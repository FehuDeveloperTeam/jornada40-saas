"""Cálculo de la liquidación de sueldo (todo lo legal vive aquí)."""
from rest_framework.exceptions import ValidationError
from django.template.loader import get_template
from ..models import Contrato, ConceptoRemuneracion, Finiquito
from xhtml2pdf import pisa
from django.utils.text import slugify
import calendar
import datetime
import io
import math
from ..indicadores import obtener_uf, obtener_utm, calcular_impuesto_unico
from ..jornada import jornada_maxima_vigente
from num2words import num2words

from .base import logger
from .feriado import _contar_domingos_y_festivos
from .parametros import _anios_de_servicio, _parametros_previsionales, _tasas_afc, _tasas_afp, _tope_en_pesos


# Naturaleza previsional de cada tipo de partida. Se usa para los ítems que
# no tienen concepto del catálogo: los emitidos antes de que existiera.
_NATURALEZA_POR_TIPO = {
    'HABER_IMPONIBLE':    dict(es_imponible=True,  afecta_gratificacion=True,
                               afecta_semana_corrida=False),
    'HORA_EXTRA':         dict(es_imponible=True,  afecta_gratificacion=True,
                               afecta_semana_corrida=False),
    'COMISION':           dict(es_imponible=True,  afecta_gratificacion=True,
                               afecta_semana_corrida=True),
    'HABER_NO_IMPONIBLE': dict(es_imponible=False, afecta_gratificacion=False,
                               afecta_semana_corrida=False),
    'DESCUENTO':          dict(es_imponible=False, afecta_gratificacion=False,
                               afecta_semana_corrida=False),
}

# Listas del formato anterior y la naturaleza que representaba cada una.
_TIPOS_POR_LISTA = {
    'detalle_haberes_imponibles':    'HABER_IMPONIBLE',
    'detalle_horas_extras':          'HORA_EXTRA',
    'detalle_haberes_no_imponibles': 'HABER_NO_IMPONIBLE',
    'detalle_otros_descuentos':      'DESCUENTO',
    'detalle_comisiones':            'COMISION',
}


def _items_desde_payload(data) -> list:
    """Detalle unificado a partir del payload.

    Acepta el formato nuevo y el anterior de listas separadas, para que un
    cliente que todavía no se actualizó siga funcionando durante el despliegue.
    """
    if data.get('detalle_items') is not None:
        return [dict(i) for i in (data.get('detalle_items') or []) if isinstance(i, dict)]

    items = []
    for lista, naturaleza in _TIPOS_POR_LISTA.items():
        for item in (data.get(lista) or []):
            if isinstance(item, dict):
                items.append({**item, 'naturaleza': naturaleza})
    return items


def _concepto_comision(nombre: str, empresa):
    """Concepto de comisión de la empresa, creándolo si es la primera vez.

    Las categorías de comisión son propias de cada empresa (Carrocería, Piezas
    de motor), así que no pueden venir en el catálogo del sistema. Se crean al
    vuelo para que configurar el contrato no obligue a pasar antes por el
    mantenedor de conceptos.
    """
    nombre = nombre.strip()
    existente = ConceptoRemuneracion.objects.filter(
        empresa=empresa, tipo='COMISION', nombre__iexact=nombre).first()
    if existente:
        return existente

    base = (slugify(nombre).upper().replace('-', '_') or 'COMISION')[:36]
    codigo, sufijo = base, 1
    while ConceptoRemuneracion.objects.filter(empresa=empresa, codigo=codigo).exists():
        sufijo += 1
        codigo = f'{base[:34]}_{sufijo}'

    return ConceptoRemuneracion.objects.create(
        empresa=empresa, tipo='COMISION', codigo=codigo, nombre=nombre)


def _normalizar_comisiones_config(config, empresa) -> list:
    """Deja cada categoría de comisión referenciada por concepto del catálogo.

    Antes se identificaban por su glosa, así que renombrar una categoría
    rompía la correspondencia con las liquidaciones ya emitidas y su comisión
    pasaba a calcularse en cero. El id del concepto no cambia al renombrar.
    """
    normalizada = []
    for entrada in (config or []):
        if not isinstance(entrada, dict):
            continue
        porcentaje = float(entrada.get('porcentaje', 0) or 0)
        nombre = str(entrada.get('glosa', '') or '').strip()

        if nombre:
            concepto = _concepto_comision(nombre, empresa)
        elif entrada.get('concepto'):
            concepto = ConceptoRemuneracion.objects.filter(
                id=entrada['concepto'], tipo='COMISION').first()
        else:
            continue

        if concepto is not None:
            normalizada.append({'concepto': concepto.id, 'porcentaje': porcentaje})
    return normalizada


