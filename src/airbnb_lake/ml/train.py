"""Etapa de entrenamiento: ajusta el modelo de precios, lo evalúa y publica sus resultados como marts."""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from datetime import datetime, timezone

from pyspark.ml import PipelineModel
from pyspark.ml.evaluation import RegressionEvaluator
from pyspark.ml.regression import GBTRegressionModel, GBTRegressor
from pyspark.ml.tuning import ParamGridBuilder, TrainValidationSplit
from pyspark.sql import DataFrame
from pyspark.sql import functions as F
from pyspark.storagelevel import StorageLevel

from airbnb_lake.config import City, MlConfig
from airbnb_lake.context import PipelineContext
from airbnb_lake.errors import DataQualityError
from airbnb_lake.lake.io import read_latest, write_mart
from airbnb_lake.ml import evaluate
from airbnb_lake.ml.features import (
    FEATURES,
    LABEL,
    PREDICTION,
    SPLIT,
    build_feature_pipeline,
    build_model_frame,
    feature_names,
    select_numeric_features,
)

logger = logging.getLogger(__name__)

MODEL_NAME = "price"
MIN_TRAIN_ROWS = 100
_ACCURACY = 10000


def fit_gbt(train: DataFrame, ml: MlConfig) -> tuple[GBTRegressionModel, int]:
    """Ajusta el GBT eligiendo la profundidad con un conjunto de validación.

    Recibe las variables ya ensambladas y en caché: cada combinación de hiperparámetros reutiliza el mismo
    vector en lugar de recalcular los indexadores y la imputación.
    """
    gbt = GBTRegressor(
        featuresCol=FEATURES,
        labelCol=LABEL,
        predictionCol=PREDICTION,
        maxIter=ml.gbt.max_iter,
        stepSize=ml.gbt.step_size,
        maxBins=ml.gbt.max_bins,
        subsamplingRate=ml.gbt.subsampling_rate,
        seed=ml.seed,
    )
    depths = ml.gbt.max_depth_grid
    if len(depths) == 1:
        return gbt.setMaxDepth(depths[0]).fit(train), depths[0]

    search = TrainValidationSplit(
        estimator=gbt,
        estimatorParamMaps=ParamGridBuilder().addGrid(gbt.maxDepth, list(depths)).build(),
        evaluator=RegressionEvaluator(labelCol=LABEL, predictionCol=PREDICTION, metricName="rmse"),
        trainRatio=ml.validation_train_ratio,
        parallelism=ml.tuning_parallelism,
        seed=ml.seed,
    )
    fitted = search.fit(train)
    for depth, rmse in zip(depths, fitted.validationMetrics, strict=True):
        logger.info("GBT maxDepth=%d: RMSE de validación %.4f", depth, rmse)
    best: GBTRegressionModel = fitted.bestModel
    return best, int(best.getMaxDepth())


def run_train(ctx: PipelineContext, cities: Sequence[City]) -> None:
    ml = ctx.config.ml
    slugs = [city.slug for city in cities]
    listings = read_latest(ctx.spark, ctx.fs, ctx.paths.silver("listings"), slugs)

    frame = build_model_frame(listings, ml).persist(StorageLevel.MEMORY_AND_DISK)
    try:
        counts = {row[SPLIT]: row["count"] for row in frame.groupBy(SPLIT).count().collect()}
        n_train, n_test = counts.get("train", 0), counts.get("test", 0)
        if n_train < MIN_TRAIN_ROWS or n_test == 0:
            raise DataQualityError(
                f"Datos insuficientes para entrenar: {n_train} anuncios de entrenamiento y {n_test} de prueba"
            )
        logger.info("Anuncios elegibles: %d de entrenamiento, %d de prueba", n_train, n_test)

        train = frame.where(F.col(SPLIT) == "train")
        numeric = select_numeric_features(train, ml.min_feature_fill_rate)
        feature_model = build_feature_pipeline(numeric).fit(train)
        vectors = (
            feature_model.transform(frame)
            .select("listing_id", "city", "neighbourhood", "room_type", "price_usd", LABEL, SPLIT, FEATURES)
            .persist(StorageLevel.MEMORY_AND_DISK)
        )
        try:
            gbt_model, depth = fit_gbt(vectors.where(F.col(SPLIT) == "train"), ml)
            scored = gbt_model.transform(vectors).drop(FEATURES).persist(StorageLevel.MEMORY_AND_DISK)
            try:
                _write_outputs(ctx, scored, gbt_model, feature_model, numeric, depth, n_train)
            finally:
                scored.unpersist()
        finally:
            vectors.unpersist()
    finally:
        frame.unpersist()


