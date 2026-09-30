"""Catálogo de módulos del panel y cupos de usuarios.

La cuenta tiene tres tipos de acceso, cada uno con su propia entrada y sesión:

- TITULAR: quien creó la cuenta. Ve y gestiona todo, salvo el contenido de las
  denuncias de la Ley Karin (solo un contador de casos y plazos, sin datos).
- EQUIPO: personas que el titular invita. Ven solo los módulos marcados, cada
  uno en nivel "solo ver" o "ver y gestionar", y solo las empresas elegidas.
- LEY KARIN: encargado de denuncias. Entrada y sesión aparte; no ve nada más
  del sistema, aunque su RUT también sea titular o del equipo.

Los cupos del equipo son una bolsa común de la cuenta: usuarios por empresa ×
empresas del plan, más los adicionales comprados. El encargado de la Ley Karin
va fuera de ese cupo (uno desde Pyme, más los adicionales comprados).
"""

VER = 'VER'
GESTIONAR = 'GESTIONAR'
NIVELES = [(VER, 'Solo ver'), (GESTIONAR, 'Ver y gestionar')]

# código, nombre, descripción (lo que el titular lee al marcar la casilla)
MODULOS = [
    ('TRABAJADORES', 'Trabajadores', 'Fichas, datos personales y carpeta de cada trabajador.'),
    ('CONTRATOS', 'Contratos y anexos', 'Contratos, anexos, Ley 40 horas, teletrabajo y digitalización.'),
    ('REMUNERACIONES', 'Remuneraciones', 'Liquidaciones, conceptos, Previred, libro electrónico y Certificado N°6.'),
    ('VACACIONES', 'Vacaciones y permisos', 'Vacaciones, días libres por horas extra y permisos legales.'),
    ('DOCUMENTOS', 'Documentos y pactos', 'Amonestaciones, constancias, pactos y autorizaciones de descuento.'),
    ('TERMINO', 'Término de contrato', 'Cartas de despido y finiquitos.'),
    ('DIRECCION_TRABAJO', 'Dirección del Trabajo', 'Registro en Mi DT, consentimientos y accesos de fiscalización.'),
    ('SEGURIDAD', 'Reglamento y seguridad', 'Reglamento interno, información de riesgos, EPP y aviso de la Ley Karin.'),
    ('SOLICITUDES', 'Solicitudes del portal', 'Documentos que piden los trabajadores desde su portal.'),
    ('REPORTES', 'Reportes y expedientes', 'Reportes y descargas masivas (ZIP) de documentos.'),
]
CODIGOS_MODULOS = [c for c, _, _ in MODULOS]

# Los demás módulos muestran datos de los trabajadores: quien tenga cualquiera
# de ellos puede al menos ver las fichas (sin editarlas).
REQUIERE_VER_TRABAJADORES = set(CODIGOS_MODULOS) - {'TRABAJADORES'}

# Acciones que nunca se delegan.
SOLO_TITULAR = [
    'Datos de la empresa y firma del empleador',
    'Plan, pagos y usuarios adicionales',
    'Usuarios del equipo y encargado de la Ley Karin',
    'Bitácora de acciones',
    'Crear o desactivar empresas',
]

USUARIOS_POR_EMPRESA = 2          # desde Starter; Semilla solo tiene al titular
NIVEL_EQUIPO = 2                  # Starter en adelante
NIVEL_LEY_KARIN = 3               # Pyme en adelante
ENCARGADOS_LEY_KARIN = 1          # por cuenta, fuera del cupo del equipo
ANIOS_BITACORA = 5


def normalizar_permisos(permisos):
    """{código: nivel} solo con módulos y niveles válidos (lo demás se descarta)."""
    niveles = {n for n, _ in NIVELES}
    return {m: n for m, n in (permisos or {}).items() if m in CODIGOS_MODULOS and n in niveles}


def cupo_equipo(plan, adicionales=0):
    """Usuarios del equipo que permite el plan: bolsa común de la cuenta."""
    if plan is None or plan.nivel < NIVEL_EQUIPO:
        return 0
    return USUARIOS_POR_EMPRESA * max(plan.max_empresas or 1, 1) + max(adicionales or 0, 0)


def cupo_ley_karin(plan, adicionales=0):
    """Encargados de denuncias de la Ley Karin: uno desde Pyme, más los comprados."""
    if plan is None or plan.nivel < NIVEL_LEY_KARIN:
        return 0
    return ENCARGADOS_LEY_KARIN + max(adicionales or 0, 0)
