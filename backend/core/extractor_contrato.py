"""
Extractor de campos de contrato de trabajo usando Gemini.

Recibe los bytes de un PDF o imagen escaneada y retorna un dict con los
campos del modelo Empleado/Contrato que pudo identificar. Los campos no
encontrados se retornan como None para que el frontend los muestre vacíos.
"""
import json
from google import genai
from google.genai import types
from django.conf import settings


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


def extraer_campos_contrato(file_bytes: bytes, mime_type: str) -> dict:
    """
    Envía el documento a Gemini Flash y retorna los campos extraídos como dict.
    Lanza RuntimeError si la API key no está configurada o si Gemini falla.
    """
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY no está configurado. "
            "Agrega la variable de entorno en .env y en Railway."
        )

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=[
            types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            _PROMPT,
        ],
        config=types.GenerateContentConfig(
            response_mime_type='application/json',
        ),
    )

    try:
        return json.loads(response.text)
    except (json.JSONDecodeError, AttributeError) as e:
        raise RuntimeError(f"Gemini devolvió una respuesta inesperada: {e}")
