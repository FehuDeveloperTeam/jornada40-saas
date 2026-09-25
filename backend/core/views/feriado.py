"""Feriados legales, días hábiles y saldo de vacaciones (Arts. 67 a 70)."""
from django.utils import timezone
from ..models import VacacionEmpleado
import datetime
import functools
import holidays as holidays_cl
from dateutil.relativedelta import relativedelta
from django.db.models import Sum


# ==========================================
# UTILIDADES DE VACACIONES (Art. 67-68 Código del Trabajo)
# ==========================================

# Feriados legales de Chile, incluidos los móviles (Semana Santa, Pueblos
# Indígenas) y los que la ley traslada a lunes. La lista fija que había antes
# omitía Viernes y Sábado Santo y el 20/21 de junio.
@functools.lru_cache(maxsize=32)
def _feriados_cl(anio: int) -> frozenset:
    return frozenset(holidays_cl.Chile(years=anio).keys())


def es_feriado_cl(fecha) -> bool:
    return fecha in _feriados_cl(fecha.year)


def _contar_domingos_y_festivos(mes: int, anio: int) -> int:
    """Cuenta los domingos y feriados dentro de un mes calendario.

    Usado para la semana corrida (Art. 45 Código del Trabajo): un domingo
    que coincide con un feriado se cuenta una sola vez.
    """
    import calendar
    _, ultimo_dia = calendar.monthrange(anio, mes)
    dias = 0
    for dia in range(1, ultimo_dia + 1):
        fecha = datetime.date(anio, mes, dia)
        if fecha.weekday() == 6 or es_feriado_cl(fecha):
            dias += 1
    return dias


def _es_dia_habil_feriado(fecha) -> bool:
    """Día hábil para el feriado anual: lunes a viernes que no sea feriado.

    Art. 69 del Código del Trabajo: "para los efectos del feriado, el día
    sábado se considerará siempre inhábil".
    """
    return fecha.weekday() < 5 and not es_feriado_cl(fecha)


def _calcular_dias_habiles_vacacion(fecha_inicio, fecha_fin) -> int:
    """Días hábiles de feriado entre fecha_inicio y fecha_fin (inclusive)."""
    dias = 0
    current = fecha_inicio
    delta_un_dia = datetime.timedelta(days=1)
    while current <= fecha_fin:
        if _es_dia_habil_feriado(current):
            dias += 1
        current += delta_un_dia
    return dias


def calcular_saldo_vacaciones(empleado, hasta=None) -> dict:
    """Saldo de vacaciones legales de un empleado (Art. 67-68 Código del Trabajo).

    Retorna:
        anos_servicio       — años completos desde fecha_ingreso
        dias_base           — 15 días × años_servicio
        dias_progresivos    — 1 día extra por cada 3 años sobre 10 (Art. 68)
        dias_devengados     — días_base + días_progresivos
        dias_usados         — suma de días_hábiles de registros APROBADO
        dias_disponibles    — devengados − usados (mínimo 0)
    """
    hoy = hasta or timezone.localdate()
    anos_servicio = relativedelta(hoy, empleado.fecha_ingreso).years if empleado.fecha_ingreso <= hoy else 0

    dias_base = 15 * anos_servicio

    # Feriado progresivo (Art. 68): con 10 años de trabajo (hasta 10 con
    # empleadores anteriores, acreditados) se gana un día más por cada 3
    # nuevos años. Se acumula año a año: cada período anual trae los días
    # progresivos que correspondían en ese aniversario.
    dias_progresivos = sum(_dias_progresivos_del_anio(empleado, k) for k in range(1, anos_servicio + 1))

    dias_devengados = dias_base + dias_progresivos

    dias_usados = (
        VacacionEmpleado.objects
        .filter(
            empleado=empleado,
            estado='APROBADO',
            tipo__in=['VACACION_LEGAL', 'VACACION_PROGRESIVA'],
        )
        .aggregate(total=Sum('dias_habiles'))['total'] or 0
    )

    disponibles = max(0, dias_devengados - int(dias_usados))
    return {
        'anos_servicio':    anos_servicio,
        'dias_base':        dias_base,
        'dias_progresivos': dias_progresivos,
        'dias_devengados':  dias_devengados,
        'dias_usados':      int(dias_usados),
        'dias_disponibles': disponibles,
        'dias_progresivos_anuales': _dias_progresivos_del_anio(empleado, anos_servicio),
        'anios_previos_feriado': int(empleado.anios_previos_feriado or 0),
        **_aviso_acumulacion_feriado(empleado, anos_servicio,
                                     15 + _dias_progresivos_del_anio(empleado, anos_servicio), disponibles),
    }


def _dias_progresivos_del_anio(empleado, anio_servicio: int) -> int:
    """Días progresivos del período que se cumple en el aniversario N° anio_servicio.

    Años de trabajo = años previos acreditados (máx. 10) + años con esta empresa.
    Desde los 10, un día adicional por cada 3 años nuevos: 13 → 1, 16 → 2...
    """
    if anio_servicio < 1:
        return 0
    total = min(int(getattr(empleado, 'anios_previos_feriado', 0) or 0), 10) + anio_servicio
    return max(0, (total - 10) // 3)


def _aviso_acumulacion_feriado(empleado, anos_servicio, dias_por_periodo, disponibles) -> dict:
    """Aviso del Art. 70: el feriado se acumula hasta dos períodos.

    Con dos períodos pendientes, el empleador debe otorgar al menos el
    primero antes de que se cumpla el año que da derecho a un tercero. Solo
    avisa: los días pendientes no se pierden ni se descuentan del saldo.
    """
    if not dias_por_periodo or disponibles < 2 * dias_por_periodo:
        return {}
    proximo = empleado.fecha_ingreso + relativedelta(years=anos_servicio + 1)
    if disponibles > 2 * dias_por_periodo:
        texto = (f'Tiene {disponibles} días hábiles de feriado pendientes: más de dos períodos. '
                 f'El Art. 70 permite acumular hasta dos; otórgale feriado cuanto antes. '
                 f'Los días pendientes no se pierden.')
    else:
        texto = (f'Tiene dos períodos de feriado acumulados ({disponibles} días hábiles). Según el '
                 f'Art. 70 debe tomar al menos el primero antes del {proximo:%d-%m-%Y}, cuando '
                 f'cumple un nuevo año de servicio.')
    return {'periodos_acumulados': round(disponibles / dias_por_periodo, 1), 'aviso_acumulacion': texto}
