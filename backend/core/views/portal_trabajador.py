"""Portal del trabajador: ingreso con código al correo o con clave, y consulta
de sus documentos.

Reglas de acceso (ver CuentaTrabajador):
- Una ficha (Empleado) se ve solo si su correo fue verificado por la cuenta
  con un código: el RUT solo no basta, porque cualquier empleador puede
  crear una ficha con un RUT ajeno.
- La empresa debe estar en plan Pyme o superior (nivel 3).
- Un desvinculado conserva el acceso 3 meses desde la firma de su finiquito
  en Jornada40 o, si no la hay, desde la fecha de desvinculación.

La sesión es independiente de la del empleador: una cookie firmada propia,
que se invalida al crear o cambiar la clave. Las vistas solo aceptan JSON,
así un formulario de otro sitio no puede actuar en nombre del trabajador.
"""
import datetime
import hashlib
import secrets
import string

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.core import signing
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import BaseAuthentication
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes, \
    throttle_classes
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

from ..models import (CodigoTrabajador, Contrato, CorreoTrabajador, CuentaTrabajador,
                      Empleado, Liquidacion, SolicitudFirma, VacacionEmpleado)
from ..rut import formatear_rut, limpiar_rut, validar_rut
from .base import _ctx_contrato, _html_a_pdf_bytes, _plan_permite, logger, pdf_firmado, respuesta_pdf

COOKIE = 'jornada40-trabajador'
DURACION_SESION = 8 * 60 * 60          # segundos
MESES_ACCESO_DESVINCULADO = 3
NIVEL_PLAN_PORTAL = 3                  # Pyme
MINUTOS_CODIGO = 10
INTENTOS_POR_CODIGO = 3
CODIGOS_POR_HORA = 5
LARGO_MINIMO_CLAVE = 8
_SAL = 'portal-trabajador'


# ── Acceso ───────────────────────────────────────────────────────────────────

def _rut_limpio(valor):
    rut = limpiar_rut(valor or '')
    return rut if validar_rut(rut) else ''


def _fichas_del_rut(rut):
    """Fichas con ese RUT, escritas con o sin puntos."""
    variantes = {formatear_rut(rut), formatear_rut(rut).replace('.', ''), rut, f'{rut[:-1]}-{rut[-1]}'}
    return Empleado.objects.filter(rut__in=variantes).select_related('empresa', 'empresa__owner')


def acceso_hasta(emp):
    """Último día de acceso de un desvinculado; None si está activo (sin límite)."""
    if emp.activo:
        return None
    # Desde el finiquito ratificado (Mi DT o ministro de fe); si no, desde su firma de
    # recepción en Jornada40; si tampoco, desde la desvinculación.
    from ..models import Finiquito
    ratificado = Finiquito.objects.filter(empleado=emp, ratificado_en__isnull=False).order_by('-ratificado_en').first()
    firma = (SolicitudFirma.objects.filter(empleado=emp, tipo_documento='FINIQUITO', estado='FIRMADO',
                                           firmado_en__isnull=False).order_by('-firmado_en').first())
    desde = (ratificado.ratificado_en if ratificado else
             timezone.localtime(firma.firmado_en).date() if firma else emp.fecha_desvinculacion)
    if not desde:
        return timezone.localdate() - datetime.timedelta(days=1)   # sin fecha: sin acceso
    return desde + relativedelta(months=MESES_ACCESO_DESVINCULADO)


def _habilitada(emp, planes):
    """Ficha que puede entrar al portal (plan de la empresa y ventana de acceso)."""
    duenio = emp.empresa.owner_id
    if duenio not in planes:
        planes[duenio] = _plan_permite(emp.empresa.owner, NIVEL_PLAN_PORTAL)
    if not planes[duenio] or not emp.empresa.activo:
        return False
    hasta = acceso_hasta(emp)
    return hasta is None or timezone.localdate() <= hasta


def fichas_habilitadas(rut):
    planes = {}
    return [e for e in _fichas_del_rut(rut) if _habilitada(e, planes)]


def fichas_accesibles(cuenta):
    """Fichas que la cuenta puede ver: habilitadas y con un correo que verificó."""
    verificados = {c.lower() for c in cuenta.correos.values_list('email', flat=True)}
    return [e for e in fichas_habilitadas(cuenta.rut) if (e.email or '').strip().lower() in verificados]


