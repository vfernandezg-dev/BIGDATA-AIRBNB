"""Silver de calendario, reseñas y barrios."""

from __future__ import annotations

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from airbnb_lake.silver import parsing as p


def build_calendar_monthly(bronze: DataFrame) -> DataFrame:
    """Disponibilidad por anuncio y mes.

    El calendario trae 365 filas por anuncio (cientos de millones entre todas las ciudades) y ya no incluye
    precio: lo único que aporta es la disponibilidad. Se agrega directamente a anuncio × mes, que es el
    grano que usan los marts, en lugar de materializar el detalle diario.
    """
    daily = bronze.select(
        "city",
        "snapshot_date",
        p.to_long(F.col("listing_id")).alias("listing_id"),
        p.to_date(F.col("date")).alias("date"),
        p.to_bool(F.col("available")).alias("available"),
    ).where(F.col("listing_id").isNotNull() & F.col("date").isNotNull())

    return daily.groupBy("city", "snapshot_date", "listing_id", F.trunc("date", "month").alias("month")).agg(
        F.count("*").cast("int").alias("days"),
        F.count_if(F.col("available")).cast("int").alias("days_available"),
    )


def build_reviews(bronze: DataFrame) -> DataFrame:
    """Reseñas tipadas y sin duplicados.

    No se conserva el texto ni el nombre de quien reseña: los marts solo necesitan volumen y fechas, y así
    Silver no arrastra datos personales ni gigabytes de texto.
    """
    typed = bronze.select(
        "city",
        "snapshot_date",
        p.to_long(F.col("id")).alias("review_id"),
        p.to_long(F.col("listing_id")).alias("listing_id"),
        p.to_date(F.col("date")).alias("review_date"),
        p.to_long(F.col("reviewer_id")).alias("reviewer_id"),
        F.coalesce(F.length("comments"), F.lit(0)).alias("comment_length"),
    ).where(
        F.col("review_id").isNotNull() & F.col("listing_id").isNotNull() & F.col("review_date").isNotNull()
    )
    return typed.dropDuplicates(["city", "snapshot_date", "review_id"])


def build_neighbourhoods(bronze: DataFrame) -> DataFrame:
    return (
        bronze.select(
            "city",
            "snapshot_date",
            F.trim("neighbourhood").alias("neighbourhood"),
            F.trim("neighbourhood_group").alias("neighbourhood_group"),
        )
        .where(F.col("neighbourhood").isNotNull())
        .dropDuplicates(["city", "snapshot_date", "neighbourhood"])
    )
