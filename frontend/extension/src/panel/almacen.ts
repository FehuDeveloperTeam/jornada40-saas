/**
 * Lo único que la extensión guarda en el navegador (chrome.storage.local):
 * el token de la conexión, la empresa elegida y qué pantallas ya se
 * levantaron. Nunca datos de trabajadores: la ficha se pide a Jornada40 al
 * abrirla y se olvida al cerrar el panel.
 */
export interface Conexion {
  token: string;
  cuenta: string;
  persona: string;
  dispositivo: string;
}

const CONEXION = 'conexion';
const EMPRESA = 'empresa';
const LEVANTADAS = 'levantadas';

export async function leerConexion(): Promise<Conexion | null> {
  const r = await chrome.storage.local.get(CONEXION);
  const c = r[CONEXION] as Conexion | undefined;
  return c?.token ? c : null;
}

export async function guardarConexion(c: Conexion): Promise<void> {
  await chrome.storage.local.set({ [CONEXION]: c });
}

export async function borrarConexion(): Promise<void> {
  await chrome.storage.local.remove([CONEXION, EMPRESA]);
}

export async function leerEmpresa(): Promise<number | null> {
  const r = await chrome.storage.local.get(EMPRESA);
  return typeof r[EMPRESA] === 'number' ? (r[EMPRESA] as number) : null;
}

export async function guardarEmpresa(id: number): Promise<void> {
  await chrome.storage.local.set({ [EMPRESA]: id });
}

/** Pantallas enviadas en el levantamiento: ruta y título de la etapa (sin datos). */
export interface Levantada { ruta: string; etapa: string; enviada_en: string }

export async function leerLevantadas(): Promise<Levantada[]> {
  const r = await chrome.storage.local.get(LEVANTADAS);
  return Array.isArray(r[LEVANTADAS]) ? (r[LEVANTADAS] as Levantada[]) : [];
}

export async function anotarLevantada(l: Levantada): Promise<Levantada[]> {
  const lista = [...(await leerLevantadas()), l].slice(-100);
  await chrome.storage.local.set({ [LEVANTADAS]: lista });
  return lista;
}
