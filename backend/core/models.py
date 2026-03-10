from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Plan(models.Model):
    nombre = models.CharField(max_length=50) 
    descripcion = models.TextField(blank=True, null=True)
    precio = models.IntegerField(default=0) 
    max_empresas = models.IntegerField(default=1)
    limite_trabajadores = models.IntegerField(default=3) # Ajustado al nombre que usa views.py
    activo = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nombre} ({self.limite_trabajadores} trab.) - ${self.precio}"


class Cliente(models.Model):
    TIPO_CLIENTE_CHOICES = [
        ('PERSONA', 'Persona Natural'),
        ('EMPRESA', 'Empresa (Persona Jurídica)'),
    ]
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil_cliente')
    plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True, blank=True)
    tipo_cliente = models.CharField(max_length=20, choices=TIPO_CLIENTE_CHOICES, default='PERSONA')
    rut = models.CharField(max_length=20, unique=True)
    nombres = models.CharField(max_length=100)
    apellido_paterno = models.CharField(max_length=100, blank=True, null=True)
    apellido_materno = models.CharField(max_length=100, blank=True, null=True)
    razon_social = models.CharField(max_length=255, blank=True, null=True)
    direccion = models.CharField(max_length=255, blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.tipo_cliente == 'EMPRESA' and self.razon_social:
            return f"{self.razon_social} ({self.plan})"
        return f"{self.nombres} {self.apellido_paterno} ({self.plan})"


class Empresa(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='empresas')
    nombre_legal = models.CharField(max_length=255)
    rut = models.CharField(max_length=20, unique=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    alias = models.CharField(max_length=100, blank=True, null=True) 
    giro = models.CharField(max_length=200, blank=True, null=True)
    direccion = models.CharField(max_length=255, blank=True, null=True)
    comuna = models.CharField(max_length=100, blank=True, null=True)
    ciudad = models.CharField(max_length=100, blank=True, null=True)
    sucursal = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        unique_together = ['rut', 'owner']
        
    def __str__(self):
        return self.nombre_legal


class Empleado(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='empleados')
    rut = models.CharField(max_length=20)
    nombres = models.CharField(max_length=100)
    apellido_paterno = models.CharField(max_length=100)
    apellido_materno = models.CharField(max_length=100, blank=True, null=True)
    sexo = models.CharField(max_length=20, choices=[('M', 'Masculino'), ('F', 'Femenino'), ('O', 'Otro')], blank=True, null=True)
    fecha_nacimiento = models.DateField(null=True, blank=True) 
    nacionalidad = models.CharField(max_length=50, default="Chilena")
    estado_civil = models.CharField(max_length=50, blank=True, null=True)
    direccion = models.CharField(max_length=255, blank=True, null=True) 
    comuna = models.CharField(max_length=100, blank=True, null=True) 
    numero_telefono = models.CharField(max_length=20, blank=True, null=True)
    departamento = models.CharField(max_length=100, blank=True, null=True)
    cargo = models.CharField(max_length=100)
    sucursal = models.CharField(max_length=100, blank=True, null=True)
    horas_laborales = models.IntegerField(default=40) 
    modalidad = models.CharField(max_length=20, choices=[('PRESENCIAL', 'Presencial'), ('REMOTO', 'Remoto'), ('HIBRIDO', 'Híbrido')], default='PRESENCIAL')
    sueldo_base = models.IntegerField(default=0)
    afp = models.CharField(max_length=50, blank=True, null=True)
    sistema_salud = models.CharField(max_length=50, choices=[('FONASA', 'Fonasa'), ('ISAPRE', 'Isapre')], blank=True, null=True)
    fecha_ingreso = models.DateField()
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.nombres} {self.apellido_paterno}"


# ==========================================
# 3. CONTRATO (El núcleo Legal del SaaS)
# ==========================================
class Contrato(models.Model):
    TIPO_CONTRATO_CHOICES = [
        ('INDEFINIDO', 'Indefinido'),
        ('PLAZO_FIJO', 'Plazo Fijo'),
        ('OBRA_FAENA', 'Por Obra o Faena'),
    ]

    TIPO_JORNADA_CHOICES = [
        ('ORDINARIA', 'Ordinaria (Lunes a Viernes/Sábado)'),
        ('TURNOS', 'Turnos Rotativos'),
        ('BISMANAL', 'Bismanal'),
        ('ART_22', 'Artículo 22 (Sin límite de horario)'),
        ('PARCIAL', 'Part-Time'),
        ('OTRO', 'Otra (Jornada Personalizada)'),
    ]

    empleado = models.OneToOneField(Empleado, on_delete=models.CASCADE, related_name='contrato_activo')
    
    # 1. Datos Claves del Contrato
    tipo_contrato = models.CharField(max_length=20, choices=TIPO_CONTRATO_CHOICES, default='INDEFINIDO')
    cargo = models.CharField(max_length=100, default="No especificado")
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    sueldo_base = models.IntegerField()
    
    # 2. Datos de la Ley 40 Horas y Jornadas
    tipo_jornada = models.CharField(max_length=20, choices=TIPO_JORNADA_CHOICES, default='ORDINARIA')
    horas_semanales = models.DecimalField(max_digits=3, decimal_places=1, default=44.0)
    distribucion_dias = models.IntegerField(default=5)
    
    # NUEVO: Matriz de Horarios en JSON y colación
    distribucion_horario = models.JSONField(default=dict, blank=True, null=True) 
    
    # 3. Variables Financieras (Quincena, Día de pago y Gratificación)
    dia_pago = models.IntegerField(default=5)
    gratificacion_legal = models.CharField(max_length=20, choices=[('MENSUAL', 'Mensual (Art. 50)'), ('ANUAL', 'Anual (Art. 47)')], default='MENSUAL')
    tiene_quincena = models.BooleanField(default=False)
    dia_quincena = models.IntegerField(null=True, blank=True)
    monto_quincena = models.IntegerField(null=True, blank=True)
    
    # 4. Arreglos Dinámicos (Listas en vez de texto plano)
    jornada_personalizada = models.TextField(blank=True, null=True)
    funciones_especificas = models.JSONField(default=list, blank=True, null=True)
    clausulas_especiales = models.JSONField(default=list, blank=True, null=True)

    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Contrato {self.tipo_contrato} - {self.empleado} - {self.horas_semanales}h"