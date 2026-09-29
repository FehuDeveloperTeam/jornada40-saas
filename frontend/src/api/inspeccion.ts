import { isAxiosError } from 'axios';
import client from './client';
import { descargar } from './descargas';
import type { DocumentoInspeccion, SesionInspeccion, TrabajadorInspeccion } from '../types';

/**
 * Portal de fiscalización para inspectores de la DT. Su sesión es una cookie
 * propia (httpOnly), distinta de la del empleador: sin ella el backend responde
 * 403, y el interceptor de client.ts no intenta renovar nada ('/inspeccion/').
 */
const BASE = '/inspeccion';

export function mensajeError(err: unknown, porDefecto: string): string {
  if (isAxiosError(err)) {
    const datos = err.response?.data as { error?: string } | undefined;
    if (datos?.error) return datos.error;
    if (err.response?.status === 429) return 'Hiciste demasiados intentos. Espera unos minutos.';
  }
  return porDefecto;
}

export const inspeccion = {
  ingreso: async (datos: { rut_empresa: string; nombre: string; rut: string; correo: string }) =>
    (await client.post<{ mensaje: string }>(`${BASE}/ingreso/`, datos)).data,
  verificar: async (datos: { rut_empresa: string; correo: string; codigo: string }) =>
    (await client.post<SesionInspeccion>(`${BASE}/verificar/`, datos)).data,
  yo: async () => (await client.get<SesionInspeccion>(`${BASE}/yo/`)).data,
  salir: async () => (await client.post(`${BASE}/salir/`, {})).data,
  trabajadores: async () => (await client.get<TrabajadorInspeccion[]>(`${BASE}/trabajadores/`)).data,
  documentos: async () => (await client.get<DocumentoInspeccion[]>(`${BASE}/documentos/`)).data,
  ratificar: async (clave: string, firma: string) => (await client.post(`${BASE}/ratificar/`, { clave, firma })).data,
  descargar: (clave: string, nombre: string) =>
    descargar(`${BASE}/descargar/?clave=${encodeURIComponent(clave)}`, nombre),
};
