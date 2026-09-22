from django.contrib import admin
from .models import (Empresa, Empleado, Contrato, AnexoContrato, Plan, Cliente,
                     ParametroPrevisional, TasaAFP)


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
    list_display = ('nombre', 'precio', 'max_empresas', 'limite_trabajadores', 'activo')
    list_filter = ('activo',)
    search_fields = ('nombre',)

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