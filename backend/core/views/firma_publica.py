"""Firma electrónica: flujo público del trabajador (RUT, código, firma, rechazo)."""
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import transaction
from django.http import HttpResponse
from ..models import Empresa, SolicitudFirma, OTPFirma
from django.conf import settings
from django.utils import timezone
from ..rut import limpiar_rut
import string
import hashlib
import secrets
from html import escape as _esc
from .. import b2_client
from django.core.mail import EmailMultiAlternatives
import uuid as uuid_mod

from .base import THROTTLES_FIRMA_PUBLICA, logger
from .contratos import _aplicar_anexo_a_contrato


# ==========================================
# FIRMA ELECTRÓNICA — ENDPOINTS PÚBLICOS
# (no requieren autenticación del empleador)
# ==========================================

def _enmascarar_email(email: str) -> str:
    """Ej: juan.perez@gmail.com → ju***@gmail.com"""
    partes = email.split('@')
    usuario = partes[0]
    dominio = partes[1] if len(partes) > 1 else ''
    prefijo = usuario[:2] if len(usuario) >= 2 else usuario[:1]
    return f"{prefijo}***@{dominio}"


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes(THROTTLES_FIRMA_PUBLICA)
def firma_publica_info(request, token):
    """
    Retorna la información pública de una solicitud de firma:
    tipo de documento, nombre de empresa, nombre del trabajador y fecha de expiración.
    No expone datos sensibles.
    """
    try:
        solicitud = SolicitudFirma.objects.select_related('empleado', 'empresa').get(token=token)
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    # Vencida o colgada en PROCESANDO: se corrige antes de mostrarla.
    SolicitudFirma.actualizar_estados(SolicitudFirma.objects.filter(pk=solicitud.pk))
    solicitud.refresh_from_db()

    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
        'LIQUIDACION': 'Liquidación de Sueldo', 'VACACION': 'Comprobante de Vacaciones',
        'FINIQUITO': 'Finiquito de Término',
    }
    empleado = solicitud.empleado
    empresa  = solicitud.empresa

    return Response({
        'estado': solicitud.estado,
        'tipo_documento': solicitud.tipo_documento,
        'tipo_documento_label': tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento),
        'empresa_nombre': empresa.nombre_legal,
        'trabajador_nombre': f"{empleado.nombres} {empleado.apellido_paterno}",
        'email_firmante_enmascarado': _enmascarar_email(solicitud.email_firmante),
        'expira_en': solicitud.expira_en.isoformat(),
        'ya_verificado': solicitud.sesion_token_trabajador is not None,
        # Comprobante, solo cuando ya se firmó (para volver a verlo desde el enlace).
        **({
            'firmado_en': solicitud.firmado_en.isoformat() if solicitud.firmado_en else None,
            'folio': solicitud.folio,
            'hash_firmado': solicitud.hash_firmado,
        } if solicitud.estado == 'FIRMADO' else {}),
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes(THROTTLES_FIRMA_PUBLICA)
def firma_publica_solicitar_otp(request, token):
    """
    Genera un código OTP de 6 dígitos y lo envía al email del trabajador.
    Limita a 1 solicitud por minuto para evitar spam.
    """
    try:
        solicitud = SolicitudFirma.objects.get(token=token)
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    if solicitud.estado != 'PENDIENTE':
        return Response({'error': 'Esta solicitud no está pendiente de firma.'}, status=400)

    if timezone.now() > solicitud.expira_en:
        solicitud.estado = 'EXPIRADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': 'El enlace de firma ha expirado.'}, status=410)

    # Confirmar identidad con el RUT antes de enviar el código: el enlace
    # solo no basta (un correo reenviado o una bandeja compartida).
    rut_ingresado = limpiar_rut(request.data.get('rut', ''))
    if not rut_ingresado or rut_ingresado != limpiar_rut(solicitud.empleado.rut):
        return Response(
            {'error': 'El RUT no coincide con el del trabajador al que se envió el documento.'},
            status=400,
        )

    # Tope de códigos por hora: con 3 intentos por código, acota los intentos
    # totales de adivinar uno aunque se pidan códigos nuevos cada minuto.
    hace_una_hora = timezone.now() - timezone.timedelta(hours=1)
    if OTPFirma.objects.filter(solicitud=solicitud, creado_en__gte=hace_una_hora).count() >= 5:
        return Response(
            {'error': 'Pediste demasiados códigos. Intenta de nuevo en una hora.'},
            status=429,
        )

    # Anti-spam: no permitir más de un OTP por minuto
    ultimo_otp = OTPFirma.objects.filter(solicitud=solicitud).order_by('-creado_en').first()
    if ultimo_otp:
        segundos_transcurridos = (timezone.now() - ultimo_otp.creado_en).total_seconds()
        if segundos_transcurridos < 60:
            espera = int(60 - segundos_transcurridos)
            return Response(
                {'error': f'Debes esperar {espera} segundo(s) antes de solicitar un nuevo código.'},
                status=429
            )

    # Invalidar OTPs previos no verificados
    OTPFirma.objects.filter(
        solicitud=solicitud, verificado=False
    ).update(expira_en=timezone.now())

    # Generar código de 6 dígitos
    codigo = ''.join(secrets.choice(string.digits) for _ in range(6))

    otp = OTPFirma.objects.create(
        solicitud=solicitud,
        codigo=codigo,
        email_destino=solicitud.email_firmante,
    )

    # Enviar email con el código
    try:
        _enviar_email_otp(otp, solicitud)
    except Exception:
        logger.exception('No se pudo enviar el código de firma de la solicitud %s', solicitud.pk)
        otp.delete()
        return Response({'error': 'No pudimos enviar el código a tu correo. Intenta de nuevo en unos minutos.'},
                        status=500)

    return Response({
        'enviado': True,
        'email_destino': _enmascarar_email(solicitud.email_firmante),
        'expira_en_minutos': 10,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes(THROTTLES_FIRMA_PUBLICA)
def firma_publica_verificar_otp(request, token):
    """
    Verifica el código OTP enviado al trabajador.
    Si es correcto devuelve un sesion_token que autoriza el paso de firma.
    """
    codigo_enviado = str(request.data.get('codigo', '')).strip()

    if not codigo_enviado:
        return Response({'error': 'Debes ingresar el código.'}, status=400)

    try:
        solicitud = SolicitudFirma.objects.get(token=token)
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    if solicitud.estado != 'PENDIENTE':
        return Response({'error': 'Esta solicitud no está pendiente de firma.'}, status=400)

    if timezone.now() > solicitud.expira_en:
        solicitud.estado = 'EXPIRADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': 'El enlace de firma ha expirado.'}, status=410)

    # Buscar el OTP más reciente válido
    otp = OTPFirma.objects.filter(
        solicitud=solicitud, verificado=False
    ).order_by('-creado_en').first()

    if not otp or not otp.es_valido:
        return Response(
            {'error': 'No hay un código activo. Por favor solicita uno nuevo.'},
            status=400
        )

    # Incrementar intentos antes de verificar (previene timing attacks)
    otp.intentos += 1
    otp.save(update_fields=['intentos'])

    if otp.intentos > 3:
        return Response(
            {'error': 'Código bloqueado por demasiados intentos. Solicita uno nuevo.'},
            status=400
        )

    if otp.codigo != codigo_enviado:
        restantes = 3 - otp.intentos
        msg = (f'Código incorrecto. Te quedan {restantes} intento(s).'
               if restantes > 0 else 'Código bloqueado. Solicita uno nuevo.')
        return Response({'error': msg}, status=400)

    # Código correcto — marcar OTP como verificado
    otp.verificado = True
    otp.save(update_fields=['verificado'])

    # Generar sesion_token para el paso de firma
    sesion_token = uuid_mod.uuid4()
    solicitud.sesion_token_trabajador = sesion_token
    solicitud.save(update_fields=['sesion_token_trabajador', 'actualizado_en'])

    return Response({
        'verificado': True,
        'sesion_token': str(sesion_token),
    })


