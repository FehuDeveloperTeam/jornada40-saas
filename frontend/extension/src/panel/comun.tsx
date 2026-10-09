import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, CircleAlert, CircleCheck, Copy, Info, Loader2, TriangleAlert } from 'lucide-react';
import { cn } from '../../../src/utils/cn';
import { ENTORNO, SITIO, VERSION } from '../configuracion';
import { abrirPagina } from './pestana';
import { copiarTexto, textoParaCopiar } from './util';

type Tono = 'info' | 'aviso' | 'peligro' | 'ok';

const TONOS: Record<Tono, string> = {
  info: 'bg-brand-soft text-brand-text',
  aviso: 'bg-warn-soft text-warn',
  peligro: 'bg-danger-soft text-danger',
  ok: 'bg-ok-soft text-ok',
};
const ICONOS = { info: Info, aviso: TriangleAlert, peligro: CircleAlert, ok: CircleCheck };

/** Mensaje en línea con letra grande (muchos titulares son adultos mayores). */
export function Aviso({ tono = 'info', titulo, children, accion }: {
  tono?: Tono; titulo?: ReactNode; children?: ReactNode; accion?: ReactNode;
}) {
  const Icono = ICONOS[tono];
  return (
    <div role={tono === 'peligro' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 px-3.5 py-3 rounded-[10px] text-[14px] leading-snug', TONOS[tono])}>
      <Icono className="size-5 shrink-0 mt-px" strokeWidth={2} aria-hidden />
      <div className="flex flex-col gap-1 min-w-0">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="break-words">{children}</div>}
        {accion && <div className="mt-1.5 flex flex-wrap gap-2">{accion}</div>}
      </div>
    </div>
  );
}

export function Tarjeta({ titulo, children, className }: { titulo?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('bg-surface border border-line rounded-j40-card shadow-card', className)}>
      {titulo && <h2 className="px-4 pt-3.5 text-[15px] font-semibold">{titulo}</h2>}
      <div className="px-4 py-3.5 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-fg-3 text-[14px]">
      <Loader2 className="size-4 animate-spin" aria-hidden />{texto}
    </p>
  );
}

/** Logo cuadrado de Jornada40, dibujado (sin imágenes externas). */
export function Marca() {
  return (
    <span aria-hidden
      className="grid place-items-center size-9 shrink-0 rounded-[9px] bg-navy text-white text-[12px] font-bold tracking-tight">
      J40
    </span>
  );
}

export function Casilla({ marcada, onChange, children }: { marcada: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 text-[14px] text-fg-2 cursor-pointer">
      <input type="checkbox" checked={marcada} onChange={(e) => onChange(e.target.checked)}
        className="size-[18px] mt-0.5 shrink-0 accent-brand cursor-pointer" />
      <span>{children}</span>
    </label>
  );
}

/** Botón "Copiar" de un dato de la ficha, con confirmación visible. */
export function BotonCopiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [estado, setEstado] = useState<'listo' | 'copiado' | 'error'>('listo');
  const copiar = async () => {
    setEstado((await copiarTexto(textoParaCopiar(texto))) ? 'copiado' : 'error');
    window.setTimeout(() => setEstado('listo'), 1800);
  };
  return (
    <button type="button" onClick={() => void copiar()} aria-label={`Copiar ${etiqueta}`}
      className={cn('inline-flex items-center gap-1 h-8 px-2.5 rounded-[8px] border text-[13px] font-medium shrink-0 cursor-pointer',
        estado === 'copiado' ? 'border-ok text-ok bg-ok-soft' : estado === 'error' ? 'border-danger text-danger' : 'border-line-strong text-brand-text bg-surface hover:bg-surface-2')}>
      {estado === 'copiado'
        ? <><Check className="size-4" strokeWidth={2.5} aria-hidden />Copiado</>
        : estado === 'error' ? 'No se pudo' : <><Copy className="size-4" strokeWidth={2} aria-hidden />Copiar</>}
    </button>
  );
}

const NOMBRE_ENTORNO: Record<string, string> = { staging: 'pruebas', desarrollo: 'desarrollo' };

export function Pie() {
  return (
    <p className="text-[12px] text-fg-3 flex flex-wrap gap-x-3 gap-y-1">
      <span>Versión {VERSION}{NOMBRE_ENTORNO[ENTORNO] ? ` · ${NOMBRE_ENTORNO[ENTORNO]}` : ''}</span>
      <button type="button" className="underline cursor-pointer" onClick={() => void abrirPagina(`${SITIO}/privacidad/extension`)}>
        Privacidad
      </button>
    </p>
  );
}

/** Enlace con aspecto de texto (acciones secundarias del pie). */
export function BotonTexto({ children, onClick, peligro }: { children: ReactNode; onClick: () => void; peligro?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('text-[13.5px] font-medium underline-offset-2 hover:underline cursor-pointer', peligro ? 'text-danger' : 'text-brand-text')}>
      {children}
    </button>
  );
}
