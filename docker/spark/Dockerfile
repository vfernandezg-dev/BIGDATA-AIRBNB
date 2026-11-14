# Imagen única para el master, los workers y el driver del pipeline.
# Spark 4.2.1 (JDK 21, Python 3.10, cliente Hadoop 3.5.0). No se usa 4.3.0: su imagen publicada trae
# Python 3.10 y esa versión de PySpark exige 3.11 o superior.
FROM apache/spark:4.2.1-scala2.13-java21-python3-ubuntu

USER root

ENV SPARK_HOME=/opt/spark \
    PATH=/opt/spark/bin:$PATH \
    PYTHONPATH=/opt/airbnb/src:/opt/spark/python:/opt/spark/python/lib/py4j-0.10.9.9-src.zip \
    MYPYPATH=/opt/spark/python \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/home/spark

# Dependencias del driver y herramientas de calidad. Los ejecutores no las necesitan: el pipeline solo usa
# funciones nativas de Spark, sin UDF de Python.
RUN pip3 install --no-cache-dir \
        "numpy>=1.26,<2.3" \
        "psycopg[binary]>=3.2" \
        "pyyaml>=6.0" \
        "requests>=2.32" \
        "mypy>=1.13" \
        "pytest>=8.3" \
        "ruff>=0.8" \
        types-PyYAML \
        types-requests

# El usuario spark (uid 185) no tiene directorio personal en la imagen base.
RUN mkdir -p /home/spark /opt/airbnb /var/lib/airbnb/landing \
    && chown -R spark:spark /home/spark /opt/airbnb /var/lib/airbnb

WORKDIR /opt/airbnb
COPY --chown=spark:spark pyproject.toml ./
COPY --chown=spark:spark conf ./conf
COPY --chown=spark:spark src ./src
COPY --chown=spark:spark tests ./tests

USER spark
