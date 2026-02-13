from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

# 1. EMPRESA (El Cliente del SaaS)
class Empresa(models.Model):
    # Relación con el usuario que se registra (Dueño de la cuenta)
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name='empresa')
    
    nombre_legal = models.CharField(max_length=255)
    rut = models.CharField(max_length=20, unique=True, help_text="RUT de la empresa sin puntos")
    direccion = models.CharField(max_length=255, blank=True)
    giro = models.CharField(max_length=255, blank=True)
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nombre_legal

# 2. EMPLEADO (El recurso humano)
class Empleado(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='empleados')
    
    rut = models.CharField(max_length=20, help_text="RUT personal")
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    email = models.EmailField(blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True)
    cargo = models.CharField(max_length=100)
    
    fecha_ingreso = models.DateField()
    activo = models.BooleanField(default=True)

    class Meta:
        # Evitar duplicados de RUT dentro de la misma empresa
        unique_together = ['empresa', 'rut']

    def __str__(self):
        return f"{self.nombres} {self.apellidos}"

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