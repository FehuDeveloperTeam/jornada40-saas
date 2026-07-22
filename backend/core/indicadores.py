"""
Indicadores económicos de Chile (UF, UTM) e Impuesto Único de Segunda Categoría.

Los valores de UF y UTM se consultan a mindicador.cl (API pública que refleja
los valores oficiales del Banco Central y del SII) y se cachean para no
depender de la disponibilidad de la API en cada liquidación.

Si la API no responde, se usa un valor de respaldo (FALLBACK) — ojo que estos
valores quedan desactualizados con el tiempo; conviene revisarlos cada cierto
tiempo si empiezan a aparecer usados en los logs.
"""
import logging

import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

MINDICADOR_URL = "https://mindicador.cl/api/{indicador}"
CACHE_TTL_SEGUNDOS = 6 * 60 * 60  # 6 horas

# Valores de respaldo si la API falla. Actualizados por última vez: julio 2026.
UF_FALLBACK = 40844.79
UTM_FALLBACK = 71506.0


def _obtener_indicador(nombre: str, fallback: float) -> float:
    cache_key = f"indicador_{nombre}"
    valor_cacheado = cache.get(cache_key)
    if valor_cacheado is not None:
        return valor_cacheado

    try:
        resp = requests.get(MINDICADOR_URL.format(indicador=nombre), timeout=5)
        resp.raise_for_status()
        data = resp.json()
        serie = data.get('serie', [])
        valor = float(serie[0]['valor']) if serie else float(data.get('valor'))
    except Exception:
        logger.warning(
            "No se pudo obtener el indicador '%s' desde mindicador.cl, usando valor de respaldo (%s).",
            nombre, fallback,
        )
        return fallback

    cache.set(cache_key, valor, CACHE_TTL_SEGUNDOS)
    return valor


def obtener_uf() -> float:
    """Valor de la UF vigente hoy, en pesos."""
    return _obtener_indicador('uf', UF_FALLBACK)


def obtener_utm() -> float:
    """Valor de la UTM vigente este mes, en pesos."""
    return _obtener_indicador('utm', UTM_FALLBACK)


# ==========================================
# IMPUESTO ÚNICO DE SEGUNDA CATEGORÍA
# ==========================================
# Tabla expresada en múltiplos de UTM (estable en el tiempo — el SII solo
# ajusta el valor de la UTM cada mes, no estos factores/rebajas).
# Fórmula: impuesto = (base_tributable * factor) - (rebaja_utm * valor_utm)
_TRAMOS_IUSC = [
    # (desde_utm, factor, rebaja_utm)
    (0.0,   0.0,   0.0),
    (13.5,  0.04,  0.54),
    (30.0,  0.08,  1.74),
    (50.0,  0.135, 4.49),
    (70.0,  0.23,  11.14),
    (90.0,  0.304, 17.80),
    (120.0, 0.35,  23.32),
    (310.0, 0.40,  38.82),
]


def calcular_impuesto_unico(base_tributable: float, valor_utm: float) -> int:
    """
    Calcula el Impuesto Único de Segunda Categoría mensual.

    base_tributable: renta líquida imponible (haberes imponibles menos
                      descuentos previsionales obligatorios: AFP + salud + AFC).
    valor_utm: valor de la UTM del mes correspondiente (usar obtener_utm()).
    """
    if valor_utm <= 0 or base_tributable <= 0:
        return 0

    base_en_utm = base_tributable / valor_utm

    tramo_factor = 0.0
    tramo_rebaja_utm = 0.0
    for desde_utm, factor, rebaja_utm in _TRAMOS_IUSC:
        if base_en_utm >= desde_utm:
            tramo_factor = factor
            tramo_rebaja_utm = rebaja_utm
        else:
            break

    impuesto = (base_tributable * tramo_factor) - (tramo_rebaja_utm * valor_utm)
    return max(0, round(impuesto))