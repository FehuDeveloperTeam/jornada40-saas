"""Documentos del expediente Ley Karin (PDF que se generan al pedirlos; no se guardan).

Cada función arma secciones para la plantilla genérica `karin_documento.html`.
Las declaraciones se firman en papel en todas sus hojas (Art. 15 DS 21): el acta
sale en blanco para llenarla y firmarla, y luego se sube escaneada al expediente.
"""
import datetime

from django.template.loader import get_template
from django.utils import timezone

from . import denuncias_karin as dk

TIPOS = {
    'RECEPCION': 'Comprobante de recepción de la denuncia',
    'ACTA_VERBAL': 'Acta de denuncia verbal',
    'RESGUARDO': 'Registro de medidas de resguardo',
    'DECISION': 'Comunicación de la decisión a quien denunció',
    'ANTECEDENTES_DT': 'Antecedentes para la Dirección del Trabajo',
    'CITACION': 'Citación a declarar',
    'ACTA_DECLARACION': 'Acta de declaración',
    'INFORME': 'Informe de investigación',
    'NOTIFICACION': 'Notificación de las conclusiones',
    'MEDIDAS': 'Comunicación de medidas y sanciones',
}
CON_PARTICIPANTE = {'CITACION', 'ACTA_DECLARACION'}
NOTA = ('Documento reservado. La investigación es reservada (Art. 211-C del Código del Trabajo) y la ley prohíbe '
        'cualquier represalia contra quien denuncia o declara.')


class DocumentoNoDisponible(ValueError):
    pass


def _d(fecha_iso):
    return datetime.date.fromisoformat(fecha_iso).strftime('%d-%m-%Y') if fecha_iso else '—'


def _persona(p, con_correo=True):
    if not p:
        return '—'
    partes = [p.get('nombre') or '—']
    if p.get('rut'):
        partes.append(f"RUT {p['rut']}")
    if p.get('cargo'):
        partes.append(p['cargo'])
    if con_correo and p.get('correo'):
        partes.append(p['correo'])
    return ' · '.join(partes)


def _denunciados(d):
    vinculos = dict(dk.VINCULOS)
    return [[f'Persona denunciada {i + 1}', f"{_persona(p, False)}\nVínculo: {vinculos.get(p.get('vinculo'), '—')}"]
            for i, p in enumerate(d.datos.get('denunciados', []))]


def _datos_basicos(d):
    datos = d.datos
    filas = [['Expediente', d.folio],
             ['Recibida', timezone.localtime(d.recibida_en).strftime('%d-%m-%Y a las %H:%M')],
             ['Forma', d.get_canal_display()], ['Materia', d.get_tipo_display()],
             ['Persona afectada', _persona(datos.get('afectada'))]]
    if datos.get('denunciante'):
        filas.append(['Denuncia por la persona afectada',
                      f"{_persona(datos['denunciante'])}\nEn calidad de: "
                      f"{dict(dk.REPRESENTACIONES).get(datos.get('representacion'), '—')}"])
    return filas


def _resguardo(d):
    tipos, aplica = dict(dk.RESGUARDOS), dict(dk.APLICA_A)
    return [[tipos.get(m['tipo'], m['tipo']), f"{aplica.get(m['aplica_a'], '')}, desde el {_d(m['fecha'])}"]
            for m in d.resguardo or []] or [['Medidas de resguardo', 'Aún no se registran.']]


def _participante(d, pid):
    p = next((x for x in (d.investigacion or {}).get('participantes', []) if x['id'] == pid), None)
    if p is None:
        raise DocumentoNoDisponible('Elige a la persona citada.')
    return p


def _mutual(empresa):
    from .views.ley_karin import _mutual as mutual
    return mutual(empresa)


