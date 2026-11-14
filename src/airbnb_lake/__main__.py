"""Permite ejecutar el pipeline con `python -m airbnb_lake <etapa>`."""

import sys

from airbnb_lake.cli import main

if __name__ == "__main__":
    sys.exit(main())
