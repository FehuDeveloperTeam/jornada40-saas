"""Protecciones especiales del trabajador: responsabilidades de cuidado (Ley 21.645),
hijo con enfermedad grave (Ley 21.063, SANNA) y fuero laboral.

Solo avisan (mismo formato que los avisos de jornada, core/jornada.py): la carpeta,
el finiquito, la carta de despido y las vacaciones los muestran. Nunca bloquean.
"""
import datetime

from django.utils import timezone

# Fuero maternal: embarazo y hasta un año después de terminar el postnatal de 12
# semanas (Arts. 195 y 201; excluye el postnatal parental). Si el postnatal se
# alargó (parto prematuro o múltiple, enfermedad), se ingresa la fecha exacta.
SEMANAS_POSTNATAL = 12

# ¿A quién cuida? (Ley 21.645, conciliación de la vida personal, familiar y laboral)
CUIDADOS = [
    ('MENOR_14', 'Niño o niña menor de 14 años'),
    ('MENOR_18_DISCAPACIDAD', 'Adolescente menor de 18 años con discapacidad o dependencia'),
    ('DISCAPACIDAD', 'Persona con discapacidad'),
    ('DEPENDENCIA', 'Persona en situación de dependencia severa o moderada'),
]
# Feriado preferente y cambio de turnos en vacaciones escolares: solo cuidado de menores.
CUIDADO_MENORES = ('MENOR_14', 'MENOR_18_DISCAPACIDAD')

FUEROS = [
    ('MATERNIDAD', 'Maternidad: embarazo y hasta un año después del postnatal (Art. 201)'),
    ('POSTNATAL_PARENTAL', 'Padre que usa el postnatal parental (Art. 201 inc. 2°)'),
    ('SINDICAL', 'Dirigente o candidato sindical (Arts. 224, 243)'),
    ('DELEGADO', 'Delegado del personal o sindical (Arts. 229, 302)'),
    ('COMITE_PARITARIO', 'Representante titular del Comité Paritario (Art. 243)'),
    ('NEGOCIACION', 'Negociación colectiva en curso (Art. 309)'),
]


def _sumar_un_anio(fecha):
    try:
        return fecha.replace(year=fecha.year + 1)
    except ValueError:   # 29 de febrero
        return fecha.replace(year=fecha.year + 1, day=28)


def fin_fuero(emp):
    """Último día del fuero: el ingresado o, en maternidad con fecha de parto, el
    calculado. None = vigente sin término conocido (p. ej. embarazo)."""
    if emp.fuero_hasta:
        return emp.fuero_hasta
    if emp.fuero == 'MATERNIDAD' and getattr(emp, 'fecha_parto', None):
        return _sumar_un_anio(emp.fecha_parto + datetime.timedelta(weeks=SEMANAS_POSTNATAL))
    return None


def fuero_vigente(emp, hoy=None):
    hoy = hoy or timezone.localdate()
    fin = fin_fuero(emp)
    return bool(emp.fuero) and (fin is None or fin >= hoy)


def solicitudes_pendientes(emp, hoy=None):
    """Solicitudes de conciliación sin responder, con su plazo."""
    from .models import SolicitudConciliacion
    hoy = hoy or timezone.localdate()
    return [(s, s.vence_el, s.vence_el < hoy) for s in
            SolicitudConciliacion.objects.filter(empleado=emp, activo=True, estado='PENDIENTE')]


def vacaciones_escolares(hoy=None, cuantas=2):
    from .models import PeriodoVacacionesEscolares
    hoy = hoy or timezone.localdate()
    return list(PeriodoVacacionesEscolares.objects.filter(hasta__gte=hoy)[:cuantas])


