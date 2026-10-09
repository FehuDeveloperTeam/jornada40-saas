import { MI_DT } from '../configuracion';
import type { Mensaje } from '../mensajes';

export interface Pestana {
  id: number;
  /** Solo se conoce en Mi DT (es el único sitio con permiso); en otro sitio es null. */
  url: string | null;
  enMiDT: boolean;
}

/** La pestaña visible en la ventana donde está abierto el panel. */
export async function pestanaActiva(): Promise<Pestana | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return null;
  const url = tab.url ?? null;
  return { id: tab.id, url, enMiDT: Boolean(url?.startsWith(`${MI_DT}/`) || url === MI_DT) };
}

/**
 * Pregunta al script de la extensión que corre dentro de Mi DT. Devuelve null
 * si no responde: pasa con una pestaña de Mi DT abierta antes de instalar la
 * extensión, y se arregla recargando la página.
 */
export async function preguntar<T>(pestana: Pestana, mensaje: Mensaje): Promise<T | null> {
  try {
    const r = (await chrome.tabs.sendMessage(pestana.id, mensaje)) as T | undefined;
    return r ?? null;
  } catch {
    return null;
  }
}

/** Abre una ruta de Mi DT en la misma pestaña de Mi DT (conserva la sesión) o en una nueva. */
export async function abrirEnMiDT(ruta: string, pestana: Pestana | null): Promise<void> {
  const url = `${MI_DT}${ruta}`;
  if (pestana?.enMiDT) await chrome.tabs.update(pestana.id, { url });
  else await chrome.tabs.create({ url });
}

export async function abrirPagina(url: string): Promise<void> {
  await chrome.tabs.create({ url });
}
