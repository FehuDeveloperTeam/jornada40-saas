/**
 * Los listados de la API vienen paginados (DEFAULT_PAGINATION_CLASS en
 * settings.py): `{ count, next, previous, results }`. Algunas acciones
 * propias devuelven la lista directa. Esto acepta ambas formas.
 */
export type RespuestaLista<T> = T[] | { results: T[] };

export function lista<T>(datos: RespuestaLista<T> | undefined | null): T[] {
  if (!datos) return [];
  return Array.isArray(datos) ? datos : (datos.results ?? []);
}