def armar(d, tipo, participante='', encargado=None):
    """(titulo, secciones, firmas). Lanza DocumentoNoDisponible si aún no corresponde."""
    if tipo not in TIPOS:
        raise DocumentoNoDisponible('Documento no válido.')
    h, datos, inv = d.hitos or {}, d.datos, d.investigacion or {}
    receptor = {'nombre': encargado.nombre_completo if encargado else 'Encargado de denuncias',
                'detalle': 'Recibe por la empresa'}
    afectada = datos.get('afectada') or {}
    quien = datos.get('denunciante') or afectada
    secciones, firmas = [], []
    if tipo in ('RECEPCION', 'ACTA_VERBAL'):
        filas = _datos_basicos(d) + (_denunciados(d) if tipo == 'ACTA_VERBAL' else [])
        if d.origen == 'PORTAL':
            filas.append(['Ingreso', 'Por la persona denunciante en su portal de Jornada40 (identificada con su RUT '
                                     'y su correo verificado). Fecha y hora registradas por el sistema.'])
        secciones.append({'filas': filas})
        if tipo == 'ACTA_VERBAL':
            secciones.append({'titulo': 'Relación de los hechos', 'parrafos': [datos.get('relato', '')]})
            secciones.append({'parrafos': ['Esta acta deja por escrito la denuncia hecha en forma verbal. Se entrega '
                                           'copia a quien denuncia, fechada y con la hora de presentación '
                                           '(Art. 12 DS 21).']})
        secciones.append({'titulo': 'Qué sigue', 'parrafos': [
            'La empresa adoptará de inmediato medidas de resguardo y le ofrece atención psicológica temprana a través '
            f'de {_mutual(d.empresa)} (Art. 13 DS 21).',
            'Dentro de 3 días hábiles, la empresa iniciará una investigación interna, informándolo a la Dirección del '
            'Trabajo, o derivará la denuncia a la Dirección del Trabajo. Si usted lo pide, se deriva a la Dirección del '
            'Trabajo. Se le informará por escrito la decisión (Art. 12 DS 21).',
            'La investigación se hará con reserva, de forma imparcial y oyendo a todas las partes, y concluirá dentro '
            'de 30 días hábiles (Arts. 15 y 17 DS 21).']})
        firmas = [] if d.origen == 'PORTAL' else [{'nombre': _persona(quien, False), 'detalle': 'Recibí copia'}, receptor]
    elif tipo == 'RESGUARDO':
        secciones = [{'filas': [['Expediente', d.folio], ['Persona afectada', _persona(afectada, False)]]},
                     {'titulo': 'Medidas adoptadas', 'filas': _resguardo(d)},
                     {'parrafos': ['Las medidas se adoptan en atención a la gravedad de los hechos, la seguridad de la '
                                   'persona afectada y las condiciones de trabajo, y no pueden ser gravosas ni '
                                   'perjudicarla (Arts. 13 y 20 DS 21; Art. 211-B bis del Código del Trabajo).']}]
        firmas = [receptor | {'detalle': 'Por la empresa'}]
    elif tipo == 'DECISION':
        if not h.get('decision'):
            raise DocumentoNoDisponible('Primero registre la decisión.')
        if h['decision'] == 'INTERNA':
            texto = [f'En relación con su denuncia {d.folio}, la empresa realizará una investigación interna, de la que '
                     'informará a la Dirección del Trabajo junto con las medidas de resguardo adoptadas (Art. 12 DS 21). '
                     'La investigación concluirá dentro de 30 días hábiles desde la presentación de la denuncia.']
            investigador = inv.get('investigador')
            if investigador:
                texto.append(f"Quien investigará es {investigador['nombre']}"
                             f"{', ' + investigador['cargo'] if investigador.get('cargo') else ''}. Al declarar, usted "
                             'podrá presentar antecedentes que afecten su imparcialidad y pedir su cambio (Art. 14 DS 21).')
        else:
            texto = [f'En relación con su denuncia {d.folio}, la empresa la derivó a la Dirección del Trabajo para su '
                     'investigación (Art. 12 DS 21). La Dirección del Trabajo concluirá su investigación dentro de 30 '
                     'días hábiles desde que reciba la derivación.']
        secciones = [{'filas': [['Para', _persona(quien)], ['Fecha de la decisión', _d(h.get('decision_en'))]]},
                     {'parrafos': texto}]
        firmas = [receptor | {'detalle': 'Por la empresa'}, {'nombre': _persona(quien, False), 'detalle': 'Recibí'}]
    elif tipo == 'ANTECEDENTES_DT':
        decision = {'INTERNA': 'Investigación interna', 'DT': 'Derivación a la Dirección del Trabajo'}.get(
            h.get('decision'), 'Pendiente')
        filas = [['Empresa', f'{d.empresa.nombre_legal} · RUT {d.empresa.rut}'], *_datos_basicos(d), *_denunciados(d),
                 ['Decisión', decision]]
        if inv.get('investigador'):
            filas.append(['Quien investiga', _persona(inv['investigador'])])
        secciones = [{'parrafos': ['Datos para el trámite en el sitio de la Dirección del Trabajo (aviso de inicio de '
                                   'la investigación o derivación de la denuncia). El trámite se hace con ClaveÚnica.']},
                     {'filas': filas}, {'titulo': 'Medidas de resguardo', 'filas': _resguardo(d)}]
        if h.get('decision') == 'DT':
            secciones.append({'titulo': 'Relación de los hechos', 'parrafos': [datos.get('relato', '')]})
    elif tipo in CON_PARTICIPANTE:
        p = _participante(d, participante)
        rol = dict(dk.ROLES).get(p['rol'], '')
        investigador = inv.get('investigador') or {}
        if tipo == 'CITACION':
            if not p.get('citacion'):
                raise DocumentoNoDisponible('Primero registre la fecha, hora y lugar de la citación.')
            c = p['citacion']
            secciones = [{'filas': [['Para', p['nombre']], ['En calidad de', rol],
                                    ['Fecha', _d(c['fecha'])], ['Hora', c['hora']], ['Lugar', c['lugar']]]},
                         {'parrafos': [f'Se le cita a declarar en la investigación {d.folio}. La investigación es '
                                       'reservada; puede aportar los antecedentes que estime pertinentes.',
                                       'Si usted es parte (persona afectada, denunciante o denunciada), al declarar '
                                       'puede presentar antecedentes que afecten la imparcialidad de quien investiga '
                                       '(Art. 14 DS 21).']}]
            firmas = [{'nombre': investigador.get('nombre', 'Quien investiga'), 'detalle': 'Investigador(a)'},
                      {'nombre': p['nombre'], 'detalle': 'Recibí la citación'}]
        else:
            secciones = [{'filas': [['Expediente', d.folio], ['Declara', f"{p['nombre']}{' · RUT ' + p['rut'] if p.get('rut') else ''}"],
                                    ['En calidad de', rol], ['Fecha y hora', ''], ['Lugar', ''],
                                    ['Ante', investigador.get('nombre', '')]]},
                         {'parrafos': ['La declaración se deja por escrito y debe constar en papel, con la firma de '
                                       'quien comparece en todas sus hojas (Art. 15 DS 21). Al terminar, se sube '
                                       'escaneada al expediente.']},
                         {'titulo': 'Declaración', 'lineas': range(26)}]
            firmas = [{'nombre': p['nombre'], 'detalle': 'Firma de quien declara (en todas las hojas)'},
                      {'nombre': investigador.get('nombre', ''), 'detalle': 'Investigador(a)'}]
    elif tipo == 'INFORME':
        if not d.informe or h.get('decision') != 'INTERNA':
            raise DocumentoNoDisponible('Primero complete el informe.')
        i = d.informe
        roles = dict(dk.ROLES)
        testigos = 0
        entrevistas = []
        for p in inv.get('participantes', []):
            if p['rol'] == 'TESTIGO':
                testigos += 1
                quien_es = f'Testigo {testigos}'
            else:
                quien_es = f"{roles.get(p['rol'])}: {p['nombre']}"
            entrevistas.append([quien_es, f"Declaró el {_d(p['declaro_en'])}" if p.get('declaro_en') else 'Sin declaración'])
        antecedentes = dict(dk.ANTECEDENTES)
        sanciones, nombres = dict(dk.SANCIONES), [p.get('nombre') for p in datos.get('denunciados', [])]
        investigador = inv.get('investigador') or {}
        secciones = [
            {'titulo': 'a) Empresa', 'filas': [['Nombre', d.empresa.nombre_legal], ['RUT', d.empresa.rut],
                                               ['Correo', d.empresa.denuncias_correo or '—']]},
            {'titulo': 'b) Persona denunciante y denunciada',
             'filas': [['Persona afectada', _persona(afectada)],
                       *([['Denunciante', _persona(datos['denunciante'])]] if datos.get('denunciante') else []),
                       *_denunciados(d)]},
            {'titulo': 'c) Persona a cargo de la investigación',
             'filas': [['Investigador(a)', _persona(investigador) + (' (externo)' if investigador.get('externo') else '')],
                       ['Imparcialidad', i.get('imparcialidad') or 'No se recibieron antecedentes sobre su imparcialidad.']]},
            {'titulo': 'd) Medidas de resguardo y notificaciones',
             'filas': _resguardo(d) + [['Decisión informada a quien denunció', _d(h.get('denunciante_informado_en'))],
                                       ['Inicio informado a la DT', _d(h.get('inicio_informado_dt_en'))],
                                       ['Investigador informado a quien denunció', _d(h.get('investigador_informado_en'))]]},
            {'titulo': 'e) Antecedentes y entrevistas',
             'filas': entrevistas + [['Antecedentes revisados', ', '.join(antecedentes[a] for a in inv.get('antecedentes', []))
                                      or '—']]},
            {'titulo': 'f) Hechos denunciados, declaraciones y alegaciones',
             'parrafos': [f"Hechos denunciados: {datos.get('relato', '')}", i['hechos']]},
            {'titulo': 'g) Fundamentos y conclusión',
             'parrafos': [i['fundamentos'], f"Conclusión: {dict(dk.CONCLUSIONES)[i['conclusion']]}."]},
            {'titulo': 'h) Medidas correctivas propuestas',
             'parrafos': [m for m in (dict(dk.MEDIDAS_CORRECTIVAS)[x] for x in i.get('medidas_correctivas', []))] or ['No se proponen.']},
            {'titulo': 'i) Sanciones propuestas',
             'filas': [[nombres[s['persona']] if s['persona'] < len(nombres) else '—', sanciones[s['sancion']]]
                       for s in i.get('sanciones', [])] or [['Sanciones', 'No se proponen.']]},
        ]
        firmas = [{'nombre': investigador.get('nombre', ''), 'detalle': 'Investigador(a)'}]
    elif tipo == 'NOTIFICACION':
        if not d.informe or not h.get('informe_enviado_dt_en'):
            raise DocumentoNoDisponible('Primero remita el informe a la DT.')
        secciones = [{'filas': [['Expediente', d.folio], ['Informe remitido a la DT', _d(h.get('informe_enviado_dt_en'))]]},
                     {'parrafos': ['A la persona afectada, denunciante y denunciada: la Dirección del Trabajo no se '
                                   'pronunció dentro de 30 días hábiles, por lo que se consideran válidas las '
                                   'conclusiones del informe de la empresa (Art. 18 DS 21).',
                                   f"Conclusión: {dict(dk.CONCLUSIONES)[d.informe['conclusion']]}."]}]
        firmas = [receptor | {'detalle': 'Por la empresa'}, {'nombre': 'Recibí', 'detalle': 'Nombre, firma y fecha'}]
    elif tipo == 'MEDIDAS':
        if not d.medidas:
            raise DocumentoNoDisponible('Primero registre las medidas aplicadas.')
        sanciones, nombres = dict(dk.SANCIONES), [p.get('nombre') for p in datos.get('denunciados', [])]
        secciones = [{'filas': [['Expediente', d.folio], ['Fecha', _d(h.get('medidas_aplicadas_en'))]]},
                     {'titulo': 'Sanciones', 'filas': [[nombres[s['persona']], sanciones[s['sancion']]]
                                                       for s in d.medidas.get('sanciones', [])] or [['Sanciones', 'Ninguna']]},
                     {'titulo': 'Medidas correctivas',
                      'parrafos': [dict(dk.MEDIDAS_CORRECTIVAS)[m] for m in d.medidas.get('correctivas', [])] or ['Ninguna.']},
                     {'parrafos': ['Se informa a la persona denunciante y a la denunciada (Art. 19 DS 21). La persona '
                                   'sancionada con el despido puede impugnarlo ante el tribunal competente (Art. 22 DS 21).']}]
        firmas = [receptor | {'detalle': 'Por la empresa'}, {'nombre': 'Recibí', 'detalle': 'Nombre, firma y fecha'}]
    return TIPOS[tipo], secciones, firmas


def pdf(d, tipo, participante='', encargado=None):
    from .views.base import _html_a_pdf_bytes
    titulo, secciones, firmas = armar(d, tipo, participante, encargado)
    e = d.empresa
    ahora = timezone.localtime()
    html = get_template('karin_documento.html').render({
        'titulo': titulo, 'secciones': secciones, 'firmas': firmas, 'folio': d.folio, 'empresa': e,
        'empresa_correo': e.denuncias_correo, 'empresa_direccion': ', '.join(x for x in (e.direccion, e.comuna) if x),
        'ciudad': e.ciudad or e.comuna or 'Santiago', 'fecha': ahora.strftime('%d-%m-%Y'),
        'generado': ahora.strftime('%d-%m-%Y %H:%M'), 'nota': NOTA,
    })
    return titulo, _html_a_pdf_bytes(html, f'{d.folio} {titulo}')
