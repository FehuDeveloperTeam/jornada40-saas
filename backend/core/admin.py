import datetime

from django import forms
from django.conf import settings
from django.contrib import admin
from django.core.exceptions import PermissionDenied
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import path
from django.utils import timezone
from django.utils.html import format_html

from . import pruebas
from .models import CodigoPrueba
from .models import PeriodoVacacionesEscolares, SolicitudConciliacion
from .models import DispositivoExtension, LevantamientoMiDT
from .models import (RegistroBitacora, ExportacionBitacora, Empresa, Empleado, Contrato, AnexoContrato, Plan, Cliente,
                     ParametroPrevisional, TasaAFP, ConceptoRemuneracion, Suscripcion, EventoPasarela, IntentoPago,
                     RegistroDT, TramoAsignacionFamiliar, SolicitudDocumento, CertificadoEmitido,
                     RegistroInspeccion, RatificacionInspeccion, FactorActualizacionSII, CertificadoSueldos)


@admin.register(ConceptoRemuneracion)
class ConceptoRemuneracionAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'codigo', 'tipo', 'ambito', 'es_imponible',
                    'afecta_gratificacion', 'afecta_semana_corrida', 'activo')
    list_filter = ('tipo', 'activo', 'es_imponible')
    search_fields = ('codigo', 'nombre')
    ordering = ('tipo', 'nombre')

    @admin.display(description='Ámbito')
    def ambito(self, obj):
        return obj.empresa.nombre_legal if obj.empresa else 'Catálogo del sistema'

    fieldsets = (
        (None, {
            'fields': ('codigo', 'nombre', 'tipo', 'empresa', 'activo'),
            'description': 'Sin empresa, el concepto queda disponible para todas. '
                           'La naturaleza previsional se deriva del tipo al crearlo.',
        }),
        ('Naturaleza previsional', {
            'fields': ('es_imponible', 'es_tributable', 'afecta_gratificacion',
                       'afecta_semana_corrida', 'codigo_lre'),
            'description': 'Ajustar solo ante una excepción que la ley reconozca. '
                           'El código LRE se completa al implementar el Libro de '
                           'Remuneraciones Electrónico.',
        }),
    )


# ==========================================
# PARÁMETROS LEGALES (topes, tasas, sueldo mínimo)
# ==========================================
@admin.register(ParametroPrevisional)
class ParametroPrevisionalAdmin(admin.ModelAdmin):
    list_display = ('vigente_desde', 'estado', 'origen', 'tope_imponible_afp_uf',
                    'tope_imponible_afc_uf', 'ingreso_minimo_mensual')
    list_filter = ('confirmado', 'origen')
    ordering = ('-vigente_desde',)
    actions = ['confirmar_propuestas']

    @admin.display(description='Estado')
    def estado(self, obj):
        if obj.confirmado:
            return 'Rige (confirmado)'
        if obj.origen == 'PREVIRED':
            return 'Propuesta — NO rige'
        return 'Rige (sin confirmar)'

    @admin.action(description='Confirmar: poner en vigencia los valores seleccionados')
    def confirmar_propuestas(self, request, queryset):
        actualizados = queryset.update(confirmado=True)
        self.message_user(
            request,
            f'{actualizados} período(s) confirmado(s). Las liquidaciones que se '
            f'calculen para esos períodos ya usan estos valores.')

    fieldsets = (
        ('Vigencia', {
            'fields': ('vigente_desde', 'origen', 'confirmado', 'notas'),
            'description': 'Los valores rigen desde esta fecha hasta que exista un período posterior. '
                           'Una propuesta leída de Previred no entra al cálculo hasta que la confirmes; '
                           'una carga manual sí rige de inmediato.',
        }),
        ('Topes imponibles (en UF)', {
            'fields': ('tope_imponible_afp_uf', 'tope_imponible_afc_uf'),
        }),
        ('Gratificación', {
            'fields': ('ingreso_minimo_mensual', 'factor_gratificacion'),
            'description': 'El tope mensual de gratificación se calcula como factor × sueldo mínimo / 12.',
        }),
        ('Tasas de cotización', {
            'fields': ('tasa_salud', 'tasa_afc_trabajador_indefinido',
                       'tasa_afc_empleador_indefinido', 'tasa_afc_empleador_plazo',
                       'tasa_sis', 'tasa_mutual_base', 'tasa_expectativa_vida'),
        }),
    )


