/** Dirección por partes (core/direcciones.py): el backend arma `direccion` con ellas. */
export interface DireccionPartes { calle: string; numero: string; sin_numero: boolean; depto: string }

/** Partes de un objeto que viene del backend (los nulos pasan a vacío). */
export function partesDe(o: Partial<Record<keyof DireccionPartes, string | boolean | null>> | null | undefined): DireccionPartes {
  return {
    calle: String(o?.calle ?? ''), numero: String(o?.numero ?? ''),
    sin_numero: Boolean(o?.sin_numero), depto: String(o?.depto ?? ''),
  };
}