def _porcentajes_comision(config) -> dict:
    """Porcentaje por categoría, indexado por concepto y también por nombre.

    La doble clave permite resolver tanto los ítems nuevos (que traen el
    concepto) como los emitidos antes del catálogo (que solo tienen glosa).
    """
    porcentajes = {}
    ids = [c.get('concepto') for c in (config or []) if c.get('concepto')]
    nombres = {c.id: c.nombre for c in ConceptoRemuneracion.objects.filter(id__in=ids)}

    for entrada in (config or []):
        if not isinstance(entrada, dict):
            continue
        porcentaje = float(entrada.get('porcentaje', 0) or 0)
        concepto_id = entrada.get('concepto')
        if concepto_id:
            porcentajes[concepto_id] = porcentaje
            if concepto_id in nombres:
                porcentajes[nombres[concepto_id]] = porcentaje
        glosa = str(entrada.get('glosa', '') or '').strip()
        if glosa:
            porcentajes[glosa] = porcentaje
    return porcentajes


def _conceptos_por_id(items) -> dict:
    """Conceptos referenciados por una lista de ítems, en una sola consulta."""
    ids = {item.get('concepto') for item in items if item.get('concepto')}
    if not ids:
        return {}
    return {c.id: c for c in ConceptoRemuneracion.objects.filter(id__in=ids)}


def _validar_conceptos(data, user):
    """Comprueba que cada ítem use un concepto válido y del tipo correcto.

    Se valida antes de calcular para poder responder un 400 explicativo en vez
    de fallar a mitad del cálculo.
    """
    items = _items_desde_payload(data)
    conceptos = _conceptos_por_id(items)

    # El recargo de las horas extras no puede ser menor al 50 % (Art. 32 del
    # Código del Trabajo). Uno mayor es decisión del empleador; uno menor
    # dejaría mal calculada la liquidación.
    for item in items:
        if item.get('naturaleza') != 'HORA_EXTRA' or item.get('recargo') in (None, ''):
            continue
        try:
            recargo = float(item['recargo'])
        except (TypeError, ValueError):
            raise ValidationError({'error': f'Recargo inválido en «{item.get("glosa", "hora extra")}».'})
        if recargo < 50:
            raise ValidationError({'error': (
                f'«{item.get("glosa", "Hora extra")}»: el recargo mínimo legal de las horas extras '
                f'es 50 % (Art. 32 del Código del Trabajo).')})

    for item in items:
        concepto_id = item.get('concepto')
        if not concepto_id:
            continue  # ítem sin catálogo: se acepta por compatibilidad
        concepto = conceptos.get(concepto_id)
        if concepto is None:
            raise ValidationError({'error': f'El concepto {concepto_id} no existe.'})
        if concepto.empresa_id is not None and concepto.empresa.owner_id != user.id:
            raise ValidationError(
                {'error': f'El concepto «{concepto.nombre}» no pertenece a tus empresas.'})
        naturaleza = item.get('naturaleza')
        if naturaleza and concepto.tipo != naturaleza:
            raise ValidationError({'error': (
                f'«{concepto.nombre}» es un {concepto.get_tipo_display().lower()} '
                f'y no puede registrarse como {naturaleza.replace("_", " ").lower()}.')})


def _terminos_vigentes(contrato) -> dict:
    """Condiciones contractuales de hoy — se usan al emitir una liquidación nueva."""
    return {
        'sueldo_base_contrato': contrato.sueldo_base,
        'horas_semanales_contrato': float(getattr(contrato, 'horas_semanales', 0) or 0)
                                    or float(jornada_maxima_vigente()),
        'gratificacion_legal': contrato.gratificacion_legal,
        'tipo_contrato': contrato.tipo_contrato,
        'anticipo_quincena': (contrato.monto_quincena or 0) if contrato.tiene_quincena else 0,
        'valor_uf': obtener_uf(),
        'porcentajes_comision': _porcentajes_comision(contrato.comisiones_config),
    }


