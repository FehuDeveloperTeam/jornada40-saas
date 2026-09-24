import ipaddress

from django.conf import settings


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
