"""Archivo Previred: formato estándar de largo variable, 105 campos."""
from ..models import Finiquito, ConceptoRemuneracion
import datetime
import math
from decimal import Decimal
from ..indicadores import obtener_uf
from dateutil.relativedelta import relativedelta

from .parametros import _anios_de_servicio, _parametros_previsionales, _tasas_afc, _tope_en_pesos


# ==========================================
# PREVIRED EXPORT
# ==========================================

# Formato estándar de largo variable por separador de Previred, versión 100
# (septiembre 2026): 105 campos separados por ";". Los números van sin
# relleno; un campo que no aplica va en 0 si es numérico y vacío si es texto.
# Las tablas llevan el número de la tabla de equivalencia del documento.

_AFP_CODIGOS_PREVIRED = {   # Tabla 10
    'CUPRUM': '03', 'HABITAT': '05', 'PROVIDA': '08', 'PLANVITAL': '29',
    'CAPITAL': '33', 'MODELO': '34', 'UNO': '35',
}
_JORNADA_PARCIAL_PREVIRED = {'PARCIAL'}   # Tabla 22: 1 completa, 2 parcial
_FONASA_PREVIRED = '07'                  # Tabla 16
# Con caja de compensación, el 7 % de Fonasa se reparte: 0,6 % a la caja
# (campo 90) y el resto a Fonasa (campo 70).
_TASA_CCAF_NO_ISAPRE = Decimal('0.006')
_CODIGOS_ASIGNACION_FAMILIAR = {'ASIGNACION_FAMILIAR'}


def _rut_partes(rut_str: str):
    """Devuelve (numero_str, dv_str) desde un RUT como '12.345.678-9'."""
    limpio = (rut_str or '').replace('.', '').replace(' ', '').upper()
    if '-' in limpio:
        num, dv = limpio.rsplit('-', 1)
    elif len(limpio) > 1:
        num, dv = limpio[:-1], limpio[-1]
    else:
        return '0', '0'
    return num.lstrip('0') or '0', dv


def _texto_previred(texto, largo=30) -> str:
    """Mayúsculas sin tildes (la Ñ se mantiene), sin ';' y cortado al largo del campo."""
    import unicodedata
    salida = []
    for c in (texto or '').strip().upper():
        if c == 'Ñ':
            salida.append(c)
            continue
        salida.append(''.join(x for x in unicodedata.normalize('NFD', c) if unicodedata.category(x) != 'Mn'))
    return ''.join(salida).replace(';', ' ')[:largo].strip()


def _fecha_previred(fecha) -> str:
    return fecha.strftime('%d-%m-%Y') if fecha else ''


def _tasa_previred(tasa) -> str:
    """Tasa en formato 99,99 (porcentaje con coma): 0,0093 → '00,93'."""
    return f'{float(tasa) * 100:05.2f}'.replace('.', ',')


def _tasa_accidentes(empresa, parametros) -> float:
    if empresa.tasa_accidentes is not None:
        return float(empresa.tasa_accidentes)
    return float(parametros['tasa_mutual_base'])


def _movimiento_previred(liq, contrato):
    """(código, fecha desde, fecha hasta) del movimiento de personal del mes (tabla 7)."""
    emp = liq.empleado
    inicio = datetime.date(liq.anio, liq.mes, 1)
    fin = inicio + relativedelta(months=1) - datetime.timedelta(days=1)
    termino = Finiquito.objects.filter(empleado=emp, fecha_termino__range=(inicio, fin)).order_by('-fecha_termino').first()
    if termino:
        return '2', '', _fecha_previred(termino.fecha_termino)
    if emp.fecha_ingreso and inicio <= emp.fecha_ingreso <= fin:
        codigo = '1' if not contrato or contrato.tipo_contrato == 'INDEFINIDO' else '7'
        return codigo, _fecha_previred(emp.fecha_ingreso), ''
    return '0', '', ''


