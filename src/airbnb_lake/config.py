"""Configuración tipada del pipeline, cargada desde YAML y variables de entorno.

Los archivos viven en `conf/` (o en el directorio de `AIRBNB_CONF_DIR`). Las variables de entorno
`AIRBNB_LAKE_ROOT` y `AIRBNB_LANDING_DIR` sustituyen a los valores del YAML: así el mismo código corre contra
HDFS en Docker y contra un directorio temporal en los tests.
"""

from __future__ import annotations

import os
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import yaml

from airbnb_lake.errors import ConfigError

_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
_DEFAULT_CONF_DIR = Path(__file__).resolve().parents[2] / "conf"


@dataclass(frozen=True)
class City:
    """Una ciudad del catálogo de Inside Airbnb."""

    slug: str
    name: str
    country: str
    source_path: str
    currency: str


@dataclass(frozen=True)
class SourceConfig:
    catalog_url: str
    user_agent: str
    timeout_seconds: int
    max_retries: int
    download_workers: int
    landing_dir: Path


@dataclass(frozen=True)
class CleaningConfig:
    min_nights_range: tuple[int, int]
    availability_range: tuple[int, int]
    price_outlier_quantiles: tuple[float, float]
    max_km_from_city_center: float
    valid_room_types: tuple[str, ...]


@dataclass(frozen=True)
class SegmentationConfig:
    k_candidates: tuple[int, ...]
    seed: int


@dataclass(frozen=True)
class GoldConfig:
    map_cell_degrees: float
    price_histogram_bucket_usd: int
    price_histogram_max_usd: int
    min_listings_per_neighbourhood: int
    segmentation: SegmentationConfig


@dataclass(frozen=True)
class GbtConfig:
    max_iter: int
    step_size: float
    max_bins: int
    subsampling_rate: float
    max_depth_grid: tuple[int, ...]


@dataclass(frozen=True)
class MlConfig:
    seed: int
    train_fraction: float
    min_feature_fill_rate: float
    top_property_types: int
    gbt: GbtConfig
    validation_train_ratio: float
    tuning_parallelism: int
    prediction_sample_rows: int


@dataclass(frozen=True)
class ServingConfig:
    max_rows_per_mart: int


@dataclass(frozen=True)
class FxRates:
    """Tipos de cambio de referencia: unidades de moneda local por 1 USD."""

    as_of: date
    units_per_usd: Mapping[str, float]


@dataclass(frozen=True)
class PipelineConfig:
    lake_root: str
    source: SourceConfig
    bronze_max_records_per_file: int
    cleaning: CleaningConfig
    gold: GoldConfig
    ml: MlConfig
    serving: ServingConfig
    cities: tuple[City, ...]
    fx: FxRates

    def select_cities(self, slugs: Sequence[str] | None) -> tuple[City, ...]:
        """Devuelve las ciudades pedidas, o todas las configuradas si no se pide ninguna."""
        if not slugs:
            return self.cities
        by_slug = {city.slug: city for city in self.cities}
        unknown = sorted(set(slugs) - by_slug.keys())
        if unknown:
            raise ConfigError(
                f"Ciudades no configuradas en cities.yaml: {', '.join(unknown)}. "
                f"Disponibles: {', '.join(sorted(by_slug))}"
            )
        return tuple(by_slug[slug] for slug in dict.fromkeys(slugs))


def load_config(conf_dir: Path | None = None, env: Mapping[str, str] | None = None) -> PipelineConfig:
    """Carga y valida la configuración completa."""
    environment = os.environ if env is None else env
    directory = conf_dir or Path(environment.get("AIRBNB_CONF_DIR", str(_DEFAULT_CONF_DIR)))

    pipeline = _read_yaml(directory / "pipeline.yaml")
    cities = _parse_cities(_read_yaml(directory / "cities.yaml"))
    fx = _parse_fx(_read_yaml(directory / "fx_rates.yaml"))

    missing_rates = sorted({city.currency for city in cities} - fx.units_per_usd.keys())
    if missing_rates:
        raise ConfigError(f"fx_rates.yaml no tiene tipo de cambio para: {', '.join(missing_rates)}")

    try:
        source = pipeline["source"]
        cleaning = pipeline["cleaning"]
        gold = pipeline["gold"]
        ml = pipeline["ml"]
        serving = pipeline["serving"]
        config = PipelineConfig(
            lake_root=str(environment.get("AIRBNB_LAKE_ROOT") or pipeline["lake"]["root_uri"]).rstrip("/"),
            source=SourceConfig(
                catalog_url=str(source["catalog_url"]),
                user_agent=str(source["user_agent"]),
                timeout_seconds=int(source["timeout_seconds"]),
                max_retries=int(source["max_retries"]),
                download_workers=int(source["download_workers"]),
                landing_dir=Path(environment.get("AIRBNB_LANDING_DIR") or source["landing_dir"]),
            ),
            bronze_max_records_per_file=int(pipeline["bronze"]["max_records_per_file"]),
            cleaning=CleaningConfig(
                min_nights_range=_int_pair(cleaning["min_nights_range"], "cleaning.min_nights_range"),
                availability_range=_int_pair(cleaning["availability_range"], "cleaning.availability_range"),
                price_outlier_quantiles=_quantile_pair(cleaning["price_outlier_quantiles"]),
                max_km_from_city_center=float(cleaning["max_km_from_city_center"]),
                valid_room_types=tuple(str(value) for value in cleaning["valid_room_types"]),
            ),
            gold=GoldConfig(
                map_cell_degrees=float(gold["map_cell_degrees"]),
                price_histogram_bucket_usd=int(gold["price_histogram_bucket_usd"]),
                price_histogram_max_usd=int(gold["price_histogram_max_usd"]),
                min_listings_per_neighbourhood=int(gold["min_listings_per_neighbourhood"]),
                segmentation=SegmentationConfig(
                    k_candidates=tuple(int(k) for k in gold["segmentation"]["k_candidates"]),
                    seed=int(gold["segmentation"]["seed"]),
                ),
            ),
            ml=MlConfig(
                seed=int(ml["seed"]),
                train_fraction=float(ml["train_fraction"]),
                min_feature_fill_rate=float(ml["min_feature_fill_rate"]),
                top_property_types=int(ml["top_property_types"]),
                gbt=GbtConfig(
                    max_iter=int(ml["gbt"]["max_iter"]),
                    step_size=float(ml["gbt"]["step_size"]),
                    max_bins=int(ml["gbt"]["max_bins"]),
                    subsampling_rate=float(ml["gbt"]["subsampling_rate"]),
                    max_depth_grid=tuple(int(depth) for depth in ml["gbt"]["max_depth_grid"]),
                ),
                validation_train_ratio=float(ml["validation_train_ratio"]),
                tuning_parallelism=int(ml["tuning_parallelism"]),
                prediction_sample_rows=int(ml["prediction_sample_rows"]),
            ),
            serving=ServingConfig(max_rows_per_mart=int(serving["max_rows_per_mart"])),
            cities=cities,
            fx=fx,
        )
    except KeyError as exc:
        raise ConfigError(f"Falta la clave {exc} en {directory / 'pipeline.yaml'}") from exc
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"Valor inválido en {directory / 'pipeline.yaml'}: {exc}") from exc

    _validate(config)
    return config


