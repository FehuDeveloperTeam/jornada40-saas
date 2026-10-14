#!/usr/bin/env python3
"""Genera los anexos del documento técnico que salen del código: B (diccionario de
datos), C (rutas de la API), F (catálogos), H (licencias) y J (trazabilidad).

Uso (desde la raíz del repositorio, con el entorno del backend):
    python3 docs/tecnico/herramientas/anexos.py

Escribe docs/tecnico/anexo-b-diccionario.md, anexo-c-api.md, anexo-f-catalogos.md,
anexo-h-licencias.md y anexo-j-trazabilidad.md. No necesita base de datos: lee los
modelos, las rutas, los catálogos, las dependencias instaladas y el capítulo 3.
"""
import json
import re
import sys
from collections import defaultdict
from importlib import metadata
from pathlib import Path

HERRAMIENTAS = Path(__file__).resolve().parent
sys.path.insert(0, str(HERRAMIENTAS))
import modelo_datos as md  # noqa: E402  (configura Django)

from django.apps import apps  # noqa: E402
from django.urls import get_resolver  # noqa: E402

RAIZ = md.RAIZ
DOC = RAIZ / 'docs' / 'tecnico'
MAX_OPCIONES = 10


def _celda(texto):
    return str(texto).replace('|', '\\|').replace('\n', ' ').strip()


# ── Anexo B: diccionario de datos ─────────────────────────────────────────────

def _doc_modelo(modelo):
    doc = (modelo.__doc__ or '').strip()
    if not doc or doc.startswith(f'{modelo.__name__}('):
        return ''   # docstring automática de Django: solo repite los campos
    parrafo = re.split(r'\n\s*\n', doc)[0]
    return ' '.join(parrafo.split())


def _por_omision(valor):
    if callable(valor):
        nombre = getattr(valor, '__name__', '')
        return {'now': 'el momento de crear', 'localdate': 'la fecha de crear', 'today': 'la fecha de crear',
                'dict': '`{}`', 'list': '`[]`', 'uuid4': 'un identificador aleatorio'}.get(nombre, f'`{nombre}()`')
    if isinstance(valor, bool):
        return 'sí' if valor else 'no'
    if valor == '':
        return 'vacío'
    return f'`{valor}`'


def _detalle_campo(f):
    partes = []
    if f.is_relation:
        destino = 'User' if f.related_model.__name__ == 'User' else f.related_model.__name__
        if f.many_to_many:
            partes.append(f'Muchos a muchos con `{destino}`')
        else:
            tipo = 'Uno a uno con' if f.one_to_one else 'Referencia a'
            partes.append(f'{tipo} `{destino}`; al borrar: {f.remote_field.on_delete.__name__}')
    if getattr(f, 'null', False):
        partes.append('admite nulo')
    if getattr(f, 'unique', False) and not getattr(f, 'primary_key', False) and not f.one_to_one:
        partes.append('único')
    if getattr(f, 'primary_key', False):
        partes.append('identificador')
    if getattr(f, 'auto_now_add', False):
        partes.append('se fija al crear')
    elif getattr(f, 'auto_now', False):
        partes.append('se actualiza al guardar')
    elif not f.is_relation and f.has_default() and not getattr(f, 'primary_key', False):
        partes.append(f'por omisión: {_por_omision(f.default)}')
    largo = getattr(f, 'max_length', None)
    if largo and not getattr(f, 'choices', None) and md._tipo(f) == 'texto':
        partes.append(f'hasta {largo} caracteres')
    opciones = [c[0] for c in (getattr(f, 'choices', None) or [])]
    if opciones:
        if len(opciones) <= MAX_OPCIONES:
            partes.append('opciones: ' + ', '.join(f'`{o}`' for o in opciones))
        else:
            partes.append(f'{len(opciones)} opciones (anexo F)')
    ayuda = str(getattr(f, 'help_text', '') or '').strip()
    if ayuda:
        partes.append(ayuda.rstrip('.'))
    return '; '.join(partes)


