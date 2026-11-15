"""Variables del modelo de precios.

El modelo original tenía R² negativo por tres motivos que aquí se corrigen: el objetivo sin transformar y con
atípicos (ahora `log1p` del precio, sobre anuncios elegibles), variables pobres (ahora las del listings
detallado) y fuga del objetivo (ahora hay una lista explícita de columnas prohibidas).
"""

from __future__ import annotations

import logging

from pyspark.ml import Pipeline
from pyspark.ml.feature import Imputer, StringIndexer, VectorAssembler
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from airbnb_lake.config import MlConfig
from airbnb_lake.silver.listings import AMENITY_FLAGS, REVIEW_SCORE_COLUMNS

logger = logging.getLogger(__name__)

LABEL = "label"
FEATURES = "features"
PREDICTION = "prediction"
SPLIT = "split"
OTHER_PROPERTY_GROUP = "Other"

CATEGORICAL_FEATURES: tuple[str, ...] = ("city", "room_type", "property_group")

NUMERIC_FEATURES: tuple[str, ...] = (
    "accommodates",
    "bedrooms",
    "beds",
    "bathrooms",
    "has_shared_bathroom",
    "latitude",
    "longitude",
    "km_from_center",
    "minimum_nights",
    "availability_30",
    "availability_60",
    "availability_90",
    "availability_365",
    "number_of_reviews",
    "number_of_reviews_ltm",
    "number_of_reviews_l30d",
    "reviews_per_month",
    "has_reviews",
    *REVIEW_SCORE_COLUMNS,
    "amenities_count",
    *AMENITY_FLAGS,
    "host_is_superhost",
    "host_identity_verified",
    "host_listings_count",
    "calculated_host_listings_count",
    "host_tenure_years",
    "has_license",
    "instant_bookable",
)

# Columnas que contienen el precio o se derivan de él. Usarlas daría un modelo perfecto e inútil:
# `estimated_revenue_l365d` es ocupación × precio.
FORBIDDEN_FEATURES: frozenset[str] = frozenset(
    {
        "price_usd",
        "price_local",
        "estimated_revenue_l365d_usd",
        "has_valid_price",
        "is_price_outlier",
        "is_model_eligible",
    }
)


def build_model_frame(listings: DataFrame, ml: MlConfig) -> DataFrame:
    """Anuncios elegibles con el objetivo, las variables candidatas y su asignación a train o test.

    El reparto usa un hash del identificador: es determinista, no depende de cómo estén particionados los
    datos y un mismo anuncio cae siempre en el mismo conjunto.
    """
    eligible = listings.where("is_model_eligible")
    top_types = [
        row["property_type"]
        for row in eligible.groupBy("property_type")
        .count()
        .orderBy(F.desc("count"), "property_type")
        .limit(ml.top_property_types)
        .collect()
        if row["property_type"] is not None
    ]
    property_group = F.when(F.col("property_type").isin(top_types), F.col("property_type")).otherwise(
        F.lit(OTHER_PROPERTY_GROUP)
    )
    bucket = F.pmod(F.xxhash64(F.col("listing_id"), F.lit(ml.seed)), F.lit(100))
    derived = eligible.withColumn("property_group", property_group).withColumn(
        "has_reviews", F.coalesce(F.col("number_of_reviews") > 0, F.lit(False))
    )
    return derived.select(
        "listing_id",
        "neighbourhood",
        *CATEGORICAL_FEATURES,
        "price_usd",
        F.log1p("price_usd").alias(LABEL),
        *[F.col(feature).cast("double").alias(feature) for feature in NUMERIC_FEATURES],
        F.when(bucket < round(ml.train_fraction * 100), F.lit("train")).otherwise(F.lit("test")).alias(SPLIT),
    )


def select_numeric_features(train: DataFrame, min_fill_rate: float) -> list[str]:
    """Descarta las variables casi vacías.

    Inside Airbnb deja de publicar columnas sin avisar (hoy `instant_bookable` llega vacía): en lugar de
    mantener la lista a mano, se mide cuántos datos tiene cada candidata en el conjunto de entrenamiento.
    """
    row = train.agg(
        *[F.avg(F.col(feature).isNotNull().cast("double")).alias(feature) for feature in NUMERIC_FEATURES]
    ).first()
    assert row is not None
    kept = [feature for feature in NUMERIC_FEATURES if (row[feature] or 0.0) >= min_fill_rate]
    dropped = sorted(set(NUMERIC_FEATURES) - set(kept))
    if dropped:
        logger.info(
            "Variables descartadas por tener menos del %.0f%% de datos: %s", min_fill_rate * 100, dropped
        )
    return kept


def build_feature_pipeline(numeric_features: list[str]) -> Pipeline:
    """Indexa las categóricas, imputa las numéricas con la mediana y ensambla el vector de variables.

    Las categóricas indexadas conservan su metadato de variable nominal, así que los árboles las tratan
    como categorías y no como números ordenados; no hace falta one-hot.
    """
    indexers = [
        StringIndexer(inputCol=feature, outputCol=f"{feature}_idx", handleInvalid="keep")
        for feature in CATEGORICAL_FEATURES
    ]
    imputer = Imputer(
        strategy="median",
        inputCols=numeric_features,
        outputCols=[f"{feature}_imp" for feature in numeric_features],
    )
    assembler = VectorAssembler(
        inputCols=[f"{feature}_idx" for feature in CATEGORICAL_FEATURES]
        + [f"{feature}_imp" for feature in numeric_features],
        outputCol=FEATURES,
    )
    return Pipeline(stages=[*indexers, imputer, assembler])


def feature_names(numeric_features: list[str]) -> list[str]:
    """Nombres de las variables en el mismo orden que las posiciones del vector ensamblado."""
    return [*CATEGORICAL_FEATURES, *numeric_features]
