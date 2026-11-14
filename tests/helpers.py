"""Constructores de datos de prueba con la forma de las tablas Bronze."""

from __future__ import annotations

import csv
import gzip
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path

from pyspark.sql import DataFrame, SparkSession

from airbnb_lake.schemas import CALENDAR, LISTINGS, REVIEWS, DatasetContract

SNAPSHOT = "2026-09-23"

_LISTING_DEFAULTS: dict[str, str | None] = {
    "last_scraped": "2026-09-26",
    "host_id": "100",
    "host_is_superhost": "f",
    "host_identity_verified": "t",
    "host_listings_count": "1",
    "calculated_host_listings_count": "1",
    "hosts_time_as_host_years": "3",
    "hosts_time_as_host_months": "6",
    "neighbourhood_cleansed": "Providencia",
    "latitude": "-33.43",
    "longitude": "-70.61",
    "property_type": "Entire rental unit",
    "room_type": "Entire home/apt",
    "accommodates": "2",
    "bathrooms_text": "1 bath",
    "bedrooms": "1",
    "beds": "1",
    "amenities": '["Wifi", "Kitchen"]',
    "price": "$50,000.00",
    "minimum_nights": "2",
    "maximum_nights": "365",
    "has_availability": "t",
    "availability_30": "10",
    "availability_60": "20",
    "availability_90": "30",
    "availability_365": "200",
    "number_of_reviews": "12",
    "number_of_reviews_ltm": "4",
    "number_of_reviews_l30d": "1",
    "reviews_per_month": "0.5",
    "review_scores_rating": "4.8",
    "estimated_occupancy_l365d": "90",
}


def listing(
    listing_id: int | str | None, *, city: str = "santiago", **overrides: str | None
) -> dict[str, str | None]:
    """Una fila de Bronze de anuncios: todas las columnas del contrato, en texto."""
    row: dict[str, str | None] = dict.fromkeys(LISTINGS.columns)
    row.update(_LISTING_DEFAULTS)
    row["id"] = None if listing_id is None else str(listing_id)
    row.update(overrides)
    row["city"] = city
    row["snapshot_date"] = SNAPSHOT
    return row


def bronze_frame(
    spark: SparkSession, contract: DatasetContract, rows: Iterable[Mapping[str, str | None]]
) -> DataFrame:
    """DataFrame con el esquema de Bronze: columnas del contrato en texto + partición."""
    columns = [*contract.columns, "city", "snapshot_date"]
    schema = ", ".join(f"`{column}` string" for column in columns)
    data = [tuple(row.get(column) for column in columns) for row in rows]
    return spark.createDataFrame(data, schema).withColumn("snapshot_date", _as_date("snapshot_date"))


def calendar_rows(
    listing_id: int, days: Sequence[tuple[str, str]], *, city: str = "santiago"
) -> list[dict[str, str | None]]:
    return [
        {
            **dict.fromkeys(CALENDAR.columns),
            "listing_id": str(listing_id),
            "date": day,
            "available": available,
            "city": city,
            "snapshot_date": SNAPSHOT,
        }
        for day, available in days
    ]


def review(
    review_id: int | None, listing_id: int, day: str, *, comments: str | None = "Muy bien"
) -> dict[str, str | None]:
    return {
        **dict.fromkeys(REVIEWS.columns),
        "id": None if review_id is None else str(review_id),
        "listing_id": str(listing_id),
        "date": day,
        "reviewer_id": "7",
        "reviewer_name": "Ana",
        "comments": comments,
        "city": "santiago",
        "snapshot_date": SNAPSHOT,
    }


def write_csv_gz(path: Path, header: Sequence[str], rows: Iterable[Sequence[str]]) -> None:
    """Escribe un CSV comprimido como los de Inside Airbnb (RFC 4180, comillas duplicadas)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def _as_date(column: str):  # type: ignore[no-untyped-def]
    from pyspark.sql import functions as F

    return F.col(column).cast("date")
