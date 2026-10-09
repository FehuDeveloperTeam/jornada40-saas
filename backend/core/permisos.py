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


# ── Cerco de los usuarios del equipo ─────────────────────────────────────────
#
# Cada ruta del panel pertenece a un módulo. Leer (GET, o POST que solo calcula
# o descarga) pide "solo ver"; lo demás pide "ver y gestionar". Lo que no está
# en estas listas es del titular (empresa, plan, pagos, equipo, bitácora…) y se
# rechaza. Las rutas de identidad actúan como la propia persona; las demás, sobre
# los datos de la cuenta, limitados a sus empresas.

# Actúan como la persona (su clave, su sesión, su confirmación para firmar).
RUTAS_IDENTIDAD = (
    '/api/auth/logout/', '/api/auth/user/', '/api/auth/sesion/', '/api/auth/password/change/',
    '/api/auth/token/refresh/', '/api/firmas/confirmar_identidad/', '/api/clientes/resumen/',
)
# Datos de la cuenta que todo usuario del equipo necesita para usar el panel (solo lectura).
RUTAS_COMUNES_LECTURA = (
    '/api/empresas/', '/api/clientes/mi_suscripcion/', '/api/indicadores/', '/api/parametros/vigentes/',
    '/api/planes/', '/api/catalogos/',
)
# POST que no modifican nada: vistas previas y descargas.
# Conectar o desconectar el propio navegador a la extensión para Mi DT tampoco modifica datos de la
# cuenta: con "solo ver" la extensión sirve para consultar y copiar (marcar registros pide gestionar).
_SOLO_LECTURA_POST = ('/simular/', '/evaluar-jornada/', '/descarga_masiva/', '/descargar_anexos_zip/',
                      '/api/extension/codigo/', '/api/extension/dispositivos/')

# (prefijo, módulos que la abren). El primero que calce decide; con varios módulos basta uno.
RUTAS_MODULO = [
    ('/api/empleados/', lambda ruta: (
        ('DIRECCION_TRABAJO',) if '/consentimiento/' in ruta else
        ('CONTRATOS',) if '/digitalizar_contrato/' in ruta else
        ('REPORTES',) if '/descarga_masiva/' in ruta or '/descargar_anexos_zip/' in ruta else
        ('TRABAJADORES',))),
    ('/api/contratos/', ('CONTRATOS',)),
    ('/api/anexos_contrato/', ('CONTRATOS',)),
    ('/api/liquidaciones/consolidado/', ('REMUNERACIONES', 'REPORTES')),
    ('/api/liquidaciones/libro_remuneraciones/', ('REMUNERACIONES', 'REPORTES')),
    ('/api/liquidaciones/zip_periodo/', ('REMUNERACIONES', 'REPORTES')),
    ('/api/liquidaciones/', ('REMUNERACIONES',)),
    ('/api/conceptos/', ('REMUNERACIONES',)),
    ('/api/certificados-sueldos/', ('REMUNERACIONES',)),
    ('/api/vacaciones/', ('VACACIONES',)),
    ('/api/finiquitos/', ('TERMINO',)),
    ('/api/registro-dt/', ('DIRECCION_TRABAJO',)),
    ('/api/inspeccion/bitacora/', ('DIRECCION_TRABAJO',)),
    ('/api/extension/', ('DIRECCION_TRABAJO',)),
    ('/api/reglamentos/', ('SEGURIDAD',)),
    ('/api/ley-karin/', ('SEGURIDAD',)),
    ('/api/solicitudes-documento/', ('SOLICITUDES',)),
    ('/api/certificados/', ('TRABAJADORES',)),
    ('/api/solicitudes-conciliacion/', ('TRABAJADORES',)),
    ('/api/solicitudes-permiso/', ('VACACIONES',)),
    ('/api/peticiones-portal/', ('VACACIONES', 'TRABAJADORES')),
]

# Documentos que se firman o se crean por tipo: el módulo sale del tipo.
MODULO_POR_TIPO = {
    'CONTRATO': 'CONTRATOS', 'ANEXO_40H': 'CONTRATOS', 'ANEXO_CONTRATO': 'CONTRATOS',
    'LIQUIDACION': 'REMUNERACIONES', 'VACACION': 'VACACIONES', 'PERMISO_LEGAL': 'VACACIONES',
    'FINIQUITO': 'TERMINO', 'DESPIDO': 'TERMINO',
    'AMONESTACION': 'DOCUMENTOS', 'CONSTANCIA': 'DOCUMENTOS', 'HORAS_EXTRA': 'DOCUMENTOS',
    'DESCUENTO': 'DOCUMENTOS', 'INDEMNIZACION': 'DOCUMENTOS', 'REVOCACION_DESCUENTO': 'DOCUMENTOS',
    'MUTUO_ACUERDO': 'TERMINO',
    'REGLAMENTO': 'SEGURIDAD', 'CANALES_DENUNCIA': 'SEGURIDAD', 'ENTREGA_EPP': 'SEGURIDAD',
    'INFORMACION_RIESGOS': 'SEGURIDAD',
}
MODULOS_DOCUMENTOS = ('DOCUMENTOS', 'TERMINO', 'VACACIONES', 'SEGURIDAD', 'CONTRATOS', 'REMUNERACIONES')


def es_lectura(ruta, metodo):
    return metodo in ('GET', 'HEAD', 'OPTIONS') or (metodo == 'POST' and any(p in ruta for p in _SOLO_LECTURA_POST))


def tiene(permisos, modulos, escribir):
    """Si con esos permisos se abre alguno de los módulos (en el nivel pedido)."""
    for m in modulos:
        nivel = permisos.get(m)
        if nivel == GESTIONAR or (nivel == VER and not escribir):
            return True
    # Quien tiene cualquier módulo puede ver las fichas de los trabajadores.
    if not escribir and 'TRABAJADORES' in modulos and permisos:
        return True
    return False


def modulos_de_ruta(ruta):
    """Módulos que abren la ruta, o None si no es de ningún módulo."""
    for prefijo, modulos in RUTAS_MODULO:
        if ruta.startswith(prefijo):
            return modulos(ruta) if callable(modulos) else modulos
    return None
