"""Bitácora de acciones de la cuenta (solo lectura, encadenada con SHA-256).

`registrar()` agrega un registro; `BitacoraMiddleware` registra solo lo que se
hace en el panel: toda escritura (crear, editar, enviar a firma, borrar) y toda
descarga, con quién, cuándo, desde qué IP y el resultado. Nunca guarda el
contenido de lo que se envió (sueldos, RUT, textos): solo qué acción fue y
sobre qué registro. El ingreso y la salida se registran en sus vistas.

Queda fuera lo que tiene su propio registro o no es del panel: el portal del
trabajador, el de fiscalización, la firma pública y la Ley Karin.
"""
import hashlib
import json
import logging
import re

from django.db import transaction
from django.utils import timezone

from .models import Empresa, RegistroBitacora

logger = logging.getLogger(__name__)

_EXCLUIDAS = ('/api/trabajador/', '/api/inspeccion/', '/api/firma-publica/', '/api/auth/token/refresh/',
              '/api/auth/login/', '/api/auth/equipo/', '/api/ley-karin/denuncias/', '/api/karin/')
# POST que solo calculan una vista previa: no son acciones.
_SOLO_CALCULO = re.compile(r'/(simular|evaluar-jornada|evaluar_jornada|dias_habiles)/?$')
_DESCARGA = re.compile(r'(pdf|descargar|exportar|zip|plantilla|resumen-dj1887|csv)', re.IGNORECASE)

_ENTIDADES = {
    'empresa': 'empresa', 'empleado': 'trabajador', 'contrato': 'contrato', 'documentolegal': 'documento legal',
    'documento_legal': 'documento legal', 'liquidacion': 'liquidación', 'anexocontrato': 'anexo de contrato',
    'anexo_contrato': 'anexo de contrato', 'vacacion': 'vacación o permiso', 'finiquito': 'finiquito',
    'conceptoremuneracion': 'concepto de remuneración', 'concepto': 'concepto de remuneración',
    'solicitudfirma': 'solicitud de firma', 'firma': 'solicitud de firma', 'documento_laboral': 'pacto o constancia',
    'reglamento': 'reglamento interno', 'ley_karin': 'aviso Ley Karin', 'registro_dt': 'registro en Mi DT',
    'solicitud_documento': 'solicitud de documento', 'certificado': 'certificado',
    'equipo': 'usuario del equipo',
    'encargado_karin': 'encargado de denuncias Ley Karin',
}
_VERBOS = {'POST': 'Creó', 'PUT': 'Modificó', 'PATCH': 'Modificó', 'DELETE': 'Eliminó'}
# Rutas con un texto propio.
_ESPECIALES = {
    'rest_logout': ('SALIDA', 'Cerró sesión'),
    'rest_password_change': ('CLAVE', 'Cambió su contraseña'),
    'solicitudfirma-confirmar-identidad': ('IDENTIDAD', 'Confirmó su identidad con su clave para firmar'),
    'perfil_usuario': ('PERFIL', 'Modificó los datos del titular'),
    'preferencia_resumen': ('PERFIL', 'Cambió la frecuencia del resumen por correo'),
    'exportar_bitacora': ('DESCARGA', 'Descargó una copia de la bitácora'),
}


