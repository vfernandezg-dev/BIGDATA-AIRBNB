"""Agregaciones analíticas: una función por mart.

Cada función recibe tablas de Silver (el último snapshot de cada ciudad) y devuelve un DataFrame pequeño,
con el grano que consume el dashboard. Las estadísticas de precio usan solo anuncios con precio válido y
no atípico; el resto de métricas usa todos los anuncios.
"""

from __future__ import annotations

from pyspark.sql import Column, DataFrame, Window
from pyspark.sql import functions as F

from airbnb_lake.config import GoldConfig

ENTIRE_HOME = "Entire home/apt"
PRIVATE_ROOM = "Private room"
_PERCENTILE_ACCURACY = 10000

# (orden, etiqueta, mínimo, máximo) de anuncios por anfitrión.
HOST_BUCKETS: tuple[tuple[int, str, int, int | None], ...] = (
    (1, "1", 1, 1),
    (2, "2", 2, 2),
    (3, "3-5", 3, 5),
    (4, "6-10", 6, 10),
    (5, "11-50", 11, 50),
    (6, "51+", 51, None),
)


def has_usable_price() -> Column:
    return F.col("has_valid_price") & ~F.col("is_price_outlier")


def usable_price() -> Column:
    """Precio en USD, o nulo si no es utilizable (los agregados ignoran los nulos)."""
    return F.when(has_usable_price(), F.col("price_usd"))


def share(condition: Column) -> Column:
    """Fracción de filas que cumplen la condición (los nulos cuentan como que no la cumplen)."""
    return F.avg(F.when(condition, F.lit(1.0)).otherwise(F.lit(0.0)))


def quartiles(column: Column) -> Column:
    return F.percentile_approx(column, [0.25, 0.5, 0.75], _PERCENTILE_ACCURACY)


def _price_quartile_columns(source: str = "_price_quartiles") -> list[Column]:
    return [
        F.get(F.col(source), F.lit(0)).alias("p25_price_usd"),
        F.get(F.col(source), F.lit(1)).alias("median_price_usd"),
        F.get(F.col(source), F.lit(2)).alias("p75_price_usd"),
    ]


def dim_city(listings: DataFrame) -> DataFrame:
    """Una fila por ciudad: nombre, país, moneda y encuadre del mapa."""
    return (
        listings.where("is_geo_valid")
        .groupBy("city", "city_name", "country", "snapshot_date")
        .agg(
            F.mode("currency").alias("currency"),
            F.percentile_approx("latitude", 0.5, _PERCENTILE_ACCURACY).alias("center_lat"),
            F.percentile_approx("longitude", 0.5, _PERCENTILE_ACCURACY).alias("center_lon"),
            # Percentiles, no mínimo y máximo: unos pocos anuncios alejados no deben abrir el encuadre.
            F.percentile_approx("latitude", [0.005, 0.995], _PERCENTILE_ACCURACY).alias("_lat_bounds"),
            F.percentile_approx("longitude", [0.005, 0.995], _PERCENTILE_ACCURACY).alias("_lon_bounds"),
        )
        .select(
            "city",
            "city_name",
            "country",
            "currency",
            "snapshot_date",
            "center_lat",
            "center_lon",
            F.get("_lat_bounds", F.lit(0)).alias("min_lat"),
            F.get("_lat_bounds", F.lit(1)).alias("max_lat"),
            F.get("_lon_bounds", F.lit(0)).alias("min_lon"),
            F.get("_lon_bounds", F.lit(1)).alias("max_lon"),
        )
    )


