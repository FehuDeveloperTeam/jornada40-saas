from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from django.contrib.auth.models import User
from django.db import transaction
from django.http import HttpResponse
from django.template.loader import render_to_string, get_template
from xhtml2pdf import pisa
import datetime
import io
import zipfile

from .models import Plan, Cliente, Empresa, Empleado, Contrato
from .serializers import EmpresaSerializer, EmpleadoSerializer, ContratoSerializer

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

    @action(detail=False, methods=['post'])
    def carga_masiva(self, request):
        datos_excel = request.data # Recibimos la lista de empleados desde React
        usuario = request.user
        
        try:
            # 1. Identificar la empresa y el plan del cliente
            empresa = Empresa.objects.filter(owner=usuario).first()
            cliente = Cliente.objects.filter(usuario=usuario).first()
            
            # ATENCIÓN: Asegúrate de que tu modelo 'Plan' tenga un campo numérico para el límite. 
            limite_plan = cliente.plan.limite_trabajadores 
            
            # 2. Calcular cuánto espacio le queda
            trabajadores_actuales = Empleado.objects.filter(empresa=empresa).count()
            espacio_disponible = limite_plan - trabajadores_actuales
            
            if espacio_disponible <= 0:
                return Response(
                    {'error': 'No tienes espacio. Has alcanzado el límite máximo de tu plan.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            mensaje_advertencia = None
            
            # 3. Cortar la lista si supera el límite
            if len(datos_excel) > espacio_disponible:
                # Cortamos la lista hasta donde alcance
                datos_excel = datos_excel[:espacio_disponible]
                
                # Obtenemos al último que logró entrar
                ultimo = datos_excel[-1]
                nombre_completo_ultimo = f"{ultimo.get('nombres', '')} {ultimo.get('apellido_paterno', '')} {ultimo.get('apellido_materno', '')}".strip().upper()
                
                mensaje_advertencia = f"¡ATENCIÓN! llegaste al total de trabajadores, se cargará hasta {nombre_completo_ultimo}"

            # 4. Guardar masivamente en la base de datos
            nuevos_empleados = []
            with transaction.atomic(): # Esto asegura que si uno falla, no se guarde ninguno a medias
                for item in datos_excel:
                    empleado = Empleado(
                        empresa=empresa,
                        rut=item.get('rut'),
                        nombres=item.get('nombres'),
                        apellido_paterno=item.get('apellido_paterno'),
                        apellido_materno=item.get('apellido_materno', ''),
                        cargo=item.get('cargo', 'No especificado'),
                        sueldo_base=item.get('sueldo_base', 0),
                        fecha_ingreso=item.get('fecha_ingreso') or datetime.date.today()
                    )
                    nuevos_empleados.append(empleado)
                
                Empleado.objects.bulk_create(nuevos_empleados)

            # 5. Responder al frontend
            return Response({
                'mensaje': 'Carga masiva exitosa',
                'advertencia': mensaje_advertencia # Enviamos la advertencia si hubo corte
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': f'Error procesando el archivo: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def descargar_anexos_zip(self, request):
        empleado_ids = request.data.get('empleados', [])
        
        if not empleado_ids:
            return Response({'error': 'No se seleccionaron trabajadores'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Creamos un archivo ZIP virtual en la memoria del servidor
        zip_buffer = io.BytesIO()
        
        # Abrimos el ZIP para empezar a meterle PDFs
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for emp_id in empleado_ids:
                try:
                    # Validamos que el empleado sea de la empresa del usuario
                    empleado = Empleado.objects.get(id=emp_id, empresa__owner=request.user)
                    empresa = empleado.empresa
                    
                    # 2. Buscar o crear contrato automáticamente (como lo hacíamos en React)
                    contrato = Contrato.objects.filter(empleado=empleado).first()
                    if not contrato:
                        contrato = Contrato.objects.create(
                            empleado=empleado,
                            tipo_contrato='INDEFINIDO',
                            fecha_inicio=empleado.fecha_ingreso or datetime.date.today(),
                            sueldo_base=empleado.sueldo_base or 0,
                            cargo=empleado.cargo or 'No especificado'
                        )
                    
                    # 3. Preparar los datos y la fecha en español
                    meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                             "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
                    hoy = datetime.date.today()
                    fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
                    ciudad = getattr(empresa, 'comuna', None) or getattr(empresa, 'ciudad', None) or getattr(empleado, 'comuna', 'Santiago')

                    context = {
                        'contrato': contrato,
                        'empleado': empleado,
                        'empresa': empresa,
                        'fecha_actual': fecha_espanol,
                        'ciudad': ciudad.title()
                    }
                    
                    # 4. Renderizar el HTML
                    template = get_template('anexo_40h.html')
                    html = template.render(context)
                    
                    # 5. Crear el PDF virtualmente
                    pdf_buffer = io.BytesIO()
                    pisa_status = pisa.CreatePDF(html, dest=pdf_buffer)
                    
                    if not pisa_status.err:
                        # 6. Guardar el PDF dentro del ZIP con el RUT del trabajador
                        nombre_archivo = f"Anexo_40h_{empleado.rut}.pdf"
                        zip_file.writestr(nombre_archivo, pdf_buffer.getvalue())
                        
                except Exception as e:
                    print(f"Error generando PDF para empleado {emp_id}: {e}")
                    continue # Si falla uno, que siga con los demás
        
        # 7. Preparamos el ZIP para enviarlo por HTTP
        zip_buffer.seek(0)
        response = HttpResponse(zip_buffer, content_type='application/zip')
        response['Content-Disposition'] = 'attachment; filename="Anexos_Masivos_40h.zip"'
        
        return response


class ContratoViewSet(viewsets.ModelViewSet):
    serializer_class = ContratoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # 1. Obtenemos todos los contratos de la empresa
        queryset = Contrato.objects.filter(empleado__empresa__owner=self.request.user)
        
        # 2. LA MAGIA: Si React pide un empleado en específico, lo filtramos
        empleado_id = self.request.query_params.get('empleado')
        if empleado_id:
            queryset = queryset.filter(empleado_id=empleado_id)
            
        return queryset

    # ==========================================
    # GENERADOR DE PDF XHTML2PDF
    # ==========================================
    @action(detail=True, methods=['get'])
    def generar_anexo(self, request, pk=None):
        try:
            contrato = self.get_object() # Obtiene el contrato exacto por su ID
            empleado = contrato.empleado
            empresa = empleado.empresa

            # 1. TRUCO PARA FECHA SIEMPRE EN ESPAÑOL
            meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                     "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            hoy = datetime.date.today()
            fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"

            # 2. OBTENER LA CIUDAD DINÁMICAMENTE
            # Busca si la empresa tiene comuna/ciudad, si no, usa la del empleado, si no, "Santiago"
            ciudad = getattr(empresa, 'comuna', None) or getattr(empresa, 'ciudad', None) or getattr(empleado, 'comuna', 'Santiago')

            # 3. Preparamos los datos
            context = {
                'contrato': contrato,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': fecha_espanol,
                'ciudad': ciudad.title() # Pone la primera letra en mayúscula (ej: "Concepción")
            }

            # 2. Obtenemos el template y lo renderizamos
            template = get_template('anexo_40h.html')
            html = template.render(context)

            # 3. Creamos la respuesta HTTP tipo PDF
            response = HttpResponse(content_type='application/pdf')
            nombre_archivo = f'Anexo_40h_{empleado.rut}.pdf'
            response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'

            # 4. xhtml2pdf hace la magia: Transforma el HTML en PDF
            pisa_status = pisa.CreatePDF(html, dest=response)

            # Si hay un error interno en la creación
            if pisa_status.err:
                return HttpResponse(f'Tuvimos algunos errores al generar el PDF <pre>{html}</pre>', status=500)
            
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
                username=data.get('rut'),
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