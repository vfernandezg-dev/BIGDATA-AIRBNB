"""Recorrido completo sobre un lake temporal: raw -> Bronze -> Silver -> Gold -> modelo -> marts.

Parte de archivos CSV comprimidos con la forma de los de Inside Airbnb (incluidos saltos de línea dentro de
los campos) y comprueba que cada etapa deja lo que la siguiente necesita.
"""

from __future__ import annotations

import random
from dataclasses import replace
from pathlib import Path

import pytest

from airbnb_lake.bronze import run_bronze
from airbnb_lake.context import PipelineContext
from airbnb_lake.gold.job import run_gold
from airbnb_lake.lake.paths import RAW_MANIFEST, Partition
from airbnb_lake.ml.train import run_train
from airbnb_lake.schemas import CALENDAR, CONTRACTS, LISTINGS, REVIEWS
from airbnb_lake.serving.publish import MARTS, load_marts
from airbnb_lake.silver.job import run_silver
from tests.helpers import SNAPSHOT, listing, write_csv_gz

CITIES = {"santiago": ("CLP", -33.43, -70.61), "madrid": ("EUR", 40.41, -3.70)}
LISTINGS_PER_CITY = 150
NEIGHBOURHOODS = ("Centro", "Norte", "Sur")


def _stage(ctx: PipelineContext, dataset: str, city: str, local: Path) -> None:
    partition_uri = ctx.paths.raw_partition(dataset, Partition(city, SNAPSHOT))
    ctx.fs.mkdirs(partition_uri)
    ctx.fs.put(local, f"{partition_uri}/{CONTRACTS[dataset].source_file}")
    ctx.fs.write_text(f"{partition_uri}/{RAW_MANIFEST}", "{}")


