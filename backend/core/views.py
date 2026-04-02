from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from django.contrib.auth.models import User
from django.db import transaction, IntegrityError
from django.http import HttpResponse
from django.template.loader import render_to_string, get_template
from .models import Plan, Suscripcion, Cliente
from .serializers import PlanSerializer
from django.contrib.auth.forms import PasswordResetForm
from xhtml2pdf import pisa
from django.conf import settings
import datetime
import io
import zipfile
import re
import math
from num2words import num2words
import pandas as pd
import traceback
import urllib.parse
from django.db.models import Max

from .models import Plan, Cliente, Empresa, Empleado, Contrato, DocumentoLegal, Liquidacion
from .serializers import EmpresaSerializer, EmpleadoSerializer, ContratoSerializer, DocumentoLegalSerializer, LiquidacionSerializer

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
    # 1. Manejo de nulos (incluyendo nulos de Pandas)
    if not fecha_valor or pd.isna(fecha_valor):
        return None
    
    # 2. Si Pandas ya lo parseó correctamente como objeto datetime/date
    if isinstance(fecha_valor, (datetime.datetime, datetime.date)):
        return fecha_valor.date() if isinstance(fecha_valor, datetime.datetime) else fecha_valor

    fecha_str = str(fecha_valor).strip()
    
    # 3. Si viene como número de serie de Excel
    try:
        serial = float(fecha_str)
        base = datetime.datetime(1899, 12, 30)
        return (base + datetime.timedelta(days=serial)).date()
    except ValueError:
        pass

    # 4. Formatos estrictos chilenos (Día, Mes, Año) + ISO estándar de BD
    formatos_chilenos = [
        '%d-%m-%Y', '%d/%m/%Y', '%d.%m.%Y',
        '%d-%m-%y', '%d/%m/%y', '%d.%m.%y',
        '%Y-%m-%d'
    ]
    
    for fmt in formatos_chilenos:
        try:
            dt = datetime.datetime.strptime(fecha_str, fmt).date()
            # Ajuste para años de 2 dígitos (ej: 92 -> 1992 en vez de 2092)
            if dt.year > datetime.date.today().year + 10:
                dt = dt.replace(year=dt.year - 100)
            return dt
        except ValueError:
            continue
            
    return None

