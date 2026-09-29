import { describe, expect, it } from 'vitest';
import { esRutDePersona, estadoRut, formatRut, validateRut } from './rutUtils';

describe('rutUtils', () => {
  it('formatea con puntos y guion, con K en mayúscula', () => {
    expect(formatRut('123456785')).toBe('12.345.678-5');
    expect(formatRut('76.000.555-k')).toBe('76.000.555-K');
    expect(formatRut('1')).toBe('1');
  });

  it('valida el dígito verificador', () => {
    expect(validateRut('12.345.678-5')).toBe(true);
    expect(validateRut('76000555K')).toBe(true);
    expect(validateRut('11.111.111-1')).toBe(true);
    expect(validateRut('12.345.678-9')).toBe(false);
    expect(validateRut('')).toBe(false);
    expect(validateRut('1-9')).toBe(false);
  });

  it('no marca como inválido un RUT a medio escribir', () => {
    expect(estadoRut('12.345')).toBe('incompleto');
    expect(estadoRut('12.345.678-5')).toBe('valido');
    expect(estadoRut('12.345.678-0')).toBe('invalido');
  });

  it('distingue personas de empresas por los 50 millones', () => {
    expect(esRutDePersona('12.345.678-5')).toBe(true);
    expect(esRutDePersona('76.000.555-K')).toBe(false);
    expect(esRutDePersona('-')).toBe(false);
  });
});
