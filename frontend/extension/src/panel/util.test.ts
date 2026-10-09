import { describe, expect, it } from 'vitest';
import type { ItemRegistroDT } from '../../../src/types';
import { formatearCodigo, nombrePorDefecto, plazo, porRegistrar, textoParaCopiar } from './util';

const item = (clave: string, estado: ItemRegistroDT['estado'], vence: string, dias: number | null = 5): ItemRegistroDT => ({
  clave, tipo: 'CONTRATO', detalle: 'Contrato indefinido', empleado: { id: 1, nombre: clave, rut: '1-9', activo: true },
  fecha: '2026-10-01', vence, estado, dias_habiles_restantes: dias, registrado_en: null,
});

describe('formatearCodigo', () => {
  it('deja el código como ABCD-EFGH mientras se escribe', () => {
    expect(formatearCodigo('abcd')).toBe('ABCD');
    expect(formatearCodigo('abcde')).toBe('ABCD-E');
    expect(formatearCodigo(' ab-cd ef gh xyz')).toBe('ABCD-EFGH');
  });
});

describe('nombrePorDefecto', () => {
  it('nombra el navegador y el sistema', () => {
    expect(nombrePorDefecto('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0 Safari/537.36')).toBe('Chrome en Windows');
    expect(nombrePorDefecto('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/129.0 Safari/537.36 Edg/129.0')).toBe('Edge en Mac');
  });
});

describe('porRegistrar', () => {
  it('quita los registrados y pone los vencidos primero, luego por vencimiento', () => {
    const lista = porRegistrar([
      item('C', 'PENDIENTE', '2026-10-20'),
      item('R', 'REGISTRADO', '2026-10-01'),
      item('B', 'PENDIENTE', '2026-10-12'),
      item('A', 'VENCIDO', '2026-10-05'),
    ]);
    expect(lista.map((i) => i.clave)).toEqual(['A', 'B', 'C']);
  });
});

describe('plazo', () => {
  it('lo dice en palabras', () => {
    expect(plazo(item('x', 'VENCIDO', '2026-10-05'))).toEqual({ texto: 'Venció el 05-10-2026', tono: 'peligro' });
    expect(plazo(item('x', 'PENDIENTE', '2026-10-08', 0)).texto).toBe('Vence hoy');
    expect(plazo(item('x', 'PENDIENTE', '2026-10-09', 1))).toEqual({ texto: 'Queda 1 día hábil (09-10-2026)', tono: 'aviso' });
    expect(plazo(item('x', 'PENDIENTE', '2026-10-20', 8)).tono).toBe('neutro');
  });
});

describe('textoParaCopiar', () => {
  it('copia los montos solo con dígitos y deja igual el resto', () => {
    expect(textoParaCopiar('$1.000.000')).toBe('1000000');
    expect(textoParaCopiar('$0')).toBe('0');
    expect(textoParaCopiar('12.345.678-5')).toBe('12.345.678-5');
    expect(textoParaCopiar('Quincenal: $200.000 el día 15')).toBe('Quincenal: $200.000 el día 15');
  });
});
