"""Reglas de jornada laboral: máximo legal vigente y avisos de incumplimiento.

Criterio de producto: Jornada40 AVISA, nunca bloquea. Si un contrato
incumple la norma, el sistema lo muestra de forma visible y recomienda cómo
corregirlo, pero la decisión final es del usuario. Por eso esto solo produce
avisos; nada aquí impide guardar un contrato.

Calendario de la Ley 21.561 (publicada el 26-04-2023): la jornada ordinaria
máxima baja a 44 h al primer año, a 42 h al tercero y a 40 h al quinto, cada
vez el 26 de abril. El frontend replica este calendario en
frontend/src/utils/ley40.ts para mostrarlo en el sitio público; si cambia
aquí, cambia allá.
"""
import datetime

ETAPAS_LEY_40 = [
    # (desde, horas). None = jornada previa a la ley.
    (None, 45),
    (datetime.date(2024, 4, 26), 44),
    (datetime.date(2026, 4, 26), 42),
    (datetime.date(2028, 4, 26), 40),
]

# Art. 28: la jornada ordinaria no puede exceder de diez horas por día.
MAXIMO_DIARIO = 10

# Art. 40 bis: jornada parcial es la no superior a dos tercios de la jornada
# ordinaria del Art. 22, así que el tope baja junto con el máximo semanal.
FRACCION_JORNADA_PARCIAL = 2 / 3

# Art. 28 (texto de la Ley 21.561): la jornada ordinaria se distribuye en no
# menos de cuatro ni más de seis días. Rige desde la etapa de 40 h; antes, el
# art. 8° transitorio permite los cuatro días solo si la jornada ya es de 40 h
# o menos. Sin ese pacto, el mínimo es cinco días.
MAXIMO_DIAS_SEMANA = 6
MINIMO_DIAS_SEMANA = 5
MINIMO_DIAS_4X3 = 4
JORNADA_MAXIMA_4X3_ANTICIPADA = 40

# Con cuánta anticipación se avisa la próxima reducción.
DIAS_AVISO_PROXIMA_REDUCCION = 180

# Las horas semanales llevan un decimal; esto absorbe redondeos del horario.
_TOLERANCIA = 0.01

# Tipos a los que aplica el tope diario. Turnos y jornada bisemanal tienen
# regímenes propios (sistemas excepcionales autorizados por la Dirección del
# Trabajo) y el Art. 22 inciso 2° está excluido del límite de jornada.
_TIPOS_CON_TOPE_DIARIO = {'ORDINARIA', 'PARCIAL', 'OTRO'}


def _hoy(fecha=None) -> datetime.date:
    return fecha or datetime.date.today()


def etapa_vigente(fecha=None):
    """(desde, horas) de la etapa que rige en una fecha; desde=None antes de la ley."""
    fecha = _hoy(fecha)
    vigente = ETAPAS_LEY_40[0]
    for etapa in ETAPAS_LEY_40:
        if etapa[0] and etapa[0] <= fecha:
            vigente = etapa
    return vigente


def jornada_maxima_vigente(fecha=None) -> int:
    """Jornada ordinaria máxima semanal que rige en una fecha, en horas."""
    return etapa_vigente(fecha)[1]


def jornada_maxima_por_defecto() -> float:
    """Default de Contrato.horas_semanales: el máximo que rige el día de hoy.

    Antes era 44 fijo, que desde el 26-04-2026 está sobre el máximo legal:
    cada contrato creado con el valor por defecto nacía incumpliendo.
    """
    return float(jornada_maxima_vigente())


def proxima_reduccion(fecha=None):
    """(fecha, horas) de la próxima etapa aún no vigente, o None si ya es 40 h."""
    fecha = _hoy(fecha)
    for desde, horas in ETAPAS_LEY_40:
        if desde and desde > fecha:
            return desde, horas
    return None


def _minutos(hhmm) -> int | None:
    try:
        horas, minutos = str(hhmm).split(':')[:2]
        return int(horas) * 60 + int(minutos)
    except (ValueError, AttributeError):
        return None


