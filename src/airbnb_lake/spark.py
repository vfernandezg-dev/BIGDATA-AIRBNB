"""Fábrica de la SparkSession.

El master y la memoria no se fijan aquí: llegan del entorno de ejecución (`PYSPARK_SUBMIT_ARGS` y
`spark-defaults.conf`), de modo que el mismo código corre en el cluster standalone, en modo local o en otro
gestor. Aquí solo se fijan los ajustes de los que depende que el resultado sea correcto.
"""

from __future__ import annotations

from pyspark.sql import SparkSession

# Ajustes de corrección: deben valer lo mismo en cualquier entorno, por eso no se dejan al despliegue.
_REQUIRED_SETTINGS = {
    # Las fechas no deben depender de la zona horaria de la máquina.
    "spark.sql.session.timeZone": "UTC",
    # Sobrescribir una tabla particionada reemplaza solo las particiones escritas: es lo que hace que cada
    # etapa sea idempotente e incremental.
    "spark.sql.sources.partitionOverwriteMode": "dynamic",
    "spark.sql.parquet.compression.codec": "zstd",
    # Con ANSI activo una conversión inválida falla en lugar de devolver nulo en silencio; las conversiones
    # de datos sucios se hacen de forma explícita con try_cast.
    "spark.sql.ansi.enabled": "true",
    # Cada tarea de Bronze escribe una sola partición: con escritores concurrentes Spark no necesita ordenar
    # todas las filas por partición antes de escribir.
    "spark.sql.maxConcurrentOutputFileWriters": "16",
}


def build_spark(app_name: str, *, driver_only: bool = False) -> SparkSession:
    """Crea (o reutiliza) la sesión.

    `driver_only` es para etapas que no procesan datos en Spark (descargas, publicación): usan una sesión
    local para acceder a HDFS sin reservar ejecutores en el cluster.
    """
    builder = SparkSession.builder.appName(app_name)
    for key, value in _REQUIRED_SETTINGS.items():
        builder = builder.config(key, value)
    if driver_only:
        builder = builder.master("local[2]")
    spark = builder.getOrCreate()
    spark.sparkContext.setLogLevel("WARN")
    return spark
