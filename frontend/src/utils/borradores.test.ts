import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { borrarTodosLosBorradores, claveBorrador, guardarBorrador, leerBorrador, VIGENCIA_BORRADOR_MS } from './borradores';

describe('borradores', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('guarda y recupera por usuario y formulario', () => {
    const clave = claveBorrador(7, 'contrato-1-nuevo');
    guardarBorrador(clave, { cargo: 'Vendedora' });
    expect(leerBorrador<{ cargo: string }>(clave)?.valor.cargo).toBe('Vendedora');
    expect(leerBorrador(claveBorrador(8, 'contrato-1-nuevo'))).toBeNull();
  });

  it('vence a las 24 horas', () => {
    const clave = claveBorrador(7, 'liquidacion');
    guardarBorrador(clave, 1);
    vi.setSystemTime(Date.now() + VIGENCIA_BORRADOR_MS + 1000);
    expect(leerBorrador(clave)).toBeNull();
  });

  it('al cerrar sesión a mano se borran todos, sin tocar otras preferencias', () => {
    guardarBorrador(claveBorrador(7, 'a'), 1);
    localStorage.setItem('j40-empresa', '3');
    borrarTodosLosBorradores();
    expect(leerBorrador(claveBorrador(7, 'a'))).toBeNull();
    expect(localStorage.getItem('j40-empresa')).toBe('3');
  });
});
