"""Contratos, evaluación de jornada y anexos."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from django.http import HttpResponse
from django.template.loader import get_template
from ..models import Contrato, AnexoContrato, ConceptoRemuneracion
from xhtml2pdf import pisa
from django.utils import timezone
import io
from ..jornada import avisos_jornada, jornada_maxima_vigente
from django.core.files.base import ContentFile
from ..serializers import ContratoSerializer, AnexoContratoSerializer

from .base import _MESES, _ctx_contrato, _es_plan_semilla
from .calculo_liquidacion import _normalizar_comisiones_config
from .parametros import ingreso_minimo_vigente


class ContratoViewSet(viewsets.ModelViewSet):
    serializer_class = ContratoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Contrato.objects.filter(empleado__empresa__owner=self.request.user)
        empleado_id = self.request.query_params.get('empleado')
        if empleado_id:
            queryset = queryset.filter(empleado_id=empleado_id)
        return queryset

    def _build_contrato_context(self, contrato, es_plan_semilla):
        return _ctx_contrato(contrato, es_plan_semilla)

    def perform_create(self, serializer):
        self._guardar_normalizando(serializer)

    def perform_update(self, serializer):
        contrato = self._guardar_normalizando(serializer)
        # Los PDF guardados reflejan las condiciones anteriores: se descartan
        # y se vuelven a generar al descargarlos.
        for archivo in (contrato.archivo_contrato, contrato.archivo_anexo_40h):
            if archivo:
                archivo.delete(save=False)
        contrato.save(update_fields=['archivo_contrato', 'archivo_anexo_40h'])

    def _pdf_de_contrato(self, contrato, plantilla, campo, nombre):
        """Genera y guarda el PDF del contrato o del anexo 40h; devuelve sus bytes."""
        context = self._build_contrato_context(contrato, _es_plan_semilla(self.request.user))
        pdf_buf = io.BytesIO()
        if pisa.CreatePDF(get_template(plantilla).render(context), dest=pdf_buf).err:
            raise ValueError('Error al generar el PDF.')
        archivo = getattr(contrato, campo)
        if archivo:
            archivo.delete(save=False)
        getattr(contrato, campo).save(nombre, ContentFile(pdf_buf.getvalue()), save=True)
        return pdf_buf.getvalue()

    def _guardar_normalizando(self, serializer):
        """Resuelve las categorías de comisión a conceptos del catálogo."""
        contrato = serializer.save()
        config = _normalizar_comisiones_config(
            contrato.comisiones_config, contrato.empleado.empresa)
        if config != contrato.comisiones_config:
            contrato.comisiones_config = config
            contrato.save(update_fields=['comisiones_config'])
        return contrato

    @action(detail=False, methods=['post'], url_path='evaluar-jornada')
    def evaluar_jornada(self, request):
        """Avisos de jornada para un contrato que se está editando.

        El formulario lo llama mientras el usuario escribe, para mostrar los
        incumplimientos antes de guardar. Solo informa: guardar un contrato que
        incumple sigue permitido, la decisión es del usuario.
        """
        datos = request.data
        return Response({
            'jornada_maxima_vigente': jornada_maxima_vigente(),
            'avisos': avisos_jornada(
                datos.get('tipo_jornada'),
                datos.get('horas_semanales'),
                datos.get('distribucion_horario'),
                sueldo_base=datos.get('sueldo_base'),
                ingreso_minimo=ingreso_minimo_vigente(),
            ),
        })

    @action(detail=True, methods=['post'])
    def generar_contrato_pdf(self, request, pk=None):
        try:
            contrato = self.get_object()
            es_plan_semilla = _es_plan_semilla(request.user)
            context = self._build_contrato_context(contrato, es_plan_semilla)
            html = get_template('contrato_trabajo.html').render(context)
            pdf_buf = io.BytesIO()
            pisa_status = pisa.CreatePDF(html, dest=pdf_buf)
            if pisa_status.err:
                return Response({'error': 'Error al generar el PDF.'}, status=500)
            if contrato.archivo_contrato:
                contrato.archivo_contrato.delete(save=False)
            nombre = f"Contrato_{contrato.empleado.rut}.pdf"
            contrato.archivo_contrato.save(nombre, ContentFile(pdf_buf.getvalue()), save=True)
            return Response({'ok': True, 'mensaje': 'Contrato generado y guardado exitosamente.'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def descargar_contrato(self, request, pk=None):
        try:
            contrato = self.get_object()
            nombre = f"Contrato_{contrato.empleado.rut}.pdf"
            # Sin PDF guardado (nuevo o recién editado) se genera en el momento.
            datos = (contrato.archivo_contrato.read() if contrato.archivo_contrato
                     else self._pdf_de_contrato(contrato, 'contrato_trabajo.html', 'archivo_contrato', nombre))
            response = HttpResponse(datos, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{nombre}"'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def generar_anexo_40h(self, request, pk=None):
        try:
            contrato = self.get_object()
            es_plan_semilla = _es_plan_semilla(request.user)
            context = self._build_contrato_context(contrato, es_plan_semilla)
            html = get_template('anexo_40h.html').render(context)
            pdf_buf = io.BytesIO()
            pisa_status = pisa.CreatePDF(html, dest=pdf_buf)
            if pisa_status.err:
                return Response({'error': 'Error al generar el PDF.'}, status=500)
            if contrato.archivo_anexo_40h:
                contrato.archivo_anexo_40h.delete(save=False)
            nombre = f"Anexo_40h_{contrato.empleado.rut}.pdf"
            contrato.archivo_anexo_40h.save(nombre, ContentFile(pdf_buf.getvalue()), save=True)
            return Response({'ok': True, 'mensaje': 'Anexo 40h generado y guardado exitosamente.'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def descargar_anexo_40h(self, request, pk=None):
        try:
            contrato = self.get_object()
            nombre = f"Anexo_40h_{contrato.empleado.rut}.pdf"
            datos = (contrato.archivo_anexo_40h.read() if contrato.archivo_anexo_40h
                     else self._pdf_de_contrato(contrato, 'anexo_40h.html', 'archivo_anexo_40h', nombre))
            response = HttpResponse(datos, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{nombre}"'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Mantener compatibilidad con descarga masiva ZIP (sin guardar)
    @action(detail=True, methods=['get'])
    def generar_anexo(self, request, pk=None):
        try:
            contrato = self.get_object()
            es_plan_semilla = _es_plan_semilla(request.user)
            context = self._build_contrato_context(contrato, es_plan_semilla)
            html = get_template('anexo_40h.html').render(context)
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Anexo_40h_{contrato.empleado.rut}.pdf"'
            pisa.CreatePDF(html, dest=response)
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
# Campos del contrato que un anexo puede modificar. Todo lo que no esté acá
# se ignora, aunque venga en el JSON: evita que un payload manipulado cambie
# el empleado dueño del contrato o campos que no corresponden a un anexo.
_CAMPOS_ANEXO_APLICABLES = {
    'cargo':               str,
    'sueldo_base':         int,
    'tipo_jornada':        str,
    'horas_semanales':     float,
    'gratificacion_legal': str,
    'es_comisionista':     bool,
    'comisiones_config':   list,
    'tiene_quincena':      bool,
    'dia_quincena':        int,
    'monto_quincena':      int,
}

_ETIQUETAS_CAMPOS_ANEXO = {
    'cargo':               'Cargo',
    'sueldo_base':         'Sueldo base',
    'tipo_jornada':        'Tipo de jornada',
    'horas_semanales':     'Horas semanales',
    'gratificacion_legal': 'Gratificación legal',
    'es_comisionista':     'Remuneración por comisiones',
    'comisiones_config':   'Comisiones por venta',
    'tiene_quincena':      'Anticipo quincenal',
    'dia_quincena':        'Día de la quincena',
    'monto_quincena':      'Monto de la quincena',
}


def _formatear_valor_anexo(campo, valor) -> str:
    """Representación legible de un valor para la cláusula del anexo."""
    if campo == 'comisiones_config':
        if not valor:
            return 'sin comisiones'
        ids = [c.get('concepto') for c in valor if c.get('concepto')]
        nombres = {c.id: c.nombre
                   for c in ConceptoRemuneracion.objects.filter(id__in=ids)}
        return ', '.join(
            f"{nombres.get(c.get('concepto'), c.get('glosa', ''))} "
            f"{c.get('porcentaje', 0)}%" for c in valor
        )
    if isinstance(valor, bool):
        return 'Sí' if valor else 'No'
    if campo in ('sueldo_base', 'monto_quincena') and valor:
        return f"${int(valor):,}".replace(',', '.')
    return str(valor)


def _clausulas_desde_cambios(anexo, contrato) -> list:
    """Genera el texto de las cláusulas a partir de los cambios estructurados.

    Se antepone a las cláusulas de texto libre que haya escrito el empleador,
    para que el PDF refleje siempre lo que el anexo modifica de verdad.
    """
    cambios = anexo.cambios or {}
    if not cambios:
        return []

    desde = anexo.vigencia_desde or anexo.fecha_emision
    fecha_txt = f"{desde.day:02d} de {_MESES[desde.month - 1]} de {desde.year}"

    clausulas = []
    for campo, valor_nuevo in cambios.items():
        if campo not in _CAMPOS_ANEXO_APLICABLES:
            continue
        etiqueta = _ETIQUETAS_CAMPOS_ANEXO.get(campo, campo)
        anterior = _formatear_valor_anexo(campo, getattr(contrato, campo, None))
        nuevo = _formatear_valor_anexo(campo, valor_nuevo)
        clausulas.append(
            f"{etiqueta}: se modifica de «{anterior}» a «{nuevo}», "
            f"con vigencia a contar del {fecha_txt}."
        )
    return clausulas


def _aplicar_anexo_a_contrato(anexo) -> bool:
    """Traspasa los cambios del anexo al contrato. Se llama al firmarse.

    Retorna True si aplicó algo. Es idempotente: un anexo ya aplicado no
    vuelve a tocar el contrato.
    """
    if anexo.aplicado or not anexo.cambios:
        return False

    contrato = anexo.contrato
    campos_actualizados = []

    for campo, valor in anexo.cambios.items():
        tipo = _CAMPOS_ANEXO_APLICABLES.get(campo)
        if tipo is None:
            continue
        try:
            if tipo is bool:
                valor_limpio = bool(valor)
            elif tipo is list:
                valor_limpio = list(valor or [])
            elif valor is None or valor == '':
                continue
            else:
                valor_limpio = tipo(valor)
        except (TypeError, ValueError):
            continue
        if campo == 'comisiones_config':
            valor_limpio = _normalizar_comisiones_config(
                valor_limpio, contrato.empleado.empresa)
        setattr(contrato, campo, valor_limpio)
        campos_actualizados.append(campo)

    if not campos_actualizados:
        return False

    contrato.save(update_fields=campos_actualizados)
    anexo.aplicado = True
    anexo.aplicado_en = timezone.now()
    anexo.save(update_fields=['aplicado', 'aplicado_en'])
    return True


class AnexoContratoViewSet(viewsets.ModelViewSet):
    serializer_class = AnexoContratoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = AnexoContrato.objects.filter(
            contrato__empleado__empresa__owner=self.request.user
        ).order_by('-fecha_emision')
        empleado_id = self.request.query_params.get('empleado')
        if empleado_id:
            queryset = queryset.filter(contrato__empleado_id=empleado_id)
        return queryset

    def create(self, request, *args, **kwargs):
        contrato_id = request.data.get('contrato')
        try:
            Contrato.objects.get(id=contrato_id, empleado__empresa__owner=request.user)
        except Contrato.DoesNotExist:
            return Response({'error': 'Contrato no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if self.get_object().aplicado:
            return Response(
                {'error': 'Este anexo ya fue firmado y sus cambios se aplicaron al contrato; no puede modificarse.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if self.get_object().aplicado:
            return Response(
                {'error': 'Este anexo ya fue firmado y sus cambios se aplicaron al contrato; no puede eliminarse.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        anexo = serializer.save()

        # Las cláusulas del cambio estructurado se materializan al crear el
        # anexo, cuando el contrato todavía tiene los valores anteriores: así
        # el documento deja constancia del "de X a Y" tal como era en ese momento.
        generadas = _clausulas_desde_cambios(anexo, anexo.contrato)
        if generadas:
            anexo.clausulas_modificadas = generadas + list(anexo.clausulas_modificadas or [])
            anexo.save(update_fields=['clausulas_modificadas'])

        try:
            contrato = anexo.contrato
            empleado = contrato.empleado
            empresa = empleado.empresa
            es_plan_semilla = _es_plan_semilla(self.request.user)
            meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
            fecha_obj = anexo.fecha_emision
            fecha_espanol = f"{fecha_obj.day:02d} de {meses[fecha_obj.month - 1]} de {fecha_obj.year}"
            ciudad = str(getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()
            context = {
                'anexo': anexo, 'contrato': contrato, 'empleado': empleado,
                'empresa': empresa, 'fecha_actual': fecha_espanol,
                'ciudad': ciudad, 'es_plan_semilla': es_plan_semilla,
            }
            html = get_template('anexo_contrato.html').render(context)
            pdf_buf = io.BytesIO()
            pisa_status = pisa.CreatePDF(html, dest=pdf_buf)
            if not pisa_status.err and pdf_buf.getvalue():
                nombre = f"AnexoContrato_{empleado.rut}_{anexo.fecha_emision}.pdf"
                anexo.archivo_pdf.save(nombre, ContentFile(pdf_buf.getvalue()), save=True)
        except Exception:
            pass  # No bloqueamos el guardado si el PDF falla

    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        try:
            anexo = self.get_object()
            contrato = anexo.contrato
            empleado = contrato.empleado
            empresa = empleado.empresa
            es_plan_semilla = _es_plan_semilla(request.user)

            meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
            hoy = anexo.fecha_emision
            fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
            ciudad = str(getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()

            context = {
                'anexo': anexo,
                'contrato': contrato,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': fecha_espanol,
                'ciudad': ciudad,
                'es_plan_semilla': es_plan_semilla,
            }
            template = get_template('anexo_contrato.html')
            html = template.render(context)

            response = HttpResponse(content_type='application/pdf')
            nombre = f"Anexo_{empleado.rut}_{hoy}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{nombre}"'
            pisa_status = pisa.CreatePDF(html, dest=response)
            if pisa_status.err:
                return Response({'error': 'Error generando PDF'}, status=500)
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=500)
