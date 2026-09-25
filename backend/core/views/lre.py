"""Libro de Remuneraciones Electrónico (LRE): archivo mensual para Mi DT.

Una fila por liquidación del período, con las 147 columnas de la plantilla
oficial (`core/datos/lre_plantilla.csv`). Los montos salen de la liquidación
ya emitida; los aportes del empleador se calculan igual que en el archivo
Previred, para que ambos cuadren.

Reforma de pensiones (Ley 21.735): la DT no publicó conceptos nuevos. Como el
software del mercado, el 0,1 % del empleador a la cuenta individual va en
4157 y lo que va al Seguro Social (SIS, expectativa de vida y rentabilidad
protegida) en 4155.
"""
import calendar
import datetime
import math

from .. import lre
from ..indicadores import obtener_uf
from ..models import ConceptoRemuneracion, Contrato, Empleado, Finiquito, Liquidacion, VacacionEmpleado
from ..rut import formatear_rut, validar_rut
from .feriado import _es_dia_habil_feriado
from .parametros import _anios_de_servicio, _parametros_previsionales, _tasas_afc, _tope_en_pesos
from .previred import _tasa_accidentes

_CODIGOS_PLANTILLA = None


def _codigos_plantilla():
    global _CODIGOS_PLANTILLA
    if _CODIGOS_PLANTILLA is None:
        _CODIGOS_PLANTILLA = {codigo for _, codigo in lre.columnas()}
    return _CODIGOS_PLANTILLA


def _nombre(emp):
    return f'{emp.nombres} {emp.apellido_paterno}'.strip()


def _dias_vacaciones(emp, mes, anio):
    """Días hábiles de feriado aprobado dentro del mes (concepto 1117)."""
    inicio = datetime.date(anio, mes, 1)
    fin = datetime.date(anio, mes, calendar.monthrange(anio, mes)[1])
    dias = 0
    for v in VacacionEmpleado.objects.filter(empleado=emp, estado='APROBADO', fecha_inicio__lte=fin,
                                             fecha_fin__gte=inicio).exclude(tipo='PERMISO_SIN_GOCE'):
        dia = max(v.fecha_inicio, inicio)
        while dia <= min(v.fecha_fin, fin):
            dias += _es_dia_habil_feriado(dia)
            dia += datetime.timedelta(days=1)
    return dias