def _enviar_email_otp(otp: OTPFirma, solicitud: SolicitudFirma):
    """Envía el código OTP al trabajador por email."""
    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
        'LIQUIDACION': 'Liquidación de Sueldo', 'VACACION': 'Comprobante de Vacaciones',
        'FINIQUITO': 'Finiquito de Término',
    }
    tipo_label = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento)
    empresa_nombre = solicitud.empresa.nombre_legal
    codigo = otp.codigo

    texto_plano = (
        f"Tu código de verificación es: {codigo}\n\n"
        f"Ingresa este código en la página de firma para verificar tu identidad.\n"
        f"Válido por 10 minutos.\n\n"
        f"Si no solicitaste este código, ignora este mensaje.\n\n"
        f"Jornada40 — Sistema de Gestión Laboral"
    )
    html_body = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Verifica tu identidad</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa_nombre} · {tipo_label}</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="color:#374151;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Ingresa el siguiente código en la página de firma para verificar tu identidad:
      </p>
      <div style="text-align:center;margin:0 0 28px;">
        <div style="display:inline-block;background:#f0f4ff;border:2px dashed #2563eb;border-radius:12px;padding:20px 40px;">
          <span style="font-size:38px;font-weight:900;letter-spacing:0.3em;color:#1e3a6e;font-family:monospace;">{codigo}</span>
        </div>
        <p style="color:#6b7280;font-size:13px;margin:10px 0 0;">Válido por <strong>10 minutos</strong></p>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Si no solicitaste este código, puedes ignorar este mensaje con seguridad.<br>
        Firma Electrónica Simple válida bajo Ley 19.799 (Chile).
      </p>
    </div>
  </div>
