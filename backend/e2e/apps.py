"""App solo para las pruebas de navegador (config/settings_e2e.py). Nunca se instala en producción.

Aísla las pruebas de servicios externos: los PDF firmados se guardan en disco
en vez de B2 y la UF/UTM usan los valores de respaldo del código.
"""
import os

from django.apps import AppConfig
from django.conf import settings


class E2EConfig(AppConfig):
    name = 'e2e'

    def ready(self):
        from core import b2_client, indicadores

        carpeta = settings.E2E_ARCHIVOS_DIR

        def ruta(key):
            os.makedirs(carpeta, exist_ok=True)
            return os.path.join(carpeta, key.replace('/', '__'))

        def subir(file_bytes, key, *args, **kwargs):
            with open(ruta(key), 'wb') as f:
                f.write(file_bytes)

        def descargar(key):
            with open(ruta(key), 'rb') as f:
                return f.read()

        b2_client.subir_documento = subir
        b2_client.descargar_documento = descargar
        b2_client.eliminar_documento = lambda key: None
        b2_client.documento_existe = lambda key: os.path.exists(ruta(key))
        b2_client.generar_url_presignada = lambda key, ttl_segundos=3600: 'about:blank#' + key
        indicadores._obtener_indicador = lambda nombre, fallback: fallback
