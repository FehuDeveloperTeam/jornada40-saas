"""Extensión "Jornada40 para Mi DT" (plan en docs/PLAN_EXTENSION_MIDT.md).

La extensión llena en el navegador del empleador los formularios de Mi DT con
los datos de Jornada40. Nunca toca la Clave Única: la persona entra a Mi DT como
siempre y presiona el botón final. Aquí está lo que la extensión necesita de
Jornada40, en dos lados:

- Panel (sesión del panel, cerco del equipo en el módulo Dirección del Trabajo):
  crear el código para conectar un navegador, ver los navegadores conectados y
  desconectarlos.
- Extensión (/api/extension/v1/, solo con su token): vincular con el código, y
  luego leer lo que hay que registrar y su ficha, marcarlo como registrado,
  bajar los mapeos de Mi DT y enviar el levantamiento de una pantalla.

El token es propio de la extensión: no abre ninguna otra ruta, respeta los
módulos y empresas de la persona, se guarda como huella y se corta al
desconectarlo, al quitar a la persona del equipo o tras 90 días sin uso.
"""
import hashlib
import hmac
import json
import re
import secrets
from pathlib import Path

from django.conf import settings
from django.utils import timezone
from rest_framework import exceptions, status
from rest_framework.authentication import BaseAuthentication
from rest_framework.decorators import (api_view, authentication_classes, parser_classes, permission_classes,
                                       throttle_classes)
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

from .. import bitacora
from .. import permisos as p
from ..autenticacion import actor, usuario_equipo_de
from ..contexto import fijar_empresas
from ..models import CodigoExtension, DispositivoExtension, Empresa, LevantamientoMiDT
from .direccion_trabajo import ficha_registro, lista_registro, marcar_registros

MINUTOS_CODIGO = 10
# Sin 0/O ni 1/I/L: se dicta y se escribe sin confusiones.
_ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
_MAPEOS = Path(__file__).resolve().parent.parent / 'datos' / 'mapeos_midt.json'
TAMANO_MAXIMO_LEVANTAMIENTO = 400_000   # bytes del JSON


def _huella_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _normalizar_codigo(codigo):
    return re.sub(r'[^A-Z0-9]', '', str(codigo or '').upper())


def _huella_codigo(codigo):
    return hmac.new(settings.SECRET_KEY.encode(), f'extension:{codigo}'.encode(), hashlib.sha256).hexdigest()


def _nombre_persona(user):
    ue = usuario_equipo_de(user)
    if ue is not None:
        return ue.nombre_completo
    return (user.get_full_name() or user.username).strip()


# ── Autenticación de la extensión ────────────────────────────────────────────

class TokenExtension(BaseAuthentication):
    """`Authorization: Extension <token>`. Actúa sobre la cuenta (request.user = titular)
    con `request.actor` = la persona y, si es del equipo, solo en sus empresas y con
    el módulo Dirección del Trabajo (ver para leer, gestionar para marcar)."""

    PREFIJO = 'Extension '

    def authenticate(self, request):
        encabezado = request.META.get('HTTP_AUTHORIZATION', '')
        if not encabezado.startswith(self.PREFIJO):
            return None
        token = encabezado[len(self.PREFIJO):].strip()
        dispositivo = (DispositivoExtension.objects.select_related('cuenta', 'persona')
                       .filter(token_hash=_huella_token(token)).first()) if token else None
        if dispositivo is None or not dispositivo.vigente() or not dispositivo.persona.is_active:
            raise exceptions.AuthenticationFailed('La extensión no está conectada. Conéctala de nuevo desde Jornada40.')
        persona = dispositivo.persona
        ue = usuario_equipo_de(persona)
        if ue is not None:
            if ue.estado != 'ACTIVO':
                raise exceptions.AuthenticationFailed('Tu acceso a esta cuenta fue retirado.')
            escribir = request.method not in ('GET', 'HEAD', 'OPTIONS')
            if not p.tiene(ue.permisos or {}, ['DIRECCION_TRABAJO'], escribir=escribir):
                raise exceptions.PermissionDenied('Tu usuario no tiene permiso para el registro en Mi DT. '
                                                  'Pídeselo al titular de la cuenta.')
            fijar_empresas(ue.empresas.values_list('id', flat=True))
        request._request.actor = persona
        # Último uso, a lo más una escritura por minuto (cuenta para los 90 días sin uso).
        ahora = timezone.now()
        if dispositivo.ultimo_uso is None or ahora - dispositivo.ultimo_uso > timezone.timedelta(minutes=1):
            DispositivoExtension.objects.filter(pk=dispositivo.pk).update(ultimo_uso=ahora)
        return dispositivo.cuenta, dispositivo

    def authenticate_header(self, request):
        return 'Extension'


class VincularThrottle(AnonRateThrottle):
    scope = 'extension_vincular'


