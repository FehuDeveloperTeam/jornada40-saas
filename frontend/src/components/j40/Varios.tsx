import type { ReactNode } from 'react';
import { Circle, CircleAlert, CircleDot, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../utils/cn';

/** Botón cuadrado de 38 px que alterna claro/oscuro. */
export function ToggleTema({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const oscuro = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={oscuro ? 'Usar tema claro' : 'Usar tema oscuro'}
      title="Cambiar tema"
      className={cn(
        'grid place-items-center size-[38px] rounded-j40-control border border-line bg-surface text-fg-2',
        'hover:text-fg cursor-pointer',
        className,
      )}
    >
      {oscuro ? <Sun className="size-5" strokeWidth={2} /> : <Moon className="size-5" strokeWidth={2} />}
    </button>
  );
}

interface TarjetaOpcionProps {
  seleccionada: boolean;
  onSeleccionar: () => void;
  titulo: ReactNode;
  detalle?: ReactNode;
  /** Contenido a la derecha, p. ej. el precio del plan. */
  extremo?: ReactNode;
  className?: string;
}

/**
 * Opción seleccionable con aspecto de tarjeta (tipo de cliente, plan).
 * Se comporta como radio: `role="radio"` dentro de un `role="radiogroup"`.
 */
export function TarjetaOpcion({ seleccionada, onSeleccionar, titulo, detalle, extremo, className }: TarjetaOpcionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={seleccionada}
      onClick={onSeleccionar}
      className={cn(
        'flex items-start gap-2.5 p-3 rounded-[10px] border-[1.5px] text-left text-fg cursor-pointer',
        'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft',
        seleccionada ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface hover:bg-surface-2',
        className,
      )}
    >
      {seleccionada
        ? <CircleDot className="size-5 shrink-0 text-brand-text" strokeWidth={2} aria-hidden />
        : <Circle className="size-5 shrink-0 text-fg-3" strokeWidth={2} aria-hidden />}
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-[13.5px] font-medium">{titulo}</span>
        {detalle && <span className="text-[11.5px] text-fg-3">{detalle}</span>}
      </span>
      {extremo}
    </button>
  );
}

/** Aviso en línea de error (p. ej. "Revisa tu correo y contraseña"). */
export function AlertaError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-center gap-2.5 px-3.5 py-3 rounded-[10px] bg-danger-soft text-danger text-[13px]">
      <CircleAlert className="size-[19px] shrink-0" strokeWidth={2} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Casilla con texto al lado, tamaño 18 px y acento de marca. */
export function Casilla({
  marcada, onChange, children, invalida,
}: { marcada: boolean; onChange: (v: boolean) => void; children: ReactNode; invalida?: boolean }) {
  return (
    <label className="flex items-start gap-2.5 text-[13.5px] text-fg-2 cursor-pointer">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalida || undefined}
        className="size-[18px] mt-0.5 shrink-0 accent-brand cursor-pointer"
      />
      <span>{children}</span>
    </label>
  );
}
