"""Catálogo de descargas de Inside Airbnb.

La página https://insideairbnb.com/get-the-data/ enlaza los archivos de cada ciudad con esta forma:

    https://data.insideairbnb.com/<país>/<región>/<ciudad>/<AAAA-MM-DD>/<data|visualisations>/<archivo>

Solo publica el snapshot más reciente de cada ciudad, y los anteriores dejan de estar disponibles: por eso
la zona raw del lake conserva cada snapshot descargado.
"""

from __future__ import annotations

import html
import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from urllib.parse import quote, unquote

from airbnb_lake.config import City
from airbnb_lake.errors import CatalogError
from airbnb_lake.lake.paths import Partition
from airbnb_lake.schemas import CONTRACTS

_DATA_HOST = "https://data.insideairbnb.com"
_LINK_PATTERN = re.compile(
    r"https?://data\.insideairbnb\.com/"
    r"(?P<path>[^\"'<>\s]+?)/"
    r"(?P<date>\d{4}-\d{2}-\d{2})/"
    r"(?P<folder>data|visualisations)/"
    r"(?P<file>[A-Za-z0-9_.\-]+)"
)


@dataclass(frozen=True)
class SourceFile:
    """Un archivo de origen ya resuelto: qué es, de qué ciudad y snapshot, y dónde descargarlo."""

    dataset: str
    city: str
    snapshot_date: str
    filename: str
    url: str

    @property
    def partition(self) -> Partition:
        return Partition(self.city, self.snapshot_date)


def normalize_source_path(path: str) -> str:
    """Forma canónica de la ruta de una ciudad: sin codificación de URL, en NFC y en minúsculas.

    Las rutas llevan tildes (`são-paulo`, `bogotá`) y pueden aparecer codificadas o no en el HTML.
    """
    return unicodedata.normalize("NFC", unquote(html.unescape(path))).strip("/").lower()


class Catalog:
    """Snapshots disponibles por ciudad y archivo, extraídos del HTML de la página de descargas."""

    def __init__(self, snapshots: dict[tuple[str, str, str], set[str]]) -> None:
        self._snapshots = snapshots

    @classmethod
    def from_html(cls, page: str) -> Catalog:
        snapshots: dict[tuple[str, str, str], set[str]] = {}
        for match in _LINK_PATTERN.finditer(page):
            key = (normalize_source_path(match["path"]), match["folder"], match["file"])
            snapshots.setdefault(key, set()).add(match["date"])
        if not snapshots:
            raise CatalogError(
                "La página de Inside Airbnb no contiene enlaces de descarga reconocibles: "
                "puede haber cambiado de formato"
            )
        return cls(snapshots)

    def source_paths(self) -> set[str]:
        return {path for path, _, _ in self._snapshots}

    def latest_snapshot(self, source_path: str, dataset: str) -> str | None:
        contract = CONTRACTS[dataset]
        key = (normalize_source_path(source_path), contract.source_folder, contract.source_file)
        dates = self._snapshots.get(key)
        return max(dates) if dates else None

    def resolve(self, cities: Iterable[City], datasets: Iterable[str]) -> list[SourceFile]:
        """Archivos del último snapshot de cada ciudad. Falla si falta alguno: mejor antes de descargar."""
        resolved: list[SourceFile] = []
        missing: list[str] = []
        wanted_datasets = tuple(datasets)
        for city in cities:
            for dataset in wanted_datasets:
                snapshot = self.latest_snapshot(city.source_path, dataset)
                if snapshot is None:
                    missing.append(f"{city.slug}/{dataset}")
                    continue
                contract = CONTRACTS[dataset]
                encoded_path = quote(normalize_source_path(city.source_path), safe="/")
                resolved.append(
                    SourceFile(
                        dataset=dataset,
                        city=city.slug,
                        snapshot_date=snapshot,
                        filename=contract.source_file,
                        url=f"{_DATA_HOST}/{encoded_path}/{snapshot}/{contract.source_folder}/{contract.source_file}",
                    )
                )
        if missing:
            raise CatalogError(
                f"El catálogo no publica: {', '.join(missing)}. Revisa `source_path` en cities.yaml "
                f"({len(self.source_paths())} ciudades disponibles en el catálogo)"
            )
        return resolved

    def to_records(self) -> list[dict[str, object]]:
        """Representación serializable: deja constancia de lo que publicaba el origen en cada corrida."""
        return [
            {"source_path": path, "folder": folder, "file": file, "snapshot_dates": sorted(dates)}
            for (path, folder, file), dates in sorted(self._snapshots.items())
        ]
