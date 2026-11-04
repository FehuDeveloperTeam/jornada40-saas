"""Firma del empleador a distancia (plan Corporativo).

Quien administra la cuenta (el titular, o un usuario del equipo con un módulo de
documentos en "ver y gestionar") le pide por correo al representante legal de una
empresa que registre su firma. El representante abre el enlace, confirma su RUT y
un código de un solo uso enviado a ese correo, acepta la declaración y dibuja su
firma: queda como firma del empleador de la empresa, igual que si se hubiera
dibujado en el panel. La solicitud guarda la evidencia (declaración aceptada,
fechas, IP, huella de la imagen) y la constancia en PDF va por correo al titular,
a quien la pidió y al representante.

El código y la clave solo verifican la identidad; el acto de firma es la
aceptación expresa de la declaración más el trazo, como en la firma del trabajador.
"""
import base64
import hashlib
import io
import re
import secrets
import string
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.db import transaction
from django.template.loader import get_template, render_to_string
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .. import bitacora
from ..autenticacion import actor, usuario_equipo_de
from ..models import Empresa, SolicitudFirmaEmpleador
from ..rut import es_rut_de_persona, formatear_rut, limpiar_rut, validar_rut
from .base import THROTTLES_FIRMA_PUBLICA, _html_a_pdf_bytes, _plan_permite, error_interno, logger, respuesta_pdf
from .certificados import _firma_legible
from .firma_publica import _enmascarar_email
from .portal_trabajador import _anotar_para_pruebas

NIVEL_FIRMA_A_DISTANCIA = 4   # Corporativo
MENSAJE_PLAN = 'Pedir la firma del empleador a distancia está disponible desde el plan Corporativo.'
CARGO_POR_DEFECTO = 'Representante legal'
LARGO_MAXIMO_FIRMA = 500_000
_IMAGEN = re.compile(r'^data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)$')


def _sitio():
    return getattr(settings, 'SITIO_URL', 'https://jornada40.cl').rstrip('/')


def _fecha_hora(dt):
    return timezone.localtime(dt).strftime('%d/%m/%Y %H:%M') + ' (hora de Chile)' if dt else ''


def _fecha(dt):
    return timezone.localtime(dt).strftime('%d/%m/%Y') if dt else ''


def _nombre_persona(user):
    """Nombre de quien pide la firma: el usuario del equipo o el titular."""
    if user is None:
        return ''
    ue = usuario_equipo_de(user)
    if ue is not None:
        return ue.nombre_completo
    cliente = getattr(user, 'perfil_cliente', None)
    if cliente is not None:
        nombre = ' '.join(p for p in (cliente.nombres, cliente.apellido_paterno) if p).strip()
        if nombre:
            return nombre
    return (user.get_full_name() or user.username).strip()


def _correo_persona(user):
    ue = usuario_equipo_de(user)
    return (ue.correo if ue is not None else user.email) or ''


def declaracion(s):
    """Texto que el representante acepta antes de dibujar su firma (se guarda tal cual al firmar)."""
    e = s.empresa
    return (f'Yo, {s.nombre}, RUT {s.rut}, declaro que soy representante legal de {e.nombre_legal}, '
            f'RUT {e.rut}, y autorizo que la firma que dibujo a continuación se estampe como firma del '
            f'empleador en los documentos laborales que la empresa emita y envíe a firma desde Jornada40, '
            f'por medio de las personas que administran su cuenta.')


def _dato(s):
    return {
        'id': s.id, 'folio': s.folio, 'empresa': s.empresa_id, 'nombre': s.nombre, 'rut': s.rut,
        'cargo': s.cargo, 'email': s.email, 'estado': s.estado, 'estado_display': s.get_estado_display(),
        'creada_en': s.creada_en.isoformat() if s.creada_en else None,
        'expira_en': s.expira_en.isoformat() if s.expira_en else None,
        'firmada_en': s.firmada_en.isoformat() if s.firmada_en else None,
        'correo_enviado': s.correo_enviado, 'pedida_por': s.pedida_por_nombre,
    }


def _dato_empresa(e, ultima):
    return {
        'id': e.id, 'nombre': e.nombre_legal, 'rut': e.rut,
        'representante_legal': e.representante_legal or '', 'rut_representante': e.rut_representante or '',
        'firma': {
            'configurada': bool(e.firma_imagen),
            'nombre': e.firma_firmante_nombre, 'cargo': e.firma_firmante_cargo,
            'configurada_en': e.firma_configurada_en.isoformat() if e.firma_configurada_en else None,
            'a_distancia': e.firma_solicitud_id is not None,
            'solicitud_id': e.firma_solicitud_id,
            'folio': e.firma_solicitud.folio if e.firma_solicitud_id else '',
        },
        # El último pedido de la empresa (pendiente, vencido, cancelado o firmado), o None.
        'solicitud': _dato(ultima) if ultima else None,
    }


