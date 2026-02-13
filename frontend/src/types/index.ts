// frontend/src/types/index.ts

export interface User {
    pk: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
}

export interface Empresa {
    id: number;
    nombre_legal: string;
    rut: string;
    direccion: string;
    giro: string;
    owner: number;
}

export interface Contrato {
    id: number;
    horas_semanales: string; // Django DecimalField suele llegar como string o number
    distribucion_dias: number;
    tipo_jornada: string;
    sueldo_base: number;
    fecha_inicio: string;
    fecha_fin: string | null;
}

export interface Empleado {
    id: number;
    rut: string;
    nombres: string;
    apellidos: string;
    cargo: string;
    fecha_ingreso: string;
    activo: boolean;
    // Ojo: contrato_activo puede venir nulo si el empleado no tiene contrato
    contrato_activo?: Contrato | null; 
}