def _terminos_congelados(liquidacion, contrato) -> dict:
    """Condiciones con las que se emitió una liquidación existente.

    Al editarla se recalcula con estos valores y no con los del contrato
    vigente: una liquidación de marzo no debe recalcularse con el sueldo o la
    comisión que se pactaron en junio. Los porcentajes de comisión se leen de
    la fila guardada en BD, nunca del payload, para que no puedan alterarse.

    Las liquidaciones anteriores a esta funcionalidad no tienen los términos
    guardados; en ese caso se cae al contrato vigente como mejor aproximación.
    """
    if not liquidacion.sueldo_base_contrato:
        return _terminos_vigentes(contrato)

    porcentajes = {}
    for item in liquidacion.items_de('COMISION'):
        porcentaje = float(item.get('porcentaje', 0) or 0)
        if item.get('concepto'):
            porcentajes[item['concepto']] = porcentaje
        if item.get('glosa'):
            porcentajes[str(item['glosa'])] = porcentaje
    # Una categoría agregada al contrato después de emitir esta liquidación
    # todavía no tiene porcentaje histórico: se toma el del contrato.
    for glosa, porcentaje in _terminos_vigentes(contrato)['porcentajes_comision'].items():
        porcentajes.setdefault(glosa, porcentaje)

    return {
        'sueldo_base_contrato': liquidacion.sueldo_base_contrato,
        # Las emitidas antes de congelar las horas usan las del contrato.
        'horas_semanales_contrato': float(liquidacion.horas_semanales_contrato
                                          or contrato.horas_semanales or jornada_maxima_vigente()),
        'gratificacion_legal': liquidacion.gratificacion_legal or contrato.gratificacion_legal,
        'tipo_contrato': liquidacion.tipo_contrato or contrato.tipo_contrato,
        'anticipo_quincena': liquidacion.anticipo_quincena or 0,
        'valor_uf': float(liquidacion.valor_uf) or obtener_uf(),
        'porcentajes_comision': porcentajes,
    }


class PeriodoSinContrato(ValueError):
    """El período liquidado es anterior al inicio del contrato."""


def _dias_fuera_de_contrato(contrato, empleado, mes, anio):
    """Días del mes comercial (30) en que no hubo contrato: los anteriores al
    inicio y, si el trabajador ya fue desvinculado, los posteriores al término
    del plazo fijo. Así quien entra a mitad de mes no recibe 30 días aunque se
    emita con los valores por defecto (la emisión masiva).

    El término de un plazo fijo con el trabajador aún activo no descuenta:
    siguió trabajando y el contrato pasó a indefinido (Art. 159 N°4).
    """
    if not (1 <= mes <= 12) or not anio:
        return 0
    inicio_mes = datetime.date(anio, mes, 1)
    ultimo_dia = calendar.monthrange(anio, mes)[1]
    fin_mes = datetime.date(anio, mes, ultimo_dia)
    # Un contrato rehecho puede tener fecha de inicio posterior al ingreso
    # real: manda la más antigua.
    inicio = min([f for f in (getattr(contrato, 'fecha_inicio', None), getattr(empleado, 'fecha_ingreso', None))
                  if isinstance(f, datetime.date)], default=None)
    fin = getattr(contrato, 'fecha_fin', None)
    # Desvinculado con finiquito: el término efectivo es la fecha del finiquito.
    if getattr(empleado, 'activo', True) is False and getattr(empleado, 'pk', None):
        termino = (Finiquito.objects.filter(empleado_id=empleado.pk).order_by('-fecha_termino')
                   .values_list('fecha_termino', flat=True).first())
        if termino:
            fin = termino
    if inicio and inicio > fin_mes:
        raise PeriodoSinContrato(
            f'El contrato empieza el {inicio.strftime("%d-%m-%Y")}: no hay remuneraciones que liquidar en ese período.')
    antes = min(inicio.day - 1, 30) if inicio and inicio > inicio_mes else 0
    despues = 0
    if isinstance(fin, datetime.date) and getattr(empleado, 'activo', True) is False and inicio_mes <= fin < fin_mes:
        despues = max(30 - fin.day, 0)
    return min(antes + despues, 30)


