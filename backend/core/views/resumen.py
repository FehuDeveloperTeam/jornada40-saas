"""Resumen por correo para el empleador.

El comando diario `enviar_resumenes` revisa a cada cliente según su frecuencia
(cada día, cada lunes o nunca) y le envía, por empresa, lo que requiere su
atención: solicitudes de sus trabajadores, firmas por vencer, vencidas o
rechazadas y plazos del registro en Mi DT. Si no hay nada que contar no se
envía correo. Cada tema es una función en FUENTES; los módulos nuevos (Ley
Karin, horas compensatorias, EPP…) agregan la suya.

`Cliente.resumen_hasta` marca el momento revisado: lo "nuevo" del siguiente
resumen es lo ocurrido desde ahí.
"""
import logging
from datetime import date, timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Cliente, Empresa, SolicitudDocumento, SolicitudFirma
from .direccion_trabajo import items_registro
from .solicitudes_documento import actualizar_solicitudes

logger = logging.getLogger(__name__)

# Firmas pendientes que vencen dentro de estos días se destacan.
DIAS_POR_VENCER = 2
# Plazos de Mi DT a destacar (días hábiles restantes).
DIAS_HABILES_AVISO_DT = 3
# Tope de nombres por tema: el detalle completo está en el panel.
MAX_LINEAS = 8


def _nombre(empleado):
    return ' '.join(p for p in (empleado.nombres, empleado.apellido_paterno) if p).strip()


def _fecha(d):
    return d.strftime('%d-%m-%Y')


def _seccion(titulo, lineas, ruta, boton):
    if not lineas:
        return None
    extra = len(lineas) - MAX_LINEAS
    if extra > 0:
        lineas = lineas[:MAX_LINEAS] + [f'y {extra} más.']
    return {'titulo': titulo, 'lineas': lineas, 'ruta': ruta, 'boton': boton}


def _solicitudes(empresa, desde, hoy):
    qs = SolicitudDocumento.objects.filter(empleado__empresa=empresa)
    actualizar_solicitudes(qs)
    pendientes = list(qs.filter(estado='PENDIENTE').select_related('empleado').order_by('creada_en'))
    if not pendientes:
        return None
    nuevas = sum(1 for s in pendientes if s.creada_en >= desde)
    lineas = [f'{_nombre(s.empleado)} pidió: {s.get_tipo_display().lower()}'
              + (f' de {s.mes:02d}/{s.anio}' if s.mes else '') + '.' for s in pendientes]
    titulo = (f'Sus trabajadores le pidieron {len(pendientes)} '
              f'{"documento" if len(pendientes) == 1 else "documentos"}')
    if nuevas:
        titulo += f' ({nuevas} {"nuevo" if nuevas == 1 else "nuevos"})'
    return _seccion(titulo, lineas, '/app/solicitudes', 'Ver solicitudes')


def _firmas(empresa, desde, hoy):
    qs = SolicitudFirma.objects.filter(empresa=empresa)
    SolicitudFirma.actualizar_estados(qs)
    limite = timezone.now() + timedelta(days=DIAS_POR_VENCER)
    lineas = []
    for f in qs.filter(estado='PENDIENTE', expira_en__lte=limite).select_related('empleado').order_by('expira_en'):
        lineas.append(f'Vence el {_fecha(timezone.localtime(f.expira_en))} sin firmar: '
                      f'{f.get_tipo_documento_display().lower()} de {_nombre(f.empleado)}.')
    for f in qs.filter(estado='RECHAZADO', actualizado_en__gte=desde).select_related('empleado'):
        lineas.append(f'{_nombre(f.empleado)} rechazó: {f.get_tipo_documento_display().lower()}.')
    for f in qs.filter(estado='EXPIRADO', actualizado_en__gte=desde).select_related('empleado'):
        lineas.append(f'Venció sin firma: {f.get_tipo_documento_display().lower()} de {_nombre(f.empleado)}. '
                      'Puede reenviarlo.')
    firmados = qs.filter(estado='FIRMADO', firmado_en__gte=desde).count()
    if firmados and lineas:
        lineas.append(f'Además, se firmaron {firmados} {"documento" if firmados == 1 else "documentos"}.')
    return _seccion('Firmas que requieren su atención', lineas, '/app/firmas', 'Ver firmas')


