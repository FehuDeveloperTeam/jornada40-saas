import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Max
from django.core.validators import MinValueValidator, MaxValueValidator

from .jornada import jornada_maxima_por_defecto, jornada_maxima_vigente

class Plan(models.Model):
    nombre = models.CharField(max_length=50)
    descripcion = models.TextField(blank=True, null=True)
    precio = models.IntegerField(default=0)
    max_empresas = models.IntegerField(default=1)
    limite_trabajadores = models.IntegerField(default=5)
    # Nivel de plan: 1=Semilla, 2=Starter, 3=Pyme, 4=Corporativo
    # Controla qué features están disponibles (finiquitos, vacaciones, Previred, ZIP, etc.)
    nivel = models.IntegerField(default=1)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nombre} ({self.limite_trabajadores} trab.) - ${self.precio}"


class ParametroPrevisional(models.Model):
    """Parámetros legales del sistema previsional chileno, versionados por período.

    Cambian por ley (topes imponibles y sueldo mínimo se reajustan todos los
    años). Al vivir en BD, recalcular una liquidación antigua usa los valores
    que regían en su período y actualizarlos no requiere un despliegue.
    """
    vigente_desde = models.DateField(unique=True, help_text='Primer día del período en que rigen estos valores.')

    # Topes imponibles expresados en UF (los fija la Superintendencia de Pensiones)
    tope_imponible_afp_uf = models.DecimalField(max_digits=6, decimal_places=2, default=87.80)
    tope_imponible_afc_uf = models.DecimalField(max_digits=6, decimal_places=2, default=131.90)

    # Base del tope de gratificación: 4,75 ingresos mínimos mensuales al año
    ingreso_minimo_mensual = models.IntegerField(default=529000)
    factor_gratificacion = models.DecimalField(max_digits=4, decimal_places=2, default=4.75)

    # Tasas de cotización
    tasa_salud = models.DecimalField(max_digits=6, decimal_places=5, default=0.07)
    tasa_afc_trabajador_indefinido = models.DecimalField(max_digits=6, decimal_places=5, default=0.006)
    tasa_afc_empleador_indefinido = models.DecimalField(max_digits=6, decimal_places=5, default=0.024)
    tasa_afc_empleador_plazo = models.DecimalField(max_digits=6, decimal_places=5, default=0.03)
    tasa_sis = models.DecimalField(max_digits=6, decimal_places=5, default=0.0149)
    tasa_mutual_base = models.DecimalField(max_digits=6, decimal_places=5, default=0.0093)
    tasa_expectativa_vida = models.DecimalField(max_digits=6, decimal_places=5, default=0.0072)
    # Reforma de pensiones (Ley 21.735), cargo del empleador. Los informa
    # Previred cada mes en "Seguro Social" y en "Tasa Cotización AFP".
    tasa_rentabilidad_protegida = models.DecimalField(max_digits=6, decimal_places=5, default=0.009)
    tasa_afp_empleador = models.DecimalField(max_digits=6, decimal_places=5, default=0.001)
    # Seguro de cesantía desde el año 11 de un contrato indefinido: el
    # trabajador deja de cotizar y el empleador paga esta tasa (Ley 19.728).
    tasa_afc_empleador_11_anios = models.DecimalField(max_digits=6, decimal_places=5, default=0.008)

    ORIGEN_CHOICES = [
        ('MANUAL', 'Carga manual'),
        ('PREVIRED', 'Propuesta leída de Previred'),
    ]
    # Una propuesta automática NO entra al cálculo hasta que alguien la
    # confirma: leer mal un tope y aplicarlo en silencio es peor que quedarse
    # con el valor anterior. Las cargas manuales sí rigen de inmediato.
    origen = models.CharField(max_length=10, choices=ORIGEN_CHOICES, default='MANUAL')
    confirmado = models.BooleanField(default=False)
    notas = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-vigente_desde']
        verbose_name = 'Parámetro previsional'
        verbose_name_plural = 'Parámetros previsionales'

    @property
    def rige(self) -> bool:
        """Si estos valores se usan en el cálculo o son solo una propuesta."""
        return self.confirmado or self.origen != 'PREVIRED'

    def __str__(self):
        estado = '' if self.confirmado else ' (por confirmar)'
        return f"Parámetros desde {self.vigente_desde}{estado}"


