"""Publicación en Postgres: carga atómica, reemplazo completo y rol de solo lectura.

Necesitan una base de datos real (la `serving-db` del stack o el servicio de Postgres del CI). Sin
`SERVING_DATABASE_URL` se omiten.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import date
from typing import Any

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from airbnb_lake.errors import PublishError
from airbnb_lake.serving.publish import MARTS, READONLY_ROLE, publish_marts

TEST_DATABASE = "airbnb_lake_test"
READONLY_PASSWORD = os.environ.get("DASHBOARD_DB_PASSWORD", "dashboard_local")

pytestmark = pytest.mark.skipif(
    not os.environ.get("SERVING_DATABASE_URL"), reason="requiere SERVING_DATABASE_URL (Postgres)"
)


@pytest.fixture
def dsn() -> Iterator[str]:
    """Una base de datos vacía para cada test, para no tocar los marts publicados en local."""
    admin_dsn = os.environ["SERVING_DATABASE_URL"]
    database = sql.Identifier(TEST_DATABASE)
    with psycopg.connect(admin_dsn, autocommit=True) as admin:
        admin.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(database))
        admin.execute(sql.SQL("CREATE DATABASE {}").format(database))
    yield make_conninfo(admin_dsn, dbname=TEST_DATABASE)
    with psycopg.connect(admin_dsn, autocommit=True) as admin:
        admin.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(database))


def city_kpis_row(city: str, n_listings: int) -> tuple[Any, ...]:
    columns = next(spec.columns for spec in MARTS if spec.table == "city_kpis")
    values: dict[str, Any] = dict.fromkeys(columns)
    values.update(
        city=city, snapshot_date=date(2026, 9, 23), n_listings=n_listings, n_priced=n_listings, n_hosts=3
    )
    return tuple(values[column] for column in columns)


def dim_city_row(city: str) -> tuple[Any, ...]:
    return (city, city.title(), "Chile", "CLP", date(2026, 9, 23), -33.4, -70.6, -33.6, -33.3, -70.8, -70.5)


def publish(dsn: str, marts: dict[str, list[tuple[Any, ...]]]) -> None:
    publish_marts(
        dsn,
        marts,
        pipeline_run_id="test-run",
        fx_as_of=date(2026, 11, 14),
        readonly_password=READONLY_PASSWORD,
    )


def scalar(dsn: str, query: str) -> Any:
    with psycopg.connect(dsn) as connection:
        row = connection.execute(query).fetchone()  # type: ignore[arg-type]
    assert row is not None
    return row[0]


def test_publish_loads_marts_and_logs_the_publication(dsn: str) -> None:
    publish(
        dsn,
        {
            "dim_city": [dim_city_row("santiago"), dim_city_row("madrid")],
            "city_kpis": [city_kpis_row("santiago", 100), city_kpis_row("madrid", 250)],
        },
    )

    assert scalar(dsn, "SELECT count(*) FROM marts.dim_city") == 2
    assert scalar(dsn, "SELECT n_listings FROM marts.city_kpis WHERE city = 'madrid'") == 250
    assert scalar(dsn, "SELECT n_cities FROM marts.publish_log") == 2
    assert scalar(dsn, "SELECT n_listings FROM marts.publish_log") == 350
    assert scalar(dsn, "SELECT pipeline_run_id FROM marts.publish_log") == "test-run"


def test_republishing_replaces_the_previous_data(dsn: str) -> None:
    publish(dsn, {"dim_city": [dim_city_row("santiago"), dim_city_row("madrid")]})
    publish(dsn, {"dim_city": [dim_city_row("lisbon")]})

    assert scalar(dsn, "SELECT string_agg(city, ',') FROM marts.dim_city") == "lisbon"
    assert scalar(dsn, "SELECT count(*) FROM marts.publish_log") == 1


def test_failed_publication_leaves_the_previous_data_untouched(dsn: str) -> None:
    publish(dsn, {"dim_city": [dim_city_row("santiago")], "city_kpis": [city_kpis_row("santiago", 100)]})
    broken_row = (None, "Sin clave", "Chile", "CLP", date(2026, 9, 23), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)

    with pytest.raises(PublishError, match="no se aplicó ningún cambio"):
        # city_kpis se carga después de dim_city: el fallo debe deshacer también lo ya cargado.
        publish(
            dsn, {"city_kpis": [city_kpis_row("madrid", 1)], "dim_city": [dim_city_row("madrid"), broken_row]}
        )

    assert scalar(dsn, "SELECT string_agg(city, ',') FROM marts.dim_city") == "santiago"
    assert scalar(dsn, "SELECT string_agg(city, ',') FROM marts.city_kpis") == "santiago"


def test_dashboard_role_can_read_but_not_write(dsn: str) -> None:
    publish(dsn, {"dim_city": [dim_city_row("santiago")]})
    readonly_dsn = make_conninfo(
        **{**conninfo_to_dict(dsn), "user": READONLY_ROLE, "password": READONLY_PASSWORD}  # type: ignore[arg-type]
    )

    assert scalar(readonly_dsn, "SELECT city FROM marts.dim_city") == "santiago"
    with psycopg.connect(readonly_dsn) as connection, pytest.raises(psycopg.errors.InsufficientPrivilege):
        connection.execute("DELETE FROM marts.dim_city")
