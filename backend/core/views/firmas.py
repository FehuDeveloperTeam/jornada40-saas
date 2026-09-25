"""Firma electrónica: solicitudes del empleador."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import viewsets
from django.template.loader import render_to_string
from django.db.models import Exists, OuterRef
from django.utils import timezone
from ..models import AnexoContrato, Contrato, DocumentoLegal, Empleado, Empresa, Finiquito, Liquidacion, SolicitudFirma, VacacionEmpleado
from django.conf import settings
from num2words import num2words
from ..serializers import SolicitudFirmaSerializer
from .. import b2_client
from django.core.mail import EmailMultiAlternatives
import uuid as uuid_mod

from .documentos import pdf_anexo_contrato, pdf_documento_legal
from .finiquitos import pdf_finiquito
from .vacaciones import pdf_vacacion
from .base import _ctx_contrato, _es_plan_semilla, _html_a_pdf_bytes, logger


# ==========================================
# FIRMA ELECTRÓNICA
# ==========================================

class _ErrorFirma(Exception):
    def __init__(self, mensaje, estado=400):
        super().__init__(mensaje)
        self.mensaje, self.estado = mensaje, estado


class SolicitudFirmaViewSet(viewsets.GenericViewSet):
    serializer_class = SolicitudFirmaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SolicitudFirma.objects.filter(
            empresa__owner=self.request.user
        ).select_related('empleado', 'empresa')

    def list(self, request):
        empleado_id = request.query_params.get('empleado_id')
        qs = self.get_queryset()
        if empleado_id:
            qs = qs.filter(empleado_id=empleado_id)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=['post'])
    def solicitar(self, request):
        empleado_id   = request.data.get('empleado_id')
        tipo_doc      = request.data.get('tipo_documento')
        contrato_id   = request.data.get('contrato_id')
        doc_legal_id  = request.data.get('documento_legal_id')
        anexo_id      = request.data.get('anexo_contrato_id')
        liquidacion_id = request.data.get('liquidacion_id')
        vacacion_id    = request.data.get('vacacion_id')
        finiquito_id   = request.data.get('finiquito_id')

        tipos_validos = [t[0] for t in SolicitudFirma.TIPOS_DOCUMENTO]
        if tipo_doc not in tipos_validos:
            return Response({'error': 'Tipo de documento inválido.'}, status=400)

        try:
            empleado = Empleado.objects.get(id=empleado_id, empresa__owner=request.user)
        except Empleado.DoesNotExist:
            return Response({'error': 'Trabajador no encontrado.'}, status=404)

        try:
            solicitud = self._crear_solicitud(request.user, empleado, tipo_doc, contrato_id, doc_legal_id, anexo_id,
                                              liquidacion_id, vacacion_id, finiquito_id)
        except _ErrorFirma as e:
            return Response({'error': e.mensaje}, status=e.estado)
        return Response(SolicitudFirmaSerializer(solicitud).data, status=201)

    @action(detail=False, methods=['post'], url_path='solicitar_liquidaciones')
    def solicitar_liquidaciones(self, request):
        """Envía a firma todas las liquidaciones de una empresa y período que
        aún no tienen una firma pendiente, en proceso o completa.

        No se detiene por un trabajador sin correo: lo informa y sigue.
        """
        try:
            mes = int(request.data.get('mes'))
            anio = int(request.data.get('anio'))
            empresa = Empresa.objects.get(id=request.data.get('empresa'), owner=request.user)
        except (TypeError, ValueError, Empresa.DoesNotExist):
            return Response({'error': 'Indica una empresa y un período válidos.'}, status=400)
        if not empresa.firma_imagen:
            return Response({'error': 'Configura la firma del empleador (Firma electrónica) antes de enviar documentos a firma.'},
                            status=400)
        vigentes = SolicitudFirma.objects.filter(liquidacion=OuterRef('pk'),
                                                 estado__in=['PENDIENTE', 'PROCESANDO', 'FIRMADO'])
        liquidaciones = (Liquidacion.objects.filter(empleado__empresa=empresa, mes=mes, anio=anio)
                         .annotate(con_firma=Exists(vigentes)).filter(con_firma=False)
                         .select_related('empleado').order_by('empleado__apellido_paterno'))
        enviadas, omitidas = 0, []
        for liq in liquidaciones:
            emp = liq.empleado
            try:
                self._crear_solicitud(request.user, emp, 'LIQUIDACION', liquidacion_id=liq.id)
                enviadas += 1
            except _ErrorFirma as e:
                omitidas.append({'empleado': emp.id, 'nombre': f'{emp.nombres} {emp.apellido_paterno}'.strip(),
                                 'motivo': e.mensaje})
        return Response({'enviadas': enviadas, 'omitidas': omitidas})

    def _crear_solicitud(self, user, empleado, tipo_doc, contrato_id=None, doc_legal_id=None, anexo_id=None,
                         liquidacion_id=None, vacacion_id=None, finiquito_id=None):
        """Genera el PDF, lo sube, crea la solicitud y avisa al trabajador. Lanza _ErrorFirma."""
        empresa = empleado.empresa
        if not empresa.firma_imagen:
            raise _ErrorFirma('La empresa no tiene firma del empleador configurada. Configúrala en Firma electrónica.')
        email_trabajador = empleado.email
        if not email_trabajador:
            raise _ErrorFirma('El trabajador no tiene correo registrado. Agrégalo en sus datos antes de enviar a firma.')

        try:
            pdf_bytes, contrato_obj, doc_legal_obj, liquidacion_obj, vacacion_obj, finiquito_obj = self._generar_pdf_firma(
                empleado, empresa, tipo_doc,
                contrato_id, doc_legal_id, anexo_id,
                liquidacion_id, vacacion_id, finiquito_id, _es_plan_semilla(user)
            )
        except Exception as e:
            raise _ErrorFirma(str(e))

        key = b2_client.key_pendiente(empresa.id, str(uuid_mod.uuid4()))
        try:
            b2_client.subir_documento(pdf_bytes, key)
        except RuntimeError as e:
            raise _ErrorFirma(str(e), 503)
        except Exception:
            raise _ErrorFirma('Error al subir el documento al almacenamiento.', 500)

        # El anexo se enlaza explícitamente porque al firmarse aplica sus
        # cambios al contrato, y hay que saber cuál fue.
        anexo_obj = None
        if tipo_doc == 'ANEXO_CONTRATO' and anexo_id:
            anexo_obj = AnexoContrato.objects.filter(id=anexo_id, contrato__empleado=empleado).first()

        try:
            solicitud = SolicitudFirma.objects.create(
                empleado=empleado, empresa=empresa, tipo_documento=tipo_doc,
                contrato=contrato_obj, documento_legal=doc_legal_obj, anexo_contrato=anexo_obj,
                liquidacion=liquidacion_obj, vacacion=vacacion_obj, finiquito=finiquito_obj,
                email_firmante=email_trabajador, b2_key_temporal=key,
            )
        except Exception as e:
            b2_client.eliminar_documento(key)
            raise _ErrorFirma(f'Error al registrar la solicitud: {e}', 500)

        try:
            self._enviar_email_firma(solicitud, empleado, empresa)
        except Exception:
            logger.exception('No se pudo enviar el correo de firma de la solicitud %s', solicitud.pk)
        return solicitud

    @action(detail=True, methods=['patch'])
    def cancelar(self, request, pk=None):
        solicitud = self.get_object()
        if solicitud.estado != 'PENDIENTE':
            return Response({'error': 'Solo se puede cancelar una solicitud pendiente.'}, status=400)
        solicitud.estado = 'CANCELADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response(SolicitudFirmaSerializer(solicitud).data)

    @action(detail=True, methods=['post'])
    def reenviar(self, request, pk=None):
        solicitud = self.get_object()
        if solicitud.estado != 'PENDIENTE':
            return Response({'error': 'Solo se puede reenviar una solicitud pendiente.'}, status=400)
        try:
            self._enviar_email_firma(solicitud, solicitud.empleado, solicitud.empresa)
        except Exception as e:
            return Response({'error': f'Error al reenviar el email: {str(e)}'}, status=500)
        return Response({'mensaje': 'Email de firma reenviado correctamente.'})

    @action(detail=True, methods=['post'])
    def descargar(self, request, pk=None):
        """Genera una URL presignada de corta duración para descargar el PDF firmado."""
        solicitud = self.get_object()
        if solicitud.estado != 'FIRMADO' or not solicitud.b2_key_firmado:
            return Response({'error': 'No hay PDF firmado disponible para esta solicitud.'}, status=400)
        try:
            url = b2_client.generar_url_presignada(solicitud.b2_key_firmado, ttl_segundos=300)
        except RuntimeError as exc:
            return Response({'error': str(exc)}, status=503)
        except Exception:
            return Response({'error': 'Error al generar el enlace de descarga.'}, status=500)
        return Response({'url': url})

    # -------------------------------------------------
    # Helpers internos
    # -------------------------------------------------

    MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
             "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

    def _generar_pdf_firma(self, empleado, empresa, tipo_doc,
                           contrato_id, doc_legal_id, anexo_id,
                           liquidacion_id, vacacion_id, finiquito_id, es_plan_semilla):
        """Genera el PDF a firmar y retorna (pdf_bytes, contrato, doc_legal, liquidacion, vacacion, finiquito)."""

        if tipo_doc == 'CONTRATO':
            try:
                contrato = (Contrato.objects.get(id=contrato_id)
                            if contrato_id else Contrato.objects.get(empleado=empleado))
            except Contrato.DoesNotExist:
                raise Exception('El trabajador no tiene contrato registrado.')
            ctx = _ctx_contrato(contrato, es_plan_semilla)
            html = render_to_string('contrato_trabajo.html', ctx)
            return _html_a_pdf_bytes(html, f'Contrato_{empleado.rut}'), contrato, None, None, None, None

        if tipo_doc == 'ANEXO_40H':
            try:
                contrato = (Contrato.objects.get(id=contrato_id)
                            if contrato_id else Contrato.objects.get(empleado=empleado))
            except Contrato.DoesNotExist:
                raise Exception('El trabajador no tiene contrato registrado.')
            ctx = _ctx_contrato(contrato, es_plan_semilla)
            html = render_to_string('anexo_40h.html', ctx)
            return _html_a_pdf_bytes(html, f'Anexo40h_{empleado.rut}'), contrato, None, None, None, None

        if tipo_doc in ('AMONESTACION', 'CONSTANCIA'):
            if doc_legal_id:
                try:
                    doc = DocumentoLegal.objects.get(id=doc_legal_id, empleado=empleado)
                except DocumentoLegal.DoesNotExist:
                    raise Exception('Documento legal no encontrado.')
            else:
                doc = DocumentoLegal.objects.filter(
                    empleado=empleado, tipo=tipo_doc
                ).order_by('-fecha_emision').first()
                if not doc:
                    raise Exception(f'No se encontró documento de tipo {tipo_doc}.')
            return pdf_documento_legal(doc, es_plan_semilla), None, doc, None, None, None

        if tipo_doc == 'DESPIDO':
            if doc_legal_id:
                try:
                    doc = DocumentoLegal.objects.get(id=doc_legal_id, empleado=empleado)
                except DocumentoLegal.DoesNotExist:
                    raise Exception('Documento legal no encontrado.')
            else:
                doc = DocumentoLegal.objects.filter(
                    empleado=empleado, tipo='DESPIDO'
                ).order_by('-fecha_emision').first()
                if not doc:
                    raise Exception('No se encontró carta de despido.')
            pdf_bytes = pdf_documento_legal(doc, es_plan_semilla)
            return pdf_bytes, None, doc, None, None, None

        if tipo_doc == 'ANEXO_CONTRATO':
            if not anexo_id:
                raise Exception('Se requiere el ID del anexo de contrato.')
            try:
                contrato = Contrato.objects.get(empleado=empleado)
                anexo = AnexoContrato.objects.get(id=anexo_id, contrato=contrato)
            except (Contrato.DoesNotExist, AnexoContrato.DoesNotExist):
                raise Exception('Anexo de contrato no encontrado.')
            return pdf_anexo_contrato(anexo, es_plan_semilla), contrato, None, None, None, None

        if tipo_doc == 'LIQUIDACION':
            if not liquidacion_id:
                raise Exception('Se requiere el ID de la liquidación.')
            try:
                liq = Liquidacion.objects.get(id=liquidacion_id, empleado=empleado)
            except Liquidacion.DoesNotExist:
                raise Exception('Liquidación no encontrada.')
            contrato_liq = Contrato.objects.filter(empleado=empleado).first()
            meses = self.MESES
            mes_nombre = meses[liq.mes - 1]
            sueldo_seguro = int(liq.sueldo_liquido or 0)
            liquido_palabras = num2words(sueldo_seguro, lang='es')
            agrupados = liq.items_agrupados
            det_no_imp = agrupados['no_imponibles']
            suma_no_imponibles = sum(int(i.get('valor', 0)) for i in det_no_imp if isinstance(i, dict))
            det_otros = agrupados['descuentos']
            suma_otros_descuentos = sum(int(i.get('valor', 0)) for i in det_otros if isinstance(i, dict))
            total_ley = ((liq.afp_monto or 0) + (liq.salud_monto or 0) +
                         (liq.seguro_cesantia or 0) + (liq.impuesto_unico or 0))
            total_otros_dsctos = (liq.anticipo_quincena or 0) + suma_otros_descuentos
            ctx = {
                'liquidacion': liq, 'empleado': empleado, 'empresa': empresa,
                'contrato': contrato_liq,
                'mes_nombre': mes_nombre.upper(),
                'liquido_palabras': liquido_palabras,
                'total_no_imponible': suma_no_imponibles,
                'total_ley': total_ley,
                'total_otros_dsctos': total_otros_dsctos,
                'es_plan_semilla': es_plan_semilla,
            }
            html = render_to_string('liquidacion.html', ctx)
            return _html_a_pdf_bytes(html, f'Liquidacion_{liq.mes}_{liq.anio}_{empleado.rut}'), None, None, liq, None, None

        if tipo_doc == 'VACACION':
            if not vacacion_id:
                raise Exception('Se requiere el ID del comprobante de vacaciones.')
            try:
                vac = VacacionEmpleado.objects.get(id=vacacion_id, empleado=empleado)
            except VacacionEmpleado.DoesNotExist:
                raise Exception('Comprobante de vacaciones no encontrado.')
            # La misma plantilla y fecha que la descarga del comprobante.
            return pdf_vacacion(vac, es_plan_semilla), None, None, None, vac, None

        if tipo_doc == 'FINIQUITO':
            if not finiquito_id:
                raise Exception('Se requiere el ID del finiquito.')
            try:
                fin = Finiquito.objects.get(id=finiquito_id, empleado=empleado)
            except Finiquito.DoesNotExist:
                raise Exception('Finiquito no encontrado.')

            # La misma plantilla que la descarga (antes había una copia que ya difería).
            return pdf_finiquito(fin), None, None, None, None, fin

        raise Exception(f'Tipo de documento no soportado: {tipo_doc}')

    def _enviar_email_firma(self, solicitud, empleado, empresa):
        tipo_labels = {
            'CONTRATO':       'Contrato Laboral',
            'ANEXO_40H':      'Anexo Ley 40 Horas',
            'AMONESTACION':   'Carta de Amonestación',
            'DESPIDO':        'Carta de Despido',
            'CONSTANCIA':     'Constancia Laboral',
            'ANEXO_CONTRATO': 'Anexo de Contrato',
            'LIQUIDACION':    'Liquidación de Sueldo',
            'VACACION':       'Comprobante de Vacaciones',
            'FINIQUITO':      'Finiquito de Término',
        }
        tipo_label       = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento)
        firma_url        = f"https://jornada40.cl/firma/{solicitud.token}"
        nombre_trabajador = f"{empleado.nombres} {empleado.apellido_paterno}"
        expira_fecha     = timezone.localtime(solicitud.expira_en).strftime('%d/%m/%Y')

        texto_plano = (
            f"Hola {nombre_trabajador},\n\n"
            f"{empresa.nombre_legal} requiere tu firma en: {tipo_label}.\n\n"
            f"Para firmar ingresa al siguiente enlace (válido hasta el {expira_fecha}):\n"
            f"{firma_url}\n\n"
            f"Si no reconoces esta solicitud, ignora este mensaje.\n\n"
            f"Jornada40 — Sistema de Gestión Laboral"
        )
        html_body = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Firma Electrónica Requerida</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa.nombre_legal}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hola <strong>{nombre_trabajador}</strong>,</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Tu empleador requiere tu firma electrónica en el siguiente documento:
      </p>
      <div style="background:#f0f4ff;border-left:4px solid #2563eb;padding:16px 20px;border-radius:6px;margin-bottom:28px;">
        <p style="margin:0;font-weight:700;color:#1e3a6e;font-size:15px;">{tipo_label}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Válido para firmar hasta el {expira_fecha}</p>
      </div>
      <a href="{firma_url}"
         style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Revisar y Firmar Documento
      </a>
      <p style="color:#9ca3af;font-size:12px;margin:28px 0 0;line-height:1.6;">
        Si el botón no funciona, copia este enlace:<br>
        <a href="{firma_url}" style="color:#2563eb;word-break:break-all;">{firma_url}</a>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Mensaje enviado a trabajador de <strong>{empresa.nombre_legal}</strong>.
        Firma Electrónica Simple válida bajo Ley 19.799 (Chile).
      </p>
    </div>
  </div>
</body>
</html>"""
        msg = EmailMultiAlternatives(
            subject=f"Firma requerida: {tipo_label} — {empresa.nombre_legal}",
            body=texto_plano,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[solicitud.email_firmante],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send()
