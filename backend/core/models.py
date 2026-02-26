from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Plan(models.Model):
    nombre = models.CharField(max_length=50) # Ej: "Gratis", "Pyme", "Corporativo"
    descripcion = models.TextField(blank=True, null=True)
    precio = models.IntegerField(default=0) # Precio mensual en CLP
    
    # Aquí están los límites mágicos
    max_empresas = models.IntegerField(default=1)
    max_empleados = models.IntegerField(default=3)
    
    activo = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nombre} ({self.max_empleados} trab.) - ${self.precio}"


# ==========================================
# 2. TABLA DE CLIENTES (Datos de facturación y perfil)
# ==========================================
class Cliente(models.Model):
    TIPO_CLIENTE_CHOICES = [
        ('PERSONA', 'Persona Natural'),
        ('EMPRESA', 'Empresa (Persona Jurídica)'),
    ]
    
    # Relación 1 a 1 con el usuario de Django (el que hace Login)
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil_cliente')
    
    # Relación con el Plan que contrató
    plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True, blank=True)
    
    tipo_cliente = models.CharField(max_length=20, choices=TIPO_CLIENTE_CHOICES, default='PERSONA')
    rut = models.CharField(max_length=20, unique=True)
    
    # --- DATOS PERSONALES (Si es Persona Natural) ---
    nombres = models.CharField(max_length=100)
    apellido_paterno = models.CharField(max_length=100, blank=True, null=True)
    apellido_materno = models.CharField(max_length=100, blank=True, null=True)
    
    # --- DATOS COMERCIALES (Si es Empresa) ---
    razon_social = models.CharField(max_length=255, blank=True, null=True)
    direccion = models.CharField(max_length=255, blank=True, null=True)
    
    # --- CONTACTO ---
    telefono = models.CharField(max_length=20, blank=True, null=True)
    # Nota: El correo ya viene incluido en el modelo 'usuario' (User) de Django.
    
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.tipo_cliente == 'EMPRESA' and self.razon_social:
            return f"{self.razon_social} ({self.plan})"
        return f"{self.nombres} {self.apellido_paterno} ({self.plan})"

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
    def __str__(self):
        return self.nombre_legal

# 2. EMPLEADO (El recurso humano)
class Empleado(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='empleados')
    rut = models.CharField(max_length=20)
    nombres = models.CharField(max_length=100)
    
    # --- APELLIDOS SEPARADOS ---
    apellido_paterno = models.CharField(max_length=100)
    apellido_materno = models.CharField(max_length=100, blank=True, null=True)
    
    # --- DATOS PERSONALES ---
    sexo = models.CharField(max_length=20, choices=[('M', 'Masculino'), ('F', 'Femenino'), ('O', 'Otro')], blank=True, null=True)
    fecha_nacimiento = models.DateField(null=True, blank=True) 
    nacionalidad = models.CharField(max_length=50, default="Chilena")
    estado_civil = models.CharField(max_length=50, blank=True, null=True)
    direccion = models.CharField(max_length=255, blank=True, null=True) # NUEVO
    comuna = models.CharField(max_length=100, blank=True, null=True) 
    numero_telefono = models.CharField(max_length=20, blank=True, null=True)
    
    # --- DATOS LABORALES ---
    departamento = models.CharField(max_length=100, blank=True, null=True)
    cargo = models.CharField(max_length=100)
    sucursal = models.CharField(max_length=100, blank=True, null=True)
    horas_laborales = models.IntegerField(default=40) # NUEVO (Ej: 40, 44, 45)
    modalidad = models.CharField(max_length=20, choices=[('PRESENCIAL', 'Presencial'), ('REMOTO', 'Remoto'), ('HIBRIDO', 'Híbrido')], default='PRESENCIAL')
    
    # --- PREVISIÓN Y SUELDO ---
    sueldo_base = models.IntegerField(default=0)
    afp = models.CharField(max_length=50, blank=True, null=True)
    sistema_salud = models.CharField(max_length=50, choices=[('FONASA', 'Fonasa'), ('ISAPRE', 'Isapre')], blank=True, null=True)
    
    # --- ESTADOS Y TRAZABILIDAD ---
    fecha_ingreso = models.DateField()
    activo = models.BooleanField(default=True)
    
    # NUEVO: Registro interno automático (No se muestra en el form, se llena solo)
    creado_en = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.nombres} {self.apellido_paterno}"

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
