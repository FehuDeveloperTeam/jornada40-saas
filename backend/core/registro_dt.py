"""Registro Electrónico Laboral de la Dirección del Trabajo (Ley 21.327).

Plazos de registro en Mi DT y el archivo CSV de "Registro Masivo de Contratos
de Trabajo" según el instructivo oficial (versión 21.04.22): columnas,
códigos y formatos. Mi DT no tiene API: el empleador sube el archivo.

Notas del instructivo que condicionan el archivo:
- Un archivo por cargo (y por CAE): el cargo se elige en el formulario.
- Separador punto y coma, fechas dd/mm/aaaa, montos sin puntos, 1.000 filas y
  5 MB como máximo, nombre rutempleador_aaaamm.csv.
- Trabajador con RUT chileno: DNI, fecha de nacimiento, nombres, apellidos,
  sexo y nacionalidad van vacíos (son solo para extranjeros sin RUT).
"""
import datetime
import re
import unicodedata

from .rut import formatear_rut, limpiar_rut

# Orden de columnas del instructivo ("Estructura CSV archivo de carga masiva").
COLUMNAS = [
    'CATEGORIA_CONTRATO', 'COMUNA_CELEBRACION', 'FECHA_SUSCRPCION', 'RUT_TRABAJADOR', 'DNI_TRABAJADOR',
    'FECHA_NACIMIENTO', 'NOMBRES', 'APELLIDOS', 'SEXO', 'NACIONALIDAD', 'EMAIL', 'TELEFONO', 'COMUNA', 'CALLE',
    'NUMERO', 'DPTO', 'DECLARACION_DISCAPACIDAD', 'DECLARACION_INVALIDEZ', 'FUNCIONES', 'SUBCONTRATACION',
    'RUT_EMPRESA_PRINCIPAL', 'EST', 'RUT_EMPRESA_USUARIA', 'FAENA_COMUNA', 'FAENA_CALLE', 'FAENA_NUMERO',
    'FAENA_DPTO', 'ZONA_GEOGRAFICA_1', 'ZONA_GEOGRAFICA_2', 'ZONA_GEOGRAFICA_3', 'ZONA_GEOGRAFICA_4',
    'ZONA_GEOGRAFICA_5', 'SUELDO_BASE', 'MONTO_IMPONIBLE',
    'HABER_1', 'MONTO_1', 'PER_DEVENGAMIENTO_1', 'HABER_2', 'MONTO_2', 'PER_DEVENGAMIENTO_2',
    'HABER_3', 'MONTO_3', 'PER_DEVENGAMIENTO_3', 'HABER_4', 'MONTO_4', 'PER_DEVENGAMIENTO_4',
    'HABER_5', 'MONTO_5', 'PER_DEVENGAMIENTO_5',
    'GRAT_FORMA_PAGO', 'GRAT_MODALIDAD', 'GRAT_PERIODO_PAGO', 'REM_PERIODO_PAGO', 'REM_FECHA_PAGO',
    'REM_FORMA_PAGO', 'REM_ANTICIPO', 'REM_AFP', 'REM_SALUD', 'REM_OTROS_PACTOS', 'TIPO_JORNADA',
    'NRO_RESOLUCION', 'FECHA_RESOLUCION', 'DURACION_JORNADA', 'TURNOS', 'TIEMPO_COLACION', 'T_COLACION_IMP',
    'T_COLACION_NO_IMP', 'ROTACION', 'NRO_DIAS_DIST_JOR',
    'LUNES_HORA_INICIO', 'LUNES_HORA_TERMINO', 'MARTES_HORA_INICIO', 'MARTES_HORA_TERMINO',
    'MIERCOLES_HORA_INICIO', 'MIERCOLES_HORA_TERMINO', 'JUEVES_HORA_INICIO', 'JUEVES_HORA_TERMINO',
    'VIERNES_HORA_INICIO', 'VIERNES_HORA_TERMINO', 'SABADO_HORA_INICIO', 'SABADO_HORA_TERMINO',
    'DOMINGO_HORA_INICIO', 'DOMINGO_HORA_TERMINO',
    'TIPO_CONTRATO', 'FECHA_INI_RELABORAL', 'FECHA_FIN_RELABORAL', 'OTROS_INDEMNIZACIONES', 'OTROS_FERIADOS',
    'OTROS_NEGOCIACIONES', 'OTROS_PROPINTELECTUAL', 'OTROS_LICMEDICA', 'OTROS_SALACUNA', 'OTROS_PERMISOS',
    'OTROS_CONESPECIALES', 'OTROS_SEGUROS', 'OTROS_STOCK', 'OTROS_INSTCOLECTIVO', 'AFECTO_A',
    'FECHA_INI_INSTCOLECTIVO', 'FECHA_FIN_INSTCOLECTIVO',
]

