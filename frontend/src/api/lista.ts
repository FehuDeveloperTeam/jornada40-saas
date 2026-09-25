import client from './client';

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

type Pagina<T> = T[] | { results: T[]; next?: string | null };

/**
 * GET de un listado completo: recorre todas las páginas. Con una sola página
 * se cortaban los listados largos (una empresa Corporativo puede tener 250
 * trabajadores más los desvinculados, y la página trae 200).
 */
export async function obtenerTodo<T>(url: string): Promise<T[]> {
  const todos: T[] = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data } = await client.get<Pagina<T>>(url, { params: pagina > 1 ? { page: pagina } : undefined });
    if (Array.isArray(data)) return data;
    todos.push(...(data.results ?? []));
    if (!data.next) break;
  }
  return todos;
}
