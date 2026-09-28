"""Solicitudes de documentos del trabajador (portal) y su atención (panel).

Solo se ofrecen documentos que Jornada40 genera y que aún no existen o no se
han enviado a firma: la liquidación de un mes cerrado sin emitir, el contrato
sin firmar ni subido, el anexo Ley 40 horas si la jornada excede el máximo, el
comprobante de una vacación aprobada y el finiquito de quien fue desvinculado.
No hay texto libre. Se resuelven solos cuando el empleador envía ese documento
a firma (el correo de firma es el aviso al trabajador); el empleador puede
descartarlas eligiendo un motivo de una lista.
"""
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..jornada import _TOLERANCIA, jornada_maxima_vigente
from ..models import Contrato, Liquidacion, SolicitudDocumento, SolicitudFirma, VacacionEmpleado
from .portal_trabajador import _con_sesion, fichas_accesibles

MESES_HACIA_ATRAS = 24
MAX_PENDIENTES = 10
_VIVAS = ['PENDIENTE', 'PROCESANDO', 'FIRMADO']
_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
          'noviembre', 'diciembre']
_TEXTO_TIPO = dict(SolicitudDocumento.TIPOS)
_TEXTO_MOTIVO = dict(SolicitudDocumento.MOTIVOS)
# "Sin remuneración" y "fuera de la relación laboral" solo aplican a un período de liquidación.
_MOTIVOS_POR_TIPO = {'LIQUIDACION': [m for m, _ in SolicitudDocumento.MOTIVOS]}
_MOTIVOS_GENERALES = ['ENTREGADO_PAPEL', 'NO_CORRESPONDE']


def _fecha(d):
    return d.strftime('%d-%m-%Y')


def _texto_periodo(mes, anio):
    return f'{_MESES[mes - 1].capitalize()} {anio}'


def _texto_vacacion(v):
    return f'Del {_fecha(v.fecha_inicio)} al {_fecha(v.fecha_fin)} · {v.dias_habiles} días hábiles'


def _firma_viva(emp, tipo, **filtro):
    return SolicitudFirma.objects.filter(empleado=emp, tipo_documento=tipo, estado__in=_VIVAS, **filtro).exists()


def _contrato(emp):
    return Contrato.objects.filter(empleado=emp).first()


def _contrato_resuelto(emp, contrato):
    """El contrato ya está firmado (o en firma) o se subió firmado en papel."""
    return bool(contrato and (contrato.archivo_contrato or _firma_viva(emp, 'CONTRATO', contrato=contrato)))


def _excede_maximo(contrato):
    return bool(contrato and contrato.tipo_jornada != 'ART_22'
                and float(contrato.horas_semanales or 0) > jornada_maxima_vigente() + _TOLERANCIA)


def _clave(tipo, mes=None, anio=None, vacacion_id=None):
    """Identifica el documento pedido, para no aceptar dos solicitudes pendientes del mismo."""
    if tipo == 'LIQUIDACION':
        return f'{anio}-{mes}'
    if tipo == 'VACACION':
        return str(vacacion_id)
    return ''


def _resuelta(s):
    emp = s.empleado
    if s.tipo == 'LIQUIDACION':
        return _firma_viva(emp, 'LIQUIDACION', liquidacion__mes=s.mes, liquidacion__anio=s.anio)
    if s.tipo == 'VACACION':
        return s.vacacion_id is not None and _firma_viva(emp, 'VACACION', vacacion_id=s.vacacion_id)
    if s.tipo == 'FINIQUITO':
        return _firma_viva(emp, 'FINIQUITO')
    contrato = _contrato(emp)
    if s.tipo == 'CONTRATO':
        return _contrato_resuelto(emp, contrato)
    return bool(contrato and _firma_viva(emp, 'ANEXO_40H', contrato=contrato))


def actualizar_solicitudes(qs):
    """Resuelve las pendientes cuyo documento ya se envió a firma."""
    ahora = timezone.now()
    for s in qs.filter(estado='PENDIENTE').select_related('empleado'):
        if _resuelta(s):
            s.estado, s.resuelta_en = 'RESUELTA', ahora
            s.save(update_fields=['estado', 'resuelta_en'])


def _ultimo_mes_cerrado():
    hoy = timezone.localdate()
    return (hoy.year - (hoy.month == 1), 12 if hoy.month == 1 else hoy.month - 1)