# ── Estado del portal para el empleador (carpeta del trabajador) ─────────────

HORAS_ENTRE_INVITACIONES = 24


def estado_portal(emp):
    """Si el trabajador puede entrar a su portal y si ya lo usa, en palabras simples.

    "Ya lo usa" = verificó con un código el correo que tiene esta ficha; la
    fecha de último ingreso es la de su cuenta y se muestra solo en ese caso."""
    hoy = timezone.localdate()
    correo = (emp.email or '').strip().lower()
    hasta = acceso_hasta(emp)
    cuenta = CuentaTrabajador.objects.filter(rut=limpiar_rut(emp.rut or '')).first()
    usa = bool(cuenta and correo and cuenta.correos.filter(email__iexact=correo).exists())
    invitado = timezone.localtime(emp.portal_invitado_en) if emp.portal_invitado_en else None
    if not _plan_permite(emp.empresa.owner, NIVEL_PLAN_PORTAL):
        estado, texto = 'SIN_PLAN', 'El portal del trabajador está disponible desde el plan Pyme.'
    elif not emp.empresa.activo or (hasta and hoy > hasta):
        estado, texto = 'SIN_ACCESO', (f'Su acceso terminó el {hasta:%d-%m-%Y}.' if hasta else 'No tiene acceso.')
    elif not correo:
        estado, texto = 'SIN_CORREO', 'Agregue su correo personal en Datos personales para que pueda entrar.'
    elif usa:
        estado, texto = 'ACTIVO', 'Ya usa su portal: ve sus liquidaciones firmadas, documentos y vacaciones.'
    else:
        estado, texto = 'NO_INGRESA', 'Todavía no ha entrado a su portal.'
    espera = invitado and timezone.now() - emp.portal_invitado_en < datetime.timedelta(hours=HORAS_ENTRE_INVITACIONES)
    return {
        'estado': estado, 'texto': texto, 'correo': emp.email or '',
        'acceso_hasta': hasta.isoformat() if hasta else None,
        'ultimo_ingreso': timezone.localtime(cuenta.ultimo_ingreso).date().isoformat()
        if usa and cuenta.ultimo_ingreso else None,
        'invitado_en': invitado.date().isoformat() if invitado else None,
        'puede_invitar': estado in ('NO_INGRESA', 'ACTIVO') and not espera,
    }


def invitar_al_portal(emp):
    """Correo al trabajador con los pasos para entrar. Devuelve un error o None."""
    estado = estado_portal(emp)
    if estado['estado'] not in ('NO_INGRESA', 'ACTIVO'):
        return estado['texto']
    if not estado['puede_invitar']:
        return 'Ya le enviamos una invitación hoy. Puede enviar otra mañana.'
    sitio = getattr(settings, 'SITIO_URL', 'https://jornada40.cl').rstrip('/')
    ctx = {'nombre': emp.nombres, 'empresa': emp.empresa.alias or emp.empresa.nombre_legal,
           'enlace': f'{sitio}/trabajador', 'correo': emp.email}
    try:
        msg = EmailMultiAlternatives(f'{ctx["empresa"]} te invita a tu portal del trabajador',
                                     render_to_string('portal_invitacion.txt', ctx), settings.DEFAULT_FROM_EMAIL,
                                     to=[emp.email])
        msg.attach_alternative(render_to_string('portal_invitacion.html', ctx), 'text/html')
        msg.send()
    except Exception:
        logger.exception('No se pudo enviar la invitación al portal del empleado %s', emp.id)
        return 'No pudimos enviar el correo. Intente de nuevo en unos minutos.'
    emp.portal_invitado_en = timezone.now()
    emp.save(update_fields=['portal_invitado_en'])
    return None


# ── Sesión ───────────────────────────────────────────────────────────────────

def _poner_sesion(response, cuenta, via):
    valor = signing.dumps({'c': cuenta.pk, 'v': cuenta.version_sesion, 'via': via}, salt=_SAL)
    desplegado = bool(getattr(settings, 'IS_DEPLOYED', False))
    response.set_cookie(COOKIE, valor, max_age=DURACION_SESION, httponly=True, secure=desplegado,
                        samesite='None' if desplegado else 'Lax', path='/')
    cuenta.ultimo_ingreso = timezone.now()
    cuenta.save(update_fields=['ultimo_ingreso'])
    return response


