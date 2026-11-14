"""Descarga de los archivos de origen a la zona raw del lake.

Cada archivo se descarga en streaming (nunca entero en memoria) a un directorio temporal local, se verifica
su tamaño, se copia al lake de forma atómica y se deja un manifiesto con su sha256. La partición raw es
inmutable: si su manifiesto existe, no se vuelve a descargar.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import requests

from airbnb_lake.config import City, SourceConfig
from airbnb_lake.context import PipelineContext
from airbnb_lake.errors import CatalogError, DownloadError
from airbnb_lake.ingestion.catalog import Catalog, SourceFile
from airbnb_lake.lake.paths import RAW_MANIFEST

logger = logging.getLogger(__name__)

_CHUNK_BYTES = 1 << 20
_MAX_BACKOFF_SECONDS = 60.0
# Errores del cliente que no se arreglan reintentando (el archivo no existe o no está permitido).
_PERMANENT_STATUS = frozenset({400, 401, 403, 404, 410})


@dataclass(frozen=True)
class DownloadResult:
    size_bytes: int
    sha256: str


@dataclass(frozen=True)
class IngestSummary:
    downloaded: int
    skipped: int
    bytes_downloaded: int


def build_session(source: SourceConfig) -> requests.Session:
    session = requests.Session()
    # `identity` evita la compresión de transporte: los bytes recibidos son los del archivo publicado, así
    # que el tamaño y el sha256 se pueden comprobar contra el origen.
    session.headers.update({"User-Agent": source.user_agent, "Accept-Encoding": "identity"})
    return session


def fetch_catalog(session: requests.Session, source: SourceConfig) -> Catalog:
    try:
        response = session.get(source.catalog_url, timeout=source.timeout_seconds)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise CatalogError(f"No se pudo leer el catálogo {source.catalog_url}: {exc}") from exc
    # La página es UTF-8 pero no lo declara en la cabecera, y `response.text` asumiría ISO-8859-1: las rutas
    # con tildes (`bogotá`, `são-paulo`) llegarían corruptas y esas ciudades no se encontrarían.
    return Catalog.from_html(response.content.decode("utf-8", errors="replace"))


def download_file(
    session: requests.Session,
    url: str,
    target: Path,
    *,
    timeout_seconds: int,
    max_retries: int,
    sleep: Callable[[float], None] = time.sleep,
) -> DownloadResult:
    """Descarga `url` en `target`, reintentando con espera exponencial ante fallos transitorios."""
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + ".part")
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            result = _stream_to_file(session, url, partial, timeout_seconds)
        except _PermanentDownloadError as exc:
            partial.unlink(missing_ok=True)
            raise DownloadError(str(exc)) from exc
        except (requests.RequestException, _IncompleteDownloadError) as exc:
            last_error = exc
            partial.unlink(missing_ok=True)
            if attempt < max_retries:
                wait = min(2.0**attempt, _MAX_BACKOFF_SECONDS)
                logger.warning(
                    "Intento %d/%d fallido para %s (%s); reintento en %.0f s",
                    attempt,
                    max_retries,
                    url,
                    exc,
                    wait,
                )
                sleep(wait)
            continue
        partial.replace(target)
        return result

    raise DownloadError(f"No se pudo descargar {url} tras {max_retries} intentos: {last_error}")


class _PermanentDownloadError(Exception):
    pass


class _IncompleteDownloadError(Exception):
    pass


def _stream_to_file(
    session: requests.Session, url: str, target: Path, timeout_seconds: int
) -> DownloadResult:
    digest = hashlib.sha256()
    size = 0
    with session.get(url, stream=True, timeout=timeout_seconds) as response:
        if response.status_code in _PERMANENT_STATUS:
            raise _PermanentDownloadError(
                f"{url} respondió {response.status_code}: el archivo no está disponible"
            )
        response.raise_for_status()
        expected = response.headers.get("Content-Length")
        with target.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=_CHUNK_BYTES):
                handle.write(chunk)
                digest.update(chunk)
                size += len(chunk)
    if expected is not None and size != int(expected):
        raise _IncompleteDownloadError(f"se recibieron {size} bytes de {expected}")
    if size == 0:
        raise _IncompleteDownloadError("el archivo llegó vacío")
    return DownloadResult(size_bytes=size, sha256=digest.hexdigest())


def run_ingest(ctx: PipelineContext, cities: Sequence[City], datasets: Sequence[str]) -> IngestSummary:
    """Descarga a raw el último snapshot de cada ciudad y dataset que aún no esté en el lake."""
    source = ctx.config.source
    session = build_session(source)
    catalog = fetch_catalog(session, source)
    ctx.fs.write_text(
        f"{ctx.paths.catalog()}/fetched_at={ctx.run_id}.json",
        json.dumps(catalog.to_records(), ensure_ascii=False),
    )

    wanted = catalog.resolve(cities, datasets)
    pending = [
        file
        for file in wanted
        if not ctx.fs.exists(f"{ctx.paths.raw_partition(file.dataset, file.partition)}/{RAW_MANIFEST}")
    ]
    skipped = len(wanted) - len(pending)
    logger.info(
        "Archivos de origen: %d en total, %d ya en raw, %d por descargar", len(wanted), skipped, len(pending)
    )
    if not pending:
        return IngestSummary(downloaded=0, skipped=skipped, bytes_downloaded=0)

    failures: list[str] = []
    total_bytes = 0
    with ThreadPoolExecutor(max_workers=source.download_workers, thread_name_prefix="download") as pool:
        futures = {
            pool.submit(
                download_file,
                session,
                file.url,
                source.landing_dir / file.dataset / file.city / file.snapshot_date / file.filename,
                timeout_seconds=source.timeout_seconds,
                max_retries=source.max_retries,
            ): file
            for file in pending
        }
        # La copia al lake se hace en este hilo, a medida que termina cada descarga.
        for future in as_completed(futures):
            file = futures[future]
            local = source.landing_dir / file.dataset / file.city / file.snapshot_date / file.filename
            try:
                result = future.result()
                _store_in_raw(ctx, file, local, result)
            except DownloadError as exc:
                failures.append(f"{file.city}/{file.dataset}: {exc}")
                logger.error("Descarga fallida %s/%s: %s", file.city, file.dataset, exc)
                continue
            finally:
                local.unlink(missing_ok=True)
            total_bytes += result.size_bytes
            logger.info(
                "raw <- %s/%s snapshot %s (%.1f MB)",
                file.city,
                file.dataset,
                file.snapshot_date,
                result.size_bytes / 1e6,
            )

    if failures:
        raise DownloadError(f"{len(failures)} de {len(pending)} descargas fallaron: " + "; ".join(failures))
    return IngestSummary(downloaded=len(pending), skipped=skipped, bytes_downloaded=total_bytes)


def _store_in_raw(ctx: PipelineContext, file: SourceFile, local: Path, result: DownloadResult) -> None:
    partition_uri = ctx.paths.raw_partition(file.dataset, file.partition)
    ctx.fs.mkdirs(partition_uri)
    ctx.fs.put(local, f"{partition_uri}/{file.filename}")
    manifest = {
        **asdict(file),
        **asdict(result),
        "downloaded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    # El manifiesto se escribe al final: su presencia es la señal de que la partición está completa.
    ctx.fs.write_text(f"{partition_uri}/{RAW_MANIFEST}", json.dumps(manifest, ensure_ascii=False, indent=2))