def _meses_disponibles(emp, contrato, pedidas):
    """Meses cerrados de la relación laboral sin liquidación emitida ni solicitud pendiente."""
    inicio = min([f for f in ((contrato.fecha_inicio if contrato else None), emp.fecha_ingreso) if f], default=None)
    if not inicio:
        return []
    anio, mes = _ultimo_mes_cerrado()
    if not emp.activo and emp.fecha_desvinculacion:
        anio, mes = min((anio, mes), (emp.fecha_desvinculacion.year, emp.fecha_desvinculacion.month))
    emitidas = set(Liquidacion.objects.filter(empleado=emp).values_list('anio', 'mes'))
    salida = []
    for _ in range(MESES_HACIA_ATRAS):
        if (anio, mes) < (inicio.year, inicio.month):
            break
        if (anio, mes) not in emitidas and ('LIQUIDACION', _clave('LIQUIDACION', mes, anio)) not in pedidas:
            salida.append({'valor': _clave('LIQUIDACION', mes, anio), 'texto': _texto_periodo(mes, anio)})
        anio, mes = (anio - 1, 12) if mes == 1 else (anio, mes - 1)
    return salida


def _vacaciones_disponibles(emp, pedidas):
    hoy = timezone.localdate()
    desde = hoy.replace(year=hoy.year - 2, day=1)
    firmadas = set(SolicitudFirma.objects.filter(empleado=emp, tipo_documento='VACACION', estado__in=_VIVAS)
                   .values_list('vacacion_id', flat=True))
    return [{'valor': str(v.id), 'texto': _texto_vacacion(v)}
            for v in VacacionEmpleado.objects.filter(empleado=emp, estado='APROBADO', fecha_inicio__gte=desde)
            .order_by('-fecha_inicio')
            if v.id not in firmadas and ('VACACION', str(v.id)) not in pedidas]


def _documentos_disponibles(emp, pedidas):
    """Lo que el trabajador puede pedir de esta ficha. `pedidas`: {(tipo, clave)} pendientes."""
    contrato = _contrato(emp)
    docs = []

    def agregar(tipo, opciones=None, etiqueta=''):
        doc = {'tipo': tipo, 'texto': _TEXTO_TIPO[tipo]}
        if opciones is not None:
            doc.update(etiqueta_opcion=etiqueta, opciones=opciones)
        docs.append(doc)

    meses = _meses_disponibles(emp, contrato, pedidas)
    if meses:
        agregar('LIQUIDACION', meses, 'Mes y año')
    if ('CONTRATO', '') not in pedidas and not _contrato_resuelto(emp, contrato):
        agregar('CONTRATO')
    if (('ANEXO_40H', '') not in pedidas and _excede_maximo(contrato)
            and not _firma_viva(emp, 'ANEXO_40H', contrato=contrato)):
        agregar('ANEXO_40H')
    vacaciones = _vacaciones_disponibles(emp, pedidas)
    if vacaciones:
        agregar('VACACION', vacaciones, 'Período de vacaciones')
    if not emp.activo and ('FINIQUITO', '') not in pedidas and not _firma_viva(emp, 'FINIQUITO'):
        agregar('FINIQUITO')
    return docs


def _referencia(s):
    if s.tipo == 'LIQUIDACION' and s.mes:
        return _texto_periodo(s.mes, s.anio)
    if s.tipo == 'VACACION' and s.vacacion:
        return _texto_vacacion(s.vacacion)
    return ''


def _dato_solicitud(s):
    return {'id': s.id, 'tipo': s.tipo, 'tipo_texto': s.get_tipo_display(), 'referencia': _referencia(s),
            'estado': s.estado, 'motivo': s.motivo, 'motivo_texto': _TEXTO_MOTIVO.get(s.motivo, ''),
            'creada_en': s.creada_en.isoformat(), 'resuelta_en': s.resuelta_en.isoformat() if s.resuelta_en else None}


def _pedidas(qs, emp):
    return {(s.tipo, _clave(s.tipo, s.mes, s.anio, s.vacacion_id))
            for s in qs.filter(empleado=emp, estado='PENDIENTE')}


# ── Portal del trabajador ────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@_con_sesion
def solicitudes_trabajador(request):
    fichas = fichas_accesibles(request.user)
    propias = SolicitudDocumento.objects.filter(empleado__in=fichas).select_related('empleado__empresa', 'vacacion')
    actualizar_solicitudes(propias)
    if request.method == 'POST':
        return _crear(request, fichas, propias)
    opciones = [{'empleo': emp.id, 'empresa': emp.empresa.nombre_legal.title(),
                 'documentos': _documentos_disponibles(emp, _pedidas(propias, emp))} for emp in fichas]
    return Response({'opciones': opciones,
                     'solicitudes': [{**_dato_solicitud(s), 'empresa': s.empleado.empresa.nombre_legal.title()}
                                     for s in propias]})


