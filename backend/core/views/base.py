"""Piezas comunes de las vistas: límites de intentos, plan activo y cupos, fechas y PDF."""
from rest_framework.exceptions import ValidationError
from rest_framework.throttling import AnonRateThrottle
from ..models import Plan, Empleado
from xhtml2pdf import pisa
import datetime
import io
from ..rut import limpiar_rut
import logging
import pandas as pd


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'

class LoginAccountRateThrottle(AnonRateThrottle):
    scope = 'login'
    def get_cache_key(self, request, view):
        # RUT limpio: con el texto tal cual, "123456785" y "12.345.678-5"
        # contaban como cuentas distintas y se multiplicaban los intentos.
        username = limpiar_rut(request.data.get('username', '')) or \
            str(request.data.get('username', '')).strip().lower()
        if not username:
            return None  # sin username, no aplica (cae al throttle por IP igual)
        return f'throttle_login_account_{username}'

class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'

class RegisterAccountRateThrottle(AnonRateThrottle):
    scope = 'register'
    def get_cache_key(self, request, view):
        rut = limpiar_rut(request.data.get('rut', ''))
        email = (request.data.get('email') or request.data.get('correo') or '').strip().lower()
        clave = rut or email
        if not clave:
            return None
        return f'throttle_register_account_{clave}'

class PasswordResetRateThrottle(AnonRateThrottle):
    scope = 'password_reset'

class PasswordResetAccountRateThrottle(AnonRateThrottle):
    """Límite de solicitudes de recuperación por cuenta (RUT).

    Evita que alguien inunde de correos de recuperación a un titular
    cambiando de IP.
    """
    scope = 'password_reset'
    def get_cache_key(self, request, view):
        rut = limpiar_rut(request.data.get('rut', ''))
        if not rut:
            return None
        return f'throttle_pwreset_account_{rut}'


logger = logging.getLogger(__name__)



# ==========================================
# UTILIDADES DE RUT (VALIDACIÓN Y FORMATO)
# ==========================================
# Ayudantes de RUT en core/rut.py (los usa también serializers.py).

# ==========================================
# TRADUCTOR INTELIGENTE DE FECHAS EXCEL
# ==========================================
def estandarizar_fecha(fecha_valor):
    # 1. Manejo de nulos (incluyendo nulos de Pandas)
    if not fecha_valor or pd.isna(fecha_valor):
        return None
    
    # 2. Si Pandas ya lo parseó correctamente como objeto datetime/date
    if isinstance(fecha_valor, (datetime.datetime, datetime.date)):
        return fecha_valor.date() if isinstance(fecha_valor, datetime.datetime) else fecha_valor

    fecha_str = str(fecha_valor).strip()
    
    # 3. Si viene como número de serie de Excel
    try:
        serial = float(fecha_str)
        base = datetime.datetime(1899, 12, 30)
        return (base + datetime.timedelta(days=serial)).date()
    except ValueError:
        pass

    # 4. Formatos estrictos chilenos (Día, Mes, Año) + ISO estándar de BD
    formatos_chilenos = [
        '%d-%m-%Y', '%d/%m/%Y', '%d.%m.%Y',
        '%d-%m-%y', '%d/%m/%y', '%d.%m.%y',
        '%Y-%m-%d'
    ]
    
    for fmt in formatos_chilenos:
        try:
            dt = datetime.datetime.strptime(fecha_str, fmt).date()
            # Ajuste para años de 2 dígitos (ej: 92 -> 1992 en vez de 2092)
            if dt.year > datetime.date.today().year + 10:
                dt = dt.replace(year=dt.year - 100)
            return dt
        except ValueError:
            continue

    return None


def _plan_activo(user):
    """Devuelve el objeto Plan activo del usuario, o None si no tiene plan."""
    cliente = getattr(user, 'perfil_cliente', None)
    if not cliente:
        return None
    plan = cliente.plan
    if not plan:
        try:
            suscripcion = cliente.suscripcion_activa
            if suscripcion.estado in ('ACTIVE', 'TRIAL', 'PAST_DUE'):
                plan = suscripcion.plan
        except Exception:
            pass
    return plan


def _limite_trabajadores(user) -> int:
    """Trabajadores vigentes que permite el plan activo. Sin plan rige el de nivel 1."""
    plan = _plan_activo(user) or Plan.objects.filter(nivel=1).order_by('id').first()
    return plan.limite_trabajadores if plan else 3