def _validar(datos):
    """(campos, error) con los datos del representante que escribió quien pide la firma."""
    nombre = ' '.join(str(datos.get('nombre') or '').split())
    if len(nombre) < 3:
        return None, 'Indica el nombre completo del representante legal.'
    rut = str(datos.get('rut') or '').strip()
    if not validar_rut(rut):
        return None, 'El RUT del representante no es válido: revisa el dígito verificador.'
    if not es_rut_de_persona(rut):
        return None, 'Indica el RUT de la persona que firma, no el de la empresa.'
    cargo = ' '.join(str(datos.get('cargo') or '').split()) or CARGO_POR_DEFECTO
    email = str(datos.get('email') or '').strip().lower()
    try:
        validate_email(email)
    except DjangoValidationError:
        return None, 'El correo del representante no es válido.'
    return {'nombre': nombre[:200], 'rut': formatear_rut(rut), 'cargo': cargo[:200], 'email': email}, None


def _avisos(empresa, s):
    """Advertencias al pedir la firma (nunca bloquean)."""
    avisos = []
    rut_registrado = (empresa.rut_representante or '').strip()
    if rut_registrado and limpiar_rut(rut_registrado) != limpiar_rut(s.rut):
        avisos.append(f'El RUT indicado no es el del representante legal registrado en la empresa '
                      f'({empresa.representante_legal or formatear_rut(rut_registrado)}, {formatear_rut(rut_registrado)}). '
                      f'Si firma otra persona, verifica que tenga poder para representar a la empresa.')
    elif not rut_registrado:
        avisos.append('La empresa no tiene representante legal registrado: cuando firme, se completará con estos datos.')
    if empresa.firma_imagen:
        avisos.append('La empresa ya tiene una firma registrada: cuando el representante firme, la nueva la reemplazará.')
    return avisos


def _enviar(plantilla, asunto, para, ctx, adjunto=None):
    msg = EmailMultiAlternatives(asunto, render_to_string(f'{plantilla}.txt', ctx), settings.DEFAULT_FROM_EMAIL,
                                 to=para)
    msg.attach_alternative(render_to_string(f'{plantilla}.html', ctx), 'text/html')
    if adjunto:
        msg.attach(*adjunto)
    msg.send()


def _enviar_pedido(s):
    """Correo al representante con el enlace. True si salió."""
    e = s.empresa
    ctx = {'nombre': s.nombre, 'empresa': e.nombre_legal, 'empresa_rut': e.rut,
           'quien': s.pedida_por_nombre or 'Quien administra la cuenta', 'enlace': f'{_sitio()}/firma-empleador/{s.token}',
           'vence': _fecha(s.expira_en)}
    try:
        _enviar('firma_empleador_pedido', f'Registra tu firma como representante legal de {e.nombre_legal}',
                [s.email], ctx)
        return True
    except Exception:
        logger.exception('No se pudo enviar el pedido de firma del empleador %s', s.pk)
        return False


# ── Panel: pedir, reenviar, cancelar y descargar la constancia ──────────────

