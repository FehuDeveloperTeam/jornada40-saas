from rest_framework import serializers
from .models import Empresa, Empleado, Contrato, AnexoContrato, DocumentoLegal, Liquidacion, Plan, Suscripcion, SolicitudFirma
from dj_rest_auth.serializers import PasswordResetSerializer

class EmpresaSerializer(serializers.ModelSerializer):
    firma_configurada = serializers.SerializerMethodField()

    def get_firma_configurada(self, obj):
        return bool(obj.firma_imagen)

    class Meta:
        model = Empresa
        fields = [
            'id', 'owner', 'nombre_legal', 'rut', 'alias', 'giro',
            'direccion', 'comuna', 'ciudad', 'sucursal',
            'representante_legal', 'rut_representante',
            'activo', 'created_at',
            'firma_firmante_nombre', 'firma_firmante_cargo', 'firma_configurada_en',
            'firma_configurada',
        ]
        read_only_fields = ('id', 'owner', 'activo', 'created_at',
                            'firma_imagen', 'firma_configurada_en', 'firma_configurada')


class ContratoSerializer(serializers.ModelSerializer):
    tiene_contrato_pdf = serializers.SerializerMethodField()
    tiene_anexo_40h_pdf = serializers.SerializerMethodField()

    def get_tiene_contrato_pdf(self, obj):
        return bool(obj.archivo_contrato)

    def get_tiene_anexo_40h_pdf(self, obj):
        return bool(obj.archivo_anexo_40h)

    class Meta:
        model = Contrato
        fields = [
            'id', 'empleado', 'tipo_contrato', 'cargo',
            'fecha_inicio', 'fecha_fin', 'sueldo_base',
            'tipo_jornada', 'horas_semanales', 'distribucion_dias', 'distribucion_horario',
            'dia_pago', 'gratificacion_legal',
            'tiene_quincena', 'dia_quincena', 'monto_quincena',
            'jornada_personalizada', 'funciones_especificas', 'clausulas_especiales',
            'archivo_contrato', 'archivo_anexo_40h',
            'tiene_contrato_pdf', 'tiene_anexo_40h_pdf',
            'creado_en',
        ]
        read_only_fields = ('id', 'archivo_contrato', 'archivo_anexo_40h', 'creado_en',
                            'tiene_contrato_pdf', 'tiene_anexo_40h_pdf')


class EmpleadoSerializer(serializers.ModelSerializer):
    contrato_activo = ContratoSerializer(read_only=True)

    class Meta:
        model = Empleado
        fields = [
            'id', 'empresa', 'rut', 'nombres', 'apellido_paterno', 'apellido_materno',
            'sexo', 'fecha_nacimiento', 'nacionalidad', 'estado_civil',
            'direccion', 'comuna', 'numero_telefono', 'email',
            'departamento', 'cargo', 'sucursal',
            'horas_laborales', 'modalidad', 'sueldo_base', 'fecha_ingreso',
            'afp', 'sistema_salud', 'plan_isapre_uf',
            'forma_pago', 'banco', 'tipo_cuenta', 'numero_cuenta',
            'centro_costo', 'ficha_numero',
            'activo', 'creado_en',
            'contrato_activo',
        ]
        read_only_fields = ('id', 'ficha_numero', 'activo', 'creado_en', 'contrato_activo')


class AnexoContratoSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnexoContrato
        fields = [
            'id', 'contrato', 'titulo', 'descripcion',
            'clausulas_modificadas', 'fecha_emision',
            'archivo_pdf', 'creado_en',
        ]
        read_only_fields = ('id', 'archivo_pdf', 'creado_en')


class DocumentoLegalSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentoLegal
        fields = [
            'id', 'empleado', 'tipo', 'fecha_emision',
            'causal_legal', 'hechos', 'aviso_previo_pagado',
            'archivo_pdf', 'creado_en',
        ]
        read_only_fields = ('id', 'archivo_pdf', 'creado_en')


class LiquidacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Liquidacion
        fields = [
            'id', 'empleado', 'mes', 'anio',
            'dias_trabajados', 'dias_licencia', 'dias_ausencia', 'dias_no_contratados',
            'sueldo_base', 'gratificacion',
            'detalle_haberes_imponibles', 'detalle_horas_extras', 'detalle_haberes_no_imponibles',
            'afp_nombre', 'afp_monto',
            'salud_nombre', 'isapre_cotizacion_uf', 'salud_monto',
            'seguro_cesantia', 'impuesto_unico',
            'anticipo_quincena', 'detalle_otros_descuentos',
            'total_imponible', 'total_haberes', 'total_descuentos', 'sueldo_liquido',
            'archivo_pdf', 'fecha_emision',
        ]
        read_only_fields = (
            'id',
            'total_imponible', 'total_haberes', 'total_descuentos', 'sueldo_liquido',
            'archivo_pdf', 'fecha_emision',
        )


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ['id', 'nombre', 'descripcion', 'precio', 'max_empresas', 'limite_trabajadores', 'activo']
        read_only_fields = ('id', 'nombre', 'descripcion', 'precio', 'max_empresas', 'limite_trabajadores', 'activo')


class SolicitudFirmaSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.SerializerMethodField()
    empresa_nombre  = serializers.SerializerMethodField()

    def get_empleado_nombre(self, obj):
        return f"{obj.empleado.nombres} {obj.empleado.apellido_paterno}"

    def get_empresa_nombre(self, obj):
        return obj.empresa.nombre_legal

    class Meta:
        model = SolicitudFirma
        fields = [
            'id', 'empleado', 'empresa', 'contrato', 'documento_legal',
            'tipo_documento', 'token', 'estado',
            'email_firmante', 'ip_firmante',
            'enviado_en', 'firmado_en', 'expira_en',
            'empleado_nombre', 'empresa_nombre',
        ]
        read_only_fields = (
            'id', 'token', 'estado', 'email_firmante', 'ip_firmante',
            'enviado_en', 'firmado_en', 'expira_en',
            'empleado_nombre', 'empresa_nombre',
        )


class CustomPasswordResetSerializer(PasswordResetSerializer):
    def get_email_options(self):
        return {
            'html_email_template_name': 'registration/password_reset_email.html',
            'email_template_name': 'registration/password_reset_email.txt',
        }