def anexo_b():
    lineas = ['# Anexo B. Diccionario de datos {.unnumbered #sec-anexo-b}', '',
              'Campos de cada modelo de `backend/core/models.py`, generados con `herramientas/anexos.py`. '
              'Los modelos se agrupan por dominio, en el orden de la sección 6.2. Los tipos son los de la '
              'tabla «Tipos de datos» de la sección 6.1.', '']
    modelos = {m.__name__: m for m in apps.get_app_config('core').get_models()}
    for titulo, nombres in md.DOMINIOS.values():
        lineas += [f'## {titulo} {{.unnumbered}}', '']
        for nombre in nombres:
            m = modelos[nombre]
            lineas += [f'#### `{nombre}` {{.unnumbered}}', '']
            texto = f'Tabla `{m._meta.db_table}`.'
            doc = _doc_modelo(m)
            if doc:
                texto += f' {doc}'
            lineas += [texto, '', '| Campo | Tipo | Detalle |', '|---|---|---|']
            for f in m._meta.get_fields():
                if f.auto_created and not f.concrete:
                    continue
                tipo = 'relación' if f.is_relation else md._tipo(f)
                lineas.append(f'| `{f.name}` | {tipo} | {_celda(_detalle_campo(f))} |')
            unicos = [', '.join(u) for u in m._meta.unique_together] + [
                f'{c.name}: {", ".join(c.fields)}' for c in m._meta.constraints if getattr(c, 'fields', None)]
            lineas.append('')
            if unicos:
                lineas += ['Unicidad: ' + '; '.join(f'`{u}`' for u in unicos) + '.', '']
    (DOC / 'anexo-b-diccionario.md').write_text('\n'.join(lineas) + '\n')


# ── Anexo C: rutas de la API ──────────────────────────────────────────────────

_CONVERTIDOR = re.compile(r'<(?:\w+:)?(\w+)>')
_GRUPO = re.compile(r'\(\?P<(\w+)>[^)]*\)')


def _limpiar_ruta(patron):
    # Primero los grupos con nombre de las expresiones regulares del enrutador de DRF,
    # para que el convertidor no se coma el <pk> de (?P<pk>[^/.]+).
    ruta = _GRUPO.sub(r'{\1}', patron)
    ruta = _CONVERTIDOR.sub(r'{\1}', ruta)
    ruta = ruta.replace('^', '').replace('$', '').replace('\\.', '.')
    return ruta[:-1] if ruta.endswith('/?') else ruta   # dj-rest-auth acepta la barra final opcional


def _recorrer(patrones, prefijo=''):
    for p in patrones:
        if hasattr(p, 'url_patterns'):
            yield from _recorrer(p.url_patterns, prefijo + str(p.pattern))
        else:
            yield prefijo + str(p.pattern), p


def _acciones(callback):
    """Método → acción de una ruta de DRF, sin los métodos que la clase no admite.

    El enrutador asocia DELETE a `destroy` aunque la clase lo excluya de `http_method_names`
    (responde 405), así que se filtra con esa lista.
    """
    clase = getattr(callback, 'cls', None)
    permitidos = getattr(clase, 'http_method_names', None)
    return {m: a for m, a in (getattr(callback, 'actions', None) or {}).items()
            if permitidos is None or m in permitidos}


def _metodos(callback):
    if getattr(callback, 'actions', None):
        return sorted(m.upper() for m in _acciones(callback))
    clase = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
    if clase is None:
        return ['GET']
    nombres = getattr(clase, 'http_method_names', [])
    return sorted(m.upper() for m in nombres if m not in ('options', 'head', 'trace') and hasattr(clase, m))


# Accesos aislados, por prefijo (sección 4.7). La bitácora de fiscalización es del panel.
_FAMILIAS = (('inspeccion/bitacora/', None), ('trabajador/', 'Portal'), ('karin/', 'Ley Karin'),
             ('inspeccion/', 'Fiscalización'), ('extension/v1/', 'Extensión'))


