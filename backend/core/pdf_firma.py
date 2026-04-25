"""
pdf_firma.py — Motor de certificado de Firma Electrónica Simple

Estrategia: agregar una página final de certificado al PDF original.
Esto evita depender de coordenadas fijas en templates distintos y es
más sólido legalmente (el documento original queda intacto).

Uso:
    from core.pdf_firma import agregar_certificado_firma
    pdf_final = agregar_certificado_firma(pdf_original_bytes, ...)
"""
import base64
import io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas
from pypdf import PdfReader, PdfWriter


# ──────────────────────────────────────────────────────────────────────────────
# Paleta
# ──────────────────────────────────────────────────────────────────────────────
AZUL_OSCURO = HexColor('#0c1a35')
AZUL_MEDIO  = HexColor('#1e3a6e')
AZUL_CLARO  = HexColor('#2563eb')
VIOLETA     = HexColor('#7c3aed')
VERDE       = HexColor('#059669')
VERDE_LIGHT = HexColor('#d1fae5')
GRIS_TEXTO  = HexColor('#374151')
GRIS_SUAVE  = HexColor('#6b7280')
GRIS_FONDO  = HexColor('#f3f4f6')
GRIS_BORDE  = HexColor('#e5e7eb')
AZUL_FONDO  = HexColor('#f0f4ff')
AZUL_BORDE  = HexColor('#bfdbfe')
AZUL_LABEL  = HexColor('#93c5fd')


# ──────────────────────────────────────────────────────────────────────────────
# Helpers internos
# ──────────────────────────────────────────────────────────────────────────────

def _b64_a_reader(data_url: str) -> ImageReader | None:
    """Convierte data URL base64 (PNG/JPEG) a ImageReader de ReportLab."""
    if not data_url:
        return None
    raw = data_url.split(',', 1)[1] if ',' in data_url else data_url
    try:
        return ImageReader(io.BytesIO(base64.b64decode(raw)))
    except Exception:
        return None


def _truncar(texto: str, max_chars: int) -> str:
    return texto if len(texto) <= max_chars else texto[:max_chars - 1] + '…'


def _caja(c: rl_canvas.Canvas, x, y, w, h, fondo, borde, radio=6):
    c.setFillColor(fondo)
    c.setStrokeColor(borde)
    c.setLineWidth(0.5)
    c.roundRect(x, y, w, h, radio, fill=True, stroke=True)


def _separador(c: rl_canvas.Canvas, titulo: str, x, y, ancho_util):
    c.setFillColor(GRIS_TEXTO)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(x, y, titulo)
    c.setStrokeColor(AZUL_CLARO)
    c.setLineWidth(1.5)
    c.line(x, y - 3, x + ancho_util, y - 3)


# ──────────────────────────────────────────────────────────────────────────────
# Generación de la página de certificado
# ──────────────────────────────────────────────────────────────────────────────

