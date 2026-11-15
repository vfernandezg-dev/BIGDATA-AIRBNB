"""Métricas de regresión calculadas en Spark, en la escala logarítmica y en USD."""

from __future__ import annotations

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from airbnb_lake.ml.features import LABEL, PREDICTION

GLOBAL_SCOPE = "global"
BASELINE_PREDICTION = "baseline_prediction"
_ACCURACY = 10000


def with_baseline(train: DataFrame, target: DataFrame) -> DataFrame:
    """Añade la predicción de referencia: la mediana del objetivo por ciudad y tipo de alojamiento.

    Un modelo solo aporta algo si mejora a esta regla. Se calcula con el conjunto de entrenamiento; las
    combinaciones que no aparecen en él usan la mediana de la ciudad y, en último caso, la global.
    """
    by_city_room = train.groupBy("city", "room_type").agg(
        F.percentile_approx(LABEL, 0.5, _ACCURACY).alias("_by_room")
    )
    by_city = train.groupBy("city").agg(F.percentile_approx(LABEL, 0.5, _ACCURACY).alias("_by_city"))
    overall_row = train.agg(F.percentile_approx(LABEL, 0.5, _ACCURACY).alias("overall")).first()
    overall = (
        float(overall_row["overall"])
        if overall_row is not None and overall_row["overall"] is not None
        else 0.0
    )
    return (
        target.join(F.broadcast(by_city_room), on=["city", "room_type"], how="left")
        .join(F.broadcast(by_city), on="city", how="left")
        .withColumn(BASELINE_PREDICTION, F.coalesce("_by_room", "_by_city", F.lit(overall)))
        .drop("_by_room", "_by_city")
    )


def regression_metrics(predictions: DataFrame, models: dict[str, str]) -> DataFrame:
    """Métricas por modelo, globales y por ciudad.

    `models` asocia el nombre de cada modelo con su columna de predicción (en escala logarítmica).
    Devuelve una fila por (modelo, ámbito), donde el ámbito es `global` o el slug de una ciudad.
    """
    long = None
    for model, column in models.items():
        frame = predictions.select(
            "city", LABEL, "price_usd", F.lit(model).alias("model"), F.col(column).alias(PREDICTION)
        )
        long = frame if long is None else long.unionByName(frame)
    assert long is not None

    error = F.col(PREDICTION) - F.col(LABEL)
    predicted_usd = F.expm1(F.col(PREDICTION))
    error_usd = predicted_usd - F.col("price_usd")
    relative_error = F.abs(error_usd) / F.col("price_usd")
    aggregates = [
        F.count("*").alias("n_test"),
        F.sqrt(F.avg(error * error)).alias("rmse_log"),
        F.avg(F.abs(error)).alias("mae_log"),
        # R² = 1 - error cuadrático medio / varianza del objetivo.
        (F.lit(1.0) - F.try_divide(F.avg(error * error), F.var_pop(LABEL))).alias("r2_log"),
        F.avg(F.abs(error_usd)).alias("mae_usd"),
        F.sqrt(F.avg(error_usd * error_usd)).alias("rmse_usd"),
        F.avg(relative_error).alias("mape"),
        F.percentile_approx(relative_error, 0.5, _ACCURACY).alias("median_ape"),
    ]
    overall = long.groupBy("model").agg(*aggregates).withColumn("scope", F.lit(GLOBAL_SCOPE))
    by_city = long.groupBy("model", F.col("city").alias("scope")).agg(*aggregates)
    return overall.unionByName(by_city)
