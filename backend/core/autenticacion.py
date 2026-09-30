"""Autenticación del panel con cerco para los usuarios del equipo.

Titular y equipo usan la misma sesión JWT en cookies. Esta clase agrega dos
reglas para el equipo: un usuario eliminado queda fuera de inmediato (aunque su
token siga vigente) y solo puede llamar las rutas que sus módulos permiten
(`permisos.equipo_puede`); lo demás responde 403. El cerco está en un solo lugar,
así una ruta nueva queda cerrada hasta que se asigne a un módulo.
"""
from dj_rest_auth.jwt_auth import JWTCookieAuthentication
from rest_framework import exceptions

from .permisos import equipo_puede


def usuario_equipo_de(user):
    """UsuarioEquipo activo del usuario, o None si es titular u otro."""
    ue = getattr(user, 'usuario_equipo', None) if getattr(user, 'pk', None) else None
    return ue


class CookieConCerco(JWTCookieAuthentication):
    def authenticate(self, request):
        resultado = super().authenticate(request)
        if resultado is None:
            return None
        user, token = resultado
        ue = usuario_equipo_de(user)
        if ue is not None:
            if ue.estado != 'ACTIVO':
                raise exceptions.AuthenticationFailed('Tu acceso a esta cuenta fue retirado.')
            if not equipo_puede(ue, request.path, request.method):
                raise exceptions.PermissionDenied('Tu usuario no tiene acceso a esta sección.')
        return user, token
