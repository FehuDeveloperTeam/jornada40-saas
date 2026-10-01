"""Reglas del procedimiento de denuncias Ley Karin (Ley 21.643 y DS 21 de 2024).

Todo cálculo legal está aquí, no en el frontend:

- Plazos (DS 21 Art. 2 inc. final): días **hábiles** de lunes a viernes sin
  feriados, salvo que se diga otra cosa. Las medidas o sanciones se aplican en
  15 días **corridos** (Art. 19).
  - Medidas de resguardo: de inmediato (Art. 13; Art. 211-B bis CT).
  - Investigar internamente (informando a la DT el inicio y las medidas de
    resguardo) o derivar a la DT: 3 días desde la recepción (Art. 12).
  - Derivación obligatoria a la DT si la denuncia es contra el empleador o quien
    ejerce dirección o administración (Art. 4° inc. 1° CT), o si quien denuncia
    lo pide (Art. 12).
  - Investigación: 30 días desde la presentación de la denuncia (Art. 17).
  - Remitir el informe a la DT: 2 días desde que termina la investigación
    (Art. 18). La DT tiene 30 días para pronunciarse; si no lo hace, valen las
    conclusiones del informe y el empleador las notifica a las partes.
  - Aplicar medidas o sanciones: 15 días corridos desde que se notifica el
    pronunciamiento de la DT, o desde que vencen sus 30 días (Art. 19).
- Sin control de admisibilidad (Art. 12): una denuncia incompleta se registra
  igual y se le da un plazo para completarla (Art. 15). No se aceptan
  denuncias anónimas (Dictamen 497/21): la persona afectada se identifica.
- La plataforma no decide si hubo acoso ni propone sanciones: lo registra quien
  investiga, desde listas cerradas.
"""
import datetime
import uuid

from django.utils import timezone

from .registro_dt import dias_habiles_entre, sumar_dias_habiles
from .rut import formatear_rut, validar_rut
from .views.feriado import es_feriado_cl

PLAZO_DECISION = 3
PLAZO_INVESTIGACION = 30
PLAZO_ENVIO_INFORME = 2
PLAZO_PRONUNCIAMIENTO_DT = 30
PLAZO_MEDIDAS_CORRIDOS = 15
AVISO_HABILES = 2           # "por vencer": quedan 2 días hábiles o menos

# Vínculo de cada persona denunciada con la afectada (Art. 11 c).
VINCULOS = [
    ('EMPLEADOR', 'Es el empleador (dueño o representante legal)'),
    ('DIRECCION', 'Gerente, administrador o con funciones de dirección (Art. 4° CT)'),
    ('JEFATURA', 'Jefatura directa o superior'),
    ('PAR', 'Compañero o compañera de trabajo'),
    ('SUBORDINADO', 'Persona a su cargo'),
    ('TERCERO', 'Externo: cliente, proveedor, usuario u otro'),
]
VINCULOS_DT = {'EMPLEADOR', 'DIRECCION'}     # derivación obligatoria (Art. 12 inc. 5°)
REPRESENTACIONES = [('SINDICATO', 'Sindicato'), ('ABOGADO', 'Abogado o abogada'), ('FAMILIAR', 'Familiar'),
                    ('COMPANERO', 'Compañero o compañera de trabajo'), ('OTRA', 'Otra persona')]
RESGUARDOS = [
    ('SEPARACION_ESPACIOS', 'Separación de los espacios físicos'),
    ('REDISTRIBUCION_JORNADA', 'Redistribución del tiempo de la jornada'),
    ('ATENCION_PSICOLOGICA', 'Derivación a atención psicológica temprana del organismo administrador (mutual)'),
    ('CAMBIO_DEPENDENCIA', 'Cambio de dependencia o de jefatura directa'),
    ('TELETRABAJO_TEMPORAL', 'Trabajo a distancia temporal, con acuerdo de la persona'),
    ('PERMISO_CON_GOCE', 'Permiso con goce de remuneraciones'),
]
APLICA_A = [('DENUNCIADO', 'A la persona denunciada'), ('DENUNCIANTE', 'A la persona afectada'),
            ('AMBOS', 'A ambas')]
ROLES = [('AFECTADA', 'Persona afectada'), ('DENUNCIANTE', 'Denunciante'), ('DENUNCIADA', 'Persona denunciada'),
         ('TESTIGO', 'Testigo')]