def _linea_previred(liq):
    """Los 105 campos de la línea principal de un trabajador, y los datos que faltan."""
    emp = liq.empleado
    empresa = emp.empresa
    contrato = getattr(emp, 'contrato_activo', None)
    par = _parametros_previsionales(liq.mes, liq.anio)
    faltan = []

    uf = float(liq.valor_uf) or obtener_uf()
    imponible = int(liq.total_imponible or 0)
    renta = min(imponible, _tope_en_pesos(par['tope_imponible_afp_uf'], uf))
    renta_afc = min(imponible, _tope_en_pesos(par['tope_imponible_afc_uf'], uf))
    dias = max(0, min(30, int(liq.dias_trabajados or 0)))

    sexo = (emp.sexo or '').upper()
    if sexo not in ('M', 'F'):
        faltan.append('sexo (Previred solo acepta masculino o femenino)')
    if not (emp.apellido_paterno or '').strip() or not (emp.nombres or '').strip():
        faltan.append('nombres y apellido paterno')
    nacionalidad = '0' if (emp.nacionalidad or 'Chilena').strip().lower().startswith('chilen') else '1'

    cod_afp = _AFP_CODIGOS_PREVIRED.get((liq.afp_nombre or emp.afp or '').upper(), '')
    if not cod_afp:
        faltan.append('AFP (el archivo solo informa trabajadores en AFP)')

    movimiento, desde, hasta = _movimiento_previred(liq, contrato)
    if dias == 0 and movimiento == '0':
        faltan.append('0 días trabajados sin movimiento de personal (licencia o permiso): infórmalo directo en Previred')

    # Asignación familiar: el monto lo paga el empleador en la liquidación y lo
    # recupera descontándolo de la caja (campo 91) o del IPS (campo 73).
    cargas = (emp.cargas_simples or 0) + (emp.cargas_maternales or 0) + (emp.cargas_invalidas or 0)
    codigos = dict(ConceptoRemuneracion.objects.filter(
        id__in={i.get('concepto') for i in liq.detalle_items or [] if i.get('concepto')}).values_list('id', 'codigo'))
    asignacion = sum(int(i.get('valor') or 0) for i in liq.detalle_items or []
                     if codigos.get(i.get('concepto')) in _CODIGOS_ASIGNACION_FAMILIAR)
    tramo = emp.tramo_asignacion_familiar or 'D'
    if asignacion and (tramo == 'D' or not cargas):
        faltan.append('tramo y cargas de asignación familiar (la liquidación paga asignación familiar)')
    if tramo == 'D':
        asignacion = 0

    # Salud
    es_isapre = (emp.sistema_salud or '').upper() == 'ISAPRE'
    siete = math.floor(renta * par['tasa_salud'])
    if es_isapre and not emp.isapre:
        faltan.append('Isapre (elige la institución en Previsión y pago)')
    con_ccaf = empresa.ccaf and empresa.ccaf != '00'
    fonasa_ccaf = math.floor(renta * float(_TASA_CCAF_NO_ISAPRE)) if (not es_isapre and con_ccaf) else 0

    con_mutual = empresa.mutual and empresa.mutual != '00'
    accidentes = math.floor(renta * _tasa_accidentes(empresa, par))

    # Seguro de cesantía (el trabajador desde el año 11 del indefinido ya no cotiza)
    tipo_contrato = contrato.tipo_contrato if contrato else 'INDEFINIDO'
    afc_trab = int(liq.seguro_cesantia or 0)
    _, tasa_afc_emp = _tasas_afc(par, tipo_contrato, _anios_de_servicio(emp, contrato, liq.mes, liq.anio))
    afc_emp = math.floor(renta_afc * tasa_afc_emp)

    c = [''] * 105
    def poner(n, valor):   # n: número de campo del documento (1 a 105)
        c[n - 1] = str(valor)

    rut, dv = _rut_partes(emp.rut)
    poner(1, rut); poner(2, dv)
    poner(3, _texto_previred(emp.apellido_paterno)); poner(4, _texto_previred(emp.apellido_materno))
    poner(5, _texto_previred(emp.nombres)); poner(6, sexo); poner(7, nacionalidad)
    poner(8, '01')                                     # remuneraciones del mes (tabla 3)
    periodo = f'{liq.mes:02d}{liq.anio}'
    poner(9, periodo); poner(10, periodo)
    poner(11, 'AFP'); poner(12, '0')                   # activo, no pensionado (tabla 5)
    poner(13, dias); poner(14, '00')                   # línea principal (tabla 6)
    poner(15, movimiento); poner(16, desde); poner(17, hasta)
    poner(18, tramo); poner(19, emp.cargas_simples or 0); poner(20, emp.cargas_maternales or 0)
    poner(21, emp.cargas_invalidas or 0); poner(22, asignacion); poner(23, 0); poner(24, 0); poner(25, '')
    # AFP. La cotización obligatoria incluye el 0,1 % de cargo del empleador (reforma).
    poner(26, cod_afp); poner(27, renta)
    poner(28, int(liq.afp_monto or 0) + math.floor(renta * par['tasa_afp_empleador']))
    poner(29, math.floor(renta * par['tasa_sis']))
    for n in (30, 31, 33, 34, 39):
        poner(n, 0)
    poner(32, '00,00'); poner(38, '00,00')             # 35, 36 y 37 quedan vacíos
    # APVI, APVC y afiliado voluntario: no se informan.
    poner(40, '000'); poner(42, 0); poner(43, 0); poner(44, 0)
    poner(45, '000'); poner(47, 0); poner(48, 0); poner(49, 0)
    poner(50, 0); poner(55, 0); poner(58, 0); poner(59, 0); poner(60, 0); poner(61, 0)
    # IPS / ISL / Fonasa
    poner(62, '0000'); poner(63, '00,00')
    poner(64, 0)   # se completa al final: depende de los campos 70, 71 y 73
    poner(65, 0); poner(66, 0); poner(67, '0000'); poner(68, '00,00'); poner(69, 0)
    poner(70, 0 if es_isapre else siete - fonasa_ccaf)
    poner(71, 0 if con_mutual else accidentes)
    poner(72, 0); poner(73, 0 if con_ccaf else asignacion); poner(74, 0)
    # Salud
    if es_isapre:
        plan_uf = float(liq.isapre_cotizacion_uf or 0)
        poner(75, emp.isapre); poner(76, _texto_previred(emp.numero_fun, 16)); poner(77, renta)
        poner(78, '2' if plan_uf > 0 else '1')
        poner(79, f'{plan_uf:.2f}'.replace('.', ',') if plan_uf > 0 else siete)
        poner(80, siete); poner(81, max(int(liq.salud_monto or 0) - siete, 0))
    else:
        poner(75, _FONASA_PREVIRED); poner(77, 0); poner(78, '1'); poner(79, 0); poner(80, 0); poner(81, 0)
    poner(82, 0)
    # Caja de compensación
    poner(83, empresa.ccaf if con_ccaf else '00'); poner(84, renta if con_ccaf else 0)
    for n in (85, 86, 87, 88, 89):
        poner(n, 0)
    poner(90, fonasa_ccaf); poner(91, asignacion if con_ccaf else 0)
    poner(92, 0)
    tipo_jornada = contrato.tipo_jornada if contrato else 'ORDINARIA'
    poner(93, '2' if tipo_jornada in _JORNADA_PARCIAL_PREVIRED else '1')
    poner(94, math.floor(renta * par['tasa_expectativa_vida']))
    poner(95, math.floor(renta * par['tasa_rentabilidad_protegida']))
    # Mutual
    poner(96, empresa.mutual if con_mutual else '00'); poner(97, renta if con_mutual else 0)
    poner(98, accidentes if con_mutual else 0); poner(99, (empresa.sucursal_mutual or '0') if con_mutual else '0')
    # Seguro de cesantía (renta de un mes completo, con su tope)
    poner(100, renta_afc); poner(101, afc_trab); poner(102, afc_emp)
    poner(103, 0); poner(104, ''); poner(105, _texto_previred(emp.centro_costo, 20) if emp.centro_costo else '')
    # Renta IPS/ISL/Fonasa: obligatoria si hay cotización a Fonasa, al ISL o
    # descuento de cargas al IPS; para régimen AFP va con el tope AFP.
    if any(int(c[n - 1]) > 0 for n in (70, 71, 73)):
        poner(64, renta)
    return c, faltan
