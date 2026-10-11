#!/usr/bin/env python3
"""Compila el documento técnico: Markdown → Word (pandoc) → PDF (LibreOffice).

Uso (desde la raíz del repositorio):
    python3 docs/tecnico/herramientas/construir.py            # Word y PDF
    python3 docs/tecnico/herramientas/construir.py --figuras  # además, redibuja los diagramas

Requisitos: pandoc 3, LibreOffice 7.6 o superior con Python UNO (paquete
python3-uno; se usa el python3 del sistema). Para --figuras: Node y Chromium.

Pasos:
1. Diagramas (con --figuras): cada figuras/*.mmd se dibuja a PNG con
   mermaid-cli. Los PNG se versionan, así que compilar no requiere Node.
2. Word: pandoc une los capítulos de documento.json con la plantilla de estilos
   (referencia.py) y el filtro documento.lua.
3. PDF: LibreOffice abre el Word, actualiza los índices (general, de figuras y
   de tablas, con sus números de página) y exporta el PDF y una copia del Word
   con los índices ya calculados.

Salida en docs/tecnico/salida/ (no se versiona).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

HERRAMIENTAS = Path(__file__).resolve().parent
RAIZ_DOC = HERRAMIENTAS.parent
SALIDA = RAIZ_DOC / 'salida'
FIGURAS = RAIZ_DOC / 'figuras'
MERMAID_CLI = '@mermaid-js/mermaid-cli@11.17.0'

sys.path.insert(0, str(HERRAMIENTAS))
import referencia  # noqa: E402


def dibujar_figuras():
    """Dibuja cada figuras/*.mmd a PNG (fondo blanco, doble resolución)."""
    chromium = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium')
    with tempfile.TemporaryDirectory() as tmp:
        navegador = Path(tmp) / 'puppeteer.json'
        navegador.write_text(json.dumps({'executablePath': chromium, 'args': ['--no-sandbox', '--disable-gpu']}))
        mmdc = os.environ.get('MMDC')
        comando = [mmdc] if mmdc else ['npx', '-y', MERMAID_CLI]
        for fuente in sorted(FIGURAS.glob('*.mmd')):
            destino = fuente.with_suffix('.png')
            print(f'  figura: {fuente.name}')
            subprocess.run(comando + ['-i', str(fuente), '-o', str(destino), '-p', str(navegador),
                                      '-c', str(HERRAMIENTAS / 'mermaid.json'), '-b', 'white', '-s', '3', '-q'],
                           check=True, env={**os.environ, 'PUPPETEER_SKIP_DOWNLOAD': 'true'})


def _ajustar_docx(ruta, datos):
    """Ajustes que pandoc no hace: propiedades del archivo (título, autor, idioma) y filas sin cortes."""
    with zipfile.ZipFile(ruta) as z:
        partes = {n: z.read(n) for n in z.namelist()}
    nucleo = partes['docProps/core.xml'].decode()
    nucleo = re.sub(r'<dc:title>.*?</dc:title>|<dc:title\s*/>', '', nucleo)
    nucleo = re.sub(r'<dc:creator>.*?</dc:creator>|<dc:creator\s*/>', '', nucleo)
    extra = (f'<dc:title>Jornada40 · {datos["titulo-documento"]}</dc:title>'
             f'<dc:creator>{datos["autor"]}</dc:creator><dc:language>es-CL</dc:language>'
             f'<cp:keywords>Jornada40; documento técnico; versión {datos["version"]}</cp:keywords>')
    nucleo = nucleo.replace('</cp:coreProperties>', extra + '</cp:coreProperties>')
    partes['docProps/core.xml'] = nucleo.encode()
    # Ninguna fila de tabla se parte entre dos páginas (pandoc no lo permite indicar).
    cuerpo = partes['word/document.xml'].decode().replace('<w:trPr>', '<w:trPr><w:cantSplit/>')
    cuerpo = re.sub(r'<w:tr>(?!<w:trPr>)', '<w:tr><w:trPr><w:cantSplit/></w:trPr>', cuerpo)
    partes['word/document.xml'] = cuerpo.encode()
    with zipfile.ZipFile(ruta, 'w', zipfile.ZIP_DEFLATED) as z:
        for nombre, contenido in partes.items():
            z.writestr(nombre, contenido)


