"""Registro del pipeline: un formato único y un cronómetro por etapa."""

from __future__ import annotations

import logging
import sys
import time
from collections.abc import Iterator
from contextlib import contextmanager

_FORMAT = "%(asctime)s %(levelname)-7s %(name)s | %(message)s"


def configure_logging(level: str = "INFO") -> None:
    """Configura el registro de la aplicación. Py4J es muy verboso en DEBUG, así que se limita a avisos."""
    logging.basicConfig(level=level.upper(), format=_FORMAT, datefmt="%Y-%m-%d %H:%M:%S", stream=sys.stderr)
    logging.getLogger("py4j").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


@contextmanager
def timed(logger: logging.Logger, what: str) -> Iterator[None]:
    """Registra el inicio, la duración y el fallo (si lo hay) de un bloque de trabajo."""
    logger.info("%s: inicio", what)
    start = time.monotonic()
    try:
        yield
    except Exception:
        logger.error("%s: falló tras %.1f s", what, time.monotonic() - start)
        raise
    logger.info("%s: completado en %.1f s", what, time.monotonic() - start)