class TasaAFP(models.Model):
    """Tasa de cotización de cada AFP, versionada por período."""
    nombre = models.CharField(max_length=50)
    tasa = models.DecimalField(max_digits=6, decimal_places=5)
    vigente_desde = models.DateField()

    # Mismo criterio que ParametroPrevisional: una propuesta automática no
    # entra al cálculo mientras no la confirme una persona.
    origen = models.CharField(max_length=10, default='MANUAL',
                              choices=ParametroPrevisional.ORIGEN_CHOICES)
    confirmado = models.BooleanField(default=True)

    class Meta:
        unique_together = ('nombre', 'vigente_desde')
        ordering = ['-vigente_desde', 'nombre']
        verbose_name = 'Tasa AFP'
        verbose_name_plural = 'Tasas AFP'

    def __str__(self):
        return f"{self.nombre} {self.tasa:.2%} desde {self.vigente_desde}"


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
    es_profesional_titulado = models.BooleanField(
        default=False,
        help_text="Gerente o profesional/técnico con título de educación superior — habilita el tope de 2 años en vez de 1 para contratos a plazo fijo (Art. 159 N°4 del Código del Trabajo)."
    )
    sueldo_base = models.IntegerField(validators=[MinValueValidator(0)])

    # 2. Datos de la Ley 40 Horas y Jornadas
    tipo_jornada = models.CharField(max_length=20, choices=TIPO_JORNADA_CHOICES, default='ORDINARIA')
    # El default es el máximo que rige al crear el contrato (antes era 44 fijo,
    # sobre el máximo legal desde el 26-04-2026).
    horas_semanales = models.DecimalField(max_digits=3, decimal_places=1, default=jornada_maxima_por_defecto)
    distribucion_dias = models.IntegerField(default=5)
    
    # NUEVO: Matriz de Horarios en JSON y colación
    distribucion_horario = models.JSONField(default=dict, blank=True, null=True) 
    
    # 3. Variables Financieras (Quincena, Día de pago y Gratificación)
    dia_pago = models.IntegerField(default=5)
    gratificacion_legal = models.CharField(max_length=20, choices=[('MENSUAL', 'Mensual (Art. 50)'), ('ANUAL', 'Anual (Art. 47)')], default='MENSUAL')
    tiene_quincena = models.BooleanField(default=False)
    dia_quincena = models.IntegerField(null=True, blank=True)
    monto_quincena = models.IntegerField(null=True, blank=True)

    # 3b. Comisiones (remuneración variable, Art. 45 semana corrida)
    es_comisionista = models.BooleanField(default=False)
    # [{"glosa": "Carrocería", "porcentaje": 0.5}, ...] — porcentaje sobre el monto vendido
    comisiones_config = models.JSONField(default=list, blank=True)

    # 4. Arreglos Dinámicos (Listas en vez de texto plano)
    jornada_personalizada = models.TextField(blank=True, null=True)
    funciones_especificas = models.JSONField(default=list, blank=True, null=True)
    clausulas_especiales = models.JSONField(default=list, blank=True, null=True)

    # Archivos Físicos Persistentes
    archivo_contrato = models.FileField(upload_to='contratos/', null=True, blank=True)
    archivo_anexo_40h = models.FileField(upload_to='anexos/', null=True, blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Una sola fuente de horas: el contrato. La ficha del trabajador
        # (horas_laborales) lo refleja, venga el cambio del formulario o de un
        # anexo firmado; si no, estadísticas y cálculos leían otra cifra.
        horas = int(float(self.horas_semanales or 0) + 0.5)
        if horas and self.empleado.horas_laborales != horas:
            Empleado.objects.filter(pk=self.empleado_id).update(horas_laborales=horas)
            self.empleado.horas_laborales = horas

    @property
    def horas_propuestas_anexo_40h(self):
        """Horas que propone el anexo de adecuación a la Ley 40 horas.

        El anexo repetía las horas del contrato: a un contrato de 44 h le
        generaba un anexo de "adecuación" que volvía a decir 44 h. Propone el
        máximo vigente si el contrato lo excede; si no, mantiene lo pactado.
        """
        maximo = jornada_maxima_vigente()
        horas = float(self.horas_semanales or 0)
        return f'{min(horas, maximo):g}'.replace('.', ',')

    def __str__(self):
        return f"Contrato {self.tipo_contrato} - {self.empleado} - {self.horas_semanales}h"

class ConceptoRemuneracion(models.Model):
    """Catálogo de haberes y descuentos que pueden aparecer en una liquidación.

    Reemplaza la glosa de texto libre. El punto no es cosmético: cada concepto
    tiene un tratamiento previsional y tributario distinto, y con texto libre
    el sistema no puede saber cuál es cuál. Eso es lo que permite clasificar
    correctamente lo imponible y, más adelante, emitir el Libro de
    Remuneraciones Electrónico, que exige cada partida mapeada a un código.

    Con empresa en null es un concepto del catálogo del sistema, disponible
    para todos. Con empresa, es propio de esa empresa.
    """
    TIPOS = [
        ('HABER_IMPONIBLE',    'Haber imponible'),
        ('HABER_NO_IMPONIBLE', 'Haber no imponible'),
        ('HORA_EXTRA',         'Hora extra'),
        ('COMISION',           'Comisión por venta'),
        ('DESCUENTO',          'Descuento'),
    ]

    # Naturaleza por defecto de cada tipo. Se aplica al crear un concepto
    # propio para que la empresa no tenga que decidir algo que fija la ley.
    NATURALEZA_POR_TIPO = {
        'HABER_IMPONIBLE':    dict(es_imponible=True,  es_tributable=True,
                                   afecta_gratificacion=True,  afecta_semana_corrida=False),
        'HABER_NO_IMPONIBLE': dict(es_imponible=False, es_tributable=False,
                                   afecta_gratificacion=False, afecta_semana_corrida=False),
        # Las horas extras quedan fuera de la semana corrida por el Art. 32
        # inciso final del Código del Trabajo.
        'HORA_EXTRA':         dict(es_imponible=True,  es_tributable=True,
                                   afecta_gratificacion=True,  afecta_semana_corrida=False),
        'COMISION':           dict(es_imponible=True,  es_tributable=True,
                                   afecta_gratificacion=True,  afecta_semana_corrida=True),
        'DESCUENTO':          dict(es_imponible=False, es_tributable=False,
                                   afecta_gratificacion=False, afecta_semana_corrida=False),
    }

    codigo = models.SlugField(max_length=40)
    nombre = models.CharField(max_length=100)
    tipo = models.CharField(max_length=20, choices=TIPOS)

    es_imponible = models.BooleanField(default=False)
    es_tributable = models.BooleanField(default=False)
    afecta_gratificacion = models.BooleanField(default=False)
    afecta_semana_corrida = models.BooleanField(default=False)

    # Columna del Libro de Remuneraciones Electrónico. Se completa al
    # implementar el LRE; hasta entonces queda vacío a propósito.
    codigo_lre = models.CharField(max_length=20, blank=True, default='')

    empresa = models.ForeignKey('Empresa', on_delete=models.CASCADE, null=True, blank=True,
                                related_name='conceptos_remuneracion')
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['tipo', 'nombre']
        verbose_name = 'Concepto de remuneración'
        verbose_name_plural = 'Conceptos de remuneración'
        constraints = [
            # En Postgres dos NULL se consideran distintos, así que el catálogo
            # del sistema necesita su propia restricción para no duplicarse.
            models.UniqueConstraint(
                fields=['codigo'], condition=models.Q(empresa__isnull=True),
                name='concepto_codigo_unico_en_sistema'),
            models.UniqueConstraint(
                fields=['empresa', 'codigo'], condition=models.Q(empresa__isnull=False),
                name='concepto_codigo_unico_por_empresa'),
        ]

    def __str__(self):
        ambito = self.empresa.nombre_legal if self.empresa else 'Sistema'
        return f"{self.nombre} ({self.get_tipo_display()}) — {ambito}"

    def save(self, *args, **kwargs):
        # La naturaleza previsional la fija el tipo, no el criterio de quien
        # crea el concepto: un bono nunca puede quedar como no imponible.
        # En los conceptos de una empresa se aplica en cada guardado (tampoco
        # se altera desde el admin). Solo los del sistema, que mantiene
        # Jornada40, pueden ajustarse en el admin para las excepciones que la
        # ley reconoce.
        if self._state.adding or self.empresa_id is not None:
            for campo, valor in self.NATURALEZA_POR_TIPO.get(self.tipo, {}).items():
                setattr(self, campo, valor)
        super().save(*args, **kwargs)


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

    # --- MODIFICACIÓN ESTRUCTURADA DEL CONTRATO (Art. 11 Código del Trabajo) ---
    # Los cambios se aplican al contrato recién cuando el trabajador firma el
    # anexo: una modificación no firmada no tiene efecto sobre la relación
    # laboral, y por lo tanto tampoco sobre las liquidaciones.
    # {"sueldo_base": 900000, "cargo": "Jefe de Área", "comisiones_config": [...]}
    cambios = models.JSONField(default=dict, blank=True)
    vigencia_desde = models.DateField(null=True, blank=True)
    aplicado = models.BooleanField(default=False)
    aplicado_en = models.DateTimeField(null=True, blank=True)

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

    CAUSAL_ARTICULO_CHOICES = [
        # Art. 159 — Causales objetivas
        ('159_1', 'Art. 159 N°1 — Mutuo acuerdo de las partes'),
        ('159_2', 'Art. 159 N°2 — Renuncia voluntaria del trabajador'),
        ('159_3', 'Art. 159 N°3 — Muerte del trabajador'),
        ('159_4', 'Art. 159 N°4 — Vencimiento del plazo convenido'),
        ('159_5', 'Art. 159 N°5 — Conclusión del trabajo o servicio'),
        ('159_6', 'Art. 159 N°6 — Caso fortuito o fuerza mayor'),
        # Art. 160 — Causales disciplinarias
        ('160_1a', 'Art. 160 N°1 a) — Falta de probidad'),
        ('160_1b', 'Art. 160 N°1 b) — Acoso sexual'),
        ('160_1c', 'Art. 160 N°1 c) — Vías de hecho contra empleador u otro trabajador'),
        ('160_1d', 'Art. 160 N°1 d) — Injurias al empleador'),
        ('160_1e', 'Art. 160 N°1 e) — Conducta inmoral grave'),
        ('160_1f', 'Art. 160 N°1 f) — Acoso laboral (mobbing)'),
        ('160_2',  'Art. 160 N°2 — Negociaciones prohibidas en el contrato'),
        ('160_3',  'Art. 160 N°3 — Inasistencias injustificadas'),
        ('160_4a', 'Art. 160 N°4 a) — Abandono: salida intempestiva'),
        ('160_4b', 'Art. 160 N°4 b) — Abandono: negativa injustificada a trabajar'),
        ('160_5',  'Art. 160 N°5 — Actos que afectan la seguridad'),
        ('160_6',  'Art. 160 N°6 — Daño material intencional'),
        ('160_7',  'Art. 160 N°7 — Incumplimiento grave del contrato'),
        # Art. 161 — Decisión del empleador
        ('161_1',  'Art. 161 inc. 1° — Necesidades de la empresa'),
        ('161_2',  'Art. 161 inc. 2° — Desahucio del empleador'),
        # Otros
        ('163bis', 'Art. 163 bis — Liquidación concursal del empleador'),
    ]

    MODALIDAD_FINIQUITO_CHOICES = [
        ('PRESENCIAL',  'Presencial ante ministro de fe'),
        ('ELECTRONICO', 'Electrónico (voluntario para el trabajador)'),
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

    # ── Campos específicos para Carta de Despido (tipo=DESPIDO) ──────────────
    causal_articulo        = models.CharField(max_length=20, choices=CAUSAL_ARTICULO_CHOICES,
                                              blank=True, null=True)
    fecha_ultimo_dia       = models.DateField(blank=True, null=True)
    cotizaciones_al_dia    = models.BooleanField(blank=True, null=True)
    aviso_previo_dias      = models.IntegerField(blank=True, null=True)
    monto_indemnizacion_anos        = models.IntegerField(blank=True, null=True)
    monto_indemnizacion_sustitutiva = models.IntegerField(blank=True, null=True)
    modalidad_finiquito    = models.CharField(max_length=15, choices=MODALIDAD_FINIQUITO_CHOICES,
                                              blank=True, null=True)
    copia_inspeccion_trabajo = models.BooleanField(blank=True, null=True)

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
    # Haberes y descuentos en una sola lista. Cada ítem lleva su naturaleza
    # congelada al emitir, así que agruparlos para el PDF o el Libro no
    # depende de cómo esté configurado el catálogo hoy:
    #   {"concepto": 12|null, "glosa": "...", "naturaleza": "HABER_IMPONIBLE",
    #    "valor": 0, "horas": .., "recargo": .., "monto_vendido": .., "porcentaje": ..}
    detalle_items = models.JSONField(default=list, blank=True)

    # Listas anteriores a la unificación. Ya no se escriben ni se leen; se
    # conservan un release como respaldo del traspaso.
    detalle_haberes_imponibles = models.JSONField(default=list, blank=True)
    detalle_horas_extras = models.JSONField(default=list, blank=True)
    detalle_haberes_no_imponibles = models.JSONField(default=list, blank=True)
    # [{"glosa": "Carrocería", "monto_vendido": 15000000, "porcentaje": 0.5, "valor": 75000}, ...]
    detalle_comisiones = models.JSONField(default=list, blank=True)
    # Art. 45 Código del Trabajo — promedio diario de comisiones x domingos y festivos del mes
    semana_corrida = models.IntegerField(default=0)

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
    
    # --- TÉRMINOS DEL CONTRATO CONGELADOS AL EMITIR ---
    # Se guardan para que recalcular una liquidación antigua use las condiciones
    # que estaban vigentes en su período, y no las del contrato de hoy.
    sueldo_base_contrato = models.IntegerField(default=0)
    # Base del valor de la hora extra: sueldo / 30 × 7 / horas semanales.
    horas_semanales_contrato = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    gratificacion_legal = models.CharField(max_length=20, blank=True, default='')
    tipo_contrato = models.CharField(max_length=20, blank=True, default='')
    # UF con la que se calcularon los topes imponibles y la Isapre de este
    # período. Se congela para que recalcular no use la UF de hoy.
    valor_uf = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # --- TOTALES MATEMÁTICOS ---
    total_imponible = models.IntegerField(default=0)
    total_haberes = models.IntegerField(default=0)
    total_descuentos = models.IntegerField(default=0)
    sueldo_liquido = models.IntegerField(default=0)
    
    archivo_pdf = models.FileField(upload_to='liquidaciones/', null=True, blank=True)

    fecha_emision = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = ('empleado', 'mes', 'anio')

    def items_de(self, naturaleza) -> list:
        """Ítems de una naturaleza, en el orden en que se registraron."""
        return [i for i in (self.detalle_items or []) if i.get('naturaleza') == naturaleza]

    @property
    def items_agrupados(self) -> dict:
        """Ítems separados por naturaleza, para el PDF y el Libro.

        La liquidación es un documento legal con un orden establecido —
        haberes imponibles, subtotal, no imponibles, subtotal, descuentos —
        así que la separación sigue existiendo al mostrarla aunque el
        almacenamiento sea una sola lista.
        """
        return {
            'imponibles':    self.items_de('HABER_IMPONIBLE'),
            'horas_extras':  self.items_de('HORA_EXTRA'),
            'comisiones':    self.items_de('COMISION'),
            'no_imponibles': self.items_de('HABER_NO_IMPONIBLE'),
            'descuentos':    self.items_de('DESCUENTO'),
        }

    def __str__(self):
        return f"Liquidación {self.mes}/{self.anio} - {self.empleado.rut}"

# ==========================================
# 6. FINIQUITO
# ==========================================
class Finiquito(models.Model):
    CAUSAL_ARTICULO_CHOICES = DocumentoLegal.CAUSAL_ARTICULO_CHOICES

    MODALIDAD_CHOICES = [
        ('PRESENCIAL',  'Presencial ante ministro de fe'),
        ('ELECTRONICO', 'Electrónico (voluntario para el trabajador)'),
    ]

    empleado         = models.ForeignKey(Empleado,       on_delete=models.CASCADE, related_name='finiquitos')
    documento_legal  = models.ForeignKey(DocumentoLegal, on_delete=models.SET_NULL, null=True, blank=True,
                                         related_name='finiquitos')

    causal_articulo  = models.CharField(max_length=20, choices=CAUSAL_ARTICULO_CHOICES, blank=True, default='')
    fecha_termino    = models.DateField()
    fecha_emision    = models.DateField()

    # ── Haberes del último mes (pro-rata) ────────────────────────────────────
    sueldo_base               = models.IntegerField(default=0)
    dias_trabajados_ultimo_mes = models.IntegerField(default=30)
    gratificacion_proporcional = models.IntegerField(default=0)

    # ── Compensaciones por término ───────────────────────────────────────────
    feriado_proporcional           = models.IntegerField(default=0)   # vacaciones adeudadas
    indemnizacion_anos_servicio    = models.IntegerField(default=0)   # Art. 163 — 1 mes por año
    indemnizacion_sustitutiva_aviso = models.IntegerField(default=0)  # aviso previo no dado

    # ── Otros ───────────────────────────────────────────────────────────────
    otros_haberes  = models.IntegerField(default=0)
    otros_descuentos = models.IntegerField(default=0)

    # ── Descuentos previsionales del último período ─────────────────────────
    descuentos_prevision = models.IntegerField(default=0)

    # ── Total calculado ──────────────────────────────────────────────────────
    total_a_pagar = models.IntegerField(default=0)

    # Si el empleador dio el aviso con 30 días de anticipación (Art. 161):
    # sin él corresponde la indemnización sustitutiva del aviso previo.
    aviso_previo_dado = models.BooleanField(default=False)
    modalidad  = models.CharField(max_length=15, choices=MODALIDAD_CHOICES, default='PRESENCIAL')
    archivo_pdf = models.FileField(upload_to='finiquitos/', null=True, blank=True)

    creado_en     = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_emision']

    def __str__(self):
        return f"Finiquito {self.empleado.rut} — {self.fecha_termino}"

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


class EventoPasarela(models.Model):
    """Cada aviso recibido de la pasarela (Reveniu), tal como llegó.

    Sirve de historial de pagos del cliente y de respaldo: un aviso que no se
    pudo asociar a una cuenta queda aquí con cliente vacío, se avisa por
    correo y se asocia a mano desde el admin, sin perder el pago.
    """
    evento = models.CharField(max_length=60)
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True, related_name='eventos_pasarela')
    plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True, blank=True)
    gateway_subscription_id = models.CharField(max_length=100, blank=True, default='')
    orden_compra = models.CharField(max_length=100, blank=True, default='')
    monto = models.IntegerField(default=0)
    fecha_pago = models.DateField(null=True, blank=True)
    datos = models.JSONField(default=dict, blank=True)
    aplicado = models.BooleanField(default=False, help_text='Si ya se reflejó en la suscripción del cliente.')
    recibido_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-recibido_en']
        verbose_name = 'Evento de la pasarela'
        verbose_name_plural = 'Eventos de la pasarela'

    def __str__(self):
        return f"{self.evento} · {self.gateway_subscription_id or 'sin suscripción'} · {self.recibido_en:%d-%m-%Y}"


