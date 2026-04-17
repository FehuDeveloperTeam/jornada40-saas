// Tipos locales del Dashboard (no exportados en types/index.ts)

export interface DashboardEmpresa {
  id: number;
  nombre_legal: string;
  rut: string;
  giro?: string;
}

export interface DashboardEmpleado {
  id: number;
  rut: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno?: string;
  sexo?: string;
  fecha_nacimiento?: string;
  nacionalidad?: string;
  estado_civil?: string;
  direccion?: string;
  comuna?: string;
  numero_telefono?: string;
  email?: string;
  departamento?: string;
  cargo: string;
  sucursal?: string;
  horas_laborales?: number;
  modalidad?: string;
  sueldo_base?: number;
  afp?: string;
  sistema_salud?: string;
  fecha_ingreso?: string;
  activo: boolean;
  empresa: number;
  creado_en?: string;
  centro_costo?: string;
  ficha_numero?: string;
  forma_pago?: string;
  banco?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  plan_isapre_uf?: number;
}

export interface HorarioDia {
  activo: boolean;
  entrada: string;
  salida: string;
  colacion: number;
}

export type HorarioSemana = Record<string, HorarioDia>;

export interface DashboardContrato {
  id?: number;
  empleado: number;
  tipo_contrato: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin?: string;
  sueldo_base: number;
  tipo_jornada: string;
  horas_semanales: number;
  distribucion_dias: number;
  tiene_colacion_imputable: boolean;
  jornada_personalizada?: string;
  clausulas_especiales?: string[];
  dia_pago: number;
  gratificacion_legal: string;
  tiene_quincena: boolean;
  dia_quincena?: number | null;
  monto_quincena?: number | null;
  funciones_especificas?: string[];
  distribucion_horario?: HorarioSemana;
}

export interface DashboardDocumentoLegal {
  id?: number;
  empleado: number;
  tipo: string;
  fecha_emision: string;
  causal_legal?: string;
  hechos: string;
  aviso_previo_pagado: boolean;
  creado_en?: string;
}

export interface ItemDinamico {
  glosa: string;
  valor: number;
}

export interface HoraExtraItem {
  glosa: string;
  horas: number;
  recargo: number;
  valor: number;
}

export interface DashboardLiquidacion {
  id?: number;
  empleado: number;
  mes: number;
  anio: number;
  dias_trabajados: number;
  dias_licencia?: number;
  dias_ausencia?: number;
  dias_no_contratados?: number;
  sueldo_base: number;
  gratificacion: number;
  detalle_haberes_imponibles?: ItemDinamico[];
  detalle_horas_extras?: HoraExtraItem[];
  detalle_haberes_no_imponibles?: ItemDinamico[];
  detalle_otros_descuentos?: ItemDinamico[];
  afp_nombre?: string;
  afp_monto: number;
  salud_nombre?: string;
  isapre_cotizacion_uf?: number;
  salud_monto: number;
  seguro_cesantia: number;
  anticipo_quincena: number;
  total_imponible: number;
  total_haberes: number;
  total_descuentos: number;
  sueldo_liquido: number;
  fecha_emision?: string;
}

export const defaultHorario: HorarioSemana = {
  lunes: { activo: true, entrada: '09:00', salida: '18:00', colacion: 60 },
  martes: { activo: true, entrada: '09:00', salida: '18:00', colacion: 60 },
  miercoles: { activo: true, entrada: '09:00', salida: '18:00', colacion: 60 },
  jueves: { activo: true, entrada: '09:00', salida: '18:00', colacion: 60 },
  viernes: { activo: true, entrada: '09:00', salida: '18:00', colacion: 60 },
  sabado: { activo: false, entrada: '09:00', salida: '14:00', colacion: 0 },
  domingo: { activo: false, entrada: '09:00', salida: '14:00', colacion: 0 },
};