# Tabla N°1 del instructivo: código de comuna.
COMUNAS = {
    1: 'IQUIQUE', 2: 'ALTO HOSPICIO', 3: 'CAMIÑA', 4: 'PICA',
    5: 'POZO ALMONTE', 6: 'HUARA', 7: 'COLCHANE', 8: 'MEJILLONES',
    9: 'ANTOFAGASTA', 10: 'TALTAL', 11: 'SIERRA GORDA', 12: 'CALAMA',
    13: 'SAN PEDRO DE ATACAMA', 14: 'OLLAGÜE', 15: 'TOCOPILLA', 16: 'MARÍA ELENA',
    17: 'COPIAPÓ', 18: 'CALDERA', 19: 'TIERRA AMARILLA', 20: 'DIEGO DE ALMAGRO',
    21: 'CHAÑARAL', 22: 'HUASCO', 23: 'FREIRINA', 24: 'VALLENAR',
    25: 'ALTO DEL CARMEN', 26: 'COQUIMBO', 27: 'LA SERENA', 28: 'ANDACOLLO',
    29: 'PAIGUANO', 30: 'VICUÑA', 31: 'LA HIGUERA', 32: 'CANELA',
    33: 'ILLAPEL', 34: 'SALAMANCA', 35: 'LOS VILOS', 36: 'COMBARBALÁ',
    37: 'MONTE PATRIA', 38: 'PUNITAQUI', 39: 'OVALLE', 40: 'RÍO HURTADO',
    41: 'JUAN FERNÁNDEZ', 42: 'VALPARAÍSO', 43: 'CASABLANCA', 44: 'CONCÓN',
    45: 'VIÑA DEL MAR', 46: 'PUCHUNCAVÍ', 47: 'QUINTERO', 48: 'ISLA DE PASCUA',
    49: 'CALLE LARGA', 50: 'LOS ANDES', 51: 'SAN ESTEBAN', 52: 'RINCONADA',
    53: 'CABILDO', 54: 'PETORCA', 55: 'ZAPALLAR', 56: 'LA LIGUA',
    57: 'PAPUDO', 58: 'HIJUELAS', 59: 'QUILLOTA', 60: 'CALERA',
    61: 'NOGALES', 62: 'LA CRUZ', 63: 'CARTAGENA', 64: 'ALGARROBO',
    65: 'SAN ANTONIO', 66: 'EL TABO', 67: 'SANTO DOMINGO', 68: 'EL QUISCO',
    69: 'LLAILLAY', 70: 'CATEMU', 71: 'SAN FELIPE', 72: 'PUTAENDO',
    73: 'SANTA MARÍA', 74: 'PANQUEHUE', 75: 'VILLA ALEMANA', 76: 'OLMUÉ',
    77: 'LIMACHE', 78: 'QUILPUÉ', 79: 'QUINTA DE TILCOCO', 80: 'RENGO',
    81: 'REQUÍNOA', 82: 'SAN VICENTE', 83: 'PICHIDEGUA', 84: 'PEUMO',
    85: 'OLIVAR', 86: 'MOSTAZAL', 87: 'MALLOA', 88: 'MACHALÍ',
    89: 'CODEGUA', 90: 'GRANEROS', 91: 'DOÑIHUE', 92: 'COLTAUCO',
    93: 'COINCO', 94: 'RANCAGUA', 95: 'LAS CABRAS', 96: 'PAREDONES',
    97: 'NAVIDAD', 98: 'LITUECHE', 99: 'LA ESTRELLA', 100: 'MARCHIHUE',
    101: 'PICHILEMU', 102: 'LOLOL', 103: 'SANTA CRUZ', 104: 'PUMANQUE',
    105: 'PLACILLA', 106: 'PERALILLO', 107: 'SAN FERNANDO', 108: 'CHÉPICA',
    109: 'CHIMBARONGO', 110: 'NANCAGUA', 111: 'PALMILLA', 112: 'PELARCO',
    113: 'RÍO CLARO', 114: 'MAULE', 115: 'PENCAHUE', 116: 'SAN RAFAEL',
    117: 'EMPEDRADO', 118: 'SAN CLEMENTE', 119: 'CONSTITUCIÓN', 120: 'TALCA',
    121: 'CUREPTO', 122: 'PELLUHUE', 123: 'CHANCO', 124: 'CAUQUENES',
    125: 'ROMERAL', 126: 'SAGRADA FAMILIA', 127: 'TENO', 128: 'VICHUQUÉN',
    129: 'RAUCO', 130: 'MOLINA', 131: 'CURICÓ', 132: 'HUALAÑÉ',
    133: 'LICANTÉN', 134: 'PARRAL', 135: 'RETIRO', 136: 'SAN JAVIER',
    137: 'VILLA ALEGRE', 138: 'YERBAS BUENAS', 139: 'LONGAVÍ', 140: 'LINARES',
    141: 'COLBÚN', 142: 'FLORIDA', 143: 'LOTA', 144: 'HUALQUI',
    145: 'CHIGUAYANTE', 146: 'PENCO', 147: 'CORONEL', 148: 'SANTA JUANA',
    149: 'TALCAHUANO', 150: 'TOMÉ', 151: 'HUALPÉN', 152: 'CONCEPCIÓN',
    153: 'SAN PEDRO DE LA PAZ', 154: 'CAÑETE', 155: 'CURANILAHUE', 156: 'CONTULMO',
    157: 'LOS ÁLAMOS', 158: 'ARAUCO', 159: 'TIRÚA', 160: 'LEBU',
    161: 'NEGRETE', 162: 'TUCAPEL', 163: 'YUMBEL', 164: 'ALTO BIOBÍO',
    165: 'SANTA BÁRBARA', 166: 'SAN ROSENDO', 167: 'QUILACO', 168: 'NACIMIENTO',
    169: 'QUILLECO', 170: 'LAJA', 171: 'CABRERO', 172: 'ANTUCO',
    173: 'LOS ÁNGELES', 174: 'MULCHÉN', 175: 'PORTEZUELO', 176: 'QUILLÓN',
    177: 'QUIRIHUE', 178: 'RÁNQUIL', 179: 'SAN CARLOS', 180: 'SAN IGNACIO',
    181: 'PINTO', 182: 'SAN NICOLÁS', 183: 'TREGUACO', 184: 'YUNGAY',
    185: 'SAN FABIÁN', 186: 'ÑIQUÉN', 187: 'PEMUCO', 188: 'BULNES',
    189: 'EL CARMEN', 190: 'CHILLÁN VIEJO', 191: 'COIHUECO', 192: 'COELEMU',
    193: 'COBQUECURA', 194: 'CHILLÁN', 195: 'NINHUE', 196: 'PERQUENCO',
    197: 'NUEVA IMPERIAL', 198: 'PITRUFQUÉN', 199: 'PADRE LAS CASAS', 200: 'PUCÓN',
    201: 'VILCÚN', 202: 'TEODORO SCHMIDT', 203: 'CHOLCHOL', 204: 'VILLARRICA',
    205: 'TOLTÉN', 206: 'SAAVEDRA', 207: 'MELIPEUCO', 208: 'CUNCO',
    209: 'LAUTARO', 210: 'LONCOCHE', 211: 'CARAHUE', 212: 'CURARREHUE',
    213: 'TEMUCO', 214: 'GALVARINO', 215: 'GORBEA', 216: 'FREIRE',
    217: 'VICTORIA', 218: 'TRAIGUÉN', 219: 'RENAICO', 220: 'PURÉN',
    221: 'LUMACO', 222: 'LOS SAUCES', 223: 'LONQUIMAY', 224: 'COLLIPULLI',
    225: 'CURACAUTÍN', 226: 'ANGOL', 227: 'ERCILLA', 228: 'PUERTO VARAS',
    229: 'MAULLÍN', 230: 'LLANQUIHUE', 231: 'FRUTILLAR', 232: 'CALBUCO',
    233: 'FRESIA', 234: 'COCHAMÓ', 235: 'PUERTO MONTT', 236: 'LOS MUERMOS',
    237: 'QUEILÉN', 238: 'ANCUD', 239: 'CHONCHI', 240: 'QUINCHAO',
    241: 'QUEMCHI', 242: 'QUELLÓN', 243: 'CASTRO', 244: 'PUQUELDÓN',
    245: 'DALCAHUE', 246: 'CURACO DE VÉLEZ', 247: 'SAN JUAN DE LA COSTA', 248: 'PUERTO OCTAY',
    249: 'OSORNO', 250: 'RÍO NEGRO', 251: 'PUYEHUE', 252: 'SAN PABLO',
    253: 'PURRANQUE', 254: 'HUALAIHUÉ', 255: 'PALENA', 256: 'CHAITÉN',
    257: 'FUTALEUFÚ', 258: 'COYHAIQUE', 259: 'LAGO VERDE', 260: 'AYSÉN',
    261: 'GUAITECAS', 262: 'CISNES', 263: 'COCHRANE', 264: "O'HIGGINS",
    265: 'TORTEL', 266: 'RÍO IBÁÑEZ', 267: 'CHILE CHICO', 268: 'SAN GREGORIO',
    269: 'RÍO VERDE', 270: 'LAGUNA BLANCA', 271: 'PUNTA ARENAS', 272: 'ANTÁRTICA',
    273: 'CABO DE HORNOS', 274: 'PORVENIR', 275: 'PRIMAVERA', 276: 'TIMAUKEL',
    277: 'NATALES', 278: 'TORRES DEL PAINE', 279: 'ESTACIÓN CENTRAL', 280: 'LAS CONDES',
    281: 'LA REINA', 282: 'LA PINTANA', 283: 'LA GRANJA', 284: 'LA FLORIDA',
    285: 'LA CISTERNA', 286: 'SANTIAGO', 287: 'CERRILLOS', 288: 'INDEPENDENCIA',
    289: 'CONCHALÍ', 290: 'EL BOSQUE', 291: 'HUECHURABA', 292: 'CERRO NAVIA',
    293: 'MAIPÚ', 294: 'VITACURA', 295: 'ÑUÑOA', 296: 'PEDRO AGUIRRE CERDA',
    297: 'PEÑALOLÉN', 298: 'PROVIDENCIA', 299: 'LO BARNECHEA', 300: 'PUDAHUEL',
    301: 'MACUL', 302: 'QUILICURA', 303: 'RECOLETA', 304: 'RENCA',
    305: 'SAN JOAQUÍN', 306: 'SAN MIGUEL', 307: 'SAN RAMÓN', 308: 'LO PRADO',
    309: 'QUINTA NORMAL', 310: 'LO ESPEJO', 311: 'PIRQUE', 312: 'PUENTE ALTO',
    313: 'SAN JOSÉ DE MAIPO', 314: 'TILTIL', 315: 'LAMPA', 316: 'COLINA',
    317: 'CALERA DE TANGO', 318: 'BUIN', 319: 'SAN BERNARDO', 320: 'PAINE',
    321: 'MELIPILLA', 322: 'CURACAVÍ', 323: 'MARÍA PINTO', 324: 'ALHUÉ',
    325: 'SAN PEDRO', 326: 'ISLA DE MAIPO', 327: 'EL MONTE', 328: 'TALAGANTE',
    329: 'PEÑAFLOR', 330: 'PADRE HURTADO', 331: 'LANCO', 332: 'VALDIVIA',
    333: 'PANGUIPULLI', 334: 'PAILLACO', 335: 'MARIQUINA', 336: 'MÁFIL',
    337: 'LOS LAGOS', 338: 'CORRAL', 339: 'LAGO RANCO', 340: 'LA UNIÓN',
    341: 'FUTRONO', 342: 'RÍO BUENO', 343: 'CAMARONES', 344: 'ARICA',
    345: 'GENERAL LAGOS', 346: 'PUTRE',
}

