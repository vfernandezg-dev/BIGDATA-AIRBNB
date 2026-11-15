"""Marts de Gold, segmentación y validaciones de calidad."""

from __future__ import annotations

import pytest
from pyspark.sql import DataFrame, SparkSession

from airbnb_lake import quality
from airbnb_lake.config import PipelineConfig, SegmentationConfig
from airbnb_lake.errors import DataQualityError
from airbnb_lake.gold import marts
from airbnb_lake.gold.segmentation import segment_neighbourhoods
from airbnb_lake.schemas import CALENDAR, LISTINGS, REVIEWS
from airbnb_lake.silver.job import cities_dimension, fx_dimension
from airbnb_lake.silver.listings import build_listings
from airbnb_lake.silver.tables import build_calendar_monthly, build_reviews
from tests.helpers import bronze_frame, calendar_rows, listing, review


def usd_to_clp(config: PipelineConfig, usd: float) -> str:
    return f"{usd * config.fx.units_per_usd['CLP']:.4f}"


@pytest.fixture
def listings(spark: SparkSession, config: PipelineConfig) -> DataFrame:
    """Diez anuncios en Santiago con precio (15, 25, ..., 105 USD) y uno sin él; dos barrios."""
    rows = [
        listing(
            i,
            price=usd_to_clp(config, i * 10 + 5),
            neighbourhood_cleansed="Providencia" if i <= 6 else "Ñuñoa",
            room_type="Entire home/apt" if i % 2 == 0 else "Private room",
            host_id="500" if i <= 3 else str(600 + i),
            calculated_host_listings_count="3" if i <= 3 else "1",
            latitude=f"{-33.4301 - i * 0.001:.4f}",
            longitude="-70.6101",
        )
        for i in range(1, 11)
    ]
    rows.append(listing(11, price=None, neighbourhood_cleansed="Providencia"))
    bronze = bronze_frame(spark, LISTINGS, rows)
    return build_listings(
        bronze, cities_dimension(spark, config), fx_dimension(spark, config), config.cleaning
    )


def test_city_kpis(listings: DataFrame) -> None:
    row = marts.city_kpis(listings).first()

    assert row is not None
    assert (row["n_listings"], row["n_hosts"]) == (11, 9)
    assert row["n_priced"] == 10
    assert row["median_price_usd"] == pytest.approx(60, abs=10)
    assert row["pct_entire_home"] == pytest.approx(6 / 11)
    assert row["pct_multi_listing"] == pytest.approx(3 / 11)


def test_price_histogram_has_an_open_last_bucket(listings: DataFrame, config: PipelineConfig) -> None:
    from dataclasses import replace

    gold = replace(config.gold, price_histogram_bucket_usd=20, price_histogram_max_usd=60)
    rows = marts.price_histogram(listings, gold).collect()

    buckets: dict[int, tuple[int | None, int]] = {}
    for row in rows:
        upper, count = buckets.get(row["bucket_from_usd"], (row["bucket_to_usd"], 0))
        buckets[row["bucket_from_usd"]] = (upper, count + row["n_listings"])

    # El tramo de 60 es abierto: acumula 65, 75, 85, 95 y 105 USD.
    assert buckets == {0: (20, 1), 20: (40, 2), 40: (60, 2), 60: (None, 5)}


def test_map_grid_groups_listings_into_cells(listings: DataFrame) -> None:
    rows = marts.map_grid(listings, cell_degrees=0.005).collect()

    assert sum(row["n_listings"] for row in rows) == 11
    assert len(rows) < 11
    for row in rows:
        # El centro de la celda queda a media celda de un múltiplo exacto del tamaño.
        assert (abs(row["cell_lat"]) / 0.005) % 1 == pytest.approx(0.5, abs=1e-6)


def test_host_concentration_buckets(listings: DataFrame) -> None:
    rows = {
        row["bucket_label"]: (row["n_hosts"], row["n_listings"])
        for row in marts.host_concentration(listings).collect()
    }

    assert rows == {"1": (8, 8), "3-5": (1, 3)}


def test_neighbourhood_stats_filters_small_neighbourhoods(listings: DataFrame) -> None:
    rows = {
        row["neighbourhood"]: row for row in marts.neighbourhood_stats(listings, min_listings=5).collect()
    }

    assert set(rows) == {"Providencia"}
    assert rows["Providencia"]["n_listings"] == 7
    assert rows["Providencia"]["listings_share"] == pytest.approx(7 / 11)
    assert rows["Providencia"]["price_vs_city"] < 1


def test_room_type_shares_add_up_to_one(listings: DataFrame) -> None:
    rows = marts.room_type_stats(listings).collect()

    assert sum(row["listings_share"] for row in rows) == pytest.approx(1.0)


