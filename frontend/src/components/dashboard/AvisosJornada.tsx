import { AlertTriangle, Info, Scale } from 'lucide-react';
import type { AvisoJornada } from '../../types';

/**
 * Avisos de incumplimiento de jornada que calcula el backend (core/jornada.py).
 *
 * Criterio de producto: Jornada40 avisa y recomienda, nunca bloquea. Estos
 * avisos tienen que verse (colores fuertes, arriba), pero no impiden guardar:
 * la decisión final es del usuario.
 *
 * Usa los estilos del panel actual; en el paso A del rediseño se reemplaza.
 */
const ESTILOS = {
  alta: { fondo: 'rgba(239,68,68,0.10)', borde: 'rgba(239,68,68,0.45)', texto: '#f87171', Icono: AlertTriangle },
  media: { fondo: 'rgba(245,158,11,0.10)', borde: 'rgba(245,158,11,0.45)', texto: '#fbbf24', Icono: Info },
} as const;

interface AvisosJornadaProps {
  avisos: AvisoJornada[] | undefined;
  /** Texto introductorio sobre la lista; p. ej. el nombre del trabajador. */
  encabezado?: string;
  compacto?: boolean;
}

export default function AvisosJornada({ avisos, encabezado, compacto = false }: AvisosJornadaProps) {
  if (!avisos?.length) return null;

  return (
    <section aria-label="Avisos de jornada" className="flex flex-col gap-2">
      {encabezado && (
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#f87171' }}>{encabezado}</p>
      )}
      {avisos.map((aviso) => {
        const e = ESTILOS[aviso.gravedad] ?? ESTILOS.media;
        return (
          <div key={aviso.codigo} role="alert" className="rounded-xl p-4 flex gap-3"
            style={{ background: e.fondo, border: `1px solid ${e.borde}` }}>
            <e.Icono size={20} className="shrink-0 mt-0.5" style={{ color: e.texto }} aria-hidden />
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: e.texto }}>{aviso.titulo}</p>
              <p className="text-sm" style={{ color: 'var(--c-text-1)' }}>{aviso.detalle}</p>
              {!compacto && (
                <>
                  <p className="text-sm" style={{ color: 'var(--c-text-2)' }}>
                    <span className="font-semibold">Recomendación: </span>{aviso.recomendacion}
                  </p>
                  <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--c-text-3)' }}>
                    <Scale size={13} aria-hidden />{aviso.articulo}
                  </p>
                </>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs" style={{ color: 'var(--c-text-3)' }}>
        Son avisos: puedes guardar igual. La decisión es tuya.
      </p>
    </section>
  );
}
