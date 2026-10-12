#!/usr/bin/env python3
"""Lee los modelos de Django y genera los diagramas del modelo de datos (capítulo 6).

Uso (desde la raíz del repositorio, con el entorno del backend):
    python3 docs/tecnico/herramientas/modelo_datos.py            # diagramas ER por dominio
    python3 docs/tecnico/herramientas/modelo_datos.py --json     # resumen de todos los modelos

Los diagramas quedan en docs/tecnico/figuras/06-er-<dominio>.mmd; después se dibujan
con `construir.py --figuras`. No necesita base de datos: solo lee la definición
de los modelos, así que el diagrama siempre corresponde al código.
"""
import json
import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
FIGURAS = RAIZ / 'docs' / 'tecnico' / 'figuras'
sys.path.insert(0, str(RAIZ / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django  # noqa: E402

django.setup()
from django.apps import apps  # noqa: E402

# Dominios del capítulo 6. Cada modelo aparece en su dominio; los de otros
# dominios que se relacionan con él se dibujan sin atributos, como referencia.
DOMINIOS = {
    'cuentas': ('Cuentas, planes y pagos', ['Plan', 'Cliente', 'Suscripcion', 'IntentoPago', 'EventoPasarela']),
    'trabajadores': ('Empresas, trabajadores y contratos', ['Empresa', 'Empleado', 'Contrato', 'AnexoContrato']),
    'remuneraciones': ('Remuneraciones y certificados del SII',
                       ['ConceptoRemuneracion', 'Liquidacion', 'CertificadoSueldos']),
    'documentos': ('Cartas, pactos, constancias y reglamento',
                   ['DocumentoLegal', 'DocumentoLaboral', 'ReglamentoInterno']),
    'firma': ('Firma electrónica', ['SolicitudFirma', 'OTPFirma']),
    'termino': ('Vacaciones, permisos, conciliación y término',
                ['VacacionEmpleado', 'SolicitudPermiso', 'SolicitudConciliacion', 'Finiquito']),
    'portal': ('Portal del trabajador',
               ['CuentaTrabajador', 'CorreoTrabajador', 'CodigoTrabajador', 'SolicitudDocumento', 'CertificadoEmitido']),
    'dt': ('Registro en Mi DT y fiscalización',
           ['RegistroDT', 'CodigoInspeccion', 'RegistroInspeccion', 'RatificacionInspeccion']),
    'extension': ('Extensión para Mi DT', ['DispositivoExtension', 'CodigoExtension', 'LevantamientoMiDT']),
    'equipo': ('Usuarios del equipo y bitácora', ['UsuarioEquipo', 'RegistroBitacora', 'ExportacionBitacora']),
    'karin': ('Ley Karin', ['EncargadoKarin', 'DenunciaKarin', 'ArchivoKarin', 'RegistroKarin']),
    'parametros': ('Parámetros legales', ['ParametroPrevisional', 'TasaAFP', 'TramoAsignacionFamiliar',
                                          'FactorActualizacionSII', 'PeriodoVacacionesEscolares']),
}

# Orientación de cada diagrama (por omisión, de arriba abajo): la que deja la letra
# más grande sin pasar de una página carta.
DIRECCION = {'cuentas': 'LR', 'documentos': 'LR', 'firma': 'LR'}

# Relaciones (modelo, campo) que se escriben desde el modelo hijo. La notación es la
# misma, pero el hijo queda al lado del padre y no debajo: así una cadena larga
# (empresa → trabajador → contrato → anexo) no hace un diagrama angosto y muy alto.
INVERTIR = {('AnexoContrato', 'contrato'), ('EncargadoKarin', 'empresas'), ('UsuarioEquipo', 'empresas')}

# Atributos que se muestran en cada entidad del diagrama (los demás están en el anexo B).
ATRIBUTOS = {
    'Plan': ['nombre', 'nivel', 'max_empresas', 'limite_trabajadores', 'precio', 'precio_anual'],
    'Cliente': ['rut', 'tipo_cliente', 'nombres', 'correo', 'frecuencia_resumen'],
    'Suscripcion': ['estado', 'ciclo', 'gateway_subscription_id', 'fecha_proximo_cobro', 'fecha_cancelacion'],
    'IntentoPago': ['ciclo', 'creado_en'],
    'EventoPasarela': ['evento', 'orden_compra', 'gateway_subscription_id', 'monto', 'aplicado'],
    'Empresa': ['rut', 'nombre_legal', 'mutual', 'ccaf', 'activo'],
    'Empleado': ['rut', 'nombres', 'ficha_numero', 'afp', 'sistema_salud', 'activo', 'fecha_desvinculacion'],
    'Contrato': ['tipo_contrato', 'fecha_inicio', 'fecha_fin', 'sueldo_base', 'horas_semanales', 'tipo_jornada'],
    'AnexoContrato': ['tipo', 'vigencia_desde', 'cambios', 'aplicado'],
    'SolicitudConciliacion': ['tipo', 'presentada_el', 'estado', 'respondida_el', 'origen'],
    'ConceptoRemuneracion': ['codigo', 'nombre', 'tipo', 'es_imponible', 'codigo_lre', 'activo'],
    'Liquidacion': ['mes', 'anio', 'total_imponible', 'total_haberes', 'sueldo_liquido', 'valor_uf'],
    'CertificadoSueldos': ['numero', 'anio', 'datos'],
    'DocumentoLegal': ['tipo', 'causal_articulo', 'fecha_emision', 'fecha_ultimo_dia'],
    'DocumentoLaboral': ['tipo', 'datos', 'vigente_desde', 'vigente_hasta', 'activo'],
    'ReglamentoInterno': ['tipo', 'version', 'publicado_en', 'vigente_desde', 'activo'],
    'SolicitudFirma': ['token', 'tipo_documento', 'estado', 'folio', 'verificacion', 'origen', 'expira_en'],
    'OTPFirma': ['codigo_hash', 'expira_en', 'intentos'],
    'VacacionEmpleado': ['tipo', 'fecha_inicio', 'fecha_fin', 'dias_habiles', 'estado', 'origen'],
    'SolicitudPermiso': ['permiso', 'fecha_hecho', 'inicio', 'estado'],
    'Finiquito': ['fecha_termino', 'causal_articulo', 'total_a_pagar', 'modalidad', 'ratificado_en'],
    'CuentaTrabajador': ['rut', 'version_sesion'],
    'CorreoTrabajador': ['email', 'verificado_en'],
    'CodigoTrabajador': ['rut', 'huella', 'expira_en', 'intentos', 'usado'],
    'SolicitudDocumento': ['tipo', 'mes', 'anio', 'estado', 'motivo'],
    'CertificadoEmitido': ['tipo', 'codigo', 'datos', 'anulado_en'],
    'RegistroDT': ['clave', 'registrado_en', 'via'],
    'CodigoInspeccion': ['correo', 'rut_inspector', 'huella', 'expira_en', 'intentos'],
    'RegistroInspeccion': ['accion', 'creado_en'],
    'RatificacionInspeccion': ['clave', 'inspector_nombre', 'inspector_rut', 'ip', 'ratificado_en'],
    'DispositivoExtension': ['token_hash', 'ultimo_uso', 'revocado_en'],
    'CodigoExtension': ['codigo_hash', 'expira_en', 'usado'],
    'LevantamientoMiDT': ['ruta', 'titulo', 'estructura'],
    'UsuarioEquipo': ['rut', 'permisos', 'estado', 'frecuencia_resumen'],
    'RegistroBitacora': ['accion', 'ruta', 'estado_http', 'ip', 'hash', 'hash_anterior'],
    'ExportacionBitacora': ['numero', 'codigo', 'formato', 'huella'],
    'EncargadoKarin': ['rut', 'estado', 'version_sesion'],
    'DenunciaKarin': ['numero', 'tipo', 'recibida_en', 'datos', 'hitos', 'origen'],
    'ArchivoKarin': ['tipo', 'clave', 'huella', 'nombre'],
    'RegistroKarin': ['accion', 'descripcion', 'hash', 'hash_anterior'],
    'ParametroPrevisional': ['vigente_desde', 'ingreso_minimo_mensual', 'tope_imponible_afp_uf', 'confirmado'],
    'TasaAFP': ['nombre', 'tasa', 'vigente_desde'],
    'TramoAsignacionFamiliar': ['tramo', 'monto', 'renta_hasta', 'vigente_desde'],
    'FactorActualizacionSII': ['anio', 'mes', 'factor'],
    'PeriodoVacacionesEscolares': ['nombre', 'desde', 'hasta'],
}


def _tipo(campo):
    clase = type(campo).__name__
    if clase in ('TextoCifrado', 'JSONCifrado'):
        return clase
    return {
        'CharField': 'texto', 'TextField': 'texto', 'EmailField': 'correo', 'SlugField': 'texto',
        'IntegerField': 'entero', 'PositiveIntegerField': 'entero', 'PositiveSmallIntegerField': 'entero',
        'SmallIntegerField': 'entero', 'BigIntegerField': 'entero', 'AutoField': 'entero', 'BigAutoField': 'entero',
        'DecimalField': 'decimal', 'FloatField': 'decimal', 'BooleanField': 'booleano',
        'DateField': 'fecha', 'DateTimeField': 'fecha_hora', 'JSONField': 'json', 'UUIDField': 'uuid',
        'FileField': 'archivo', 'ImageField': 'imagen', 'GenericIPAddressField': 'ip',
    }.get(clase, clase)


def resumen():
    salida = {}
    for m in apps.get_app_config('core').get_models():
        campos, relaciones = [], []
        for f in m._meta.get_fields():
            if f.auto_created and not f.concrete:
                continue
            if f.is_relation:
                if f.many_to_many:
                    relaciones.append({'campo': f.name, 'tipo': 'M2M', 'destino': f.related_model.__name__})
                else:
                    relaciones.append({'campo': f.name, 'tipo': 'O2O' if f.one_to_one else 'FK',
                                       'destino': f.related_model.__name__, 'nulo': f.null,
                                       'al_borrar': f.remote_field.on_delete.__name__})
            else:
                campos.append({'campo': f.name, 'tipo': _tipo(f), 'nulo': getattr(f, 'null', False),
                               'unico': getattr(f, 'unique', False) and not getattr(f, 'primary_key', False),
                               'opciones': len(f.choices or [])})
        salida[m.__name__] = {
            'tabla': m._meta.db_table,
            'doc': (m.__doc__ or '').strip().split('\n')[0][:160],
            'campos': campos, 'relaciones': relaciones,
            'unicos': [list(u) for u in m._meta.unique_together],
            'restricciones': [c.name for c in m._meta.constraints],
            'gestor': type(m._default_manager).__name__,
        }
    return salida


def _entidad(nombre):
    # El nombre de la clase, tal como está en el código (User es el usuario de Django).
    return nombre


def diagrama(clave, titulo, nombres, datos):
    lineas = [f'%% Capítulo 6 · {titulo} (generado por herramientas/modelo_datos.py)', 'erDiagram',
              f'  direction {DIRECCION.get(clave, "TB")}']
    vistos = set(nombres)
    for nombre in nombres:
        for r in datos[nombre]['relaciones']:
            destino = r['destino']
            padre = '|o' if r.get('nulo') else '||'
            if r['tipo'] == 'M2M':
                a, b = (destino, nombre) if (nombre, r['campo']) in INVERTIR else (nombre, destino)
                lineas.append(f'  {_entidad(a)} }}o--o{{ {_entidad(b)} : "{r["campo"]}"')
            elif (nombre, r['campo']) in INVERTIR:
                hijo = '|o' if r['tipo'] == 'O2O' else '}o'
                lineas.append(f'  {_entidad(nombre)} {hijo}--{padre[::-1]} {_entidad(destino)} : "{r["campo"]}"')
            elif r['tipo'] == 'O2O':
                lineas.append(f'  {_entidad(destino)} ||--o| {_entidad(nombre)} : "{r["campo"]}"')
            else:
                lineas.append(f'  {_entidad(destino)} {padre}--o{{ {_entidad(nombre)} : "{r["campo"]}"')
            vistos.add(destino)
    for nombre in nombres:
        campos = {c['campo']: c for c in datos[nombre]['campos']}
        attrs = [a for a in ATRIBUTOS.get(nombre, []) if a in campos]
        lineas.append(f'  {_entidad(nombre)} {{')
        for a in attrs:
            c = campos[a]
            marca = ' UK' if c['unico'] else ''
            lineas.append(f'    {c["tipo"]} {a}{marca}')
        lineas.append('  }')
    (FIGURAS / f'06-er-{clave}.mmd').write_text('\n'.join(lineas) + '\n')
    return sorted(vistos - set(nombres))


def main():
    datos = resumen()
    if '--json' in sys.argv:
        print(json.dumps(datos, ensure_ascii=False, indent=1))
        return
    asignados = {n for _, ns in DOMINIOS.values() for n in ns}
    faltan = sorted(set(datos) - asignados)
    if faltan:
        sys.exit(f'Modelos sin dominio asignado: {", ".join(faltan)}')
    for clave, (titulo, nombres) in DOMINIOS.items():
        if clave == 'parametros':
            continue   # sin relaciones: se describen en una tabla
        externos = diagrama(clave, titulo, nombres, datos)
        print(f'{clave}: {len(nombres)} modelos; referencias a {", ".join(externos) or "—"}')


if __name__ == '__main__':
    main()