def test_monthly_marts(spark: SparkSession) -> None:
    calendar = build_calendar_monthly(
        bronze_frame(
            spark,
            CALENDAR,
            calendar_rows(1, [("2026-10-01", "t"), ("2026-10-02", "f")])
            + calendar_rows(2, [("2026-10-01", "t")]),
        )
    )
    reviews = build_reviews(
        bronze_frame(
            spark,
            REVIEWS,
            [review(1, 1, "2026-01-05"), review(2, 1, "2026-01-20"), review(3, 2, "2026-02-01")],
        )
    )

    availability = marts.availability_monthly(calendar).first()
    monthly = {
        str(row["month"]): (row["n_reviews"], row["n_listings_reviewed"])
        for row in marts.reviews_monthly(reviews).collect()
    }

    assert availability is not None
    assert (availability["n_listings"], availability["days_total"], availability["days_available"]) == (
        2,
        3,
        2,
    )
    assert availability["availability_rate"] == pytest.approx(2 / 3)
    assert monthly == {"2026-01-01": (2, 1), "2026-02-01": (1, 1)}


def test_segmentation_orders_segments_by_relative_price(spark: SparkSession) -> None:
    cheap = [("a", f"barato-{i}", 0.6 + i * 0.01, 2.0, 200.0, 0.4, 0.02) for i in range(10)]
    expensive = [("a", f"caro-{i}", 1.8 + i * 0.01, 0.5, 100.0, 0.9, 0.05) for i in range(10)]
    neighbourhoods = spark.createDataFrame(
        cheap + expensive,
        "city string, neighbourhood string, price_vs_city double, avg_reviews_per_month double, "
        "avg_availability_365 double, pct_entire_home double, listings_share double",
    )

    result = segment_neighbourhoods(neighbourhoods, SegmentationConfig(k_candidates=(2, 3), seed=42))

    assert result is not None
    assert result.k == 2
    assert result.silhouette is not None
    assert result.silhouette > 0.8
    segments = {row["neighbourhood"]: row["segment"] for row in result.assignments.collect()}
    assert {segments[f"barato-{i}"] for i in range(10)} == {1}
    assert {segments[f"caro-{i}"] for i in range(10)} == {2}
    profiles = {row["segment"]: row for row in result.profiles.collect()}
    assert profiles[1]["avg_price_vs_city"] < profiles[2]["avg_price_vs_city"]


def test_segmentation_does_not_depend_on_how_rows_are_partitioned(spark: SparkSession) -> None:
    """Regresión: con los mismos datos, dos corridas elegían un número distinto de segmentos."""
    rows = [
        (
            "a",
            f"barrio-{i:03d}",
            0.5 + (i * 37 % 100) / 60,
            (i * 13 % 50) / 10,
            100.0 + i * 7 % 250,
            (i * 29 % 100) / 100,
            0.01,
        )
        for i in range(120)
    ]
    schema = (
        "city string, neighbourhood string, price_vs_city double, avg_reviews_per_month double, "
        "avg_availability_365 double, pct_entire_home double, listings_share double"
    )
    config = SegmentationConfig(k_candidates=(3, 4, 5), seed=42)

    def segments(frame: DataFrame) -> tuple[int, dict[str, int]]:
        result = segment_neighbourhoods(frame, config)
        assert result is not None
        return result.k, {row["neighbourhood"]: row["segment"] for row in result.assignments.collect()}

    one_partition = segments(spark.createDataFrame(rows, schema).repartition(1))
    many_partitions = segments(spark.createDataFrame(list(reversed(rows)), schema).repartition(7))

    assert one_partition == many_partitions


def test_segmentation_is_skipped_without_enough_neighbourhoods(spark: SparkSession) -> None:
    neighbourhoods = spark.createDataFrame(
        [("a", "único", 1.0, 1.0, 100.0, 0.5, 1.0)],
        "city string, neighbourhood string, price_vs_city double, avg_reviews_per_month double, "
        "avg_availability_365 double, pct_entire_home double, listings_share double",
    )

    assert segment_neighbourhoods(neighbourhoods, SegmentationConfig(k_candidates=(2, 3), seed=42)) is None


def test_quality_summary_passes_for_clean_data(listings: DataFrame) -> None:
    summary = quality.listing_quality(listings)

    quality.assert_listings_quality(summary, ["santiago"])
    row = summary.first()
    assert row is not None
    assert (row["n_listings"], row["n_with_price"], row["n_model_eligible"]) == (11, 10, 10)


def test_quality_fails_when_a_city_is_missing(listings: DataFrame) -> None:
    with pytest.raises(DataQualityError, match="madrid"):
        quality.assert_listings_quality(quality.listing_quality(listings), ["santiago", "madrid"])


def test_quality_detects_shifted_columns(spark: SparkSession, config: PipelineConfig) -> None:
    """Si el CSV se leyera mal, `room_type` contendría precios o coordenadas, como en el proyecto original."""
    rows = [listing(i, room_type="43000" if i <= 3 else "Entire home/apt") for i in range(1, 21)]
    bronze = bronze_frame(spark, LISTINGS, rows)
    silver = build_listings(
        bronze, cities_dimension(spark, config), fx_dimension(spark, config), config.cleaning
    )

    with pytest.raises(DataQualityError, match="columnas desplazadas"):
        quality.assert_listings_quality(quality.listing_quality(silver), ["santiago"])


def test_calendar_with_duplicated_dates_is_rejected(spark: SparkSession) -> None:
    calendar = spark.createDataFrame([("santiago", 1, 62)], "city string, listing_id long, days int")

    with pytest.raises(DataQualityError, match="62"):
        quality.assert_calendar_quality(calendar)
