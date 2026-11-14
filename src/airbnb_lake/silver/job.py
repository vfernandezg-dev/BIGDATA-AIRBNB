"""Etapa Silver: procesa las particiones de Bronze que aún no están en Silver."""

from __future__ import annotations

import logging
from collections.abc import Callable, Sequence

from pyspark.sql import DataFrame, SparkSession

from airbnb_lake.config import City, PipelineConfig
from airbnb_lake.context import PipelineContext
from airbnb_lake.lake.io import read_partitions, write_partitioned
from airbnb_lake.lake.paths import Partition
from airbnb_lake.silver.listings import build_listings
from airbnb_lake.silver.tables import build_calendar_monthly, build_neighbourhoods, build_reviews

logger = logging.getLogger(__name__)

# Tabla de Silver -> dataset de Bronze del que sale.
SILVER_SOURCES: dict[str, str] = {
    "listings": "listings",
    "calendar_monthly": "calendar",
    "reviews": "reviews",
    "neighbourhoods": "neighbourhoods",
}


def cities_dimension(spark: SparkSession, config: PipelineConfig) -> DataFrame:
    rows = [(city.slug, city.name, city.country, city.currency) for city in config.cities]
    return spark.createDataFrame(rows, "city string, city_name string, country string, city_currency string")


def fx_dimension(spark: SparkSession, config: PipelineConfig) -> DataFrame:
    rows = [(currency, float(rate)) for currency, rate in sorted(config.fx.units_per_usd.items())]
    return spark.createDataFrame(rows, "currency string, units_per_usd double")


def run_silver(ctx: PipelineContext, cities: Sequence[City], *, force: bool = False) -> None:
    config = ctx.config
    builders: dict[str, Callable[[DataFrame], DataFrame]] = {
        "listings": lambda bronze: build_listings(
            bronze, cities_dimension(ctx.spark, config), fx_dimension(ctx.spark, config), config.cleaning
        ),
        "calendar_monthly": build_calendar_monthly,
        "reviews": build_reviews,
        "neighbourhoods": build_neighbourhoods,
    }
    slugs = {city.slug for city in cities}

    for table, build in builders.items():
        bronze_uri = ctx.paths.bronze(SILVER_SOURCES[table])
        silver_uri = ctx.paths.silver(table)
        available = {partition for partition in ctx.fs.list_partitions(bronze_uri) if partition.city in slugs}
        done: set[Partition] = set() if force else ctx.fs.list_partitions(silver_uri)
        pending = sorted(available - done, key=lambda partition: (partition.city, partition.snapshot_date))
        if not pending:
            logger.info("silver/%s: sin particiones pendientes", table)
            continue

        write_partitioned(build(read_partitions(ctx.spark, bronze_uri, pending)), silver_uri)
        logger.info("silver/%s: %d particiones escritas", table, len(pending))