class SesionTrabajador(BaseAuthentication):
    def authenticate(self, request):
        valor = request.COOKIES.get(COOKIE)
        if not valor:
            return None
        try:
            datos = signing.loads(valor, salt=_SAL, max_age=DURACION_SESION)
            cuenta = CuentaTrabajador.objects.get(pk=datos['c'])
        except (signing.BadSignature, CuentaTrabajador.DoesNotExist, KeyError, TypeError):
            return None
        if cuenta.version_sesion != datos.get('v'):
            return None
        return cuenta, datos


class EsTrabajador(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, CuentaTrabajador)


class PortalAnonThrottle(AnonRateThrottle):
    scope = 'portal_trabajador'


class PortalCuentaThrottle(SimpleRateThrottle):
    scope = 'portal_trabajador_sesion'

    def get_cache_key(self, request, view):
        cuenta = getattr(request, 'user', None)
        return f'throttle_portal_{cuenta.pk}' if isinstance(cuenta, CuentaTrabajador) else None


def _publica(vista):
    """Vista del ingreso: sin sesión, solo JSON, con límite por IP."""
    vista = throttle_classes([PortalAnonThrottle])(vista)
    vista = parser_classes([JSONParser])(vista)
    vista = permission_classes([AllowAny])(vista)
    return authentication_classes([SesionTrabajador])(vista)


def _con_sesion(vista):
    vista = throttle_classes([PortalCuentaThrottle])(vista)
    vista = parser_classes([JSONParser])(vista)
    vista = permission_classes([EsTrabajador])(vista)
    return authentication_classes([SesionTrabajador])(vista)


# ── Códigos por correo ───────────────────────────────────────────────────────

def _huella(rut, codigo):
    return hashlib.sha256(f'{rut}:{codigo}:{settings.SECRET_KEY}'.encode()).hexdigest()


def _enmascarar(email):
    usuario, _, dominio = (email or '').partition('@')
    return f'{usuario[:2]}***@{dominio}' if dominio else ''


def _enviar_codigo(rut, correos):
    """Envía un código distinto a cada correo, en mensajes separados. Devuelve
    un error (texto) o None.

    Un código por correo es lo que impide que una ficha con un RUT ajeno dé
    acceso a las fichas de otras empresas: cada código verifica solo el correo
    al que llegó, y nadie ve a qué otros correos se envió.
    """
    hace_una_hora = timezone.now() - datetime.timedelta(hours=1)
    recientes = CodigoTrabajador.objects.filter(rut=rut, creado_en__gte=hace_una_hora)
    if recientes.count() >= CODIGOS_POR_HORA * max(1, len(correos)):
        return 'Pediste demasiados códigos. Intenta de nuevo en una hora.'
    ultimo = recientes.order_by('-creado_en').first()
    if ultimo and (timezone.now() - ultimo.creado_en).total_seconds() < 60:
        return 'Espera un minuto antes de pedir otro código.'
    CodigoTrabajador.objects.filter(rut=rut, usado=False).update(usado=True)
    for correo in sorted(correos):
        codigo = ''.join(secrets.choice(string.digits) for _ in range(6))
        CodigoTrabajador.objects.create(rut=rut, huella=_huella(rut, codigo), correos=[correo],
                                        expira_en=timezone.now() + datetime.timedelta(minutes=MINUTOS_CODIGO))
        _anotar_para_pruebas(correo, codigo)
        texto = (f'Tu código para entrar al portal del trabajador de Jornada40 es: {codigo}\n\n'
                 f'Vence en {MINUTOS_CODIGO} minutos. Si no lo pediste, ignora este mensaje.')
        html = render_to_string('portal_trabajador_codigo.html', {'codigo': codigo, 'minutos': MINUTOS_CODIGO})
        try:
            msg = EmailMultiAlternatives('Tu código de acceso a Jornada40', texto, settings.DEFAULT_FROM_EMAIL,
                                         to=[correo])
            msg.attach_alternative(html, 'text/html')
            msg.send()
        except Exception:
            logger.exception('No se pudo enviar el código del portal a %s', rut)
            return 'No pudimos enviar el código. Intenta de nuevo en unos minutos.'
    return None


