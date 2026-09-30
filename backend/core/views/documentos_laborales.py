"""Pactos, autorizaciones y constancias redactados desde datos estructurados.

Cada tipo se crea eligiendo opciones de listas cerradas (nunca texto libre):
el backend valida las reglas legales, calcula plazos y días, y redacta las
cláusulas. Se firman como los demás documentos y recién firmados surten
efecto: la liquidación avisa (sin bloquear) cuando hay horas extra sin pacto
vigente, descuentos voluntarios sin autorización o ausencias descontadas en
un mes con permiso legal pagado.

- Pacto de horas extraordinarias (Arts. 31 y 32): vigencia de hasta 3 meses,
  máximo 2 horas por día, recargo mínimo de 50 %.
- Autorización de descuento (Art. 58 inciso 2°): concepto de descuento, cuota
  y número de cuotas; los voluntarios no pueden superar el 15 % de la
  remuneración total.
- Constancia de permiso legal con goce (Arts. 66, 195 y 207 bis): días
  calculados por el sistema; días hábiles = lunes a sábado sin feriados
  (criterio de la Dirección del Trabajo).
- Pacto de indemnización a todo evento (Art. 164): desde el séptimo año de
  servicio, aporte mínimo de 4,11 %. Solo el documento: su efecto en
  liquidación, Previred y finiquito queda para un sprint propio.
- Pacto de teletrabajo (Ley 21.220, Arts. 152 quáter G y siguientes): se crea
  como anexo de contrato, para que se firme y se registre en Mi DT como tal.
"""
import calendar
import datetime

from dateutil.relativedelta import relativedelta
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import AnexoContrato, ConceptoRemuneracion, Contrato, DocumentoLaboral, Empleado
from ..rut import formatear_rut
from .base import _html_a_pdf_bytes, _plan_permite, pdf_firmado, respuesta_pdf
from .feriado import es_feriado_cl
from .horas_compensatorias import COMPENSACIONES, permite_compensacion
from .. import seguridad
from ..reglamento_plantilla import OPCIONES_RUBRO, RUBROS

NIVEL_DOCUMENTOS = 2   # Starter en adelante
_VIVAS = ['PENDIENTE', 'PROCESANDO', 'FIRMADO']
_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
          'noviembre', 'diciembre']

MOTIVOS_HORAS_EXTRA = [
    ('DEMANDA', 'Aumento temporal de la demanda o de la producción'),
    ('INVENTARIO', 'Inventario, cierre contable o auditoría'),
    ('IMPREVISTO', 'Situación imprevista que requiere dar continuidad a la operación'),
    ('PROYECTO', 'Proyecto o entrega con plazo acotado'),
]
FINALIDADES_DESCUENTO = [
    ('PRESTAMO', 'Pago de un préstamo otorgado por el empleador'),
    ('SEGURO', 'Pago de la prima de un seguro'),
    ('AHORRO', 'Ahorro o aporte voluntario'),
    ('COMPRA', 'Pago de bienes o servicios adquiridos al empleador'),
]
# Descuentos que no requieren la autorización del Art. 58 inciso 2°: los
# legales o judiciales, y los anticipos de remuneración ya pagada.
CONCEPTOS_SIN_AUTORIZACION = {'ANTICIPO', 'CUOTA_SINDICAL', 'RETENCION_JUDICIAL', 'CAJA_COMPENSACION'}
TOPE_DESCUENTOS_VOLUNTARIOS = 0.15

# tipo: (texto, días, 'corridos' | 'hábiles', norma)
PERMISOS = {
    'FALLECIMIENTO_HIJO': ('Fallecimiento de un hijo', 10, 'corridos', 'Art. 66 del Código del Trabajo'),
    'FALLECIMIENTO_CONYUGE': ('Fallecimiento del cónyuge o conviviente civil', 7, 'corridos',
                              'Art. 66 del Código del Trabajo'),
    'FALLECIMIENTO_GESTACION': ('Fallecimiento de un hijo en período de gestación', 7, 'hábiles',
                                'Art. 66 del Código del Trabajo'),
    'FALLECIMIENTO_PADRES': ('Fallecimiento del padre o de la madre', 4, 'hábiles', 'Art. 66 del Código del Trabajo'),
    'FALLECIMIENTO_HERMANO': ('Fallecimiento de un hermano o hermana', 4, 'hábiles', 'Art. 66 del Código del Trabajo'),
    'NACIMIENTO': ('Nacimiento o adopción de un hijo', 5, 'corridos', 'Art. 195 del Código del Trabajo'),
    'MATRIMONIO': ('Matrimonio o acuerdo de unión civil', 5, 'hábiles', 'Art. 207 bis del Código del Trabajo'),
}
# Fallecimientos (salvo el de un hijo en gestación): el permiso corre desde el día de la muerte.
_DESDE_EL_HECHO = {'FALLECIMIENTO_HIJO', 'FALLECIMIENTO_CONYUGE', 'FALLECIMIENTO_PADRES', 'FALLECIMIENTO_HERMANO'}
PORCENTAJES_INDEMNIZACION = ['4.11', '5', '6', '7', '8.33']

MODALIDADES_TELETRABAJO = [('TOTAL', 'Total: toda la jornada a distancia'),
                           ('PARCIAL', 'Parcial: combina días presenciales y a distancia')]
LUGARES_TELETRABAJO = [('DOMICILIO', 'El domicilio del trabajador'),
                       ('LIBRE', 'Un lugar libremente elegido por el trabajador')]
EQUIPOS_TELETRABAJO = [('COMPUTADOR', 'Computador'), ('CELULAR', 'Teléfono celular'),
                       ('INTERNET', 'Conexión a internet'), ('MOBILIARIO', 'Silla y escritorio ergonómicos')]
DIAS_SEMANA = [('LUNES', 'lunes'), ('MARTES', 'martes'), ('MIERCOLES', 'miércoles'), ('JUEVES', 'jueves'),
               ('VIERNES', 'viernes'), ('SABADO', 'sábado')]
HORAS_DESCONEXION = ['18:00', '19:00', '20:00', '21:00', '22:00']
DURACIONES_TELETRABAJO = [('INDEFINIDA', 'Indefinida'), ('3', '3 meses'), ('6', '6 meses'), ('12', '12 meses')]