def _calcular_liquidacion(contrato, empleado, data, terminos=None):
    """
    Calcula todos los campos derivados de una liquidación (haberes, descuentos
    legales, impuesto único y totales) a partir de los datos de asistencia y
    los arreglos dinámicos de haberes/descuentos.

    Usada tanto por LiquidacionViewSet.create() como por .update(), para que
    editar una liquidación existente recalcule los totales de la misma forma
    que al crearla (en vez de dejarlos congelados con los valores viejos).

    `terminos` son las condiciones contractuales a aplicar (ver
    _terminos_vigentes / _terminos_congelados). Sin él se usa el contrato actual.
    """
    if terminos is None:
        terminos = _terminos_vigentes(contrato)

    # Período liquidado: define qué parámetros legales aplican.
    mes = int(data.get('mes') or 0)
    anio = int(data.get('anio') or 0)
    parametros = _parametros_previsionales(mes, anio)
    valor_uf = terminos['valor_uf']
    # 1. ASISTENCIA
    dias_trabajados = int(data.get('dias_trabajados', 30))
    dias_ausencia = int(data.get('dias_ausencia', 0))
    dias_licencia = int(data.get('dias_licencia', 0))
    dias_no_contratados = max(int(data.get('dias_no_contratados', 0) or 0),
                              _dias_fuera_de_contrato(contrato, empleado, mes, anio))
    dias_trabajados = min(dias_trabajados, 30 - dias_no_contratados)

    # Los días a pagar de sueldo base son 30 menos las ausencias y licencias
    dias_a_pagar = 30 - dias_ausencia - dias_licencia - dias_no_contratados
    if dias_a_pagar < 0: dias_a_pagar = 0

    # 2. DETALLE DE HABERES Y DESCUENTOS (lista única)
    items = _items_desde_payload(data)
    conceptos = _conceptos_por_id(items)

    # La glosa y la naturaleza se toman del concepto y quedan guardadas en el
    # ítem: una liquidación que no se vuelve a tocar conserva el nombre que
    # tenía el día que se emitió. Al editarla se re-derivan, porque editar es
    # volver a emitirla y ahí corresponde el nombre vigente.
    for item in items:
        concepto = conceptos.get(item.get('concepto'))
        if concepto is not None:
            item['glosa'] = concepto.nombre
            item['naturaleza'] = concepto.tipo

    # 2b. COMISIONES (remuneración variable, Art. 45 Código del Trabajo)
    # El valor se recalcula acá y no se toma del payload: el porcentaje sale
    # de los términos resueltos en el servidor (contrato vigente o los
    # congelados en la liquidación), así que no puede alterarse desde el
    # navegador. El input solo aporta el monto vendido del mes.
    porcentajes_comision = terminos['porcentajes_comision']
    for item in items:
        if item.get('naturaleza') != 'COMISION':
            continue
        monto_vendido = int(item.get('monto_vendido', 0) or 0)
        # Por concepto primero; la glosa solo cubre lo emitido antes del catálogo.
        porcentaje = porcentajes_comision.get(
            item.get('concepto'), porcentajes_comision.get(str(item.get('glosa', '')), 0))
        item['monto_vendido'] = monto_vendido
        item['porcentaje'] = porcentaje
        item['valor'] = math.floor(monto_vendido * porcentaje / 100)

    # 2c. HORAS EXTRA (Arts. 30 a 32 Código del Trabajo)
    # Igual que las comisiones, el valor se calcula acá: valor hora ordinaria
    # = sueldo / 30 × 7 / horas semanales, con el sueldo y las horas del
    # contrato (congelados en la liquidación). Antes llegaba calculado desde el
    # navegador con las horas de la ficha del trabajador, que pueden no ser
    # las pactadas. El input aporta solo horas y recargo. Los ítems sin horas
    # (anteriores a este cálculo) conservan su valor.
    horas_contrato = float(terminos.get('horas_semanales_contrato') or jornada_maxima_vigente())
    valor_hora_ordinaria = terminos['sueldo_base_contrato'] / 30 * 7 / horas_contrato
    for item in items:
        if item.get('naturaleza') != 'HORA_EXTRA' or 'horas' not in item:
            continue
        horas = float(item.get('horas') or 0)
        recargo = item.get('recargo')
        recargo = 50.0 if recargo in (None, '') else float(recargo)  # mínimo legal: 50 %
        item['horas'] = horas
        item['recargo'] = recargo
        # Redondeo al entero más cercano, igual que la vista previa del panel.
        item['valor'] = math.floor(valor_hora_ordinaria * (1 + recargo / 100) * horas + 0.5)

    # La naturaleza previsional la define el concepto; los ítems anteriores al
    # catálogo no lo tienen y usan la congelada en el propio ítem.
    def _naturaleza(item):
        concepto = conceptos.get(item.get('concepto'))
        if concepto is None:
            return _NATURALEZA_POR_TIPO[item.get('naturaleza', 'HABER_IMPONIBLE')]
        return {
            'es_imponible': concepto.es_imponible,
            'afecta_gratificacion': concepto.afecta_gratificacion,
            'afecta_semana_corrida': concepto.afecta_semana_corrida,
        }

    haberes = [(i, _naturaleza(i)) for i in items if i.get('naturaleza') != 'DESCUENTO']
    descuentos = [i for i in items if i.get('naturaleza') == 'DESCUENTO']

    suma_imponibles_extra = sum(int(i.get('valor', 0)) for i, n in haberes if n['es_imponible'])
    suma_no_imponibles = sum(int(i.get('valor', 0)) for i, n in haberes if not n['es_imponible'])
    suma_gratificable_extra = sum(
        int(i.get('valor', 0)) for i, n in haberes if n['afecta_gratificacion'])
    suma_otros_descuentos = sum(int(item.get('valor', 0)) for item in descuentos)

    # 2c. SEMANA CORRIDA (Art. 45) — método mensual simplificado.
    # La base es todo haber que el catálogo marque como remuneración variable,
    # típicamente las comisiones. Las horas extras quedan excluidas
    # explícitamente por el Art. 32 inciso final del Código del Trabajo.
    base_variable = sum(
        int(i.get('valor', 0)) for i, n in haberes if n['afecta_semana_corrida'])
    semana_corrida = 0
    if base_variable > 0 and dias_a_pagar > 0 and mes and anio:
        promedio_diario_variable = base_variable / dias_a_pagar
        dias_descanso = _contar_domingos_y_festivos(mes, anio)
        semana_corrida = math.floor(promedio_diario_variable * dias_descanso)

    # 3. CÁLCULO DE HABERES
    sueldo_base_mensual = terminos['sueldo_base_contrato']
    sueldo_base_proporcional = math.floor((sueldo_base_mensual / 30) * dias_a_pagar)

    # Gratificación: tope legal de 4,75 ingresos mínimos mensuales al año
    tope_gratificacion = math.floor(
        parametros['factor_gratificacion'] * parametros['ingreso_minimo_mensual'] / 12
    )
    # Gratificable e imponible no son lo mismo: un haber puede cotizar sin
    # entrar a la base de gratificación. Hasta ahora coincidían porque la
    # clasificación dependía de la lista; con el catálogo pueden diferir.
    base_gratificacion = (
        sueldo_base_proporcional + suma_gratificable_extra + semana_corrida
    )
    gratificacion_calculada = math.floor(base_gratificacion * 0.25)
    gratificacion_final = min(gratificacion_calculada, tope_gratificacion) if terminos['gratificacion_legal'] == 'MENSUAL' else 0

    base_imponible = (
        sueldo_base_proporcional + suma_imponibles_extra + semana_corrida
    )
    total_imponible = base_imponible + gratificacion_final
    total_haberes = total_imponible + suma_no_imponibles

    # 4. CÁLCULO DE DESCUENTOS LEGALES
    # Las cotizaciones se calculan sobre la renta imponible TOPADA, no sobre el
    # total imponible: lo que excede el tope legal no cotiza. AFP y salud
    # comparten tope; el seguro de cesantía tiene uno propio, más alto.
    tope_afp = _tope_en_pesos(parametros['tope_imponible_afp_uf'], valor_uf)
    tope_afc = _tope_en_pesos(parametros['tope_imponible_afc_uf'], valor_uf)
    renta_imponible_afp = min(total_imponible, tope_afp)
    renta_imponible_afc = min(total_imponible, tope_afc)

    nombre_afp = (empleado.afp or 'MODELO').upper()
    tasa_afp = _tasas_afp(mes, anio).get(nombre_afp, 0.11)
    afp_monto = math.floor(renta_imponible_afp * tasa_afp)

    # Salud (Isapre UF vs Fonasa 7%)
    tasa_salud = parametros['tasa_salud']
    salud_nombre = (empleado.sistema_salud or 'FONASA').upper()
    if salud_nombre == 'ISAPRE' and empleado.plan_isapre_uf > 0:
        salud_monto = math.floor(float(empleado.plan_isapre_uf) * valor_uf)
        isapre_uf = empleado.plan_isapre_uf
        # La ley exige descontar al menos el 7%, si el plan UF es menor, se cobra 7%
        minimo_legal = math.floor(renta_imponible_afp * tasa_salud)
        if salud_monto < minimo_legal:
            salud_monto = minimo_legal
    else:
        salud_monto = math.floor(renta_imponible_afp * tasa_salud)
        isapre_uf = 0

    # Seguro Cesantía: 0,6 % del trabajador indefinido, salvo desde el año 11
    # de la relación laboral, en que deja de cotizar (antes se le descontaba
    # igual y su líquido salía menor).
    tasa_afc_trabajador, _ = _tasas_afc(
        parametros, terminos['tipo_contrato'],
        _anios_de_servicio(empleado, contrato, data.get('mes'), data.get('anio')))
    seguro_cesantia = math.floor(renta_imponible_afc * tasa_afc_trabajador)

    # Impuesto Único de Segunda Categoría
    base_tributable = total_imponible - afp_monto - salud_monto - seguro_cesantia
    impuesto_unico = calcular_impuesto_unico(base_tributable, obtener_utm())

    # Quincena y otros
    anticipo_quincena = terminos['anticipo_quincena']
    total_descuentos = afp_monto + salud_monto + seguro_cesantia + impuesto_unico + anticipo_quincena + suma_otros_descuentos

    # 5. SUELDO LÍQUIDO FINAL
    sueldo_liquido = total_haberes - total_descuentos

    return {
        'dias_trabajados': dias_trabajados, 'dias_licencia': dias_licencia,
        'dias_ausencia': dias_ausencia, 'dias_no_contratados': dias_no_contratados,
        'sueldo_base': sueldo_base_proporcional, 'gratificacion': gratificacion_final,
        'detalle_items': items, 'semana_corrida': semana_corrida,
        'afp_nombre': nombre_afp, 'afp_monto': afp_monto,
        'salud_nombre': salud_nombre, 'isapre_cotizacion_uf': isapre_uf, 'salud_monto': salud_monto,
        'seguro_cesantia': seguro_cesantia, 'impuesto_unico': impuesto_unico, 'anticipo_quincena': anticipo_quincena,
        'sueldo_base_contrato': terminos['sueldo_base_contrato'],
        'horas_semanales_contrato': round(horas_contrato, 1),
        'gratificacion_legal': terminos['gratificacion_legal'],
        'tipo_contrato': terminos['tipo_contrato'],
        'valor_uf': round(valor_uf, 2),
        'total_imponible': total_imponible, 'total_haberes': total_haberes,
        'total_descuentos': total_descuentos, 'sueldo_liquido': sueldo_liquido,
    }


