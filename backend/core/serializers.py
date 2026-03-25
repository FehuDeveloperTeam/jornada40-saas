from rest_framework import serializers
from .models import Empresa, Empleado, Contrato, DocumentoLegal, Liquidacion, Plan, Suscripcion
from dj_rest_auth.serializers import PasswordResetSerializer

class EmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = '__all__'
        read_only_fields = ('owner',) # El dueño se asigna automático

class ContratoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contrato
        fields = '__all__'

class EmpleadoSerializer(serializers.ModelSerializer):
    # Incluimos el contrato anidado para facilitar la lectura en el frontend
    contrato_activo = ContratoSerializer(read_only=True)
    
    class Meta:
        model = Empleado
        fields = '__all__'

class DocumentoLegalSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentoLegal
        fields = '__all__'

class LiquidacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Liquidacion
        fields = '__all__'

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = '__all__'

class CustomPasswordResetSerializer(PasswordResetSerializer):
    def get_email_options(self):
        return {
            
            'html_email_template_name': 'registration/password_reset_email.html',
            
            'email_template_name': 'registration/password_reset_email.txt',
        }
        