def horas_por_dia(distribucion_horario) -> dict:
    """Horas efectivas de cada día activo del horario, descontada la colación.

    El horario se guarda como {"lunes": {"activo", "entrada", "salida",
    "colacion"}, ...}, con la colación en minutos (no es jornada, Art. 34).
    """
    resultado = {}
    for dia, datos in (distribucion_horario or {}).items():
        if not isinstance(datos, dict) or not datos.get('activo'):
            continue
        entrada, salida = _minutos(datos.get('entrada')), _minutos(datos.get('salida'))
        if entrada is None or salida is None:
            continue
        neto = salida - entrada - int(datos.get('colacion') or 0)
        if neto > 0:
            resultado[dia] = neto / 60
    return resultado


def _fmt(horas) -> str:
    """42.0 → '42'; 42.5 → '42,5'."""
    horas = round(float(horas), 1)
    return f'{horas:g}'.replace('.', ',')


def _fecha(fecha: datetime.date) -> str:
    return fecha.strftime('%d-%m-%Y')


def _aviso(codigo, gravedad, titulo, detalle, recomendacion, articulo):
    return {
        'codigo': codigo,
        'gravedad': gravedad,          # 'alta' incumple hoy · 'media' conviene revisar
        'titulo': titulo,
        'detalle': detalle,
        'recomendacion': recomendacion,
        'articulo': articulo,
    }


def aviso_sueldo_minimo(tipo_jornada, horas_semanales, sueldo_base, ingreso_minimo, fecha=None):
    """Aviso si el sueldo base queda bajo el ingreso mínimo que corresponde a la jornada.

    Art. 44: la remuneración mensual no puede ser inferior al ingreso mínimo;
    con jornada menor a la máxima (parcial, Art. 40 bis) el mínimo es
    proporcional a las horas pactadas. Art. 42 a): el sueldo base tampoco
    puede ser menor. Un contrato Art. 22 no tiene horas: se compara con el
    mínimo completo.
    """
    try:
        sueldo = float(sueldo_base or 0)
        minimo = float(ingreso_minimo or 0)
        pactadas = float(horas_semanales or 0)
    except (TypeError, ValueError):
        return None
    if sueldo <= 0 or minimo <= 0:
        return None
    maximo = jornada_maxima_vigente(fecha)
    tipo = (tipo_jornada or 'ORDINARIA').upper()
    proporcional = tipo != 'ART_22' and 0 < pactadas < maximo - _TOLERANCIA
    exigido = minimo * pactadas / maximo if proporcional else minimo
    if sueldo + 1 >= exigido:  # 1 peso de holgura por redondeo
        return None
    base = (f'el mínimo proporcional a {_fmt(pactadas)} h de {maximo} h es ${exigido:,.0f}'
            if proporcional else f'el ingreso mínimo mensual es ${minimo:,.0f}').replace(',', '.')
    return _aviso(
        'SUELDO_BAJO_MINIMO', 'alta',
        'Sueldo base bajo el ingreso mínimo',
        f'El sueldo base pactado es ${sueldo:,.0f} y {base}.'.replace(',', '.'),
        'Sube el sueldo base al mínimo que corresponde con un anexo de contrato. Si el trabajador es '
        'menor de 18 o mayor de 65 años rige un ingreso mínimo menor: en ese caso revisa ese valor.',
        'Código del Trabajo, Arts. 42 a), 44 y 40 bis',
    )


