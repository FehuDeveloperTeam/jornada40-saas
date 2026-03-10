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

def estandarizar_fecha(fecha_valor):
    if not fecha_valor:
        return None
    
    fecha_str = str(fecha_valor).strip()
    
    # 1. Si Excel lo mandó como número de serie invisible (ej: 20517)
    try:
        serial = float(fecha_str)
        base = datetime.datetime(1899, 12, 30)
        return (base + datetime.timedelta(days=serial)).date()
    except ValueError:
        pass

    # 2. Si viene como texto, probamos todos los formatos posibles chilenos
    formatos = [
        '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', 
        '%d-%m-%y', '%d/%m/%y', '%m/%d/%y', '%m/%d/%Y'
    ]
    for fmt in formatos:
        try:
            dt = datetime.datetime.strptime(fecha_str, fmt).date()
            # Corrección del efecto "Y2K": Si el Excel manda "56", Python a veces cree que es "2056".
            # Si el año resulta ser mayor al actual (imposible para un nacimiento o ingreso), le restamos 100 años.
            if dt.year > datetime.date.today().year:
                dt = dt.replace(year=dt.year - 100)
            return dt
        except ValueError:
            continue
            
    return None # Si de verdad mandaron algo ilegible, lo dejamos vacío
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
            # 1. Identificar la empresa del usuario
            empresa = Empresa.objects.filter(owner=usuario).first()
            
            # 2. DEFINIR EL LÍMITE (Evitando el error del Admin)
            if usuario.is_superuser:
                limite_plan = 999999  # El admin tiene cupos ilimitados
            else:
                cliente = Cliente.objects.filter(usuario=usuario).first()
                # Validación extra por si un cliente normal se quedó sin plan por algún error
                if not cliente or not getattr(cliente, 'plan', None):
                    return Response(
                        {'error': 'Tu cuenta no tiene un plan activo. Contacta a soporte.'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                limite_plan = cliente.plan.limite_trabajadores 
            
            # 3. Calcular cuánto espacio le queda
            trabajadores_actuales = Empleado.objects.filter(empresa=empresa).count()
            espacio_disponible = limite_plan - trabajadores_actuales
            
            if espacio_disponible <= 0:
                return Response(
                    {'error': 'No tienes espacio. Has alcanzado el límite máximo de tu plan.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            mensaje_advertencia = None
            
            # Limpiamos filas vacías por si el Excel trae basura al final
            datos_limpios = [item for item in datos_excel if item.get('rut') and item.get('nombres')]
            # 3. Cortar la lista si supera el límite
            if len(datos_limpios) > espacio_disponible:
                # Cortamos la lista hasta donde alcance
                datos_limpios = datos_limpios[:espacio_disponible]
                
                # Obtenemos al último que logró entrar
                ultimo = datos_limpios[-1]
                nombre_completo_ultimo = f"{ultimo.get('nombres', '')} {ultimo.get('apellido_paterno', '')} {ultimo.get('apellido_materno', '')}".strip().upper()
                
                mensaje_advertencia = f"¡ATENCIÓN! llegaste al total de trabajadores, se cargará hasta {nombre_completo_ultimo}"

            # 4. Guardar masivamente en la base de datos con TODOS los campos
            nuevos_empleados = []
            with transaction.atomic(): # Esto asegura que si uno falla, no se guarde ninguno a medias
                for item in datos_limpios:
                    
                    # Manejo seguro de fechas para evitar que la BD colapse si vienen vacías
                   
                    fecha_nac = estandarizar_fecha(item.get('fecha_nacimiento'))
                    fecha_ing = estandarizar_fecha(item.get('fecha_ingreso')) or datetime.date.today()

                    # Limpieza de números
                    try: horas = int(item.get('horas_laborales') or 40)
                    except: horas = 40
                        
                    try: sueldo = int(item.get('sueldo_base') or 0)
                    except: sueldo = 0

                    empleado = Empleado(
                        empresa=empresa,
                        rut=str(item.get('rut')).strip(),
                        nombres=str(item.get('nombres')).strip(),
                        apellido_paterno=str(item.get('apellido_paterno', '')).strip(),
                        apellido_materno=str(item.get('apellido_materno', '')).strip(),
                        sexo=str(item.get('sexo', '')).strip(),
                        nacionalidad=str(item.get('nacionalidad', '')).strip(),
                        fecha_nacimiento=fecha_nac,
                        estado_civil=str(item.get('estado_civil', '')).strip(),
                        numero_telefono=str(item.get('numero_telefono', '')).strip(),
                        comuna=str(item.get('comuna', '')).strip(),
                        direccion=str(item.get('direccion', '')).strip(),
                        departamento=str(item.get('departamento', '')).strip(),
                        cargo=str(item.get('cargo', 'No especificado')).strip(),
                        sucursal=str(item.get('sucursal', '')).strip(),
                        fecha_ingreso=fecha_ing,
                        horas_laborales=horas,
                        modalidad=str(item.get('modalidad', 'PRESENCIAL')).strip(),
                        sueldo_base=sueldo,
                        afp=str(item.get('afp', '')).strip(),
                        sistema_salud=str(item.get('sistema_salud', '')).strip(),
                        activo=True
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
                    
                    # 2. Buscar o crear contrato automáticamente
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
            ciudad = getattr(empresa, 'comuna', None) or getattr(empresa, 'ciudad', None) or getattr(empleado, 'comuna', 'Santiago')

            # 3. Preparamos los datos
            context = {
                'contrato': contrato,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': fecha_espanol,
                'ciudad': ciudad.title()
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

            if pisa_status.err:
                return HttpResponse(f'Tuvimos algunos errores al generar el PDF <pre>{html}</pre>', status=500)
            
            return response

        except Exception as e:
            return Response({'error': f'Error al generar PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ==========================================
# REGISTRO DE NUEVOS CLIENTES (ONBOARDING)
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny]) 
def registrar_cliente(request):
    data = request.data
    
    if User.objects.filter(username=data.get('email')).exists():
        return Response({'error': 'Este correo ya está registrado.'}, status=status.HTTP_400_BAD_REQUEST)
    
    if Cliente.objects.filter(rut=data.get('rut')).exists():
        return Response({'error': 'Este RUT ya está registrado.'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        with transaction.atomic():
            usuario = User.objects.create_user(
                username=data.get('rut'),
                email=data.get('email'),
                password=data.get('password')
            )
            
            plan_id = data.get('planId')
            plan_seleccionado = Plan.objects.filter(id=plan_id).first()
            
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