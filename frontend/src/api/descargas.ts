import { isAxiosError } from 'axios';
import client from './client';

/**
 * Nombre de archivo seguro: sin tildes ni caracteres especiales. Chrome
 * descarta un nombre con tildes ("Liquidación…") y guarda el archivo como
 * "download", sin extensión.
 */
export function nombreSeguro(nombre: string): string {
  return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_');
}

/** Guarda un Blob en el equipo con el nombre indicado. */
export function guardarArchivo(datos: Blob, nombre: string): void {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(datos);
  enlace.download = nombreSeguro(nombre);
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000);
}

/**
 * Descarga un archivo de la API con la sesión del usuario (cookies) y lo
 * guarda con el nombre indicado. Devuelve el mensaje de error del backend si
 * lo hay (p. ej. una función fuera del plan), o null si salió bien.
 */
export async function descargar(
  url: string, nombre: string, opciones: { metodo?: 'get' | 'post'; datos?: unknown } = {},
): Promise<string | null> {
  try {
    const { data } = opciones.metodo === 'post'
      ? await client.post<Blob>(url, opciones.datos, { responseType: 'blob' })
      : await client.get<Blob>(url, { responseType: 'blob' });
    guardarArchivo(data, nombre);
    return null;
  } catch (error) {
    // Con responseType blob el error también llega como Blob: se lee el JSON.
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        const cuerpo = JSON.parse(await error.response.data.text()) as { error?: string; detail?: string };
        return cuerpo.error ?? cuerpo.detail ?? 'No pudimos descargar el archivo.';
      } catch {
        return 'No pudimos descargar el archivo.';
      }
    }
    return 'No pudimos descargar el archivo.';
  }
}