@admin.register(TasaAFP)
class TasaAFPAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tasa', 'vigente_desde', 'origen', 'confirmado')
    list_filter = ('vigente_desde', 'origen', 'confirmado')
    search_fields = ('nombre',)
    ordering = ('-vigente_desde', 'nombre')
    actions = ['confirmar_propuestas']

    @admin.action(description='Confirmar: poner en vigencia las tasas seleccionadas')
    def confirmar_propuestas(self, request, queryset):
        actualizados = queryset.update(confirmado=True)
        self.message_user(request, f'{actualizados} tasa(s) confirmada(s).')

# ==========================================
# GESTIÓN DE SUSCRIPCIONES Y CLIENTES
# ==========================================
@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'nivel', 'precio', 'precio_anual', 'max_empresas', 'limite_trabajadores', 'activo')
    list_filter = ('activo',)
    search_fields = ('nombre',)

@admin.register(Suscripcion)
class SuscripcionAdmin(admin.ModelAdmin):
    list_display = ('cliente', 'plan', 'plan_programado', 'ciclo', 'estado', 'prueba_hasta', 'gateway_subscription_id',
                    'fecha_cancelacion')
    list_filter = ('estado', 'plan')
    search_fields = ('cliente__rut', 'gateway_subscription_id')

    def save_model(self, request, obj, form, change):
        # Prueba extendida a mano: los avisos de término se vuelven a enviar según la nueva fecha.
        if change and 'prueba_hasta' in form.changed_data and obj.estado == 'TRIAL':
            obj.prueba_aviso = None
        super().save_model(request, obj, form, change)


class GenerarCodigosForm(forms.Form):
    plan = forms.ModelChoiceField(queryset=Plan.objects.filter(activo=True, precio__gt=0).order_by('nivel'),
                                  label='Plan que regala')
    meses = forms.IntegerField(min_value=1, max_value=12, initial=pruebas.MESES_POR_DEFECTO, label='Meses gratis')
    dias_validez = forms.IntegerField(min_value=1, max_value=365, initial=pruebas.DIAS_VALIDEZ_POR_DEFECTO,
                                      label='Días para usarlo',
                                      help_text='Si no se crea la cuenta dentro de este plazo, el código vence.')
    cantidad = forms.IntegerField(min_value=1, max_value=pruebas.MAXIMO_POR_VEZ, initial=1, label='Cantidad de códigos')
    nota = forms.CharField(max_length=200, label='Nota',
                           help_text='Para quién es (p. ej. "Ferretería El Clavo, piloto"). Se ve en la lista y en '
                                     'el correo que avisa cuando se usa.')


class EstadoCodigoFilter(admin.SimpleListFilter):
    title = 'estado'
    parameter_name = 'estado'

    def lookups(self, request, model_admin):
        return [('DISPONIBLE', 'Disponible'), ('USADO', 'Usado'), ('VENCIDO', 'Vencido'), ('ANULADO', 'Anulado')]

    def queryset(self, request, queryset):
        hoy = timezone.localdate()
        sin_usar = queryset.filter(usado_en__isnull=True)
        return {
            'DISPONIBLE': sin_usar.filter(activo=True, valido_hasta__gte=hoy),
            'USADO': queryset.filter(usado_en__isnull=False),
            'VENCIDO': sin_usar.filter(activo=True, valido_hasta__lt=hoy),
            'ANULADO': sin_usar.filter(activo=False),
        }.get(self.value(), queryset)


