"""Peticiones del trabajador desde su portal: vacaciones (y permiso sin goce o día
libre por horas extra), permisos legales con goce y solicitudes de conciliación
(Ley 21.645). El trabajador pide; el empleador aprueba o rechaza desde
/app/solicitudes. Todo de listas cerradas; los cálculos son del backend.

Reglas comunes: solo fichas accesibles (plan Pyme, correo verificado), fechas
desde hoy y hasta 12 meses adelante, máximo `MAX_PENDIENTES` peticiones
pendientes por ficha. Al pedir, aviso por correo al titular; al responder,
aviso al trabajador. Avisos, nunca bloqueos, salvo lo que la ley no permite.
"""
import datetime

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Contrato, DocumentoLaboral, Empleado, SolicitudConciliacion, SolicitudPermiso, VacacionEmpleado
from ..proteccion import CUIDADO_MENORES, CUIDADOS, vacaciones_escolares
from .base import _plan_permite, logger
from .feriado import _calcular_dias_habiles_vacacion, calcular_saldo_vacaciones
from . import horas_compensatorias as hc
from .portal_trabajador import _con_sesion, _empleo, fichas_accesibles

MAX_PENDIENTES = 5
MESES_ADELANTE = 12
TIPOS_VACACION = {
    'VACACION_LEGAL': 'Feriado legal (vacaciones)',
    'VACACION_PROGRESIVA': 'Feriado progresivo',
    'PERMISO_SIN_GOCE': 'Permiso sin goce de sueldo',
    'DIA_COMPENSATORIO': 'Día libre por horas extra',
}
DESCUENTAN_SALDO = ('VACACION_LEGAL', 'VACACION_PROGRESIVA')
# Textos para el trabajador (las vacaciones y las solicitudes son femeninas; el permiso, masculino).
ESTADO_VACACION = {'PENDIENTE': 'Esperando respuesta', 'APROBADO': 'Aprobada', 'RECHAZADO': 'Rechazada'}
ESTADO_PERMISO = {'PENDIENTE': 'Esperando respuesta', 'APROBADA': 'Aprobado', 'RECHAZADA': 'Rechazado'}
ESTADO_CONCILIACION = {'PENDIENTE': 'Esperando respuesta', 'ACEPTADA': 'Aceptada',
                       'ALTERNATIVA': 'Te ofrecieron otra fórmula', 'RECHAZADA': 'Rechazada'}


class PeticionInvalida(Exception):
    pass


def _sitio():
    return getattr(settings, 'SITIO_URL', 'https://jornada40.cl').rstrip('/')


def _nombre(emp):
    return f'{emp.nombres} {emp.apellido_paterno}'.strip().title()


def _correo(destino, asunto, contexto):
    """Aviso por correo; si falla, solo se anota (la petición ya quedó guardada)."""
    if not destino:
        return
    try:
        msg = EmailMultiAlternatives(asunto, render_to_string('peticion_aviso.txt', contexto),
                                     settings.DEFAULT_FROM_EMAIL, to=[destino])
        msg.attach_alternative(render_to_string('peticion_aviso.html', contexto), 'text/html')
        msg.send()
    except Exception:
        logger.exception('No se pudo enviar el aviso de petición del portal (%s)', asunto)


def avisar_empleador(emp, que):
    duenio = emp.empresa.owner
    destino = duenio.email or getattr(getattr(duenio, 'perfil_cliente', None), 'correo', '')
    _correo(destino, f'{_nombre(emp)} hizo una solicitud en su portal', {
        'titulo': 'Nueva solicitud de un trabajador', 'empresa': emp.empresa.nombre_legal.title(),
        'saludo': (duenio.first_name or '').title() or 'empleador',
        'parrafos': [f'{_nombre(emp)} pidió desde su portal: {que}.',
                     'Revísala y responde en Jornada40: el trabajador recibirá tu respuesta por correo.'],
        'enlace': f'{_sitio()}/app/solicitudes', 'boton': 'Ver solicitudes'})


def avisar_trabajador(emp, que, respuesta, detalle=''):
    _correo(emp.email, f'Respuesta a tu solicitud: {que}', {
        'titulo': 'Respondieron tu solicitud', 'empresa': emp.empresa.nombre_legal.title(),
        'saludo': (emp.nombres or '').split(' ')[0].title() or 'trabajador',
        'parrafos': [f'Tu solicitud de {que} fue: {respuesta}.'] + ([detalle] if detalle else []),
        'enlace': f'{_sitio()}/trabajador', 'boton': 'Ver en mi portal'})


