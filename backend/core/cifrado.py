"""Cifrado de datos sensibles en la base (Ley Karin: estricta reserva, Art. 211-C).

Los campos `TextoCifrado` y `JSONCifrado` se guardan cifrados con Fernet
(AES-128-CBC + HMAC-SHA256) y se leen descifrados: quien tenga acceso a la base
de datos, a un respaldo o al admin de Django no ve el contenido.

Claves: `KARIN_CLAVES_CIFRADO`, una o más claves Fernet separadas por coma. La
primera cifra; todas descifran, así se puede rotar: se agrega la nueva al
principio, se corre `python manage.py rotar_cifrado` y después se quita la
antigua. Generar una clave:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

En desarrollo y pruebas, sin la variable, se deriva una clave de SECRET_KEY. En
Railway la variable es obligatoria: sin ella, guardar o leer un campo cifrado
falla (el resto del sistema sigue funcionando). Perder la clave es perder los
datos: se guarda en Railway y en un lugar seguro aparte.
"""
import base64
import hashlib
import json

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models

# Marca de los valores cifrados: distingue un texto ya cifrado de uno plano.
PREFIJO = 'fv1:'
_cache = {}


def _claves():
    crudas = [c.strip() for c in (getattr(settings, 'KARIN_CLAVES_CIFRADO', '') or '').split(',') if c.strip()]
    if not crudas:
        if getattr(settings, 'IS_DEPLOYED', False):
            raise ImproperlyConfigured('Falta KARIN_CLAVES_CIFRADO para cifrar los datos de la Ley Karin.')
        crudas = [base64.urlsafe_b64encode(hashlib.sha256(f'karin:{settings.SECRET_KEY}'.encode()).digest()).decode()]
    return tuple(crudas)


def _fernet():
    claves = _claves()
    if claves not in _cache:
        _cache.clear()
        _cache[claves] = MultiFernet([Fernet(c.encode()) for c in claves])
    return _cache[claves]


def cifrar(texto):
    if texto is None:
        return None
    return PREFIJO + _fernet().encrypt(str(texto).encode()).decode()


def descifrar(valor):
    """Texto descifrado; un valor sin la marca se devuelve tal cual (dato anterior al cifrado)."""
    if valor is None or not str(valor).startswith(PREFIJO):
        return valor
    try:
        return _fernet().decrypt(valor[len(PREFIJO):].encode()).decode()
    except InvalidToken as e:
        raise ImproperlyConfigured('No se pudo descifrar un dato: la clave no corresponde (KARIN_CLAVES_CIFRADO).') from e


def rotar(valor):
    """Vuelve a cifrar con la clave actual (la primera)."""
    if valor is None or not str(valor).startswith(PREFIJO):
        return cifrar(valor) if valor is not None else None
    return PREFIJO + _fernet().rotate(valor[len(PREFIJO):].encode()).decode()


class TextoCifrado(models.TextField):
    """Texto que se guarda cifrado. No se puede filtrar ni ordenar por su contenido."""

    def from_db_value(self, value, expression, connection):
        return descifrar(value)

    def to_python(self, value):
        return descifrar(value) if isinstance(value, str) else value

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None or str(value).startswith(PREFIJO):
            return value
        return cifrar(value)


class JSONCifrado(models.TextField):
    """Dato JSON (dict, lista…) que se guarda cifrado."""

    def from_db_value(self, value, expression, connection):
        texto = descifrar(value)
        return json.loads(texto) if texto else texto

    def to_python(self, value):
        if isinstance(value, str):
            texto = descifrar(value)
            return json.loads(texto) if texto else texto
        return value

    def get_prep_value(self, value):
        if value is None:
            return None
        return cifrar(json.dumps(value, ensure_ascii=False, sort_keys=True))
