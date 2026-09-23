import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';

interface DrawerProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** Botones del pie fijo. */
  acciones?: ReactNode;
  children: ReactNode;
}

/**
 * Panel lateral derecho de hasta 620 px sobre `overlay`: encabezado con
 * título y subtítulo, cuerpo con scroll y pie fijo con las acciones.
 * Cierra con Esc y con clic afuera, bloquea el scroll del fondo y devuelve el
 * foco a quien lo abrió. Como el Modal, lleva su propio `data-j40` porque el
 * portal sale del árbol de <J40Root>.
 */
export function Drawer({ abierto, onCerrar, titulo, subtitulo, acciones, children }: DrawerProps) {
  const idTitulo = useId();
  const panel = useRef<HTMLElement>(null);
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
  const tema = document.querySelector('[data-j40]')?.getAttribute('data-j40') ?? 'claro';

  return createPortal(
    <div data-j40={tema} className="font-sans text-[14px] leading-[1.45] text-fg">
      <div className="fixed inset-0 z-[70] bg-overlay" onClick={onCerrar} aria-hidden />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className="fixed top-0 right-0 bottom-0 z-[71] w-[min(620px,100vw)] flex flex-col bg-surface shadow-pop outline-none j40-anim-slide"
      >
        <div className="flex items-start gap-3 px-5 py-[18px] border-b border-line">
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <h2 id={idTitulo} className="text-[17px] font-semibold tracking-[-0.01em]">{titulo}</h2>
            {subtitulo && <p className="text-[12.5px] text-fg-3">{subtitulo}</p>}
          </div>
          <Button variante="fantasma" soloIcono aria-label="Cerrar" onClick={onCerrar} className="size-9">
            <X className="size-[21px]" strokeWidth={2} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-[22px]">{children}</div>
        {acciones && (
          <div className="flex justify-end gap-2 px-5 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] border-t border-line bg-surface-2">
            {acciones}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
