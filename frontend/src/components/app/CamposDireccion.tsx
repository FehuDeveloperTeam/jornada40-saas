import { Casilla, Input } from '../j40';
import { capitalizar } from '../../utils/formato';
import type { DireccionPartes } from '../../utils/direccion';

/**
 * Calle, número (o "Sin número" con altura/kilómetro) y depto. Se ubica dentro
 * de una grilla: cada campo es una celda. `anterior` es la dirección escrita en
 * un solo campo antes de separarla, para mostrarla mientras no se complete.
 */
export function CamposDireccion({ valor, onChange, anterior, alto }: {
  valor: DireccionPartes; onChange: (v: DireccionPartes) => void; anterior?: string | null;
  /** Clase de alto para los inputs (p. ej. 'h-11' en la bienvenida). */
  alto?: string;
}) {
  const poner = (k: keyof DireccionPartes) => (e: { target: { value: string } }) => onChange({ ...valor, [k]: e.target.value });
  return (
    <>
      {anterior && !valor.calle && (
        <p className="col-span-full rounded-[10px] bg-warn-soft text-warn px-3.5 py-2.5 text-[13px]">
          Dirección registrada: <strong>{capitalizar(anterior)}</strong>. Complétala por partes (calle y número) para los documentos y la DT.
        </p>
      )}
      <Celda etiqueta="Calle, pasaje o camino">
        <Input className={alto} value={valor.calle} onChange={poner('calle')} autoComplete="address-line1" />
      </Celda>
      <div className="flex flex-col gap-1.5 min-w-0">
        <label className="flex flex-col gap-1.5 min-w-0">
          <span className="text-[12.5px] font-medium text-fg-2">{valor.sin_numero ? 'Altura o kilómetro (opcional)' : 'Número'}</span>
          <Input className={alto} value={valor.numero} onChange={poner('numero')} inputMode={valor.sin_numero ? 'text' : 'numeric'}
            placeholder={valor.sin_numero ? 'Ej.: km 2' : ''} />
        </label>
        <Casilla marcada={valor.sin_numero} onChange={(v) => onChange({ ...valor, sin_numero: v, numero: '' })}>
          Sin número (S/N)
        </Casilla>
      </div>
      <Celda etiqueta="Depto, oficina o casa (opcional)">
        <Input className={alto} value={valor.depto} onChange={poner('depto')} placeholder="Ej.: depto 34" />
      </Celda>
    </>
  );
}

function Celda({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5 min-w-0"><span className="text-[12.5px] font-medium text-fg-2">{etiqueta}</span>{children}</label>;
}
