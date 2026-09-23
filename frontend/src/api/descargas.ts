import { isAxiosError } from 'axios';
import client from './client';

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
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(data);
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000);
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
