from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.db import transaction
from .models import Plan, Cliente
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.template.loader import render_to_string
from weasyprint import HTML
import datetime

from .models import Empresa, Empleado, Contrato
from .serializers import EmpresaSerializer, EmpleadoSerializer, ContratoSerializer

# --- BLOQUE DE COMPATIBILIDAD (Windows vs Linux) ---
# Intentamos importar WeasyPrint. Si falla (común en Windows sin GTK3),
# desactivamos la generación de PDF y activamos el modo "Vista Previa HTML".

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

    # ==========================================
    # GENERADOR DE PDF WEASYPRINT
    # ==========================================
    @action(detail=True, methods=['get'])
    def generar_anexo(self, request, pk=None):
        try:
            contrato = self.get_object() # Obtiene el contrato exacto por su ID
            empleado = contrato.empleado
            empresa = empleado.empresa

            # 1. Preparamos los datos que irán al HTML
            context = {
                'contrato': contrato,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': datetime.date.today().strftime("%d de %B de %Y")
            }

            # 2. Renderizamos el HTML con las variables
            html_string = render_to_string('anexo_40h.html', context)

            # 3. WeasyPrint hace la magia: Transforma el HTML en PDF
            pdf_file = HTML(string=html_string).write_pdf()

            # 4. Creamos la respuesta para que el navegador descargue el archivo
            response = HttpResponse(pdf_file, content_type='application/pdf')
            nombre_archivo = f'Anexo_40h_{empleado.rut}.pdf'
            response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
            
            return response

        except Exception as e:
            return Response({'error': f'Error al generar PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ==========================================
# REGISTRO DE NUEVOS CLIENTES (ONBOARDING)
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny]) # Permitir que cualquiera se registre sin estar logueado
def registrar_cliente(request):
    data = request.data
    
    # 1. Validaciones de seguridad (Que no existan duplicados)
    if User.objects.filter(username=data.get('email')).exists():
        return Response({'error': 'Este correo ya está registrado.'}, status=status.HTTP_400_BAD_REQUEST)
    
    if Cliente.objects.filter(rut=data.get('rut')).exists():
        return Response({'error': 'Este RUT ya está registrado.'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        # transaction.atomic asegura que o se crea todo, o no se crea nada.
        with transaction.atomic():
            # 2. Crear el Usuario de acceso (Django User)
            usuario = User.objects.create_user(
                username=data.get('email'),
                email=data.get('email'),
                password=data.get('password')
            )
            
            # 3. Asignar el Plan seleccionado
            plan_id = data.get('planId')
            plan_seleccionado = Plan.objects.filter(id=plan_id).first()
            
            # 4. Crear el Perfil del Cliente
            Cliente.objects.create(
                usuario=usuario,
                plan=plan_seleccionado,
                tipo_cliente=data.get('tipoCliente', 'PERSONA'),
                rut=data.get('rut'),
                nombres=data.get('nombres', ''),
                apellido_paterno=data.get('apellido_paterno', ''),
                apellido_materno=data.get('apellido_materno', ''),
                razon_social=data.get('razon_social', ''),
                direccion=data.get('direccion', ''),
                telefono=data.get('telefono', '')
            )
            
        return Response({'mensaje': '¡Cuenta creada con éxito!'}, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({'error': f'Error interno: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
