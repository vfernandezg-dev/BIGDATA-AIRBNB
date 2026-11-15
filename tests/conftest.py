"""Fixtures compartidas: una SparkSession local y un lake en un directorio temporal."""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from pyspark.sql import SparkSession

from airbnb_lake.config import PipelineConfig, load_config
from airbnb_lake.context import PipelineContext
from airbnb_lake.spark import build_spark

REPO_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def spark() -> Iterator[SparkSession]:
    # Los tests nunca usan el cluster: modo local, sin interfaz web y con pocas particiones de shuffle.
    os.environ["PYSPARK_SUBMIT_ARGS"] = (
        "--master local[2] --driver-memory 1g "
        "--conf spark.ui.enabled=false "
        "--conf spark.sql.shuffle.partitions=2 "
        "--conf spark.driver.host=localhost "
        "--conf spark.driver.bindAddress=127.0.0.1 "
        "pyspark-shell"
    )
    os.environ.pop("SPARK_CONF_DIR", None)
    session = build_spark("airbnb-lake-tests")
    yield session
    session.stop()


@pytest.fixture
def config(tmp_path: Path) -> PipelineConfig:
    env = {
        "AIRBNB_LAKE_ROOT": (tmp_path / "lake").as_uri(),
        "AIRBNB_LANDING_DIR": str(tmp_path / "landing"),
    }
    return load_config(REPO_ROOT / "conf", env)


@pytest.fixture
def ctx(spark: SparkSession, config: PipelineConfig) -> PipelineContext:
    return PipelineContext.create(config, spark)