# Códigos de AFP (REM_AFP) y salud (REM_SALUD) del instructivo.
AFP = {'PROVIDA': 6, 'PLANVITAL': 11, 'CUPRUM': 13, 'HABITAT': 14, 'UNO': 19, 'CAPITAL': 31, 'MODELO': 103,
       'IPS': 101, 'INP': 101}
# Isapre de Empleado.isapre (códigos de Previred) → código de la DT.
ISAPRE = {'01': 3, '02': 9, '03': 12, '04': 4, '05': 1, '10': 43, '12': 40, '25': 38}
FONASA = 102
FORMA_PAGO = {'EFECTIVO': 1, 'CHEQUE': 2, 'VALE VISTA': 3, 'VALE_VISTA': 3, 'DEPOSITO': 4, 'TRANSFERENCIA': 5}
TIPO_CONTRATO = {'INDEFINIDO': 1, 'PLAZO_FIJO': 2, 'OBRA_FAENA': 3}
DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

# Plazo de registro en días hábiles (DT: registro de contrato, anexo y término).
PLAZO_CONTRATO = 15
PLAZO_ANEXO = 15
PLAZO_TERMINO = {'159_1': 10, '159_2': 10, '159_3': 10, '159_4': 3, '159_5': 3, '159_6': 6, '163bis': 6}
PLAZO_TERMINO_160 = 3


