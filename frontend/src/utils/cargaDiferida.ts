import { lazy } from 'react';
import type { ComponentType } from 'react';
import PaginaNoCargo from '../components/sitio/PaginaNoCargo';

// Cada publicación cambia el nombre de los archivos de cada página. Una pestaña
// abierta antes de publicar pide un archivo que ya no existe: se recarga una vez
// para tomar la versión nueva (no más de una vez cada 10 s, para no entrar en bucle).
const CLAVE = 'j40-recarga-version';

export function recargarPorVersion(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE) || 0);
    if (Date.now() - ultima < 10_000) return false;
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** `lazy` que, si la página no se puede descargar, recarga una vez o muestra un aviso en vez de una pantalla en blanco. */
export function diferida<P extends object>(cargar: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(() => cargar().catch(() => {
    if (recargarPorVersion()) return new Promise<never>(() => undefined);
    return { default: PaginaNoCargo as ComponentType<P> };
  }));
}