class DocumentoLegalViewSet(viewsets.ModelViewSet):
    queryset = DocumentoLegal.objects.all().order_by('-fecha_emision', '-creado_en')
    serializer_class = DocumentoLegalSerializer
    permission_classes = [IsAuthenticated]

    # Filtro para buscar solo los documentos de un empleado específico
    def get_queryset(self):
        queryset = super().get_queryset()
        empleado_id = self.request.query_params.get('empleado', None)
        if empleado_id is not None:
            queryset = queryset.filter(empleado_id=empleado_id)
        return queryset

    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        try:
            documento = self.get_object()
            empleado = documento.empleado
            empresa = empleado.empresa

            meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            hoy = documento.fecha_emision
            fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"

            comuna_emp = getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or ''
            comuna_empl = getattr(empleado, 'comuna', '') or ''
            ciudad_segura = str(comuna_emp or comuna_empl or 'Santiago').strip().title()
            cliente = getattr(request.user, 'perfil_cliente', None)
            es_plan_semilla = cliente.plan.nombre.lower() == 'semilla' if (cliente and cliente.plan) else True

            context = {
                'documento': documento,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': fecha_espanol,
                'ciudad': ciudad_segura,
                'es_plan_semilla': es_plan_semilla
            }

            template = get_template('documento_legal.html')
            html = template.render(context)

            response = HttpResponse(content_type='application/pdf')
            nombre_archivo = f'{documento.tipo}_{empleado.rut}.pdf'
            response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'

            pisa_status = pisa.CreatePDF(html, dest=response)

            if pisa_status.err:
                return HttpResponse(f'Errores al generar PDF <pre>{html}</pre>', status=500)
            
            return response

        except Exception as e:
            return Response({'error': f'Error al generar PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class EmpresaViewSet(viewsets.ModelViewSet):
    serializer_class = EmpresaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.query_params.get('incluir_inactivas') == 'true':
            return Empresa.objects.filter(owner=self.request.user)
        return Empresa.objects.filter(owner=self.request.user, activo=True)
    
    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        try:
            # Buscamos directo en la base de datos (saltando el filtro de activas)
            empresa = Empresa.objects.get(pk=pk, owner=request.user)
            empresa.activo = True
            empresa.save()
            return Response({"mensaje": "Empresa reactivada correctamente"}, status=status.HTTP_200_OK)
        except Empresa.DoesNotExist:
            return Response({"error": "Empresa no encontrada"}, status=status.HTTP_404_NOT_FOUND)

    def perform_create(self, serializer):
        cliente = getattr(self.request.user, 'perfil_cliente', None)
        
        # 1. REGLA DE NEGOCIO: Límite de empresas según el Plan
        if cliente and cliente.plan:
            total_empresas = Empresa.objects.filter(owner=self.request.user).count()
            
            # Definir límite según el ID del plan (1: Semilla, 2: Pyme, 3: Corporativo)
            limite_empresas = cliente.plan.max_empresas
                        
            if total_empresas >= limite_empresas:
                raise ValidationError({'error': f'Tu {cliente.plan.nombre} permite administrar un máximo de {limite_empresas} empresas. Actualiza tu plan para registrar más.'})

        # 2. Convertir a mayúsculas
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        rut_raw = self.request.data.get('rut', '')
        
        # 3. REGLA DE NEGOCIO: No repetir RUT en el mismo panel
        if rut_raw:
            rut_form = formatear_rut(rut_raw)
            if Empresa.objects.filter(rut=rut_form).exists():
                raise ValidationError({'error': 'Ya existe una empresa registrada con este RUT en el sistema. Contacta a soporte si crees que esto es un error.'})
            datos_mayusculas['rut'] = rut_form
            
        serializer.save(owner=self.request.user, **datos_mayusculas)

    # SOFT-DELETE: En vez de eliminar la empresa, la marcamos como inactiva
    def destroy(self, request, *args, **kwargs):
        empresa = self.get_object()
        empresa.activo = False
        empresa.save()
        return Response({"mensaje": "Empresa desactivada correctamente"}, status=status.HTTP_200_OK)
            
    def perform_update(self, serializer):
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        rut_raw = self.request.data.get('rut', '')
        
        if rut_raw:
            rut_form = formatear_rut(rut_raw)
            if Empresa.objects.filter(owner=self.request.user, rut=rut_form).exclude(id=serializer.instance.id).exists():
                raise ValidationError({'error': 'Ya tienes otra empresa registrada con este RUT.'})
            datos_mayusculas['rut'] = rut_form
            
        serializer.save(**datos_mayusculas)

class EmpleadoViewSet(viewsets.ModelViewSet):
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Empleado.objects.filter(empresa__owner=self.request.user)

    def perform_create(self, serializer):
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        
        # Obtenemos la empresa a la que se está intentando agregar el trabajador
        empresa_destino = serializer.validated_data.get('empresa')
        
        rut_raw = self.request.data.get('rut', '')
        if rut_raw:
            if not validar_rut(rut_raw):
                raise ValidationError({'error': 'El RUT ingresado no es válido.'})
            rut_form = formatear_rut(rut_raw)
            
            # Solo verificamos si existe dentro de ESTA empresa específica
            if Empleado.objects.filter(empresa=empresa_destino, rut=rut_form).exists():
                raise ValidationError({'error': 'Este trabajador ya está registrado en esta empresa.'})
            
            datos_mayusculas['rut'] = rut_form
            
        serializer.save(**datos_mayusculas)

    def perform_update(self, serializer):
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        
        empresa_destino = serializer.validated_data.get('empresa', serializer.instance.empresa)
        
        rut_raw = self.request.data.get('rut', '')
        if rut_raw:
            if not validar_rut(rut_raw):
                raise ValidationError({'error': 'El RUT ingresado no es válido.'})
            rut_form = formatear_rut(rut_raw)
            
            if Empleado.objects.filter(empresa=empresa_destino, rut=rut_form).exclude(id=serializer.instance.id).exists():
                raise ValidationError({'error': 'Ya existe otro trabajador con este RUT en esta empresa.'})
            
            datos_mayusculas['rut'] = rut_form
            
        serializer.save(**datos_mayusculas)

    @action(detail=False, methods=['post'])
    def carga_masiva(self, request):
        try:
            # 1. Manejo seguro si el frontend manda un Array en lugar de un Objeto
            data = request.data[0] if isinstance(request.data, list) else request.data
            
            empresa_id = data.get('empresa')
            
            # 2. Rescatamos el archivo (si viene en FILES o dentro de data)
            archivo_excel = request.FILES.get('file') or data.get('file')
            # Validar extensión
            if not archivo_excel.name.endswith(('.xlsx', '.xls')):
                return Response({'error': 'Formato no permitido'}, status=400)

            # Validar tamaño (5MB máximo)
            if archivo_excel.size > 5 * 1024 * 1024:
                return Response({'error': 'Archivo demasiado pesado'}, status=400)

            if not archivo_excel or not empresa_id:
                return Response({'error': 'Falta el archivo o la empresa.'}, status=status.HTTP_400_BAD_REQUEST)
            
            empresa = Empresa.objects.get(id=empresa_id, owner=request.user)
            cliente = getattr(request.user, 'perfil_cliente', None)
            
            limite_trabajadores = float('inf')
            if cliente and cliente.plan:
                limite_trabajadores = cliente.plan.limite_trabajadores

            df = pd.read_excel(archivo_excel).fillna('')
            registros = df.to_dict('records')
            # 1. PRE-VALIDACIÓN Y ESTANDARIZACIÓN
            datos_a_procesar = []
            for index, row in enumerate(registros):
                rut_raw = str(row.get('RUT', '')).strip()
                if not rut_raw:
                    continue
                
                if not validar_rut(rut_raw):
                    return Response({
                        'error': f'El RUT {rut_raw} de {row.get("Nombres", "")} es inválido. Carga abortada completamente.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Guarda siempre formateado: XX.XXX.XXX-X
                rut_formateado = formatear_rut(rut_raw)
                datos_a_procesar.append({'rut': rut_formateado, 'row': row})

            empleados_creados = 0
            empleados_actualizados = 0
            ultimo_ingresado = None
            limite_alcanzado = False
            max_ficha_actual = Empleado.objects.filter(empresa=empresa).aggregate(Max('ficha_numero'))['ficha_numero__max']
            siguiente_ficha = (max_ficha_actual or 0) + 1

            with transaction.atomic():
                total_actual = Empleado.objects.filter(empresa=empresa).count()

                for item in datos_a_procesar:
                    rut = item['rut']
                    row = item['row']

                    # Función para asegurar Mayúsculas visuales
                    def clean_str(val, default=''):
                        return str(row.get(val, default)).strip().upper()

                    nombres = clean_str('Nombres')
                    ap_paterno = clean_str('Apellido_Paterno')
                    
                    try:
                        sueldo = int(float(row.get('Sueldo_Base', 0))) if row.get('Sueldo_Base') != '' else 0
                        horas = int(row.get('Horas_Laborales', 44)) if row.get('Horas_Laborales') != '' else 44
                        plan_uf = float(row.get('Plan_Isapre_UF', 0)) if row.get('Plan_Isapre_UF') != '' else 0
                    except ValueError:
                        sueldo, horas, plan_uf = 0, 44, 0

                    fecha_ing = estandarizar_fecha(row.get('Fecha_Ingreso')) or datetime.date.today()

                    nuevos_datos = {
                        'nombres': nombres,
                        'apellido_paterno': ap_paterno,
                        'apellido_materno': clean_str('Apellido_Materno'),
                        'sueldo_base': sueldo,
                        'horas_laborales': horas,
                        'afp': clean_str('AFP', 'MODELO'),
                        'sistema_salud': clean_str('Salud', 'FONASA'),
                        'plan_isapre_uf': plan_uf,
                        'centro_costo': clean_str('Centro_Costo', 'GENERAL'),
                        'sexo': clean_str('Sexo', 'M'),
                        'nacionalidad': clean_str('Nacionalidad', 'CHILENA'),
                        'estado_civil': clean_str('Estado_Civil', 'SOLTERO'),
                        'numero_telefono': clean_str('Numero_Telefono'),
                        'email': str(row.get('Email', '')).strip().lower(),
                        'comuna': clean_str('Comuna'),
                        'direccion': clean_str('Direccion'),
                        'cargo': clean_str('Cargo'),
                        'modalidad': clean_str('Modalidad', 'PRESENCIAL'),
                    }

                    empleado = Empleado.objects.filter(rut=rut, empresa=empresa).first()

                    if empleado:
                        # 3. ACTUALIZAR SI HAY DIFERENCIAS
                        hay_cambios = False
                        for key, value in nuevos_datos.items():
                            if getattr(empleado, key) != value:
                                setattr(empleado, key, value)
                                hay_cambios = True
                        if hay_cambios:
                            empleado.save()
                            empleados_actualizados += 1
                    else:
                        # 4. CREAR (SI NO SUPERA LÍMITE)
                        if total_actual >= limite_trabajadores:
                            limite_alcanzado = True
                            break
                        
                        Empleado.objects.create(
                            rut=rut, 
                            empresa=empresa, 
                            fecha_ingreso=fecha_ing,
                            ficha_numero=siguiente_ficha,
                            **nuevos_datos
                        )
                        siguiente_ficha += 1
                        empleados_creados += 1
                        total_actual += 1
                        ultimo_ingresado = f"{nombres} {ap_paterno}"

            # 5. RETORNO CONDICIONAL AL FRONTEND
            mensaje = f"Carga procesada. Nuevos: {empleados_creados}. Actualizados: {empleados_actualizados}."
            if limite_alcanzado:
                advertencia = f"Se alcanzó el límite de su plan ({limite_trabajadores} trabajadores). El último ingresado fue {ultimo_ingresado}. Actualice su plan para ingresar más."
                return Response({'mensaje': mensaje, 'advertencia': advertencia}, status=status.HTTP_200_OK)

            return Response({'mensaje': mensaje}, status=status.HTTP_200_OK)
        except Exception as e:
            # Captura la traza completa del error
            error_trace = traceback.format_exc()
            
            # Imprime en la consola del servidor (Railway/Terminal)
            print("=== ERROR EN CARGA MASIVA ===")
            print(error_trace)
            print("=============================")
            
            # Devuelve el detalle al frontend para que lo leamos de inmediato
            return Response({
                'error': f'Error procesando el archivo: {str(e)}',
                'detalle': error_trace
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    @action(detail=False, methods=['post'])
    def descargar_anexos_zip(self, request):

        cliente = getattr(request.user, 'perfil_cliente', None)
        if cliente and cliente.plan and cliente.plan.nombre.lower() == 'semilla':
            return Response(
                {'error': 'Tu plan Semilla no permite descargas masivas en ZIP. Mejora a PYME para desbloquear esta función.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
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
            cliente = getattr(request.user, 'perfil_cliente', None)
            es_plan_semilla = cliente.plan.nombre.lower() == 'semilla' if (cliente and cliente.plan) else True

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
                'ciudad': ciudad_segura,
                'es_plan_semilla': es_plan_semilla

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
            cliente = getattr(request.user, 'perfil_cliente', None)
            es_plan_semilla = cliente.plan.nombre.lower() == 'semilla' if (cliente and cliente.plan) else True

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
                'ciudad': ciudad_segura,
                'es_plan_semilla': es_plan_semilla
            }

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
    rut = request.data.get('rut')
    password = request.data.get('password')
    # Atrapamos el correo (por si tu React lo manda como 'email' o como 'correo')
    email = request.data.get('email') or request.data.get('correo')
    
    # Validaciones básicas
    if not rut or not password or not email:
        return Response({'error': 'Faltan datos obligatorios (RUT, contraseña o correo)'}, status=400)

    try:
        with transaction.atomic():
            # 1. Creamos el acceso en la tabla core_users (User de Django)
            user = User.objects.create_user(
                username=rut, 
                password=password,
                email=email
            )

            plan_semilla, creado = Plan.objects.get_or_create(
            nombre__iexact='Semilla',  # <--- MAGIA: Busca por nombre, no por ID
            defaults={
                'nombre': 'Semilla', 
                'max_empresas': 1, 
                'limite_trabajadores': 3,
                'precio': 0, # Opcional, si tienes este campo
                'activo': True
                }
            )
            
            # 2. Creamos el perfil en core_cliente 
            cliente = Cliente.objects.create(
                usuario=user,
                rut=rut,
                correo=email,
                plan=plan_semilla  # Asignamos el plan "Semilla" por defecto (usando el objeto obtenido o creado arriba
            )
            
           
        return Response({'mensaje': 'Cliente creado con éxito'}, status=201)
        
    except IntegrityError:
        return Response({'error': 'Este RUT ya está registrado en el sistema.'}, status=400)
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    
class LiquidacionViewSet(viewsets.ModelViewSet):
    queryset = Liquidacion.objects.all().order_by('-anio', '-mes')
    serializer_class = LiquidacionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        empleado_id = self.request.query_params.get('empleado', None)
        if empleado_id is not None:
            queryset = queryset.filter(empleado_id=empleado_id)
        return queryset

    def create(self, request, *args, **kwargs):
        data = request.data
        empleado_id = data.get('empleado')
        
        try:
            empleado = Empleado.objects.get(id=empleado_id)
            contrato = Contrato.objects.filter(empleado=empleado).first()
            
            if not contrato:
                return Response({'error': 'El trabajador no tiene un contrato activo.'}, status=status.HTTP_400_BAD_REQUEST)

            # 1. ASISTENCIA
            dias_trabajados = int(data.get('dias_trabajados', 30))
            dias_ausencia = int(data.get('dias_ausencia', 0))
            dias_licencia = int(data.get('dias_licencia', 0))
            dias_no_contratados = int(data.get('dias_no_contratados', 0))
            
            # Los días a pagar de sueldo base son 30 menos las ausencias y licencias
            dias_a_pagar = 30 - dias_ausencia - dias_licencia - dias_no_contratados
            if dias_a_pagar < 0: dias_a_pagar = 0

            # 2. ARREGLOS DINÁMICOS (JSON)
            detalle_imponibles = data.get('detalle_haberes_imponibles', [])
            detalle_no_imponibles = data.get('detalle_haberes_no_imponibles', [])
            detalle_horas_extras = data.get('detalle_horas_extras', [])
            detalle_otros_descuentos = data.get('detalle_otros_descuentos', [])

            # Sumas matemáticas de los arreglos
            suma_imponibles_extra = sum(int(item.get('valor', 0)) for item in detalle_imponibles)
            suma_horas_extras = sum(int(item.get('valor', 0)) for item in detalle_horas_extras)
            suma_no_imponibles = sum(int(item.get('valor', 0)) for item in detalle_no_imponibles)
            suma_otros_descuentos = sum(int(item.get('valor', 0)) for item in detalle_otros_descuentos)

            # 3. CÁLCULO DE HABERES
            sueldo_base_mensual = contrato.sueldo_base
            sueldo_base_proporcional = math.floor((sueldo_base_mensual / 30) * dias_a_pagar)
            
            # Gratificación
            tope_gratificacion = 200000 
            base_gratificacion = sueldo_base_proporcional + suma_imponibles_extra + suma_horas_extras
            gratificacion_calculada = math.floor(base_gratificacion * 0.25)
            gratificacion_final = min(gratificacion_calculada, tope_gratificacion) if contrato.gratificacion_legal == 'MENSUAL' else 0

            total_imponible = base_gratificacion + gratificacion_final
            total_haberes = total_imponible + suma_no_imponibles

            # 4. CÁLCULO DE DESCUENTOS LEGALES
            tasas_afp = {
                'MODELO': 0.1058, 'HABITAT': 0.1127, 'PROVIDA': 0.1145,
                'CAPITAL': 0.1144, 'CUPRUM': 0.1144, 'PLANVITAL': 0.1116, 'UNO': 0.1049
            }
            nombre_afp = (empleado.afp or 'MODELO').upper()
            tasa_afp = tasas_afp.get(nombre_afp, 0.11)
            afp_monto = math.floor(total_imponible * tasa_afp)

            # Salud (Isapre UF vs Fonasa 7%)
            salud_nombre = (empleado.sistema_salud or 'FONASA').upper()
            if salud_nombre == 'ISAPRE' and empleado.plan_isapre_uf > 0:
                # Simulación valor UF 
                VALOR_UF = 38000 
                salud_monto = math.floor(float(empleado.plan_isapre_uf) * VALOR_UF)
                isapre_uf = empleado.plan_isapre_uf
                # La ley exige descontar al menos el 7%, si el plan UF es menor, se cobra 7%
                minimo_legal = math.floor(total_imponible * 0.07)
                if salud_monto < minimo_legal:
                    salud_monto = minimo_legal
            else:
                salud_monto = math.floor(total_imponible * 0.07)
                isapre_uf = 0

            # Seguro Cesantía
            seguro_cesantia = math.floor(total_imponible * 0.006) if contrato.tipo_contrato == 'INDEFINIDO' else 0

            # Quincena y otros
            anticipo_quincena = contrato.monto_quincena if contrato.tiene_quincena else 0
            total_descuentos = afp_monto + salud_monto + seguro_cesantia + anticipo_quincena + suma_otros_descuentos

            # 5. SUELDO LÍQUIDO FINAL
            sueldo_liquido = total_haberes - total_descuentos

            # 6. GUARDAR EN BASE DE DATOS
            liquidacion = Liquidacion.objects.create(
                empleado=empleado, mes=data.get('mes'), anio=data.get('anio'),
                dias_trabajados=dias_trabajados, dias_licencia=dias_licencia,
                dias_ausencia=dias_ausencia, dias_no_contratados=dias_no_contratados,
                sueldo_base=sueldo_base_proporcional, gratificacion=gratificacion_final,
                detalle_haberes_imponibles=detalle_imponibles,
                detalle_horas_extras=detalle_horas_extras,
                detalle_haberes_no_imponibles=detalle_no_imponibles,
                detalle_otros_descuentos=detalle_otros_descuentos,
                afp_nombre=nombre_afp, afp_monto=afp_monto,
                salud_nombre=salud_nombre, isapre_cotizacion_uf=isapre_uf, salud_monto=salud_monto,
                seguro_cesantia=seguro_cesantia, anticipo_quincena=anticipo_quincena,
                total_imponible=total_imponible, total_haberes=total_haberes,
                total_descuentos=total_descuentos, sueldo_liquido=sueldo_liquido
            )

            serializer = self.get_serializer(liquidacion)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        try:
            liquidacion = self.get_object()
            cliente = getattr(request.user, 'perfil_cliente', None)
            es_plan_semilla = cliente.plan.nombre.lower() == 'semilla' if (cliente and cliente.plan) else True
            empleado = liquidacion.empleado
            empresa = empleado.empresa
            contrato = Contrato.objects.filter(empleado=empleado).first()

            meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            mes_nombre = meses[liquidacion.mes - 1]

            # Transformar número a palabras (Ej: 542000 -> "quinientos cuarenta y dos mil")
            sueldo_seguro = int(liquidacion.sueldo_liquido or 0)
            liquido_palabras = num2words(sueldo_seguro, lang='es')

            det_no_imp = liquidacion.detalle_haberes_no_imponibles
            if not isinstance(det_no_imp, list): det_no_imp = []
            suma_no_imponibles = sum(int(item.get('valor', 0)) for item in det_no_imp if isinstance(item, dict))

            det_otros_dsctos = liquidacion.detalle_otros_descuentos
            if not isinstance(det_otros_dsctos, list): det_otros_dsctos = []
            suma_otros_descuentos = sum(int(item.get('valor', 0)) for item in det_otros_dsctos if isinstance(item, dict))
            
            total_ley = (liquidacion.afp_monto or 0) + (liquidacion.salud_monto or 0) + (liquidacion.seguro_cesantia or 0) + (liquidacion.impuesto_unico or 0)
            total_otros_dsctos = (liquidacion.anticipo_quincena or 0) + suma_otros_descuentos

            context = {
                'liquidacion': liquidacion,
                'empleado': empleado,
                'empresa': empresa,
                'contrato': contrato,
                'mes_nombre': mes_nombre.upper(),
                'liquido_palabras': liquido_palabras,
                'total_no_imponible': suma_no_imponibles,
                'total_ley': total_ley,
                'total_otros_dsctos': total_otros_dsctos,
                'es_plan_semilla': es_plan_semilla
            }

            template = get_template('liquidacion.html')
            html = template.render(context)

            response = HttpResponse(content_type='application/pdf')
            nombre_archivo = f'Liquidacion_{liquidacion.mes}_{liquidacion.anio}_{empleado.rut}.pdf'
            response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'

            pisa_status = pisa.CreatePDF(html, dest=response)

            if pisa_status.err:
                print("Error interno de pisa (xhtml2pdf)")
                return Response({'error': 'Error al generar PDF'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            return response

        except Exception as e:
            import traceback
            print("=== ERROR GENERANDO PDF ===")
            print(traceback.format_exc())
            print("===========================")
            return Response({'error': f'Error generando PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Endpoint para listar los planes activos en la BD
class PlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Plan.objects.filter(activo=True)
    serializer_class = PlanSerializer
    permission_classes = [AllowAny] 

# Endpoint específico para el dashboard del cliente
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mi_suscripcion(request):
    cliente = getattr(request.user, 'perfil_cliente', None)
    if not cliente:
        return Response({'error': 'Perfil de cliente no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    # 1. Buscar o crear suscripción 
    try:
        suscripcion = cliente.suscripcion_activa
    except Suscripcion.DoesNotExist:
        plan_asignado = cliente.plan if cliente.plan else Plan.objects.first()
        suscripcion = Suscripcion.objects.create(
            cliente=cliente,
            plan=plan_asignado,
            estado='ACTIVE' if plan_asignado else 'TRIAL'
        )

    # 2. Calcular uso real (trabajadores en TODAS las empresas del usuario)
    trabajadores_actuales = Empleado.objects.filter(empresa__owner=request.user).count()

    # 3. Armar la respuesta exacta que espera Suscripcion.tsx
    data = {
        'estado': suscripcion.estado,
        'plan': {
            'id': suscripcion.plan.id,
            'nombre': suscripcion.plan.nombre,
            'precio': suscripcion.plan.precio,
            'limite_trabajadores': suscripcion.plan.limite_trabajadores,
            'descripcion': suscripcion.plan.descripcion,
        },
        'trabajadores_actuales': trabajadores_actuales,
        'fecha_proximo_cobro': suscripcion.fecha_proximo_cobro.strftime('%Y-%m-%d') if suscripcion.fecha_proximo_cobro else None,
        'metodo_pago_glosa': suscripcion.metodo_pago_glosa,
    }

    return Response(data, status=status.HTTP_200_OK)

# ==========================================
# PASARELA DE PAGOS (REVENIU)
# ==========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crear_checkout_reveniu(request):
    plan_id = str(request.data.get('plan_id'))
    ciclo = request.data.get('ciclo', 'mensual') # 'mensual' o 'anual'

    try:
        plan = Plan.objects.get(id=plan_id)
        cliente = getattr(request.user, 'perfil_cliente', None)

        # Mapeo de planes 
        links_reveniu = {
            '2_mensual': 'https://app.reveniu.com/checkout-custom-link/QSMYRGkfHJRKBMLEZv5GIjzp1bDi4SUk',
            '2_anual': 'https://app.reveniu.com/checkout-custom-link/Z5vFclG2XxwsAmK97pdqZtDlodg8Z8AI',
            '3_mensual': 'https://app.reveniu.com/checkout-custom-link/79QUEzlLLxyvHpMLDPRF7Hh5f8I6PMBU',
            '3_anual': 'https://app.reveniu.com/checkout-custom-link/qT6wMve3nlJ5HzpWZyHBcF2ym9K7BTZy',
        }

        llave = f"{plan.id}_{ciclo}"
        link_base = links_reveniu.get(llave)

        if not link_base:
            return Response({'error': 'Link de pago no configurado para este plan.'}, status=status.HTTP_400_BAD_REQUEST)

        nombre_completo = f"{request.user.first_name} {request.user.last_name}".strip()
        
        nombre_url = urllib.parse.quote(nombre_completo)

        url_pago = f"{link_base}?email={request.user.email}&name={nombre_url}&custom_reference={cliente.id}_{plan.id}"

        return Response({'url': url_pago}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def webhook_reveniu(request):
    data = request.data
    evento = data.get('event') 
    
    if evento in ['subscription_created', 'payment_succeeded']:
        custom_reference = data.get('custom_reference')
        
        if custom_reference and '_' in custom_reference:
            cliente_id, plan_id = custom_reference.split('_')
            
            suscripcion = Suscripcion.objects.get(cliente_id=cliente_id)
            plan_nuevo = Plan.objects.get(id=plan_id)
            
            suscripcion.plan = plan_nuevo
            suscripcion.estado = 'ACTIVE'
            suscripcion.gateway_subscription_id = str(data.get('subscription_id', ''))
            suscripcion.save()
            
    return Response(status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
def recuperar_password_por_rut(request):
    rut = request.data.get('rut')
    
    if not rut:
        return Response({'error': 'Debes ingresar un RUT'}, status=400)

    try:
        # 1. VALIDAMOS CONTRA TABLA CLIENTES
        cliente = Cliente.objects.get(rut=rut)
    except Cliente.DoesNotExist:
        # Mensaje ambiguo por seguridad anti-hackers
        return Response({'error': 'Si el RUT es válido, enviaremos un correo.'}, status=404)

    # 2. VERIFICAMOS SI EL CLIENTE TIENE CORREO
    if not cliente.correo:
        return Response({'error': 'Este cliente no tiene un correo configurado en el sistema.'}, status=400)

    try:
        # 3. BUSCAMOS AL USUARIO DE DJANGO ASOCIADO A ESE RUT
        user = User.objects.get(username=rut)
    except User.DoesNotExist:
        return Response({'error': 'Error interno: Cliente existe pero no tiene credenciales de acceso.'}, status=400)

    if user.email != cliente.correo:
        user.email = cliente.correo
        user.save()

    # 4. ENMASCARAR EL CORREO (con***@gmail.com)
    partes = cliente.correo.split('@')
    nombre_correo = partes[0]
    dominio = partes[1]
    
    if len(nombre_correo) > 3:
        correo_oculto = nombre_correo[:3] + '*' * (len(nombre_correo) - 3) + '@' + dominio
    else:
        correo_oculto = nombre_correo[0] + '*' * (len(nombre_correo) - 1) + '@' + dominio

    # 5. ENVIAR EL CORREO
    form = PasswordResetForm({'email': user.email})
    if form.is_valid():
        form.save(
            request=request,
            use_https=True,
            from_email=settings.DEFAULT_FROM_EMAIL,
            email_template_name='registration/password_reset_email.html',
            html_email_template_name='registration/password_reset_email.html',
        )

    # 6. RESPONDER A REACT
    return Response({
        'mensaje': 'Correo enviado exitosamente', 
        'correo_oculto': correo_oculto
    }, status=200)