</body>
</html>"""

    msg = EmailMultiAlternatives(
        subject=f"Tu código de verificación — {empresa_nombre}",
        body=texto_plano,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[otp.email_destino],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send()


# ==========================================
# FASE 8 — Procesamiento de la firma
# ==========================================

def _ip_desde_request(request) -> str:
    """IP real del firmante. IpRealMiddleware ya la dejó en REMOTE_ADDR; el
    primer valor de X-Forwarded-For era la IP de Cloudflare, no la del firmante."""
    return request.META.get('REMOTE_ADDR', '')


def _enviar_emails_firma_completada(
    solicitud: SolicitudFirma,
    empleado,
    empresa,
    pdf_firmado_bytes: bytes,
):
    """Envía confirmación de firma al trabajador y notificación al empleador."""
    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
        'LIQUIDACION': 'Liquidación de Sueldo', 'VACACION': 'Comprobante de Vacaciones',
        'FINIQUITO': 'Finiquito de Término',
    }
    tipo_label        = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento)
    nombre_trabajador = f"{empleado.nombres} {empleado.apellido_paterno}"
    firmado_str       = timezone.localtime(solicitud.firmado_en).strftime('%d/%m/%Y a las %H:%M') + ' (hora de Chile)'
    nombre_pdf        = f"{tipo_label.replace(' ', '_')}_{empleado.rut}_firmado.pdf"

    # ── Email al trabajador ──────────────────────────────────────────────────
    texto_trabajador = (
        f"Hola {nombre_trabajador},\n\n"
        f"Tu firma electrónica simple fue registrada exitosamente el {firmado_str}.\n\n"
        f"Documento: {tipo_label}\n"
        f"Empresa: {empresa.nombre_legal}\n\n"
        f"Adjunto encontrarás una copia del documento firmado con el certificado de firma.\n\n"
        f"Jornada40 — Sistema de Gestión Laboral"
    )
    html_trabajador = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">¡Documento Firmado!</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa.nombre_legal}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hola <strong>{nombre_trabajador}</strong>,</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Tu firma electrónica simple fue registrada exitosamente.
      </p>
      <div style="background:#f0fdf4;border-left:4px solid #059669;padding:16px 20px;border-radius:6px;margin-bottom:28px;">
        <p style="margin:0;font-weight:700;color:#065f46;font-size:15px;">{tipo_label}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Firmado el {firmado_str}</p>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Adjunto a este correo encontrarás el documento firmado con el certificado de autenticidad.
        Guárdalo en un lugar seguro.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Firma Electrónica Simple válida bajo Ley N° 19.799 (Chile). Generado por Jornada40.
      </p>
    </div>
  </div>
</body>
</html>"""

    msg_trabajador = EmailMultiAlternatives(
        subject=f"Documento firmado: {tipo_label} — {empresa.nombre_legal}",
        body=texto_trabajador,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[solicitud.email_firmante],
    )
    msg_trabajador.attach_alternative(html_trabajador, "text/html")
    msg_trabajador.attach(nombre_pdf, pdf_firmado_bytes, 'application/pdf')
    msg_trabajador.send()

    # ── Email al empleador ───────────────────────────────────────────────────
    email_empleador = empresa.owner.email
    if not email_empleador:
        return

    texto_empleador = (
        f"El trabajador {nombre_trabajador} firmó el documento «{tipo_label}» "
        f"el {firmado_str}.\n\n"
        f"Empresa: {empresa.nombre_legal}\n"
        f"El documento firmado está adjunto a este correo.\n\n"
        f"Jornada40 — Sistema de Gestión Laboral"
    )
    html_empleador = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Firma Recibida</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa.nombre_legal}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        El trabajador <strong>{nombre_trabajador}</strong> firmó el siguiente documento:
      </p>
      <div style="background:#f0f4ff;border-left:4px solid #2563eb;padding:16px 20px;border-radius:6px;margin-bottom:28px;">
        <p style="margin:0;font-weight:700;color:#1e3a6e;font-size:15px;">{tipo_label}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Firmado el {firmado_str}</p>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 0;">
        El documento firmado con certificado de autenticidad está adjunto a este correo.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Firma Electrónica Simple válida bajo Ley N° 19.799 (Chile). Generado por Jornada40.
      </p>
    </div>
  </div>
