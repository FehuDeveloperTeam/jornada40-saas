"""Reglamento interno: plantilla guía por rubro, versiones, plazos y entrega.

El empleador descarga la plantilla de su rubro (Word para editar o PDF para
leer), la completa y sube el reglamento final en PDF. Jornada40 calcula desde
cuándo rige (30 días después de darlo a conocer, Art. 156), el plazo para
remitirlo a la DT y a la Seremi de Salud (5 días desde la vigencia, Art. 153),
y lo entrega a cada trabajador con una constancia de recepción firmada que
lleva adjunto el reglamento completo. Plan Pyme en adelante.
"""
import datetime
import io

from django.template.loader import render_to_string
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..docx_simple import a_html, construir_docx
from ..models import DocumentoLaboral, Empleado, Empresa, ReglamentoInterno, SolicitudFirma
from ..reglamento_plantilla import OPCIONES_RUBRO, RUBROS, UMBRAL_RIOHS, bloques, tipo_segun_dotacion
from .base import _html_a_pdf_bytes, _plan_permite, logger, respuesta_pdf

NIVEL_REGLAMENTO = 3            # Pyme en adelante
DIAS_ANTICIPACION = 30          # Art. 156
DIAS_REMISION = 5               # Art. 153
MAX_MB = 20
_VIVAS = ('PENDIENTE', 'PROCESANDO', 'FIRMADO')


def _nombre(emp):
    return ' '.join(p for p in (emp.nombres, emp.apellido_paterno) if p).strip().title()


def vigente(empresa, hoy=None):
    """Reglamento en uso: la última versión activa (aunque aún no rija, ya se dio a conocer)."""
    return ReglamentoInterno.objects.filter(empresa=empresa, activo=True).order_by('-version').first()


def dato_reglamento(r, hoy):
    vence = r.vigente_desde + datetime.timedelta(days=DIAS_REMISION)
    return {
        'id': r.id, 'tipo': r.tipo, 'tipo_texto': r.get_tipo_display(), 'version': r.version,
        'publicado_en': r.publicado_en.isoformat(), 'vigente_desde': r.vigente_desde.isoformat(),
        'rige': r.vigente_desde <= hoy, 'plazo_remision': vence.isoformat(),
        'remitido_dt_en': r.remitido_dt_en.isoformat() if r.remitido_dt_en else None,
        'remitido_salud_en': r.remitido_salud_en.isoformat() if r.remitido_salud_en else None,
        'revisar': r.publicado_en + datetime.timedelta(days=365) < hoy, 'activo': r.activo,
    }


def _estado_constancia(doc):
    if doc is None:
        return None
    firma = doc.solicitudes_firma.exclude(estado='CANCELADO').order_by('-enviado_en').first()
    return firma.estado if firma else 'SIN_ENVIAR'


def entrega(reglamento):
    """Quién recibió (firmó) la versión vigente y quién no."""
    if reglamento is None:
        return {'total': 0, 'firmados': 0, 'trabajadores': []}
    SolicitudFirma.actualizar_estados(SolicitudFirma.objects.filter(documento_laboral__reglamento=reglamento))
    docs = {d.empleado_id: d for d in DocumentoLaboral.objects.filter(reglamento=reglamento, activo=True)
            .order_by('id')}
    filas = []
    for emp in Empleado.objects.filter(empresa=reglamento.empresa, activo=True).order_by('apellido_paterno', 'nombres'):
        filas.append({'id': emp.id, 'nombre': _nombre(emp), 'correo': bool(emp.email),
                      'estado': _estado_constancia(docs.get(emp.id))})
    return {'total': len(filas), 'firmados': sum(1 for f in filas if f['estado'] == 'FIRMADO'), 'trabajadores': filas}


