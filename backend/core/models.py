import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Max
from django.core.validators import MinValueValidator, MaxValueValidator

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
    correo=models.EmailField(max_length=255, null=True, blank=True, verbose_name='Correo Electrónico')

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
    representante_legal = models.CharField(max_length=200, blank=True, null=True)
    rut_representante = models.CharField(max_length=20, blank=True, null=True)
    activo = models.BooleanField(default=True)

    # --- FIRMA ELECTRÓNICA DEL REPRESENTANTE LEGAL ---
    firma_imagen          = models.TextField(blank=True, default='')   # base64 PNG del canvas
    firma_firmante_nombre = models.CharField(max_length=200, blank=True, default='')
    firma_firmante_cargo  = models.CharField(max_length=200, blank=True, default='')
    firma_configurada_en  = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.nombre_legal} ({self.rut})"


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
    email = models.EmailField(blank=True, null=True)
    departamento = models.CharField(max_length=100, blank=True, null=True)
    cargo = models.CharField(max_length=100)
    sucursal = models.CharField(max_length=100, blank=True, null=True)
    horas_laborales = models.IntegerField(
        default=40,
        validators=[MinValueValidator(1), MaxValueValidator(168)]
    )
    modalidad = models.CharField(max_length=20, choices=[('PRESENCIAL', 'Presencial'), ('REMOTO', 'Remoto'), ('HIBRIDO', 'Híbrido')], default='PRESENCIAL')
    sueldo_base = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    afp = models.CharField(max_length=50, blank=True, null=True)
    sistema_salud = models.CharField(max_length=50, choices=[('FONASA', 'Fonasa'), ('ISAPRE', 'Isapre')], blank=True, null=True)
    fecha_ingreso = models.DateField()
    # --- DATOS CORPORATIVOS AVANZADOS ---
    centro_costo = models.CharField(max_length=100, blank=True, null=True)
    ficha_numero = models.PositiveIntegerField(blank=True, null=True, verbose_name='Número de Ficha')
    
    # --- DATOS BANCARIOS ---
    forma_pago = models.CharField(max_length=50, default='Transferencia') # Depósito, Efectivo, Cheque
    banco = models.CharField(max_length=50, blank=True, null=True)
    tipo_cuenta = models.CharField(max_length=50, blank=True, null=True)
    numero_cuenta = models.CharField(max_length=50, blank=True, null=True)
    
    # --- PLAN ISAPRE ---
    plan_isapre_uf = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.nombres} {self.apellido_paterno}"
    def save(self, *args, **kwargs):
        # Solo calculamos la ficha si el empleado es nuevo (no tiene ficha aún)
        if not self.ficha_numero:
            # Buscamos cuál es el número de ficha más alto DENTRO de esta empresa específica
            max_ficha = Empleado.objects.filter(empresa=self.empresa).aggregate(Max('ficha_numero'))['ficha_numero__max']
            
            # Si ya hay empleados, le sumamos 1 al número mayor. Si es el primero, le ponemos 1.
            if max_ficha is not None:
                self.ficha_numero = max_ficha + 1
            else:
                self.ficha_numero = 1
                
        # Finalmente, ejecutamos el guardado normal de Django
        super(Empleado, self).save(*args, **kwargs)

    class Meta:
        unique_together = [('empresa', 'rut')]