def _generar_pagina_certificado(
    tipo_documento_label: str,
    empresa_nombre: str,
    empresa_rut: str,
    firmante_nombre: str,
    firmante_cargo: str,
    firma_empleador_b64: str,
    trabajador_nombre: str,
    trabajador_rut: str,
    firma_trabajador_b64: str,
    token: str,
    firmado_en: datetime,
    ip_firmante: str,
    email_firmante: str,
) -> bytes:
    buf = io.BytesIO()
    ancho, alto = A4          # 595.27 × 841.89 pts
    margen      = 2.0 * cm
    ancho_util  = ancho - 2 * margen
    c = rl_canvas.Canvas(buf, pagesize=A4)

    # ── Header ──────────────────────────────────────────────────────────
    c.setFillColor(AZUL_OSCURO)
    c.rect(0, alto - 3.2 * cm, ancho, 3.2 * cm, fill=True, stroke=False)

    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 13)
    c.drawString(margen, alto - 1.5 * cm, 'CERTIFICADO DE FIRMA ELECTRÓNICA')

    c.setFillColor(AZUL_LABEL)
    c.setFont('Helvetica', 8.5)
    c.drawString(margen, alto - 2.3 * cm,
                 'Firma Electrónica Simple — Ley 19.799 (Chile) | Jornada40')

    y = alto - 3.9 * cm

    # ── Bloque documento ────────────────────────────────────────────────
    doc_h = 2.8 * cm
    _caja(c, margen, y - doc_h, ancho_util, doc_h, GRIS_FONDO, GRIS_BORDE)

    c.setFillColor(GRIS_SUAVE)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(margen + 0.4*cm, y - 0.55*cm, 'DOCUMENTO')
    c.setFillColor(GRIS_TEXTO)
    c.setFont('Helvetica', 10)
    c.drawString(margen + 0.4*cm, y - 1.1*cm, _truncar(tipo_documento_label, 60))

    c.setFillColor(GRIS_SUAVE)
    c.setFont('Helvetica-Bold', 7)
    c.drawString(margen + 0.4*cm, y - 1.75*cm, 'EMPRESA')
    c.setFillColor(GRIS_TEXTO)
    c.setFont('Helvetica', 9)
    c.drawString(margen + 0.4*cm, y - 2.25*cm,
                 _truncar(f'{empresa_nombre}  ·  RUT {empresa_rut}', 80))

    # Badge FIRMADO
    bx = ancho - margen - 2.6*cm
    by = y - 1.85*cm
    c.setFillColor(VERDE_LIGHT)
    c.setStrokeColor(VERDE)
    c.setLineWidth(0.8)
    c.roundRect(bx, by, 2.3*cm, 0.75*cm, 4, fill=True, stroke=True)
    c.setFillColor(VERDE)
    c.setFont('Helvetica-Bold', 8)
    c.drawCentredString(bx + 1.15*cm, by + 0.2*cm, '✓  FIRMADO')

    y -= (doc_h + 0.9*cm)

    # ── Firmas ──────────────────────────────────────────────────────────
    _separador(c, 'FIRMAS DE LAS PARTES', margen, y, ancho_util)
    y -= 0.6 * cm

    mitad = (ancho_util - 0.5*cm) / 2
    box_h = 5.6 * cm

    for i, (etiqueta, color_label, img_b64, nombre, sub) in enumerate([
        ('EMPLEADOR',  AZUL_CLARO, firma_empleador_b64,
         _truncar(firmante_nombre, 40),  _truncar(firmante_cargo, 40)),
        ('TRABAJADOR', VIOLETA,    firma_trabajador_b64,
         _truncar(trabajador_nombre, 40), f'RUT {trabajador_rut}'),
    ]):
        bx = margen + i * (mitad + 0.5*cm)
        _caja(c, bx, y - box_h, mitad, box_h, GRIS_FONDO, GRIS_BORDE)

        c.setFillColor(color_label)
        c.setFont('Helvetica-Bold', 7)
        c.drawString(bx + 0.3*cm, y - 0.45*cm, etiqueta)

        # Imagen de firma centrada en el espacio disponible
        img = _b64_a_reader(img_b64)
        if img:
            img_margin = 0.3*cm
            img_area_w = mitad - 2 * img_margin
            img_area_h = 2.6*cm
            c.drawImage(
                img,
                bx + img_margin,
                y - 3.3*cm,
                img_area_w,
                img_area_h,
                preserveAspectRatio=True,
                anchor='c',
                mask='auto',
            )
        else:
            # Placeholder si no hay imagen
            c.setStrokeColor(GRIS_BORDE)
            c.setLineWidth(0.5)
            c.rect(bx + 0.3*cm, y - 3.3*cm, mitad - 0.6*cm, 2.6*cm)
            c.setFillColor(GRIS_SUAVE)
            c.setFont('Helvetica', 7)
            c.drawCentredString(bx + mitad/2, y - 2.1*cm, 'Sin firma registrada')

        # Nombre y sub-texto
        c.setFillColor(GRIS_TEXTO)
        c.setFont('Helvetica-Bold', 7.5)
        c.drawString(bx + 0.3*cm, y - 3.9*cm, nombre)
        c.setFillColor(GRIS_SUAVE)
        c.setFont('Helvetica', 7)
        c.drawString(bx + 0.3*cm, y - 4.45*cm, sub)

    y -= (box_h + 0.9*cm)

    # ── Datos de verificación ────────────────────────────────────────────
    _separador(c, 'DATOS DE VERIFICACIÓN', margen, y, ancho_util)
    y -= 0.6 * cm

    filas = [
        ('TOKEN DE VERIFICACIÓN', str(token)),
        ('FECHA Y HORA DE FIRMA',
         firmado_en.strftime('%d/%m/%Y %H:%M:%S') + ' (UTC)'),
        ('IP DEL FIRMANTE',       ip_firmante or 'No registrada'),
        ('EMAIL VERIFICADO',      email_firmante),
    ]
    datos_h = len(filas) * 0.82*cm + 0.5*cm
    _caja(c, margen, y - datos_h, ancho_util, datos_h, AZUL_FONDO, AZUL_BORDE)

    col_label = margen + 0.4*cm
    col_valor = margen + ancho_util * 0.36
    yd = y - 0.6*cm

    for label, valor in filas:
        c.setFillColor(GRIS_SUAVE)
        c.setFont('Helvetica-Bold', 7)
        c.drawString(col_label, yd, label)
        c.setFillColor(GRIS_TEXTO)
        c.setFont('Helvetica', 8)
        c.drawString(col_valor, yd, _truncar(valor, 70))
        yd -= 0.82*cm

    # ── Pie de página ────────────────────────────────────────────────────
    pie1 = ('Este certificado acredita la firma electrónica simple del '
            'documento adjunto, válida de conformidad con la Ley N° 19.799 '
            'sobre Documentos Electrónicos,')
    pie2 = ('Firma Electrónica y Servicios de Certificación de la República '
            'de Chile. Generado por Jornada40 (jornada40.cl).')
    c.setFillColor(GRIS_SUAVE)
    c.setFont('Helvetica', 6.5)
    c.drawString(margen, 1.5*cm, pie1)
    c.drawString(margen, 0.9*cm, pie2)

    c.save()
    return buf.getvalue()