# ── Reglas ───────────────────────────────────────────────────────────────────

def _ficha(cuenta, empleo_id):
    try:
        empleo_id = int(empleo_id)
    except (TypeError, ValueError):
        raise PeticionInvalida('Elige la empresa.')
    for emp in fichas_accesibles(cuenta):
        if emp.id == empleo_id:
            if not emp.activo:
                raise PeticionInvalida('Ya no trabajas en esta empresa: no puedes hacer solicitudes.')
            return emp
    raise PeticionInvalida('Elige la empresa.')


def pendientes_de(emp):
    return (VacacionEmpleado.objects.filter(empleado=emp, origen='PORTAL', estado='PENDIENTE').count()
            + SolicitudPermiso.objects.filter(empleado=emp, estado='PENDIENTE').count()
            + SolicitudConciliacion.objects.filter(empleado=emp, activo=True, origen='PORTAL', estado='PENDIENTE').count())


def _limite_pendientes(emp):
    if pendientes_de(emp) >= MAX_PENDIENTES:
        raise PeticionInvalida(f'Tienes {MAX_PENDIENTES} solicitudes esperando respuesta. Espera a que respondan alguna.')


def _fecha(valor, nombre):
    try:
        return datetime.date.fromisoformat(str(valor))
    except (TypeError, ValueError):
        raise PeticionInvalida(f'Indica {nombre}.')