def avisos(emp, hoy=None):
    """Avisos de protección del trabajador, con la forma de AvisoJornada del frontend."""
    hoy = hoy or timezone.localdate()
    lista = []
    if fuero_vigente(emp, hoy):
        tipo = dict(FUEROS).get(emp.fuero, emp.fuero).split(' (')[0]
        fin = fin_fuero(emp)
        hasta = f' hasta el {fin:%d-%m-%Y}' if fin else ''
        calculado = (' (calculado desde el parto: 12 semanas de postnatal más un año; si el postnatal se alargó, '
                     'ingresa la fecha exacta).' if fin and not emp.fuero_hasta else '')
        lista.append({
            'codigo': 'FUERO', 'gravedad': 'alta',
            'titulo': f'Trabajador con fuero{hasta}',
            'detalle': f'Fuero por {tipo.lower()}. No se le puede despedir sin autorización judicial previa '
                       '(desafuero), ni siquiera por vencimiento del plazo o término de la obra.' + calculado,
            'recomendacion': 'Antes de cualquier término de contrato, consulta con un abogado y pide el desafuero '
                             'al juzgado del trabajo.',
            'articulo': 'Art. 174 del Código del Trabajo',
        })
    if emp.cuidado_de:
        a_quien = dict(CUIDADOS).get(emp.cuidado_de, '').lower()
        menores = emp.cuidado_de in CUIDADO_MENORES
        periodos = vacaciones_escolares(hoy) if menores else []
        proximas = ('' if not periodos else ' Próximas vacaciones escolares: ' + '; '.join(
            f'{p.nombre} del {p.desde:%d-%m} al {p.hasta:%d-%m-%Y}' for p in periodos) + '.')
        lista.append({
            'codigo': 'CUIDADO', 'gravedad': 'media',
            'titulo': 'Trabajador con responsabilidades de cuidado',
            'detalle': f'Cuida a: {a_quien}. Tiene derecho preferente a teletrabajo si su cargo lo permite'
                       + ('; preferencia para tomar su feriado en las vacaciones escolares y a pedir un cambio '
                          'transitorio de turnos o jornada en ese período (avisando con 30 días; respondes en 10).'
                          if menores else '.') + proximas,
            'recomendacion': 'Si pide teletrabajo, un cambio de jornada o feriado en vacaciones escolares, '
                             'respóndele por escrito dentro de plazo; si lo rechazas, explica el motivo.',
            'articulo': 'Ley 21.645 (conciliación de la vida laboral, familiar y personal)',
        })
    # Solo quien tiene responsabilidades de cuidado presenta estas solicitudes (y así
    # el listado de trabajadores no consulta solicitudes de todos).
    for s, vence, vencida in (solicitudes_pendientes(emp, hoy) if emp.cuidado_de else []):
        lista.append({
            'codigo': 'CONCILIACION', 'gravedad': 'alta' if vencida else 'media',
            'titulo': (f'Solicitud de {s.get_tipo_display().lower()} sin responder: '
                       + (f'el plazo venció el {vence:%d-%m-%Y}' if vencida else f'responde a más tardar el {vence:%d-%m-%Y}')),
            'detalle': f'La presentó el {s.presentada_el:%d-%m-%Y}. Puedes aceptarla, ofrecer otra fórmula o rechazarla '
                       'fundadamente.',
            'recomendacion': 'Registra tu respuesta en la ficha del trabajador (Protecciones especiales) y entrégasela '
                             'por escrito.',
            'articulo': 'Art. 152 quáter O bis (15 días) o Art. 207 ter (10 días) del Código del Trabajo',
        })
    if emp.hijo_enfermedad_grave:
        lista.append({
            'codigo': 'SANNA', 'gravedad': 'media',
            'titulo': 'Hijo o hija con enfermedad grave',
            'detalle': 'Puede ausentarse con licencia médica del Seguro SANNA para acompañarlo; esos días los paga '
                       'el seguro y no son inasistencias.',
            'recomendacion': 'Registra sus licencias como licencia médica (no como ausencia) y facilita los '
                             'permisos para atenderlo.',
            'articulo': 'Ley 21.063 (SANNA) y Art. 199 bis del Código del Trabajo',
        })
    return lista
