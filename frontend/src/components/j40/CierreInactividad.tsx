import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { leerActividad as leer, marcarActividad } from '../../utils/actividad';

/**
 * Cierre de sesión por inactividad (panel, equipo, Ley Karin, portal del
 * trabajador e inspector).
 *
 * - La última actividad (mouse, teclado, toques, scroll) se guarda en
 *   localStorage por acceso: todas las pestañas comparten el mismo reloj, y al
 *   volver tras cerrar la pestaña o el navegador se compara con esa hora.
 * - Un minuto antes avisa con un botón grande "Seguir trabajando".
 * - Mientras hay actividad, `latido` renueva la sesión del servidor cada
 *   `LATIDO_MS`, para que escribir un formulario largo sin guardar no la venza.
 * - El servidor vence por su cuenta (JWT de 5/15 min, cookies firmadas), así
 *   que esto es la parte visible, no la única barrera.
 */
const LATIDO_MS = 2 * 60_000;
const ESCRIBIR_CADA_MS = 10_000;
const AVISO_SEG = 60;
const EVENTOS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

export function CierreInactividad({ acceso, minutos, alVencer, latido }: {
  /** Nombre del acceso: 'panel', 'karin', 'portal', 'inspeccion'. */
  acceso: string;
  minutos: number;
  /** Cerrar la sesión y volver al ingreso (se llama una sola vez). */
  alVencer: () => void;
  /** Petición que renueva la sesión en el servidor. */
  latido?: () => Promise<unknown>;
}) {
  const [restantes, setRestantes] = useState<number | null>(null);
  const ultima = useRef(0);   // se fija al montar (efecto)
  const escrita = useRef(0);
  const ultimoLatido = useRef(0);
  const vencida = useRef(false);
  const avisando = useRef(false);
  const fns = useRef({ alVencer, latido });
  useEffect(() => { fns.current = { alVencer, latido }; });

  useEffect(() => {
    const limite = minutos * 60_000;
    const guardada = leer(acceso);
    // Volvió después de cerrar la pestaña o el navegador: si pasó el plazo, se cierra.
    if (guardada !== null && Date.now() - guardada >= limite) {
      vencida.current = true;
      fns.current.alVencer();
      return;
    }
    ultima.current = guardada ?? Date.now();
    ultimoLatido.current = Date.now();
    if (guardada === null) marcarActividad(acceso);

    const actividad = () => {
      if (avisando.current || vencida.current) return;   // con el aviso abierto, solo cuenta el botón
      const ahora = Date.now();
      ultima.current = ahora;
      if (ahora - escrita.current > ESCRIBIR_CADA_MS) {
        escrita.current = ahora;
        marcarActividad(acceso);
      }
    };
    EVENTOS.forEach((e) => window.addEventListener(e, actividad, { passive: true }));

    const reloj = window.setInterval(() => {
      if (vencida.current) return;
      const ahora = Date.now();
      // Otra pestaña pudo tener actividad más reciente.
      const compartida = leer(acceso);
      if (compartida !== null && compartida > ultima.current) ultima.current = compartida;
      const inactivo = ahora - ultima.current;
      if (inactivo >= limite) {
        vencida.current = true;
        setRestantes(null);
        fns.current.alVencer();
        return;
      }
      const quedan = Math.ceil((limite - inactivo) / 1000);
      avisando.current = quedan <= AVISO_SEG;
      setRestantes(avisando.current ? quedan : null);
      // Renovar en el servidor solo si hubo actividad desde el último latido.
      if (fns.current.latido && ultima.current > ultimoLatido.current && ahora - ultimoLatido.current >= LATIDO_MS) {
        ultimoLatido.current = ahora;
        fns.current.latido().catch(() => undefined);
      }
    }, 1000);

    return () => {
      EVENTOS.forEach((e) => window.removeEventListener(e, actividad));
      window.clearInterval(reloj);
    };
  }, [acceso, minutos]);

  const seguir = () => {
    avisando.current = false;
    ultima.current = Date.now();
    marcarActividad(acceso);
    setRestantes(null);
    ultimoLatido.current = Date.now();
    fns.current.latido?.().catch(() => undefined);
  };

  return (
    <Modal abierto={restantes !== null} onCerrar={seguir} titulo="¿Sigues ahí?"
      acciones={<Button tamano="lg" onClick={seguir}>Seguir trabajando</Button>}>
      <div className="flex items-start gap-3 text-[15.5px] text-fg-2">
        <Clock className="size-6 shrink-0 text-warn" strokeWidth={2} aria-hidden />
        <p role="timer" aria-live="polite">
          Por seguridad, tu sesión se cerrará en <strong className="text-fg j40-num">{restantes ?? 0} segundos</strong> por
          inactividad. Lo que no hayas guardado se perderá.
        </p>
      </div>
    </Modal>
  );
}
