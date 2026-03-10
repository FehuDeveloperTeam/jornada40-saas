from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from django.contrib.auth.models import User
from django.db import transaction
from django.http import HttpResponse
from django.template.loader import render_to_string, get_template
from xhtml2pdf import pisa
import datetime
import io
import zipfile
import re

from .models import Plan, Cliente, Empresa, Empleado, Contrato
from .serializers import EmpresaSerializer, EmpleadoSerializer, ContratoSerializer

# ==========================================
# UTILIDADES DE RUT (VALIDACIÓN Y FORMATO)
# ==========================================
def limpiar_rut(rut):
    return re.sub(r'[^0-9kK]', '', str(rut)).upper()

def formatear_rut(rut):
    rut_limpio = limpiar_rut(rut)
    if len(rut_limpio) < 2:
        return rut
    cuerpo = rut_limpio[:-1]
    dv = rut_limpio[-1]
    try:
        cuerpo_con_puntos = "{:,}".format(int(cuerpo)).replace(',', '.')
    except ValueError:
        return rut
    return f"{cuerpo_con_puntos}-{dv}"

def validar_rut(rut):
    rut_limpio = limpiar_rut(rut)
    if len(rut_limpio) < 2:
        return False
    cuerpo = rut_limpio[:-1]
    dv_ingresado = rut_limpio[-1]

    try:
        cuerpo_int = int(cuerpo)
    except ValueError:
        return False

    suma = 0
    multiplo = 2
    for d in reversed(cuerpo):
        suma += int(d) * multiplo
        multiplo += 1
        if multiplo == 8:
            multiplo = 2
    
    resto = suma % 11
    dv_esperado = 11 - resto
    
    if dv_esperado == 11:
        dv_calculado = '0'
    elif dv_esperado == 10:
        dv_calculado = 'K'
    else:
        dv_calculado = str(dv_esperado)
        
    return dv_ingresado == dv_calculado

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
        # Convertir todo a mayúsculas
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        rut_raw = self.request.data.get('rut', '')
        if rut_raw:
            datos_mayusculas['rut'] = formatear_rut(rut_raw)
        serializer.save(owner=self.request.user, **datos_mayusculas)
            
    def perform_update(self, serializer):
        # Convertir todo a mayúsculas
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        rut_raw = self.request.data.get('rut', '')
        if rut_raw:
            datos_mayusculas['rut'] = formatear_rut(rut_raw)
        serializer.save(**datos_mayusculas)