def _huella(datos):
    return hashlib.sha256(json.dumps(datos, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _contenido(r):
    return {'cuenta': r.cuenta_id, 'actor': r.actor_id, 'actor_tipo': r.actor_tipo, 'actor_nombre': r.actor_nombre,
            'actor_rut': r.actor_rut, 'empresa': r.empresa_id, 'accion': r.accion, 'descripcion': r.descripcion,
            'metodo': r.metodo, 'ruta': r.ruta, 'estado_http': r.estado_http, 'ip': r.ip,
            'creado_en': r.creado_en.isoformat(), 'hash_anterior': r.hash_anterior}


def cuenta_de(user):
    """(cuenta, tipo de actor) del usuario del panel, o (None, None) si no es del panel."""
    if not getattr(user, 'is_authenticated', False) or not getattr(user, 'pk', None):
        return None, None
    if hasattr(user, 'perfil_cliente'):
        return user, 'TITULAR'
    ue = getattr(user, 'usuario_equipo', None)
    if ue is not None and ue.estado == 'ACTIVO':
        return ue.cuenta, 'EQUIPO'
    return None, None


def _nombre(user):
    ue = getattr(user, 'usuario_equipo', None)
    if ue is not None:
        return f'{ue.nombre_completo} (equipo)'
    cliente = getattr(user, 'perfil_cliente', None)
    if cliente:
        nombre = ' '.join(p for p in (cliente.nombres, cliente.apellido_paterno) if p).strip()
        if nombre:
            return nombre
    return user.get_full_name() or user.username


def registrar(cuenta, accion, descripcion, *, actor=None, actor_tipo='SISTEMA', empresa=None, metodo='', ruta='',
              estado_http=None, ip=''):
    """Agrega un registro al final de la cadena de la cuenta."""
    with transaction.atomic():
        # Bloquea la cuenta para que dos registros simultáneos no partan del mismo anterior.
        type(cuenta).objects.select_for_update().filter(pk=cuenta.pk).first()
        anterior = RegistroBitacora.objects.filter(cuenta=cuenta).order_by('-id').values_list('hash', flat=True).first()
        r = RegistroBitacora(
            cuenta=cuenta, actor=actor, actor_tipo=actor_tipo,
            actor_nombre=(_nombre(actor) if actor else 'Jornada40')[:150],
            actor_rut=(getattr(getattr(actor, 'usuario_equipo', None), 'rut', None) or (actor.username if actor else ''))[:15], empresa=empresa, accion=accion[:40],
            descripcion=descripcion[:300], metodo=metodo[:8], ruta=ruta[:200], estado_http=estado_http, ip=ip[:64],
            creado_en=timezone.now(), hash_anterior=anterior or '')
        r.hash = _huella(_contenido(r))
        r.save()
        return r


def verificar(cuenta):
    """Recorre la cadena: {'ok', 'registros', 'roto_en'} (id del primer registro alterado o quitado)."""
    anterior, n = '', 0
    for r in RegistroBitacora.objects.filter(cuenta=cuenta).order_by('id').iterator():
        n += 1
        if r.hash_anterior != anterior or _huella(_contenido(r)) != r.hash:
            return {'ok': False, 'registros': n, 'roto_en': r.id}
        anterior = r.hash
    return {'ok': True, 'registros': n, 'roto_en': None}


def describir(request, estado):
    """(acción, descripción) legibles a partir de la ruta; nunca incluye datos enviados."""
    match = getattr(request, 'resolver_match', None)
    nombre = (match.url_name if match else '') or ''
    base, _, sufijo = nombre.partition('-')
    entidad = _ENTIDADES.get(base, base.replace('_', ' ') or 'registro')
    ident = (match.kwargs.get('pk') if match else None) or ''
    metodo = request.method
    if nombre in _ESPECIALES:
        accion, texto = _ESPECIALES[nombre]
    elif request.method == 'GET':
        accion, texto = 'DESCARGA', f'Descargó {entidad}' + (f' N° {ident}' if ident else '')
        if sufijo and sufijo not in ('detail', 'list'):
            texto += f' ({sufijo.replace("-", " ").replace("_", " ")})'
    elif sufijo in ('list', 'detail', ''):
        accion = {'POST': 'CREAR', 'DELETE': 'ELIMINAR'}.get(metodo, 'MODIFICAR')
        texto = f'{_VERBOS.get(metodo, "Modificó")} {entidad}' + (f' N° {ident}' if ident else '')
    else:
        accion = 'ACCION'
        texto = f'{sufijo.replace("-", " ").replace("_", " ").capitalize()} · {entidad}' + (
            f' N° {ident}' if ident else '')
    if estado >= 400:
        texto += ' (no se completó)'
    return accion, texto


def _empresa_de(request, cuenta):
    try:
        ident = int(request.GET.get('empresa') or 0)
    except (TypeError, ValueError):
        return None
    return Empresa.objects.filter(pk=ident, owner=cuenta).first() if ident else None


def registrar_peticion(request, estado):
    ruta = request.path
    if not ruta.startswith('/api/') or ruta.startswith(_EXCLUIDAS) or _SOLO_CALCULO.search(ruta):
        return
    if request.method == 'GET':
        if not _DESCARGA.search(ruta):
            return
    elif request.method not in ('POST', 'PUT', 'PATCH', 'DELETE'):
        return
    persona = getattr(request, 'actor', None) or getattr(request, 'user', None)
    cuenta, tipo = cuenta_de(persona)
    if cuenta is None:
        return
    accion, texto = describir(request, estado)
    registrar(cuenta, accion, texto, actor=persona, actor_tipo=tipo, empresa=_empresa_de(request, cuenta),
              metodo=request.method, ruta=ruta, estado_http=estado, ip=request.META.get('REMOTE_ADDR', ''))


class BitacoraMiddleware:
    """Registra en la bitácora las escrituras y descargas del panel (después de responder)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        respuesta = self.get_response(request)
        try:
            registrar_peticion(request, respuesta.status_code)
        except Exception:
            # La bitácora nunca tumba una acción del usuario, pero la falla queda en el log.
            logger.exception('No se pudo registrar en la bitácora %s %s', request.method, request.path)
        return respuesta
