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
    /** Precio del pago anual; 0 si el plan no se vende anual. */
    precio_anual: number;
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
    // Seguridad social (archivo Previred): códigos de las tablas 19 y 18
    mutual: '00' | '01' | '02' | '03';
    /** Tasa total de accidentes (ej. "0.00930"); null = tasa base de los parámetros. */
    tasa_accidentes: string | null;
    sucursal_mutual: string;
    ccaf: '00' | '01' | '02' | '03' | '04';
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
    /** El empleador confirmó que es su correo personal (la DT exige enviar ahí los documentos). */
    email_personal_confirmado: boolean;
    /** El dominio no es de un proveedor de correo personal conocido: probablemente corporativo. */
    correo_parece_corporativo: boolean;
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
    /** Código de la Isapre (tabla 16 de Previred); vacío si es Fonasa. */
    isapre: string;
    numero_fun: string;
    tramo_asignacion_familiar: 'A' | 'B' | 'C' | 'D';
    cargas_simples: number;
    cargas_maternales: number;
    cargas_invalidas: number;
    /** Años con empleadores anteriores acreditados para el feriado progresivo (Art. 68, máx. 10). */
    anios_previos_feriado: number;
    /** Día en que se desvinculó (ocupa cupo hasta fin de ese mes). */
    fecha_desvinculacion?: string | null;
    /** Discapacidad certificada por la COMPIN (se informa al registrar el contrato en Mi DT). */
    discapacidad: boolean;
    /** Pensionado por invalidez (se informa al registrar el contrato en Mi DT). */
    pension_invalidez: boolean;
    /** Datos del Libro de Remuneraciones Electrónico (conceptos 1109, 1146 y 1170). */
    pensionado_vejez: boolean;
    tecnico_extranjero_exento: boolean;
    tipo_impuesto_renta: '1' | '2' | '3';
    /** Cuándo autorizó la documentación laboral electrónica (Dictamen 0789/15); null si no la ha autorizado. */
    consentimiento_electronico_en: string | null;
    consentimiento_electronico_via: ViaConsentimiento;
    activo: boolean;
    creado_en: string;
    contrato_activo?: Contrato | null;
    tiene_rechazos_pendientes?: boolean;
}

/** Cómo autorizó el trabajador la documentación electrónica; '' si no la ha autorizado. */
export type ViaConsentimiento = 'CONTRATO' | 'ANEXO' | 'PAPEL' | '';

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
    /** CONSENTIMIENTO_ELECTRONICO: autorización de documentación electrónica (texto fijo del sistema). */
    tipo: 'GENERAL' | 'CONSENTIMIENTO_ELECTRONICO';
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

export type TipoVacacion = 'VACACION_LEGAL' | 'VACACION_PROGRESIVA' | 'PERMISO_SIN_GOCE' | 'DIA_COMPENSATORIO';
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
    /** Solo días libres por horas extra: horas de la bolsa que descontó. */
    horas_compensatorias?: string | number;
}

/** Bolsa de horas de descanso ganadas con horas extra (Art. 32 inc. 4°), GET /vacaciones/compensatorias/. */
export interface BolsaCompensatoria {
    permitido: boolean;
    horas_disponibles?: number;
    dias_aproximados?: number;
    horas_por_dia?: number;
    proximo_vencimiento?: string | null;
    horas_por_vencer?: number;
    tope_horas?: number;
    generadas_anualidad?: number;
    compensacion_vigente?: 'PAGO' | 'FERIADO' | 'MIXTO';
}

export interface SaldoVacaciones {
    anos_servicio: number;
    dias_base: number;
    dias_progresivos: number;
    dias_devengados: number;
    dias_usados: number;
    dias_disponibles: number;
    /** Días progresivos que trae cada período en el año de servicio actual (Art. 68). */
    dias_progresivos_anuales: number;
    anios_previos_feriado: number;
    /** Solo con dos períodos o más pendientes (Art. 70). */
    periodos_acumulados?: number;
    aviso_acumulacion?: string;
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
    /** Calculado por el sistema (asignación familiar): no se edita ni se envía. */
    calculado?: boolean;
    tramo?: string;
    monto_carga?: number;
    /** Horas extra cambiadas por descanso (Art. 32 inc. 4°): horas trabajadas que no se pagan y horas de descanso que dan. */
    horas_compensadas?: number;
    horas_feriado?: number;
    /** Pago de horas de descanso vencidas sin usar, por mes de origen ("aaaa-mm": horas). */
    lotes_compensatorios?: Record<string, number>;
    nota_compensacion?: string;
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
    /** Ratificación (Art. 177): en Mi DT si es electrónico, ante ministro de fe si es presencial. */
    ratificado_en: string | null;
    ratificado_via: string;
    ratificado_via_label: string;
}