def _rango(desde, hasta, hoy):
    if hasta < desde:
        raise PeticionInvalida('La fecha de término es anterior a la de inicio.')
    if desde < hoy:
        raise PeticionInvalida('Solo puedes pedir fechas desde hoy en adelante.')
    if hasta > hoy + datetime.timedelta(days=365 * MESES_ADELANTE // 12):
        raise PeticionInvalida(f'Solo puedes pedir hasta {MESES_ADELANTE} meses adelante.')


def calcular_vacacion(emp, tipo, desde, hasta, hoy):
    """(días, horas, avisos) de una petición de vacaciones, sin guardarla."""
    if tipo not in TIPOS_VACACION:
        raise PeticionInvalida('Elige el tipo de la lista.')
    _rango(desde, hasta, hoy)
    avisos, horas = [], 0
    if tipo == 'DIA_COMPENSATORIO':
        contrato = Contrato.objects.filter(empleado=emp).first()
        if not hc.permite_compensacion(emp.empresa.owner) or not contrato:
            raise PeticionInvalida('Tu empresa no tiene días libres por horas extra.')
        horas = hc.horas_de_uso(contrato, desde, hasta)
        if horas <= 0:
            raise PeticionInvalida('En esas fechas no tienes jornada: elige días en que trabajas.')
        dias = sum(1 for n in range((hasta - desde).days + 1)
                   if hc.horas_del_dia(contrato, desde + datetime.timedelta(days=n)) > 0)
        disponibles = hc.bolsa(emp, hasta=desde)['disponibles']
        if horas > disponibles + 0.01:
            avisos.append(f'Esos días suman {hc._horas(horas)} h y tienes {hc._horas(disponibles)} h de descanso '
                          'disponibles: tu empleador no podrá aprobarlo completo.')
        if desde < hoy + datetime.timedelta(days=2):
            avisos.append('El día libre por horas extra se avisa con 48 horas de anticipación (Art. 32).')
    else:
        dias = _calcular_dias_habiles_vacacion(desde, hasta)
        if tipo in DESCUENTAN_SALDO:
            try:
                saldo = calcular_saldo_vacaciones(emp)['dias_disponibles']
            except Exception:
                saldo = None
            if saldo is not None and dias > saldo:
                avisos.append(f'Pides {dias} días hábiles y tienes {saldo:g} disponibles: sería un feriado '
                              'anticipado y queda a criterio de tu empleador.')
    cruce = VacacionEmpleado.objects.filter(empleado=emp, estado__in=('PENDIENTE', 'APROBADO'),
                                            fecha_inicio__lte=hasta, fecha_fin__gte=desde)
    if cruce.exists():
        avisos.append('Se cruza con otras vacaciones o permisos que ya tienes pedidos o aprobados.')
    if emp.cuidado_de in CUIDADO_MENORES and tipo in DESCUENTAN_SALDO:
        if any(p.desde <= hasta and p.hasta >= desde for p in vacaciones_escolares(hoy, cuantas=6)):
            avisos.append('Estas fechas caen en vacaciones escolares: como cuidas a un menor, tienes preferencia '
                          'para tu feriado en ese período (Ley 21.645).')
    return dias, horas, avisos


def _validar_permiso(emp, d, hoy):
    from .documentos_laborales import DatoInvalido, _permiso
    try:
        return _permiso(emp, Contrato.objects.filter(empleado=emp).first(), d, hoy)
    except DatoInvalido as e:
        raise PeticionInvalida(str(e))


# ── Datos para el portal ─────────────────────────────────────────────────────

def _vacacion_dato(v):
    return {'id': v.id, 'tipo': v.tipo, 'tipo_texto': TIPOS_VACACION.get(v.tipo, v.get_tipo_display()),
            'desde': v.fecha_inicio.isoformat(), 'hasta': v.fecha_fin.isoformat(), 'dias': v.dias_habiles,
            'estado': v.estado, 'estado_texto': ESTADO_VACACION.get(v.estado, v.estado),
            'motivo': v.get_motivo_rechazo_display() if v.motivo_rechazo else '', 'pedida_en': v.creado_en.isoformat()}


def _permiso_dato(s):
    from .documentos_laborales import PERMISOS
    return {'id': s.id, 'permiso': s.permiso, 'permiso_texto': PERMISOS.get(s.permiso, ('',))[0],
            'fecha_hecho': s.fecha_hecho.isoformat(), 'inicio': s.inicio.isoformat() if s.inicio else None,
            'estado': s.estado, 'estado_texto': ESTADO_PERMISO.get(s.estado, s.estado),
            'motivo': s.get_motivo_rechazo_display() if s.motivo_rechazo else '', 'pedida_en': s.creada_en.isoformat()}


def _conciliacion_dato(s):
    return {'id': s.id, 'tipo': s.tipo, 'tipo_texto': s.get_tipo_display(), 'presentada_el': s.presentada_el.isoformat(),
            'desde': s.desde.isoformat() if s.desde else None, 'hasta': s.hasta.isoformat() if s.hasta else None,
            'estado': s.estado, 'estado_texto': ESTADO_CONCILIACION.get(s.estado, s.estado),
            'motivo': s.get_motivo_display() if s.motivo else '', 'fundamento': s.fundamento,
            'vence_el': s.vence_el.isoformat(), 'respondida_el': s.respondida_el.isoformat() if s.respondida_el else None}


def _opciones(emp):
    from .documentos_laborales import PERMISOS
    tipos = [k for k in TIPOS_VACACION if k != 'DIA_COMPENSATORIO']
    contrato = Contrato.objects.filter(empleado=emp).first()
    if contrato and hc.permite_compensacion(emp.empresa.owner) and hc.bolsa(emp)['disponibles'] > 0:
        tipos.append('DIA_COMPENSATORIO')
    return {
        'tipos_vacacion': [{'valor': k, 'texto': TIPOS_VACACION[k]} for k in tipos],
        'permisos': [{'valor': k, 'texto': v[0], 'dias': v[1], 'tipo_dias': v[2], 'desde_el_hecho': k.startswith('FALLECIMIENTO') and k != 'FALLECIMIENTO_GESTACION'}
                     for k, v in PERMISOS.items()],
        'conciliacion': [{'valor': v, 'texto': t, 'plazo_dias': SolicitudConciliacion.PLAZO_RESPUESTA[v]}
                         for v, t in SolicitudConciliacion.TIPOS],
        'cuidados': [{'valor': v, 'texto': t} for v, t in CUIDADOS],
        'cuidados_menores': [{'valor': v, 'texto': t} for v, t in CUIDADOS if v in CUIDADO_MENORES],
    }


@api_view(['GET'])
@_con_sesion
def peticiones(request):
    """GET /api/trabajador/peticiones/ — por empleo: lo pedido, sus respuestas y las listas para pedir."""
    salida = []
    for emp in fichas_accesibles(request.user):
        if not emp.activo:
            continue
        salida.append({
            **_empleo(emp), 'cuida': emp.cuidado_de, 'cuida_menores': emp.cuidado_de in CUIDADO_MENORES,
            'opciones': _opciones(emp),
            'vacaciones': [_vacacion_dato(v) for v in VacacionEmpleado.objects.filter(empleado=emp, origen='PORTAL')
                           .order_by('-creado_en')[:30]],
            'permisos': [_permiso_dato(s) for s in SolicitudPermiso.objects.filter(empleado=emp)[:30]],
            'conciliacion': [_conciliacion_dato(s) for s in SolicitudConciliacion.objects.filter(empleado=emp, activo=True)[:30]],
        })
    return Response(salida)


@api_view(['POST'])
@_con_sesion
def calcular(request):
    """POST /api/trabajador/peticiones/calcular/ {empleo, tipo, desde, hasta} — vista previa sin guardar."""
    hoy = timezone.localdate()
    try:
        emp = _ficha(request.user, request.data.get('empleo'))
        dias, horas, avisos = calcular_vacacion(emp, request.data.get('tipo'), _fecha(request.data.get('desde'), 'desde'),
                                                _fecha(request.data.get('hasta'), 'hasta'), hoy)
    except PeticionInvalida as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    try:
        saldo = calcular_saldo_vacaciones(emp)['dias_disponibles']
    except Exception:
        saldo = None
    return Response({'dias': dias, 'horas': horas, 'saldo': saldo, 'avisos': avisos})


@api_view(['POST'])
@_con_sesion
def pedir_vacaciones(request):
    """POST /api/trabajador/peticiones/vacaciones/ {empleo, tipo, desde, hasta}."""
    hoy = timezone.localdate()
    try:
        emp = _ficha(request.user, request.data.get('empleo'))
        _limite_pendientes(emp)
        tipo = request.data.get('tipo')
        desde, hasta = _fecha(request.data.get('desde'), 'desde'), _fecha(request.data.get('hasta'), 'hasta')
        dias, horas, avisos = calcular_vacacion(emp, tipo, desde, hasta, hoy)
    except PeticionInvalida as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    v = VacacionEmpleado.objects.create(empleado=emp, empresa=emp.empresa, tipo=tipo, fecha_inicio=desde,
                                        fecha_fin=hasta, dias_habiles=dias, horas_compensatorias=horas,
                                        estado='PENDIENTE', origen='PORTAL')
    avisar_empleador(emp, f'{TIPOS_VACACION[tipo].lower()} del {desde:%d-%m-%Y} al {hasta:%d-%m-%Y}')
    return Response({**_vacacion_dato(v), 'avisos': avisos}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@_con_sesion
def pedir_permiso(request):
    """POST /api/trabajador/peticiones/permisos/ {empleo, permiso, fecha_hecho, inicio?}."""
    hoy = timezone.localdate()
    try:
        emp = _ficha(request.user, request.data.get('empleo'))
        _limite_pendientes(emp)
        d = {k: request.data.get(k) for k in ('permiso', 'fecha_hecho', 'inicio')}
        armado, _ = _validar_permiso(emp, d, hoy)
        hecho = _fecha(d['fecha_hecho'], 'la fecha del hecho')
        if hecho > hoy + datetime.timedelta(days=60) or hecho < hoy - datetime.timedelta(days=60):
            raise PeticionInvalida('La fecha del hecho debe estar dentro de los últimos o próximos 60 días.')
    except PeticionInvalida as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    s = SolicitudPermiso.objects.create(empleado=emp, permiso=d['permiso'], fecha_hecho=hecho,
                                        inicio=armado['vigente_desde'])
    avisar_empleador(emp, f'permiso por {_permiso_dato(s)["permiso_texto"].lower()}')
    return Response({**_permiso_dato(s), 'resumen': armado['datos']['resumen']}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@_con_sesion
def pedir_conciliacion(request):
    """POST /api/trabajador/peticiones/conciliacion/ {empleo, tipo, desde?, hasta?, cuidado?}."""
    hoy = timezone.localdate()
    try:
        emp = _ficha(request.user, request.data.get('empleo'))
        _limite_pendientes(emp)
        tipo = request.data.get('tipo')
        if tipo not in dict(SolicitudConciliacion.TIPOS):
            raise PeticionInvalida('Elige qué quieres pedir.')
        # A quién cuida: lo que dice su ficha, o lo que declara al pedir (el empleador lo
        # confirma al responder). Para el cambio de jornada debe ser un menor: si la ficha
        # dice otra cosa (p. ej. "persona adulta con discapacidad"), puede declararlo aquí.
        cuidado = request.data.get('cuidado') or ''
        if cuidado and cuidado not in dict(CUIDADOS):
            raise PeticionInvalida('Elige a quién cuidas de la lista.')
        if not emp.cuidado_de and not cuidado:
            raise PeticionInvalida('Indica a quién cuidas.')
        if cuidado == emp.cuidado_de:
            cuidado = ''
        desde = hasta = None
        avisos = []
        if tipo == 'CAMBIO_JORNADA':
            if (cuidado or emp.cuidado_de) not in CUIDADO_MENORES:
                raise PeticionInvalida('El cambio de jornada en vacaciones escolares es para quien cuida a un niño o niña '
                                       'menor de 14 años o a un adolescente menor de 18 con discapacidad o dependencia '
                                       '(Ley 21.645). Si es tu caso, elige esa opción en "¿A quién cuidas?".')
            desde, hasta = _fecha(request.data.get('desde'), 'desde'), _fecha(request.data.get('hasta'), 'hasta')
            _rango(desde, hasta, hoy)
            if (desde - hoy).days < SolicitudConciliacion.ANTICIPACION_CAMBIO_JORNADA:
                avisos.append(f'Lo ideal es pedirlo con {SolicitudConciliacion.ANTICIPACION_CAMBIO_JORNADA} días de '
                              'anticipación: igual queda registrado y tu empleador debe responder.')
    except PeticionInvalida as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    s = SolicitudConciliacion.objects.create(empleado=emp, tipo=tipo, presentada_el=hoy, desde=desde, hasta=hasta,
                                             origen='PORTAL', cuidado_declarado=cuidado)
    avisar_empleador(emp, f'{s.get_tipo_display().lower()} (Ley 21.645; respondes a más tardar el {s.vence_el:%d-%m-%Y})')
    return Response({**_conciliacion_dato(s), 'avisos': avisos}, status=status.HTTP_201_CREATED)


# ── Empleador ────────────────────────────────────────────────────────────────

def _puede(request, modulo):
    from ..autenticacion import usuario_equipo_de
    ue = usuario_equipo_de(getattr(request, 'actor', None))
    return ue is None or bool((ue.permisos or {}).get(modulo))


@api_view(['GET'])
def peticiones_empleador(request):
    """GET /api/peticiones-portal/?empresa= — lo que piden los trabajadores, pendiente de respuesta.
    Vacaciones y permisos con el módulo Vacaciones; conciliación con Trabajadores."""
    if not request.user.is_authenticated:
        return Response(status=status.HTTP_401_UNAUTHORIZED)
    empresa = request.query_params.get('empresa')
    base = {'empleado__empresa__owner': request.user, **({'empleado__empresa_id': empresa} if empresa else {})}

    def persona(emp):
        return {'id': emp.id, 'nombre': _nombre(emp), 'rut': emp.rut}

    vacaciones = permisos = conciliacion = []
    if _puede(request, 'VACACIONES'):
        vacaciones = [{**_vacacion_dato(v), 'empleado': persona(v.empleado)} for v in VacacionEmpleado.objects.filter(
            origen='PORTAL', estado='PENDIENTE', **base).select_related('empleado').order_by('fecha_inicio')]
        permisos = [{**_permiso_dato(s), 'empleado': persona(s.empleado)} for s in SolicitudPermiso.objects.filter(
            estado='PENDIENTE', **base).select_related('empleado').order_by('creada_en')]
    if _puede(request, 'TRABAJADORES'):
        conciliacion = [{**_conciliacion_dato(s), 'empleado': persona(s.empleado),
                         'cuidado_declarado': s.get_cuidado_declarado_display() if s.cuidado_declarado else ''}
                        for s in SolicitudConciliacion.objects.filter(activo=True, estado='PENDIENTE', **base)
                        .select_related('empleado').order_by('presentada_el')]
    return Response({'vacaciones': vacaciones, 'permisos': permisos, 'conciliacion': conciliacion,
                     'motivos_vacacion': [{'valor': v, 'texto': t} for v, t in VacacionEmpleado.MOTIVOS_RECHAZO],
                     'motivos_permiso': [{'valor': v, 'texto': t} for v, t in SolicitudPermiso.MOTIVOS_RECHAZO]})


def responder_vacacion(vacacion, aprobar, motivo):
    """Aprueba (verificando la bolsa si es día libre por horas extra) o rechaza con motivo; avisa al trabajador."""
    if vacacion.estado != 'PENDIENTE':
        raise PeticionInvalida('Esta solicitud ya fue respondida.')
    if aprobar:
        if vacacion.tipo == 'DIA_COMPENSATORIO':
            disponibles = hc.bolsa(vacacion.empleado, hasta=vacacion.fecha_inicio)['disponibles']
            if float(vacacion.horas_compensatorias) > disponibles + 0.01:
                raise PeticionInvalida(f'No le alcanzan las horas: pide {hc._horas(vacacion.horas_compensatorias)} h y '
                                       f'tiene {hc._horas(disponibles)} h disponibles. Rechácela con "Conversemos otras fechas".')
        vacacion.estado, vacacion.motivo_rechazo = 'APROBADO', ''
    else:
        if motivo not in dict(VacacionEmpleado.MOTIVOS_RECHAZO):
            raise PeticionInvalida('Elige el motivo del rechazo.')
        vacacion.estado, vacacion.motivo_rechazo = 'RECHAZADO', motivo
    vacacion.respondida_en = timezone.now()
    vacacion.save(update_fields=['estado', 'motivo_rechazo', 'respondida_en'])
    if vacacion.origen == 'PORTAL':
        avisar_trabajador(vacacion.empleado,
                          f'{TIPOS_VACACION.get(vacacion.tipo, "vacaciones").lower()} del {vacacion.fecha_inicio:%d-%m-%Y} '
                          f'al {vacacion.fecha_fin:%d-%m-%Y}', 'aprobada' if aprobar else 'rechazada',
                          '' if aprobar else f'Motivo: {vacacion.get_motivo_rechazo_display()}.')
    return vacacion


class SolicitudPermisoViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Permisos legales pedidos desde el portal: POST <id>/responder/ {aprobar, motivo?}."""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SolicitudPermiso.objects.filter(empleado__empresa__owner=self.request.user).select_related('empleado__empresa')

    def list(self, request):
        qs = self.get_queryset()
        if request.query_params.get('empleado'):
            qs = qs.filter(empleado_id=request.query_params['empleado'])
        return Response([_permiso_dato(s) for s in qs[:50]])

    @action(detail=True, methods=['post'])
    def responder(self, request, pk=None):
        s = self.get_queryset().filter(pk=pk).first()
        if s is None:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if s.estado != 'PENDIENTE':
            return Response({'error': 'Esta solicitud ya fue respondida.'}, status=status.HTTP_400_BAD_REQUEST)
        texto = _permiso_dato(s)['permiso_texto'].lower()
        if request.data.get('aprobar'):
            if not _plan_permite(request.user, 2):
                return Response({'error': 'Disponible desde el plan Starter.'}, status=status.HTTP_403_FORBIDDEN)
            try:
                armado, _ = _validar_permiso(s.empleado, {'permiso': s.permiso, 'fecha_hecho': s.fecha_hecho.isoformat(),
                                                          'inicio': s.inicio.isoformat() if s.inicio else None},
                                             timezone.localdate())
            except PeticionInvalida as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            doc = DocumentoLaboral.objects.create(empleado=s.empleado, tipo='PERMISO_LEGAL',
                                                  fecha_emision=timezone.localdate(), **armado)
            s.estado, s.documento, s.motivo_rechazo = 'APROBADA', doc, ''
            detalle = f'{armado["datos"]["resumen"]}. Te llegará la constancia para firmarla.'
        else:
            motivo = request.data.get('motivo')
            if motivo not in dict(SolicitudPermiso.MOTIVOS_RECHAZO):
                return Response({'error': 'Elige el motivo del rechazo.'}, status=status.HTTP_400_BAD_REQUEST)
            s.estado, s.motivo_rechazo = 'RECHAZADA', motivo
            detalle = f'Motivo: {s.get_motivo_rechazo_display()}.'
        s.respondida_en = timezone.now()
        s.save(update_fields=['estado', 'documento', 'motivo_rechazo', 'respondida_en'])
        avisar_trabajador(s.empleado, f'permiso por {texto}', 'aprobado' if s.estado == 'APROBADA' else 'rechazado', detalle)
        return Response({**_permiso_dato(s), 'documento': s.documento_id})


def responder_conciliacion_portal(s):
    """Tras responder una solicitud pedida desde el portal: deja en la ficha a quién cuida
    (salvo que se rechace por no acreditarlo) y avisa al trabajador."""
    emp = s.empleado
    if s.cuidado_declarado and s.cuidado_declarado != emp.cuidado_de and s.motivo != 'NO_ACREDITA_CUIDADO':
        Empleado.objects.filter(pk=emp.pk).update(cuidado_de=s.cuidado_declarado)
    if s.origen == 'PORTAL':
        detalle = (f'Motivo: {s.get_motivo_display()}. {s.fundamento}' if s.motivo else '')
        avisar_trabajador(emp, s.get_tipo_display().lower(), s.get_estado_display().lower(), detalle.strip())