# ──────────────────────────────────────────────────────────────────────────────
# Función pública principal
# ──────────────────────────────────────────────────────────────────────────────

def agregar_certificado_firma(
    pdf_original_bytes: bytes,
    tipo_documento_label: str,
    empresa_nombre: str,
    empresa_rut: str,
    firmante_nombre: str,
    firmante_cargo: str,
    firma_empleador_b64: str,
    trabajador_nombre: str,
    trabajador_rut: str,
    firma_trabajador_b64: str,
    token: str,
    firmado_en: datetime,
    ip_firmante: str,
    email_firmante: str,
) -> bytes:
    """
    Une el PDF original con la página de certificado de firma.

    Args:
        pdf_original_bytes:    Bytes del PDF sin firmas (descargado de B2).
        tipo_documento_label:  Ej. "Contrato Laboral", "Carta de Amonestación".
        empresa_nombre/rut:    Datos de la empresa.
        firmante_nombre/cargo: Nombre y cargo del representante legal.
        firma_empleador_b64:   Data URL base64 de la firma del empleador.
        trabajador_nombre/rut: Datos del trabajador.
        firma_trabajador_b64:  Data URL base64 de la firma del trabajador.
        token:                 UUID de la SolicitudFirma (trazabilidad).
        firmado_en:            Datetime UTC del momento de firma.
        ip_firmante:           IP del trabajador al firmar.
        email_firmante:        Email verificado con OTP.

    Returns:
        Bytes del PDF final (original + página de certificado).
    """
    cert_bytes = _generar_pagina_certificado(
        tipo_documento_label=tipo_documento_label,
        empresa_nombre=empresa_nombre,
        empresa_rut=empresa_rut,
        firmante_nombre=firmante_nombre,
        firmante_cargo=firmante_cargo,
        firma_empleador_b64=firma_empleador_b64,
        trabajador_nombre=trabajador_nombre,
        trabajador_rut=trabajador_rut,
        firma_trabajador_b64=firma_trabajador_b64,
        token=token,
        firmado_en=firmado_en,
        ip_firmante=ip_firmante,
        email_firmante=email_firmante,
    )

    writer = PdfWriter()

    # Todas las páginas del documento original
    for page in PdfReader(io.BytesIO(pdf_original_bytes)).pages:
        writer.add_page(page)

    # Página de certificado de firma
    writer.add_page(PdfReader(io.BytesIO(cert_bytes)).pages[0])

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
