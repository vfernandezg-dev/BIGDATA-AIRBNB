"""Conversores de columnas de texto de Inside Airbnb a tipos.

Son expresiones nativas de Spark (sin UDF de Python), así que se ejecutan dentro de la JVM. Todas devuelven
nulo ante un valor que no se puede interpretar, en lugar de fallar: los datos de origen son sucios y cada
tabla de Silver decide después qué hacer con los nulos.
"""

from __future__ import annotations

from pyspark.sql import Column
from pyspark.sql import functions as F

_EARTH_RADIUS_KM = 6371.0088


def to_long(column: Column) -> Column:
    return F.trim(column).try_cast("long")


def to_int(column: Column) -> Column:
    """Entero; acepta también decimales sin parte fraccionaria relevante (`"2.0"`)."""
    return F.trim(column).try_cast("double").try_cast("int")


def to_double(column: Column) -> Column:
    return F.trim(column).try_cast("double")


def to_date(column: Column) -> Column:
    """Fecha en formato ISO (AAAA-MM-DD), el que usa Inside Airbnb."""
    return F.trim(column).try_cast("date")


def to_bool(column: Column) -> Column:
    """Inside Airbnb codifica los booleanos como `t` y `f`."""
    value = F.lower(F.trim(column))
    return F.when(value == "t", F.lit(True)).when(value == "f", F.lit(False))


def parse_money(column: Column) -> Column:
    """Importe con símbolo y separador de miles: `"$59,303.00"` -> 59303.0."""
    return F.regexp_replace(column, r"[^0-9.\-]", "").try_cast("double")


def parse_percent(column: Column) -> Column:
    """Porcentaje como fracción: `"95%"` -> 0.95."""
    return F.regexp_replace(column, r"[^0-9.]", "").try_cast("double") / F.lit(100.0)


def parse_bathrooms(bathrooms_text: Column) -> Column:
    """Número de baños desde el texto: `"1.5 shared baths"` -> 1.5, `"Half-bath"` -> 0.5."""
    text = F.lower(bathrooms_text)
    number = F.regexp_extract(text, r"(\d+(?:\.\d+)?)", 1).try_cast("double")
    return F.coalesce(number, F.when(text.contains("half"), F.lit(0.5)))


def is_shared_bathroom(bathrooms_text: Column) -> Column:
    return F.when(bathrooms_text.isNotNull(), F.lower(bathrooms_text).contains("shared"))


def parse_amenities(amenities: Column) -> Column:
    """Lista de amenities: el origen la publica como un array JSON dentro de un texto."""
    return F.from_json(amenities, "array<string>")


def has_amenity(amenities_lower: Column, pattern: str) -> Column:
    """Verdadero si el texto de amenities (ya en minúsculas) casa con la expresión regular."""
    return F.coalesce(amenities_lower.rlike(pattern), F.lit(False))


def haversine_km(lat1: Column, lon1: Column, lat2: Column, lon2: Column) -> Column:
    """Distancia en kilómetros entre dos puntos sobre la esfera terrestre."""
    d_lat = F.radians(lat2 - lat1)
    d_lon = F.radians(lon2 - lon1)
    a = F.pow(F.sin(d_lat / 2), 2) + F.cos(F.radians(lat1)) * F.cos(F.radians(lat2)) * F.pow(
        F.sin(d_lon / 2), 2
    )
    # `least` protege de errores de redondeo que dejarían el argumento de asin apenas por encima de 1.
    return F.lit(2 * _EARTH_RADIUS_KM) * F.asin(F.sqrt(F.least(a, F.lit(1.0))))
