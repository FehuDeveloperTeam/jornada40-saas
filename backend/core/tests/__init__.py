"""Pruebas del backend (`python manage.py test core`).

Ninguna prueba sale a internet. Los servicios externos se simulan:
- mindicador.cl (UF y UTM) responde aquí, para toda la suite, con los mismos
  valores de `@indicadores_fijos`: los cálculos no dependen de la UF del día;
- B2, Reveniu y Gemini se simulan en cada prueba con `patch`.

Si una prueba intenta otra conexión HTTP real, falla con un mensaje que dice qué
simular. La excepción no hereda de `Exception` a propósito: así no la atrapa un
`except Exception` del código y el olvido no queda escondido.
"""
import json

from requests import Response
from requests.adapters import HTTPAdapter

# Los mismos valores de tests.utiles.indicadores_fijos.
INDICADORES = {'uf': 41057.20, 'utm': 71721.0}
_MINDICADOR = 'https://mindicador.cl/api/'


class SalidaAInternet(BaseException):
    """Una prueba intentó una conexión HTTP real."""


def _respuesta_mindicador(request):
    nombre = request.url[len(_MINDICADOR):].split('?')[0].strip('/')
    valor = INDICADORES.get(nombre)
    respuesta = Response()
    respuesta.status_code = 200 if valor is not None else 404
    respuesta._content = json.dumps({'serie': [{'valor': valor}]} if valor is not None else {}).encode()
    respuesta.headers['Content-Type'] = 'application/json'
    respuesta.url, respuesta.request = request.url, request
    return respuesta


def _sin_internet(self, request, *args, **kwargs):
    if request.url.startswith(_MINDICADOR):
        return _respuesta_mindicador(request)
    destino = request.url.split('?')[0]
    raise SalidaAInternet(f'La prueba intentó conectarse a {destino}: simula ese servicio con patch.')


HTTPAdapter.send = _sin_internet