def normalizar(texto) -> str:
    """Mayúsculas sin tildes ni signos, para comparar nombres de comunas o AFP."""
    t = unicodedata.normalize('NFD', str(texto or '').upper())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^A-Z0-9]+', ' ', t).strip()


_COMUNA_POR_NOMBRE = {normalizar(n): c for c, n in COMUNAS.items()}
# Nombres alternativos frecuentes.
_COMUNA_POR_NOMBRE.update({normalizar('Santiago Centro'): _COMUNA_POR_NOMBRE['SANTIAGO'],
                           normalizar('La Calera'): _COMUNA_POR_NOMBRE['CALERA'],
                           normalizar('Llay Llay'): _COMUNA_POR_NOMBRE['LLAILLAY'],
                           normalizar('OHiggins'): _COMUNA_POR_NOMBRE['O HIGGINS']})


def codigo_comuna(nombre):
    return _COMUNA_POR_NOMBRE.get(normalizar(nombre))


def codigo_afp(nombre):
    n = normalizar(nombre).replace('AFP ', '')
    return next((c for clave, c in AFP.items() if clave in n.split() or n == clave), None)


def es_dia_habil(fecha, es_feriado) -> bool:
    return fecha.weekday() < 5 and not es_feriado(fecha)


def sumar_dias_habiles(desde, dias, es_feriado):
    """Fecha en que vence un plazo de `dias` hábiles contados desde el día
    siguiente a `desde`. Hábil: lunes a viernes que no sea feriado (el criterio
    más estricto; así el plazo mostrado nunca es más largo que el real)."""
    fecha = desde
    restantes = dias
    while restantes > 0:
        fecha += datetime.timedelta(days=1)
        if es_dia_habil(fecha, es_feriado):
            restantes -= 1
    return fecha


