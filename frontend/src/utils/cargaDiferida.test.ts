import { afterEach, describe, expect, it, vi } from 'vitest';
import { recargarPorVersion } from './cargaDiferida';

describe('recargarPorVersion', () => {
  afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

  it('recarga una sola vez cada 10 segundos para no entrar en bucle', () => {
    const recargar = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload: recargar });
    expect(recargarPorVersion()).toBe(true);
    expect(recargarPorVersion()).toBe(false);
    expect(recargar).toHaveBeenCalledTimes(1);
  });
});
