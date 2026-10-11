"""Plantilla de estilos (referencia.docx) del documento técnico.

Parte de la plantilla por defecto de pandoc y le aplica el formato de
Jornada40: tipografía, títulos numerados, tablas, leyendas de figuras y
tablas, índices, notas, portada, encabezado con la clasificación y pie con la
versión y el número de página. No se guarda en el repositorio: `construir.py`
la genera en cada compilación con la versión y la fecha del documento.
"""
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

# Colores de la marca (frontend/src/styles/j40.css) y neutros para texto y bordes.
AZUL = '0A5DB3'          # --j40-brand-text
AZUL_SUAVE = 'E8F1FC'    # --j40-brand-soft
FONDO_NOTA = 'F3F7FC'
TEXTO = '1F2937'
TEXTO_2 = '4B5563'
BORDE = 'C9D3E0'
ROJO = 'B42318'
FUENTE = 'Arial'
MONO = 'Consolas'

# Hoja tamaño carta con márgenes de 2,5 cm; ancho útil para las tabulaciones.
ANCHO_PAGINA, ALTO_PAGINA, MARGEN = 12240, 15840, 1418
ANCHO_UTIL = ANCHO_PAGINA - 2 * MARGEN

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'


def _fuente(nombre):
    return f'<w:rFonts w:ascii="{nombre}" w:hAnsi="{nombre}" w:eastAsia="{nombre}" w:cs="{nombre}"/>'


def _estilo(tipo, sid, nombre, basado=None, siguiente=None, ppr='', rpr='', extra='', propio=True):
    personalizado = ' w:customStyle="1"' if propio else ''
    partes = [f'<w:style w:type="{tipo}"{personalizado} w:styleId="{sid}">', f'<w:name w:val="{nombre}"/>']
    if basado:
        partes.append(f'<w:basedOn w:val="{basado}"/>')
    if siguiente:
        partes.append(f'<w:next w:val="{siguiente}"/>')
    partes.append('<w:qFormat/>')
    if ppr:
        partes.append(f'<w:pPr>{ppr}</w:pPr>')
    if rpr:
        partes.append(f'<w:rPr>{rpr}</w:rPr>')
    partes.append(extra)
    partes.append('</w:style>')
    return ''.join(partes)


def _tab_derecha(relleno='dot'):
    return f'<w:tabs><w:tab w:val="right" w:leader="{relleno}" w:pos="{ANCHO_UTIL}"/></w:tabs>'


def _titulo(nivel, tam, antes, despues, color=AZUL, salto=False, borde=False, cursiva=False):
    ppr = ('<w:pageBreakBefore/>' if salto else '') + '<w:keepNext/><w:keepLines/>'
    if borde:
        ppr += f'<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="{AZUL}"/></w:pBdr>'
    ppr += f'<w:spacing w:before="{antes}" w:after="{despues}"/><w:jc w:val="left"/><w:outlineLvl w:val="{nivel - 1}"/>'
    rpr = _fuente(FUENTE) + '<w:b/><w:bCs/>' + ('<w:i/>' if cursiva else '') + \
        f'<w:color w:val="{color}"/><w:sz w:val="{tam}"/><w:szCs w:val="{tam}"/>'
    return _estilo('paragraph', f'Heading{nivel}', f'heading {nivel}', 'Normal', 'BodyText', ppr, rpr, propio=False)