def _registro_dt(empresa, desde, hoy):
    lineas = []
    for i in items_registro(empresa, hoy):
        if i['estado'] == 'VENCIDO':
            lineas.append(f'Plazo vencido el {_fecha(date.fromisoformat(i["vence"]))}: '
                          f'{i["detalle"].lower()} de {i["empleado"]["nombre"]}.')
        elif i['estado'] == 'PENDIENTE' and i['dias_habiles_restantes'] <= DIAS_HABILES_AVISO_DT:
            lineas.append(f'Registrar a más tardar el {_fecha(date.fromisoformat(i["vence"]))}: '
                          f'{i["detalle"].lower()} de {i["empleado"]["nombre"]}.')
    return _seccion('Registros pendientes en Mi DT (Dirección del Trabajo)', lineas, '/app/dt', 'Ver registros')


FUENTES = [_solicitudes, _firmas, _registro_dt]


def contenido(cliente, desde, hoy=None):
    """Secciones del resumen por empresa; lista vacía si no hay nada que contar."""
    hoy = hoy or timezone.localdate()
    empresas = []
    for empresa in Empresa.objects.filter(owner=cliente.usuario, activo=True).order_by('nombre_legal'):
        secciones = []
        for fuente in FUENTES:
            try:
                s = fuente(empresa, desde, hoy)
            except Exception:
                # Un tema que falla no deja sin resumen al cliente.
                logger.exception('Resumen: falló %s en la empresa %s', fuente.__name__, empresa.id)
                s = None
            if s:
                secciones.append(s)
        if secciones:
            empresas.append({'nombre': empresa.alias or empresa.nombre_legal, 'secciones': secciones})
    return empresas


def corresponde(cliente, hoy):
    """Si hoy toca enviarle el resumen. Semanal = los lunes (o si se saltó uno)."""
    if cliente.frecuencia_resumen == 'NUNCA':
        return False
    ultimo = timezone.localtime(cliente.resumen_hasta).date() if cliente.resumen_hasta else None
    if ultimo and ultimo >= hoy:
        return False
    if cliente.frecuencia_resumen == 'DIARIA':
        return True
    return hoy.weekday() == 0 or bool(ultimo and (hoy - ultimo).days > 7)


def _correo(cliente):
    return (cliente.usuario.email or cliente.correo or '').strip()


def enviar(cliente, hoy=None, ahora=None):
    """Arma y envía el resumen. Devuelve True si se envió un correo."""
    hoy = hoy or timezone.localdate()
    ahora = ahora or timezone.now()
    dias = 1 if cliente.frecuencia_resumen == 'DIARIA' else 7
    desde = cliente.resumen_hasta or ahora - timedelta(days=dias)
    empresas = contenido(cliente, desde, hoy)
    enviado = False
    correo = _correo(cliente)
    if empresas and correo:
        sitio = getattr(settings, 'SITIO_URL', 'https://jornada40.cl').rstrip('/')
        ctx = {'nombre': cliente.nombres, 'empresas': empresas, 'sitio': sitio,
               'fecha': _fecha(hoy), 'diario': cliente.frecuencia_resumen == 'DIARIA'}
        html = render_to_string('resumen_empleador.html', ctx)
        texto = render_to_string('resumen_empleador.txt', ctx)
        asunto = f'Jornada40: {sum(len(e["secciones"]) for e in empresas)} temas por revisar'
        msg = EmailMultiAlternatives(asunto, texto, settings.DEFAULT_FROM_EMAIL, to=[correo])
        msg.attach_alternative(html, 'text/html')
        msg.send()
        enviado = True
    cliente.resumen_hasta = ahora
    cliente.save(update_fields=['resumen_hasta'])
    return enviado


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def preferencia_resumen(request):
    """Frecuencia del resumen por correo (lista cerrada)."""
    cliente = getattr(request.user, 'perfil_cliente', None)
    if not cliente:
        return Response({'error': 'Perfil no encontrado.'}, status=404)
    if request.method == 'PATCH':
        frecuencia = request.data.get('frecuencia')
        if frecuencia not in dict(Cliente.FRECUENCIAS_RESUMEN):
            return Response({'error': 'Elige una de las opciones.'}, status=400)
        cliente.frecuencia_resumen = frecuencia
        cliente.save(update_fields=['frecuencia_resumen'])
    return Response({'frecuencia': cliente.frecuencia_resumen, 'correo': _correo(cliente),
                     'opciones': [{'valor': v, 'texto': t} for v, t in Cliente.FRECUENCIAS_RESUMEN]})