def generar_word(datos, destino):
    with tempfile.TemporaryDirectory() as tmp:
        plantilla = Path(tmp) / 'referencia.docx'
        referencia.generar(plantilla, datos['titulo-documento'], datos['version'], datos['fecha'],
                           datos['clasificacion'])
        capitulos = [str(RAIZ_DOC / c) for c in datos['capitulos']]
        subprocess.run(['pandoc', *capitulos, '-f', 'markdown', '-t', 'docx', '-o', str(destino),
                        '--reference-doc', str(plantilla), '--lua-filter', str(HERRAMIENTAS / 'documento.lua'),
                        '--metadata-file', str(RAIZ_DOC / 'documento.json'), '--number-sections',
                        '--columns=10', '--resource-path', str(RAIZ_DOC)], check=True, cwd=RAIZ_DOC)
    _ajustar_docx(destino, datos)


def _propiedad(nombre, valor):
    import uno  # noqa: F401  (registra los tipos de UNO)
    from com.sun.star.beans import PropertyValue
    p = PropertyValue()
    p.Name, p.Value = nombre, valor
    return p


def generar_pdf(docx, pdf, docx_final):
    """Abre el Word en LibreOffice, actualiza los índices y exporta PDF y Word."""
    try:
        import uno
    except ImportError:
        sys.exit('Falta Python UNO (paquete python3-uno): no se puede generar el PDF.')
    with tempfile.TemporaryDirectory() as perfil:
        tubo = f'j40doc{os.getpid()}'
        proceso = subprocess.Popen(
            ['soffice', '--headless', '--invisible', '--nologo', '--norestore', '--nodefault',
             f'-env:UserInstallation=file://{perfil}', f'--accept=pipe,name={tubo};urp;StarOffice.ComponentContext'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            local = uno.getComponentContext()
            resolutor = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
            for _ in range(120):
                try:
                    contexto = resolutor.resolve(f'uno:pipe,name={tubo};urp;StarOffice.ComponentContext')
                    break
                except Exception:
                    time.sleep(0.5)
            else:
                sys.exit('LibreOffice no respondió.')
            escritorio = contexto.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', contexto)
            documento = escritorio.loadComponentFromURL(Path(docx).resolve().as_uri(), '_blank', 0,
                                                        (_propiedad('Hidden', True),))
            # Las tablas cortas no se parten entre páginas (las largas sí, repitiendo el encabezado).
            tablas = documento.getTextTables()
            for i in range(tablas.getCount()):
                tabla = tablas.getByIndex(i)
                texto = sum(len(tabla.getCellByName(c).getString()) for c in tabla.getCellNames())
                if tabla.getRows().getCount() <= 10 and texto <= 1200:
                    tabla.Split = False
            # Dos pasadas: la primera fija el largo de los índices; la segunda, sus números de página.
            for _ in range(2):
                indices = documento.getDocumentIndexes()
                for i in range(indices.getCount()):
                    indices.getByIndex(i).update()
                documento.getTextFields().refresh()
            opciones = uno.Any('[]com.sun.star.beans.PropertyValue', (
                _propiedad('UseTaggedPDF', True), _propiedad('ExportBookmarks', True),
                _propiedad('ExportLinksRelativeFsys', False), _propiedad('PDFViewSelection', 2)))
            documento.storeToURL(Path(pdf).resolve().as_uri(),
                                 (_propiedad('FilterName', 'writer_pdf_Export'), _propiedad('FilterData', opciones)))
            documento.storeToURL(Path(docx_final).resolve().as_uri(), (_propiedad('FilterName', 'MS Word 2007 XML'),))
            documento.close(True)
        finally:
            try:
                escritorio.terminate()
            except Exception:
                pass
            proceso.wait(timeout=30)


def main():
    datos = json.loads((RAIZ_DOC / 'documento.json').read_text())
    if '--figuras' in sys.argv:
        dibujar_figuras()
    SALIDA.mkdir(exist_ok=True)
    nombre = f'Jornada40-documento-tecnico-v{datos["version"]}'
    borrador = SALIDA / f'{nombre}-pandoc.docx'
    print('Word (pandoc)…')
    generar_word(datos, borrador)
    if '--sin-pdf' in sys.argv:
        shutil.copy(borrador, SALIDA / f'{nombre}.docx')
        print(f'Listo: {SALIDA / (nombre + ".docx")}')
        return
    print('PDF e índices (LibreOffice)…')
    generar_pdf(borrador, SALIDA / f'{nombre}.pdf', SALIDA / f'{nombre}.docx')
    borrador.unlink()
    print(f'Listo: {SALIDA / (nombre + ".pdf")} y {SALIDA / (nombre + ".docx")}')


if __name__ == '__main__':
    main()