class DatoInvalido(Exception):
    pass


# ── Utilidades ───────────────────────────────────────────────────────────────

def _fecha(d):
    return f'{d.day} de {_MESES[d.month - 1]} de {d.year}' if d else '—'


def _pesos(n):
    return '$' + f'{int(n or 0):,}'.replace(',', '.')


def _fecha_param(valor, campo):
    try:
        return datetime.date.fromisoformat(str(valor))
    except (TypeError, ValueError):
        raise DatoInvalido(f'Indica {campo}.')


def _entero(valor, campo, minimo, maximo):
    try:
        n = int(valor)
    except (TypeError, ValueError):
        raise DatoInvalido(f'Indica {campo}.')
    if not minimo <= n <= maximo:
        raise DatoInvalido(f'{campo[0].upper()}{campo[1:]} debe estar entre {minimo} y {maximo}.')
    return n


def _opcion(valor, opciones, campo):
    claves = [o[0] if isinstance(o, tuple) else o for o in opciones]
    if valor not in claves:
        raise DatoInvalido(f'Elige {campo}.')
    return valor


def _fin_de_mes(d):
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def _es_habil(d):
    """Día hábil para los permisos: lunes a sábado sin feriados (criterio DT)."""
    return d.weekday() < 6 and not es_feriado_cl(d)


def dias_permiso(inicio, dias, tipo_dias):
    """Último día del permiso: `dias` corridos o hábiles contados desde `inicio`."""
    if tipo_dias == 'corridos':
        return inicio + datetime.timedelta(days=dias - 1)
    d, contados = inicio, 0
    while True:
        if _es_habil(d):
            contados += 1
            if contados == dias:
                return d
        d += datetime.timedelta(days=1)


def _firmados(qs):
    return qs.filter(activo=True, solicitudes_firma__estado='FIRMADO').distinct()


def _vigentes_en(qs, desde, hasta):
    """Documentos cuya vigencia toca el período [desde, hasta]."""
    return qs.filter(vigente_desde__lte=hasta).exclude(vigente_hasta__lt=desde)


def _nombre_trabajador(emp):
    return ' '.join(p for p in (emp.nombres, emp.apellido_paterno, emp.apellido_materno) if p).strip().title()


def _antiguedad_anios(emp, hoy):
    ingreso = emp.fecha_ingreso
    if not ingreso:
        return 0
    return relativedelta(hoy, ingreso).years


def conceptos_descuento(user, empresa):
    """Conceptos de descuento que admiten autorización del Art. 58."""
    qs = ConceptoRemuneracion.objects.filter(tipo='DESCUENTO', activo=True)
    return [c for c in qs if (c.empresa_id is None and c.codigo not in CONCEPTOS_SIN_AUTORIZACION)
            or (c.empresa_id == empresa.id)]


# ── Validación y redacción por tipo ──────────────────────────────────────────

def _horas_extra(emp, contrato, d, hoy, user=None):
    if not contrato:
        raise DatoInvalido('El trabajador no tiene contrato registrado.')
    compensacion = d.get('compensacion') or 'PAGO'
    if compensacion not in dict(COMPENSACIONES):
        raise DatoInvalido('Elige cómo se compensan las horas extra.')
    if compensacion != 'PAGO' and not (user and permite_compensacion(user)):
        raise DatoInvalido('Cambiar horas extra por días libres está disponible desde el plan Pyme.')
    desde = _fecha_param(d.get('desde'), 'la fecha de inicio')
    meses = _entero(d.get('meses'), 'la duración en meses', 1, 3)
    horas = _entero(d.get('horas_diarias'), 'las horas diarias', 1, 2)
    motivo = _opcion(d.get('motivo'), MOTIVOS_HORAS_EXTRA, 'el motivo')
    hasta = desde + relativedelta(months=meses) - datetime.timedelta(days=1)
    choque = _vigentes_en(DocumentoLaboral.objects.filter(empleado=emp, tipo='HORAS_EXTRA', activo=True), desde, hasta)
    if choque.exists():
        raise DatoInvalido('Ya hay un pacto de horas extra que cubre parte de ese período. Anúlalo o elige otras fechas.')
    avisos = []
    if contrato.tipo_jornada == 'ART_22':
        avisos.append('El contrato excluye al trabajador del límite de jornada (Art. 22): no genera horas extra.')
    texto_motivo = dict(MOTIVOS_HORAS_EXTRA)[motivo]
    clausulas = [
        f'Las partes acuerdan que el trabajador podrá laborar horas extraordinarias entre el {_fecha(desde)} y el '
        f'{_fecha(hasta)}, para atender la siguiente necesidad temporal de la empresa: {texto_motivo.lower()}.',
        f'Las horas extraordinarias no podrán exceder de {horas} {"hora" if horas == 1 else "horas"} por día, conforme '
        'al artículo 31 del Código del Trabajo, y solo se podrán trabajar en los días en que el trabajador tenga '
        'jornada ordinaria.',
        *_clausulas_compensacion(compensacion),
        'Este pacto tiene la vigencia transitoria indicada, que no excede de tres meses, y podrá renovarse por '
        'acuerdo escrito de las partes (artículo 32).',
    ]
    if compensacion != 'PAGO' and contrato.tipo_jornada == 'ART_22':
        avisos.append('Sin límite de jornada (Art. 22) no hay horas extra que cambiar por días libres.')
    resumen = f'Hasta {horas} h diarias · del {desde:%d-%m-%Y} al {hasta:%d-%m-%Y}'
    if compensacion != 'PAGO':
        resumen += ' · ' + dict(COMPENSACIONES)[compensacion].lower()
    return {'vigente_desde': desde, 'vigente_hasta': hasta,
            'datos': {'meses': meses, 'horas_diarias': horas, 'motivo': motivo, 'compensacion': compensacion,
                      'clausulas': clausulas, 'resumen': resumen}}, avisos


_PAGO_HORAS_EXTRA = ('Las horas extraordinarias se pagarán con un recargo del cincuenta por ciento sobre el sueldo '
                     'convenido para la jornada ordinaria, junto con la remuneración del respectivo período '
                     '(artículo 32).')