</body>
</html>"""

    msg_empleador = EmailMultiAlternatives(
        subject=f"Firma recibida: {nombre_trabajador} firmó «{tipo_label}»",
        body=texto_empleador,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email_empleador],
    )
    msg_empleador.attach_alternative(html_empleador, "text/html")
    msg_empleador.attach(nombre_pdf, pdf_firmado_bytes, 'application/pdf')
    msg_empleador.send()


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes(THROTTLES_FIRMA_PUBLICA)
def firma_publica_firmar(request, token):
    """
    Procesa la firma del trabajador:
    1. Valida sesion_token y datos de entrada
    2. Descarga PDF original de B2
    3. Genera PDF firmado con página de certificado (pdf_firma.py)
    4. Sube PDF firmado a B2 y elimina el temporal
    5. Marca SolicitudFirma como FIRMADO
    6. Envía emails de confirmación con el PDF adjunto
    """
    sesion_token    = str(request.data.get('sesion_token',    '')).strip()
    firma_trabajador = str(request.data.get('firma_trabajador', '')).strip()

    if not sesion_token:
        return Response({'error': 'Sesión inválida. Vuelve a verificar tu identidad.'}, status=400)
    if not firma_trabajador:
        return Response({'error': 'Debes dibujar tu firma antes de continuar.'}, status=400)
    if not firma_trabajador.startswith('data:image/'):
        return Response({'error': 'Formato de firma inválido.'}, status=400)
    if len(firma_trabajador) > 500_000:
        return Response({'error': 'La imagen de firma es demasiado grande.'}, status=400)

    try:
        with transaction.atomic():
            solicitud = SolicitudFirma.objects.select_related(
                'empleado', 'empresa', 'empresa__owner'
            ).select_for_update().get(token=token)

            # ── Validaciones de estado ──────────────────────────────────────
            if solicitud.estado != 'PENDIENTE':
                return Response(
                    {'error': f'Esta solicitud ya no está pendiente ({solicitud.get_estado_display()}).'},
                    status=400,
                )

            if timezone.now() > solicitud.expira_en:
                solicitud.estado = 'EXPIRADO'
                solicitud.save(update_fields=['estado', 'actualizado_en'])
                return Response({'error': 'El enlace de firma ha expirado.'}, status=410)

            if (not solicitud.sesion_token_trabajador
                    or str(solicitud.sesion_token_trabajador) != sesion_token):
                return Response(
                    {'error': 'Sesión inválida. Vuelve a verificar tu identidad con el código OTP.'},
                    status=403,
                )

            if not solicitud.b2_key_temporal:
                return Response(
                    {'error': 'No se encontró el PDF del documento. Contacta al empleador.'},
                    status=400,
                )

            # Reclamamos la solicitud de inmediato para que ninguna petición
            # concurrente (doble clic, doble tap) pueda pasar este chequeo.
            solicitud.estado = 'PROCESANDO'
            solicitud.save(update_fields=['estado', 'actualizado_en'])
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    # ── Descargar PDF original de B2 ────────────────────────────────────────
    try:
        pdf_original_bytes = b2_client.descargar_documento(solicitud.b2_key_temporal)
    except Exception:
        logger.exception('Firma %s: no se pudo descargar el original', solicitud.pk)
        solicitud.estado = 'PENDIENTE'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': 'No pudimos obtener el documento. Intenta de nuevo en unos minutos.'}, status=500)

    # ── Folio correlativo por empresa y huella del documento revisado ───────
    empleado = solicitud.empleado
    empresa  = solicitud.empresa
    hash_original = hashlib.sha256(pdf_original_bytes).hexdigest()
    if not solicitud.folio:
        # Con la fila de la empresa bloqueada, dos firmas simultáneas no
        # pueden tomar el mismo número. Si luego falla, el folio queda
        # reservado para el reintento de esta misma solicitud.
        with transaction.atomic():
            Empresa.objects.select_for_update().get(id=empresa.id)
            siguiente = SolicitudFirma.objects.filter(empresa=empresa).exclude(folio='').count() + 1
            solicitud.folio = f'J40-{timezone.localdate().year}-{siguiente:06d}'
            solicitud.save(update_fields=['folio', 'actualizado_en'])

    # ── Generar PDF firmado con certificado ─────────────────────────────────
    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
        'LIQUIDACION': 'Liquidación de Sueldo', 'VACACION': 'Comprobante de Vacaciones',
        'FINIQUITO': 'Finiquito de Término',
    }
    firmado_en  = timezone.now()
    ip_firmante = _ip_desde_request(request)

    try:
        from ..pdf_firma import agregar_certificado_firma
        pdf_firmado_bytes = agregar_certificado_firma(
            pdf_original_bytes    = pdf_original_bytes,
            tipo_documento_label  = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento),
            empresa_nombre        = empresa.nombre_legal,
            empresa_rut           = empresa.rut,
            firmante_nombre       = empresa.firma_firmante_nombre or empresa.representante_legal or '',
            firmante_cargo        = empresa.firma_firmante_cargo or 'Representante Legal',
            firma_empleador_b64   = empresa.firma_imagen or '',
            trabajador_nombre     = f"{empleado.nombres} {empleado.apellido_paterno}",
            trabajador_rut        = empleado.rut,
            firma_trabajador_b64  = firma_trabajador,
            token                 = str(solicitud.token),
            firmado_en            = firmado_en,
            ip_firmante           = ip_firmante,
            email_firmante        = solicitud.email_firmante,
            folio                 = solicitud.folio,
            hash_original         = hash_original,
        )
    except Exception:
        logger.exception('Firma %s: no se pudo generar el PDF firmado', solicitud.pk)
        solicitud.estado = 'PENDIENTE'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': 'No pudimos generar el documento firmado. Intenta de nuevo en unos minutos.'},
                        status=500)

    # ── Subir PDF firmado a B2 ──────────────────────────────────────────────
    key_firmado = b2_client.key_firmado(
        empresa_id=empresa.id,
        uuid=str(solicitud.token),
        year=firmado_en.year,
        month=firmado_en.month,
    )
    try:
        b2_client.subir_documento(pdf_firmado_bytes, key_firmado)
    except Exception:
        logger.exception('Firma %s: no se pudo guardar el PDF firmado', solicitud.pk)
        solicitud.estado = 'PENDIENTE'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': 'No pudimos guardar el documento firmado. Intenta de nuevo en unos minutos.'},
                        status=500)

    # Eliminar PDF temporal (no crítico)
    b2_client.eliminar_documento(solicitud.b2_key_temporal)

    # ── Actualizar SolicitudFirma ───────────────────────────────────────────
    solicitud.estado                 = 'FIRMADO'
    solicitud.firmado_en             = firmado_en
    solicitud.ip_firmante            = ip_firmante or None
    solicitud.firma_trabajador_imagen = firma_trabajador
    solicitud.b2_key_firmado         = key_firmado
    solicitud.hash_original          = hash_original
    solicitud.hash_firmado           = hashlib.sha256(pdf_firmado_bytes).hexdigest()
    # La sesión se conserva: ya no sirve para firmar ni rechazar (el estado
    # dejó de ser PENDIENTE) y permite al trabajador descargar el PDF firmado.
    solicitud.save(update_fields=[
        'estado', 'firmado_en', 'ip_firmante',
        'firma_trabajador_imagen', 'b2_key_firmado',
        'hash_original', 'hash_firmado', 'actualizado_en',
    ])

    # ── Un anexo modifica el contrato recién al firmarse (Art. 11) ──────────
    # Si falla no se revierte la firma: quedó legalmente otorgada. Se registra
    # para poder aplicar el cambio manualmente.
    if solicitud.tipo_documento == 'ANEXO_CONTRATO' and solicitud.anexo_contrato_id:
        try:
            _aplicar_anexo_a_contrato(solicitud.anexo_contrato)
        except Exception:
            logger.exception(
                'Anexo %s firmado pero no se pudieron aplicar sus cambios al contrato',
                solicitud.anexo_contrato_id,
            )

    # ── Consentimiento para la documentación electrónica (Dictamen 0789/15) ─
    if solicitud.incluye_consentimiento and not empleado.consentimiento_electronico_en:
        empleado.consentimiento_electronico_en = firmado_en
        empleado.consentimiento_electronico_via = 'CONTRATO' if solicitud.tipo_documento == 'CONTRATO' else 'ANEXO'
        empleado.save(update_fields=['consentimiento_electronico_en', 'consentimiento_electronico_via'])

    # ── Emails de confirmación (no críticos) ────────────────────────────────
    try:
        _enviar_emails_firma_completada(solicitud, empleado, empresa, pdf_firmado_bytes)
    except Exception:
        pass

    return Response({
        'firmado': True, 'firmado_en': firmado_en.isoformat(),
        'folio': solicitud.folio, 'hash_firmado': solicitud.hash_firmado,
    })


# ============================================================
# FASE 9 — Previsualización y rechazo por parte del trabajador
# ============================================================

_TIPO_LABELS_PUBLICO = {
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


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes(THROTTLES_FIRMA_PUBLICA)
def firma_publica_documento(request, token):
    """
    Retorna el PDF del documento para que el trabajador lo revise antes de firmar.
    Exige la sesión obtenida con el RUT y el código (?sesion=): el enlace solo
    no basta, igual que para pedir el código (un correo reenviado o una bandeja
    compartida expondría sueldos y datos personales).
    Si la solicitud ya fue firmada, retorna el PDF firmado con certificado.
    """
    try:
        solicitud = SolicitudFirma.objects.select_related('empleado').get(token=token)
    except SolicitudFirma.DoesNotExist:
        return HttpResponse(status=404)

    sesion = str(request.query_params.get('sesion', '')).strip()
    if not sesion or not solicitud.sesion_token_trabajador or str(solicitud.sesion_token_trabajador) != sesion:
        return Response({'error': 'Verifica tu identidad para ver el documento.'}, status=403)

    if solicitud.estado in ('CANCELADO', 'EXPIRADO'):
        return HttpResponse(status=410)

    # Elegir qué versión del PDF servir
    if solicitud.estado == 'FIRMADO' and solicitud.b2_key_firmado:
        b2_key = solicitud.b2_key_firmado
    elif solicitud.b2_key_temporal:
        b2_key = solicitud.b2_key_temporal
    else:
        return HttpResponse(status=404)

    try:
        pdf_bytes = b2_client.descargar_documento(b2_key)
    except Exception:
        logger.exception('Firma %s: no se pudo descargar el documento', solicitud.pk)
        return Response({'error': 'No pudimos obtener el documento. Intenta de nuevo en unos minutos.'}, status=500)

    tipo_label = _TIPO_LABELS_PUBLICO.get(solicitud.tipo_documento, solicitud.tipo_documento)
    apellido   = solicitud.empleado.apellido_paterno.replace(' ', '_')
    filename   = f"{tipo_label.replace(' ', '_')}_{apellido}.pdf"

    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{filename}"'
    response['Content-Length']      = len(pdf_bytes)
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes(THROTTLES_FIRMA_PUBLICA)
def firma_publica_rechazar(request, token):
    """
    El trabajador rechaza el documento tras verificar su identidad con OTP.
    Requiere sesion_token válido. Cambia estado a RECHAZADO y notifica al empleador.
    """
    sesion_token = str(request.data.get('sesion_token', '')).strip()
    motivo       = str(request.data.get('motivo', '')).strip()

    if not sesion_token:
        return Response({'error': 'Sesión inválida. Vuelve a verificar tu identidad.'}, status=400)

    try:
        with transaction.atomic():
            solicitud = SolicitudFirma.objects.select_related(
                'empleado', 'empresa', 'empresa__owner'
            ).select_for_update().get(token=token)

            if solicitud.estado != 'PENDIENTE':
                return Response(
                    {'error': f'Esta solicitud ya no está pendiente ({solicitud.get_estado_display()}).'},
                    status=400,
                )

            if timezone.now() > solicitud.expira_en:
                solicitud.estado = 'EXPIRADO'
                solicitud.save(update_fields=['estado', 'actualizado_en'])
                return Response({'error': 'El enlace de firma ha expirado.'}, status=410)

            if (not solicitud.sesion_token_trabajador
                    or str(solicitud.sesion_token_trabajador) != sesion_token):
                return Response(
                    {'error': 'Sesión inválida. Vuelve a verificar tu identidad con el código OTP.'},
                    status=403,
                )

            solicitud.estado = 'RECHAZADO'
            solicitud.motivo_rechazo = motivo
            solicitud.save(update_fields=['estado', 'motivo_rechazo', 'actualizado_en'])
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud no encontrada.'}, status=404)

    try:
        _notificar_rechazo_empleador(solicitud, motivo)
    except Exception:
        pass  # el rechazo ya fue registrado; el email es no-crítico

    return Response({'rechazado': True})


def _notificar_rechazo_empleador(solicitud: SolicitudFirma, motivo: str):
    """Envía un email al empleador informando que el trabajador rechazó el documento."""
    tipo_label      = _TIPO_LABELS_PUBLICO.get(solicitud.tipo_documento, solicitud.tipo_documento)
    empleado        = solicitud.empleado
    empresa         = solicitud.empresa
    nombre_trabajador = f"{empleado.nombres} {empleado.apellido_paterno}"
    email_empleador = empresa.owner.email
    if not email_empleador:
        return

    _motivo_seg = _esc(motivo) if motivo else ''
    motivo_bloque = (
        f"<div style='background:#fff3cd;border-left:4px solid #f59e0b;padding:12px 16px;"
        f"border-radius:6px;margin:20px 0;'>"
        f"<p style='margin:0;font-size:13px;color:#92400e;font-weight:600;'>Motivo indicado</p>"
        f"<p style='margin:4px 0 0;font-size:14px;color:#374151;'>{_motivo_seg}</p></div>"
        if motivo else ""
    )
    motivo_texto = f"\n\nMotivo indicado por el trabajador: {motivo}" if motivo else ""

    texto_plano = (
        f"El trabajador {nombre_trabajador} rechazó la firma del documento «{tipo_label}».\n"
        f"Empresa: {empresa.nombre_legal}{motivo_texto}\n\n"
        f"Revisa el documento y comunícate con el trabajador para resolver el inconveniente.\n\n"
        f"Jornada40 — Sistema de Gestión Laboral"
    )
    html_body = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#7f1d1d,#991b1b);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Documento Rechazado</h1>
      <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:14px;">{empresa.nombre_legal}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">
        El trabajador <strong>{nombre_trabajador}</strong> rechazó la firma del siguiente documento:
      </p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px 20px;border-radius:6px;margin-bottom:20px;">
        <p style="margin:0;font-weight:700;color:#991b1b;font-size:15px;">{tipo_label}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">{empresa.nombre_legal}</p>
      </div>
      {motivo_bloque}
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
        Comunícate con el trabajador para revisar el documento y volver a enviarlo una vez corregido.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Firma Electrónica Simple · Ley N° 19.799 · Jornada40
      </p>
    </div>
  </div>
</body>
</html>"""

    msg = EmailMultiAlternatives(
        subject=f"Documento rechazado: {nombre_trabajador} rechazó «{tipo_label}»",
        body=texto_plano,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email_empleador],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send()
