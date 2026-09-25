"""Finiquito: cálculo legal e indemnizaciones."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import NotFound, ValidationError
from django.utils import timezone
from ..models import Empleado, Contrato, Liquidacion, SolicitudFirma, Finiquito, ConceptoRemuneracion
from xhtml2pdf import pisa
import datetime
import io
import math
from ..indicadores import obtener_uf, obtener_utm, calcular_impuesto_unico
from dateutil.relativedelta import relativedelta
from html import escape as _esc
from django.db.models import Q
from ..serializers import FiniquitoSerializer

from .base import _MESES, _plan_permite, pdf_firmado, respuesta_pdf
from .feriado import _dias_progresivos_del_anio, _es_dia_habil_feriado, calcular_saldo_vacaciones
from .parametros import _anios_de_servicio, _parametros_previsionales, _tasas_afc, _tasas_afp, _tope_en_pesos


# ==========================================
# FINIQUITO
# ==========================================

# Causales que dan derecho a indemnización por años (Art. 161)
_CAUSALES_CON_INDEMNIZACION = {'161_1', '161_2', '163bis'}
# Tope de la base de las indemnizaciones por término (Art. 172 inc. final).
_TOPE_BASE_INDEMNIZACION_UF = 90
# Tope de años de la indemnización por años de servicio (Art. 163 inc. 2°):
# 330 días de remuneración para contratos posteriores al 14-08-1981.
_TOPE_ANIOS_INDEMNIZACION = 11
# Contratos vigentes desde antes del 14-08-1981 no tienen ese tope de años
# (Código del Trabajo, art. 7° transitorio). El tope de 90 UF de la base sí rige.
_FECHA_SIN_TOPE_ANIOS = datetime.date(1981, 8, 14)


def _anios_indemnizacion(fecha_ingreso, fecha_termino) -> int:
    """Años para la indemnización del Art. 163: 30 días por año de servicio y
    fracción superior a seis meses, con tope de 11. Exige un año o más de
    contrato vigente."""
    if not fecha_ingreso or fecha_termino < fecha_ingreso:
        return 0
    tiempo = relativedelta(fecha_termino, fecha_ingreso)
    if tiempo.years < 1:
        return 0
    anios = tiempo.years
    # Fracción superior a seis meses: más de 6 meses cumplidos (6 meses y 1 día).
    if tiempo.months > 6 or (tiempo.months == 6 and tiempo.days > 0):
        anios += 1
    if fecha_ingreso < _FECHA_SIN_TOPE_ANIOS:
        return anios
    return min(anios, _TOPE_ANIOS_INDEMNIZACION)


def _feriado_proporcional_habiles(empleado, fecha_termino) -> float:
    """Días hábiles de feriado ganados en el año en curso y no completados
    (Art. 73): 15 días por año, es decir 1,25 por mes, desde el último
    aniversario hasta el término."""
    if not empleado.fecha_ingreso or fecha_termino < empleado.fecha_ingreso:
        return 0.0
    tiempo = relativedelta(fecha_termino, empleado.fecha_ingreso)
    # El año en curso devenga también sus días progresivos (Art. 68).
    dias_anuales = 15 + _dias_progresivos_del_anio(empleado, tiempo.years + 1)
    return round((tiempo.months + tiempo.days / 30) * dias_anuales / 12, 2)


def _dias_corridos_de_feriado(fecha_termino, dias_habiles: float) -> float:
    """Convierte días hábiles de feriado a días corridos para pagarlos.

    Criterio de la Dirección del Trabajo: se cuentan desde el día siguiente al
    término y se agregan los sábados, domingos y feriados que caigan en ese
    período. La fracción de día que sobra se paga tal cual.
    """
    enteros = int(dias_habiles)
    fraccion = round(dias_habiles - enteros, 2)
    corridos = 0
    fecha = fecha_termino
    contados = 0
    while contados < enteros:
        fecha += datetime.timedelta(days=1)
        corridos += 1
        if _es_dia_habil_feriado(fecha):
            contados += 1
    return corridos + fraccion


def _gratificacion_anual_proporcional(empleado, sueldo_base, fecha_termino, sueldo_ultimo_mes, parametros):
    """Gratificación proporcional del año en que termina un contrato con gratificación anual (Art. 52).

    Se calcula con la modalidad del Art. 50: 25 % de las remuneraciones
    devengadas en el año calendario hasta el término, con tope de 4,75
    ingresos mínimos mensuales proporcional a los meses trabajados. Si la
    empresa paga por utilidades (Art. 47), el monto debe ajustarse: se avisa.

    Devuelve el monto y el detalle por mes (base imponible de cada mes), que
    sirve para distribuir cotizaciones e impuesto en los meses devengados.
    """
    inicio = datetime.date(fecha_termino.year, 1, 1)
    desde = max(inicio, empleado.fecha_ingreso) if empleado.fecha_ingreso else inicio
    if desde > fecha_termino:
        return 0, [], 0, 0.0, 0
    liquidaciones = {l.mes: l for l in Liquidacion.objects.filter(
        empleado=empleado, anio=fecha_termino.year, mes__gte=desde.month, mes__lt=fecha_termino.month)}
    meses = []
    for mes in range(desde.month, fecha_termino.month):
        liq = liquidaciones.get(mes)
        if liq:
            base = int(liq.total_imponible or 0) - int(liq.gratificacion or 0)
        elif mes == desde.month and desde.day > 1:
            base = math.floor(sueldo_base / 30 * (31 - desde.day))  # ingreso a mitad de mes
        else:
            base = sueldo_base
        meses.append((mes, max(base, 0)))
    meses.append((fecha_termino.month, sueldo_ultimo_mes))
    devengado = sum(b for _, b in meses)
    tiempo = relativedelta(fecha_termino + datetime.timedelta(days=1), desde)
    meses_trabajados = min(12.0, tiempo.years * 12 + tiempo.months + tiempo.days / 30)
    tope = math.floor(parametros['factor_gratificacion'] * parametros['ingreso_minimo_mensual'] * meses_trabajados / 12)
    return min(math.floor(devengado * 0.25), tope), meses, devengado, round(meses_trabajados, 2), tope


# Haberes que el Art. 172 excluye de la base (asignación familiar legal,
# aguinaldos) o que no remuneran servicios sino que reembolsan gastos o
# cubren un beneficio legal (Art. 41 inc. 2°). Colación y movilización
# pagadas cada mes sí entran: criterio mayoritario de la Corte Suprema.
_EXCLUIDOS_BASE_INDEMNIZACION = {'ASIGNACION_FAMILIAR', 'AGUINALDO', 'VIATICO', 'PERDIDA_CAJA',
                                 'DESGASTE_HERRAMIENTAS', 'SALA_CUNA'}


def _base_indemnizacion_art172(empleado, sueldo_base, fecha_termino, gratificacion_mensual_pactada, tope_gratificacion):
    """Última remuneración mensual para las indemnizaciones (Art. 172).

    Sueldo base del contrato + los haberes que se pagan regularmente, tomados
    de las últimas tres liquidaciones: lo fijo (bonos mensuales, colación,
    movilización) y lo variable (comisiones, semana corrida, tratos) por su
    promedio, como ordena el inciso 2°. Un haber que aparece en un solo mes
    de tres es esporádico y queda fuera; las horas extra, siempre.
    La gratificación mensual pactada se suma sobre esa base con su tope.

    Devuelve (base sin tope, líneas del detalle, meses usados).
    """
    liquidaciones = list(Liquidacion.objects.filter(empleado=empleado)
                         .filter(Q(anio__lt=fecha_termino.year) | Q(anio=fecha_termino.year, mes__lte=fecha_termino.month))
                         .order_by('-anio', '-mes')[:3])
    n = len(liquidaciones)
    codigos = dict(ConceptoRemuneracion.objects.filter(
        id__in={i.get('concepto') for l in liquidaciones for i in (l.detalle_items or []) if i.get('concepto')}
    ).values_list('id', 'codigo'))

    haberes = {}   # clave → [glosa, total, meses presente, variable, afecta gratificación]
    for liq in liquidaciones:
        vistos = set()
        for item in liq.detalle_items or []:
            naturaleza = item.get('naturaleza')
            if naturaleza not in ('HABER_IMPONIBLE', 'HABER_NO_IMPONIBLE', 'COMISION'):
                continue
            if codigos.get(item.get('concepto')) in _EXCLUIDOS_BASE_INDEMNIZACION:
                continue
            clave = item.get('concepto') or (item.get('glosa') or '').strip().lower()
            h = haberes.setdefault(clave, [item.get('glosa') or 'Haber', 0, 0, naturaleza == 'COMISION',
                                           naturaleza != 'HABER_NO_IMPONIBLE'])
            h[1] += int(item.get('valor') or 0)
            if clave not in vistos:
                h[2] += 1
                vistos.add(clave)
        if liq.semana_corrida:
            h = haberes.setdefault('semana_corrida', ['Semana corrida', 0, 0, True, True])
            h[1] += int(liq.semana_corrida)
            h[2] += 1

    lineas = [{'glosa': 'Sueldo base', 'monto': sueldo_base}]
    afecto_gratificacion = sueldo_base
    for glosa, total, presente, variable, afecta in haberes.values():
        # Lo variable se promedia siempre; lo fijo solo si se repite.
        if not variable and n > 1 and presente < 2:
            continue
        # Lo variable, promedio de los meses (inc. 2°); lo fijo, su monto mensual.
        monto = math.floor(total / (n if variable else presente))
        if monto <= 0:
            continue
        lineas.append({'glosa': f'{glosa} (promedio {n} {"mes" if n == 1 else "meses"})' if variable else glosa,
                       'monto': monto})
        if afecta:
            afecto_gratificacion += monto
    if gratificacion_mensual_pactada:
        lineas.append({'glosa': 'Gratificación mensual', 'monto': min(math.floor(afecto_gratificacion * 0.25), tope_gratificacion)})
    return sum(l['monto'] for l in lineas), lineas, n


def _calcular_finiquito(empleado, fecha_termino, dias_trabajados_ultimo_mes, causal_articulo,
                        aviso_previo_dado=False, otros_haberes=0, otros_descuentos=0):
    """Montos del finiquito y su detalle. Todo lo legal se calcula aquí.

    El usuario solo aporta hechos (causal, fecha, días trabajados, si dio el
    aviso previo) y montos voluntarios (otros haberes y descuentos): nunca
    los montos que fija la ley.
    """
    contrato = Contrato.objects.filter(empleado=empleado).first()
    sueldo_base = contrato.sueldo_base if contrato else empleado.sueldo_base
    tipo_contrato = contrato.tipo_contrato if contrato else 'INDEFINIDO'
    gratificacion_mensual_pactada = (contrato.gratificacion_legal if contrato else 'MENSUAL') == 'MENSUAL'

    parametros = _parametros_previsionales(fecha_termino.month, fecha_termino.year)
    valor_uf = obtener_uf()
    tope_gratificacion = math.floor(parametros['factor_gratificacion'] * parametros['ingreso_minimo_mensual'] / 12)

    # ── Remuneración del último mes ──────────────────────────────────────
    dias = max(0, min(30, int(dias_trabajados_ultimo_mes)))
    sueldo_proporcional = math.floor((sueldo_base / 30) * dias)
    grat_anual = None
    if gratificacion_mensual_pactada:
        gratificacion = min(math.floor(sueldo_proporcional * 0.25), tope_gratificacion)
    else:
        grat_anual = _gratificacion_anual_proporcional(empleado, sueldo_base, fecha_termino, sueldo_proporcional, parametros)
        gratificacion = grat_anual[0]

    # ── Feriado: saldo de años cumplidos + proporcional del año en curso ──
    saldo = calcular_saldo_vacaciones(empleado, hasta=fecha_termino)['dias_disponibles']
    proporcional = _feriado_proporcional_habiles(empleado, fecha_termino)
    dias_habiles_feriado = round(saldo + proporcional, 2)
    dias_corridos_feriado = _dias_corridos_de_feriado(fecha_termino, dias_habiles_feriado)
    feriado = math.floor((sueldo_base / 30) * dias_corridos_feriado)

    # ── Indemnizaciones (Arts. 161, 162, 163, 163 bis y 172) ──────────────
    # Base: última remuneración mensual (Art. 172), con tope de 90 UF.
    base_indemnizacion_sin_tope, base_lineas, base_meses = _base_indemnizacion_art172(
        empleado, sueldo_base, fecha_termino, gratificacion_mensual_pactada, tope_gratificacion)
    tope_base = _tope_en_pesos(_TOPE_BASE_INDEMNIZACION_UF, valor_uf)
    base_indemnizacion = min(base_indemnizacion_sin_tope, tope_base)
    con_indemnizacion = causal_articulo in _CAUSALES_CON_INDEMNIZACION
    anios = _anios_indemnizacion(empleado.fecha_ingreso, fecha_termino) if con_indemnizacion else 0
    indemnizacion_anos = base_indemnizacion * anios
    sustitutiva = base_indemnizacion if (con_indemnizacion and not aviso_previo_dado) else 0

    # ── Descuentos legales sobre la remuneración del último mes ───────────
    # La gratificación anual no entra aquí: se distribuye más abajo.
    imponible = sueldo_proporcional + (0 if grat_anual else gratificacion)
    tope_afp = _tope_en_pesos(parametros['tope_imponible_afp_uf'], valor_uf)
    tope_afc = _tope_en_pesos(parametros['tope_imponible_afc_uf'], valor_uf)
    renta_afp = min(imponible, tope_afp)
    renta_afc = min(imponible, tope_afc)
    nombre_afp = (empleado.afp or 'MODELO').upper()
    tasa_afp = _tasas_afp(fecha_termino.month, fecha_termino.year).get(nombre_afp, 0.11)
    afp_monto = math.floor(renta_afp * tasa_afp)
    salud_nombre = (empleado.sistema_salud or 'FONASA').upper()
    salud_monto = math.floor(renta_afp * parametros['tasa_salud'])
    if salud_nombre == 'ISAPRE' and empleado.plan_isapre_uf and float(empleado.plan_isapre_uf) > 0:
        salud_monto = max(math.floor(float(empleado.plan_isapre_uf) * valor_uf * dias / 30), salud_monto)
    anios_servicio = _anios_de_servicio(empleado, contrato, fecha_termino.month, fecha_termino.year)
    tasa_afc, _ = _tasas_afc(parametros, tipo_contrato, anios_servicio)
    afc_monto = math.floor(renta_afc * tasa_afc)
    valor_utm = obtener_utm()
    impuesto = calcular_impuesto_unico(max(imponible - afp_monto - salud_monto - afc_monto, 0), valor_utm)

    if grat_anual and gratificacion:
        # DL 3.500 Art. 28 y LIR Art. 46: una gratificación anual cotiza y
        # tributa distribuida en los meses en que se devengó, con el tope y
        # la tabla de cada mes; no toda de golpe en el mes del finiquito.
        _, meses_grat, _, _, _ = grat_anual
        cuota = gratificacion / len(meses_grat)
        tasa_trab = tasa_afp + parametros['tasa_salud'] + tasa_afc
        for _, base_mes in meses_grat:
            cot_afp = min(cuota, max(tope_afp - base_mes, 0))
            cot_afc = min(cuota, max(tope_afc - base_mes, 0))
            afp_monto += math.floor(cot_afp * tasa_afp)
            salud_monto += math.floor(cot_afp * parametros['tasa_salud'])
            afc_monto += math.floor(cot_afc * tasa_afc)
            tributable = base_mes * (1 - tasa_trab)
            impuesto += max(calcular_impuesto_unico(tributable + cuota * (1 - tasa_trab), valor_utm)
                            - calcular_impuesto_unico(tributable, valor_utm), 0)
    descuentos_prevision = afp_monto + salud_monto + afc_monto + impuesto

    otros_haberes = max(int(otros_haberes or 0), 0)
    otros_descuentos = max(int(otros_descuentos or 0), 0)
    total = (sueldo_proporcional + gratificacion + feriado + indemnizacion_anos + sustitutiva
             + otros_haberes - otros_descuentos - descuentos_prevision)

    montos = {
        'sueldo_base':                  sueldo_base,
        'dias_trabajados_ultimo_mes':   dias,
        'gratificacion_proporcional':   gratificacion,
        'feriado_proporcional':         feriado,
        'indemnizacion_anos_servicio':  indemnizacion_anos,
        'indemnizacion_sustitutiva_aviso': sustitutiva,
        'otros_haberes':                otros_haberes,
        'otros_descuentos':             otros_descuentos,
        'descuentos_prevision':         descuentos_prevision,
        'total_a_pagar':                max(total, 0),
    }
    detalle = {
        'sueldo_proporcional': sueldo_proporcional,
        'feriado_dias_saldo': saldo, 'feriado_dias_proporcionales': proporcional,
        'feriado_dias_habiles': dias_habiles_feriado, 'feriado_dias_corridos': dias_corridos_feriado,
        'con_indemnizacion': con_indemnizacion, 'anios_indemnizacion': anios,
        'base_indemnizacion': base_indemnizacion, 'base_indemnizacion_topada': base_indemnizacion_sin_tope > tope_base,
        'tope_base_indemnizacion': tope_base,
        'base_indemnizacion_detalle': base_lineas, 'base_indemnizacion_meses': base_meses,
        **({'aviso_base_indemnizacion': (
            'Sin liquidaciones emitidas: la base considera solo el sueldo base y la gratificación. '
            'Si el trabajador recibe bonos, colación, movilización o comisiones, emite sus liquidaciones antes del finiquito.'
            if base_meses == 0 else
            f'La base usa {base_meses} {"liquidación" if base_meses == 1 else "liquidaciones"} de las tres que pide el Art. 172 '
            'para promediar lo variable; con menos meses no se distinguen bien los haberes esporádicos. Revísala.'),
        } if con_indemnizacion and base_meses < 3 else {}),
        **({'aviso_anios_indemnizacion': (
            f'Contrato anterior al 14-08-1981: la indemnización por años de servicio no tiene el tope '
            f'de 11 años (art. 7° transitorio); se consideran los {anios} años.'),
        } if con_indemnizacion and empleado.fecha_ingreso and empleado.fecha_ingreso < _FECHA_SIN_TOPE_ANIOS
          and anios > _TOPE_ANIOS_INDEMNIZACION else {}),
        'afp_nombre': nombre_afp, 'afp': afp_monto, 'salud_nombre': salud_nombre, 'salud': salud_monto,
        'seguro_cesantia': afc_monto, 'impuesto_unico': impuesto,
        'gratificacion_modalidad': 'ANUAL' if grat_anual else 'MENSUAL',
        **({
            'gratificacion_devengado_anio': grat_anual[2], 'gratificacion_meses': grat_anual[3],
            'gratificacion_tope': grat_anual[4],
            'aviso_gratificacion': ('Gratificación anual calculada con el Art. 50 (25 % de lo devengado en el año, '
                                    'tope 4,75 ingresos mínimos proporcional). Si la empresa paga por utilidades '
                                    '(Art. 47), el monto que corresponde puede ser distinto.'),
        } if grat_anual else {}),
    }
    return montos, detalle


class FiniquitoViewSet(viewsets.ModelViewSet):
    serializer_class = FiniquitoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Finiquito.objects.filter(
            empleado__empresa__owner=self.request.user
        ).order_by('-fecha_emision')
        empleado_id = self.request.query_params.get('empleado')
        if empleado_id:
            qs = qs.filter(empleado_id=empleado_id)
        return qs

    _ERROR_PLAN = 'Los finiquitos están disponibles desde el plan Starter. Mejora tu suscripción para acceder a esta función.'

    def _entrada(self, request, empleado=None, base=None):
        """Lee los hechos del finiquito. Los montos legales nunca se aceptan del cliente."""
        data = request.data
        base = base or {}
        if empleado is None:
            try:
                empleado = Empleado.objects.get(id=data.get('empleado'), empresa__owner=request.user)
            except (Empleado.DoesNotExist, ValueError, TypeError):
                raise NotFound('Empleado no encontrado.')
        try:
            fecha_termino = datetime.date.fromisoformat(str(data.get('fecha_termino', base.get('fecha_termino', ''))))
        except (ValueError, TypeError):
            raise ValidationError({'error': 'Fecha de término inválida.'})
        if empleado.fecha_ingreso and fecha_termino < empleado.fecha_ingreso:
            raise ValidationError({'error': 'La fecha de término es anterior al ingreso del trabajador.'})
        try:
            entrada = {
                'dias_trabajados_ultimo_mes': int(data.get('dias_trabajados_ultimo_mes', base.get('dias_trabajados_ultimo_mes', 30))),
                'causal_articulo': str(data.get('causal_articulo', base.get('causal_articulo', ''))),
                'aviso_previo_dado': str(data.get('aviso_previo_dado', base.get('aviso_previo_dado', False))).lower() in ('true', '1'),
                'otros_haberes': int(data.get('otros_haberes', base.get('otros_haberes', 0)) or 0),
                'otros_descuentos': int(data.get('otros_descuentos', base.get('otros_descuentos', 0)) or 0),
            }
        except (ValueError, TypeError):
            raise ValidationError({'error': 'Días, otros haberes y otros descuentos deben ser números.'})
        if entrada['causal_articulo'] not in dict(Finiquito.CAUSAL_ARTICULO_CHOICES):
            raise ValidationError({'error': 'Selecciona una causal de término válida.'})
        if entrada['otros_haberes'] < 0 or entrada['otros_descuentos'] < 0:
            raise ValidationError({'error': 'Otros haberes y descuentos no pueden ser negativos.'})
        return empleado, fecha_termino, entrada

    def _calcular(self, empleado, fecha_termino, entrada):
        return _calcular_finiquito(
            empleado, fecha_termino, entrada['dias_trabajados_ultimo_mes'], entrada['causal_articulo'],
            aviso_previo_dado=entrada['aviso_previo_dado'],
            otros_haberes=entrada['otros_haberes'], otros_descuentos=entrada['otros_descuentos'])

    @action(detail=False, methods=['post'])
    def simular(self, request):
        """Vista previa: el mismo cálculo que al guardar, sin guardar."""
        if not _plan_permite(request.user, 2):
            return Response({'error': self._ERROR_PLAN}, status=status.HTTP_403_FORBIDDEN)
        empleado, fecha_termino, entrada = self._entrada(request)
        montos, detalle = self._calcular(empleado, fecha_termino, entrada)
        return Response({**montos, 'detalle': detalle, 'aviso_previo_dado': entrada['aviso_previo_dado'],
                         'causal_articulo': entrada['causal_articulo'], 'fecha_termino': fecha_termino.isoformat()})

    def create(self, request, *args, **kwargs):
        if not _plan_permite(request.user, 2):
            return Response({'error': self._ERROR_PLAN}, status=status.HTTP_403_FORBIDDEN)
        empleado, fecha_termino, entrada = self._entrada(request)
        montos, _ = self._calcular(empleado, fecha_termino, entrada)
        try:
            fecha_emision = datetime.date.fromisoformat(str(request.data.get('fecha_emision', timezone.localdate().isoformat())))
        except (ValueError, TypeError):
            fecha_emision = timezone.localdate()
        finiquito = Finiquito.objects.create(
            empleado=empleado,
            documento_legal_id=request.data.get('documento_legal') or None,
            causal_articulo=entrada['causal_articulo'],
            aviso_previo_dado=entrada['aviso_previo_dado'],
            fecha_termino=fecha_termino,
            fecha_emision=fecha_emision,
            modalidad=request.data.get('modalidad', 'PRESENCIAL'),
            **montos,
        )
        return Response(self.get_serializer(finiquito).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Editar recalcula todo con los hechos nuevos; firmado, ya no se toca."""
        instancia = self.get_object()
        if SolicitudFirma.objects.filter(finiquito=instancia, estado__in=('FIRMADO', 'PENDIENTE')).exists():
            return Response({'error': 'Este finiquito tiene una firma pendiente o ya fue firmado: no se puede modificar.'},
                            status=status.HTTP_403_FORBIDDEN)
        base = {
            'fecha_termino': instancia.fecha_termino.isoformat(), 'causal_articulo': instancia.causal_articulo,
            'dias_trabajados_ultimo_mes': instancia.dias_trabajados_ultimo_mes, 'aviso_previo_dado': instancia.aviso_previo_dado,
            'otros_haberes': instancia.otros_haberes, 'otros_descuentos': instancia.otros_descuentos,
        }
        _, fecha_termino, entrada = self._entrada(request, empleado=instancia.empleado, base=base)
        montos, _ = self._calcular(instancia.empleado, fecha_termino, entrada)
        for campo, valor in {**montos, 'fecha_termino': fecha_termino, 'causal_articulo': entrada['causal_articulo'],
                             'aviso_previo_dado': entrada['aviso_previo_dado']}.items():
            setattr(instancia, campo, valor)
        if 'modalidad' in request.data:
            instancia.modalidad = request.data['modalidad']
        if instancia.archivo_pdf:
            instancia.archivo_pdf.delete(save=False)  # el PDF anterior ya no refleja los montos
        instancia.save()
        return Response(self.get_serializer(instancia).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='generar_pdf')
    def generar_pdf(self, request, pk=None):
        try:
            finiquito = self.get_object()
            nombre = f'finiquito_{finiquito.empleado.rut}_{finiquito.fecha_termino}.pdf'
            firmado = pdf_firmado('FINIQUITO', finiquito=finiquito)
            if firmado:
                return respuesta_pdf(firmado, nombre, firmado=True)
            return respuesta_pdf(pdf_finiquito(finiquito), nombre)
        except Finiquito.DoesNotExist:
            return Response({'error': 'Finiquito no encontrado.'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


def html_finiquito(finiquito) -> str:
    """HTML del finiquito: una sola plantilla para la descarga y para la firma."""
    empleado  = finiquito.empleado
    empresa   = empleado.empresa

    def _fmt(f):
        if not f:
            return '—'
        return f"{f.day:02d} de {_MESES[f.month - 1]} de {f.year}"

    ciudad = (getattr(empresa, 'comuna', '') or 'Santiago').strip().title()
    causal_label = finiquito.get_causal_articulo_display() if finiquito.causal_articulo else '—'

    sueldo_prop = math.floor(
        (finiquito.sueldo_base / 30) * finiquito.dias_trabajados_ultimo_mes
    )

    # Escapar campos de texto para prevenir inyección HTML/CSS en el PDF
    _ciudad      = _esc(ciudad)
    _causal      = _esc(causal_label)
    _nom_legal   = _esc(empresa.nombre_legal or '')
    _rut_emp     = _esc(empresa.rut or '')
    _trab_nombre = _esc(f"{empleado.nombres} {empleado.apellido_paterno} {empleado.apellido_materno or ''}")
    _trab_firma  = _esc(f"{empleado.nombres} {empleado.apellido_paterno}")
    _rut_trab    = _esc(empleado.rut or '')
    _cargo       = _esc(empleado.cargo or '—')
    _depto       = _esc(empleado.departamento or '—')
    _modalidad   = _esc(finiquito.get_modalidad_display())

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  @page {{ size: letter; margin: 2cm 2.5cm; }}
  body {{ font-family: Arial, sans-serif; font-size: 10pt; color: #111; line-height: 1.5; }}
  h1 {{ font-size: 14pt; text-align: center; text-transform: uppercase;
        letter-spacing: 2px; margin-bottom: 4px; }}
  h2 {{ font-size: 10pt; text-align: center; color: #555; margin-top: 0; margin-bottom: 20px; }}
  .seccion {{ margin-bottom: 16px; }}
  .seccion-titulo {{ font-size: 9pt; font-weight: bold; text-transform: uppercase;
             letter-spacing: 1px; color: #555; border-bottom: 1px solid #ccc;
             padding-bottom: 3px; margin-bottom: 8px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 10pt; }}
  table td {{ padding: 4px 6px; vertical-align: top; }}
  table td:last-child {{ text-align: right; font-weight: bold; }}
  .total-row td {{ border-top: 2px solid #333; font-weight: bold; font-size: 11pt;
           padding-top: 8px; }}
  .firma-bloque {{ margin-top: 60px; display: flex; justify-content: space-between; }}
  .firma-item {{ text-align: center; width: 44%; }}
  .firma-linea {{ border-top: 1px solid #333; padding-top: 6px; margin-top: 50px; font-size: 9pt; }}
  p {{ margin: 4px 0; }}
  .aviso {{ font-size: 8pt; color: #666; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; }}
</style>
</head>
<body>

<h1>Finiquito de Contrato de Trabajo</h1>
<h2>{_ciudad}, {_fmt(finiquito.fecha_emision)}</h2>

<div class="seccion">
  <div class="seccion-titulo">Partes</div>
  <p><strong>Empleador:</strong> {_nom_legal} — RUT {_rut_emp}</p>
  <p><strong>Trabajador:</strong> {_trab_nombre} — RUT {_rut_trab}</p>
  <p><strong>Cargo:</strong> {_cargo} &nbsp;|&nbsp; <strong>Departamento:</strong> {_depto}</p>
  <p><strong>Fecha de ingreso:</strong> {_fmt(empleado.fecha_ingreso)} &nbsp;|&nbsp;
     <strong>Fecha de término:</strong> {_fmt(finiquito.fecha_termino)}</p>
  <p><strong>Causal de término:</strong> {_causal}</p>
</div>

<div class="seccion">
  <div class="seccion-titulo">Liquidación Final</div>
  <table>
    <tr><td>Sueldo base proporcional ({finiquito.dias_trabajados_ultimo_mes} días)</td>
        <td>${sueldo_prop:,.0f}</td></tr>
    <tr><td>Gratificación proporcional</td>
        <td>${finiquito.gratificacion_proporcional:,.0f}</td></tr>
    <tr><td>Feriado pendiente y proporcional ({(finiquito.feriado_proporcional * 30 // finiquito.sueldo_base) if finiquito.sueldo_base else 0} días corridos aprox.)</td>
        <td>${finiquito.feriado_proporcional:,.0f}</td></tr>
    {f'<tr><td>Indemnización por años de servicio (Art. 163)</td><td>${finiquito.indemnizacion_anos_servicio:,.0f}</td></tr>' if finiquito.indemnizacion_anos_servicio else ''}
    {f'<tr><td>Indemnización sustitutiva de aviso previo</td><td>${finiquito.indemnizacion_sustitutiva_aviso:,.0f}</td></tr>' if finiquito.indemnizacion_sustitutiva_aviso else ''}
    {f'<tr><td>Otros haberes</td><td>${finiquito.otros_haberes:,.0f}</td></tr>' if finiquito.otros_haberes else ''}
    <tr><td>Descuentos legales (AFP, salud, seguro de cesantía e impuesto)</td>
        <td>-${finiquito.descuentos_prevision:,.0f}</td></tr>
    {f'<tr><td>Otros descuentos</td><td>-${finiquito.otros_descuentos:,.0f}</td></tr>' if finiquito.otros_descuentos else ''}
    <tr class="total-row">
      <td>TOTAL A PAGAR</td>
      <td>${finiquito.total_a_pagar:,.0f}</td>
    </tr>
  </table>
</div>

<div class="seccion">
  <div class="seccion-titulo">Declaración del Trabajador</div>
  <p>El trabajador declara haber recibido a su entera satisfacción la suma indicada como total a pagar,
  y nada más tiene que reclamar al empleador por concepto alguno derivado de la relación laboral
  que los vinculó, quedando ambas partes en paz y a finiquito.</p>
  <p>Modalidad de suscripción del finiquito: <strong>{_modalidad}</strong></p>
</div>

<div class="firma-bloque">
  <div class="firma-item">
    <div class="firma-linea">
      <strong>{_nom_legal}</strong><br/>RUT {_rut_emp}<br/>Empleador
    </div>
  </div>
  <div class="firma-item">
    <div class="firma-linea">
      <strong>{_trab_firma}</strong><br/>RUT {_rut_trab}<br/>Trabajador
    </div>
  </div>
</div>

<p class="aviso">
  Finiquito regulado por los artículos 177 y siguientes del Código del Trabajo de la República de Chile.
  Generado por Jornada40 · {_fmt(finiquito.fecha_emision)}.
</p>

</body>
</html>"""
    return html


def pdf_finiquito(finiquito) -> bytes:
    buffer = io.BytesIO()
    if pisa.CreatePDF(html_finiquito(finiquito), dest=buffer).err:
        raise Exception('Error al generar el PDF del finiquito.')
    return buffer.getvalue()