def dias_habiles_entre(desde, hasta, es_feriado) -> int:
    """Días hábiles desde mañana hasta `hasta` inclusive (0 si ya pasó)."""
    n, fecha = 0, desde
    while fecha < hasta:
        fecha += datetime.timedelta(days=1)
        if es_dia_habil(fecha, es_feriado):
            n += 1
    return n


def plazo_termino(causal):
    """Días hábiles para registrar el término, o 0 para el Art. 161 (se registra
    junto con el envío de la carta de aviso)."""
    if causal.startswith('161'):
        return 0
    if causal.startswith('160'):
        return PLAZO_TERMINO_160
    return PLAZO_TERMINO.get(causal, PLAZO_TERMINO_160)


def separar_direccion(direccion):
    """(calle, número, depto) desde una dirección escrita en un solo campo.
    El número es el último del texto (la calle puede tener números: "Av. 5 de
    Abril 1020"); lo que sigue a "depto", "casa", "oficina"… es el depto."""
    texto = re.sub(r'\s+', ' ', str(direccion or '')).strip(' ,')
    dpto = ''
    m = re.match(r'^(.*?)[\s,]+(?:DEPTO|DPTO|DEPARTAMENTO|CASA|OFICINA|OF|BLOCK|BLOQUE)\.?\s*(\S.*)$', texto, re.I)
    if m:
        texto, dpto = m.group(1).strip(' ,'), m.group(2).strip()
    m = re.match(r'^(.*?\D)[\s,]*(?:#|N[°ºO]?\.)?\s*(\d+[A-Z]?)$', texto, re.I)
    if not m or not m.group(1).strip(' ,#'):
        return texto, '', dpto[:10]
    calle = re.sub(r'\s+(?:N[°º]|N\.|NO\.)$', '', m.group(1).strip(' ,#'), flags=re.I)
    return calle, m.group(2), dpto[:10]


