import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CierreInactividad } from './CierreInactividad';
import { marcarActividad } from '../../utils/actividad';

const avanzar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('CierreInactividad', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('avisa un minuto antes y cierra a los 5 minutos sin actividad', () => {
    const alVencer = vi.fn();
    render(<CierreInactividad acceso="panel" minutos={5} alVencer={alVencer} />);
    avanzar(3 * 60_000);
    expect(screen.queryByText('¿Sigues ahí?')).toBeNull();
    avanzar(61_000);
    expect(screen.getByText('¿Sigues ahí?')).toBeTruthy();
    expect(alVencer).not.toHaveBeenCalled();
    avanzar(60_000);
    expect(alVencer).toHaveBeenCalledTimes(1);
  });

  it('"Seguir trabajando" reinicia el plazo y renueva la sesión', () => {
    const alVencer = vi.fn();
    const latido = vi.fn(() => Promise.resolve());
    render(<CierreInactividad acceso="panel" minutos={5} alVencer={alVencer} latido={latido} />);
    avanzar(4 * 60_000 + 5_000);
    fireEvent.click(screen.getByRole('button', { name: 'Seguir trabajando' }));
    expect(latido).toHaveBeenCalled();
    avanzar(3 * 60_000);
    expect(alVencer).not.toHaveBeenCalled();
  });

  it('la actividad mantiene la sesión y la renueva en el servidor', () => {
    const alVencer = vi.fn();
    const latido = vi.fn(() => Promise.resolve());
    render(<CierreInactividad acceso="panel" minutos={5} alVencer={alVencer} latido={latido} />);
    for (let i = 0; i < 8; i++) {
      avanzar(60_000);
      fireEvent.keyDown(window, { key: 'a' });
    }
    expect(alVencer).not.toHaveBeenCalled();
    expect(latido).toHaveBeenCalled();
  });

  it('al volver después de cerrar la pestaña, si pasó el plazo, cierra de inmediato', () => {
    marcarActividad('panel');
    vi.setSystemTime(Date.now() + 6 * 60_000);
    const alVencer = vi.fn();
    render(<CierreInactividad acceso="panel" minutos={5} alVencer={alVencer} />);
    expect(alVencer).toHaveBeenCalledTimes(1);
  });
});
