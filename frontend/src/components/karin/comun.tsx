import type { ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { TriangleAlert } from 'lucide-react';
import type { EstadoPlazoKarin, OpcionKarin } from '../../types';
import { cn } from '../../utils/cn';

// Utilidades del acceso Ley Karin: letra grande y pocos pasos (usuarios mayores).

 
export const CONTROL = 'h-11 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[15px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';
 
export const AREA = 'w-full min-h-[130px] px-3 py-2.5 rounded-j40-control border border-line-strong bg-surface text-fg text-[15px] leading-relaxed outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';

// eslint-disable-next-line react-refresh/only-export-components
export const mensajeError = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

export function Seccion({ titulo, icono, children, id }: { titulo: string; icono?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="bg-surface border border-line rounded-j40-card shadow-card p-5 flex flex-col gap-4">
      <h2 className="flex items-center gap-3 text-[18px] font-semibold">{icono}{titulo}</h2>
      {children}
    </section>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2.5 items-start rounded-[10px] bg-warn-soft text-warn px-4 py-3 text-[14.5px] leading-relaxed">
      <TriangleAlert className="size-5 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />{children}
    </p>
  );
}

const PLAZO: Record<EstadoPlazoKarin, { texto: string; clase: string }> = {
  CUMPLIDO: { texto: 'Hecho', clase: 'bg-ok-soft text-ok' },
  VENCIDO: { texto: 'Vencido', clase: 'bg-danger-soft text-danger' },
  POR_VENCER: { texto: 'Por vencer', clase: 'bg-warn-soft text-warn' },
  PENDIENTE: { texto: 'Pendiente', clase: 'bg-sunken text-fg-2' },
  ESPERA: { texto: 'En espera', clase: 'bg-sunken text-fg-3' },
};

export function ChipPlazo({ estado }: { estado: EstadoPlazoKarin }) {
  return <span className={cn('inline-flex items-center h-7 px-2.5 rounded-full text-[13px] font-semibold whitespace-nowrap', PLAZO[estado].clase)}>{PLAZO[estado].texto}</span>;
}

export function Selector({ etiqueta, valor, onChange, opciones, vacio = 'Elige una opción', id }: {
  etiqueta: string; valor: string; onChange: (v: string) => void; opciones: OpcionKarin[]; vacio?: string; id: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[13.5px] font-medium text-fg-2">
      {etiqueta}
      <select id={id} value={valor} onChange={(e) => onChange(e.target.value)} className={CONTROL}>
        <option value="">{vacio}</option>
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
    </label>
  );
}

export function Texto({ etiqueta, valor, onChange, id, tipo = 'text', ayuda }: {
  etiqueta: string; valor: string; onChange: (v: string) => void; id: string; tipo?: string; ayuda?: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[13.5px] font-medium text-fg-2">
      {etiqueta}
      <input id={id} type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} className={CONTROL} autoComplete="off" />
      {ayuda && <span className="text-[12.5px] font-normal text-fg-3">{ayuda}</span>}
    </label>
  );
}