def _clausulas_compensacion(compensacion):
    """Cláusulas de pago o de compensación con días adicionales de feriado (Art. 32 inc. 4°)."""
    if compensacion == 'PAGO':
        return [_PAGO_HORAS_EXTRA]
    parte = ('La totalidad de las horas extraordinarias' if compensacion == 'FERIADO'
             else 'La mitad de las horas extraordinarias trabajadas en cada período')
    clausulas = [] if compensacion == 'FERIADO' else [
        'La otra mitad se pagará con un recargo del cincuenta por ciento sobre el sueldo convenido para la jornada '
        'ordinaria, junto con la remuneración del respectivo período (artículo 32).']
    return [
        f'{parte} se compensará con días adicionales de feriado, conforme al inciso cuarto del artículo 32 del Código '
        'del Trabajo: por cada hora extraordinaria corresponderá una hora y media de descanso, hasta un máximo de '
        'cinco días hábiles de descanso adicional por cada año de contrato. Lo que exceda ese máximo se pagará '
        'con el recargo legal.',
        *clausulas,
        'El trabajador podrá usar esos días, completos, dentro de los seis meses siguientes al mes en que se '
        'trabajaron las horas, dando aviso al empleador con cuarenta y ocho horas de anticipación. Si no los '
        'solicita en ese plazo, se pagarán en la remuneración del período respectivo, y los que queden pendientes '
        'al término de la relación laboral se compensarán conforme al artículo 73.',
    ]


def _descuento(emp, contrato, d, hoy, user):
    ids = {c.id: c for c in conceptos_descuento(user, emp.empresa)}
    try:
        concepto = ids[int(d.get('concepto'))]
    except (TypeError, ValueError, KeyError):
        raise DatoInvalido('Elige el concepto de descuento.')
    finalidad = _opcion(d.get('finalidad'), FINALIDADES_DESCUENTO, 'la finalidad')
    cuota = _entero(d.get('monto_cuota'), 'el monto de la cuota', 1000, 50_000_000)
    cuotas = _entero(d.get('cuotas'), 'el número de cuotas', 0, 60)
    desde = _fecha_param(d.get('desde'), 'el mes de inicio').replace(day=1)
    hasta = _fin_de_mes(desde + relativedelta(months=cuotas - 1)) if cuotas else None
    avisos = []
    sueldo = contrato.sueldo_base if contrato else 0
    if sueldo and cuota > sueldo * TOPE_DESCUENTOS_VOLUNTARIOS:
        avisos.append(f'La cuota supera el 15 % del sueldo base ({_pesos(sueldo * TOPE_DESCUENTOS_VOLUNTARIOS)}): '
                      'los descuentos voluntarios no pueden exceder el 15 % de la remuneración total (Art. 58).')
    plazo = (f'en {cuotas} cuotas mensuales de {_pesos(cuota)}, desde {_MESES[desde.month - 1]} de {desde.year} '
             f'hasta {_MESES[hasta.month - 1]} de {hasta.year}') if cuotas else \
        f'en cuotas mensuales de {_pesos(cuota)} desde {_MESES[desde.month - 1]} de {desde.year}, hasta que revoque ' \
        'esta autorización por escrito'
    clausulas = [
        f'El trabajador autoriza al empleador a descontar de sus remuneraciones, bajo el concepto «{concepto.nombre}», '
        f'la suma que se indica, destinada a: {dict(FINALIDADES_DESCUENTO)[finalidad].lower()}.',
        f'El descuento se hará {plazo}.',
        'Conforme al artículo 58 inciso segundo del Código del Trabajo, los descuentos de esta naturaleza no podrán '
        'exceder, en conjunto, del quince por ciento de la remuneración total del trabajador; el exceso no se '
        'descontará en el mes respectivo.',
    ]
    total = f' · {cuotas} cuotas' if cuotas else ' · hasta revocación'
    return {'vigente_desde': desde, 'vigente_hasta': hasta, 'concepto': concepto,
            'datos': {'finalidad': finalidad, 'monto_cuota': cuota, 'cuotas': cuotas, 'clausulas': clausulas,
                      'resumen': f'{concepto.nombre}: {_pesos(cuota)} mensuales{total}'}}, avisos


def _permiso(emp, contrato, d, hoy):
    tipo = _opcion(d.get('permiso'), list(PERMISOS), 'el tipo de permiso')
    texto, dias, tipo_dias, norma = PERMISOS[tipo]
    hecho = _fecha_param(d.get('fecha_hecho'), 'la fecha del hecho')
    if tipo in _DESDE_EL_HECHO:
        inicio = hecho
    else:
        inicio = _fecha_param(d.get('inicio'), 'la fecha de inicio del permiso')
        limites = {'NACIMIENTO': (hecho, hecho + relativedelta(months=1)),
                   'FALLECIMIENTO_GESTACION': (hecho, hecho + relativedelta(months=1)),
                   'MATRIMONIO': (hecho - datetime.timedelta(days=7), hecho + datetime.timedelta(days=7))}[tipo]
        if not limites[0] <= inicio <= limites[1]:
            raise DatoInvalido({'NACIMIENTO': 'El permiso por nacimiento se usa dentro del primer mes desde el '
                                              'nacimiento.',
                                'FALLECIMIENTO_GESTACION': 'El permiso se usa desde que se acredita la muerte con el '
                                                           'certificado, dentro del mes siguiente.',
                                'MATRIMONIO': 'El permiso por matrimonio se usa en torno al día del matrimonio '
                                              '(días inmediatamente anteriores o posteriores).'}[tipo])
    if tipo_dias == 'hábiles' and not _es_habil(inicio):
        raise DatoInvalido('El permiso en días hábiles debe comenzar en un día hábil (lunes a sábado, sin feriados).')
    fin = dias_permiso(inicio, dias, tipo_dias)
    clausulas = [
        f'Se deja constancia de que el trabajador hace uso del permiso pagado por {texto.lower()}, ocurrido el '
        f'{_fecha(hecho)}, conforme al {norma}.',
        f'El permiso es de {dias} días {tipo_dias}, desde el {_fecha(inicio)} hasta el {_fecha(fin)}, ambos inclusive.'
        + (' Los días hábiles se cuentan de lunes a sábado, sin domingos ni festivos.' if tipo_dias == 'hábiles' else ''),
        'Estos días son de cargo del empleador, se pagan íntegramente y no se descuentan de la remuneración ni del '
        'feriado anual.',
    ]
    if tipo.startswith('FALLECIMIENTO'):
        clausulas.append('El trabajador goza de fuero laboral por un mes desde el fallecimiento; en contratos a plazo '
                         'fijo o por obra o faena, por ese mismo período o hasta el término del contrato (Art. 66).')
    return {'vigente_desde': inicio, 'vigente_hasta': fin,
            'datos': {'permiso': tipo, 'fecha_hecho': hecho.isoformat(), 'dias': dias, 'tipo_dias': tipo_dias,
                      'clausulas': clausulas,
                      'resumen': f'{texto}: {dias} días {tipo_dias}, del {inicio:%d-%m-%Y} al {fin:%d-%m-%Y}'}}, []


