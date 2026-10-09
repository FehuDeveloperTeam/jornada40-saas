import { useCallback, useEffect, useState } from 'react';
import type { EstadoPagina } from '../mensajes';
import { pestanaActiva, preguntar } from './pestana';
import type { Pestana } from './pestana';

export interface MiDT {
  pestana: Pestana | null;
  /** Qué muestra Mi DT (ruta, títulos, RUT del empleador). null si la pestaña no es Mi DT. */
  pagina: EstadoPagina | null;
  /** Mi DT está abierto pero sin el script de la extensión: hay que recargar la página. */
  sinScript: boolean;
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Sigue la pestaña visible: cada 2 segundos (y al cambiar de pestaña o de
 * página) pregunta a Mi DT en qué pantalla y etapa está. Mi DT cambia de etapa
 * sin recargar, por eso no basta con los eventos de las pestañas.
 */
export function useMiDT(empleador: { selector: string } | null): MiDT {
  const [estado, setEstado] = useState<MiDT>({ pestana: null, pagina: null, sinScript: false });
  const selector = empleador?.selector ?? null;

  const actualizar = useCallback(async () => {
    const pestana = await pestanaActiva();
    let pagina: EstadoPagina | null = null;
    if (pestana?.enMiDT) {
      pagina = await preguntar<EstadoPagina>(pestana, { tipo: 'estado', empleador: selector ? { selector } : null });
    }
    const nuevo: MiDT = { pestana, pagina, sinScript: Boolean(pestana?.enMiDT && pagina === null) };
    setEstado((previo) => (igual(previo, nuevo) ? previo : nuevo));
  }, [selector]);

  useEffect(() => {
    const revisar = () => void actualizar();
    // El panel lateral existe solo mientras está abierto: no hace falta pausar la revisión.
    const intervalo = window.setInterval(revisar, 2000);
    const primera = window.setTimeout(revisar, 0);
    chrome.tabs.onActivated.addListener(revisar);
    chrome.tabs.onUpdated.addListener(revisar);
    return () => {
      window.clearInterval(intervalo);
      window.clearTimeout(primera);
      chrome.tabs.onActivated.removeListener(revisar);
      chrome.tabs.onUpdated.removeListener(revisar);
    };
  }, [actualizar]);

  return estado;
}