@admin.register(CodigoPrueba)
class CodigoPruebaAdmin(admin.ModelAdmin):
    """Códigos que regalan un plan pagado por unos meses al crear la cuenta (core/pruebas.py).
    "Agregar" abre la generación: el código completo se ve solo en ese momento."""
    list_display = ('codigo', 'plan_nombre', 'meses', 'estado_visible', 'nota', 'valido', 'cuenta', 'usado')
    list_select_related = ('plan', 'usado_por')
    list_filter = (EstadoCodigoFilter, 'plan')
    search_fields = ('nota', 'sufijo', 'usado_por__rut')
    fields = ('visible', 'plan', 'meses', 'nota', 'valido_hasta', 'activo', 'creado_en', 'creado_por', 'usado_por',
              'usado_en')
    readonly_fields = ('visible', 'plan', 'meses', 'creado_en', 'creado_por', 'usado_por', 'usado_en')
    actions = ['anular']

    @admin.display(description='Código')
    def visible(self, obj):
        return obj.visible

    @admin.display(description='Código', ordering='creado_en')
    def codigo(self, obj):
        return format_html('<span style="white-space:nowrap">{}</span>', obj.visible)

    @admin.display(description='Plan', ordering='plan__nivel')
    def plan_nombre(self, obj):
        return obj.plan.nombre

    @admin.display(description='Válido hasta', ordering='valido_hasta')
    def valido(self, obj):
        return obj.valido_hasta.strftime('%d-%m-%Y')

    @admin.display(description='Cuenta')
    def cuenta(self, obj):
        c = obj.usado_por
        return f'{c.rut} · {c.nombres} {c.apellido_paterno or ""}'.strip() if c else '—'

    @admin.display(description='Usado el', ordering='usado_en')
    def usado(self, obj):
        return timezone.localtime(obj.usado_en).strftime('%d-%m-%Y %H:%M') if obj.usado_en else '—'

    @admin.display(description='Estado')
    def estado_visible(self, obj):
        return {'DISPONIBLE': 'Disponible', 'USADO': 'Usado', 'VENCIDO': 'Vencido', 'ANULADO': 'Anulado'}[obj.estado()]

    @admin.action(description='Anular los códigos seleccionados que no se han usado')
    def anular(self, request, queryset):
        anulados = queryset.filter(usado_en__isnull=True, activo=True).update(activo=False)
        self.message_user(request, f'{anulados} código(s) anulado(s). Los ya usados no cambian: esas cuentas '
                                   'conservan su prueba.')

    def has_delete_permission(self, request, obj=None):
        return False   # se anulan: un código usado es el respaldo de la prueba de esa cuenta

    def get_urls(self):
        propias = [path('generar/', self.admin_site.admin_view(self.generar_view), name='core_codigoprueba_generar')]
        return propias + super().get_urls()

    def add_view(self, request, form_url='', extra_context=None):
        return redirect('admin:core_codigoprueba_generar')

    def generar_view(self, request):
        if not self.has_add_permission(request):
            raise PermissionDenied
        contexto = {**self.admin_site.each_context(request), 'opts': self.model._meta,
                    'title': 'Generar códigos de prueba'}
        if request.method == 'POST':
            form = GenerarCodigosForm(request.POST)
            if form.is_valid():
                datos = form.cleaned_data
                valido_hasta = timezone.localdate() + datetime.timedelta(days=datos['dias_validez'])
                creados = pruebas.generar(datos['plan'], nota=datos['nota'], meses=datos['meses'],
                                          cantidad=datos['cantidad'], valido_hasta=valido_hasta,
                                          creado_por=request.user)
                for codigo, _ in creados:
                    self.log_addition(request, codigo, [{'added': {}}])
                sitio = settings.SITIO_URL.rstrip('/')
                contexto.update(
                    codigos=[{'codigo': texto, 'enlace': f'{sitio}/register?codigo={texto}'} for _, texto in creados],
                    plan=datos['plan'].nombre, meses=datos['meses'], valido_hasta=valido_hasta, nota=datos['nota'])
                return TemplateResponse(request, 'admin/core/codigoprueba/generar.html', contexto)
        else:
            form = GenerarCodigosForm(initial={'plan': Plan.objects.filter(activo=True, nivel=3).first()})
        contexto['form'] = form
        return TemplateResponse(request, 'admin/core/codigoprueba/generar.html', contexto)


@admin.register(IntentoPago)
class IntentoPagoAdmin(admin.ModelAdmin):
    """Checkouts iniciados: su id es el external_id que Reveniu devuelve en los webhooks."""
    list_display = ('creado_en', 'cliente', 'plan', 'ciclo', 'gateway_subscription_id')
    list_filter = ('ciclo', 'plan')
    search_fields = ('cliente__rut', 'gateway_subscription_id')
    readonly_fields = ('cliente', 'plan', 'ciclo', 'gateway_subscription_id', 'creado_en')


