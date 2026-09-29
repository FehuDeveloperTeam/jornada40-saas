import { describe, expect, it } from 'vitest';
import { diasHasta, fechaCorta, jornadaMaximaVigente, proximaEtapa } from './ley40';

describe('ley40', () => {
  it('cambia el máximo exactamente el 26 de abril de cada etapa', () => {
    expect(jornadaMaximaVigente(new Date(2024, 3, 25))).toBe(45);
    expect(jornadaMaximaVigente(new Date(2024, 3, 26))).toBe(44);
    expect(jornadaMaximaVigente(new Date(2026, 3, 25))).toBe(44);
    expect(jornadaMaximaVigente(new Date(2026, 3, 26))).toBe(42);
    expect(jornadaMaximaVigente(new Date(2028, 3, 26))).toBe(40);
  });

  it('indica la próxima reducción o null al llegar a 40 h', () => {
    expect(proximaEtapa(new Date(2026, 8, 29))?.horas).toBe(40);
    expect(proximaEtapa(new Date(2030, 0, 1))).toBeNull();
  });

  it('cuenta días calendario sin negativos', () => {
    expect(diasHasta(new Date(2028, 3, 26), new Date(2028, 3, 25, 23, 59))).toBe(1);
    expect(diasHasta(new Date(2020, 0, 1), new Date(2026, 0, 1))).toBe(0);
    expect(fechaCorta(new Date(2028, 3, 26))).toBe('26-04-2028');
  });
});