def estilos():
    """Estilos que reemplazan (o se agregan a) los de la plantilla de pandoc."""
    return [
        _estilo('paragraph', 'Normal', 'Normal', ppr='<w:spacing w:after="120" w:line="264" w:lineRule="auto"/>',
                rpr=_fuente(FUENTE) + f'<w:color w:val="{TEXTO}"/><w:sz w:val="21"/><w:szCs w:val="21"/>',
                propio=False),
        _estilo('paragraph', 'BodyText', 'Body Text', 'Normal', ppr='<w:spacing w:before="0" w:after="140"/><w:jc w:val="both"/>',
                propio=False),
        _estilo('paragraph', 'FirstParagraph', 'First Paragraph', 'BodyText', 'BodyText'),
        _estilo('paragraph', 'Compact', 'Compact', 'Normal', ppr='<w:spacing w:before="20" w:after="40"/>'),
        _titulo(1, 32, 0, 240, salto=True, borde=True),
        _titulo(2, 26, 320, 120),
        _titulo(3, 22, 240, 80, color=TEXTO),
        _titulo(4, 21, 200, 60, color=TEXTO, cursiva=True),
        _estilo('paragraph', 'BlockText', 'Block Text', 'BodyText', 'BodyText',
                ppr=(f'<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="{AZUL}"/></w:pBdr>'
                     f'<w:shd w:val="clear" w:color="auto" w:fill="{FONDO_NOTA}"/>'
                     '<w:spacing w:before="120" w:after="120"/><w:ind w:left="227" w:right="113"/><w:jc w:val="left"/>'),
                rpr='<w:sz w:val="20"/><w:szCs w:val="20"/>', propio=False),
        _estilo('paragraph', 'Caption', 'caption', 'Normal', ppr='<w:spacing w:before="60" w:after="200"/>',
                rpr=f'<w:color w:val="{TEXTO_2}"/><w:sz w:val="18"/><w:szCs w:val="18"/>', propio=False),
        _estilo('paragraph', 'TableCaption', 'Table Caption', 'Caption',
                ppr='<w:keepNext/><w:spacing w:before="200" w:after="80"/>'),
        _estilo('paragraph', 'ImageCaption', 'Image Caption', 'Caption', ppr='<w:jc w:val="center"/>'),
        _estilo('paragraph', 'Figure', 'Figure', 'Normal', ppr='<w:keepNext/><w:spacing w:before="160" w:after="60"/><w:jc w:val="center"/>'),
        _estilo('paragraph', 'CaptionedFigure', 'Captioned Figure', 'Figure', ppr='<w:keepNext/>'),
        _estilo('paragraph', 'TOC1', 'toc 1', 'Normal', 'Normal',
                ppr=_tab_derecha() + '<w:spacing w:before="120" w:after="40"/>', rpr='<w:b/><w:bCs/>', propio=False),
        _estilo('paragraph', 'TOC2', 'toc 2', 'Normal', 'Normal',
                ppr=_tab_derecha() + '<w:spacing w:before="0" w:after="30"/><w:ind w:left="220"/>', propio=False),
        _estilo('paragraph', 'TOC3', 'toc 3', 'Normal', 'Normal',
                ppr=_tab_derecha() + '<w:spacing w:before="0" w:after="20"/><w:ind w:left="440"/>',
                rpr='<w:sz w:val="20"/><w:szCs w:val="20"/>', propio=False),
        _estilo('paragraph', 'TableofFigures', 'table of figures', 'Normal', 'Normal',
                ppr=_tab_derecha() + '<w:spacing w:before="0" w:after="40"/>', propio=False),
        _estilo('paragraph', 'Header', 'header', 'Normal', ppr=f'<w:tabs><w:tab w:val="right" w:pos="{ANCHO_UTIL}"/></w:tabs>'
                f'<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="{BORDE}"/></w:pBdr><w:spacing w:after="0"/>',
                rpr=f'<w:color w:val="{TEXTO_2}"/><w:sz w:val="16"/><w:szCs w:val="16"/>', propio=False),
        _estilo('paragraph', 'Footer', 'footer', 'Normal', ppr=f'<w:tabs><w:tab w:val="right" w:pos="{ANCHO_UTIL}"/></w:tabs>'
                '<w:spacing w:after="0"/>',
                rpr=f'<w:color w:val="{TEXTO_2}"/><w:sz w:val="16"/><w:szCs w:val="16"/>', propio=False),
        # Propios del documento (los usa el Markdown con custom-style).
        _estilo('paragraph', 'TituloPreliminar', 'Título preliminar', 'Normal', 'BodyText',
                ppr=(f'<w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="{AZUL}"/></w:pBdr>'
                     '<w:spacing w:before="0" w:after="240"/>'),
                rpr=f'<w:b/><w:bCs/><w:color w:val="{AZUL}"/><w:sz w:val="32"/><w:szCs w:val="32"/>'),
        _estilo('paragraph', 'TituloPagina', 'Título de página', 'TituloPreliminar', 'BodyText',
                ppr='<w:pageBreakBefore/>'),
        _estilo('paragraph', 'NotaTabla', 'Nota de tabla', 'Normal', 'BodyText',
                ppr='<w:spacing w:before="40" w:after="200"/>',
                rpr=f'<w:color w:val="{TEXTO_2}"/><w:sz w:val="16"/><w:szCs w:val="16"/>'),
        _estilo('paragraph', 'EspacioTabla', 'Espacio tras tabla', 'Normal',
                ppr='<w:spacing w:before="0" w:after="0" w:line="160" w:lineRule="exact"/>',
                rpr='<w:sz w:val="4"/><w:szCs w:val="4"/>'),
        _estilo('paragraph', 'SubtituloPreliminar', 'Subtítulo preliminar', 'Normal', 'BodyText',
                ppr='<w:keepNext/><w:spacing w:before="320" w:after="120"/>',
                rpr=f'<w:b/><w:bCs/><w:color w:val="{AZUL}"/><w:sz w:val="24"/><w:szCs w:val="24"/>'),
        _estilo('paragraph', 'PortadaLogo', 'Portada logo', 'Normal', ppr='<w:spacing w:before="600" w:after="360"/>'),
        _estilo('paragraph', 'PortadaProducto', 'Portada producto', 'Normal', ppr='<w:spacing w:before="0" w:after="120"/>',
                rpr=f'<w:b/><w:bCs/><w:color w:val="{AZUL}"/><w:spacing w:val="30"/><w:sz w:val="28"/><w:szCs w:val="28"/>'),
        _estilo('paragraph', 'PortadaTitulo', 'Portada título', 'Normal', ppr='<w:spacing w:before="0" w:after="200" w:line="240" w:lineRule="auto"/>',
                rpr=f'<w:b/><w:bCs/><w:color w:val="{TEXTO}"/><w:sz w:val="60"/><w:szCs w:val="60"/>'),
        _estilo('paragraph', 'PortadaSubtitulo', 'Portada subtítulo', 'Normal', ppr='<w:spacing w:before="0" w:after="720"/>',
                rpr=f'<w:color w:val="{TEXTO_2}"/><w:sz w:val="28"/><w:szCs w:val="28"/>'),
        _estilo('paragraph', 'PortadaAviso', 'Portada aviso', 'Normal', ppr='<w:spacing w:before="720" w:after="0"/><w:jc w:val="both"/>',
                rpr=f'<w:color w:val="{TEXTO_2}"/><w:sz w:val="17"/><w:szCs w:val="17"/>'),
        _estilo('paragraph', 'Celda', 'Celda', 'Normal', ppr='<w:spacing w:before="30" w:after="30" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/>',
                rpr='<w:sz w:val="18"/><w:szCs w:val="18"/>'),
        _estilo('paragraph', 'CeldaEncabezado', 'Celda encabezado', 'Celda',
                rpr=f'<w:b/><w:bCs/><w:color w:val="{TEXTO}"/>'),
        _estilo('character', 'VerbatimChar', 'Verbatim Char', rpr=_fuente(MONO) + '<w:sz w:val="18"/><w:szCs w:val="18"/>'),
        _estilo('character', 'Hyperlink', 'Hyperlink', rpr=f'<w:color w:val="{AZUL}"/><w:u w:val="single"/>', propio=False),
        _estilo('table', 'Table', 'Table', extra=(
            '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/>'
            f'<w:tblBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="{AZUL}"/>'
            f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="{BORDE}"/>'
            f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{BORDE}"/></w:tblBorders>'
            '<w:tblCellMar><w:top w:w="45" w:type="dxa"/><w:left w:w="100" w:type="dxa"/>'
            '<w:bottom w:w="45" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>'
            '<w:tblStylePr w:type="firstRow"><w:rPr><w:b/><w:bCs/></w:rPr>'
            f'<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="{AZUL_SUAVE}"/><w:vAlign w:val="bottom"/></w:tcPr>'
            '</w:tblStylePr>'), propio=False),
    ]