def _crear(request, fichas, propias):
    datos = request.data
    emp = next((e for e in fichas if str(e.id) == str(datos.get('empleo'))), None)
    tipo = datos.get('tipo')
    if emp is None or tipo not in _TEXTO_TIPO:
        return Response({'error': 'Elige el empleo y el documento.'}, status=status.HTTP_400_BAD_REQUEST)
    if propias.filter(estado='PENDIENTE').count() >= MAX_PENDIENTES:
        return Response({'error': f'Tienes {MAX_PENDIENTES} solicitudes pendientes. Espera a que tu empleador las '
                                  'atienda.'}, status=status.HTTP_400_BAD_REQUEST)
    # Solo se acepta lo que el portal ofrece en este momento, con la opción elegida.
    doc = next((d for d in _documentos_disponibles(emp, _pedidas(propias, emp)) if d['tipo'] == tipo), None)
    if doc is None:
        return Response({'error': 'Ese documento no está disponible para solicitar: ya existe, ya lo pediste o no '
                                  'corresponde a tu contrato.'}, status=status.HTTP_400_BAD_REQUEST)
    campos = {'empleado': emp, 'cuenta': request.user, 'tipo': tipo}
    if 'opciones' in doc:
        opcion = str(datos.get('opcion') or '')
        if opcion not in {o['valor'] for o in doc['opciones']}:
            return Response({'error': f'Elige una opción de «{doc["etiqueta_opcion"]}».'},
                            status=status.HTTP_400_BAD_REQUEST)
        if tipo == 'LIQUIDACION':
            anio, mes = (int(x) for x in opcion.split('-'))
            campos.update(mes=mes, anio=anio)
        else:
            campos['vacacion'] = VacacionEmpleado.objects.get(pk=int(opcion), empleado=emp)
    solicitud = SolicitudDocumento.objects.create(**campos)
    return Response({**_dato_solicitud(solicitud), 'empresa': emp.empresa.nombre_legal.title()},
                    status=status.HTTP_201_CREATED)


# ── Panel del empleador ──────────────────────────────────────────────────────

class SolicitudDocumentoViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _qs(self, request):
        qs = (SolicitudDocumento.objects.filter(empleado__empresa__owner=request.user)
              .select_related('empleado', 'vacacion'))
        empresa = request.query_params.get('empresa')
        return qs.filter(empleado__empresa_id=empresa) if empresa else qs

    def list(self, request):
        qs = self._qs(request)
        actualizar_solicitudes(qs)
        estado = request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado)
        salida = []
        for s in qs:
            e = s.empleado
            liq = (Liquidacion.objects.filter(empleado=e, mes=s.mes, anio=s.anio).first()
                   if s.tipo == 'LIQUIDACION' else None)
            contrato = _contrato(e) if s.tipo in ('CONTRATO', 'ANEXO_40H') else None
            motivos = _MOTIVOS_POR_TIPO.get(s.tipo, _MOTIVOS_GENERALES)
            salida.append({**_dato_solicitud(s),
                           'empleado': {'id': e.id, 'nombre': f'{e.nombres} {e.apellido_paterno}'.strip(), 'rut': e.rut,
                                        'email': e.email or ''},
                           'mes': s.mes, 'anio': s.anio,
                           'liquidacion': liq.id if liq else None,
                           'contrato': contrato.id if contrato else None,
                           'vacacion': s.vacacion_id,
                           'motivos': [{'valor': m, 'texto': _TEXTO_MOTIVO[m]} for m in motivos]})
        return Response(salida)

    @action(detail=True, methods=['post'])
    def descartar(self, request, pk=None):
        s = self._qs(request).filter(pk=pk, estado='PENDIENTE').first()
        if s is None:
            return Response({'error': 'Solicitud no encontrada o ya atendida.'}, status=status.HTTP_404_NOT_FOUND)
        motivo = request.data.get('motivo')
        if motivo not in _MOTIVOS_POR_TIPO.get(s.tipo, _MOTIVOS_GENERALES):
            return Response({'error': 'Elige el motivo: el trabajador lo verá en su portal.'},
                            status=status.HTTP_400_BAD_REQUEST)
        s.estado, s.motivo, s.resuelta_en = 'DESCARTADA', motivo, timezone.now()
        s.save(update_fields=['estado', 'motivo', 'resuelta_en'])
        return Response(_dato_solicitud(s))
