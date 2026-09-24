"""Firma electrónica: solicitudes del empleador."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import viewsets
from django.template.loader import render_to_string
from ..models import Empleado, Contrato, AnexoContrato, DocumentoLegal, Liquidacion, SolicitudFirma, VacacionEmpleado, Finiquito
from django.conf import settings
import datetime
import math
from num2words import num2words
from html import escape as _esc
from ..serializers import SolicitudFirmaSerializer
from .. import b2_client
from django.core.mail import EmailMultiAlternatives
import uuid as uuid_mod

from .base import _MESES, _ctx_contrato, _es_plan_semilla, _html_a_pdf_bytes


# ==========================================
# FIRMA ELECTRÓNICA
# ==========================================

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

        empresa = empleado.empresa

        if not empresa.firma_imagen:
            return Response(
                {'error': 'La empresa no tiene firma del empleador configurada. Configúrela en el Lobby de Empresas.'},
                status=400
            )

        email_trabajador = empleado.email
        if not email_trabajador:
            return Response(
                {'error': 'El trabajador no tiene email registrado. Agréguelo en Datos Generales antes de enviar a firma.'},
                status=400
            )

        es_plan_semilla = _es_plan_semilla(request.user)

        try:
            pdf_bytes, contrato_obj, doc_legal_obj, liquidacion_obj, vacacion_obj, finiquito_obj = self._generar_pdf_firma(
                empleado, empresa, tipo_doc,
                contrato_id, doc_legal_id, anexo_id,
                liquidacion_id, vacacion_id, finiquito_id, es_plan_semilla
            )
        except Exception as e:
            return Response({'error': str(e)}, status=400)

        key = b2_client.key_pendiente(empresa.id, str(uuid_mod.uuid4()))
        try:
            b2_client.subir_documento(pdf_bytes, key)
        except RuntimeError as e:
            return Response({'error': str(e)}, status=503)
        except Exception:
            return Response({'error': 'Error al subir el documento al almacenamiento.'}, status=500)

        # El anexo se enlaza explícitamente porque al firmarse aplica sus
        # cambios al contrato, y hay que saber cuál fue.
        anexo_obj = None
        if tipo_doc == 'ANEXO_CONTRATO' and anexo_id:
            anexo_obj = AnexoContrato.objects.filter(
                id=anexo_id, contrato__empleado=empleado
            ).first()

        try:
            solicitud = SolicitudFirma.objects.create(
                empleado=empleado,
                empresa=empresa,
                tipo_documento=tipo_doc,
                contrato=contrato_obj,
                documento_legal=doc_legal_obj,
                anexo_contrato=anexo_obj,
                liquidacion=liquidacion_obj,
                vacacion=vacacion_obj,
                finiquito=finiquito_obj,
                email_firmante=email_trabajador,
                b2_key_temporal=key,
            )
        except Exception as e:
            b2_client.eliminar_documento(key)
            return Response({'error': f'Error al registrar la solicitud: {e}'}, status=500)

        try:
            self._enviar_email_firma(solicitud, empleado, empresa)
        except Exception:
            pass

        return Response(SolicitudFirmaSerializer(solicitud).data, status=201)

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
        ciudad = str(
            getattr(empresa, 'ciudad', '') or getattr(empresa, 'comuna', '') or 'Santiago'
        ).strip().title()

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
            hoy = doc.fecha_emision
            fecha_es = f"{hoy.day:02d} de {self.MESES[hoy.month - 1]} de {hoy.year}"
            ctx = {'documento': doc, 'empleado': empleado, 'empresa': empresa,
                   'fecha_actual': fecha_es, 'ciudad': ciudad,
                   'es_plan_semilla': es_plan_semilla}
            html = render_to_string('documento_legal.html', ctx)
            return _html_a_pdf_bytes(html, f'{doc.tipo}_{empleado.rut}'), None, doc, None, None, None

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
            pdf_bytes = self._pdf_para_documento_legal(doc, es_plan_semilla)
            return pdf_bytes, None, doc, None, None, None

        if tipo_doc == 'ANEXO_CONTRATO':
            if not anexo_id:
                raise Exception('Se requiere el ID del anexo de contrato.')
            try:
                contrato = Contrato.objects.get(empleado=empleado)
                anexo = AnexoContrato.objects.get(id=anexo_id, contrato=contrato)
            except (Contrato.DoesNotExist, AnexoContrato.DoesNotExist):
                raise Exception('Anexo de contrato no encontrado.')
            hoy = anexo.fecha_emision
            fecha_es = f"{hoy.day:02d} de {self.MESES[hoy.month - 1]} de {hoy.year}"
            ctx = {'anexo': anexo, 'contrato': contrato, 'empleado': empleado,
                   'empresa': empresa, 'fecha_actual': fecha_es, 'ciudad': ciudad,
                   'es_plan_semilla': es_plan_semilla}
            html = render_to_string('anexo_contrato.html', ctx)
            return _html_a_pdf_bytes(html, f'AnexoContrato_{empleado.rut}'), contrato, None, None, None, None

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
            hoy = datetime.date.today()
            fecha_hoy = f"{hoy.day:02d} de {self.MESES[hoy.month - 1]} de {hoy.year}"
            def _fmt(f):
                return f"{f.day:02d} de {self.MESES[f.month - 1]} de {f.year}" if f else '—'
            ctx = {
                'vacacion': vac, 'empleado': empleado, 'empresa': empresa,
                'fecha_actual': fecha_hoy,
                'fecha_inicio_texto': _fmt(vac.fecha_inicio),
                'fecha_fin_texto': _fmt(vac.fecha_fin),
                'ciudad': ciudad,
                'es_plan_semilla': es_plan_semilla,
            }
            html = render_to_string('comprobante_vacaciones.html', ctx)
            return _html_a_pdf_bytes(html, f'Vacacion_{empleado.rut}'), None, None, None, vac, None

        if tipo_doc == 'FINIQUITO':
            if not finiquito_id:
                raise Exception('Se requiere el ID del finiquito.')
            try:
                fin = Finiquito.objects.get(id=finiquito_id, empleado=empleado)
            except Finiquito.DoesNotExist:
                raise Exception('Finiquito no encontrado.')

            def _fmt_fin(f):
                if not f:
                    return '—'
                return f"{f.day:02d} de {_MESES[f.month - 1]} de {f.year}"

            ciudad_fin = (getattr(empresa, 'ciudad', '') or getattr(empresa, 'comuna', '') or 'Santiago').strip().title()
            causal_label = fin.get_causal_articulo_display() if fin.causal_articulo else '—'
            sueldo_prop = math.floor((fin.sueldo_base / 30) * fin.dias_trabajados_ultimo_mes)
            _f_ciudad     = _esc(ciudad_fin)
            _f_causal     = _esc(causal_label)
            _f_nom_legal  = _esc(empresa.nombre_legal or '')
            _f_rut_emp    = _esc(empresa.rut or '')
            _f_trab_nomb  = _esc(f"{empleado.nombres} {empleado.apellido_paterno} {empleado.apellido_materno or ''}")
            _f_trab_firma = _esc(f"{empleado.nombres} {empleado.apellido_paterno}")
            _f_rut_trab   = _esc(empleado.rut or '')
            _f_cargo      = _esc(empleado.cargo or '—')
            _f_depto      = _esc(empleado.departamento or '—')
            _f_modalidad  = _esc(fin.get_modalidad_display())
            html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  @page {{ size: letter; margin: 2cm 2.5cm; }}
  body {{ font-family: Arial, sans-serif; font-size: 10pt; color: #111; line-height: 1.5; }}
  h1 {{ font-size: 14pt; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }}
  h2 {{ font-size: 10pt; text-align: center; color: #555; margin-top: 0; margin-bottom: 20px; }}
  .seccion {{ margin-bottom: 16px; }}
  .seccion-titulo {{ font-size: 9pt; font-weight: bold; text-transform: uppercase;
                     letter-spacing: 1px; color: #555; border-bottom: 1px solid #ccc;
                     padding-bottom: 3px; margin-bottom: 8px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 10pt; }}
  table td {{ padding: 4px 6px; vertical-align: top; }}
  table td:last-child {{ text-align: right; font-weight: bold; }}
  .total-row td {{ border-top: 2px solid #333; font-weight: bold; font-size: 11pt; padding-top: 8px; }}
  .firma-bloque {{ margin-top: 60px; display: flex; justify-content: space-between; }}
  .firma-item {{ text-align: center; width: 44%; }}
  .firma-linea {{ border-top: 1px solid #333; padding-top: 6px; margin-top: 50px; font-size: 9pt; }}
  p {{ margin: 4px 0; }}
  .aviso {{ font-size: 8pt; color: #666; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; }}
</style>
</head>
<body>
<h1>Finiquito de Contrato de Trabajo</h1>
<h2>{_f_ciudad}, {_fmt_fin(fin.fecha_emision)}</h2>
<div class="seccion">
  <div class="seccion-titulo">Partes</div>
  <p><strong>Empleador:</strong> {_f_nom_legal} — RUT {_f_rut_emp}</p>
  <p><strong>Trabajador:</strong> {_f_trab_nomb} — RUT {_f_rut_trab}</p>
  <p><strong>Cargo:</strong> {_f_cargo} &nbsp;|&nbsp; <strong>Departamento:</strong> {_f_depto}</p>
  <p><strong>Fecha de ingreso:</strong> {_fmt_fin(empleado.fecha_ingreso)} &nbsp;|&nbsp;
     <strong>Fecha de término:</strong> {_fmt_fin(fin.fecha_termino)}</p>
  <p><strong>Causal de término:</strong> {_f_causal}</p>
</div>
<div class="seccion">
  <div class="seccion-titulo">Liquidación Final</div>
  <table>
    <tr><td>Sueldo base proporcional ({fin.dias_trabajados_ultimo_mes} días)</td><td>${sueldo_prop:,.0f}</td></tr>
    <tr><td>Gratificación proporcional</td><td>${fin.gratificacion_proporcional:,.0f}</td></tr>
    <tr><td>Feriado proporcional</td><td>${fin.feriado_proporcional:,.0f}</td></tr>
    {f'<tr><td>Indemnización por años de servicio</td><td>${fin.indemnizacion_anos_servicio:,.0f}</td></tr>' if fin.indemnizacion_anos_servicio else ''}
    {f'<tr><td>Indemnización sustitutiva de aviso previo</td><td>${fin.indemnizacion_sustitutiva_aviso:,.0f}</td></tr>' if fin.indemnizacion_sustitutiva_aviso else ''}
    {f'<tr><td>Otros haberes</td><td>${fin.otros_haberes:,.0f}</td></tr>' if fin.otros_haberes else ''}
    <tr><td>Descuentos previsionales</td><td>-${fin.descuentos_prevision:,.0f}</td></tr>
    {f'<tr><td>Otros descuentos</td><td>-${fin.otros_descuentos:,.0f}</td></tr>' if fin.otros_descuentos else ''}
    <tr class="total-row"><td>TOTAL A PAGAR</td><td>${fin.total_a_pagar:,.0f}</td></tr>
  </table>
</div>
<div class="seccion">
  <div class="seccion-titulo">Declaración del Trabajador</div>
  <p>El trabajador declara haber recibido a su entera satisfacción la suma indicada como total a pagar,
  y nada más tiene que reclamar al empleador, quedando ambas partes en paz y a finiquito.</p>
  <p>Modalidad de suscripción: <strong>{_f_modalidad}</strong></p>
</div>
<div class="firma-bloque">
  <div class="firma-item">
    <div class="firma-linea"><strong>{_f_nom_legal}</strong><br/>RUT {_f_rut_emp}<br/>Empleador</div>
  </div>
  <div class="firma-item">
    <div class="firma-linea"><strong>{_f_trab_firma}</strong><br/>RUT {_f_rut_trab}<br/>Trabajador</div>
  </div>
</div>
<p class="aviso">Finiquito regulado por los artículos 177 y siguientes del Código del Trabajo de Chile.
  Generado por Jornada40 · {_fmt_fin(fin.fecha_emision)}.</p>
</body>
</html>"""
            return _html_a_pdf_bytes(html, f'Finiquito_{empleado.rut}'), None, None, None, None, fin

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
        expira_fecha     = solicitud.expira_en.strftime('%d/%m/%Y')

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
