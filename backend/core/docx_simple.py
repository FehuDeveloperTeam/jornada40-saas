"""Documento Word (.docx) mínimo, sin dependencias: títulos, párrafos, viñetas y
notas destacadas. Sirve para entregar plantillas que el empleador edita.

Los bloques son tuplas (tipo, texto) con tipo en: 'titulo', 'h1', 'h2', 'p',
'li', 'nota'. El texto entre corchetes que empieza con "COMPLETAR" se marca
en amarillo para que se vea qué falta llenar.
"""
import io
import re
import zipfile
from xml.sax.saxutils import escape

_PENDIENTE = re.compile(r'(\[COMPLETAR[^\]]*\])')

_CONTENT_TYPES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''

_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

_DOC_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

_STYLES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:lang w:val="es-CL"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
</w:styles>'''

_NS = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
       'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"')


def _runs(texto, negrita=False):
    salida = []
    for parte in _PENDIENTE.split(texto):
        if not parte:
            continue
        props = ('<w:b/>' if negrita else '') + ('<w:highlight w:val="yellow"/>' if _PENDIENTE.fullmatch(parte) else '')
        salida.append(f'<w:r>{f"<w:rPr>{props}</w:rPr>" if props else ""}'
                      f'<w:t xml:space="preserve">{escape(parte)}</w:t></w:r>')
    return ''.join(salida)


def _parrafo(tipo, texto):
    if tipo == 'titulo':
        return f'<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>{_runs(texto)}</w:p>'
    if tipo in ('h1', 'h2'):
        estilo = 'Heading1' if tipo == 'h1' else 'Heading2'
        return f'<w:p><w:pPr><w:pStyle w:val="{estilo}"/></w:pPr>{_runs(texto)}</w:p>'
    if tipo == 'li':
        return (f'<w:p><w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr>'
                f'<w:r><w:t xml:space="preserve">•\t</w:t></w:r>{_runs(texto)}</w:p>')
    if tipo == 'nota':
        borde = '<w:top w:val="single" w:sz="8" w:space="4" w:color="B45309"/>' \
                '<w:left w:val="single" w:sz="8" w:space="4" w:color="B45309"/>' \
                '<w:bottom w:val="single" w:sz="8" w:space="4" w:color="B45309"/>' \
                '<w:right w:val="single" w:sz="8" w:space="4" w:color="B45309"/>'
        return (f'<w:p><w:pPr><w:pBdr>{borde}</w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FEF3C7"/></w:pPr>'
                f'{_runs(texto, negrita=True)}</w:p>')
    return f'<w:p>{_runs(texto)}</w:p>'


def construir_docx(bloques):
    cuerpo = ''.join(_parrafo(t, x) for t, x in bloques)
    documento = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document {_NS}><w:body>{cuerpo}'
                 '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
                 '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="708" w:footer="708" '
                 'w:gutter="0"/></w:sectPr></w:body></w:document>')
    salida = io.BytesIO()
    with zipfile.ZipFile(salida, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', _CONTENT_TYPES)
        z.writestr('_rels/.rels', _RELS)
        z.writestr('word/_rels/document.xml.rels', _DOC_RELS)
        z.writestr('word/styles.xml', _STYLES)
        z.writestr('word/document.xml', documento)
    return salida.getvalue()


def a_html(bloques):
    """Los mismos bloques en HTML para el PDF de vista previa (xhtml2pdf)."""
    partes = []
    en_lista = False
    for tipo, texto in bloques:
        if tipo != 'li' and en_lista:
            partes.append('</ul>')
            en_lista = False
        html = _PENDIENTE.sub(lambda m: f'<span class="pendiente">{m.group(1)}</span>', escape(texto))
        if tipo == 'li':
            if not en_lista:
                partes.append('<ul>')
                en_lista = True
            partes.append(f'<li>{html}</li>')
        elif tipo == 'titulo':
            partes.append(f'<h1>{html}</h1>')
        elif tipo == 'h1':
            partes.append(f'<h2>{html}</h2>')
        elif tipo == 'h2':
            partes.append(f'<h3>{html}</h3>')
        elif tipo == 'nota':
            partes.append(f'<div class="nota">{html}</div>')
        else:
            partes.append(f'<p>{html}</p>')
    if en_lista:
        partes.append('</ul>')
    return '\n'.join(partes)