def avisos_jornada(tipo_jornada, horas_semanales, distribucion_horario, fecha=None,
                   sueldo_base=None, ingreso_minimo=None) -> list:
    """Avisos de incumplimiento de jornada para un contrato (o un borrador).

    Recibe los campos sueltos y no el modelo para poder evaluar un contrato
    mientras se edita, antes de guardarlo. Con sueldo e ingreso mínimo
    también avisa si el sueldo base queda bajo el mínimo de la jornada.
    """
    fecha = _hoy(fecha)
    vigente_desde, maximo = etapa_vigente(fecha)
    tipo = (tipo_jornada or 'ORDINARIA').upper()
    try:
        pactadas = float(horas_semanales or 0)
    except (TypeError, ValueError):
        pactadas = 0.0

    por_dia = horas_por_dia(distribucion_horario)
    total_horario = sum(por_dia.values())
    avisos = []
    desde_txt = f' desde el {_fecha(vigente_desde)}' if vigente_desde else ''
    sueldo = aviso_sueldo_minimo(tipo, pactadas, sueldo_base, ingreso_minimo, fecha)
    if sueldo:
        avisos.append(sueldo)

    if tipo == 'ART_22':
        # El Art. 22 inciso 2° excluye del límite de jornada a quien trabaja sin
        # fiscalización superior inmediata. Fijarle horario de entrada y
        # salida es justamente fiscalizarlo: la exclusión no se sostiene.
        if por_dia:
            avisos.append(_aviso(
                'ART22_CON_HORARIO', 'alta',
                'Artículo 22 con horario fijo',
                f'El contrato excluye al trabajador del límite de jornada (Art. 22 inciso 2°), '
                f'pero le fija horario de entrada y salida en {len(por_dia)} día(s), '
                f'por {_fmt(total_horario)} h a la semana. Quien cumple horario está sujeto a '
                f'fiscalización y no califica para esa exclusión.',
                f'Si el trabajador cumple horario, pacta una jornada ordinaria de hasta {maximo} h '
                f'y paga las horas que realmente trabaja. Si trabaja sin fiscalización, quita el horario.',
                'Código del Trabajo, Art. 22 inciso 2°',
            ))
        # Un contrato Art. 22 no pacta horas. Si registra menos que el máximo
        # (p. ej. 20 h), lo habitual es que el sueldo se haya fijado en
        # proporción a esas horas aunque la jornada real no tenga límite.
        if 0 < pactadas < maximo - _TOLERANCIA:
            avisos.append(_aviso(
                'ART22_CON_HORAS', 'media',
                'Artículo 22 con horas pactadas',
                f'El contrato excluye al trabajador del límite de jornada, pero registra '
                f'{_fmt(pactadas)} h semanales. Un contrato Art. 22 no pacta horas: si el sueldo se '
                f'calculó en proporción a {_fmt(pactadas)} h, puede estar pagándose menos de lo que '
                f'corresponde a una jornada sin límite.',
                f'Si el trabajador tiene una jornada acotada, pacta una jornada ordinaria o parcial con '
                f'horario. Si de verdad trabaja sin fiscalización, revisa que el sueldo no esté '
                f'calculado sobre {_fmt(pactadas)} h.',
                'Código del Trabajo, Art. 22 inciso 2°',
            ))
        return avisos

    if pactadas > maximo + _TOLERANCIA:
        avisos.append(_aviso(
            'EXCEDE_MAXIMO', 'alta',
            'Jornada sobre el máximo legal',
            f'El contrato pacta {_fmt(pactadas)} h semanales y el máximo vigente{desde_txt} '
            f'es {maximo} h. Excede en {_fmt(pactadas - maximo)} h.',
            f'Genera un anexo de contrato que reduzca la jornada a {maximo} h o menos.',
            'Código del Trabajo, Art. 22 · Ley 21.561',
        ))

    if por_dia and total_horario > pactadas + _TOLERANCIA:
        sobre_maximo = total_horario > maximo + _TOLERANCIA
        detalle = (
            f'El horario suma {_fmt(total_horario)} h a la semana, pero el contrato pacta '
            f'{_fmt(pactadas)} h. Las {_fmt(total_horario - pactadas)} h de diferencia son horas '
            f'extraordinarias: requieren pacto escrito y se pagan con recargo.'
        )
        if sobre_maximo:
            detalle += f' Además, el horario supera el máximo legal de {maximo} h.'
        avisos.append(_aviso(
            'HORARIO_SUPERA_PACTADO', 'alta',
            'El horario no calza con la jornada pactada',
            detalle,
            'Ajusta el horario a las horas pactadas, o las horas pactadas al horario real '
            f'(sin superar {maximo} h), y paga como extra lo que corresponda.',
            'Código del Trabajo, Arts. 30 a 32',
        ))

    if tipo in _TIPOS_CON_TOPE_DIARIO:
        largos = {d: h for d, h in por_dia.items() if h > MAXIMO_DIARIO + _TOLERANCIA}
        if largos:
            dias = ', '.join(f'{d} ({_fmt(h)} h)' for d, h in largos.items())
            avisos.append(_aviso(
                'DIA_SUPERA_10H', 'alta',
                'Días con más de 10 horas',
                f'La jornada ordinaria no puede superar 10 horas por día. Excede en: {dias}.',
                'Redistribuye el horario para que ningún día pase de 10 horas.',
                'Código del Trabajo, Art. 28',
            ))

    if tipo in _TIPOS_CON_TOPE_DIARIO and por_dia:
        dias = len(por_dia)
        cuatro_permitido = maximo <= JORNADA_MAXIMA_4X3_ANTICIPADA or (
            0 < pactadas <= JORNADA_MAXIMA_4X3_ANTICIPADA + _TOLERANCIA)
        minimo_dias = MINIMO_DIAS_4X3 if cuatro_permitido else MINIMO_DIAS_SEMANA
        if dias > MAXIMO_DIAS_SEMANA:
            avisos.append(_aviso(
                'DIAS_SOBRE_6', 'alta',
                'Jornada distribuida en más de seis días',
                f'El horario reparte la jornada en {dias} días. La jornada ordinaria se distribuye '
                f'en {minimo_dias} a {MAXIMO_DIAS_SEMANA} días, con al menos un día de descanso.',
                'Deja al menos un día de descanso semanal en el horario.',
                'Código del Trabajo, Arts. 28 y 35',
            ))
        elif dias < minimo_dias and tipo != 'PARCIAL':
            # La jornada parcial (Art. 40 bis) se reparte habitualmente en menos días.
            if dias == MINIMO_DIAS_4X3:
                detalle = (f'El horario reparte la jornada en 4 días (sistema 4x3). Hasta el 26-04-2028 '
                           f'solo se puede pactar con una jornada de {JORNADA_MAXIMA_4X3_ANTICIPADA} h o '
                           f'menos, y este contrato pacta {_fmt(pactadas)} h.')
                recomendacion = (f'Reduce la jornada a {JORNADA_MAXIMA_4X3_ANTICIPADA} h para pactar el 4x3, '
                                 f'o distribúyela en 5 o 6 días.')
            else:
                detalle = (f'El horario reparte la jornada en {dias} '
                           f'{"día" if dias == 1 else "días"}; el mínimo es {minimo_dias}.')
                recomendacion = f'Distribuye la jornada en {minimo_dias} a {MAXIMO_DIAS_SEMANA} días.'
            avisos.append(_aviso(
                'DIAS_BAJO_MINIMO', 'alta',
                'Distribución semanal con muy pocos días',
                detalle, recomendacion,
                'Código del Trabajo, Art. 28 · Ley 21.561, art. 8° transitorio',
            ))

    if tipo == 'PARCIAL':
        tope_parcial = maximo * FRACCION_JORNADA_PARCIAL
        if pactadas > tope_parcial + _TOLERANCIA:
            avisos.append(_aviso(
                'PARCIAL_SOBRE_TOPE', 'media',
                'No califica como jornada parcial',
                f'Una jornada parcial no puede superar dos tercios de la jornada ordinaria máxima: '
                f'hoy {_fmt(tope_parcial)} h. El contrato pacta {_fmt(pactadas)} h.',
                f'Pacta {_fmt(tope_parcial)} h o menos, o cambia el tipo de jornada a ordinaria.',
                'Código del Trabajo, Art. 40 bis',
            ))

    proxima = proxima_reduccion(fecha)
    if proxima and pactadas <= maximo + _TOLERANCIA:
        fecha_prox, horas_prox = proxima
        faltan = (fecha_prox - fecha).days
        if pactadas > horas_prox + _TOLERANCIA and faltan <= DIAS_AVISO_PROXIMA_REDUCCION:
            avisos.append(_aviso(
                'PROXIMA_REDUCCION', 'media',
                f'La jornada máxima baja a {horas_prox} h',
                f'Desde el {_fecha(fecha_prox)} (en {faltan} días) el máximo será {horas_prox} h y '
                f'este contrato pacta {_fmt(pactadas)} h.',
                f'Prepara un anexo que reduzca la jornada a {horas_prox} h antes de esa fecha.',
                'Ley 21.561',
            ))

    return avisos
