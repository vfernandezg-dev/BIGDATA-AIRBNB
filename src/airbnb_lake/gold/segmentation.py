"""Segmentación de barrios con K-Means.

Viene del proyecto original (`añadir_demand_cluster`), con dos cambios: las variables son relativas a la
ciudad (precio frente a la mediana local, cuota de anuncios), de modo que barrios de ciudades distintas son
comparables, y el resultado es un producto analítico; ya no se usa como variable del modelo de precios,
donde filtraba información del objetivo.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from pyspark.ml.clustering import KMeans
from pyspark.ml.evaluation import ClusteringEvaluator
from pyspark.ml.feature import StandardScaler, VectorAssembler
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from airbnb_lake.config import SegmentationConfig

logger = logging.getLogger(__name__)

SEGMENT_FEATURES = (
    "price_vs_city",
    "avg_reviews_per_month",
    "avg_availability_365",
    "pct_entire_home",
    "listings_share",
)


@dataclass(frozen=True)
class Segmentation:
    """Asignación de barrios a segmentos y perfil medio de cada segmento."""

    assignments: DataFrame
    profiles: DataFrame
    k: int
    silhouette: float | None


def segment_neighbourhoods(neighbourhoods: DataFrame, config: SegmentationConfig) -> Segmentation | None:
    """Agrupa los barrios y devuelve la mejor partición según el coeficiente de silueta.

    Los segmentos se numeran de 1 a k por precio relativo creciente, para que el número signifique lo mismo
    entre ejecuciones. Devuelve None si no hay barrios suficientes para agrupar.
    """
    # La inicialización de K-Means depende de cómo estén repartidas y ordenadas las filas. Son unos cientos
    # de barrios: en una sola partición y con un orden fijo, la misma semilla da siempre el mismo resultado.
    complete = (
        neighbourhoods.dropna(subset=list(SEGMENT_FEATURES))
        .select("city", "neighbourhood", *SEGMENT_FEATURES)
        .orderBy("city", "neighbourhood")
        .coalesce(1)
    )
    assembled = VectorAssembler(inputCols=list(SEGMENT_FEATURES), outputCol="_raw").transform(complete)
    # K-Means usa distancias: sin estandarizar, la variable de mayor escala dominaría el resultado.
    scaled = (
        StandardScaler(inputCol="_raw", outputCol="_features", withMean=True, withStd=True)
        .fit(assembled)
        .transform(assembled)
        .persist()
    )
    try:
        n_rows = scaled.count()
        candidates = [k for k in config.k_candidates if k < n_rows]
        if not candidates:
            logger.warning("Segmentación omitida: solo hay %d barrios con datos completos", n_rows)
            return None

        evaluator = ClusteringEvaluator(
            featuresCol="_features", predictionCol="_cluster", metricName="silhouette"
        )
        best: tuple[float, int, DataFrame] | None = None
        for k in candidates:
            model = KMeans(featuresCol="_features", predictionCol="_cluster", k=k, seed=config.seed).fit(
                scaled
            )
            clustered = model.transform(scaled)
            silhouette = evaluator.evaluate(clustered)
            logger.info("K-Means k=%d: silueta %.4f", k, silhouette)
            if best is None or silhouette > best[0]:
                best = (silhouette, k, clustered)

        assert best is not None
        silhouette, k, clustered = best
        # Se materializa antes de liberar la caché de la que depende.
        assignments = _rank_by_price(clustered).localCheckpoint()
        return Segmentation(
            assignments=assignments, profiles=_profiles(assignments), k=k, silhouette=silhouette
        )
    finally:
        scaled.unpersist()


def _rank_by_price(clustered: DataFrame) -> DataFrame:
    # Hay como mucho unos pocos clusters: el orden se decide en el driver, sin una ventana global en Spark.
    cluster_prices = clustered.groupBy("_cluster").agg(F.avg("price_vs_city").alias("price")).collect()
    ordered = sorted(cluster_prices, key=lambda row: (row["price"], row["_cluster"]))
    ranking = clustered.sparkSession.createDataFrame(
        [(int(row["_cluster"]), position) for position, row in enumerate(ordered, start=1)],
        "_cluster int, segment int",
    )
    return clustered.join(F.broadcast(ranking), on="_cluster").select(
        "city", "neighbourhood", "segment", *SEGMENT_FEATURES
    )


def _profiles(assignments: DataFrame) -> DataFrame:
    return assignments.groupBy("segment").agg(
        F.count("*").alias("n_neighbourhoods"),
        *[F.avg(feature).alias(f"avg_{feature.removeprefix('avg_')}") for feature in SEGMENT_FEATURES],
    )
