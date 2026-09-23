/**
 * Calendario de reducción de jornada de la Ley 21.561 ("Ley 40 horas").
 *
 * La ley se publicó el 26-04-2023 y baja la jornada ordinaria máxima en tres
 * etapas, cada una el 26 de abril: 44 h al primer año, 42 h al tercero y
 * 40 h al quinto.
 *
 * Todo lo que dependa del máximo vigente (el sitio, las alertas de contratos
 * y el anexo de jornada) debe leerlo de aquí y no escribir "42" a mano: el
 * 26-04-2028 el máximo pasa a 40 h y el cambio tiene que verse en todas
 * partes a la vez.
 */

export interface EtapaJornada {
  /** Primer día en que rige. `null` para la jornada previa a la ley. */
  desde: Date | null;
  horas: number;
  descripcion: string;
}

// Fechas locales (mes base 0): el cambio ocurre a medianoche en Chile.
export const ETAPAS_LEY_40: EtapaJornada[] = [
  { desde: null, horas: 45, descripcion: 'Jornada anterior' },
  { desde: new Date(2024, 3, 26), horas: 44, descripcion: 'Primera reducción' },
  { desde: new Date(2026, 3, 26), horas: 42, descripcion: 'Segunda reducción' },
  { desde: new Date(2028, 3, 26), horas: 40, descripcion: 'Meta final' },
];

/** Índice de la etapa que rige en una fecha. */
export function indiceEtapaVigente(fecha: Date = new Date()): number {
  let indice = 0;
  ETAPAS_LEY_40.forEach((etapa, i) => {
    if (etapa.desde && etapa.desde <= fecha) indice = i;
  });
  return indice;
}

/** Jornada ordinaria máxima semanal vigente en una fecha, en horas. */
export function jornadaMaximaVigente(fecha: Date = new Date()): number {
  return ETAPAS_LEY_40[indiceEtapaVigente(fecha)].horas;
}

/** Próxima reducción aún no vigente, o `null` si ya se llegó a 40 h. */
export function proximaEtapa(fecha: Date = new Date()): EtapaJornada | null {
  return ETAPAS_LEY_40[indiceEtapaVigente(fecha) + 1] ?? null;
}

const MS_POR_DIA = 86_400_000;

/** Días calendario que faltan para una fecha (0 si ya pasó). */
export function diasHasta(destino: Date, desde: Date = new Date()): number {
  const inicio = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  return Math.max(0, Math.round((destino.getTime() - inicio.getTime()) / MS_POR_DIA));
}

/** Fecha en formato chileno dd-mm-aaaa. */
export function fechaCorta(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${fecha.getFullYear()}`;
}
