"""
Cliente Backblaze B2 para el sistema de firma electrónica.

Estructura de carpetas en el bucket:
  pendientes/{empresa_id}/{uuid}.pdf          — PDF sin firmas, temporal
  firmados/{empresa_id}/{año}/{mes}/{uuid}_firmado.pdf — PDF firmado, permanente
"""
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from django.conf import settings


def _cliente():
    """Crea y retorna un cliente boto3 apuntando a Backblaze B2."""
    if not all([settings.B2_KEY_ID, settings.B2_APPLICATION_KEY,
                settings.B2_BUCKET_NAME, settings.B2_ENDPOINT_URL]):
        raise RuntimeError(
            "B2 no está configurado. Define B2_KEY_ID, B2_APPLICATION_KEY, "
            "B2_BUCKET_NAME y B2_ENDPOINT_URL en las variables de entorno."
        )
    return boto3.client(
        's3',
        endpoint_url=settings.B2_ENDPOINT_URL,
        aws_access_key_id=settings.B2_KEY_ID,
        aws_secret_access_key=settings.B2_APPLICATION_KEY,
        config=Config(signature_version='s3v4'),
    )


# ---------------------------------------------------------------------------
# Helpers de path — toda la lógica de rutas en un solo lugar
# ---------------------------------------------------------------------------

def key_pendiente(empresa_id: int, uuid: str) -> str:
    return f"pendientes/{empresa_id}/{uuid}.pdf"


def key_firmado(empresa_id: int, uuid: str, year: int, month: int) -> str:
    return f"firmados/{empresa_id}/{year}/{month:02d}/{uuid}_firmado.pdf"


# ---------------------------------------------------------------------------
# Operaciones principales
# ---------------------------------------------------------------------------

def subir_documento(file_bytes: bytes, key: str,
                    content_type: str = 'application/pdf') -> str:
    """
    Sube file_bytes a B2 bajo el key indicado.
    Retorna el key usado (útil para guardarlo en la BD).
    """
    cliente = _cliente()
    cliente.put_object(
        Bucket=settings.B2_BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return key


def generar_url_presignada(key: str, ttl_segundos: int = 3600) -> str:
    """
    Genera una URL de lectura temporal para el key dado.
    Por defecto expira en 1 hora. Usar 300 (5 min) para vistas previas
    y 3600 para la página de firma.
    """
    cliente = _cliente()
    return cliente.generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.B2_BUCKET_NAME, 'Key': key},
        ExpiresIn=ttl_segundos,
    )


def eliminar_documento(key: str) -> None:
    """Elimina un archivo de B2. No lanza error si el key no existe."""
    cliente = _cliente()
    try:
        cliente.delete_object(Bucket=settings.B2_BUCKET_NAME, Key=key)
    except ClientError:
        pass


def descargar_documento(key: str) -> bytes:
    """Descarga un archivo de B2 y retorna sus bytes."""
    cliente = _cliente()
    response = cliente.get_object(Bucket=settings.B2_BUCKET_NAME, Key=key)
    return response['Body'].read()


def documento_existe(key: str) -> bool:
    """Verifica si un key existe en B2 sin descargarlo."""
    cliente = _cliente()
    try:
        cliente.head_object(Bucket=settings.B2_BUCKET_NAME, Key=key)
        return True
    except ClientError:
        return False
