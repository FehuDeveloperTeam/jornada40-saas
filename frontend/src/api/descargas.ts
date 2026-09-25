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

/**
 * Nombre del archivo que manda el backend en Content-Disposition, si lo hay.
 * Así un documento firmado se guarda como "…_firmado.pdf". Acepta
 * filename*=UTF-8''… (RFC 5987) y filename="…".
 */
export function nombreDeRespuesta(cabecera: unknown): string | null {
  if (typeof cabecera !== 'string' || !cabecera) return null;
  const extendido = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(cabecera);
  if (extendido) {
    try { return decodeURIComponent(extendido[1].trim().replace(/^"|"$/g, '')) || null; } catch { /* sigue con filename= */ }
  }
  const simple = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(cabecera);
  const nombre = (simple?.[2] ?? simple?.[1] ?? '').trim();
  return nombre || null;
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
 * guarda con el nombre que indique el backend (Content-Disposition) o, si no
 * viene o el navegador no lo expone, con el indicado. Devuelve el mensaje de error del backend si
 * lo hay (p. ej. una función fuera del plan), o null si salió bien.
 */
export async function descargar(
  url: string, nombre: string, opciones: { metodo?: 'get' | 'post'; datos?: unknown } = {},
): Promise<string | null> {
  try {
    const { data, headers } = opciones.metodo === 'post'
      ? await client.post<Blob>(url, opciones.datos, { responseType: 'blob' })
      : await client.get<Blob>(url, { responseType: 'blob' });
    guardarArchivo(data, nombreDeRespuesta(headers['content-disposition']) ?? nombre);
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
