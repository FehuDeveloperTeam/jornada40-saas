// frontend/src/types/index.ts

export interface User {
    pk: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
}

export interface Plan {
    id: number;
    nombre: string;
    descripcion: string | null;
    precio: number;
    max_empresas: number;
    limite_trabajadores: number;
    /** 1 Semilla · 2 Starter · 3 Pyme · 4 Corporativo. El backend habilita
     *  funciones por nivel (`_plan_permite`), no por nombre. */
    nivel: number;
    activo: boolean;
}

export interface Cliente {
    id: number;
    usuario: number;
    plan: Plan | null;
    tipo_cliente: 'PERSONA' | 'EMPRESA';
    rut: string;
    nombres: string;
    apellido_paterno: string | null;
    apellido_materno: string | null;
    razon_social: string | null;
    direccion: string | null;
    telefono: string | null;
    correo: string | null;
    creado_en: string;
}

export interface Empresa {
    id: number;
    owner: number;
    nombre_legal: string;
    rut: string;
    alias: string | null;
    giro: string | null;
    direccion: string | null;
    comuna: string | null;
    ciudad: string | null;
    sucursal: string | null;
    representante_legal: string | null;
    rut_representante: string | null;
    activo: boolean;
    created_at: string | null;
    // Firma electrónica
    firma_firmante_nombre: string;
    firma_firmante_cargo: string;
    firma_configurada_en: string | null;
    firma_configurada: boolean;
}

// Entrada de detalle para haberes o descuentos en una liquidación
export interface DetalleItem {
    glosa: string;
    valor: number;
    /** Concepto del catálogo. Los ítems previos al catálogo no lo tienen. */
    concepto?: number | null;
}

export type TipoConcepto =
    | 'HABER_IMPONIBLE'
    | 'HABER_NO_IMPONIBLE'
    | 'HORA_EXTRA'
    | 'COMISION'
    | 'DESCUENTO';

export interface ConceptoRemuneracion {
    id: number;
    codigo: string;
    nombre: string;
    tipo: TipoConcepto;
    es_imponible: boolean;
    es_tributable: boolean;
    afecta_gratificacion: boolean;
    afecta_semana_corrida: boolean;
    codigo_lre: string;
    empresa: number | null;
    es_del_sistema: boolean;
    activo: boolean;
    creado_en: string;
}

// Horario de un día en la distribución de jornada
export interface HorarioDia {
    activo: boolean;
    entrada: string;
    salida: string;
    colacion: number;
}

export type HorarioSemana = Record<string, HorarioDia>;

export interface Contrato {
    id: number;
    empleado: number;
    tipo_contrato: 'INDEFINIDO' | 'PLAZO_FIJO' | 'OBRA_FAENA';
    cargo: string;
    fecha_inicio: string;
    fecha_fin: string | null;
    es_profesional_titulado: boolean;
    sueldo_base: number;
    tipo_jornada: 'ORDINARIA' | 'TURNOS' | 'BISMANAL' | 'ART_22' | 'PARCIAL' | 'OTRO';
    horas_semanales: string; // DecimalField llega como string desde DRF
    distribucion_dias: number;
    distribucion_horario: Record<string, HorarioDia> | null;
    dia_pago: number;
    gratificacion_legal: 'MENSUAL' | 'ANUAL';
    tiene_quincena: boolean;
    dia_quincena: number | null;
    monto_quincena: number | null;
    es_comisionista: boolean;
    comisiones_config: ComisionConfig[];
    jornada_personalizada: string | null;
    funciones_especificas: string[] | null;
    clausulas_especiales: string[] | null;
    archivo_contrato: string | null;
    archivo_anexo_40h: string | null;
    tiene_contrato_pdf: boolean;
    tiene_anexo_40h_pdf: boolean;
    /** Calculados por el backend (core/jornada.py); solo lectura. */
    jornada_maxima_vigente?: number;
    avisos_jornada?: AvisoJornada[];
    creado_en: string;
}

/** Aviso de incumplimiento de jornada. Informa, no bloquea. */
export interface AvisoJornada {
    codigo: 'EXCEDE_MAXIMO' | 'HORARIO_SUPERA_PACTADO' | 'ART22_CON_HORARIO' | 'ART22_CON_HORAS'
        | 'DIA_SUPERA_10H' | 'PARCIAL_SOBRE_TOPE' | 'PROXIMA_REDUCCION';
    /** alta: incumple hoy · media: conviene revisar. */
    gravedad: 'alta' | 'media';
    titulo: string;
    detalle: string;
    recomendacion: string;
    articulo: string;
}

