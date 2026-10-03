"""Portal de fiscalización para inspectores de la Dirección del Trabajo.

Requisitos del Dictamen 0789/15 que cubre:
- Acceso por internet desde cualquier computador de la DT, a partir del RUT del
  empleador: el inspector ingresa el RUT de la empresa y su correo institucional
  (@dt.gob.cl, ajustable con DOMINIOS_CORREO_INSPECCION) y recibe un código de un
  solo uso. El empleador no interviene ni puede bloquearlo.
- Sin restricciones de fecha, volumen ni tipo de documento: se listan todos los
  documentos de todos los trabajadores (activos y desvinculados), con filtros que
  solo ayudan a buscar.
- Impresión con la certificación de la firma: la descarga entrega la versión
  firmada (con su página de certificado) cuando la hay.
- Ratificación en terreno: el inspector firma un documento con su sola
  identificación; la descarga posterior lo incluye como página adicional.
- Medidas de seguridad: sesión propia (cookie firmada de 8 horas), solo JSON,
  límites de intentos y una bitácora de ingresos, descargas y ratificaciones que
  el empleador ve en Dirección del Trabajo.
"""
import datetime
import hashlib
import io
import secrets
import string

from django.conf import settings
from django.core import signing
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import BaseAuthentication
from rest_framework.decorators import (api_view, authentication_classes, parser_classes, permission_classes,
                                       throttle_classes)
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

from ..models import (AnexoContrato, CodigoInspeccion, Contrato, DocumentoLaboral, DocumentoLegal, Empleado, Empresa,
                      Finiquito, Liquidacion, RatificacionInspeccion, RegistroInspeccion, SolicitudFirma,
                      VacacionEmpleado)
from .. import sesion_inactividad
from ..rut import formatear_rut, limpiar_rut, validar_rut
from .base import _ctx_contrato, _html_a_pdf_bytes, logger, pdf_firmado, respuesta_pdf
from .portal_trabajador import _anotar_para_pruebas

COOKIE = 'jornada40-inspeccion'
DURACION_SESION = 8 * 60 * 60     # tope aunque haya actividad
INACTIVIDAD_SESION = 15 * 60      # sin uso, se cierra
MINUTOS_CODIGO = 10
INTENTOS_POR_CODIGO = 3
_SAL = 'portal-inspeccion'
_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
          'noviembre', 'diciembre']
MENSAJE_INGRESO = ('Si la empresa usa Jornada40, enviamos un código a tu correo institucional. '
                   'Vence en 10 minutos.')


def dominios_permitidos():
    return [d.lower() for d in getattr(settings, 'DOMINIOS_CORREO_INSPECCION', ['dt.gob.cl'])]


def _correo_institucional(correo):
    correo = (correo or '').strip().lower()
    return correo if '@' in correo and correo.rsplit('@', 1)[1] in dominios_permitidos() else ''


def _empresa_por_rut(valor):
    rut = limpiar_rut(valor or '')
    if not validar_rut(rut):
        return None
    variantes = {formatear_rut(rut), formatear_rut(rut).replace('.', ''), rut, f'{rut[:-1]}-{rut[-1]}'}
    return Empresa.objects.filter(rut__in=variantes, activo=True).first()


def _ip(request):
    return request.META.get('REMOTE_ADDR', '')


# ── Sesión del inspector ─────────────────────────────────────────────────────

class Inspector:
    """Identidad de la sesión: el inspector y la empresa que fiscaliza."""
    is_authenticated = True

    def __init__(self, empresa, correo, nombre, rut):
        self.empresa, self.correo, self.nombre, self.rut = empresa, correo, nombre, rut


class SesionInspeccion(BaseAuthentication):
    def authenticate(self, request):
        valor = request.COOKIES.get(COOKIE)
        if not valor:
            return None
        try:
            d = sesion_inactividad.leer(valor, _SAL, INACTIVIDAD_SESION, DURACION_SESION)
            empresa = Empresa.objects.get(pk=d['e'], activo=True)
        except (signing.BadSignature, Empresa.DoesNotExist, KeyError, TypeError):
            return None
        sesion_inactividad.renovar(request, COOKIE, d, _SAL, INACTIVIDAD_SESION)
        return Inspector(empresa, d['c'], d['n'], d['r']), d


