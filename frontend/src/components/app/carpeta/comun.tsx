import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Chip } from '../../j40';
import type { TonoChip } from '../../j40';
import type { SolicitudFirma } from '../../../types';
import { cn } from '../../../utils/cn';
import { ETAPAS_LEY_40 } from '../../../utils/ley40';

const ESTADO_FIRMA: Record<string, { texto: string; tono: TonoChip }> = {
  FIRMADO: { texto: 'Firmado', tono: 'ok' },
  PENDIENTE: { texto: 'Pendiente de firma', tono: 'aviso' },
  RECHAZADO: { texto: 'Rechazado', tono: 'peligro' },
  EXPIRADO: { texto: 'Expirado', tono: 'neutro' },
  CANCELADO: { texto: 'Cancelado', tono: 'neutro' },
};

export function ChipFirma({ firma, corto }: { firma: SolicitudFirma | undefined; corto?: boolean }) {
  if (!firma) return <Chip>Sin enviar</Chip>;
  const e = ESTADO_FIRMA[firma.estado] ?? ESTADO_FIRMA.CANCELADO;
  return <Chip tono={e.tono}>{corto && firma.estado === 'PENDIENTE' ? 'Pendiente' : e.texto}</Chip>;
}

/** Tarjeta con encabezado del diseño (título 14/600 + acción a la derecha). */
export function Seccion({ titulo, accion, children, className }: {
  titulo: ReactNode; accion?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn('bg-surface border border-line rounded-j40-card shadow-card flex flex-col', className)}>
      <div className="flex items-center justify-between gap-2.5 flex-wrap px-[18px] py-3 min-h-[52px] border-b border-line">
        <h3 className="text-[14px] font-semibold">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

/** Enlace con aspecto de acción secundaria (texto de marca). */
export function EnlaceAccion({ a, children }: { a: string; children: ReactNode }) {
  return <Link to={a} className="text-brand-text text-[12.5px] font-medium">{children}</Link>;
}

export function BotonEnlace({ a, children, primario, className, icono }: {
  a: string; children: ReactNode; primario?: boolean; className?: string; icono?: ReactNode;
}) {
  return (
    <Link to={a} className={cn(
      'inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-[8px] border text-[13px] font-medium no-underline hover:no-underline whitespace-nowrap',
      primario ? 'bg-brand-btn border-brand-btn text-white hover:brightness-110' : 'bg-surface border-line-strong text-fg hover:bg-surface-2',
      className,
    )}>{icono}{children}</Link>
  );
}

/**
 * Barra de horas semanales frente al calendario de la ley. La escala va de 0
 * al máximo histórico (45 h); las etapas quedan como marcas y solo se rotula
 * la vigente, porque 40, 42 y 44 están demasiado cerca para rotularlas todas.
 */
export function BarraJornada({ horas, maximo }: { horas: number; maximo: number }) {
  const escala = 46;
  const pct = (h: number) => `${Math.min(100, (h / escala) * 100)}%`;
  const marcas = ETAPAS_LEY_40.map((e) => e.horas).filter((h) => h <= 44);
  const excede = horas > maximo;
  return (
    <div className="relative h-[30px]" role="img" aria-label={`${horas} horas semanales; máximo vigente ${maximo} horas`}>
      <div className="absolute inset-x-0 top-1 h-2 rounded-full bg-sunken" />
      {/* Posiciones calculadas: dependen de las horas, no hay clase fija. */}
      <div className={cn('absolute left-0 top-1 h-2 rounded-full transition-[width] duration-300', excede ? 'bg-danger' : 'bg-brand')}
        style={{ width: pct(horas) }} />
      {marcas.map((h) => (
        <span key={h} title={`${h} h`} className={cn('absolute top-0 h-4 w-0.5', h === maximo ? 'bg-fg' : 'bg-fg-3 opacity-60')}
          style={{ left: pct(h) }} />
      ))}
      <span className="absolute top-[18px] -translate-x-full text-[11px] font-semibold text-fg whitespace-nowrap"
        style={{ left: `calc(${pct(maximo)} + 1px)` }}>máx. {maximo} h</span>
    </div>
  );
}
