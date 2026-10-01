"""Acceso Ley Karin: el encargado de denuncias, con su propia puerta y sesión.

La ley exige estricta reserva de las denuncias (Art. 211-C del Código del
Trabajo). Por eso el encargado no es un módulo del panel: tiene su tabla
(`EncargadoKarin`), su clave y su sesión (cookie firmada `jornada40-karin`,
independiente del JWT del panel). Esa sesión solo abre `/api/karin/…`, y el JWT
del panel no la abre, aunque sea la misma persona con el mismo RUT.

- Titular (`/api/encargados-karin/`): designar (Pyme en adelante, fuera del cupo
  del equipo), editar empresas, reenviar la invitación y eliminar.
- Encargado (`/api/karin/…`): ingresar (`elegir_cuenta` si la clave vale en
  varias), recuperar y crear la clave desde el correo, ver su sesión, cambiar la
  clave, salir y revisar la bitácora reservada (`RegistroKarin`).
"""
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status, viewsets
from rest_framework.authentication import BaseAuthentication
from rest_framework.decorators import (action, api_view, authentication_classes, parser_classes,
                                       permission_classes, throttle_classes)
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

from ..bitacora import cuenta_de
from ..karin import registrar_karin, verificar_karin
from ..models import EncargadoKarin, Empresa, RegistroKarin
from ..permisos import cupo_ley_karin
from ..rut import formatear_rut, limpiar_rut, validar_rut
from .base import _plan_activo, logger

COOKIE = 'jornada40-karin'
DURACION_SESION = 4 * 60 * 60     # más corta que la del panel: es información reservada
_SAL = 'acceso-ley-karin'
POR_PAGINA = 100
_ERROR_INGRESO = 'RUT o clave incorrectos.'


def _sitio():
    return getattr(settings, 'SITIO_URL', 'https://jornada40.cl').rstrip('/')


def _ip(request):
    return request.META.get('REMOTE_ADDR', '')


def _nombre_cuenta(cuenta):
    c = cuenta.perfil_cliente
    return c.razon_social or f'{c.nombres} {c.apellido_paterno or ""}'.strip()


def _enviar(enc, plantilla, asunto):
    uid = urlsafe_base64_encode(force_bytes(enc.usuario.pk))
    ctx = {'nombre': enc.nombres, 'cuenta': _nombre_cuenta(enc.cuenta),
           'enlace': f'{_sitio()}/karin/clave/{uid}/{default_token_generator.make_token(enc.usuario)}',
           'ingreso': f'{_sitio()}/karin'}
    msg = EmailMultiAlternatives(asunto, render_to_string(f'{plantilla}.txt', ctx), settings.DEFAULT_FROM_EMAIL,
                                 to=[enc.correo])
    msg.attach_alternative(render_to_string(f'{plantilla}.html', ctx), 'text/html')
    msg.send()


def _empresas(enc):
    return [{'id': e.id, 'nombre': e.alias or e.nombre_legal, 'rut': e.rut}
            for e in Empresa.objects.filter(id__in=enc.empresas.values('id'), activo=True).order_by('nombre_legal')]


# ── Titular: designar encargados ─────────────────────────────────────────────

def _dato(enc):
    return {'id': enc.id, 'rut': enc.rut, 'nombres': enc.nombres, 'apellidos': enc.apellidos, 'correo': enc.correo,
            'empresas': list(enc.empresas.values_list('id', flat=True)), 'estado': enc.estado,
            'invitado_en': enc.invitado_en.isoformat() if enc.invitado_en else None,
            'activado_en': enc.activado_en.isoformat() if enc.activado_en else None}


def _uso(cuenta):
    cupo = cupo_ley_karin(_plan_activo(cuenta), cuenta.perfil_cliente.encargados_karin_adicionales)
    usados = EncargadoKarin.objects.filter(cuenta=cuenta, estado__in=('INVITADO', 'ACTIVO')).count()
    return cupo, usados


