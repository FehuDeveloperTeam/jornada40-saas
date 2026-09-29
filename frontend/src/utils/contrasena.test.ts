import { describe, expect, it } from 'vitest';
import { contrasenaAceptable, problemaContrasena, puntajeContrasena } from './contrasena';

describe('contrasena', () => {
  it('puntúa largo, mayúsculas/minúsculas, números y símbolos', () => {
    expect(puntajeContrasena('abc')).toBe(0);
    expect(puntajeContrasena('abcdefgh')).toBe(1);
    expect(puntajeContrasena('abcdefg1')).toBe(2);
    expect(puntajeContrasena('Abcdefg1!')).toBe(4);
  });

  it('replica las reglas del backend', () => {
    expect(problemaContrasena('corta')).toMatch(/8 caracteres/);
    expect(problemaContrasena('12345678')).toMatch(/solo números/);
    expect(problemaContrasena('Jornada40')).toMatch(/común/);
    expect(problemaContrasena('abcdefgh')).toMatch(/Combina/);
    expect(problemaContrasena('abcdefghijkl')).toBeNull();          // 12 caracteres bastan
    expect(contrasenaAceptable('abcdefg1')).toBe(true);
  });
});