# ==========================================
# 7. FIRMA ELECTRÓNICA
# ==========================================

class SolicitudFirma(models.Model):
    ESTADOS = [
        ('PENDIENTE',  'Pendiente de firma'),
        ('PROCESANDO', 'Procesando firma'),
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
        ('LIQUIDACION',     'Liquidación de Sueldo'),
        ('VACACION',        'Comprobante de Vacaciones'),
        ('FINIQUITO',       'Finiquito de Término'),
    ]

    empleado         = models.ForeignKey('Empleado',      on_delete=models.CASCADE,    related_name='solicitudes_firma')
    empresa          = models.ForeignKey('Empresa',       on_delete=models.CASCADE,    related_name='solicitudes_firma')
    contrato         = models.ForeignKey('Contrato',      on_delete=models.SET_NULL,   null=True, blank=True)
    documento_legal  = models.ForeignKey('DocumentoLegal', on_delete=models.SET_NULL,  null=True, blank=True)
    anexo_contrato   = models.ForeignKey('AnexoContrato', on_delete=models.SET_NULL,   null=True, blank=True,
                                         related_name='solicitudes_firma')
    liquidacion      = models.ForeignKey('Liquidacion',   on_delete=models.SET_NULL,   null=True, blank=True)
    vacacion         = models.ForeignKey('VacacionEmpleado', on_delete=models.SET_NULL, null=True, blank=True)
    finiquito        = models.ForeignKey('Finiquito',     on_delete=models.SET_NULL,   null=True, blank=True)

    tipo_documento   = models.CharField(max_length=20, choices=TIPOS_DOCUMENTO)
    token            = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    estado           = models.CharField(max_length=12, choices=ESTADOS, default='PENDIENTE')

    b2_key_temporal  = models.CharField(max_length=500, blank=True, default='')
    b2_key_firmado   = models.CharField(max_length=500, blank=True, default='')

    firma_trabajador_imagen = models.TextField(blank=True, default='')  # base64 PNG
    ip_firmante      = models.GenericIPAddressField(null=True, blank=True)
    email_firmante   = models.EmailField(blank=True, default='')

    sesion_token_trabajador = models.UUIDField(null=True, blank=True)

    enviado_en       = models.DateTimeField(auto_now_add=True)
    firmado_en       = models.DateTimeField(null=True, blank=True)
    expira_en        = models.DateTimeField()
    motivo_rechazo   = models.TextField(blank=True, default='')

    # Comprobante de la firma. El folio es correlativo por empresa; las huellas
    # SHA-256 permiten verificar qué documento se revisó (original) y que el
    # PDF firmado que se descarga no fue alterado (firmado).
    folio            = models.CharField(max_length=20, blank=True, default='')
    hash_original    = models.CharField(max_length=64, blank=True, default='')
    hash_firmado     = models.CharField(max_length=64, blank=True, default='')

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