# ==========================================
# 3. CONTRATO
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
    sueldo_base = models.IntegerField(validators=[MinValueValidator(0)])

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

    # Archivos Físicos Persistentes
    archivo_contrato = models.FileField(upload_to='contratos/', null=True, blank=True)
    archivo_anexo_40h = models.FileField(upload_to='anexos/', null=True, blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Contrato {self.tipo_contrato} - {self.empleado} - {self.horas_semanales}h"

# ==========================================
# 3b. ANEXOS DE CONTRATO (Modificaciones contractuales)
# ==========================================
class AnexoContrato(models.Model):
    contrato = models.ForeignKey(Contrato, on_delete=models.CASCADE, related_name='anexos')
    titulo = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    clausulas_modificadas = models.JSONField(default=list, blank=True)
    fecha_emision = models.DateField()
    archivo_pdf = models.FileField(upload_to='anexos_contrato/', null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Anexo: {self.titulo} — {self.contrato.empleado} ({self.fecha_emision})"

# ==========================================
# 4. HISTORIAL LEGAL (Amonestaciones y Despidos)
# ==========================================
class DocumentoLegal(models.Model):
    TIPO_DOCUMENTO_CHOICES = [
        ('AMONESTACION', 'Carta de Amonestación'),
        ('DESPIDO', 'Carta de Término de Contrato (Despido)'),
        ('MUTUO_ACUERDO', 'Renuncia / Mutuo Acuerdo'),
        ('CONSTANCIA', 'Constancia Laboral'),
    ]

    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name='documentos_legales')
    tipo = models.CharField(max_length=20, choices=TIPO_DOCUMENTO_CHOICES)
    fecha_emision = models.DateField()
    
    # Causal legal invocada (Ej: "Artículo 160 N°3 del Código del Trabajo")
    causal_legal = models.CharField(max_length=255, blank=True, null=True) 
    
    # Descripción detallada de los hechos que motivan la carta
    hechos = models.TextField()
    
    # Para cartas de despido: indicar si se pagan o no los días de aviso previo
    aviso_previo_pagado = models.BooleanField(default=False)

    archivo_pdf = models.FileField(upload_to='documentos_legales/', null=True, blank=True)
    
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.empleado.rut} ({self.fecha_emision})"

# ==========================================
# 5. LIQUIDACIONES DE SUELDO (Remuneraciones)
# ==========================================
class Liquidacion(models.Model):
    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name='liquidaciones')
    mes = models.IntegerField()
    anio = models.IntegerField()
    
    # --- ASISTENCIA DETALLADA ---
    dias_trabajados = models.IntegerField(default=30, validators=[MinValueValidator(0), MaxValueValidator(31)])
    dias_licencia = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(31)])
    dias_ausencia = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(31)])
    dias_no_contratados = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(31)])
    
    # --- HABERES ---
    sueldo_base = models.IntegerField(default=0)
    gratificacion = models.IntegerField(default=0)
    detalle_haberes_imponibles = models.JSONField(default=list, blank=True)
    detalle_horas_extras = models.JSONField(default=list, blank=True)
    detalle_haberes_no_imponibles = models.JSONField(default=list, blank=True)
    
    # --- DESCUENTOS PREVISIONALES ---
    afp_nombre = models.CharField(max_length=50, blank=True, null=True)
    afp_monto = models.IntegerField(default=0)
    
    salud_nombre = models.CharField(max_length=50, blank=True, null=True)
    isapre_cotizacion_uf = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    salud_monto = models.IntegerField(default=0)
    
    seguro_cesantia = models.IntegerField(default=0)
    impuesto_unico = models.IntegerField(default=0)
    
    # --- OTROS DESCUENTOS ---
    anticipo_quincena = models.IntegerField(default=0)
    detalle_otros_descuentos = models.JSONField(default=list, blank=True)
    
    # --- TOTALES MATEMÁTICOS ---
    total_imponible = models.IntegerField(default=0)
    total_haberes = models.IntegerField(default=0)
    total_descuentos = models.IntegerField(default=0)
    sueldo_liquido = models.IntegerField(default=0)
    
    archivo_pdf = models.FileField(upload_to='liquidaciones/', null=True, blank=True)

    fecha_emision = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = ('empleado', 'mes', 'anio')

    def __str__(self):
        return f"Liquidación {self.mes}/{self.anio} - {self.empleado.rut}"

