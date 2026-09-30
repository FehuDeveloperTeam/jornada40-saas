"""Horas extra compensadas con días adicionales de feriado (Art. 32 inc. 4°, Ley 21.561).

Si el pacto de horas extra firmado dice que se compensan con descanso (todo o
la mitad), la liquidación no paga esas horas: las guarda en una "bolsa" de
horas de descanso, con el mismo recargo (50 % → cada hora extra da 1,5 horas).

- Tope: 5 días hábiles de descanso por año de contrato (anualidad desde el
  inicio de la relación, Dictamen 199/5), medidos en horas de la jornada
  diaria. Lo que exceda el tope se paga en dinero.
- Uso: días completos, que descuentan las horas de la jornada de ese día
  (Dictamen 387/11), registrados en Vacaciones como "Día compensatorio".
- Vencimiento: seis meses después del mes en que se trabajaron. Lo que no se
  usó se paga en la liquidación del mes en que vence (o en la siguiente que se
  emita) y, al término de la relación, en el finiquito (Art. 73).

La bolsa no se guarda aparte: se deduce de las liquidaciones emitidas (horas
generadas y pagadas) y de los días compensatorios aprobados, así que editar
una liquidación la mantiene al día.
"""
import calendar
import datetime
import math
from collections import OrderedDict

from dateutil.relativedelta import relativedelta
from django.utils import timezone

from ..jornada import horas_por_dia
from ..models import ConceptoRemuneracion, DocumentoLaboral, Empleado, Liquidacion, VacacionEmpleado
from .base import _plan_permite
from .feriado import es_feriado_cl

NIVEL_COMPENSACION = 3            # Pyme en adelante
DIAS_TOPE = 5
MESES_PARA_USAR = 6
AVISO_HORAS = 48
COMPENSACIONES = [
    ('PAGO', 'Se pagan en dinero'),
    ('FERIADO', 'Se cambian por días libres'),
    ('MIXTO', 'Mitad en dinero y mitad en días libres'),
]
_FRACCION = {'FERIADO': 1.0, 'MIXTO': 0.5}
_CLAVES_DIA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']


def permite_compensacion(user):
    return _plan_permite(user, NIVEL_COMPENSACION)


def _horas(valor):
    """1.5 → '1,5'; 12.0 → '12'."""
    return f'{round(float(valor), 2):g}'.replace('.', ',')


def _fin_de_mes(anio, mes):
    return datetime.date(anio, mes, calendar.monthrange(anio, mes)[1])


def vencimiento(anio, mes):
    """Último día para usar las horas generadas en ese mes (seis meses siguientes)."""
    d = datetime.date(anio, mes, 1) + relativedelta(months=MESES_PARA_USAR)
    return _fin_de_mes(d.year, d.month)


# ── Jornada ──────────────────────────────────────────────────────────────────

def _dias_semana(contrato):
    por_dia = horas_por_dia(contrato.distribucion_horario)
    return len(por_dia) or int(contrato.distribucion_dias or 5)


def horas_dia_promedio(contrato):
    return float(contrato.horas_semanales or 0) / max(_dias_semana(contrato), 1)


def horas_del_dia(contrato, fecha):
    """Horas de jornada de ese día según el horario pactado (0 si no trabaja)."""
    if es_feriado_cl(fecha):
        return 0.0
    por_dia = horas_por_dia(contrato.distribucion_horario)
    if por_dia:
        return float(por_dia.get(_CLAVES_DIA[fecha.weekday()], 0))
    return horas_dia_promedio(contrato) if fecha.weekday() < _dias_semana(contrato) else 0.0


def tope_horas(contrato):
    """Horas de descanso que caben en 5 días de jornada."""
    return round(DIAS_TOPE * horas_dia_promedio(contrato), 2)


def _inicio_relacion(empleado, contrato):
    fechas = [f for f in (getattr(contrato, 'fecha_inicio', None), empleado.fecha_ingreso) if f]
    return min(fechas) if fechas else None


def anualidad(empleado, contrato, fecha):
    """(desde, hasta) del año de contrato que contiene la fecha."""
    inicio = _inicio_relacion(empleado, contrato)
    if not inicio or fecha < inicio:
        return fecha.replace(month=1, day=1), fecha.replace(month=12, day=31)
    anios = relativedelta(fecha, inicio).years
    desde = inicio + relativedelta(years=anios)
    return desde, desde + relativedelta(years=1) - datetime.timedelta(days=1)


# ── Pacto ────────────────────────────────────────────────────────────────────

def pacto_del_mes(empleado, mes, anio):
    """Pacto de horas extra firmado y vigente en el mes (el más reciente)."""
    desde = datetime.date(anio, mes, 1)
    hasta = _fin_de_mes(anio, mes)
    return (DocumentoLaboral.objects
            .filter(empleado=empleado, tipo='HORAS_EXTRA', activo=True, solicitudes_firma__estado='FIRMADO',
                    vigente_desde__lte=hasta)
            .exclude(vigente_hasta__lt=desde).distinct().order_by('-vigente_desde').first())