def _acceso(ruta, callback):
    from rest_framework.views import APIView
    clase = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
    if clase is None or not issubclass(clase, APIView):
        abierta = True   # vista de Django sin autenticación de DRF
    else:
        permisos = [c.__name__ for c in getattr(clase, 'permission_classes', []) or []]
        abierta = not permisos or 'AllowAny' in permisos
    if ruta.startswith('firma-publica/'):
        return 'Firma pública'
    for prefijo, familia in _FAMILIAS:
        if ruta.startswith(prefijo):
            if familia is None:
                break
            return f'{familia}, sin sesión' if abierta else familia
    return 'Público' if abierta else 'Panel'


def _modulo(ruta, acceso, metodos):
    from core import permisos as p
    if acceso != 'Panel':
        return '—'
    completa = '/api/' + ruta
    # Mismo orden que autenticacion.autorizar_equipo.
    if completa.startswith(p.RUTAS_IDENTIDAD):
        return 'Identidad de la persona'
    if completa.startswith(p.RUTAS_COMUNES_LECTURA):
        if set(metodos) <= {'GET'}:
            return 'Lectura común'
        return 'Lectura común; escribir, solo el titular' if 'GET' in metodos else 'Solo el titular'
    if completa.startswith(('/api/firmas/', '/api/documentos_legales/', '/api/documentos-laborales/')):
        return 'Según el tipo de documento'
    modulos = p.modulos_de_ruta(completa)
    if modulos:
        nombres = {codigo: nombre for codigo, nombre, _ in p.MODULOS}
        return ' o '.join(nombres[m] for m in modulos if m)
    return 'Solo el titular'


def anexo_c():
    filas = defaultdict(lambda: {'metodos': set(), 'vista': '', 'acceso': '', 'modulo': ''})
    primera = {}   # Django usa el primer patrón que calza: los siguientes con la misma ruta no se alcanzan
    for patron, p in _recorrer(get_resolver().url_patterns):
        ruta = _limpiar_ruta(patron)
        if not ruta.startswith('api/') or 'format' in ruta or ruta == 'api/':
            continue
        ruta = ruta[len('api/'):]
        callback = p.callback
        origen = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None) or callback
        if primera.setdefault(ruta, origen) is not origen:
            continue
        acceso = _acceso(ruta, callback)
        fila = filas[ruta]
        fila['metodos'].update(_metodos(callback))
        nombre = getattr(callback, '__name__', '')
        clase = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
        fila['vista'] = clase.__name__ if clase is not None and nombre in ('view', 'WrappedAPIView') else (
            getattr(clase, '__name__', '') if getattr(callback, 'actions', None) else nombre)
        if getattr(callback, 'actions', None):
            acciones = sorted(set(_acciones(callback).values()))
            fila['vista'] = f'{getattr(clase, "__name__", "")} ({", ".join(acciones)})'
        fila['acceso'] = acceso
    for ruta, fila in filas.items():
        fila['modulo'] = _modulo(ruta, fila['acceso'], fila['metodos'])
    grupos = defaultdict(list)
    for ruta, fila in filas.items():
        grupos[ruta.split('/')[0]].append((ruta, fila))
    lineas = ['# Anexo C. Rutas de la API {.unnumbered #sec-anexo-c}', '',
              f'Las {len(filas)} rutas bajo `/api/`, generadas con `herramientas/anexos.py` desde el enrutador de Django. '
              'Las convenciones, los códigos de estado y los límites de intentos están en la sección 7.2. Columnas:', '',
              '- **Métodos:** los que admite la ruta.',
              '- **Vista:** la función o clase que la atiende; en las de DRF, también sus acciones.',
              '- **Acceso:** quién la abre (sección 4.7). *Panel* pide la sesión del titular o de un usuario del equipo; '
              '*Portal*, *Ley Karin*, *Fiscalización* y *Extensión* piden la sesión o el token de ese acceso, y '
              '«sin sesión» marca sus rutas de ingreso; *Firma pública* pide el enlace de la solicitud y, para ver el '
              'documento y firmar, el código o la clave; *Público* no pide sesión.',
              '- **Módulo:** en el panel, el módulo que exige a un usuario del equipo (sección 8.3); con dos, basta uno. «Lectura común» se abre a '
              'todo el equipo solo para consultar; «Identidad de la persona» actúa sobre la propia persona; '
              '«Solo el titular», solo para el dueño de la cuenta.', '',
              '**Rutas auxiliares.** `auth/password/reset/` responde 410: la recuperación por correo está cerrada y '
              'se recupera por RUT. `diagnostico/red/` responde solo con `DIAGNOSTICO_RED=1`.', '',
              '**Sin borrado.** **[Solo en staging]** Las rutas de trabajadores, contratos, liquidaciones, cartas, finiquitos y vacaciones '
              'no admiten DELETE (405): esos registros respaldan firmas y obligaciones laborales, y no se borran '
              '(sección 6.4.2).', '']
    for grupo in sorted(grupos):
        lineas += [f'#### `/api/{grupo}/` {{.unnumbered}}', '', '| Métodos | Ruta | Vista | Acceso | Módulo |', '|---|---|---|---|---|']
        for ruta, fila in sorted(grupos[grupo]):
            metodos = ', '.join(sorted(fila['metodos'])) or 'GET'
            lineas.append(f'| {metodos} | `/api/{ruta}` | {_celda(fila["vista"])} | {fila["acceso"]} | {fila["modulo"]} |')
        lineas.append('')
    (DOC / 'anexo-c-api.md').write_text('\n'.join(lineas) + '\n')
    return len(filas)


