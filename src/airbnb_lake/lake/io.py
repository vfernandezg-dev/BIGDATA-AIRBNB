"""Lectura y escritura de tablas Parquet con las convenciones del lake."""

from __future__ import annotations

from collections.abc import Iterable
from functools import reduce

from pyspark.sql import Column, DataFrame, SparkSession
from pyspark.sql import functions as F

from airbnb_lake.errors import MissingInputError
from airbnb_lake.lake.fs import HadoopFs
from airbnb_lake.lake.paths import PARTITION_COLUMNS, Partition


def partition_filter(partitions: Iterable[Partition]) -> Column:
    """Predicado sobre las columnas de partición: Spark solo abre los directorios pedidos."""
    predicates = [
        (F.col("city") == partition.city)
        & (F.col("snapshot_date") == F.lit(partition.snapshot_date).cast("date"))
        for partition in partitions
    ]
    if not predicates:
        return F.lit(False)
    return reduce(lambda left, right: left | right, predicates)


def latest_partitions(partitions: Iterable[Partition]) -> list[Partition]:
    """El snapshot más reciente de cada ciudad."""
    latest: dict[str, Partition] = {}
    for partition in partitions:
        current = latest.get(partition.city)
        if current is None or partition.snapshot_date > current.snapshot_date:
            latest[partition.city] = partition
    return sorted(latest.values(), key=lambda partition: partition.city)


def read_partitions(spark: SparkSession, table_uri: str, partitions: Iterable[Partition]) -> DataFrame:
    """Lee solo las particiones indicadas de una tabla particionada por ciudad y snapshot."""
    return spark.read.parquet(table_uri).where(partition_filter(partitions))


def read_latest(spark: SparkSession, fs: HadoopFs, table_uri: str, cities: Iterable[str]) -> DataFrame:
    """Lee el último snapshot de cada ciudad pedida. Falla si la tabla no tiene datos de ninguna."""
    wanted = set(cities)
    partitions = [p for p in latest_partitions(fs.list_partitions(table_uri)) if p.city in wanted]
    if not partitions:
        raise MissingInputError(
            f"No hay datos en {table_uri} para las ciudades pedidas; ejecuta la etapa anterior"
        )
    return read_partitions(spark, table_uri, partitions)


def write_partitioned(df: DataFrame, table_uri: str, *, max_records_per_file: int | None = None) -> None:
    """Escribe una tabla particionada por ciudad y snapshot.

    Con sobrescritura dinámica solo se reemplazan las particiones presentes en `df`: reejecutar una etapa
    no duplica ni toca los snapshots que no se están procesando.
    """
    writer = df.write.mode("overwrite").partitionBy(*PARTITION_COLUMNS)
    if max_records_per_file:
        writer = writer.option("maxRecordsPerFile", max_records_per_file)
    writer.parquet(table_uri)


def write_mart(df: DataFrame, mart_uri: str) -> None:
    """Escribe un mart de Gold. Son tablas pequeñas: un solo archivo evita miles de archivos diminutos."""
    df.coalesce(1).write.mode("overwrite").parquet(mart_uri)
