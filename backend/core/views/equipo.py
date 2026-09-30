"""Usuarios del equipo: los administra el titular y entran por su propia puerta.

- Titular: `GET/POST /api/equipo/`, `PATCH /api/equipo/<id>/`, `POST …/<id>/eliminar/`,
  `POST …/<id>/reenviar/`. Módulos de la lista cerrada (core.permisos) y solo
  empresas propias; el cupo es la bolsa común del plan más los adicionales.
- Equipo: `POST /api/auth/equipo/ingresar/ {rut, clave, cuenta?}` (si la clave vale
  en más de una cuenta, responde la lista para elegir), `POST …/recuperar/ {rut}`
  (respuesta idéntica exista o no) y `POST …/clave/ {uid, token, clave}` para crear
  o cambiar la clave desde el enlace del correo.
- Ambos: `GET /api/auth/sesion/` dice quién es y qué ve.
"""
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from dj_rest_auth.jwt_auth import set_jwt_cookies
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes, \
    throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from ..bitacora import cuenta_de, registrar
from ..models import Empresa, UsuarioEquipo
from ..permisos import MODULOS, NIVELES, cupo_equipo, normalizar_permisos
from ..rut import formatear_rut, limpiar_rut, validar_rut
from .base import LoginRateThrottle, PasswordResetRateThrottle, _plan_activo, logger


class ClaveEquipoThrottle(AnonRateThrottle):
    scope = 'equipo_clave'


class IngresoEquipoRutThrottle(AnonRateThrottle):
    """Intentos por RUT (además del límite por IP), como en el ingreso del titular."""
    scope = 'login'

    def get_cache_key(self, request, view):
        rut = limpiar_rut(str(request.data.get('rut') or ''))
        return f'throttle_login_equipo_{rut}' if rut else None


def _titular(request):
    cuenta, tipo = cuenta_de(request.user)
    return cuenta if tipo == 'TITULAR' else None


def _uso(cuenta):
    plan = _plan_activo(cuenta)
    cliente = cuenta.perfil_cliente
    cupo = cupo_equipo(plan, cliente.usuarios_adicionales)
    usados = UsuarioEquipo.objects.filter(cuenta=cuenta, estado__in=('INVITADO', 'ACTIVO')).count()
    return cupo, usados


def _dato(ue):
    return {'id': ue.id, 'rut': ue.rut, 'nombres': ue.nombres, 'apellidos': ue.apellidos, 'correo': ue.correo,
            'permisos': ue.permisos, 'empresas': list(ue.empresas.values_list('id', flat=True)),
            'estado': ue.estado, 'invitado_en': ue.invitado_en.isoformat() if ue.invitado_en else None,
            'activado_en': ue.activado_en.isoformat() if ue.activado_en else None}


def _sitio():
    return getattr(settings, 'SITIO_URL', 'https://jornada40.cl').rstrip('/')


def _enlace_clave(ue):
    uid = urlsafe_base64_encode(force_bytes(ue.usuario.pk))
    return f'{_sitio()}/equipo/clave/{uid}/{default_token_generator.make_token(ue.usuario)}'


def _enviar(ue, plantilla, asunto):
    cliente = ue.cuenta.perfil_cliente
    ctx = {'nombre': ue.nombres, 'cuenta': cliente.razon_social or f'{cliente.nombres} {cliente.apellido_paterno or ""}'.strip(),
           'enlace': _enlace_clave(ue), 'ingreso': f'{_sitio()}/equipo'}
    msg = EmailMultiAlternatives(asunto, render_to_string(f'{plantilla}.txt', ctx), settings.DEFAULT_FROM_EMAIL,
                                 to=[ue.correo])
    msg.attach_alternative(render_to_string(f'{plantilla}.html', ctx), 'text/html')
    msg.send()


