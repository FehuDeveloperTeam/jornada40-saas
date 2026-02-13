from rest_framework import serializers
from .models import Empresa, Empleado, Contrato

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