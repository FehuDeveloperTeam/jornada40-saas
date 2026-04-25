from rest_framework.decorators import api_view, permission_classes, action, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'

class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'

class PasswordResetRateThrottle(AnonRateThrottle):
    scope = 'password_reset'
from django.contrib.auth.models import User
from django.db import transaction, IntegrityError
from django.http import HttpResponse
from django.template.loader import render_to_string, get_template
from .models import Plan, Suscripcion, Cliente
from .serializers import PlanSerializer
from django.contrib.auth.forms import PasswordResetForm
from xhtml2pdf import pisa
from django.conf import settings
from django.utils import timezone
import datetime
import io
import zipfile
import re
import math
import random
import string
from num2words import num2words
import pandas as pd
import traceback
import urllib.parse
from django.db.models import Max
from django.core.files.base import ContentFile

from .models import Plan, Cliente, Empresa, Empleado, Contrato, AnexoContrato, DocumentoLegal, Liquidacion, SolicitudFirma, OTPFirma
from .serializers import EmpresaSerializer, EmpleadoSerializer, ContratoSerializer, AnexoContratoSerializer, DocumentoLegalSerializer, LiquidacionSerializer, SolicitudFirmaSerializer
from . import b2_client
from django.core.mail import EmailMultiAlternatives
import uuid as uuid_mod

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


def _es_plan_semilla(user) -> bool:
    """True si el usuario no tiene plan activo o su plan es Semilla (gratuito)."""
    cliente = getattr(user, 'perfil_cliente', None)
    if not cliente:
        return True
    plan = cliente.plan
    if not plan:
        try:
            suscripcion = cliente.suscripcion_activa
            if suscripcion.estado in ('ACTIVE', 'TRIAL', 'PAST_DUE'):
                plan = suscripcion.plan
        except Exception:
            pass
    if not plan:
        return True
    return plan.nombre.lower() == 'semilla'


def _html_a_pdf_bytes(html_string: str, nombre_doc: str) -> bytes:
    """Convierte HTML a bytes PDF con xhtml2pdf. Lanza excepción si falla."""
    resultado = io.BytesIO()
    status = pisa.pisaDocument(io.BytesIO(html_string.encode("UTF-8")), resultado)
    if status.err:
        raise Exception(f"Error generando PDF '{nombre_doc}'.")
    pdf_bytes = resultado.getvalue()
    if not pdf_bytes:
        raise Exception(f"PDF '{nombre_doc}' resultó vacío.")
    return pdf_bytes


