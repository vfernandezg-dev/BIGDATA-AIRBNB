"""Silver de anuncios: tipado, normalización de precios a USD y flags de calidad.

Las reglas de negocio vienen del proyecto original (`limpiar_y_enriquecer_listings`): noches mínimas y
disponibilidad dentro de rango, precio sin atípicos, coordenadas dentro de la ciudad y un registro por
anuncio. Aquí se aplican a cualquier ciudad y se expresan como flags: Silver conserva las filas y deja
constancia de qué regla incumple cada una; quien consume los datos (marts o modelo) decide qué filtrar.
"""

from __future__ import annotations

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from airbnb_lake.config import CleaningConfig
from airbnb_lake.silver import parsing as p

# Amenities que se convierten en variables: nombre de la columna -> expresión regular sobre el texto de
# origen en minúsculas. Los patrones evitan los falsos positivos más comunes ("dishwasher" no es lavadora,
# "hair dryer" no es secadora, "pool table" no es piscina).
AMENITY_FLAGS: dict[str, str] = {
    "has_wifi": r"wifi",
    "has_kitchen": r"kitchen",
    "has_air_conditioning": r"air conditioning",
    "has_heating": r"heating",
    "has_washer": r"(?<!dish)washer",
    "has_dryer": r"(?<!hair )dryer",
    "has_tv": r"\btv\b|hdtv",
    "has_parking": r"parking",
    "has_pool": r"\bpool\b(?! table)",
    "has_hot_tub": r"hot tub",
    "has_gym": r"\bgym\b",
    "has_elevator": r"elevator",
    "has_workspace": r"workspace",
    "has_dishwasher": r"dishwasher",
    "has_balcony": r"balcony|patio",
}

REVIEW_SCORE_COLUMNS = (
    "review_scores_rating",
    "review_scores_accuracy",
    "review_scores_cleanliness",
    "review_scores_checkin",
    "review_scores_communication",
    "review_scores_location",
    "review_scores_value",
)


def build_listings(
    bronze: DataFrame, cities: DataFrame, fx: DataFrame, cleaning: CleaningConfig
) -> DataFrame:
    """Construye la tabla Silver de anuncios.

    `cities` (city, city_name, country, city_currency) y `fx` (currency, units_per_usd) son dimensiones
    pequeñas que vienen de la configuración; se unen con broadcast.
    """
    typed = _typed(bronze).where(F.col("listing_id").isNotNull())
    priced = _with_usd_price(typed, cities, fx)
    unique = _deduplicate(priced)
    return _with_quality_flags(unique, cleaning)


def _typed(bronze: DataFrame) -> DataFrame:
    amenities_lower = F.lower(F.col("amenities"))
    tenure_years = p.to_double(F.col("hosts_time_as_host_years")) + F.coalesce(
        p.to_double(F.col("hosts_time_as_host_months")), F.lit(0.0)
    ) / F.lit(12.0)

    return bronze.select(
        "city",
        "snapshot_date",
        p.to_long(F.col("id")).alias("listing_id"),
        p.to_date(F.col("last_scraped")).alias("last_scraped"),
        F.col("name"),
        p.to_long(F.col("host_id")).alias("host_id"),
        p.to_bool(F.col("host_is_superhost")).alias("host_is_superhost"),
        p.to_bool(F.col("host_identity_verified")).alias("host_identity_verified"),
        p.to_int(F.col("host_listings_count")).alias("host_listings_count"),
        p.to_int(F.col("calculated_host_listings_count")).alias("calculated_host_listings_count"),
        tenure_years.alias("host_tenure_years"),
        F.col("neighbourhood_cleansed").alias("neighbourhood"),
        F.col("neighbourhood_group_cleansed").alias("neighbourhood_group"),
        p.to_double(F.col("latitude")).alias("latitude"),
        p.to_double(F.col("longitude")).alias("longitude"),
        F.col("property_type"),
        F.col("room_type"),
        p.to_int(F.col("accommodates")).alias("accommodates"),
        p.to_double(F.col("bedrooms")).alias("bedrooms"),
        p.to_double(F.col("beds")).alias("beds"),
        # La columna `bathrooms` llega vacía; el dato está en el texto.
        F.coalesce(p.to_double(F.col("bathrooms")), p.parse_bathrooms(F.col("bathrooms_text"))).alias(
            "bathrooms"
        ),
        p.is_shared_bathroom(F.col("bathrooms_text")).alias("has_shared_bathroom"),
        F.size(p.parse_amenities(F.col("amenities"))).alias("amenities_count"),
        *[p.has_amenity(amenities_lower, pattern).alias(flag) for flag, pattern in AMENITY_FLAGS.items()],
        p.parse_money(F.col("price")).alias("price_local"),
        F.upper(F.get_json_object(F.col("price_quote_raw"), "$.quote.currency")).alias("quoted_currency"),
        p.to_int(F.col("minimum_nights")).alias("minimum_nights"),
        p.to_int(F.col("maximum_nights")).alias("maximum_nights"),
        p.to_bool(F.col("has_availability")).alias("has_availability"),
        p.to_int(F.col("availability_30")).alias("availability_30"),
        p.to_int(F.col("availability_60")).alias("availability_60"),
        p.to_int(F.col("availability_90")).alias("availability_90"),
        p.to_int(F.col("availability_365")).alias("availability_365"),
        p.to_int(F.col("number_of_reviews")).alias("number_of_reviews"),
        p.to_int(F.col("number_of_reviews_ltm")).alias("number_of_reviews_ltm"),
        p.to_int(F.col("number_of_reviews_l30d")).alias("number_of_reviews_l30d"),
        p.to_double(F.col("reviews_per_month")).alias("reviews_per_month"),
        p.to_date(F.col("first_review")).alias("first_review"),
        p.to_date(F.col("last_review")).alias("last_review"),
        *[p.to_double(F.col(column)).alias(column) for column in REVIEW_SCORE_COLUMNS],
        p.to_int(F.col("estimated_occupancy_l365d")).alias("estimated_occupancy_l365d"),
        p.to_double(F.col("estimated_revenue_l365d")).alias("estimated_revenue_l365d_local"),
        p.to_bool(F.col("instant_bookable")).alias("instant_bookable"),
        F.col("license").isNotNull().alias("has_license"),
    )