export interface Empleado {
    id: number;
    empresa: number;
    rut: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    sexo: 'M' | 'F' | 'O' | null;
    fecha_nacimiento: string | null;
    nacionalidad: string;
    estado_civil: string | null;
    direccion: string | null;
    comuna: string | null;
    numero_telefono: string | null;
    email: string | null;
    departamento: string | null;
    cargo: string;
    sucursal: string | null;
    horas_laborales: number;
    modalidad: 'PRESENCIAL' | 'REMOTO' | 'HIBRIDO';
    sueldo_base: number;
    afp: string | null;
    sistema_salud: 'FONASA' | 'ISAPRE' | null;
    fecha_ingreso: string;
    centro_costo: string | null;
    ficha_numero: number | null;
    forma_pago: string;
    banco: string | null;
    tipo_cuenta: string | null;
    numero_cuenta: string | null;
    plan_isapre_uf: string; // DecimalField llega como string desde DRF
    activo: boolean;
    creado_en: string;
    contrato_activo?: Contrato | null;
    tiene_rechazos_pendientes?: boolean;
}

export interface DocumentosDisponibles {
    tiene_contrato: boolean;
    tiene_anexo_40h: boolean;
    cantidad_liquidaciones: number;
    cantidad_amonestaciones: number;
    tiene_despido: boolean;
    tiene_mutuo_acuerdo: boolean;
    cantidad_constancias: number;
    cantidad_anexos_contrato: number;
}

// Cambios estructurados que un anexo aplica al contrato al ser firmado.
// Las claves son campos de Contrato; el backend valida contra su whitelist.
export type CambiosAnexo = Partial<{
    cargo: string;
    sueldo_base: number;
    tipo_jornada: string;
    horas_semanales: number;
    gratificacion_legal: string;
    es_comisionista: boolean;
    comisiones_config: ComisionConfig[];
    tiene_quincena: boolean;
    dia_quincena: number;
    monto_quincena: number;
}>;

export interface AnexoContrato {
    id: number;
    contrato: number;
    titulo: string;
    descripcion: string;
    clausulas_modificadas: string[];
    fecha_emision: string;
    cambios: CambiosAnexo;
    vigencia_desde: string | null;
    aplicado: boolean;
    aplicado_en: string | null;
    archivo_pdf: string | null;
    creado_en: string;
}

export interface DocumentoLegal {
    id: number;
    empleado: number;
    tipo: 'AMONESTACION' | 'DESPIDO' | 'MUTUO_ACUERDO' | 'CONSTANCIA';
    fecha_emision: string;
    causal_legal: string | null;
    hechos: string;
    aviso_previo_pagado: boolean;
    // Campos específicos carta de despido
    causal_articulo: string | null;
    fecha_ultimo_dia: string | null;
    cotizaciones_al_dia: boolean | null;
    aviso_previo_dias: number | null;
    monto_indemnizacion_anos: number | null;
    monto_indemnizacion_sustitutiva: number | null;
    modalidad_finiquito: 'PRESENCIAL' | 'ELECTRONICO' | null;
    copia_inspeccion_trabajo: boolean | null;
    archivo_pdf: string | null;
    creado_en: string;
}

export type TipoVacacion = 'VACACION_LEGAL' | 'VACACION_PROGRESIVA' | 'PERMISO_SIN_GOCE';
export type EstadoVacacion = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface VacacionEmpleado {
    id: number;
    empleado: number;
    empresa: number;
    fecha_inicio: string;
    fecha_fin: string;
    dias_habiles: number;
    tipo: TipoVacacion;
    estado: EstadoVacacion;
    observaciones: string;
    archivo_pdf: string | null;
    creado_en: string;
    dias_habiles_calculados: number;
}

export interface SaldoVacaciones {
    anos_servicio: number;
    dias_base: number;
    dias_progresivos: number;
    dias_devengados: number;
    dias_usados: number;
    dias_disponibles: number;
}

export interface HoraExtraItem {
    glosa: string;
    horas: number;
    recargo: number;
    valor: number;
    concepto?: number | null;
}

// Tasa de comisión configurada en el contrato (ej. "Carrocería" 0.5%)
export interface ComisionConfig {
    /** Concepto del catálogo (tipo COMISION). Es la referencia estable:
     *  renombrar la categoría no rompe las liquidaciones ya emitidas. */
    concepto?: number | null;
    /** Nombre escrito en el formulario. El backend lo resuelve a concepto. */
    glosa?: string;
    porcentaje: number;
}

// Monto vendido en el mes por categoría; el backend recalcula 'valor' con
// el porcentaje guardado en el contrato (nunca confía en el que llegue aquí)
/** Ítem del detalle de una liquidación. Los campos extra dependen de la
 *  naturaleza: horas y recargo en las horas extras, monto vendido y
 *  porcentaje en las comisiones. */