def _reemplazar_estilos(xml):
    for estilo in estilos():
        sid = re.search(r'w:styleId="([^"]+)"', estilo).group(1)
        patron = re.compile(r'<w:style [^>]*w:styleId="%s".*?</w:style>' % re.escape(sid), re.S)
        if patron.search(xml):
            xml = patron.sub(lambda _m, e=estilo: e, xml, count=1)
        else:
            xml = xml.replace('</w:styles>', estilo + '</w:styles>')
    # Fuente, tamaño e idioma por defecto (es-CL: revisión ortográfica en español).
    xml = re.sub(r'<w:rPrDefault>.*?</w:rPrDefault>',
                 '<w:rPrDefault><w:rPr>' + _fuente(FUENTE) + '<w:sz w:val="21"/><w:szCs w:val="21"/>'
                 '<w:lang w:val="es-CL" w:eastAsia="es-CL" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>', xml, flags=re.S)
    return xml


def _encabezado(texto_izq, texto_der):
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="{W}" xmlns:r="{R}">'
            '<w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr>'
            f'<w:r><w:t xml:space="preserve">{texto_izq}</w:t></w:r><w:r><w:tab/></w:r>'
            f'<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="{ROJO}"/></w:rPr><w:t>{texto_der}</w:t></w:r></w:p></w:hdr>')


