import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

type Tamano = 'md' | 'lg';

// md es el del panel (40 px); lg el de los formularios del sitio público (46 px).
const TAMANOS: Record<Tamano, string> = {
  md: 'h-10 px-3 rounded-[8px] text-[14px]',
  lg: 'h-[46px] px-3.5 rounded-[10px] text-[16px]',  // 16 px: iOS no hace zoom al enfocar
};

const BASE =
  'w-full border bg-surface text-fg outline-none placeholder:text-fg-3 ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-brand focus:ring-[3px] focus:ring-brand-soft ' +
  'disabled:bg-sunken disabled:text-fg-3 disabled:cursor-not-allowed';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  tamano?: Tamano;
  /** RUT, códigos, OTP: tipografía mono con cifras tabulares. */
  mono?: boolean;
  invalido?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { tamano = 'md', mono = false, invalido = false, className, ...resto },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalido || undefined}
      className={cn(
        BASE,
        TAMANOS[tamano],
        invalido ? 'border-danger focus:border-danger focus:ring-danger-soft' : 'border-line-strong',
        mono && 'j40-mono',
        className,
      )}
      {...resto}
    />
  );
});

export interface FieldProps {
  etiqueta: ReactNode;
  /** Texto de ayuda bajo el control. Se reemplaza por el error si lo hay. */
  ayuda?: ReactNode;
  error?: ReactNode;
  /** Ocupa todas las columnas de la grilla que lo contiene. */
  anchoCompleto?: boolean;
  className?: string;
  /** Recibe el id que debe llevar el control para quedar asociado a la etiqueta. */
  children: (props: { id: string; 'aria-describedby'?: string; invalido: boolean }) => ReactNode;
}

/**
 * Etiqueta + control + ayuda/error, con la asociación de accesibilidad hecha.
 *
 *   <Field etiqueta="RUT" error={errores.rut}>
 *     {(p) => <Input {...p} mono tamano="lg" />}
 *   </Field>
 */
export function Field({ etiqueta, ayuda, error, anchoCompleto, className, children }: FieldProps) {
  const id = useId();
  const idNota = `${id}-nota`;
  const nota = error || ayuda;

  return (
    <div className={cn('flex flex-col gap-1.5', anchoCompleto && 'col-span-full', className)}>
      <label htmlFor={id} className="text-[12.5px] font-medium text-fg-2">
        {etiqueta}
      </label>
      {children({ id, 'aria-describedby': nota ? idNota : undefined, invalido: Boolean(error) })}
      {nota && (
        <p
          id={idNota}
          role={error ? 'alert' : undefined}
          className={cn('text-[12px] leading-snug', error ? 'text-danger' : 'text-fg-3')}
        >
          {nota}
        </p>
      )}
    </div>
  );
}
