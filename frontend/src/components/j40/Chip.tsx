import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type TonoChip = 'neutro' | 'marca' | 'ok' | 'aviso' | 'peligro';

// Cada tono es un par fondo suave / color base, como en el handoff.
const TONOS: Record<TonoChip, string> = {
  neutro: 'bg-sunken text-fg-2',
  marca: 'bg-brand-soft text-brand-text',
  ok: 'bg-ok-soft text-ok',
  aviso: 'bg-warn-soft text-warn',
  peligro: 'bg-danger-soft text-danger',
};

interface ChipProps {
  tono?: TonoChip;
  icono?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Chip de estado: 11,5 px / 500, padding 2×8, radio completo. */
export function Chip({ tono = 'neutro', icono, className, children }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'text-[11.5px] font-medium leading-[1.45] whitespace-nowrap',
        TONOS[tono],
        className,
      )}
    >
      {icono}
      {children}
    </span>
  );
}
