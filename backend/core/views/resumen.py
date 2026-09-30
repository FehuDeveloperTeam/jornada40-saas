"""Resumen por correo para el empleador.

El comando diario `enviar_resumenes` revisa a cada cliente según su frecuencia
(cada día, cada lunes o nunca) y le envía, por empresa, lo que requiere su
atención: solicitudes de sus trabajadores, firmas por vencer, vencidas o
rechazadas y plazos del registro en Mi DT. Si no hay nada que contar no se
envía correo. Cada tema es una función en FUENTES; los módulos nuevos (Ley
Karin, horas compensatorias, EPP…) agregan la suya.

`Cliente.resumen_hasta` marca el momento revisado: lo "nuevo" del siguiente
resumen es lo ocurrido desde ahí.

Los usuarios del equipo reciben el suyo (misma frecuencia a elegir en Mi
cuenta), solo con los temas de sus módulos y de sus empresas.
"""
from functools import partial
import logging
from datetime import date, timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Cliente, Contrato, Empleado, Empresa, SolicitudDocumento, SolicitudFirma, UsuarioEquipo
from ..permisos import MODULO_POR_TIPO, MODULOS_DOCUMENTOS
from .base import _plan_permite
from . import horas_compensatorias as hc
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


def _firmas(empresa, desde, hoy, tipos=None):
    qs = SolicitudFirma.objects.filter(empresa=empresa)
    SolicitudFirma.actualizar_estados(qs)
    if tipos is not None:
        qs = qs.filter(tipo_documento__in=tipos)
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


# Horas de descanso por horas extra que vencen dentro de estos días.
DIAS_AVISO_DESCANSO = 30


def _horas_descanso(empresa, desde, hoy):
    """Horas de descanso (Art. 32 inc. 4°) por vencer: si no se usan, se pagan."""
    if not hc.permite_compensacion(empresa.owner):
        return None
    lineas = []
    for contrato in Contrato.objects.filter(empleado__empresa=empresa, empleado__activo=True).select_related('empleado'):
        b = hc.bolsa(contrato.empleado, hasta=hoy)
        for lote in b['lotes']:
            if not lote['vencido'] and lote['saldo'] > 0 and (lote['vence'] - hoy).days <= DIAS_AVISO_DESCANSO:
                lineas.append(f'{_nombre(contrato.empleado)} tiene {hc._horas(lote["saldo"])} h de descanso que vencen '
                              f'el {_fecha(lote["vence"])}. Si no las usa, se le pagan en la liquidación de ese mes.')
    return _seccion('Días libres por horas extra por vencer', lineas, '/app/trabajadores', 'Ver trabajadores')


def _reglamento_y_ley_karin(empresa, desde, hoy):
    """Reglamento interno (remisión, entregas) y aviso semestral de la Ley Karin (Pyme+)."""
    from .ley_karin import NIVEL_LEY_KARIN, avance_semestre, semestre
    from .reglamento import avisos_reglamento, entrega, vigente
    if not _plan_permite(empresa.owner, NIVEL_LEY_KARIN):
        return None
    trabajadores = Empleado.objects.filter(empresa=empresa, activo=True).count()
    if not trabajadores:
        return None
    actual = vigente(empresa)
    lineas = list(avisos_reglamento(empresa, hoy, trabajadores, actual))
    if actual:
        e = entrega(actual)
        faltan = e['total'] - e['firmados']
        if faltan:
            lineas.append(f'{faltan} de {e["total"]} trabajadores aún no firman la recepción del reglamento.')
    clave, texto, _, fin = semestre(hoy)
    avance = avance_semestre(empresa, clave)
    if avance['enviados'] < avance['total']:
        lineas.append(f'Falta informar los canales de denuncia del {texto} (Ley Karin) a '
                      f'{avance["total"] - avance["enviados"]} trabajadores; plazo: {_fecha(fin)}.')
    return _seccion('Reglamento interno y Ley Karin', lineas, '/app/reglamento', 'Ver reglamento')


def _seguridad(empresa, desde, hoy):
    """Información de riesgos pendiente (Pyme+) y refuerzo anual de la capacitación en EPP (todos)."""
    from .documentos_laborales import NIVEL_RIESGOS, avisos_seguridad
    permite = _plan_permite(empresa.owner, NIVEL_RIESGOS)
    sin_riesgos, refuerzo = [], []
    for emp in Empleado.objects.filter(empresa=empresa, activo=True).order_by('apellido_paterno', 'nombres'):
        for aviso in avisos_seguridad(emp, hoy, permite):
            (refuerzo if 'capacitación en el uso' in aviso else sin_riesgos).append(_nombre(emp))
    lineas = []
    if sin_riesgos:
        lineas.append(f'Falta informar los riesgos de su trabajo (o actualizarlos por cambio de cargo) a: '
                      f'{", ".join(sin_riesgos[:MAX_LINEAS])}{" y otros" if len(sin_riesgos) > MAX_LINEAS else ""}.')
    if refuerzo:
        lineas.append(f'Toca reforzar la capacitación anual en elementos de protección de: '
                      f'{", ".join(refuerzo[:MAX_LINEAS])}{" y otros" if len(refuerzo) > MAX_LINEAS else ""}.')
    return _seccion('Seguridad en el trabajo', lineas, '/app/reglamento' if sin_riesgos else '/app/trabajadores',
                    'Ver seguridad' if sin_riesgos else 'Ver trabajadores')