# ── Anexo F: catálogos ────────────────────────────────────────────────────────

def anexo_f():
    from core import bancos, permisos, seguridad
    from core import reglamento_plantilla as rp
    from core.views import documentos_laborales as dl
    lineas = ['# Anexo F. Catálogos y listas cerradas {.unnumbered #sec-anexo-f}', '',
              'Las listas cerradas que usa el sistema, generadas con `herramientas/anexos.py`. Las primeras son las '
              'opciones de los campos de los modelos (se guardan como código); las siguientes, los catálogos que '
              'definen los módulos de reglas.', '',
              '#### Opciones de los campos {.unnumbered}', '', '| Modelo y campo | Opciones (código: texto) |', '|---|---|']
    modelos = {m.__name__: m for m in apps.get_app_config('core').get_models()}
    for _, nombres in md.DOMINIOS.values():   # en el orden de los dominios, como el anexo B
        for m in (modelos[n] for n in nombres):
            for f in m._meta.get_fields():
                opciones = getattr(f, 'choices', None) if not f.is_relation else None
                if opciones:
                    valores = '; '.join(f'`{c}`: {_celda(t)}' for c, t in opciones)
                    lineas.append(f'| `{m.__name__}.{f.name}` | {valores} |')
    lineas += ['', '#### Catálogos de los módulos de reglas {.unnumbered}', '', '| Catálogo | Ubicación | Valores |', '|---|---|---|']
    lineas.append(f'| Bancos e instituciones de pago | `core/bancos.py` | {_celda("; ".join(bancos.BANCOS))} |')
    lineas.append('| Rubros del reglamento interno | `core/reglamento_plantilla.py` | '
                  f'{_celda("; ".join(str(v.get("nombre", k)) if isinstance(v, dict) else k for k, v in rp.RUBROS.items()))} |')
    lineas.append(f'| Elementos de protección personal | `core/seguridad.py` | {_celda("; ".join(t for _, t in seguridad.EPP))} |')
    lineas.append(f'| Motivos de entrega de EPP | `core/seguridad.py` | {_celda("; ".join(t for _, t in seguridad.MOTIVOS_EPP))} |')
    lineas.append(f'| Motivos de la información de riesgos | `core/seguridad.py` | {_celda("; ".join(t for _, t in seguridad.MOTIVOS_RIESGOS))} |')
    permisos_legales = '; '.join(f'{v[0]} ({v[1]} días {v[2]}; {v[3]})' for v in dl.PERMISOS.values())
    lineas.append(f'| Permisos legales con goce | `core/views/documentos_laborales.py` | {_celda(permisos_legales)} |')
    lineas.append(f'| Motivos de un pacto de horas extra | `core/views/documentos_laborales.py` | {_celda("; ".join(t for _, t in dl.MOTIVOS_HORAS_EXTRA))} |')
    lineas.append(f'| Compensación de las horas extra | `core/views/documentos_laborales.py` | {_celda("; ".join(t for _, t in dl.COMPENSACIONES))} |')
    lineas.append(f'| Módulos del panel para el equipo | `core/permisos.py` | {_celda("; ".join(f"{c} ({n})" for c, n, _ in permisos.MODULOS))} |')
    lineas.append('')
    (DOC / 'anexo-f-catalogos.md').write_text('\n'.join(lineas) + '\n')