class ExtensionThrottle(SimpleRateThrottle):
    scope = 'extension'

    def get_cache_key(self, request, view):
        dispositivo = getattr(request, 'auth', None)
        if isinstance(dispositivo, DispositivoExtension):
            return f'throttle_extension_{dispositivo.pk}'
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


def _de_la_extension(vista):
    """Ruta de la extensión: solo con su token, solo JSON, con límite por navegador."""
    vista = throttle_classes([ExtensionThrottle])(vista)
    vista = parser_classes([JSONParser])(vista)
    vista = permission_classes([IsAuthenticated])(vista)
    return authentication_classes([TokenExtension])(vista)


def _empresa(request, datos=None):
    try:
        ident = int((datos or request.query_params).get('empresa'))
    except (TypeError, ValueError):
        return None
    # Con un usuario del equipo, el manager ya limita a sus empresas.
    return Empresa.objects.filter(pk=ident, owner=request.user, activo=True).first()


# ── Panel: conectar y desconectar navegadores ────────────────────────────────

def _dispositivo(d):
    return {'id': d.id, 'nombre': d.nombre, 'persona': _nombre_persona(d.persona),
            'creado_en': d.creado_en.isoformat(), 'ultimo_uso': d.ultimo_uso.isoformat() if d.ultimo_uso else None,
            'vigente': d.vigente()}


