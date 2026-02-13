from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.template.loader import render_to_string

from .models import Empresa, Empleado, Contrato
from .serializers import EmpresaSerializer, EmpleadoSerializer, ContratoSerializer

# --- BLOQUE DE COMPATIBILIDAD (Windows vs Linux) ---
# Intentamos importar WeasyPrint. Si falla (común en Windows sin GTK3),
# desactivamos la generación de PDF y activamos el modo "Vista Previa HTML".
try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except OSError:
    WEASYPRINT_AVAILABLE = False
# ---------------------------------------------------

class EmpresaViewSet(viewsets.ModelViewSet):
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Asigna automáticamente el usuario logueado como dueño
        serializer.save(owner=self.request.user)

class EmpleadoViewSet(viewsets.ModelViewSet):
    queryset = Empleado.objects.all()
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]

class ContratoViewSet(viewsets.ModelViewSet):
    queryset = Contrato.objects.all()
    serializer_class = ContratoSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        """
        Genera el Anexo de Contrato.
        - En Producción (Railway): Descarga un PDF.
        - En Desarrollo (Windows sin GTK): Muestra el HTML en el navegador.
        """
        contrato = self.get_object()
        
        # 1. Renderizar la plantilla con datos reales
        # Asegúrate de que 'backend/core/templates/anexo_40h.html' exista
        html_string = render_to_string('anexo_40h.html', {'contrato': contrato})
        
        # 2. Decisión basada en el entorno
        if WEASYPRINT_AVAILABLE:
            # Lógica para Servidor (Linux/Mac o Windows con GTK3)
            pdf_file = HTML(string=html_string).write_pdf()
            
            response = HttpResponse(pdf_file, content_type='application/pdf')
            filename = f"Anexo_40h_{contrato.empleado.rut}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        else:
            # Lógica de Fallback (Tu PC actual)
            # Retorna el HTML puro para validación visual rápida
            return HttpResponse(html_string)