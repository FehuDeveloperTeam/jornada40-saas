import { describe, expect, it } from 'vitest';
import { codigoCompleto, normalizarCodigo } from './codigos';

describe('códigos de verificación', () => {
  it('normaliza en grupos de 4, en mayúsculas y sin símbolos', () => {
    expect(normalizarCodigo('ab12cd34ef56')).toBe('AB12-CD34-EF56');
    expect(normalizarCodigo(' ab 12-c ')).toBe('AB12-C');
    expect(normalizarCodigo('AB12-CD34-EF56-XYZ')).toBe('AB12-CD34-EF56');
    expect(normalizarCodigo('')).toBe('');
  });

  it('solo considera completo un código de 12 caracteres', () => {
    expect(codigoCompleto('AB12CD34EF56')).toBe(true);
    expect(codigoCompleto('AB12CD34EF5')).toBe(false);
  });
});