@admin.register(EventoPasarela)
class EventoPasarelaAdmin(admin.ModelAdmin):
    """Avisos de Reveniu. Uno sin cliente se asocia eligiendo cliente y plan y guardando."""
    list_display = ('recibido_en', 'evento', 'cliente', 'plan', 'monto', 'gateway_subscription_id', 'aplicado')
    list_filter = ('evento', 'aplicado')
    search_fields = ('cliente__rut', 'gateway_subscription_id', 'orden_compra')
    readonly_fields = ('evento', 'gateway_subscription_id', 'orden_compra', 'monto', 'fecha_pago', 'datos', 'aplicado', 'recibido_en')
    autocomplete_fields = ('cliente',)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        from .views import aplicar_evento_pasarela
        if aplicar_evento_pasarela(obj):
            self.message_user(request, 'Evento aplicado: la suscripción del cliente quedó actualizada.')


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('rut', 'obtener_nombre', 'tipo_cliente', 'plan', 'creado_en')
    list_filter = ('tipo_cliente', 'plan')
    search_fields = ('rut', 'nombres', 'apellido_paterno', 'razon_social')
    
    def obtener_nombre(self, obj):
        if obj.tipo_cliente == 'EMPRESA':
            return obj.razon_social
        return f"{obj.nombres} {obj.apellido_paterno}"
    obtener_nombre.short_description = 'Nombre / Razón Social'

@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ('nombre_legal', 'rut', 'owner', 'created_at')
    search_fields = ('nombre_legal', 'rut', 'owner__username')

@admin.register(Empleado)
class EmpleadoAdmin(admin.ModelAdmin):
    list_display = ('rut', 'nombres', 'apellido_paterno', 'apellido_materno', 'empresa', 'cargo', 'activo')
    list_filter = ('empresa', 'activo', 'cargo')
    search_fields = ('rut', 'nombres', 'apellido_paterno')

@admin.register(Contrato)
class ContratoAdmin(admin.ModelAdmin):
    list_display = ('empleado', 'tipo_jornada', 'horas_semanales', 'fecha_inicio')
    list_filter = ('tipo_jornada', 'horas_semanales')

@admin.register(AnexoContrato)
class AnexoContratoAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'contrato', 'fecha_emision', 'creado_en')
    list_filter = ('fecha_emision',)
    search_fields = ('titulo', 'contrato__empleado__rut', 'contrato__empleado__apellido_paterno')

@admin.register(RegistroDT)
class RegistroDTAdmin(admin.ModelAdmin):
    """Constancias de registro en Mi DT (contratos, anexos y términos)."""
    list_display = ('empresa', 'clave', 'registrado_en', 'creado_en')
    search_fields = ('empresa__rut', 'clave')


@admin.register(TramoAsignacionFamiliar)
class TramoAsignacionFamiliarAdmin(admin.ModelAdmin):
    """Monto por carga de la asignación familiar. Cuando la SUSESO publique un
    reajuste, se agregan los tres tramos con su fecha de vigencia."""
    list_display = ('vigente_desde', 'tramo', 'monto', 'renta_hasta', 'fuente')
    list_filter = ('vigente_desde',)
    ordering = ('-vigente_desde', 'tramo')


@admin.register(SolicitudDocumento)
class SolicitudDocumentoAdmin(admin.ModelAdmin):
    list_display = ('creada_en', 'empleado', 'tipo', 'mes', 'anio', 'estado')
    list_filter = ('estado', 'tipo')
    search_fields = ('empleado__rut', 'empleado__apellido_paterno')


@admin.register(CertificadoEmitido)
class CertificadoEmitidoAdmin(admin.ModelAdmin):
    """Solo lectura: lo que el certificado afirma no se corrige a mano (la verificación pública lo muestra)."""
    list_display = ('emitido_en', 'folio', 'tipo', 'empleado', 'codigo')
    list_filter = ('tipo',)
    search_fields = ('codigo', 'empleado__rut', 'empleado__apellido_paterno')
    readonly_fields = ('empleado', 'cuenta', 'tipo', 'opcion', 'codigo', 'datos', 'emitido_en')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(RegistroInspeccion)
class RegistroInspeccionAdmin(admin.ModelAdmin):
    """Bitácora de fiscalización: solo lectura (es evidencia del acceso de la DT)."""
    list_display = ('creado_en', 'empresa', 'accion', 'nombre', 'correo', 'detalle')
    list_filter = ('accion',)
    search_fields = ('correo', 'nombre', 'empresa__rut')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(RatificacionInspeccion)