def _pie(texto_izq):
    campo = ('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> {0} </w:instrText></w:r>'
             '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>')
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="{W}" xmlns:r="{R}">'
            '<w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>'
            f'<w:r><w:t xml:space="preserve">{texto_izq}</w:t></w:r><w:r><w:tab/></w:r>'
            '<w:r><w:t xml:space="preserve">Página </w:t></w:r>' + campo.format('PAGE') +
            '<w:r><w:t xml:space="preserve"> de </w:t></w:r>' + campo.format('NUMPAGES') + '</w:p></w:ftr>')


_VACIO_HDR = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="{W}" xmlns:r="{R}"><w:p/></w:hdr>'
_VACIO_FTR = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="{W}" xmlns:r="{R}"><w:p/></w:ftr>'

_SECCION = (
    '<w:sectPr>'
    '<w:headerReference w:type="default" r:id="rIdJ40Hdr"/><w:headerReference w:type="first" r:id="rIdJ40HdrPortada"/>'
    '<w:footerReference w:type="default" r:id="rIdJ40Ftr"/><w:footerReference w:type="first" r:id="rIdJ40FtrPortada"/>'
    f'<w:pgSz w:w="{ANCHO_PAGINA}" w:h="{ALTO_PAGINA}"/>'
    f'<w:pgMar w:top="{MARGEN}" w:right="{MARGEN}" w:bottom="{MARGEN}" w:left="{MARGEN}" w:header="709" w:footer="709" w:gutter="0"/>'
    '<w:cols w:space="720"/><w:titlePg/></w:sectPr>')

_PARTES = {
    'word/header1.xml': ('rIdJ40Hdr', 'header'),
    'word/header2.xml': ('rIdJ40HdrPortada', 'header'),
    'word/footer1.xml': ('rIdJ40Ftr', 'footer'),
    'word/footer2.xml': ('rIdJ40FtrPortada', 'footer'),
}


def generar(destino, titulo, version, fecha, clasificacion):
    """Escribe la plantilla en `destino` a partir de la de pandoc."""
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / 'pandoc.docx'
        subprocess.run(['pandoc', '-o', str(base), '--print-default-data-file', 'reference.docx'], check=True)
        with zipfile.ZipFile(base) as origen:
            contenido = {n: origen.read(n) for n in origen.namelist()}

    contenido['word/styles.xml'] = _reemplazar_estilos(contenido['word/styles.xml'].decode()).encode()
    documento = contenido['word/document.xml'].decode()
    documento = re.sub(r'<w:sectPr\s*/>|<w:sectPr>.*?</w:sectPr>', _SECCION, documento, flags=re.S)
    contenido['word/document.xml'] = documento.encode()

    contenido['word/header1.xml'] = _encabezado(f'Jornada40 · {titulo}', clasificacion.upper()).encode()
    contenido['word/header2.xml'] = _VACIO_HDR.encode()
    contenido['word/footer1.xml'] = _pie(f'Versión {version} · {fecha}').encode()
    contenido['word/footer2.xml'] = _VACIO_FTR.encode()

    rels = contenido['word/_rels/document.xml.rels'].decode()
    tipos = contenido['[Content_Types].xml'].decode()
    for parte, (rid, tipo) in _PARTES.items():
        rels = rels.replace('</Relationships>', (
            f'<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/{tipo}" '
            f'Id="{rid}" Target="{parte.split("/")[-1]}"/></Relationships>'))
        tipos = tipos.replace('</Types>', (
            f'<Override PartName="/{parte}" '
            f'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.{tipo}+xml"/></Types>'))
    contenido['word/_rels/document.xml.rels'] = rels.encode()
    contenido['[Content_Types].xml'] = tipos.encode()

    ajustes = contenido['word/settings.xml'].decode().replace('w:val="en-US"', 'w:val="es-CL"')
    contenido['word/settings.xml'] = ajustes.encode()

    with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED) as salida:
        for nombre, datos in contenido.items():
            salida.writestr(nombre, datos)