def _validar(cuenta, datos, actual=None):
    """(campos, empresas, error) con los datos del formulario del titular."""
    campos = {}
    if actual is None or 'rut' in datos:
        rut = str(datos.get('rut') or '')
        if not validar_rut(rut):
            return None, None, 'El RUT no es válido.'
        campos['rut'] = formatear_rut(rut)
    for campo, etiqueta, largo in (('nombres', 'el nombre', 100), ('apellidos', 'los apellidos', 150)):
        if actual is None or campo in datos:
            valor = str(datos.get(campo) or '').strip()
            if campo == 'nombres' and not valor:
                return None, None, f'Indica {etiqueta}.'
            campos[campo] = valor[:largo]
    if actual is None or 'correo' in datos:
        correo = str(datos.get('correo') or '').strip().lower()
        try:
            validate_email(correo)
        except DjangoValidationError:
            return None, None, 'Indica un correo válido: ahí le llega la invitación.'
        campos['correo'] = correo
    if actual is None or 'permisos' in datos:
        permisos = normalizar_permisos(datos.get('permisos') if isinstance(datos.get('permisos'), dict) else {})
        if not permisos:
            return None, None, 'Marca al menos un módulo.'
        campos['permisos'] = permisos
    empresas = None
    if actual is None or 'empresas' in datos:
        ids = {int(i) for i in (datos.get('empresas') or []) if str(i).isdigit()}
        empresas = list(Empresa.objects.filter(owner=cuenta, activo=True, id__in=ids))
        if not empresas or len(empresas) != len(ids):
            return None, None, 'Elige al menos una de tus empresas.'
    return campos, empresas, None