def _indemnizacion(emp, contrato, d, hoy):
    if _antiguedad_anios(emp, hoy) < 6:
        raise DatoInvalido('El pacto de indemnización a todo evento se celebra desde el inicio del séptimo año de '
                           'servicio (Art. 164): el trabajador aún no cumple seis años.')
    if DocumentoLaboral.objects.filter(empleado=emp, tipo='INDEMNIZACION', activo=True).exists():
        raise DatoInvalido('El trabajador ya tiene un pacto de indemnización a todo evento.')
    porcentaje = _opcion(str(d.get('porcentaje') or ''), PORCENTAJES_INDEMNIZACION, 'el porcentaje de aporte')
    desde = _fecha_param(d.get('desde'), 'el mes de inicio del aporte').replace(day=1)
    ingreso = emp.fecha_ingreso
    septimo = ingreso + relativedelta(years=6) if ingreso else None
    texto_pct = porcentaje.replace('.', ',')
    clausulas = [
        f'Las partes acuerdan sustituir, respecto del lapso posterior a los primeros seis años de servicio (que se '
        f'cumplieron el {_fecha(septimo)}), la indemnización por años de servicio por una indemnización a todo evento, '
        'conforme al artículo 164 del Código del Trabajo.',
        f'El empleador aportará mensualmente el {texto_pct} % de la remuneración mensual imponible del trabajador, '
        f'desde {_MESES[desde.month - 1]} de {desde.year}, en la cuenta de ahorro de indemnización que el trabajador '
        'mantiene en su AFP, con el límite de remuneración imponible que establece la ley.',
        'Los aportes serán de propiedad del trabajador y podrá retirarlos al término de la relación laboral, '
        'cualquiera sea la causa.',
        'La indemnización por los primeros seis años de servicio se rige por las normas generales.',
    ]
    return {'vigente_desde': desde, 'vigente_hasta': None,
            'datos': {'porcentaje': porcentaje, 'clausulas': clausulas,
                      'resumen': f'Aporte de {texto_pct} % desde {_MESES[desde.month - 1]} de {desde.year}'}}, []


def _teletrabajo(emp, contrato, d, hoy):
    """Anexo de contrato (se firma y se registra en Mi DT como tal)."""
    if not contrato:
        raise DatoInvalido('El trabajador no tiene contrato registrado.')
    modalidad = _opcion(d.get('modalidad'), MODALIDADES_TELETRABAJO, 'la modalidad')
    lugar = _opcion(d.get('lugar'), LUGARES_TELETRABAJO, 'el lugar')
    desde = _fecha_param(d.get('desde'), 'la fecha de inicio')
    duracion = _opcion(str(d.get('duracion') or ''), DURACIONES_TELETRABAJO, 'la duración')
    desconexion = _opcion(d.get('desconexion'), HORAS_DESCONEXION, 'la hora de inicio de la desconexión')
    equipos = d.get('equipos') or []
    if not isinstance(equipos, list) or any(e not in dict(EQUIPOS_TELETRABAJO) for e in equipos):
        raise DatoInvalido('Elige los equipos de la lista.')
    presenciales = d.get('dias_presenciales') or []
    if modalidad == 'PARCIAL':
        if not isinstance(presenciales, list) or not presenciales or \
                any(x not in dict(DIAS_SEMANA) for x in presenciales):
            raise DatoInvalido('Elige los días presenciales.')
    else:
        presenciales = []
    compensacion = _entero(d.get('compensacion') or 0, 'la compensación mensual de gastos', 0, 1_000_000)
    hasta = None if duracion == 'INDEFINIDA' else desde + relativedelta(months=int(duracion)) - datetime.timedelta(days=1)
    fin_desconexion = f'{(int(desconexion[:2]) + 12) % 24:02d}:00'
    lugar_txt = dict(LUGARES_TELETRABAJO)[lugar].lower()
    dias_txt = ', '.join(dict(DIAS_SEMANA)[x] for x in presenciales)
    equipos_txt = ', '.join(dict(EQUIPOS_TELETRABAJO)[e].lower() for e in equipos)
    clausulas = [
        (f'Desde el {_fecha(desde)}, el trabajador prestará sus servicios bajo la modalidad de trabajo a distancia o '
         f'teletrabajo {"total" if modalidad == "TOTAL" else "parcial"}, en {lugar_txt}'
         + (f', y en forma presencial los días {dias_txt}' if presenciales else '') + '.'),
        ('Este pacto rige por tiempo indefinido.' if not hasta else
         f'Este pacto rige hasta el {_fecha(hasta)}.'),
        'La jornada y su distribución son las del contrato de trabajo. El trabajador tiene derecho a desconectarse '
        f'al menos doce horas continuas en cada período de veinticuatro horas, entre las {desconexion} y las '
        f'{fin_desconexion}, sin que deba responder comunicaciones ni órdenes (Art. 152 quáter J).',
        ('El empleador proporcionará ' + (f'los siguientes equipos y herramientas: {equipos_txt}, ' if equipos else
                                          'los equipos y herramientas necesarios, ')
         + 'y serán de su cargo los costos de operación, funcionamiento, mantenimiento y reparación (Art. 152 quáter L).'
         + (f' Además pagará una compensación mensual de gastos de {_pesos(compensacion)}.' if compensacion else '')),
        'El empleador informará por escrito al trabajador los riesgos de la modalidad y las medidas de seguridad y '
        'salud que debe observar, y la supervisión se hará por medios telemáticos que respeten su intimidad '
        '(Art. 152 quáter M).',
        'Si la relación laboral se inició en forma presencial, cualquiera de las partes podrá volver unilateralmente '
        'a las condiciones originalmente pactadas, con aviso por escrito de al menos treinta días (Art. 152 quáter I).',
    ]
    datos = {'modalidad': modalidad, 'lugar': lugar, 'desde': desde.isoformat(), 'duracion': duracion,
             'desconexion': desconexion, 'equipos': equipos, 'dias_presenciales': presenciales,
             'compensacion': compensacion}
    return {'desde': desde, 'clausulas': clausulas, 'datos': datos}, []