/** Respuesta de /finiquitos/simular/: montos calculados por el backend y su detalle. */
export interface SimulacionFiniquito extends Omit<Finiquito, 'id' | 'empleado' | 'documento_legal' | 'causal_articulo_label' | 'fecha_emision' | 'modalidad' | 'archivo_pdf' | 'creado_en' | 'ratificado_en' | 'ratificado_via' | 'ratificado_via_label'> {
    detalle: {
        sueldo_proporcional: number;
        feriado_dias_saldo: number;
        feriado_dias_proporcionales: number;
        feriado_dias_habiles: number;
        feriado_dias_corridos: number;
        /** Horas de descanso por horas extra no usadas: se pagan con el feriado (Art. 32 y 73). */
        horas_compensatorias?: number;
        monto_horas_compensatorias?: number;
        con_indemnizacion: boolean;
        anios_indemnizacion: number;
        base_indemnizacion: number;
        base_indemnizacion_topada: boolean;
        tope_base_indemnizacion: number;
        /** Composición de la base (Art. 172): sueldo, haberes mensuales, variables promediados, gratificación. */
        base_indemnizacion_detalle: { glosa: string; monto: number }[];
        base_indemnizacion_meses: number;
        aviso_base_indemnizacion?: string;
        /** Contrato anterior al 14-08-1981: sin tope de 11 años. */
        aviso_anios_indemnizacion?: string;
        afp_nombre: string;
        afp: number;
        salud_nombre: string;
        salud: number;
        seguro_cesantia: number;
        impuesto_unico: number;
        gratificacion_modalidad: 'MENSUAL' | 'ANUAL';
        /** Solo con gratificación anual (Art. 52, modalidad Art. 50). */
        gratificacion_devengado_anio?: number;
        gratificacion_meses?: number;
        gratificacion_tope?: number;
        aviso_gratificacion?: string;
    };
}

export type TipoDocumentoLaboral = 'HORAS_EXTRA' | 'DESCUENTO' | 'PERMISO_LEGAL' | 'INDEMNIZACION';

/** Pacto, autorización o constancia redactado por el backend desde opciones cerradas. */
export interface DocumentoLaboral {
    id: number;
    empleado: number;
    /** Además de los que se crean en la carpeta, las constancias del reglamento y de la Ley Karin. */
    tipo: TipoDocumentoLaboral | 'REGLAMENTO' | 'CANALES_DENUNCIA';
    tipo_texto: string;
    resumen: string;
    fecha_emision: string;
    vigente_desde: string;
    vigente_hasta: string | null;
    activo: boolean;
}

export interface OpcionSimple { valor: string; texto: string }

