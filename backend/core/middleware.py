import ipaddress
import logging
import re
from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import DisallowedHost
from django.http import JsonResponse

logger = logging.getLogger(__name__)


class IpRealMiddleware:
    """Deja en REMOTE_ADDR la IP real del visitante cuando corre en Railway.

    En Railway, REMOTE_ADDR es la IP interna del balanceador (100.64.x.x),
    igual para todos, y X-Forwarded-For trae la de Cloudflare, compartida
    por muchos visitantes. Railway escribe X-Real-IP con la IP real (la que
    informa Cloudflare, o la de quien conecta directo) y reemplaza el valor
    que envíe el cliente: verificado con el diagnóstico de red el 24-09-2026.

    Con esto el límite de intentos (DRF con NUM_PROXIES = 0) y la IP que
    queda en la auditoría de firma usan la IP del visitante, que no se
    puede falsificar desde el navegador.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(settings, 'IS_DEPLOYED', False):
            ip = request.META.get('HTTP_X_REAL_IP', '').strip()
            try:
                ipaddress.ip_address(ip)
            except ValueError:
                pass
            else:
                request.META['REMOTE_ADDR'] = ip
        return self.get_response(request)


MENSAJE_ORIGEN_AJENO = 'Solicitud rechazada: no viene de la aplicación de Jornada40.'

_METODOS_SEGUROS = frozenset({'GET', 'HEAD', 'OPTIONS', 'TRACE'})

# Rutas que no usa un navegador con la sesión de alguien: el aviso de pago de
# Reveniu (de servidor a servidor) y la extensión, que se identifica con su token
# y no con cookies (sus peticiones traen el origen chrome-extension://).
_SIN_REVISION = ('/api/pagos/webhook/reveniu/', '/api/extension/v1/')


def _origen_de(url):
    """'esquema://host[:puerto]' de una URL en minúsculas, o '' si no se puede leer."""
    partes = urlsplit(url.strip())
    return f'{partes.scheme}://{partes.netloc}'.lower() if partes.scheme and partes.netloc else ''


class OrigenPermitidoMiddleware:
    """Rechaza las escrituras en la API que nacen en una página de otro sitio (CSRF).

    Las sesiones viajan en cookies. Sin esta revisión, un formulario de otro sitio
    podría crear o modificar datos con la sesión abierta de la persona: el navegador
    agrega las cookies y Django REST Framework acepta formularios. Los navegadores
    ponen el encabezado Origin en toda petición POST, PUT, PATCH o DELETE que una
    página envía a otro origen, y la página no lo puede cambiar. Si ese origen no es
    uno de los de la aplicación (CORS_ALLOWED_ORIGINS, sus patrones de staging o
    CSRF_TRUSTED_ORIGINS) ni la propia API, la petición se rechaza antes de llegar a
    la vista. «null» (iframe aislado, documento local) también se rechaza.

    Sin Origin se mira Referer. Sin ninguno de los dos, la petición no viene de una
    página web (no puede llevar la sesión de otra persona) y sigue su curso.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _permitido(origen, request):
        propios = {o.rstrip('/').lower() for o in (*getattr(settings, 'CORS_ALLOWED_ORIGINS', ()),
                                                    *getattr(settings, 'CSRF_TRUSTED_ORIGINS', ()))}
        if origen in propios:
            return True
        if any(re.match(patron, origen) for patron in getattr(settings, 'CORS_ALLOWED_ORIGIN_REGEXES', ())):
            return True
        # La propia API: el administrador de Django y la API navegable de DRF.
        try:
            return urlsplit(origen).netloc == request.get_host().lower()
        except DisallowedHost:
            return False

    def __call__(self, request):
        if (request.method not in _METODOS_SEGUROS and request.path.startswith('/api/')
                and not request.path.startswith(_SIN_REVISION)):
            origen = request.META.get('HTTP_ORIGIN')
            if origen is None and request.META.get('HTTP_REFERER'):
                origen = _origen_de(request.META['HTTP_REFERER']) or None
            if origen is not None:
                origen = origen.strip().rstrip('/').lower()
                if not self._permitido(origen, request):
                    logger.warning('Escritura rechazada por venir de otro origen: %s %s', request.method, request.path)
                    return JsonResponse({'error': MENSAJE_ORIGEN_AJENO}, status=403)
        return self.get_response(request)
