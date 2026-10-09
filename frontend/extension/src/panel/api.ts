import { API } from '../configuracion';
import { leerConexion } from './almacen';

/** Error de la API de Jornada40 con un mensaje listo para mostrar. */
export class ErrorApi extends Error {
  readonly estado: number;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
  }
}

let alCortar: ((mensaje: string) => void) | null = null;

/** El panel se entera cuando el token deja de servir (desconectado desde Jornada40, 90 días sin uso…). */
export function alDesconectar(fn: ((mensaje: string) => void) | null) {
  alCortar = fn;
}

const POR_ESTADO: Record<number, string> = {
  403: 'No tienes permiso para esto. Pídeselo al titular de la cuenta.',
  404: 'No encontramos ese dato en Jornada40.',
  429: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar.',
};

interface Opciones {
  metodo?: 'GET' | 'POST';
  cuerpo?: unknown;
  /** Solo para vincular: todavía no hay token. */
  sinToken?: boolean;
}

/**
 * Llama a la API de Jornada40 con el token de la extensión. Sin cookies: la
 * extensión no usa la sesión del panel ni la de Mi DT.
 */
export async function pedir<T>(ruta: string, { metodo = 'GET', cuerpo, sinToken = false }: Opciones = {}): Promise<T> {
  const encabezados: Record<string, string> = { Accept: 'application/json' };
  if (cuerpo !== undefined) encabezados['Content-Type'] = 'application/json';
  if (!sinToken) {
    const conexion = await leerConexion();
    if (!conexion) throw new ErrorApi(401, 'La extensión no está conectada.');
    encabezados.Authorization = `Extension ${conexion.token}`;
  }
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: encabezados,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch {
    throw new ErrorApi(0, 'No pudimos conectar con Jornada40. Revisa tu conexión a internet e intenta de nuevo.');
  }
  const datos: unknown = await respuesta.json().catch(() => null);
  if (respuesta.ok) return datos as T;
  const d = (datos ?? {}) as { error?: unknown; detail?: unknown };
  const delServidor = typeof d.error === 'string' ? d.error : typeof d.detail === 'string' ? d.detail : '';
  const mensaje = respuesta.status === 429 || respuesta.status >= 500 || !delServidor
    ? POR_ESTADO[respuesta.status] ?? 'Jornada40 no pudo responder. Intenta de nuevo en unos minutos.'
    : delServidor;
  if (respuesta.status === 401 && !sinToken) alCortar?.(mensaje);
  throw new ErrorApi(respuesta.status, mensaje);
}

export function mensajeDe(error: unknown, porDefecto = 'Algo falló. Intenta de nuevo.'): string {
  return error instanceof ErrorApi ? error.message : porDefecto;
}
