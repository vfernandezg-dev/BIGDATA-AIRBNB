"""Modelo de precios: variables, reparto train/test y métricas."""

from __future__ import annotations

import math

import pytest
from pyspark.sql import DataFrame, SparkSession

from airbnb_lake.config import PipelineConfig
from airbnb_lake.ml import evaluate
from airbnb_lake.ml.features import (
    CATEGORICAL_FEATURES,
    FORBIDDEN_FEATURES,
    LABEL,
    NUMERIC_FEATURES,
    OTHER_PROPERTY_GROUP,
    SPLIT,
    build_model_frame,
    select_numeric_features,
)
from airbnb_lake.schemas import LISTINGS
from airbnb_lake.silver.job import cities_dimension, fx_dimension
from airbnb_lake.silver.listings import build_listings
from tests.helpers import bronze_frame, listing


def test_no_feature_leaks_the_price() -> None:
    assert FORBIDDEN_FEATURES.isdisjoint(NUMERIC_FEATURES)
    assert FORBIDDEN_FEATURES.isdisjoint(CATEGORICAL_FEATURES)
    assert not [feature for feature in NUMERIC_FEATURES if "price" in feature or "revenue" in feature]
    assert len(set(NUMERIC_FEATURES)) == len(NUMERIC_FEATURES)


@pytest.fixture
def model_frame(spark: SparkSession, config: PipelineConfig) -> DataFrame:
    clp = config.fx.units_per_usd["CLP"]
    rows = [
        listing(
            i,
            price=f"{(40 + i % 50) * clp:.2f}",
            accommodates=str(1 + i % 6),
            property_type="Entire rental unit" if i % 10 else f"Casa rara {i}",
        )
        for i in range(1, 401)
    ]
    rows.append(listing(1000, price=None))
    bronze = bronze_frame(spark, LISTINGS, rows)
    silver = build_listings(
        bronze, cities_dimension(spark, config), fx_dimension(spark, config), config.cleaning
    )
    from dataclasses import replace

    return build_model_frame(silver, replace(config.ml, top_property_types=1)).cache()


def test_model_frame_keeps_only_eligible_listings_with_log_label(model_frame: DataFrame) -> None:
    rows = model_frame.collect()

    assert 1000 not in {row["listing_id"] for row in rows}
    for row in rows[:20]:
        assert row[LABEL] == pytest.approx(math.log1p(row["price_usd"]))
    assert {row["property_group"] for row in rows} == {"Entire rental unit", OTHER_PROPERTY_GROUP}


def test_split_is_deterministic_and_close_to_the_requested_fraction(
    model_frame: DataFrame, spark: SparkSession, config: PipelineConfig
) -> None:
    first = {row["listing_id"]: row[SPLIT] for row in model_frame.collect()}
    # Reordenar y reparticionar no cambia a qué conjunto va cada anuncio.
    second = {
        row["listing_id"]: row[SPLIT] for row in model_frame.repartition(7).orderBy("price_usd").collect()
    }

    assert first == second
    train_share = sum(1 for split in first.values() if split == "train") / len(first)
    assert train_share == pytest.approx(config.ml.train_fraction, abs=0.07)


def test_empty_features_are_dropped_automatically(model_frame: DataFrame) -> None:
    kept = select_numeric_features(model_frame.where(f"{SPLIT} = 'train'"), min_fill_rate=0.5)

    # `instant_bookable` llega vacía en el origen; `accommodates` siempre viene informada.
    assert "instant_bookable" not in kept
    assert "accommodates" in kept
    assert "km_from_center" in kept


def predictions(spark: SparkSession, rows: list[tuple[str, str, float, float, float]]) -> DataFrame:
    """(ciudad, tipo, precio real, predicción en USD del modelo, predicción en USD del baseline)."""
    data = [
        (city, room, price, math.log1p(price), math.log1p(model), math.log1p(baseline))
        for city, room, price, model, baseline in rows
    ]
    return spark.createDataFrame(
        data,
        f"city string, room_type string, price_usd double, {LABEL} double, prediction double, baseline_prediction double",
    )


def test_metrics_for_perfect_and_constant_predictions(spark: SparkSession) -> None:
    frame = predictions(
        spark,
        [
            ("a", "x", 50.0, 50.0, 100.0),
            ("a", "x", 100.0, 100.0, 100.0),
            ("b", "x", 200.0, 200.0, 100.0),
            ("b", "x", 100.0, 100.0, 100.0),
        ],
    )

    metrics = {
        (row["model"], row["scope"]): row
        for row in evaluate.regression_metrics(
            frame, {"gbt": "prediction", "baseline": "baseline_prediction"}
        ).collect()
    }

    perfect = metrics[("gbt", evaluate.GLOBAL_SCOPE)]
    assert perfect["n_test"] == 4
    assert perfect["rmse_log"] == pytest.approx(0.0, abs=1e-9)
    assert perfect["r2_log"] == pytest.approx(1.0)
    assert perfect["mae_usd"] == pytest.approx(0.0, abs=1e-6)

    constant = metrics[("baseline", evaluate.GLOBAL_SCOPE)]
    assert constant["mae_usd"] == pytest.approx((50 + 0 + 100 + 0) / 4)
    assert constant["mape"] == pytest.approx((1.0 + 0 + 0.5 + 0) / 4)
    assert constant["r2_log"] < 1.0
    assert metrics[("baseline", "a")]["n_test"] == 2
    assert metrics[("baseline", "b")]["mae_usd"] == pytest.approx(50.0)


def test_baseline_falls_back_to_city_and_then_global_median(spark: SparkSession) -> None:
    schema = f"city string, room_type string, {LABEL} double"
    train = spark.createDataFrame(
        [("a", "x", 1.0), ("a", "x", 3.0), ("a", "x", 5.0), ("a", "y", 9.0)], schema
    )
    target = spark.createDataFrame([("a", "x", 0.0), ("a", "z", 0.0), ("c", "x", 0.0)], schema)

    result = {
        (row["city"], row["room_type"]): row[evaluate.BASELINE_PREDICTION]
        for row in evaluate.with_baseline(train, target).collect()
    }

    assert result[("a", "x")] == 3.0  # mediana de la ciudad y el tipo
    assert result[("a", "z")] in (3.0, 5.0)  # tipo no visto: mediana de la ciudad
    assert result[("c", "x")] in (3.0, 5.0)  # ciudad no vista: mediana global
