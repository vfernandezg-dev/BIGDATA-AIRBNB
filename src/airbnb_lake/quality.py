"""Calidad de datos: métricas por etapa y validaciones que detienen el pipeline.

Las métricas se publican como marts (el dashboard las muestra en la página de metodología). Las validaciones
comprueban las propiedades de las que dependen los marts; si alguna falla, es mejor detenerse que publicar
cifras incorrectas.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from airbnb_lake.errors import DataQualityError

logger = logging.getLogger(__name__)

MIN_VALID_ROOM_TYPE_SHARE = 0.98
MAX_DAYS_PER_MONTH = 31


def listing_quality(listings: DataFrame) -> DataFrame:
    """Por ciudad: cuántos anuncios hay y cuántos incumplen cada regla de limpieza."""
    return listings.groupBy("city", "snapshot_date").agg(
        F.count("*").alias("n_listings"),
        F.count_distinct("listing_id").alias("n_distinct_listings"),
        F.count_if(F.col("has_valid_price")).alias("n_with_price"),
        F.count_if(F.col("is_price_outlier")).alias("n_price_outliers"),
        F.count_if(~F.col("is_geo_valid")).alias("n_geo_invalid"),
        F.count_if(~F.col("is_room_type_valid")).alias("n_room_type_invalid"),
        F.count_if(~F.col("is_min_nights_valid")).alias("n_min_nights_invalid"),
        F.count_if(F.col("is_model_eligible")).alias("n_model_eligible"),
    )


def stage_counts(dataset: str, bronze: DataFrame, silver: DataFrame) -> DataFrame:
    """Filas por ciudad en Bronze y en Silver para un dataset.

    El calendario cambia de grano entre capas (días en Bronze, anuncio × mes en Silver), así que ahí las dos
    cifras no son comparables entre sí; en el resto, la diferencia son las filas descartadas o duplicadas.
    """
    bronze_counts = bronze.groupBy("city", "snapshot_date").agg(F.count("*").alias("bronze_rows"))
    silver_counts = silver.groupBy("city", "snapshot_date").agg(F.count("*").alias("silver_rows"))
    return bronze_counts.join(silver_counts, on=["city", "snapshot_date"], how="full_outer").select(
        "city",
        F.lit(dataset).alias("dataset"),
        "snapshot_date",
        F.coalesce("bronze_rows", F.lit(0)).alias("bronze_rows"),
        F.coalesce("silver_rows", F.lit(0)).alias("silver_rows"),
    )


def assert_listings_quality(quality: DataFrame, expected_cities: Sequence[str]) -> None:
    """Valida la tabla de anuncios a partir de su resumen de calidad (ya agregado: es barato recogerlo)."""
    rows = {row["city"]: row for row in quality.collect()}
    problems: list[str] = []

    missing = sorted(set(expected_cities) - rows.keys())
    if missing:
        problems.append(f"sin anuncios en Silver para: {', '.join(missing)}")

    for city, row in sorted(rows.items()):
        if row["n_listings"] != row["n_distinct_listings"]:
            duplicated = row["n_listings"] - row["n_distinct_listings"]
            problems.append(f"{city}: {duplicated} anuncios duplicados")
        valid_share = 1 - row["n_room_type_invalid"] / row["n_listings"]
        if valid_share < MIN_VALID_ROOM_TYPE_SHARE:
            problems.append(
                f"{city}: solo el {valid_share:.1%} de los anuncios tiene un tipo de alojamiento válido "
                "(señal de columnas desplazadas al leer el CSV)"
            )
        if row["n_with_price"] == 0:
            problems.append(f"{city}: ningún anuncio tiene precio")

    if problems:
        raise DataQualityError("Validación de anuncios fallida: " + "; ".join(problems))
    logger.info("Validación de anuncios superada en %d ciudades", len(rows))


def assert_calendar_quality(calendar_monthly: DataFrame) -> None:
    """Un mes no puede tener más días que el calendario: si ocurre, hay fechas duplicadas en el origen."""
    row = calendar_monthly.agg(F.max("days").alias("max_days")).first()
    max_days = row["max_days"] if row is not None else None
    if max_days is not None and max_days > MAX_DAYS_PER_MONTH:
        raise DataQualityError(
            f"El calendario tiene hasta {max_days} días en un mes para un mismo anuncio: fechas duplicadas"
        )