def _anotar_para_pruebas(correo, codigo):
    """Solo en las pruebas de navegador (config.settings_e2e): deja el código en
    un archivo para que la prueba lo lea en vez del correo. Sin el ajuste no hace nada."""
    archivo = getattr(settings, 'PORTAL_CODIGOS_E2E', None)
    if archivo:
        import os
        os.makedirs(os.path.dirname(archivo), exist_ok=True)
        with open(archivo, 'a', encoding='utf-8') as f:
            f.write(f'{correo} {codigo}\n')


def _verificar_codigo(rut, codigo):
    """Correo al que se envió el código ingresado; si no calza, ValueError con el motivo."""
    vigentes = list(CodigoTrabajador.objects.filter(rut=rut, usado=False, expira_en__gt=timezone.now()))
    if not vigentes:
        raise ValueError('El código venció. Pide uno nuevo.')
    if any(c.intentos >= INTENTOS_POR_CODIGO for c in vigentes):
        raise ValueError('Superaste los intentos para este código. Pide uno nuevo.')
    huella = _huella(rut, str(codigo or '').strip())
    acertado = next((c for c in vigentes if secrets.compare_digest(c.huella, huella)), None)
    if acertado is None:
        CodigoTrabajador.objects.filter(id__in=[c.id for c in vigentes]).update(intentos=vigentes[0].intentos + 1)
        raise ValueError('El código no es correcto.')
    acertado.usado = True
    acertado.save(update_fields=['usado'])
    return acertado.correos


# ── Ingreso ──────────────────────────────────────────────────────────────────

_MENSAJE_CODIGO = 'Si tu RUT tiene documentos en Jornada40, te enviamos un código a tu correo personal.'


@api_view(['POST'])
@_publica
def ingreso(request):
    """Paso 1: el RUT. Con clave creada se pide la clave; si no, se envía un código."""
    rut = _rut_limpio(request.data.get('rut'))
    if not rut:
        return Response({'error': 'Ingresa un RUT válido.'}, status=status.HTTP_400_BAD_REQUEST)
    cuenta = CuentaTrabajador.objects.filter(rut=rut).first()
    if cuenta and cuenta.tiene_clave():
        return Response({'metodo': 'clave'})
    return _responder_con_codigo(rut)


