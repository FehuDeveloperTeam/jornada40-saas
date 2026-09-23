import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from './Button';

interface ModalProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** Botones del pie. Si no se pasan, el modal no tiene pie. */
  acciones?: ReactNode;
  /** `dialogo` (480 px) para confirmaciones y formularios cortos; `amplio`
   *  (620 px) para la paleta de comandos y el checkout. */
  ancho?: 'dialogo' | 'amplio';
  children: ReactNode;
}

const ANCHOS = {
  dialogo: 'w-[min(480px,calc(100vw-24px))]',
  amplio: 'w-[min(620px,calc(100vw-24px))]',
} as const;

/**
 * Modal centrado sobre `overlay`. Cierra con Esc y con clic afuera, bloquea el
 * scroll del fondo y devuelve el foco a quien lo abrió.
 *
 * Se monta en un portal con su propio `data-j40`: un portal sale del árbol DOM
 * de <J40Root>, así que sin esto perdería los tokens del tema.
 */
export function Modal({ abierto, onCerrar, titulo, subtitulo, acciones, ancho = 'dialogo', children }: ModalProps) {
  const idTitulo = useId();
  const panel = useRef<HTMLDivElement>(null);

  // El callback va en un ref para que el efecto dependa solo de `abierto`. Si
  // dependiera de `onCerrar`, un padre que pasa una función inline haría
  // correr el efecto en cada render y le quitaría el foco al input en que el
  // usuario está escribiendo.
  const cerrar = useRef(onCerrar);
  useEffect(() => {
    cerrar.current = onCerrar;
  });

  useEffect(() => {
    if (!abierto) return;

    const previo = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current();
    };
    document.addEventListener('keydown', alTeclear);

    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflowPrevio;
      previo?.focus?.();
    };
  }, [abierto]);

  if (!abierto) return null;

  // Hereda el tema del documento: J40Root marca su nodo, no <html>.
  const tema = document.querySelector('[data-j40]')?.getAttribute('data-j40') ?? 'claro';

  return createPortal(
    <div data-j40={tema} className="font-sans text-[14px] leading-[1.5] text-fg">
      <div className="fixed inset-0 z-[85] bg-overlay" onClick={onCerrar} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={cn(
          'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[86]',
          ANCHOS[ancho],
          'max-h-[calc(100vh-24px)] overflow-y-auto outline-none',
          'bg-surface border border-line rounded-j40-modal shadow-pop j40-anim-pop',
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-[18px] pb-3">
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-[16px] font-semibold text-fg">{titulo}</h2>
            {subtitulo && <p className="text-[13px] text-fg-3 mt-1">{subtitulo}</p>}
          </div>
          <Button variante="fantasma" tamano="sm" soloIcono aria-label="Cerrar" onClick={onCerrar}>
            <X className="size-4" strokeWidth={2} />
          </Button>
        </div>
        <div className="px-5 pb-5">{children}</div>
        {acciones && (
          <div className="flex justify-end gap-2 px-5 py-3.5 bg-surface-2 border-t border-line rounded-b-j40-modal">
            {acciones}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
