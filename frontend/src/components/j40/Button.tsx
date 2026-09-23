import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'peligro-contorno';
// sm y md son del panel; lg es del sitio público, que usa controles más grandes.
type Tamano = 'sm' | 'md' | 'lg';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-brand-btn border-brand-btn text-white hover:brightness-110',
  secundario: 'bg-surface border-line-strong text-fg hover:bg-surface-2',
  fantasma: 'bg-transparent border-transparent text-fg-2 hover:bg-sunken hover:text-fg',
  // En oscuro, `danger` es un salmón claro pensado para texto: con letra
  // blanca encima el contraste cae a 2,6:1. El texto oscuro lo deja en 7,2:1.
  peligro: 'bg-danger border-danger text-white oscuro:text-canvas hover:brightness-110',
  // El destructivo habitual del panel: acción secundaria con texto rojo.
  'peligro-contorno': 'bg-surface border-line-strong text-danger hover:bg-danger-soft',
};

const TAMANOS: Record<Tamano, string> = {
  sm: 'h-8 px-3 rounded-[8px] text-[12.5px] gap-1.5',
  md: 'h-10 px-4 rounded-j40-control text-[13px] gap-2',
  lg: 'h-12 px-[22px] rounded-[11px] text-[15px] gap-2',
};

// Botón solo con ícono: cuadrado, del alto de su tamaño.
const TAMANOS_ICONO: Record<Tamano, string> = {
  sm: 'size-8 rounded-[8px]',
  md: 'size-[38px] rounded-j40-control',
  lg: 'size-12 rounded-[11px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  /** Muestra un spinner y deshabilita el botón. El texto se mantiene: el
   *  handoff pide cargas con texto ("Verificando…"), así que se pasa desde fuera. */
  cargando?: boolean;
  /** Botón cuadrado solo con ícono. Requiere `aria-label`. */
  soloIcono?: boolean;
  bloque?: boolean;
  iconoInicio?: ReactNode;
  iconoFin?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variante = 'primario',
    tamano = 'md',
    cargando = false,
    soloIcono = false,
    bloque = false,
    iconoInicio,
    iconoFin,
    className,
    disabled,
    children,
    type = 'button',
    ...resto
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(
        'inline-flex items-center justify-center border font-medium whitespace-nowrap',
        'cursor-pointer transition-[background-color,filter,color] duration-150',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft focus-visible:border-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTES[variante],
        soloIcono ? cn(TAMANOS_ICONO[tamano], 'p-0') : TAMANOS[tamano],
        bloque && 'w-full',
        className,
      )}
      {...resto}
    >
      {cargando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : iconoInicio}
      {children}
      {!cargando && iconoFin}
    </button>
  );
});