def _responder_con_codigo(rut):
    correos = {e.email.strip().lower() for e in fichas_habilitadas(rut) if (e.email or '').strip()}
    if correos:
        error = _enviar_codigo(rut, correos)
        if error:
            return Response({'error': error}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    # Misma respuesta haya o no fichas: no revela quién trabaja dónde.
    return Response({'metodo': 'codigo', 'mensaje': _MENSAJE_CODIGO,
                     'destinos': sorted(_enmascarar(c) for c in correos)})


@api_view(['POST'])
@_publica
def pedir_codigo(request):
    """Entrar con código aunque haya clave ("olvidé mi clave") o reenviarlo."""
    rut = _rut_limpio(request.data.get('rut'))
    if not rut:
        return Response({'error': 'Ingresa un RUT válido.'}, status=status.HTTP_400_BAD_REQUEST)
    return _responder_con_codigo(rut)


@api_view(['POST'])
@_publica
def verificar_codigo(request):
    rut = _rut_limpio(request.data.get('rut'))
    try:
        correos = _verificar_codigo(rut, request.data.get('codigo'))
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    cuenta, _ = CuentaTrabajador.objects.get_or_create(rut=rut)
    for correo in correos:
        CorreoTrabajador.objects.update_or_create(cuenta=cuenta, email=correo)
    return _poner_sesion(Response(_datos_cuenta(cuenta, 'codigo')), cuenta, 'codigo')


@api_view(['POST'])
@_publica
def ingresar_con_clave(request):
    rut = _rut_limpio(request.data.get('rut'))
    cuenta = CuentaTrabajador.objects.filter(rut=rut).first() if rut else None
    if not cuenta or not cuenta.clave_correcta(str(request.data.get('clave') or '')):
        return Response({'error': 'RUT o clave incorrectos.'}, status=status.HTTP_400_BAD_REQUEST)
    return _poner_sesion(Response(_datos_cuenta(cuenta, 'clave')), cuenta, 'clave')


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def salir(request):
    respuesta = Response({'ok': True})
    respuesta.delete_cookie(COOKIE, path='/', samesite='None' if getattr(settings, 'IS_DEPLOYED', False) else 'Lax')
    return respuesta


# ── Cuenta ───────────────────────────────────────────────────────────────────

def _nombre(emp):
    return ' '.join(p for p in (emp.nombres, emp.apellido_paterno, emp.apellido_materno) if p).strip().title()


def _empleo(emp):
    hasta = acceso_hasta(emp)
    return {'id': emp.id, 'empresa': emp.empresa.nombre_legal.title(), 'empresa_rut': emp.empresa.rut,
            'cargo': (emp.cargo or '').title(), 'activo': emp.activo,
            'acceso_hasta': hasta.isoformat() if hasta else None}


def _datos_cuenta(cuenta, via):
    accesibles = fichas_accesibles(cuenta)
    ids = {e.id for e in accesibles}
    por_vincular = [e for e in fichas_habilitadas(cuenta.rut) if e.id not in ids and (e.email or '').strip()]
    return {
        'rut': formatear_rut(cuenta.rut),
        'nombre': _nombre(accesibles[0]) if accesibles else '',
        'tiene_clave': cuenta.tiene_clave(),
        'mostrar_invitacion_clave': not cuenta.invitacion_clave_vista and not cuenta.tiene_clave(),
        'ingreso_con': via,
        'empleos': [_empleo(e) for e in accesibles],
        'por_vincular': [{'id': e.id, 'empresa': e.empresa.nombre_legal.title(), 'correo': _enmascarar(e.email)}
                         for e in por_vincular],
    }


@api_view(['GET'])
@_con_sesion
def yo(request):
    return Response(_datos_cuenta(request.user, request.auth.get('via')))


@api_view(['POST'])
@_con_sesion
def omitir_invitacion(request):
    request.user.invitacion_clave_vista = True
    request.user.save(update_fields=['invitacion_clave_vista'])
    return Response({'ok': True})


@api_view(['POST'])
@_con_sesion
def fijar_clave(request):
    """Crear o cambiar la clave. Quien entró con clave debe dar la actual; quien
    entró con un código recién verificado no (así se recupera una clave olvidada)."""
    cuenta = request.user
    nueva = str(request.data.get('clave_nueva') or '')
    if cuenta.tiene_clave() and request.auth.get('via') == 'clave' \
            and not cuenta.clave_correcta(str(request.data.get('clave_actual') or '')):
        return Response({'error': 'La clave actual no es correcta.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(nueva) < LARGO_MINIMO_CLAVE or nueva.isdigit() or nueva == cuenta.rut:
        return Response({'error': f'La clave debe tener al menos {LARGO_MINIMO_CLAVE} caracteres, no solo números, '
                                  'y no puede ser tu RUT.'}, status=status.HTTP_400_BAD_REQUEST)
    cuenta.fijar_clave(nueva)
    cuenta.invitacion_clave_vista = True
    cuenta.save(update_fields=['password', 'version_sesion', 'invitacion_clave_vista'])
    # La sesión actual se renueva con la versión nueva; las demás quedan cerradas.
    return _poner_sesion(Response({'ok': True}), cuenta, request.auth.get('via'))


@api_view(['POST'])
@_con_sesion
def vincular_empleo(request):
    """Envía un código al correo de otra ficha del mismo RUT para verla también."""
    cuenta = request.user
    try:
        ficha_id = int(request.data.get('ficha'))
    except (TypeError, ValueError):
        ficha_id = None
    ficha = next((e for e in fichas_habilitadas(cuenta.rut) if e.id == ficha_id), None)
    if not ficha or not (ficha.email or '').strip():
        return Response({'error': 'Empleo no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    error = _enviar_codigo(cuenta.rut, {ficha.email.strip().lower()})
    if error:
        return Response({'error': error}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    return Response({'destino': _enmascarar(ficha.email)})


@api_view(['POST'])
@_con_sesion
def confirmar_empleo(request):
    try:
        correos = _verificar_codigo(request.user.rut, request.data.get('codigo'))
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    for correo in correos:
        CorreoTrabajador.objects.update_or_create(cuenta=request.user, email=correo)
    return Response(_datos_cuenta(request.user, request.auth.get('via')))


# ── Documentos (solo lectura) ────────────────────────────────────────────────

def _periodo_cerrado(liq):
    hoy = timezone.localdate()
    return (liq.anio, liq.mes) < (hoy.year, hoy.month)


def _firmas_por(campo, ids):
    return {getattr(s, f'{campo}_id'): s for s in SolicitudFirma.objects.filter(
        **{f'{campo}_id__in': ids}).exclude(estado='CANCELADO').order_by('enviado_en')}


def _liquidaciones(fichas):
    """Liquidaciones que el trabajador puede descargar: solo las firmadas, que
    son las que presenta donde las pidan."""
    liqs = list(Liquidacion.objects.filter(empleado__in=fichas).select_related('empleado__empresa')
                .order_by('-anio', '-mes'))
    firmas = _firmas_por('liquidacion', [l.id for l in liqs])
    return [(l, firmas[l.id]) for l in liqs if l.id in firmas and firmas[l.id].estado == 'FIRMADO']


def _liquidaciones_por_firmar(fichas):
    """Liquidaciones de meses cerrados que aún no firma: sin solicitud, o con una
    vencida o cancelada. Las rechazadas esperan la corrección del empleador y
    las pendientes ya aparecen con su propio enlace."""
    liqs = Liquidacion.objects.filter(empleado__in=fichas).select_related('empleado__empresa').order_by('anio', 'mes')
    vivas = set(SolicitudFirma.objects.filter(liquidacion__in=liqs, estado__in=[
        'PENDIENTE', 'PROCESANDO', 'FIRMADO', 'RECHAZADO']).values_list('liquidacion_id', flat=True))
    return [l for l in liqs if _periodo_cerrado(l) and l.id not in vivas]


_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
          'noviembre', 'diciembre']


@api_view(['GET'])
@_con_sesion
def liquidaciones(request):
    return Response([{
        'id': l.id, 'mes': l.mes, 'anio': l.anio, 'empresa': l.empleado.empresa.nombre_legal.title(),
        'total_haberes': l.total_haberes, 'total_descuentos': l.total_descuentos, 'liquido': l.sueldo_liquido,
        'firmada': bool(f and f.estado == 'FIRMADO'),
    } for l, f in _liquidaciones(fichas_accesibles(request.user))])


def _documentos(fichas):
    """[(clave, dict)] de lo que el trabajador ya recibió, sin liquidaciones."""
    docs = []
    for c in Contrato.objects.filter(empleado__in=fichas).select_related('empleado__empresa'):
        docs.append(('contrato', c.id, c.empleado, 'Contrato de trabajo', c.fecha_inicio,
                     bool(pdf_firmado_existe('CONTRATO', contrato=c))))
    etiquetas = dict(SolicitudFirma.TIPOS_DOCUMENTO)
    firmadas = (SolicitudFirma.objects.filter(empleado__in=fichas, estado='FIRMADO')
                .exclude(tipo_documento__in=['LIQUIDACION', 'CONTRATO'])
                .select_related('empleado__empresa', 'anexo_contrato'))
    for s in firmadas:
        titulo = etiquetas.get(s.tipo_documento, s.tipo_documento)
        if s.anexo_contrato_id:
            titulo = s.anexo_contrato.titulo if s.anexo_contrato else titulo
        docs.append(('firma', s.id, s.empleado, titulo, timezone.localtime(s.firmado_en).date() if s.firmado_en else None,
                     True))
    # Reglamento interno vigente de cada empresa: el trabajador siempre puede consultarlo (Art. 156).
    from ..models import ReglamentoInterno
    empresas = {f.empresa_id: f for f in fichas}
    for r in ReglamentoInterno.objects.filter(empresa_id__in=empresas, activo=True):
        docs.append(('reglamento', r.id, empresas[r.empresa_id], f'{r.get_tipo_display()} (versión {r.version})',
                     r.publicado_en, False))
    # Cartas y constancias: solo firmadas (van arriba como 'firma'); las pendientes esperan en Inicio.
    # Comprobantes de vacaciones: igual, solo firmados; los demás se piden en Solicitudes.
    return docs


def pdf_firmado_existe(tipo, **documento):
    return SolicitudFirma.objects.filter(estado='FIRMADO', tipo_documento=tipo, **documento) \
        .exclude(b2_key_firmado='').exists()


@api_view(['GET'])
@_con_sesion
def documentos(request):
    docs = _documentos(fichas_accesibles(request.user))
    docs.sort(key=lambda d: d[4] or datetime.date.min, reverse=True)
    return Response([{'tipo': t, 'id': i, 'titulo': titulo, 'fecha': f.isoformat() if f else None,
                      'empresa': emp.empresa.nombre_legal.title(), 'firmado': firmado}
                     for t, i, emp, titulo, f, firmado in docs])


@api_view(['GET'])
@_con_sesion
def descargar(request):
    """PDF de un documento que el trabajador puede ver (firmado si lo está)."""
    fichas = fichas_accesibles(request.user)
    tipo = request.query_params.get('tipo')
    try:
        ident = int(request.query_params.get('id'))
    except (TypeError, ValueError):
        return Response({'error': 'Documento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    try:
        if tipo == 'liquidacion':
            from .calculo_liquidacion import _pdf_liquidacion
            liq = next((l for l, _ in _liquidaciones(fichas) if l.id == ident), None)
            if not liq:
                raise LookupError
            nombre = f'Liquidacion_{liq.anio}_{liq.mes:02d}.pdf'
            firmado = pdf_firmado('LIQUIDACION', liquidacion=liq)
            return respuesta_pdf(firmado or _pdf_liquidacion(liq, False), nombre, firmado=bool(firmado))
        if tipo == 'certificado_sii':
            from ..models import CertificadoSueldos
            from .certificado_sueldos import pdf_certificado_sueldos, vigentes
            cert = CertificadoSueldos.objects.filter(id=ident, empleado__in=fichas).select_related('empresa', 'reemplaza').first()
            if not cert or cert not in vigentes(cert.empresa, cert.anio):
                raise LookupError
            return respuesta_pdf(pdf_certificado_sueldos(cert), f'Certificado6_{cert.anio}_{cert.numero}.pdf')
        if tipo == 'certificado':
            from ..models import CertificadoEmitido
            from .certificados import pdf_certificado
            cert = CertificadoEmitido.objects.filter(id=ident, empleado__in=fichas).select_related('empleado__empresa').first()
            if not cert:
                raise LookupError
            if cert.anulado_en:
                return Response({'error': 'Tu empleador anuló este certificado. Puedes emitir uno nuevo.'},
                                status=status.HTTP_410_GONE)
            return respuesta_pdf(pdf_certificado(cert), f'{cert.folio}.pdf')
        visibles = {(t, i): (emp, titulo) for t, i, emp, titulo, _, _ in _documentos(fichas)}
        if (tipo, ident) not in visibles:
            raise LookupError
        if tipo == 'contrato':
            contrato = Contrato.objects.get(id=ident)
            firmado = pdf_firmado('CONTRATO', contrato=contrato)
            pdf = firmado or _html_a_pdf_bytes(render_to_string('contrato_trabajo.html',
                                                                _ctx_contrato(contrato, False)), 'Contrato')
            return respuesta_pdf(pdf, 'Contrato.pdf', firmado=bool(firmado))
        if tipo == 'reglamento':
            from ..models import ReglamentoInterno
            r = ReglamentoInterno.objects.get(id=ident)
            with r.archivo.open('rb') as f:
                return respuesta_pdf(f.read(), f'Reglamento_interno_v{r.version}.pdf')
        if tipo == 'firma':
            from .. import b2_client
            solicitud = SolicitudFirma.objects.get(id=ident)
            return respuesta_pdf(b2_client.descargar_documento(solicitud.b2_key_firmado),
                                 f'{solicitud.tipo_documento.title()}.pdf', firmado=True)
        raise LookupError
    except LookupError:
        return Response({'error': 'Documento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception:
        logger.exception('Portal del trabajador: no se pudo entregar %s %s', tipo, ident)
        return Response({'error': 'No pudimos obtener el documento. Intenta de nuevo en unos minutos.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@_con_sesion
def vacaciones(request):
    from .feriado import calcular_saldo_vacaciones
    salida = []
    for emp in fichas_accesibles(request.user):
        try:
            saldo = calcular_saldo_vacaciones(emp)
        except Exception:
            logger.exception('Saldo de vacaciones del portal, ficha %s', emp.id)
            saldo = None
        registros = VacacionEmpleado.objects.filter(empleado=emp, estado='APROBADO').order_by('-fecha_inicio')
        # Días libres por horas extra (Art. 32 inc. 4°): solo si alguna vez los tuvo.
        descanso = None
        contrato = Contrato.objects.filter(empleado=emp).first()
        if contrato:
            from .horas_compensatorias import resumen_empleado
            r = resumen_empleado(emp, contrato, timezone.localdate())
            if r['horas_disponibles'] or r['generadas_anualidad'] or r['compensacion_vigente'] != 'PAGO':
                descanso = {k: r[k] for k in ('horas_disponibles', 'dias_aproximados', 'proximo_vencimiento',
                                              'horas_por_vencer')}
        salida.append({**_empleo(emp), 'saldo': saldo, 'horas_descanso': descanso, 'registros': [
            {'id': v.id, 'desde': v.fecha_inicio.isoformat(), 'hasta': v.fecha_fin.isoformat(),
             'dias_habiles': v.dias_habiles, 'tipo': v.get_tipo_display()} for v in registros]})
    return Response(salida)


@api_view(['GET'])
@_con_sesion
def firmas_pendientes(request):
    """Documentos por firmar: solicitudes pendientes (con su enlace) y
    liquidaciones de meses cerrados sin firmar (se firman con POST firmar/)."""
    fichas = fichas_accesibles(request.user)
    qs = SolicitudFirma.objects.filter(empleado__in=fichas)
    SolicitudFirma.actualizar_estados(qs)
    etiquetas = dict(SolicitudFirma.TIPOS_DOCUMENTO)
    pendientes = [{
        'id': s.id, 'tipo': 'solicitud', 'documento': _titulo_solicitud(s, etiquetas),
        'empresa': s.empresa.nombre_legal.title(), 'vence': s.expira_en.isoformat(),
        'enlace': f'/firma/{s.token}',
    } for s in qs.filter(estado='PENDIENTE').select_related('empresa', 'liquidacion').order_by('expira_en')]
    pendientes += [{
        'id': l.id, 'tipo': 'liquidacion', 'documento': f'Liquidación de sueldo · {_MESES[l.mes - 1]} {l.anio}',
        'empresa': l.empleado.empresa.nombre_legal.title(), 'vence': None, 'enlace': None,
    } for l in _liquidaciones_por_firmar(fichas)]
    return Response(pendientes)


def _titulo_solicitud(s, etiquetas):
    if s.tipo_documento == 'LIQUIDACION' and s.liquidacion_id:
        return f'Liquidación de sueldo · {_MESES[s.liquidacion.mes - 1]} {s.liquidacion.anio}'
    return etiquetas.get(s.tipo_documento, s.tipo_documento)


@api_view(['POST'])
@_con_sesion
def firmar_liquidacion(request):
    """Inicia la firma de una liquidación de un mes cerrado desde el portal:
    crea la solicitud (sin correo, el trabajador ya está aquí) y devuelve el
    enlace del flujo de firma."""
    from .firmas import SolicitudFirmaViewSet, _ErrorFirma
    try:
        ident = int(request.data.get('liquidacion'))
    except (TypeError, ValueError):
        ident = None
    fichas = fichas_accesibles(request.user)
    liq = next((l for l in _liquidaciones_por_firmar(fichas) if l.id == ident), None)
    if liq is None:
        pendiente = SolicitudFirma.objects.filter(liquidacion_id=ident, empleado__in=fichas, estado='PENDIENTE').first()
        if pendiente:
            return Response({'enlace': f'/firma/{pendiente.token}'})
        return Response({'error': 'Esta liquidación no está disponible para firmar.'}, status=status.HTTP_404_NOT_FOUND)
    empresa = liq.empleado.empresa
    try:
        # La pide el trabajador sobre una liquidación que el empleador ya emitió: queda registrado el origen.
        solicitud = SolicitudFirmaViewSet()._crear_solicitud(empresa.owner, liq.empleado, 'LIQUIDACION',
                                                             liquidacion_id=liq.id, avisar_por_correo=False,
                                                             emision={'origen': 'PORTAL', 'emisor': empresa.owner})
    except _ErrorFirma as e:
        if not empresa.firma_imagen:
            return Response({'error': f'{empresa.nombre_legal.title()} aún no habilita la firma electrónica. '
                                      'Pídele que la configure.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'error': e.mensaje}, status=e.estado)
    return Response({'enlace': f'/firma/{solicitud.token}'})