# Antecedentes que el Art. 15 manda considerar "en especial".
ANTECEDENTES = [
    ('PROTOCOLO', 'Protocolo de prevención del acoso y la violencia'),
    ('REGLAMENTO', 'Reglamento interno'),
    ('CONTRATOS', 'Contratos de trabajo y anexos'),
    ('ASISTENCIA', 'Registros de asistencia'),
    ('DIEP', 'Denuncia individual de enfermedad profesional o accidente (DIEP/DIAT)'),
    ('PSICOSOCIAL', 'Protocolo de Vigilancia de Riesgos Psicosociales'),
    ('CEAL_SM', 'Resultados del cuestionario CEAL-SM'),
]
CONCLUSIONES = [('ACREDITADO', 'Los hechos constituyen acoso o violencia'),
                ('NO_ACREDITADO', 'Los hechos no constituyen acoso ni violencia'),
                ('PARCIAL', 'Se acreditan solo algunos de los hechos denunciados')]
# Medidas correctivas (Art. 21) y sanciones (Art. 22; Art. 160 N°1 b y f; reglamento interno).
MEDIDAS_CORRECTIVAS = [
    ('CAPACITACION', 'Refuerzo de información y capacitación sobre prevención del acoso y la violencia'),
    ('APOYO_PSICOLOGICO', 'Apoyo psicológico a las personas involucradas que lo requieran'),
    ('CANALES', 'Reiteración de la información sobre los canales de denuncia'),
    ('PROTOCOLO', 'Revisión y mejora del protocolo de prevención'),
    ('ORGANIZACION', 'Cambios en la organización del trabajo o en los espacios'),
]
SANCIONES = [
    ('NINGUNA', 'Sin sanción'),
    ('AMONESTACION_VERBAL', 'Amonestación verbal (reglamento interno)'),
    ('AMONESTACION_ESCRITA', 'Amonestación escrita (reglamento interno)'),
    ('MULTA', 'Multa de hasta 25 % de la remuneración diaria (reglamento interno)'),
    ('DESPIDO_160_1_B', 'Término del contrato: Art. 160 N°1 letra b) (acoso sexual)'),
    ('DESPIDO_160_1_F', 'Término del contrato: Art. 160 N°1 letra f) (acoso laboral)'),
]
RESULTADOS_DT = [('CON_OBSERVACIONES', 'La DT se pronunció con observaciones'),
                 ('SIN_OBSERVACIONES', 'La DT se pronunció sin observaciones'),
                 ('SIN_PRONUNCIAMIENTO', 'La DT no se pronunció en 30 días: valen las conclusiones del informe')]

_DICT = lambda lista: dict(lista)  # noqa: E731


class DatosInvalidos(ValueError):
    pass


def _texto(valor, largo, obligatorio=False, campo=''):
    texto = str(valor or '').strip()[:largo]
    if obligatorio and not texto:
        raise DatosInvalidos(f'Falta {campo}.')
    return texto


def _rut(valor, obligatorio, campo):
    valor = str(valor or '').strip()
    if not valor:
        if obligatorio:
            raise DatosInvalidos(f'Falta el RUT de {campo}.')
        return ''
    if not validar_rut(valor):
        raise DatosInvalidos(f'El RUT de {campo} no es válido.')
    return formatear_rut(valor)


def _fecha(valor, campo, hoy=None):
    try:
        f = datetime.date.fromisoformat(str(valor))
    except (TypeError, ValueError):
        raise DatosInvalidos(f'Indica la fecha de {campo}.')
    if f > (hoy or timezone.localdate()):
        raise DatosInvalidos(f'La fecha de {campo} no puede ser futura.')
    return f


def _persona(p, campo, rut_obligatorio=False, con_correo=False):
    p = p if isinstance(p, dict) else {}
    persona = {'nombre': _texto(p.get('nombre'), 150, True, f'el nombre de {campo}'),
               'rut': _rut(p.get('rut'), rut_obligatorio, campo),
               'cargo': _texto(p.get('cargo'), 120)}
    if con_correo:
        persona['correo'] = _texto(p.get('correo'), 150).lower()
    if str(p.get('empleado_id') or '').isdigit():
        persona['empleado_id'] = int(p['empleado_id'])
    return persona


