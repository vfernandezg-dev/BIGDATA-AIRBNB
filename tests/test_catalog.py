"""Catálogo de Inside Airbnb: extracción de enlaces y resolución de ciudades."""

from __future__ import annotations

import pytest

from airbnb_lake.config import City
from airbnb_lake.errors import CatalogError
from airbnb_lake.ingestion.catalog import Catalog, normalize_source_path

HOST = "https://data.insideairbnb.com"
PAGE = f"""
<table>
  <tr><td><a href="{HOST}/chile/rm/santiago/2026-09-23/data/listings.csv.gz">listings.csv.gz</a></td></tr>
  <tr><td><a href="{HOST}/chile/rm/santiago/2026-09-23/data/calendar.csv.gz">calendar.csv.gz</a></td></tr>
  <tr><td><a href="{HOST}/chile/rm/santiago/2026-06-20/data/listings.csv.gz">listings.csv.gz</a></td></tr>
  <tr><td><a href="{HOST}/chile/rm/santiago/2026-09-23/visualisations/neighbourhoods.csv">neighbourhoods.csv</a></td></tr>
  <tr><td><a href="{HOST}/brazil/sp/s%C3%A3o-paulo/2026-09-14/data/listings.csv.gz">listings.csv.gz</a></td></tr>
  <tr><td><a href="{HOST}/colombia/dc/bogotá/2026-09-14/data/listings.csv.gz">listings.csv.gz</a></td></tr>
  <tr><td><a href="{HOST}/ireland/2026-09-17/data/listings.csv.gz">listings.csv.gz</a></td></tr>
</table>
"""

SANTIAGO = City("santiago", "Santiago", "Chile", "chile/rm/santiago", "CLP")
SAO_PAULO = City("sao-paulo", "São Paulo", "Brasil", "brazil/sp/são-paulo", "BRL")
BOGOTA = City("bogota", "Bogotá", "Colombia", "colombia/dc/bogotá", "COP")


def test_latest_snapshot_picks_the_most_recent_date() -> None:
    catalog = Catalog.from_html(PAGE)
    assert catalog.latest_snapshot("chile/rm/santiago", "listings") == "2026-09-23"


def test_paths_with_accents_match_whether_or_not_they_are_url_encoded() -> None:
    catalog = Catalog.from_html(PAGE)
    assert catalog.latest_snapshot("brazil/sp/são-paulo", "listings") == "2026-09-14"
    assert catalog.latest_snapshot("colombia/dc/bogotá", "listings") == "2026-09-14"
    assert normalize_source_path("Brazil/SP/s%C3%A3o-paulo/") == "brazil/sp/são-paulo"


def test_country_level_paths_are_recognised() -> None:
    assert "ireland" in Catalog.from_html(PAGE).source_paths()


def test_resolve_builds_encoded_urls_per_dataset() -> None:
    files = Catalog.from_html(PAGE).resolve([SANTIAGO, SAO_PAULO], ["listings"])
    assert [(file.city, file.snapshot_date) for file in files] == [
        ("santiago", "2026-09-23"),
        ("sao-paulo", "2026-09-14"),
    ]
    assert files[0].url == f"{HOST}/chile/rm/santiago/2026-09-23/data/listings.csv.gz"
    # La URL que se descarga va siempre codificada, aunque la ruta configurada lleve tildes.
    assert files[1].url == f"{HOST}/brazil/sp/s%C3%A3o-paulo/2026-09-14/data/listings.csv.gz"


def test_resolve_fails_before_downloading_when_a_file_is_not_published() -> None:
    with pytest.raises(CatalogError, match="bogota/calendar"):
        Catalog.from_html(PAGE).resolve([SANTIAGO, BOGOTA], ["listings", "calendar"])


def test_page_without_links_is_reported_as_a_format_change() -> None:
    with pytest.raises(CatalogError, match="cambiado de formato"):
        Catalog.from_html("<html><body>Mantenimiento</body></html>")
