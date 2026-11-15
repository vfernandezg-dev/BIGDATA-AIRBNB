"""Línea de órdenes del pipeline.

    python -m airbnb_lake run                      # todas las etapas, todas las ciudades configuradas
    python -m airbnb_lake ingest --cities santiago # una etapa, un subconjunto de ciudades
    python -m airbnb_lake silver --force           # reprocesa aunque la partición ya exista

Cada etapa es idempotente: procesa solo lo que falta y se puede relanzar tras un fallo.
"""

from __future__ import annotations

import argparse
import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from airbnb_lake.config import City, load_config
from airbnb_lake.context import PipelineContext
from airbnb_lake.errors import PipelineError
from airbnb_lake.logging_config import configure_logging, timed
from airbnb_lake.schemas import DATASETS
from airbnb_lake.spark import build_spark

logger = logging.getLogger("airbnb_lake")


@dataclass(frozen=True)
class StageArgs:
    cities: tuple[City, ...]
    datasets: tuple[str, ...]
    force: bool


def _catalog(ctx: PipelineContext, args: StageArgs) -> None:
    from airbnb_lake.ingestion.downloader import build_session, fetch_catalog

    catalog = fetch_catalog(build_session(ctx.config.source), ctx.config.source)
    logger.info("El catálogo publica %d ciudades", len(catalog.source_paths()))
    for file in catalog.resolve(args.cities, args.datasets):
        logger.info("%-16s %-14s snapshot %s  %s", file.city, file.dataset, file.snapshot_date, file.url)


def _ingest(ctx: PipelineContext, args: StageArgs) -> None:
    from airbnb_lake.ingestion.downloader import run_ingest

    summary = run_ingest(ctx, args.cities, args.datasets)
    logger.info(
        "Ingesta: %d archivos descargados (%.2f GB), %d ya estaban en raw",
        summary.downloaded,
        summary.bytes_downloaded / 1e9,
        summary.skipped,
    )


def _bronze(ctx: PipelineContext, args: StageArgs) -> None:
    from airbnb_lake.bronze import run_bronze

    run_bronze(ctx, args.cities, args.datasets, force=args.force)


def _silver(ctx: PipelineContext, args: StageArgs) -> None:
    from airbnb_lake.silver.job import run_silver

    run_silver(ctx, args.cities, force=args.force)


def _gold(ctx: PipelineContext, args: StageArgs) -> None:
    from airbnb_lake.gold.job import run_gold

    run_gold(ctx, args.cities)


def _train(ctx: PipelineContext, args: StageArgs) -> None:
    from airbnb_lake.ml.train import run_train

    run_train(ctx, args.cities)


def _publish(ctx: PipelineContext, args: StageArgs) -> None:
    from airbnb_lake.serving.publish import run_publish

    run_publish(ctx)


@dataclass(frozen=True)
class Stage:
    run: Callable[[PipelineContext, StageArgs], None]
    help: str
    # Las etapas que no procesan datos con Spark usan una sesión local y no reservan ejecutores.
    driver_only: bool = False


STAGES: dict[str, Stage] = {
    "catalog": Stage(
        _catalog, "Muestra qué snapshot publica Inside Airbnb para cada ciudad", driver_only=True
    ),
    "ingest": Stage(_ingest, "Descarga los archivos de origen a la zona raw", driver_only=True),
    "bronze": Stage(_bronze, "Convierte raw (CSV) a Bronze (Parquet fiel)"),
    "silver": Stage(_silver, "Tipa, limpia y deduplica Bronze en Silver"),
    "gold": Stage(_gold, "Construye los data marts analíticos"),
    "train": Stage(_train, "Entrena y evalúa el modelo de precios"),
    "publish": Stage(_publish, "Carga los marts en la base de datos de serving", driver_only=True),
}
# Orden de la ejecución completa (el catálogo es solo informativo).
RUN_ORDER = ("ingest", "bronze", "silver", "gold", "train", "publish")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="airbnb_lake", description="Pipeline batch de Inside Airbnb")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    subparsers = parser.add_subparsers(dest="stage", required=True, metavar="etapa")

    def add_common(subparser: argparse.ArgumentParser) -> None:
        subparser.add_argument(
            "--cities", help="Slugs separados por comas (por defecto, todas las de cities.yaml)"
        )
        subparser.add_argument(
            "--datasets", help=f"Datasets separados por comas (por defecto: {', '.join(DATASETS)})"
        )
        subparser.add_argument(
            "--force", action="store_true", help="Reprocesa las particiones aunque ya existan"
        )

    for name, stage in STAGES.items():
        add_common(subparsers.add_parser(name, help=stage.help))
    add_common(subparsers.add_parser("run", help=f"Ejecuta en orden: {' -> '.join(RUN_ORDER)}"))
    return parser


def _split(value: str | None) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()] if value else []


def main(argv: Sequence[str] | None = None) -> int:
    options = build_parser().parse_args(argv)
    configure_logging(options.log_level)

    try:
        config = load_config()
        datasets = tuple(_split(options.datasets)) or DATASETS
        unknown = sorted(set(datasets) - set(DATASETS))
        if unknown:
            raise PipelineError(
                f"Datasets desconocidos: {', '.join(unknown)}. Válidos: {', '.join(DATASETS)}"
            )
        args = StageArgs(
            cities=config.select_cities(_split(options.cities)), datasets=datasets, force=options.force
        )
    except PipelineError as exc:
        logger.error("%s", exc)
        return 1

    stage_names = RUN_ORDER if options.stage == "run" else (options.stage,)
    driver_only = all(STAGES[name].driver_only for name in stage_names)
    spark = build_spark(f"airbnb-lake:{options.stage}", driver_only=driver_only)
    try:
        ctx = PipelineContext.create(config, spark)
        logger.info(
            "run_id=%s lake=%s ciudades=%s",
            ctx.run_id,
            config.lake_root,
            ",".join(c.slug for c in args.cities),
        )
        for name in stage_names:
            with timed(logger, f"etapa {name}"):
                STAGES[name].run(ctx, args)
    except PipelineError as exc:
        logger.error("%s", exc)
        return 1
    except Exception:
        logger.exception("Error inesperado en la etapa %s", options.stage)
        return 2
    finally:
        spark.stop()
    return 0