def fila_lre(liq, conceptos):
    """({código: valor}, faltan, avisos) de una liquidación.

    `faltan`: datos sin los cuales la DT rechaza el archivo. `avisos`: lo que
    conviene revisar pero no impide declarar.
    """
    emp = liq.empleado
    empresa = emp.empresa
    contrato = Contrato.objects.filter(empleado=emp).first()
    par = _parametros_previsionales(liq.mes, liq.anio)
    faltan, avisos = [], []
    v = {}

    rut = formatear_rut(emp.rut).replace('.', '') if validar_rut(emp.rut or '') else ''
    if not rut:
        faltan.append('RUT válido')
    v[1101] = rut
    inicio = min([f for f in ((contrato.fecha_inicio if contrato else None), emp.fecha_ingreso) if f], default=None)
    if not inicio:
        faltan.append('fecha de inicio del contrato')
    v[1102] = inicio.strftime('%d/%m/%Y') if inicio else ''

    desde = datetime.date(liq.anio, liq.mes, 1)
    hasta = datetime.date(liq.anio, liq.mes, calendar.monthrange(liq.anio, liq.mes)[1])
    termino = Finiquito.objects.filter(empleado=emp, fecha_termino__range=(desde, hasta)).order_by('-fecha_termino').first()
    if termino:
        v[1103] = termino.fecha_termino.strftime('%d/%m/%Y')
        v[1104] = lre.CAUSAL.get(termino.causal_articulo, '')
        if not v[1104]:
            faltan.append('causal del término del contrato (en el finiquito)')

    comuna = lre.codigo_comuna(empresa.comuna)
    if not comuna:
        faltan.append(f'comuna de la empresa con código de la DT (hoy "{empresa.comuna or "vacía"}"; corrígela en Empresa)')
    v[1105] = lre.region_de_comuna(comuna) if comuna else ''
    v[1106] = comuna or ''
    v[1170] = int(emp.tipo_impuesto_renta or 1)
    v[1146] = 1 if emp.tecnico_extranjero_exento else 0
    jornada = contrato.tipo_jornada if contrato else 'ORDINARIA'
    v[1107] = lre.JORNADA.get(jornada, 101)
    if jornada not in lre.JORNADA:
        avisos.append('jornada personalizada: se informó como ordinaria (101); si es especial, corrige el código en el archivo')
    v[1108] = 1 if emp.discapacidad else 2 if emp.pension_invalidez else 0
    v[1109] = 1 if emp.pensionado_vejez else 0

    afp = lre.AFP.get((liq.afp_nombre or emp.afp or '').upper())
    if afp is None:
        if int(liq.afp_monto or 0) > 0:
            faltan.append('AFP (elige una AFP válida en Previsión y pago)')
        afp = 100
    v[1141] = afp
    v[1142] = 0
    if (emp.sistema_salud or '').upper() == 'ISAPRE':
        isapre = lre.ISAPRE.get(emp.isapre or '')
        if not isapre:
            faltan.append('Isapre (elige la institución en Previsión y pago)')
        v[1143] = isapre or ''
    else:
        v[1143] = lre.FONASA
    v[1151] = 1
    v[1110] = int(empresa.ccaf or 0)
    v[1152] = int(empresa.mutual or 0)
    v[1111] = emp.cargas_simples or ''
    v[1112] = emp.cargas_maternales or ''
    v[1113] = emp.cargas_invalidas or ''
    v[1114] = emp.tramo_asignacion_familiar or 'D'
    v[1115] = max(0, min(30, int(liq.dias_trabajados or 0)))
    v[1116] = int(liq.dias_licencia or 0) or ''
    v[1117] = _dias_vacaciones(emp, liq.mes, liq.anio) or ''
    v[1118] = 0
    v[1155] = 0
    v[1157] = 0
    v[1131] = 0

    # ── Haberes ─────────────────────────────────────────────────────────────
    montos = {}

    def sumar(codigo, monto):
        if monto:
            montos[codigo] = montos.get(codigo, 0) + int(monto)

    sumar(2101, liq.sueldo_base)
    sumar(2106, liq.gratificacion)
    sumar(2104, liq.semana_corrida)
    for item in liq.detalle_items or []:
        concepto = conceptos.get(item.get('concepto'))
        naturaleza = item.get('naturaleza') or (concepto.tipo if concepto else 'HABER_IMPONIBLE')
        codigo = None
        if concepto and str(concepto.codigo_lre or '').isdigit() and int(concepto.codigo_lre) in _codigos_plantilla():
            codigo = int(concepto.codigo_lre)
        if codigo is None:
            codigo = lre.codigo_por_defecto(naturaleza, concepto.es_imponible if concepto else naturaleza != 'HABER_NO_IMPONIBLE',
                                            concepto.es_tributable if concepto else naturaleza != 'HABER_NO_IMPONIBLE')
            glosa = (concepto.nombre if concepto else item.get('glosa')) or 'sin nombre'
            avisos.append(f'"{glosa}" no tiene código LRE asignado: se informó en el concepto {codigo}')
        sumar(codigo, item.get('valor'))
    sumar(3188, liq.anticipo_quincena)

    # ── Descuentos legales y aportes del empleador (como en Previred) ──────
    uf = float(liq.valor_uf) or obtener_uf()
    imponible = int(liq.total_imponible or 0)
    renta = min(imponible, _tope_en_pesos(par['tope_imponible_afp_uf'], uf))
    renta_afc = min(imponible, _tope_en_pesos(par['tope_imponible_afc_uf'], uf))
    salud = int(liq.salud_monto or 0)
    siete = min(salud, math.floor(renta * par['tasa_salud']))
    sumar(3141, liq.afp_monto)
    montos[3143] = siete
    sumar(3144, salud - siete)
    sumar(3151, liq.seguro_cesantia)
    montos[3161] = int(liq.impuesto_unico or 0)
    _, tasa_afc_emp = _tasas_afc(par, contrato.tipo_contrato if contrato else 'INDEFINIDO',
                                 _anios_de_servicio(emp, contrato, liq.mes, liq.anio))
    sumar(4151, math.floor(renta_afc * tasa_afc_emp))
    montos[4152] = math.floor(renta * _tasa_accidentes(empresa, par))
    montos[4155] = (math.floor(renta * par['tasa_sis']) + math.floor(renta * par['tasa_expectativa_vida'])
                    + math.floor(renta * par['tasa_rentabilidad_protegida']))
    sumar(4157, math.floor(renta * par['tasa_afp_empleador']))

    # ── Totales, desde las mismas columnas (el archivo cuadra consigo mismo) ─
    haberes = {k: m for k, m in montos.items() if 2000 <= k < 3000}
    for total in (5210, 5220, 5230, 5240):
        montos[total] = sum(m for k, m in haberes.items() if lre.subcategoria(k) == total)
    montos[5201] = sum(haberes.values())
    cotizaciones = sum(montos.get(k, 0) for k in (3141, 3143, 3144, 3146, 3151, 3154, 3155, 3156, 3157, 3158))
    impuestos = sum(montos.get(k, 0) for k in (3161, 3163, 3164, 3165))
    otros = sum(m for k, m in montos.items() if 3000 <= k < 4000) - cotizaciones - impuestos
    montos[5341], montos[5361], montos[5302] = cotizaciones, impuestos, otros
    montos[5301] = cotizaciones + impuestos + otros
    montos[5410] = sum(m for k, m in montos.items() if 4000 <= k < 5000)
    montos[5501] = montos[5201] - montos[5301]
    montos[5564] = 0
    if montos[5201] != int(liq.total_haberes or 0) or montos[5501] != int(liq.sueldo_liquido or 0):
        avisos.append(f'los totales del libro (haberes ${montos[5201]:,}, líquido ${montos[5501]:,}) no calzan con la '
                      f'liquidación (haberes ${int(liq.total_haberes or 0):,}, líquido ${int(liq.sueldo_liquido or 0):,}): '
                      'revísala antes de declarar'.replace(',', '.'))
    v.update(montos)
    return v, faltan, avisos


