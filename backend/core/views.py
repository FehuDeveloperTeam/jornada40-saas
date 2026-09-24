from rest_framework.decorators import api_view, permission_classes, action, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.throttling import AnonRateThrottle


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

from django.contrib.auth.models import User
from django.db import transaction, IntegrityError
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.http import HttpResponse
from django.template.loader import render_to_string, get_template
from .models import Plan, Suscripcion, Cliente, Empresa, Empleado, Contrato, AnexoContrato, DocumentoLegal, Liquidacion, SolicitudFirma, OTPFirma, VacacionEmpleado, Finiquito, ParametroPrevisional, TasaAFP, ConceptoRemuneracion, EventoPasarela
from .serializers import PlanSerializer
from django.contrib.auth.forms import PasswordResetForm
from xhtml2pdf import pisa
from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify
import datetime
import io
import zipfile
import re
import math
from decimal import Decimal, ROUND_FLOOR
from .indicadores import obtener_uf, obtener_utm, calcular_impuesto_unico
from .jornada import avisos_jornada, jornada_maxima_vigente
from .rut import es_rut_de_persona, formatear_rut, limpiar_rut, normalizar_rut_usuario, validar_rut
import random
import string
from num2words import num2words
from decouple import config
import hmac
import functools
import hashlib
import holidays as holidays_cl
from dateutil.relativedelta import relativedelta
import secrets
import logging
from html import escape as _esc

logger = logging.getLogger(__name__)
import pandas as pd
import urllib.parse
from django.db.models import Max, Sum, Exists, OuterRef, Q
from django.core.files.base import ContentFile
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter


from .serializers import EmpresaSerializer, EmpleadoSerializer, ContratoSerializer, AnexoContratoSerializer, DocumentoLegalSerializer, LiquidacionSerializer, SolicitudFirmaSerializer, FiniquitoSerializer, ConceptoRemuneracionSerializer
from . import b2_client
from django.core.mail import EmailMultiAlternatives
import uuid as uuid_mod

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


# ==========================================
# UTILIDADES DE VACACIONES (Art. 67-68 Código del Trabajo)
# ==========================================

# Feriados legales de Chile, incluidos los móviles (Semana Santa, Pueblos
# Indígenas) y los que la ley traslada a lunes. La lista fija que había antes
# omitía Viernes y Sábado Santo y el 20/21 de junio.
@functools.lru_cache(maxsize=32)
def _feriados_cl(anio: int) -> frozenset:
    return frozenset(holidays_cl.Chile(years=anio).keys())


def es_feriado_cl(fecha) -> bool:
    return fecha in _feriados_cl(fecha.year)


def _contar_domingos_y_festivos(mes: int, anio: int) -> int:
    """Cuenta los domingos y feriados dentro de un mes calendario.

    Usado para la semana corrida (Art. 45 Código del Trabajo): un domingo
    que coincide con un feriado se cuenta una sola vez.
    """
    import calendar
    _, ultimo_dia = calendar.monthrange(anio, mes)
    dias = 0
    for dia in range(1, ultimo_dia + 1):
        fecha = datetime.date(anio, mes, dia)
        if fecha.weekday() == 6 or es_feriado_cl(fecha):
            dias += 1
    return dias


def _es_dia_habil_feriado(fecha) -> bool:
    """Día hábil para el feriado anual: lunes a viernes que no sea feriado.

    Art. 69 del Código del Trabajo: "para los efectos del feriado, el día
    sábado se considerará siempre inhábil".
    """
    return fecha.weekday() < 5 and not es_feriado_cl(fecha)


def _calcular_dias_habiles_vacacion(fecha_inicio, fecha_fin) -> int:
    """Días hábiles de feriado entre fecha_inicio y fecha_fin (inclusive)."""
    dias = 0
    current = fecha_inicio
    delta_un_dia = datetime.timedelta(days=1)
    while current <= fecha_fin:
        if _es_dia_habil_feriado(current):
            dias += 1
        current += delta_un_dia
    return dias


