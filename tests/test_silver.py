"""Silver: tipado, precio en USD, deduplicación y flags de calidad."""

from __future__ import annotations

import pytest
from pyspark.sql import DataFrame, SparkSession

from airbnb_lake.config import PipelineConfig
from airbnb_lake.schemas import CALENDAR, LISTINGS, REVIEWS
from airbnb_lake.silver.job import cities_dimension, fx_dimension
from airbnb_lake.silver.listings import build_listings
from airbnb_lake.silver.tables import build_calendar_monthly, build_reviews
from tests.helpers import bronze_frame, calendar_rows, listing, review


def silver_listings(
    spark: SparkSession, config: PipelineConfig, rows: list[dict[str, str | None]]
) -> DataFrame:
    bronze = bronze_frame(spark, LISTINGS, rows)
    return build_listings(
        bronze, cities_dimension(spark, config), fx_dimension(spark, config), config.cleaning
    )


def by_id(df: DataFrame) -> dict[int, dict[str, object]]:
    return {row["listing_id"]: row.asDict() for row in df.collect()}


def test_price_is_converted_to_usd_with_the_quoted_currency(
    spark: SparkSession, config: PipelineConfig
) -> None:
    clp = config.fx.units_per_usd["CLP"]
    eur = config.fx.units_per_usd["EUR"]
    rows = [
        # Sin cotización: se usa la moneda configurada para la ciudad (CLP).
        listing(1, price="$99,212.55"),
        # Con cotización: manda la moneda que declara el propio anuncio.
        listing(2, price="$90.60", price_quote_raw='{"quote": {"currency": "EUR"}}'),
        listing(3, price=None),
    ]

    result = by_id(silver_listings(spark, config, rows))

    assert result[1]["currency"] == "CLP"
    assert result[1]["price_usd"] == pytest.approx(99212.55 / clp)
    assert result[2]["currency"] == "EUR"
    assert result[2]["price_usd"] == pytest.approx(90.60 / eur)
    assert result[3]["price_usd"] is None
    assert result[3]["has_valid_price"] is False
    assert result[3]["is_model_eligible"] is False


def test_columns_are_typed(spark: SparkSession, config: PipelineConfig) -> None:
    rows = [
        listing(
            1352055619826961511,
            bathrooms_text="1.5 shared baths",
            amenities='["Wifi", "Dishwasher", "Pool table"]',
            host_is_superhost="t",
            license=None,
        )
    ]

    row = silver_listings(spark, config, rows).first()

    assert row is not None
    assert row["listing_id"] == 1352055619826961511
    assert row["bathrooms"] == 1.5
    assert row["has_shared_bathroom"] is True
    assert row["amenities_count"] == 3
    assert (row["has_wifi"], row["has_dishwasher"], row["has_washer"], row["has_pool"]) == (
        True,
        True,
        False,
        False,
    )
    assert row["host_is_superhost"] is True
    assert row["host_tenure_years"] == pytest.approx(3.5)
    assert row["has_license"] is False
    assert row["neighbourhood"] == "Providencia"
    assert (row["city_name"], row["country"]) == ("Santiago", "Chile")


def test_one_row_per_listing_keeps_the_latest_scrape(spark: SparkSession, config: PipelineConfig) -> None:
    rows = [
        listing(1, last_scraped="2026-09-20", name="antiguo"),
        listing(1, last_scraped="2026-09-26", name="reciente"),
        listing(None, name="fila corrupta sin id"),
    ]

    result = silver_listings(spark, config, rows).collect()

    assert [(row["listing_id"], row["name"]) for row in result] == [(1, "reciente")]


def test_price_outliers_are_flagged_per_city(spark: SparkSession, config: PipelineConfig) -> None:
    clp = config.fx.units_per_usd["CLP"]
    eur = config.fx.units_per_usd["EUR"]
    # 200 anuncios por ciudad con precios de 51 a 250 USD, y uno absurdo en cada extremo.
    santiago = [listing(i, price=f"{(50 + i) * clp:.2f}") for i in range(1, 201)]
    santiago += [listing(900, price=f"{0.5 * clp:.2f}"), listing(901, price=f"{90000 * clp:.2f}")]
    madrid = [
        listing(i, city="madrid", price=f"{(50 + i) * eur:.2f}", latitude="40.41", longitude="-3.70")
        for i in range(1, 201)
    ]

    result = silver_listings(spark, config, santiago + madrid)
    flagged = {(row["city"], row["listing_id"]) for row in result.where("is_price_outlier").collect()}

    assert ("santiago", 900) in flagged
    assert ("santiago", 901) in flagged
    # Los cuantiles 1% y 99% dejan fuera, como mucho, un puñado de valores en cada cola.
    assert len(flagged) <= 10
    assert result.where("city = 'madrid' AND NOT is_price_outlier").count() >= 195


def test_quality_flags(spark: SparkSession, config: PipelineConfig) -> None:
    base = [listing(i) for i in range(1, 30)]
    rows = [
        *base,
        listing(100, latitude="40.41", longitude="-3.70"),  # coordenadas de Madrid en Santiago
        listing(101, room_type="43000"),  # columna desplazada en el origen
        listing(102, minimum_nights="1000"),
        listing(103, availability_365="400"),
        listing(104, accommodates="0"),
    ]

    result = by_id(silver_listings(spark, config, rows))

    assert result[1]["is_model_eligible"] is True
    assert result[1]["km_from_center"] == pytest.approx(0.0, abs=0.01)
    assert result[100]["is_geo_valid"] is False
    assert result[101]["is_room_type_valid"] is False
    assert result[102]["is_min_nights_valid"] is False
    assert result[103]["is_availability_valid"] is False
    for listing_id in (100, 101, 102, 103, 104):
        assert result[listing_id]["is_model_eligible"] is False


def test_calendar_is_aggregated_to_listing_month(spark: SparkSession) -> None:
    rows = calendar_rows(
        1, [("2026-10-01", "t"), ("2026-10-02", "f"), ("2026-10-03", "t"), ("2026-11-01", "f")]
    )
    rows += calendar_rows(2, [("2026-10-01", "t"), ("fecha rota", "t")])

    result = {
        (row["listing_id"], str(row["month"])): (row["days"], row["days_available"])
        for row in build_calendar_monthly(bronze_frame(spark, CALENDAR, rows)).collect()
    }

    assert result == {(1, "2026-10-01"): (3, 2), (1, "2026-11-01"): (1, 0), (2, "2026-10-01"): (1, 1)}


def test_reviews_drop_duplicates_and_personal_data(spark: SparkSession) -> None:
    rows = [
        review(10, 1, "2026-01-05", comments="Excelente"),
        review(10, 1, "2026-01-05", comments="Excelente"),
        review(11, 1, "2026-02-01", comments=None),
        review(None, 1, "2026-02-02"),
    ]

    result = build_reviews(bronze_frame(spark, REVIEWS, rows))

    assert "comments" not in result.columns
    assert "reviewer_name" not in result.columns
    assert {(row["review_id"], row["comment_length"]) for row in result.collect()} == {(10, 9), (11, 0)}