class DocumentoLegalViewSet(viewsets.ModelViewSet):
    queryset = DocumentoLegal.objects.all().order_by('-fecha_emision', '-creado_en')
    serializer_class = DocumentoLegalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Solo documentos de empleados que pertenecen al usuario autenticado
        queryset = DocumentoLegal.objects.filter(
            empleado__empresa__owner=self.request.user
        ).order_by('-fecha_emision', '-creado_en')
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
            es_plan_semilla = _es_plan_semilla(request.user)

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
                return HttpResponse('Error al generar el PDF.', status=500)
            
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
            empresa = Empresa.objects.get(pk=pk, owner=request.user)
            empresa.activo = True
            empresa.save()
            return Response({"mensaje": "Empresa reactivada correctamente"}, status=status.HTTP_200_OK)
        except Empresa.DoesNotExist:
            return Response({"error": "Empresa no encontrada"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['patch'], url_path='configurar-firma')
    def configurar_firma(self, request, pk=None):
        """Guarda la firma dibujada del representante legal de la empresa."""
        empresa = self.get_object()

        firma_imagen = request.data.get('firma_imagen', '').strip()
        nombre       = request.data.get('firma_firmante_nombre', '').strip()
        cargo        = request.data.get('firma_firmante_cargo', '').strip()

        if not firma_imagen:
            return Response({'error': 'La imagen de firma es requerida.'}, status=status.HTTP_400_BAD_REQUEST)
        if not firma_imagen.startswith('data:image/'):
            return Response({'error': 'Formato de imagen inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        empresa.firma_imagen          = firma_imagen
        empresa.firma_firmante_nombre = nombre
        empresa.firma_firmante_cargo  = cargo
        empresa.firma_configurada_en  = timezone.now()
        empresa.save(update_fields=['firma_imagen', 'firma_firmante_nombre',
                                    'firma_firmante_cargo', 'firma_configurada_en'])

        serializer = self.get_serializer(empresa)
        return Response(serializer.data)

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
            data = request.data[0] if isinstance(request.data, list) else request.data
            empresa_id = data.get('empresa')
            archivo_excel = request.FILES.get('file') or data.get('file')
            
            if not archivo_excel or not empresa_id:
                return Response({'error': 'Falta el archivo o la empresa.'}, status=400)

            MAX_EXCEL_MB = 5
            if hasattr(archivo_excel, 'size') and archivo_excel.size > MAX_EXCEL_MB * 1024 * 1024:
                return Response({'error': f'El archivo no puede superar {MAX_EXCEL_MB} MB.'}, status=400)

            empresa = Empresa.objects.get(id=empresa_id, owner=request.user)
            cliente = getattr(request.user, 'perfil_cliente', None)
            limite_trabajadores = cliente.plan.limite_trabajadores if (cliente and cliente.plan) else 1000

            # Leemos el Excel
            df = pd.read_excel(archivo_excel).fillna('')
            registros = df.to_dict('records')

            MAX_FILAS = 500
            if len(registros) > MAX_FILAS:
                return Response({'error': f'El archivo no puede tener más de {MAX_FILAS} filas por importación.'}, status=400)
            
            empleados_creados = 0
            empleados_actualizados = 0
            limite_alcanzado = False
            errores = []
            
            # Preparamos el mapa de empleados actuales para evitar duplicados
            empleados_bd = Empleado.objects.filter(empresa=empresa)
            mapa_empleados = { limpiar_rut(emp.rut): emp for emp in empleados_bd }
            
            siguiente_ficha = (empleados_bd.aggregate(Max('ficha_numero'))['ficha_numero__max'] or 0) + 1

            with transaction.atomic():
                total_actual = empleados_bd.count()

                for fila_num, row in enumerate(registros, start=2):  # start=2 porque fila 1 es el header del Excel
                    # --- NORMALIZADOR DE COLUMNAS ---
                    # Creamos un nuevo diccionario con todas las llaves en minúsculas y sin espacios
                    # Así row.get('email') funcionará aunque el Excel diga "Email", " EMAIL" o "email"
                    row_norm = { str(k).strip().lower().replace(' ', '_'): v for k, v in row.items() }
                    
                    rut_raw = str(row_norm.get('rut', '')).strip()
                    if not rut_raw: continue
                    
                    if not validar_rut(rut_raw):
                        continue # Saltamos RUTs inválidos

                    rut_limpio = limpiar_rut(rut_raw)
                    rut_formateado = formatear_rut(rut_raw)

                    # Extraer datos usando las llaves normalizadas
                    nombres = str(row_norm.get('nombres', '')).strip().upper()
                    ap_paterno = str(row_norm.get('apellido_paterno', '')).strip().upper()
                    email_dato = str(row_norm.get('email', '')).strip().lower() # <--- AQUÍ SE CORRIGE EL EMAIL

                    # Lógica de tipos de datos
                    try:
                        sueldo = int(float(row_norm.get('sueldo_base', 0)))
                        if sueldo < 0:
                            errores.append(f"Fila {fila_num}: sueldo_base no puede ser negativo.")
                            continue
                        horas_raw = row_norm.get('horas_laborales', 44)
                        horas = int(horas_raw)
                        if horas <= 0 or horas > 168:
                            errores.append(f"Fila {fila_num}: horas_laborales debe estar entre 1 y 168.")
                            continue
                    except (ValueError, TypeError):
                        errores.append(f"Fila {fila_num}: sueldo_base u horas_laborales contienen valores no numéricos.")
                        continue

                    raw_cuenta = row_norm.get('numero_cuenta', '')
                    try:
                        # Si es numérico (ej. 12345.0), lo pasamos a float, luego a entero (quita el .0) y luego a texto
                        num_cuenta = str(int(float(raw_cuenta)))
                    except (ValueError, TypeError):
                        # Si tiene letras o guiones (ej. "Chequera-123") o está vacío, lo dejamos como texto normal
                        num_cuenta = str(raw_cuenta).strip()

                    # AQUÍ SE ASIGNAN TODOS LOS CAMPOS QUE ESTABAN EN NULL
                    nuevos_datos = {
                        'nombres': nombres,
                        'apellido_paterno': ap_paterno,
                        'apellido_materno': str(row_norm.get('apellido_materno', '')).strip().upper(),
                        'email': email_dato,
                        'sexo': str(row_norm.get('sexo', 'M')).strip().upper()[:1],
                        'nacionalidad': str(row_norm.get('nacionalidad', 'CHILENA')).strip().upper(),
                        'fecha_nacimiento': estandarizar_fecha(row_norm.get('fecha_nacimiento')),
                        'fecha_ingreso': estandarizar_fecha(row_norm.get('fecha_ingreso')) or datetime.date.today(),
                        'departamento': str(row_norm.get('departamento', '')).strip().upper(),
                        'sucursal': str(row_norm.get('sucursal', '')).strip().upper(),
                        'cargo': str(row_norm.get('cargo', '')).strip().upper(),
                        'sueldo_base': sueldo,
                        'horas_laborales': horas,
                        'forma_pago': str(row_norm.get('forma_pago', 'TRANSFERENCIA')).strip().upper(),
                        'banco': str(row_norm.get('banco', '')).strip().upper(),
                        'tipo_cuenta': str(row_norm.get('tipo_cuenta', '')).strip().upper(),
                        'numero_cuenta': num_cuenta
                    }

                    empleado_existente = mapa_empleados.get(rut_limpio)

                    if empleado_existente:
                        # ACTUALIZAR
                        for key, value in nuevos_datos.items():
                            setattr(empleado_existente, key, value)
                        empleado_existente.save()
                        empleados_actualizados += 1
                    else:
                        # CREAR (Validando límite de plan)
                        if total_actual >= limite_trabajadores:
                            limite_alcanzado = True
                            continue
                        
                        Empleado.objects.create(
                            rut=rut_formateado,
                            empresa=empresa,
                            ficha_numero=siguiente_ficha,
                            **nuevos_datos
                        )
                        siguiente_ficha += 1
                        empleados_creados += 1
                        total_actual += 1

            return Response({
                'agregados': empleados_creados,
                'actualizados': empleados_actualizados,
                'limite_alcanzado': limite_alcanzado,
                'errores': errores,
            }, status=200)

        except Exception:
            return Response({'error': 'Error procesando el archivo. Revisa el formato e inténtalo de nuevo.'}, status=500)
                
   # ====================================================
    # DISPONIBILIDAD DE DOCUMENTOS POR TRABAJADOR
    # ====================================================
    @action(detail=True, methods=['get'])
    def documentos_disponibles(self, request, pk=None):
        empleado = self.get_object()
        contrato = Contrato.objects.filter(empleado=empleado).first()

        data = {
            'tiene_contrato': contrato is not None,
            'tiene_anexo_40h': bool(contrato and contrato.archivo_anexo_40h),
            'cantidad_liquidaciones': Liquidacion.objects.filter(empleado=empleado).count(),
            'cantidad_amonestaciones': DocumentoLegal.objects.filter(empleado=empleado, tipo='AMONESTACION').count(),
            'tiene_despido': DocumentoLegal.objects.filter(empleado=empleado, tipo='DESPIDO').exists(),
            'tiene_mutuo_acuerdo': DocumentoLegal.objects.filter(empleado=empleado, tipo='MUTUO_ACUERDO').exists(),
            'cantidad_constancias': DocumentoLegal.objects.filter(empleado=empleado, tipo='CONSTANCIA').count(),
            'cantidad_anexos_contrato': AnexoContrato.objects.filter(contrato=contrato).count() if contrato else 0,
        }
        return Response(data)

   # ====================================================
    # MOTOR DOCUMENTAL PERSISTENTE (CON PLANTILLAS REALES)
    # ====================================================

    def _html_a_pdf(self, html_string, nombre_doc):
        """Convierte HTML a bytes PDF con xhtml2pdf. Lanza excepción clara si falla."""
        resultado = io.BytesIO()
        status = pisa.pisaDocument(io.BytesIO(html_string.encode("UTF-8")), resultado)
        if status.err:
            raise Exception(
                f"xhtml2pdf reportó {status.err} error(s) generando '{nombre_doc}'. "
                f"Revisar el template y el contexto pasado."
            )
        pdf_bytes = resultado.getvalue()
        if not pdf_bytes:
            raise Exception(
                f"PDF '{nombre_doc}' resultó vacío tras la conversión. "
                f"xhtml2pdf no reportó error pero el resultado es b\"\". "
                f"Posible problema de encoding o template vacío."
            )
        return pdf_bytes

    def _obtener_o_generar_documento(self, empleado, tipo_documento, user=None):
        """Revisa si el PDF ya existe en la BD. Si no, lo genera usando los templates HTML reales."""

        empresa = empleado.empresa
        es_plan_semilla = _es_plan_semilla(user) if user else False

        # --- LÓGICA PARA CONTRATOS ---
        if tipo_documento == 'contrato':
            try:
                contrato = Contrato.objects.get(empleado=empleado)
            except Contrato.DoesNotExist:
                raise Exception(f"El trabajador {empleado.nombres} no tiene contrato registrado.")
            if contrato.archivo_contrato:
                try:
                    return contrato.archivo_contrato.read()
                except Exception:
                    pass

            context = {'empleado': empleado, 'empresa': empresa, 'contrato': contrato, 'es_plan_semilla': es_plan_semilla}
            html_string = render_to_string('contrato_trabajo.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Contrato_{empleado.rut}')
            contrato.archivo_contrato.save(f"Contrato_{empleado.rut}.pdf", ContentFile(pdf_bytes))
            return pdf_bytes

        # --- LÓGICA PARA ANEXOS 40 HORAS ---
        elif tipo_documento == 'anexo_40h':
            try:
                contrato = Contrato.objects.get(empleado=empleado)
            except Contrato.DoesNotExist:
                raise Exception(f"El trabajador {empleado.nombres} no tiene contrato registrado.")
            if contrato.archivo_anexo_40h:
                try:
                    return contrato.archivo_anexo_40h.read()
                except Exception:
                    pass

            context = {'empleado': empleado, 'empresa': empresa, 'contrato': contrato, 'es_plan_semilla': es_plan_semilla}
            html_string = render_to_string('anexo_40h.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Anexo_40h_{empleado.rut}')
            contrato.archivo_anexo_40h.save(f"Anexo_40h_{empleado.rut}.pdf", ContentFile(pdf_bytes))
            return pdf_bytes

        # --- LÓGICA PARA LIQUIDACIONES (MES ACTUAL) ---
        elif tipo_documento == 'liquidacion_actual':
            hoy = datetime.date.today()
            try:
                liquidacion = Liquidacion.objects.get(empleado=empleado, mes=hoy.month, anio=hoy.year)
            except Liquidacion.DoesNotExist:
                raise Exception(f"No existe liquidación del mes actual para {empleado.nombres}.")
            if liquidacion.archivo_pdf:
                try:
                    return liquidacion.archivo_pdf.read()
                except Exception:
                    pass

            try:
                liquido_palabras = num2words(liquidacion.sueldo_liquido, lang='es')
            except Exception:
                liquido_palabras = str(liquidacion.sueldo_liquido)

            context = {
                'empleado': empleado, 'empresa': empresa,
                'liquidacion': liquidacion, 'liquido_palabras': liquido_palabras,
                'es_plan_semilla': es_plan_semilla,
            }
            html_string = render_to_string('liquidacion.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Liquidacion_{hoy.month}_{hoy.year}_{empleado.rut}')
            liquidacion.archivo_pdf.save(
                f"Liquidacion_{hoy.month}_{hoy.year}_{empleado.rut}.pdf", ContentFile(pdf_bytes)
            )
            return pdf_bytes

        # --- LÓGICA PARA LIQUIDACIONES HISTÓRICAS ---
        elif tipo_documento.startswith('liquidacion_historica_'):
            _, _, mes_str, anio_str = tipo_documento.split('_')
            mes_hist, anio_hist = int(mes_str), int(anio_str)

            try:
                liquidacion = Liquidacion.objects.get(empleado=empleado, mes=mes_hist, anio=anio_hist)
            except Liquidacion.DoesNotExist:
                raise Exception(f"No existe liquidación {mes_hist}/{anio_hist} para {empleado.nombres}.")
            if liquidacion.archivo_pdf:
                try:
                    return liquidacion.archivo_pdf.read()
                except Exception:
                    pass

            try:
                liquido_palabras = num2words(liquidacion.sueldo_liquido, lang='es')
            except Exception:
                liquido_palabras = str(liquidacion.sueldo_liquido)

            context = {
                'empleado': empleado, 'empresa': empresa,
                'liquidacion': liquidacion, 'liquido_palabras': liquido_palabras,
                'es_plan_semilla': es_plan_semilla,
            }
            html_string = render_to_string('liquidacion.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Liquidacion_{mes_hist}_{anio_hist}_{empleado.rut}')
            liquidacion.archivo_pdf.save(
                f"Liquidacion_{mes_hist}_{anio_hist}_{empleado.rut}.pdf", ContentFile(pdf_bytes)
            )
            return pdf_bytes

        # --- LÓGICA PARA CARTAS DE AMONESTACIÓN ---
        elif tipo_documento == 'amonestacion':
            doc_legal = DocumentoLegal.objects.filter(
                empleado=empleado, tipo='AMONESTACION'
            ).order_by('-fecha_emision').first()
            if doc_legal is None:
                raise Exception(f"El trabajador {empleado.nombres} no tiene amonestaciones registradas.")
            if doc_legal.archivo_pdf:
                try:
                    return doc_legal.archivo_pdf.read()
                except Exception:
                    pass

            context = {'empleado': empleado, 'empresa': empresa, 'documento': doc_legal, 'es_plan_semilla': es_plan_semilla}
            html_string = render_to_string('documento_legal.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Amonestacion_{empleado.rut}')
            doc_legal.archivo_pdf.save(f"Amonestacion_{empleado.rut}.pdf", ContentFile(pdf_bytes))
            return pdf_bytes

        raise Exception(f"Tipo de documento no soportado: '{tipo_documento}'")
    
    # ====================================================
    # HELPERS PDF PARA DOCUMENTOS LEGALES Y ANEXOS
    # ====================================================
    def _pdf_para_documento_legal(self, doc, es_plan_semilla):
        empleado = doc.empleado
        empresa = empleado.empresa
        meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
        hoy = doc.fecha_emision
        fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
        ciudad = str(getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()
        context = {
            'documento': doc, 'empleado': empleado, 'empresa': empresa,
            'fecha_actual': fecha_espanol, 'ciudad': ciudad,
            'es_plan_semilla': es_plan_semilla,
        }
        html = render_to_string('documento_legal.html', context)
        return self._html_a_pdf(html, f'{doc.tipo}_{empleado.rut}_{doc.fecha_emision}')

    def _pdf_para_anexo_contrato(self, anexo, es_plan_semilla):
        contrato = anexo.contrato
        empleado = contrato.empleado
        empresa = empleado.empresa
        meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
        hoy = anexo.fecha_emision
        fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
        ciudad = str(getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()
        context = {
            'anexo': anexo, 'contrato': contrato, 'empleado': empleado, 'empresa': empresa,
            'fecha_actual': fecha_espanol, 'ciudad': ciudad,
            'es_plan_semilla': es_plan_semilla,
        }
        html = render_to_string('anexo_contrato.html', context)
        return self._html_a_pdf(html, f'AnexoContrato_{empleado.rut}_{hoy}')

    # ====================================================
    # ENDPOINT: DESCARGA MASIVA Y EXPEDIENTES (ZIP)
    # ====================================================
    @action(detail=False, methods=['post'])
    def descarga_masiva(self, request):
        """
        POST body:
          empleados: [id, ...]
          empresa_id: int
          documentos: lista de tipos a incluir:
            'contrato', 'anexo_40h', 'liquidaciones',
            'amonestaciones', 'despidos', 'mutuo_acuerdo',
            'constancias', 'anexos_contrato'
          cantidad_liquidaciones: int (cuántas liquidaciones recientes incluir)
        """
        try:
            empleados_ids = request.data.get('empleados', [])
            empresa_id = request.data.get('empresa_id')
            documentos = request.data.get('documentos', [])
            cantidad_liquidaciones = int(request.data.get('cantidad_liquidaciones', 1))

            if not empleados_ids or not empresa_id:
                return Response({'error': 'Faltan IDs de trabajadores o empresa'}, status=400)
            if not documentos:
                return Response({'error': 'Debes seleccionar al menos un tipo de documento'}, status=400)

            MAX_EMPLEADOS_ZIP = 50
            if len(empleados_ids) > MAX_EMPLEADOS_ZIP:
                return Response({'error': f'Máximo {MAX_EMPLEADOS_ZIP} trabajadores por descarga. Divide la selección en grupos.'}, status=400)

            MAX_LIQUIDACIONES_ZIP = 12
            cantidad_liquidaciones = min(cantidad_liquidaciones, MAX_LIQUIDACIONES_ZIP)

            if _es_plan_semilla(request.user):
                return Response({'error': 'Tu plan Semilla no permite descargas masivas en ZIP. Actualiza a PYME para desbloquear esta función.'}, status=403)

            empresa = Empresa.objects.get(id=empresa_id, owner=request.user)
            empleados = Empleado.objects.filter(id__in=empleados_ids, empresa=empresa)
            if not empleados.exists():
                return Response({'error': 'No se encontraron trabajadores válidos'}, status=404)

            es_semilla = False  # ya verificado arriba
            meses_corto = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
            zip_buffer = io.BytesIO()

            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for emp in empleados:
                    rut_limpio = emp.rut.replace("-", "").replace(".", "")
                    carpeta = f"{rut_limpio}_{emp.nombres}_{emp.apellido_paterno}".replace(" ", "_")

                    if 'contrato' in documentos:
                        try:
                            pdf = self._obtener_o_generar_documento(emp, 'contrato', request.user)
                            zip_file.writestr(f"{carpeta}/Contrato.pdf", pdf)
                        except Exception:
                            pass

                    if 'anexo_40h' in documentos:
                        try:
                            pdf = self._obtener_o_generar_documento(emp, 'anexo_40h', request.user)
                            zip_file.writestr(f"{carpeta}/Anexo_Ley_40h.pdf", pdf)
                        except Exception:
                            pass

                    if 'liquidaciones' in documentos and cantidad_liquidaciones > 0:
                        liq_qs = Liquidacion.objects.filter(empleado=emp).order_by('-anio', '-mes')[:cantidad_liquidaciones]
                        for liq in liq_qs:
                            try:
                                pdf = self._obtener_o_generar_documento(emp, f'liquidacion_historica_{liq.mes}_{liq.anio}', request.user)
                                zip_file.writestr(f"{carpeta}/Liquidaciones/Liq_{meses_corto[liq.mes - 1]}_{liq.anio}.pdf", pdf)
                            except Exception:
                                pass

                    if 'amonestaciones' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='AMONESTACION').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Amonestaciones/Amonestacion_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'despidos' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='DESPIDO').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Terminos_Contrato/Termino_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'mutuo_acuerdo' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='MUTUO_ACUERDO').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Renuncias/Renuncia_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'constancias' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='CONSTANCIA').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Constancias/Constancia_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'anexos_contrato' in documentos:
                        contrato_emp = Contrato.objects.filter(empleado=emp).first()
                        if contrato_emp:
                            for anexo in AnexoContrato.objects.filter(contrato=contrato_emp).order_by('fecha_emision'):
                                try:
                                    pdf = self._pdf_para_anexo_contrato(anexo, es_semilla)
                                    titulo_corto = anexo.titulo[:30].replace(" ", "_")
                                    zip_file.writestr(f"{carpeta}/Anexos_Contrato/Anexo_{anexo.fecha_emision}_{titulo_corto}.pdf", pdf)
                                except Exception:
                                    pass

            zip_buffer.seek(0)
            nombre_zip = f"Expedientes_{empresa.nombre_legal.replace(' ', '_')}_{datetime.date.today()}.zip"
            response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="{nombre_zip}"'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response

        except Exception:
            import traceback
            print(traceback.format_exc())
            return Response({'error': 'Error al generar el ZIP. Inténtalo de nuevo.'}, status=500)
        

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

        MAX_EMPLEADOS_ZIP = 50
        if len(empleado_ids) > MAX_EMPLEADOS_ZIP:
            return Response({'error': f'Máximo {MAX_EMPLEADOS_ZIP} trabajadores por descarga. Divide la selección en grupos.'}, status=status.HTTP_400_BAD_REQUEST)
        
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

    def _build_contrato_context(self, contrato, es_plan_semilla):
        empleado = contrato.empleado
        empresa = empleado.empresa
        meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
        hoy = datetime.date.today()
        fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
        comuna_emp = getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or ''
        ciudad_segura = str(comuna_emp or getattr(empleado, 'comuna', '') or 'Santiago').strip().title()

        def fmt_fecha(fecha):
            if not fecha:
                return None
            return f"{fecha.day:02d} de {meses[fecha.month - 1]} de {fecha.year}"

        def fmt_pesos(valor):
            if not valor:
                return "$0"
            return f"${valor:,}".replace(",", ".")

        _dias_nombres = {
            'lunes': 'Lunes', 'martes': 'Martes', 'miercoles': 'Miércoles',
            'jueves': 'Jueves', 'viernes': 'Viernes', 'sabado': 'Sábado', 'domingo': 'Domingo',
        }
        horario_formateado = []
        if contrato.distribucion_horario:
            for dia_key, datos in contrato.distribucion_horario.items():
                if datos.get('activo'):
                    horario_formateado.append({
                        'dia_nombre': _dias_nombres.get(dia_key, dia_key.title()),
                        'entrada': datos.get('entrada', ''),
                        'salida': datos.get('salida', ''),
                        'colacion': datos.get('colacion', 0),
                    })

        return {
            'contrato': contrato, 'empleado': empleado, 'empresa': empresa,
            'fecha_actual': fecha_espanol, 'ciudad': ciudad_segura,
            'es_plan_semilla': es_plan_semilla,
            'tipo_contrato_texto': contrato.get_tipo_contrato_display(),
            'fecha_inicio_texto': fmt_fecha(contrato.fecha_inicio),
            'fecha_fin_texto': fmt_fecha(contrato.fecha_fin),
            'fecha_nacimiento_texto': fmt_fecha(empleado.fecha_nacimiento),
            'sueldo_base_texto': fmt_pesos(contrato.sueldo_base),
            'monto_quincena_texto': fmt_pesos(contrato.monto_quincena),
            'horario_formateado': horario_formateado,
        }

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
            if not contrato.archivo_contrato:
                return Response({'error': 'El contrato aún no tiene PDF generado.'}, status=status.HTTP_404_NOT_FOUND)
            nombre = f"Contrato_{contrato.empleado.rut}.pdf"
            response = HttpResponse(contrato.archivo_contrato.read(), content_type='application/pdf')
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
            if not contrato.archivo_anexo_40h:
                return Response({'error': 'El anexo 40h aún no tiene PDF generado.'}, status=status.HTTP_404_NOT_FOUND)
            nombre = f"Anexo_40h_{contrato.empleado.rut}.pdf"
            response = HttpResponse(contrato.archivo_anexo_40h.read(), content_type='application/pdf')
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
# ==========================================
# LOGIN CON RATE LIMITING
# ==========================================
from dj_rest_auth.views import LoginView as DjRestLoginView

class ThrottledLoginView(DjRestLoginView):
    throttle_classes = [LoginRateThrottle]

from dj_rest_auth.views import PasswordResetView as DjRestPasswordResetView

class ThrottledPasswordResetView(DjRestPasswordResetView):
    throttle_classes = [PasswordResetRateThrottle]

# ==========================================
# REGISTRO DE NUEVOS CLIENTES
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterRateThrottle])
def registrar_cliente(request):
    rut = request.data.get('rut')
    password = request.data.get('password')
    # Atrapamos el correo (por si tu React lo manda como 'email' o como 'correo')
    email = request.data.get('email') or request.data.get('correo')
    first_name=request.data.get('nombres', ''),
    last_name=request.data.get('apellidos', '')
    
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
                nombre='Semilla',
                defaults={
                    'nombre': 'Semilla',
                    'max_empresas': 1,
                    'limite_trabajadores': 3,
                    'precio': 0,
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
            contrato = Contrato.objects.get(id=contrato_id, empleado__empresa__owner=request.user)
        except Contrato.DoesNotExist:
            return Response({'error': 'Contrato no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        anexo = serializer.save()
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


class LiquidacionViewSet(viewsets.ModelViewSet):
    queryset = Liquidacion.objects.all().order_by('-anio', '-mes')
    serializer_class = LiquidacionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Solo liquidaciones de empleados que pertenecen al usuario autenticado
        queryset = Liquidacion.objects.filter(
            empleado__empresa__owner=self.request.user
        ).order_by('-anio', '-mes')
        empleado_id = self.request.query_params.get('empleado', None)
        if empleado_id is not None:
            queryset = queryset.filter(empleado_id=empleado_id)
        return queryset

    def create(self, request, *args, **kwargs):
        data = request.data
        empleado_id = data.get('empleado')

        try:
            # Validar que el empleado pertenezca al usuario autenticado
            empleado = Empleado.objects.get(id=empleado_id, empresa__owner=request.user)
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

        except Empleado.DoesNotExist:
            return Response({'error': 'Trabajador no encontrado o no autorizado.'}, status=status.HTTP_404_NOT_FOUND)
        except IntegrityError:
            return Response(
                {'error': f'Ya existe una liquidación para este trabajador en el período indicado.'},
                status=status.HTTP_409_CONFLICT
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        try:
            liquidacion = self.get_object()
            es_plan_semilla = _es_plan_semilla(request.user)
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

# ==========================================
# FIRMA ELECTRÓNICA
# ==========================================

class SolicitudFirmaViewSet(viewsets.GenericViewSet):
    serializer_class = SolicitudFirmaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        cliente = getattr(self.request.user, 'perfil_cliente', None)
        if not cliente:
            return SolicitudFirma.objects.none()
        return SolicitudFirma.objects.filter(
            empresa__owner=cliente
        ).select_related('empleado', 'empresa')

    def list(self, request):
        empleado_id = request.query_params.get('empleado_id')
        qs = self.get_queryset()
        if empleado_id:
            qs = qs.filter(empleado_id=empleado_id)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=['post'])
    def solicitar(self, request):
        empleado_id   = request.data.get('empleado_id')
        tipo_doc      = request.data.get('tipo_documento')
        contrato_id   = request.data.get('contrato_id')
        doc_legal_id  = request.data.get('documento_legal_id')
        anexo_id      = request.data.get('anexo_contrato_id')

        tipos_validos = [t[0] for t in SolicitudFirma.TIPOS_DOCUMENTO]
        if tipo_doc not in tipos_validos:
            return Response({'error': 'Tipo de documento inválido.'}, status=400)

        cliente = getattr(request.user, 'perfil_cliente', None)
        if not cliente:
            return Response({'error': 'Perfil de cliente no encontrado.'}, status=403)

        try:
            empleado = Empleado.objects.get(id=empleado_id, empresa__owner=cliente)
        except Empleado.DoesNotExist:
            return Response({'error': 'Trabajador no encontrado.'}, status=404)

        empresa = empleado.empresa

        if not empresa.firma_imagen:
            return Response(
                {'error': 'La empresa no tiene firma del empleador configurada. Configúrela en el Lobby de Empresas.'},
                status=400
            )

        email_trabajador = empleado.email
        if not email_trabajador:
            return Response(
                {'error': 'El trabajador no tiene email registrado. Agréguelo antes de enviar a firma.'},
                status=400
            )

        es_plan_semilla = _es_plan_semilla(request.user)

        try:
            pdf_bytes, contrato_obj, doc_legal_obj = self._generar_pdf_firma(
                empleado, empresa, tipo_doc,
                contrato_id, doc_legal_id, anexo_id, es_plan_semilla
            )
        except Exception as e:
            return Response({'error': str(e)}, status=400)

        key = b2_client.key_pendiente(empresa.id, str(uuid_mod.uuid4()))
        try:
            b2_client.subir_documento(pdf_bytes, key)
        except RuntimeError as e:
            return Response({'error': str(e)}, status=503)
        except Exception:
            return Response({'error': 'Error al subir el documento al almacenamiento.'}, status=500)

        solicitud = SolicitudFirma.objects.create(
            empleado=empleado,
            empresa=empresa,
            tipo_documento=tipo_doc,
            contrato=contrato_obj,
            documento_legal=doc_legal_obj,
            email_firmante=email_trabajador,
            b2_key_temporal=key,
        )

        try:
            self._enviar_email_firma(solicitud, empleado, empresa)
        except Exception:
            pass

        return Response(SolicitudFirmaSerializer(solicitud).data, status=201)

    @action(detail=True, methods=['patch'])
    def cancelar(self, request, pk=None):
        solicitud = self.get_object()
        if solicitud.estado != 'PENDIENTE':
            return Response({'error': 'Solo se puede cancelar una solicitud pendiente.'}, status=400)
        solicitud.estado = 'CANCELADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response(SolicitudFirmaSerializer(solicitud).data)

    @action(detail=True, methods=['post'])
    def reenviar(self, request, pk=None):
        solicitud = self.get_object()
        if solicitud.estado != 'PENDIENTE':
            return Response({'error': 'Solo se puede reenviar una solicitud pendiente.'}, status=400)
        try:
            self._enviar_email_firma(solicitud, solicitud.empleado, solicitud.empresa)
        except Exception as e:
            return Response({'error': f'Error al reenviar el email: {str(e)}'}, status=500)
        return Response({'mensaje': 'Email de firma reenviado correctamente.'})

    # -------------------------------------------------
    # Helpers internos
    # -------------------------------------------------

    MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
             "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

    def _generar_pdf_firma(self, empleado, empresa, tipo_doc,
                           contrato_id, doc_legal_id, anexo_id, es_plan_semilla):
        if tipo_doc == 'CONTRATO':
            try:
                contrato = (Contrato.objects.get(id=contrato_id)
                            if contrato_id else Contrato.objects.get(empleado=empleado))
            except Contrato.DoesNotExist:
                raise Exception('El trabajador no tiene contrato registrado.')
            ctx = {'empleado': empleado, 'empresa': empresa, 'contrato': contrato,
                   'es_plan_semilla': es_plan_semilla}
            html = render_to_string('contrato_trabajo.html', ctx)
            return _html_a_pdf_bytes(html, f'Contrato_{empleado.rut}'), contrato, None

        if tipo_doc == 'ANEXO_40H':
            try:
                contrato = (Contrato.objects.get(id=contrato_id)
                            if contrato_id else Contrato.objects.get(empleado=empleado))
            except Contrato.DoesNotExist:
                raise Exception('El trabajador no tiene contrato registrado.')
            ctx = {'empleado': empleado, 'empresa': empresa, 'contrato': contrato,
                   'es_plan_semilla': es_plan_semilla}
            html = render_to_string('anexo_40h.html', ctx)
            return _html_a_pdf_bytes(html, f'Anexo40h_{empleado.rut}'), contrato, None

        if tipo_doc in ('AMONESTACION', 'DESPIDO', 'CONSTANCIA'):
            if doc_legal_id:
                try:
                    doc = DocumentoLegal.objects.get(id=doc_legal_id, empleado=empleado)
                except DocumentoLegal.DoesNotExist:
                    raise Exception('Documento legal no encontrado.')
            else:
                doc = DocumentoLegal.objects.filter(
                    empleado=empleado, tipo=tipo_doc
                ).order_by('-fecha_emision').first()
                if not doc:
                    raise Exception(f'No se encontró documento de tipo {tipo_doc}.')
            hoy = doc.fecha_emision
            fecha_es = f"{hoy.day:02d} de {self.MESES[hoy.month - 1]} de {hoy.year}"
            ciudad = str(getattr(empresa, 'comuna', '') or
                         getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()
            ctx = {'documento': doc, 'empleado': empleado, 'empresa': empresa,
                   'fecha_actual': fecha_es, 'ciudad': ciudad,
                   'es_plan_semilla': es_plan_semilla}
            html = render_to_string('documento_legal.html', ctx)
            return _html_a_pdf_bytes(html, f'{doc.tipo}_{empleado.rut}'), None, doc

        if tipo_doc == 'ANEXO_CONTRATO':
            if not anexo_id:
                raise Exception('Se requiere el ID del anexo de contrato.')
            try:
                contrato = Contrato.objects.get(empleado=empleado)
                anexo = AnexoContrato.objects.get(id=anexo_id, contrato=contrato)
            except (Contrato.DoesNotExist, AnexoContrato.DoesNotExist):
                raise Exception('Anexo de contrato no encontrado.')
            hoy = anexo.fecha_emision
            fecha_es = f"{hoy.day:02d} de {self.MESES[hoy.month - 1]} de {hoy.year}"
            ciudad = str(getattr(empresa, 'comuna', '') or
                         getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()
            ctx = {'anexo': anexo, 'contrato': contrato, 'empleado': empleado,
                   'empresa': empresa, 'fecha_actual': fecha_es, 'ciudad': ciudad,
                   'es_plan_semilla': es_plan_semilla}
            html = render_to_string('anexo_contrato.html', ctx)
            return _html_a_pdf_bytes(html, f'AnexoContrato_{empleado.rut}'), contrato, None

        raise Exception(f'Tipo de documento no soportado: {tipo_doc}')

    def _enviar_email_firma(self, solicitud, empleado, empresa):
        tipo_labels = {
            'CONTRATO':       'Contrato Laboral',
            'ANEXO_40H':      'Anexo Ley 40 Horas',
            'AMONESTACION':   'Carta de Amonestación',
            'DESPIDO':        'Carta de Despido',
            'CONSTANCIA':     'Constancia Laboral',
            'ANEXO_CONTRATO': 'Anexo de Contrato',
        }
        tipo_label       = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento)
        firma_url        = f"https://jornada40.cl/firma/{solicitud.token}"
        nombre_trabajador = f"{empleado.nombres} {empleado.apellido_paterno}"
        expira_fecha     = solicitud.expira_en.strftime('%d/%m/%Y')

        texto_plano = (
            f"Hola {nombre_trabajador},\n\n"
            f"{empresa.nombre_legal} requiere tu firma en: {tipo_label}.\n\n"
            f"Para firmar ingresa al siguiente enlace (válido hasta el {expira_fecha}):\n"
            f"{firma_url}\n\n"
            f"Si no reconoces esta solicitud, ignora este mensaje.\n\n"
            f"Jornada40 — Sistema de Gestión Laboral"
        )
        html_body = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Firma Electrónica Requerida</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa.nombre_legal}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hola <strong>{nombre_trabajador}</strong>,</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Tu empleador requiere tu firma electrónica en el siguiente documento:
      </p>
      <div style="background:#f0f4ff;border-left:4px solid #2563eb;padding:16px 20px;border-radius:6px;margin-bottom:28px;">
        <p style="margin:0;font-weight:700;color:#1e3a6e;font-size:15px;">{tipo_label}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Válido para firmar hasta el {expira_fecha}</p>
      </div>
      <a href="{firma_url}"
         style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Revisar y Firmar Documento
      </a>
      <p style="color:#9ca3af;font-size:12px;margin:28px 0 0;line-height:1.6;">
        Si el botón no funciona, copia este enlace:<br>
        <a href="{firma_url}" style="color:#2563eb;word-break:break-all;">{firma_url}</a>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Mensaje enviado a trabajador de <strong>{empresa.nombre_legal}</strong>.
        Firma Electrónica Simple válida bajo Ley 19.799 (Chile).
      </p>
    </div>
  </div>
</body>
</html>"""
        msg = EmailMultiAlternatives(
            subject=f"Firma requerida: {tipo_label} — {empresa.nombre_legal}",
            body=texto_plano,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[solicitud.email_firmante],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send()


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
    import hmac

    webhook_secret = config('REVENIU_WEBHOOK_SECRET', default=None)

    # Secret obligatorio. Sin él, rechazamos todo (fail closed).
    if not webhook_secret:
        return Response({'error': 'Webhook no configurado'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    token_recibido = request.headers.get('X-Webhook-Token', '')

    # Comparación en tiempo constante para evitar timing attacks.
    if not hmac.compare_digest(token_recibido, webhook_secret):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

    data = request.data
    evento = data.get('event')

    if evento in ['subscription_created', 'payment_succeeded']:
        custom_reference = data.get('custom_reference', '')

        if not custom_reference or '_' not in custom_reference:
            return Response({'error': 'custom_reference inválido'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cliente_id, plan_id = custom_reference.split('_', 1)
            cliente_id = int(cliente_id)
            plan_id = int(plan_id)
        except (ValueError, AttributeError):
            return Response({'error': 'Formato de custom_reference inválido'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            suscripcion = Suscripcion.objects.get(cliente_id=cliente_id)
            plan_nuevo = Plan.objects.get(id=plan_id)
        except (Suscripcion.DoesNotExist, Plan.DoesNotExist):
            return Response({'error': 'Suscripción o plan no encontrado'}, status=status.HTTP_400_BAD_REQUEST)

        suscripcion.plan = plan_nuevo
        suscripcion.estado = 'ACTIVE'
        suscripcion.gateway_subscription_id = str(data.get('subscription_id', ''))
        suscripcion.save()

        # Sincronizar también cliente.plan para que los PDFs y límites
        # reflejen el plan activo sin depender de la Suscripcion.
        suscripcion.cliente.plan = plan_nuevo
        suscripcion.cliente.save(update_fields=['plan'])

    return Response(status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetRateThrottle])
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
    if len(partes) != 2:
        return Response({'error': 'El correo registrado tiene un formato inválido.'}, status=400)
    nombre_correo, dominio = partes

    if len(nombre_correo) > 3:
        correo_oculto = nombre_correo[:3] + '*' * (len(nombre_correo) - 3) + '@' + dominio
    elif len(nombre_correo) > 1:
        correo_oculto = nombre_correo[0] + '*' * (len(nombre_correo) - 1) + '@' + dominio
    else:
        correo_oculto = '*@' + dominio

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

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def perfil_usuario(request):
    # Obtenemos el perfil del cliente (Tabla Cliente)
    cliente = getattr(request.user, 'perfil_cliente', None)
    
    if not cliente:
        return Response({'error': 'Perfil no encontrado en la tabla Cliente'}, status=404)

    if request.method == 'GET':
        # EXTRAEMOS DIRECTAMENTE DE LA TABLA CLIENTE
        return Response({
            'nombres': cliente.nombres or "",
            'apellido_paterno': cliente.apellido_paterno or "",
            'apellido_materno': cliente.apellido_materno or "",
            'email': request.user.email,
            'rut': cliente.rut,
            # Agregamos el nombre del plan para verificar el error del null
            'plan_nombre': cliente.plan.nombre if cliente.plan else "Sin Plan (null)"
        })

    if request.method == 'PUT':
        nombres = request.data.get('nombres')
        paterno = request.data.get('apellido_paterno')
        materno = request.data.get('apellido_materno')
        email = request.data.get('email')

        # 1. ACTUALIZAR TABLA CLIENTE (Campos específicos)
        if nombres is not None: cliente.nombres = nombres
        if paterno is not None: cliente.apellido_paterno = paterno
        if materno is not None: cliente.apellido_materno = materno
        if email: cliente.correo = email
        cliente.save()

        # 2. MANTENER REDUNDANCIA EN TABLA USER (Django Auth)
        if nombres is not None: request.user.first_name = nombres
        request.user.last_name = f"{paterno or ''} {materno or ''}".strip()
        if email: request.user.email = email
        request.user.save()

        return Response({'mensaje': 'Perfil actualizado con éxito en ambas tablas'})


# ==========================================
# FIRMA ELECTRÓNICA — ENDPOINTS PÚBLICOS
# (no requieren autenticación del empleador)
# ==========================================

def _enmascarar_email(email: str) -> str:
    """Ej: juan.perez@gmail.com → ju***@gmail.com"""
    partes = email.split('@')
    usuario = partes[0]
    dominio = partes[1] if len(partes) > 1 else ''
    prefijo = usuario[:2] if len(usuario) >= 2 else usuario[:1]
    return f"{prefijo}***@{dominio}"


@api_view(['GET'])
@permission_classes([AllowAny])
def firma_publica_info(request, token):
    """
    Retorna la información pública de una solicitud de firma:
    tipo de documento, nombre de empresa, nombre del trabajador y fecha de expiración.
    No expone datos sensibles.
    """
    try:
        solicitud = SolicitudFirma.objects.select_related('empleado', 'empresa').get(token=token)
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    # Marcar como expirada si corresponde
    if solicitud.estado == 'PENDIENTE' and timezone.now() > solicitud.expira_en:
        solicitud.estado = 'EXPIRADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])

    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
    }
    empleado = solicitud.empleado
    empresa  = solicitud.empresa

    return Response({
        'estado': solicitud.estado,
        'tipo_documento': solicitud.tipo_documento,
        'tipo_documento_label': tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento),
        'empresa_nombre': empresa.nombre_legal,
        'trabajador_nombre': f"{empleado.nombres} {empleado.apellido_paterno}",
        'email_firmante_enmascarado': _enmascarar_email(solicitud.email_firmante),
        'expira_en': solicitud.expira_en.isoformat(),
        'ya_verificado': solicitud.sesion_token_trabajador is not None,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def firma_publica_solicitar_otp(request, token):
    """
    Genera un código OTP de 6 dígitos y lo envía al email del trabajador.
    Limita a 1 solicitud por minuto para evitar spam.
    """
    try:
        solicitud = SolicitudFirma.objects.get(token=token)
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    if solicitud.estado != 'PENDIENTE':
        return Response({'error': 'Esta solicitud no está pendiente de firma.'}, status=400)

    if timezone.now() > solicitud.expira_en:
        solicitud.estado = 'EXPIRADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': 'El enlace de firma ha expirado.'}, status=410)

    # Anti-spam: no permitir más de un OTP por minuto
    ultimo_otp = OTPFirma.objects.filter(solicitud=solicitud).order_by('-creado_en').first()
    if ultimo_otp:
        segundos_transcurridos = (timezone.now() - ultimo_otp.creado_en).total_seconds()
        if segundos_transcurridos < 60:
            espera = int(60 - segundos_transcurridos)
            return Response(
                {'error': f'Debes esperar {espera} segundo(s) antes de solicitar un nuevo código.'},
                status=429
            )

    # Invalidar OTPs previos no verificados
    OTPFirma.objects.filter(
        solicitud=solicitud, verificado=False
    ).update(expira_en=timezone.now())

    # Generar código de 6 dígitos
    codigo = ''.join(random.choices(string.digits, k=6))

    otp = OTPFirma.objects.create(
        solicitud=solicitud,
        codigo=codigo,
        email_destino=solicitud.email_firmante,
    )

    # Enviar email con el código
    try:
        _enviar_email_otp(otp, solicitud)
    except Exception as e:
        otp.delete()
        return Response({'error': f'No se pudo enviar el código por email: {str(e)}'}, status=500)

    return Response({
        'enviado': True,
        'email_destino': _enmascarar_email(solicitud.email_firmante),
        'expira_en_minutos': 10,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def firma_publica_verificar_otp(request, token):
    """
    Verifica el código OTP enviado al trabajador.
    Si es correcto devuelve un sesion_token que autoriza el paso de firma.
    """
    codigo_enviado = str(request.data.get('codigo', '')).strip()

    if not codigo_enviado:
        return Response({'error': 'Debes ingresar el código.'}, status=400)

    try:
        solicitud = SolicitudFirma.objects.get(token=token)
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    if solicitud.estado != 'PENDIENTE':
        return Response({'error': 'Esta solicitud no está pendiente de firma.'}, status=400)

    if timezone.now() > solicitud.expira_en:
        solicitud.estado = 'EXPIRADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': 'El enlace de firma ha expirado.'}, status=410)

    # Buscar el OTP más reciente válido
    otp = OTPFirma.objects.filter(
        solicitud=solicitud, verificado=False
    ).order_by('-creado_en').first()

    if not otp or not otp.es_valido:
        return Response(
            {'error': 'No hay un código activo. Por favor solicita uno nuevo.'},
            status=400
        )

    # Incrementar intentos antes de verificar (previene timing attacks)
    otp.intentos += 1
    otp.save(update_fields=['intentos'])

    if otp.intentos > 3:
        return Response(
            {'error': 'Código bloqueado por demasiados intentos. Solicita uno nuevo.'},
            status=400
        )

    if otp.codigo != codigo_enviado:
        restantes = 3 - otp.intentos
        msg = (f'Código incorrecto. Te quedan {restantes} intento(s).'
               if restantes > 0 else 'Código bloqueado. Solicita uno nuevo.')
        return Response({'error': msg}, status=400)

    # Código correcto — marcar OTP como verificado
    otp.verificado = True
    otp.save(update_fields=['verificado'])

    # Generar sesion_token para el paso de firma
    sesion_token = uuid_mod.uuid4()
    solicitud.sesion_token_trabajador = sesion_token
    solicitud.save(update_fields=['sesion_token_trabajador', 'actualizado_en'])

    return Response({
        'verificado': True,
        'sesion_token': str(sesion_token),
    })


def _enviar_email_otp(otp: OTPFirma, solicitud: SolicitudFirma):
    """Envía el código OTP al trabajador por email."""
    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
    }
    tipo_label = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento)
    empresa_nombre = solicitud.empresa.nombre_legal
    codigo = otp.codigo

    texto_plano = (
        f"Tu código de verificación es: {codigo}\n\n"
        f"Ingresa este código en la página de firma para verificar tu identidad.\n"
        f"Válido por 10 minutos.\n\n"
        f"Si no solicitaste este código, ignora este mensaje.\n\n"
        f"Jornada40 — Sistema de Gestión Laboral"
    )
    html_body = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Verifica tu identidad</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa_nombre} · {tipo_label}</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="color:#374151;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Ingresa el siguiente código en la página de firma para verificar tu identidad:
      </p>
      <div style="text-align:center;margin:0 0 28px;">
        <div style="display:inline-block;background:#f0f4ff;border:2px dashed #2563eb;border-radius:12px;padding:20px 40px;">
          <span style="font-size:38px;font-weight:900;letter-spacing:0.3em;color:#1e3a6e;font-family:monospace;">{codigo}</span>
        </div>
        <p style="color:#6b7280;font-size:13px;margin:10px 0 0;">Válido por <strong>10 minutos</strong></p>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Si no solicitaste este código, puedes ignorar este mensaje con seguridad.<br>
        Firma Electrónica Simple válida bajo Ley 19.799 (Chile).
      </p>
    </div>
  </div>
</body>
</html>"""

    msg = EmailMultiAlternatives(
        subject=f"Tu código de verificación — {empresa_nombre}",
        body=texto_plano,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[otp.email_destino],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send()


# ==========================================
# FASE 8 — Procesamiento de la firma
# ==========================================

def _ip_desde_request(request) -> str:
    """Extrae la IP real del firmante considerando proxies (Railway/Vercel)."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR', '')


def _enviar_emails_firma_completada(
    solicitud: SolicitudFirma,
    empleado,
    empresa,
    pdf_firmado_bytes: bytes,
):
    """Envía confirmación de firma al trabajador y notificación al empleador."""
    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
    }
    tipo_label        = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento)
    nombre_trabajador = f"{empleado.nombres} {empleado.apellido_paterno}"
    firmado_str       = solicitud.firmado_en.strftime('%d/%m/%Y a las %H:%M') + ' UTC'
    nombre_pdf        = f"{tipo_label.replace(' ', '_')}_{empleado.rut}_firmado.pdf"

    # ── Email al trabajador ──────────────────────────────────────────────────
    texto_trabajador = (
        f"Hola {nombre_trabajador},\n\n"
        f"Tu firma electrónica simple fue registrada exitosamente el {firmado_str}.\n\n"
        f"Documento: {tipo_label}\n"
        f"Empresa: {empresa.nombre_legal}\n\n"
        f"Adjunto encontrarás una copia del documento firmado con el certificado de firma.\n\n"
        f"Jornada40 — Sistema de Gestión Laboral"
    )
    html_trabajador = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">¡Documento Firmado!</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa.nombre_legal}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hola <strong>{nombre_trabajador}</strong>,</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Tu firma electrónica simple fue registrada exitosamente.
      </p>
      <div style="background:#f0fdf4;border-left:4px solid #059669;padding:16px 20px;border-radius:6px;margin-bottom:28px;">
        <p style="margin:0;font-weight:700;color:#065f46;font-size:15px;">{tipo_label}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Firmado el {firmado_str}</p>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Adjunto a este correo encontrarás el documento firmado con el certificado de autenticidad.
        Guárdalo en un lugar seguro.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Firma Electrónica Simple válida bajo Ley N° 19.799 (Chile). Generado por Jornada40.
      </p>
    </div>
  </div>
</body>
</html>"""

    msg_trabajador = EmailMultiAlternatives(
        subject=f"Documento firmado: {tipo_label} — {empresa.nombre_legal}",
        body=texto_trabajador,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[solicitud.email_firmante],
    )
    msg_trabajador.attach_alternative(html_trabajador, "text/html")
    msg_trabajador.attach(nombre_pdf, pdf_firmado_bytes, 'application/pdf')
    msg_trabajador.send()

    # ── Email al empleador ───────────────────────────────────────────────────
    email_empleador = empresa.owner.email
    if not email_empleador:
        return

    texto_empleador = (
        f"El trabajador {nombre_trabajador} firmó el documento «{tipo_label}» "
        f"el {firmado_str}.\n\n"
        f"Empresa: {empresa.nombre_legal}\n"
        f"El documento firmado está adjunto a este correo.\n\n"
        f"Jornada40 — Sistema de Gestión Laboral"
    )
    html_empleador = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0c1a35,#1e3a6e);padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Firma Recibida</h1>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">{empresa.nombre_legal}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
        El trabajador <strong>{nombre_trabajador}</strong> firmó el siguiente documento:
      </p>
      <div style="background:#f0f4ff;border-left:4px solid #2563eb;padding:16px 20px;border-radius:6px;margin-bottom:28px;">
        <p style="margin:0;font-weight:700;color:#1e3a6e;font-size:15px;">{tipo_label}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Firmado el {firmado_str}</p>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 0;">
        El documento firmado con certificado de autenticidad está adjunto a este correo.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        Firma Electrónica Simple válida bajo Ley N° 19.799 (Chile). Generado por Jornada40.
      </p>
    </div>
  </div>
</body>
</html>"""

    msg_empleador = EmailMultiAlternatives(
        subject=f"Firma recibida: {nombre_trabajador} firmó «{tipo_label}»",
        body=texto_empleador,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email_empleador],
    )
    msg_empleador.attach_alternative(html_empleador, "text/html")
    msg_empleador.attach(nombre_pdf, pdf_firmado_bytes, 'application/pdf')
    msg_empleador.send()


@api_view(['POST'])
@permission_classes([AllowAny])
def firma_publica_firmar(request, token):
    """
    Procesa la firma del trabajador:
    1. Valida sesion_token y datos de entrada
    2. Descarga PDF original de B2
    3. Genera PDF firmado con página de certificado (pdf_firma.py)
    4. Sube PDF firmado a B2 y elimina el temporal
    5. Marca SolicitudFirma como FIRMADO
    6. Envía emails de confirmación con el PDF adjunto
    """
    sesion_token    = str(request.data.get('sesion_token',    '')).strip()
    firma_trabajador = str(request.data.get('firma_trabajador', '')).strip()

    if not sesion_token:
        return Response({'error': 'Sesión inválida. Vuelve a verificar tu identidad.'}, status=400)
    if not firma_trabajador:
        return Response({'error': 'Debes dibujar tu firma antes de continuar.'}, status=400)

    try:
        solicitud = SolicitudFirma.objects.select_related(
            'empleado', 'empresa', 'empresa__owner'
        ).get(token=token)
    except SolicitudFirma.DoesNotExist:
        return Response({'error': 'Solicitud de firma no encontrada.'}, status=404)

    # ── Validaciones de estado ──────────────────────────────────────────────
    if solicitud.estado != 'PENDIENTE':
        return Response(
            {'error': f'Esta solicitud ya no está pendiente ({solicitud.get_estado_display()}).'},
            status=400,
        )

    if timezone.now() > solicitud.expira_en:
        solicitud.estado = 'EXPIRADO'
        solicitud.save(update_fields=['estado', 'actualizado_en'])
        return Response({'error': 'El enlace de firma ha expirado.'}, status=410)

    if (not solicitud.sesion_token_trabajador
            or str(solicitud.sesion_token_trabajador) != sesion_token):
        return Response(
            {'error': 'Sesión inválida. Vuelve a verificar tu identidad con el código OTP.'},
            status=403,
        )

    if not solicitud.b2_key_temporal:
        return Response(
            {'error': 'No se encontró el PDF del documento. Contacta al empleador.'},
            status=400,
        )

    # ── Descargar PDF original de B2 ────────────────────────────────────────
    try:
        pdf_original_bytes = b2_client.descargar_documento(solicitud.b2_key_temporal)
    except Exception as exc:
        return Response({'error': f'Error al obtener el documento: {exc}'}, status=500)

    # ── Generar PDF firmado con certificado ─────────────────────────────────
    empleado = solicitud.empleado
    empresa  = solicitud.empresa
    tipo_labels = {
        'CONTRATO': 'Contrato Laboral', 'ANEXO_40H': 'Anexo Ley 40 Horas',
        'AMONESTACION': 'Carta de Amonestación', 'DESPIDO': 'Carta de Despido',
        'CONSTANCIA': 'Constancia Laboral', 'ANEXO_CONTRATO': 'Anexo de Contrato',
    }
    firmado_en  = timezone.now()
    ip_firmante = _ip_desde_request(request)

    try:
        from .pdf_firma import agregar_certificado_firma
        pdf_firmado_bytes = agregar_certificado_firma(
            pdf_original_bytes    = pdf_original_bytes,
            tipo_documento_label  = tipo_labels.get(solicitud.tipo_documento, solicitud.tipo_documento),
            empresa_nombre        = empresa.nombre_legal,
            empresa_rut           = empresa.rut,
            firmante_nombre       = empresa.firma_firmante_nombre or empresa.representante_legal or '',
            firmante_cargo        = empresa.firma_firmante_cargo or 'Representante Legal',
            firma_empleador_b64   = empresa.firma_imagen or '',
            trabajador_nombre     = f"{empleado.nombres} {empleado.apellido_paterno}",
            trabajador_rut        = empleado.rut,
            firma_trabajador_b64  = firma_trabajador,
            token                 = str(solicitud.token),
            firmado_en            = firmado_en,
            ip_firmante           = ip_firmante,
            email_firmante        = solicitud.email_firmante,
        )
    except Exception as exc:
        return Response({'error': f'Error al generar el documento firmado: {exc}'}, status=500)

    # ── Subir PDF firmado a B2 ──────────────────────────────────────────────
    key_firmado = b2_client.key_firmado(
        empresa_id=empresa.id,
        uuid=str(solicitud.token),
        year=firmado_en.year,
        month=firmado_en.month,
    )
    try:
        b2_client.subir_documento(pdf_firmado_bytes, key_firmado)
    except Exception as exc:
        return Response({'error': f'Error al guardar el documento firmado: {exc}'}, status=500)

    # Eliminar PDF temporal (no crítico)
    b2_client.eliminar_documento(solicitud.b2_key_temporal)

    # ── Actualizar SolicitudFirma ───────────────────────────────────────────
    solicitud.estado                 = 'FIRMADO'
    solicitud.firmado_en             = firmado_en
    solicitud.ip_firmante            = ip_firmante or None
    solicitud.firma_trabajador_imagen = firma_trabajador
    solicitud.b2_key_firmado         = key_firmado
    solicitud.sesion_token_trabajador = None   # invalidar sesión
    solicitud.save(update_fields=[
        'estado', 'firmado_en', 'ip_firmante',
        'firma_trabajador_imagen', 'b2_key_firmado',
        'sesion_token_trabajador', 'actualizado_en',
    ])

    # ── Emails de confirmación (no críticos) ────────────────────────────────
    try:
        _enviar_emails_firma_completada(solicitud, empleado, empresa, pdf_firmado_bytes)
    except Exception:
        pass

    return Response({'firmado': True, 'firmado_en': firmado_en.isoformat()})