def _mis_dispositivos(request):
    qs = DispositivoExtension.objects.filter(cuenta=request.user, revocado_en__isnull=True).select_related('persona')
    persona = actor(request)
    # El titular ve todos los navegadores de la cuenta; cada persona del equipo, los suyos.
    return qs if persona.pk == request.user.pk else qs.filter(persona=persona)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dispositivos(request):
    """GET /api/extension/dispositivos/ — navegadores conectados."""
    return Response([_dispositivo(d) for d in _mis_dispositivos(request).order_by('-creado_en') if d.vigente()])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crear_codigo(request):
    """POST /api/extension/codigo/ — código de un solo uso para conectar un navegador."""
    persona = actor(request)
    CodigoExtension.objects.filter(persona=persona, usado=False).update(usado=True)
    codigo = ''.join(secrets.choice(_ALFABETO) for _ in range(8))
    expira = timezone.now() + timezone.timedelta(minutes=MINUTOS_CODIGO)
    CodigoExtension.objects.create(cuenta=request.user, persona=persona, codigo_hash=_huella_codigo(codigo),
                                   expira_en=expira)
    return Response({'codigo': f'{codigo[:4]}-{codigo[4:]}', 'expira_en': expira.isoformat(),
                     'minutos': MINUTOS_CODIGO}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def desconectar(request, pk):
    """POST /api/extension/dispositivos/<id>/desconectar/ — corta ese navegador al tiro."""
    d = _mis_dispositivos(request).filter(pk=pk).first()
    if d is None:
        return Response({'error': 'Navegador no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    d.revocado_en = timezone.now()
    d.save(update_fields=['revocado_en'])
    return Response({'ok': True})


# ── Extensión ────────────────────────────────────────────────────────────────

def _datos_conexion(dispositivo):
    cuenta = dispositivo.cuenta
    fijadas = None
    ue = usuario_equipo_de(dispositivo.persona)
    if ue is not None:
        fijadas = set(ue.empresas.values_list('id', flat=True))
    empresas = Empresa.objects.filter(owner=cuenta, activo=True).order_by('nombre_legal')
    return {
        'cuenta': _nombre_persona(cuenta),
        'persona': _nombre_persona(dispositivo.persona),
        'dispositivo': dispositivo.nombre,
        'empresas': [{'id': e.id, 'nombre': e.alias or e.nombre_legal, 'rut': e.rut}
                     for e in empresas if fijadas is None or e.id in fijadas],
    }


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
@throttle_classes([VincularThrottle])
def vincular(request):
    """POST /api/extension/v1/vincular/ {codigo, nombre} — cambia el código del panel por el token."""
    codigo = _normalizar_codigo(request.data.get('codigo'))
    fila = (CodigoExtension.objects.select_related('cuenta', 'persona')
            .filter(codigo_hash=_huella_codigo(codigo), usado=False, expira_en__gt=timezone.now()).first()
            if len(codigo) == 8 else None)
    if fila is None:
        return Response({'error': 'El código no es válido o venció. Pide uno nuevo en Jornada40 → Dirección del Trabajo.'},
                        status=status.HTTP_400_BAD_REQUEST)
    fila.usado = True
    fila.save(update_fields=['usado'])
    ue = usuario_equipo_de(fila.persona)
    if not fila.persona.is_active or (ue is not None and ue.estado != 'ACTIVO'):
        return Response({'error': 'Tu acceso a esta cuenta fue retirado.'}, status=status.HTTP_403_FORBIDDEN)
    nombre = str(request.data.get('nombre') or '').strip()[:80] or 'Navegador'
    token = 'j40e_' + secrets.token_urlsafe(32)
    dispositivo = DispositivoExtension.objects.create(cuenta=fila.cuenta, persona=fila.persona, nombre=nombre,
                                                      token_hash=_huella_token(token), ultimo_uso=timezone.now())
    bitacora.registrar(fila.cuenta, 'EXTENSION', f'Conectó la extensión para Mi DT en «{nombre}»',
                       actor=fila.persona, actor_tipo='EQUIPO' if ue else 'TITULAR', metodo='POST',
                       ruta=request.path, estado_http=201, ip=request.META.get('REMOTE_ADDR', ''))
    return Response({'token': token, **_datos_conexion(dispositivo)}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@_de_la_extension
def yo(request):
    """GET /api/extension/v1/yo/ — cuenta, persona y empresas que puede usar."""
    return Response(_datos_conexion(request.auth))


@api_view(['POST'])
@_de_la_extension
def salir(request):
    """POST /api/extension/v1/salir/ — desconecta este navegador."""
    request.auth.revocado_en = timezone.now()
    request.auth.save(update_fields=['revocado_en'])
    return Response({'ok': True})


@api_view(['GET'])
@_de_la_extension
def registro(request):
    """GET /api/extension/v1/registro/?empresa= — lo que hay que registrar en Mi DT, con plazos."""
    empresa = _empresa(request)
    if empresa is None:
        return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(lista_registro(empresa))


@api_view(['GET'])
@_de_la_extension
def registro_ficha(request):
    """GET /api/extension/v1/registro/ficha/?empresa=&clave= — datos en el orden del formulario."""
    empresa = _empresa(request)
    if empresa is None:
        return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
    datos = ficha_registro(empresa, str(request.query_params.get('clave') or ''))
    if datos is None:
        return Response({'error': 'Registro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(datos)


@api_view(['POST'])
@_de_la_extension
def registro_marcar(request):
    """POST /api/extension/v1/registro/marcar/ {empresa, claves, fecha?, comprobante?}."""
    empresa = _empresa(request, request.data)
    if empresa is None:
        return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
    try:
        n = marcar_registros(empresa, request.data.get('claves'), request.data.get('fecha'), via='EXTENSION',
                             comprobante=str(request.data.get('comprobante') or ''), persona=actor(request))
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'marcados': n})


def mapeos_vigentes():
    # MAPEOS_MIDT_ARCHIVO solo lo cambian las pruebas e2e (su copia local de Mi DT).
    archivo = Path(getattr(settings, 'MAPEOS_MIDT_ARCHIVO', '') or _MAPEOS)
    try:
        return json.loads(archivo.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {'version': 0, 'empleador': None, 'pantallas': {}}


@api_view(['GET'])
@_de_la_extension
def mapeos(request):
    """GET /api/extension/v1/mapeos/ — qué campo de la ficha va en qué campo de Mi DT.
    Son datos, no código: se corrigen sin publicar otra versión de la extensión."""
    return Response(mapeos_vigentes())


_RUT = re.compile(r'\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b')
_CORREO = re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+')
_CLAVES_DE_VALOR = {'valor', 'value', 'valores', 'values'}


def _limpiar(dato):
    """Defensa adicional: sin valores escritos ni RUT o correos en los textos."""
    if isinstance(dato, dict):
        return {k: _limpiar(v) for k, v in dato.items() if str(k).lower() not in _CLAVES_DE_VALOR}
    if isinstance(dato, list):
        return [_limpiar(v) for v in dato]
    if isinstance(dato, str):
        return _CORREO.sub('[correo]', _RUT.sub('[rut]', dato))[:500]
    return dato


@api_view(['POST'])
@_de_la_extension
def levantamiento(request):
    """POST /api/extension/v1/levantamiento/ {ruta, titulo, version, estructura}."""
    estructura = request.data.get('estructura')
    if not isinstance(estructura, (dict, list)):
        return Response({'error': 'Falta la estructura de la pantalla.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(json.dumps(estructura, ensure_ascii=False).encode()) > TAMANO_MAXIMO_LEVANTAMIENTO:
        return Response({'error': 'La pantalla es demasiado grande para enviarla.'}, status=status.HTTP_400_BAD_REQUEST)
    fila = LevantamientoMiDT.objects.create(
        cuenta=request.user, persona=actor(request), ruta=str(request.data.get('ruta') or '')[:300],
        titulo=_limpiar(str(request.data.get('titulo') or ''))[:200],
        version_extension=str(request.data.get('version') or '')[:20], estructura=_limpiar(estructura))
    return Response({'id': fila.id}, status=status.HTTP_201_CREATED)