def _with_usd_price(typed: DataFrame, cities: DataFrame, fx: DataFrame) -> DataFrame:
    """Normaliza los importes a USD.

    El origen publica los precios en la moneda local con un `$` genérico. La moneda real viene en la
    cotización de cada anuncio; cuando falta se usa la configurada para la ciudad.
    """
    with_city = typed.join(F.broadcast(cities), on="city", how="left")
    with_currency = with_city.withColumn("currency", F.coalesce("quoted_currency", "city_currency")).drop(
        "quoted_currency", "city_currency"
    )
    with_rate = with_currency.join(F.broadcast(fx), on="currency", how="left")
    return (
        with_rate.withColumn("price_usd", F.try_divide("price_local", "units_per_usd"))
        .withColumn(
            "estimated_revenue_l365d_usd", F.try_divide("estimated_revenue_l365d_local", "units_per_usd")
        )
        .drop("units_per_usd", "estimated_revenue_l365d_local")
    )


def _deduplicate(df: DataFrame) -> DataFrame:
    """Un registro por anuncio y snapshot: se conserva el del scrape más reciente."""
    window = Window.partitionBy("city", "snapshot_date", "listing_id").orderBy(
        F.col("last_scraped").desc_nulls_last(), F.col("number_of_reviews").desc_nulls_last()
    )
    return df.withColumn("_row", F.row_number().over(window)).where(F.col("_row") == 1).drop("_row")


def _with_quality_flags(df: DataFrame, cleaning: CleaningConfig) -> DataFrame:
    """Añade los flags de calidad. Los umbrales de precio y el centro se calculan por ciudad y snapshot."""
    by_city = Window.partitionBy("city", "snapshot_date")
    low_q, high_q = cleaning.price_outlier_quantiles
    positive_price = F.when(F.col("price_usd") > 0, F.col("price_usd"))

    with_stats = (
        df.withColumn(
            "_price_bounds", F.percentile_approx(positive_price, [low_q, high_q], 10000).over(by_city)
        )
        .withColumn("_center_lat", F.percentile_approx("latitude", 0.5, 10000).over(by_city))
        .withColumn("_center_lon", F.percentile_approx("longitude", 0.5, 10000).over(by_city))
        .withColumn(
            "km_from_center",
            p.haversine_km(F.col("latitude"), F.col("longitude"), F.col("_center_lat"), F.col("_center_lon")),
        )
    )

    has_valid_price = F.coalesce(F.col("price_usd") > 0, F.lit(False))
    is_price_outlier = has_valid_price & F.coalesce(
        (F.col("price_usd") < F.get(F.col("_price_bounds"), F.lit(0)))
        | (F.col("price_usd") > F.get(F.col("_price_bounds"), F.lit(1))),
        F.lit(False),
    )
    is_geo_valid = F.coalesce(
        F.col("latitude").between(-90, 90)
        & F.col("longitude").between(-180, 180)
        & (F.col("km_from_center") <= cleaning.max_km_from_city_center),
        F.lit(False),
    )
    is_room_type_valid = F.coalesce(F.col("room_type").isin(*cleaning.valid_room_types), F.lit(False))
    is_min_nights_valid = F.coalesce(
        F.col("minimum_nights").between(*cleaning.min_nights_range), F.lit(False)
    )
    is_availability_valid = F.coalesce(
        F.col("availability_365").between(*cleaning.availability_range), F.lit(False)
    )

    return (
        with_stats.withColumn("has_valid_price", has_valid_price)
        .withColumn("is_price_outlier", is_price_outlier)
        .withColumn("is_geo_valid", is_geo_valid)
        .withColumn("is_room_type_valid", is_room_type_valid)
        .withColumn("is_min_nights_valid", is_min_nights_valid)
        .withColumn("is_availability_valid", is_availability_valid)
        .withColumn(
            "is_model_eligible",
            F.col("has_valid_price")
            & ~F.col("is_price_outlier")
            & F.col("is_geo_valid")
            & F.col("is_room_type_valid")
            & F.col("is_min_nights_valid")
            & F.col("is_availability_valid")
            & F.coalesce(F.col("accommodates") > 0, F.lit(False)),
        )
        .drop("_price_bounds", "_center_lat", "_center_lon")
    )