/** Listas cerradas del formulario de documentos laborales (GET /documentos-laborales/opciones/). */
export interface OpcionesDocumentoLaboral {
    permitido: boolean;
    avisos: string[];
    tipos: Record<TipoDocumentoLaboral | 'TELETRABAJO', { disponible: boolean; motivo: string }>;
    motivos_horas_extra: OpcionSimple[];
    compensaciones_horas_extra: OpcionSimple[];
    conceptos_descuento: OpcionSimple[];
    finalidades_descuento: OpcionSimple[];
    permisos: (OpcionSimple & { desde_el_hecho: boolean })[];
    porcentajes_indemnizacion: OpcionSimple[];
    modalidades_teletrabajo: OpcionSimple[];
    lugares_teletrabajo: OpcionSimple[];
    equipos_teletrabajo: OpcionSimple[];
    dias_semana: OpcionSimple[];
    horas_desconexion: OpcionSimple[];
    duraciones_teletrabajo: OpcionSimple[];
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
    documento_laboral: number | null;
    tipo_documento: 'CONTRATO' | 'ANEXO_40H' | 'AMONESTACION' | 'DESPIDO' | 'CONSTANCIA' | 'ANEXO_CONTRATO' | 'LIQUIDACION'
        | 'VACACION' | 'FINIQUITO' | TipoDocumentoLaboral | 'REGLAMENTO' | 'CANALES_DENUNCIA';
    token: string;
    estado: 'PENDIENTE' | 'PROCESANDO' | 'FIRMADO' | 'RECHAZADO' | 'EXPIRADO' | 'CANCELADO';
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
    /** Firma del empleador: PANEL (confirmó su clave al enviar) o PORTAL (la pidió el trabajador). */
    origen: 'PANEL' | 'PORTAL';
    emisor_nombre: string;
    emisor_ip: string;
    emisor_confirmado_en: string | null;
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

// ── Registro en la Dirección del Trabajo (/registro-dt/) ─────────────────────

export type TipoRegistroDT = 'CONTRATO' | 'ANEXO' | 'TERMINO';
export type EstadoRegistroDT = 'VENCIDO' | 'PENDIENTE' | 'REGISTRADO';

/** Un contrato, anexo o término que se debe registrar en Mi DT, con su plazo calculado por el backend. */
export interface ItemRegistroDT {
    clave: string;
    tipo: TipoRegistroDT;
    detalle: string;
    empleado: { id: number; nombre: string; rut: string; activo: boolean };
    /** Celebración (contrato, anexo) o término. */
    fecha: string;
    vence: string;
    estado: EstadoRegistroDT;
    dias_habiles_restantes: number | null;
    registrado_en: string | null;
    cargo?: string;
    /** Entra en el CSV de carga masiva de Mi DT. */
    csv?: boolean;
    firmado?: boolean;
    /** Término sin causal registrada: se usa el plazo más corto. */
    sin_causal?: boolean;
}

export type EstadoFirmaAnexo = SolicitudFirma['estado'] | null;

export interface PendienteConsentimiento {
    id: number;
    nombre: string;
    rut: string;
    email: string;
    anexo: { id: number; firma: EstadoFirmaAnexo } | null;
}

export interface RegistroDT {
    items: ItemRegistroDT[];
    resumen: { VENCIDO: number; PENDIENTE: number; REGISTRADO: number; por_vencer: number };
    consentimiento: { total: number; con: number; sin: PendienteConsentimiento[] };
    /** CSV para Mi DT: desde el plan Pyme (nivel 3). */
    csv_disponible: boolean;
}

export interface ResultadoAnexosConsentimiento {
    creados: number;
    enviados: number;
    omitidos: { nombre: string; motivo: string }[];
}

/** Ficha para el registro individual en Mi DT (GET /registro-dt/ficha/). */
export interface CampoFichaDT {
    etiqueta: string;
    valor: string;
    /** Texto largo o dato que conviene pegar tal cual en Mi DT. */
    copiar: boolean;
    nota: string;
}

export interface FichaDT {
    clave: string;
    titulo: string;
    /** Camino dentro de Mi DT hasta el formulario. */
    ruta_mi_dt: string;
    secciones: { titulo: string; campos: CampoFichaDT[] }[];
    avisos: string[];
    estado: EstadoRegistroDT;
    vence: string;
}

// ── Portal del trabajador (/api/trabajador/) ────────────────────────────────

/** Ficha (empleo) que la cuenta del trabajador ya puede ver. */
export interface EmpleoPortal {
    id: number;
    empresa: string;
    empresa_rut: string;
    cargo: string;
    activo: boolean;
    /** Último día de acceso de un desvinculado (ISO); null si está vigente. */
    acceso_hasta: string | null;
}

/** Otra ficha con el mismo RUT cuyo correo aún no se verificó. */
export interface EmpleoPorVincular {
    id: number;
    empresa: string;
    /** Correo enmascarado ("ma***@example.com"). */
    correo: string;
}

export interface CuentaTrabajador {
    rut: string;
    nombre: string;
    tiene_clave: boolean;
    mostrar_invitacion_clave: boolean;
    /** Cómo entró en esta sesión: con clave debe dar la actual para cambiarla. */
    ingreso_con: 'codigo' | 'clave';
    empleos: EmpleoPortal[];
    por_vincular: EmpleoPorVincular[];
}

export type RespuestaIngresoPortal =
    | { metodo: 'clave' }
    | { metodo: 'codigo'; mensaje: string; destinos: string[] };

export interface LiquidacionPortal {
    id: number;
    mes: number;
    anio: number;
    empresa: string;
    total_haberes: number | string;
    total_descuentos: number | string;
    liquido: number | string;
    firmada: boolean;
}

export type TipoDocumentoPortal = 'liquidacion' | 'contrato' | 'firma' | 'certificado' | 'certificado_sii' | 'reglamento';

export interface DocumentoPortal {
    tipo: Exclude<TipoDocumentoPortal, 'liquidacion'>;
    id: number;
    titulo: string;
    fecha: string | null;
    empresa: string;
    firmado: boolean;
}

export interface RegistroVacacionPortal {
    id: number;
    desde: string;
    hasta: string;
    dias_habiles: number | string;
    /** Texto ya legible ("Feriado legal"). */
    tipo: string;
}

export interface VacacionesPortal extends EmpleoPortal {
    saldo: SaldoVacaciones | null;
    /** Horas de descanso ganadas con horas extra (Art. 32); null si nunca tuvo. */
    horas_descanso: { horas_disponibles: number; dias_aproximados: number; proximo_vencimiento: string | null;
        horas_por_vencer: number } | null;
    registros: RegistroVacacionPortal[];
}

export type TipoSolicitudDocumento = 'LIQUIDACION' | 'CONTRATO' | 'ANEXO_40H' | 'VACACION' | 'FINIQUITO';
export type EstadoSolicitudDocumento = 'PENDIENTE' | 'RESUELTA' | 'DESCARTADA';

/** Solicitud de un documento que el empleador aún no emite (portal → panel). Sin texto libre. */
export interface SolicitudDocumento {
    id: number;
    tipo: TipoSolicitudDocumento;
    tipo_texto: string;
    /** "Agosto 2026" (liquidación) o "Del 01-02-2026 al 15-02-2026 · 10 días hábiles" (vacación). */
    referencia: string;
    estado: EstadoSolicitudDocumento;
    /** Motivo del descarte (código y texto que ve el trabajador). */
    motivo: string;
    motivo_texto: string;
    creada_en: string;
    resuelta_en: string | null;
}

export interface SolicitudDocumentoPortal extends SolicitudDocumento {
    empresa: string;
}

export interface OpcionValor { valor: string; texto: string }

/** Documento que el trabajador puede pedir; si trae opciones, se elige una (mes, vacación). */
export interface DocumentoSolicitable {
    tipo: TipoSolicitudDocumento;
    texto: string;
    etiqueta_opcion?: string;
    opciones?: OpcionValor[];
}

export interface OpcionesSolicitudPortal {
    empleo: number;
    empresa: string;
    documentos: DocumentoSolicitable[];
}

/** Solicitud vista por el empleador. */
export interface SolicitudDocumentoPanel extends SolicitudDocumento {
    empleado: { id: number; nombre: string; rut: string; email: string };
    /** Período pedido (solo liquidaciones). */
    mes: number | null;
    anio: number | null;
    /** Liquidación del período si ya está emitida (falta enviarla a firma). */
    liquidacion: number | null;
    /** Contrato del trabajador (contrato y anexo 40 horas); null si aún no tiene. */
    contrato: number | null;
    vacacion: number | null;
    /** Motivos de descarte que admite esta solicitud. */
    motivos: OpcionValor[];
}

export type TipoCertificado = 'ANTIGUEDAD' | 'RENTA' | 'VACACIONES' | 'JORNADA' | 'TERMINO' | 'COTIZACIONES';

/** Certificado que se puede generar; si no está disponible, `motivo` dice por qué. */
export interface CertificadoGenerable {
    tipo: TipoCertificado;
    texto: string;
    disponible: boolean;
    motivo: string;
    /** Período (renta y cotizaciones). */
    opciones?: { valor: string; texto: string; disponible: boolean; motivo: string }[];
}

export interface CertificadoEmitido {
    id: number;
    folio: string;
    tipo: TipoCertificado;
    titulo: string;
    opcion: string;
    opcion_texto: string;
    codigo: string;
    emitido_en: string;
    /** Anulado por el empleador: no se descarga y la verificación lo informa como no válido. */
    anulado_en: string | null;
    motivo_anulacion: string;
    empresa?: string;
}

export interface OpcionesCertificado { empleo: number; empresa: string; aviso: string; certificados: CertificadoGenerable[] }

/** Estado del portal del trabajador visto desde su carpeta (GET /empleados/<id>/portal/). */
export interface EstadoPortal {
  estado: 'SIN_PLAN' | 'SIN_ACCESO' | 'SIN_CORREO' | 'NO_INGRESA' | 'ACTIVO';
  texto: string;
  correo: string;
  acceso_hasta: string | null;
  ultimo_ingreso: string | null;
  invitado_en: string | null;
  puede_invitar: boolean;
}

export interface CertificadosPortal {
    /** `aviso`: por qué no se puede emitir ninguno en ese empleo (p. ej. sin firma del empleador). */
    opciones: OpcionesCertificado[];
    emitidos: CertificadoEmitido[];
    /** Certificados N°6 del SII (sueldos) que emitió el empleador, vigentes por año. */
    sueldos_sii: { id: number; numero: number; anio: number; empresa: string }[];
}

/** Respuesta pública de /certificados/verificar/<código>/. */
export interface VerificacionCertificado {
    valido: boolean;
    anulado: boolean;
    folio: string;
    codigo: string;
    titulo: string;
    emitido: string;
    empresa: { nombre: string; rut: string; direccion: string };
    /** Solo en los válidos: de un anulado no se repite lo que afirmaba. */
    trabajador?: { nombre: string; rut: string };
    filas?: [string, string][];
    tabla?: { columnas: string[]; filas: string[][]; pie: string[] | null } | null;
    nota?: string;
    anulado_en?: string;
    motivo_anulacion?: string;
}

export interface FirmaPendientePortal {
    id: number;
    /** 'solicitud': ya enviada a firma, con enlace. 'liquidacion': de un mes cerrado, se inicia con portal.firmar(id). */
    tipo: 'solicitud' | 'liquidacion';
    documento: string;
    empresa: string;
    /** Fecha y hora ISO en que vence el enlace (solo solicitudes). */
    vence: string | null;
    /** Ruta de la página pública de firma: /firma/<token> (solo solicitudes). */
    enlace: string | null;
}

// ── Portal de fiscalización (Dirección del Trabajo) ──────────────────────────

export interface SesionInspeccion {
    empresa: { nombre: string; rut: string; direccion: string; representante_legal: string };
    inspector: { nombre: string; rut: string; correo: string };
}

export interface TrabajadorInspeccion {
    id: number;
    nombre: string;
    rut: string;
    cargo: string;
    activo: boolean;
    fecha_ingreso: string | null;
    fecha_desvinculacion: string | null;
    tipo_contrato: string;
    horas_semanales: number | null;
}

export type TipoDocumentoInspeccion = 'CONTRATO' | 'ANEXO' | 'LIQUIDACION' | 'CARTA' | 'VACACION' | 'FINIQUITO' | 'PACTO';

export interface DocumentoInspeccion {
    /** <tipo>:<id>, identifica el documento para descargar o ratificar. */
    clave: string;
    tipo: TipoDocumentoInspeccion;
    titulo: string;
    empleado: number;
    trabajador: string;
    rut: string;
    fecha: string | null;
    firma: { estado: SolicitudFirma['estado']; firmado_en: string | null; folio: string; enviado_en: string | null } | null;
    ratificaciones: { inspector: string; fecha: string }[];
}

/** Bitácora de fiscalización que ve el empleador. */
export interface RegistroInspeccion {
    accion: 'INGRESO' | 'DESCARGA' | 'RATIFICACION' | 'SALIDA';
    accion_texto: string;
    inspector: string;
    correo: string;
    detalle: string;
    fecha: string;
}

/** Estado del Certificado N°6 (SII) de una empresa y año. */
export interface EstadoCertificado6 {
    anio: number;
    anios: number[];
    factores_completos: boolean;
    anio_cerrado: boolean;
    plazo_certificados: string;
    plazo_dj1887: string;
    trabajadores: number;
    sin_certificado: number;
    certificados: { id: number; numero: number; anio: number; empleado: number; trabajador: string; rut: string;
        renta_afecta_act: number; impuesto_act: number; emitido_en: string; reemplaza: number | null }[];
}

/** Reglamento interno subido por el empleador (GET /reglamentos/?empresa=). */
export interface ReglamentoVersion {
    id: number;
    tipo: 'RIOHS' | 'RIHS';
    tipo_texto: string;
    version: number;
    publicado_en: string;
    vigente_desde: string;
    rige: boolean;
    plazo_remision: string;
    remitido_dt_en: string | null;
    remitido_salud_en: string | null;
    revisar: boolean;
    activo: boolean;
}

/** Trabajador y el estado de su constancia (recepción del reglamento o aviso de la Ley Karin). */
export interface EntregaTrabajador {
    id: number;
    nombre: string;
    correo: boolean;
    estado: SolicitudFirma['estado'] | 'SIN_ENVIAR' | null;
}

export interface EstadoReglamento {
    permitido: boolean;
    trabajadores: number;
    tipo_sugerido: 'RIOHS' | 'RIHS';
    rubros: OpcionSimple[];
    actual: ReglamentoVersion | null;
    versiones: ReglamentoVersion[];
    entrega: { total: number; firmados: number; trabajadores: EntregaTrabajador[] };
    avisos: string[];
}

export interface EstadoLeyKarin {
    permitido: boolean;
    canal: { responsable: string; correo: string };
    semestre: { clave: string; texto: string; hasta: string };
    avance: { total: number; firmados: number; enviados: number; trabajadores: EntregaTrabajador[] };
    mutual: string;
}

/** Resultado de un envío masivo a firma. */
export interface EnvioMasivo { enviadas: number; omitidas: { nombre: string; motivo: string }[] }
