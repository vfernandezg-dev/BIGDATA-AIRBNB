"""Carga y validación de la configuración."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from airbnb_lake.config import load_config
from airbnb_lake.errors import ConfigError
from tests.conftest import REPO_ROOT

ENV = {"AIRBNB_LAKE_ROOT": "file:///tmp/lake", "AIRBNB_LANDING_DIR": "/tmp/landing"}


@pytest.fixture
def conf_dir(tmp_path: Path) -> Path:
    target = tmp_path / "conf"
    shutil.copytree(REPO_ROOT / "conf", target)
    return target


def test_repository_configuration_is_valid() -> None:
    config = load_config(REPO_ROOT / "conf", {})

    assert config.lake_root == "hdfs://namenode:8020/lake"
    assert len(config.cities) == 12
    assert {city.currency for city in config.cities} <= config.fx.units_per_usd.keys()
    assert config.fx.units_per_usd["USD"] == 1.0


def test_environment_overrides_the_lake_location() -> None:
    config = load_config(
        REPO_ROOT / "conf", {"AIRBNB_LAKE_ROOT": "file:///data/lake/", "AIRBNB_LANDING_DIR": "/x"}
    )

    assert config.lake_root == "file:///data/lake"
    assert config.source.landing_dir == Path("/x")


def test_select_cities_keeps_order_and_rejects_unknown_slugs() -> None:
    config = load_config(REPO_ROOT / "conf", ENV)

    assert [city.slug for city in config.select_cities(["madrid", "santiago", "madrid"])] == [
        "madrid",
        "santiago",
    ]
    assert config.select_cities(None) == config.cities
    with pytest.raises(ConfigError, match="atlantis"):
        config.select_cities(["santiago", "atlantis"])


def test_city_with_a_currency_without_fx_rate_is_rejected(conf_dir: Path) -> None:
    cities = conf_dir / "cities.yaml"
    cities.write_text(cities.read_text("utf-8").replace("currency: CLP", "currency: XXX"), "utf-8")

    with pytest.raises(ConfigError, match="XXX"):
        load_config(conf_dir, ENV)


def test_slug_must_be_safe_as_a_partition_name(conf_dir: Path) -> None:
    cities = conf_dir / "cities.yaml"
    cities.write_text(cities.read_text("utf-8").replace("slug: santiago", "slug: Santiago de Chile"), "utf-8")

    with pytest.raises(ConfigError, match="Slug inválido"):
        load_config(conf_dir, ENV)


def test_missing_key_is_reported_with_its_name(conf_dir: Path) -> None:
    pipeline = conf_dir / "pipeline.yaml"
    pipeline.write_text(pipeline.read_text("utf-8").replace("  timeout_seconds: 60\n", ""), "utf-8")

    with pytest.raises(ConfigError, match="timeout_seconds"):
        load_config(conf_dir, ENV)


def test_lake_root_must_be_a_uri() -> None:
    with pytest.raises(ConfigError, match="URI"):
        load_config(REPO_ROOT / "conf", {"AIRBNB_LAKE_ROOT": "/solo/una/ruta"})
