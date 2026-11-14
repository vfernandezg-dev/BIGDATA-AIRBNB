"""Bronze: copia fiel de los archivos de origen en Parquet.

Todas las columnas se guardan como texto, sin interpretar: Bronze solo cambia el formato (de CSV comprimido,
que no es divisible, a Parquet, que sí lo es) y añade de dónde vino cada fila. La limpieza y los tipos son
responsabilidad de Silver.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from functools import reduce

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

from airbnb_lake.config import City
from airbnb_lake.context import PipelineContext
from airbnb_lake.lake.io import write_partitioned
from airbnb_lake.lake.paths import RAW_MANIFEST, Partition
from airbnb_lake.schemas import CONTRACTS, DatasetContract

logger = logging.getLogger(__name__)


def read_raw_csv(spark: SparkSession, uri: str, contract: DatasetContract) -> DataFrame:
    """Lee un CSV de Inside Airbnb con todas sus columnas como texto.

    Los archivos siguen el RFC 4180: campos entre comillas dobles y comillas internas duplicadas. Declararlo
    (`quote` y `escape`) junto con `multiLine` es lo que evita que un salto de línea dentro de una
    descripción se lea como un registro nuevo.
    """
    reader = (
        spark.read.option("header", True)
        .option("inferSchema", False)
        .option("quote", '"')
        .option("escape", '"')
        .option("mode", "PERMISSIVE")
        .option("encoding", "UTF-8")
    )
    if contract.multiline:
        reader = reader.option("multiLine", True)
    return reader.csv(uri)


def conform(df: DataFrame, contract: DatasetContract, partition: Partition) -> DataFrame:
    """Ajusta un archivo al contrato de su dataset y añade los metadatos de origen.

    Las columnas del contrato que el archivo no trae quedan nulas; las que trae de más se conservan como
    JSON en `_extra_columns`. Todos los archivos de un dataset terminan con las mismas columnas, por nombre.
    """
    present = set(df.columns)
    extras = sorted(present - set(contract.columns))
    missing = [column for column in contract.columns if column not in present]
    if extras:
        logger.warning(
            "Deriva de esquema en %s (%s): columnas nuevas %s", contract.name, partition.subpath(), extras
        )
    if missing:
        logger.info("%s (%s) no trae las columnas %s", contract.name, partition.subpath(), missing)

    contract_columns = [
        F.col(column) if column in present else F.lit(None).cast("string").alias(column)
        for column in contract.columns
    ]
    extra_columns = F.to_json(F.struct(*extras)) if extras else F.lit(None).cast("string")
    return df.select(
        *contract_columns,
        extra_columns.alias("_extra_columns"),
        F.col("_metadata.file_path").alias("_source_file"),
        F.current_timestamp().alias("_ingested_at"),
        F.lit(partition.city).alias("city"),
        F.lit(partition.snapshot_date).cast("date").alias("snapshot_date"),
    )


def pending_partitions(
    ctx: PipelineContext, dataset: str, cities: Sequence[City], *, force: bool
) -> list[Partition]:
    """Particiones completas en raw que todavía no están en Bronze (todas, si `force`)."""
    slugs = {city.slug for city in cities}
    downloaded = {
        p for p in ctx.fs.list_partitions(ctx.paths.raw(dataset), marker=RAW_MANIFEST) if p.city in slugs
    }
    done = set() if force else ctx.fs.list_partitions(ctx.paths.bronze(dataset))
    return sorted(downloaded - done, key=lambda p: (p.city, p.snapshot_date))


def run_bronze(
    ctx: PipelineContext, cities: Sequence[City], datasets: Sequence[str], *, force: bool = False
) -> None:
    for dataset in datasets:
        contract = CONTRACTS[dataset]
        partitions = pending_partitions(ctx, dataset, cities, force=force)
        if not partitions:
            logger.info("bronze/%s: sin particiones pendientes", dataset)
            continue

        # Un DataFrame perezoso por archivo, unidos en un solo plan: como los .csv.gz no son divisibles,
        # cada archivo es una tarea y Spark los procesa en paralelo en un único job.
        frames = [
            conform(
                read_raw_csv(
                    ctx.spark,
                    f"{ctx.paths.raw_partition(dataset, partition)}/{contract.source_file}",
                    contract,
                ),
                contract,
                partition,
            )
            for partition in partitions
        ]
        unified = reduce(DataFrame.unionByName, frames)
        write_partitioned(
            unified, ctx.paths.bronze(dataset), max_records_per_file=ctx.config.bronze_max_records_per_file
        )
        logger.info("bronze/%s: %d particiones escritas", dataset, len(partitions))
