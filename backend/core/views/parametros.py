"""Parámetros previsionales versionados por período e indicadores del día."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import ParametroPrevisional, TasaAFP, TramoAsignacionFamiliar
from django.utils import timezone
import datetime
import math
from decimal import Decimal, ROUND_FLOOR
from ..indicadores import obtener_uf, obtener_utm
from ..jornada import jornada_maxima_vigente


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def indicadores_del_dia(request):
    """UF, UTM y jornada máxima vigente para el encabezado del panel.

    `respaldo` avisa si mindicador.cl no respondió y se usan los valores de
    respaldo del código.
    """
    from ..indicadores import estado_indicadores
    return Response({
        'fecha': timezone.localdate().isoformat(),
        'uf': obtener_uf(),
        'utm': obtener_utm(),
        'jornada_maxima_vigente': jornada_maxima_vigente(),
        'respaldo': bool(estado_indicadores()),
    })


def ingreso_minimo_vigente() -> int:
    """Ingreso mínimo mensual del período en curso (para los avisos de sueldo)."""
    hoy = timezone.localdate()
    return int(_parametros_previsionales(hoy.month, hoy.year)['ingreso_minimo_mensual'])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def parametros_vigentes(request):
    """Parámetros previsionales con que se calcula hoy, solo lectura.

    Son comunes a todos los clientes: los mantiene Jornada40 en el admin y no
    se confirman ni se editan desde el panel.
    """
    hoy = timezone.localdate()
    fila = _fila_parametros(_fecha_referencia(hoy.month, hoy.year))
    p = _parametros_previsionales(hoy.month, hoy.year)
    return Response({
        'periodo': f'{hoy.year}-{hoy.month:02d}',
        'vigente_desde': fila.vigente_desde.isoformat() if fila else None,
        'origen': fila.get_origen_display() if fila else 'Valores de respaldo del sistema',
        'ingreso_minimo_mensual': int(p['ingreso_minimo_mensual']),
        'tope_imponible_afp_uf': p['tope_imponible_afp_uf'],
        'tope_imponible_afc_uf': p['tope_imponible_afc_uf'],
        'tope_gratificacion_mensual': math.floor(p['factor_gratificacion'] * p['ingreso_minimo_mensual'] / 12),
        'tasa_salud': p['tasa_salud'],
        'tasa_afc_trabajador_indefinido': p['tasa_afc_trabajador_indefinido'],
        'tasa_afc_empleador_indefinido': p['tasa_afc_empleador_indefinido'],
        'tasa_afc_empleador_plazo': p['tasa_afc_empleador_plazo'],
        'tasa_sis': p['tasa_sis'],
        'tasas_afp': _tasas_afp(hoy.month, hoy.year),
        'uf': obtener_uf(),
        'utm': obtener_utm(),
        'jornada_maxima_vigente': jornada_maxima_vigente(),
        'advertencias': advertencias_parametros(hoy.month, hoy.year),
        'asignacion_familiar': [{'tramo': t, 'monto': m, 'renta_hasta': h}
                                for t, (m, h) in sorted((tramos_asignacion_familiar(hoy.month, hoy.year) or {}).items())],
    })


# Respaldo si la tabla de parámetros está vacía (BD recién creada, antes del
# seed). Se mantienen al día con el último período cargado en migraciones: son
# lo que se aplica cuando todavía no hay filas, y quedarse atrás aquí produce
# liquidaciones con topes viejos sin que nada lo advierta.
_PARAMETROS_RESPALDO = {
    'tope_imponible_afp_uf': 90.00,
    'tope_imponible_afc_uf': 135.20,
    'ingreso_minimo_mensual': 553553,
    'factor_gratificacion': 4.75,
    'tasa_salud': 0.07,
    'tasa_afc_trabajador_indefinido': 0.006,
    'tasa_afc_empleador_indefinido': 0.024,
    'tasa_afc_empleador_plazo': 0.030,
    'tasa_sis': 0.0178,
    'tasa_mutual_base': 0.0093,
    'tasa_expectativa_vida': 0.0072,
    'tasa_rentabilidad_protegida': 0.009,
    'tasa_afp_empleador': 0.001,
    'tasa_afc_empleador_11_anios': 0.008,
}

_TASAS_AFP_RESPALDO = {
    'MODELO': 0.1058, 'HABITAT': 0.1127, 'PROVIDA': 0.1145,
    'CAPITAL': 0.1144, 'CUPRUM': 0.1144, 'PLANVITAL': 0.1116, 'UNO': 0.1046,
}


# Ley 19.728: desde el año 11 de un contrato indefinido el trabajador deja de
# cotizar al seguro de cesantía y el empleador paga una tasa menor.
_ANIOS_AFC_REDUCIDA = 11


def _anios_de_servicio(empleado, contrato, mes, anio) -> int:
    """Años completos de la relación laboral al último día del mes liquidado."""
    inicio = getattr(empleado, 'fecha_ingreso', None) or getattr(contrato, 'fecha_inicio', None)
    if not inicio:
        return 0
    if isinstance(inicio, str):
        inicio = datetime.date.fromisoformat(inicio)
    try:
        mes, anio = int(mes), int(anio)
    except (TypeError, ValueError):
        fin = timezone.localdate()
    else:
        fin = datetime.date(anio + (mes == 12), mes % 12 + 1, 1) - datetime.timedelta(days=1)
    return fin.year - inicio.year - ((fin.month, fin.day) < (inicio.month, inicio.day))


def _tasas_afc(parametros, tipo_contrato, anios_servicio) -> tuple:
    """(tasa trabajador, tasa empleador) del seguro de cesantía."""
    if tipo_contrato == 'INDEFINIDO':
        if anios_servicio >= _ANIOS_AFC_REDUCIDA:
            return 0.0, parametros['tasa_afc_empleador_11_anios']
        return parametros['tasa_afc_trabajador_indefinido'], parametros['tasa_afc_empleador_indefinido']
    return 0.0, parametros['tasa_afc_empleador_plazo']


def _tope_en_pesos(tope_uf, valor_uf) -> int:
    """Tope imponible del período llevado a pesos.

    Multiplicar dos floats y truncar pierde un peso cuando el producto cae
    apenas por debajo del entero: 90 × 41.057,20 da 3.695.147,999... en punto
    flotante y el tope quedaría en $3.695.147, uno menos que los $3.695.148 que
    publica Previred. Con Decimal el producto es exacto y el truncado coincide.
    """
    producto = Decimal(str(tope_uf)) * Decimal(str(valor_uf))
    return int(producto.to_integral_value(rounding=ROUND_FLOOR))


def _fecha_referencia(mes, anio) -> datetime.date:
    """Primer día del período liquidado; hoy si no viene informado."""
    try:
        return datetime.date(int(anio), int(mes), 1)
    except (TypeError, ValueError):
        return timezone.localdate()


def _parametros_previsionales(mes=None, anio=None) -> dict:
    """Parámetros legales que regían en el período de la liquidación.

    Resolver por período (y no por la fecha de hoy) es lo que permite que
    recalcular una liquidación antigua use los topes y el sueldo mínimo de su
    momento. Si no hay una fila anterior al período se usa la más antigua
    disponible, que es la mejor aproximación para liquidaciones previas.
    """
    fila = _fila_parametros(_fecha_referencia(mes, anio))
    if fila is None:
        return dict(_PARAMETROS_RESPALDO)

    return {campo: float(getattr(fila, campo)) for campo in _PARAMETROS_RESPALDO}


def _fila_parametros(referencia):
    """Fila de parámetros aplicable a una fecha, o None si no hay ninguna.

    Las propuestas automáticas sin confirmar quedan fuera: existen para que
    alguien las revise, no para cambiar liquidaciones por su cuenta.
    """
    aplicables = ParametroPrevisional.objects.exclude(origen='PREVIRED', confirmado=False)
    fila = (aplicables.filter(vigente_desde__lte=referencia)
            .order_by('-vigente_desde').first())
    if fila is None:
        fila = aplicables.order_by('vigente_desde').first()
    return fila


# Los topes imponibles y el sueldo mínimo se reajustan al menos una vez al año.
# Pasado este margen, seguir calculando con los mismos valores es sospechoso.
_MESES_VIGENCIA_ESPERADA = 14


def advertencias_parametros(mes=None, anio=None) -> list:
    """Motivos por los que los parámetros aplicados podrían no ser fiables.

    Se evalúa contra el período liquidado, no contra hoy: liquidar marzo de
    2025 con los parámetros de enero de 2025 es correcto.
    """
    referencia = _fecha_referencia(mes, anio)
    fila = _fila_parametros(referencia)

    if fila is None:
        return ['No hay parámetros previsionales cargados: se está calculando '
                'con los valores de respaldo del código.']

    advertencias = []
    if not fila.confirmado:
        advertencias.append(
            f'Los parámetros vigentes desde {fila.vigente_desde} no han sido '
            f'confirmados contra fuente oficial.')

    meses = (referencia - fila.vigente_desde).days / 30.0
    if meses > _MESES_VIGENCIA_ESPERADA:
        advertencias.append(
            f'Para el período {referencia:%m/%Y} se están aplicando los '
            f'parámetros de {fila.vigente_desde}, de {int(meses)} meses de '
            f'antigüedad. Los topes se reajustan cada enero.')

    return advertencias


def _tasas_afp(mes=None, anio=None) -> dict:
    """Tasa de cada AFP vigente en el período liquidado."""
    referencia = _fecha_referencia(mes, anio)
    aplicables = TasaAFP.objects.exclude(origen='PREVIRED', confirmado=False)
    filas = aplicables.filter(vigente_desde__lte=referencia).order_by('vigente_desde')
    if not filas.exists():
        filas = aplicables.order_by('vigente_desde')

    # Recorrido ascendente: la vigencia más reciente sobrescribe a la anterior.
    tasas = {}
    for fila in filas:
        tasas[fila.nombre.upper()] = float(fila.tasa)
    return tasas or dict(_TASAS_AFP_RESPALDO)


# ==========================================
# ASIGNACIÓN FAMILIAR (DFL 150 de 1981, Ley 18.987)
# ==========================================
# Se paga completa si el trabajador tuvo remuneración imponible por 25 días o
# más en el mes; si no, en proporción a esos días sobre 30 (DT, consulta
# "asignación familiar y jornada parcial"). Durante una licencia médica la
# paga igual el empleador (SUSESO): los días de subsidio cuentan.
_DIAS_ASIGNACION_COMPLETA = 25


def tramos_asignacion_familiar(mes=None, anio=None):
    """{'A': (monto, renta_hasta), 'B': …, 'C': …} vigentes en el período, o
    None si no hay tabla cargada para esa fecha (entonces no se calcula)."""
    referencia = _fecha_referencia(mes, anio)
    ultima = (TramoAsignacionFamiliar.objects.filter(vigente_desde__lte=referencia)
              .order_by('-vigente_desde').values_list('vigente_desde', flat=True).first())
    if ultima is None:
        return None
    return {t.tramo: (t.monto, t.renta_hasta) for t in TramoAsignacionFamiliar.objects.filter(vigente_desde=ultima)}


def asignacion_familiar(empleado, mes, anio, dias_con_remuneracion):
    """(monto, detalle) de la asignación familiar del mes, o None si no hay
    tabla para el período. El tramo lo informa el IPS y queda en la ficha."""
    tramos = tramos_asignacion_familiar(mes, anio)
    if tramos is None:
        return None
    tramo = getattr(empleado, 'tramo_asignacion_familiar', 'D') or 'D'
    simples = int(getattr(empleado, 'cargas_simples', 0) or 0)
    maternales = int(getattr(empleado, 'cargas_maternales', 0) or 0)
    invalidas = int(getattr(empleado, 'cargas_invalidas', 0) or 0)
    if tramo not in tramos or not (simples + maternales + invalidas):
        return 0, None
    monto_carga = tramos[tramo][0]
    # Las cargas por invalidez reciben el doble (el "duplo" de la tabla SUSESO).
    completo = monto_carga * (simples + maternales + 2 * invalidas)
    dias = max(0, min(30, int(dias_con_remuneracion)))
    monto = completo if dias >= _DIAS_ASIGNACION_COMPLETA else math.floor(completo * dias / 30)
    return monto, {'tramo': tramo, 'monto_carga': monto_carga, 'cargas': simples + maternales,
                   'cargas_invalidez': invalidas, 'dias': dias}
