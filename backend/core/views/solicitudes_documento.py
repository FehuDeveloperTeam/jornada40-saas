"""Solicitudes de documentos del trabajador (portal) y su atención (panel).

Liquidación y finiquito se resuelven solos cuando el empleador envía ese
documento a firma: el envío ya le avisa al trabajador por correo. "Otro" lo
resuelve el empleador a mano. El empleador puede descartar con un motivo.
"""
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Contrato, Liquidacion, SolicitudDocumento, SolicitudFirma
from .portal_trabajador import _con_sesion, fichas_accesibles

MESES_HACIA_ATRAS = 24
MAX_PENDIENTES = 10
_VIVAS = ['PENDIENTE', 'PROCESANDO', 'FIRMADO']
_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
          'noviembre', 'diciembre']


def actualizar_solicitudes(qs):
    """Resuelve las pendientes cuyo documento ya se envió a firma."""
    ahora = timezone.now()
    for s in qs.filter(estado='PENDIENTE', tipo__in=['LIQUIDACION', 'FINIQUITO']).select_related('empleado'):
        filtro = ({'liquidacion__empleado': s.empleado, 'liquidacion__mes': s.mes, 'liquidacion__anio': s.anio}
                  if s.tipo == 'LIQUIDACION' else {'empleado': s.empleado, 'tipo_documento': 'FINIQUITO'})
        if SolicitudFirma.objects.filter(estado__in=_VIVAS, **filtro).exists():
            s.estado, s.resuelta_en = 'RESUELTA', ahora
            s.save(update_fields=['estado', 'resuelta_en'])


def _ultimo_mes_cerrado():
    hoy = timezone.localdate()
    return (hoy.year - (hoy.month == 1), 12 if hoy.month == 1 else hoy.month - 1)


def _meses_disponibles(emp, pendientes):
    """Meses cerrados de la relación laboral sin liquidación emitida ni solicitud pendiente."""
    contrato = Contrato.objects.filter(empleado=emp).first()
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
        if (anio, mes) not in emitidas and (anio, mes) not in pendientes:
            salida.append({'mes': mes, 'anio': anio, 'texto': f'{_MESES[mes - 1].capitalize()} {anio}'})
        anio, mes = (anio - 1, 12) if mes == 1 else (anio, mes - 1)
    return salida


def _finiquito_disponible(emp):
    return not emp.activo and not SolicitudFirma.objects.filter(
        empleado=emp, tipo_documento='FINIQUITO', estado__in=_VIVAS).exists()


def _dato_solicitud(s):
    periodo = f'{_MESES[s.mes - 1].capitalize()} {s.anio}' if s.mes else ''
    return {'id': s.id, 'tipo': s.tipo, 'tipo_texto': s.get_tipo_display(), 'periodo': periodo, 'mes': s.mes,
            'anio': s.anio, 'detalle': s.detalle, 'estado': s.estado, 'motivo': s.motivo,
            'creada_en': s.creada_en.isoformat(), 'resuelta_en': s.resuelta_en.isoformat() if s.resuelta_en else None}


# ── Portal del trabajador ────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@_con_sesion
def solicitudes_trabajador(request):
    fichas = fichas_accesibles(request.user)
    propias = SolicitudDocumento.objects.filter(empleado__in=fichas).select_related('empleado__empresa')
    actualizar_solicitudes(propias)
    if request.method == 'POST':
        return _crear(request, fichas, propias)
    opciones = []
    for emp in fichas:
        pendientes = set(propias.filter(empleado=emp, tipo='LIQUIDACION', estado='PENDIENTE')
                         .values_list('anio', 'mes'))
        finiquito_pedido = propias.filter(empleado=emp, tipo='FINIQUITO', estado='PENDIENTE').exists()
        opciones.append({'empleo': emp.id, 'empresa': emp.empresa.nombre_legal.title(),
                         'meses': _meses_disponibles(emp, pendientes),
                         'finiquito': _finiquito_disponible(emp) and not finiquito_pedido})
    return Response({'opciones': opciones,
                     'solicitudes': [{**_dato_solicitud(s), 'empresa': s.empleado.empresa.nombre_legal.title()}
                                     for s in propias]})


