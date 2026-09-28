import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface CampoCodigoProps {
  valor: string;
  onChange: (codigo: string) => void;
  /** Se llama al completar los 6 dígitos. */
  onCompleto?: (codigo: string) => void;
  deshabilitado?: boolean;
  autoFocus?: boolean;
  etiqueta?: string;
}

/**
 * Código de 6 dígitos: un solo campo real (autocompletado del SMS o del
 * correo en móvil) bajo 6 casillas visuales. 16 px para que iOS no haga zoom.
 */
export const CampoCodigo = forwardRef<HTMLInputElement, CampoCodigoProps>(function CampoCodigo(
  { valor, onChange, onCompleto, deshabilitado, autoFocus, etiqueta = 'Código de 6 dígitos' }, ref,
) {
  return (
    <label className="relative block cursor-text">
      <span className="sr-only">{etiqueta}</span>
      <input ref={ref} autoFocus={autoFocus} value={valor} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
        disabled={deshabilitado}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          onChange(v);
          if (v.length === 6) onCompleto?.(v);
        }}
        className="peer absolute inset-0 w-full h-full opacity-0 text-[16px]" />
      <span className="grid grid-cols-6 gap-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={cn('h-14 rounded-[10px] border bg-surface grid place-items-center text-[22px] font-semibold j40-mono',
            i === Math.min(valor.length, 5) ? 'border-brand ring-[3px] ring-brand-soft peer-focus:border-brand' : 'border-line-strong')}>
            {valor[i] ?? ''}
          </span>
        ))}
      </span>
    </label>
  );
});