def validar_denuncia(entrada, empresa):
    """Datos de la denuncia (Art. 11), normalizados. Lanza DatosInvalidos."""
    from .models import DenunciaKarin, Empleado
    if entrada.get('tipo') not in _DICT(DenunciaKarin.TIPOS):
        raise DatosInvalidos('Elige el tipo de denuncia.')
    if entrada.get('canal') not in _DICT(DenunciaKarin.CANALES):
        raise DatosInvalidos('Elige cómo se recibió la denuncia.')
    # No hay denuncias anónimas: la persona afectada se identifica con su RUT.
    afectada = _persona(entrada.get('afectada'), 'la persona afectada', rut_obligatorio=True, con_correo=True)
    denunciante = None
    if entrada.get('denunciante'):
        denunciante = _persona(entrada['denunciante'], 'quien denuncia', rut_obligatorio=True, con_correo=True)
        if entrada.get('representacion') not in _DICT(REPRESENTACIONES):
            raise DatosInvalidos('Indica en qué calidad denuncia por la persona afectada.')
    denunciados = []
    for i, d in enumerate(entrada.get('denunciados') or []):
        persona = _persona(d, f'la persona denunciada {i + 1}')
        if (d or {}).get('vinculo') not in _DICT(VINCULOS):
            raise DatosInvalidos(f'Indica el vínculo de la persona denunciada {i + 1} con la persona afectada.')
        persona['vinculo'] = d['vinculo']
        denunciados.append(persona)
    if not denunciados:
        raise DatosInvalidos('Indica al menos a una persona denunciada (si no conoce su nombre, una descripción).')
    relato = _texto(entrada.get('relato'), 20000, True, 'la relación de los hechos')
    # Los trabajadores vinculados deben ser de la misma empresa.
    ids = {p['empleado_id'] for p in [afectada, *(denunciados), *([denunciante] if denunciante else [])]
           if p.get('empleado_id')}
    if ids and Empleado.objects.filter(id__in=ids, empresa=empresa).count() != len(ids):
        raise DatosInvalidos('Un trabajador elegido no es de esta empresa.')
    return {'afectada': afectada, 'denunciante': denunciante,
            'representacion': entrada.get('representacion') if denunciante else '',
            'denunciados': denunciados, 'relato': relato}


def derivacion_obligatoria(d):
    """Motivo por el que la denuncia debe ir a la DT, o '' si puede investigarse internamente."""
    if any(p.get('vinculo') in VINCULOS_DT for p in d.datos.get('denunciados', [])):
        return ('La denuncia es contra el empleador o contra quien ejerce dirección o administración '
                '(Art. 4° del Código del Trabajo): siempre se deriva a la Dirección del Trabajo.')
    if d.pide_derivar_dt:
        return 'Quien denuncia pidió que la investigue la Dirección del Trabajo.'
    return ''


# ── Plazos ───────────────────────────────────────────────────────────────────

def _f(valor):
    return datetime.date.fromisoformat(valor) if valor else None


def _item(clave, texto, norma, vence, cumplido, hoy, espera=False):
    if cumplido:
        estado = 'CUMPLIDO'
    elif espera:
        estado = 'ESPERA'
    elif vence and hoy > vence:
        estado = 'VENCIDO'
    elif vence and dias_habiles_entre(hoy, vence, es_feriado_cl) <= AVISO_HABILES:
        estado = 'POR_VENCER'
    else:
        estado = 'PENDIENTE'
    return {'clave': clave, 'texto': texto, 'norma': norma, 'vence': vence.isoformat() if vence else None,
            'cumplido': cumplido.isoformat() if isinstance(cumplido, datetime.date) else None, 'estado': estado}


def habiles(desde, dias):
    return sumar_dias_habiles(desde, dias, es_feriado_cl)


