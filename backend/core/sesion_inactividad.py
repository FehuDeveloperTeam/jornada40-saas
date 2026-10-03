"""Sesiones con cookie firmada que vencen por inactividad.

El acceso Ley Karin, el portal del trabajador y el del inspector usan una
cookie firmada propia. Cada petición autenticada la vuelve a firmar
(`RenovarSesionMiddleware`), así que vence tras `inactividad` segundos sin uso.
Además guarda la hora de ingreso (`i`) y no pasa de `maximo` aunque haya
actividad. Una cookie sin `i` (anterior a este cambio) ya no sirve: se vuelve a entrar.
"""
import time

from django.conf import settings
from django.core import signing


def firmar(datos, salt):
    """Firma los datos de la sesión, con la hora de ingreso si aún no la tienen."""
    return signing.dumps({**datos, 'i': datos.get('i') or int(time.time())}, salt=salt)


def leer(valor, salt, inactividad, maximo):
    """Datos de una cookie vigente; lanza signing.BadSignature si venció o fue alterada."""
    datos = signing.loads(valor, salt=salt, max_age=inactividad)
    inicio = datos.get('i') if isinstance(datos, dict) else None
    if not isinstance(inicio, int) or time.time() - inicio > maximo:
        raise signing.BadSignature('Sesión vencida.')
    return datos


def poner_cookie(respuesta, nombre, valor, max_age):
    desplegado = bool(getattr(settings, 'IS_DEPLOYED', False))
    respuesta.set_cookie(nombre, valor, max_age=max_age, httponly=True, secure=desplegado,
                         samesite='None' if desplegado else 'Lax', path='/')
    return respuesta


def renovar(request, nombre, datos, salt, max_age):
    """Pide al middleware volver a firmar la cookie al responder (corre el plazo de inactividad)."""
    destino = getattr(request, '_request', request)   # DRF envuelve el HttpRequest
    destino.sesion_renovada = (nombre, firmar(datos, salt), max_age)


class RenovarSesionMiddleware:
    """Vuelve a poner la cookie de sesión que pidió renovar la autenticación.
    Si la vista ya puso o borró esa cookie (ingreso, salida), manda la vista."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        respuesta = self.get_response(request)
        renovada = getattr(request, 'sesion_renovada', None)
        if renovada and renovada[0] not in respuesta.cookies:
            poner_cookie(respuesta, *renovada)
        return respuesta