def city_kpis(listings: DataFrame) -> DataFrame:
    """Indicadores principales por ciudad."""
    return (
        listings.groupBy("city", "snapshot_date")
        .agg(
            F.count("*").alias("n_listings"),
            F.count_if(has_usable_price()).alias("n_priced"),
            F.count_distinct("host_id").alias("n_hosts"),
            quartiles(usable_price()).alias("_price_quartiles"),
            F.avg(usable_price()).alias("avg_price_usd"),
            share(F.col("room_type") == ENTIRE_HOME).alias("pct_entire_home"),
            share(F.col("room_type") == PRIVATE_ROOM).alias("pct_private_room"),
            share(F.col("calculated_host_listings_count") > 1).alias("pct_multi_listing"),
            share(F.col("host_is_superhost")).alias("pct_superhost"),
            share(F.col("has_license")).alias("pct_licensed"),
            share(F.col("minimum_nights") < 30).alias("pct_short_term"),
            F.avg("review_scores_rating").alias("avg_rating"),
            F.sum("number_of_reviews_ltm").alias("n_reviews_ltm"),
            F.avg("reviews_per_month").alias("avg_reviews_per_month"),
            F.avg("availability_365").alias("avg_availability_365"),
            F.avg(F.col("estimated_occupancy_l365d") / F.lit(365.0)).alias("avg_occupancy_l365d"),
            F.percentile_approx("minimum_nights", 0.5, _PERCENTILE_ACCURACY).alias("median_min_nights"),
            F.percentile_approx(
                F.when(F.col("estimated_revenue_l365d_usd") > 0, F.col("estimated_revenue_l365d_usd")),
                0.5,
                _PERCENTILE_ACCURACY,
            ).alias("median_revenue_l365d_usd"),
        )
        .select("*", *_price_quartile_columns())
        .drop("_price_quartiles")
    )


def neighbourhood_stats(listings: DataFrame, min_listings: int) -> DataFrame:
    """Estadísticas por barrio, con su precio relativo al de la ciudad."""
    by_city = Window.partitionBy("city")
    stats = (
        listings.where(F.col("neighbourhood").isNotNull())
        .groupBy("city", "neighbourhood")
        .agg(
            F.first("neighbourhood_group", ignorenulls=True).alias("neighbourhood_group"),
            F.count("*").alias("n_listings"),
            F.count_if(has_usable_price()).alias("n_priced"),
            quartiles(usable_price()).alias("_price_quartiles"),
            F.avg("review_scores_rating").alias("avg_rating"),
            F.avg("availability_365").alias("avg_availability_365"),
            F.avg(F.col("estimated_occupancy_l365d") / F.lit(365.0)).alias("avg_occupancy_l365d"),
            F.sum("number_of_reviews_ltm").alias("n_reviews_ltm"),
            F.avg("reviews_per_month").alias("avg_reviews_per_month"),
            share(F.col("room_type") == ENTIRE_HOME).alias("pct_entire_home"),
            F.avg(F.when(F.col("is_geo_valid"), F.col("latitude"))).alias("center_lat"),
            F.avg(F.when(F.col("is_geo_valid"), F.col("longitude"))).alias("center_lon"),
        )
        .select("*", *_price_quartile_columns())
        .drop("_price_quartiles")
    )
    city_median = listings.groupBy("city").agg(
        F.percentile_approx(usable_price(), 0.5, _PERCENTILE_ACCURACY).alias("_city_median_price")
    )
    return (
        stats.join(F.broadcast(city_median), on="city", how="left")
        .withColumn("price_vs_city", F.try_divide("median_price_usd", "_city_median_price"))
        .withColumn("listings_share", F.col("n_listings") / F.sum("n_listings").over(by_city))
        .drop("_city_median_price")
        .where(F.col("n_listings") >= min_listings)
    )


def room_type_stats(listings: DataFrame) -> DataFrame:
    by_city = Window.partitionBy("city")
    return (
        listings.where("is_room_type_valid")
        .groupBy("city", "room_type")
        .agg(
            F.count("*").alias("n_listings"),
            F.count_if(has_usable_price()).alias("n_priced"),
            quartiles(usable_price()).alias("_price_quartiles"),
            F.avg("accommodates").alias("avg_accommodates"),
            F.avg("review_scores_rating").alias("avg_rating"),
        )
        .select("*", *_price_quartile_columns())
        .drop("_price_quartiles")
        .withColumn("listings_share", F.col("n_listings") / F.sum("n_listings").over(by_city))
    )