def plazos(d, hoy=None):
    """Lista de pasos con su vencimiento y estado (CUMPLIDO, VENCIDO, POR_VENCER, PENDIENTE, ESPERA)."""
    hoy = hoy or timezone.localdate()
    h = d.hitos or {}
    recibida = timezone.localtime(d.recibida_en).date()
    resguardo = d.resguardo or []
    primera_medida = min((_f(m['fecha']) for m in resguardo), default=None)
    items = [_item('resguardo', 'Adoptar medidas de resguardo', 'Art. 13 DS 21', recibida, primera_medida, hoy)]
    v_decision = habiles(recibida, PLAZO_DECISION)
    obligatoria = derivacion_obligatoria(d)
    decision = h.get('decision')
    if decision != 'INTERNA':
        texto = 'Derivar la denuncia a la Dirección del Trabajo' if obligatoria or decision == 'DT' \
            else 'Decidir: investigar en la empresa o derivar a la Dirección del Trabajo'
        items.append(_item('decision', texto, 'Art. 12 DS 21', v_decision, _f(h.get('decision_en')), hoy))
    items.append(_item('informar_denunciante', 'Informar por escrito a quien denunció la decisión adoptada',
                       'Art. 12 DS 21', v_decision, _f(h.get('denunciante_informado_en')), hoy))
    v_medidas = None
    if decision == 'INTERNA':
        items.append(_item('decision', 'Iniciar la investigación en la empresa', 'Art. 12 DS 21', v_decision,
                           _f(h.get('decision_en')), hoy))
        items.append(_item('inicio_dt', 'Informar a la DT el inicio de la investigación y las medidas de resguardo',
                           'Art. 12 DS 21', v_decision, _f(h.get('inicio_informado_dt_en')), hoy))
        items.append(_item('investigador', 'Designar a quien investiga e informarlo por escrito a quien denunció',
                           'Art. 14 DS 21', v_decision, _f(h.get('investigador_informado_en')), hoy))
        fin = _f(h.get('informe_emitido_en'))
        items.append(_item('informe', 'Terminar la investigación y emitir el informe', 'Art. 17 DS 21',
                           habiles(recibida, PLAZO_INVESTIGACION), fin, hoy))
        if fin:
            enviado = _f(h.get('informe_enviado_dt_en'))
            items.append(_item('envio_dt', 'Remitir el informe a la Dirección del Trabajo', 'Art. 18 DS 21',
                               habiles(fin, PLAZO_ENVIO_INFORME), enviado, hoy))
            if enviado:
                v_dt = habiles(enviado, PLAZO_PRONUNCIAMIENTO_DT)
                notificado = _f(h.get('pronunciamiento_en'))
                items.append(_item('pronunciamiento', 'Pronunciamiento de la DT (si no responde, valen las '
                                   'conclusiones del informe)', 'Art. 18 DS 21', v_dt, notificado, hoy,
                                   espera=hoy <= v_dt))
                base = notificado or (v_dt if hoy > v_dt else None)
                if base:
                    v_medidas = base + datetime.timedelta(days=PLAZO_MEDIDAS_CORRIDOS)
                    if h.get('resultado_dt') == 'SIN_PRONUNCIAMIENTO' or (not notificado and hoy > v_dt):
                        items.append(_item('notificar_partes', 'Notificar las conclusiones a la persona afectada, '
                                           'denunciante y denunciada', 'Art. 18 DS 21', v_medidas,
                                           _f(h.get('partes_notificadas_en')), hoy))
    elif decision == 'DT':
        derivada = _f(h.get('decision_en'))
        resultado = _f(h.get('resultado_dt_en'))
        items.append(_item('resultado_dt', 'Investigación de la DT (30 días desde que recibe la derivación)',
                           'Art. 17 DS 21', habiles(derivada, PLAZO_INVESTIGACION), resultado, hoy, espera=True))
        if resultado:
            v_medidas = resultado + datetime.timedelta(days=PLAZO_MEDIDAS_CORRIDOS)
    if v_medidas:
        items.append(_item('medidas', 'Aplicar las medidas o sanciones e informarlas a las partes',
                           'Art. 19 DS 21 (15 días corridos)', v_medidas, _f(h.get('medidas_aplicadas_en')), hoy))
    return items


def siguiente_plazo(items):
    pendientes = [i for i in items if i['estado'] in ('VENCIDO', 'POR_VENCER', 'PENDIENTE')]
    return min(pendientes, key=lambda i: i['vence'] or '9999') if pendientes else None


def estado_de(d, hoy=None):
    hoy = hoy or timezone.localdate()
    h = d.hitos or {}
    if h.get('cerrada_en'):
        return 'CERRADA'
    if h.get('decision') == 'DT':
        return 'MEDIDAS' if h.get('resultado_dt_en') else 'DERIVADA_DT'
    if h.get('decision') == 'INTERNA':
        if h.get('informe_enviado_dt_en'):
            vence_dt = habiles(_f(h['informe_enviado_dt_en']), PLAZO_PRONUNCIAMIENTO_DT)
            return 'MEDIDAS' if h.get('pronunciamiento_en') or hoy > vence_dt else 'REVISION_DT'
        if h.get('informe_emitido_en'):
            return 'INFORME'
        return 'INVESTIGACION'
    return 'RECIBIDA'


# ── Avisos (nunca bloquean) ──────────────────────────────────────────────────

