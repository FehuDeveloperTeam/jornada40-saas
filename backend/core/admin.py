from django.contrib import admin
from .models import Empresa, Empleado, Contrato

@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ('nombre_legal', 'rut', 'owner', 'created_at')
    search_fields = ('nombre_legal', 'rut', 'owner__username')

@admin.register(Empleado)
class EmpleadoAdmin(admin.ModelAdmin):
    list_display = ('rut', 'nombres', 'apellidos', 'empresa', 'cargo', 'activo')
    list_filter = ('empresa', 'activo', 'cargo')
    search_fields = ('rut', 'nombres', 'apellidos')

@admin.register(Contrato)
class ContratoAdmin(admin.ModelAdmin):
    list_display = ('empleado', 'tipo_jornada', 'horas_semanales', 'fecha_inicio')
    list_filter = ('tipo_jornada', 'horas_semanales')