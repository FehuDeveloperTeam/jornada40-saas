import { CircleAlert, Info, Scale } from 'lucide-react';
import type { AvisoJornada } from '../../types';
import { cn } from '../../utils/cn';

/**
 * Avisos de jornada del backend (core/jornada.py) con el diseño nuevo.
 * Avisan y recomiendan, nunca bloquean: la decisión es del usuario.
 */
export function ListaAvisos({ avisos, compacto = false, className }: {
  avisos: AvisoJornada[] | undefined; compacto?: boolean; className?: string;
}) {
  if (!avisos?.length) return null;
  return (
    <section aria-label="Avisos de jornada" className={cn('flex flex-col gap-2', className)}>
      {avisos.map((a) => {
        const alta = a.gravedad === 'alta';
        const Icono = alta ? CircleAlert : Info;
        return (
          <div key={a.codigo} role="alert"
            className={cn('flex gap-2.5 items-start p-3 rounded-[9px]', alta ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn')}>
            <Icono className="size-[19px] shrink-0 mt-px" strokeWidth={2} aria-hidden />
            <div className="flex flex-col gap-1 text-[12.5px] min-w-0">
              <span className="font-semibold">{a.titulo}</span>
              <span className="text-fg">{a.detalle}</span>
              {!compacto && (
                <>
                  <span className="text-fg-2"><span className="font-medium">Recomendación: </span>{a.recomendacion}</span>
                  <span className="flex items-center gap-1.5 text-fg-3 text-[11.5px]">
                    <Scale className="size-3.5" strokeWidth={2} aria-hidden />{a.articulo}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
      {!compacto && <p className="text-[11.5px] text-fg-3">Son avisos: puedes guardar igual. La decisión es tuya.</p>}
    </section>
  );
}