export interface ItemLiquidacion {
    concepto?: number | null;
    glosa: string;
    naturaleza: TipoConcepto;
    valor: number;
    horas?: number;
    recargo?: number;
    monto_vendido?: number;
    porcentaje?: number;
}

export interface ComisionItem {
    glosa: string;
    monto_vendido: number;
    porcentaje: number;
    valor: number;
    concepto?: number | null;
}

export interface Liquidacion {
    id: number;
    empleado: number;
    mes: number;
    anio: number;
    dias_trabajados: number;
    dias_licencia: number;
    dias_ausencia: number;
    dias_no_contratados: number;
    sueldo_base: number;
    gratificacion: number;
    /** Haberes y descuentos en una sola lista; cada ítem lleva su naturaleza. */
    detalle_items: ItemLiquidacion[];
    semana_corrida: number;
    afp_nombre: string | null;
    afp_monto: number;
    salud_nombre: string | null;
    isapre_cotizacion_uf: string; // DecimalField llega como string desde DRF
    salud_monto: number;
    seguro_cesantia: number;
    impuesto_unico: number;
    anticipo_quincena: number;
    // Términos del contrato congelados al emitir la liquidación
    sueldo_base_contrato: number;
    gratificacion_legal: string;
    tipo_contrato: string;
    total_imponible: number;
    total_haberes: number;
    total_descuentos: number;
    sueldo_liquido: number;
    archivo_pdf: string | null;
    fecha_emision: string;
}

export interface Finiquito {
    id: number;
    empleado: number;
    documento_legal: number | null;
    causal_articulo: string;
    causal_articulo_label: string;
    fecha_termino: string;
    fecha_emision: string;
    sueldo_base: number;
    dias_trabajados_ultimo_mes: number;
    gratificacion_proporcional: number;
    feriado_proporcional: number;
    indemnizacion_anos_servicio: number;
    indemnizacion_sustitutiva_aviso: number;
    otros_haberes: number;
    otros_descuentos: number;
    descuentos_prevision: number;
    total_a_pagar: number;
    modalidad: 'PRESENCIAL' | 'ELECTRONICO';
    /** Si el empleador dio el aviso de 30 días (Art. 161); sin él corresponde la sustitutiva. */
    aviso_previo_dado: boolean;
    archivo_pdf: string | null;
    creado_en: string;
}

/** Respuesta de /finiquitos/simular/: montos calculados por el backend y su detalle. */
export interface SimulacionFiniquito extends Omit<Finiquito, 'id' | 'empleado' | 'documento_legal' | 'causal_articulo_label' | 'fecha_emision' | 'modalidad' | 'archivo_pdf' | 'creado_en'> {
    detalle: {
        sueldo_proporcional: number;
        feriado_dias_saldo: number;
        feriado_dias_proporcionales: number;
        feriado_dias_habiles: number;
        feriado_dias_corridos: number;
        con_indemnizacion: boolean;
        anios_indemnizacion: number;
        base_indemnizacion: number;
        base_indemnizacion_topada: boolean;
        tope_base_indemnizacion: number;
        afp_nombre: string;
        afp: number;
        salud_nombre: string;
        salud: number;
        seguro_cesantia: number;
        impuesto_unico: number;
    };
}

export interface SolicitudFirma {
    id: number;
    empleado: number;
    empresa: number;
    contrato: number | null;
    documento_legal: number | null;
    anexo_contrato: number | null;
    liquidacion: number | null;
    vacacion: number | null;
    finiquito: number | null;
    tipo_documento: 'CONTRATO' | 'ANEXO_40H' | 'AMONESTACION' | 'DESPIDO' | 'CONSTANCIA' | 'ANEXO_CONTRATO' | 'LIQUIDACION' | 'VACACION' | 'FINIQUITO';
    token: string;
    estado: 'PENDIENTE' | 'FIRMADO' | 'RECHAZADO' | 'EXPIRADO' | 'CANCELADO';
    email_firmante: string;
    ip_firmante: string | null;
    enviado_en: string;
    firmado_en: string | null;
    expira_en: string;
    motivo_rechazo: string;
    /** Comprobante (solo firmadas): folio correlativo y huella SHA-256 del PDF firmado. */
    folio?: string;
    hash_firmado?: string;
    empleado_nombre: string;
    empresa_nombre: string;
}

export interface Suscripcion {
    id: number;
    cliente: number;
    plan: Plan;
    estado: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
    fecha_inicio: string;
    fecha_proximo_cobro: string | null;
    fecha_cancelacion: string | null;
    gateway_customer_id: string | null;
    gateway_subscription_id: string | null;
    metodo_pago_glosa: string | null;
}