def avisos(d, encargado=None):
    lista = []
    obligatoria = derivacion_obligatoria(d)
    if obligatoria and (d.hitos or {}).get('decision') != 'DT':
        lista.append(obligatoria)
    for m in d.resguardo or []:
        if m.get('aplica_a') in ('DENUNCIANTE', 'AMBOS') and m.get('tipo') != 'ATENCION_PSICOLOGICA':
            lista.append('Una medida de resguardo afecta a la persona afectada: no puede ser gravosa ni perjudicarla '
                         '(Art. 20 DS 21). Prefiera medidas que afecten a la persona denunciada.')
            break
    if encargado is not None:
        ruts = {p.get('rut') for p in d.datos.get('denunciados', []) if p.get('rut')}
        if encargado.rut in ruts:
            lista.append('Usted figura como persona denunciada: no debe llevar este caso. Pida al titular que '
                         'designe a otra persona o derive la denuncia a la Dirección del Trabajo.')
    inv = d.investigacion or {}
    if (d.hitos or {}).get('decision') == 'INTERNA':
        ruts_partes = ({d.datos['afectada'].get('rut')} | {p.get('rut') for p in d.datos.get('denunciados', [])})
        if inv.get('investigador', {}).get('rut') in ruts_partes - {''}:
            lista.append('Quien investiga es parte del caso: designe a otra persona (imparcialidad, Art. 14 DS 21).')
        sin_declarar = [p['nombre'] for p in inv.get('participantes', [])
                        if p.get('rol') in ('AFECTADA', 'DENUNCIADA') and not p.get('declaro_en')]
        if (d.hitos or {}).get('informe_emitido_en') is None and sin_declarar and d.informe:
            lista.append('Todas las partes deben ser oídas (Art. 15 DS 21). Falta la declaración de: '
                         + ', '.join(sin_declarar) + '.')
    return lista


def nuevo_participante(entrada):
    if entrada.get('rol') not in _DICT(ROLES):
        raise DatosInvalidos('Indica el rol de la persona en la investigación.')
    return {'id': uuid.uuid4().hex[:10], 'nombre': _texto(entrada.get('nombre'), 150, True, 'el nombre'),
            'rut': _rut(entrada.get('rut'), False, 'la persona'), 'rol': entrada['rol'],
            'citacion': None, 'declaro_en': None}


def citacion(entrada, hoy=None):
    hoy = hoy or timezone.localdate()
    try:
        fecha = datetime.date.fromisoformat(str(entrada.get('fecha')))
        hora = datetime.time.fromisoformat(str(entrada.get('hora')))
    except (TypeError, ValueError):
        raise DatosInvalidos('Indica la fecha y la hora de la citación.')
    if fecha < hoy:
        raise DatosInvalidos('La citación no puede ser en una fecha pasada.')
    return {'fecha': fecha.isoformat(), 'hora': hora.strftime('%H:%M'),
            'lugar': _texto(entrada.get('lugar'), 200, True, 'el lugar de la citación')}


def validar_informe(entrada):
    """Partes f) a i) del Art. 16 (las demás salen de los datos del caso)."""
    if entrada.get('conclusion') not in _DICT(CONCLUSIONES):
        raise DatosInvalidos('Indica la conclusión de la investigación.')
    correctivas = [m for m in entrada.get('medidas_correctivas') or [] if m in _DICT(MEDIDAS_CORRECTIVAS)]
    sanciones = []
    for s in entrada.get('sanciones') or []:
        if (s or {}).get('sancion') not in _DICT(SANCIONES) or not str(s.get('persona', '')).isdigit():
            raise DatosInvalidos('Revisa la propuesta de sanciones.')
        sanciones.append({'persona': int(s['persona']), 'sancion': s['sancion']})
    return {'hechos': _texto(entrada.get('hechos'), 30000, True, 'la relación de hechos, declaraciones y alegaciones'),
            'fundamentos': _texto(entrada.get('fundamentos'), 30000, True,
                                  'los indicios o razonamientos en que se funda la conclusión'),
            'conclusion': entrada['conclusion'], 'medidas_correctivas': correctivas, 'sanciones': sanciones,
            'imparcialidad': _texto(entrada.get('imparcialidad'), 2000)}


def resumen(denuncias, hoy=None):
    """Solo cifras, sin contenido: lo que puede ver el titular y lo que va en los correos."""
    hoy = hoy or timezone.localdate()
    abiertas = vencidas = por_vencer = 0
    proximo = None
    for d in denuncias:
        if (d.hitos or {}).get('cerrada_en'):
            continue
        abiertas += 1
        estados = {i['estado'] for i in plazos(d, hoy)}
        vencidas += 'VENCIDO' in estados
        por_vencer += 'VENCIDO' not in estados and 'POR_VENCER' in estados
        sig = siguiente_plazo(plazos(d, hoy))
        if sig and sig['vence'] and (proximo is None or sig['vence'] < proximo):
            proximo = sig['vence']
    return {'abiertas': abiertas, 'vencidas': vencidas, 'por_vencer': por_vencer, 'proximo_vence': proximo}
