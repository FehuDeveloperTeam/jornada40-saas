"""
Extractor de campos de contrato de trabajo usando Gemini.

Recibe los bytes de un PDF o imagen escaneada y retorna un dict con los
campos del modelo Empleado/Contrato que pudo identificar. Los campos no
encontrados se retornan como None para que el frontend los muestre vacíos.
"""
import json
import logging

from django.conf import settings
from google import genai
from google.genai import errors, types

from .rut import formatear_rut, validar_rut

logger = logging.getLogger(__name__)


_PROMPT = """
Eres un asistente especializado en contratos laborales chilenos.
Analiza el documento adjunto y extrae los siguientes campos.
Devuelve ÚNICAMENTE un objeto JSON válido con las claves exactas indicadas.
Si un campo no aparece en el documento, usa null.

Claves requeridas y sus descripciones:
- nombres: Nombres de pila del trabajador (sin apellidos)
- apellido_paterno: Apellido paterno del trabajador
- apellido_materno: Apellido materno del trabajador
- rut: RUT del trabajador en formato XX.XXX.XXX-X
- fecha_nacimiento: Fecha de nacimiento en formato YYYY-MM-DD
- estado_civil: Uno de: SOLTERO, CASADO, DIVORCIADO, VIUDO, CONVIVIENTE_CIVIL
- nacionalidad: Nacionalidad en mayúsculas (ej: CHILENA)
- direccion: Dirección del domicilio del trabajador
- comuna: Comuna del domicilio del trabajador
- cargo: Cargo o puesto de trabajo
- modalidad: Uno de: PRESENCIAL, REMOTO, HIBRIDO
- tipo_contrato: Uno de: INDEFINIDO, PLAZO_FIJO, OBRA_FAENA
- fecha_inicio: Fecha de inicio del contrato en formato YYYY-MM-DD
- fecha_fin: Fecha de término del contrato en formato YYYY-MM-DD (solo si es plazo fijo u obra/faena, si no null)
- sueldo_base: Monto del sueldo base mensual como número entero en pesos (sin puntos ni símbolo $)
- dia_pago: Día del mes en que se paga el sueldo (número entero, ej: 5)
- horas_semanales: Horas semanales de trabajo (número, ej: 40)
- afp: Nombre de la AFP (ej: HABITAT, CAPITAL, CUPRUM, PLANVITAL, PROVIDA, UNO)
- sistema_salud: FONASA o nombre de la ISAPRE
- gratificacion_legal: Uno de: MENSUAL, ANUAL
- tiene_quincena: true si el contrato contempla anticipo quincenal, false si no
- dia_quincena: Día del mes en que se paga la quincena (número entero, null si no aplica)
- monto_quincena: Monto del anticipo quincenal como número entero en pesos (null si no aplica)

No incluyas explicaciones ni texto fuera del JSON.
""".strip()


CLAVES = ('nombres', 'apellido_paterno', 'apellido_materno', 'rut', 'fecha_nacimiento', 'estado_civil',
          'nacionalidad', 'direccion', 'comuna', 'cargo', 'modalidad', 'tipo_contrato', 'fecha_inicio',
          'fecha_fin', 'sueldo_base', 'dia_pago', 'horas_semanales', 'afp', 'sistema_salud',
          'gratificacion_legal', 'tiene_quincena', 'dia_quincena', 'monto_quincena')

# gemini-2.0-flash está en retiro; el alias "latest" cubre el cambio de versión
# si el modelo configurado deja de existir. Se puede fijar con GEMINI_MODEL.
MODELOS_RESPALDO = ('gemini-2.5-flash', 'gemini-flash-latest')
TIEMPO_MAXIMO_MS = 45_000  # Gunicorn corta a los 60 s


class ExtraccionNoDisponible(RuntimeError):
    """Mensaje apto para mostrar al usuario."""


def _modelos():
    configurado = getattr(settings, 'GEMINI_MODEL', None)
    return tuple(dict.fromkeys([m for m in (configurado, *MODELOS_RESPALDO) if m]))


def _normalizar(datos) -> dict:
    """Solo las claves esperadas; el RUT se descarta si su dígito verificador no calza."""
    if not isinstance(datos, dict):
        raise ExtraccionNoDisponible('No pudimos leer los datos del documento. Completa el contrato a mano.')
    campos = {k: datos.get(k) for k in CLAVES}
    if campos['rut'] and not validar_rut(str(campos['rut'])):
        campos['rut'] = None
    elif campos['rut']:
        campos['rut'] = formatear_rut(str(campos['rut']))
    return campos


def extraer_campos_contrato(file_bytes: bytes, mime_type: str) -> dict:
    """
    Envía el documento a Gemini y retorna los campos extraídos como dict.
    Lanza ExtraccionNoDisponible (con un mensaje para el usuario) si no hay
    clave, si Gemini no responde a tiempo o si la respuesta no sirve.
    """
    if not settings.GEMINI_API_KEY:
        logger.error('Digitalización de contratos sin GEMINI_API_KEY')
        raise ExtraccionNoDisponible('La lectura automática de contratos no está disponible en este momento.')

    client = genai.Client(api_key=settings.GEMINI_API_KEY,
                          http_options=types.HttpOptions(timeout=TIEMPO_MAXIMO_MS))
    ultimo_error = None
    for modelo in _modelos():
        try:
            response = client.models.generate_content(
                model=modelo,
                contents=[types.Part.from_bytes(data=file_bytes, mime_type=mime_type), _PROMPT],
                config=types.GenerateContentConfig(response_mime_type='application/json'),
            )
        except errors.ClientError as e:
            # 404: el modelo ya no existe; se prueba el siguiente. Otro 4xx
            # (clave inválida, cuota) no se arregla cambiando de modelo.
            ultimo_error = e
            if getattr(e, 'code', None) == 404:
                logger.warning('Modelo de Gemini no disponible: %s', modelo)
                continue
            logger.exception('Gemini rechazó la solicitud (%s)', modelo)
            raise ExtraccionNoDisponible('La lectura automática de contratos no está disponible en este momento.') from e
        except Exception as e:
            logger.exception('Gemini no respondió (%s)', modelo)
            raise ExtraccionNoDisponible('El servicio de lectura tardó demasiado o no respondió. Intenta de nuevo '
                                         'o completa el contrato a mano.') from e
        try:
            return _normalizar(json.loads(response.text))
        except (json.JSONDecodeError, TypeError, AttributeError) as e:
            logger.exception('Gemini devolvió una respuesta que no es JSON')
            raise ExtraccionNoDisponible('No pudimos leer los datos del documento. Completa el contrato a mano.') from e
    logger.error('Ningún modelo de Gemini disponible: %s', ultimo_error)
    raise ExtraccionNoDisponible('La lectura automática de contratos no está disponible en este momento.')