def fin_teletrabajo(anexo):
    """Último día de un pacto de teletrabajo con plazo; None si es indefinido o no se puede leer."""
    datos = anexo.datos or {}
    try:
        desde = datetime.date.fromisoformat(datos.get('desde'))
        meses = int(datos.get('duracion'))
    except (TypeError, ValueError):
        return None
    return desde + relativedelta(months=meses) - datetime.timedelta(days=1)


def _pactos_teletrabajo_firmados(empleados):
    """{empleado_id: [anexos TELETRABAJO firmados]}."""
    anexos = AnexoContrato.objects.filter(
        tipo='TELETRABAJO', contrato__empleado__in=empleados,
        solicitudes_firma__estado='FIRMADO').distinct().select_related('contrato')
    salida = {}
    for a in anexos:
        salida.setdefault(a.contrato.empleado_id, []).append(a)
    return salida


def actualizar_modalidad_teletrabajo(empleados, hoy=None):
    """Devuelve a presencial a quien trabajaba a distancia por un pacto con plazo ya vencido y
    sin otro vigente. Si la modalidad no vino de un pacto firmado (se registró a mano), no se toca."""
    hoy = hoy or timezone.localdate()
    remotos = [e for e in empleados if e.modalidad in ('REMOTO', 'HIBRIDO')]
    if not remotos:
        return
    pactos = _pactos_teletrabajo_firmados(remotos)
    for emp in remotos:
        suyos = pactos.get(emp.id)
        if not suyos:
            continue
        fines = [fin_teletrabajo(a) for a in suyos]
        if all(f is not None and f < hoy for f in fines):
            emp.modalidad = 'PRESENCIAL'
            emp.save(update_fields=['modalidad'])


def _avisos_teletrabajo(emp, hoy):
    avisos = []
    suyos = _pactos_teletrabajo_firmados([emp]).get(emp.id, [])
    fines = [fin_teletrabajo(a) for a in suyos]
    if emp.modalidad in ('REMOTO', 'HIBRIDO') and not suyos:
        avisos.append('El trabajador figura con modalidad remota o híbrida y no tiene un pacto de teletrabajo '
                      'firmado (Ley 21.220).')
    vigentes = [f for f in fines if f is None or f >= hoy]
    if suyos and vigentes and None not in vigentes:
        fin = max(vigentes)
        if fin <= hoy + datetime.timedelta(days=30):
            avisos.append(f'El pacto de teletrabajo vence el {fin:%d-%m-%Y}: después, el trabajador vuelve a la '
                          'modalidad presencial. Si seguirá a distancia, genera un nuevo pacto.')
    return avisos



# ── Seguridad laboral: EPP (todos los planes) e información de riesgos (Pyme) ─

NIVEL_RIESGOS = 3
MESES_REFUERZO_EPP = 12


def _entrega_epp(emp, contrato, d, hoy):
    """Constancia de entrega gratuita de EPP (Art. 68 Ley 16.744; Art. 13 DS 44)."""
    elegidos = []
    for item in d.get('items') or []:
        if not isinstance(item, dict):
            continue
        codigo = _opcion(item.get('codigo'), seguridad.EPP, 'los elementos entregados')
        elegidos.append((codigo, _entero(item.get('cantidad'), 'la cantidad', 1, 20)))
    if not elegidos:
        raise DatoInvalido('Elige al menos un elemento de protección entregado.')
    if len({c for c, _ in elegidos}) != len(elegidos):
        raise DatoInvalido('Un mismo elemento aparece dos veces: indica una sola vez su cantidad.')
    motivo = _opcion(d.get('motivo'), seguridad.MOTIVOS_EPP, 'el motivo de la entrega')
    entrega = _fecha_param(d.get('fecha'), 'la fecha de entrega')
    if entrega > hoy:
        raise DatoInvalido('La fecha de entrega no puede ser futura.')
    capacitado = d.get('capacitacion') == 'SI'
    capacitacion = _fecha_param(d.get('fecha_capacitacion'), 'la fecha de la capacitación') if capacitado else None
    if capacitacion and capacitacion > hoy:
        raise DatoInvalido('La fecha de la capacitación no puede ser futura.')
    lista = ', '.join(f'{n} × {seguridad.TEXTO_EPP[c].lower()}' for c, n in elegidos)
    clausulas = [
        f'Se deja constancia de que el empleador entregó al trabajador el {_fecha(entrega)}, sin costo alguno para '
        f'este, los siguientes elementos de protección personal: {lista}. Motivo: '
        f'{dict(seguridad.MOTIVOS_EPP)[motivo].lower()} (artículo 68 de la Ley 16.744 y artículo 13 del DS 44 de 2023).',
    ]
    if capacitacion:
        clausulas.append(f'El {_fecha(capacitacion)} el trabajador recibió capacitación teórica y práctica, de al menos '
                         'una hora, sobre su correcta colocación y uso, sus limitaciones, su limpieza, almacenamiento y '
                         'revisión diaria (artículo 13 del DS 44 y artículo 53 del DS 594).')
    clausulas.append('El trabajador se compromete a usar estos elementos durante su trabajo, cuidarlos y avisar '
                     'cuando se deterioren o pierdan; su reposición es gratuita.')
    avisos = [] if capacitacion else ['Falta registrar la capacitación de al menos una hora sobre el uso de estos '
                                      'elementos (Art. 13 del DS 44).']
    return {'vigente_desde': entrega, 'vigente_hasta': None,
            'datos': {'items': [{'codigo': c, 'cantidad': n} for c, n in elegidos], 'motivo': motivo,
                      'capacitacion_en': capacitacion.isoformat() if capacitacion else None,
                      'clausulas': clausulas,
                      'resumen': f'{sum(n for _, n in elegidos)} elementos · {entrega:%d-%m-%Y}'}}, avisos