def _validar(cuenta, datos, nuevo):
    campos = {}
    if nuevo:
        if not validar_rut(str(datos.get('rut') or '')):
            return None, None, 'El RUT no es válido.'
        campos['rut'] = formatear_rut(str(datos['rut']))
    if nuevo or 'nombres' in datos:
        campos['nombres'] = str(datos.get('nombres') or '').strip()[:100]
        if not campos['nombres']:
            return None, None, 'Indica el nombre.'
    if nuevo or 'apellidos' in datos:
        campos['apellidos'] = str(datos.get('apellidos') or '').strip()[:150]
    if nuevo or 'correo' in datos:
        correo = str(datos.get('correo') or '').strip().lower()
        try:
            validate_email(correo)
        except DjangoValidationError:
            return None, None, 'Indica un correo válido: ahí le llega la invitación.'
        campos['correo'] = correo
    empresas = None
    if nuevo or 'empresas' in datos:
        ids = {int(i) for i in (datos.get('empresas') or []) if str(i).isdigit()}
        empresas = list(Empresa.objects.filter(owner=cuenta, activo=True, id__in=ids))
        if not empresas or len(empresas) != len(ids):
            return None, None, 'Elige al menos una de tus empresas.'
    return campos, empresas, None


class EncargadoKarinViewSet(viewsets.ViewSet):
    """Encargados de denuncias Ley Karin de la cuenta (solo el titular)."""
    permission_classes = [IsAuthenticated]

    def _cuenta(self, request):
        cuenta, tipo = cuenta_de(request.user)
        if tipo != 'TITULAR':
            return None, Response({'error': 'Solo el titular de la cuenta designa al encargado de denuncias.'},
                                  status=status.HTTP_403_FORBIDDEN)
        return cuenta, None

    def _encargado(self, cuenta, pk):
        return EncargadoKarin.objects.filter(pk=pk, cuenta=cuenta).exclude(estado='ELIMINADO').first()

    def list(self, request):
        cuenta, error = self._cuenta(request)
        if error:
            return error
        cupo, usados = _uso(cuenta)
        return Response({'cupo': cupo, 'usados': usados, 'encargados': [
            _dato(e) for e in EncargadoKarin.objects.filter(cuenta=cuenta).exclude(estado='ELIMINADO')
            .prefetch_related('empresas')]})

    def create(self, request):
        cuenta, error = self._cuenta(request)
        if error:
            return error
        cupo, usados = _uso(cuenta)
        if cupo == 0:
            return Response({'error': 'El acceso del encargado de denuncias está disponible desde el plan Pyme.'},
                            status=status.HTTP_403_FORBIDDEN)
        if usados >= cupo:
            return Response({'error': 'Ya designaste al encargado que permite tu plan. Elimínalo para designar a otro.'},
                            status=status.HTTP_400_BAD_REQUEST)
        campos, empresas, problema = _validar(cuenta, request.data, nuevo=True)
        if problema:
            return Response({'error': problema}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            usuario = User(username=f'karin:{cuenta.pk}:{limpiar_rut(campos["rut"])}:{timezone.now():%Y%m%d%H%M%S%f}',
                           email=campos['correo'], first_name=campos['nombres'][:150],
                           last_name=campos['apellidos'][:150])
            usuario.set_unusable_password()
            usuario.save()
            enc = EncargadoKarin.objects.create(cuenta=cuenta, usuario=usuario, invitado_en=timezone.now(), **campos)
            enc.empresas.set(empresas)
        registrar_karin(cuenta, 'DESIGNACION', f'El titular designó a {enc.nombre_completo} como encargado',
                        ip=_ip(request))
        try:
            _enviar(enc, 'karin_invitacion', 'Te designaron encargado de denuncias Ley Karin')
        except Exception:
            logger.exception('No se pudo enviar la invitación al encargado Ley Karin %s', enc.id)
            return Response({**_dato(enc), 'aviso': 'Quedó designado, pero no pudimos enviar el correo. '
                                                    'Usa "Reenviar invitación".'}, status=status.HTTP_201_CREATED)
        return Response(_dato(enc), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        cuenta, error = self._cuenta(request)
        if error:
            return error
        enc = self._encargado(cuenta, pk)
        if enc is None:
            return Response({'error': 'Encargado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        campos, empresas, problema = _validar(cuenta, {k: v for k, v in request.data.items() if k != 'rut'}, nuevo=False)
        if problema:
            return Response({'error': problema}, status=status.HTTP_400_BAD_REQUEST)
        for campo, valor in campos.items():
            setattr(enc, campo, valor)
        enc.save()
        if empresas is not None:
            enc.empresas.set(empresas)
        if 'correo' in campos:
            enc.usuario.email = campos['correo']
            enc.usuario.save(update_fields=['email'])
        registrar_karin(cuenta, 'CAMBIO_ENCARGADO', f'El titular modificó los datos o empresas de {enc.nombre_completo}',
                        ip=_ip(request))
        return Response(_dato(enc))

    @action(detail=True, methods=['post'])
    def eliminar(self, request, pk=None):
        """Quita el acceso para siempre (cierra sus sesiones) y libera el cupo."""
        cuenta, error = self._cuenta(request)
        if error:
            return error
        enc = self._encargado(cuenta, pk)
        if enc is None:
            return Response({'error': 'Encargado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        enc.estado, enc.eliminado_en, enc.version_sesion = 'ELIMINADO', timezone.now(), enc.version_sesion + 1
        enc.save(update_fields=['estado', 'eliminado_en', 'version_sesion'])
        enc.usuario.is_active = False
        enc.usuario.set_unusable_password()
        enc.usuario.save(update_fields=['is_active', 'password'])
        registrar_karin(cuenta, 'ELIMINACION', f'El titular quitó el acceso a {enc.nombre_completo}', ip=_ip(request))
        return Response({'ok': True})

    @action(detail=True, methods=['post'])
    def reenviar(self, request, pk=None):
        cuenta, error = self._cuenta(request)
        if error:
            return error
        enc = self._encargado(cuenta, pk)
        if enc is None:
            return Response({'error': 'Encargado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if enc.estado != 'INVITADO':
            return Response({'error': 'Ya creó su clave. Si la olvidó, puede recuperarla desde su ingreso.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            _enviar(enc, 'karin_invitacion', 'Te designaron encargado de denuncias Ley Karin')
        except Exception:
            logger.exception('No se pudo reenviar la invitación al encargado Ley Karin %s', enc.id)
            return Response({'error': 'No pudimos enviar el correo. Intenta de nuevo en unos minutos.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        enc.invitado_en = timezone.now()
        enc.save(update_fields=['invitado_en'])
        return Response(_dato(enc))


# ── Sesión del encargado ─────────────────────────────────────────────────────

class SesionKarin(BaseAuthentication):
    """La cookie firmada del acceso Ley Karin; el JWT del panel no sirve aquí."""

    def authenticate(self, request):
        valor = request.COOKIES.get(COOKIE)
        if not valor:
            return None
        try:
            d = signing.loads(valor, salt=_SAL, max_age=DURACION_SESION)
            enc = EncargadoKarin.objects.select_related('cuenta__perfil_cliente', 'usuario').get(pk=d['e'])
        except (signing.BadSignature, EncargadoKarin.DoesNotExist, KeyError, TypeError):
            return None
        if enc.estado != 'ACTIVO' or not enc.usuario.is_active or enc.version_sesion != d.get('v'):
            return None
        return enc, d


class EsEncargado(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, EncargadoKarin)


class KarinAnonThrottle(AnonRateThrottle):
    scope = 'karin'


class KarinRutThrottle(AnonRateThrottle):
    """Intentos por RUT, además del límite por IP."""
    scope = 'karin'

    def get_cache_key(self, request, view):
        rut = limpiar_rut(str(request.data.get('rut') or ''))
        return f'throttle_karin_rut_{rut}' if rut else None


class KarinSesionThrottle(SimpleRateThrottle):
    scope = 'karin_sesion'

    def get_cache_key(self, request, view):
        u = getattr(request, 'user', None)
        return f'throttle_karin_{u.pk}' if isinstance(u, EncargadoKarin) else None


def _publica(*throttles):
    def decorar(vista):
        vista = throttle_classes(list(throttles))(vista)
        vista = parser_classes([JSONParser])(vista)
        vista = permission_classes([AllowAny])(vista)
        return authentication_classes([])(vista)
    return decorar


def _con_sesion(vista):
    vista = throttle_classes([KarinSesionThrottle])(vista)
    vista = parser_classes([JSONParser])(vista)
    vista = permission_classes([EsEncargado])(vista)
    return authentication_classes([SesionKarin])(vista)


def _abrir_sesion(respuesta, enc):
    desplegado = bool(getattr(settings, 'IS_DEPLOYED', False))
    respuesta.set_cookie(COOKIE, signing.dumps({'e': enc.pk, 'v': enc.version_sesion}, salt=_SAL),
                         max_age=DURACION_SESION, httponly=True, secure=desplegado,
                         samesite='None' if desplegado else 'Lax')
    return respuesta


def _activos_del_rut(rut):
    return EncargadoKarin.objects.filter(rut=formatear_rut(rut), estado='ACTIVO').select_related(
        'usuario', 'cuenta__perfil_cliente')


@api_view(['POST'])
@_publica(KarinAnonThrottle, KarinRutThrottle)
def ingresar(request):
    rut = str(request.data.get('rut') or '')
    clave = str(request.data.get('clave') or '')
    if not validar_rut(rut) or not clave:
        return Response({'error': _ERROR_INGRESO}, status=status.HTTP_400_BAD_REQUEST)
    candidatos = list(_activos_del_rut(rut))
    validos = [e for e in candidatos if e.usuario.is_active and e.usuario.check_password(clave)]
    if not validos:
        for e in candidatos:
            registrar_karin(e.cuenta, 'INGRESO_FALLIDO', 'Intento de ingreso con clave incorrecta', encargado=e,
                            ip=_ip(request))
        return Response({'error': _ERROR_INGRESO}, status=status.HTTP_400_BAD_REQUEST)
    if len(validos) > 1:
        elegida = str(request.data.get('cuenta') or '')
        validos = [e for e in validos if str(e.cuenta_id) == elegida] or validos
        if len(validos) > 1:
            return Response({'elegir_cuenta': [{'cuenta': e.cuenta_id, 'nombre': _nombre_cuenta(e.cuenta)}
                                               for e in validos]})
    enc = validos[0]
    enc.usuario.last_login = timezone.now()
    enc.usuario.save(update_fields=['last_login'])
    registrar_karin(enc.cuenta, 'INGRESO', 'Inició sesión', encargado=enc, ip=_ip(request))
    return _abrir_sesion(Response(_sesion(enc)), enc)


@api_view(['POST'])
@_publica(KarinAnonThrottle, KarinRutThrottle)
def recuperar(request):
    """Envía el enlace para una clave nueva a cada cuenta donde el RUT es encargado activo."""
    rut = str(request.data.get('rut') or '')
    if validar_rut(rut):
        for enc in _activos_del_rut(rut):
            try:
                _enviar(enc, 'karin_recuperar', 'Crea una clave nueva para el acceso Ley Karin')
            except Exception:
                logger.exception('No se pudo enviar la recuperación al encargado Ley Karin %s', enc.id)
    return Response({'mensaje': 'Si el RUT corresponde a un encargado, le enviamos un correo con un enlace para '
                                'crear una clave nueva.'})


@api_view(['POST'])
@_publica(KarinAnonThrottle)
def crear_clave(request):
    """Crea la clave desde el enlace de invitación o de recuperación (vale una sola vez)."""
    try:
        usuario = User.objects.get(pk=force_str(urlsafe_base64_decode(str(request.data.get('uid') or ''))))
        enc = usuario.encargado_karin
    except (User.DoesNotExist, EncargadoKarin.DoesNotExist, ValueError, TypeError, OverflowError):
        return Response({'error': 'El enlace no es válido.'}, status=status.HTTP_400_BAD_REQUEST)
    if enc.estado == 'ELIMINADO' or not default_token_generator.check_token(usuario, str(request.data.get('token') or '')):
        return Response({'error': 'El enlace venció o ya se usó. Pide uno nuevo.'}, status=status.HTTP_400_BAD_REQUEST)
    clave = str(request.data.get('clave') or '')
    problema = _clave_invalida(clave, enc)
    if problema:
        return Response({'error': problema}, status=status.HTTP_400_BAD_REQUEST)
    usuario.set_password(clave)
    usuario.is_active = True
    usuario.save()
    enc.version_sesion += 1
    if enc.estado == 'INVITADO':
        enc.estado, enc.activado_en = 'ACTIVO', timezone.now()
    enc.save(update_fields=['estado', 'activado_en', 'version_sesion'])
    registrar_karin(enc.cuenta, 'CLAVE', 'Creó su clave desde el enlace del correo', encargado=enc, ip=_ip(request))
    return Response({'ok': True})


def _clave_invalida(clave, enc):
    if limpiar_rut(clave) == limpiar_rut(enc.rut):
        return 'La clave no puede ser tu RUT.'
    try:
        validate_password(clave, enc.usuario)
    except DjangoValidationError as e:
        return ' '.join(e.messages)
    return None


def _sesion(enc):
    return {'nombre': enc.nombre_completo, 'rut': enc.rut, 'correo': enc.correo,
            'cuenta': _nombre_cuenta(enc.cuenta), 'empresas': _empresas(enc)}


@api_view(['GET'])
@_con_sesion
def yo(request):
    return Response(_sesion(request.user))


@api_view(['POST'])
@_con_sesion
def salir(request):
    enc = request.user
    registrar_karin(enc.cuenta, 'SALIDA', 'Cerró sesión', encargado=enc, ip=_ip(request))
    respuesta = Response({'ok': True})
    respuesta.delete_cookie(COOKIE)
    return respuesta


@api_view(['POST'])
@_con_sesion
def cambiar_clave(request):
    enc = request.user
    if not enc.usuario.check_password(str(request.data.get('actual') or '')):
        return Response({'error': 'La clave actual no es correcta.'}, status=status.HTTP_400_BAD_REQUEST)
    nueva = str(request.data.get('nueva') or '')
    problema = _clave_invalida(nueva, enc)
    if problema:
        return Response({'error': problema}, status=status.HTTP_400_BAD_REQUEST)
    enc.usuario.set_password(nueva)
    enc.usuario.save(update_fields=['password'])
    enc.version_sesion += 1          # cierra las demás sesiones abiertas
    enc.save(update_fields=['version_sesion'])
    registrar_karin(enc.cuenta, 'CLAVE', 'Cambió su clave', encargado=enc, ip=_ip(request))
    return _abrir_sesion(Response({'ok': True}), enc)


@api_view(['GET'])
@_con_sesion
def bitacora(request):
    """Bitácora reservada de la cuenta, del más reciente al más antiguo."""
    enc = request.user
    try:
        pagina = max(int(request.query_params.get('pagina') or 1), 1)
    except ValueError:
        pagina = 1
    qs = RegistroKarin.objects.filter(cuenta=enc.cuenta).order_by('-id')
    total = qs.count()
    return Response({'total': total, 'pagina': pagina, 'por_pagina': POR_PAGINA, 'registros': [
        {'id': r.id, 'fecha': timezone.localtime(r.creado_en).isoformat(), 'actor': r.actor_nombre,
         'accion': r.accion, 'descripcion': r.descripcion, 'ip': r.ip}
        for r in qs[(pagina - 1) * POR_PAGINA: pagina * POR_PAGINA]]})


@api_view(['GET'])
@_con_sesion
def verificar_bitacora(request):
    return Response(verificar_karin(request.user.cuenta))
