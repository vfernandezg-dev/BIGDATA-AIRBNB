"""Bronze: lectura fiel del CSV, contrato de columnas e idempotencia."""

from __future__ import annotations

import json
from pathlib import Path

from pyspark.sql import SparkSession

from airbnb_lake.bronze import conform, read_raw_csv, run_bronze
from airbnb_lake.context import PipelineContext
from airbnb_lake.lake.paths import RAW_MANIFEST, Partition
from airbnb_lake.schemas import DatasetContract
from tests.helpers import SNAPSHOT, write_csv_gz

DEMO = DatasetContract(
    name="demo",
    source_folder="data",
    source_file="demo.csv.gz",
    columns=("id", "name", "room_type", "price"),
    multiline=True,
    key_columns=("id",),
)
ROWS = [
    ("1", "Depto luminoso,\ncerca del metro", "Entire home/apt", "$50,000.00"),
    ("2", 'Habitación "tranquila" con vista', "Private room", "$20,000.00"),
    ("3", "Loft\n\ncon terraza", "Entire home/apt", ""),
]
PARTITION = Partition("santiago", SNAPSHOT)


def test_multiline_fields_do_not_create_phantom_rows(spark: SparkSession, tmp_path: Path) -> None:
    """Regresión del bug original: Spark leía 15.143 filas de un archivo con 15.051 registros."""
    path = tmp_path / "demo.csv.gz"
    write_csv_gz(path, DEMO.columns, ROWS)

    rows = read_raw_csv(spark, path.as_uri(), DEMO).orderBy("id").collect()

    assert [row["id"] for row in rows] == ["1", "2", "3"]
    assert [row["room_type"] for row in rows] == ["Entire home/apt", "Private room", "Entire home/apt"]
    assert rows[0]["name"] == "Depto luminoso,\ncerca del metro"
    assert rows[1]["name"] == 'Habitación "tranquila" con vista'
    assert rows[2]["price"] is None

    # La lectura del proyecto original (sin multiLine ni escape) parte los registros por cada salto de línea.
    legacy_count = spark.read.option("header", True).csv(path.as_uri()).count()
    assert legacy_count > len(ROWS)


def test_conform_fills_missing_columns_and_keeps_extra_ones(spark: SparkSession, tmp_path: Path) -> None:
    path = tmp_path / "drift.csv.gz"
    # Un snapshot con otra forma: falta `price`, aparece `new_field` y el orden es distinto.
    write_csv_gz(path, ("room_type", "id", "new_field", "name"), [("Private room", "9", "x", "Casa")])

    row = conform(read_raw_csv(spark, path.as_uri(), DEMO), DEMO, PARTITION).first()

    assert row is not None
    assert (row["id"], row["name"], row["room_type"], row["price"]) == ("9", "Casa", "Private room", None)
    assert json.loads(row["_extra_columns"]) == {"new_field": "x"}
    assert (row["city"], str(row["snapshot_date"])) == ("santiago", SNAPSHOT)
    assert row["_source_file"].endswith("drift.csv.gz")


def _stage_raw(ctx: PipelineContext, tmp_path: Path, city: str, rows: list[tuple[str, ...]]) -> None:
    local = tmp_path / f"{city}-neighbourhoods.csv"
    local.write_text(
        "neighbourhood_group,neighbourhood\n" + "\n".join(",".join(row) for row in rows) + "\n", "utf-8"
    )
    partition_uri = ctx.paths.raw_partition("neighbourhoods", Partition(city, SNAPSHOT))
    ctx.fs.mkdirs(partition_uri)
    ctx.fs.put(local, f"{partition_uri}/neighbourhoods.csv")
    ctx.fs.write_text(f"{partition_uri}/{RAW_MANIFEST}", "{}")


def test_run_bronze_is_incremental_and_idempotent(ctx: PipelineContext, tmp_path: Path) -> None:
    cities = ctx.config.select_cities(["santiago", "madrid"])
    bronze_uri = ctx.paths.bronze("neighbourhoods")

    _stage_raw(ctx, tmp_path, "santiago", [("", "Providencia"), ("", "Las Condes")])
    run_bronze(ctx, cities, ["neighbourhoods"])
    assert ctx.spark.read.parquet(bronze_uri).count() == 2

    # Llega otra ciudad: solo se procesa la partición nueva y la existente no se toca.
    _stage_raw(ctx, tmp_path, "madrid", [("Centro", "Sol")])
    run_bronze(ctx, cities, ["neighbourhoods"])
    run_bronze(ctx, cities, ["neighbourhoods"])

    counts = {
        row["city"]: row["count"]
        for row in ctx.spark.read.parquet(bronze_uri).groupBy("city").count().collect()
    }
    assert counts == {"santiago": 2, "madrid": 1}


def test_partitions_without_manifest_are_ignored(ctx: PipelineContext, tmp_path: Path) -> None:
    """Una descarga interrumpida no deja manifiesto: Bronze no debe procesar ese archivo a medias."""
    local = tmp_path / "partial.csv"
    local.write_text("neighbourhood_group,neighbourhood\n,Incompleto\n", "utf-8")
    partition_uri = ctx.paths.raw_partition("neighbourhoods", PARTITION)
    ctx.fs.mkdirs(partition_uri)
    ctx.fs.put(local, f"{partition_uri}/neighbourhoods.csv")

    run_bronze(ctx, ctx.config.select_cities(["santiago"]), ["neighbourhoods"])

    assert not ctx.fs.exists(ctx.paths.bronze("neighbourhoods"))
