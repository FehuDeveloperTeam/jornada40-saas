import type { ItemRegistroDT, ResumenRegistroDT } from '../../../src/types';

/** Respuestas de /api/extension/v1/ (backend: core/views/extension.py). */
export interface EmpresaExtension {
  id: number;
  nombre: string;
  rut: string;
}

export interface Yo {
  cuenta: string;
  persona: string;
  dispositivo: string;
  empresas: EmpresaExtension[];
}

export interface Vinculacion extends Yo {
  token: string;
}

export interface ListaRegistro {
  items: ItemRegistroDT[];
  resumen: ResumenRegistroDT;
  /** Anexos aún sin firma del trabajador: entran a la lista al firmarse. */
  anexos_sin_firmar: number;
}

/** Si la empresa con que se entró a Mi DT es la elegida en el panel. */
export type VerificacionEmpresa = 'coincide' | 'distinta' | 'sin_leer';
