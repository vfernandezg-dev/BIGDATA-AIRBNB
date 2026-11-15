"""Contexto de ejecución que comparten las etapas del pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from pyspark.sql import SparkSession

from airbnb_lake.config import PipelineConfig
from airbnb_lake.lake.fs import HadoopFs
from airbnb_lake.lake.paths import LakePaths


@dataclass(frozen=True)
class PipelineContext:
    config: PipelineConfig
    spark: SparkSession
    fs: HadoopFs
    paths: LakePaths
    run_id: str

    @classmethod
    def create(cls, config: PipelineConfig, spark: SparkSession) -> PipelineContext:
        return cls(
            config=config,
            spark=spark,
            fs=HadoopFs(spark),
            paths=LakePaths(config.lake_root),
            run_id=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
        )
