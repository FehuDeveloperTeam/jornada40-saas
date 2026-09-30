"""Catálogos cerrados de seguridad laboral: elementos de protección personal
(EPP) y riesgos para la información del Art. 15 del DS 44.

Los riesgos salen de los rubros de la plantilla del reglamento
(core.reglamento_plantilla.RUBROS) más unos comunes a todo trabajo, así que un
rubro nuevo trae sus riesgos a la constancia sin tocar nada aquí.
"""
from .reglamento_plantilla import RUBROS

EPP = [
    ('CASCO', 'Casco de seguridad'),
    ('CALZADO', 'Calzado de seguridad'),
    ('CALZADO_ANTIDESLIZANTE', 'Calzado antideslizante'),
    ('GUANTES', 'Guantes de trabajo'),
    ('GUANTES_ANTICORTE', 'Guantes anticorte'),
    ('GUANTES_TERMICOS', 'Guantes térmicos'),
    ('GUANTES_NITRILO', 'Guantes de nitrilo o de procedimiento'),
    ('LENTES', 'Lentes de seguridad'),
    ('CARETA', 'Careta facial o de soldar'),
    ('PROTECTOR_AUDITIVO', 'Protector auditivo'),
    ('RESPIRADOR', 'Respirador con filtro'),
    ('MASCARILLA', 'Mascarilla'),
    ('ARNES', 'Arnés de seguridad con línea de vida'),
    ('CHALECO', 'Chaleco reflectante'),
    ('ROPA_TRABAJO', 'Ropa de trabajo'),
    ('ROPA_IMPERMEABLE', 'Ropa impermeable'),
    ('DELANTAL', 'Delantal o pechera'),
    ('COFIA', 'Cofia o gorro'),
    ('LEGIONARIO', 'Sombrero o legionario'),
    ('PROTECTOR_SOLAR', 'Protector solar'),
]
TEXTO_EPP = dict(EPP)
# Elementos que se sugieren marcados según el rubro de la empresa.
EPP_POR_RUBRO = {
    'ADMINISTRACION': [],
    'COMERCIO': ['CALZADO', 'GUANTES'],
    'MANUFACTURA': ['CALZADO', 'GUANTES', 'PROTECTOR_AUDITIVO', 'LENTES', 'ROPA_TRABAJO'],
    'TECNOLOGIA': [],
    'CONSTRUCCION': ['CASCO', 'CALZADO', 'ARNES', 'GUANTES', 'LENTES', 'PROTECTOR_AUDITIVO', 'CHALECO', 'RESPIRADOR'],
    'GASTRONOMIA': ['CALZADO_ANTIDESLIZANTE', 'GUANTES_TERMICOS', 'GUANTES_ANTICORTE', 'DELANTAL', 'COFIA'],
    'TRANSPORTE': ['CALZADO', 'GUANTES', 'CHALECO', 'CASCO'],
    'AGRICOLA': ['LEGIONARIO', 'PROTECTOR_SOLAR', 'GUANTES', 'CALZADO', 'RESPIRADOR', 'ROPA_IMPERMEABLE'],
    'ASEO': ['GUANTES_NITRILO', 'CALZADO_ANTIDESLIZANTE', 'LENTES', 'MASCARILLA'],
    'SALUD': ['GUANTES_NITRILO', 'MASCARILLA', 'LENTES', 'DELANTAL', 'CALZADO'],
}
MOTIVOS_EPP = [
    ('INGRESO', 'Ingreso del trabajador'),
    ('REPOSICION', 'Reposición por desgaste'),
    ('DETERIORO', 'Reposición por deterioro o falla'),
    ('PERDIDA', 'Reposición por pérdida'),
    ('CAMBIO_PUESTO', 'Cambio de puesto o de tareas'),
]
MOTIVOS_RIESGOS = [
    ('INGRESO', 'Antes de empezar a trabajar'),
    ('CAMBIO_PUESTO', 'Cambio de puesto o de tareas'),
    ('NUEVO_PROCESO', 'Nuevo proceso, tecnología, material o sustancia'),
]

_COMUNES = [
    ('COMUN_EMERGENCIAS', 'Emergencias (sismo, incendio y evacuación)',
     'Conocer las vías de evacuación, las zonas de seguridad y el plan de emergencia; participar en los simulacros.'),
    ('COMUN_PSICOSOCIAL', 'Riesgos psicosociales, acoso y violencia en el trabajo',
     'Protocolo de prevención de la Ley Karin, canales de denuncia y pausas en la jornada.'),
    ('COMUN_TRAYECTO', 'Accidentes de trayecto',
     'Respetar las normas del tránsito y avisar de inmediato cualquier accidente al ir o volver del trabajo.'),
]


def riesgos():
    """{código: (riesgo, medidas)} de todos los rubros y los comunes."""
    salida = {codigo: (riesgo, medidas) for codigo, riesgo, medidas in _COMUNES}
    for rubro, datos in RUBROS.items():
        for i, (riesgo, medidas) in enumerate(datos['riesgos']):
            salida[f'{rubro}_{i}'] = (riesgo, medidas)
    return salida


def riesgos_del_rubro(rubro):
    """Códigos sugeridos para un rubro: los suyos más los comunes."""
    propios = [f'{rubro}_{i}' for i in range(len(RUBROS.get(rubro, {}).get('riesgos', [])))]
    return propios + [c for c, _, _ in _COMUNES]