class Suscripcion(models.Model):
    ESTADOS_SUSCRIPCION = [
        ('TRIAL', 'Período de Prueba'),
        ('ACTIVE', 'Activa'),
        ('PAST_DUE', 'Pago Pendiente / Moroso'),
        ('CANCELED', 'Cancelada'),
    ]

    cliente = models.OneToOneField(Cliente, on_delete=models.CASCADE, related_name='suscripcion_activa')
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT) # PROTECT evita borrar planes en uso
    
    # Ciclo de vida
    estado = models.CharField(max_length=20, choices=ESTADOS_SUSCRIPCION, default='TRIAL')
    fecha_inicio = models.DateTimeField(auto_now_add=True)
    fecha_proximo_cobro = models.DateTimeField(null=True, blank=True)
    fecha_cancelacion = models.DateTimeField(null=True, blank=True)
    
    # Pasarela de Pagos (Mercado Pago / Stripe / Fintoc)
    gateway_customer_id = models.CharField(max_length=100, blank=True, null=True, help_text="ID del cliente en la pasarela")
    gateway_subscription_id = models.CharField(max_length=100, blank=True, null=True, help_text="ID de la suscripción/tarjeta")
    metodo_pago_glosa = models.CharField(max_length=50, blank=True, null=True, help_text="Ej: Visa terminada en 4242 o Fintoc Banco de Chile")

    def __str__(self):
        return f"{self.cliente.rut} - {self.plan.nombre} ({self.estado})"
    
    @property
    def is_active(self):
        return self.estado in ['ACTIVE', 'TRIAL']


# ==========================================
# 7. FIRMA ELECTRÓNICA
# ==========================================

class SolicitudFirma(models.Model):
    ESTADOS = [
        ('PENDIENTE',  'Pendiente de firma'),
        ('FIRMADO',    'Firmado'),
        ('RECHAZADO',  'Rechazado por el trabajador'),
        ('EXPIRADO',   'Plazo vencido'),
        ('CANCELADO',  'Cancelado por el empleador'),
    ]
    TIPOS_DOCUMENTO = [
        ('CONTRATO',        'Contrato Laboral'),
        ('ANEXO_40H',       'Anexo Ley 40 Horas'),
        ('AMONESTACION',    'Carta de Amonestación'),
        ('DESPIDO',         'Carta de Despido'),
        ('CONSTANCIA',      'Constancia Laboral'),
        ('ANEXO_CONTRATO',  'Anexo de Contrato'),
    ]

    empleado         = models.ForeignKey('Empleado',      on_delete=models.CASCADE,    related_name='solicitudes_firma')
    empresa          = models.ForeignKey('Empresa',       on_delete=models.CASCADE,    related_name='solicitudes_firma')
    contrato         = models.ForeignKey('Contrato',      on_delete=models.SET_NULL,   null=True, blank=True)
    documento_legal  = models.ForeignKey('DocumentoLegal', on_delete=models.SET_NULL,  null=True, blank=True)

    tipo_documento   = models.CharField(max_length=20, choices=TIPOS_DOCUMENTO)
    token            = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    estado           = models.CharField(max_length=12, choices=ESTADOS, default='PENDIENTE')

    b2_key_temporal  = models.CharField(max_length=500, blank=True, default='')
    b2_key_firmado   = models.CharField(max_length=500, blank=True, default='')

    firma_trabajador_imagen = models.TextField(blank=True, default='')  # base64 PNG
    ip_firmante      = models.GenericIPAddressField(null=True, blank=True)
    email_firmante   = models.EmailField(blank=True, default='')

    enviado_en       = models.DateTimeField(auto_now_add=True)
    firmado_en       = models.DateTimeField(null=True, blank=True)
    expira_en        = models.DateTimeField()

    creado_en        = models.DateTimeField(auto_now_add=True)
    actualizado_en   = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.expira_en:
            self.expira_en = timezone.now() + timezone.timedelta(days=7)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.tipo_documento} — {self.empleado} [{self.estado}]"

    class Meta:
        ordering = ['-enviado_en']


class OTPFirma(models.Model):
    solicitud     = models.ForeignKey(SolicitudFirma, on_delete=models.CASCADE, related_name='otps')
    codigo        = models.CharField(max_length=6)
    email_destino = models.EmailField()
    creado_en     = models.DateTimeField(auto_now_add=True)
    expira_en     = models.DateTimeField()
    verificado    = models.BooleanField(default=False)
    intentos      = models.PositiveSmallIntegerField(default=0)

    def save(self, *args, **kwargs):
        if not self.expira_en:
            self.expira_en = timezone.now() + timezone.timedelta(minutes=10)
        super().save(*args, **kwargs)

    @property
    def es_valido(self):
        return (
            not self.verificado
            and self.intentos < 3
            and timezone.now() < self.expira_en
        )

    def __str__(self):
        return f"OTP {self.solicitud_id} — {'✓' if self.verificado else '⏳'}"