def _fecha(f):
    return f.strftime('%d/%m/%Y') if f else ''


def _telefono(t):
    digitos = re.sub(r'\D', '', str(t or ''))
    if digitos.startswith('56') and len(digitos) == 11:
        digitos = digitos[2:]
    return digitos if len(digitos) == 9 else ''


def _horas(valor):
    if valor is None:
        return ''
    v = float(valor)
    return str(int(v)) if v.is_integer() else f'{v:.1f}'.replace('.', ',')


def fila_contrato(contrato, empleado, empresa, fecha_suscripcion, monto_imponible):
    """(fila, advertencias) de un contrato para el CSV de Mi DT.

    Las advertencias explican lo que el empleador debe completar o revisar antes
    de subir el archivo (datos faltantes o casos que la carga masiva no admite).
    """
    avisos = []
    fila = dict.fromkeys(COLUMNAS, '')
    fila['CATEGORIA_CONTRATO'] = 1
    c_empresa = codigo_comuna(empresa.comuna)
    if not c_empresa:
        avisos.append(f'Comuna de la empresa "{empresa.comuna or "(vacía)"}" sin código de la DT: corrígela en Empresa.')
    fila['COMUNA_CELEBRACION'] = c_empresa or ''
    fila['FECHA_SUSCRPCION'] = _fecha(fecha_suscripcion)
    fila['RUT_TRABAJADOR'] = formatear_rut(empleado.rut).replace('.', '') if limpiar_rut(empleado.rut) else ''
    fila['EMAIL'] = empleado.email or ''
    fila['TELEFONO'] = _telefono(empleado.numero_telefono)
    c_comuna = codigo_comuna(empleado.comuna)
    if not c_comuna:
        avisos.append(f'Comuna del domicilio "{empleado.comuna or "(vacía)"}" sin código de la DT.')
    fila['COMUNA'] = c_comuna or ''
    calle, numero, dpto = separar_direccion(empleado.direccion)
    if not numero:
        avisos.append('No se pudo separar la calle y el número del domicilio: complétalo en el archivo.')
    fila.update({'CALLE': calle[:100], 'NUMERO': numero, 'DPTO': dpto})
    fila['DECLARACION_DISCAPACIDAD'] = 1 if empleado.discapacidad else 0
    fila['DECLARACION_INVALIDEZ'] = 1 if empleado.pension_invalidez else 0
    funciones = '; '.join(str(f) for f in (contrato.funciones_especificas or []) if f) or contrato.cargo or ''
    fila['FUNCIONES'] = funciones[:300]
    fila['SUBCONTRATACION'] = 0
    fila['EST'] = 0
    fila['ZONA_GEOGRAFICA_1'] = c_empresa or ''
    fila['SUELDO_BASE'] = int(contrato.sueldo_base or 0)
    fila['MONTO_IMPONIBLE'] = int(monto_imponible or 0)
    if contrato.es_comisionista:
        # Haber calculado con fórmula: monto 0 (instructivo).
        fila.update({'HABER_1': 3, 'MONTO_1': 0, 'PER_DEVENGAMIENTO_1': 5})
    if contrato.gratificacion_legal == 'ANUAL':
        fila.update({'GRAT_FORMA_PAGO': 2, 'GRAT_PERIODO_PAGO': 6})     # Art. 47, anual
    else:
        fila.update({'GRAT_FORMA_PAGO': 4, 'GRAT_PERIODO_PAGO': 1})     # Art. 50, mensual
    fila['REM_PERIODO_PAGO'] = 1
    fila['REM_FECHA_PAGO'] = min(max(int(contrato.dia_pago or 30), 1), 30)
    fila['REM_FORMA_PAGO'] = FORMA_PAGO.get(normalizar(empleado.forma_pago), 5)
    fila['REM_ANTICIPO'] = 5 if contrato.tiene_quincena else 1
    afp = codigo_afp(empleado.afp)
    if not afp:
        avisos.append(f'AFP "{empleado.afp or "(vacía)"}" sin código de la DT.')
    fila['REM_AFP'] = afp or ''
    if normalizar(empleado.sistema_salud) == 'ISAPRE':
        isapre = ISAPRE.get(empleado.isapre or '')
        if not isapre:
            avisos.append('Isapre sin código de la DT (o sin informar): complétala en Previsión y pago.')
        fila['REM_SALUD'] = isapre or ''
    else:
        fila['REM_SALUD'] = FONASA
    fila['REM_OTROS_PACTOS'] = '; '.join(str(c) for c in (contrato.clausulas_especiales or []) if c)[:2000]

    jornada = contrato.tipo_jornada
    if jornada == 'ART_22':
        fila['TIPO_JORNADA'] = 7
    elif jornada in ('ORDINARIA', 'PARCIAL', 'TURNOS', 'BISMANAL'):
        fila['TIPO_JORNADA'] = 3 if jornada == 'BISMANAL' else 1
        fila['DURACION_JORNADA'] = _horas(contrato.horas_semanales)
        fila['TURNOS'] = 1
        fila['ROTACION'] = 1
        if jornada == 'TURNOS':
            avisos.append('Jornada por turnos: la carga masiva admite un solo turno; revisa el horario informado.')
        if jornada == 'BISMANAL':
            fila['NRO_DIAS_DIST_JOR'] = contrato.distribucion_dias or ''
            avisos.append('Jornada bisemanal: revisa el número de días de distribución (7 a 12).')
        horario = contrato.distribucion_horario or {}
        colaciones = set()
        for dia in DIAS:
            d = horario.get(dia) or {}
            if not d.get('activo'):
                continue
            if dia == 'domingo':
                avisos.append('Trabaja el domingo: si es una jornada del Art. 38, cambia TIPO_JORNADA a 8 o 9.')
            fila[f'{dia.upper()}_HORA_INICIO'] = d.get('entrada') or ''
            fila[f'{dia.upper()}_HORA_TERMINO'] = d.get('salida') or ''
            colaciones.add(int(d.get('colacion') or 0))
        if jornada != 'BISMANAL' and not colaciones:
            avisos.append('El contrato no tiene horario por día: complétalo en el editor del contrato.')
        if len(colaciones) > 1:
            avisos.append('La colación cambia según el día: la DT admite un solo valor; se informa la mayor.')
        colacion = max(colaciones) if colaciones else 0
        fila['TIEMPO_COLACION'] = colacion
        fila['T_COLACION_IMP'] = 0
        fila['T_COLACION_NO_IMP'] = colacion      # el contrato la pacta como no imputable
    else:
        avisos.append('Jornada personalizada: regístralo con el formulario individual de Mi DT.')
    fila['TIPO_CONTRATO'] = TIPO_CONTRATO.get(contrato.tipo_contrato, 1)
    fila['FECHA_INI_RELABORAL'] = _fecha(contrato.fecha_inicio)
    if contrato.tipo_contrato == 'PLAZO_FIJO':
        fila['FECHA_FIN_RELABORAL'] = _fecha(contrato.fecha_fin)
        if not contrato.fecha_fin:
            avisos.append('Contrato a plazo fijo sin fecha de término.')
    for col in ('OTROS_INDEMNIZACIONES', 'OTROS_FERIADOS', 'OTROS_NEGOCIACIONES', 'OTROS_PROPINTELECTUAL',
                'OTROS_LICMEDICA', 'OTROS_SALACUNA', 'OTROS_PERMISOS', 'OTROS_CONESPECIALES', 'OTROS_SEGUROS',
                'OTROS_STOCK', 'OTROS_INSTCOLECTIVO'):
        fila[col] = 0
    return [fila[c] for c in COLUMNAS], avisos


def csv_contratos(filas) -> bytes:
    """Archivo CSV (punto y coma, CRLF) como lo guarda Excel en Windows (ANSI)."""
    def celda(v):
        t = str(v).replace(';', ',').replace('\r', ' ').replace('\n', ' ')
        return t
    lineas = [';'.join(COLUMNAS)] + [';'.join(celda(v) for v in fila) for fila in filas]
    return ('\r\n'.join(lineas) + '\r\n').encode('cp1252', errors='replace')