def _informacion_riesgos(emp, contrato, d, hoy):
    """Constancia de la información de riesgos del Art. 15 del DS 44 (lista cerrada del rubro)."""
    rubro = _opcion(d.get('rubro'), list(RUBROS), 'el rubro')
    catalogo = seguridad.riesgos()
    codigos = [c for c in (d.get('riesgos') or []) if c in catalogo]
    if not codigos:
        raise DatoInvalido('Marca al menos un riesgo del puesto.')
    motivo = _opcion(d.get('motivo'), seguridad.MOTIVOS_RIESGOS, 'el momento en que se informa')
    capacitacion = _fecha_param(d.get('fecha_capacitacion'), 'la fecha de la capacitación presencial')
    cargo = (emp.cargo or (contrato.cargo if contrato else '') or 'su cargo').strip()
    clausulas = [
        f'Conforme al artículo 15 del DS 44 de 2023, el empleador informó al trabajador, que se desempeña como {cargo}, '
        f'{dict(seguridad.MOTIVOS_RIESGOS)[motivo].lower()}, los riesgos de su trabajo, las medidas preventivas y '
        'los procedimientos de trabajo seguro. Los riesgos informados y sus medidas son:',
        *[f'{catalogo[c][0]}. Medidas: {catalogo[c][1]}' for c in codigos],
        f'Los procedimientos de trabajo seguro se capacitaron en forma presencial el {_fecha(capacitacion)} '
        '(Dirección del Trabajo, ORD 374 de 2024).',
        'El trabajador conoce las características de su lugar de trabajo, el plan de emergencia y, cuando '
        'corresponde, las hojas de datos de seguridad de los productos que usa, y puede consultar la matriz de '
        'riesgos de la empresa.',
    ]
    if emp.empresa.rubro != rubro:
        emp.empresa.rubro = rubro
        emp.empresa.save(update_fields=['rubro'])
    return {'vigente_desde': hoy, 'vigente_hasta': None,
            'datos': {'rubro': rubro, 'riesgos': codigos, 'motivo': motivo, 'cargo': cargo,
                      'capacitacion_en': capacitacion.isoformat(), 'clausulas': clausulas,
                      'resumen': f'{len(codigos)} riesgos · {dict(seguridad.MOTIVOS_RIESGOS)[motivo].lower()}'}}, []


def avisos_seguridad(emp, hoy, permite_riesgos):
    """Avisos de la carpeta: información de riesgos pendiente o desactualizada y refuerzo anual de EPP."""
    avisos = []
    firmados = _firmados(DocumentoLaboral.objects.filter(empleado=emp))
    if permite_riesgos and emp.activo:
        ultimo = firmados.filter(tipo='INFORMACION_RIESGOS').order_by('-fecha_emision', '-id').first()
        if ultimo is None:
            avisos.append('No hay constancia firmada de que se le informaron los riesgos de su trabajo (Art. 15 del '
                          'DS 44). Genérala en Documentos → Información de riesgos.')
        elif (emp.cargo or '').strip() and ultimo.datos.get('cargo') and ultimo.datos['cargo'] != emp.cargo.strip():
            avisos.append('Cambió de cargo desde la última información de riesgos: infórmale los riesgos del nuevo '
                          'puesto (Art. 15 del DS 44).')
    capacitaciones = [datetime.date.fromisoformat(d.datos['capacitacion_en'])
                      for d in firmados.filter(tipo='ENTREGA_EPP') if d.datos.get('capacitacion_en')]
    if capacitaciones and max(capacitaciones) < hoy - relativedelta(months=MESES_REFUERZO_EPP):
        avisos.append('La última capacitación en el uso de sus elementos de protección fue hace más de un año: '
                      'refuérzala (Art. 13 del DS 44).')
    return avisos

_CONSTRUCTORES = {'HORAS_EXTRA': _horas_extra, 'PERMISO_LEGAL': _permiso, 'INDEMNIZACION': _indemnizacion,
                  'ENTREGA_EPP': _entrega_epp, 'INFORMACION_RIESGOS': _informacion_riesgos}


# ── PDF ──────────────────────────────────────────────────────────────────────

def pdf_documento_laboral(doc, es_plan_semilla):
    emp = doc.empleado
    empresa = emp.empresa
    html = render_to_string('documento_laboral.html', {
        'doc': doc, 'titulo': doc.get_tipo_display(), 'clausulas': doc.datos.get('clausulas', []),
        'empleado': emp, 'nombre': _nombre_trabajador(emp), 'rut': formatear_rut(emp.rut),
        'empresa': empresa, 'empresa_rut': formatear_rut(empresa.rut),
        'ciudad': str(empresa.ciudad or empresa.comuna or 'Santiago').strip().title(),
        'fecha': _fecha(doc.fecha_emision), 'es_plan_semilla': es_plan_semilla,
        'es_constancia': doc.tipo in ('PERMISO_LEGAL', 'REGLAMENTO', 'CANALES_DENUNCIA', 'ENTREGA_EPP',
                                      'INFORMACION_RIESGOS'),
    })
    pdf = _html_a_pdf_bytes(html, f'{doc.tipo}_{emp.rut}_{doc.fecha_emision}')
    if doc.tipo == 'REGLAMENTO' and doc.reglamento_id:
        # La constancia lleva adjunto el reglamento completo: el trabajador lo lee
        # al firmar y el PDF firmado prueba qué versión recibió.
        from .reglamento import anexar_reglamento
        pdf = anexar_reglamento(pdf, doc.reglamento)
    return pdf


# ── Avisos para la liquidación ───────────────────────────────────────────────