# ── Anexo H: licencias ────────────────────────────────────────────────────────

def _licencia_python(nombre):
    try:
        datos = metadata.metadata(nombre)
    except metadata.PackageNotFoundError:
        return '—'
    expresion = datos.get('License-Expression')
    if expresion:
        return expresion
    clasificadores = [c.split('::')[-1].strip() for c in datos.get_all('Classifier') or [] if c.startswith('License ::')]
    if clasificadores:
        return ', '.join(dict.fromkeys(clasificadores))
    texto = (datos.get('License') or '').strip().split('\n')[0]
    return texto[:60] if texto and texto.upper() != 'UNKNOWN' else '—'


def anexo_h():
    lineas = ['# Anexo H. Bibliotecas de terceros y licencias {.unnumbered #sec-anexo-h}', '',
              'Dependencias con su versión fijada y su licencia, generadas con `herramientas/anexos.py` desde '
              '`backend/requirements.txt` (todas, incluidas las indirectas) y `frontend/package.json` (directas). '
              'La licencia se toma de los metadatos de cada paquete instalado; «—» indica que no la declaran.', '',
              '#### Servidor (Python) {.unnumbered}', '', '| Paquete | Versión | Licencia |', '|---|---|---|']
    for linea in (RAIZ / 'backend' / 'requirements.txt').read_text().splitlines():
        linea = linea.split('#')[0].strip()
        if '==' not in linea:
            continue
        nombre, version = linea.split('==', 1)
        nombre = nombre.split('[')[0].strip()
        lineas.append(f'| {nombre} | {version.strip()} | {_celda(_licencia_python(nombre))} |')
    paquete = json.loads((RAIZ / 'frontend' / 'package.json').read_text())
    for titulo, clave in (('Aplicación web y extensión: dependencias de producción', 'dependencies'),
                          ('Aplicación web y extensión: herramientas de desarrollo', 'devDependencies')):
        lineas += ['', f'#### {titulo} {{.unnumbered}}', '', '| Paquete | Versión | Licencia |', '|---|---|---|']
        for nombre in sorted(paquete.get(clave, {})):
            ruta = RAIZ / 'frontend' / 'node_modules' / nombre / 'package.json'
            version, licencia = paquete[clave][nombre], '—'
            if ruta.exists():
                datos = json.loads(ruta.read_text())
                version = datos.get('version', version)
                licencia = datos.get('license') or '—'
                if isinstance(licencia, dict):
                    licencia = licencia.get('type', '—')
            lineas.append(f'| {nombre} | {version} | {_celda(licencia)} |')
    reciprocas = [f.split('|')[1].strip() for f in lineas if f.startswith('| ') and re.search(r'GPL|MPL|Mozilla|GNU', f)]
    lineas += ['', '#### Licencias con reciprocidad {.unnumbered}', '',
               f'Usan licencias con reciprocidad (LGPL, MPL o GPL a elección): {", ".join(reciprocas)}. Todas se usan '
               'como bibliotecas, sin modificarlas: las del servidor corren en la API, que se presta como servicio y no '
               'se distribuye, y las de la interfaz son herramientas de prueba que no entran en la aplicación web ni '
               'en la extensión. Las dependencias de producción de la aplicación web y de la extensión, que sí llegan '
               'al navegador de las personas, tienen licencias permisivas (MIT, ISC y Apache-2.0). Si se modificara '
               'alguna de esas bibliotecas o se distribuyera el servidor, habría que revisar sus obligaciones.', '']
    (DOC / 'anexo-h-licencias.md').write_text('\n'.join(lineas) + '\n')


