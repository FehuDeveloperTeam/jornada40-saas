import { afterEach, describe, expect, it, vi } from 'vitest';
import { antiguedad, capitalizar, clp, fechaCL, fechaLarga, fechaLocal, hoyISO, iniciales, nombreMes, periodo } from './formato';

describe('formato', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('formatea pesos chilenos redondeando y con signo', () => {
    expect(clp(1450000)).toBe('$1.450.000');
    expect(clp('999.6')).toBe('$1.000');
    expect(clp(-2500)).toBe('−$2.500');
    expect(clp(null)).toBe('$0');
  });

  it('lee fechas ISO sin corrimiento de zona horaria', () => {
    const f = fechaLocal('2026-09-22T00:00:00Z');
    expect([f?.getFullYear(), f?.getMonth(), f?.getDate()]).toEqual([2026, 8, 22]);
    expect(fechaLocal('')).toBeNull();
    expect(fechaCL('2026-01-05')).toBe('05-01-2026');
    expect(fechaCL(null)).toBe('—');
    expect(fechaLarga(new Date(2026, 8, 22))).toBe('Martes 22 de septiembre de 2026');
  });

  it('usa el día de Chile y no el de UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T02:30:00Z'));   // 23:30 del 22 en Santiago (UTC−3)
    expect(hoyISO()).toBe('2026-09-22');
  });

  it('nombra meses y períodos', () => {
    expect(nombreMes(1)).toBe('Enero');
    expect(nombreMes(12)).toBe('Diciembre');
    expect(periodo(8, 2026)).toBe('Agosto 2026');
  });

  it('calcula la antigüedad en años y meses', () => {
    const hoy = new Date(2026, 8, 22);
    expect(antiguedad('2022-06-01', hoy)).toBe('4 años 3 meses');
    expect(antiguedad('2025-09-22', hoy)).toBe('1 año');
    expect(antiguedad('2026-09-01', hoy)).toBe('0 meses');
    expect(antiguedad('2026-11-01', hoy)).toBe('Aún no ingresa');
    expect(antiguedad(null, hoy)).toBe('—');
  });

  it('arma iniciales y capitaliza nombres guardados en mayúsculas', () => {
    expect(iniciales('Matías', 'Soto', 'Rojas')).toBe('MS');
    expect(iniciales(null, 'ana')).toBe('A');
    expect(capitalizar('MATÍAS IGNACIO PÉREZ-COTAPOS')).toBe('Matías Ignacio Pérez-Cotapos');
    expect(capitalizar(undefined)).toBe('');
  });
});
