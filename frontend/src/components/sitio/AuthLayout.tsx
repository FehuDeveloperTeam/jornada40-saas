import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Lock } from 'lucide-react';
import { J40Root, Logo, ToggleTema } from '../j40';
import { jornadaMaximaVigente } from '../../utils/ley40';

interface AuthLayoutProps {
  /** Mensaje del panel oscuro lateral (solo escritorio y tablet). */
  titulo: string;
  descripcion: string;
  children: ReactNode;
}

/**
 * Pantallas de acceso: panel oscuro a la izquierda con el mensaje de la
 * pantalla y dos garantías, y el formulario a la derecha en una columna de
 * 440 px. Bajo 760 px el panel desaparece y el logo pasa a la barra superior.
 */
export function AuthLayout({ titulo, descripcion, children }: AuthLayoutProps) {
  return (
    <J40Root className="flex">
      <aside className="hidden min-[760px]:flex flex-[0_0_min(44%,560px)] sticky top-0 h-screen flex-col justify-between gap-10 bg-ink text-white px-[clamp(32px,4vw,56px)] py-10">
        <Link to="/" aria-label="Jornada40, inicio" className="self-start no-underline hover:no-underline">
          <span className="inline-flex items-center gap-2.5">
            <Logo soloIcono tamano={38} />
            <span className="text-[17px] font-semibold text-white">
              Jornada<span className="text-[#86BDF5]">40</span>
            </span>
          </span>
        </Link>

        <div className="flex flex-col gap-3.5 max-w-[420px]">
          <h2 className="text-[clamp(26px,2.8vw,36px)] leading-[1.15] font-semibold tracking-[-0.025em] text-balance">
            {titulo}
          </h2>
          <p className="text-[15px] text-white/72 text-pretty">{descripcion}</p>
        </div>

        <ul className="flex flex-col gap-3 text-[13px] text-white/72">
          <li className="flex items-center gap-2.5">
            <Lock className="size-[19px] text-[#86BDF5]" strokeWidth={2} aria-hidden />
            Sesión protegida con cookies seguras
          </li>
          <li className="flex items-center gap-2.5">
            <Clock className="size-[19px] text-[#86BDF5]" strokeWidth={2} aria-hidden />
            Jornada máxima vigente: {jornadaMaximaVigente()} horas
          </li>
        </ul>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2.5 h-16 px-[clamp(16px,3vw,32px)]">
          <Link to="/" className="min-[760px]:hidden no-underline hover:no-underline" aria-label="Jornada40, inicio">
            <Logo tamano={34} />
          </Link>
          <Link to="/"
            className="hidden min-[760px]:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-[8px] text-fg-2 text-[13px] font-medium no-underline hover:no-underline hover:bg-sunken hover:text-fg">
            <ArrowLeft className="size-[18px]" strokeWidth={2} aria-hidden />
            Volver al sitio
          </Link>
          <div className="flex-1" />
          <ToggleTema />
        </div>

        <div className="flex-1 flex justify-center px-[clamp(16px,3vw,32px)] pt-[clamp(16px,4vw,48px)] pb-12">
          <div className="w-full max-w-[440px] flex flex-col gap-6 j40-anim-pop">{children}</div>
        </div>
      </main>
    </J40Root>
  );
}

/** Título de formulario (26 px) con su bajada. */
export function EncabezadoForm({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{titulo}</h1>
      {children && <p className="text-fg-2 text-[14px]">{children}</p>}
    </div>
  );
}