def avisos_liquidacion(empleado, mes, anio, items, total_haberes, dias_ausencia=0):
    """Avisos (nunca bloqueos) sobre documentos que respaldan la liquidación."""
    try:
        desde = datetime.date(int(anio), int(mes), 1)
    except (TypeError, ValueError):
        return []
    hasta = _fin_de_mes(desde)
    firmados = _firmados(DocumentoLaboral.objects.filter(empleado=empleado))
    avisos = []

    def valor(i):
        try:
            return int(float(i.get('valor') or 0))
        except (TypeError, ValueError):
            return 0

    horas_extra = [i for i in items if i.get('naturaleza') == 'HORA_EXTRA' and not i.get('lotes_compensatorios')
                   and (valor(i) > 0 or float(i.get('horas') or 0) > 0)]
    if horas_extra and not _vigentes_en(firmados.filter(tipo='HORAS_EXTRA'), desde, hasta).exists():
        avisos.append('Hay horas extra sin un pacto de horas extraordinarias firmado y vigente en el mes (Art. 32). '
                      'Genéralo en la carpeta del trabajador → Documentos.')

    exceso = sum(float(i.get('exceso_tope') or 0) for i in horas_extra)
    if exceso:
        avisos.append(f'{f"{exceso:g}".replace(".", ",")} h extra se pagaron en dinero porque se alcanzó el tope de '
                      '5 días de descanso del año de contrato (Art. 32).')

    descuentos = [i for i in items if i.get('naturaleza') == 'DESCUENTO' and valor(i) > 0]
    ids = {i.get('concepto') for i in descuentos if i.get('concepto')}
    conceptos = {c.id: c for c in ConceptoRemuneracion.objects.filter(id__in=ids)}
    autorizaciones = {}
    for doc in _vigentes_en(firmados.filter(tipo='DESCUENTO'), desde, hasta):
        autorizaciones.setdefault(doc.concepto_id, []).append(doc)
    voluntarios = 0
    for i in descuentos:
        concepto = conceptos.get(i.get('concepto'))
        if concepto and concepto.empresa_id is None and concepto.codigo in CONCEPTOS_SIN_AUTORIZACION:
            continue
        voluntarios += valor(i)
        nombre = concepto.nombre if concepto else (i.get('glosa') or 'Descuento')
        docs = autorizaciones.get(concepto.id if concepto else None, [])
        if not docs:
            avisos.append(f'«{nombre}» no tiene una autorización de descuento firmada y vigente (Art. 58).')
        elif valor(i) > sum(int(d.datos.get('monto_cuota') or 0) for d in docs):
            avisos.append(f'«{nombre}» supera la cuota autorizada por escrito.')
    if total_haberes and voluntarios > total_haberes * TOPE_DESCUENTOS_VOLUNTARIOS:
        avisos.append(f'Los descuentos voluntarios suman {_pesos(voluntarios)}, más del 15 % de la remuneración total '
                      f'({_pesos(total_haberes * TOPE_DESCUENTOS_VOLUNTARIOS)}), tope del Art. 58.')

    if dias_ausencia and _vigentes_en(firmados.filter(tipo='PERMISO_LEGAL'), desde, hasta).exists():
        avisos.append('En este mes hay un permiso legal con goce firmado: esos días se pagan y no deben registrarse '
                      'como ausencia.')
    return avisos


# ── API del panel ────────────────────────────────────────────────────────────

def _estado_firma(doc):
    s = doc.solicitudes_firma.exclude(estado='CANCELADO').order_by('-enviado_en').first()
    return s.estado if s else None


def dato_documento(doc):
    return {'id': doc.id, 'empleado': doc.empleado_id, 'tipo': doc.tipo, 'tipo_texto': doc.get_tipo_display(),
            'resumen': doc.datos.get('resumen', ''), 'fecha_emision': doc.fecha_emision.isoformat(),
            'vigente_desde': doc.vigente_desde.isoformat(),
            'vigente_hasta': doc.vigente_hasta.isoformat() if doc.vigente_hasta else None,
            'activo': doc.activo}


class DocumentoLaboralViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _empleado(self, request, empleado_id):
        return Empleado.objects.filter(pk=empleado_id or 0, empresa__owner=request.user).select_related('empresa').first()

    def list(self, request):
        qs = DocumentoLaboral.objects.filter(empleado__empresa__owner=request.user, activo=True)
        if request.query_params.get('empleado'):
            qs = qs.filter(empleado_id=request.query_params['empleado'])
        return Response([dato_documento(d) for d in qs])

    @action(detail=False, methods=['get'])
    def opciones(self, request):
        """Listas cerradas del formulario y si cada tipo aplica a este trabajador."""
        emp = self._empleado(request, request.query_params.get('empleado'))
        if emp is None:
            return Response({'error': 'Trabajador no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        contrato = Contrato.objects.filter(empleado=emp).first()
        hoy = timezone.localdate()
        anios = _antiguedad_anios(emp, hoy)
        actualizar_modalidad_teletrabajo([emp], hoy)
        avisos = _avisos_teletrabajo(emp, hoy) + avisos_seguridad(emp, hoy, _plan_permite(request.user, NIVEL_RIESGOS))
        return Response({
            'permitido': _plan_permite(request.user, NIVEL_DOCUMENTOS),
            'avisos': avisos,
            'tipos': {
                'HORAS_EXTRA': {'disponible': bool(contrato), 'motivo': '' if contrato else 'Requiere contrato.'},
                'TELETRABAJO': {'disponible': bool(contrato), 'motivo': '' if contrato else 'Requiere contrato.'},
                'DESCUENTO': {'disponible': True, 'motivo': ''},
                'PERMISO_LEGAL': {'disponible': True, 'motivo': ''},
                'ENTREGA_EPP': {'disponible': True, 'motivo': ''},
                'INFORMACION_RIESGOS': {'disponible': _plan_permite(request.user, NIVEL_RIESGOS),
                                        'motivo': '' if _plan_permite(request.user, NIVEL_RIESGOS)
                                        else 'Disponible desde el plan Pyme.'},
                'INDEMNIZACION': {'disponible': anios >= 6,
                                  'motivo': '' if anios >= 6 else 'Desde el séptimo año de servicio (Art. 164).'},
            },
            'motivos_horas_extra': [{'valor': v, 'texto': t} for v, t in MOTIVOS_HORAS_EXTRA],
            # Cambiar horas extra por días libres (Ley 21.561) es desde Pyme.
            'compensaciones_horas_extra': [{'valor': v, 'texto': t} for v, t in COMPENSACIONES
                                           if v == 'PAGO' or permite_compensacion(request.user)],
            'conceptos_descuento': [{'valor': str(c.id), 'texto': c.nombre}
                                    for c in conceptos_descuento(request.user, emp.empresa)],
            'finalidades_descuento': [{'valor': v, 'texto': t} for v, t in FINALIDADES_DESCUENTO],
            'permisos': [{'valor': k, 'texto': f'{t} · {d} días {td}', 'desde_el_hecho': k in _DESDE_EL_HECHO}
                         for k, (t, d, td, _) in PERMISOS.items()],
            'porcentajes_indemnizacion': [{'valor': p, 'texto': f"{p.replace('.', ',')} %"}
                                          for p in PORCENTAJES_INDEMNIZACION],
            'modalidades_teletrabajo': [{'valor': v, 'texto': t} for v, t in MODALIDADES_TELETRABAJO],
            'lugares_teletrabajo': [{'valor': v, 'texto': t} for v, t in LUGARES_TELETRABAJO],
            'equipos_teletrabajo': [{'valor': v, 'texto': t} for v, t in EQUIPOS_TELETRABAJO],
            'dias_semana': [{'valor': v, 'texto': t.capitalize()} for v, t in DIAS_SEMANA],
            'horas_desconexion': [{'valor': h, 'texto': f'Desde las {h}'} for h in HORAS_DESCONEXION],
            'duraciones_teletrabajo': [{'valor': v, 'texto': t} for v, t in DURACIONES_TELETRABAJO],
            'epp': [{'valor': v, 'texto': t} for v, t in seguridad.EPP],
            'epp_sugeridos': seguridad.EPP_POR_RUBRO.get(emp.empresa.rubro, []),
            'motivos_epp': [{'valor': v, 'texto': t} for v, t in seguridad.MOTIVOS_EPP],
            'motivos_riesgos': [{'valor': v, 'texto': t} for v, t in seguridad.MOTIVOS_RIESGOS],
            'rubros': [{'valor': v, 'texto': t} for v, t in OPCIONES_RUBRO],
            'rubro_empresa': emp.empresa.rubro if emp.empresa.rubro in RUBROS else '',
            'riesgos': [{'valor': c, 'texto': r} for c, (r, _) in seguridad.riesgos().items()],
            'riesgos_por_rubro': {rubro: seguridad.riesgos_del_rubro(rubro) for rubro in RUBROS},
        })

    def create(self, request):
        tipo_pedido = request.data.get('tipo')
        # La entrega de EPP es para todos los planes; la información de riesgos, desde Pyme.
        if tipo_pedido == 'INFORMACION_RIESGOS' and not _plan_permite(request.user, NIVEL_RIESGOS):
            return Response({'error': 'Disponible desde el plan Pyme.'}, status=status.HTTP_403_FORBIDDEN)
        if tipo_pedido != 'ENTREGA_EPP' and not _plan_permite(request.user, NIVEL_DOCUMENTOS):
            return Response({'error': 'Disponible desde el plan Starter.'}, status=status.HTTP_403_FORBIDDEN)
        emp = self._empleado(request, request.data.get('empleado'))
        if emp is None:
            return Response({'error': 'Trabajador no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        tipo = request.data.get('tipo')
        datos = request.data.get('datos') or {}
        if not isinstance(datos, dict):
            return Response({'error': 'Datos inválidos.'}, status=status.HTTP_400_BAD_REQUEST)
        contrato = Contrato.objects.filter(empleado=emp).first()
        hoy = timezone.localdate()
        try:
            if tipo == 'TELETRABAJO':
                armado, avisos = _teletrabajo(emp, contrato, datos, hoy)
                anexo = AnexoContrato.objects.create(
                    contrato=contrato, tipo='TELETRABAJO', titulo='Pacto de trabajo a distancia o teletrabajo',
                    clausulas_modificadas=armado['clausulas'], datos=armado['datos'], fecha_emision=hoy,
                    vigencia_desde=armado['desde'])
                return Response({'anexo': anexo.id, 'avisos': avisos}, status=status.HTTP_201_CREATED)
            if tipo == 'DESCUENTO':
                armado, avisos = _descuento(emp, contrato, datos, hoy, request.user)
            elif tipo == 'HORAS_EXTRA':
                armado, avisos = _horas_extra(emp, contrato, datos, hoy, request.user)
            elif tipo in _CONSTRUCTORES:
                armado, avisos = _CONSTRUCTORES[tipo](emp, contrato, datos, hoy)
            else:
                return Response({'error': 'Tipo de documento inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        except DatoInvalido as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        doc = DocumentoLaboral.objects.create(empleado=emp, tipo=tipo, fecha_emision=hoy, **armado)
        return Response({**dato_documento(doc), 'avisos': avisos}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        doc = DocumentoLaboral.objects.filter(pk=pk, empleado__empresa__owner=request.user) \
            .select_related('empleado__empresa').first()
        if doc is None:
            return Response({'error': 'Documento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        nombre = f'{doc.tipo.title()}_{doc.empleado.rut}_{doc.fecha_emision}.pdf'
        firmado = pdf_firmado(doc.tipo, documento_laboral=doc)
        if firmado:
            return respuesta_pdf(firmado, nombre, firmado=True)
        return respuesta_pdf(pdf_documento_laboral(doc, not _plan_permite(request.user, 2)), nombre)

    @action(detail=True, methods=['post'])
    def anular(self, request, pk=None):
        """Deja sin efecto un documento que aún no se firma ni está en firma (soft delete)."""
        doc = DocumentoLaboral.objects.filter(pk=pk, empleado__empresa__owner=request.user, activo=True).first()
        if doc is None:
            return Response({'error': 'Documento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if doc.solicitudes_firma.filter(estado__in=_VIVAS).exists():
            return Response({'error': 'El documento está en firma o firmado: no se puede anular.'},
                            status=status.HTTP_400_BAD_REQUEST)
        doc.activo = False
        doc.save(update_fields=['activo'])
        return Response(dato_documento(doc))