def calcular_saldo_vacaciones(empleado, hasta=None) -> dict:
    """Saldo de vacaciones legales de un empleado (Art. 67-68 Código del Trabajo).

    Retorna:
        anos_servicio       — años completos desde fecha_ingreso
        dias_base           — 15 días × años_servicio
        dias_progresivos    — 1 día extra por cada 3 años sobre 10 (Art. 68)
        dias_devengados     — días_base + días_progresivos
        dias_usados         — suma de días_hábiles de registros APROBADO
        dias_disponibles    — devengados − usados (mínimo 0)
    """
    hoy = hasta or datetime.date.today()
    anos_servicio = relativedelta(hoy, empleado.fecha_ingreso).years if empleado.fecha_ingreso <= hoy else 0

    dias_base = 15 * anos_servicio

    # Feriado progresivo: 1 día adicional por cada período completo de 3 años sobre 10
    dias_progresivos = max(0, (anos_servicio - 10) // 3) if anos_servicio >= 10 else 0

    dias_devengados = dias_base + dias_progresivos

    dias_usados = (
        VacacionEmpleado.objects
        .filter(
            empleado=empleado,
            estado='APROBADO',
            tipo__in=['VACACION_LEGAL', 'VACACION_PROGRESIVA'],
        )
        .aggregate(total=Sum('dias_habiles'))['total'] or 0
    )

    return {
        'anos_servicio':    anos_servicio,
        'dias_base':        dias_base,
        'dias_progresivos': dias_progresivos,
        'dias_devengados':  dias_devengados,
        'dias_usados':      int(dias_usados),
        'dias_disponibles': max(0, dias_devengados - int(dias_usados)),
    }


class DocumentoLegalViewSet(viewsets.ModelViewSet):
    queryset = DocumentoLegal.objects.all().order_by('-fecha_emision', '-creado_en')
    serializer_class = DocumentoLegalSerializer
    permission_classes = [IsAuthenticated]

    # Textos legales de cada causal para el PDF
    _CAUSAL_INFO = {
        '159_1':  ('Art. 159 N°1 — Mutuo acuerdo de las partes',
                   'Ambas partes acuerdan, de mutuo acuerdo, poner término al contrato de trabajo.', False),
        '159_2':  ('Art. 159 N°2 — Renuncia voluntaria del trabajador',
                   'El trabajador ha presentado su renuncia voluntaria al cargo.', False),
        '159_3':  ('Art. 159 N°3 — Muerte del trabajador',
                   'El contrato de trabajo termina por fallecimiento del trabajador.', False),
        '159_4':  ('Art. 159 N°4 — Vencimiento del plazo convenido',
                   'Ha vencido el plazo estipulado en el contrato de trabajo a plazo fijo.', False),
        '159_5':  ('Art. 159 N°5 — Conclusión del trabajo o servicio que dio origen al contrato',
                   'Ha concluido el trabajo, obra o servicio específico para el cual fue contratado el trabajador.', False),
        '159_6':  ('Art. 159 N°6 — Caso fortuito o fuerza mayor',
                   'Se ha producido un evento de caso fortuito o fuerza mayor que hace imposible continuar con la relación laboral.', False),
        '160_1a': ('Art. 160 N°1 a) — Falta de probidad del trabajador',
                   'El trabajador ha incurrido en conductas contrarias a la honradez e integridad que debe observar en el ejercicio de su cargo.', False),
        '160_1b': ('Art. 160 N°1 b) — Acoso sexual',
                   'El trabajador ha incurrido en conductas de acoso sexual, conforme a lo definido en el Artículo 2° del Código del Trabajo.', False),
        '160_1c': ('Art. 160 N°1 c) — Vías de hecho ejercidas por el trabajador',
                   'El trabajador ha ejercido vías de hecho en contra del empleador o de algún compañero de trabajo de la empresa.', False),
        '160_1d': ('Art. 160 N°1 d) — Injurias proferidas al empleador',
                   'El trabajador ha proferido injurias graves en contra del empleador, afectando su honor y dignidad.', False),
        '160_1e': ('Art. 160 N°1 e) — Conducta inmoral del trabajador',
                   'El trabajador ha incurrido en conductas inmorales graves que afectan a la empresa donde se desempeña.', False),
        '160_1f': ('Art. 160 N°1 f) — Conductas de acoso laboral',
                   'El trabajador ha incurrido en conductas de acoso laboral (mobbing), atentando contra la dignidad de otros trabajadores de la empresa.', False),
        '160_2':  ('Art. 160 N°2 — Negociaciones que ejecute el trabajador dentro del giro del negocio prohibidas por escrito',
                   'El trabajador ha realizado negociaciones dentro del giro del negocio de la empresa, en contravención a la prohibición expresa establecida en el contrato de trabajo.', False),
        '160_3':  ('Art. 160 N°3 — No concurrencia del trabajador a sus labores sin causa justificada',
                   'El trabajador no ha concurrido a sus labores sin causa justificada, configurándose la causal de inasistencias injustificadas establecida en el Código del Trabajo.', False),
        '160_4a': ('Art. 160 N°4 a) — Abandono del trabajo: salida intempestiva e injustificada',
                   'El trabajador ha abandonado el lugar de trabajo de forma intempestiva e injustificada durante la jornada laboral, sin permiso del empleador.', False),
        '160_4b': ('Art. 160 N°4 b) — Abandono del trabajo: negativa injustificada a trabajar',
                   'El trabajador se ha negado injustificadamente a realizar las faenas convenidas en el contrato de trabajo.', False),
        '160_5':  ('Art. 160 N°5 — Actos, omisiones o imprudencias temerarias que afecten la seguridad',
                   'El trabajador ha incurrido en actos, omisiones o imprudencias temerarias que afectan gravemente la seguridad o el funcionamiento del establecimiento, o la salud de los trabajadores.', False),
        '160_6':  ('Art. 160 N°6 — Perjuicio material causado intencionalmente',
                   'El trabajador ha causado intencionalmente perjuicio material en las instalaciones, maquinarias, herramientas, útiles de trabajo, productos o mercaderías de la empresa.', False),
        '160_7':  ('Art. 160 N°7 — Incumplimiento grave de las obligaciones que impone el contrato',
                   'El trabajador ha incurrido en incumplimiento grave de las obligaciones que le impone el contrato de trabajo.', False),
        '161_1':  ('Art. 161 inciso 1° — Necesidades de la empresa, establecimiento o servicio',
                   'La empresa, por razones derivadas de la racionalización o modernización de la misma, bajas en la productividad, cambios en las condiciones del mercado o de la economía, o que hagan necesaria la separación de uno o más trabajadores, ha decidido poner término al contrato de trabajo.', True),
        '161_2':  ('Art. 161 inciso 2° — Desahucio del empleador',
                   'El empleador, en ejercicio de la facultad contemplada en el inciso segundo del Artículo 161 del Código del Trabajo, pone término al contrato de trabajo mediante desahucio.', True),
        '163bis': ('Art. 163 bis — Liquidación concursal del empleador',
                   'La empresa ha sido sometida a un procedimiento concursal de liquidación de sus bienes por resolución judicial, lo que determina el término del contrato de trabajo conforme a lo dispuesto en el Artículo 163 bis del Código del Trabajo.', True),
    }

    # Las cartas de término (despido) son del plan Starter en adelante.
    _MENSAJE_CARTA_TERMINO = ('Las cartas de término están disponibles desde el plan Starter. '
                              'Mejora tu suscripción para acceder.')

    def _exigir_plan_si_es_carta_de_termino(self, tipo):
        if tipo == 'DESPIDO' and not _plan_permite(self.request.user, 2):
            raise PermissionDenied(self._MENSAJE_CARTA_TERMINO)

    def _montos_legales(self, documento):
        """Indemnizaciones que informa la carta de término (Art. 162 inc. 4°).

        Las calcula el mismo motor del finiquito: el usuario elige la causal,
        la fecha y si dio el aviso previo, pero no escribe los montos.
        """
        if documento.tipo != 'DESPIDO' or documento.causal_articulo not in _CAUSALES_CON_INDEMNIZACION:
            montos = (None, None)
        else:
            fecha = documento.fecha_ultimo_dia or documento.fecha_emision
            if isinstance(fecha, str):
                fecha = datetime.date.fromisoformat(fecha)
            calculado, _ = _calcular_finiquito(
                documento.empleado, fecha, 30, documento.causal_articulo,
                aviso_previo_dado=(documento.aviso_previo_dias or 0) >= 30)
            montos = (calculado['indemnizacion_anos_servicio'], calculado['indemnizacion_sustitutiva_aviso'])
        documento.monto_indemnizacion_anos, documento.monto_indemnizacion_sustitutiva = montos
        documento.save(update_fields=['monto_indemnizacion_anos', 'monto_indemnizacion_sustitutiva'])

    def perform_create(self, serializer):
        self._exigir_plan_si_es_carta_de_termino(serializer.validated_data.get('tipo'))
        self._montos_legales(serializer.save())

    def perform_update(self, serializer):
        self._exigir_plan_si_es_carta_de_termino(
            serializer.validated_data.get('tipo', serializer.instance.tipo))
        documento = serializer.save()
        if documento.archivo_pdf:
            documento.archivo_pdf.delete(save=False)  # el PDF anterior ya no corresponde
        self._montos_legales(documento)

    def get_queryset(self):
        # Solo documentos de empleados que pertenecen al usuario autenticado
        queryset = DocumentoLegal.objects.filter(
            empleado__empresa__owner=self.request.user
        ).order_by('-fecha_emision', '-creado_en')
        empleado_id = self.request.query_params.get('empleado', None)
        if empleado_id is not None:
            queryset = queryset.filter(empleado_id=empleado_id)
        return queryset

    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        documento = self.get_object()
        if documento.tipo == 'DESPIDO' and not _plan_permite(request.user, 2):
            return Response({'error': self._MENSAJE_CARTA_TERMINO}, status=status.HTTP_403_FORBIDDEN)
        try:
            empleado = documento.empleado
            empresa = empleado.empresa

            meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            hoy = documento.fecha_emision
            fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"

            comuna_emp = getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or ''
            comuna_empl = getattr(empleado, 'comuna', '') or ''
            ciudad_segura = str(comuna_emp or comuna_empl or 'Santiago').strip().title()
            es_plan_semilla = _es_plan_semilla(request.user)

            context = {
                'documento': documento,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': fecha_espanol,
                'ciudad': ciudad_segura,
                'es_plan_semilla': es_plan_semilla,
            }

            if documento.tipo == 'DESPIDO':
                # Contexto enriquecido para carta_despido.html
                codigo = documento.causal_articulo or ''
                causal_label, causal_descripcion, requiere_indemnizacion = self._CAUSAL_INFO.get(
                    codigo, (documento.causal_legal or '—', '', False)
                )
                def _fmt_pesos(v):
                    if not v:
                        return '$ 0'
                    return f'$ {v:,}'.replace(',', '.')
                monto_anos  = documento.monto_indemnizacion_anos or 0
                monto_sust  = documento.monto_indemnizacion_sustitutiva or 0
                # Cargo desde contrato si existe
                try:
                    contrato_cargo = documento.empleado.contrato.cargo
                except Exception:
                    contrato_cargo = None
                # Fecha último día en español
                fecha_ultimo_dia_texto = None
                if documento.fecha_ultimo_dia:
                    f = documento.fecha_ultimo_dia
                    fecha_ultimo_dia_texto = f"{f.day:02d} de {meses[f.month - 1]} de {f.year}"
                context.update({
                    'causal_label': causal_label,
                    'causal_descripcion': causal_descripcion,
                    'requiere_indemnizacion': requiere_indemnizacion,
                    'monto_anos_texto': _fmt_pesos(monto_anos),
                    'monto_sustitutiva_texto': _fmt_pesos(monto_sust),
                    'monto_total_texto': _fmt_pesos(monto_anos + monto_sust),
                    'fecha_ultimo_dia_texto': fecha_ultimo_dia_texto,
                    'contrato_cargo': contrato_cargo,
                })
                template = get_template('carta_despido.html')
            else:
                template = get_template('documento_legal.html')

            html = template.render(context)

            response = HttpResponse(content_type='application/pdf')
            nombre_archivo = f'{documento.tipo}_{empleado.rut}.pdf'
            response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'

            pisa_status = pisa.CreatePDF(html, dest=response)

            if pisa_status.err:
                return HttpResponse('Error al generar el PDF.', status=500)
            
            return response

        except Exception as e:
            return Response({'error': f'Error al generar PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==========================================
# VACACIONES Y PERMISOS
# ==========================================
class VacacionViewSet(viewsets.ModelViewSet):
    serializer_class = None  # se asigna abajo tras importar el serializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        from .serializers import VacacionSerializer
        return VacacionSerializer

    def get_queryset(self):
        qs = VacacionEmpleado.objects.filter(
            empresa__owner=self.request.user
        ).order_by('-fecha_inicio')
        empleado_id = self.request.query_params.get('empleado')
        if empleado_id:
            qs = qs.filter(empleado_id=empleado_id)
        return qs

    def create(self, request, *args, **kwargs):
        if not _plan_permite(request.user, 2):
            return Response(
                {'error': 'La gestión de vacaciones y permisos está disponible desde el plan Starter. Mejora tu suscripción para acceder.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def _guardar(self, serializer):
        """Los días hábiles siempre los calcula el servidor (Art. 69 y feriados)."""
        inicio = serializer.validated_data.get('fecha_inicio', getattr(serializer.instance, 'fecha_inicio', None))
        fin = serializer.validated_data.get('fecha_fin', getattr(serializer.instance, 'fecha_fin', None))
        if inicio and fin and fin < inicio:
            raise ValidationError({'error': 'La fecha de término es anterior a la de inicio.'})
        serializer.save(dias_habiles=_calcular_dias_habiles_vacacion(inicio, fin) if inicio and fin else 0)

    def perform_create(self, serializer):
        self._guardar(serializer)

    def perform_update(self, serializer):
        self._guardar(serializer)

    @action(detail=False, methods=['get'], url_path='dias_habiles')
    def dias_habiles(self, request):
        """GET /api/vacaciones/dias_habiles/?inicio=AAAA-MM-DD&fin=AAAA-MM-DD — vista previa del formulario."""
        try:
            inicio = datetime.date.fromisoformat(request.query_params.get('inicio', ''))
            fin = datetime.date.fromisoformat(request.query_params.get('fin', ''))
        except ValueError:
            return Response({'error': 'Fechas inválidas.'}, status=status.HTTP_400_BAD_REQUEST)
        if fin < inicio:
            return Response({'error': 'La fecha de término es anterior a la de inicio.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'dias_habiles': _calcular_dias_habiles_vacacion(inicio, fin)})

    @action(detail=False, methods=['get'], url_path='saldo')
    def saldo(self, request):
        """GET /api/vacaciones/saldo/?empleado=<id>
        Retorna el saldo de vacaciones del empleado.
        """
        if not _plan_permite(request.user, 2):
            return Response(
                {'error': 'La gestión de vacaciones está disponible desde el plan Starter.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        empleado_id = request.query_params.get('empleado')
        if not empleado_id:
            return Response({'error': 'Parámetro empleado requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            empleado = Empleado.objects.get(pk=empleado_id, empresa__owner=request.user)
        except Empleado.DoesNotExist:
            return Response({'error': 'Empleado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(calcular_saldo_vacaciones(empleado))

    @action(detail=True, methods=['get'], url_path='generar_pdf')
    def generar_pdf(self, request, pk=None):
        """GET /api/vacaciones/<id>/generar_pdf/
        Genera y devuelve el comprobante de vacaciones en PDF.
        """
        try:
            vacacion = self.get_object()
            empleado = vacacion.empleado
            empresa  = vacacion.empresa
            es_semilla = _es_plan_semilla(request.user)

            hoy = datetime.date.today()
            fecha_hoy_texto = f"{hoy.day:02d} de {_MESES[hoy.month - 1]} de {hoy.year}"

            def _fmt_fecha(f):
                if not f:
                    return '—'
                return f"{f.day:02d} de {_MESES[f.month - 1]} de {f.year}"

            context = {
                'vacacion':          vacacion,
                'empleado':          empleado,
                'empresa':           empresa,
                'fecha_actual':      fecha_hoy_texto,
                'fecha_inicio_texto': _fmt_fecha(vacacion.fecha_inicio),
                'fecha_fin_texto':    _fmt_fecha(vacacion.fecha_fin),
                'ciudad': str(
                    getattr(empresa, 'ciudad', '') or
                    getattr(empresa, 'comuna', '') or
                    getattr(empleado, 'comuna', '') or 'Santiago'
                ).strip().title(),
                'es_plan_semilla': es_semilla,
            }

            template = get_template('comprobante_vacaciones.html')
            html = template.render(context)

            response = HttpResponse(content_type='application/pdf')
            nombre = f'vacacion_{empleado.rut}_{vacacion.fecha_inicio}.pdf'
            response['Content-Disposition'] = f'attachment; filename="{nombre}"'

            pisa_status = pisa.CreatePDF(html, dest=response)
            if pisa_status.err:
                return HttpResponse('Error al generar el PDF.', status=500)

            return response

        except Exception as e:
            return Response(
                {'error': f'Error al generar PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class EmpresaViewSet(viewsets.ModelViewSet):
    serializer_class = EmpresaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.query_params.get('incluir_inactivas') == 'true':
            return Empresa.objects.filter(owner=self.request.user)
        return Empresa.objects.filter(owner=self.request.user, activo=True)
    
    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        try:
            empresa = Empresa.objects.get(pk=pk, owner=request.user)
            empresa.activo = True
            empresa.save()
            return Response({"mensaje": "Empresa reactivada correctamente"}, status=status.HTTP_200_OK)
        except Empresa.DoesNotExist:
            return Response({"error": "Empresa no encontrada"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['patch'], url_path='configurar-firma')
    def configurar_firma(self, request, pk=None):
        """Guarda la firma dibujada del representante legal de la empresa."""
        empresa = self.get_object()

        firma_imagen = request.data.get('firma_imagen', '').strip()
        nombre       = request.data.get('firma_firmante_nombre', '').strip()
        cargo        = request.data.get('firma_firmante_cargo', '').strip()

        if not firma_imagen:
            return Response({'error': 'La imagen de firma es requerida.'}, status=status.HTTP_400_BAD_REQUEST)
        if not firma_imagen.startswith('data:image/'):
            return Response({'error': 'Formato de imagen inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(firma_imagen) > 500_000:
            return Response({'error': 'La imagen de firma es demasiado grande.'}, status=status.HTTP_400_BAD_REQUEST)

        empresa.firma_imagen          = firma_imagen
        empresa.firma_firmante_nombre = nombre
        empresa.firma_firmante_cargo  = cargo
        empresa.firma_configurada_en  = timezone.now()
        empresa.save(update_fields=['firma_imagen', 'firma_firmante_nombre',
                                    'firma_firmante_cargo', 'firma_configurada_en'])

        serializer = self.get_serializer(empresa)
        return Response(serializer.data)

    def perform_create(self, serializer):
        # 1. REGLA DE NEGOCIO: Límite de empresas según el plan activo
        plan = _plan_activo(self.request.user)
        if plan:
            total_empresas = Empresa.objects.filter(owner=self.request.user, activo=True).count()
            if total_empresas >= plan.max_empresas:
                raise ValidationError({'error': f'Tu plan {plan.nombre} permite administrar un máximo de {plan.max_empresas} empresas. Actualiza tu plan para registrar más.'})

        # 2. Convertir a mayúsculas
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        rut_raw = self.request.data.get('rut', '')
        
        # 3. REGLA DE NEGOCIO: No repetir RUT en el mismo panel
        if rut_raw:
            rut_form = formatear_rut(rut_raw)
            if Empresa.objects.filter(rut=rut_form).exists():
                raise ValidationError({'error': 'Ya existe una empresa registrada con este RUT en el sistema. Contacta a soporte si crees que esto es un error.'})
            datos_mayusculas['rut'] = rut_form
            
        serializer.save(owner=self.request.user, **datos_mayusculas)

    # SOFT-DELETE: En vez de eliminar la empresa, la marcamos como inactiva
    def destroy(self, request, *args, **kwargs):
        empresa = self.get_object()
        empresa.activo = False
        empresa.save()
        return Response({"mensaje": "Empresa desactivada correctamente"}, status=status.HTTP_200_OK)
            
    def perform_update(self, serializer):
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        rut_raw = self.request.data.get('rut', '')
        
        if rut_raw:
            rut_form = formatear_rut(rut_raw)
            if Empresa.objects.filter(owner=self.request.user, rut=rut_form).exclude(id=serializer.instance.id).exists():
                raise ValidationError({'error': 'Ya tienes otra empresa registrada con este RUT.'})
            datos_mayusculas['rut'] = rut_form
            
        serializer.save(**datos_mayusculas)

# Columnas obligatorias para crear un trabajador desde la planilla. Al
# actualizar uno existente basta el RUT: solo cambian las columnas que traen dato.
_COLUMNAS_OBLIGATORIAS = ('rut', 'nombres', 'apellido_paterno', 'cargo', 'fecha_ingreso', 'sueldo_base', 'horas_laborales')
_CAMPOS_TEXTO_CARGA = ('nombres', 'apellido_paterno', 'apellido_materno', 'nacionalidad', 'departamento',
                       'sucursal', 'cargo', 'forma_pago', 'banco', 'tipo_cuenta')
_NOMBRE_CAMPO = {
    'nombres': 'nombres', 'apellido_paterno': 'apellido paterno', 'apellido_materno': 'apellido materno',
    'email': 'correo', 'sexo': 'sexo', 'nacionalidad': 'nacionalidad', 'fecha_nacimiento': 'fecha de nacimiento',
    'fecha_ingreso': 'fecha de ingreso', 'departamento': 'departamento', 'sucursal': 'sucursal', 'cargo': 'cargo',
    'sueldo_base': 'sueldo', 'horas_laborales': 'horas', 'forma_pago': 'forma de pago', 'banco': 'banco',
    'tipo_cuenta': 'tipo de cuenta', 'numero_cuenta': 'número de cuenta',
}


def _vacio(valor):
    return valor is None or (isinstance(valor, float) and math.isnan(valor)) or str(valor).strip() == ''


def _procesar_carga_masiva(empresa, registros, limite_trabajadores, guardar):
    """Revisa (y si `guardar`, aplica) cada fila de la planilla de trabajadores.

    Devuelve una fila de resultado por registro: 'nuevo', 'actualiza', 'error'
    o 'limite' (no cabe en el plan), con el mensaje para mostrar. Al actualizar
    solo se escriben las columnas que traen dato: una columna ausente o vacía
    no borra lo que ya estaba guardado.
    """
    empleados_bd = Empleado.objects.filter(empresa=empresa)
    mapa = {limpiar_rut(e.rut): e for e in empleados_bd}
    siguiente_ficha = (empleados_bd.aggregate(Max('ficha_numero'))['ficha_numero__max'] or 0) + 1
    total_actual = Empleado.objects.filter(empresa__owner=empresa.owner, activo=True).count()
    maximo_legal = jornada_maxima_vigente()
    vistos = set()
    resultados = []

    with transaction.atomic():
        for fila_num, row in enumerate(registros, start=2):  # la fila 1 es el encabezado
            r = {str(k).strip().lower().replace(' ', '_'): v for k, v in row.items()}
            if all(_vacio(v) for v in r.values()):
                continue  # fila en blanco
            rut_raw = str(r.get('rut', '')).strip()
            base = {'fila': fila_num, 'rut': rut_raw,
                    'nombre': f"{str(r.get('nombres', '')).strip()} {str(r.get('apellido_paterno', '')).strip()}".strip(),
                    'cargo': str(r.get('cargo', '')).strip(), 'horas': None, 'sueldo': None,
                    'cambios': [], 'alerta': ''}

            def error(msj):
                resultados.append({**base, 'resultado': 'error', 'mensaje': msj})

            if not rut_raw:
                error('Falta el RUT.'); continue
            if not validar_rut(rut_raw):
                error(f'RUT inválido ({rut_raw}): revisa el dígito verificador.'); continue
            rut_limpio = limpiar_rut(rut_raw)
            base['rut'] = formatear_rut(rut_raw)
            if rut_limpio in vistos:
                error('RUT repetido en la planilla: se usa solo la primera fila.'); continue
            vistos.add(rut_limpio)
            existente = mapa.get(rut_limpio)
            if existente is not None and not base['nombre']:
                base['nombre'] = f'{existente.nombres} {existente.apellido_paterno}'.title()

            # ── Valores presentes en la fila ─────────────────────────────
            datos = {}
            for campo in _CAMPOS_TEXTO_CARGA:
                if not _vacio(r.get(campo)):
                    datos[campo] = str(r[campo]).strip().upper()
            if not _vacio(r.get('email')):
                datos['email'] = str(r['email']).strip().lower()
            if not _vacio(r.get('sexo')):
                datos['sexo'] = str(r['sexo']).strip().upper()[:1]
            if not _vacio(r.get('numero_cuenta')):
                crudo = r['numero_cuenta']
                try:
                    datos['numero_cuenta'] = str(int(float(crudo)))
                except (ValueError, TypeError):
                    datos['numero_cuenta'] = str(crudo).strip()
            for campo in ('fecha_ingreso', 'fecha_nacimiento'):
                if not _vacio(r.get(campo)):
                    fecha = estandarizar_fecha(r[campo])
                    if fecha is None:
                        error(f'{_NOMBRE_CAMPO[campo].capitalize()} inválida ({r[campo]}): usa DD-MM-AAAA.'); break
                    datos[campo] = fecha
            else:
                try:
                    if not _vacio(r.get('sueldo_base')):
                        datos['sueldo_base'] = int(float(r['sueldo_base']))
                        if datos['sueldo_base'] < 0:
                            error('El sueldo no puede ser negativo.'); continue
                    if not _vacio(r.get('horas_laborales')):
                        datos['horas_laborales'] = int(float(r['horas_laborales']))
                        if not 1 <= datos['horas_laborales'] <= 168:
                            error('Las horas semanales deben estar entre 1 y 168.'); continue
                except (ValueError, TypeError):
                    error('El sueldo o las horas no son números.'); continue

                faltan = [c for c in _COLUMNAS_OBLIGATORIAS[1:] if c not in datos]
                if existente is None and faltan:
                    error('Faltan datos para crearlo: ' + ', '.join(_NOMBRE_CAMPO[c] for c in faltan) + '.'); continue

                base['horas'] = datos.get('horas_laborales', existente.horas_laborales if existente else None)
                base['sueldo'] = datos.get('sueldo_base', existente.sueldo_base if existente else None)
                if base['horas'] and base['horas'] > maximo_legal:
                    # Aviso, no bloqueo: la decisión es del empleador.
                    base['alerta'] = f'Jornada de {base["horas"]} h: supera el máximo legal vigente de {maximo_legal} h.'

                if existente is not None:
                    cambios = [c for c, v in datos.items() if str(getattr(existente, c) or '') != str(v)]
                    base['cambios'] = [_NOMBRE_CAMPO[c] for c in cambios]
                    if guardar and cambios:
                        for c in cambios:
                            setattr(existente, c, datos[c])
                        existente.save(update_fields=cambios)
                    resultados.append({**base, 'resultado': 'actualiza',
                                       'mensaje': ('Cambia: ' + ', '.join(base['cambios']) + '.') if cambios else 'Sin cambios.'})
                    continue

                if total_actual >= limite_trabajadores:
                    resultados.append({**base, 'resultado': 'limite',
                                       'mensaje': f'Tu plan permite {limite_trabajadores} trabajadores vigentes: esta fila no se crea.'})
                    continue
                if guardar:
                    Empleado.objects.create(rut=formatear_rut(rut_raw), empresa=empresa, ficha_numero=siguiente_ficha,
                                            **{'nacionalidad': 'CHILENA', **datos})
                    siguiente_ficha += 1
                total_actual += 1
                resultados.append({**base, 'resultado': 'nuevo', 'mensaje': 'Se crea.'})
    return resultados


class EmpleadoViewSet(viewsets.ModelViewSet):
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        rechazos_qs = SolicitudFirma.objects.filter(
            empleado=OuterRef('pk'),
            estado='RECHAZADO',
        )
        qs = Empleado.objects.filter(empresa__owner=self.request.user).annotate(
            tiene_rechazos_pendientes=Exists(rechazos_qs)
        )
        # El panel pide los trabajadores de la empresa activa; sin el
        # parámetro se mantienen todos los del usuario (panel anterior).
        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)
        return qs

    def perform_create(self, serializer):
        _exigir_cupo_trabajador(self.request.user)
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}

        empresa_destino = serializer.validated_data.get('empresa')

        rut_raw = self.request.data.get('rut', '')
        if rut_raw:
            if not validar_rut(rut_raw):
                raise ValidationError({'error': 'El RUT ingresado no es válido.'})
            rut_form = formatear_rut(rut_raw)

            if Empleado.objects.filter(empresa=empresa_destino, rut=rut_form).exists():
                raise ValidationError({'error': 'Este trabajador ya está registrado en esta empresa.'})

            datos_mayusculas['rut'] = rut_form

        telefono = datos_mayusculas.get('numero_telefono')
        if telefono and isinstance(telefono, str):
            solo_digitos = re.sub(r'[^0-9]', '', telefono)
            datos_mayusculas['numero_telefono'] = f'+56{solo_digitos[-9:]}' if solo_digitos else None

        serializer.save(**datos_mayusculas)

    def perform_update(self, serializer):
        # Reactivar a un desvinculado vuelve a ocupar cupo del plan.
        if serializer.validated_data.get('activo') is True and not serializer.instance.activo:
            _exigir_cupo_trabajador(self.request.user)
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}

        empresa_destino = serializer.validated_data.get('empresa', serializer.instance.empresa)

        rut_raw = self.request.data.get('rut', '')
        if rut_raw:
            if not validar_rut(rut_raw):
                raise ValidationError({'error': 'El RUT ingresado no es válido.'})
            rut_form = formatear_rut(rut_raw)

            if Empleado.objects.filter(empresa=empresa_destino, rut=rut_form).exclude(id=serializer.instance.id).exists():
                raise ValidationError({'error': 'Ya existe otro trabajador con este RUT en esta empresa.'})

            datos_mayusculas['rut'] = rut_form

        # Normalizar teléfono: extraer solo los últimos 9 dígitos y anteponer +56
        telefono = datos_mayusculas.get('numero_telefono')
        if telefono and isinstance(telefono, str):
            solo_digitos = re.sub(r'[^0-9]', '', telefono)
            datos_mayusculas['numero_telefono'] = f'+56{solo_digitos[-9:]}' if solo_digitos else None

        serializer.save(**datos_mayusculas)

    @action(detail=False, methods=['post'])
    def carga_masiva(self, request):
        if not _plan_permite(request.user, 3):
            return Response(
                {'error': 'La importación masiva por Excel está disponible desde el plan Pyme. Mejora tu suscripción para acceder.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            data = request.data[0] if isinstance(request.data, list) else request.data
            empresa_id = data.get('empresa')
            archivo_excel = request.FILES.get('file') or data.get('file')

            if not archivo_excel or not empresa_id:
                return Response({'error': 'Falta el archivo o la empresa.'}, status=400)

            MAX_EXCEL_MB = 5
            if hasattr(archivo_excel, 'size') and archivo_excel.size > MAX_EXCEL_MB * 1024 * 1024:
                return Response({'error': f'El archivo no puede superar {MAX_EXCEL_MB} MB.'}, status=400)

            MIME_EXCEL = {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
            }
            if hasattr(archivo_excel, 'content_type') and archivo_excel.content_type not in MIME_EXCEL:
                return Response({'error': 'Solo se aceptan archivos Excel (.xlsx o .xls).'}, status=400)

            empresa = Empresa.objects.get(id=empresa_id, owner=request.user)
            limite_trabajadores = _limite_trabajadores(request.user)

            # dtype=str: el RUT, la cuenta y las fechas llegan tal como se escribieron.
            df = pd.read_excel(archivo_excel, dtype=object).fillna('')
            registros = df.to_dict('records')

            MAX_FILAS = 500
            if len(registros) > MAX_FILAS:
                return Response({'error': f'El archivo no puede tener más de {MAX_FILAS} filas por importación.'}, status=400)

            # ?previsualizar=1 revisa cada fila con las mismas reglas y no guarda nada:
            # es la revisión previa del importador del panel.
            previsualizar = str(request.query_params.get('previsualizar', '')).lower() in ('1', 'true', 'si')
            filas = _procesar_carga_masiva(empresa, registros, limite_trabajadores, guardar=not previsualizar)

            creados = sum(1 for f in filas if f['resultado'] == 'nuevo')
            actualizados = sum(1 for f in filas if f['resultado'] == 'actualiza')
            return Response({
                'previsualizacion': previsualizar,
                'agregados': creados,
                'actualizados': actualizados,
                'limite_alcanzado': any(f['resultado'] == 'limite' for f in filas),
                'errores': [f"Fila {f['fila']}: {f['mensaje']}" for f in filas if f['resultado'] in ('error', 'limite')],
                'filas': filas,
            }, status=200)

        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada.'}, status=404)
        except Exception:
            return Response({'error': 'Error procesando el archivo. Revisa el formato e inténtalo de nuevo.'}, status=500)
                
   # ====================================================
    # DISPONIBILIDAD DE DOCUMENTOS POR TRABAJADOR
    # ====================================================
    @action(detail=True, methods=['get'])
    def documentos_disponibles(self, request, pk=None):
        empleado = self.get_object()
        contrato = Contrato.objects.filter(empleado=empleado).first()

        data = {
            'tiene_contrato': contrato is not None,
            'tiene_anexo_40h': bool(contrato and contrato.archivo_anexo_40h),
            'cantidad_liquidaciones': Liquidacion.objects.filter(empleado=empleado).count(),
            'cantidad_amonestaciones': DocumentoLegal.objects.filter(empleado=empleado, tipo='AMONESTACION').count(),
            'tiene_despido': DocumentoLegal.objects.filter(empleado=empleado, tipo='DESPIDO').exists(),
            'tiene_mutuo_acuerdo': DocumentoLegal.objects.filter(empleado=empleado, tipo='MUTUO_ACUERDO').exists(),
            'cantidad_constancias': DocumentoLegal.objects.filter(empleado=empleado, tipo='CONSTANCIA').count(),
            'cantidad_anexos_contrato': AnexoContrato.objects.filter(contrato=contrato).count() if contrato else 0,
        }
        return Response(data)

    @action(detail=True, methods=['get'], url_path='historial_salarial')
    def historial_salarial(self, request, pk=None):
        empleado = self.get_object()
        contrato = Contrato.objects.filter(empleado=empleado).first()

        liqs = list(
            Liquidacion.objects.filter(empleado=empleado)
            .order_by('anio', 'mes')
            .values('mes', 'anio', 'sueldo_base', 'total_haberes', 'total_descuentos',
                    'sueldo_liquido', 'dias_trabajados')
        )

        periodos = []
        prev_liq = None
        for liq in liqs:
            delta_pct = None
            if prev_liq is not None and prev_liq > 0:
                delta_pct = round((liq['sueldo_liquido'] - prev_liq) / prev_liq * 100, 1)
            periodos.append({**liq, 'delta_pct': delta_pct})
            prev_liq = liq['sueldo_liquido']

        liquidos = [p['sueldo_liquido'] for p in periodos]
        promedio = round(sum(liquidos) / len(liquidos)) if liquidos else 0

        # Tendencia: promedio últimos 3 meses vs los 3 anteriores
        tendencia_3m = None
        if len(liquidos) >= 6:
            avg_rec = sum(liquidos[-3:]) / 3
            avg_ant = sum(liquidos[-6:-3]) / 3
            if avg_ant > 0:
                tendencia_3m = round((avg_rec - avg_ant) / avg_ant * 100, 1)
        elif len(liquidos) >= 2:
            tendencia_3m = periodos[-1]['delta_pct']

        return Response({
            'contrato_sueldo_base': contrato.sueldo_base if contrato else None,
            'contrato_tipo': contrato.tipo_contrato if contrato else None,
            'promedio_liquido': promedio,
            'tendencia_3m': tendencia_3m,
            'periodos': periodos,
        })

   # ====================================================
    # MOTOR DOCUMENTAL PERSISTENTE (CON PLANTILLAS REALES)
    # ====================================================

    def _html_a_pdf(self, html_string, nombre_doc):
        """Convierte HTML a bytes PDF con xhtml2pdf. Lanza excepción clara si falla."""
        resultado = io.BytesIO()
        status = pisa.pisaDocument(io.BytesIO(html_string.encode("UTF-8")), resultado)
        if status.err:
            raise Exception(
                f"xhtml2pdf reportó {status.err} error(s) generando '{nombre_doc}'. "
                f"Revisar el template y el contexto pasado."
            )
        pdf_bytes = resultado.getvalue()
        if not pdf_bytes:
            raise Exception(
                f"PDF '{nombre_doc}' resultó vacío tras la conversión. "
                f"xhtml2pdf no reportó error pero el resultado es b\"\". "
                f"Posible problema de encoding o template vacío."
            )
        return pdf_bytes

    def _obtener_o_generar_documento(self, empleado, tipo_documento, user=None):
        """Revisa si el PDF ya existe en la BD. Si no, lo genera usando los templates HTML reales."""

        empresa = empleado.empresa
        es_plan_semilla = _es_plan_semilla(user) if user else False

        # --- LÓGICA PARA CONTRATOS ---
        if tipo_documento == 'contrato':
            try:
                contrato = Contrato.objects.get(empleado=empleado)
            except Contrato.DoesNotExist:
                raise Exception(f"El trabajador {empleado.nombres} no tiene contrato registrado.")
            if contrato.archivo_contrato:
                try:
                    return contrato.archivo_contrato.read()
                except Exception:
                    pass

            context = _ctx_contrato(contrato, es_plan_semilla)
            html_string = render_to_string('contrato_trabajo.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Contrato_{empleado.rut}')
            contrato.archivo_contrato.save(f"Contrato_{empleado.rut}.pdf", ContentFile(pdf_bytes))
            return pdf_bytes

        # --- LÓGICA PARA ANEXOS 40 HORAS ---
        elif tipo_documento == 'anexo_40h':
            try:
                contrato = Contrato.objects.get(empleado=empleado)
            except Contrato.DoesNotExist:
                raise Exception(f"El trabajador {empleado.nombres} no tiene contrato registrado.")
            if contrato.archivo_anexo_40h:
                try:
                    return contrato.archivo_anexo_40h.read()
                except Exception:
                    pass

            context = _ctx_contrato(contrato, es_plan_semilla)
            html_string = render_to_string('anexo_40h.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Anexo_40h_{empleado.rut}')
            contrato.archivo_anexo_40h.save(f"Anexo_40h_{empleado.rut}.pdf", ContentFile(pdf_bytes))
            return pdf_bytes

        # --- LÓGICA PARA LIQUIDACIONES (MES ACTUAL) ---
        elif tipo_documento == 'liquidacion_actual':
            hoy = datetime.date.today()
            try:
                liquidacion = Liquidacion.objects.get(empleado=empleado, mes=hoy.month, anio=hoy.year)
            except Liquidacion.DoesNotExist:
                raise Exception(f"No existe liquidación del mes actual para {empleado.nombres}.")
            if liquidacion.archivo_pdf:
                try:
                    return liquidacion.archivo_pdf.read()
                except Exception:
                    pass

            try:
                liquido_palabras = num2words(liquidacion.sueldo_liquido, lang='es')
            except Exception:
                liquido_palabras = str(liquidacion.sueldo_liquido)
            contrato_liq = Contrato.objects.filter(empleado=empleado).first()
            meses_liq = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
            agrupados = liquidacion.items_agrupados
            det_no_imp = agrupados['no_imponibles']
            det_otros = agrupados['descuentos']
            context = {
                'empleado': empleado, 'empresa': empresa,
                'liquidacion': liquidacion, 'contrato': contrato_liq,
                'mes_nombre': meses_liq[liquidacion.mes - 1].upper(),
                'liquido_palabras': liquido_palabras,
                'total_no_imponible': sum(int(i.get('valor', 0)) for i in det_no_imp if isinstance(i, dict)),
                'total_ley': (liquidacion.afp_monto or 0) + (liquidacion.salud_monto or 0) + (liquidacion.seguro_cesantia or 0) + (liquidacion.impuesto_unico or 0),
                'total_otros_dsctos': (liquidacion.anticipo_quincena or 0) + sum(int(i.get('valor', 0)) for i in det_otros if isinstance(i, dict)),
                'es_plan_semilla': es_plan_semilla,
            }
            html_string = render_to_string('liquidacion.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Liquidacion_{hoy.month}_{hoy.year}_{empleado.rut}')
            liquidacion.archivo_pdf.save(
                f"Liquidacion_{hoy.month}_{hoy.year}_{empleado.rut}.pdf", ContentFile(pdf_bytes)
            )
            return pdf_bytes

        # --- LÓGICA PARA LIQUIDACIONES HISTÓRICAS ---
        elif tipo_documento.startswith('liquidacion_historica_'):
            _, _, mes_str, anio_str = tipo_documento.split('_')
            mes_hist, anio_hist = int(mes_str), int(anio_str)

            try:
                liquidacion = Liquidacion.objects.get(empleado=empleado, mes=mes_hist, anio=anio_hist)
            except Liquidacion.DoesNotExist:
                raise Exception(f"No existe liquidación {mes_hist}/{anio_hist} para {empleado.nombres}.")
            if liquidacion.archivo_pdf:
                try:
                    return liquidacion.archivo_pdf.read()
                except Exception:
                    pass

            try:
                liquido_palabras = num2words(liquidacion.sueldo_liquido, lang='es')
            except Exception:
                liquido_palabras = str(liquidacion.sueldo_liquido)
            contrato_liq = Contrato.objects.filter(empleado=empleado).first()
            meses_liq = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
            agrupados = liquidacion.items_agrupados
            det_no_imp = agrupados['no_imponibles']
            det_otros = agrupados['descuentos']
            context = {
                'empleado': empleado, 'empresa': empresa,
                'liquidacion': liquidacion, 'contrato': contrato_liq,
                'mes_nombre': meses_liq[liquidacion.mes - 1].upper(),
                'liquido_palabras': liquido_palabras,
                'total_no_imponible': sum(int(i.get('valor', 0)) for i in det_no_imp if isinstance(i, dict)),
                'total_ley': (liquidacion.afp_monto or 0) + (liquidacion.salud_monto or 0) + (liquidacion.seguro_cesantia or 0) + (liquidacion.impuesto_unico or 0),
                'total_otros_dsctos': (liquidacion.anticipo_quincena or 0) + sum(int(i.get('valor', 0)) for i in det_otros if isinstance(i, dict)),
                'es_plan_semilla': es_plan_semilla,
            }
            html_string = render_to_string('liquidacion.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Liquidacion_{mes_hist}_{anio_hist}_{empleado.rut}')
            liquidacion.archivo_pdf.save(
                f"Liquidacion_{mes_hist}_{anio_hist}_{empleado.rut}.pdf", ContentFile(pdf_bytes)
            )
            return pdf_bytes

        # --- LÓGICA PARA CARTAS DE AMONESTACIÓN ---
        elif tipo_documento == 'amonestacion':
            doc_legal = DocumentoLegal.objects.filter(
                empleado=empleado, tipo='AMONESTACION'
            ).order_by('-fecha_emision').first()
            if doc_legal is None:
                raise Exception(f"El trabajador {empleado.nombres} no tiene amonestaciones registradas.")
            if doc_legal.archivo_pdf:
                try:
                    return doc_legal.archivo_pdf.read()
                except Exception:
                    pass

            pdf_bytes = self._pdf_para_documento_legal(doc_legal, es_plan_semilla)
            doc_legal.archivo_pdf.save(f"Amonestacion_{empleado.rut}.pdf", ContentFile(pdf_bytes))
            return pdf_bytes

        raise Exception(f"Tipo de documento no soportado: '{tipo_documento}'")
    
    # ====================================================
    # HELPERS PDF PARA DOCUMENTOS LEGALES Y ANEXOS
    # ====================================================
    def _pdf_para_documento_legal(self, doc, es_plan_semilla):
        empleado = doc.empleado
        empresa = empleado.empresa
        meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
        hoy = doc.fecha_emision
        fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
        ciudad = str(getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()
        context = {
            'documento': doc, 'empleado': empleado, 'empresa': empresa,
            'fecha_actual': fecha_espanol, 'ciudad': ciudad,
            'es_plan_semilla': es_plan_semilla,
        }
        if doc.tipo == 'DESPIDO':
            codigo = doc.causal_articulo or ''
            causal_label, causal_descripcion, requiere_indemnizacion = self._CAUSAL_INFO.get(
                codigo, (doc.causal_legal or '—', '', False)
            )
            def _fmt(v):
                return f'$ {v:,}'.replace(',', '.') if v else '$ 0'
            fecha_ult = None
            if doc.fecha_ultimo_dia:
                f = doc.fecha_ultimo_dia
                fecha_ult = f"{f.day:02d} de {meses[f.month - 1]} de {f.year}"
            try:
                contrato_cargo = doc.empleado.contrato.cargo
            except Exception:
                contrato_cargo = None
            context.update({
                'causal_label': causal_label,
                'causal_descripcion': causal_descripcion,
                'requiere_indemnizacion': requiere_indemnizacion,
                'monto_anos_texto': _fmt(doc.monto_indemnizacion_anos or 0),
                'monto_sustitutiva_texto': _fmt(doc.monto_indemnizacion_sustitutiva or 0),
                'monto_total_texto': _fmt((doc.monto_indemnizacion_anos or 0) + (doc.monto_indemnizacion_sustitutiva or 0)),
                'fecha_ultimo_dia_texto': fecha_ult,
                'contrato_cargo': contrato_cargo,
            })
            html = render_to_string('carta_despido.html', context)
        else:
            html = render_to_string('documento_legal.html', context)
        return self._html_a_pdf(html, f'{doc.tipo}_{empleado.rut}_{doc.fecha_emision}')

    def _pdf_para_anexo_contrato(self, anexo, es_plan_semilla):
        contrato = anexo.contrato
        empleado = contrato.empleado
        empresa = empleado.empresa
        meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
        hoy = anexo.fecha_emision
        fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
        ciudad = str(getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()
        context = {
            'anexo': anexo, 'contrato': contrato, 'empleado': empleado, 'empresa': empresa,
            'fecha_actual': fecha_espanol, 'ciudad': ciudad,
            'es_plan_semilla': es_plan_semilla,
        }
        html = render_to_string('anexo_contrato.html', context)
        return self._html_a_pdf(html, f'AnexoContrato_{empleado.rut}_{hoy}')

    # ====================================================
    # ENDPOINT: DESCARGA MASIVA Y EXPEDIENTES (ZIP)
    # ====================================================
    @action(detail=False, methods=['post'])
    def descarga_masiva(self, request):
        """
        POST body:
          empleados: [id, ...]
          empresa_id: int
          documentos: lista de tipos a incluir:
            'contrato', 'anexo_40h', 'liquidaciones',
            'amonestaciones', 'despidos', 'mutuo_acuerdo',
            'constancias', 'anexos_contrato'
          cantidad_liquidaciones: int (cuántas liquidaciones recientes incluir)
        """
        try:
            empleados_ids = request.data.get('empleados', [])
            empresa_id = request.data.get('empresa_id')
            documentos = request.data.get('documentos', [])
            cantidad_liquidaciones = int(request.data.get('cantidad_liquidaciones', 1))

            if not empleados_ids or not empresa_id:
                return Response({'error': 'Faltan IDs de trabajadores o empresa'}, status=400)
            if not documentos:
                return Response({'error': 'Debes seleccionar al menos un tipo de documento'}, status=400)

            MAX_EMPLEADOS_ZIP = 50
            if len(empleados_ids) > MAX_EMPLEADOS_ZIP:
                return Response({'error': f'Máximo {MAX_EMPLEADOS_ZIP} trabajadores por descarga. Divide la selección en grupos.'}, status=400)

            MAX_LIQUIDACIONES_ZIP = 12
            cantidad_liquidaciones = min(cantidad_liquidaciones, MAX_LIQUIDACIONES_ZIP)

            if not _plan_permite(request.user, 3):
                return Response({'error': 'La descarga masiva de expedientes en ZIP está disponible desde el plan Pyme. Mejora tu suscripción para acceder.'}, status=403)

            empresa = Empresa.objects.get(id=empresa_id, owner=request.user)
            empleados = Empleado.objects.filter(id__in=empleados_ids, empresa=empresa)
            if not empleados.exists():
                return Response({'error': 'No se encontraron trabajadores válidos'}, status=404)

            es_semilla = False  # ya verificado arriba
            meses_corto = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
            zip_buffer = io.BytesIO()

            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for emp in empleados:
                    rut_limpio = emp.rut.replace("-", "").replace(".", "")
                    carpeta = f"{rut_limpio}_{emp.nombres}_{emp.apellido_paterno}".replace(" ", "_")

                    if 'contrato' in documentos:
                        try:
                            pdf = self._obtener_o_generar_documento(emp, 'contrato', request.user)
                            zip_file.writestr(f"{carpeta}/Contrato.pdf", pdf)
                        except Exception:
                            pass

                    if 'anexo_40h' in documentos:
                        try:
                            pdf = self._obtener_o_generar_documento(emp, 'anexo_40h', request.user)
                            zip_file.writestr(f"{carpeta}/Anexo_Ley_40h.pdf", pdf)
                        except Exception:
                            pass

                    if 'liquidaciones' in documentos and cantidad_liquidaciones > 0:
                        liq_qs = Liquidacion.objects.filter(empleado=emp).order_by('-anio', '-mes')[:cantidad_liquidaciones]
                        for liq in liq_qs:
                            try:
                                pdf = self._obtener_o_generar_documento(emp, f'liquidacion_historica_{liq.mes}_{liq.anio}', request.user)
                                zip_file.writestr(f"{carpeta}/Liquidaciones/Liq_{meses_corto[liq.mes - 1]}_{liq.anio}.pdf", pdf)
                            except Exception:
                                pass

                    if 'amonestaciones' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='AMONESTACION').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Amonestaciones/Amonestacion_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'despidos' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='DESPIDO').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Terminos_Contrato/Termino_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'mutuo_acuerdo' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='MUTUO_ACUERDO').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Renuncias/Renuncia_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'constancias' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='CONSTANCIA').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Constancias/Constancia_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'anexos_contrato' in documentos:
                        contrato_emp = Contrato.objects.filter(empleado=emp).first()
                        if contrato_emp:
                            for anexo in AnexoContrato.objects.filter(contrato=contrato_emp).order_by('fecha_emision'):
                                try:
                                    pdf = self._pdf_para_anexo_contrato(anexo, es_semilla)
                                    titulo_corto = anexo.titulo[:30].replace(" ", "_")
                                    zip_file.writestr(f"{carpeta}/Anexos_Contrato/Anexo_{anexo.fecha_emision}_{titulo_corto}.pdf", pdf)
                                except Exception:
                                    pass

            zip_buffer.seek(0)
            nombre_zip = f"Expedientes_{empresa.nombre_legal.replace(' ', '_')}_{datetime.date.today()}.zip"
            response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="{nombre_zip}"'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response

        except Exception:
            logger.exception('Error al generar ZIP de expedientes')
            return Response({'error': 'Error al generar el ZIP. Inténtalo de nuevo.'}, status=500)
        

    @action(detail=False, methods=['post'])
    def descargar_anexos_zip(self, request):

        if not _plan_permite(request.user, 3):
            return Response(
                {'error': 'La descarga masiva de expedientes en ZIP está disponible desde el plan Pyme. Mejora tu suscripción para acceder.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        empleado_ids = request.data.get('empleados', [])

        if not empleado_ids:
            return Response({'error': 'No se seleccionaron trabajadores'}, status=status.HTTP_400_BAD_REQUEST)

        MAX_EMPLEADOS_ZIP = 50
        if len(empleado_ids) > MAX_EMPLEADOS_ZIP:
            return Response({'error': f'Máximo {MAX_EMPLEADOS_ZIP} trabajadores por descarga. Divide la selección en grupos.'}, status=status.HTTP_400_BAD_REQUEST)
        
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for emp_id in empleado_ids:
                try:
                    empleado = Empleado.objects.get(id=emp_id, empresa__owner=request.user)
                    empresa = empleado.empresa
                    
                    contrato = Contrato.objects.filter(empleado=empleado).first()
                    if not contrato:
                        try: s_base = int(str(empleado.sueldo_base).strip()) if empleado.sueldo_base else 0
                        except: s_base = 0
                        
                        f_inicio = empleado.fecha_ingreso if isinstance(empleado.fecha_ingreso, datetime.date) else datetime.date.today()
                        c_cargo = str(empleado.cargo).strip().upper() if empleado.cargo else 'NO ESPECIFICADO'
                        
                        try:
                            contrato = Contrato.objects.create(
                                empleado=empleado,
                                tipo_contrato='INDEFINIDO',
                                fecha_inicio=f_inicio,
                                sueldo_base=s_base,
                                cargo=c_cargo
                            )
                        except Exception as e:
                            print(f"Aviso BD Contrato - Creando virtual para {empleado.rut}: {e}")
                            class ContratoVirtual:
                                pass
                            contrato = ContratoVirtual()
                            contrato.sueldo_base = s_base

                    meses_zip = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
                    hoy_zip = datetime.date.today()
                    fecha_zip = f"{hoy_zip.day:02d} de {meses_zip[hoy_zip.month - 1]} de {hoy_zip.year}"
                    ciudad_zip = str(
                        getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or
                        getattr(empleado, 'comuna', '') or 'Santiago'
                    ).strip().title()
                    context = {
                        'contrato': contrato,
                        'empleado': empleado,
                        'empresa': empresa,
                        'fecha_actual': fecha_zip,
                        'ciudad': ciudad_zip,
                        'es_plan_semilla': _es_plan_semilla(request.user),
                    }

                    template = get_template('anexo_40h.html')
                    html = template.render(context)
                    
                    pdf_buffer = io.BytesIO()
                    pisa_status = pisa.CreatePDF(html, dest=pdf_buffer)
                    
                    if not pisa_status.err:
                        nombre_archivo = f"Anexo_40h_{empleado.rut}.pdf"
                        zip_file.writestr(nombre_archivo, pdf_buffer.getvalue())
                        
                except Exception as e:
                    print(f"Error fatal saltando empleado {emp_id} en ZIP: {e}")
                    continue 
        
        zip_buffer.seek(0)
        response = HttpResponse(zip_buffer, content_type='application/zip')
        response['Content-Disposition'] = 'attachment; filename="Anexos_Masivos_40h.zip"'
        return response

    @action(detail=True, methods=['post'], url_path='digitalizar_contrato')
    def digitalizar_contrato(self, request, pk=None):
        from .extractor_contrato import extraer_campos_contrato

        archivo = request.FILES.get('file')
        if not archivo:
            return Response({'error': 'No se recibió ningún archivo.'}, status=400)

        MIME_PERMITIDOS = {
            'application/pdf': 'application/pdf',
            'image/jpeg':      'image/jpeg',
            'image/png':       'image/png',
        }
        mime = archivo.content_type or ''
        if mime not in MIME_PERMITIDOS:
            return Response(
                {'error': 'Formato no soportado. Sube un PDF, JPG o PNG.'},
                status=400,
            )

        LIMITE_BYTES = 20 * 1024 * 1024  # 20 MB
        if archivo.size > LIMITE_BYTES:
            return Response({'error': 'El archivo supera el límite de 20 MB.'}, status=400)

        try:
            campos = extraer_campos_contrato(archivo.read(), mime)
        except RuntimeError as e:
            return Response({'error': str(e)}, status=502)
        except Exception as e:
            return Response(
                {'error': f'Error inesperado al analizar el documento: {e}'},
                status=500,
            )

        return Response(campos)


class ContratoViewSet(viewsets.ModelViewSet):
    serializer_class = ContratoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Contrato.objects.filter(empleado__empresa__owner=self.request.user)
        empleado_id = self.request.query_params.get('empleado')
        if empleado_id:
            queryset = queryset.filter(empleado_id=empleado_id)
        return queryset

    def _build_contrato_context(self, contrato, es_plan_semilla):
        return _ctx_contrato(contrato, es_plan_semilla)

    def perform_create(self, serializer):
        self._guardar_normalizando(serializer)

    def perform_update(self, serializer):
        contrato = self._guardar_normalizando(serializer)
        # Los PDF guardados reflejan las condiciones anteriores: se descartan
        # y se vuelven a generar al descargarlos.
        for archivo in (contrato.archivo_contrato, contrato.archivo_anexo_40h):
            if archivo:
                archivo.delete(save=False)
        contrato.save(update_fields=['archivo_contrato', 'archivo_anexo_40h'])

    def _pdf_de_contrato(self, contrato, plantilla, campo, nombre):
        """Genera y guarda el PDF del contrato o del anexo 40h; devuelve sus bytes."""
        context = self._build_contrato_context(contrato, _es_plan_semilla(self.request.user))
        pdf_buf = io.BytesIO()
        if pisa.CreatePDF(get_template(plantilla).render(context), dest=pdf_buf).err:
            raise ValueError('Error al generar el PDF.')
        archivo = getattr(contrato, campo)
        if archivo:
            archivo.delete(save=False)
        getattr(contrato, campo).save(nombre, ContentFile(pdf_buf.getvalue()), save=True)
        return pdf_buf.getvalue()

    def _guardar_normalizando(self, serializer):
        """Resuelve las categorías de comisión a conceptos del catálogo."""
        contrato = serializer.save()
        config = _normalizar_comisiones_config(
            contrato.comisiones_config, contrato.empleado.empresa)
        if config != contrato.comisiones_config:
            contrato.comisiones_config = config
            contrato.save(update_fields=['comisiones_config'])
        return contrato

    @action(detail=False, methods=['post'], url_path='evaluar-jornada')
    def evaluar_jornada(self, request):
        """Avisos de jornada para un contrato que se está editando.

        El formulario lo llama mientras el usuario escribe, para mostrar los
        incumplimientos antes de guardar. Solo informa: guardar un contrato que
        incumple sigue permitido, la decisión es del usuario.
        """
        datos = request.data
        return Response({
            'jornada_maxima_vigente': jornada_maxima_vigente(),
            'avisos': avisos_jornada(
                datos.get('tipo_jornada'),
                datos.get('horas_semanales'),
                datos.get('distribucion_horario'),
            ),
        })

    @action(detail=True, methods=['post'])
    def generar_contrato_pdf(self, request, pk=None):
        try:
            contrato = self.get_object()
            es_plan_semilla = _es_plan_semilla(request.user)
            context = self._build_contrato_context(contrato, es_plan_semilla)
            html = get_template('contrato_trabajo.html').render(context)
            pdf_buf = io.BytesIO()
            pisa_status = pisa.CreatePDF(html, dest=pdf_buf)
            if pisa_status.err:
                return Response({'error': 'Error al generar el PDF.'}, status=500)
            if contrato.archivo_contrato:
                contrato.archivo_contrato.delete(save=False)
            nombre = f"Contrato_{contrato.empleado.rut}.pdf"
            contrato.archivo_contrato.save(nombre, ContentFile(pdf_buf.getvalue()), save=True)
            return Response({'ok': True, 'mensaje': 'Contrato generado y guardado exitosamente.'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def descargar_contrato(self, request, pk=None):
        try:
            contrato = self.get_object()
            nombre = f"Contrato_{contrato.empleado.rut}.pdf"
            # Sin PDF guardado (nuevo o recién editado) se genera en el momento.
            datos = (contrato.archivo_contrato.read() if contrato.archivo_contrato
                     else self._pdf_de_contrato(contrato, 'contrato_trabajo.html', 'archivo_contrato', nombre))
            response = HttpResponse(datos, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{nombre}"'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def generar_anexo_40h(self, request, pk=None):
        try:
            contrato = self.get_object()
            es_plan_semilla = _es_plan_semilla(request.user)
            context = self._build_contrato_context(contrato, es_plan_semilla)
            html = get_template('anexo_40h.html').render(context)
            pdf_buf = io.BytesIO()
            pisa_status = pisa.CreatePDF(html, dest=pdf_buf)
            if pisa_status.err:
                return Response({'error': 'Error al generar el PDF.'}, status=500)
            if contrato.archivo_anexo_40h:
                contrato.archivo_anexo_40h.delete(save=False)
            nombre = f"Anexo_40h_{contrato.empleado.rut}.pdf"
            contrato.archivo_anexo_40h.save(nombre, ContentFile(pdf_buf.getvalue()), save=True)
            return Response({'ok': True, 'mensaje': 'Anexo 40h generado y guardado exitosamente.'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def descargar_anexo_40h(self, request, pk=None):
        try:
            contrato = self.get_object()
            nombre = f"Anexo_40h_{contrato.empleado.rut}.pdf"
            datos = (contrato.archivo_anexo_40h.read() if contrato.archivo_anexo_40h
                     else self._pdf_de_contrato(contrato, 'anexo_40h.html', 'archivo_anexo_40h', nombre))
            response = HttpResponse(datos, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{nombre}"'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Mantener compatibilidad con descarga masiva ZIP (sin guardar)
    @action(detail=True, methods=['get'])
    def generar_anexo(self, request, pk=None):
        try:
            contrato = self.get_object()
            es_plan_semilla = _es_plan_semilla(request.user)
            context = self._build_contrato_context(contrato, es_plan_semilla)
            html = get_template('anexo_40h.html').render(context)
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Anexo_40h_{contrato.empleado.rut}.pdf"'
            pisa.CreatePDF(html, dest=response)
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
# ==========================================
# LOGIN CON RATE LIMITING
# ==========================================
from dj_rest_auth.views import LoginView as DjRestLoginView

class ThrottledLoginView(DjRestLoginView):
    throttle_classes = [LoginRateThrottle, LoginAccountRateThrottle]

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def indicadores_del_dia(request):
    """UF, UTM y jornada máxima vigente para el encabezado del panel.

    `respaldo` avisa si mindicador.cl no respondió y se usan los valores de
    respaldo del código.
    """
    from .indicadores import estado_indicadores
    return Response({
        'fecha': timezone.localdate().isoformat(),
        'uf': obtener_uf(),
        'utm': obtener_utm(),
        'jornada_maxima_vigente': jornada_maxima_vigente(),
        'respaldo': bool(estado_indicadores()),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def parametros_vigentes(request):
    """Parámetros previsionales con que se calcula hoy, solo lectura.

    Son comunes a todos los clientes: los mantiene Jornada40 en el admin y no
    se confirman ni se editan desde el panel.
    """
    hoy = timezone.localdate()
    fila = _fila_parametros(_fecha_referencia(hoy.month, hoy.year))
    p = _parametros_previsionales(hoy.month, hoy.year)
    return Response({
        'periodo': f'{hoy.year}-{hoy.month:02d}',
        'vigente_desde': fila.vigente_desde.isoformat() if fila else None,
        'origen': fila.get_origen_display() if fila else 'Valores de respaldo del sistema',
        'ingreso_minimo_mensual': int(p['ingreso_minimo_mensual']),
        'tope_imponible_afp_uf': p['tope_imponible_afp_uf'],
        'tope_imponible_afc_uf': p['tope_imponible_afc_uf'],
        'tope_gratificacion_mensual': math.floor(p['factor_gratificacion'] * p['ingreso_minimo_mensual'] / 12),
        'tasa_salud': p['tasa_salud'],
        'tasa_afc_trabajador_indefinido': p['tasa_afc_trabajador_indefinido'],
        'tasa_afc_empleador_indefinido': p['tasa_afc_empleador_indefinido'],
        'tasa_afc_empleador_plazo': p['tasa_afc_empleador_plazo'],
        'tasa_sis': p['tasa_sis'],
        'tasas_afp': _tasas_afp(hoy.month, hoy.year),
        'uf': obtener_uf(),
        'utm': obtener_utm(),
        'jornada_maxima_vigente': jornada_maxima_vigente(),
        'advertencias': advertencias_parametros(hoy.month, hoy.year),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def diagnostico_red(request):
    """Muestra la cadena de proxies con que llega una solicitud. Apagado por defecto.

    El límite de intentos identifica al cliente por IP. Sin NUM_PROXIES, DRF
    usa el encabezado X-Forwarded-For completo, que el cliente puede escribir:
    cambiándolo en cada intento se esquiva el límite por IP. Para fijar
    NUM_PROXIES hay que saber cuántos proxies agregan su IP en producción
    (Vercel → Railway), y un valor mal puesto haría que todos los usuarios
    compartan un mismo límite.

    Se enciende con DIAGNOSTICO_RED=1 en Railway, se consulta una vez y se
    apaga. Solo devuelve los encabezados del propio solicitante.
    """
    if config('DIAGNOSTICO_RED', default='0') != '1':
        return Response(status=status.HTTP_404_NOT_FOUND)
    return Response({
        'remote_addr': request.META.get('REMOTE_ADDR'),
        'x_forwarded_for': request.headers.get('x-forwarded-for'),
        'x_real_ip': request.headers.get('x-real-ip'),
        'x_vercel_forwarded_for': request.headers.get('x-vercel-forwarded-for'),
        # Cloudflare (proxy delante de api.jornada40.cl) informa aquí la IP del visitante.
        'cf_connecting_ip': request.headers.get('cf-connecting-ip'),
        'true_client_ip': request.headers.get('true-client-ip'),
        'cf_ray': request.headers.get('cf-ray'),
        'host': request.get_host(),
        'ident_actual_drf': AnonRateThrottle().get_ident(request),
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def recuperacion_por_correo_cerrada(request):
    """La recuperación por correo quedó cerrada: se recupera solo por RUT.

    El correo no identifica a una cuenta (puede repetirse entre cuentas).
    Se responde 410 en vez de dejar activa la ruta de dj-rest-auth.
    """
    return Response({'error': 'La recuperación de contraseña es solo por RUT: usa /api/auth/recuperar-por-rut/.'},
                    status=status.HTTP_410_GONE)


# ==========================================
# REGISTRO DE NUEVOS CLIENTES
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterRateThrottle, RegisterAccountRateThrottle])
def registrar_cliente(request):
    rut = (request.data.get('rut') or '').strip()
    password = request.data.get('password')
    # Atrapamos el correo (por si React lo manda como 'email' o como 'correo')
    email = request.data.get('email') or request.data.get('correo')
    nombres=request.data.get('nombres', '')
    apellido_paterno = request.data.get('apellido_paterno', '')
    apellido_materno = request.data.get('apellido_materno', '')
    # El modelo ya tenía estos campos pero el registro los descartaba: el
    # formulario enviaba tipo_cliente y siempre quedaba PERSONA.
    tipo_cliente = request.data.get('tipo_cliente', 'PERSONA')
    if tipo_cliente not in dict(Cliente.TIPO_CLIENTE_CHOICES):
        tipo_cliente = 'PERSONA'
    razon_social = (request.data.get('razon_social') or '').strip() if tipo_cliente == 'EMPRESA' else ''
    telefono = (request.data.get('telefono') or '').strip()[:20]

    # Validaciones básicas
    # La razón social se exige en el formulario, no aquí: el registro anterior
    # envía EMPRESA por defecto sin razón social, y Railway y Vercel despliegan
    # por separado. Exigirla aquí rompería el registro mientras conviven.
    if not rut or not password or not email:
        return Response({'error': 'Faltan datos obligatorios (RUT, contraseña o correo)'}, status=400)

    # El servidor valida lo mismo que el formulario: nada impide llamar a la
    # API directamente, y el RUT es el usuario con que se inicia sesión.
    if not validar_rut(rut):
        return Response({'error': 'El RUT no es válido: revisa el dígito verificador.'}, status=400)
    # Un solo formato guardado (12.345.678-5): es el que busca el login.
    rut = formatear_rut(rut)
    if not es_rut_de_persona(rut):
        return Response({'error': (
            'Ese RUT corresponde a una empresa. Regístrate con tu RUT personal: '
            'las empresas se agregan después, desde tu cuenta.'
        )}, status=400)
    try:
        validate_email(email)
    except DjangoValidationError:
        return Response({'error': 'El correo no es válido.'}, status=400)
    try:
        validate_password(password, user=User(username=rut, email=email, first_name=nombres))
    except DjangoValidationError as exc:
        return Response({'error': ' '.join(exc.messages)}, status=400)

    try:
        with transaction.atomic():
            # 1. Creamos el acceso en la tabla core_users (User de Django)
            user = User.objects.create_user(
                username=rut, 
                password=password,
                email=email
            )

            plan_semilla, creado = Plan.objects.get_or_create(
                nombre='Semilla',
                defaults={
                    'max_empresas': 1,
                    'limite_trabajadores': 3,
                    'precio': 0,
                    'nivel': 1,
                    'activo': True,
                }
            )
            if not creado and plan_semilla.nivel != 1:
                plan_semilla.nivel = 1
                plan_semilla.save(update_fields=['nivel'])
            
            # 2. Creamos el perfil en core_cliente 
            cliente = Cliente.objects.create(
                usuario=user,
                rut=rut,
                correo=email,
                nombres=nombres,
                apellido_paterno=apellido_paterno,
                apellido_materno=apellido_materno,
                tipo_cliente=tipo_cliente,
                razon_social=razon_social or None,
                telefono=telefono or None,
                plan=plan_semilla  # Asignamos el plan "Semilla" por defecto (usando el objeto obtenido o creado arriba
            )
            user.first_name = nombres
            user.last_name = f"{apellido_paterno} {apellido_materno}".strip()
            user.save(update_fields=['first_name', 'last_name'])

            # La suscripción nace con la cuenta. Antes solo se creaba al abrir
            # la página de suscripción, y el webhook de Reveniu (que actualiza
            # una suscripción existente) fallaba si el pago llegaba antes.
            Suscripcion.objects.create(cliente=cliente, plan=plan_semilla, estado='ACTIVE')
            
           
        return Response({'mensaje': 'Cliente creado con éxito'}, status=201)
        
    except IntegrityError:
        return Response({'error': 'Este RUT ya está registrado en el sistema.'}, status=400)
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    
# Campos del contrato que un anexo puede modificar. Todo lo que no esté acá
# se ignora, aunque venga en el JSON: evita que un payload manipulado cambie
# el empleado dueño del contrato o campos que no corresponden a un anexo.
_CAMPOS_ANEXO_APLICABLES = {
    'cargo':               str,
    'sueldo_base':         int,
    'tipo_jornada':        str,
    'horas_semanales':     float,
    'gratificacion_legal': str,
    'es_comisionista':     bool,
    'comisiones_config':   list,
    'tiene_quincena':      bool,
    'dia_quincena':        int,
    'monto_quincena':      int,
}

_ETIQUETAS_CAMPOS_ANEXO = {
    'cargo':               'Cargo',
    'sueldo_base':         'Sueldo base',
    'tipo_jornada':        'Tipo de jornada',
    'horas_semanales':     'Horas semanales',
    'gratificacion_legal': 'Gratificación legal',
    'es_comisionista':     'Remuneración por comisiones',
    'comisiones_config':   'Comisiones por venta',
    'tiene_quincena':      'Anticipo quincenal',
    'dia_quincena':        'Día de la quincena',
    'monto_quincena':      'Monto de la quincena',
}


def _formatear_valor_anexo(campo, valor) -> str:
    """Representación legible de un valor para la cláusula del anexo."""
    if campo == 'comisiones_config':
        if not valor:
            return 'sin comisiones'
        ids = [c.get('concepto') for c in valor if c.get('concepto')]
        nombres = {c.id: c.nombre
                   for c in ConceptoRemuneracion.objects.filter(id__in=ids)}
        return ', '.join(
            f"{nombres.get(c.get('concepto'), c.get('glosa', ''))} "
            f"{c.get('porcentaje', 0)}%" for c in valor
        )
    if isinstance(valor, bool):
        return 'Sí' if valor else 'No'
    if campo in ('sueldo_base', 'monto_quincena') and valor:
        return f"${int(valor):,}".replace(',', '.')
    return str(valor)


def _clausulas_desde_cambios(anexo, contrato) -> list:
    """Genera el texto de las cláusulas a partir de los cambios estructurados.

    Se antepone a las cláusulas de texto libre que haya escrito el empleador,
    para que el PDF refleje siempre lo que el anexo modifica de verdad.
    """
    cambios = anexo.cambios or {}
    if not cambios:
        return []

    desde = anexo.vigencia_desde or anexo.fecha_emision
    fecha_txt = f"{desde.day:02d} de {_MESES[desde.month - 1]} de {desde.year}"

    clausulas = []
    for campo, valor_nuevo in cambios.items():
        if campo not in _CAMPOS_ANEXO_APLICABLES:
            continue
        etiqueta = _ETIQUETAS_CAMPOS_ANEXO.get(campo, campo)
        anterior = _formatear_valor_anexo(campo, getattr(contrato, campo, None))
        nuevo = _formatear_valor_anexo(campo, valor_nuevo)
        clausulas.append(
            f"{etiqueta}: se modifica de «{anterior}» a «{nuevo}», "
            f"con vigencia a contar del {fecha_txt}."
        )
    return clausulas


def _aplicar_anexo_a_contrato(anexo) -> bool:
    """Traspasa los cambios del anexo al contrato. Se llama al firmarse.

    Retorna True si aplicó algo. Es idempotente: un anexo ya aplicado no
    vuelve a tocar el contrato.
    """
    if anexo.aplicado or not anexo.cambios:
        return False

    contrato = anexo.contrato
    campos_actualizados = []

    for campo, valor in anexo.cambios.items():
        tipo = _CAMPOS_ANEXO_APLICABLES.get(campo)
        if tipo is None:
            continue
        try:
            if tipo is bool:
                valor_limpio = bool(valor)
            elif tipo is list:
                valor_limpio = list(valor or [])
            elif valor is None or valor == '':
                continue
            else:
                valor_limpio = tipo(valor)
        except (TypeError, ValueError):
            continue
        if campo == 'comisiones_config':
            valor_limpio = _normalizar_comisiones_config(
                valor_limpio, contrato.empleado.empresa)
        setattr(contrato, campo, valor_limpio)
        campos_actualizados.append(campo)

    if not campos_actualizados:
        return False

    contrato.save(update_fields=campos_actualizados)
    anexo.aplicado = True
    anexo.aplicado_en = timezone.now()
    anexo.save(update_fields=['aplicado', 'aplicado_en'])
    return True


class ConceptoRemuneracionViewSet(viewsets.ModelViewSet):
    """Catálogo de haberes y descuentos disponible para el usuario.

    Devuelve los conceptos del sistema más los propios de sus empresas. Los
    del sistema son de solo lectura: una empresa no puede alterar la
    naturaleza previsional de un concepto compartido.
    """
    serializer_class = ConceptoRemuneracionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = ConceptoRemuneracion.objects.filter(
            Q(empresa__isnull=True) | Q(empresa__owner=self.request.user)
        )
        # Los inactivos se ocultan del listado, pero el detalle los incluye:
        # si no, un concepto desactivado no se podía volver a activar.
        if self.action == 'list' and self.request.query_params.get('incluir_inactivos') != 'true':
            qs = qs.filter(activo=True)
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)
        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(Q(empresa__isnull=True) | Q(empresa_id=empresa_id))
        return qs

    def perform_create(self, serializer):
        empresa = serializer.validated_data.get('empresa')
        if empresa is None:
            raise ValidationError(
                {'empresa': 'Un concepto propio debe pertenecer a una empresa. '
                            'El catálogo del sistema no se edita desde aquí.'})
        if empresa.owner_id != self.request.user.id:
            raise ValidationError({'empresa': 'Empresa no encontrada.'})
        serializer.save()

    def _rechazar_si_es_del_sistema(self, instancia):
        if instancia.empresa_id is None:
            return Response(
                {'error': 'Los conceptos del catálogo del sistema no se pueden '
                          'modificar ni eliminar. Crea uno propio si necesitas '
                          'una variante.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def update(self, request, *args, **kwargs):
        return (self._rechazar_si_es_del_sistema(self.get_object())
                or super().update(request, *args, **kwargs))

    def destroy(self, request, *args, **kwargs):
        instancia = self.get_object()
        rechazo = self._rechazar_si_es_del_sistema(instancia)
        if rechazo:
            return rechazo
        # Desactivar en vez de borrar: las liquidaciones ya emitidas lo
        # referencian y deben poder seguir mostrándolo.
        instancia.activo = False
        instancia.save(update_fields=['activo'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class AnexoContratoViewSet(viewsets.ModelViewSet):
    serializer_class = AnexoContratoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = AnexoContrato.objects.filter(
            contrato__empleado__empresa__owner=self.request.user
        ).order_by('-fecha_emision')
        empleado_id = self.request.query_params.get('empleado')
        if empleado_id:
            queryset = queryset.filter(contrato__empleado_id=empleado_id)
        return queryset

    def create(self, request, *args, **kwargs):
        contrato_id = request.data.get('contrato')
        try:
            Contrato.objects.get(id=contrato_id, empleado__empresa__owner=request.user)
        except Contrato.DoesNotExist:
            return Response({'error': 'Contrato no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if self.get_object().aplicado:
            return Response(
                {'error': 'Este anexo ya fue firmado y sus cambios se aplicaron al contrato; no puede modificarse.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if self.get_object().aplicado:
            return Response(
                {'error': 'Este anexo ya fue firmado y sus cambios se aplicaron al contrato; no puede eliminarse.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        anexo = serializer.save()

        # Las cláusulas del cambio estructurado se materializan al crear el
        # anexo, cuando el contrato todavía tiene los valores anteriores: así
        # el documento deja constancia del "de X a Y" tal como era en ese momento.
        generadas = _clausulas_desde_cambios(anexo, anexo.contrato)
        if generadas:
            anexo.clausulas_modificadas = generadas + list(anexo.clausulas_modificadas or [])
            anexo.save(update_fields=['clausulas_modificadas'])

        try:
            contrato = anexo.contrato
            empleado = contrato.empleado
            empresa = empleado.empresa
            es_plan_semilla = _es_plan_semilla(self.request.user)
            meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
            fecha_obj = anexo.fecha_emision
            fecha_espanol = f"{fecha_obj.day:02d} de {meses[fecha_obj.month - 1]} de {fecha_obj.year}"
            ciudad = str(getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()
            context = {
                'anexo': anexo, 'contrato': contrato, 'empleado': empleado,
                'empresa': empresa, 'fecha_actual': fecha_espanol,
                'ciudad': ciudad, 'es_plan_semilla': es_plan_semilla,
            }
            html = get_template('anexo_contrato.html').render(context)
            pdf_buf = io.BytesIO()
            pisa_status = pisa.CreatePDF(html, dest=pdf_buf)
            if not pisa_status.err and pdf_buf.getvalue():
                nombre = f"AnexoContrato_{empleado.rut}_{anexo.fecha_emision}.pdf"
                anexo.archivo_pdf.save(nombre, ContentFile(pdf_buf.getvalue()), save=True)
        except Exception:
            pass  # No bloqueamos el guardado si el PDF falla

    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        try:
            anexo = self.get_object()
            contrato = anexo.contrato
            empleado = contrato.empleado
            empresa = empleado.empresa
            es_plan_semilla = _es_plan_semilla(request.user)

            meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
            hoy = anexo.fecha_emision
            fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
            ciudad = str(getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()

            context = {
                'anexo': anexo,
                'contrato': contrato,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': fecha_espanol,
                'ciudad': ciudad,
                'es_plan_semilla': es_plan_semilla,
            }
            template = get_template('anexo_contrato.html')
            html = template.render(context)

            response = HttpResponse(content_type='application/pdf')
            nombre = f"Anexo_{empleado.rut}_{hoy}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{nombre}"'
            pisa_status = pisa.CreatePDF(html, dest=response)
            if pisa_status.err:
                return Response({'error': 'Error generando PDF'}, status=500)
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=500)


# Respaldo si la tabla de parámetros está vacía (BD recién creada, antes del
# seed). Se mantienen al día con el último período cargado en migraciones: son
# lo que se aplica cuando todavía no hay filas, y quedarse atrás aquí produce
# liquidaciones con topes viejos sin que nada lo advierta.
_PARAMETROS_RESPALDO = {
    'tope_imponible_afp_uf': 90.00,
    'tope_imponible_afc_uf': 135.20,
    'ingreso_minimo_mensual': 553553,
    'factor_gratificacion': 4.75,
    'tasa_salud': 0.07,
    'tasa_afc_trabajador_indefinido': 0.006,
    'tasa_afc_empleador_indefinido': 0.024,
    'tasa_afc_empleador_plazo': 0.030,
    'tasa_sis': 0.0178,
    'tasa_mutual_base': 0.0093,
    'tasa_expectativa_vida': 0.0072,
    'tasa_rentabilidad_protegida': 0.009,
    'tasa_afp_empleador': 0.001,
    'tasa_afc_empleador_11_anios': 0.008,
}

_TASAS_AFP_RESPALDO = {
    'MODELO': 0.1058, 'HABITAT': 0.1127, 'PROVIDA': 0.1145,
    'CAPITAL': 0.1144, 'CUPRUM': 0.1144, 'PLANVITAL': 0.1116, 'UNO': 0.1046,
}


# Ley 19.728: desde el año 11 de un contrato indefinido el trabajador deja de
# cotizar al seguro de cesantía y el empleador paga una tasa menor.
_ANIOS_AFC_REDUCIDA = 11


def _anios_de_servicio(empleado, contrato, mes, anio) -> int:
    """Años completos de la relación laboral al último día del mes liquidado."""
    inicio = getattr(empleado, 'fecha_ingreso', None) or getattr(contrato, 'fecha_inicio', None)
    if not inicio:
        return 0
    if isinstance(inicio, str):
        inicio = datetime.date.fromisoformat(inicio)
    try:
        mes, anio = int(mes), int(anio)
    except (TypeError, ValueError):
        fin = datetime.date.today()
    else:
        fin = datetime.date(anio + (mes == 12), mes % 12 + 1, 1) - datetime.timedelta(days=1)
    return fin.year - inicio.year - ((fin.month, fin.day) < (inicio.month, inicio.day))


def _tasas_afc(parametros, tipo_contrato, anios_servicio) -> tuple:
    """(tasa trabajador, tasa empleador) del seguro de cesantía."""
    if tipo_contrato == 'INDEFINIDO':
        if anios_servicio >= _ANIOS_AFC_REDUCIDA:
            return 0.0, parametros['tasa_afc_empleador_11_anios']
        return parametros['tasa_afc_trabajador_indefinido'], parametros['tasa_afc_empleador_indefinido']
    return 0.0, parametros['tasa_afc_empleador_plazo']


def _tope_en_pesos(tope_uf, valor_uf) -> int:
    """Tope imponible del período llevado a pesos.

    Multiplicar dos floats y truncar pierde un peso cuando el producto cae
    apenas por debajo del entero: 90 × 41.057,20 da 3.695.147,999... en punto
    flotante y el tope quedaría en $3.695.147, uno menos que los $3.695.148 que
    publica Previred. Con Decimal el producto es exacto y el truncado coincide.
    """
    producto = Decimal(str(tope_uf)) * Decimal(str(valor_uf))
    return int(producto.to_integral_value(rounding=ROUND_FLOOR))


def _fecha_referencia(mes, anio) -> datetime.date:
    """Primer día del período liquidado; hoy si no viene informado."""
    try:
        return datetime.date(int(anio), int(mes), 1)
    except (TypeError, ValueError):
        return datetime.date.today()


def _parametros_previsionales(mes=None, anio=None) -> dict:
    """Parámetros legales que regían en el período de la liquidación.

    Resolver por período (y no por la fecha de hoy) es lo que permite que
    recalcular una liquidación antigua use los topes y el sueldo mínimo de su
    momento. Si no hay una fila anterior al período se usa la más antigua
    disponible, que es la mejor aproximación para liquidaciones previas.
    """
    fila = _fila_parametros(_fecha_referencia(mes, anio))
    if fila is None:
        return dict(_PARAMETROS_RESPALDO)

    return {campo: float(getattr(fila, campo)) for campo in _PARAMETROS_RESPALDO}


def _fila_parametros(referencia):
    """Fila de parámetros aplicable a una fecha, o None si no hay ninguna.

    Las propuestas automáticas sin confirmar quedan fuera: existen para que
    alguien las revise, no para cambiar liquidaciones por su cuenta.
    """
    aplicables = ParametroPrevisional.objects.exclude(origen='PREVIRED', confirmado=False)
    fila = (aplicables.filter(vigente_desde__lte=referencia)
            .order_by('-vigente_desde').first())
    if fila is None:
        fila = aplicables.order_by('vigente_desde').first()
    return fila


# Los topes imponibles y el sueldo mínimo se reajustan al menos una vez al año.
# Pasado este margen, seguir calculando con los mismos valores es sospechoso.
_MESES_VIGENCIA_ESPERADA = 14


def advertencias_parametros(mes=None, anio=None) -> list:
    """Motivos por los que los parámetros aplicados podrían no ser fiables.

    Se evalúa contra el período liquidado, no contra hoy: liquidar marzo de
    2025 con los parámetros de enero de 2025 es correcto.
    """
    referencia = _fecha_referencia(mes, anio)
    fila = _fila_parametros(referencia)

    if fila is None:
        return ['No hay parámetros previsionales cargados: se está calculando '
                'con los valores de respaldo del código.']

    advertencias = []
    if not fila.confirmado:
        advertencias.append(
            f'Los parámetros vigentes desde {fila.vigente_desde} no han sido '
            f'confirmados contra fuente oficial.')

    meses = (referencia - fila.vigente_desde).days / 30.0
    if meses > _MESES_VIGENCIA_ESPERADA:
        advertencias.append(
            f'Para el período {referencia:%m/%Y} se están aplicando los '
            f'parámetros de {fila.vigente_desde}, de {int(meses)} meses de '
            f'antigüedad. Los topes se reajustan cada enero.')

    return advertencias


def _tasas_afp(mes=None, anio=None) -> dict:
    """Tasa de cada AFP vigente en el período liquidado."""
    referencia = _fecha_referencia(mes, anio)
    aplicables = TasaAFP.objects.exclude(origen='PREVIRED', confirmado=False)
    filas = aplicables.filter(vigente_desde__lte=referencia).order_by('vigente_desde')
    if not filas.exists():
        filas = aplicables.order_by('vigente_desde')

    # Recorrido ascendente: la vigencia más reciente sobrescribe a la anterior.
    tasas = {}
    for fila in filas:
        tasas[fila.nombre.upper()] = float(fila.tasa)
    return tasas or dict(_TASAS_AFP_RESPALDO)


# Naturaleza previsional de cada tipo de partida. Se usa para los ítems que
# no tienen concepto del catálogo: los emitidos antes de que existiera.
_NATURALEZA_POR_TIPO = {
    'HABER_IMPONIBLE':    dict(es_imponible=True,  afecta_gratificacion=True,
                               afecta_semana_corrida=False),
    'HORA_EXTRA':         dict(es_imponible=True,  afecta_gratificacion=True,
                               afecta_semana_corrida=False),
    'COMISION':           dict(es_imponible=True,  afecta_gratificacion=True,
                               afecta_semana_corrida=True),
    'HABER_NO_IMPONIBLE': dict(es_imponible=False, afecta_gratificacion=False,
                               afecta_semana_corrida=False),
    'DESCUENTO':          dict(es_imponible=False, afecta_gratificacion=False,
                               afecta_semana_corrida=False),
}

# Listas del formato anterior y la naturaleza que representaba cada una.
_TIPOS_POR_LISTA = {
    'detalle_haberes_imponibles':    'HABER_IMPONIBLE',
    'detalle_horas_extras':          'HORA_EXTRA',
    'detalle_haberes_no_imponibles': 'HABER_NO_IMPONIBLE',
    'detalle_otros_descuentos':      'DESCUENTO',
    'detalle_comisiones':            'COMISION',
}


def _items_desde_payload(data) -> list:
    """Detalle unificado a partir del payload.

    Acepta el formato nuevo y el anterior de listas separadas, para que un
    cliente que todavía no se actualizó siga funcionando durante el despliegue.
    """
    if data.get('detalle_items') is not None:
        return [dict(i) for i in (data.get('detalle_items') or []) if isinstance(i, dict)]

    items = []
    for lista, naturaleza in _TIPOS_POR_LISTA.items():
        for item in (data.get(lista) or []):
            if isinstance(item, dict):
                items.append({**item, 'naturaleza': naturaleza})
    return items


def _concepto_comision(nombre: str, empresa):
    """Concepto de comisión de la empresa, creándolo si es la primera vez.

    Las categorías de comisión son propias de cada empresa (Carrocería, Piezas
    de motor), así que no pueden venir en el catálogo del sistema. Se crean al
    vuelo para que configurar el contrato no obligue a pasar antes por el
    mantenedor de conceptos.
    """
    nombre = nombre.strip()
    existente = ConceptoRemuneracion.objects.filter(
        empresa=empresa, tipo='COMISION', nombre__iexact=nombre).first()
    if existente:
        return existente

    base = (slugify(nombre).upper().replace('-', '_') or 'COMISION')[:36]
    codigo, sufijo = base, 1
    while ConceptoRemuneracion.objects.filter(empresa=empresa, codigo=codigo).exists():
        sufijo += 1
        codigo = f'{base[:34]}_{sufijo}'

    return ConceptoRemuneracion.objects.create(
        empresa=empresa, tipo='COMISION', codigo=codigo, nombre=nombre)


def _normalizar_comisiones_config(config, empresa) -> list:
    """Deja cada categoría de comisión referenciada por concepto del catálogo.

    Antes se identificaban por su glosa, así que renombrar una categoría
    rompía la correspondencia con las liquidaciones ya emitidas y su comisión
    pasaba a calcularse en cero. El id del concepto no cambia al renombrar.
    """
    normalizada = []
    for entrada in (config or []):
        if not isinstance(entrada, dict):
            continue
        porcentaje = float(entrada.get('porcentaje', 0) or 0)
        nombre = str(entrada.get('glosa', '') or '').strip()

        if nombre:
            concepto = _concepto_comision(nombre, empresa)
        elif entrada.get('concepto'):
            concepto = ConceptoRemuneracion.objects.filter(
                id=entrada['concepto'], tipo='COMISION').first()
        else:
            continue

        if concepto is not None:
            normalizada.append({'concepto': concepto.id, 'porcentaje': porcentaje})
    return normalizada


def _porcentajes_comision(config) -> dict:
    """Porcentaje por categoría, indexado por concepto y también por nombre.

    La doble clave permite resolver tanto los ítems nuevos (que traen el
    concepto) como los emitidos antes del catálogo (que solo tienen glosa).
    """
    porcentajes = {}
    ids = [c.get('concepto') for c in (config or []) if c.get('concepto')]
    nombres = {c.id: c.nombre for c in ConceptoRemuneracion.objects.filter(id__in=ids)}

    for entrada in (config or []):
        if not isinstance(entrada, dict):
            continue
        porcentaje = float(entrada.get('porcentaje', 0) or 0)
        concepto_id = entrada.get('concepto')
        if concepto_id:
            porcentajes[concepto_id] = porcentaje
            if concepto_id in nombres:
                porcentajes[nombres[concepto_id]] = porcentaje
        glosa = str(entrada.get('glosa', '') or '').strip()
        if glosa:
            porcentajes[glosa] = porcentaje
    return porcentajes


def _conceptos_por_id(items) -> dict:
    """Conceptos referenciados por una lista de ítems, en una sola consulta."""
    ids = {item.get('concepto') for item in items if item.get('concepto')}
    if not ids:
        return {}
    return {c.id: c for c in ConceptoRemuneracion.objects.filter(id__in=ids)}


def _validar_conceptos(data, user):
    """Comprueba que cada ítem use un concepto válido y del tipo correcto.

    Se valida antes de calcular para poder responder un 400 explicativo en vez
    de fallar a mitad del cálculo.
    """
    items = _items_desde_payload(data)
    conceptos = _conceptos_por_id(items)

    # El recargo de las horas extras no puede ser menor al 50 % (Art. 32 del
    # Código del Trabajo). Uno mayor es decisión del empleador; uno menor
    # dejaría mal calculada la liquidación.
    for item in items:
        if item.get('naturaleza') != 'HORA_EXTRA' or item.get('recargo') in (None, ''):
            continue
        try:
            recargo = float(item['recargo'])
        except (TypeError, ValueError):
            raise ValidationError({'error': f'Recargo inválido en «{item.get("glosa", "hora extra")}».'})
        if recargo < 50:
            raise ValidationError({'error': (
                f'«{item.get("glosa", "Hora extra")}»: el recargo mínimo legal de las horas extras '
                f'es 50 % (Art. 32 del Código del Trabajo).')})

    for item in items:
        concepto_id = item.get('concepto')
        if not concepto_id:
            continue  # ítem sin catálogo: se acepta por compatibilidad
        concepto = conceptos.get(concepto_id)
        if concepto is None:
            raise ValidationError({'error': f'El concepto {concepto_id} no existe.'})
        if concepto.empresa_id is not None and concepto.empresa.owner_id != user.id:
            raise ValidationError(
                {'error': f'El concepto «{concepto.nombre}» no pertenece a tus empresas.'})
        naturaleza = item.get('naturaleza')
        if naturaleza and concepto.tipo != naturaleza:
            raise ValidationError({'error': (
                f'«{concepto.nombre}» es un {concepto.get_tipo_display().lower()} '
                f'y no puede registrarse como {naturaleza.replace("_", " ").lower()}.')})


def _terminos_vigentes(contrato) -> dict:
    """Condiciones contractuales de hoy — se usan al emitir una liquidación nueva."""
    return {
        'sueldo_base_contrato': contrato.sueldo_base,
        'horas_semanales_contrato': float(getattr(contrato, 'horas_semanales', 0) or 0)
                                    or float(jornada_maxima_vigente()),
        'gratificacion_legal': contrato.gratificacion_legal,
        'tipo_contrato': contrato.tipo_contrato,
        'anticipo_quincena': (contrato.monto_quincena or 0) if contrato.tiene_quincena else 0,
        'valor_uf': obtener_uf(),
        'porcentajes_comision': _porcentajes_comision(contrato.comisiones_config),
    }


def _terminos_congelados(liquidacion, contrato) -> dict:
    """Condiciones con las que se emitió una liquidación existente.

    Al editarla se recalcula con estos valores y no con los del contrato
    vigente: una liquidación de marzo no debe recalcularse con el sueldo o la
    comisión que se pactaron en junio. Los porcentajes de comisión se leen de
    la fila guardada en BD, nunca del payload, para que no puedan alterarse.

    Las liquidaciones anteriores a esta funcionalidad no tienen los términos
    guardados; en ese caso se cae al contrato vigente como mejor aproximación.
    """
    if not liquidacion.sueldo_base_contrato:
        return _terminos_vigentes(contrato)

    porcentajes = {}
    for item in liquidacion.items_de('COMISION'):
        porcentaje = float(item.get('porcentaje', 0) or 0)
        if item.get('concepto'):
            porcentajes[item['concepto']] = porcentaje
        if item.get('glosa'):
            porcentajes[str(item['glosa'])] = porcentaje
    # Una categoría agregada al contrato después de emitir esta liquidación
    # todavía no tiene porcentaje histórico: se toma el del contrato.
    for glosa, porcentaje in _terminos_vigentes(contrato)['porcentajes_comision'].items():
        porcentajes.setdefault(glosa, porcentaje)

    return {
        'sueldo_base_contrato': liquidacion.sueldo_base_contrato,
        # Las emitidas antes de congelar las horas usan las del contrato.
        'horas_semanales_contrato': float(liquidacion.horas_semanales_contrato
                                          or contrato.horas_semanales or jornada_maxima_vigente()),
        'gratificacion_legal': liquidacion.gratificacion_legal or contrato.gratificacion_legal,
        'tipo_contrato': liquidacion.tipo_contrato or contrato.tipo_contrato,
        'anticipo_quincena': liquidacion.anticipo_quincena or 0,
        'valor_uf': float(liquidacion.valor_uf) or obtener_uf(),
        'porcentajes_comision': porcentajes,
    }


def _calcular_liquidacion(contrato, empleado, data, terminos=None):
    """
    Calcula todos los campos derivados de una liquidación (haberes, descuentos
    legales, impuesto único y totales) a partir de los datos de asistencia y
    los arreglos dinámicos de haberes/descuentos.

    Usada tanto por LiquidacionViewSet.create() como por .update(), para que
    editar una liquidación existente recalcule los totales de la misma forma
    que al crearla (en vez de dejarlos congelados con los valores viejos).

    `terminos` son las condiciones contractuales a aplicar (ver
    _terminos_vigentes / _terminos_congelados). Sin él se usa el contrato actual.
    """
    if terminos is None:
        terminos = _terminos_vigentes(contrato)

    # Período liquidado: define qué parámetros legales aplican.
    mes = int(data.get('mes') or 0)
    anio = int(data.get('anio') or 0)
    parametros = _parametros_previsionales(mes, anio)
    valor_uf = terminos['valor_uf']
    # 1. ASISTENCIA
    dias_trabajados = int(data.get('dias_trabajados', 30))
    dias_ausencia = int(data.get('dias_ausencia', 0))
    dias_licencia = int(data.get('dias_licencia', 0))
    dias_no_contratados = int(data.get('dias_no_contratados', 0))

    # Los días a pagar de sueldo base son 30 menos las ausencias y licencias
    dias_a_pagar = 30 - dias_ausencia - dias_licencia - dias_no_contratados
    if dias_a_pagar < 0: dias_a_pagar = 0

    # 2. DETALLE DE HABERES Y DESCUENTOS (lista única)
    items = _items_desde_payload(data)
    conceptos = _conceptos_por_id(items)

    # La glosa y la naturaleza se toman del concepto y quedan guardadas en el
    # ítem: una liquidación que no se vuelve a tocar conserva el nombre que
    # tenía el día que se emitió. Al editarla se re-derivan, porque editar es
    # volver a emitirla y ahí corresponde el nombre vigente.
    for item in items:
        concepto = conceptos.get(item.get('concepto'))
        if concepto is not None:
            item['glosa'] = concepto.nombre
            item['naturaleza'] = concepto.tipo

    # 2b. COMISIONES (remuneración variable, Art. 45 Código del Trabajo)
    # El valor se recalcula acá y no se toma del payload: el porcentaje sale
    # de los términos resueltos en el servidor (contrato vigente o los
    # congelados en la liquidación), así que no puede alterarse desde el
    # navegador. El input solo aporta el monto vendido del mes.
    porcentajes_comision = terminos['porcentajes_comision']
    for item in items:
        if item.get('naturaleza') != 'COMISION':
            continue
        monto_vendido = int(item.get('monto_vendido', 0) or 0)
        # Por concepto primero; la glosa solo cubre lo emitido antes del catálogo.
        porcentaje = porcentajes_comision.get(
            item.get('concepto'), porcentajes_comision.get(str(item.get('glosa', '')), 0))
        item['monto_vendido'] = monto_vendido
        item['porcentaje'] = porcentaje
        item['valor'] = math.floor(monto_vendido * porcentaje / 100)

    # 2c. HORAS EXTRA (Arts. 30 a 32 Código del Trabajo)
    # Igual que las comisiones, el valor se calcula acá: valor hora ordinaria
    # = sueldo / 30 × 7 / horas semanales, con el sueldo y las horas del
    # contrato (congelados en la liquidación). Antes llegaba calculado desde el
    # navegador con las horas de la ficha del trabajador, que pueden no ser
    # las pactadas. El input aporta solo horas y recargo. Los ítems sin horas
    # (anteriores a este cálculo) conservan su valor.
    horas_contrato = float(terminos.get('horas_semanales_contrato') or jornada_maxima_vigente())
    valor_hora_ordinaria = terminos['sueldo_base_contrato'] / 30 * 7 / horas_contrato
    for item in items:
        if item.get('naturaleza') != 'HORA_EXTRA' or 'horas' not in item:
            continue
        horas = float(item.get('horas') or 0)
        recargo = item.get('recargo')
        recargo = 50.0 if recargo in (None, '') else float(recargo)  # mínimo legal: 50 %
        item['horas'] = horas
        item['recargo'] = recargo
        # Redondeo al entero más cercano, igual que la vista previa del panel.
        item['valor'] = math.floor(valor_hora_ordinaria * (1 + recargo / 100) * horas + 0.5)

    # La naturaleza previsional la define el concepto; los ítems anteriores al
    # catálogo no lo tienen y usan la congelada en el propio ítem.
    def _naturaleza(item):
        concepto = conceptos.get(item.get('concepto'))
        if concepto is None:
            return _NATURALEZA_POR_TIPO[item.get('naturaleza', 'HABER_IMPONIBLE')]
        return {
            'es_imponible': concepto.es_imponible,
            'afecta_gratificacion': concepto.afecta_gratificacion,
            'afecta_semana_corrida': concepto.afecta_semana_corrida,
        }

    haberes = [(i, _naturaleza(i)) for i in items if i.get('naturaleza') != 'DESCUENTO']
    descuentos = [i for i in items if i.get('naturaleza') == 'DESCUENTO']

    suma_imponibles_extra = sum(int(i.get('valor', 0)) for i, n in haberes if n['es_imponible'])
    suma_no_imponibles = sum(int(i.get('valor', 0)) for i, n in haberes if not n['es_imponible'])
    suma_gratificable_extra = sum(
        int(i.get('valor', 0)) for i, n in haberes if n['afecta_gratificacion'])
    suma_otros_descuentos = sum(int(item.get('valor', 0)) for item in descuentos)

    # 2c. SEMANA CORRIDA (Art. 45) — método mensual simplificado.
    # La base es todo haber que el catálogo marque como remuneración variable,
    # típicamente las comisiones. Las horas extras quedan excluidas
    # explícitamente por el Art. 32 inciso final del Código del Trabajo.
    base_variable = sum(
        int(i.get('valor', 0)) for i, n in haberes if n['afecta_semana_corrida'])
    semana_corrida = 0
    if base_variable > 0 and dias_a_pagar > 0 and mes and anio:
        promedio_diario_variable = base_variable / dias_a_pagar
        dias_descanso = _contar_domingos_y_festivos(mes, anio)
        semana_corrida = math.floor(promedio_diario_variable * dias_descanso)

    # 3. CÁLCULO DE HABERES
    sueldo_base_mensual = terminos['sueldo_base_contrato']
    sueldo_base_proporcional = math.floor((sueldo_base_mensual / 30) * dias_a_pagar)

    # Gratificación: tope legal de 4,75 ingresos mínimos mensuales al año
    tope_gratificacion = math.floor(
        parametros['factor_gratificacion'] * parametros['ingreso_minimo_mensual'] / 12
    )
    # Gratificable e imponible no son lo mismo: un haber puede cotizar sin
    # entrar a la base de gratificación. Hasta ahora coincidían porque la
    # clasificación dependía de la lista; con el catálogo pueden diferir.
    base_gratificacion = (
        sueldo_base_proporcional + suma_gratificable_extra + semana_corrida
    )
    gratificacion_calculada = math.floor(base_gratificacion * 0.25)
    gratificacion_final = min(gratificacion_calculada, tope_gratificacion) if terminos['gratificacion_legal'] == 'MENSUAL' else 0

    base_imponible = (
        sueldo_base_proporcional + suma_imponibles_extra + semana_corrida
    )
    total_imponible = base_imponible + gratificacion_final
    total_haberes = total_imponible + suma_no_imponibles

    # 4. CÁLCULO DE DESCUENTOS LEGALES
    # Las cotizaciones se calculan sobre la renta imponible TOPADA, no sobre el
    # total imponible: lo que excede el tope legal no cotiza. AFP y salud
    # comparten tope; el seguro de cesantía tiene uno propio, más alto.
    tope_afp = _tope_en_pesos(parametros['tope_imponible_afp_uf'], valor_uf)
    tope_afc = _tope_en_pesos(parametros['tope_imponible_afc_uf'], valor_uf)
    renta_imponible_afp = min(total_imponible, tope_afp)
    renta_imponible_afc = min(total_imponible, tope_afc)

    nombre_afp = (empleado.afp or 'MODELO').upper()
    tasa_afp = _tasas_afp(mes, anio).get(nombre_afp, 0.11)
    afp_monto = math.floor(renta_imponible_afp * tasa_afp)

    # Salud (Isapre UF vs Fonasa 7%)
    tasa_salud = parametros['tasa_salud']
    salud_nombre = (empleado.sistema_salud or 'FONASA').upper()
    if salud_nombre == 'ISAPRE' and empleado.plan_isapre_uf > 0:
        salud_monto = math.floor(float(empleado.plan_isapre_uf) * valor_uf)
        isapre_uf = empleado.plan_isapre_uf
        # La ley exige descontar al menos el 7%, si el plan UF es menor, se cobra 7%
        minimo_legal = math.floor(renta_imponible_afp * tasa_salud)
        if salud_monto < minimo_legal:
            salud_monto = minimo_legal
    else:
        salud_monto = math.floor(renta_imponible_afp * tasa_salud)
        isapre_uf = 0

    # Seguro Cesantía: 0,6 % del trabajador indefinido, salvo desde el año 11
    # de la relación laboral, en que deja de cotizar (antes se le descontaba
    # igual y su líquido salía menor).
    tasa_afc_trabajador, _ = _tasas_afc(
        parametros, terminos['tipo_contrato'],
        _anios_de_servicio(empleado, contrato, data.get('mes'), data.get('anio')))
    seguro_cesantia = math.floor(renta_imponible_afc * tasa_afc_trabajador)

    # Impuesto Único de Segunda Categoría
    base_tributable = total_imponible - afp_monto - salud_monto - seguro_cesantia
    impuesto_unico = calcular_impuesto_unico(base_tributable, obtener_utm())

    # Quincena y otros
    anticipo_quincena = terminos['anticipo_quincena']
    total_descuentos = afp_monto + salud_monto + seguro_cesantia + impuesto_unico + anticipo_quincena + suma_otros_descuentos

    # 5. SUELDO LÍQUIDO FINAL
    sueldo_liquido = total_haberes - total_descuentos

    return {
        'dias_trabajados': dias_trabajados, 'dias_licencia': dias_licencia,
        'dias_ausencia': dias_ausencia, 'dias_no_contratados': dias_no_contratados,
        'sueldo_base': sueldo_base_proporcional, 'gratificacion': gratificacion_final,
        'detalle_items': items, 'semana_corrida': semana_corrida,
        'afp_nombre': nombre_afp, 'afp_monto': afp_monto,
        'salud_nombre': salud_nombre, 'isapre_cotizacion_uf': isapre_uf, 'salud_monto': salud_monto,
        'seguro_cesantia': seguro_cesantia, 'impuesto_unico': impuesto_unico, 'anticipo_quincena': anticipo_quincena,
        'sueldo_base_contrato': terminos['sueldo_base_contrato'],
        'horas_semanales_contrato': round(horas_contrato, 1),
        'gratificacion_legal': terminos['gratificacion_legal'],
        'tipo_contrato': terminos['tipo_contrato'],
        'valor_uf': round(valor_uf, 2),
        'total_imponible': total_imponible, 'total_haberes': total_haberes,
        'total_descuentos': total_descuentos, 'sueldo_liquido': sueldo_liquido,
    }


def _pdf_liquidacion(liquidacion, es_plan_semilla):
    """PDF de una liquidación en bytes, o None si xhtml2pdf falla."""
    empleado = liquidacion.empleado
    empresa = empleado.empresa
    contrato = Contrato.objects.filter(empleado=empleado).first()
    meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
             "Septiembre", "Octubre", "Noviembre", "Diciembre"]

    # Transformar número a palabras (Ej: 542000 -> "quinientos cuarenta y dos mil")
    liquido_palabras = num2words(int(liquidacion.sueldo_liquido or 0), lang='es')

    agrupados = liquidacion.items_agrupados
    suma_no_imponibles = sum(int(i.get('valor', 0)) for i in agrupados['no_imponibles'] if isinstance(i, dict))
    suma_otros_descuentos = sum(int(i.get('valor', 0)) for i in agrupados['descuentos'] if isinstance(i, dict))
    total_ley = ((liquidacion.afp_monto or 0) + (liquidacion.salud_monto or 0)
                 + (liquidacion.seguro_cesantia or 0) + (liquidacion.impuesto_unico or 0))
    total_otros_dsctos = (liquidacion.anticipo_quincena or 0) + suma_otros_descuentos

    html = get_template('liquidacion.html').render({
        'liquidacion': liquidacion, 'empleado': empleado, 'empresa': empresa, 'contrato': contrato,
        'mes_nombre': meses[liquidacion.mes - 1].upper(), 'liquido_palabras': liquido_palabras,
        'total_no_imponible': suma_no_imponibles, 'total_ley': total_ley,
        'total_otros_dsctos': total_otros_dsctos, 'es_plan_semilla': es_plan_semilla,
    })
    salida = io.BytesIO()
    if pisa.CreatePDF(html, dest=salida).err:
        logger.error('xhtml2pdf no pudo generar la liquidación %s', liquidacion.id)
        return None
    return salida.getvalue()


class LiquidacionViewSet(viewsets.ModelViewSet):
    queryset = Liquidacion.objects.all().order_by('-anio', '-mes')
    serializer_class = LiquidacionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Solo liquidaciones de empleados que pertenecen al usuario autenticado
        queryset = Liquidacion.objects.filter(
            empleado__empresa__owner=self.request.user
        ).order_by('-anio', '-mes')
        empleado_id = self.request.query_params.get('empleado', None)
        if empleado_id is not None:
            queryset = queryset.filter(empleado_id=empleado_id)
        # Filtros del proceso mensual: una empresa y un período.
        params = self.request.query_params
        if params.get('empresa'):
            queryset = queryset.filter(empleado__empresa_id=params['empresa'])
        if params.get('mes'):
            queryset = queryset.filter(mes=params['mes'])
        if params.get('anio'):
            queryset = queryset.filter(anio=params['anio'])
        return queryset

    @action(detail=False, methods=['post'])
    def simular(self, request):
        """Calcula una liquidación sin guardarla (vista previa del formulario).

        Usa exactamente el mismo cálculo que create/update: el frontend no
        replica ninguna regla previsional. Con `liquidacion` se simula la
        edición de una existente, con los términos con que se emitió.
        """
        data = request.data
        try:
            _validar_conceptos(data, request.user)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        try:
            empleado = Empleado.objects.get(id=data.get('empleado'), empresa__owner=request.user)
        except (Empleado.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Trabajador no encontrado o no autorizado.'}, status=status.HTTP_404_NOT_FOUND)
        contrato = Contrato.objects.filter(empleado=empleado).first()
        if not contrato:
            return Response({'error': 'El trabajador no tiene un contrato activo.'}, status=status.HTTP_400_BAD_REQUEST)

        terminos = _terminos_vigentes(contrato)
        if data.get('liquidacion'):
            existente = Liquidacion.objects.filter(id=data['liquidacion'], empleado=empleado).first()
            if existente:
                terminos = _terminos_congelados(existente, contrato)
        try:
            calculado = _calcular_liquidacion(contrato, empleado, data, terminos=terminos)
        except (ValueError, TypeError) as e:
            return Response({'error': f'Datos inválidos: {e}'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'empleado': empleado.id, 'mes': data.get('mes'), 'anio': data.get('anio'), **calculado})

    def create(self, request, *args, **kwargs):
        data = request.data
        empleado_id = data.get('empleado')

        try:
            _validar_conceptos(data, request.user)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Validar que el empleado pertenezca al usuario autenticado
            empleado = Empleado.objects.get(id=empleado_id, empresa__owner=request.user)
            contrato = Contrato.objects.filter(empleado=empleado).first()

            if not contrato:
                return Response({'error': 'El trabajador no tiene un contrato activo.'}, status=status.HTTP_400_BAD_REQUEST)

            calculado = _calcular_liquidacion(
                contrato, empleado, data, terminos=_terminos_vigentes(contrato)
            )

            liquidacion = Liquidacion.objects.create(
                empleado=empleado, mes=data.get('mes'), anio=data.get('anio'),
                **calculado,
            )

            serializer = self.get_serializer(liquidacion)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Empleado.DoesNotExist:
            return Response({'error': 'Trabajador no encontrado o no autorizado.'}, status=status.HTTP_404_NOT_FOUND)
        except IntegrityError:
            return Response(
                {'error': 'Ya existe una liquidación para este trabajador en el período indicado.'},
                status=status.HTTP_409_CONFLICT
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()

        # Una liquidación ya firmada por el trabajador queda inmutable.
        # Mientras la firma esté solo PENDIENTE, se debe cancelar esa
        # solicitud antes de poder editar (flujo ya soportado por /cancelar/).
        firmada = SolicitudFirma.objects.filter(
            tipo_documento='LIQUIDACION', liquidacion=instance, estado='FIRMADO'
        ).exists()
        if firmada:
            return Response(
                {'error': 'Esta liquidación ya fue firmada por el trabajador y no puede modificarse.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        pendiente = SolicitudFirma.objects.filter(
            tipo_documento='LIQUIDACION', liquidacion=instance, estado='PENDIENTE'
        ).exists()
        if pendiente:
            return Response(
                {'error': 'Hay una solicitud de firma pendiente para esta liquidación. Cancélala antes de modificarla.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        empleado = instance.empleado
        contrato = Contrato.objects.filter(empleado=empleado).first()

        if not contrato:
            return Response({'error': 'El trabajador no tiene un contrato activo.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            _validar_conceptos(request.data, request.user)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

        data = request.data
        campos_editables = [
            'mes', 'anio', 'dias_trabajados', 'dias_ausencia', 'dias_licencia',
            'dias_no_contratados', 'detalle_items',
        ]
        # Combina lo que venga en el request con lo que ya estaba guardado,
        # así un PATCH parcial recalcula usando el resto de los valores tal
        # como estaban, en vez de perderlos.
        datos_para_calculo = {
            campo: data.get(campo, getattr(instance, campo)) for campo in campos_editables
        }

        try:
            calculado = _calcular_liquidacion(
                contrato, empleado, datos_para_calculo,
                terminos=_terminos_congelados(instance, contrato),
            )

            for campo, valor in calculado.items():
                setattr(instance, campo, valor)

            instance.mes = data.get('mes', instance.mes)
            instance.anio = data.get('anio', instance.anio)

            # El PDF generado antes de este cambio ya no refleja los montos
            # recalculados — se limpia para forzar que se regenere.
            if instance.archivo_pdf:
                instance.archivo_pdf.delete(save=False)

            instance.save()
        except IntegrityError:
            return Response(
                {'error': 'Ya existe una liquidación para este trabajador en el período indicado.'},
                status=status.HTTP_409_CONFLICT
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = self.get_serializer(instance)
        return Response(serializer.data)
        
    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        try:
            liquidacion = self.get_object()
            pdf = _pdf_liquidacion(liquidacion, _es_plan_semilla(request.user))
            if pdf is None:
                return Response({'error': 'Error al generar PDF'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            response = HttpResponse(pdf, content_type='application/pdf')
            nombre_archivo = f'Liquidacion_{liquidacion.mes}_{liquidacion.anio}_{liquidacion.empleado.rut}.pdf'
            response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
            return response
        except Exception as e:
            logger.exception('Error al generar PDF de liquidación')
            return Response({'error': f'Error generando PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='zip_periodo')
    def zip_periodo(self, request):
        """PDF de todas las liquidaciones de una empresa en un período, en un ZIP (plan Pyme+)."""
        if not _plan_permite(request.user, 3):
            return Response(
                {'error': 'La descarga de liquidaciones en ZIP está disponible desde el plan Pyme. Mejora tu suscripción para acceder.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            mes = int(request.query_params.get('mes'))
            anio = int(request.query_params.get('anio'))
            empresa = Empresa.objects.get(id=request.query_params.get('empresa'), owner=request.user)
        except (TypeError, ValueError, Empresa.DoesNotExist):
            return Response({'error': 'Indica una empresa y un período válidos.'}, status=status.HTTP_400_BAD_REQUEST)

        liquidaciones = (Liquidacion.objects
                         .filter(empleado__empresa=empresa, mes=mes, anio=anio)
                         .select_related('empleado', 'empleado__empresa')
                         .order_by('empleado__apellido_paterno'))
        if not liquidaciones.exists():
            return Response({'error': 'No hay liquidaciones emitidas en ese período.'}, status=status.HTTP_404_NOT_FOUND)

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for liq in liquidaciones:
                pdf = _pdf_liquidacion(liq, False)
                if pdf is None:
                    continue
                emp = liq.empleado
                nombre = f"Liquidacion_{emp.rut.replace('.', '')}_{emp.apellido_paterno}_{anio}-{mes:02d}.pdf".replace(' ', '_')
                zf.writestr(nombre, pdf)
        response = HttpResponse(buffer.getvalue(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="Liquidaciones_{empresa.rut}_{anio}-{mes:02d}.zip"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=False, methods=['get'], url_path='exportar_previred')
    def exportar_previred(self, request):
        if not _plan_permite(request.user, 3):
            return Response(
                {'error': 'La exportación Previred está disponible desde el plan Pyme. Mejora tu suscripción para acceder.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        mes_param = request.query_params.get('mes')
        anio_param = request.query_params.get('anio')
        empresa_id = request.query_params.get('empresa')

        if not mes_param or not anio_param:
            return Response({'error': 'Se requieren los parámetros mes y anio.'}, status=400)
        try:
            mes = int(mes_param)
            anio = int(anio_param)
        except ValueError:
            return Response({'error': 'Parámetros mes y anio deben ser numéricos.'}, status=400)

        qs = Liquidacion.objects.filter(
            empleado__empresa__owner=request.user,
            mes=mes, anio=anio,
        ).select_related('empleado', 'empleado__empresa')

        if empresa_id:
            qs = qs.filter(empleado__empresa_id=empresa_id)

        if not qs.exists():
            return Response({'error': 'No hay liquidaciones para el período seleccionado.'}, status=404)

        params_periodo = _parametros_previsionales(mes, anio)

        lineas = []
        for liq in qs:
            emp = liq.empleado
            empresa = emp.empresa
            contrato = Contrato.objects.filter(empleado=emp).first()

            # ── Identificación trabajador ──────────────────────────────────
            rut_num, rut_dv = _rut_partes(emp.rut)
            apellido_m = emp.apellido_materno or ''
            sexo_cod = '2' if emp.sexo == 'F' else '1'
            fecha_nac = _fmt_fecha_previred(emp.fecha_nacimiento)
            fecha_ing = _fmt_fecha_previred(emp.fecha_ingreso)
            tipo_trab = '01'
            nac_cod = '152'  # Chile

            # ── Contrato ───────────────────────────────────────────────────
            dias_trab = str(int(liq.dias_trabajados or 30))
            tipo_ctto = _TIPO_CONTRATO_PREVIRED.get(
                contrato.tipo_contrato if contrato else 'INDEFINIDO', '1'
            )
            es_indefinido = contrato.tipo_contrato == 'INDEFINIDO' if contrato else False
            movimiento = '0'  # vigente
            rut_emp_num, rut_emp_dv = _rut_partes(empresa.rut)

            # ── AFP ────────────────────────────────────────────────────────
            nombre_afp = (liq.afp_nombre or 'MODELO').upper()
            cod_afp = _AFP_CODIGOS_PREVIRED.get(nombre_afp, '08')
            # Se informa la renta TOPADA, que es sobre la que se cotiza.
            uf_periodo = float(liq.valor_uf) or obtener_uf()
            renta_imp = min(
                int(liq.total_imponible or 0),
                _tope_en_pesos(params_periodo['tope_imponible_afp_uf'], uf_periodo),
            )
            renta_afc = min(
                int(liq.total_imponible or 0),
                _tope_en_pesos(params_periodo['tope_imponible_afc_uf'], uf_periodo),
            )
            cotiz_afp = str(int(liq.afp_monto or 0))
            sis = str(math.floor(renta_imp * params_periodo['tasa_sis']))

            # ── Salud ──────────────────────────────────────────────────────
            sistema = (liq.salud_nombre or 'FONASA').upper()
            if sistema == 'FONASA':
                cod_salud = '00'
            else:
                cod_salud = _ISAPRE_CODIGOS_PREVIRED.get(sistema, '00')
            cotiz_salud = str(int(liq.salud_monto or 0))
            uf_isapre = str(float(liq.isapre_cotizacion_uf or 0))

            # ── Mutual AT/EP ───────────────────────────────────────────────
            cotiz_mutual = str(math.floor(renta_imp * params_periodo['tasa_mutual_base']))

            # ── AFC Cesantía ───────────────────────────────────────────────
            ind_afc = '1' if es_indefinido else '0'
            cotiz_afc_trab = str(int(liq.seguro_cesantia or 0))
            if contrato and contrato.tipo_contrato in ('INDEFINIDO', 'PLAZO_FIJO'):
                _, tasa_afc_emp = _tasas_afc(
                    params_periodo, contrato.tipo_contrato,
                    _anios_de_servicio(emp, contrato, liq.mes, liq.anio))
                cotiz_afc_emp = str(math.floor(renta_afc * tasa_afc_emp))
            else:
                cotiz_afc_emp = '0'
            renta_imp_afc = str(renta_afc) if es_indefinido else '0'

            # ── Reforma 2025 ───────────────────────────────────────────────
            tipo_jornada_code = _TIPO_JORNADA_PREVIRED.get(
                contrato.tipo_jornada if contrato else 'ORDINARIA', '1'
            )
            cotiz_expectativa = str(math.floor(renta_imp * params_periodo['tasa_expectativa_vida']))

            # ── Construir array de 105 campos (base cero) ──────────────────
            campos = ['0'] * 105

            # Trabajador / contrato (campos 1-17, índices 0-16)
            campos[0]  = rut_num
            campos[1]  = rut_dv
            campos[2]  = emp.apellido_paterno
            campos[3]  = apellido_m
            campos[4]  = emp.nombres
            campos[5]  = sexo_cod
            campos[6]  = fecha_nac
            campos[7]  = nac_cod
            campos[8]  = tipo_trab
            campos[9]  = fecha_ing
            campos[10] = ''   # fecha término (activo)
            campos[11] = ''   # causal término
            campos[12] = dias_trab
            campos[13] = tipo_ctto
            campos[14] = movimiento
            campos[15] = rut_emp_num
            campos[16] = rut_emp_dv
            # índices 17-23: padding → '0' (ya inicializados)

            # AFP (campos 25-28, índices 24-27)
            campos[24] = cod_afp
            campos[25] = str(renta_imp)
            campos[26] = cotiz_afp
            campos[27] = sis
            # índices 28-43: extras AFP → '0'

            # Salud (campos 45-48, índices 44-47)
            campos[44] = cod_salud
            campos[45] = str(renta_imp)
            campos[46] = cotiz_salud
            campos[47] = uf_isapre
            # índices 48-59: extras salud → '0'

            # Mutual AT/EP (campos 61-63, índices 60-62)
            campos[60] = _MUTUAL_DEFAULT
            campos[61] = str(renta_imp)
            campos[62] = cotiz_mutual
            # índices 63-69: extras mutual → '0'

            # AFC (campos 71-74, índices 70-73)
            campos[70] = ind_afc
            campos[71] = renta_imp_afc
            campos[72] = cotiz_afc_trab
            campos[73] = cotiz_afc_emp
            # índices 74-84: extras AFC → '0'

            # Reforma 2025 (campos 86-88, índices 85-87)
            campos[85] = '0'               # RIMA
            campos[86] = tipo_jornada_code # tipo jornada ley 40h
            # Posición no verificada contra el formato oficial de Previred para la
            # reforma; la tasa sale de ParametroPrevisional.tasa_expectativa_vida.
            campos[87] = cotiz_expectativa # expectativa de vida
            # índices 88-104: extras → '0'

            lineas.append(';'.join(campos))

        meses_nombres = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
        ]
        nombre_archivo = f'Previred_{meses_nombres[mes - 1]}_{anio}.txt'
        contenido = '\n'.join(lineas)
        response = HttpResponse(contenido, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
        return response

    @action(detail=False, methods=['get'], url_path='libro_remuneraciones')
    def libro_remuneraciones(self, request):
        if not _plan_permite(request.user, 3):
            return Response(
                {'error': 'El Libro de Remuneraciones está disponible desde el plan Pyme. Mejora tu suscripción para acceder.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        mes_param  = request.query_params.get('mes')
        anio_param = request.query_params.get('anio')
        empresa_id = request.query_params.get('empresa')
        formato    = request.query_params.get('formato', 'excel')

        if not mes_param or not anio_param:
            return Response({'error': 'Se requieren los parámetros mes y anio.'}, status=400)
        try:
            mes  = int(mes_param)
            anio = int(anio_param)
        except ValueError:
            return Response({'error': 'Parámetros mes y anio deben ser numéricos.'}, status=400)

        qs = Liquidacion.objects.filter(
            empleado__empresa__owner=request.user,
            mes=mes, anio=anio,
        ).select_related('empleado', 'empleado__empresa').order_by(
            'empleado__ficha_numero', 'empleado__apellido_paterno'
        )
        if empresa_id:
            qs = qs.filter(empleado__empresa_id=empresa_id)
        if not qs.exists():
            return Response({'error': 'No hay liquidaciones para el período seleccionado.'}, status=404)

        empresa = qs.first().empleado.empresa
        meses_nombres = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
        ]
        mes_nombre = meses_nombres[mes - 1]

        # ── Helper formato CLP para el PDF ────────────────────────────────────
        def clp(n):
            if not n:
                return '$0'
            return f'${int(n):,}'.replace(',', '.')

        # ── Preparación de filas (compartido por Excel y PDF) ─────────────────
        filas = []
        totales = {k: 0 for k in [
            'sueldo_base', 'gratificacion', 'otros_imp', 'total_imponible',
            'no_imponibles', 'total_haberes', 'cotiz_afp', 'cotiz_salud',
            'cesantia', 'imp_unico', 'anticipo', 'otros_desc',
            'total_descuentos', 'sueldo_liquido',
        ]}

        for liq in qs:
            emp = liq.empleado
            agrupados = liq.items_agrupados
            det_imp = agrupados['imponibles']
            det_hex = agrupados['horas_extras']
            det_com = agrupados['comisiones']
            det_noi = agrupados['no_imponibles']
            det_odc = agrupados['descuentos']

            otros_imp  = sum(int(d.get('valor', 0)) for d in det_imp if isinstance(d, dict))
            otros_imp += sum(int(d.get('valor', 0)) for d in det_hex if isinstance(d, dict))
            otros_imp += sum(int(d.get('valor', 0)) for d in det_com if isinstance(d, dict))
            otros_imp += int(liq.semana_corrida or 0)
            no_impon   = sum(int(d.get('valor', 0)) for d in det_noi if isinstance(d, dict))
            otros_desc = sum(int(d.get('valor', 0)) for d in det_odc if isinstance(d, dict))

            filas.append({
                'ficha':        emp.ficha_numero or '',
                'rut':          emp.rut,
                'nombre':       f'{emp.apellido_paterno} {emp.apellido_materno or ""} {emp.nombres}'.strip(),
                'cargo':        emp.cargo or '',
                'dias':         liq.dias_trabajados,
                'sueldo_base':  int(liq.sueldo_base),
                'gratificacion':int(liq.gratificacion),
                'otros_imp':    otros_imp,
                'total_imp':    int(liq.total_imponible),
                'no_imp':       no_impon,
                'total_hab':    int(liq.total_haberes),
                'afp_nombre':   liq.afp_nombre or '',
                'cotiz_afp':    int(liq.afp_monto),
                'salud_nombre': liq.salud_nombre or '',
                'cotiz_salud':  int(liq.salud_monto),
                'cesantia':     int(liq.seguro_cesantia),
                'imp_unico':    int(liq.impuesto_unico or 0),
                'anticipo':     int(liq.anticipo_quincena or 0),
                'otros_desc':   otros_desc,
                'total_desc':   int(liq.total_descuentos),
                'sueldo_liq':   int(liq.sueldo_liquido),
            })

            totales['sueldo_base']      += int(liq.sueldo_base)
            totales['gratificacion']    += int(liq.gratificacion)
            totales['otros_imp']        += otros_imp
            totales['total_imponible']  += int(liq.total_imponible)
            totales['no_imponibles']    += no_impon
            totales['total_haberes']    += int(liq.total_haberes)
            totales['cotiz_afp']        += int(liq.afp_monto)
            totales['cotiz_salud']      += int(liq.salud_monto)
            totales['cesantia']         += int(liq.seguro_cesantia)
            totales['imp_unico']        += int(liq.impuesto_unico or 0)
            totales['anticipo']         += int(liq.anticipo_quincena or 0)
            totales['otros_desc']       += otros_desc
            totales['total_descuentos'] += int(liq.total_descuentos)
            totales['sueldo_liquido']   += int(liq.sueldo_liquido)

        nombre_base = f'LibroRemuneraciones_{mes_nombre}_{anio}_{empresa.rut}'

        # ══════════════════════════════════════════════════════════════════════
        # RAMA PDF
        # ══════════════════════════════════════════════════════════════════════
        if formato == 'pdf':
            # Pre-formatear montos para el template
            for f in filas:
                for k in ['sueldo_base','gratificacion','otros_imp','total_imp','no_imp',
                          'total_hab','cotiz_afp','cotiz_salud','cesantia','imp_unico',
                          'anticipo','otros_desc','total_desc','sueldo_liq']:
                    f[f'{k}_fmt'] = clp(f[k])

            totales_fmt = {k: clp(v) for k, v in totales.items()}

            context = {
                'empresa':      empresa,
                'mes_nombre':   mes_nombre,
                'anio':         anio,
                'filas':        filas,
                'totales':      totales,
                'totales_fmt':  totales_fmt,
                'fecha_emision': timezone.now().date().strftime('%d/%m/%Y'),
                'n_trabajadores': len(filas),
            }
            template = get_template('libro_remuneraciones.html')
            html = template.render(context)

            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{nombre_base}.pdf"'
            pisa_status = pisa.CreatePDF(html, dest=response)
            if pisa_status.err:
                return Response({'error': 'Error al generar PDF'}, status=500)
            return response

        # ══════════════════════════════════════════════════════════════════════
        # RAMA EXCEL (sin cambios respecto al paso 1)
        # ══════════════════════════════════════════════════════════════════════

        # ── Estilos ───────────────────────────────────────────────────────────
        COLOR_HEADER   = '1E3A5F'
        COLOR_TOTALES  = 'F59E0B'
        COLOR_FILA_PAR = 'F1F5F9'

        ft_titulo    = Font(name='Calibri', bold=True, size=14, color='1E3A5F')
        ft_subtit    = Font(name='Calibri', bold=True, size=11, color='334155')
        ft_header    = Font(name='Calibri', bold=True, size=9,  color='FFFFFF')
        ft_dato      = Font(name='Calibri', size=9)
        ft_total     = Font(name='Calibri', bold=True, size=9)
        ft_total_liq = Font(name='Calibri', bold=True, size=9, color='7C3AED')

        al_center = Alignment(horizontal='center', vertical='center', wrap_text=True)
        al_left   = Alignment(horizontal='left',   vertical='center')
        al_right  = Alignment(horizontal='right',  vertical='center')

        fill_header = PatternFill('solid', fgColor=COLOR_HEADER)
        fill_total  = PatternFill('solid', fgColor=COLOR_TOTALES)
        fill_par    = PatternFill('solid', fgColor=COLOR_FILA_PAR)

        thin  = Side(style='thin', color='CBD5E1')
        borde = Border(left=thin, right=thin, top=thin, bottom=thin)

        FMT_CLP  = '#,##0'
        FMT_TEXT = '@'

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f'Libro {mes_nombre} {anio}'
        ws.sheet_view.showGridLines = False

        COLS = [
            ('N°',                    5),
            ('RUT',                  12),
            ('Apellidos y Nombres',  28),
            ('Cargo',                16),
            ('Días\nTrab.',           7),
            ('Sueldo\nBase',         12),
            ('Gratif.',              11),
            ('Otros Hab.\nImpon.',   12),
            ('Total\nImponible',     13),
            ('Hab. No\nImponibles',  13),
            ('Total\nHaberes',       12),
            ('AFP',                   9),
            ('Cotiz.\nAFP',          11),
            ('Salud',                 9),
            ('Cotiz.\nSalud',        11),
            ('Cesantía',             10),
            ('Imp.\nÚnico',          10),
            ('Anticipo',             10),
            ('Otros\nDesc.',         10),
            ('Total\nDescuentos',    13),
            ('Alcance\nLíquido',     13),
        ]
        for i, (_, ancho) in enumerate(COLS, start=1):
            ws.column_dimensions[get_column_letter(i)].width = ancho

        N_COLS     = len(COLS)
        ultima_col = get_column_letter(N_COLS)

        ws.row_dimensions[1].height = 22
        ws.row_dimensions[2].height = 18
        ws.row_dimensions[3].height = 16

        ws.merge_cells(f'A1:{ultima_col}1')
        c = ws['A1']
        c.value     = empresa.nombre_legal.upper()
        c.font      = ft_titulo
        c.alignment = al_center

        ws.merge_cells(f'A2:{ultima_col}2')
        c = ws['A2']
        c.value     = 'LIBRO DE REMUNERACIONES'
        c.font      = ft_subtit
        c.alignment = al_center

        ws.merge_cells(f'A3:{ultima_col}3')
        c = ws['A3']
        c.value     = f'RUT: {empresa.rut}     Período: {mes_nombre} {anio}'
        c.font      = Font(name='Calibri', size=10, color='475569')
        c.alignment = al_center

        ws.row_dimensions[4].height = 6

        ws.row_dimensions[5].height = 36
        for col_idx, (label, _) in enumerate(COLS, start=1):
            c = ws.cell(row=5, column=col_idx, value=label)
            c.font      = ft_header
            c.fill      = fill_header
            c.alignment = al_center
            c.border    = borde

        for fila_idx, f in enumerate(filas, start=6):
            fill_fila = fill_par if fila_idx % 2 == 0 else None
            valores = [
                (f['ficha'],         FMT_TEXT, al_center),
                (f['rut'],           FMT_TEXT, al_left),
                (f['nombre'],        FMT_TEXT, al_left),
                (f['cargo'],         FMT_TEXT, al_left),
                (f['dias'],          FMT_TEXT, al_center),
                (f['sueldo_base'],   FMT_CLP,  al_right),
                (f['gratificacion'], FMT_CLP,  al_right),
                (f['otros_imp'],     FMT_CLP,  al_right),
                (f['total_imp'],     FMT_CLP,  al_right),
                (f['no_imp'],        FMT_CLP,  al_right),
                (f['total_hab'],     FMT_CLP,  al_right),
                (f['afp_nombre'],    FMT_TEXT, al_center),
                (f['cotiz_afp'],     FMT_CLP,  al_right),
                (f['salud_nombre'],  FMT_TEXT, al_center),
                (f['cotiz_salud'],   FMT_CLP,  al_right),
                (f['cesantia'],      FMT_CLP,  al_right),
                (f['imp_unico'],     FMT_CLP,  al_right),
                (f['anticipo'],      FMT_CLP,  al_right),
                (f['otros_desc'],    FMT_CLP,  al_right),
                (f['total_desc'],    FMT_CLP,  al_right),
                (f['sueldo_liq'],    FMT_CLP,  al_right),
            ]
            ws.row_dimensions[fila_idx].height = 15
            for col_idx, (valor, fmt, alin) in enumerate(valores, start=1):
                c = ws.cell(row=fila_idx, column=col_idx, value=valor)
                c.number_format = fmt
                c.font          = ft_dato
                c.alignment     = alin
                c.border        = borde
                if fill_fila:
                    c.fill = fill_fila

        fila_total = len(filas) + 6
        ws.row_dimensions[fila_total].height = 18
        vals_total = [
            ('', FMT_TEXT), ('', FMT_TEXT),
            ('TOTALES', FMT_TEXT), ('', FMT_TEXT), ('', FMT_TEXT),
            (totales['sueldo_base'],      FMT_CLP),
            (totales['gratificacion'],    FMT_CLP),
            (totales['otros_imp'],        FMT_CLP),
            (totales['total_imponible'],  FMT_CLP),
            (totales['no_imponibles'],    FMT_CLP),
            (totales['total_haberes'],    FMT_CLP),
            ('', FMT_TEXT),
            (totales['cotiz_afp'],        FMT_CLP),
            ('', FMT_TEXT),
            (totales['cotiz_salud'],      FMT_CLP),
            (totales['cesantia'],         FMT_CLP),
            (totales['imp_unico'],        FMT_CLP),
            (totales['anticipo'],         FMT_CLP),
            (totales['otros_desc'],       FMT_CLP),
            (totales['total_descuentos'], FMT_CLP),
            (totales['sueldo_liquido'],   FMT_CLP),
        ]
        for col_idx, (valor, fmt) in enumerate(vals_total, start=1):
            c = ws.cell(row=fila_total, column=col_idx, value=valor)
            c.number_format = fmt
            c.fill      = fill_total
            c.border    = borde
            c.alignment = al_right if fmt == FMT_CLP else al_center
            if col_idx == 3:
                c.alignment = al_left
            c.font = ft_total_liq if col_idx == N_COLS else ft_total

        ws.page_setup.orientation   = 'landscape'
        ws.page_setup.paperSize     = ws.PAPERSIZE_LETTER
        ws.page_setup.fitToPage     = True
        ws.page_setup.fitToWidth    = 1
        ws.page_setup.fitToHeight   = 0
        ws.print_title_rows         = '1:5'
        ws.freeze_panes             = 'A6'

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        response = HttpResponse(
            buf.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{nombre_base}.xlsx"'
        return response

    # ──────────────────────────────────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='consolidado')
    def consolidado(self, request):
        # Consolidado multiempresa: plan Pyme en adelante.
        if not _plan_permite(request.user, 3):
            return Response(
                {'error': 'El consolidado multiempresa está disponible desde el plan Pyme. Mejora tu suscripción para acceder.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        anio_param = request.query_params.get('anio')
        mes_param  = request.query_params.get('mes')
        formato    = request.query_params.get('formato', 'json')

        if not anio_param:
            return Response({'error': 'Se requiere el parámetro anio.'}, status=400)
        try:
            anio = int(anio_param)
            mes  = int(mes_param) if mes_param else None
        except ValueError:
            return Response({'error': 'Los parámetros anio y mes deben ser numéricos.'}, status=400)

        base_qs = (
            Liquidacion.objects
            .filter(empleado__empresa__owner=request.user, anio=anio)
            .select_related('empleado', 'empleado__empresa', 'empleado__contrato_activo')
        )
        qs_periodo = base_qs.filter(mes=mes) if mes else base_qs

        if not qs_periodo.exists():
            if formato == 'json':
                return Response({'error': 'No hay liquidaciones para el período seleccionado.'}, status=404)
            return Response({'error': 'No hay liquidaciones para el período seleccionado.'}, status=404)

        def _costo_emp(liq):
            """Aportes de cargo del empleador: SIS, mutual, cesantía y reforma."""
            par = _parametros_previsionales(liq.mes, liq.anio)
            contrato_liq = getattr(liq.empleado, 'contrato_activo', None)
            tipo = liq.tipo_contrato or getattr(contrato_liq, 'tipo_contrato', 'INDEFINIDO')
            _, tasa_afc = _tasas_afc(par, tipo, _anios_de_servicio(liq.empleado, contrato_liq, liq.mes, liq.anio))
            uf_periodo = float(liq.valor_uf) or obtener_uf()
            renta = min(
                int(liq.total_imponible or 0),
                _tope_en_pesos(par['tope_imponible_afp_uf'], uf_periodo),
            )
            renta_afc = min(
                int(liq.total_imponible or 0),
                _tope_en_pesos(par['tope_imponible_afc_uf'], uf_periodo),
            )
            # Reforma de pensiones (Ley 21.735): aporte a la cuenta individual,
            # rentabilidad protegida y expectativa de vida.
            reforma = par['tasa_afp_empleador'] + par['tasa_rentabilidad_protegida'] + par['tasa_expectativa_vida']
            return int(renta * (par['tasa_sis'] + par['tasa_mutual_base'] + reforma) + renta_afc * tasa_afc)

        def clp(n):
            if not n: return '$0'
            return f'${int(n):,}'.replace(',', '.')

        # ── Datos compartidos ─────────────────────────────────────────────────
        from collections import defaultdict
        masa_salarial = liquido_total = costo_empleador = 0
        empleados_ids = set()
        empresas_dict = defaultdict(lambda: {
            'id': None, 'nombre': '', 'rut': '',
            'trabajadores': 0, 'masa_salarial': 0,
            'liquido_total': 0, 'costo_empleador': 0,
        })
        for liq in qs_periodo:
            ce = _costo_emp(liq)
            masa_salarial   += liq.total_haberes
            liquido_total   += liq.sueldo_liquido
            costo_empleador += ce
            empleados_ids.add(liq.empleado_id)
            eid = liq.empleado.empresa_id
            emp = liq.empleado.empresa
            d = empresas_dict[eid]
            d['id']             = eid
            d['nombre']         = emp.nombre_legal
            d['rut']            = emp.rut
            d['trabajadores']  += 1
            d['masa_salarial'] += liq.total_haberes
            d['liquido_total'] += liq.sueldo_liquido
            d['costo_empleador'] += ce

        empresas_list = sorted(empresas_dict.values(), key=lambda x: x['masa_salarial'], reverse=True)

        MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
        MESES_LARGOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        evolucion = []
        for m in range(1, 13):
            qs_m = base_qs.filter(mes=m)
            if qs_m.exists():
                ms = sum(l.total_haberes   for l in qs_m)
                lq = sum(l.sueldo_liquido  for l in qs_m)
                ce = sum(_costo_emp(l)     for l in qs_m)
                tw = qs_m.values('empleado_id').distinct().count()
            else:
                ms = lq = ce = tw = 0
            evolucion.append({'mes': m, 'mes_nombre': MESES_CORTOS[m-1],
                              'masa_salarial': ms, 'liquido_total': lq,
                              'costo_empleador': ce, 'trabajadores': tw})

        kpis = {
            'masa_salarial':   masa_salarial,
            'trabajadores':    len(empleados_ids),
            'costo_empleador': costo_empleador,
            'liquido_total':   liquido_total,
        }
        periodo_nombre = MESES_LARGOS[mes - 1] if mes else f'Año {anio}'
        nombre_base = f'Consolidado_{periodo_nombre.replace(" ","_")}_{anio}'

        # ══════════════════════════════════════════════════════════════════════
        # RAMA JSON
        # ══════════════════════════════════════════════════════════════════════
        if formato == 'json':
            return Response({
                'periodo': {'anio': anio, 'mes': mes, 'mes_nombre': MESES_LARGOS[mes-1] if mes else None},
                'kpis': kpis,
                'empresas': empresas_list,
                'evolucion': evolucion,
            })

        # ══════════════════════════════════════════════════════════════════════
        # RAMA EXCEL
        # ══════════════════════════════════════════════════════════════════════
        if formato == 'excel':
            from openpyxl import Workbook
            from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
            from openpyxl.utils import get_column_letter

            wb = Workbook()

            # ── Hoja 1: Resumen ───────────────────────────────────────────────
            ws = wb.active
            ws.title = 'Resumen'

            hdr_fill  = PatternFill('solid', fgColor='1E3A5F')
            tot_fill  = PatternFill('solid', fgColor='FEF3C7')
            kpi_fill  = PatternFill('solid', fgColor='0F2540')
            thin = Side(style='thin', color='CCCCCC')
            bord = Border(left=thin, right=thin, top=thin, bottom=thin)

            def _set(cell, val, bold=False, fill=None, align='left', color='000000'):
                cell.value = val
                cell.font  = Font(bold=bold, color=color, size=10)
                cell.alignment = Alignment(horizontal=align, vertical='center', wrap_text=True)
                if fill: cell.fill = fill
                cell.border = bord

            # Title
            ws.merge_cells('A1:G1')
            t = ws['A1']
            t.value = f'Reporte Consolidado de Remuneraciones · {periodo_nombre} {anio}'
            t.font  = Font(bold=True, size=13, color='FFFFFF')
            t.fill  = PatternFill('solid', fgColor='0C1A35')
            t.alignment = Alignment(horizontal='center', vertical='center')
            ws.row_dimensions[1].height = 28

            ws.merge_cells('A2:G2')
            ws['A2'].value = f'Generado el {timezone.now().date().strftime("%d/%m/%Y")} · {len(empresas_list)} empresa(s) · {kpis["trabajadores"]} trabajadore(s)'
            ws['A2'].font  = Font(size=9, color='888888')
            ws['A2'].alignment = Alignment(horizontal='center', vertical='center')
            ws.row_dimensions[2].height = 16

            # KPI row
            kpi_labels = ['Masa salarial', 'Trabajadores', 'Costo empleador', 'Líquido a pagar']
            kpi_vals   = [clp(kpis['masa_salarial']), str(kpis['trabajadores']),
                          clp(kpis['costo_empleador']), clp(kpis['liquido_total'])]
            kpi_cols   = [('A','B'), ('C','C'), ('D','E'), ('F','G')]
            ws.row_dimensions[3].height = 14
            ws.row_dimensions[4].height = 22
            ws.row_dimensions[5].height = 22
            ws.row_dimensions[6].height = 8
            for (c1, c2), lbl, val in zip(kpi_cols, kpi_labels, kpi_vals):
                ws.merge_cells(f'{c1}4:{c2}4')
                ws.merge_cells(f'{c1}5:{c2}5')
                lc = ws[f'{c1}4']
                lc.value = lbl; lc.font = Font(bold=True, size=8, color='AAAAAA')
                lc.fill = kpi_fill; lc.alignment = Alignment(horizontal='center', vertical='center')
                vc = ws[f'{c1}5']
                vc.value = val; vc.font = Font(bold=True, size=11, color='FFFFFF')
                vc.fill = kpi_fill; vc.alignment = Alignment(horizontal='center', vertical='center')

            # Table header
            cols_h = ['Empresa', 'RUT', 'Trabajadores', 'Masa Salarial', 'Costo Empleador', 'Líquido', '% del Total']
            for ci, h in enumerate(cols_h, 1):
                c = ws.cell(row=7, column=ci)
                _set(c, h, bold=True, fill=hdr_fill, align='center', color='FFFFFF')
            ws.row_dimensions[7].height = 20

            for ri, emp in enumerate(empresas_list, 8):
                pct = round(emp['masa_salarial'] / masa_salarial * 100, 1) if masa_salarial else 0
                row_fill = PatternFill('solid', fgColor='F0F4F8') if ri % 2 == 0 else None
                vals = [emp['nombre'], emp['rut'], emp['trabajadores'],
                        clp(emp['masa_salarial']), clp(emp['costo_empleador']),
                        clp(emp['liquido_total']), f'{pct}%']
                aligns = ['left','center','center','right','right','right','center']
                for ci, (v, a) in enumerate(zip(vals, aligns), 1):
                    _set(ws.cell(row=ri, column=ci), v, fill=row_fill, align=a)
                ws.row_dimensions[ri].height = 18

            # Totals
            tr = len(empresas_list) + 8
            tot_vals = ['TOTAL CONSOLIDADO', '', kpis['trabajadores'],
                        clp(kpis['masa_salarial']), clp(kpis['costo_empleador']),
                        clp(kpis['liquido_total']), '100%']
            for ci, v in enumerate(tot_vals, 1):
                a = 'right' if ci >= 4 else ('center' if ci == 3 else 'left')
                _set(ws.cell(row=tr, column=ci), v, bold=True, fill=tot_fill, align=a)
            ws.row_dimensions[tr].height = 20

            # Column widths
            for ci, w in enumerate([38, 14, 13, 18, 18, 18, 12], 1):
                ws.column_dimensions[get_column_letter(ci)].width = w
            ws.freeze_panes = 'A8'

            # ── Hoja 2: Evolución mensual ─────────────────────────────────────
            ws2 = wb.create_sheet('Evolución mensual')
            evo_headers = ['Mes', 'Masa Salarial', 'Líquido', 'Costo Empleador', 'Trabajadores']
            for ci, h in enumerate(evo_headers, 1):
                c = ws2.cell(row=1, column=ci)
                _set(c, h, bold=True, fill=hdr_fill, align='center', color='FFFFFF')
                ws2.row_dimensions[1].height = 20

            for ri, ev in enumerate(evolucion, 2):
                row_fill = PatternFill('solid', fgColor='F0F4F8') if ri % 2 == 0 else None
                vals = [ev['mes_nombre'], clp(ev['masa_salarial']), clp(ev['liquido_total']),
                        clp(ev['costo_empleador']), ev['trabajadores']]
                aligns = ['center','right','right','right','center']
                for ci, (v, a) in enumerate(zip(vals, aligns), 1):
                    _set(ws2.cell(row=ri, column=ci), v, fill=row_fill, align=a)
                ws2.row_dimensions[ri].height = 17

            for ci, w in enumerate([14, 18, 18, 18, 14], 1):
                ws2.column_dimensions[get_column_letter(ci)].width = w

            ws.page_setup.orientation = 'landscape'
            ws.page_setup.paperSize   = ws.PAPERSIZE_LETTER
            ws2.page_setup.orientation = 'landscape'
            ws2.page_setup.paperSize   = ws2.PAPERSIZE_LETTER

            buf = io.BytesIO()
            wb.save(buf); buf.seek(0)
            response = HttpResponse(buf.read(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="{nombre_base}.xlsx"'
            return response

        # ══════════════════════════════════════════════════════════════════════
        # RAMA PDF
        # ══════════════════════════════════════════════════════════════════════
        if formato == 'pdf':
            for emp in empresas_list:
                emp['pct'] = round(emp['masa_salarial'] / masa_salarial * 100, 1) if masa_salarial else 0
                emp['masa_salarial_fmt']   = clp(emp['masa_salarial'])
                emp['costo_empleador_fmt'] = clp(emp['costo_empleador'])
                emp['liquido_total_fmt']   = clp(emp['liquido_total'])
            for ev in evolucion:
                ev['masa_salarial_fmt']   = clp(ev['masa_salarial'])
                ev['liquido_total_fmt']   = clp(ev['liquido_total'])
                ev['costo_empleador_fmt'] = clp(ev['costo_empleador'])

            context = {
                'periodo_nombre':  periodo_nombre,
                'anio':            anio,
                'mes':             mes,
                'kpis':            kpis,
                'kpis_fmt': {
                    'masa_salarial':   clp(kpis['masa_salarial']),
                    'costo_empleador': clp(kpis['costo_empleador']),
                    'liquido_total':   clp(kpis['liquido_total']),
                    'trabajadores':    kpis['trabajadores'],
                },
                'empresas':        empresas_list,
                'evolucion':       evolucion,
                'n_empresas':      len(empresas_list),
                'fecha_emision':   timezone.now().date().strftime('%d/%m/%Y'),
            }
            template = get_template('consolidado_remuneraciones.html')
            html = template.render(context)
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{nombre_base}.pdf"'
            pisa_status = pisa.CreatePDF(html, dest=response)
            if pisa_status.err:
                return Response({'error': 'Error al generar PDF'}, status=500)
            return response

        return Response({'error': 'Formato no válido. Use json, excel o pdf.'}, status=400)

# ==========================================
# PREVIRED EXPORT
# ==========================================

_AFP_CODIGOS_PREVIRED = {
    'CAPITAL': '03', 'CUPRUM': '04', 'HABITAT': '05',
    'MODELO': '08', 'PLANVITAL': '06', 'PROVIDA': '07', 'UNO': '10', 'IPS': '00',
}

_ISAPRE_CODIGOS_PREVIRED = {
    'BANMEDICA': '01', 'COLMENA': '02', 'CRUZ_BLANCA': '03',
    'ESENCIAL': '04', 'VIDA_TRES': '05', 'SAN_LORENZO': '06',
    'NUEVA_MASVIDA': '07', 'CONSALUD': '08',
}

_TIPO_CONTRATO_PREVIRED = {
    'INDEFINIDO': '1', 'PLAZO_FIJO': '2', 'OBRA_FAENA': '3',
}

_TIPO_JORNADA_PREVIRED = {
    'ORDINARIA': '1', 'TURNOS': '1', 'BISMANAL': '1',
    'ART_22': '2', 'PARCIAL': '2', 'OTRO': '1',
}

_MUTUAL_DEFAULT = '01'  # ISL por defecto
# Las tasas (SIS, mutual, AFC, expectativa de vida) viven en
# ParametroPrevisional: cambian por ley y se versionan por período.


def _rut_partes(rut_str: str):
    """Devuelve (numero_str, dv_str) desde un RUT como '12.345.678-9'."""
    limpio = (rut_str or '').replace('.', '').replace(' ', '').upper()
    if '-' in limpio:
        num, dv = limpio.rsplit('-', 1)
    elif len(limpio) > 1:
        num, dv = limpio[:-1], limpio[-1]
    else:
        return '0', '0'
    return num.lstrip('0') or '0', dv


def _fmt_fecha_previred(f) -> str:
    """Convierte fecha a DDMMAAAA o cadena vacía."""
    if not f:
        return ''
    try:
        if isinstance(f, str):
            d = datetime.date.fromisoformat(f)
        else:
            d = f
        return d.strftime('%d%m%Y')
    except Exception:
        return ''


# ==========================================
# FINIQUITO
# ==========================================

# Causales que dan derecho a indemnización por años (Art. 161)
_CAUSALES_CON_INDEMNIZACION = {'161_1', '161_2', '163bis'}
# Tope de la base de las indemnizaciones por término (Art. 172 inc. final).
_TOPE_BASE_INDEMNIZACION_UF = 90
# Tope de años de la indemnización por años de servicio (Art. 163 inc. 2°):
# 330 días de remuneración para contratos posteriores al 14-08-1981.
_TOPE_ANIOS_INDEMNIZACION = 11


def _anios_indemnizacion(fecha_ingreso, fecha_termino) -> int:
    """Años para la indemnización del Art. 163: 30 días por año de servicio y
    fracción superior a seis meses, con tope de 11. Exige un año o más de
    contrato vigente."""
    if not fecha_ingreso or fecha_termino < fecha_ingreso:
        return 0
    tiempo = relativedelta(fecha_termino, fecha_ingreso)
    if tiempo.years < 1:
        return 0
    anios = tiempo.years
    # Fracción superior a seis meses: más de 6 meses cumplidos (6 meses y 1 día).
    if tiempo.months > 6 or (tiempo.months == 6 and tiempo.days > 0):
        anios += 1
    return min(anios, _TOPE_ANIOS_INDEMNIZACION)


def _feriado_proporcional_habiles(empleado, fecha_termino) -> float:
    """Días hábiles de feriado ganados en el año en curso y no completados
    (Art. 73): 15 días por año, es decir 1,25 por mes, desde el último
    aniversario hasta el término."""
    if not empleado.fecha_ingreso or fecha_termino < empleado.fecha_ingreso:
        return 0.0
    tiempo = relativedelta(fecha_termino, empleado.fecha_ingreso)
    return round((tiempo.months + tiempo.days / 30) * 15 / 12, 2)


def _dias_corridos_de_feriado(fecha_termino, dias_habiles: float) -> float:
    """Convierte días hábiles de feriado a días corridos para pagarlos.

    Criterio de la Dirección del Trabajo: se cuentan desde el día siguiente al
    término y se agregan los sábados, domingos y feriados que caigan en ese
    período. La fracción de día que sobra se paga tal cual.
    """
    enteros = int(dias_habiles)
    fraccion = round(dias_habiles - enteros, 2)
    corridos = 0
    fecha = fecha_termino
    contados = 0
    while contados < enteros:
        fecha += datetime.timedelta(days=1)
        corridos += 1
        if _es_dia_habil_feriado(fecha):
            contados += 1
    return corridos + fraccion


def _gratificacion_anual_proporcional(empleado, sueldo_base, fecha_termino, sueldo_ultimo_mes, parametros):
    """Gratificación proporcional del año en que termina un contrato con gratificación anual (Art. 52).

    Se calcula con la modalidad del Art. 50: 25 % de las remuneraciones
    devengadas en el año calendario hasta el término, con tope de 4,75
    ingresos mínimos mensuales proporcional a los meses trabajados. Si la
    empresa paga por utilidades (Art. 47), el monto debe ajustarse: se avisa.

    Devuelve el monto y el detalle por mes (base imponible de cada mes), que
    sirve para distribuir cotizaciones e impuesto en los meses devengados.
    """
    inicio = datetime.date(fecha_termino.year, 1, 1)
    desde = max(inicio, empleado.fecha_ingreso) if empleado.fecha_ingreso else inicio
    if desde > fecha_termino:
        return 0, [], 0, 0.0, 0
    liquidaciones = {l.mes: l for l in Liquidacion.objects.filter(
        empleado=empleado, anio=fecha_termino.year, mes__gte=desde.month, mes__lt=fecha_termino.month)}
    meses = []
    for mes in range(desde.month, fecha_termino.month):
        liq = liquidaciones.get(mes)
        if liq:
            base = int(liq.total_imponible or 0) - int(liq.gratificacion or 0)
        elif mes == desde.month and desde.day > 1:
            base = math.floor(sueldo_base / 30 * (31 - desde.day))  # ingreso a mitad de mes
        else:
            base = sueldo_base
        meses.append((mes, max(base, 0)))
    meses.append((fecha_termino.month, sueldo_ultimo_mes))
    devengado = sum(b for _, b in meses)
    tiempo = relativedelta(fecha_termino + datetime.timedelta(days=1), desde)
    meses_trabajados = min(12.0, tiempo.years * 12 + tiempo.months + tiempo.days / 30)
    tope = math.floor(parametros['factor_gratificacion'] * parametros['ingreso_minimo_mensual'] * meses_trabajados / 12)
    return min(math.floor(devengado * 0.25), tope), meses, devengado, round(meses_trabajados, 2), tope


# Haberes que el Art. 172 excluye de la base (asignación familiar legal,
# aguinaldos) o que no remuneran servicios sino que reembolsan gastos o
# cubren un beneficio legal (Art. 41 inc. 2°). Colación y movilización
# pagadas cada mes sí entran: criterio mayoritario de la Corte Suprema.
_EXCLUIDOS_BASE_INDEMNIZACION = {'ASIGNACION_FAMILIAR', 'AGUINALDO', 'VIATICO', 'PERDIDA_CAJA',
                                 'DESGASTE_HERRAMIENTAS', 'SALA_CUNA'}


def _base_indemnizacion_art172(empleado, sueldo_base, fecha_termino, gratificacion_mensual_pactada, tope_gratificacion):
    """Última remuneración mensual para las indemnizaciones (Art. 172).

    Sueldo base del contrato + los haberes que se pagan regularmente, tomados
    de las últimas tres liquidaciones: lo fijo (bonos mensuales, colación,
    movilización) y lo variable (comisiones, semana corrida, tratos) por su
    promedio, como ordena el inciso 2°. Un haber que aparece en un solo mes
    de tres es esporádico y queda fuera; las horas extra, siempre.
    La gratificación mensual pactada se suma sobre esa base con su tope.

    Devuelve (base sin tope, líneas del detalle, meses usados).
    """
    liquidaciones = list(Liquidacion.objects.filter(empleado=empleado)
                         .filter(Q(anio__lt=fecha_termino.year) | Q(anio=fecha_termino.year, mes__lte=fecha_termino.month))
                         .order_by('-anio', '-mes')[:3])
    n = len(liquidaciones)
    codigos = dict(ConceptoRemuneracion.objects.filter(
        id__in={i.get('concepto') for l in liquidaciones for i in (l.detalle_items or []) if i.get('concepto')}
    ).values_list('id', 'codigo'))

    haberes = {}   # clave → [glosa, total, meses presente, variable, afecta gratificación]
    for liq in liquidaciones:
        vistos = set()
        for item in liq.detalle_items or []:
            naturaleza = item.get('naturaleza')
            if naturaleza not in ('HABER_IMPONIBLE', 'HABER_NO_IMPONIBLE', 'COMISION'):
                continue
            if codigos.get(item.get('concepto')) in _EXCLUIDOS_BASE_INDEMNIZACION:
                continue
            clave = item.get('concepto') or (item.get('glosa') or '').strip().lower()
            h = haberes.setdefault(clave, [item.get('glosa') or 'Haber', 0, 0, naturaleza == 'COMISION',
                                           naturaleza != 'HABER_NO_IMPONIBLE'])
            h[1] += int(item.get('valor') or 0)
            if clave not in vistos:
                h[2] += 1
                vistos.add(clave)
        if liq.semana_corrida:
            h = haberes.setdefault('semana_corrida', ['Semana corrida', 0, 0, True, True])
            h[1] += int(liq.semana_corrida)
            h[2] += 1

    lineas = [{'glosa': 'Sueldo base', 'monto': sueldo_base}]
    afecto_gratificacion = sueldo_base
    for glosa, total, presente, variable, afecta in haberes.values():
        # Lo variable se promedia siempre; lo fijo solo si se repite.
        if not variable and n > 1 and presente < 2:
            continue
        # Lo variable, promedio de los meses (inc. 2°); lo fijo, su monto mensual.
        monto = math.floor(total / (n if variable else presente))
        if monto <= 0:
            continue
        lineas.append({'glosa': f'{glosa} (promedio {n} {"mes" if n == 1 else "meses"})' if variable else glosa,
                       'monto': monto})
        if afecta:
            afecto_gratificacion += monto
    if gratificacion_mensual_pactada:
        lineas.append({'glosa': 'Gratificación mensual', 'monto': min(math.floor(afecto_gratificacion * 0.25), tope_gratificacion)})
    return sum(l['monto'] for l in lineas), lineas, n


def _calcular_finiquito(empleado, fecha_termino, dias_trabajados_ultimo_mes, causal_articulo,
                        aviso_previo_dado=False, otros_haberes=0, otros_descuentos=0):
    """Montos del finiquito y su detalle. Todo lo legal se calcula aquí.

    El usuario solo aporta hechos (causal, fecha, días trabajados, si dio el
    aviso previo) y montos voluntarios (otros haberes y descuentos): nunca
    los montos que fija la ley.
    """
    contrato = Contrato.objects.filter(empleado=empleado).first()
    sueldo_base = contrato.sueldo_base if contrato else empleado.sueldo_base
    tipo_contrato = contrato.tipo_contrato if contrato else 'INDEFINIDO'
    gratificacion_mensual_pactada = (contrato.gratificacion_legal if contrato else 'MENSUAL') == 'MENSUAL'

    parametros = _parametros_previsionales(fecha_termino.month, fecha_termino.year)
    valor_uf = obtener_uf()
    tope_gratificacion = math.floor(parametros['factor_gratificacion'] * parametros['ingreso_minimo_mensual'] / 12)

    # ── Remuneración del último mes ──────────────────────────────────────
    dias = max(0, min(30, int(dias_trabajados_ultimo_mes)))
    sueldo_proporcional = math.floor((sueldo_base / 30) * dias)
    grat_anual = None
    if gratificacion_mensual_pactada:
        gratificacion = min(math.floor(sueldo_proporcional * 0.25), tope_gratificacion)
    else:
        grat_anual = _gratificacion_anual_proporcional(empleado, sueldo_base, fecha_termino, sueldo_proporcional, parametros)
        gratificacion = grat_anual[0]

    # ── Feriado: saldo de años cumplidos + proporcional del año en curso ──
    saldo = calcular_saldo_vacaciones(empleado, hasta=fecha_termino)['dias_disponibles']
    proporcional = _feriado_proporcional_habiles(empleado, fecha_termino)
    dias_habiles_feriado = round(saldo + proporcional, 2)
    dias_corridos_feriado = _dias_corridos_de_feriado(fecha_termino, dias_habiles_feriado)
    feriado = math.floor((sueldo_base / 30) * dias_corridos_feriado)

    # ── Indemnizaciones (Arts. 161, 162, 163, 163 bis y 172) ──────────────
    # Base: última remuneración mensual (Art. 172), con tope de 90 UF.
    base_indemnizacion_sin_tope, base_lineas, base_meses = _base_indemnizacion_art172(
        empleado, sueldo_base, fecha_termino, gratificacion_mensual_pactada, tope_gratificacion)
    tope_base = _tope_en_pesos(_TOPE_BASE_INDEMNIZACION_UF, valor_uf)
    base_indemnizacion = min(base_indemnizacion_sin_tope, tope_base)
    con_indemnizacion = causal_articulo in _CAUSALES_CON_INDEMNIZACION
    anios = _anios_indemnizacion(empleado.fecha_ingreso, fecha_termino) if con_indemnizacion else 0
    indemnizacion_anos = base_indemnizacion * anios
    sustitutiva = base_indemnizacion if (con_indemnizacion and not aviso_previo_dado) else 0

    # ── Descuentos legales sobre la remuneración del último mes ───────────
    # La gratificación anual no entra aquí: se distribuye más abajo.
    imponible = sueldo_proporcional + (0 if grat_anual else gratificacion)
    tope_afp = _tope_en_pesos(parametros['tope_imponible_afp_uf'], valor_uf)
    tope_afc = _tope_en_pesos(parametros['tope_imponible_afc_uf'], valor_uf)
    renta_afp = min(imponible, tope_afp)
    renta_afc = min(imponible, tope_afc)
    nombre_afp = (empleado.afp or 'MODELO').upper()
    tasa_afp = _tasas_afp(fecha_termino.month, fecha_termino.year).get(nombre_afp, 0.11)
    afp_monto = math.floor(renta_afp * tasa_afp)
    salud_nombre = (empleado.sistema_salud or 'FONASA').upper()
    salud_monto = math.floor(renta_afp * parametros['tasa_salud'])
    if salud_nombre == 'ISAPRE' and empleado.plan_isapre_uf and float(empleado.plan_isapre_uf) > 0:
        salud_monto = max(math.floor(float(empleado.plan_isapre_uf) * valor_uf * dias / 30), salud_monto)
    anios_servicio = _anios_de_servicio(empleado, contrato, fecha_termino.month, fecha_termino.year)
    tasa_afc, _ = _tasas_afc(parametros, tipo_contrato, anios_servicio)
    afc_monto = math.floor(renta_afc * tasa_afc)
    valor_utm = obtener_utm()
    impuesto = calcular_impuesto_unico(max(imponible - afp_monto - salud_monto - afc_monto, 0), valor_utm)

    if grat_anual and gratificacion:
        # DL 3.500 Art. 28 y LIR Art. 46: una gratificación anual cotiza y
        # tributa distribuida en los meses en que se devengó, con el tope y
        # la tabla de cada mes; no toda de golpe en el mes del finiquito.
        _, meses_grat, _, _, _ = grat_anual
        cuota = gratificacion / len(meses_grat)
        tasa_trab = tasa_afp + parametros['tasa_salud'] + tasa_afc
        for _, base_mes in meses_grat:
            cot_afp = min(cuota, max(tope_afp - base_mes, 0))
            cot_afc = min(cuota, max(tope_afc - base_mes, 0))
            afp_monto += math.floor(cot_afp * tasa_afp)
            salud_monto += math.floor(cot_afp * parametros['tasa_salud'])
            afc_monto += math.floor(cot_afc * tasa_afc)
            tributable = base_mes * (1 - tasa_trab)
            impuesto += max(calcular_impuesto_unico(tributable + cuota * (1 - tasa_trab), valor_utm)
                            - calcular_impuesto_unico(tributable, valor_utm), 0)
    descuentos_prevision = afp_monto + salud_monto + afc_monto + impuesto

    otros_haberes = max(int(otros_haberes or 0), 0)
    otros_descuentos = max(int(otros_descuentos or 0), 0)
    total = (sueldo_proporcional + gratificacion + feriado + indemnizacion_anos + sustitutiva
             + otros_haberes - otros_descuentos - descuentos_prevision)

    montos = {
        'sueldo_base':                  sueldo_base,
        'dias_trabajados_ultimo_mes':   dias,
        'gratificacion_proporcional':   gratificacion,
        'feriado_proporcional':         feriado,
        'indemnizacion_anos_servicio':  indemnizacion_anos,
        'indemnizacion_sustitutiva_aviso': sustitutiva,
        'otros_haberes':                otros_haberes,
        'otros_descuentos':             otros_descuentos,
        'descuentos_prevision':         descuentos_prevision,
        'total_a_pagar':                max(total, 0),
    }
    detalle = {
        'sueldo_proporcional': sueldo_proporcional,
        'feriado_dias_saldo': saldo, 'feriado_dias_proporcionales': proporcional,
        'feriado_dias_habiles': dias_habiles_feriado, 'feriado_dias_corridos': dias_corridos_feriado,
        'con_indemnizacion': con_indemnizacion, 'anios_indemnizacion': anios,
        'base_indemnizacion': base_indemnizacion, 'base_indemnizacion_topada': base_indemnizacion_sin_tope > tope_base,
        'tope_base_indemnizacion': tope_base,
        'base_indemnizacion_detalle': base_lineas, 'base_indemnizacion_meses': base_meses,
        **({'aviso_base_indemnizacion': (
            'Sin liquidaciones emitidas: la base considera solo el sueldo base y la gratificación. '
            'Si el trabajador recibe bonos, colación, movilización o comisiones, emite sus liquidaciones antes del finiquito.'
            if base_meses == 0 else
            f'La base usa {base_meses} {"liquidación" if base_meses == 1 else "liquidaciones"} de las tres que pide el Art. 172 '
            'para promediar lo variable; con menos meses no se distinguen bien los haberes esporádicos. Revísala.'),
        } if con_indemnizacion and base_meses < 3 else {}),
        'afp_nombre': nombre_afp, 'afp': afp_monto, 'salud_nombre': salud_nombre, 'salud': salud_monto,
        'seguro_cesantia': afc_monto, 'impuesto_unico': impuesto,
        'gratificacion_modalidad': 'ANUAL' if grat_anual else 'MENSUAL',
        **({
            'gratificacion_devengado_anio': grat_anual[2], 'gratificacion_meses': grat_anual[3],
            'gratificacion_tope': grat_anual[4],
            'aviso_gratificacion': ('Gratificación anual calculada con el Art. 50 (25 % de lo devengado en el año, '
                                    'tope 4,75 ingresos mínimos proporcional). Si la empresa paga por utilidades '
                                    '(Art. 47), el monto que corresponde puede ser distinto.'),
        } if grat_anual else {}),
    }
    return montos, detalle


class FiniquitoViewSet(viewsets.ModelViewSet):
    serializer_class = FiniquitoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Finiquito.objects.filter(
            empleado__empresa__owner=self.request.user
        ).order_by('-fecha_emision')
        empleado_id = self.request.query_params.get('empleado')
        if empleado_id:
            qs = qs.filter(empleado_id=empleado_id)
        return qs

    _ERROR_PLAN = 'Los finiquitos están disponibles desde el plan Starter. Mejora tu suscripción para acceder a esta función.'

    def _entrada(self, request, empleado=None, base=None):
        """Lee los hechos del finiquito. Los montos legales nunca se aceptan del cliente."""
        data = request.data
        base = base or {}
        if empleado is None:
            try:
                empleado = Empleado.objects.get(id=data.get('empleado'), empresa__owner=request.user)
            except (Empleado.DoesNotExist, ValueError, TypeError):
                raise NotFound('Empleado no encontrado.')
        try:
            fecha_termino = datetime.date.fromisoformat(str(data.get('fecha_termino', base.get('fecha_termino', ''))))
        except (ValueError, TypeError):
            raise ValidationError({'error': 'Fecha de término inválida.'})
        if empleado.fecha_ingreso and fecha_termino < empleado.fecha_ingreso:
            raise ValidationError({'error': 'La fecha de término es anterior al ingreso del trabajador.'})
        try:
            entrada = {
                'dias_trabajados_ultimo_mes': int(data.get('dias_trabajados_ultimo_mes', base.get('dias_trabajados_ultimo_mes', 30))),
                'causal_articulo': str(data.get('causal_articulo', base.get('causal_articulo', ''))),
                'aviso_previo_dado': str(data.get('aviso_previo_dado', base.get('aviso_previo_dado', False))).lower() in ('true', '1'),
                'otros_haberes': int(data.get('otros_haberes', base.get('otros_haberes', 0)) or 0),
                'otros_descuentos': int(data.get('otros_descuentos', base.get('otros_descuentos', 0)) or 0),
            }
        except (ValueError, TypeError):
            raise ValidationError({'error': 'Días, otros haberes y otros descuentos deben ser números.'})
        if entrada['causal_articulo'] not in dict(Finiquito.CAUSAL_ARTICULO_CHOICES):
            raise ValidationError({'error': 'Selecciona una causal de término válida.'})
        if entrada['otros_haberes'] < 0 or entrada['otros_descuentos'] < 0:
            raise ValidationError({'error': 'Otros haberes y descuentos no pueden ser negativos.'})
        return empleado, fecha_termino, entrada

    def _calcular(self, empleado, fecha_termino, entrada):
        return _calcular_finiquito(
            empleado, fecha_termino, entrada['dias_trabajados_ultimo_mes'], entrada['causal_articulo'],
            aviso_previo_dado=entrada['aviso_previo_dado'],
            otros_haberes=entrada['otros_haberes'], otros_descuentos=entrada['otros_descuentos'])

    @action(detail=False, methods=['post'])
    def simular(self, request):
        """Vista previa: el mismo cálculo que al guardar, sin guardar."""
        if not _plan_permite(request.user, 2):
            return Response({'error': self._ERROR_PLAN}, status=status.HTTP_403_FORBIDDEN)
        empleado, fecha_termino, entrada = self._entrada(request)
        montos, detalle = self._calcular(empleado, fecha_termino, entrada)
        return Response({**montos, 'detalle': detalle, 'aviso_previo_dado': entrada['aviso_previo_dado'],
                         'causal_articulo': entrada['causal_articulo'], 'fecha_termino': fecha_termino.isoformat()})

    def create(self, request, *args, **kwargs):
        if not _plan_permite(request.user, 2):
            return Response({'error': self._ERROR_PLAN}, status=status.HTTP_403_FORBIDDEN)
        empleado, fecha_termino, entrada = self._entrada(request)
        montos, _ = self._calcular(empleado, fecha_termino, entrada)
        try:
            fecha_emision = datetime.date.fromisoformat(str(request.data.get('fecha_emision', datetime.date.today().isoformat())))
        except (ValueError, TypeError):
            fecha_emision = datetime.date.today()
        finiquito = Finiquito.objects.create(
            empleado=empleado,
            documento_legal_id=request.data.get('documento_legal') or None,
            causal_articulo=entrada['causal_articulo'],
            aviso_previo_dado=entrada['aviso_previo_dado'],
            fecha_termino=fecha_termino,
            fecha_emision=fecha_emision,
            modalidad=request.data.get('modalidad', 'PRESENCIAL'),
            **montos,
        )
        return Response(self.get_serializer(finiquito).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Editar recalcula todo con los hechos nuevos; firmado, ya no se toca."""
        instancia = self.get_object()
        if SolicitudFirma.objects.filter(finiquito=instancia, estado__in=('FIRMADO', 'PENDIENTE')).exists():
            return Response({'error': 'Este finiquito tiene una firma pendiente o ya fue firmado: no se puede modificar.'},
                            status=status.HTTP_403_FORBIDDEN)
        base = {
            'fecha_termino': instancia.fecha_termino.isoformat(), 'causal_articulo': instancia.causal_articulo,
            'dias_trabajados_ultimo_mes': instancia.dias_trabajados_ultimo_mes, 'aviso_previo_dado': instancia.aviso_previo_dado,
            'otros_haberes': instancia.otros_haberes, 'otros_descuentos': instancia.otros_descuentos,
        }
        _, fecha_termino, entrada = self._entrada(request, empleado=instancia.empleado, base=base)
        montos, _ = self._calcular(instancia.empleado, fecha_termino, entrada)
        for campo, valor in {**montos, 'fecha_termino': fecha_termino, 'causal_articulo': entrada['causal_articulo'],
                             'aviso_previo_dado': entrada['aviso_previo_dado']}.items():
            setattr(instancia, campo, valor)
        if 'modalidad' in request.data:
            instancia.modalidad = request.data['modalidad']
        if instancia.archivo_pdf:
            instancia.archivo_pdf.delete(save=False)  # el PDF anterior ya no refleja los montos
        instancia.save()
        return Response(self.get_serializer(instancia).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='generar_pdf')
    def generar_pdf(self, request, pk=None):
        try:
            finiquito = self.get_object()
            empleado  = finiquito.empleado
            empresa   = empleado.empresa

            def _fmt(f):
                if not f:
                    return '—'
                return f"{f.day:02d} de {_MESES[f.month - 1]} de {f.year}"

            ciudad = (getattr(empresa, 'comuna', '') or 'Santiago').strip().title()
            causal_label = finiquito.get_causal_articulo_display() if finiquito.causal_articulo else '—'

            sueldo_prop = math.floor(
                (finiquito.sueldo_base / 30) * finiquito.dias_trabajados_ultimo_mes
            )

            # Escapar campos de texto para prevenir inyección HTML/CSS en el PDF
            _ciudad      = _esc(ciudad)
            _causal      = _esc(causal_label)
            _nom_legal   = _esc(empresa.nombre_legal or '')
            _rut_emp     = _esc(empresa.rut or '')
            _trab_nombre = _esc(f"{empleado.nombres} {empleado.apellido_paterno} {empleado.apellido_materno or ''}")
            _trab_firma  = _esc(f"{empleado.nombres} {empleado.apellido_paterno}")
            _rut_trab    = _esc(empleado.rut or '')
            _cargo       = _esc(empleado.cargo or '—')
            _depto       = _esc(empleado.departamento or '—')
            _modalidad   = _esc(finiquito.get_modalidad_display())

            html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  @page {{ size: letter; margin: 2cm 2.5cm; }}
  body {{ font-family: Arial, sans-serif; font-size: 10pt; color: #111; line-height: 1.5; }}
  h1 {{ font-size: 14pt; text-align: center; text-transform: uppercase;
        letter-spacing: 2px; margin-bottom: 4px; }}
  h2 {{ font-size: 10pt; text-align: center; color: #555; margin-top: 0; margin-bottom: 20px; }}
  .seccion {{ margin-bottom: 16px; }}
  .seccion-titulo {{ font-size: 9pt; font-weight: bold; text-transform: uppercase;
                     letter-spacing: 1px; color: #555; border-bottom: 1px solid #ccc;
                     padding-bottom: 3px; margin-bottom: 8px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 10pt; }}
  table td {{ padding: 4px 6px; vertical-align: top; }}
  table td:last-child {{ text-align: right; font-weight: bold; }}
  .total-row td {{ border-top: 2px solid #333; font-weight: bold; font-size: 11pt;
                   padding-top: 8px; }}
  .firma-bloque {{ margin-top: 60px; display: flex; justify-content: space-between; }}
  .firma-item {{ text-align: center; width: 44%; }}
  .firma-linea {{ border-top: 1px solid #333; padding-top: 6px; margin-top: 50px; font-size: 9pt; }}
  p {{ margin: 4px 0; }}
  .aviso {{ font-size: 8pt; color: #666; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; }}
</style>
</head>
<body>

<h1>Finiquito de Contrato de Trabajo</h1>
<h2>{_ciudad}, {_fmt(finiquito.fecha_emision)}</h2>

<div class="seccion">
  <div class="seccion-titulo">Partes</div>
  <p><strong>Empleador:</strong> {_nom_legal} — RUT {_rut_emp}</p>
  <p><strong>Trabajador:</strong> {_trab_nombre} — RUT {_rut_trab}</p>
  <p><strong>Cargo:</strong> {_cargo} &nbsp;|&nbsp; <strong>Departamento:</strong> {_depto}</p>
  <p><strong>Fecha de ingreso:</strong> {_fmt(empleado.fecha_ingreso)} &nbsp;|&nbsp;
     <strong>Fecha de término:</strong> {_fmt(finiquito.fecha_termino)}</p>
  <p><strong>Causal de término:</strong> {_causal}</p>
</div>

<div class="seccion">
  <div class="seccion-titulo">Liquidación Final</div>
  <table>
    <tr><td>Sueldo base proporcional ({finiquito.dias_trabajados_ultimo_mes} días)</td>
        <td>${sueldo_prop:,.0f}</td></tr>
    <tr><td>Gratificación proporcional</td>
        <td>${finiquito.gratificacion_proporcional:,.0f}</td></tr>
    <tr><td>Feriado pendiente y proporcional ({(finiquito.feriado_proporcional * 30 // finiquito.sueldo_base) if finiquito.sueldo_base else 0} días corridos aprox.)</td>
        <td>${finiquito.feriado_proporcional:,.0f}</td></tr>
    {f'<tr><td>Indemnización por años de servicio (Art. 163)</td><td>${finiquito.indemnizacion_anos_servicio:,.0f}</td></tr>' if finiquito.indemnizacion_anos_servicio else ''}
    {f'<tr><td>Indemnización sustitutiva de aviso previo</td><td>${finiquito.indemnizacion_sustitutiva_aviso:,.0f}</td></tr>' if finiquito.indemnizacion_sustitutiva_aviso else ''}
    {f'<tr><td>Otros haberes</td><td>${finiquito.otros_haberes:,.0f}</td></tr>' if finiquito.otros_haberes else ''}
    <tr><td>Descuentos legales (AFP, salud, seguro de cesantía e impuesto)</td>
        <td>-${finiquito.descuentos_prevision:,.0f}</td></tr>
    {f'<tr><td>Otros descuentos</td><td>-${finiquito.otros_descuentos:,.0f}</td></tr>' if finiquito.otros_descuentos else ''}
    <tr class="total-row">
      <td>TOTAL A PAGAR</td>
      <td>${finiquito.total_a_pagar:,.0f}</td>
    </tr>
  </table>
</div>

<div class="seccion">
  <div class="seccion-titulo">Declaración del Trabajador</div>
  <p>El trabajador declara haber recibido a su entera satisfacción la suma indicada como total a pagar,
  y nada más tiene que reclamar al empleador por concepto alguno derivado de la relación laboral
  que los vinculó, quedando ambas partes en paz y a finiquito.</p>
  <p>Modalidad de suscripción del finiquito: <strong>{_modalidad}</strong></p>
</div>

<div class="firma-bloque">
  <div class="firma-item">
    <div class="firma-linea">
      <strong>{_nom_legal}</strong><br/>RUT {_rut_emp}<br/>Empleador
    </div>
  </div>
  <div class="firma-item">
    <div class="firma-linea">
      <strong>{_trab_firma}</strong><br/>RUT {_rut_trab}<br/>Trabajador
    </div>
  </div>
</div>

<p class="aviso">
  Finiquito regulado por los artículos 177 y siguientes del Código del Trabajo de la República de Chile.
  Generado por Jornada40 · {_fmt(finiquito.fecha_emision)}.
</p>

</body>
</html>"""

            buffer = io.BytesIO()
            pisa_status = pisa.CreatePDF(html, dest=buffer)
            if pisa_status.err:
                return Response({'error': 'Error al generar el PDF.'}, status=500)

            buffer.seek(0)
            response = HttpResponse(buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = (
                f'attachment; filename="finiquito_{empleado.rut}_{finiquito.fecha_termino}.pdf"'
            )
            return response

        except Finiquito.DoesNotExist:
            return Response({'error': 'Finiquito no encontrado.'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


# ==========================================
# FIRMA ELECTRÓNICA
# ==========================================

class SolicitudFirmaViewSet(viewsets.GenericViewSet):
    serializer_class = SolicitudFirmaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SolicitudFirma.objects.filter(
            empresa__owner=self.request.user
        ).select_related('empleado', 'empresa')

    def list(self, request):
        empleado_id = request.query_params.get('empleado_id')
        qs = self.get_queryset()
        if empleado_id:
            qs = qs.filter(empleado_id=empleado_id)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=['post'])
    def solicitar(self, request):
        empleado_id   = request.data.get('empleado_id')
        tipo_doc      = request.data.get('tipo_documento')
        contrato_id   = request.data.get('contrato_id')
        doc_legal_id  = request.data.get('documento_legal_id')
        anexo_id      = request.data.get('anexo_contrato_id')
        liquidacion_id = request.data.get('liquidacion_id')
        vacacion_id    = request.data.get('vacacion_id')
        finiquito_id   = request.data.get('finiquito_id')

        tipos_validos = [t[0] for t in SolicitudFirma.TIPOS_DOCUMENTO]
        if tipo_doc not in tipos_validos:
            return Response({'error': 'Tipo de documento inválido.'}, status=400)

        try:
            empleado = Empleado.objects.get(id=empleado_id, empresa__owner=request.user)
        except Empleado.DoesNotExist:
            return Response({'error': 'Trabajador no encontrado.'}, status=404)

        empresa = empleado.empresa

        if not empresa.firma_imagen:
            return Response(
                {'error': 'La empresa no tiene firma del empleador configurada. Configúrela en el Lobby de Empresas.'},
                status=400
            )

        email_trabajador = empleado.email
        if not email_trabajador:
            return Response(
                {'error': 'El trabajador no tiene email registrado. Agréguelo en Datos Generales antes de enviar a firma.'},
                status=400
            )

        es_plan_semilla = _es_plan_semilla(request.user)

        try:
            pdf_bytes, contrato_obj, doc_legal_obj, liquidacion_obj, vacacion_obj, finiquito_obj = self._generar_pdf_firma(
                empleado, empresa, tipo_doc,
                contrato_id, doc_legal_id, anexo_id,
                liquidacion_id, vacacion_id, finiquito_id, es_plan_semilla
            )
        except Exception as e:
            return Response({'error': str(e)}, status=400)

        key = b2_client.key_pendiente(empresa.id, str(uuid_mod.uuid4()))
        try:
            b2_client.subir_documento(pdf_bytes, key)
        except RuntimeError as e:
            return Response({'error': str(e)}, status=503)
        except Exception:
            return Response({'error': 'Error al subir el documento al almacenamiento.'}, status=500)

        # El anexo se enlaza explícitamente porque al firmarse aplica sus
        # cambios al contrato, y hay que saber cuál fue.
        anexo_obj = None
        if tipo_doc == 'ANEXO_CONTRATO' and anexo_id:
            anexo_obj = AnexoContrato.objects.filter(
                id=anexo_id, contrato__empleado=empleado
            ).first()

        try:
            solicitud = SolicitudFirma.objects.create(
                empleado=empleado,
                empresa=empresa,
                tipo_documento=tipo_doc,
                contrato=contrato_obj,
                documento_legal=doc_legal_obj,
                anexo_contrato=anexo_obj,
                liquidacion=liquidacion_obj,
                vacacion=vacacion_obj,
                finiquito=finiquito_obj,
                email_firmante=email_trabajador,
                b2_key_temporal=key,
            )
        except Exception as e:
            b2_client.eliminar_documento(key)
            return Response({'error': f'Error al registrar la solicitud: {e}'}, status=500)

        try:
            self._enviar_email_firma(solicitud, empleado, empresa)
        except Exception:
            pass

        return Response(SolicitudFirmaSerializer(solicitud).data, status=201)

    @action(detail=True, methods=['patch'])
    def cancelar(self, request, pk=None):
        solicitud = self.get_object()
        if solicitud.estado != 'PENDIENTE':
            return Response({'error': 'Solo se puede cancelar una solicitud pendiente.'}, status=400)
        solicitud.estado = 'CANCELADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response(SolicitudFirmaSerializer(solicitud).data)

    @action(detail=True, methods=['post'])
    def reenviar(self, request, pk=None):
        solicitud = self.get_object()
        if solicitud.estado != 'PENDIENTE':
            return Response({'error': 'Solo se puede reenviar una solicitud pendiente.'}, status=400)
        try:
            self._enviar_email_firma(solicitud, solicitud.empleado, solicitud.empresa)
        except Exception as e:
            return Response({'error': f'Error al reenviar el email: {str(e)}'}, status=500)
        return Response({'mensaje': 'Email de firma reenviado correctamente.'})

    @action(detail=True, methods=['post'])
    def descargar(self, request, pk=None):
        """Genera una URL presignada de corta duración para descargar el PDF firmado."""
        solicitud = self.get_object()
        if solicitud.estado != 'FIRMADO' or not solicitud.b2_key_firmado:
            return Response({'error': 'No hay PDF firmado disponible para esta solicitud.'}, status=400)
        try:
            url = b2_client.generar_url_presignada(solicitud.b2_key_firmado, ttl_segundos=300)
        except RuntimeError as exc:
            return Response({'error': str(exc)}, status=503)
        except Exception:
            return Response({'error': 'Error al generar el enlace de descarga.'}, status=500)
        return Response({'url': url})

    # -------------------------------------------------
    # Helpers internos
    # -------------------------------------------------

    MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
             "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

    def _generar_pdf_firma(self, empleado, empresa, tipo_doc,
                           contrato_id, doc_legal_id, anexo_id,
                           liquidacion_id, vacacion_id, finiquito_id, es_plan_semilla):
        """Genera el PDF a firmar y retorna (pdf_bytes, contrato, doc_legal, liquidacion, vacacion, finiquito)."""
        ciudad = str(
            getattr(empresa, 'ciudad', '') or getattr(empresa, 'comuna', '') or 'Santiago'
        ).strip().title()

        if tipo_doc == 'CONTRATO':
            try:
                contrato = (Contrato.objects.get(id=contrato_id)
                            if contrato_id else Contrato.objects.get(empleado=empleado))
            except Contrato.DoesNotExist:
                raise Exception('El trabajador no tiene contrato registrado.')
            ctx = _ctx_contrato(contrato, es_plan_semilla)
            html = render_to_string('contrato_trabajo.html', ctx)
            return _html_a_pdf_bytes(html, f'Contrato_{empleado.rut}'), contrato, None, None, None, None

        if tipo_doc == 'ANEXO_40H':
            try:
                contrato = (Contrato.objects.get(id=contrato_id)
                            if contrato_id else Contrato.objects.get(empleado=empleado))
            except Contrato.DoesNotExist:
                raise Exception('El trabajador no tiene contrato registrado.')
            ctx = _ctx_contrato(contrato, es_plan_semilla)
            html = render_to_string('anexo_40h.html', ctx)
            return _html_a_pdf_bytes(html, f'Anexo40h_{empleado.rut}'), contrato, None, None, None, None

        if tipo_doc in ('AMONESTACION', 'CONSTANCIA'):
            if doc_legal_id:
                try:
                    doc = DocumentoLegal.objects.get(id=doc_legal_id, empleado=empleado)
                except DocumentoLegal.DoesNotExist:
                    raise Exception('Documento legal no encontrado.')
            else:
                doc = DocumentoLegal.objects.filter(
                    empleado=empleado, tipo=tipo_doc
                ).order_by('-fecha_emision').first()
                if not doc:
                    raise Exception(f'No se encontró documento de tipo {tipo_doc}.')
            hoy = doc.fecha_emision
            fecha_es = f"{hoy.day:02d} de {self.MESES[hoy.month - 1]} de {hoy.year}"
            ctx = {'documento': doc, 'empleado': empleado, 'empresa': empresa,
                   'fecha_actual': fecha_es, 'ciudad': ciudad,
                   'es_plan_semilla': es_plan_semilla}
            html = render_to_string('documento_legal.html', ctx)
            return _html_a_pdf_bytes(html, f'{doc.tipo}_{empleado.rut}'), None, doc, None, None, None

        if tipo_doc == 'DESPIDO':
            if doc_legal_id:
                try:
                    doc = DocumentoLegal.objects.get(id=doc_legal_id, empleado=empleado)
                except DocumentoLegal.DoesNotExist:
                    raise Exception('Documento legal no encontrado.')
            else:
                doc = DocumentoLegal.objects.filter(
                    empleado=empleado, tipo='DESPIDO'
                ).order_by('-fecha_emision').first()
                if not doc:
                    raise Exception('No se encontró carta de despido.')
            pdf_bytes = self._pdf_para_documento_legal(doc, es_plan_semilla)
            return pdf_bytes, None, doc, None, None, None

        if tipo_doc == 'ANEXO_CONTRATO':
            if not anexo_id:
                raise Exception('Se requiere el ID del anexo de contrato.')
            try:
                contrato = Contrato.objects.get(empleado=empleado)
                anexo = AnexoContrato.objects.get(id=anexo_id, contrato=contrato)
            except (Contrato.DoesNotExist, AnexoContrato.DoesNotExist):
                raise Exception('Anexo de contrato no encontrado.')
            hoy = anexo.fecha_emision
            fecha_es = f"{hoy.day:02d} de {self.MESES[hoy.month - 1]} de {hoy.year}"
            ctx = {'anexo': anexo, 'contrato': contrato, 'empleado': empleado,
                   'empresa': empresa, 'fecha_actual': fecha_es, 'ciudad': ciudad,
                   'es_plan_semilla': es_plan_semilla}
            html = render_to_string('anexo_contrato.html', ctx)
            return _html_a_pdf_bytes(html, f'AnexoContrato_{empleado.rut}'), contrato, None, None, None, None

        if tipo_doc == 'LIQUIDACION':
            if not liquidacion_id:
                raise Exception('Se requiere el ID de la liquidación.')
            try:
                liq = Liquidacion.objects.get(id=liquidacion_id, empleado=empleado)
            except Liquidacion.DoesNotExist:
                raise Exception('Liquidación no encontrada.')
            contrato_liq = Contrato.objects.filter(empleado=empleado).first()
            meses = self.MESES
            mes_nombre = meses[liq.mes - 1]
            sueldo_seguro = int(liq.sueldo_liquido or 0)
            liquido_palabras = num2words(sueldo_seguro, lang='es')
            agrupados = liq.items_agrupados
            det_no_imp = agrupados['no_imponibles']
            suma_no_imponibles = sum(int(i.get('valor', 0)) for i in det_no_imp if isinstance(i, dict))
            det_otros = agrupados['descuentos']
            suma_otros_descuentos = sum(int(i.get('valor', 0)) for i in det_otros if isinstance(i, dict))
            total_ley = ((liq.afp_monto or 0) + (liq.salud_monto or 0) +
                         (liq.seguro_cesantia or 0) + (liq.impuesto_unico or 0))
            total_otros_dsctos = (liq.anticipo_quincena or 0) + suma_otros_descuentos
            ctx = {
                'liquidacion': liq, 'empleado': empleado, 'empresa': empresa,
                'contrato': contrato_liq,
                'mes_nombre': mes_nombre.upper(),
                'liquido_palabras': liquido_palabras,
                'total_no_imponible': suma_no_imponibles,
                'total_ley': total_ley,
                'total_otros_dsctos': total_otros_dsctos,
                'es_plan_semilla': es_plan_semilla,
            }
            html = render_to_string('liquidacion.html', ctx)
            return _html_a_pdf_bytes(html, f'Liquidacion_{liq.mes}_{liq.anio}_{empleado.rut}'), None, None, liq, None, None

        if tipo_doc == 'VACACION':
            if not vacacion_id:
                raise Exception('Se requiere el ID del comprobante de vacaciones.')
            try:
                vac = VacacionEmpleado.objects.get(id=vacacion_id, empleado=empleado)
            except VacacionEmpleado.DoesNotExist:
                raise Exception('Comprobante de vacaciones no encontrado.')
            hoy = datetime.date.today()
            fecha_hoy = f"{hoy.day:02d} de {self.MESES[hoy.month - 1]} de {hoy.year}"
            def _fmt(f):
                return f"{f.day:02d} de {self.MESES[f.month - 1]} de {f.year}" if f else '—'
            ctx = {
                'vacacion': vac, 'empleado': empleado, 'empresa': empresa,
                'fecha_actual': fecha_hoy,
                'fecha_inicio_texto': _fmt(vac.fecha_inicio),
                'fecha_fin_texto': _fmt(vac.fecha_fin),
                'ciudad': ciudad,
                'es_plan_semilla': es_plan_semilla,
            }
            html = render_to_string('comprobante_vacaciones.html', ctx)
            return _html_a_pdf_bytes(html, f'Vacacion_{empleado.rut}'), None, None, None, vac, None

        if tipo_doc == 'FINIQUITO':
            if not finiquito_id:
                raise Exception('Se requiere el ID del finiquito.')
            try:
                fin = Finiquito.objects.get(id=finiquito_id, empleado=empleado)
            except Finiquito.DoesNotExist:
                raise Exception('Finiquito no encontrado.')

            def _fmt_fin(f):
                if not f:
                    return '—'
                return f"{f.day:02d} de {_MESES[f.month - 1]} de {f.year}"

            ciudad_fin = (getattr(empresa, 'ciudad', '') or getattr(empresa, 'comuna', '') or 'Santiago').strip().title()
            causal_label = fin.get_causal_articulo_display() if fin.causal_articulo else '—'
            sueldo_prop = math.floor((fin.sueldo_base / 30) * fin.dias_trabajados_ultimo_mes)
            _f_ciudad     = _esc(ciudad_fin)
            _f_causal     = _esc(causal_label)
            _f_nom_legal  = _esc(empresa.nombre_legal or '')
            _f_rut_emp    = _esc(empresa.rut or '')
            _f_trab_nomb  = _esc(f"{empleado.nombres} {empleado.apellido_paterno} {empleado.apellido_materno or ''}")
            _f_trab_firma = _esc(f"{empleado.nombres} {empleado.apellido_paterno}")
            _f_rut_trab   = _esc(empleado.rut or '')
            _f_cargo      = _esc(empleado.cargo or '—')
            _f_depto      = _esc(empleado.departamento or '—')
            _f_modalidad  = _esc(fin.get_modalidad_display())
            html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  @page {{ size: letter; margin: 2cm 2.5cm; }}
  body {{ font-family: Arial, sans-serif; font-size: 10pt; color: #111; line-height: 1.5; }}
  h1 {{ font-size: 14pt; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }}
  h2 {{ font-size: 10pt; text-align: center; color: #555; margin-top: 0; margin-bottom: 20px; }}
  .seccion {{ margin-bottom: 16px; }}
  .seccion-titulo {{ font-size: 9pt; font-weight: bold; text-transform: uppercase;
                     letter-spacing: 1px; color: #555; border-bottom: 1px solid #ccc;
                     padding-bottom: 3px; margin-bottom: 8px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 10pt; }}
  table td {{ padding: 4px 6px; vertical-align: top; }}
  table td:last-child {{ text-align: right; font-weight: bold; }}
  .total-row td {{ border-top: 2px solid #333; font-weight: bold; font-size: 11pt; padding-top: 8px; }}
  .firma-bloque {{ margin-top: 60px; display: flex; justify-content: space-between; }}
  .firma-item {{ text-align: center; width: 44%; }}
  .firma-linea {{ border-top: 1px solid #333; padding-top: 6px; margin-top: 50px; font-size: 9pt; }}
  p {{ margin: 4px 0; }}
  .aviso {{ font-size: 8pt; color: #666; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; }}
</style>
</head>
<body>
<h1>Finiquito de Contrato de Trabajo</h1>
<h2>{_f_ciudad}, {_fmt_fin(fin.fecha_emision)}</h2>
<div class="seccion">
  <div class="seccion-titulo">Partes</div>
  <p><strong>Empleador:</strong> {_f_nom_legal} — RUT {_f_rut_emp}</p>
  <p><strong>Trabajador:</strong> {_f_trab_nomb} — RUT {_f_rut_trab}</p>
  <p><strong>Cargo:</strong> {_f_cargo} &nbsp;|&nbsp; <strong>Departamento:</strong> {_f_depto}</p>
  <p><strong>Fecha de ingreso:</strong> {_fmt_fin(empleado.fecha_ingreso)} &nbsp;|&nbsp;
     <strong>Fecha de término:</strong> {_fmt_fin(fin.fecha_termino)}</p>
  <p><strong>Causal de término:</strong> {_f_causal}</p>
</div>
<div class="seccion">
  <div class="seccion-titulo">Liquidación Final</div>
  <table>
    <tr><td>Sueldo base proporcional ({fin.dias_trabajados_ultimo_mes} días)</td><td>${sueldo_prop:,.0f}</td></tr>
    <tr><td>Gratificación proporcional</td><td>${fin.gratificacion_proporcional:,.0f}</td></tr>
    <tr><td>Feriado proporcional</td><td>${fin.feriado_proporcional:,.0f}</td></tr>
    {f'<tr><td>Indemnización por años de servicio</td><td>${fin.indemnizacion_anos_servicio:,.0f}</td></tr>' if fin.indemnizacion_anos_servicio else ''}
    {f'<tr><td>Indemnización sustitutiva de aviso previo</td><td>${fin.indemnizacion_sustitutiva_aviso:,.0f}</td></tr>' if fin.indemnizacion_sustitutiva_aviso else ''}
    {f'<tr><td>Otros haberes</td><td>${fin.otros_haberes:,.0f}</td></tr>' if fin.otros_haberes else ''}
    <tr><td>Descuentos previsionales</td><td>-${fin.descuentos_prevision:,.0f}</td></tr>
    {f'<tr><td>Otros descuentos</td><td>-${fin.otros_descuentos:,.0f}</td></tr>' if fin.otros_descuentos else ''}
    <tr class="total-row"><td>TOTAL A PAGAR</td><td>${fin.total_a_pagar:,.0f}</td></tr>
  </table>
</div>
<div class="seccion">
  <div class="seccion-titulo">Declaración del Trabajador</div>
  <p>El trabajador declara haber recibido a su entera satisfacción la suma indicada como total a pagar,
  y nada más tiene que reclamar al empleador, quedando ambas partes en paz y a finiquito.</p>
  <p>Modalidad de suscripción: <strong>{_f_modalidad}</strong></p>
</div>
<div class="firma-bloque">
  <div class="firma-item">
    <div class="firma-linea"><strong>{_f_nom_legal}</strong><br/>RUT {_f_rut_emp}<br/>Empleador</div>
  </div>
  <div class="firma-item">
    <div class="firma-linea"><strong>{_f_trab_firma}</strong><br/>RUT {_f_rut_trab}<br/>Trabajador</div>
  </div>
</div>
<p class="aviso">Finiquito regulado por los artículos 177 y siguientes del Código del Trabajo de Chile.
  Generado por Jornada40 · {_fmt_fin(fin.fecha_emision)}.</p>
</body>
</html>"""
            return _html_a_pdf_bytes(html, f'Finiquito_{empleado.rut}'), None, None, None, None, fin

        raise Exception(f'Tipo de documento no soportado: {tipo_doc}')

    def _enviar_email_firma(self, solicitud, empleado, empresa):
        tipo_labels = {
            'CONTRATO':       'Contrato Laboral',
            'ANEXO_40H':      'Anexo Ley 40 Horas',
            'AMONESTACION':   'Carta de Amonestación',
            'DESPIDO':        'Carta de Despido',
            'CONSTANCIA':     'Constancia Laboral',
            'ANEXO_CONTRATO': 'Anexo de Contrato',
            'LIQUIDACION':    'Liquidación de Sueldo',
            'VACACION':       'Comprobante de Vacaciones',
            'FINIQUITO':      'Finiquito de Término',
        }
        tipo_label       = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento)
        firma_url        = f"https://jornada40.cl/firma/{solicitud.token}"
        nombre_trabajador = f"{empleado.nombres} {empleado.apellido_paterno}"
        expira_fecha     = solicitud.expira_en.strftime('%d/%m/%Y')

        texto_plano = (
            f"Hola {nombre_trabajador},\n\n"
            f"{empresa.nombre_legal} requiere tu firma en: {tipo_label}.\n\n"
            f"Para firmar ingresa al siguiente enlace (válido hasta el {expira_fecha}):\n"
            f"{firma_url}\n\n"
            f"Si no reconoces esta solicitud, ignora este mensaje.\n\n"
            f"Jornada40 — Sistema de Gestión Laboral"
        )
        html_body = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Firma Electrónica Requerida</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa.nombre_legal}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hola <strong>{nombre_trabajador}</strong>,</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Tu empleador requiere tu firma electrónica en el siguiente documento:
      </p>
      <div style="background:#f0f4ff;border-left:4px solid #2563eb;padding:16px 20px;border-radius:6px;margin-bottom:28px;">
        <p style="margin:0;font-weight:700;color:#1e3a6e;font-size:15px;">{tipo_label}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Válido para firmar hasta el {expira_fecha}</p>
      </div>
      <a href="{firma_url}"
         style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Revisar y Firmar Documento
      </a>
      <p style="color:#9ca3af;font-size:12px;margin:28px 0 0;line-height:1.6;">
        Si el botón no funciona, copia este enlace:<br>
        <a href="{firma_url}" style="color:#2563eb;word-break:break-all;">{firma_url}</a>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Mensaje enviado a trabajador de <strong>{empresa.nombre_legal}</strong>.
        Firma Electrónica Simple válida bajo Ley 19.799 (Chile).
      </p>
    </div>
  </div>
</body>
</html>"""
        msg = EmailMultiAlternatives(
            subject=f"Firma requerida: {tipo_label} — {empresa.nombre_legal}",
            body=texto_plano,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[solicitud.email_firmante],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send()


# Endpoint para listar los planes activos en la BD
class PlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Plan.objects.filter(activo=True)
    serializer_class = PlanSerializer
    permission_classes = [AllowAny] 

# Endpoint específico para el dashboard del cliente
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mi_suscripcion(request):
    cliente = getattr(request.user, 'perfil_cliente', None)
    if not cliente:
        return Response({'error': 'Perfil de cliente no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    # 1. Buscar o crear suscripción 
    try:
        suscripcion = cliente.suscripcion_activa
    except Suscripcion.DoesNotExist:
        plan_asignado = cliente.plan if cliente.plan else Plan.objects.first()
        suscripcion = Suscripcion.objects.create(
            cliente=cliente,
            plan=plan_asignado,
            estado='ACTIVE' if plan_asignado else 'TRIAL'
        )

    # 2. Calcular uso real (trabajadores en TODAS las empresas del usuario)
    trabajadores_actuales = _trabajadores_vigentes(request.user)

    # 3. Armar la respuesta exacta que espera Suscripcion.tsx
    data = {
        'estado': suscripcion.estado,
        'plan': {
            'id': suscripcion.plan.id,
            'nombre': suscripcion.plan.nombre,
            'precio': suscripcion.plan.precio,
            'limite_trabajadores': suscripcion.plan.limite_trabajadores,
            'descripcion': suscripcion.plan.descripcion,
        },
        'trabajadores_actuales': trabajadores_actuales,
        'fecha_proximo_cobro': suscripcion.fecha_proximo_cobro.strftime('%Y-%m-%d') if suscripcion.fecha_proximo_cobro else None,
        'metodo_pago_glosa': suscripcion.metodo_pago_glosa,
        # Canceló la renovación en Reveniu: conserva el plan hasta el fin del período pagado.
        'renovacion_cancelada': suscripcion.estado == 'ACTIVE' and suscripcion.fecha_cancelacion is not None,
        'pagos': [
            {'id': e.id, 'fecha': e.fecha_pago.isoformat() if e.fecha_pago else None, 'monto': e.monto,
             'plan': e.plan.nombre if e.plan else None, 'orden': e.orden_compra}
            for e in cliente.eventos_pasarela.filter(evento__in=_EVENTOS_PAGO, monto__gt=0)
                .select_related('plan').order_by('-fecha_pago', '-id')[:24]
        ],
    }

    return Response(data, status=status.HTTP_200_OK)

# ==========================================
# PASARELA DE PAGOS (REVENIU)
# ==========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crear_checkout_reveniu(request):
    plan_id = str(request.data.get('plan_id'))
    ciclo = request.data.get('ciclo', 'mensual')  # 'mensual' o 'anual'

    try:
        plan = Plan.objects.get(id=plan_id)
        cliente = getattr(request.user, 'perfil_cliente', None)

        nombre_plan = plan.nombre.upper()
        ciclo_upper = ciclo.upper()
        env_key = f'REVENIU_LINK_{nombre_plan}_{ciclo_upper}'
        link_base = config(env_key, default=None)

        if not link_base:
            return Response(
                {'error': f'Link de pago no configurado para este plan ({env_key} no definido).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nombre_url = urllib.parse.quote(f"{request.user.first_name} {request.user.last_name}".strip())
        url_pago = f"{link_base}?email={request.user.email}&name={nombre_url}&custom_reference={cliente.id}_{plan.id}"

        return Response({'url': url_pago}, status=status.HTTP_200_OK)

    except Plan.DoesNotExist:
        return Response({'error': 'Plan no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

# Nombres de evento que documenta Reveniu, más los que esperaba la primera
# versión de esta integración (se siguen aceptando).
_EVENTOS_ACTIVACION = {'subscription_activated', 'subscription_created'}
_EVENTOS_PAGO = {'subscription_payment_succeeded', 'payment_succeeded'}
_EVENTO_RENOVACION_CANCELADA = 'subscription_renewal_cancelled'
_EVENTO_DESACTIVADA = 'subscription_deactivated'


def _referencia_cliente_plan(referencia):
    """(cliente, plan) desde una referencia "<cliente_id>_<plan_id>", o (None, None)."""
    try:
        cliente_id, plan_id = str(referencia or '').split('_', 1)
        return Cliente.objects.get(id=int(cliente_id)), Plan.objects.get(id=int(plan_id))
    except (ValueError, Cliente.DoesNotExist, Plan.DoesNotExist):
        return None, None


def _plan_base():
    """Plan al que vuelve una cuenta cuya suscripción pagada terminó (Semilla)."""
    return Plan.objects.filter(activo=True).order_by('nivel', 'precio', 'id').first()


def _avisar_pagos(asunto, cuerpo):
    """Correo a Jornada40 por algo de la pasarela que requiere acción manual."""
    destino = config('ALERTAS_PAGOS_EMAIL', default='contacto.jornada40@gmail.com')
    try:
        EmailMultiAlternatives(subject=f'[Jornada40 pagos] {asunto}', body=cuerpo,
                               from_email=settings.DEFAULT_FROM_EMAIL, to=[destino]).send()
    except Exception:
        logger.exception('No se pudo enviar el aviso de pagos: %s', asunto)


def aplicar_evento_pasarela(evento):
    """Refleja un EventoPasarela ya asociado (cliente y, si activa, plan) en la suscripción.

    Lo usa el webhook y también el admin, al asociar a mano un aviso que llegó
    sin referencia. Devuelve True si cambió algo.
    """
    if evento.aplicado or not evento.cliente_id:
        return False
    cliente = evento.cliente
    suscripcion = Suscripcion.objects.filter(cliente=cliente).first()
    id_pasarela = evento.gateway_subscription_id
    # Un aviso de otra suscripción de Reveniu (la anterior a un cambio de
    # plan) no debe bajar ni cambiar la vigente.
    es_la_vigente = not suscripcion or not suscripcion.gateway_subscription_id or \
        not id_pasarela or suscripcion.gateway_subscription_id == id_pasarela

    if evento.evento in _EVENTOS_ACTIVACION | _EVENTOS_PAGO:
        plan = evento.plan or (suscripcion.plan if suscripcion and es_la_vigente else None)
        if not plan:
            return False
        if suscripcion and suscripcion.gateway_subscription_id and id_pasarela and not es_la_vigente:
            # Cambio de plan: Reveniu abrió otra suscripción y la anterior
            # sigue cobrando hasta que alguien la cancele.
            _avisar_pagos(
                f'Cancelar la suscripción anterior de {cliente.rut}',
                f'La cuenta {cliente.rut} pagó el plan {plan.nombre} con la suscripción de Reveniu '
                f'{id_pasarela}. La suscripción anterior ({suscripcion.gateway_subscription_id}, plan '
                f'{suscripcion.plan.nombre}) sigue activa en Reveniu: cancélala allí para no cobrar dos veces.')
        if not suscripcion:
            # Cuentas anteriores al cambio pueden no tener suscripción: un
            # pago válido no puede perderse por eso.
            suscripcion = Suscripcion(cliente=cliente, plan=plan)
        suscripcion.plan = plan
        suscripcion.estado = 'ACTIVE'
        suscripcion.fecha_cancelacion = None
        if id_pasarela:
            suscripcion.gateway_subscription_id = id_pasarela
        suscripcion.save()
        # cliente.plan manda en los límites y los PDF: se sincroniza.
        cliente.plan = plan
        cliente.save(update_fields=['plan'])
        if not evento.plan_id:
            evento.plan = plan
    elif evento.evento == _EVENTO_RENOVACION_CANCELADA:
        # No se renovará, pero el período pagado se respeta: el acceso sigue
        # hasta que Reveniu avise que la suscripción terminó.
        if suscripcion and es_la_vigente:
            suscripcion.fecha_cancelacion = timezone.now()
            suscripcion.save(update_fields=['fecha_cancelacion'])
    elif evento.evento == _EVENTO_DESACTIVADA:
        if suscripcion and es_la_vigente:
            base = _plan_base()
            suscripcion.estado = 'CANCELED'
            suscripcion.fecha_cancelacion = suscripcion.fecha_cancelacion or timezone.now()
            suscripcion.save(update_fields=['estado', 'fecha_cancelacion'])
            # Vuelve al plan gratuito: no se borra nada, solo rigen sus límites.
            cliente.plan = base
            cliente.save(update_fields=['plan'])
    else:
        return False
    evento.aplicado = True
    evento.save()
    return True


@api_view(['POST'])
@permission_classes([AllowAny])
def webhook_reveniu(request):
    webhook_secret = config('REVENIU_WEBHOOK_SECRET', default=None)

    # Secret obligatorio. Sin él, rechazamos todo (fail closed).
    if not webhook_secret:
        return Response({'error': 'Webhook no configurado'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    # Reveniu envía el secreto en Reveniu-Secret-Key; X-Webhook-Token es el
    # encabezado que usaba la primera versión y se sigue aceptando.
    token_recibido = request.headers.get('Reveniu-Secret-Key') or request.headers.get('X-Webhook-Token', '')

    if not hmac.compare_digest(str(token_recibido), webhook_secret):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

    cuerpo = request.data if isinstance(request.data, dict) else {}
    evento_nombre = str(cuerpo.get('event') or '')
    # Reveniu anida los datos en "data"; la primera versión los esperaba planos.
    data = cuerpo.get('data') if isinstance(cuerpo.get('data'), dict) else cuerpo
    conocidos = _EVENTOS_ACTIVACION | _EVENTOS_PAGO | {_EVENTO_RENOVACION_CANCELADA, _EVENTO_DESACTIVADA}
    if evento_nombre not in conocidos:
        return Response(status=status.HTTP_200_OK)

    id_pasarela = str(data.get('subscription_id') or '')
    orden = str(data.get('buy_order') or '')
    # Reveniu reintenta los avisos: un pago ya registrado no se procesa dos veces.
    if orden and EventoPasarela.objects.filter(evento=evento_nombre, orden_compra=orden).exists():
        return Response(status=status.HTTP_200_OK)

    cliente, plan = _referencia_cliente_plan(data.get('subscription_external_id') or data.get('custom_reference'))
    if not cliente and id_pasarela:
        conocida = Suscripcion.objects.filter(gateway_subscription_id=id_pasarela).select_related('cliente').first()
        cliente = conocida.cliente if conocida else None

    try:
        monto = int(round(float(data.get('amount') or 0)))
    except (TypeError, ValueError):
        monto = 0
    try:
        fecha_pago = datetime.datetime.strptime(str(data.get('issued_on')), '%d/%m/%Y').date()
    except ValueError:
        fecha_pago = timezone.localdate() if evento_nombre in _EVENTOS_PAGO else None

    evento = EventoPasarela.objects.create(
        evento=evento_nombre, cliente=cliente, plan=plan, gateway_subscription_id=id_pasarela,
        orden_compra=orden, monto=monto, fecha_pago=fecha_pago, datos=cuerpo)

    if not cliente:
        _avisar_pagos(
            f'Aviso de Reveniu sin cuenta asociada ({evento_nombre})',
            f'Llegó "{evento_nombre}" de la suscripción de Reveniu {id_pasarela or "(sin id)"}'
            f'{f" por ${monto:,}".replace(",", ".") if monto else ""} y no se pudo asociar a una cuenta.\n\n'
            f'Asócialo en el admin: Eventos de la pasarela → evento #{evento.id} → elige cliente y plan y guarda. '
            f'Desde ahí la suscripción queda vinculada y los próximos avisos se aplican solos.')
        return Response({'estado': 'sin_asociar'}, status=status.HTTP_200_OK)

    aplicar_evento_pasarela(evento)
    return Response(status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetRateThrottle, PasswordResetAccountRateThrottle])
def recuperar_password_por_rut(request):
    """Envía el enlace de recuperación al correo registrado del titular.

    Responde exactamente lo mismo exista o no el RUT, y no muestra el correo
    (ni enmascarado): antes el 404 frente al 200 con "and***@dominio" dejaba
    averiguar qué RUT tienen cuenta y parte de su correo con solo probar RUT.
    """
    respuesta = Response({'mensaje': 'Si el RUT está registrado, enviamos un enlace al correo asociado.'},
                         status=200)
    rut = normalizar_rut_usuario(request.data.get('rut'))
    if not validar_rut(rut):
        return Response({'error': 'El RUT no es válido: revisa el dígito verificador.'}, status=400)

    cliente = Cliente.objects.filter(rut=rut).select_related('usuario').first()
    if not cliente or not cliente.correo:
        return respuesta
    user = cliente.usuario
    if user.email != cliente.correo:
        user.email = cliente.correo
        user.save(update_fields=['email'])

    # Se arma el correo para este usuario puntual: PasswordResetForm buscaría
    # por correo y, con correos repetidos entre cuentas, mandaría enlaces de
    # todas ellas.
    form = PasswordResetForm({'email': user.email})
    if form.is_valid():
        form.get_users = lambda email: [user]
        form.save(
            request=request,
            use_https=True,
            from_email=settings.DEFAULT_FROM_EMAIL,
            email_template_name='registration/password_reset_email.html',
            html_email_template_name='registration/password_reset_email.html',
        )
    return respuesta

@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def perfil_usuario(request):
    """Datos del titular de la cuenta. El RUT no se cambia: es el usuario de ingreso."""
    cliente = getattr(request.user, 'perfil_cliente', None)
    if not cliente:
        return Response({'error': 'Perfil no encontrado en la tabla Cliente'}, status=404)

    def datos():
        plan = _plan_activo(request.user)
        return {
            'rut': cliente.rut,
            'tipo_cliente': cliente.tipo_cliente,
            'nombres': cliente.nombres or '',
            'apellido_paterno': cliente.apellido_paterno or '',
            'apellido_materno': cliente.apellido_materno or '',
            'razon_social': cliente.razon_social or '',
            'email': request.user.email or cliente.correo or '',
            'telefono': cliente.telefono or '',
            'direccion': cliente.direccion or '',
            'plan_nombre': plan.nombre if plan else '',
        }

    if request.method == 'GET':
        return Response(datos())

    d = request.data
    tipo = d.get('tipo_cliente', cliente.tipo_cliente)
    if tipo not in dict(Cliente.TIPO_CLIENTE_CHOICES):
        return Response({'error': 'Tipo de cliente inválido.'}, status=400)
    nombres = str(d.get('nombres', cliente.nombres) or '').strip()
    if not nombres:
        return Response({'error': 'Ingresa el nombre del titular.'}, status=400)
    razon_social = str(d.get('razon_social', cliente.razon_social) or '').strip()
    if tipo == 'EMPRESA' and not razon_social:
        return Response({'error': 'Ingresa la razón social.'}, status=400)
    email = str(d.get('email', request.user.email) or '').strip().lower()
    if email:
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({'error': 'El correo no es válido.'}, status=400)

    cliente.tipo_cliente = tipo
    cliente.nombres = nombres
    for campo in ('apellido_paterno', 'apellido_materno', 'telefono', 'direccion'):
        if campo in d:
            setattr(cliente, campo, str(d.get(campo) or '').strip())
    cliente.razon_social = razon_social
    cliente.correo = email or cliente.correo
    cliente.save()

    # El usuario de Django guarda una copia para el correo de recuperación.
    request.user.first_name = nombres
    request.user.last_name = f"{cliente.apellido_paterno or ''} {cliente.apellido_materno or ''}".strip()
    if email:
        request.user.email = email
    request.user.save()
    return Response({'mensaje': 'Perfil actualizado.', **datos()})


# ==========================================
# FIRMA ELECTRÓNICA — ENDPOINTS PÚBLICOS
# (no requieren autenticación del empleador)
# ==========================================

def _enmascarar_email(email: str) -> str:
    """Ej: juan.perez@gmail.com → ju***@gmail.com"""
    partes = email.split('@')
    usuario = partes[0]
    dominio = partes[1] if len(partes) > 1 else ''
    prefijo = usuario[:2] if len(usuario) >= 2 else usuario[:1]
    return f"{prefijo}***@{dominio}"


@api_view(['GET'])
@permission_classes([AllowAny])
def firma_publica_info(request, token):
    """
    Retorna la información pública de una solicitud de firma:
    tipo de documento, nombre de empresa, nombre del trabajador y fecha de expiración.
    No expone datos sensibles.
    """
    try:
        solicitud = SolicitudFirma.objects.select_related('empleado', 'empresa').get(token=token)
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    # Marcar como expirada si corresponde
    if solicitud.estado == 'PENDIENTE' and timezone.now() > solicitud.expira_en:
        solicitud.estado = 'EXPIRADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])

    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
        'LIQUIDACION': 'Liquidación de Sueldo', 'VACACION': 'Comprobante de Vacaciones',
        'FINIQUITO': 'Finiquito de Término',
    }
    empleado = solicitud.empleado
    empresa  = solicitud.empresa

    return Response({
        'estado': solicitud.estado,
        'tipo_documento': solicitud.tipo_documento,
        'tipo_documento_label': tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento),
        'empresa_nombre': empresa.nombre_legal,
        'trabajador_nombre': f"{empleado.nombres} {empleado.apellido_paterno}",
        'email_firmante_enmascarado': _enmascarar_email(solicitud.email_firmante),
        'expira_en': solicitud.expira_en.isoformat(),
        'ya_verificado': solicitud.sesion_token_trabajador is not None,
        # Comprobante, solo cuando ya se firmó (para volver a verlo desde el enlace).
        **({
            'firmado_en': solicitud.firmado_en.isoformat() if solicitud.firmado_en else None,
            'folio': solicitud.folio,
            'hash_firmado': solicitud.hash_firmado,
        } if solicitud.estado == 'FIRMADO' else {}),
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def firma_publica_solicitar_otp(request, token):
    """
    Genera un código OTP de 6 dígitos y lo envía al email del trabajador.
    Limita a 1 solicitud por minuto para evitar spam.
    """
    try:
        solicitud = SolicitudFirma.objects.get(token=token)
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    if solicitud.estado != 'PENDIENTE':
        return Response({'error': 'Esta solicitud no está pendiente de firma.'}, status=400)

    if timezone.now() > solicitud.expira_en:
        solicitud.estado = 'EXPIRADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': 'El enlace de firma ha expirado.'}, status=410)

    # Confirmar identidad con el RUT antes de enviar el código: el enlace
    # solo no basta (un correo reenviado o una bandeja compartida).
    rut_ingresado = limpiar_rut(request.data.get('rut', ''))
    if not rut_ingresado or rut_ingresado != limpiar_rut(solicitud.empleado.rut):
        return Response(
            {'error': 'El RUT no coincide con el del trabajador al que se envió el documento.'},
            status=400,
        )

    # Tope de códigos por hora: con 3 intentos por código, acota los intentos
    # totales de adivinar uno aunque se pidan códigos nuevos cada minuto.
    hace_una_hora = timezone.now() - timezone.timedelta(hours=1)
    if OTPFirma.objects.filter(solicitud=solicitud, creado_en__gte=hace_una_hora).count() >= 5:
        return Response(
            {'error': 'Pediste demasiados códigos. Intenta de nuevo en una hora.'},
            status=429,
        )

    # Anti-spam: no permitir más de un OTP por minuto
    ultimo_otp = OTPFirma.objects.filter(solicitud=solicitud).order_by('-creado_en').first()
    if ultimo_otp:
        segundos_transcurridos = (timezone.now() - ultimo_otp.creado_en).total_seconds()
        if segundos_transcurridos < 60:
            espera = int(60 - segundos_transcurridos)
            return Response(
                {'error': f'Debes esperar {espera} segundo(s) antes de solicitar un nuevo código.'},
                status=429
            )

    # Invalidar OTPs previos no verificados
    OTPFirma.objects.filter(
        solicitud=solicitud, verificado=False
    ).update(expira_en=timezone.now())

    # Generar código de 6 dígitos
    codigo = ''.join(secrets.choice(string.digits) for _ in range(6))

    otp = OTPFirma.objects.create(
        solicitud=solicitud,
        codigo=codigo,
        email_destino=solicitud.email_firmante,
    )

    # Enviar email con el código
    try:
        _enviar_email_otp(otp, solicitud)
    except Exception as e:
        otp.delete()
        return Response({'error': f'No se pudo enviar el código por email: {str(e)}'}, status=500)

    return Response({
        'enviado': True,
        'email_destino': _enmascarar_email(solicitud.email_firmante),
        'expira_en_minutos': 10,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def firma_publica_verificar_otp(request, token):
    """
    Verifica el código OTP enviado al trabajador.
    Si es correcto devuelve un sesion_token que autoriza el paso de firma.
    """
    codigo_enviado = str(request.data.get('codigo', '')).strip()

    if not codigo_enviado:
        return Response({'error': 'Debes ingresar el código.'}, status=400)

    try:
        solicitud = SolicitudFirma.objects.get(token=token)
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    if solicitud.estado != 'PENDIENTE':
        return Response({'error': 'Esta solicitud no está pendiente de firma.'}, status=400)

    if timezone.now() > solicitud.expira_en:
        solicitud.estado = 'EXPIRADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': 'El enlace de firma ha expirado.'}, status=410)

    # Buscar el OTP más reciente válido
    otp = OTPFirma.objects.filter(
        solicitud=solicitud, verificado=False
    ).order_by('-creado_en').first()

    if not otp or not otp.es_valido:
        return Response(
            {'error': 'No hay un código activo. Por favor solicita uno nuevo.'},
            status=400
        )

    # Incrementar intentos antes de verificar (previene timing attacks)
    otp.intentos += 1
    otp.save(update_fields=['intentos'])

    if otp.intentos > 3:
        return Response(
            {'error': 'Código bloqueado por demasiados intentos. Solicita uno nuevo.'},
            status=400
        )

    if otp.codigo != codigo_enviado:
        restantes = 3 - otp.intentos
        msg = (f'Código incorrecto. Te quedan {restantes} intento(s).'
               if restantes > 0 else 'Código bloqueado. Solicita uno nuevo.')
        return Response({'error': msg}, status=400)

    # Código correcto — marcar OTP como verificado
    otp.verificado = True
    otp.save(update_fields=['verificado'])

    # Generar sesion_token para el paso de firma
    sesion_token = uuid_mod.uuid4()
    solicitud.sesion_token_trabajador = sesion_token
    solicitud.save(update_fields=['sesion_token_trabajador', 'actualizado_en'])

    return Response({
        'verificado': True,
        'sesion_token': str(sesion_token),
    })


def _enviar_email_otp(otp: OTPFirma, solicitud: SolicitudFirma):
    """Envía el código OTP al trabajador por email."""
    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
        'LIQUIDACION': 'Liquidación de Sueldo', 'VACACION': 'Comprobante de Vacaciones',
        'FINIQUITO': 'Finiquito de Término',
    }
    tipo_label = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento)
    empresa_nombre = solicitud.empresa.nombre_legal
    codigo = otp.codigo

    texto_plano = (
        f"Tu código de verificación es: {codigo}\n\n"
        f"Ingresa este código en la página de firma para verificar tu identidad.\n"
        f"Válido por 10 minutos.\n\n"
        f"Si no solicitaste este código, ignora este mensaje.\n\n"
        f"Jornada40 — Sistema de Gestión Laboral"
    )
    html_body = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Verifica tu identidad</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa_nombre} · {tipo_label}</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="color:#374151;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Ingresa el siguiente código en la página de firma para verificar tu identidad:
      </p>
      <div style="text-align:center;margin:0 0 28px;">
        <div style="display:inline-block;background:#f0f4ff;border:2px dashed #2563eb;border-radius:12px;padding:20px 40px;">
          <span style="font-size:38px;font-weight:900;letter-spacing:0.3em;color:#1e3a6e;font-family:monospace;">{codigo}</span>
        </div>
        <p style="color:#6b7280;font-size:13px;margin:10px 0 0;">Válido por <strong>10 minutos</strong></p>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Si no solicitaste este código, puedes ignorar este mensaje con seguridad.<br>
        Firma Electrónica Simple válida bajo Ley 19.799 (Chile).
      </p>
    </div>
  </div>
</body>
</html>"""

    msg = EmailMultiAlternatives(
        subject=f"Tu código de verificación — {empresa_nombre}",
        body=texto_plano,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[otp.email_destino],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send()


# ==========================================
# FASE 8 — Procesamiento de la firma
# ==========================================

def _ip_desde_request(request) -> str:
    """Extrae la IP real del firmante considerando proxies (Railway/Vercel)."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR', '')


def _enviar_emails_firma_completada(
    solicitud: SolicitudFirma,
    empleado,
    empresa,
    pdf_firmado_bytes: bytes,
):
    """Envía confirmación de firma al trabajador y notificación al empleador."""
    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
        'LIQUIDACION': 'Liquidación de Sueldo', 'VACACION': 'Comprobante de Vacaciones',
        'FINIQUITO': 'Finiquito de Término',
    }
    tipo_label        = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento)
    nombre_trabajador = f"{empleado.nombres} {empleado.apellido_paterno}"
    firmado_str       = solicitud.firmado_en.strftime('%d/%m/%Y a las %H:%M') + ' UTC'
    nombre_pdf        = f"{tipo_label.replace(' ', '_')}_{empleado.rut}_firmado.pdf"

    # ── Email al trabajador ──────────────────────────────────────────────────
    texto_trabajador = (
        f"Hola {nombre_trabajador},\n\n"
        f"Tu firma electrónica simple fue registrada exitosamente el {firmado_str}.\n\n"
        f"Documento: {tipo_label}\n"
        f"Empresa: {empresa.nombre_legal}\n\n"
        f"Adjunto encontrarás una copia del documento firmado con el certificado de firma.\n\n"
        f"Jornada40 — Sistema de Gestión Laboral"
    )
    html_trabajador = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">¡Documento Firmado!</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa.nombre_legal}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hola <strong>{nombre_trabajador}</strong>,</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Tu firma electrónica simple fue registrada exitosamente.
      </p>
      <div style="background:#f0fdf4;border-left:4px solid #059669;padding:16px 20px;border-radius:6px;margin-bottom:28px;">
        <p style="margin:0;font-weight:700;color:#065f46;font-size:15px;">{tipo_label}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Firmado el {firmado_str}</p>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Adjunto a este correo encontrarás el documento firmado con el certificado de autenticidad.
        Guárdalo en un lugar seguro.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Firma Electrónica Simple válida bajo Ley N° 19.799 (Chile). Generado por Jornada40.
      </p>
    </div>
  </div>
</body>
</html>"""

    msg_trabajador = EmailMultiAlternatives(
        subject=f"Documento firmado: {tipo_label} — {empresa.nombre_legal}",
        body=texto_trabajador,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[solicitud.email_firmante],
    )
    msg_trabajador.attach_alternative(html_trabajador, "text/html")
    msg_trabajador.attach(nombre_pdf, pdf_firmado_bytes, 'application/pdf')
    msg_trabajador.send()

    # ── Email al empleador ───────────────────────────────────────────────────
    email_empleador = empresa.owner.email
    if not email_empleador:
        return

    texto_empleador = (
        f"El trabajador {nombre_trabajador} firmó el documento «{tipo_label}» "
        f"el {firmado_str}.\n\n"
        f"Empresa: {empresa.nombre_legal}\n"
        f"El documento firmado está adjunto a este correo.\n\n"
        f"Jornada40 — Sistema de Gestión Laboral"
    )
    html_empleador = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Firma Recibida</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa.nombre_legal}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        El trabajador <strong>{nombre_trabajador}</strong> firmó el siguiente documento:
      </p>
      <div style="background:#f0f4ff;border-left:4px solid #2563eb;padding:16px 20px;border-radius:6px;margin-bottom:28px;">
        <p style="margin:0;font-weight:700;color:#1e3a6e;font-size:15px;">{tipo_label}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Firmado el {firmado_str}</p>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 0;">
        El documento firmado con certificado de autenticidad está adjunto a este correo.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Firma Electrónica Simple válida bajo Ley N° 19.799 (Chile). Generado por Jornada40.
      </p>
    </div>
  </div>
</body>
</html>"""

    msg_empleador = EmailMultiAlternatives(
        subject=f"Firma recibida: {nombre_trabajador} firmó «{tipo_label}»",
        body=texto_empleador,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email_empleador],
    )
    msg_empleador.attach_alternative(html_empleador, "text/html")
    msg_empleador.attach(nombre_pdf, pdf_firmado_bytes, 'application/pdf')
    msg_empleador.send()


@api_view(['POST'])
@permission_classes([AllowAny])
def firma_publica_firmar(request, token):
    """
    Procesa la firma del trabajador:
    1. Valida sesion_token y datos de entrada
    2. Descarga PDF original de B2
    3. Genera PDF firmado con página de certificado (pdf_firma.py)
    4. Sube PDF firmado a B2 y elimina el temporal
    5. Marca SolicitudFirma como FIRMADO
    6. Envía emails de confirmación con el PDF adjunto
    """
    sesion_token    = str(request.data.get('sesion_token',    '')).strip()
    firma_trabajador = str(request.data.get('firma_trabajador', '')).strip()

    if not sesion_token:
        return Response({'error': 'Sesión inválida. Vuelve a verificar tu identidad.'}, status=400)
    if not firma_trabajador:
        return Response({'error': 'Debes dibujar tu firma antes de continuar.'}, status=400)
    if not firma_trabajador.startswith('data:image/'):
        return Response({'error': 'Formato de firma inválido.'}, status=400)
    if len(firma_trabajador) > 500_000:
        return Response({'error': 'La imagen de firma es demasiado grande.'}, status=400)

    try:
        with transaction.atomic():
            solicitud = SolicitudFirma.objects.select_related(
                'empleado', 'empresa', 'empresa__owner'
            ).select_for_update().get(token=token)

            # ── Validaciones de estado ──────────────────────────────────────
            if solicitud.estado != 'PENDIENTE':
                return Response(
                    {'error': f'Esta solicitud ya no está pendiente ({solicitud.get_estado_display()}).'},
                    status=400,
                )

            if timezone.now() > solicitud.expira_en:
                solicitud.estado = 'EXPIRADO'
                solicitud.save(update_fields=['estado', 'actualizado_en'])
                return Response({'error': 'El enlace de firma ha expirado.'}, status=410)

            if (not solicitud.sesion_token_trabajador
                    or str(solicitud.sesion_token_trabajador) != sesion_token):
                return Response(
                    {'error': 'Sesión inválida. Vuelve a verificar tu identidad con el código OTP.'},
                    status=403,
                )

            if not solicitud.b2_key_temporal:
                return Response(
                    {'error': 'No se encontró el PDF del documento. Contacta al empleador.'},
                    status=400,
                )

            # Reclamamos la solicitud de inmediato para que ninguna petición
            # concurrente (doble clic, doble tap) pueda pasar este chequeo.
            solicitud.estado = 'PROCESANDO'
            solicitud.save(update_fields=['estado', 'actualizado_en'])
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    # ── Descargar PDF original de B2 ────────────────────────────────────────
    try:
        pdf_original_bytes = b2_client.descargar_documento(solicitud.b2_key_temporal)
    except Exception as exc:
        solicitud.estado = 'PENDIENTE'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': f'Error al obtener el documento: {exc}'}, status=500)

    # ── Folio correlativo por empresa y huella del documento revisado ───────
    empleado = solicitud.empleado
    empresa  = solicitud.empresa
    hash_original = hashlib.sha256(pdf_original_bytes).hexdigest()
    if not solicitud.folio:
        # Con la fila de la empresa bloqueada, dos firmas simultáneas no
        # pueden tomar el mismo número. Si luego falla, el folio queda
        # reservado para el reintento de esta misma solicitud.
        with transaction.atomic():
            Empresa.objects.select_for_update().get(id=empresa.id)
            siguiente = SolicitudFirma.objects.filter(empresa=empresa).exclude(folio='').count() + 1
            solicitud.folio = f'J40-{timezone.localdate().year}-{siguiente:06d}'
            solicitud.save(update_fields=['folio', 'actualizado_en'])

    # ── Generar PDF firmado con certificado ─────────────────────────────────
    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
        'LIQUIDACION': 'Liquidación de Sueldo', 'VACACION': 'Comprobante de Vacaciones',
        'FINIQUITO': 'Finiquito de Término',
    }
    firmado_en  = timezone.now()
    ip_firmante = _ip_desde_request(request)

    try:
        from .pdf_firma import agregar_certificado_firma
        pdf_firmado_bytes = agregar_certificado_firma(
            pdf_original_bytes    = pdf_original_bytes,
            tipo_documento_label  = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento),
            empresa_nombre        = empresa.nombre_legal,
            empresa_rut           = empresa.rut,
            firmante_nombre       = empresa.firma_firmante_nombre or empresa.representante_legal or '',
            firmante_cargo        = empresa.firma_firmante_cargo or 'Representante Legal',
            firma_empleador_b64   = empresa.firma_imagen or '',
            trabajador_nombre     = f"{empleado.nombres} {empleado.apellido_paterno}",
            trabajador_rut        = empleado.rut,
            firma_trabajador_b64  = firma_trabajador,
            token                 = str(solicitud.token),
            firmado_en            = firmado_en,
            ip_firmante           = ip_firmante,
            email_firmante        = solicitud.email_firmante,
            folio                 = solicitud.folio,
            hash_original         = hash_original,
        )
    except Exception as exc:
        solicitud.estado = 'PENDIENTE'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': f'Error al generar el documento firmado: {exc}'}, status=500)

    # ── Subir PDF firmado a B2 ──────────────────────────────────────────────
    key_firmado = b2_client.key_firmado(
        empresa_id=empresa.id,
        uuid=str(solicitud.token),
        year=firmado_en.year,
        month=firmado_en.month,
    )
    try:
        b2_client.subir_documento(pdf_firmado_bytes, key_firmado)
    except Exception as exc:
        solicitud.estado = 'PENDIENTE'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': f'Error al guardar el documento firmado: {exc}'}, status=500)

    # Eliminar PDF temporal (no crítico)
    b2_client.eliminar_documento(solicitud.b2_key_temporal)

    # ── Actualizar SolicitudFirma ───────────────────────────────────────────
    solicitud.estado                 = 'FIRMADO'
    solicitud.firmado_en             = firmado_en
    solicitud.ip_firmante            = ip_firmante or None
    solicitud.firma_trabajador_imagen = firma_trabajador
    solicitud.b2_key_firmado         = key_firmado
    solicitud.hash_original          = hash_original
    solicitud.hash_firmado           = hashlib.sha256(pdf_firmado_bytes).hexdigest()
    solicitud.sesion_token_trabajador = None   # invalidar sesión
    solicitud.save(update_fields=[
        'estado', 'firmado_en', 'ip_firmante',
        'firma_trabajador_imagen', 'b2_key_firmado',
        'hash_original', 'hash_firmado',
        'sesion_token_trabajador', 'actualizado_en',
    ])

    # ── Un anexo modifica el contrato recién al firmarse (Art. 11) ──────────
    # Si falla no se revierte la firma: quedó legalmente otorgada. Se registra
    # para poder aplicar el cambio manualmente.
    if solicitud.tipo_documento == 'ANEXO_CONTRATO' and solicitud.anexo_contrato_id:
        try:
            _aplicar_anexo_a_contrato(solicitud.anexo_contrato)
        except Exception:
            logger.exception(
                'Anexo %s firmado pero no se pudieron aplicar sus cambios al contrato',
                solicitud.anexo_contrato_id,
            )

    # ── Emails de confirmación (no críticos) ────────────────────────────────
    try:
        _enviar_emails_firma_completada(solicitud, empleado, empresa, pdf_firmado_bytes)
    except Exception:
        pass

    return Response({
        'firmado': True, 'firmado_en': firmado_en.isoformat(),
        'folio': solicitud.folio, 'hash_firmado': solicitud.hash_firmado,
    })


# ============================================================
# FASE 9 — Previsualización y rechazo por parte del trabajador
# ============================================================

_TIPO_LABELS_PUBLICO = {
    'CONTRATO':       'Contrato Laboral',
    'ANEXO_40H':      'Anexo Ley 40 Horas',
    'AMONESTACION':   'Carta de Amonestación',
    'DESPIDO':        'Carta de Despido',
    'CONSTANCIA':     'Constancia Laboral',
    'ANEXO_CONTRATO': 'Anexo de Contrato',
    'LIQUIDACION':    'Liquidación de Sueldo',
    'VACACION':       'Comprobante de Vacaciones',
    'FINIQUITO':      'Finiquito de Término',
}


@api_view(['GET'])
@permission_classes([AllowAny])
def firma_publica_documento(request, token):
    """
    Retorna el PDF del documento para que el trabajador lo revise antes de firmar.
    Solo requiere el token — ver el documento no constituye firma ni compromiso.
    Si la solicitud ya fue firmada, retorna el PDF firmado con certificado.
    """
    try:
        solicitud = SolicitudFirma.objects.select_related('empleado').get(token=token)
    except SolicitudFirma.DoesNotExist:
        return HttpResponse(status=404)

    if solicitud.estado in ('CANCELADO', 'EXPIRADO'):
        return HttpResponse(status=410)

    # Elegir qué versión del PDF servir
    if solicitud.estado == 'FIRMADO' and solicitud.b2_key_firmado:
        b2_key = solicitud.b2_key_firmado
    elif solicitud.b2_key_temporal:
        b2_key = solicitud.b2_key_temporal
    else:
        return HttpResponse(status=404)

    try:
        pdf_bytes = b2_client.descargar_documento(b2_key)
    except Exception as exc:
        return Response({'error': f'Error al obtener el documento: {exc}'}, status=500)

    tipo_label = _TIPO_LABELS_PUBLICO.get(solicitud.tipo_documento, solicitud.tipo_documento)
    apellido   = solicitud.empleado.apellido_paterno.replace(' ', '_')
    filename   = f"{tipo_label.replace(' ', '_')}_{apellido}.pdf"

    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{filename}"'
    response['Content-Length']      = len(pdf_bytes)
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def firma_publica_rechazar(request, token):
    """
    El trabajador rechaza el documento tras verificar su identidad con OTP.
    Requiere sesion_token válido. Cambia estado a RECHAZADO y notifica al empleador.
    """
    sesion_token = str(request.data.get('sesion_token', '')).strip()
    motivo       = str(request.data.get('motivo', '')).strip()

    if not sesion_token:
        return Response({'error': 'Sesión inválida. Vuelve a verificar tu identidad.'}, status=400)

    try:
        with transaction.atomic():
            solicitud = SolicitudFirma.objects.select_related(
                'empleado', 'empresa', 'empresa__owner'
            ).select_for_update().get(token=token)

            if solicitud.estado != 'PENDIENTE':
                return Response(
                    {'error': f'Esta solicitud ya no está pendiente ({solicitud.get_estado_display()}).'},
                    status=400,
                )

            if timezone.now() > solicitud.expira_en:
                solicitud.estado = 'EXPIRADO'
                solicitud.save(update_fields=['estado', 'actualizado_en'])
                return Response({'error': 'El enlace de firma ha expirado.'}, status=410)

            if (not solicitud.sesion_token_trabajador
                    or str(solicitud.sesion_token_trabajador) != sesion_token):
                return Response(
                    {'error': 'Sesión inválida. Vuelve a verificar tu identidad con el código OTP.'},
                    status=403,
                )

            solicitud.estado = 'RECHAZADO'
            solicitud.motivo_rechazo = motivo
            solicitud.save(update_fields=['estado', 'motivo_rechazo', 'actualizado_en'])
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud no encontrada.'}, status=404)

    try:
        _notificar_rechazo_empleador(solicitud, motivo)
    except Exception:
        pass  # el rechazo ya fue registrado; el email es no-crítico

    return Response({'rechazado': True})


def _notificar_rechazo_empleador(solicitud: SolicitudFirma, motivo: str):
    """Envía un email al empleador informando que el trabajador rechazó el documento."""
    tipo_label      = _TIPO_LABELS_PUBLICO.get(solicitud.tipo_documento, solicitud.tipo_documento)
    empleado        = solicitud.empleado
    empresa         = solicitud.empresa
    nombre_trabajador = f"{empleado.nombres} {empleado.apellido_paterno}"
    email_empleador = empresa.owner.email
    if not email_empleador:
        return

    _motivo_seg = _esc(motivo) if motivo else ''
    motivo_bloque = (
        f"<div style='background:#fff3cd;border-left:4px solid #f59e0b;padding:12px 16px;"
        f"border-radius:6px;margin:20px 0;'>"
        f"<p style='margin:0;font-size:13px;color:#92400e;font-weight:600;'>Motivo indicado</p>"
        f"<p style='margin:4px 0 0;font-size:14px;color:#374151;'>{_motivo_seg}</p></div>"
        if motivo else ""
    )
    motivo_texto = f"\n\nMotivo indicado por el trabajador: {motivo}" if motivo else ""

    texto_plano = (
        f"El trabajador {nombre_trabajador} rechazó la firma del documento «{tipo_label}».\n"
        f"Empresa: {empresa.nombre_legal}{motivo_texto}\n\n"
        f"Revisa el documento y comunícate con el trabajador para resolver el inconveniente.\n\n"
        f"Jornada40 — Sistema de Gestión Laboral"
    )
    html_body = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#7f1d1d,#991b1b);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Documento Rechazado</h1>
      <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:14px;">{empresa.nombre_legal}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">
        El trabajador <strong>{nombre_trabajador}</strong> rechazó la firma del siguiente documento:
      </p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px 20px;border-radius:6px;margin-bottom:20px;">
        <p style="margin:0;font-weight:700;color:#991b1b;font-size:15px;">{tipo_label}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">{empresa.nombre_legal}</p>
      </div>
      {motivo_bloque}
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
        Comunícate con el trabajador para revisar el documento y volver a enviarlo una vez corregido.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Firma Electrónica Simple · Ley N° 19.799 · Jornada40
      </p>
    </div>
  </div>
</body>
</html>"""

    msg = EmailMultiAlternatives(
        subject=f"Documento rechazado: {nombre_trabajador} rechazó «{tipo_label}»",
        body=texto_plano,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email_empleador],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send()