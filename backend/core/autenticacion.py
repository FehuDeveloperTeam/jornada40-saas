"""Autenticación del panel con cerco para los usuarios del equipo.

Titular y equipo usan la misma sesión JWT en cookies. Para un usuario del equipo:

1. Si fue eliminado, queda fuera de inmediato (401), aunque su token siga vigente.
2. Las rutas de identidad (su clave, su sesión, confirmar identidad) actúan como él.
3. Las demás rutas se resuelven a un módulo (core.permisos): si no lo tiene, o si
   quiere modificar con "solo ver", responde 403. Lo que no es de ningún módulo es
   del titular y también responde 403.
4. Si pasa, la petición actúa sobre los datos de la cuenta (request.user = titular,
   así los filtros por dueño siguen valiendo), solo en sus empresas
   (core.contexto), y `request.actor` es la persona: la bitácora y la firma usan
   su nombre, nunca el del titular.
"""
from dj_rest_auth.jwt_auth import JWTCookieAuthentication
from rest_framework import exceptions

from . import permisos as p
from .contexto import fijar_empresas


def usuario_equipo_de(user):
    return getattr(user, 'usuario_equipo', None) if getattr(user, 'pk', None) else None


def actor(request):
    """La persona que actúa (titular o usuario del equipo)."""
    return getattr(request, 'actor', None) or request.user


def tipos_visibles(request):
    """Tipos de documento que la persona puede ver, o None si ve todos (titular).

    Las listas de firmas y documentos mezclan tipos de varios módulos: un usuario
    del equipo solo ve los de sus módulos (p. ej. con Remuneraciones, solo las
    firmas de liquidaciones).
    """
    ue = usuario_equipo_de(getattr(request, 'actor', None))
    if ue is None:
        return None
    permisos = ue.permisos or {}
    return {t for t, m in p.MODULO_POR_TIPO.items() if permisos.get(m)}


def _tipo_de(modelo, pk, cuenta, campo='tipo'):
    from . import models
    fila = getattr(models, modelo)._base_manager.filter(pk=pk).values(campo, *(
        ['empresa__owner'] if modelo == 'SolicitudFirma' else ['empleado__empresa__owner'])).first()
    if not fila or list(fila.values())[1] != cuenta.pk:
        return None
    return fila[campo]


def _pk(ruta, prefijo):
    resto = ruta[len(prefijo):].split('/')
    return resto[0] if resto and resto[0].isdigit() else None


def _modulos_documento(request, ruta, cuenta):
    """Módulos que abren una ruta de firmas o documentos, según el tipo de documento."""
    try:
        datos = request.data if request.method in ('POST', 'PUT', 'PATCH') else {}
    except exceptions.ParseError:
        datos = {}
    if not hasattr(datos, 'get'):
        datos = {}
    if ruta.startswith('/api/firmas/'):
        if ruta.startswith('/api/firmas/solicitar_liquidaciones/'):
            return ('REMUNERACIONES',)
        if ruta.startswith('/api/firmas/solicitar/'):
            return (p.MODULO_POR_TIPO.get(datos.get('tipo_documento')),)
        pk = _pk(ruta, '/api/firmas/')
        if pk:
            return (p.MODULO_POR_TIPO.get(_tipo_de('SolicitudFirma', pk, cuenta, 'tipo_documento')),)
        return p.MODULOS_DOCUMENTOS
    if ruta.startswith('/api/documentos_legales/'):
        pk = _pk(ruta, '/api/documentos_legales/')
        if pk:
            return (p.MODULO_POR_TIPO.get(_tipo_de('DocumentoLegal', pk, cuenta)),)
        if request.method == 'POST':
            return (p.MODULO_POR_TIPO.get(datos.get('tipo')),)
        return ('DOCUMENTOS', 'TERMINO')
    if ruta.startswith('/api/documentos-laborales/'):
        pk = _pk(ruta, '/api/documentos-laborales/')
        if pk:
            return (p.MODULO_POR_TIPO.get(_tipo_de('DocumentoLaboral', pk, cuenta)),)
        if request.method == 'POST':
            tipo = datos.get('tipo')
            return ('CONTRATOS',) if tipo == 'TELETRABAJO' else (p.MODULO_POR_TIPO.get(tipo),)
        return p.MODULOS_DOCUMENTOS
    return None


def autorizar_equipo(request, ue):
    """True si actúa como la persona (rutas de identidad); False si actúa sobre la cuenta.
    Lanza PermissionDenied si no puede usar la ruta."""
    ruta, metodo = request.path, request.method
    if ruta.startswith(p.RUTAS_IDENTIDAD):
        return True
    permisos = ue.permisos or {}
    if ruta.startswith(p.RUTAS_COMUNES_LECTURA):
        if metodo in ('GET', 'HEAD', 'OPTIONS'):
            return False
        raise exceptions.PermissionDenied('Solo el titular de la cuenta puede hacer esto.')
    modulos = _modulos_documento(request, ruta, ue.cuenta) or p.modulos_de_ruta(ruta)
    if not modulos or not any(modulos):
        raise exceptions.PermissionDenied('Tu usuario no tiene acceso a esta sección.')
    if not p.tiene(permisos, [m for m in modulos if m], escribir=not p.es_lectura(ruta, metodo)):
        raise exceptions.PermissionDenied('Tu usuario no tiene permiso para esto. Pídeselo al titular de la cuenta.')
    return False


class CookieConCerco(JWTCookieAuthentication):
    def authenticate(self, request):
        resultado = super().authenticate(request)
        if resultado is None:
            return None
        user, token = resultado
        # Los usuarios internos del acceso Ley Karin nunca entran al panel (sesión aparte).
        if hasattr(user, 'encargado_karin'):
            raise exceptions.AuthenticationFailed('Este usuario no tiene acceso al panel.')
        ue = usuario_equipo_de(user)
        if ue is None:
            return user, token
        if ue.estado != 'ACTIVO' or not user.is_active:
            raise exceptions.AuthenticationFailed('Tu acceso a esta cuenta fue retirado.')
        if autorizar_equipo(request, ue):
            return user, token
        request._request.actor = user
        fijar_empresas(ue.empresas.values_list('id', flat=True))
        return ue.cuenta, token
