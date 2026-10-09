import type { PantallaLevantada } from './levantar';
import type { ResultadoLlenado } from './llenar';
import type { Instruccion } from './mapeo';

/** Lo que el panel lateral le pide al script que corre dentro de Mi DT. */
export type Mensaje =
  | { tipo: 'estado'; empleador: { selector: string } | null }
  | { tipo: 'levantar' }
  | { tipo: 'llenar'; instrucciones: Instruccion[]; pendientes: string[] }
  | { tipo: 'exito'; exito: { texto: string; comprobante?: string } }
  | { tipo: 'leer'; selectores: string[] };

export interface EstadoPagina {
  ruta: string;
  titulo: string;
  encabezados: string[];
  /** RUT del empleador con que se ingresó a Mi DT (sin puntos), si el mapeo dice dónde leerlo. */
  empleador: string | null;
}
export interface RespuestaLlenado {
  resultados: ResultadoLlenado[];
  /** Campos marcados en amarillo para completar a mano. */
  pendientes: number;
  /** No se llenó nada: faltan campos del mapeo en la pantalla (Mi DT cambió). */
  detenido: boolean;
}
export interface RespuestaExito { registrado: boolean; comprobante: string }
export type RespuestaLevantar = PantallaLevantada;
export type RespuestaLeer = Record<string, string | null>;