def _periodo(user, empresa_id, mes, anio):
    """(liquidaciones, trabajadores sin liquidación) de la empresa en el período."""
    liqs = list(Liquidacion.objects.filter(empleado__empresa_id=empresa_id, empleado__empresa__owner=user,
                                           mes=mes, anio=anio)
                .select_related('empleado__empresa').order_by('empleado__apellido_paterno', 'empleado__nombres'))
    con_liq = {l.empleado_id for l in liqs}
    desde = datetime.date(anio, mes, 1)
    hasta = datetime.date(anio, mes, calendar.monthrange(anio, mes)[1])
    sin_liq = []
    for emp in Empleado.objects.filter(empresa_id=empresa_id, empresa__owner=user).select_related('empresa'):
        if emp.id in con_liq:
            continue
        contrato = Contrato.objects.filter(empleado=emp).first()
        inicio = min([f for f in ((contrato.fecha_inicio if contrato else None), emp.fecha_ingreso) if f], default=None)
        vigente = emp.activo or (emp.fecha_desvinculacion and emp.fecha_desvinculacion >= desde)
        if contrato and inicio and inicio <= hasta and vigente:
            sin_liq.append(emp)
    return liqs, sin_liq


def revisar(user, empresa_id, mes, anio):
    liqs, sin_liq = _periodo(user, empresa_id, mes, anio)
    ids = {i.get('concepto') for l in liqs for i in (l.detalle_items or []) if i.get('concepto')}
    conceptos = {c.id: c for c in ConceptoRemuneracion.objects.filter(id__in=ids)}
    filas, faltan, avisos = [], [], []
    for liq in liqs:
        fila, f, a = fila_lre(liq, conceptos)
        filas.append(fila)
        if f:
            faltan.append(f'{_nombre(liq.empleado)}: {"; ".join(f)}')
        if a:
            avisos.append(f'{_nombre(liq.empleado)}: {"; ".join(dict.fromkeys(a))}')
    # El libro incluye a todos los trabajadores con contrato en el mes.
    faltan += [f'{_nombre(e)}: sin liquidación del período (emítela antes de generar el libro)' for e in sin_liq]
    return filas, faltan, avisos


def csv_lre(filas) -> bytes:
    columnas = lre.columnas()

    def celda(codigo, fila):
        valor = fila.get(codigo, '')
        if valor in ('', None):
            return '0' if codigo in lre.OBLIGATORIOS and 2000 <= codigo < 6000 else ''
        if isinstance(valor, int) and valor == 0 and codigo not in lre.OBLIGATORIOS:
            return ''    # los conceptos opcionales sin monto van vacíos (manual, 6.2)
        return str(valor).replace(';', ',')

    lineas = [';'.join(h for h, _ in columnas)]
    lineas += [';'.join(celda(codigo, fila) for _, codigo in columnas) for fila in filas]
    return ('\r\n'.join(lineas) + '\r\n').encode('cp1252', errors='replace')
