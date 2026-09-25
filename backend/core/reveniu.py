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


# Frecuencia del plan en Reveniu (docs: Variables → Intervalos): "3" mensual, "4" anual.
FRECUENCIA_POR_CICLO = {'MENSUAL': '3', 'ANUAL': '4'}


class PlanMalConfigurado(ErrorReveniu):
    """El plan de Reveniu no cobra con la frecuencia del ciclo que se vende."""


def plan_desde_link(link: str) -> dict:
    """{id, frequency, title} del plan de Reveniu al que apunta un link de pago
    (el link lleva el slug del plan)."""
    clave_cache = f'reveniu-plan-{link}'
    guardado = cache.get(clave_cache)
    if guardado:
        return guardado
    for plan in _planes():
        slug = str(plan.get('slug') or '')
        if slug and slug in link:
            datos = {'id': int(plan['id']), 'frequency': str(plan.get('frequency') or ''), 'title': plan.get('title') or ''}
            cache.set(clave_cache, datos, 60 * 60)
            return datos
    raise ErrorReveniu('No se encontró en Reveniu el plan del link de pago configurado.')


def id_plan_desde_link(link: str) -> int:
    return plan_desde_link(link)['id']


def exigir_frecuencia(plan: dict, ciclo: str) -> None:
    """Evita cobrar un plan anual cada mes (o al revés) si en Reveniu quedó mal configurado."""
    esperada = FRECUENCIA_POR_CICLO.get(ciclo.upper())
    if esperada and plan.get('frequency') and plan['frequency'] != esperada:
        raise PlanMalConfigurado(
            f'El plan "{plan.get("title")}" de Reveniu cobra con frecuencia {plan["frequency"]} y se vende como '
            f'{ciclo.lower()} (debería ser {esperada}).')


def _planes():
    """Todos los planes del comercio. La API los entrega paginados:
    {"data": {"results": [...], "next": ..., "total_pages": N}}."""
    pagina, total = 1, 1
    while pagina <= total and pagina <= 20:
        datos = _llamar('GET', '/api/v1/plans/', params={'page': pagina} if pagina > 1 else None)
        cuerpo = datos.get('data', datos) if isinstance(datos, dict) else datos
        if isinstance(cuerpo, dict):
            yield from (p for p in cuerpo.get('results') or [] if isinstance(p, dict))
            total = int(cuerpo.get('total_pages') or 1)
        elif isinstance(cuerpo, list):
            yield from (p for p in cuerpo if isinstance(p, dict))
            return
        else:
            raise ErrorReveniu('Respuesta inesperada al listar los planes de Reveniu.')
        pagina += 1


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


def obtener_suscripcion(subscription_id) -> dict:
    """Detalle de una suscripción: status, plan_amount, next_due, is_auto_renew…"""
    datos = _llamar('GET', f'/api/v1/subscriptions/{subscription_id}/')
    if not isinstance(datos, dict) or not datos.get('id'):
        raise ErrorReveniu('Reveniu no devolvió la suscripción.')
    return datos


def cambiar_monto(subscription_id, monto: int) -> None:
    """Cambia el monto de los próximos cobros de la suscripción (bajar de plan
    sin inscribir otra tarjeta ni abrir otra suscripción). Verificado en el sandbox."""
    datos = _llamar('POST', f'/api/v1/subscriptions/{subscription_id}/amount/', json={'amount': int(monto)})
    if datos.get('result') is not True:
        raise ErrorReveniu('Reveniu no confirmó el cambio de monto.')


def reactivar_renovacion(subscription_id) -> None:
    """Vuelve a dejar renovable una suscripción a la que se le quitó la
    renovación, sin cobro inmediato: /extend/ con auto_renew. Reveniu solo la
    acepta sobre suscripciones vigentes, así que se comprueba el resultado
    leyendo la suscripción; si no quedó renovable, falla con ErrorReveniu."""
    datos = _llamar('POST', '/api/v1/subscriptions/extend/',
                    json={'subs': [int(subscription_id)], 'cicles': 1, 'auto_renew': True})
    exitosas = [str(s) for s in (datos.get('success_changes') or [])]
    if str(subscription_id) not in exitosas:
        raise ErrorReveniu('Reveniu no pudo reactivar la renovación de la suscripción.')
    if obtener_suscripcion(subscription_id).get('is_auto_renew') is not True:
        raise ErrorReveniu('Reveniu aceptó la extensión, pero la suscripción no quedó renovable.')