def price_histogram(listings: DataFrame, gold: GoldConfig) -> DataFrame:
    """Histograma de precios ya agrupado: el dashboard no necesita los anuncios individuales.

    El último tramo es abierto (`bucket_to_usd` nulo) y acumula todo lo que supera el máximo.
    """
    width = gold.price_histogram_bucket_usd
    top = gold.price_histogram_max_usd
    bucket_from = F.least(F.floor(F.col("price_usd") / F.lit(width)) * F.lit(width), F.lit(top)).cast("int")
    return (
        listings.where(has_usable_price() & F.col("is_room_type_valid"))
        .groupBy("city", "room_type", bucket_from.alias("bucket_from_usd"))
        .agg(F.count("*").alias("n_listings"))
        .withColumn(
            "bucket_to_usd", F.when(F.col("bucket_from_usd") < top, F.col("bucket_from_usd") + F.lit(width))
        )
    )


def map_grid(listings: DataFrame, cell_degrees: float) -> DataFrame:
    """Rejilla del mapa: anuncios agregados en celdas de `cell_degrees` grados (unos 500 m con 0,005).

    Servir celdas en lugar de puntos mantiene el mart pequeño aunque la ciudad tenga cien mil anuncios.
    """

    def cell_center(coordinate: str) -> Column:
        return F.round(
            (F.floor(F.col(coordinate) / F.lit(cell_degrees)) + F.lit(0.5)) * F.lit(cell_degrees), 5
        )

    return (
        listings.where("is_geo_valid")
        .groupBy(
            "city", cell_center("latitude").alias("cell_lat"), cell_center("longitude").alias("cell_lon")
        )
        .agg(
            F.count("*").alias("n_listings"),
            F.count_if(has_usable_price()).alias("n_priced"),
            F.percentile_approx(usable_price(), 0.5, _PERCENTILE_ACCURACY).alias("median_price_usd"),
            F.avg("review_scores_rating").alias("avg_rating"),
            F.avg("availability_365").alias("avg_availability_365"),
        )
    )


def host_concentration(listings: DataFrame) -> DataFrame:
    """Cuántos anfitriones y anuncios hay según el número de anuncios que gestiona cada anfitrión."""
    per_host = (
        listings.where(F.col("host_id").isNotNull()).groupBy("city", "host_id").agg(F.count("*").alias("n"))
    )
    bucket_order = F.lit(None).cast("int")
    bucket_label = F.lit(None).cast("string")
    for order, label, low, high in reversed(HOST_BUCKETS):
        in_bucket = (F.col("n") >= low) if high is None else F.col("n").between(low, high)
        bucket_order = F.when(in_bucket, F.lit(order)).otherwise(bucket_order)
        bucket_label = F.when(in_bucket, F.lit(label)).otherwise(bucket_label)
    return (
        per_host.select("city", bucket_order.alias("bucket_order"), bucket_label.alias("bucket_label"), "n")
        .groupBy("city", "bucket_order", "bucket_label")
        .agg(F.count("*").alias("n_hosts"), F.sum("n").alias("n_listings"))
    )


def reviews_monthly(reviews: DataFrame) -> DataFrame:
    """Reseñas por mes: la mejor aproximación pública a la demanda histórica."""
    return reviews.groupBy("city", F.trunc("review_date", "month").alias("month")).agg(
        F.count("*").alias("n_reviews"),
        F.approx_count_distinct("listing_id", 0.02).alias("n_listings_reviewed"),
    )


def availability_monthly(calendar_monthly: DataFrame) -> DataFrame:
    """Disponibilidad futura por mes, según el calendario publicado en el snapshot."""
    return (
        calendar_monthly.groupBy("city", "month")
        .agg(
            F.count("*").alias("n_listings"),
            F.sum("days").alias("days_total"),
            F.sum("days_available").alias("days_available"),
        )
        .withColumn("availability_rate", F.try_divide("days_available", "days_total"))
    )