def _read_yaml(path: Path) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as handle:
            content = yaml.safe_load(handle)
    except FileNotFoundError as exc:
        raise ConfigError(f"No existe el archivo de configuración {path}") from exc
    except yaml.YAMLError as exc:
        raise ConfigError(f"YAML inválido en {path}: {exc}") from exc
    if not isinstance(content, dict):
        raise ConfigError(f"{path} debe contener un mapa en la raíz")
    return content


def _parse_cities(content: Mapping[str, Any]) -> tuple[City, ...]:
    entries = content.get("cities")
    if not isinstance(entries, list) or not entries:
        raise ConfigError("cities.yaml debe definir una lista `cities` con al menos una ciudad")

    cities: list[City] = []
    for entry in entries:
        try:
            city = City(
                slug=str(entry["slug"]),
                name=str(entry["name"]),
                country=str(entry["country"]),
                source_path=str(entry["source_path"]).strip("/"),
                currency=str(entry["currency"]).upper(),
            )
        except (KeyError, TypeError) as exc:
            raise ConfigError(f"Ciudad incompleta en cities.yaml ({entry!r}): falta {exc}") from exc
        if not _SLUG_PATTERN.match(city.slug):
            raise ConfigError(
                f"Slug inválido {city.slug!r}: usa minúsculas, números y guiones "
                "(se usa como nombre de partición)"
            )
        cities.append(city)

    slugs = [city.slug for city in cities]
    duplicated = sorted({slug for slug in slugs if slugs.count(slug) > 1})
    if duplicated:
        raise ConfigError(f"Slugs repetidos en cities.yaml: {', '.join(duplicated)}")
    return tuple(cities)


def _parse_fx(content: Mapping[str, Any]) -> FxRates:
    try:
        as_of = content["as_of"]
        rates = {str(code).upper(): float(value) for code, value in content["units_per_usd"].items()}
    except (KeyError, AttributeError, TypeError, ValueError) as exc:
        raise ConfigError(f"fx_rates.yaml inválido: {exc}") from exc
    if not isinstance(as_of, date):
        raise ConfigError("fx_rates.yaml: `as_of` debe ser una fecha AAAA-MM-DD")
    non_positive = sorted(code for code, value in rates.items() if value <= 0)
    if non_positive:
        raise ConfigError(f"fx_rates.yaml: tipos de cambio no positivos para {', '.join(non_positive)}")
    return FxRates(as_of=as_of, units_per_usd=rates)


def _int_pair(value: Any, key: str) -> tuple[int, int]:
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError(f"{key} debe ser una lista [mínimo, máximo]")
    low, high = int(value[0]), int(value[1])
    if low > high:
        raise ValueError(f"{key}: el mínimo ({low}) supera al máximo ({high})")
    return low, high


def _quantile_pair(value: Any) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError("cleaning.price_outlier_quantiles debe ser una lista [inferior, superior]")
    low, high = float(value[0]), float(value[1])
    if not 0 <= low < high <= 1:
        raise ValueError("cleaning.price_outlier_quantiles: se espera 0 <= inferior < superior <= 1")
    return low, high


def _validate(config: PipelineConfig) -> None:
    if "://" not in config.lake_root:
        raise ConfigError(
            f"lake.root_uri debe ser una URI con esquema (hdfs://, file://...): {config.lake_root!r}"
        )
    if not 0 < config.ml.train_fraction < 1:
        raise ConfigError("ml.train_fraction debe estar entre 0 y 1")
    if not config.ml.gbt.max_depth_grid:
        raise ConfigError("ml.gbt.max_depth_grid necesita al menos una profundidad")
    if not config.gold.segmentation.k_candidates or min(config.gold.segmentation.k_candidates) < 2:
        raise ConfigError("gold.segmentation.k_candidates necesita valores de k mayores o iguales a 2")
    if config.serving.max_rows_per_mart <= 0:
        raise ConfigError("serving.max_rows_per_mart debe ser positivo")
