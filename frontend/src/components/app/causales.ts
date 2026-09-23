// Mismas causales que el backend (Finiquito.CAUSAL_ARTICULO_CHOICES), agrupadas por artículo.
export const CAUSALES: { grupo: string; items: [string, string][] }[] = [
  { grupo: 'Art. 159 — Causales objetivas', items: [
    ['159_1', 'N°1 — Mutuo acuerdo de las partes'], ['159_2', 'N°2 — Renuncia voluntaria del trabajador'],
    ['159_3', 'N°3 — Muerte del trabajador'], ['159_4', 'N°4 — Vencimiento del plazo convenido'],
    ['159_5', 'N°5 — Conclusión del trabajo o servicio'], ['159_6', 'N°6 — Caso fortuito o fuerza mayor'],
  ] },
  { grupo: 'Art. 160 — Causales disciplinarias', items: [
    ['160_1a', 'N°1 a) — Falta de probidad'], ['160_1b', 'N°1 b) — Acoso sexual'],
    ['160_1c', 'N°1 c) — Vías de hecho'], ['160_1d', 'N°1 d) — Injurias al empleador'],
    ['160_1e', 'N°1 e) — Conducta inmoral grave'], ['160_1f', 'N°1 f) — Acoso laboral'],
    ['160_2', 'N°2 — Negociaciones prohibidas'], ['160_3', 'N°3 — Inasistencias injustificadas'],
    ['160_4a', 'N°4 a) — Salida intempestiva'], ['160_4b', 'N°4 b) — Negativa injustificada a trabajar'],
    ['160_5', 'N°5 — Actos que afectan la seguridad'], ['160_6', 'N°6 — Daño material intencional'],
    ['160_7', 'N°7 — Incumplimiento grave del contrato'],
  ] },
  { grupo: 'Art. 161 — Decisión del empleador', items: [
    ['161_1', 'Inc. 1° — Necesidades de la empresa'], ['161_2', 'Inc. 2° — Desahucio del empleador'],
  ] },
  { grupo: 'Otras', items: [['163bis', 'Art. 163 bis — Liquidación concursal del empleador']] },
];

/** Causales que dan derecho a indemnización por años de servicio y aviso previo. */
export const CAUSALES_CON_INDEMNIZACION = ['161_1', '161_2', '163bis'];

export function etiquetaCausal(codigo: string): string {
  for (const g of CAUSALES) {
    const item = g.items.find(([v]) => v === codigo);
    if (item) return `${g.grupo.split(' — ')[0]} ${item[1]}`;
  }
  return codigo;
}