class EmpleadoViewSet(viewsets.ModelViewSet):
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Empleado.objects.filter(empresa__owner=self.request.user)

    def perform_create(self, serializer):
        # 1. Transformar todos los campos de texto a UPPERCASE
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        
        rut_raw = self.request.data.get('rut', '')
        if rut_raw:
            if not validar_rut(rut_raw):
                raise ValidationError({'error': 'El RUT ingresado no es válido.'})
            rut_form = formatear_rut(rut_raw)
            if Empleado.objects.filter(empresa__owner=self.request.user, rut=rut_form).exists():
                raise ValidationError({'error': 'Este trabajador ya está registrado en la empresa.'})
            
            datos_mayusculas['rut'] = rut_form
            
        serializer.save(**datos_mayusculas)

    def perform_update(self, serializer):
        # 1. Transformar todos los campos de texto a UPPERCASE
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        
        rut_raw = self.request.data.get('rut', '')
        if rut_raw:
            if not validar_rut(rut_raw):
                raise ValidationError({'error': 'El RUT ingresado no es válido.'})
            rut_form = formatear_rut(rut_raw)
            if Empleado.objects.filter(empresa__owner=self.request.user, rut=rut_form).exclude(id=serializer.instance.id).exists():
                raise ValidationError({'error': 'Ya existe otro trabajador con este RUT.'})
            
            datos_mayusculas['rut'] = rut_form
            
        serializer.save(**datos_mayusculas)

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
            
            datos_limpios = [item for item in datos_excel if item.get('rut') and item.get('nombres')]

            ruts_empresa_actual = set(Empleado.objects.filter(empresa=empresa).values_list('rut', flat=True))
            datos_validados = []
            
            for item in datos_limpios:
                rut_raw = str(item.get('rut', '')).strip()
                nombre = str(item.get('nombres', '')).strip().upper() # Validamos en mayúscula
                apellido = str(item.get('apellido_paterno', '')).strip().upper() # Validamos en mayúscula
                
                if not validar_rut(rut_raw):
                    return Response({
                        'error': f'El rut de {nombre} {apellido} está mal ingresado, favor revisar e inténtelo nuevamente.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                rut_formateado = formatear_rut(rut_raw)
                
                if rut_formateado in ruts_empresa_actual:
                    continue
                
                item['rut'] = rut_formateado
                datos_validados.append(item)
                ruts_empresa_actual.add(rut_formateado)

            if len(datos_validados) == 0:
                return Response({'advertencia': 'No se cargaron trabajadores nuevos (Todos ya existían en la base de datos).'}, status=status.HTTP_200_OK)

            trabajadores_actuales = Empleado.objects.filter(empresa=empresa).count()
            espacio_disponible = limite_plan - trabajadores_actuales
            
            if espacio_disponible <= 0:
                return Response({'error': 'Has alcanzado el límite máximo de tu plan.'}, status=status.HTTP_400_BAD_REQUEST)

            mensaje_advertencia = None
            if len(datos_validados) > espacio_disponible:
                datos_validados = datos_validados[:espacio_disponible]
                ultimo = datos_validados[-1]
                nombre_completo_ultimo = f"{ultimo.get('nombres', '')} {ultimo.get('apellido_paterno', '')}".strip().upper()
                mensaje_advertencia = f"¡ATENCIÓN! llegaste al total de trabajadores, se cargará hasta {nombre_completo_ultimo}"

            nuevos_empleados = []
            with transaction.atomic(): 
                for item in datos_validados:
                    fecha_nac = estandarizar_fecha(item.get('fecha_nacimiento'))
                    fecha_ing = estandarizar_fecha(item.get('fecha_ingreso')) or datetime.date.today()

                    try: horas = int(item.get('horas_laborales') or 40)
                    except: horas = 40
                        
                    try: sueldo = int(item.get('sueldo_base') or 0)
                    except: sueldo = 0

                    empleado = Empleado(
                        empresa=empresa,
                        rut=item.get('rut'),
                        # ==========================================
                        # TODO A MAYÚSCULAS ANTES DE GUARDAR
                        # ==========================================
                        nombres=str(item.get('nombres', '')).strip().upper(),
                        apellido_paterno=str(item.get('apellido_paterno', '')).strip().upper(),
                        apellido_materno=str(item.get('apellido_materno', '')).strip().upper(),
                        sexo=str(item.get('sexo', '')).strip().upper(),
                        nacionalidad=str(item.get('nacionalidad', '')).strip().upper(),
                        fecha_nacimiento=fecha_nac,
                        estado_civil=str(item.get('estado_civil', '')).strip().upper(),
                        numero_telefono=str(item.get('numero_telefono', '')).strip().upper(),
                        comuna=str(item.get('comuna', '')).strip().upper(),
                        direccion=str(item.get('direccion', '')).strip().upper(),
                        departamento=str(item.get('departamento', '')).strip().upper(),
                        cargo=str(item.get('cargo', 'NO ESPECIFICADO')).strip().upper(),
                        sucursal=str(item.get('sucursal', '')).strip().upper(),
                        fecha_ingreso=fecha_ing,
                        horas_laborales=horas,
                        modalidad=str(item.get('modalidad', 'PRESENCIAL')).strip().upper(),
                        sueldo_base=sueldo,
                        afp=str(item.get('afp', '')).strip().upper(),
                        sistema_salud=str(item.get('sistema_salud', '')).strip().upper(),
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
                    
                    contrato = Contrato.objects.filter(empleado=empleado).first()
                    if not contrato:
                        try: s_base = int(str(empleado.sueldo_base).strip()) if empleado.sueldo_base else 0
                        except: s_base = 0
                        
                        f_inicio = empleado.fecha_ingreso if isinstance(empleado.fecha_ingreso, datetime.date) else datetime.date.today()
                        c_cargo = str(empleado.cargo).strip().upper() if empleado.cargo else 'NO ESPECIFICADO'
                        
                        try:
                            contrato = Contrato.objects.create(
                                empleado=empleado,
                                tipo_contrato='INDEFINIDO',
                                fecha_inicio=f_inicio,
                                sueldo_base=s_base,
                                cargo=c_cargo
                            )
                        except Exception as e:
                            print(f"Aviso BD Contrato - Creando virtual para {empleado.rut}: {e}")
                            class ContratoVirtual:
                                pass
                            contrato = ContratoVirtual()
                            contrato.sueldo_base = s_base

                    meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
                    hoy = datetime.date.today()
                    fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
                    
                    comuna_emp = getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or ''
                    comuna_empl = getattr(empleado, 'comuna', '') or ''
                    ciudad_segura = str(comuna_emp or comuna_empl or 'Santiago').strip().title()

                    context = {
                        'contrato': contrato,
                        'empleado': empleado,
                        'empresa': empresa,
                        'fecha_actual': fecha_espanol,
                        'ciudad': ciudad_segura
                    }
                    
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
            ciudad_segura = str(comuna_emp or comuna_empl or 'Santiago').strip().title()

            context = {
                'contrato': contrato,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': fecha_espanol,
                'ciudad': ciudad_segura 
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

    @action(detail=True, methods=['get'])
    def generar_contrato_pdf(self, request, pk=None):
        try:
            contrato = self.get_object() 
            empleado = contrato.empleado
            empresa = empleado.empresa

            # Formatear la fecha actual a español (Ej: "10 de Marzo de 2026")
            meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            hoy = datetime.date.today()
            fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"

            comuna_emp = getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or ''
            comuna_empl = getattr(empleado, 'comuna', '') or ''
            ciudad_segura = str(comuna_emp or comuna_empl or 'Santiago').strip().title()

            context = {
                'contrato': contrato,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': fecha_espanol,
                'ciudad': ciudad_segura 
            }

            # AQUÍ LE DECIMOS QUE USE LA NUEVA PLANTILLA
            template = get_template('contrato_trabajo.html')
            html = template.render(context)

            response = HttpResponse(content_type='application/pdf')
            nombre_archivo = f'Contrato_{empleado.rut}.pdf'
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
    data = request.data.copy() if hasattr(request.data, 'copy') else request.data
    
    rut_raw = data.get('rut', '')
    if not validar_rut(rut_raw):
        return Response({'error': 'El RUT ingresado no es válido. Verifique el formato.'}, status=status.HTTP_400_BAD_REQUEST)
        
    rut_formateado = formatear_rut(rut_raw)
    data['rut'] = rut_formateado 
    
    if User.objects.filter(username=data.get('email')).exists():
        return Response({'error': 'Este correo ya está registrado.'}, status=status.HTTP_400_BAD_REQUEST)
    
    if Cliente.objects.filter(rut=rut_formateado).exists():
        return Response({'error': 'Este RUT ya está registrado.'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        with transaction.atomic():
            usuario = User.objects.create_user(
                username=rut_formateado, 
                email=data.get('email'),
                password=data.get('password')
            )
            
            plan_id = data.get('planId')
            plan_seleccionado = Plan.objects.filter(id=plan_id).first()
            
            Cliente.objects.create(
                usuario=usuario,
                plan=plan_seleccionado,
                tipo_cliente=str(data.get('tipoCliente', 'PERSONA')).upper(),
                rut=rut_formateado,
                nombres=str(data.get('nombres', '')).upper(),
                apellido_paterno=str(data.get('apellido_paterno', '')).upper(),
                apellido_materno=str(data.get('apellido_materno', '')).upper(),
                razon_social=str(data.get('razon_social', '')).upper(),
                direccion=str(data.get('direccion', '')).upper(),
                telefono=str(data.get('telefono', '')).upper()
            )
            
        return Response({'mensaje': '¡Cuenta creada con éxito!'}, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({'error': f'Error interno: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)