import { useId } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface OpcionSegmento<T extends string> {
  valor: T;
  etiqueta: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  opciones: OpcionSegmento<T>[];
  valor: T;
  onChange: (valor: T) => void;
  /** Nombre accesible del grupo, p. ej. "Tipo de cliente". */
  etiqueta: string;
  bloque?: boolean;
  /** `lg` (38 px) es el de los formularios del sitio público. */
  tamano?: 'md' | 'lg';
  className?: string;
}

/**
 * Control segmentado: contenedor `sunken` con padding 3 px y radio 10 px;
 * la opción activa sube a `surface` con sombra y un borde de 1 px.
 *
 * Es un grupo de radios, no de botones: se navega con las flechas y el
 * lector de pantalla anuncia cuál está seleccionada.
 */
export function SegmentedControl<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
  bloque = false,
  tamano = 'md',
  className,
}: SegmentedControlProps<T>) {
  const nombre = useId();

  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className={cn(
        'inline-flex p-[3px] rounded-[10px] bg-sunken gap-[2px]',
        bloque && 'flex w-full',
        className,
      )}
    >
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <label
            key={opcion.valor}
            className={cn(
              'relative flex-1 inline-flex items-center justify-center px-3.5 rounded-[8px]',
              tamano === 'lg' ? 'h-[38px] text-[13.5px]' : 'h-8 text-[13px]',
              'font-medium cursor-pointer select-none transition-colors duration-150',
              'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand-soft',
              activa
                ? 'bg-surface text-fg shadow-card ring-1 ring-line'
                : 'text-fg-2 hover:text-fg',
            )}
          >
            <input
              type="radio"
              name={nombre}
              value={opcion.valor}
              checked={activa}
              onChange={() => onChange(opcion.valor)}
              className="sr-only"
            />
            {opcion.etiqueta}
          </label>
        );
      })}
    </div>
  );
}
