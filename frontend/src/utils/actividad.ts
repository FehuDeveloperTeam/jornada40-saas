/**
 * Última actividad por acceso ('panel', 'karin', 'portal', 'inspeccion'), compartida
 * entre pestañas. La usa CierreInactividad; los ingresos llaman a marcarActividad
 * para que una hora vieja de una sesión anterior no cierre la nueva.
 */
const CLAVE = (acceso: string) => `j40-actividad-${acceso}`;

export function leerActividad(acceso: string): number | null {
  try {
    const v = Number(localStorage.getItem(CLAVE(acceso)));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}

export function marcarActividad(acceso: string) {
  try { localStorage.setItem(CLAVE(acceso), String(Date.now())); } catch { /* sin almacenamiento: solo cuenta esta pestaña */ }
}
