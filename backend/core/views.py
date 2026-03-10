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

# ==========================================
# TRADUCTOR INTELIGENTE DE FECHAS EXCEL
# ==========================================
def estandarizar_fecha(fecha_valor):
    if not fecha_valor:
        return None
    
    fecha_str = str(fecha_valor).strip()
    
    try:
        serial = float(fecha_str)
        base = datetime.datetime(1899, 12, 30)
        return (base + datetime.timedelta(days=serial)).date()
    except ValueError:
        pass

    formatos = [
        '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', 
        '%d-%m-%y', '%d/%m/%y', '%m/%d/%y', '%m/%d/%Y'
    ]
    for fmt in formatos:
        try:
            dt = datetime.datetime.strptime(fecha_str, fmt).date()
            if dt.year > datetime.date.today().year:
                dt = dt.replace(year=dt.year - 100)
            return dt
        except ValueError:
            continue
            
    return None

class EmpresaViewSet(viewsets.ModelViewSet):
    serializer_class = EmpresaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Empresa.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class EmpleadoViewSet(viewsets.ModelViewSet):
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Empleado.objects.filter(empresa__owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=['post'])
    def carga_masiva(self, request):
        datos_excel = request.data 
        usuario = request.user
        
        try:
            empresa = Empresa.objects.filter(owner=usuario).first()
            
            if usuario.is_superuser:
                limite_plan = 999999
            else:
                cliente = Cliente.objects.filter(usuario=usuario).first()
                if not cliente or not getattr(cliente, 'plan', None):
                    return Response({'error': 'Tu cuenta no tiene un plan activo. Contacta a soporte.'}, status=status.HTTP_400_BAD_REQUEST)
                limite_plan = cliente.plan.limite_trabajadores 
            
            trabajadores_actuales = Empleado.objects.filter(empresa=empresa).count()
            espacio_disponible = limite_plan - trabajadores_actuales
            
            if espacio_disponible <= 0:
                return Response({'error': 'Has alcanzado el límite máximo de tu plan.'}, status=status.HTTP_400_BAD_REQUEST)

            mensaje_advertencia = None
            datos_limpios = [item for item in datos_excel if item.get('rut') and item.get('nombres')]

            if len(datos_limpios) > espacio_disponible:
                datos_limpios = datos_limpios[:espacio_disponible]
                ultimo = datos_limpios[-1]
                nombre_completo_ultimo = f"{ultimo.get('nombres', '')} {ultimo.get('apellido_paterno', '')}".strip().upper()
                mensaje_advertencia = f"¡ATENCIÓN! llegaste al total de trabajadores, se cargará hasta {nombre_completo_ultimo}"

            nuevos_empleados = []
            with transaction.atomic(): 
                for item in datos_limpios:
                    fecha_nac = estandarizar_fecha(item.get('fecha_nacimiento'))
                    fecha_ing = estandarizar_fecha(item.get('fecha_ingreso')) or datetime.date.today()

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

            return Response({
                'mensaje': 'Carga masiva exitosa',
                'advertencia': mensaje_advertencia 
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': f'Error procesando archivo: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def descargar_anexos_zip(self, request):
        empleado_ids = request.data.get('empleados', [])
        
        if not empleado_ids:
            return Response({'error': 'No se seleccionaron trabajadores'}, status=status.HTTP_400_BAD_REQUEST)
        
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for emp_id in empleado_ids:
                try:
                    empleado = Empleado.objects.get(id=emp_id, empresa__owner=request.user)
                    empresa = empleado.empresa
                    
                    # 1. GENERADOR DE CONTRATOS ANTI-FALLOS
                    contrato = Contrato.objects.filter(empleado=empleado).first()
                    if not contrato:
                        # Limpiamos los datos para que la Base de Datos no colapse
                        try: s_base = int(str(empleado.sueldo_base).strip()) if empleado.sueldo_base else 0
                        except: s_base = 0
                        
                        f_inicio = empleado.fecha_ingreso if isinstance(empleado.fecha_ingreso, datetime.date) else datetime.date.today()
                        c_cargo = str(empleado.cargo).strip() if empleado.cargo else 'No especificado'
                        
                        try:
                            contrato = Contrato.objects.create(
                                empleado=empleado,
                                tipo_contrato='INDEFINIDO',
                                fecha_inicio=f_inicio,
                                sueldo_base=s_base,
                                cargo=c_cargo
                            )
                        except Exception as e:
                            # Si la BD lo rechaza, creamos uno virtual en la RAM para que el PDF se dibuje igual
                            print(f"Aviso BD Contrato - Creando virtual para {empleado.rut}: {e}")
                            class ContratoVirtual:
                                pass
                            contrato = ContratoVirtual()
                            contrato.sueldo_base = s_base

                    # 2. FECHA Y CIUDAD SEGURAS (Sin errores de "NoneType")
                    meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
                    hoy = datetime.date.today()
                    fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
                    
                    comuna_emp = getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or ''
                    comuna_empl = getattr(empleado, 'comuna', '') or ''
                    ciudad_segura = str(comuna_emp or comuna_empl or 'Santiago').strip()

                    context = {
                        'contrato': contrato,
                        'empleado': empleado,
                        'empresa': empresa,
                        'fecha_actual': fecha_espanol,
                        'ciudad': ciudad_segura.title()
                    }
                    
                    # 3. RENDERIZADO DEL PDF
                    template = get_template('anexo_40h.html')
                    html = template.render(context)
                    
                    pdf_buffer = io.BytesIO()
                    pisa_status = pisa.CreatePDF(html, dest=pdf_buffer)
                    
                    if not pisa_status.err:
                        nombre_archivo = f"Anexo_40h_{empleado.rut}.pdf"
                        zip_file.writestr(nombre_archivo, pdf_buffer.getvalue())
                        
                except Exception as e:
                    print(f"Error fatal saltando empleado {emp_id} en ZIP: {e}")
                    continue 
        
        zip_buffer.seek(0)
        response = HttpResponse(zip_buffer, content_type='application/zip')
        response['Content-Disposition'] = 'attachment; filename="Anexos_Masivos_40h.zip"'
        return response


class ContratoViewSet(viewsets.ModelViewSet):
    serializer_class = ContratoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Contrato.objects.filter(empleado__empresa__owner=self.request.user)
        empleado_id = self.request.query_params.get('empleado')
        if empleado_id:
            queryset = queryset.filter(empleado_id=empleado_id)
        return queryset

    @action(detail=True, methods=['get'])
    def generar_anexo(self, request, pk=None):
        try:
            contrato = self.get_object() 
            empleado = contrato.empleado
            empresa = empleado.empresa

            meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            hoy = datetime.date.today()
            fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"

            comuna_emp = getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or ''
            comuna_empl = getattr(empleado, 'comuna', '') or ''
            ciudad_segura = str(comuna_emp or comuna_empl or 'Santiago').strip()

            context = {
                'contrato': contrato,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': fecha_espanol,
                'ciudad': ciudad_segura.title() 
            }

            template = get_template('anexo_40h.html')
            html = template.render(context)

            response = HttpResponse(content_type='application/pdf')
            nombre_archivo = f'Anexo_40h_{empleado.rut}.pdf'
            response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'

            pisa_status = pisa.CreatePDF(html, dest=response)

            if pisa_status.err:
                return HttpResponse(f'Errores al generar PDF <pre>{html}</pre>', status=500)
            
            return response

        except Exception as e:
            return Response({'error': f'Error al generar PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ==========================================
# REGISTRO DE NUEVOS CLIENTES
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