class RatificacionInspeccionAdmin(admin.ModelAdmin):
    list_display = ('ratificado_en', 'empresa', 'titulo', 'inspector_nombre', 'inspector_correo')
    readonly_fields = ('empresa', 'clave', 'titulo', 'inspector_nombre', 'inspector_rut', 'inspector_correo',
                       'firma_imagen', 'ip', 'ratificado_en')

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(FactorActualizacionSII)
class FactorActualizacionSIIAdmin(admin.ModelAdmin):
    """Factores de actualización de la Operación Renta: cargar los 12 meses del año cuando el SII los publique
    (tabla de corrección monetaria, columna diciembre, como 1 + porcentaje)."""
    list_display = ('anio', 'mes', 'factor')
    list_filter = ('anio',)


@admin.register(CertificadoSueldos)
class CertificadoSueldosAdmin(admin.ModelAdmin):
    list_display = ('numero', 'anio', 'empresa', 'empleado', 'emitido_en')
    list_filter = ('anio',)
    readonly_fields = ('empresa', 'empleado', 'anio', 'numero', 'datos', 'reemplaza', 'emitido_en')

    def has_add_permission(self, request):
        return False


@admin.register(ExportacionBitacora)
class ExportacionBitacoraAdmin(admin.ModelAdmin):
    """Copias descargadas de la bitácora (solo lectura)."""
    list_display = ('creado_en', 'cuenta', 'numero', 'codigo', 'formato', 'registros', 'generado_por_nombre')
    search_fields = ('codigo', 'cuenta__username')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(RegistroBitacora)
class RegistroBitacoraAdmin(admin.ModelAdmin):
    """Solo lectura: la bitácora no se edita ni se borra (tampoco desde el admin)."""
    list_display = ('creado_en', 'cuenta', 'actor_nombre', 'actor_tipo', 'accion', 'descripcion', 'estado_http')
    list_filter = ('actor_tipo', 'accion')
    search_fields = ('actor_nombre', 'actor_rut', 'descripcion', 'cuenta__username')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PeriodoVacacionesEscolares)
class PeriodoVacacionesEscolaresAdmin(admin.ModelAdmin):
    """Calendario escolar del Mineduc: se carga cada año (avisos de cuidado, Ley 21.645)."""
    list_display = ('nombre', 'desde', 'hasta', 'regiones')


@admin.register(SolicitudConciliacion)
class SolicitudConciliacionAdmin(admin.ModelAdmin):
    list_display = ('empleado', 'tipo', 'presentada_el', 'estado', 'respondida_el', 'activo')
    list_filter = ('tipo', 'estado')


@admin.register(DispositivoExtension)
class DispositivoExtensionAdmin(admin.ModelAdmin):
    """Navegadores conectados a la extensión para Mi DT. Solo se desconectan (revocado_en)."""
    list_display = ('nombre', 'cuenta', 'persona', 'creado_en', 'ultimo_uso', 'revocado_en')
    readonly_fields = ('cuenta', 'persona', 'nombre', 'token_hash', 'creado_en', 'ultimo_uso')
    search_fields = ('nombre', 'cuenta__username')

    def has_add_permission(self, request):
        return False


@admin.register(LevantamientoMiDT)
class LevantamientoMiDTAdmin(admin.ModelAdmin):
    """Estructura de pantallas de Mi DT enviada desde la extensión (sin valores): base de los mapeos."""
    list_display = ('creado_en', 'ruta', 'titulo', 'cuenta', 'version_extension')
    readonly_fields = ('cuenta', 'persona', 'ruta', 'titulo', 'version_extension', 'estructura', 'creado_en')
    search_fields = ('ruta', 'titulo')
    actions = ['descargar_json']

    @admin.action(description='Descargar en JSON (para armar los mapeos)')
    def descargar_json(self, request, queryset):
        import json
        from django.http import HttpResponse
        datos = [{'id': l.id, 'creado_en': l.creado_en.isoformat(), 'ruta': l.ruta, 'titulo': l.titulo,
                  'version_extension': l.version_extension, 'estructura': l.estructura}
                 for l in queryset.order_by('creado_en')]
        respuesta = HttpResponse(json.dumps(datos, ensure_ascii=False, indent=2), content_type='application/json; charset=utf-8')
        respuesta['Content-Disposition'] = 'attachment; filename="levantamiento_mi_dt.json"'
        return respuesta

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
