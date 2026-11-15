"""Excepciones del pipeline. Cada una identifica en qué parte falló la ejecución."""


class PipelineError(Exception):
    """Base de los errores esperables del pipeline (la CLI los muestra sin traza)."""


class ConfigError(PipelineError):
    """La configuración falta, está incompleta o es incoherente."""


class CatalogError(PipelineError):
    """El catálogo de Inside Airbnb no se pudo leer o no contiene lo que se le pidió."""


class DownloadError(PipelineError):
    """Un archivo de origen no se pudo descargar completo."""


class MissingInputError(PipelineError):
    """Una etapa no encuentra los datos que debía dejarle la etapa anterior."""


class DataQualityError(PipelineError):
    """Los datos no superan una validación que impide continuar."""


class PublishError(PipelineError):
    """La carga de los marts en la base de datos de serving falló."""
