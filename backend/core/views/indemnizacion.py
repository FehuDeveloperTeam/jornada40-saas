"""Indemnización a todo evento (Arts. 164 a 169 del Código del Trabajo).

Con el pacto firmado, desde el mes pactado el empleador aporta cada mes el
porcentaje acordado (mínimo 4,11 %) de la remuneración imponible, con tope de
90 UF, a la cuenta de indemnización del trabajador en su AFP. El aporte cubre
el lapso posterior a los primeros seis años y hasta el término del undécimo
año de la relación; no es remuneración (no se descuenta del trabajador) y el
trabajador lo retira al término, cualquiera sea la causa. Por ese lapso ya no
corresponde indemnización por años de servicio en el finiquito.
"""
import datetime
import math
from decimal import Decimal

from dateutil.relativedelta import relativedelta

from ..models import DocumentoLaboral

TOPE_UF = 90
ANIOS_CUBIERTOS_HASTA = 11


def pacto_firmado(empleado):
    return (DocumentoLaboral.objects
            .filter(empleado=empleado, tipo='INDEMNIZACION', activo=True, solicitudes_firma__estado='FIRMADO')
            .distinct().order_by('vigente_desde').first())


def fin_de_cobertura(empleado):
    """Último día cubierto por el aporte: término del undécimo año de la relación."""
    ingreso = empleado.fecha_ingreso
    if not ingreso:
        return None
    if isinstance(ingreso, str):
        ingreso = datetime.date.fromisoformat(ingreso)
    return ingreso + relativedelta(years=ANIOS_CUBIERTOS_HASTA) - datetime.timedelta(days=1)


def aporte_del_mes(empleado, mes, anio, total_imponible, valor_uf):
    """(tasa, aporte) del mes; (0, 0) sin pacto firmado vigente."""
    if not (mes and anio) or not getattr(empleado, 'pk', None):
        return Decimal('0'), 0
    pacto = pacto_firmado(empleado)
    if pacto is None:
        return Decimal('0'), 0
    inicio_mes = datetime.date(int(anio), int(mes), 1)
    fin = fin_de_cobertura(empleado)
    if inicio_mes < pacto.vigente_desde.replace(day=1) or (fin and inicio_mes > fin):
        return Decimal('0'), 0
    tasa = Decimal(str(pacto.datos.get('porcentaje') or '0'))
    base = min(int(total_imponible or 0), math.floor(TOPE_UF * float(valor_uf or 0)))
    return tasa, math.floor(base * float(tasa) / 100)


def anios_antes_del_pacto(empleado, fecha_termino):
    """Fecha hasta la que se cuentan los años para la indemnización por años de servicio:
    el día anterior al inicio del aporte si hay pacto firmado; si no, la del término."""
    pacto = pacto_firmado(empleado)
    if pacto is None or pacto.vigente_desde > fecha_termino:
        return fecha_termino, None
    return pacto.vigente_desde - datetime.timedelta(days=1), pacto
