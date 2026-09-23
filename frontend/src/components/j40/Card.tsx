import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export function Card({ className, ...resto }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface border border-line rounded-j40-card shadow-card', className)}
      {...resto}
    />
  );
}

interface CardHeaderProps {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** Acciones alineadas a la derecha del encabezado. */
  acciones?: ReactNode;
  className?: string;
}

/** Encabezado de tarjeta: título 14/600, padding 14×18 y borde inferior. */
export function CardHeader({ titulo, subtitulo, acciones, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 flex-wrap px-[18px] py-3.5 border-b border-line',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold text-fg">{titulo}</h3>
        {subtitulo && <p className="text-[12px] text-fg-3 mt-0.5">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex items-center gap-2">{acciones}</div>}
    </div>
  );
}

export function CardBody({ className, ...resto }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-[18px]', className)} {...resto} />;
}

/** Pie de tarjeta sobre `surface-2`, típico para acciones o totales. */
export function CardFooter({ className, ...resto }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-[18px] py-3 bg-surface-2 border-t border-line rounded-b-j40-card',
        className,
      )}
      {...resto}
    />
  );
}