def _trabajadores_vigentes(user) -> int:
    """Cuenta de trabajadores activos en todas las empresas del usuario.

    Los desvinculados (activo=False) no ocupan cupo: con borrado lógico, si
    contaran, una empresa que despide nunca podría volver a contratar.
    """
    return Empleado.objects.filter(empresa__owner=user, activo=True).count()


def _exigir_cupo_trabajador(user):
    limite = _limite_trabajadores(user)
    if _trabajadores_vigentes(user) >= limite:
        raise ValidationError({'error': (
            f'Tu plan permite {limite} trabajadores vigentes y ya los tienes todos. '
            f'Mejora tu plan o desvincula a alguien para agregar otro.')})


def _nivel_plan(user) -> int:
    """Retorna el nivel del plan activo: 1=Semilla, 2=Starter, 3=Pyme, 4=Corporativo.
    Sin plan asignado se asume nivel 1 (Semilla)."""
    plan = _plan_activo(user)
    return plan.nivel if plan else 1


def _plan_permite(user, nivel_min: int) -> bool:
    """True si el plan del usuario tiene nivel >= nivel_min."""
    return _nivel_plan(user) >= nivel_min


def _es_plan_semilla(user) -> bool:
    """True si el usuario no tiene plan activo o su plan es nivel 1 (Semilla)."""
    return _nivel_plan(user) == 1


def _html_a_pdf_bytes(html_string: str, nombre_doc: str) -> bytes:
    """Convierte HTML a bytes PDF con xhtml2pdf. Lanza excepción si falla."""
    resultado = io.BytesIO()
    status = pisa.pisaDocument(io.BytesIO(html_string.encode("UTF-8")), resultado)
    if status.err:
        raise Exception(f"Error generando PDF '{nombre_doc}'.")
    pdf_bytes = resultado.getvalue()
    if not pdf_bytes:
        raise Exception(f"PDF '{nombre_doc}' resultó vacío.")
    return pdf_bytes


_MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto",
          "septiembre","octubre","noviembre","diciembre"]
_DIAS_NOMBRES = {
    'lunes': 'Lunes', 'martes': 'Martes', 'miercoles': 'Miércoles',
    'jueves': 'Jueves', 'viernes': 'Viernes', 'sabado': 'Sábado', 'domingo': 'Domingo',
}


def _ctx_contrato(contrato, es_plan_semilla: bool) -> dict:
    """Construye el contexto completo para el template contrato_trabajo.html."""
    empleado = contrato.empleado
    empresa = empleado.empresa
    hoy = datetime.date.today()
    fecha_espanol = f"{hoy.day:02d} de {_MESES[hoy.month - 1]} de {hoy.year}"
    comuna_emp = getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or ''
    ciudad = str(comuna_emp or getattr(empleado, 'comuna', '') or 'Santiago').strip().title()

    def fmt_fecha(fecha):
        if not fecha:
            return None
        return f"{fecha.day:02d} de {_MESES[fecha.month - 1]} de {fecha.year}"

    def fmt_pesos(valor):
        if not valor:
            return "$0"
        return f"${valor:,}".replace(",", ".")

    horario_formateado = []
    if contrato.distribucion_horario:
        for dia_key, datos in contrato.distribucion_horario.items():
            if datos.get('activo'):
                horario_formateado.append({
                    'dia_nombre': _DIAS_NOMBRES.get(dia_key, dia_key.title()),
                    'entrada': datos.get('entrada', ''),
                    'salida': datos.get('salida', ''),
                    'colacion': datos.get('colacion', 0),
                })

    return {
        'contrato': contrato,
        'empleado': empleado,
        'empresa': empresa,
        'es_plan_semilla': es_plan_semilla,
        'fecha_actual': fecha_espanol,
        'ciudad': ciudad,
        'tipo_contrato_texto': contrato.get_tipo_contrato_display(),
        'fecha_inicio_texto': fmt_fecha(contrato.fecha_inicio),
        'fecha_fin_texto': fmt_fecha(contrato.fecha_fin),
        'fecha_nacimiento_texto': fmt_fecha(empleado.fecha_nacimiento),
        'sueldo_base_texto': fmt_pesos(contrato.sueldo_base),
        'monto_quincena_texto': fmt_pesos(contrato.monto_quincena),
        'horario_formateado': horario_formateado,
    }
