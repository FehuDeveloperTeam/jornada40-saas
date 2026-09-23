import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../utils/cn';
import { ETIQUETAS_PUNTAJE, puntajeContrasena } from '../../utils/contrasena';
import type { InputProps } from './Field';

/**
 * Campo de contraseña con botón para mostrarla. Mismo tamaño y estados que
 * Input `lg`; el borde y el foco los lleva el contenedor porque el botón
 * vive dentro del campo.
 */
export const InputContrasena = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'tamano' | 'mono'>>(
  function InputContrasena({ invalido = false, className, ...resto }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div
        className={cn(
          'flex items-center h-[46px] pl-3.5 pr-1.5 rounded-[10px] border bg-surface',
          'transition-[border-color,box-shadow] duration-150',
          'focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft',
          invalido ? 'border-danger' : 'border-line-strong',
          className,
        )}
      >
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          aria-invalid={invalido || undefined}
          className="flex-1 min-w-0 border-0 outline-none bg-transparent text-fg text-[15px] placeholder:text-fg-3"
          {...resto}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="grid place-items-center size-9 rounded-[8px] text-fg-3 hover:text-fg hover:bg-sunken cursor-pointer"
        >
          {visible ? <EyeOff className="size-5" strokeWidth={2} /> : <Eye className="size-5" strokeWidth={2} />}
        </button>
      </div>
    );
  },
);

const COLOR_BARRA = ['', 'bg-danger', 'bg-warn', 'bg-ok', 'bg-ok'];
const COLOR_TEXTO = ['text-fg-3', 'text-danger', 'text-warn', 'text-ok', 'text-ok'];

/** Medidor de cuatro segmentos bajo el campo de contraseña nueva. */
export function MedidorContrasena({ clave, id }: { clave: string; id?: string }) {
  const puntaje = clave ? puntajeContrasena(clave) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-4 gap-1 mt-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn('h-1 rounded-full', clave && i < puntaje ? COLOR_BARRA[puntaje] : 'bg-sunken')}
          />
        ))}
      </div>
      <span id={id} aria-live="polite" className={cn('text-[12px]', COLOR_TEXTO[puntaje])}>
        {ETIQUETAS_PUNTAJE[puntaje]}
      </span>
    </div>
  );
}
