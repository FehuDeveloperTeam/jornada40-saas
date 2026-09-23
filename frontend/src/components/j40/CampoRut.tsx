import { useId } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { cn } from '../../utils/cn';
import { estadoRut, formatRut } from '../../utils/rutUtils';
import type { EstadoRut } from '../../utils/rutUtils';
import { Input } from './Field';

const MENSAJES: Record<EstadoRut, { texto: string; clase: string; Icono: typeof Info }> = {
  incompleto: { texto: 'Con dígito verificador', clase: 'text-fg-3', Icono: Info },
  valido: { texto: 'RUT válido', clase: 'text-ok', Icono: CircleCheck },
  invalido: { texto: 'Dígito verificador incorrecto', clase: 'text-danger', Icono: CircleAlert },
};

interface CampoRutProps {
  etiqueta: string;
  valor: string;
  onChange: (rut: string) => void;
  placeholder?: string;
  /** El registro usa 46 px; el onboarding, 44 px. */
  compacto?: boolean;
  anchoCompleto?: boolean;
  /** Fuerza el estado de error aunque el RUT aún esté incompleto (al enviar). */
  forzarError?: boolean;
}

/**
 * RUT con formato automático (12.345.678-5) y validación del dígito
 * verificador mientras se escribe. El valor que entrega ya viene formateado
 * con rutUtils: es el formato con que el backend guarda el RUT y con el que
 * busca al usuario al iniciar sesión.
 */
export function CampoRut({
  etiqueta, valor, onChange, placeholder = '12.345.678-9', compacto, anchoCompleto, forzarError,
}: CampoRutProps) {
  const id = useId();
  const estado = forzarError && estadoRut(valor) !== 'valido' ? 'invalido' : estadoRut(valor);
  const { texto, clase, Icono } = MENSAJES[estado];

  return (
    <div className={cn('flex flex-col gap-1.5', anchoCompleto && 'col-span-full')}>
      <label htmlFor={id} className="text-[12.5px] font-medium text-fg-2">{etiqueta}</label>
      <Input
        id={id}
        tamano="lg"
        mono
        inputMode="text"
        autoComplete="off"
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(formatRut(e.target.value))}
        invalido={estado === 'invalido'}
        aria-describedby={`${id}-estado`}
        className={cn(compacto && 'h-11', estado === 'valido' && 'border-ok')}
      />
      <span id={`${id}-estado`} className={cn('flex items-center gap-1.5 text-[12px]', clase)}>
        <Icono className="size-[15px] shrink-0" strokeWidth={2} aria-hidden />
        {texto}
      </span>
    </div>
  );
}
