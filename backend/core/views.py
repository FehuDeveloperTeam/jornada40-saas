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
import math
from num2words import num2words
import pandas as pd

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

            context = {
                'documento': documento,
                'empleado': empleado,
                'empresa': empresa,
                'fecha_actual': fecha_espanol,
                'ciudad': ciudad_segura
            }

            template = get_template('documento_legal.html')
            html = template.render(context)

            response = HttpResponse(content_type='application/pdf')
            # Nombra el archivo según el tipo de documento (Ej: AMONESTACION_12345678-9.pdf)
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
        try:
            archivo_excel = request.FILES.get('file')
            empresa_id = request.data.get('empresa')

            if not archivo_excel or not empresa_id:
                return Response({'error': 'Falta el archivo o la empresa.'}, status=status.HTTP_400_BAD_REQUEST)

            # Leer el Excel usando pandas
            df = pd.read_excel(archivo_excel)
            
            # Limpiar datos vacíos
            df = df.fillna('')

            empleados_creados = 0
            empleados_actualizados = 0

            for index, row in df.iterrows():
                rut_limpio = str(row.get('RUT', '')).strip()
                if not rut_limpio:
                    continue

                # Parsear valores numéricos seguros
                try:
                    sueldo = float(row.get('Sueldo_Base', 0)) if row.get('Sueldo_Base') != '' else 0
                    horas = int(row.get('Horas_Laborales', 44)) if row.get('Horas_Laborales') != '' else 44
                    plan_uf = float(row.get('Plan_Isapre_UF', 0)) if row.get('Plan_Isapre_UF') != '' else 0
                except ValueError:
                    sueldo, horas, plan_uf = 0, 44, 0

                # Normalizar AFP y Salud
                afp_excel = str(row.get('AFP', 'MODELO')).strip().upper()
                salud_excel = str(row.get('Salud', 'FONASA')).strip().upper()

                # Actualizar o Crear Trabajador
                empleado, created = Empleado.objects.update_or_create(
                    rut=rut_limpio,
                    empresa_id=empresa_id,
                    defaults={
                        'nombres': str(row.get('Nombres', '')).strip(),
                        'apellido_paterno': str(row.get('Apellido_Paterno', '')).strip(),
                        'apellido_materno': str(row.get('Apellido_Materno', '')).strip(),
                        'email': str(row.get('Email', '')).strip(),
                        'sueldo_base': sueldo,
                        'horas_laborales': horas,
                        'afp': afp_excel,
                        'sistema_salud': salud_excel,
                        'plan_isapre_uf': plan_uf,
                        'centro_costo': str(row.get('Centro_Costo', 'General')).strip(),
                        'sexo': str(row.get('Sexo', 'M')).strip(),
                        'nacionalidad': str(row.get('Nacionalidad', 'CHILENA')).strip(),
                        'estado_civil': str(row.get('Estado_Civil', 'SOLTERO')).strip(),
                        'numero_telefono': str(row.get('Numero_Telefono', '')).strip(),
                        'comuna': str(row.get('Comuna', '')).strip(),
                        'direccion': str(row.get('Direccion', '')).strip(),
                        'cargo': str(row.get('Cargo', '')).strip(),
                        'modalidad': str(row.get('Modalidad', 'PRESENCIAL')).strip(),
                    }
                )

                if created:
                    empleados_creados += 1
                else:
                    empleados_actualizados += 1

            return Response({
                'mensaje': 'Carga exitosa',
                'creados': empleados_creados,
                'actualizados': empleados_actualizados
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f'Error procesando el archivo: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
                # Simulación valor UF (Idealmente esto vendría de una API externa del Banco Central)
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
            empleado = liquidacion.empleado
            empresa = empleado.empresa
            contrato = Contrato.objects.filter(empleado=empleado).first()

            meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            mes_nombre = meses[liquidacion.mes - 1]

            # Transformar número a palabras (Ej: 542000 -> "quinientos cuarenta y dos mil")
            sueldo_seguro = int(liquidacion.sueldo_liquido or 0)
            liquido_palabras = num2words(sueldo_seguro, lang='es')

            # ---------------------------------------------------------
            # SOLUCIÓN: Validar que los campos JSON sean realmente listas 
            # antes de intentar iterar sobre ellos. Protege liquidaciones antiguas.
            # ---------------------------------------------------------
            det_no_imp = liquidacion.detalle_haberes_no_imponibles
            if not isinstance(det_no_imp, list): det_no_imp = []
            suma_no_imponibles = sum(int(item.get('valor', 0)) for item in det_no_imp if isinstance(item, dict))

            det_otros_dsctos = liquidacion.detalle_otros_descuentos
            if not isinstance(det_otros_dsctos, list): det_otros_dsctos = []
            suma_otros_descuentos = sum(int(item.get('valor', 0)) for item in det_otros_dsctos if isinstance(item, dict))
            
            # También protegemos las sumas legales por si algún campo quedó en None
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
                'total_otros_dsctos': total_otros_dsctos
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
            # ESTO ES VITAL: Imprimimos el error real en la terminal de Railway
            import traceback
            print("=== ERROR GENERANDO PDF ===")
            print(traceback.format_exc())
            print("===========================")
            return Response({'error': f'Error generando PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