class EquipoViewSet(viewsets.ViewSet):
    """Usuarios del equipo de la cuenta (solo el titular)."""
    permission_classes = [IsAuthenticated]

    def _cuenta(self, request):
        cuenta = _titular(request)
        if cuenta is None:
            return None, Response({'error': 'Solo el titular de la cuenta administra el equipo.'},
                                  status=status.HTTP_403_FORBIDDEN)
        return cuenta, None

    def _usuario(self, cuenta, pk):
        return UsuarioEquipo.objects.filter(pk=pk, cuenta=cuenta).exclude(estado='ELIMINADO').first()

    def list(self, request):
        cuenta, error = self._cuenta(request)
        if error:
            return error
        cupo, usados = _uso(cuenta)
        return Response({
            'cupo': cupo, 'usados': usados,
            'modulos': [{'valor': c, 'texto': t, 'detalle': d} for c, t, d in MODULOS],
            'niveles': [{'valor': v, 'texto': t} for v, t in NIVELES],
            'usuarios': [_dato(u) for u in UsuarioEquipo.objects.filter(cuenta=cuenta).exclude(estado='ELIMINADO')
                         .prefetch_related('empresas')],
        })

    def create(self, request):
        cuenta, error = self._cuenta(request)
        if error:
            return error
        cupo, usados = _uso(cuenta)
        if usados >= cupo:
            return Response({'error': f'Tu plan permite {cupo} usuarios del equipo y ya los usaste. '
                                      'Elimina uno o agrega un usuario adicional.'},
                            status=status.HTTP_400_BAD_REQUEST)
        campos, empresas, problema = _validar(cuenta, request.data)
        if problema:
            return Response({'error': problema}, status=status.HTTP_400_BAD_REQUEST)
        if UsuarioEquipo.objects.filter(cuenta=cuenta, rut=campos['rut']).exclude(estado='ELIMINADO').exists():
            return Response({'error': 'Esa persona ya está en tu equipo.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            usuario = User(username=f'equipo:{cuenta.pk}:{limpiar_rut(campos["rut"])}', email=campos['correo'],
                           first_name=campos['nombres'][:150], last_name=campos['apellidos'][:150])
            usuario.set_unusable_password()
            usuario.save()
            ue = UsuarioEquipo.objects.create(cuenta=cuenta, usuario=usuario, invitado_en=timezone.now(), **campos)
            ue.empresas.set(empresas)
        try:
            _enviar(ue, 'equipo_invitacion', 'Te invitaron al equipo en Jornada40')
        except Exception:
            logger.exception('No se pudo enviar la invitación al usuario del equipo %s', ue.id)
            return Response({**_dato(ue), 'aviso': 'Se creó el usuario, pero no pudimos enviar el correo. '
                                                   'Usa "Reenviar invitación".'}, status=status.HTTP_201_CREATED)
        return Response(_dato(ue), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        cuenta, error = self._cuenta(request)
        if error:
            return error
        ue = self._usuario(cuenta, pk)
        if ue is None:
            return Response({'error': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        datos = {k: v for k, v in request.data.items() if k != 'rut'}   # el RUT identifica a la persona
        campos, empresas, problema = _validar(cuenta, datos, actual=ue)
        if problema:
            return Response({'error': problema}, status=status.HTTP_400_BAD_REQUEST)
        for campo, valor in campos.items():
            setattr(ue, campo, valor)
        ue.save()
        if empresas is not None:
            ue.empresas.set(empresas)
        if 'correo' in campos:
            ue.usuario.email = campos['correo']
            ue.usuario.save(update_fields=['email'])
        return Response(_dato(ue))

    @action(detail=True, methods=['post'])
    def eliminar(self, request, pk=None):
        """Quita el acceso para siempre y libera el cupo; el historial se conserva."""
        cuenta, error = self._cuenta(request)
        if error:
            return error
        ue = self._usuario(cuenta, pk)
        if ue is None:
            return Response({'error': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        ue.estado, ue.eliminado_en = 'ELIMINADO', timezone.now()
        ue.save(update_fields=['estado', 'eliminado_en'])
        ue.usuario.is_active = False
        ue.usuario.set_unusable_password()
        ue.usuario.save(update_fields=['is_active', 'password'])
        return Response({'ok': True})

    @action(detail=True, methods=['post'])
    def reenviar(self, request, pk=None):
        cuenta, error = self._cuenta(request)
        if error:
            return error
        ue = self._usuario(cuenta, pk)
        if ue is None:
            return Response({'error': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if ue.estado != 'INVITADO':
            return Response({'error': 'Ya creó su clave. Si la olvidó, puede recuperarla desde el ingreso del equipo.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            _enviar(ue, 'equipo_invitacion', 'Te invitaron al equipo en Jornada40')
        except Exception:
            logger.exception('No se pudo reenviar la invitación al usuario del equipo %s', ue.id)
            return Response({'error': 'No pudimos enviar el correo. Intenta de nuevo en unos minutos.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        ue.invitado_en = timezone.now()
        ue.save(update_fields=['invitado_en'])
        return Response(_dato(ue))


# ── Ingreso del equipo ───────────────────────────────────────────────────────

_ERROR_INGRESO = 'RUT o clave incorrectos.'


def _cuentas_del_rut(rut):
    return UsuarioEquipo.objects.filter(rut=formatear_rut(rut), estado='ACTIVO').select_related(
        'usuario', 'cuenta__perfil_cliente')


def _nombre_cuenta(ue):
    cliente = ue.cuenta.perfil_cliente
    return cliente.razon_social or f'{cliente.nombres} {cliente.apellido_paterno or ""}'.strip()


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle, IngresoEquipoRutThrottle])
def ingresar_equipo(request):
    rut = str(request.data.get('rut') or '')
    clave = str(request.data.get('clave') or '')
    if not validar_rut(rut) or not clave:
        return Response({'error': _ERROR_INGRESO}, status=status.HTTP_400_BAD_REQUEST)
    validos = [ue for ue in _cuentas_del_rut(rut) if ue.usuario.is_active and ue.usuario.check_password(clave)]
    ip = request.META.get('REMOTE_ADDR', '')
    if not validos:
        for ue in _cuentas_del_rut(rut):
            registrar(ue.cuenta, 'INGRESO_FALLIDO', f'Intento de ingreso fallido de {ue.nombre_completo} (equipo)',
                      metodo='POST', ruta=request.path, estado_http=400, ip=ip)
        return Response({'error': _ERROR_INGRESO}, status=status.HTTP_400_BAD_REQUEST)
    if len(validos) > 1:
        elegida = str(request.data.get('cuenta') or '')
        validos = [ue for ue in validos if str(ue.cuenta_id) == elegida] or validos
        if len(validos) > 1:
            return Response({'elegir_cuenta': [{'cuenta': ue.cuenta_id, 'nombre': _nombre_cuenta(ue)}
                                               for ue in validos]})
    ue = validos[0]
    refresh = RefreshToken.for_user(ue.usuario)
    respuesta = Response({'tipo': 'EQUIPO', 'cuenta': _nombre_cuenta(ue)})
    set_jwt_cookies(respuesta, refresh.access_token, refresh)
    ue.usuario.last_login = timezone.now()
    ue.usuario.save(update_fields=['last_login'])
    registrar(ue.cuenta, 'INGRESO', f'Inició sesión {ue.nombre_completo} (equipo)', actor=ue.usuario,
              actor_tipo='EQUIPO', metodo='POST', ruta=request.path, estado_http=200, ip=ip)
    return respuesta


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetRateThrottle])
def recuperar_equipo(request):
    """Envía el enlace para crear una clave nueva a cada cuenta donde el RUT está activo."""
    rut = str(request.data.get('rut') or '')
    if validar_rut(rut):
        for ue in _cuentas_del_rut(rut):
            try:
                _enviar(ue, 'equipo_recuperar', 'Crea una clave nueva para Jornada40')
            except Exception:
                logger.exception('No se pudo enviar la recuperación al usuario del equipo %s', ue.id)
    return Response({'mensaje': 'Si el RUT pertenece a un equipo, le enviamos un correo con un enlace para crear '
                                'una clave nueva.'})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([ClaveEquipoThrottle])
def clave_equipo(request):
    """Crea la clave desde el enlace de invitación o de recuperación (vale una sola vez)."""
    try:
        usuario = User.objects.get(pk=force_str(urlsafe_base64_decode(str(request.data.get('uid') or ''))))
        ue = usuario.usuario_equipo
    except (User.DoesNotExist, UsuarioEquipo.DoesNotExist, ValueError, TypeError, OverflowError):
        return Response({'error': 'El enlace no es válido.'}, status=status.HTTP_400_BAD_REQUEST)
    if ue.estado == 'ELIMINADO' or not default_token_generator.check_token(usuario, str(request.data.get('token') or '')):
        return Response({'error': 'El enlace venció o ya se usó. Pide uno nuevo.'}, status=status.HTTP_400_BAD_REQUEST)
    clave = str(request.data.get('clave') or '')
    if limpiar_rut(clave) == limpiar_rut(ue.rut):
        return Response({'error': 'La clave no puede ser tu RUT.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(clave, usuario)
    except DjangoValidationError as e:
        return Response({'error': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
    usuario.set_password(clave)
    usuario.is_active = True
    usuario.save()
    if ue.estado == 'INVITADO':
        ue.estado, ue.activado_en = 'ACTIVO', timezone.now()
        ue.save(update_fields=['estado', 'activado_en'])
    registrar(ue.cuenta, 'CLAVE', f'{ue.nombre_completo} (equipo) creó su clave', actor=usuario, actor_tipo='EQUIPO',
              metodo='POST', ruta=request.path, estado_http=200, ip=request.META.get('REMOTE_ADDR', ''))
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sesion(request):
    """Quién está conectado y qué puede ver (el panel arma el menú con esto)."""
    cuenta, tipo = cuenta_de(request.user)
    if cuenta is None:
        return Response({'error': 'Sesión no válida para el panel.'}, status=status.HTTP_403_FORBIDDEN)
    if tipo == 'TITULAR':
        return Response({'tipo': 'TITULAR', 'nombre': request.user.perfil_cliente.nombres, 'permisos': None,
                         'empresas': None})
    ue = request.user.usuario_equipo
    return Response({'tipo': 'EQUIPO', 'nombre': ue.nombre_completo, 'cuenta': _nombre_cuenta(ue),
                     'permisos': ue.permisos, 'empresas': list(ue.empresas.values_list('id', flat=True))})
