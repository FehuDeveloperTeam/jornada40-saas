from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

# 1. EMPRESA (El Cliente del SaaS)
class Empresa(models.Model):
    # ForeignKey permite que un User tenga infinitas Empresas
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='empresas')
    nombre_legal = models.CharField(max_length=255)
    rut = models.CharField(max_length=20, unique=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    alias = models.CharField(max_length=100, blank=True, null=True) # Nombre de fantasía
    giro = models.CharField(max_length=200, blank=True, null=True)
    direccion = models.CharField(max_length=255, blank=True, null=True)
    comuna = models.CharField(max_length=100, blank=True, null=True)
    ciudad = models.CharField(max_length=100, blank=True, null=True)
    sucursal = models.CharField(max_length=100, blank=True, null=True)

# 2. EMPLEADO (El recurso humano)
class Empleado(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='empleados')
    rut = models.CharField(max_length=20)
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    
    # --- NUEVOS CAMPOS PARA GRAFICAR ---
    sexo = models.CharField(max_length=20, choices=[('M', 'Masculino'), ('F', 'Femenino'), ('O', 'Otro')], blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True) # Para calcular el rango de edad
    nacionalidad = models.CharField(max_length=50, default="Chilena")
    estado_civil = models.CharField(max_length=50, blank=True)
    comuna = models.CharField(max_length=100, blank=True) # Ubicación
    
    # Datos Laborales
    departamento = models.CharField(max_length=100, blank=True)
    cargo = models.CharField(max_length=100)
    sucursal = models.CharField(max_length=100, blank=True)
    modalidad = models.CharField(max_length=20, choices=[('PRESENCIAL', 'Presencial'), ('REMOTO', 'Remoto'), ('HIBRIDO', 'Híbrido')], default='PRESENCIAL')
    
    # Previsión y Sueldo
    sueldo_base = models.IntegerField(default=0)
    afp = models.CharField(max_length=50, blank=True)
    sistema_salud = models.CharField(max_length=50, choices=[('FONASA', 'Fonasa'), ('ISAPRE', 'Isapre')], blank=True)
    
    # Estados
    fecha_ingreso = models.DateField()
    activo = models.BooleanField(default=True)

# 3. CONTRATO (El núcleo de la Ley 40h)
class Contrato(models.Model):
    TIPO_JORNADA = [
        ('ORDINARIA', 'Ordinaria (Lunes a Viernes/Sábado)'),
        ('BISMANAL', 'Bismanal'),
        ('ART_22', 'Artículo 22 (Sin horario)'),
        ('PARCIAL', 'Part-Time'),
    ]

    empleado = models.OneToOneField(Empleado, on_delete=models.CASCADE, related_name='contrato_activo')
    
    # Datos de la Ley 40 Horas
    horas_semanales = models.DecimalField(max_digits=3, decimal_places=1, default=44.0, help_text="Ej: 40.0, 44.0, 45.0")
    distribucion_dias = models.IntegerField(default=5, help_text="Días de trabajo a la semana (Ej: 5 o 6)")
    
    tipo_jornada = models.CharField(max_length=20, choices=TIPO_JORNADA, default='ORDINARIA')
    sueldo_base = models.IntegerField()
    
    tiene_colacion_imputable = models.BooleanField(default=False, help_text="¿El tiempo de colación es parte de la jornada?")
    
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Contrato de {self.empleado} - {self.horas_semanales}h"
