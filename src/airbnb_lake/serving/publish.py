"""Publica los marts de Gold en la base de datos de serving.

Todos los marts se cargan en una sola transacción (`DELETE` + `COPY`): quien consulta ve los datos de la
publicación anterior o los de la nueva, nunca una mezcla, y `DELETE` no bloquea las lecturas en curso.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from importlib import resources
from typing import Any

import psycopg
import requests
from psycopg import sql

from airbnb_lake.context import PipelineContext
from airbnb_lake.errors import MissingInputError, PublishError

logger = logging.getLogger(__name__)

SCHEMA = "marts"
# Súbelo al cambiar schema.sql: la siguiente publicación recreará el esquema.
SCHEMA_VERSION = 1
READONLY_ROLE = "dashboard_ro"
_REVALIDATE_TIMEOUT_SECONDS = 30


@dataclass(frozen=True)
class MartSpec:
    table: str
    columns: tuple[str, ...]
    # Los marts opcionales pueden faltar (por ejemplo, los del modelo si aún no se ha entrenado).
    required: bool = True


MARTS: tuple[MartSpec, ...] = (
    MartSpec(
        "dim_city",
        (
            "city",
            "city_name",
            "country",
            "currency",
            "snapshot_date",
            "center_lat",
            "center_lon",
            "min_lat",
            "max_lat",
            "min_lon",
            "max_lon",
        ),
    ),
    MartSpec(
        "city_kpis",
        (
            "city",
            "snapshot_date",
            "n_listings",
            "n_priced",
            "n_hosts",
            "p25_price_usd",
            "median_price_usd",
            "p75_price_usd",
            "avg_price_usd",
            "pct_entire_home",
            "pct_private_room",
            "pct_multi_listing",
            "pct_superhost",
            "pct_licensed",
            "pct_short_term",
            "avg_rating",
            "n_reviews_ltm",
            "avg_reviews_per_month",
            "avg_availability_365",
            "avg_occupancy_l365d",
            "median_min_nights",
            "median_revenue_l365d_usd",
        ),
    ),
    MartSpec(
        "neighbourhood_stats",
        (
            "city",
            "neighbourhood",
            "neighbourhood_group",
            "n_listings",
            "n_priced",
            "p25_price_usd",
            "median_price_usd",
            "p75_price_usd",
            "avg_rating",
            "avg_availability_365",
            "avg_occupancy_l365d",
            "n_reviews_ltm",
            "avg_reviews_per_month",
            "pct_entire_home",
            "center_lat",
            "center_lon",
            "price_vs_city",
            "listings_share",
            "segment",
        ),
    ),
    MartSpec(
        "segment_profiles",
        (
            "segment",
            "n_neighbourhoods",
            "avg_price_vs_city",
            "avg_reviews_per_month",
            "avg_availability_365",
            "avg_pct_entire_home",
            "avg_listings_share",
        ),
        required=False,
    ),
    MartSpec(
        "room_type_stats",
        (
            "city",
            "room_type",
            "n_listings",
            "n_priced",
            "p25_price_usd",
            "median_price_usd",
            "p75_price_usd",
            "avg_accommodates",
            "avg_rating",
            "listings_share",
        ),
    ),
    MartSpec("price_histogram", ("city", "room_type", "bucket_from_usd", "bucket_to_usd", "n_listings")),
    MartSpec(
        "map_grid",
        (
            "city",
            "cell_lat",
            "cell_lon",
            "n_listings",
            "n_priced",
            "median_price_usd",
            "avg_rating",
            "avg_availability_365",
        ),
    ),
    MartSpec("host_concentration", ("city", "bucket_order", "bucket_label", "n_hosts", "n_listings")),
    MartSpec("reviews_monthly", ("city", "month", "n_reviews", "n_listings_reviewed")),
    MartSpec(
        "availability_monthly",
        ("city", "month", "n_listings", "days_total", "days_available", "availability_rate"),
    ),
    MartSpec(
        "listing_quality",
        (
            "city",
            "snapshot_date",
            "n_listings",
            "n_distinct_listings",
            "n_with_price",
            "n_price_outliers",
            "n_geo_invalid",
            "n_room_type_invalid",
            "n_min_nights_invalid",
            "n_model_eligible",
        ),
    ),
    MartSpec("quality_counts", ("city", "dataset", "snapshot_date", "bronze_rows", "silver_rows")),
    MartSpec(
        "model_metrics",
        (
            "run_id",
            "model",
            "scope",
            "n_train",
            "n_test",
            "rmse_log",
            "mae_log",
            "r2_log",
            "mae_usd",
            "rmse_usd",
            "mape",
            "median_ape",
            "trained_at",
        ),
        required=False,
    ),
    MartSpec("feature_importance", ("run_id", "feature", "importance", "rank"), required=False),
    MartSpec(
        "prediction_sample", ("run_id", "city", "room_type", "actual_usd", "predicted_usd"), required=False
    ),
    MartSpec(
        "neighbourhood_price_index",
        ("city", "neighbourhood", "n_scored", "median_actual_usd", "median_predicted_usd", "price_index"),
        required=False,
    ),
)


def load_marts(ctx: PipelineContext) -> dict[str, list[tuple[Any, ...]]]:
    """Lee cada mart de Gold a memoria del driver.

    Es seguro porque los marts son agregados pequeños por diseño; el tope de filas convierte un mart que
    crece más de lo previsto en un error claro en lugar de en un driver sin memoria.
    """
    limit = ctx.config.serving.max_rows_per_mart
    loaded: dict[str, list[tuple[Any, ...]]] = {}
    for spec in MARTS:
        uri = ctx.paths.gold(spec.table)
        if not ctx.fs.exists(uri):
            if spec.required:
                raise MissingInputError(f"Falta el mart gold/{spec.table}: ejecuta antes la etapa gold")
            logger.warning("gold/%s no existe: se publica vacío", spec.table)
            loaded[spec.table] = []
            continue
        rows = ctx.spark.read.parquet(uri).select(*spec.columns).limit(limit + 1).collect()
        if len(rows) > limit:
            raise PublishError(
                f"gold/{spec.table} supera las {limit} filas permitidas para un mart: revisa su grano"
            )
        loaded[spec.table] = [tuple(row) for row in rows]
    return loaded


def publish_marts(
    dsn: str,
    marts: Mapping[str, Sequence[tuple[Any, ...]]],
    *,
    pipeline_run_id: str,
    fx_as_of: Any,
    readonly_password: str | None,
) -> None:
    """Carga los marts en Postgres de forma atómica y deja el rol de solo lectura con sus permisos."""
    schema_sql = resources.files("airbnb_lake.serving").joinpath("schema.sql").read_text(encoding="utf-8")
    try:
        with psycopg.connect(dsn, connect_timeout=30) as connection, connection.transaction():
            _ensure_schema(connection, schema_sql)
            for spec in MARTS:
                _replace_table(connection, spec, marts.get(spec.table, ()))
            _log_publication(connection, marts, pipeline_run_id, fx_as_of)
            _grant_readonly(connection, readonly_password)
    except psycopg.Error as exc:
        raise PublishError(f"La publicación falló y no se aplicó ningún cambio: {exc}") from exc


def _ensure_schema(connection: psycopg.Connection[Any], schema_sql: str) -> None:
    table_exists = connection.execute("SELECT to_regclass(%s)", (f"{SCHEMA}.schema_version",)).fetchone()
    if table_exists and table_exists[0] is not None:
        row = connection.execute(
            sql.SQL("SELECT version FROM {}.schema_version").format(sql.Identifier(SCHEMA))
        ).fetchone()
        if row is not None and row[0] != SCHEMA_VERSION:
            logger.warning(
                "El esquema de serving pasa de la versión %s a la %s: se recrea", row[0], SCHEMA_VERSION
            )
            connection.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(SCHEMA)))
    # Sin parámetros, psycopg envía el script completo en una sola llamada.
    connection.execute(schema_sql)
    connection.execute(
        sql.SQL(
            "INSERT INTO {}.schema_version (id, version) VALUES (true, %s) "
            "ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version"
        ).format(sql.Identifier(SCHEMA)),
        (SCHEMA_VERSION,),
    )


def _replace_table(
    connection: psycopg.Connection[Any], spec: MartSpec, rows: Sequence[tuple[Any, ...]]
) -> None:
    table = sql.Identifier(SCHEMA, spec.table)
    columns = sql.SQL(", ").join(sql.Identifier(column) for column in spec.columns)
    with connection.cursor() as cursor:
        cursor.execute(sql.SQL("DELETE FROM {}").format(table))
        with cursor.copy(sql.SQL("COPY {} ({}) FROM STDIN").format(table, columns)) as copy:
            for row in rows:
                copy.write_row(row)
    logger.info("serving <- %s (%d filas)", spec.table, len(rows))


def _log_publication(
    connection: psycopg.Connection[Any],
    marts: Mapping[str, Sequence[tuple[Any, ...]]],
    pipeline_run_id: str,
    fx_as_of: Any,
) -> None:
    kpi_columns = next(spec.columns for spec in MARTS if spec.table == "city_kpis")
    n_listings = sum(int(row[kpi_columns.index("n_listings")]) for row in marts.get("city_kpis", ()))
    connection.execute(
        sql.SQL(
            "INSERT INTO {}.publish_log (id, published_at, pipeline_run_id, fx_as_of, n_cities, n_listings) "
            "VALUES (true, %s, %s, %s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET published_at = EXCLUDED.published_at, "
            "pipeline_run_id = EXCLUDED.pipeline_run_id, fx_as_of = EXCLUDED.fx_as_of, "
            "n_cities = EXCLUDED.n_cities, n_listings = EXCLUDED.n_listings"
        ).format(sql.Identifier(SCHEMA)),
        (datetime.now(timezone.utc), pipeline_run_id, fx_as_of, len(marts.get("dim_city", ())), n_listings),
    )


def _grant_readonly(connection: psycopg.Connection[Any], password: str | None) -> None:
    """Crea (o actualiza) el rol con el que se conecta el dashboard y le da solo lectura sobre los marts.

    El rol se crea por SQL y no desde la consola o la API de Neon: los roles creados allí pertenecen a
    `neon_superuser` y pueden escribir.
    """
    role = sql.Identifier(READONLY_ROLE)
    schema = sql.Identifier(SCHEMA)
    exists = connection.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (READONLY_ROLE,)).fetchone()
    if password:
        statement = "ALTER ROLE {} LOGIN PASSWORD {}" if exists else "CREATE ROLE {} LOGIN PASSWORD {}"
        connection.execute(sql.SQL(statement).format(role, sql.Literal(password)))
    elif not exists:
        logger.warning("No se define DASHBOARD_DB_PASSWORD: no se crea el rol %s", READONLY_ROLE)
        return
    connection.execute(sql.SQL("GRANT USAGE ON SCHEMA {} TO {}").format(schema, role))
    connection.execute(sql.SQL("GRANT SELECT ON ALL TABLES IN SCHEMA {} TO {}").format(schema, role))


def revalidate_dashboard(url: str, secret: str) -> bool:
    """Pide al dashboard que regenere sus páginas con los datos recién publicados."""
    try:
        response = requests.post(
            url, headers={"x-revalidate-secret": secret}, timeout=_REVALIDATE_TIMEOUT_SECONDS
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.warning(
            "Los datos están publicados, pero el dashboard no confirmó la revalidación (%s). "
            "Seguirá mostrando la versión anterior hasta que se vuelva a desplegar o revalidar.",
            exc,
        )
        return False
    logger.info("Dashboard revalidado: %s", url)
    return True


def run_publish(ctx: PipelineContext, env: Mapping[str, str] | None = None) -> None:
    environment = os.environ if env is None else env
    dsn = environment.get("SERVING_DATABASE_URL")
    if not dsn:
        raise PublishError("Define SERVING_DATABASE_URL con la conexión a la base de datos de serving")

    marts = load_marts(ctx)
    publish_marts(
        dsn,
        marts,
        pipeline_run_id=ctx.run_id,
        fx_as_of=ctx.config.fx.as_of,
        readonly_password=environment.get("DASHBOARD_DB_PASSWORD") or None,
    )
    logger.info(
        "Publicación completada: %d marts, %d filas", len(marts), sum(len(rows) for rows in marts.values())
    )

    url = environment.get("DASHBOARD_REVALIDATE_URL")
    secret = environment.get("DASHBOARD_REVALIDATE_SECRET")
    if url and secret:
        revalidate_dashboard(url, secret)
    else:
        logger.info("Sin DASHBOARD_REVALIDATE_URL: no se revalida ningún dashboard")