# ==========================================
# 8. VACACIONES Y PERMISOS
# ==========================================
class VacacionEmpleado(models.Model):
    TIPO_CHOICES = [
        ('VACACION_LEGAL',      'Vacación Legal (Art. 67)'),
        ('VACACION_PROGRESIVA', 'Feriado Progresivo (Art. 68)'),
        ('PERMISO_SIN_GOCE',    'Permiso Sin Goce de Sueldo'),
    ]
    ESTADO_CHOICES = [
        ('PENDIENTE',  'Pendiente de aprobación'),
        ('APROBADO',   'Aprobado'),
        ('RECHAZADO',  'Rechazado'),
    ]

    empleado     = models.ForeignKey('Empleado', on_delete=models.CASCADE, related_name='vacaciones')
    empresa      = models.ForeignKey('Empresa',  on_delete=models.CASCADE, related_name='vacaciones')
    fecha_inicio = models.DateField()
    fecha_fin    = models.DateField()
    dias_habiles = models.PositiveIntegerField(default=0)
    tipo         = models.CharField(max_length=25, choices=TIPO_CHOICES, default='VACACION_LEGAL')
    estado       = models.CharField(max_length=12, choices=ESTADO_CHOICES, default='APROBADO')
    observaciones = models.TextField(blank=True, default='')
    archivo_pdf  = models.FileField(upload_to='vacaciones/', null=True, blank=True)
    creado_en    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_inicio']

    def __str__(self):
        return f"Vacación {self.empleado} {self.fecha_inicio}→{self.fecha_fin} ({self.dias_habiles}d)"


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