def _write_outputs(
    ctx: PipelineContext,
    scored: DataFrame,
    gbt_model: GBTRegressionModel,
    feature_model: PipelineModel,
    numeric: list[str],
    depth: int,
    n_train: int,
) -> None:
    ml = ctx.config.ml
    trained_at = datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None)
    train = scored.where(F.col(SPLIT) == "train")
    test = evaluate.with_baseline(train, scored.where(F.col(SPLIT) == "test"))

    train_counts = train.groupBy(F.col("city").alias("scope")).agg(F.count("*").alias("n_train"))
    metrics = (
        evaluate.regression_metrics(test, {"gbt": PREDICTION, "baseline": evaluate.BASELINE_PREDICTION})
        .join(F.broadcast(train_counts), on="scope", how="left")
        .withColumn(
            "n_train",
            F.when(F.col("scope") == evaluate.GLOBAL_SCOPE, F.lit(n_train)).otherwise(F.col("n_train")),
        )
        .withColumn("run_id", F.lit(ctx.run_id))
        .withColumn("trained_at", F.lit(trained_at))
        .persist()
    )
    write_mart(metrics, ctx.paths.gold("model_metrics"))
    summary = {
        row["model"]: {
            key: row[key] for key in ("rmse_log", "mae_log", "r2_log", "mae_usd", "mape", "median_ape")
        }
        for row in metrics.where(F.col("scope") == evaluate.GLOBAL_SCOPE).collect()
    }
    metrics.unpersist()
    for model, values in sorted(summary.items()):
        logger.info(
            "Test %-8s R²(log)=%.4f  RMSE(log)=%.4f  MAE=%.1f USD  error relativo mediano=%.1f%%",
            model,
            values["r2_log"],
            values["rmse_log"],
            values["mae_usd"],
            values["median_ape"] * 100,
        )

    importances = sorted(
        zip(
            feature_names(numeric),
            (float(value) for value in gbt_model.featureImportances.toArray()),
            strict=True,
        ),
        key=lambda pair: pair[1],
        reverse=True,
    )
    importance_rows = [
        (ctx.run_id, name, value, rank) for rank, (name, value) in enumerate(importances, start=1)
    ]
    write_mart(
        ctx.spark.createDataFrame(
            importance_rows, "run_id string, feature string, importance double, rank int"
        ),
        ctx.paths.gold("feature_importance"),
    )

    predictions = scored.withColumn("predicted_price_usd", F.expm1(PREDICTION))
    predictions.select(
        "listing_id", "city", "neighbourhood", "room_type", "price_usd", "predicted_price_usd", SPLIT
    ).coalesce(4).write.mode("overwrite").parquet(ctx.paths.gold("listings_scored"))

    # Muestra del conjunto de prueba para el gráfico de precio real frente a predicho.
    sample = (
        predictions.where(F.col(SPLIT) == "test")
        .orderBy(F.xxhash64(F.col("listing_id"), F.lit(ml.seed + 1)))
        .limit(ml.prediction_sample_rows)
        .select(
            F.lit(ctx.run_id).alias("run_id"),
            "city",
            "room_type",
            F.round("price_usd", 2).alias("actual_usd"),
            F.round("predicted_price_usd", 2).alias("predicted_usd"),
        )
    )
    write_mart(sample, ctx.paths.gold("prediction_sample"))
    write_mart(
        neighbourhood_price_index(predictions, ctx.config.gold.min_listings_per_neighbourhood),
        ctx.paths.gold("neighbourhood_price_index"),
    )

    model_uri = f"{ctx.paths.model_run(MODEL_NAME, ctx.run_id)}/model"
    PipelineModel(stages=[*feature_model.stages, gbt_model]).write().overwrite().save(model_uri)
    ctx.fs.write_text(
        f"{ctx.paths.model_run(MODEL_NAME, ctx.run_id)}/metrics.json",
        json.dumps(
            {
                "run_id": ctx.run_id,
                "trained_at": trained_at.isoformat(),
                "max_depth": depth,
                "n_train": n_train,
                "numeric_features": numeric,
                "test_metrics": summary,
            },
            indent=2,
        ),
    )
    ctx.fs.write_text(ctx.paths.model_latest(MODEL_NAME), ctx.run_id)
    logger.info("Modelo guardado en %s (maxDepth=%d)", model_uri, depth)


def neighbourhood_price_index(predictions: DataFrame, min_listings: int) -> DataFrame:
    """Índice de precio por barrio: mediana de precio real / precio predicho.

    Por encima de 1, los anuncios del barrio cobran más de lo que sus características explican; por debajo,
    menos. Es una lectura del residuo del modelo, no una tasación.
    """
    ratio = F.col("price_usd") / F.col("predicted_price_usd")
    return (
        predictions.where(F.col("neighbourhood").isNotNull())
        .groupBy("city", "neighbourhood")
        .agg(
            F.count("*").alias("n_scored"),
            F.percentile_approx("price_usd", 0.5, _ACCURACY).alias("median_actual_usd"),
            F.percentile_approx("predicted_price_usd", 0.5, _ACCURACY).alias("median_predicted_usd"),
            F.percentile_approx(ratio, 0.5, _ACCURACY).alias("price_index"),
        )
        .where(F.col("n_scored") >= min_listings)
    )
