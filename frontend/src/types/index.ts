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
}

// Entrada de detalle para haberes o descuentos en una liquidación
export interface DetalleItem {
    glosa: string;
    valor: number;
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
    jornada_personalizada: string | null;
    funciones_especificas: string[] | null;
    clausulas_especiales: string[] | null;
    archivo_contrato: string | null;
    archivo_anexo_40h: string | null;
    creado_en: string;
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
}

export interface DocumentoLegal {
    id: number;
    empleado: number;
    tipo: 'AMONESTACION' | 'DESPIDO' | 'MUTUO_ACUERDO' | 'CONSTANCIA';
    fecha_emision: string;
    causal_legal: string | null;
    hechos: string;
    aviso_previo_pagado: boolean;
    archivo_pdf: string | null;
    creado_en: string;
}

export interface HoraExtraItem {
    glosa: string;
    horas: number;
    recargo: number;
    valor: number;
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
    detalle_haberes_imponibles: DetalleItem[];
    detalle_horas_extras: HoraExtraItem[];
    detalle_haberes_no_imponibles: DetalleItem[];
    afp_nombre: string | null;
    afp_monto: number;
    salud_nombre: string | null;
    isapre_cotizacion_uf: string; // DecimalField llega como string desde DRF
    salud_monto: number;
    seguro_cesantia: number;
    impuesto_unico: number;
    anticipo_quincena: number;
    detalle_otros_descuentos: DetalleItem[];
    total_imponible: number;
    total_haberes: number;
    total_descuentos: number;
    sueldo_liquido: number;
    archivo_pdf: string | null;
    fecha_emision: string;
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