def _pdf_liquidacion(liquidacion, es_plan_semilla):
    """PDF de una liquidación en bytes, o None si xhtml2pdf falla."""
    empleado = liquidacion.empleado
    empresa = empleado.empresa
    contrato = Contrato.objects.filter(empleado=empleado).first()
    meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
             "Septiembre", "Octubre", "Noviembre", "Diciembre"]

    # Transformar número a palabras (Ej: 542000 -> "quinientos cuarenta y dos mil")
    liquido_palabras = num2words(int(liquidacion.sueldo_liquido or 0), lang='es')

    agrupados = liquidacion.items_agrupados
    suma_no_imponibles = sum(int(i.get('valor', 0)) for i in agrupados['no_imponibles'] if isinstance(i, dict))
    suma_otros_descuentos = sum(int(i.get('valor', 0)) for i in agrupados['descuentos'] if isinstance(i, dict))
    total_ley = ((liquidacion.afp_monto or 0) + (liquidacion.salud_monto or 0)
                 + (liquidacion.seguro_cesantia or 0) + (liquidacion.impuesto_unico or 0))
    total_otros_dsctos = (liquidacion.anticipo_quincena or 0) + suma_otros_descuentos

    html = get_template('liquidacion.html').render({
        'liquidacion': liquidacion, 'empleado': empleado, 'empresa': empresa, 'contrato': contrato,
        'mes_nombre': meses[liquidacion.mes - 1].upper(), 'liquido_palabras': liquido_palabras,
        'total_no_imponible': suma_no_imponibles, 'total_ley': total_ley,
        'total_otros_dsctos': total_otros_dsctos, 'es_plan_semilla': es_plan_semilla,
    })
    salida = io.BytesIO()
    if pisa.CreatePDF(html, dest=salida).err:
        logger.error('xhtml2pdf no pudo generar la liquidación %s', liquidacion.id)
        return None
    return salida.getvalue()
