"""Operaciones de archivos sobre el lake a través de la API FileSystem de Hadoop.

Se usa la JVM de Spark, así que funciona con cualquier URI que Hadoop entienda (hdfs://, file://, s3a://,
abfss://) sin dependencias adicionales, y con las mismas rutas que usa Spark para leer y escribir.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from pyspark.sql import SparkSession

from airbnb_lake.lake.paths import PARTITION_COLUMNS, Partition


class HadoopFs:
    def __init__(self, spark: SparkSession) -> None:
        context = spark.sparkContext
        self._jvm: Any = context._jvm
        self._conf: Any = context._jsc.hadoopConfiguration()

    def _path(self, uri: str) -> Any:
        return self._jvm.org.apache.hadoop.fs.Path(uri)

    def _fs(self, uri: str) -> Any:
        return self._path(uri).getFileSystem(self._conf)

    def exists(self, uri: str) -> bool:
        return bool(self._fs(uri).exists(self._path(uri)))

    def mkdirs(self, uri: str) -> None:
        self._fs(uri).mkdirs(self._path(uri))

    def list_names(self, uri: str) -> list[str]:
        """Nombres de los hijos directos de un directorio; lista vacía si no existe."""
        if not self.exists(uri):
            return []
        return sorted(str(status.getPath().getName()) for status in self._fs(uri).listStatus(self._path(uri)))

    def delete(self, uri: str, *, recursive: bool = True) -> None:
        self._fs(uri).delete(self._path(uri), recursive)

    def rename(self, source: str, target: str) -> None:
        if not self._fs(source).rename(self._path(source), self._path(target)):
            raise OSError(f"No se pudo renombrar {source} a {target}")

    def put(self, local_file: Path, uri: str) -> None:
        """Copia un archivo local al lake de forma atómica: nadie ve un archivo a medias."""
        staging = f"{uri}._copying"
        source = self._path(local_file.resolve().as_uri())
        self._fs(uri).copyFromLocalFile(False, True, source, self._path(staging))
        if self.exists(uri):
            self.delete(uri, recursive=False)
        self.rename(staging, uri)

    def write_text(self, uri: str, text: str) -> None:
        stream = self._fs(uri).create(self._path(uri), True)
        try:
            stream.write(bytearray(text.encode("utf-8")))
        finally:
            stream.close()

    def read_text(self, uri: str) -> str:
        stream = self._fs(uri).open(self._path(uri))
        try:
            return str(self._jvm.org.apache.commons.io.IOUtils.toString(stream, "UTF-8"))
        finally:
            stream.close()

    def size_bytes(self, uri: str) -> int:
        return int(self._fs(uri).getContentSummary(self._path(uri)).getLength())

    def list_partitions(self, table_uri: str, *, marker: str | None = None) -> set[Partition]:
        """Particiones `city=/snapshot_date=` presentes en una tabla.

        Con `marker` solo cuentan las que contienen ese archivo (por ejemplo, el manifiesto que confirma que
        una descarga terminó).
        """
        city_key, snapshot_key = (f"{column}=" for column in PARTITION_COLUMNS)
        partitions: set[Partition] = set()
        for city_dir in self.list_names(table_uri):
            if not city_dir.startswith(city_key):
                continue
            for snapshot_dir in self.list_names(f"{table_uri}/{city_dir}"):
                if not snapshot_dir.startswith(snapshot_key):
                    continue
                if marker and not self.exists(f"{table_uri}/{city_dir}/{snapshot_dir}/{marker}"):
                    continue
                partitions.add(Partition(city_dir[len(city_key) :], snapshot_dir[len(snapshot_key) :]))
        return partitions