def compensacion_del_mes(empleado, mes, anio):
    pacto = pacto_del_mes(empleado, mes, anio)
    return (pacto.datos.get('compensacion') or 'PAGO') if pacto else 'PAGO'


# ── Bolsa ────────────────────────────────────────────────────────────────────

def _clave(anio, mes):
    return f'{anio}-{mes:02d}'


def _liquidaciones(empleado, excluir):
    qs = Liquidacion.objects.filter(empleado=empleado).order_by('anio', 'mes')
    if excluir:
        qs = qs.exclude(mes=excluir[1], anio=excluir[0])
    return qs


def bolsa(empleado, hasta=None, excluir=None):
    """Estado de las horas de descanso ganadas con horas extra.

    `excluir` = (anio, mes) de la liquidación que se está calculando, para no
    contarla dos veces al editarla. Devuelve los lotes por mes de origen con su
    saldo y los totales vigentes y vencidos a la fecha `hasta`.
    """
    hasta = hasta or timezone.localdate()
    lotes = OrderedDict()
    pagos = []
    for liq in _liquidaciones(empleado, excluir):
        generadas = sum(float(i.get('horas_feriado') or 0) for i in (liq.detalle_items or [])
                        if isinstance(i, dict) and i.get('naturaleza') == 'HORA_EXTRA')
        if generadas > 0:
            lotes[_clave(liq.anio, liq.mes)] = {
                'mes': liq.mes, 'anio': liq.anio, 'generadas': round(generadas, 2), 'usadas': 0.0, 'pagadas': 0.0,
                'vence': vencimiento(liq.anio, liq.mes)}
        for i in (liq.detalle_items or []):
            if isinstance(i, dict) and i.get('lotes_compensatorios'):
                pagos.append((_fin_de_mes(liq.anio, liq.mes), 'pago', i['lotes_compensatorios']))
    usos = VacacionEmpleado.objects.filter(empleado=empleado, tipo='DIA_COMPENSATORIO', estado='APROBADO') \
        .order_by('fecha_inicio', 'id')
    eventos = pagos + [(u.fecha_inicio, 'uso', float(u.horas_compensatorias or 0)) for u in usos]
    eventos.sort(key=lambda e: (e[0], e[1] == 'uso'))
    for fecha, tipo, dato in eventos:
        if tipo == 'pago':
            for clave, horas in dato.items():
                if clave in lotes:
                    lotes[clave]['pagadas'] += float(horas)
            continue
        restante = dato
        # Primero lo que estaba vigente ese día, del más antiguo al más nuevo.
        orden = [l for l in lotes.values() if l['vence'] >= fecha] + [l for l in lotes.values() if l['vence'] < fecha]
        for lote in orden:
            libre = lote['generadas'] - lote['usadas'] - lote['pagadas']
            if restante <= 0 or libre <= 0:
                continue
            tomado = min(libre, restante)
            lote['usadas'] += tomado
            restante -= tomado
    salida = []
    for clave, l in lotes.items():
        saldo = round(max(l['generadas'] - l['usadas'] - l['pagadas'], 0), 2)
        salida.append({**l, 'clave': clave, 'usadas': round(l['usadas'], 2), 'pagadas': round(l['pagadas'], 2),
                       'saldo': saldo, 'vencido': l['vence'] < hasta})
    disponibles = round(sum(l['saldo'] for l in salida if not l['vencido']), 2)
    vencidas = round(sum(l['saldo'] for l in salida if l['vencido']), 2)
    return {'lotes': salida, 'disponibles': disponibles, 'vencidas_sin_pagar': vencidas}


def generadas_en_anualidad(empleado, contrato, fecha, excluir=None):
    desde, hasta = anualidad(empleado, contrato, fecha)
    total = 0.0
    for liq in _liquidaciones(empleado, excluir):
        if desde <= _fin_de_mes(liq.anio, liq.mes) and datetime.date(liq.anio, liq.mes, 1) <= hasta:
            total += sum(float(i.get('horas_feriado') or 0) for i in (liq.detalle_items or [])
                         if isinstance(i, dict) and i.get('naturaleza') == 'HORA_EXTRA')
    return round(total, 2)