class EsInspector(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, Inspector)


class InspeccionAnonThrottle(AnonRateThrottle):
    scope = 'inspeccion'


class InspeccionSesionThrottle(SimpleRateThrottle):
    scope = 'inspeccion_sesion'

    def get_cache_key(self, request, view):
        u = getattr(request, 'user', None)
        return f'throttle_inspeccion_{u.correo}_{u.empresa.pk}' if isinstance(u, Inspector) else None


def _publica(vista):
    vista = throttle_classes([InspeccionAnonThrottle])(vista)
    vista = parser_classes([JSONParser])(vista)
    vista = permission_classes([AllowAny])(vista)
    return authentication_classes([SesionInspeccion])(vista)


def _con_sesion(vista):
    vista = throttle_classes([InspeccionSesionThrottle])(vista)
    vista = parser_classes([JSONParser])(vista)
    vista = permission_classes([EsInspector])(vista)
    return authentication_classes([SesionInspeccion])(vista)


def _registrar(empresa, correo, nombre, rut, accion, request, detalle=''):
    RegistroInspeccion.objects.create(empresa=empresa, correo=correo, nombre=nombre, rut_inspector=rut,
                                      accion=accion, detalle=detalle[:255], ip=_ip(request))


def _huella(empresa_id, correo, codigo):
    return hashlib.sha256(f'{empresa_id}:{correo}:{codigo}:{settings.SECRET_KEY}'.encode()).hexdigest()


# ── Ingreso ──────────────────────────────────────────────────────────────────

