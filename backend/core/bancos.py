"""Bancos e instituciones donde se paga el sueldo: lista cerrada.

Se guarda el nombre de la lista en mayúsculas (Empleado.banco), como el resto
de los textos del trabajador. El panel la recibe de GET /api/catalogos/trabajador/
(views/catalogos.py): agregar una institución aquí basta. Lo escrito antes a mano
se normaliza con `normalizar_banco` (migración 0092 y carga masiva).
"""
import unicodedata

# Nombre que se guarda y se muestra → otras formas de escribirlo.
BANCOS = {
    'Banco de Chile': ['CHILE', 'BANCO CHILE', 'EDWARDS', 'BANCO EDWARDS', 'BANCO DE CHILE EDWARDS', 'CITIBANK', 'CREDICHILE'],
    'BancoEstado': ['ESTADO', 'BANCO ESTADO', 'BANCO DEL ESTADO', 'BANCO DEL ESTADO DE CHILE', 'CUENTA RUT',
                    'CUENTARUT', 'BECH'],
    'Santander': ['BANCO SANTANDER', 'SANTANDER CHILE', 'SANTANDER BANEFE', 'BANEFE'],
    'BCI': ['BANCO BCI', 'BANCO DE CREDITO E INVERSIONES', 'CREDITO E INVERSIONES', 'TBANC', 'NOVA'],
    'Scotiabank': ['SCOTIA', 'BANCO SCOTIABANK', 'SCOTIABANK CHILE', 'BBVA', 'BANCO BBVA', 'DESARROLLO', 'BANCO DESARROLLO'],
    'Itaú': ['ITAU', 'BANCO ITAU', 'ITAU CORPBANCA', 'CORPBANCA', 'BANCO CORPBANCA'],
    'BICE': ['BANCO BICE'],
    'Security': ['BANCO SECURITY'],
    'Banco Falabella': ['FALABELLA'],
    'Banco Ripley': ['RIPLEY'],
    'Banco Consorcio': ['CONSORCIO'],
    'Banco Internacional': ['INTERNACIONAL'],
    'BTG Pactual': ['BTG', 'BANCO BTG PACTUAL', 'BANCO BTG'],
    'HSBC': ['HSBC BANK', 'BANCO HSBC'],
    'Coopeuch': ['COOPERATIVA COOPEUCH', 'DALE', 'DALE COOPEUCH'],
    'Tenpo': ['TENPO BANK', 'TENPO PREPAGO'],
    'Mercado Pago': ['MERCADOPAGO', 'MERCADO PAGO PREPAGO'],
    'MACH': ['CUENTA MACH', 'MACH BCI'],
    'Prepago Los Héroes': ['LOS HEROES', 'CAJA LOS HEROES', 'PREPAGO LOS HEROES'],
    'Otra institución': ['OTRO', 'OTRA', 'OTRO BANCO'],
}

NOMBRES = list(BANCOS)


def _clave(texto):
    sin_tildes = unicodedata.normalize('NFD', str(texto or '')).encode('ascii', 'ignore').decode()
    return ' '.join(sin_tildes.upper().replace('.', ' ').replace('-', ' ').split())


_POR_CLAVE = {}
for _nombre, _otros in BANCOS.items():
    for _forma in [_nombre, *_otros]:
        _POR_CLAVE[_clave(_forma)] = _nombre


def normalizar_banco(texto):
    """Nombre de la lista (en mayúsculas) para lo escrito a mano; '' si viene vacío y None si no se reconoce."""
    clave = _clave(texto)
    if not clave:
        return ''
    nombre = _POR_CLAVE.get(clave)
    return nombre.upper() if nombre else None
