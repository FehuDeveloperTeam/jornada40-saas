from django.contrib import admin
from .models import Empresa, Empleado, Contrato, Plan, Cliente

# ==========================================
# GESTIÓN DE SUSCRIPCIONES Y CLIENTES
# ==========================================
@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'precio', 'max_empresas', 'max_empleados', 'activo')
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