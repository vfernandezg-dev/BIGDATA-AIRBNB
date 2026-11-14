"""Etapa Gold: construye los marts a partir del último snapshot de cada ciudad."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from functools import reduce

from pyspark.sql import DataFrame
from pyspark.sql import functions as F
from pyspark.storagelevel import StorageLevel

from airbnb_lake import quality
from airbnb_lake.config import City
from airbnb_lake.context import PipelineContext
from airbnb_lake.gold import marts
from airbnb_lake.gold.segmentation import segment_neighbourhoods
from airbnb_lake.lake.io import read_latest, write_mart
from airbnb_lake.silver.job import SILVER_SOURCES

logger = logging.getLogger(__name__)


def run_gold(ctx: PipelineContext, cities: Sequence[City]) -> None:
    slugs = [city.slug for city in cities]
    gold = ctx.config.gold

    # Los anuncios alimentan casi todos los marts: se leen una vez y se mantienen en caché.
    listings = read_latest(ctx.spark, ctx.fs, ctx.paths.silver("listings"), slugs).persist(
        StorageLevel.MEMORY_AND_DISK
    )
    try:
        listing_quality = quality.listing_quality(listings)
        quality.assert_listings_quality(listing_quality, slugs)
        _write(ctx, "listing_quality", listing_quality)

        _write(ctx, "dim_city", marts.dim_city(listings))
        _write(ctx, "city_kpis", marts.city_kpis(listings))
        _write(ctx, "room_type_stats", marts.room_type_stats(listings))
        _write(ctx, "price_histogram", marts.price_histogram(listings, gold))
        _write(ctx, "map_grid", marts.map_grid(listings, gold.map_cell_degrees))
        _write(ctx, "host_concentration", marts.host_concentration(listings))
        _write_neighbourhoods(ctx, listings)
    finally:
        listings.unpersist()

    calendar = read_latest(ctx.spark, ctx.fs, ctx.paths.silver("calendar_monthly"), slugs)
    quality.assert_calendar_quality(calendar)
    _write(ctx, "availability_monthly", marts.availability_monthly(calendar))

    reviews = read_latest(ctx.spark, ctx.fs, ctx.paths.silver("reviews"), slugs)
    _write(ctx, "reviews_monthly", marts.reviews_monthly(reviews))

    _write(ctx, "quality_counts", _stage_counts(ctx, slugs))


def _write(ctx: PipelineContext, mart: str, df: DataFrame) -> None:
    write_mart(df, ctx.paths.gold(mart))
    logger.info("gold/%s escrito", mart)


def _write_neighbourhoods(ctx: PipelineContext, listings: DataFrame) -> None:
    gold = ctx.config.gold
    stats = marts.neighbourhood_stats(listings, gold.min_listings_per_neighbourhood).persist()
    try:
        segmentation = segment_neighbourhoods(stats, gold.segmentation)
        if segmentation is None:
            _write(ctx, "neighbourhood_stats", stats.withColumn("segment", F.lit(None).cast("int")))
            return
        logger.info(
            "Segmentación de barrios: k=%d, silueta %.4f", segmentation.k, segmentation.silhouette or 0.0
        )
        segments = segmentation.assignments.select("city", "neighbourhood", "segment")
        _write(ctx, "neighbourhood_stats", stats.join(segments, on=["city", "neighbourhood"], how="left"))
        _write(ctx, "segment_profiles", segmentation.profiles)
    finally:
        stats.unpersist()


def _stage_counts(ctx: PipelineContext, slugs: Sequence[str]) -> DataFrame:
    frames = [
        quality.stage_counts(
            dataset,
            read_latest(ctx.spark, ctx.fs, ctx.paths.bronze(dataset), slugs),
            read_latest(ctx.spark, ctx.fs, ctx.paths.silver(table), slugs),
        )
        for table, dataset in SILVER_SOURCES.items()
    ]
    return reduce(DataFrame.unionByName, frames)
