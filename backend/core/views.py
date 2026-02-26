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
    serializer_class = EmpresaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # El usuario solo puede ver su propia empresa
        return Empresa.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        # Asigna automáticamente el usuario logueado como dueño
        serializer.save(owner=self.request.user)

class EmpleadoViewSet(viewsets.ModelViewSet):
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Solo devuelve los empleados cuya empresa pertenezca al usuario logueado
        return Empleado.objects.filter(empresa__owner=self.request.user)

    def perform_create(self, serializer):
        # Como el frontend YA envía el ID de la empresa en el payload ("empresa": 1),
        # simplemente le decimos al serializador que guarde los datos tal cual llegaron.
        serializer.save()

class ContratoViewSet(viewsets.ModelViewSet):
    serializer_class = ContratoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Viajamos: Contrato -> Empleado -> Empresa -> Owner
        # Solo devuelve contratos de los empleados que pertenecen a la empresa de este usuario
        return Contrato.objects.filter(empleado__empresa__owner=self.request.user)

    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        """
        Genera el Anexo de Contrato.
        ... (Aquí dejas el código de tu función generar_pdf exactamente como lo tienes) ...
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
            return HttpResponse(html_string)