FUENTES = [_solicitudes, _firmas, _registro_dt, _horas_descanso, _reglamento_y_ley_karin, _seguridad]
# Módulos que dan acceso a cada tema a un usuario del equipo (basta uno).
MODULOS_FUENTE = {
    _solicitudes: ('SOLICITUDES',), _firmas: MODULOS_DOCUMENTOS, _registro_dt: ('DIRECCION_TRABAJO',),
    _horas_descanso: ('VACACIONES',), _reglamento_y_ley_karin: ('SEGURIDAD',), _seguridad: ('SEGURIDAD',),
}


def _fuentes(permisos):
    """Temas que ve alguien: el titular todos; un usuario del equipo, los de sus módulos."""
    if permisos is None:
        return FUENTES
    tipos = {t for t, m in MODULO_POR_TIPO.items() if permisos.get(m)}
    elegidas = []
    for fuente in FUENTES:
        if any(permisos.get(m) for m in MODULOS_FUENTE[fuente]):
            # Las firmas se limitan a los tipos de documento de sus módulos.
            elegidas.append(partial(_firmas, tipos=tipos) if fuente is _firmas else fuente)
    return elegidas


def contenido(cliente, desde, hoy=None, *, empresas=None, permisos=None):
    """Secciones del resumen por empresa; lista vacía si no hay nada que contar.

    Para un usuario del equipo se pasan sus `empresas` y sus `permisos`."""
    hoy = hoy or timezone.localdate()
    if empresas is None:
        empresas = Empresa.objects.filter(owner=cliente.usuario, activo=True)
    fuentes = _fuentes(permisos)
    resultado = []
    for empresa in empresas.order_by('nombre_legal'):
        secciones = []
        for fuente in fuentes:
            try:
                s = fuente(empresa, desde, hoy)
            except Exception:
                # Un tema que falla no deja sin resumen al cliente.
                nombre = getattr(fuente, '__name__', None) or fuente.func.__name__
                logger.exception('Resumen: falló %s en la empresa %s', nombre, empresa.id)
                s = None
            if s:
                secciones.append(s)
        if secciones:
            resultado.append({'nombre': empresa.alias or empresa.nombre_legal, 'secciones': secciones})
    return resultado


def corresponde(cliente, hoy):
    """Si hoy toca enviarle el resumen (a un titular o a un usuario del equipo).
    Semanal = los lunes (o si se saltó uno)."""
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
    """Arma y envía el resumen del titular. Devuelve True si se envió un correo."""
    return _enviar(cliente, cliente.nombres, _correo(cliente), hoy, ahora, lambda desde, dia: contenido(cliente, desde, dia))


def enviar_equipo(ue, hoy=None, ahora=None):
    """Resumen de un usuario del equipo: solo sus módulos y sus empresas activas."""
    cliente = ue.cuenta.perfil_cliente
    empresas = ue.empresas.filter(activo=True, owner=ue.cuenta)
    return _enviar(ue, ue.nombres, ue.correo, hoy, ahora,
                   lambda desde, dia: contenido(cliente, desde, dia, empresas=empresas, permisos=ue.permisos or {}),
                   equipo=True)


def _enviar(destinatario, nombre, correo, hoy, ahora, armar, equipo=False):
    hoy = hoy or timezone.localdate()
    ahora = ahora or timezone.now()
    dias = 1 if destinatario.frecuencia_resumen == 'DIARIA' else 7
    desde = destinatario.resumen_hasta or ahora - timedelta(days=dias)
    empresas = armar(desde, hoy)
    enviado = False
    correo = (correo or '').strip()
    if empresas and correo:
        sitio = getattr(settings, 'SITIO_URL', 'https://jornada40.cl').rstrip('/')
        ctx = {'nombre': nombre, 'empresas': empresas, 'sitio': sitio, 'equipo': equipo,
               'fecha': _fecha(hoy), 'diario': destinatario.frecuencia_resumen == 'DIARIA'}
        html = render_to_string('resumen_empleador.html', ctx)
        texto = render_to_string('resumen_empleador.txt', ctx)
        asunto = f'Jornada40: {sum(len(e["secciones"]) for e in empresas)} temas por revisar'
        msg = EmailMultiAlternatives(asunto, texto, settings.DEFAULT_FROM_EMAIL, to=[correo])
        msg.attach_alternative(html, 'text/html')
        msg.send()
        enviado = True
    destinatario.resumen_hasta = ahora
    destinatario.save(update_fields=['resumen_hasta'])
    return enviado


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def preferencia_resumen(request):
    """Frecuencia del resumen por correo (lista cerrada), del titular o del usuario del equipo."""
    ue = UsuarioEquipo.objects.filter(usuario=request.user, estado='ACTIVO').first()
    cliente = ue or getattr(request.user, 'perfil_cliente', None)
    if not cliente:
        return Response({'error': 'Perfil no encontrado.'}, status=404)
    if request.method == 'PATCH':
        frecuencia = request.data.get('frecuencia')
        if frecuencia not in dict(Cliente.FRECUENCIAS_RESUMEN):
            return Response({'error': 'Elige una de las opciones.'}, status=400)
        cliente.frecuencia_resumen = frecuencia
        cliente.save(update_fields=['frecuencia_resumen'])
    return Response({'frecuencia': cliente.frecuencia_resumen, 'correo': ue.correo if ue else _correo(cliente),
                     'opciones': [{'valor': v, 'texto': t} for v, t in Cliente.FRECUENCIAS_RESUMEN]})
