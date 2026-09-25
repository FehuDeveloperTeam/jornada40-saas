"""Cliente mínimo de la API de Reveniu (https://docs.reveniu.com).

- Autenticación: encabezado Reveniu-Secret-Key. Es la misma clave con que
  Reveniu firma los webhooks, así que por defecto se usa REVENIU_WEBHOOK_SECRET
  (o REVENIU_API_KEY si se define aparte).
- URL: producción https://api.reveniu.com; sandbox https://integration.reveniu.com
  (cuenta en https://sandbox.reveniu.com). Se cambia con REVENIU_API_URL.

Toda llamada falla con ErrorReveniu; quien llama decide el respaldo (link de
pago fijo, correo de aviso), de modo que una caída de Reveniu nunca deje un
pago o un doble cobro sin atender.
"""
import logging

import requests
from decouple import config
from django.core.cache import cache

logger = logging.getLogger(__name__)

_TIMEOUT = 15


class ErrorReveniu(Exception):
    pass


def _url_api() -> str:
    return config('REVENIU_API_URL', default='https://api.reveniu.com').rstrip('/')


def _clave() -> str:
    clave = config('REVENIU_API_KEY', default=None) or config('REVENIU_WEBHOOK_SECRET', default=None)
    if not clave:
        raise ErrorReveniu('Falta la clave de la API de Reveniu (REVENIU_API_KEY o REVENIU_WEBHOOK_SECRET).')
    return clave


def _llamar(metodo: str, ruta: str, **kwargs):
    try:
        r = requests.request(metodo, f'{_url_api()}{ruta}', timeout=_TIMEOUT,
                             headers={'Reveniu-Secret-Key': _clave(), 'Content-Type': 'application/json'}, **kwargs)
    except requests.RequestException as e:
        raise ErrorReveniu(f'Reveniu no respondió: {e}') from e
    if r.status_code >= 400:
        raise ErrorReveniu(f'Reveniu respondió {r.status_code}: {r.text[:300]}')
    try:
        return r.json() if r.content else {}
    except ValueError as e:
        raise ErrorReveniu('Reveniu respondió algo que no es JSON.') from e


def id_plan_desde_link(link: str) -> int:
    """Id del plan de Reveniu al que apunta un link de pago (el link lleva el slug del plan)."""
    clave_cache = f'reveniu-plan-{link}'
    guardado = cache.get(clave_cache)
    if guardado:
        return guardado
    datos = _llamar('GET', '/api/v1/plans/')
    planes = datos.get('data', datos) if isinstance(datos, dict) else datos
    for plan in planes or []:
        slug = str(plan.get('slug') or '')
        if slug and slug in link:
            cache.set(clave_cache, int(plan['id']), 60 * 60)
            return int(plan['id'])
    raise ErrorReveniu('No se encontró en Reveniu el plan del link de pago configurado.')


def crear_suscripcion(plan_id: int, email: str, nombre: str, external_id: int) -> dict:
    """Crea la suscripción y devuelve {id, completion_url, security_token}.

    El cliente completa el pago en completion_url, enviando por POST el
    campo TBK_TOKEN = security_token (Transbank).
    """
    datos = _llamar('POST', '/api/v1/subscriptions/', json={
        'plan_id': plan_id, 'external_id': external_id,
        'field_values': {'email': email, 'name': nombre or email},
    })
    if not datos.get('id') or not datos.get('completion_url'):
        raise ErrorReveniu('Reveniu no devolvió la suscripción creada.')
    return datos


def desactivar_renovacion(subscription_id) -> bool:
    """La suscripción sigue activa hasta su próximo cobro y ahí expira, sin cobrar.

    Es lo que corresponde al cambiar de plan o de ciclo: el período ya pagado
    se respeta y no hay doble cobro.
    """
    datos = _llamar('POST', f'/api/v1/subscriptions/{subscription_id}/disablerenew/')
    return datos.get('result', True) is not False
