"""Conversores de texto a tipos: cada caso es un valor real visto en los archivos de Inside Airbnb."""

from __future__ import annotations

import pytest
from pyspark.sql import Column, SparkSession
from pyspark.sql import functions as F

from airbnb_lake.silver import parsing as p


def evaluate(spark: SparkSession, expression: Column, value: str | None) -> object:
    row = spark.createDataFrame([(value,)], "raw string").select(expression.alias("out")).first()
    assert row is not None
    return row["out"]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("$59,303.00", 59303.0),
        ("$65.00", 65.0),
        ("1,234,567.50", 1234567.5),
        ("", None),
        (None, None),
        ("sin precio", None),
    ],
)
def test_parse_money(spark: SparkSession, raw: str | None, expected: float | None) -> None:
    assert evaluate(spark, p.parse_money(F.col("raw")), raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1 bath", 1.0),
        ("1.5 shared baths", 1.5),
        ("2 baths", 2.0),
        ("0 baths", 0.0),
        ("Half-bath", 0.5),
        ("Shared half-bath", 0.5),
        ("", None),
        (None, None),
    ],
)
def test_parse_bathrooms(spark: SparkSession, raw: str | None, expected: float | None) -> None:
    assert evaluate(spark, p.parse_bathrooms(F.col("raw")), raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"), [("t", True), ("f", False), ("T", True), ("", None), ("x", None)]
)
def test_to_bool(spark: SparkSession, raw: str, expected: bool | None) -> None:
    assert evaluate(spark, p.to_bool(F.col("raw")), raw) is expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("1352055619826961511", 1352055619826961511), (" 42 ", 42), ("4.5", None), ("abc", None)],
)
def test_to_long_keeps_19_digit_ids(spark: SparkSession, raw: str, expected: int | None) -> None:
    assert evaluate(spark, p.to_long(F.col("raw")), raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"), [("2", 2), ("2.0", 2), ("2147483647", 2147483647), ("n/a", None)]
)
def test_to_int(spark: SparkSession, raw: str, expected: int | None) -> None:
    assert evaluate(spark, p.to_int(F.col("raw")), raw) == expected


def test_to_date_rejects_non_iso_values(spark: SparkSession) -> None:
    assert str(evaluate(spark, p.to_date(F.col("raw")), "2026-09-23")) == "2026-09-23"
    assert evaluate(spark, p.to_date(F.col("raw")), "23/09/2026") is None


def test_parse_percent(spark: SparkSession) -> None:
    assert evaluate(spark, p.parse_percent(F.col("raw")), "95%") == pytest.approx(0.95)
    assert evaluate(spark, p.parse_percent(F.col("raw")), "N/A") is None


@pytest.mark.parametrize(
    ("amenities", "pattern", "expected"),
    [
        ('["Wifi", "Dishwasher"]', r"(?<!dish)washer", False),
        ('["Free washer – In unit"]', r"(?<!dish)washer", True),
        ('["Hair dryer"]', r"(?<!hair )dryer", False),
        ('["Dryer"]', r"(?<!hair )dryer", True),
        ('["Pool table"]', r"\bpool\b(?! table)", False),
        ('["Shared outdoor pool"]', r"\bpool\b(?! table)", True),
        (None, r"wifi", False),
    ],
)
def test_has_amenity_avoids_common_false_positives(
    spark: SparkSession, amenities: str | None, pattern: str, expected: bool
) -> None:
    assert evaluate(spark, p.has_amenity(F.lower(F.col("raw")), pattern), amenities) is expected


def test_parse_amenities_counts_items(spark: SparkSession) -> None:
    assert evaluate(spark, F.size(p.parse_amenities(F.col("raw"))), '["Wifi", "Kitchen", "TV"]') == 3
    assert evaluate(spark, F.size(p.parse_amenities(F.col("raw"))), "[]") == 0


def test_haversine_km_matches_known_distance(spark: SparkSession) -> None:
    # Plaza de Armas de Santiago a la Plaza de Mayo de Buenos Aires: unos 1.137 km.
    row = (
        spark.range(1)
        .select(
            p.haversine_km(F.lit(-33.4378), F.lit(-70.6505), F.lit(-34.6083), F.lit(-58.3712)).alias("km")
        )
        .first()
    )
    assert row is not None
    assert row["km"] == pytest.approx(1137, rel=0.01)
