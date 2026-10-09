/** Mientras la extensión para Mi DT está en prueba, su tarjeta se ve en staging o con VITE_EXTENSION_MIDT=1. */
export function extensionMiDTVisible(): boolean {
  return import.meta.env.VITE_ENTORNO === 'staging' || import.meta.env.VITE_EXTENSION_MIDT === '1';
}
