import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Lock } from 'lucide-react';
import { usePermisos } from '../../hooks/usePermisos';
import type { ModuloPanel } from '../../types';

/**
 * Cerco de una pantalla del panel para los usuarios del equipo. El backend es
 * quien protege los datos; esto evita abrir una pantalla que solo mostraría
 * errores y avisa cuando la sección es de solo lectura.
 *
 * - `titular`: solo el titular de la cuenta (empresa, plan, usuarios…).
 * - `modulos`: basta uno de ellos; `gestionar` pide "ver y gestionar".
 * - `avisoLectura`: muestra el aviso de solo lectura (no en la carpeta, que
 *   mezcla secciones de varios módulos y cada una se cuida sola).
 */
export function ConPermiso({ modulos, gestionar = false, titular = false, avisoLectura = true, children }: {
  modulos?: ModuloPanel[]; gestionar?: boolean; titular?: boolean; avisoLectura?: boolean; children: ReactNode;
}) {
  const { cargando, esTitular, puede } = usePermisos();
  if (cargando) return <p className="text-[13px] text-fg-3" role="status">Cargando…</p>;
  if (esTitular) return children;
  const permitido = titular ? false : !modulos || puede(modulos, gestionar);
  if (!permitido) {
    return (
      <div className="max-w-[560px] mx-auto mt-8 flex flex-col items-center gap-3 text-center">
        <span className="grid place-items-center size-12 rounded-full bg-sunken text-fg-2">
          <Lock className="size-6" strokeWidth={2} aria-hidden />
        </span>
        <h1 className="text-[20px] font-semibold">No tienes acceso a esta sección</h1>
        <p className="text-[15px] text-fg-2">
          {titular
            ? 'Solo el titular de la cuenta puede entrar aquí.'
            : 'El titular de la cuenta no te asignó esta sección. Si la necesitas, pídesela.'}
        </p>
        <Link to="/app" className="mt-1 h-11 px-5 inline-flex items-center rounded-[10px] bg-brand text-white text-[15px] font-medium no-underline hover:no-underline">
          Volver al inicio
        </Link>
      </div>
    );
  }
  const soloVer = avisoLectura && Boolean(modulos) && !puede(modulos!, true);
  return (
    <>
      {soloVer && (
        <div role="note" className="max-w-[1440px] mx-auto mb-4 flex items-center gap-2.5 px-4 py-3 rounded-j40-card bg-sunken text-fg-2 text-[14px]">
          <Eye className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          <span>Tienes <strong>solo lectura</strong> en esta sección: puedes ver y descargar, pero no crear ni modificar.</span>
        </div>
      )}
      {children}
    </>
  );
}