def avisos_reglamento(empresa, hoy, trabajadores, actual):
    avisos = []
    if trabajadores >= UMBRAL_RIOHS and (actual is None or actual.tipo != 'RIOHS'):
        avisos.append(f'Con {trabajadores} trabajadores, la empresa debe tener un Reglamento Interno de Orden, '
                      'Higiene y Seguridad (Art. 153 del Código del Trabajo).')
    elif actual is None:
        avisos.append('Toda empresa debe tener un reglamento de higiene y seguridad que incluya el protocolo de '
                      'prevención del acoso (Art. 67 de la Ley 16.744 y Ley Karin).')
    if actual:
        d = dato_reglamento(actual, hoy)
        if d['rige'] and hoy > datetime.date.fromisoformat(d['plazo_remision']) and not (
                actual.remitido_dt_en and actual.remitido_salud_en):
            avisos.append('Venció el plazo para enviar el reglamento a la Dirección del Trabajo y a la Seremi de '
                          'Salud (5 días desde que rige, Art. 153).')
        if d['revisar']:
            avisos.append('El reglamento tiene más de un año: revíselo y, si cambia, publique una versión nueva.')
    return avisos


def anexar_reglamento(pdf_constancia, reglamento):
    """Constancia + todas las páginas del reglamento, en un solo PDF."""
    from pypdf import PdfReader, PdfWriter
    writer = PdfWriter()
    for pagina in PdfReader(io.BytesIO(pdf_constancia)).pages:
        writer.add_page(pagina)
    try:
        with reglamento.archivo.open('rb') as f:
            for pagina in PdfReader(io.BytesIO(f.read())).pages:
                writer.add_page(pagina)
    except Exception:
        logger.exception('No se pudo adjuntar el reglamento %s a la constancia', reglamento.id)
        raise
    salida = io.BytesIO()
    writer.write(salida)
    return salida.getvalue()


def clausulas_constancia(reglamento):
    empresa = reglamento.empresa
    return [
        f'El trabajador declara haber recibido gratuitamente un ejemplar del {reglamento.get_tipo_display()} de '
        f'{empresa.nombre_legal}, versión {reglamento.version}, dado a conocer el {reglamento.publicado_en:%d-%m-%Y} '
        f'y que rige desde el {reglamento.vigente_desde:%d-%m-%Y}, cuyo texto completo se adjunta a esta constancia '
        '(artículo 156 del Código del Trabajo y artículo 56 del DS 44 de 2023).',
        'El reglamento incluye el protocolo de prevención del acoso sexual, laboral y la violencia en el trabajo, '
        'y el procedimiento de investigación y sanción (Ley 21.643).',
        'El trabajador se compromete a conocer y cumplir sus disposiciones, y puede plantear sus observaciones o '
        'impugnarlo ante la Inspección del Trabajo o la autoridad sanitaria (artículo 153).',
    ]


class ReglamentoViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def _empresa(self, request, empresa_id):
        return Empresa.objects.filter(pk=empresa_id or 0, owner=request.user).first()

    def _reglamento(self, request, pk):
        return ReglamentoInterno.objects.filter(pk=pk, empresa__owner=request.user).select_related('empresa').first()

    def list(self, request):
        empresa = self._empresa(request, request.query_params.get('empresa'))
        if empresa is None:
            return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        hoy = timezone.localdate()
        trabajadores = Empleado.objects.filter(empresa=empresa, activo=True).count()
        actual = vigente(empresa)
        return Response({
            'permitido': _plan_permite(request.user, NIVEL_REGLAMENTO),
            'trabajadores': trabajadores,
            'tipo_sugerido': tipo_segun_dotacion(trabajadores),
            'rubros': [{'valor': v, 'texto': t} for v, t in OPCIONES_RUBRO],
            'actual': dato_reglamento(actual, hoy) if actual else None,
            'versiones': [dato_reglamento(r, hoy) for r in ReglamentoInterno.objects.filter(empresa=empresa)],
            'entrega': entrega(actual),
            'avisos': avisos_reglamento(empresa, hoy, trabajadores, actual),
        })

    @action(detail=False, methods=['get'])
    def plantilla(self, request):
        """Plantilla guía del rubro, en Word (para editar) o PDF (para leer)."""
        if not _plan_permite(request.user, NIVEL_REGLAMENTO):
            return Response({'error': 'Disponible desde el plan Pyme.'}, status=status.HTTP_403_FORBIDDEN)
        empresa = self._empresa(request, request.query_params.get('empresa'))
        rubro = request.query_params.get('rubro')
        if empresa is None or rubro not in RUBROS:
            return Response({'error': 'Elija la empresa y el rubro.'}, status=status.HTTP_400_BAD_REQUEST)
        tipo = tipo_segun_dotacion(Empleado.objects.filter(empresa=empresa, activo=True).count())
        contenido = bloques(empresa, rubro, tipo, empresa.get_mutual_display() if empresa.mutual != '00'
                            else 'el Instituto de Seguridad Laboral (ISL)')
        nombre = f'Plantilla_{tipo}_{rubro.title()}'
        if request.query_params.get('formato') == 'pdf':
            html = render_to_string('reglamento_plantilla.html', {'cuerpo': a_html(contenido)})
            return respuesta_pdf(_html_a_pdf_bytes(html, nombre), f'{nombre}.pdf')
        respuesta = HttpResponse(construir_docx(contenido), content_type=(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
        respuesta['Content-Disposition'] = f'attachment; filename="{nombre}.docx"'
        return respuesta

    def create(self, request):
        """Sube el reglamento final (PDF) como una versión nueva."""
        if not _plan_permite(request.user, NIVEL_REGLAMENTO):
            return Response({'error': 'Disponible desde el plan Pyme.'}, status=status.HTTP_403_FORBIDDEN)
        empresa = self._empresa(request, request.data.get('empresa'))
        if empresa is None:
            return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        tipo = request.data.get('tipo')
        if tipo not in dict(ReglamentoInterno.TIPOS):
            return Response({'error': 'Elija el tipo de reglamento.'}, status=status.HTTP_400_BAD_REQUEST)
        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response({'error': 'Adjunte el reglamento en PDF.'}, status=status.HTTP_400_BAD_REQUEST)
        if archivo.size > MAX_MB * 1024 * 1024:
            return Response({'error': f'El archivo supera los {MAX_MB} MB.'}, status=status.HTTP_400_BAD_REQUEST)
        cabeza = archivo.read(5)
        archivo.seek(0)
        if cabeza != b'%PDF-':
            return Response({'error': 'El archivo debe ser un PDF.'}, status=status.HTTP_400_BAD_REQUEST)
        # Se adjunta a cada constancia de recepción: tiene que poder leerse.
        try:
            from pypdf import PdfReader
            legible = len(PdfReader(io.BytesIO(archivo.read())).pages) > 0
        except Exception:
            legible = False
        archivo.seek(0)
        if not legible:
            return Response({'error': 'No pudimos leer el PDF. Guárdelo de nuevo como PDF (por ejemplo, con '
                                      '«Guardar como PDF» en Word) y vuelva a subirlo.'},
                            status=status.HTTP_400_BAD_REQUEST)
        hoy = timezone.localdate()
        try:
            publicado = datetime.date.fromisoformat(str(request.data.get('publicado_en') or hoy.isoformat()))
        except ValueError:
            return Response({'error': 'La fecha no es válida.'}, status=status.HTTP_400_BAD_REQUEST)
        if publicado > hoy:
            return Response({'error': 'La fecha en que lo dio a conocer no puede ser futura.'},
                            status=status.HTTP_400_BAD_REQUEST)
        ultima = ReglamentoInterno.objects.filter(empresa=empresa).order_by('-version').first()
        nuevo = ReglamentoInterno.objects.create(
            empresa=empresa, tipo=tipo, version=(ultima.version + 1) if ultima else 1, archivo=archivo,
            publicado_en=publicado, vigente_desde=publicado + datetime.timedelta(days=DIAS_ANTICIPACION))
        ReglamentoInterno.objects.filter(empresa=empresa, activo=True).exclude(pk=nuevo.pk).update(activo=False)
        return Response(dato_reglamento(nuevo, hoy), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        r = self._reglamento(request, pk)
        if r is None:
            return Response({'error': 'Reglamento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        with r.archivo.open('rb') as f:
            return respuesta_pdf(f.read(), f'Reglamento_v{r.version}.pdf')

    @action(detail=True, methods=['post'])
    def remision(self, request, pk=None):
        """Registra (o borra) que se envió a la DT o a la Seremi de Salud."""
        r = self._reglamento(request, pk)
        if r is None:
            return Response({'error': 'Reglamento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        destino = request.data.get('destino')
        campo = {'DT': 'remitido_dt_en', 'SALUD': 'remitido_salud_en'}.get(destino)
        if not campo:
            return Response({'error': 'Destino inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        fecha = None
        if not request.data.get('deshacer'):
            try:
                fecha = datetime.date.fromisoformat(str(request.data.get('fecha') or timezone.localdate().isoformat()))
            except ValueError:
                return Response({'error': 'La fecha no es válida.'}, status=status.HTTP_400_BAD_REQUEST)
            if fecha > timezone.localdate():
                return Response({'error': 'La fecha no puede ser futura.'}, status=status.HTTP_400_BAD_REQUEST)
        setattr(r, campo, fecha)
        r.save(update_fields=[campo])
        return Response(dato_reglamento(r, timezone.localdate()))

    @action(detail=True, methods=['post'])
    def entregar(self, request, pk=None):
        """Envía la constancia de recepción (con el reglamento adjunto) a firma de
        los trabajadores activos que aún no la tienen firmada ni en curso."""
        from .firmas import SolicitudFirmaViewSet, _ErrorFirma, confirmacion_vigente, datos_emisor, \
            falta_confirmacion
        r = self._reglamento(request, pk)
        if r is None or not r.activo:
            return Response({'error': 'Reglamento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if not _plan_permite(request.user, NIVEL_REGLAMENTO):
            return Response({'error': 'Disponible desde el plan Pyme.'}, status=status.HTTP_403_FORBIDDEN)
        confirmado_en = confirmacion_vigente(request)
        if confirmado_en is None:
            return falta_confirmacion()
        elegidos = {int(i) for i in (request.data.get('empleados') or [])}
        vista = SolicitudFirmaViewSet()
        enviadas, omitidas = 0, []
        hoy = timezone.localdate()
        for fila in entrega(r)['trabajadores']:
            if (elegidos and fila['id'] not in elegidos) or fila['estado'] in ('FIRMADO', 'PENDIENTE', 'PROCESANDO'):
                continue
            emp = Empleado.objects.get(pk=fila['id'])
            if not emp.email:
                omitidas.append({'nombre': fila['nombre'], 'motivo': 'No tiene correo registrado.'})
                continue
            doc = DocumentoLaboral.objects.filter(empleado=emp, reglamento=r, activo=True).first()
            if doc is None or fila['estado'] in ('RECHAZADO', 'EXPIRADO'):
                if doc is not None:
                    doc.activo = False
                    doc.save(update_fields=['activo'])
                doc = DocumentoLaboral.objects.create(
                    empleado=emp, tipo='REGLAMENTO', reglamento=r, fecha_emision=hoy, vigente_desde=r.vigente_desde,
                    datos={'clausulas': clausulas_constancia(r),
                           'resumen': f'{r.get_tipo_display()} · versión {r.version}'})
            try:
                vista._crear_solicitud(request.user, emp, 'REGLAMENTO', documento_laboral_id=doc.id,
                                       emision=datos_emisor(request, confirmado_en))
                enviadas += 1
            except _ErrorFirma as e:
                omitidas.append({'nombre': fila['nombre'], 'motivo': e.mensaje})
        return Response({'enviadas': enviadas, 'omitidas': omitidas})
