import { describe, expect, it } from 'vitest';
import { enmascarar, normalizar, rutLimpio } from './textos';

describe('normalizar', () => {
  it('compara sin tildes, mayúsculas ni espacios de más', () => {
    expect(normalizar('  Región  de   Ñuble ')).toBe('region de nuble');
    expect(normalizar('JORNADA ORDINARIA')).toBe(normalizar('Jornada ordinaria'));
    expect(normalizar(null)).toBe('');
  });
});

describe('enmascarar', () => {
  it('tapa RUT y correos, con o sin puntos y guion', () => {
    expect(enmascarar('Empleador: 76.123.456-7 (contacto@empresa.cl)')).toBe('Empleador: [rut] ([correo])');
    expect(enmascarar('RUT 12345678-K y 9876543-2')).toBe('RUT [rut] y [rut]');
  });

  it('deja un texto corto en una línea', () => {
    expect(enmascarar('Datos\n   del   trabajador')).toBe('Datos del trabajador');
    expect(enmascarar('x'.repeat(400))).toHaveLength(300);
  });
});

describe('rutLimpio', () => {
  it('deja solo dígitos y la K en mayúscula', () => {
    expect(rutLimpio('12.345.678-k')).toBe('12345678K');
    expect(rutLimpio(undefined)).toBe('');
  });
});
