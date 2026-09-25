"""Registro de vacaciones y permisos."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from django.template.loader import get_template
from ..models import Empleado, VacacionEmpleado
import datetime

from .base import _MESES, _es_plan_semilla, _html_a_pdf_bytes, _plan_permite, pdf_firmado, respuesta_pdf
from .feriado import _calcular_dias_habiles_vacacion, calcular_saldo_vacaciones


# ==========================================
# VACACIONES Y PERMISOS
# ==========================================
class VacacionViewSet(viewsets.ModelViewSet):
    serializer_class = None  # se asigna abajo tras importar el serializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        from ..serializers import VacacionSerializer
        return VacacionSerializer

    def get_queryset(self):
        qs = VacacionEmpleado.objects.filter(
            empresa__owner=self.request.user
        ).order_by('-fecha_inicio')
        empleado_id = self.request.query_params.get('empleado')
        if empleado_id:
            qs = qs.filter(empleado_id=empleado_id)
        return qs

    def create(self, request, *args, **kwargs):
        if not _plan_permite(request.user, 2):
            return Response(
                {'error': 'La gestión de vacaciones y permisos está disponible desde el plan Starter. Mejora tu suscripción para acceder.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def _guardar(self, serializer):
        """Los días hábiles siempre los calcula el servidor (Art. 69 y feriados)."""
        inicio = serializer.validated_data.get('fecha_inicio', getattr(serializer.instance, 'fecha_inicio', None))
        fin = serializer.validated_data.get('fecha_fin', getattr(serializer.instance, 'fecha_fin', None))
        if inicio and fin and fin < inicio:
            raise ValidationError({'error': 'La fecha de término es anterior a la de inicio.'})
        serializer.save(dias_habiles=_calcular_dias_habiles_vacacion(inicio, fin) if inicio and fin else 0)

    def perform_create(self, serializer):
        self._guardar(serializer)

    def perform_update(self, serializer):
        self._guardar(serializer)

    @action(detail=False, methods=['get'], url_path='dias_habiles')
    def dias_habiles(self, request):
        """GET /api/vacaciones/dias_habiles/?inicio=AAAA-MM-DD&fin=AAAA-MM-DD — vista previa del formulario."""
        try:
            inicio = datetime.date.fromisoformat(request.query_params.get('inicio', ''))
            fin = datetime.date.fromisoformat(request.query_params.get('fin', ''))
        except ValueError:
            return Response({'error': 'Fechas inválidas.'}, status=status.HTTP_400_BAD_REQUEST)
        if fin < inicio:
            return Response({'error': 'La fecha de término es anterior a la de inicio.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'dias_habiles': _calcular_dias_habiles_vacacion(inicio, fin)})

    @action(detail=False, methods=['get'], url_path='saldo')
    def saldo(self, request):
        """GET /api/vacaciones/saldo/?empleado=<id>
        Retorna el saldo de vacaciones del empleado.
        """
        if not _plan_permite(request.user, 2):
            return Response(
                {'error': 'La gestión de vacaciones está disponible desde el plan Starter.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        empleado_id = request.query_params.get('empleado')
        if not empleado_id:
            return Response({'error': 'Parámetro empleado requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            empleado = Empleado.objects.get(pk=empleado_id, empresa__owner=request.user)
        except Empleado.DoesNotExist:
            return Response({'error': 'Empleado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(calcular_saldo_vacaciones(empleado))

    @action(detail=True, methods=['get'], url_path='generar_pdf')
    def generar_pdf(self, request, pk=None):
        """GET /api/vacaciones/<id>/generar_pdf/
        Genera y devuelve el comprobante de vacaciones en PDF.
        """
        try:
            vacacion = self.get_object()
            empleado = vacacion.empleado
            es_semilla = _es_plan_semilla(request.user)
            firmado = pdf_firmado('VACACION', vacacion=vacacion)
            if firmado:
                return respuesta_pdf(firmado, f'vacacion_{empleado.rut}_{vacacion.fecha_inicio}.pdf', firmado=True)

            return respuesta_pdf(pdf_vacacion(vacacion, es_semilla), f'vacacion_{empleado.rut}_{vacacion.fecha_inicio}.pdf')

        except Exception as e:
            return Response(
                {'error': f'Error al generar PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


def pdf_vacacion(vacacion, es_semilla) -> bytes:
    """Comprobante de vacaciones. Lleva la fecha en que se registró, no la de
    hoy: descargarlo otro día debe dar el mismo documento."""
    from django.utils import timezone
    empleado = vacacion.empleado
    empresa = vacacion.empresa
    emitido = timezone.localtime(vacacion.creado_en).date() if vacacion.creado_en else timezone.localdate()

    def _fmt_fecha(f):
        return f"{f.day:02d} de {_MESES[f.month - 1]} de {f.year}" if f else '—'

    context = {
        'vacacion': vacacion, 'empleado': empleado, 'empresa': empresa,
        'fecha_actual': _fmt_fecha(emitido),
        'fecha_inicio_texto': _fmt_fecha(vacacion.fecha_inicio),
        'fecha_fin_texto': _fmt_fecha(vacacion.fecha_fin),
        'ciudad': str(getattr(empresa, 'ciudad', '') or getattr(empresa, 'comuna', '')
                      or getattr(empleado, 'comuna', '') or 'Santiago').strip().title(),
        'es_plan_semilla': es_semilla,
    }
    return _html_a_pdf_bytes(get_template('comprobante_vacaciones.html').render(context),
                             f'vacacion_{empleado.rut}_{vacacion.fecha_inicio}')