class SolicitudFirmaEmpleadorViewSet(viewsets.ViewSet):
    """`/api/firmas-empleador/`. El titular y los usuarios del equipo con un módulo de documentos
    (ver para consultar, gestionar para pedir); cada uno solo en sus empresas (core.contexto)."""
    permission_classes = [IsAuthenticated]

    def _solicitudes(self, request):
        return SolicitudFirmaEmpleador.objects.filter(empresa__owner=request.user, empresa__activo=True)

    def _solicitud(self, request, pk, bloquear=False):
        qs = self._solicitudes(request)
        if bloquear:
            qs = qs.select_for_update()
        try:
            return qs.select_related('empresa').get(pk=int(pk))
        except (SolicitudFirmaEmpleador.DoesNotExist, TypeError, ValueError):
            return None

    def list(self, request):
        SolicitudFirmaEmpleador.actualizar_estados(self._solicitudes(request))
        ultimas = {}
        for s in self._solicitudes(request).select_related('empresa').order_by('-creada_en', '-id'):
            ultimas.setdefault(s.empresa_id, s)
        empresas = Empresa.objects.filter(owner=request.user, activo=True).select_related(
            'firma_solicitud').order_by('id')
        return Response({
            'permitido': _plan_permite(request.user, NIVEL_FIRMA_A_DISTANCIA),
            'dias_vigencia': SolicitudFirmaEmpleador.DIAS_VIGENCIA,
            'empresas': [_dato_empresa(e, ultimas.get(e.id)) for e in empresas],
        })

    def create(self, request):
        if not _plan_permite(request.user, NIVEL_FIRMA_A_DISTANCIA):
            return Response({'error': MENSAJE_PLAN}, status=status.HTTP_403_FORBIDDEN)
        try:
            empresa_id = int(request.data.get('empresa') or 0)
        except (TypeError, ValueError):
            empresa_id = 0
        empresa = Empresa.objects.filter(pk=empresa_id, owner=request.user, activo=True).first()
        if empresa is None:
            return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        campos, error = _validar(request.data)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        persona = actor(request)
        with transaction.atomic():
            # Un pedido vigente por empresa: el nuevo reemplaza al anterior (otro correo, otra persona).
            Empresa.objects.select_for_update().filter(pk=empresa.pk).first()
            SolicitudFirmaEmpleador.objects.filter(empresa=empresa, estado='PENDIENTE').update(
                estado='CANCELADA', cancelada_en=timezone.now())
            s = SolicitudFirmaEmpleador.objects.create(empresa=empresa, pedida_por=persona,
                                                       pedida_por_nombre=_nombre_persona(persona)[:200], **campos)
        s.correo_enviado = _enviar_pedido(s)
        s.save(update_fields=['correo_enviado'])
        return Response({**_dato(s), 'avisos': _avisos(empresa, s)}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def reenviar(self, request, pk=None):
        if not _plan_permite(request.user, NIVEL_FIRMA_A_DISTANCIA):
            return Response({'error': MENSAJE_PLAN}, status=status.HTTP_403_FORBIDDEN)
        s = self._solicitud(request, pk)
        if s is None:
            return Response({'error': 'Pedido no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        SolicitudFirmaEmpleador.actualizar_estados(SolicitudFirmaEmpleador.objects.filter(pk=s.pk))
        s.refresh_from_db()
        if s.estado == 'EXPIRADA':
            return Response({'error': 'El plazo para firmar venció. Pide la firma de nuevo.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if s.estado != 'PENDIENTE':
            return Response({'error': 'Solo se puede reenviar un pedido pendiente.'}, status=status.HTTP_400_BAD_REQUEST)
        if not _enviar_pedido(s):
            # El servicio de correo falló: el pedido sigue pendiente y se puede volver a intentar.
            return Response({'error': 'No pudimos enviar el correo. Intenta de nuevo en unos minutos.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not s.correo_enviado:
            s.correo_enviado = True
            s.save(update_fields=['correo_enviado'])
        return Response(_dato(s))

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        with transaction.atomic():
            s = self._solicitud(request, pk, bloquear=True)
            if s is None:
                return Response({'error': 'Pedido no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            if s.estado != 'PENDIENTE':
                return Response({'error': 'Solo se puede cancelar un pedido pendiente.'},
                                status=status.HTTP_400_BAD_REQUEST)
            s.estado = 'CANCELADA'
            s.cancelada_en = timezone.now()
            s.save(update_fields=['estado', 'cancelada_en'])
        return Response(_dato(s))

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Constancia del registro de la firma (solo de un pedido firmado)."""
        s = self._solicitud(request, pk)
        if s is None or s.estado != 'FIRMADA':
            return Response({'error': 'La constancia existe cuando el representante ya registró su firma.'},
                            status=status.HTTP_404_NOT_FOUND)
        try:
            contenido = pdf_constancia(s)
        except Exception:
            return error_interno('constancia de la firma del empleador')
        return respuesta_pdf(contenido, f'Constancia_firma_empleador_{s.folio}.pdf')


# ── Constancia en PDF ────────────────────────────────────────────────────────

def pdf_constancia(s):
    e = s.empresa
    html = get_template('firma_empleador_constancia.html').render({
        's': s, 'empresa': e, 'folio': s.folio, 'firma': _firma_legible(s.firma_imagen),
        'creada': _fecha_hora(s.creada_en), 'verificada': _fecha_hora(s.verificada_en),
        'firmada': _fecha_hora(s.firmada_en), 'emitida': _fecha_hora(timezone.now()),
    })
    return _html_a_pdf_bytes(html, s.folio)


# ── Flujo público del representante ─────────────────────────────────────────
# Sin sesión del panel: el enlace (token) identifica el pedido; el RUT y el código
# por correo, a la persona. Límite de intentos por enlace y por IP, como la firma
# del trabajador.

def _publica(metodos):
    def decorar(vista):
        vista = throttle_classes(THROTTLES_FIRMA_PUBLICA)(vista)
        vista = permission_classes([AllowAny])(vista)
        vista = authentication_classes([])(vista)
        return api_view(metodos)(vista)
    return decorar


_NO_DISPONIBLE = {
    'CANCELADA': ('La empresa canceló este pedido. Si corresponde, pídeles que lo envíen de nuevo.', 410),
    'EXPIRADA': ('El enlace venció. Pide a la empresa que te lo envíe de nuevo.', 410),
    'FIRMADA': ('Tu firma ya quedó registrada. No necesitas hacer nada más.', 400),
}


def _buscar(token, bloquear=False):
    """El pedido del enlace, con su estado al día (los vencidos pasan a vencidos)."""
    SolicitudFirmaEmpleador.actualizar_estados(SolicitudFirmaEmpleador.objects.filter(token=token))
    qs = SolicitudFirmaEmpleador.objects.select_related('empresa')
    if bloquear:
        qs = qs.select_for_update(of=('self',))
    return qs.filter(token=token).first()


def _no_disponible(s):
    if s is None:
        return Response({'error': 'El enlace no es válido.'}, status=status.HTTP_404_NOT_FOUND)
    if s.estado in _NO_DISPONIBLE:
        texto, codigo = _NO_DISPONIBLE[s.estado]
        return Response({'error': texto, 'estado': s.estado}, status=codigo)
    return None


def _sesion_valida(s, valor):
    try:
        return bool(s.sesion) and uuid.UUID(str(valor or '')) == s.sesion
    except (ValueError, TypeError, AttributeError):
        return False


@_publica(['GET'])
def publica_info(request, token):
    s = _buscar(token)
    if s is None:
        return Response({'error': 'El enlace no es válido.'}, status=status.HTTP_404_NOT_FOUND)
    datos = {
        'estado': s.estado, 'empresa_nombre': s.empresa.nombre_legal, 'empresa_rut': s.empresa.rut,
        'nombre': s.nombre, 'cargo': s.cargo, 'email_enmascarado': _enmascarar_email(s.email),
        'expira_en': s.expira_en.isoformat(), 'pedida_por': s.pedida_por_nombre,
        'minutos_codigo': SolicitudFirmaEmpleador.MINUTOS_CODIGO,
    }
    # La declaración lleva el RUT del representante: solo después de verificar su identidad.
    if _sesion_valida(s, request.query_params.get('sesion')):
        datos['verificado'] = True
        datos['declaracion'] = s.declaracion or declaracion(s)
    if s.estado == 'FIRMADA':
        datos.update(firmada_en=s.firmada_en.isoformat() if s.firmada_en else None, folio=s.folio)
    return Response(datos)


@_publica(['POST'])
def publica_codigo(request, token):
    """Envía un código de 6 dígitos al correo del pedido, si el RUT es el del representante."""
    ahora = timezone.now()
    with transaction.atomic():
        s = _buscar(token, bloquear=True)
        respuesta = _no_disponible(s)
        if respuesta is not None:
            return respuesta
        if limpiar_rut(request.data.get('rut', '')) != limpiar_rut(s.rut):
            return Response({'error': 'El RUT no coincide con el de la persona a la que se envió el pedido.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if s.codigos_pedidos >= SolicitudFirmaEmpleador.CODIGOS_MAXIMOS:
            return Response({'error': 'Pediste demasiados códigos con este enlace. Pide a la empresa que te lo '
                                      'envíe de nuevo.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if s.codigo_creado_en and (ahora - s.codigo_creado_en).total_seconds() < 60:
            espera = 60 - int((ahora - s.codigo_creado_en).total_seconds())
            return Response({'error': f'Espera {espera} segundo(s) antes de pedir otro código.'},
                            status=status.HTTP_429_TOO_MANY_REQUESTS)
        codigo = ''.join(secrets.choice(string.digits) for _ in range(6))
        s.codigo_hash = SolicitudFirmaEmpleador.huella(s.token, codigo)
        s.codigo_creado_en = ahora
        s.codigo_intentos = 0
        s.codigos_pedidos += 1
        s.save(update_fields=['codigo_hash', 'codigo_creado_en', 'codigo_intentos', 'codigos_pedidos'])
    _anotar_para_pruebas(f'firma-empleador:{s.token}', codigo)
    ctx = {'codigo': codigo, 'nombre': s.nombre, 'empresa': s.empresa.nombre_legal,
           'minutos': SolicitudFirmaEmpleador.MINUTOS_CODIGO}
    try:
        _enviar('firma_empleador_codigo', f'Tu código para registrar la firma de {s.empresa.nombre_legal}',
                [s.email], ctx)
    except Exception:
        logger.exception('No se pudo enviar el código de la firma del empleador %s', s.pk)
        # Sin correo no hay código: se puede pedir otro de inmediato.
        SolicitudFirmaEmpleador.objects.filter(pk=s.pk, codigo_hash=s.codigo_hash).update(
            codigo_hash='', codigo_creado_en=None)
        return Response({'error': 'No pudimos enviar el código a tu correo. Intenta de nuevo en unos minutos.'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response({'enviado': True, 'email_destino': _enmascarar_email(s.email),
                     'expira_en_minutos': SolicitudFirmaEmpleador.MINUTOS_CODIGO})


@_publica(['POST'])
def publica_verificar(request, token):
    """Verifica el código (un uso, 3 intentos, 10 minutos) y abre la sesión para firmar."""
    codigo = str(request.data.get('codigo') or '').strip()
    if not codigo:
        return Response({'error': 'Ingresa el código que te enviamos.'}, status=status.HTTP_400_BAD_REQUEST)
    ahora = timezone.now()
    with transaction.atomic():
        s = _buscar(token, bloquear=True)
        respuesta = _no_disponible(s)
        if respuesta is not None:
            return respuesta
        vigente = s.codigo_hash and s.codigo_creado_en and \
            (ahora - s.codigo_creado_en).total_seconds() <= SolicitudFirmaEmpleador.MINUTOS_CODIGO * 60
        if not vigente:
            return Response({'error': 'El código venció o todavía no lo pides. Pide uno nuevo.'},
                            status=status.HTTP_400_BAD_REQUEST)
        s.codigo_intentos += 1
        if s.codigo_intentos > SolicitudFirmaEmpleador.INTENTOS_CODIGO:
            s.save(update_fields=['codigo_intentos'])
            return Response({'error': 'Superaste los intentos para este código. Pide uno nuevo.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not s.coincide(codigo):
            s.save(update_fields=['codigo_intentos'])
            restantes = SolicitudFirmaEmpleador.INTENTOS_CODIGO - s.codigo_intentos
            return Response({'error': f'Código incorrecto. Te quedan {restantes} intento(s).' if restantes > 0
                             else 'Código bloqueado. Pide uno nuevo.'}, status=status.HTTP_400_BAD_REQUEST)
        s.codigo_hash = ''   # un solo uso
        s.sesion = uuid.uuid4()
        s.verificada_en = ahora
        s.save(update_fields=['codigo_intentos', 'codigo_hash', 'sesion', 'verificada_en'])
    return Response({'verificado': True, 'sesion': str(s.sesion), 'declaracion': declaracion(s)})


def _imagen_valida(firma):
    """(huella SHA-256 de la imagen, error). Solo PNG o JPEG que se puedan abrir."""
    if not firma:
        return None, 'Dibuja tu firma antes de continuar.'
    if len(firma) > LARGO_MAXIMO_FIRMA:
        return None, 'La imagen de la firma es demasiado grande.'
    coincide = _IMAGEN.match(firma)
    if not coincide:
        return None, 'Formato de firma inválido.'
    from PIL import Image
    try:
        datos = base64.b64decode(coincide.group(2), validate=True)
        Image.open(io.BytesIO(datos)).verify()
    except Exception:   # base64 o imagen dañada (Pillow lanza varios tipos de error)
        return None, 'No pudimos leer la imagen de la firma. Vuelve a dibujarla.'
    return hashlib.sha256(datos).hexdigest(), None


@_publica(['POST'])
def publica_firmar(request, token):
    """Registra la firma: queda como firma del empleador de la empresa."""
    if request.data.get('acepto') is not True:
        return Response({'error': 'Para registrar tu firma debes aceptar la declaración.'},
                        status=status.HTTP_400_BAD_REQUEST)
    firma = str(request.data.get('firma') or '').strip()
    huella, error = _imagen_valida(firma)
    if error:
        return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
    ip = request.META.get('REMOTE_ADDR') or None
    with transaction.atomic():
        s = _buscar(token, bloquear=True)
        respuesta = _no_disponible(s)
        if respuesta is not None:
            return respuesta
        if not _sesion_valida(s, request.data.get('sesion')):
            return Response({'error': 'Tu verificación ya no es válida. Vuelve a pedir el código.'},
                            status=status.HTTP_403_FORBIDDEN)
        e = Empresa.objects.select_for_update().get(pk=s.empresa_id)
        s.empresa = e
        ahora = timezone.now()
        s.estado = 'FIRMADA'
        s.firmada_en = ahora
        s.declaracion = declaracion(s)
        s.ip = ip
        s.firma_imagen = firma
        s.huella_firma = huella
        s.save(update_fields=['estado', 'firmada_en', 'declaracion', 'ip', 'firma_imagen', 'huella_firma'])
        e.firma_imagen = firma
        # En mayúsculas, como la que se dibuja en el panel (los documentos los muestran así).
        e.firma_firmante_nombre = s.nombre.upper()
        e.firma_firmante_cargo = s.cargo.upper()
        e.firma_configurada_en = ahora
        e.firma_solicitud = s
        campos = ['firma_imagen', 'firma_firmante_nombre', 'firma_firmante_cargo', 'firma_configurada_en',
                  'firma_solicitud']
        # Si la empresa no tenía representante legal, queda con quien firmó (en mayúsculas, como el resto).
        if not (e.representante_legal or '').strip():
            e.representante_legal = s.nombre.upper()
            campos.append('representante_legal')
        if not (e.rut_representante or '').strip():
            e.rut_representante = s.rut
            campos.append('rut_representante')
        e.save(update_fields=campos)
    try:
        bitacora.registrar(e.owner, 'FIRMA_EMPLEADOR', f'{s.nombre} registró a distancia la firma del empleador '
                                                       f'({s.folio})', empresa=e, ip=ip or '')
    except Exception:
        logger.exception('No se pudo registrar en la bitácora la firma del empleador %s', s.pk)
    _avisar_registro(s)
    return Response({'firmada': True, 'firmada_en': ahora.isoformat(), 'folio': s.folio})


@_publica(['GET'])
def publica_constancia(request, token):
    """La constancia, para el representante que verificó su identidad en este enlace."""
    s = _buscar(token)
    if s is None:
        return Response({'error': 'El enlace no es válido.'}, status=status.HTTP_404_NOT_FOUND)
    if s.estado != 'FIRMADA' or not _sesion_valida(s, request.query_params.get('sesion')):
        return Response({'error': 'Verifica tu identidad para descargar la constancia.'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        contenido = pdf_constancia(s)
    except Exception:
        return error_interno('constancia de la firma del empleador (enlace)')
    return respuesta_pdf(contenido, f'Constancia_firma_empleador_{s.folio}.pdf')


def _avisar_registro(s):
    """Constancia por correo al representante y, aparte, al titular y a quien pidió la firma.
    Si falla, la firma ya quedó registrada: solo se anota en el log."""
    e = s.empresa
    try:
        adjunto = (f'Constancia_firma_empleador_{s.folio}.pdf', pdf_constancia(s), 'application/pdf')
    except Exception:
        logger.exception('No se pudo generar la constancia de la firma del empleador %s', s.pk)
        adjunto = None
    ctx = {'nombre': s.nombre, 'cargo': s.cargo, 'empresa': e.nombre_legal, 'empresa_rut': e.rut, 'folio': s.folio,
           'firmada': _fecha_hora(s.firmada_en), 'quien': s.pedida_por_nombre, 'adjunto': bool(adjunto)}
    try:
        _enviar('firma_empleador_registrada', f'Tu firma quedó registrada como firma del empleador de {e.nombre_legal}',
                [s.email], {**ctx, 'para_representante': True}, adjunto)
    except Exception:
        logger.exception('No se pudo enviar la constancia al representante (firma del empleador %s)', s.pk)
    para = []
    for correo in (e.owner.email, _correo_persona(s.pedida_por) if s.pedida_por_id else ''):
        correo = (correo or '').strip().lower()
        if correo and correo != s.email.lower() and correo not in para:
            para.append(correo)
    if not para:
        return
    try:
        _enviar('firma_empleador_registrada', f'{s.nombre} registró la firma del empleador de {e.nombre_legal}',
                para, {**ctx, 'para_representante': False}, adjunto)
    except Exception:
        logger.exception('No se pudo avisar al titular el registro de la firma del empleador %s', s.pk)