@api_view(['POST'])
@_publica
def ingreso(request):
    """RUT de la empresa + identificación del inspector → código a su correo institucional."""
    d = request.data
    correo = _correo_institucional(d.get('correo'))
    nombre = str(d.get('nombre') or '').strip()[:150]
    rut = limpiar_rut(d.get('rut') or '')
    if not correo:
        return Response({'error': f"Usa tu correo institucional ({', '.join('@' + x for x in dominios_permitidos())})."},
                        status=status.HTTP_400_BAD_REQUEST)
    if len(nombre) < 5 or not validar_rut(rut):
        return Response({'error': 'Ingresa tu nombre completo y tu RUT.'}, status=status.HTTP_400_BAD_REQUEST)
    if not validar_rut(limpiar_rut(d.get('rut_empresa') or '')):
        return Response({'error': 'Ingresa un RUT de empleador válido.'}, status=status.HTTP_400_BAD_REQUEST)
    empresa = _empresa_por_rut(d.get('rut_empresa'))
    if empresa:
        reciente = CodigoInspeccion.objects.filter(correo=correo, empresa=empresa,
                                                   creado_en__gte=timezone.now() - datetime.timedelta(minutes=1))
        if reciente.exists():
            return Response({'error': 'Espera un minuto antes de pedir otro código.'},
                            status=status.HTTP_429_TOO_MANY_REQUESTS)
        CodigoInspeccion.objects.filter(correo=correo, empresa=empresa, usado=False).update(usado=True)
        codigo = ''.join(secrets.choice(string.digits) for _ in range(6))
        CodigoInspeccion.objects.create(empresa=empresa, correo=correo, nombre=nombre, rut_inspector=rut,
                                        huella=_huella(empresa.pk, correo, codigo),
                                        expira_en=timezone.now() + datetime.timedelta(minutes=MINUTOS_CODIGO))
        _anotar_para_pruebas(correo, codigo)
        texto = (f'Código de acceso al portal de fiscalización de Jornada40 para {empresa.nombre_legal} '
                 f'(RUT {formatear_rut(empresa.rut)}): {codigo}\n\nVence en {MINUTOS_CODIGO} minutos.')
        try:
            msg = EmailMultiAlternatives('Código de acceso para fiscalización · Jornada40', texto,
                                         settings.DEFAULT_FROM_EMAIL, to=[correo])
            msg.attach_alternative(render_to_string('portal_trabajador_codigo.html',
                                                    {'codigo': codigo, 'minutos': MINUTOS_CODIGO}), 'text/html')
            msg.send()
        except Exception:
            logger.exception('No se pudo enviar el código de inspección')
            return Response({'error': 'No pudimos enviar el código. Intenta de nuevo en unos minutos.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
    # Misma respuesta exista o no la empresa en Jornada40.
    return Response({'mensaje': MENSAJE_INGRESO})


@api_view(['POST'])
@_publica
def verificar(request):
    correo = _correo_institucional(request.data.get('correo'))
    empresa = _empresa_por_rut(request.data.get('rut_empresa'))
    vigente = (CodigoInspeccion.objects.filter(correo=correo, empresa=empresa, usado=False,
                                               expira_en__gt=timezone.now()).order_by('-creado_en').first()
               if correo and empresa else None)
    if vigente is None:
        return Response({'error': 'El código venció o no corresponde. Pide uno nuevo.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if vigente.intentos >= INTENTOS_POR_CODIGO:
        return Response({'error': 'Superaste los intentos para este código. Pide uno nuevo.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if not secrets.compare_digest(vigente.huella, _huella(empresa.pk, correo, str(request.data.get('codigo') or '').strip())):
        vigente.intentos += 1
        vigente.save(update_fields=['intentos'])
        return Response({'error': 'El código no es correcto.'}, status=status.HTTP_400_BAD_REQUEST)
    vigente.usado = True
    vigente.save(update_fields=['usado'])
    _registrar(empresa, correo, vigente.nombre, vigente.rut_inspector, 'INGRESO', request)
    respuesta = Response(_datos_sesion(Inspector(empresa, correo, vigente.nombre, vigente.rut_inspector)))
    return sesion_inactividad.poner_cookie(respuesta, COOKIE, sesion_inactividad.firmar(
        {'e': empresa.pk, 'c': correo, 'n': vigente.nombre, 'r': vigente.rut_inspector}, _SAL), INACTIVIDAD_SESION)


def _datos_sesion(i):
    e = i.empresa
    return {'empresa': {'nombre': e.nombre_legal, 'rut': formatear_rut(e.rut),
                        'direccion': ', '.join(p for p in (e.direccion, e.comuna) if p),
                        'representante_legal': e.representante_legal or ''},
            'inspector': {'nombre': i.nombre, 'rut': formatear_rut(i.rut), 'correo': i.correo}}


@api_view(['GET'])
@_con_sesion
def yo(request):
    return Response(_datos_sesion(request.user))


@api_view(['POST'])
@_con_sesion
def salir(request):
    i = request.user
    _registrar(i.empresa, i.correo, i.nombre, i.rut, 'SALIDA', request)
    respuesta = Response({'ok': True})
    respuesta.delete_cookie(COOKIE)
    return respuesta


# ── Documentos ───────────────────────────────────────────────────────────────

def _nombre_emp(e):
    return ' '.join(p for p in (e.nombres, e.apellido_paterno, e.apellido_materno) if p).strip().title()


@api_view(['GET'])
@_con_sesion
def trabajadores(request):
    salida = []
    for e in Empleado.objects.filter(empresa=request.user.empresa).order_by('apellido_paterno', 'nombres'):
        contrato = Contrato.objects.filter(empleado=e).first()
        salida.append({'id': e.id, 'nombre': _nombre_emp(e), 'rut': e.rut, 'cargo': (e.cargo or '').title(),
                       'activo': e.activo, 'fecha_ingreso': e.fecha_ingreso.isoformat() if e.fecha_ingreso else None,
                       'fecha_desvinculacion': e.fecha_desvinculacion.isoformat() if e.fecha_desvinculacion else None,
                       'tipo_contrato': contrato.get_tipo_contrato_display() if contrato else '',
                       'horas_semanales': float(contrato.horas_semanales) if contrato else None})
    return Response(salida)


def _firmas_por(empresa):
    """{(campo, id): solicitud más reciente no cancelada} para marcar el estado de firma."""
    salida = {}
    for s in SolicitudFirma.objects.filter(empresa=empresa).exclude(estado='CANCELADO').order_by('enviado_en'):
        for campo in ('contrato', 'anexo_contrato', 'liquidacion', 'documento_legal', 'vacacion', 'finiquito',
                      'documento_laboral'):
            ident = getattr(s, f'{campo}_id')
            if ident and not (campo == 'contrato' and s.tipo_documento != 'CONTRATO'):
                salida[(campo, ident)] = s
    return salida


def _firma(s):
    if not s:
        return None
    return {'estado': s.estado, 'firmado_en': s.firmado_en.isoformat() if s.firmado_en else None,
            'folio': s.folio, 'enviado_en': s.enviado_en.isoformat() if s.enviado_en else None}


def catalogo(empresa):
    """Todos los documentos laborales de la empresa (sin límites), con su estado de firma."""
    firmas = _firmas_por(empresa)
    docs = []

    def agregar(clave, tipo, titulo, emp, fecha, firma):
        docs.append({'clave': clave, 'tipo': tipo, 'titulo': titulo, 'empleado': emp.id, 'trabajador': _nombre_emp(emp),
                     'rut': emp.rut, 'fecha': fecha.isoformat() if fecha else None, 'firma': _firma(firma)})

    empleados = Empleado.objects.filter(empresa=empresa)
    for c in Contrato.objects.filter(empleado__in=empleados).select_related('empleado'):
        agregar(f'contrato:{c.id}', 'CONTRATO', f'Contrato de trabajo ({c.get_tipo_contrato_display().lower()})',
                c.empleado, c.fecha_inicio, firmas.get(('contrato', c.id)))
    for s in SolicitudFirma.objects.filter(empresa=empresa, tipo_documento='ANEXO_40H').exclude(
            estado='CANCELADO').select_related('empleado'):
        agregar(f'anexo40h:{s.id}', 'ANEXO', 'Anexo Ley 40 horas', s.empleado, timezone.localtime(s.enviado_en).date(), s)
    for a in AnexoContrato.objects.filter(contrato__empleado__in=empleados).select_related('contrato__empleado'):
        agregar(f'anexo:{a.id}', 'ANEXO', f'Anexo: {a.titulo}', a.contrato.empleado, a.fecha_emision,
                firmas.get(('anexo_contrato', a.id)))
    for liq in Liquidacion.objects.filter(empleado__in=empleados).select_related('empleado'):
        agregar(f'liquidacion:{liq.id}', 'LIQUIDACION',
                f'Liquidación de sueldo {_MESES[liq.mes - 1]} {liq.anio}', liq.empleado,
                datetime.date(liq.anio, liq.mes, 1), firmas.get(('liquidacion', liq.id)))
    for d in DocumentoLegal.objects.filter(empleado__in=empleados).select_related('empleado'):
        agregar(f'legal:{d.id}', 'CARTA', d.get_tipo_display(), d.empleado, d.fecha_emision,
                firmas.get(('documento_legal', d.id)))
    for v in VacacionEmpleado.objects.filter(empleado__in=empleados).select_related('empleado'):
        agregar(f'vacacion:{v.id}', 'VACACION', f'{v.get_tipo_display()} ({v.get_estado_display().lower()})',
                v.empleado, v.fecha_inicio, firmas.get(('vacacion', v.id)))
    for f in Finiquito.objects.filter(empleado__in=empleados).select_related('empleado'):
        titulo = 'Finiquito' + (f' (ratificado: {f.get_ratificado_via_display().lower()})' if f.ratificado_en
                                else ' (sin ratificación registrada)')
        agregar(f'finiquito:{f.id}', 'FINIQUITO', titulo, f.empleado, f.fecha_termino, firmas.get(('finiquito', f.id)))
    for d in DocumentoLaboral.objects.filter(empleado__in=empleados, activo=True).select_related('empleado'):
        agregar(f'laboral:{d.id}', 'PACTO', d.get_tipo_display(), d.empleado, d.fecha_emision,
                firmas.get(('documento_laboral', d.id)))
    ratificados = {}
    for r in RatificacionInspeccion.objects.filter(empresa=empresa):
        ratificados.setdefault(r.clave, []).append({'inspector': r.inspector_nombre,
                                                    'fecha': r.ratificado_en.isoformat()})
    for d in docs:
        d['ratificaciones'] = ratificados.get(d['clave'], [])
    docs.sort(key=lambda d: (d['fecha'] or ''), reverse=True)
    return docs


@api_view(['GET'])
@_con_sesion
def documentos(request):
    docs = catalogo(request.user.empresa)
    p = request.query_params
    if p.get('empleado'):
        docs = [d for d in docs if str(d['empleado']) == p['empleado']]
    if p.get('tipo'):
        docs = [d for d in docs if d['tipo'] == p['tipo']]
    if p.get('desde'):
        docs = [d for d in docs if (d['fecha'] or '') >= p['desde']]
    if p.get('hasta'):
        docs = [d for d in docs if (d['fecha'] or '') <= p['hasta']]
    return Response(docs)


def _pdf(empresa, clave):
    """(pdf, titulo, firmado) del documento de la empresa; LookupError si no es suyo."""
    tipo, _, ident = str(clave).partition(':')
    try:
        ident = int(ident)
    except ValueError:
        raise LookupError
    emp_qs = Empleado.objects.filter(empresa=empresa)
    if tipo == 'contrato':
        c = Contrato.objects.get(id=ident, empleado__in=emp_qs)
        firmado = pdf_firmado('CONTRATO', contrato=c)
        return firmado or _html_a_pdf_bytes(render_to_string('contrato_trabajo.html', _ctx_contrato(c, False)),
                                            'Contrato'), 'Contrato', bool(firmado)
    if tipo == 'anexo40h':
        s = SolicitudFirma.objects.get(id=ident, empresa=empresa, tipo_documento='ANEXO_40H')
        firmado = pdf_firmado('ANEXO_40H', contrato=s.contrato) if s.estado == 'FIRMADO' else None
        return firmado or _html_a_pdf_bytes(render_to_string('anexo_40h.html', _ctx_contrato(s.contrato, False)),
                                            'Anexo40h'), 'Anexo_40h', bool(firmado)
    if tipo == 'anexo':
        from .documentos import pdf_anexo_contrato
        a = AnexoContrato.objects.get(id=ident, contrato__empleado__in=emp_qs)
        firmado = pdf_firmado('ANEXO_CONTRATO', anexo_contrato=a)
        return firmado or pdf_anexo_contrato(a, False), 'Anexo', bool(firmado)
    if tipo == 'liquidacion':
        from .calculo_liquidacion import _pdf_liquidacion
        liq = Liquidacion.objects.get(id=ident, empleado__in=emp_qs)
        firmado = pdf_firmado('LIQUIDACION', liquidacion=liq)
        return firmado or _pdf_liquidacion(liq, False), f'Liquidacion_{liq.anio}_{liq.mes:02d}', bool(firmado)
    if tipo == 'legal':
        from .documentos import pdf_documento_legal
        d = DocumentoLegal.objects.get(id=ident, empleado__in=emp_qs)
        firmado = pdf_firmado(['AMONESTACION', 'CONSTANCIA', 'DESPIDO'], documento_legal=d)
        return firmado or pdf_documento_legal(d, False), d.tipo.title(), bool(firmado)
    if tipo == 'vacacion':
        from .vacaciones import pdf_vacacion
        v = VacacionEmpleado.objects.get(id=ident, empleado__in=emp_qs)
        firmado = pdf_firmado('VACACION', vacacion=v)
        return firmado or pdf_vacacion(v, False), 'Vacaciones', bool(firmado)
    if tipo == 'finiquito':
        from .finiquitos import pdf_finiquito
        f = Finiquito.objects.get(id=ident, empleado__in=emp_qs)
        firmado = pdf_firmado('FINIQUITO', finiquito=f)
        return firmado or pdf_finiquito(f), 'Finiquito', bool(firmado)
    if tipo == 'laboral':
        from .documentos_laborales import pdf_documento_laboral
        d = DocumentoLaboral.objects.get(id=ident, empleado__in=emp_qs)
        firmado = pdf_firmado(d.tipo, documento_laboral=d)
        return firmado or pdf_documento_laboral(d, False), d.tipo.title(), bool(firmado)
    raise LookupError


def _con_ratificaciones(pdf, ratificaciones):
    """Agrega una página por cada ratificación en terreno (firma e identificación del inspector)."""
    if not ratificaciones:
        return pdf
    from pypdf import PdfReader, PdfWriter
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas
    import base64
    writer = PdfWriter()
    for pagina in PdfReader(io.BytesIO(pdf)).pages:
        writer.add_page(pagina)
    for r in ratificaciones:
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        ancho, alto = A4
        c.setFont('Helvetica-Bold', 13)
        c.drawString(2 * cm, alto - 2.5 * cm, 'RATIFICACIÓN DE INSPECTOR DEL TRABAJO')
        c.setFont('Helvetica', 10)
        cuando = timezone.localtime(r.ratificado_en).strftime('%d/%m/%Y %H:%M')
        lineas = [f'Documento: {r.titulo}', f'Inspector: {r.inspector_nombre} · RUT {formatear_rut(r.inspector_rut)}',
                  f'Correo institucional: {r.inspector_correo}', f'Fecha y hora: {cuando} (hora de Chile)',
                  f'IP: {r.ip or "no registrada"}']
        for n, linea in enumerate(lineas):
            c.drawString(2 * cm, alto - (3.6 + n * 0.7) * cm, linea)
        try:
            datos = base64.b64decode(r.firma_imagen.split(',', 1)[1])
            c.drawImage(ImageReader(io.BytesIO(datos)), 2 * cm, alto - 12 * cm, 8 * cm, 4 * cm,
                        preserveAspectRatio=True, mask='auto')
        except Exception:
            c.drawString(2 * cm, alto - 10 * cm, '(firma no legible)')
        c.line(2 * cm, alto - 12.3 * cm, 10 * cm, alto - 12.3 * cm)
        c.drawString(2 * cm, alto - 12.9 * cm, 'Firma del inspector')
        c.save()
        writer.add_page(PdfReader(io.BytesIO(buf.getvalue())).pages[0])
    salida = io.BytesIO()
    writer.write(salida)
    return salida.getvalue()


@api_view(['GET'])
@_con_sesion
def descargar(request):
    i = request.user
    clave = request.query_params.get('clave', '')
    try:
        pdf, nombre, firmado = _pdf(i.empresa, clave)
        if pdf is None:
            raise LookupError
    except (LookupError, AttributeError, Contrato.DoesNotExist, AnexoContrato.DoesNotExist, Liquidacion.DoesNotExist,
            DocumentoLegal.DoesNotExist, VacacionEmpleado.DoesNotExist, Finiquito.DoesNotExist,
            DocumentoLaboral.DoesNotExist, SolicitudFirma.DoesNotExist):
        return Response({'error': 'Documento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception:
        logger.exception('Inspección: no se pudo generar %s', clave)
        return Response({'error': 'No pudimos generar el documento.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    pdf = _con_ratificaciones(pdf, list(RatificacionInspeccion.objects.filter(empresa=i.empresa, clave=clave)
                                        .order_by('ratificado_en')))
    _registrar(i.empresa, i.correo, i.nombre, i.rut, 'DESCARGA', request, clave)
    return respuesta_pdf(pdf, f'{nombre}.pdf', firmado=firmado)


@api_view(['POST'])
@_con_sesion
def ratificar(request):
    """Firma del inspector sobre un documento, en terreno, con su sola identificación."""
    i = request.user
    clave = str(request.data.get('clave') or '')
    firma = str(request.data.get('firma') or '')
    doc = next((d for d in catalogo(i.empresa) if d['clave'] == clave), None)
    if doc is None:
        return Response({'error': 'Documento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    if not firma.startswith('data:image/') or len(firma) > 500_000:
        return Response({'error': 'Dibuja tu firma.'}, status=status.HTTP_400_BAD_REQUEST)
    r = RatificacionInspeccion.objects.create(
        empresa=i.empresa, clave=clave, titulo=f"{doc['titulo']} · {doc['trabajador']}", inspector_nombre=i.nombre,
        inspector_rut=i.rut, inspector_correo=i.correo, firma_imagen=firma, ip=_ip(request))
    _registrar(i.empresa, i.correo, i.nombre, i.rut, 'RATIFICACION', request, clave)
    return Response({'clave': clave, 'ratificado_en': r.ratificado_en.isoformat()}, status=status.HTTP_201_CREATED)


# ── Panel del empleador: bitácora ────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bitacora_empleador(request):
    """Accesos de fiscalización a una empresa del empleador (transparencia, solo lectura)."""
    empresa = Empresa.objects.filter(pk=request.query_params.get('empresa') or 0, owner=request.user).first()
    if empresa is None:
        return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
    return Response([{'accion': r.accion, 'accion_texto': r.get_accion_display(), 'inspector': r.nombre,
                      'correo': r.correo, 'detalle': r.detalle, 'fecha': r.creado_en.isoformat()}
                     for r in RegistroInspeccion.objects.filter(empresa=empresa)[:200]])
