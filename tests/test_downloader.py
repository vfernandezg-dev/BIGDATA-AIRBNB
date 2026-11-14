"""Descargas: verificación, reintentos e idempotencia de la zona raw."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterator
from pathlib import Path

import pytest
import requests

from airbnb_lake.context import PipelineContext
from airbnb_lake.errors import DownloadError
from airbnb_lake.ingestion import downloader
from airbnb_lake.ingestion.downloader import download_file, fetch_catalog, run_ingest
from airbnb_lake.lake.paths import RAW_MANIFEST, Partition

HOST = "https://data.insideairbnb.com"
PAYLOAD = b"neighbourhood_group,neighbourhood\n,Providencia\n,Las Condes\n"


class FakeResponse:
    def __init__(self, status: int = 200, body: bytes = b"", declared_length: int | None = None) -> None:
        self.status_code = status
        self.content = body
        length = len(body) if declared_length is None else declared_length
        self.headers = {"Content-Length": str(length)}

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")

    def iter_content(self, chunk_size: int) -> Iterator[bytes]:
        for start in range(0, len(self.content), chunk_size):
            yield self.content[start : start + chunk_size]


class FakeSession:
    """Sesión que devuelve, por URL, una secuencia de respuestas (o lanza las excepciones indicadas)."""

    def __init__(self, responses: dict[str, list[FakeResponse | Exception]]) -> None:
        self._responses = responses
        self.calls: list[str] = []

    def get(self, url: str, **_: object) -> FakeResponse:
        self.calls.append(url)
        queue = self._responses[url]
        outcome = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def download(session: FakeSession, target: Path, retries: int = 3) -> downloader.DownloadResult:
    return download_file(
        session,  # type: ignore[arg-type]
        "https://example.test/file.csv",
        target,
        timeout_seconds=5,
        max_retries=retries,
        sleep=lambda _: None,
    )


def test_download_writes_the_file_and_reports_size_and_hash(tmp_path: Path) -> None:
    target = tmp_path / "nested" / "file.csv"
    session = FakeSession({"https://example.test/file.csv": [FakeResponse(body=PAYLOAD)]})

    result = download(session, target)

    assert target.read_bytes() == PAYLOAD
    assert result.size_bytes == len(PAYLOAD)
    assert result.sha256 == hashlib.sha256(PAYLOAD).hexdigest()
    assert not target.with_name("file.csv.part").exists()


def test_transient_failures_are_retried(tmp_path: Path) -> None:
    session = FakeSession(
        {
            "https://example.test/file.csv": [
                requests.ConnectionError("corte de red"),
                FakeResponse(status=503),
                FakeResponse(body=PAYLOAD),
            ]
        }
    )

    result = download(session, tmp_path / "file.csv", retries=3)

    assert result.size_bytes == len(PAYLOAD)
    assert len(session.calls) == 3


def test_truncated_download_is_never_accepted(tmp_path: Path) -> None:
    truncated = FakeResponse(body=PAYLOAD[:10], declared_length=len(PAYLOAD))
    session = FakeSession({"https://example.test/file.csv": [truncated]})
    target = tmp_path / "file.csv"

    with pytest.raises(DownloadError, match="tras 2 intentos"):
        download(session, target, retries=2)

    assert not target.exists()
    assert not target.with_name("file.csv.part").exists()


def test_missing_file_fails_without_retrying(tmp_path: Path) -> None:
    session = FakeSession({"https://example.test/file.csv": [FakeResponse(status=404)]})

    with pytest.raises(DownloadError, match="404"):
        download(session, tmp_path / "file.csv", retries=5)

    assert len(session.calls) == 1


def test_catalog_page_is_decoded_as_utf8_even_if_the_header_does_not_say_so(ctx: PipelineContext) -> None:
    """Regresión: leída como ISO-8859-1, `bogotá` llegaba corrupta y la ciudad no se encontraba."""
    page = f'<a href="{HOST}/colombia/dc/bogotá/2026-09-14/data/listings.csv.gz">x</a>'.encode()
    session = FakeSession({ctx.config.source.catalog_url: [FakeResponse(body=page)]})

    catalog = fetch_catalog(session, ctx.config.source)  # type: ignore[arg-type]

    assert catalog.latest_snapshot("colombia/dc/bogotá", "listings") == "2026-09-14"


def test_ingest_stores_file_and_manifest_and_skips_what_is_already_in_raw(
    ctx: PipelineContext, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_url = f"{HOST}/chile/rm/santiago/2026-09-23/visualisations/neighbourhoods.csv"
    page = f'<a href="{file_url}">neighbourhoods.csv</a>'.encode()
    session = FakeSession(
        {ctx.config.source.catalog_url: [FakeResponse(body=page)], file_url: [FakeResponse(body=PAYLOAD)]}
    )
    monkeypatch.setattr(downloader, "build_session", lambda _: session)
    cities = ctx.config.select_cities(["santiago"])

    first = run_ingest(ctx, cities, ["neighbourhoods"])
    second = run_ingest(ctx, cities, ["neighbourhoods"])

    assert (first.downloaded, first.skipped) == (1, 0)
    assert (second.downloaded, second.skipped) == (0, 1)
    assert session.calls.count(file_url) == 1

    partition_uri = ctx.paths.raw_partition("neighbourhoods", Partition("santiago", "2026-09-23"))
    assert ctx.fs.read_text(f"{partition_uri}/neighbourhoods.csv").encode() == PAYLOAD
    manifest = json.loads(ctx.fs.read_text(f"{partition_uri}/{RAW_MANIFEST}"))
    assert manifest["sha256"] == hashlib.sha256(PAYLOAD).hexdigest()
    assert manifest["size_bytes"] == len(PAYLOAD)
    assert manifest["url"] == file_url
    assert not any(ctx.config.source.landing_dir.rglob("*.csv"))