def resumen_empleado(empleado, contrato, hoy):
    """Lo que muestran la carpeta y el portal."""
    b = bolsa(empleado, hasta=hoy)
    promedio = horas_dia_promedio(contrato) if contrato else 0
    proximo = min((l for l in b['lotes'] if not l['vencido'] and l['saldo'] > 0), key=lambda l: l['vence'],
                  default=None)
    return {
        'horas_disponibles': b['disponibles'],
        'dias_aproximados': math.floor(b['disponibles'] / promedio) if promedio else 0,
        'horas_por_dia': round(promedio, 2),
        'proximo_vencimiento': proximo['vence'].isoformat() if proximo else None,
        'horas_por_vencer': proximo['saldo'] if proximo else 0,
        'tope_horas': tope_horas(contrato) if contrato else 0,
        'generadas_anualidad': generadas_en_anualidad(empleado, contrato, hoy) if contrato else 0,
        'compensacion_vigente': compensacion_del_mes(empleado, hoy.month, hoy.year),
    }


# ── Liquidación ──────────────────────────────────────────────────────────────

def aplicar_en_liquidacion(empleado, contrato, mes, anio, items, conceptos, valor_hora_ordinaria):
    """Ajusta las horas extra del mes según el pacto y agrega el pago de lo vencido.

    Modifica `items` en su lugar. Lo que exceda el tope anual se paga y queda
    anotado en el ítem (`exceso_tope`) para el aviso de la liquidación."""
    # Sin trabajador guardado (cálculos sueltos) no hay pacto ni bolsa que mirar.
    if not (mes and anio and contrato and isinstance(empleado, Empleado) and empleado.pk):
        return
    # El pago de horas vencidas se recalcula siempre: se quita el que venga del cliente.
    items[:] = [i for i in items if not i.get('lotes_compensatorios')]
    for i in items:
        for campo in ('horas_compensadas', 'horas_feriado', 'nota_compensacion', 'exceso_tope'):
            i.pop(campo, None)

    fin_mes = _fin_de_mes(anio, mes)
    fraccion = _FRACCION.get(compensacion_del_mes(empleado, mes, anio), 0)
    if fraccion:
        disponible = max(tope_horas(contrato) - generadas_en_anualidad(empleado, contrato, fin_mes, (anio, mes)), 0)
        for i in items:
            if i.get('naturaleza') != 'HORA_EXTRA' or 'horas' not in i or i.get('calculado'):
                continue
            horas = float(i.get('horas') or 0)
            factor = 1 + float(i.get('recargo') or 50) / 100
            a_compensar = round(horas * fraccion, 2)
            feriado = min(round(a_compensar * factor, 2), round(disponible, 2))
            compensadas = round(feriado / factor, 2)
            if a_compensar - compensadas > 0.01:
                i['exceso_tope'] = round(a_compensar - compensadas, 2)
            if compensadas <= 0:
                continue
            disponible -= feriado
            i['horas_compensadas'] = compensadas
            i['horas_feriado'] = feriado
            i['valor'] = math.floor(valor_hora_ordinaria * factor * (horas - compensadas) + 0.5)
            i['nota_compensacion'] = (f'{_horas(compensadas)} h compensadas con {_horas(feriado)} h de descanso '
                                      '(Art. 32)')

    # Horas de descanso que vencieron sin usarse: se pagan en este mes.
    b = bolsa(empleado, hasta=fin_mes + datetime.timedelta(days=1), excluir=(anio, mes))
    vencidos = {l['clave']: l['saldo'] for l in b['lotes'] if l['vencido'] and l['saldo'] > 0}
    if vencidos:
        concepto = ConceptoRemuneracion.objects.filter(empresa__isnull=True, codigo='HORA_EXTRA_50').first()
        total = round(sum(vencidos.values()), 2)
        if concepto is not None:
            conceptos[concepto.id] = concepto
        items.append({
            'concepto': concepto.id if concepto else None, 'naturaleza': 'HORA_EXTRA', 'calculado': True,
            'glosa': 'Horas de descanso no usadas', 'lotes_compensatorios': vencidos,
            'horas_feriado_pagadas': total, 'valor': math.floor(valor_hora_ordinaria * total + 0.5),
            'nota_compensacion': f'{_horas(total)} h de descanso vencidas (Art. 32)',
        })


def pago_en_finiquito(empleado, contrato, fecha_termino, valor_hora_ordinaria):
    """Horas de descanso pendientes al término: se pagan con el feriado (Art. 73)."""
    b = bolsa(empleado, hasta=fecha_termino + datetime.timedelta(days=1))
    horas = round(b['disponibles'] + b['vencidas_sin_pagar'], 2)
    return horas, math.floor(valor_hora_ordinaria * horas + 0.5) if horas > 0 else 0


# ── Día compensatorio ────────────────────────────────────────────────────────

def horas_de_uso(contrato, inicio, fin):
    """Horas que descuenta un día (o varios) compensatorios: la jornada de cada día."""
    total, d = 0.0, inicio
    while d <= fin:
        total += horas_del_dia(contrato, d)
        d += datetime.timedelta(days=1)
    return round(total, 2)
