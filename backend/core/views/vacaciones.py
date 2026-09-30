"""Registro de vacaciones y permisos."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from django.template.loader import get_template
from django.utils import timezone
from ..models import Contrato, Empleado, VacacionEmpleado
import datetime

from .base import error_interno, _MESES, _es_plan_semilla, _html_a_pdf_bytes, _plan_permite, pdf_firmado, respuesta_pdf
from .feriado import _calcular_dias_habiles_vacacion, calcular_saldo_vacaciones
from . import horas_compensatorias as hc


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
        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)
        return qs

    def _guardar(self, serializer):
        """Los días hábiles siempre los calcula el servidor (Art. 69 y feriados)."""
        inicio = serializer.validated_data.get('fecha_inicio', getattr(serializer.instance, 'fecha_inicio', None))
        fin = serializer.validated_data.get('fecha_fin', getattr(serializer.instance, 'fecha_fin', None))
        if inicio and fin and fin < inicio:
            raise ValidationError({'error': 'La fecha de término es anterior a la de inicio.'})
        tipo = serializer.validated_data.get('tipo', getattr(serializer.instance, 'tipo', None))
        if tipo == 'DIA_COMPENSATORIO':
            self._guardar_compensatorio(serializer, inicio, fin)
            return
        serializer.save(dias_habiles=_calcular_dias_habiles_vacacion(inicio, fin) if inicio and fin else 0,
                        horas_compensatorias=0)

    def _guardar_compensatorio(self, serializer, inicio, fin):
        """Día(s) libre(s) pagados con la bolsa de horas extra (Art. 32 inc. 4°).

        Descuenta las horas de la jornada de cada día; solo días completos y
        con saldo vigente ese día. El aviso de 48 horas es un aviso, no un bloqueo."""
        if not hc.permite_compensacion(self.request.user):
            raise ValidationError({'error': 'Los días compensatorios están disponibles desde el plan Pyme.'})
        empleado = serializer.validated_data.get('empleado', getattr(serializer.instance, 'empleado', None))
        contrato = Contrato.objects.filter(empleado=empleado).first()
        if not contrato:
            raise ValidationError({'error': 'El trabajador no tiene contrato registrado.'})
        horas = hc.horas_de_uso(contrato, inicio, fin)
        if horas <= 0:
            raise ValidationError({'error': 'En esas fechas el trabajador no tiene jornada: elija días en que trabaja.'})
        estado = serializer.validated_data.get('estado', getattr(serializer.instance, 'estado', 'APROBADO'))
        if estado == 'APROBADO':
            actual = float(serializer.instance.horas_compensatorias) if serializer.instance and \
                serializer.instance.estado == 'APROBADO' and serializer.instance.tipo == 'DIA_COMPENSATORIO' else 0
            disponibles = hc.bolsa(empleado, hasta=inicio)['disponibles'] + actual
            if horas > disponibles + 0.01:
                raise ValidationError({'error': f'No le alcanzan las horas: esos días suman {hc._horas(horas)} h de '
                                                f'jornada y tiene {hc._horas(disponibles)} h de descanso disponibles.'})
        dias = sum(1 for n in range((fin - inicio).days + 1)
                   if hc.horas_del_dia(contrato, inicio + datetime.timedelta(days=n)) > 0)
        serializer.save(dias_habiles=dias, horas_compensatorias=horas)
        if inicio < timezone.localdate() + datetime.timedelta(days=2):
            self._avisos = ['El trabajador debe avisar con 48 horas de anticipación (Art. 32). Si lo pidió con '
                            'menos, déjelo registrado solo si usted estuvo de acuerdo.']

    def create(self, request, *args, **kwargs):
        if not _plan_permite(request.user, 2):
            return Response(
                {'error': 'La gestión de vacaciones y permisos está disponible desde el plan Starter. Mejora tu suscripción para acceder.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        self._avisos = []
        respuesta = super().create(request, *args, **kwargs)
        if self._avisos:
            respuesta.data['avisos'] = self._avisos
        return respuesta

    @action(detail=False, methods=['get'], url_path='compensatorias')
    def compensatorias(self, request):
        """GET /api/vacaciones/compensatorias/?empleado=<id> — bolsa de horas de descanso por horas extra."""
        empleado = Empleado.objects.filter(pk=request.query_params.get('empleado') or 0,
                                           empresa__owner=request.user).first()
        if empleado is None:
            return Response({'error': 'Empleado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        contrato = Contrato.objects.filter(empleado=empleado).first()
        hoy = timezone.localdate()
        datos = hc.resumen_empleado(empleado, contrato, hoy) if contrato else {}
        return Response({'permitido': hc.permite_compensacion(request.user), **datos})

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
            return error_interno('PDF vacaciones')


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

