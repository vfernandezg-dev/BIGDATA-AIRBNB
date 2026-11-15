"""Layout del data lake. Es el único lugar que sabe dónde vive cada zona.

<root>/raw/insideairbnb/<dataset>/city=<slug>/snapshot_date=<AAAA-MM-DD>/<archivo original>
<root>/bronze/<dataset>/city=<slug>/snapshot_date=<AAAA-MM-DD>/part-*.parquet
<root>/silver/<tabla>/city=<slug>/snapshot_date=<AAAA-MM-DD>/part-*.parquet
<root>/gold/<mart>/part-*.parquet
<root>/models/<modelo>/<run_id>/
"""

from __future__ import annotations

from dataclasses import dataclass

PARTITION_COLUMNS = ("city", "snapshot_date")
RAW_MANIFEST = "_MANIFEST.json"


@dataclass(frozen=True)
class Partition:
    """Unidad de procesamiento incremental: un snapshot de una ciudad."""

    city: str
    snapshot_date: str

    def subpath(self) -> str:
        return f"city={self.city}/snapshot_date={self.snapshot_date}"


@dataclass(frozen=True)
class LakePaths:
    root: str

    def raw(self, dataset: str) -> str:
        return f"{self.root}/raw/insideairbnb/{dataset}"

    def raw_partition(self, dataset: str, partition: Partition) -> str:
        return f"{self.raw(dataset)}/{partition.subpath()}"

    def catalog(self) -> str:
        return f"{self.root}/raw/insideairbnb/_catalog"

    def bronze(self, dataset: str) -> str:
        return f"{self.root}/bronze/{dataset}"

    def silver(self, table: str) -> str:
        return f"{self.root}/silver/{table}"

    def gold(self, mart: str) -> str:
        return f"{self.root}/gold/{mart}"

    def model_run(self, model: str, run_id: str) -> str:
        return f"{self.root}/models/{model}/{run_id}"

    def model_latest(self, model: str) -> str:
        return f"{self.root}/models/{model}/LATEST"
