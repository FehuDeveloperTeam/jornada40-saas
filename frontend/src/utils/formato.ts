/** Formatos de presentación del panel (es-CL). */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** $1.450.000 */
export function clp(valor: number | string | null | undefined): string {
  const n = Math.round(Number(valor) || 0);
  return `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('es-CL')}`;
}

/** 40.512,34 (UF) */
export function decimalCL(valor: number, decimales = 2): string {
  return valor.toLocaleString('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** "2026-09-22" → Date local (sin corrimiento por zona horaria). */
export function fechaLocal(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return a ? new Date(a, (m || 1) - 1, d || 1) : null;
}

/** Fecha de hoy en Chile como "2026-09-22" (no en UTC: de noche en Chile, UTC ya es mañana). */
export function hoyISO(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
}

/** 22-09-2026 */
export function fechaCL(iso: string | null | undefined): string {
  const f = fechaLocal(iso);
  if (!f) return '—';
  return `${String(f.getDate()).padStart(2, '0')}-${String(f.getMonth() + 1).padStart(2, '0')}-${f.getFullYear()}`;
}

/** Martes 22 de septiembre de 2026 */
export function fechaLarga(f: Date = new Date()): string {
  return `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()].toLowerCase()} de ${f.getFullYear()}`;
}

export function nombreMes(mes: number): string {
  return MESES[(mes - 1 + 12) % 12];
}

/** Agosto 2026 */
export function periodo(mes: number, anio: number): string {
  return `${nombreMes(mes)} ${anio}`;
}

/** "4 años 3 meses" desde una fecha hasta hoy. */
export function antiguedad(iso: string | null | undefined, hoy: Date = new Date()): string {
  const desde = fechaLocal(iso);
  if (!desde) return '—';
  let meses = (hoy.getFullYear() - desde.getFullYear()) * 12 + hoy.getMonth() - desde.getMonth();
  if (hoy.getDate() < desde.getDate()) meses--;
  if (meses < 0) return 'Aún no ingresa';
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [];
  if (anios) partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`);
  if (resto || !anios) partes.push(`${resto} ${resto === 1 ? 'mes' : 'meses'}`);
  return partes.join(' ');
}

/** Iniciales para avatares: "Matías Soto" → "MS". */
export function iniciales(...partes: (string | null | undefined)[]): string {
  return partes.filter(Boolean).map((p) => p!.trim()[0] ?? '').join('').slice(0, 2).toUpperCase();
}

/** "MATÍAS IGNACIO" → "Matías Ignacio" (los datos se guardan en mayúsculas). */
export function capitalizar(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());
}
