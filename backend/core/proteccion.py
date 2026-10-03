"""Protecciones especiales del trabajador: responsabilidades de cuidado (Ley 21.645),
hijo con enfermedad grave (Ley 21.063, SANNA) y fuero laboral.

Solo avisan (mismo formato que los avisos de jornada, core/jornada.py): la carpeta,
el finiquito, la carta de despido y las vacaciones los muestran. Nunca bloquean.
"""
from django.utils import timezone

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


def fuero_vigente(emp, hoy=None):
    hoy = hoy or timezone.localdate()
    return bool(emp.fuero) and (emp.fuero_hasta is None or emp.fuero_hasta >= hoy)


def avisos(emp, hoy=None):
    """Avisos de protección del trabajador, con la forma de AvisoJornada del frontend."""
    hoy = hoy or timezone.localdate()
    lista = []
    if fuero_vigente(emp, hoy):
        tipo = dict(FUEROS).get(emp.fuero, emp.fuero).split(' (')[0]
        hasta = f' hasta el {emp.fuero_hasta:%d-%m-%Y}' if emp.fuero_hasta else ''
        lista.append({
            'codigo': 'FUERO', 'gravedad': 'alta',
            'titulo': f'Trabajador con fuero{hasta}',
            'detalle': f'Fuero por {tipo.lower()}. No se le puede despedir sin autorización judicial previa '
                       '(desafuero), ni siquiera por vencimiento del plazo o término de la obra.',
            'recomendacion': 'Antes de cualquier término de contrato, consulta con un abogado y pide el desafuero '
                             'al juzgado del trabajo.',
            'articulo': 'Art. 174 del Código del Trabajo',
        })
    if emp.cuidado_de:
        a_quien = dict(CUIDADOS).get(emp.cuidado_de, '').lower()
        menores = emp.cuidado_de in CUIDADO_MENORES
        lista.append({
            'codigo': 'CUIDADO', 'gravedad': 'media',
            'titulo': 'Trabajador con responsabilidades de cuidado',
            'detalle': f'Cuida a: {a_quien}. Tiene derecho preferente a teletrabajo si su cargo lo permite'
                       + ('; preferencia para tomar su feriado en las vacaciones escolares y a pedir un cambio '
                          'transitorio de turnos o jornada en ese período (avisando con 30 días; respondes en 10).'
                          if menores else '.'),
            'recomendacion': 'Si pide teletrabajo, un cambio de jornada o feriado en vacaciones escolares, '
                             'respóndele por escrito dentro de plazo; si lo rechazas, explica el motivo.',
            'articulo': 'Ley 21.645 (conciliación de la vida laboral, familiar y personal)',
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