def _generate_raw(ctx: PipelineContext, tmp_path: Path) -> None:
    rng = random.Random(7)
    for city, (currency, lat, lon) in CITIES.items():
        rate = ctx.config.fx.units_per_usd[currency]
        listings, calendar, reviews = [], [], []
        for i in range(1, LISTINGS_PER_CITY + 1):
            accommodates = rng.randint(1, 6)
            entire = rng.random() < 0.6
            # El precio depende de la capacidad y del tipo: es la señal que el modelo debe encontrar.
            price_usd = (25 + 18 * accommodates) * (1.5 if entire else 1.0) * rng.uniform(0.9, 1.1)
            row = listing(
                i,
                city=city,
                name=f"Alojamiento {i},\ncon salto de línea",
                accommodates=str(accommodates),
                bedrooms=str(max(1, accommodates // 2)),
                room_type="Entire home/apt" if entire else "Private room",
                property_type="Entire rental unit" if entire else "Private room in home",
                neighbourhood_cleansed=NEIGHBOURHOODS[i % 3],
                latitude=f"{lat + rng.uniform(-0.03, 0.03):.5f}",
                longitude=f"{lon + rng.uniform(-0.03, 0.03):.5f}",
                price=f"${price_usd * rate:,.2f}" if i % 10 else None,
                price_quote_raw=f'{{"quote": {{"currency": "{currency}"}}}}',
                host_id=str(1 + i % 40),
            )
            listings.append([row[column] or "" for column in LISTINGS.columns])
            calendar += [
                (str(i), f"2026-10-{day:02d}", "t" if rng.random() < 0.5 else "f", "2", "365")
                for day in (1, 2, 3)
            ]
            reviews.append((str(i), str(i * 10), "2026-08-15", "77", "Ana", "Todo muy bien,\ngracias"))

        base = tmp_path / city
        write_csv_gz(base / "listings.csv.gz", LISTINGS.columns, listings)
        write_csv_gz(
            base / "calendar.csv.gz",
            ("listing_id", "date", "available", "minimum_nights", "maximum_nights"),
            calendar,
        )
        write_csv_gz(base / "reviews.csv.gz", REVIEWS.columns, reviews)
        (base / "neighbourhoods.csv").write_text(
            "neighbourhood_group,neighbourhood\n" + "".join(f",{name}\n" for name in NEIGHBOURHOODS), "utf-8"
        )
        for dataset in CONTRACTS:
            _stage(ctx, dataset, city, base / CONTRACTS[dataset].source_file)


@pytest.fixture
def small_ctx(ctx: PipelineContext) -> PipelineContext:
    """Contexto con un modelo diminuto: el test comprueba el recorrido, no la calidad del ajuste."""
    ml = replace(ctx.config.ml, gbt=replace(ctx.config.ml.gbt, max_iter=10, max_depth_grid=(3,)))
    gold = replace(ctx.config.gold, min_listings_per_neighbourhood=5)
    return replace(ctx, config=replace(ctx.config, ml=ml, gold=gold))


def test_full_pipeline_on_a_temporary_lake(small_ctx: PipelineContext, tmp_path: Path) -> None:
    ctx = small_ctx
    cities = ctx.config.select_cities(list(CITIES))
    _generate_raw(ctx, tmp_path)

    run_bronze(ctx, cities, list(CONTRACTS))
    run_silver(ctx, cities)
    run_gold(ctx, cities)
    run_train(ctx, cities)

    spark = ctx.spark
    bronze_listings = spark.read.parquet(ctx.paths.bronze("listings"))
    assert bronze_listings.count() == 2 * LISTINGS_PER_CITY
    assert bronze_listings.where("name LIKE '%salto de línea'").count() == 2 * LISTINGS_PER_CITY

    silver_listings = spark.read.parquet(ctx.paths.silver("listings"))
    assert silver_listings.count() == 2 * LISTINGS_PER_CITY
    assert {row["currency"] for row in silver_listings.select("currency").distinct().collect()} == {
        "CLP",
        "EUR",
    }
    assert spark.read.parquet(ctx.paths.silver("calendar_monthly")).count() == 2 * LISTINGS_PER_CITY
    assert "comments" not in spark.read.parquet(ctx.paths.silver("reviews")).columns
    assert spark.read.parquet(ctx.paths.bronze(CALENDAR.name)).where("price IS NOT NULL").count() == 0

    kpis = {row["city"]: row for row in spark.read.parquet(ctx.paths.gold("city_kpis")).collect()}
    assert set(kpis) == set(CITIES)
    for row in kpis.values():
        assert row["n_listings"] == LISTINGS_PER_CITY
        # Los precios se generaron en USD y se guardaron en moneda local: la conversión los devuelve a USD.
        assert 60 < row["median_price_usd"] < 160

    metrics = {
        (row["model"], row["scope"]): row
        for row in spark.read.parquet(ctx.paths.gold("model_metrics")).collect()
    }
    gbt, baseline = metrics[("gbt", "global")], metrics[("baseline", "global")]
    assert gbt["r2_log"] > 0.5
    assert gbt["rmse_log"] < baseline["rmse_log"]
    assert gbt["n_train"] + gbt["n_test"] == spark.read.parquet(ctx.paths.gold("listings_scored")).count()

    top_features = [
        row["feature"]
        for row in spark.read.parquet(ctx.paths.gold("feature_importance")).orderBy("rank").limit(4).collect()
    ]
    assert "accommodates" in top_features or "bedrooms" in top_features

    run_id = ctx.fs.read_text(ctx.paths.model_latest("price"))
    assert ctx.fs.exists(f"{ctx.paths.model_run('price', run_id)}/model")
    assert ctx.fs.exists(f"{ctx.paths.model_run('price', run_id)}/metrics.json")

    # Todos los marts se pueden leer con las columnas exactas que espera el esquema de serving.
    marts = load_marts(ctx)
    assert set(marts) == {spec.table for spec in MARTS}
    for spec in MARTS:
        if spec.table != "segment_profiles":
            assert marts[spec.table], f"el mart {spec.table} está vacío"
        assert all(len(row) == len(spec.columns) for row in marts[spec.table])


def test_rerunning_the_pipeline_does_not_change_the_results(
    small_ctx: PipelineContext, tmp_path: Path
) -> None:
    ctx = small_ctx
    cities = ctx.config.select_cities(list(CITIES))
    _generate_raw(ctx, tmp_path)

    def run_and_count() -> dict[str, int]:
        run_bronze(ctx, cities, list(CONTRACTS))
        run_silver(ctx, cities)
        return {
            "bronze": ctx.spark.read.parquet(ctx.paths.bronze("reviews")).count(),
            "silver": ctx.spark.read.parquet(ctx.paths.silver("listings")).count(),
        }

    first = run_and_count()
    second = run_and_count()
    run_silver(ctx, cities, force=True)
    forced = ctx.spark.read.parquet(ctx.paths.silver("listings")).count()

    assert first == second == {"bronze": 2 * LISTINGS_PER_CITY, "silver": 2 * LISTINGS_PER_CITY}
    assert forced == 2 * LISTINGS_PER_CITY
