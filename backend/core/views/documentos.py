"""Documentos legales (amonestaciones, constancias, cartas de término)."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from django.http import HttpResponse
from django.template.loader import get_template
from ..models import DocumentoLegal
from xhtml2pdf import pisa
import datetime
from ..serializers import DocumentoLegalSerializer

from .base import _es_plan_semilla, _plan_permite
from .finiquitos import _CAUSALES_CON_INDEMNIZACION, _calcular_finiquito


class DocumentoLegalViewSet(viewsets.ModelViewSet):
    queryset = DocumentoLegal.objects.all().order_by('-fecha_emision', '-creado_en')
    serializer_class = DocumentoLegalSerializer
    permission_classes = [IsAuthenticated]

    # Textos legales de cada causal para el PDF
    _CAUSAL_INFO = {
        '159_1':  ('Art. 159 N°1 — Mutuo acuerdo de las partes',
                   'Ambas partes acuerdan, de mutuo acuerdo, poner término al contrato de trabajo.', False),
        '159_2':  ('Art. 159 N°2 — Renuncia voluntaria del trabajador',
                   'El trabajador ha presentado su renuncia voluntaria al cargo.', False),
        '159_3':  ('Art. 159 N°3 — Muerte del trabajador',
                   'El contrato de trabajo termina por fallecimiento del trabajador.', False),
        '159_4':  ('Art. 159 N°4 — Vencimiento del plazo convenido',
                   'Ha vencido el plazo estipulado en el contrato de trabajo a plazo fijo.', False),
        '159_5':  ('Art. 159 N°5 — Conclusión del trabajo o servicio que dio origen al contrato',
                   'Ha concluido el trabajo, obra o servicio específico para el cual fue contratado el trabajador.', False),
        '159_6':  ('Art. 159 N°6 — Caso fortuito o fuerza mayor',
                   'Se ha producido un evento de caso fortuito o fuerza mayor que hace imposible continuar con la relación laboral.', False),
        '160_1a': ('Art. 160 N°1 a) — Falta de probidad del trabajador',
                   'El trabajador ha incurrido en conductas contrarias a la honradez e integridad que debe observar en el ejercicio de su cargo.', False),
        '160_1b': ('Art. 160 N°1 b) — Acoso sexual',
                   'El trabajador ha incurrido en conductas de acoso sexual, conforme a lo definido en el Artículo 2° del Código del Trabajo.', False),
        '160_1c': ('Art. 160 N°1 c) — Vías de hecho ejercidas por el trabajador',
                   'El trabajador ha ejercido vías de hecho en contra del empleador o de algún compañero de trabajo de la empresa.', False),
        '160_1d': ('Art. 160 N°1 d) — Injurias proferidas al empleador',
                   'El trabajador ha proferido injurias graves en contra del empleador, afectando su honor y dignidad.', False),
        '160_1e': ('Art. 160 N°1 e) — Conducta inmoral del trabajador',
                   'El trabajador ha incurrido en conductas inmorales graves que afectan a la empresa donde se desempeña.', False),
        '160_1f': ('Art. 160 N°1 f) — Conductas de acoso laboral',
                   'El trabajador ha incurrido en conductas de acoso laboral (mobbing), atentando contra la dignidad de otros trabajadores de la empresa.', False),
        '160_2':  ('Art. 160 N°2 — Negociaciones que ejecute el trabajador dentro del giro del negocio prohibidas por escrito',
                   'El trabajador ha realizado negociaciones dentro del giro del negocio de la empresa, en contravención a la prohibición expresa establecida en el contrato de trabajo.', False),
        '160_3':  ('Art. 160 N°3 — No concurrencia del trabajador a sus labores sin causa justificada',
                   'El trabajador no ha concurrido a sus labores sin causa justificada, configurándose la causal de inasistencias injustificadas establecida en el Código del Trabajo.', False),
        '160_4a': ('Art. 160 N°4 a) — Abandono del trabajo: salida intempestiva e injustificada',
                   'El trabajador ha abandonado el lugar de trabajo de forma intempestiva e injustificada durante la jornada laboral, sin permiso del empleador.', False),
        '160_4b': ('Art. 160 N°4 b) — Abandono del trabajo: negativa injustificada a trabajar',
                   'El trabajador se ha negado injustificadamente a realizar las faenas convenidas en el contrato de trabajo.', False),
        '160_5':  ('Art. 160 N°5 — Actos, omisiones o imprudencias temerarias que afecten la seguridad',
                   'El trabajador ha incurrido en actos, omisiones o imprudencias temerarias que afectan gravemente la seguridad o el funcionamiento del establecimiento, o la salud de los trabajadores.', False),
        '160_6':  ('Art. 160 N°6 — Perjuicio material causado intencionalmente',
                   'El trabajador ha causado intencionalmente perjuicio material en las instalaciones, maquinarias, herramientas, útiles de trabajo, productos o mercaderías de la empresa.', False),
        '160_7':  ('Art. 160 N°7 — Incumplimiento grave de las obligaciones que impone el contrato',
                   'El trabajador ha incurrido en incumplimiento grave de las obligaciones que le impone el contrato de trabajo.', False),
        '161_1':  ('Art. 161 inciso 1° — Necesidades de la empresa, establecimiento o servicio',
                   'La empresa, por razones derivadas de la racionalización o modernización de la misma, bajas en la productividad, cambios en las condiciones del mercado o de la economía, o que hagan necesaria la separación de uno o más trabajadores, ha decidido poner término al contrato de trabajo.', True),
        '161_2':  ('Art. 161 inciso 2° — Desahucio del empleador',
                   'El empleador, en ejercicio de la facultad contemplada en el inciso segundo del Artículo 161 del Código del Trabajo, pone término al contrato de trabajo mediante desahucio.', True),
        '163bis': ('Art. 163 bis — Liquidación concursal del empleador',
                   'La empresa ha sido sometida a un procedimiento concursal de liquidación de sus bienes por resolución judicial, lo que determina el término del contrato de trabajo conforme a lo dispuesto en el Artículo 163 bis del Código del Trabajo.', True),
    }

    # Las cartas de término (despido) son del plan Starter en adelante.
    _MENSAJE_CARTA_TERMINO = ('Las cartas de término están disponibles desde el plan Starter. '
                              'Mejora tu suscripción para acceder.')

    def _exigir_plan_si_es_carta_de_termino(self, tipo):
        if tipo == 'DESPIDO' and not _plan_permite(self.request.user, 2):
            raise PermissionDenied(self._MENSAJE_CARTA_TERMINO)

    def _montos_legales(self, documento):
        """Indemnizaciones que informa la carta de término (Art. 162 inc. 4°).

        Las calcula el mismo motor del finiquito: el usuario elige la causal,
        la fecha y si dio el aviso previo, pero no escribe los montos.
        """
        if documento.tipo != 'DESPIDO' or documento.causal_articulo not in _CAUSALES_CON_INDEMNIZACION:
            montos = (None, None)
        else:
            fecha = documento.fecha_ultimo_dia or documento.fecha_emision
            if isinstance(fecha, str):
                fecha = datetime.date.fromisoformat(fecha)
            calculado, _ = _calcular_finiquito(
                documento.empleado, fecha, 30, documento.causal_articulo,
                aviso_previo_dado=(documento.aviso_previo_dias or 0) >= 30)
            montos = (calculado['indemnizacion_anos_servicio'], calculado['indemnizacion_sustitutiva_aviso'])
        documento.monto_indemnizacion_anos, documento.monto_indemnizacion_sustitutiva = montos
        documento.save(update_fields=['monto_indemnizacion_anos', 'monto_indemnizacion_sustitutiva'])

    def perform_create(self, serializer):
        self._exigir_plan_si_es_carta_de_termino(serializer.validated_data.get('tipo'))
        self._montos_legales(serializer.save())

    def perform_update(self, serializer):
        self._exigir_plan_si_es_carta_de_termino(
            serializer.validated_data.get('tipo', serializer.instance.tipo))
        documento = serializer.save()
        if documento.archivo_pdf:
            documento.archivo_pdf.delete(save=False)  # el PDF anterior ya no corresponde
        self._montos_legales(documento)

    def get_queryset(self):
        # Solo documentos de empleados que pertenecen al usuario autenticado
        queryset = DocumentoLegal.objects.filter(
            empleado__empresa__owner=self.request.user
        ).order_by('-fecha_emision', '-creado_en')
        empleado_id = self.request.query_params.get('empleado', None)
        if empleado_id is not None:
            queryset = queryset.filter(empleado_id=empleado_id)
        return queryset

    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        documento = self.get_object()
        if documento.tipo == 'DESPIDO' and not _plan_permite(request.user, 2):
            return Response({'error': self._MENSAJE_CARTA_TERMINO}, status=status.HTTP_403_FORBIDDEN)
        try:
            empleado = documento.empleado
            empresa = empleado.empresa

            meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            hoy = documento.fecha_emision
            fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"

            comuna_emp = getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or ''
            comuna_empl = getattr(empleado, 'comuna', '') or ''
            ciudad_segura = str(comuna_emp or comuna_empl or 'Santiago').strip().title()
            es_plan_semilla = _es_plan_semilla(request.user)

            context = {
                'documento': documento,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': fecha_espanol,
                'ciudad': ciudad_segura,
                'es_plan_semilla': es_plan_semilla,
            }

            if documento.tipo == 'DESPIDO':
                # Contexto enriquecido para carta_despido.html
                codigo = documento.causal_articulo or ''
                causal_label, causal_descripcion, requiere_indemnizacion = self._CAUSAL_INFO.get(
                    codigo, (documento.causal_legal or '—', '', False)
                )
                def _fmt_pesos(v):
                    if not v:
                        return '$ 0'
                    return f'$ {v:,}'.replace(',', '.')
                monto_anos  = documento.monto_indemnizacion_anos or 0
                monto_sust  = documento.monto_indemnizacion_sustitutiva or 0
                # Cargo desde contrato si existe
                try:
                    contrato_cargo = documento.empleado.contrato.cargo
                except Exception:
                    contrato_cargo = None
                # Fecha último día en español
                fecha_ultimo_dia_texto = None
                if documento.fecha_ultimo_dia:
                    f = documento.fecha_ultimo_dia
                    fecha_ultimo_dia_texto = f"{f.day:02d} de {meses[f.month - 1]} de {f.year}"
                context.update({
                    'causal_label': causal_label,
                    'causal_descripcion': causal_descripcion,
                    'requiere_indemnizacion': requiere_indemnizacion,
                    'monto_anos_texto': _fmt_pesos(monto_anos),
                    'monto_sustitutiva_texto': _fmt_pesos(monto_sust),
                    'monto_total_texto': _fmt_pesos(monto_anos + monto_sust),
                    'fecha_ultimo_dia_texto': fecha_ultimo_dia_texto,
                    'contrato_cargo': contrato_cargo,
                })
                template = get_template('carta_despido.html')
            else:
                template = get_template('documento_legal.html')

            html = template.render(context)

            response = HttpResponse(content_type='application/pdf')
            nombre_archivo = f'{documento.tipo}_{empleado.rut}.pdf'
            response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'

            pisa_status = pisa.CreatePDF(html, dest=response)

            if pisa_status.err:
                return HttpResponse('Error al generar el PDF.', status=500)
            
            return response

        except Exception as e:
            return Response({'error': f'Error al generar PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