# ── Anexo J: trazabilidad ─────────────────────────────────────────────────────

_PRUEBA = re.compile(r'`?((?:test_\w+)|(?:[\w.-]+\.spec\.ts)|(?:[\w/.-]+\.test\.tsx?))`?')


def anexo_j():
    texto = (DOC / '03-requerimientos.md').read_text()
    por_prueba = defaultdict(list)
    sin_prueba, pendientes, otras = [], [], []
    for linea in texto.splitlines():
        m = re.match(r'^\| (R(?:F|N|NF)-[A-Z]+-\d+) \|', linea)
        if not m:
            continue
        codigo, verificacion = m.group(1), linea.rsplit('|', 2)[-2]
        pruebas = sorted(set(p.strip('`') for p in _PRUEBA.findall(verificacion)))
        for p in pruebas:
            por_prueba[p].append(codigo)
        if 'Sin prueba directa' in verificacion:
            sin_prueba.append(codigo)
        elif not pruebas and codigo.startswith('RNF'):
            (pendientes if '**Pendiente**' in verificacion else otras).append(codigo)
    lineas = ['# Anexo J. Matriz de trazabilidad {.unnumbered #sec-anexo-j}', '',
              'El capítulo 3 da, para cada requerimiento, la norma que lo origina y las pruebas que lo verifican. '
              'Este anexo, generado con `herramientas/anexos.py` desde ese capítulo, muestra la vista inversa: '
              'qué requerimientos verifica cada archivo de prueba. Los archivos `test_*` son del servidor '
              '(`backend/core/tests/`), los `*.spec.ts` son recorridos de navegador (`frontend/e2e/`) y los '
              '`*.test.ts` son pruebas unitarias de la interfaz o de la extensión.', '',
              '#### Requerimientos por archivo de prueba {.unnumbered}', '', '| Prueba | Requerimientos que verifica |', '|---|---|']
    for prueba in sorted(por_prueba, key=lambda p: (not p.startswith('test_'), p)):
        lineas.append(f'| `{prueba}` | {", ".join(por_prueba[prueba])} |')
    lineas += ['', '#### Requerimientos sin un archivo de prueba propio {.unnumbered}', '',
               f'- **Funcionales sin prueba directa ({len(sin_prueba)}):** ' + (', '.join(sin_prueba) or 'ninguno') + '.',
               f'- **No funcionales pendientes ({len(pendientes)}):** ' + (', '.join(pendientes) or 'ninguno')
               + '. Aún no se cumplen, así que no hay qué probar (sección 11.7).',
               f'- **No funcionales verificados de otra forma ({len(otras)}):** ' + (', '.join(otras) or 'ninguno')
               + '. Se comprueban en la integración continua, en los recorridos de navegador en general, en la '
               'configuración o por revisión manual, según indica su fila en el capítulo 3.', '']
    (DOC / 'anexo-j-trazabilidad.md').write_text('\n'.join(lineas) + '\n')
    return len(por_prueba), len(sin_prueba), len(pendientes) + len(otras)


def main():
    anexo_b()
    rutas = anexo_c()
    anexo_f()
    anexo_h()
    pruebas, sin, manuales = anexo_j()
    print(f'Anexos B, C ({rutas} rutas), F, H y J ({pruebas} archivos de prueba; {sin} RF sin prueba directa; '
          f'{manuales} RNF sin archivo de prueba).')


if __name__ == '__main__':
    main()
