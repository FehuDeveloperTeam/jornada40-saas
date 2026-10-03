/**
 * Borradores locales de formularios largos (contrato, liquidación): si la sesión
 * se cierra por inactividad, lo escrito se puede recuperar al volver. Viven solo
 * en este navegador, por usuario, y vencen en 24 horas. Al cerrar sesión a mano
 * se borran (equipo compartido). Nunca se usan para la Ley Karin (reserva).
 */
const PREFIJO = 'j40-borrador-';
export const VIGENCIA_BORRADOR_MS = 24 * 60 * 60_000;

export interface Borrador<T> { valor: T; en: number }

export const claveBorrador = (usuario: number | string, formulario: string) => `${PREFIJO}${usuario}-${formulario}`;

export function leerBorrador<T>(clave: string): Borrador<T> | null {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return null;
    const b = JSON.parse(crudo) as Borrador<T>;
    if (!b || typeof b.en !== 'number' || Date.now() - b.en > VIGENCIA_BORRADOR_MS) {
      localStorage.removeItem(clave);
      return null;
    }
    return b;
  } catch { return null; }
}

export function guardarBorrador<T>(clave: string, valor: T) {
  try { localStorage.setItem(clave, JSON.stringify({ valor, en: Date.now() })); } catch { /* sin almacenamiento: no hay borrador */ }
}

export function borrarBorrador(clave: string) {
  try { localStorage.removeItem(clave); } catch { /* nada que borrar */ }
}

/** Al cerrar sesión a mano: ningún borrador queda para quien use el equipo después. */
export function borrarTodosLosBorradores() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO)).forEach((k) => localStorage.removeItem(k));
  } catch { /* sin almacenamiento */ }
}
