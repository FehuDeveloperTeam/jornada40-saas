"""Solicitudes de conciliación (Ley 21.645): el empleador registra lo que pidió por
escrito un trabajador con responsabilidades de cuidado y su respuesta, con el plazo
legal a la vista. Avisos, nunca bloqueos: registrar fuera de plazo se permite."""
import datetime

from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import SolicitudConciliacion
from ..serializers import SolicitudConciliacionSerializer

RESPUESTAS = ('ACEPTADA', 'ALTERNATIVA', 'RECHAZADA')


def avisos_solicitud(s, hoy=None):
    hoy = hoy or timezone.localdate()
    avisos = []
    if s.tipo == 'CAMBIO_JORNADA' and s.desde and (s.desde - s.presentada_el).days < s.ANTICIPACION_CAMBIO_JORNADA:
        avisos.append(f'La propuesta debía presentarse con al menos {s.ANTICIPACION_CAMBIO_JORNADA} días de anticipación '
                      f'(se presentó {(s.desde - s.presentada_el).days} días antes). Igual conviene responderla.')
    if s.estado == 'PENDIENTE' and s.vence_el < hoy:
        avisos.append(f'El plazo para responder venció el {s.vence_el:%d-%m-%Y}: responde cuanto antes.')
    if s.respondida_el and s.respondida_el > s.vence_el:
        avisos.append(f'Se respondió fuera de plazo (vencía el {s.vence_el:%d-%m-%Y}).')
    return avisos


class SolicitudConciliacionViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin,
                                   viewsets.GenericViewSet):
    """GET ?empleado=, POST {empleado, tipo, presentada_el, desde?, hasta?},
    POST <id>/responder/ {estado, motivo?, fundamento?, respondida_el?}, POST <id>/anular/."""
    serializer_class = SolicitudConciliacionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SolicitudConciliacion.objects.filter(empleado__empresa__owner=self.request.user, activo=True) \
            .select_related('empleado')
        empleado = self.request.query_params.get('empleado')
        return qs.filter(empleado_id=empleado) if empleado else qs

    @action(detail=False, methods=['get'])
    def opciones(self, request):
        return Response({
            'tipos': [{'valor': v, 'texto': t, 'plazo_dias': SolicitudConciliacion.PLAZO_RESPUESTA[v]}
                      for v, t in SolicitudConciliacion.TIPOS],
            'motivos': [{'valor': v, 'texto': t} for v, t in SolicitudConciliacion.MOTIVOS],
        })

    @action(detail=True, methods=['post'])
    def responder(self, request, pk=None):
        s = self.get_object()
        if s.estado != 'PENDIENTE':
            return Response({'error': 'Esta solicitud ya fue respondida.'}, status=status.HTTP_400_BAD_REQUEST)
        estado = request.data.get('estado')
        if estado not in RESPUESTAS:
            return Response({'error': 'Elige la respuesta: aceptar, ofrecer otra fórmula o rechazar.'},
                            status=status.HTTP_400_BAD_REQUEST)
        motivo = str(request.data.get('motivo') or '')
        fundamento = str(request.data.get('fundamento') or '').strip()[:500]
        if estado != 'ACEPTADA':
            # Rechazar u ofrecer otra fórmula exige acreditar las circunstancias (Art. 207 ter).
            if motivo not in dict(SolicitudConciliacion.MOTIVOS):
                return Response({'error': 'Elige el motivo de la lista.'}, status=status.HTTP_400_BAD_REQUEST)
            if len(fundamento) < 20:
                return Response({'error': 'Explica las circunstancias que lo justifican (al menos una frase).'},
                                status=status.HTTP_400_BAD_REQUEST)
        try:
            respondida = datetime.date.fromisoformat(str(request.data.get('respondida_el') or timezone.localdate()))
        except ValueError:
            return Response({'error': 'Fecha de respuesta inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        if respondida < s.presentada_el or respondida > timezone.localdate():
            return Response({'error': 'La respuesta va entre la fecha de la solicitud y hoy.'},
                            status=status.HTTP_400_BAD_REQUEST)
        s.estado, s.respondida_el = estado, respondida
        s.motivo, s.fundamento = ('', '') if estado == 'ACEPTADA' else (motivo, fundamento)
        s.save(update_fields=['estado', 'respondida_el', 'motivo', 'fundamento'])
        return Response(self.get_serializer(s).data)

    @action(detail=True, methods=['post'])
    def anular(self, request, pk=None):
        """Registrada por error: no se borra (queda en la bitácora), se desactiva."""
        s = self.get_object()
        s.activo = False
        s.save(update_fields=['activo'])
        return Response(status=status.HTTP_204_NO_CONTENT)