def _crear(request, fichas, propias):
    datos = request.data
    emp = next((e for e in fichas if str(e.id) == str(datos.get('empleo'))), None)
    tipo = datos.get('tipo')
    if emp is None or tipo not in dict(SolicitudDocumento.TIPOS):
        return Response({'error': 'Elige el empleo y el tipo de documento.'}, status=status.HTTP_400_BAD_REQUEST)
    if propias.filter(estado='PENDIENTE').count() >= MAX_PENDIENTES:
        return Response({'error': f'Tienes {MAX_PENDIENTES} solicitudes pendientes. Espera a que tu empleador las '
                                  'atienda.'}, status=status.HTTP_400_BAD_REQUEST)
    campos = {'empleado': emp, 'cuenta': request.user, 'tipo': tipo}
    if tipo == 'LIQUIDACION':
        try:
            mes, anio = int(datos.get('mes')), int(datos.get('anio'))
        except (TypeError, ValueError):
            return Response({'error': 'Elige el mes y el año.'}, status=status.HTTP_400_BAD_REQUEST)
        pendientes = set(propias.filter(empleado=emp, tipo='LIQUIDACION', estado='PENDIENTE').values_list('anio', 'mes'))
        if not any(m['mes'] == mes and m['anio'] == anio for m in _meses_disponibles(emp, pendientes)):
            return Response({'error': 'Ese período no está disponible: ya fue emitido, ya lo pediste o está fuera '
                                      'de tu contrato.'}, status=status.HTTP_400_BAD_REQUEST)
        campos.update(mes=mes, anio=anio)
    elif tipo == 'FINIQUITO':
        if not _finiquito_disponible(emp) or propias.filter(empleado=emp, tipo='FINIQUITO', estado='PENDIENTE').exists():
            return Response({'error': 'El finiquito no está disponible para solicitar.'},
                            status=status.HTTP_400_BAD_REQUEST)
    else:
        detalle = str(datos.get('detalle') or '').strip()
        if len(detalle) < 5:
            return Response({'error': 'Cuéntale a tu empleador qué documento necesitas.'},
                            status=status.HTTP_400_BAD_REQUEST)
        campos['detalle'] = detalle[:300]
    solicitud = SolicitudDocumento.objects.create(**campos)
    return Response({**_dato_solicitud(solicitud), 'empresa': emp.empresa.nombre_legal.title()},
                    status=status.HTTP_201_CREATED)


# ── Panel del empleador ──────────────────────────────────────────────────────

class SolicitudDocumentoViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _qs(self, request):
        qs = SolicitudDocumento.objects.filter(empleado__empresa__owner=request.user).select_related('empleado')
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
            salida.append({**_dato_solicitud(s),
                           'empleado': {'id': e.id, 'nombre': f'{e.nombres} {e.apellido_paterno}'.strip(), 'rut': e.rut,
                                        'email': e.email or ''},
                           'liquidacion': liq.id if liq else None})
        return Response(salida)

    def _pendiente(self, request, pk):
        return self._qs(request).filter(pk=pk, estado='PENDIENTE').first()

    @action(detail=True, methods=['post'])
    def resolver(self, request, pk=None):
        """Marca resuelta a mano (sobre todo "otro documento", entregado por otra vía)."""
        s = self._pendiente(request, pk)
        if s is None:
            return Response({'error': 'Solicitud no encontrada o ya atendida.'}, status=status.HTTP_404_NOT_FOUND)
        s.estado, s.resuelta_en = 'RESUELTA', timezone.now()
        s.save(update_fields=['estado', 'resuelta_en'])
        return Response(_dato_solicitud(s))

    @action(detail=True, methods=['post'])
    def descartar(self, request, pk=None):
        s = self._pendiente(request, pk)
        if s is None:
            return Response({'error': 'Solicitud no encontrada o ya atendida.'}, status=status.HTTP_404_NOT_FOUND)
        motivo = str(request.data.get('motivo') or '').strip()
        if len(motivo) < 5:
            return Response({'error': 'Indica el motivo: el trabajador lo verá en su portal.'},
                            status=status.HTTP_400_BAD_REQUEST)
        s.estado, s.motivo, s.resuelta_en = 'DESCARTADA', motivo[:300], timezone.now()
        s.save(update_fields=['estado', 'motivo', 'resuelta_en'])
        return Response(_dato_solicitud(s))
