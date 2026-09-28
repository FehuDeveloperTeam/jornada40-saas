import { useState } from 'react';
import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import { Button, Chip } from '../j40';
import { portal } from '../../api/portal';
import type { TipoDocumentoPortal } from '../../types';
import { cn } from '../../utils/cn';
import { usePortal } from './PortalShell';

/** Tarjeta con encabezado (título 14/600 y acción a la derecha). */
export function Seccion({ titulo, subtitulo, accion, children, className }: {
  titulo: ReactNode; subtitulo?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn('bg-surface border border-line rounded-j40-card shadow-card flex flex-col min-w-0', className)}>
      <div className="flex items-center justify-between gap-2.5 flex-wrap px-[18px] py-3 min-h-[52px] border-b border-line">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold">{titulo}</h2>
          {subtitulo && <p className="text-[12px] text-fg-3">{subtitulo}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

export function Titulo({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[clamp(20px,2.4vw,24px)] font-semibold tracking-[-0.015em]">{titulo}</h1>
      {children && <p className="text-[13.5px] text-fg-2">{children}</p>}
    </div>
  );
}

/** Estado de una lista: cargando, error o vacía. Devuelve null si hay datos. */
export function EstadoLista({ cargando, error, vacia, textoVacio }: {
  cargando: boolean; error: boolean; vacia: boolean; textoVacio: string;
}) {
  if (cargando) return <p className="px-[18px] py-6 text-[13px] text-fg-3" role="status">Cargando…</p>;
  if (error) return <p className="px-[18px] py-6 text-[13px] text-danger" role="alert">No pudimos cargar esta información. Intenta de nuevo en un momento.</p>;
  if (vacia) return <p className="px-[18px] py-6 text-[13px] text-fg-3">{textoVacio}</p>;
  return null;
}

export function ChipFirmado({ firmado, texto = 'Firmado' }: { firmado: boolean; texto?: string }) {
  return firmado ? <Chip tono="ok">{texto}</Chip> : null;
}

/** Botón que descarga un PDF del portal; si falla, avisa con el mensaje del backend. */
export function BotonDescarga({ tipo, id, nombre, etiqueta }: {
  tipo: TipoDocumentoPortal; id: number; nombre: string; etiqueta: string;
}) {
  const { avisar } = usePortal();
  const [descargando, setDescargando] = useState(false);
  const bajar = async () => {
    setDescargando(true);
    const error = await portal.descargar(tipo, id, nombre);
    setDescargando(false);
    if (error) avisar(error, 'error');
  };
  return (
    <Button variante="secundario" tamano="sm" onClick={bajar} cargando={descargando} aria-label={etiqueta} title={etiqueta}
      iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>
  );
}
