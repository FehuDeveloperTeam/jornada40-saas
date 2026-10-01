import { Navigate, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import client from '../../api/client';
import { AlertaError, Button, J40Root, Logo, ToggleTema } from '../j40';
import type { CatalogosKarin, SesionKarin } from '../../types';

interface ContextoKarin { yo: SesionKarin; catalogos: CatalogosKarin | undefined }

// eslint-disable-next-line react-refresh/only-export-components
export function useKarin(): ContextoKarin {
  return useOutletContext<ContextoKarin>();
}

/**
 * Marco del acceso Ley Karin: encabezado propio y sesión del encargado
 * (`/api/karin/yo/`). Sin sesión vuelve al ingreso; nada de esto usa la
 * sesión del panel de la empresa.
 */
export default function KarinShell() {
  const navigate = useNavigate();
  const sesion = useQuery({
    queryKey: ['karin', 'yo'],
    queryFn: async () => (await client.get<SesionKarin>('/karin/yo/')).data,
    retry: false,
  });
  const catalogos = useQuery({
    queryKey: ['karin', 'catalogos'],
    queryFn: async () => (await client.get<CatalogosKarin>('/karin/denuncias/catalogos/')).data,
    enabled: Boolean(sesion.data),
    staleTime: 60 * 60_000,
  });

  if (sesion.isLoading) {
    return <J40Root className="min-h-dvh grid place-items-center bg-canvas"><p className="text-[15px] text-fg-3" role="status">Cargando…</p></J40Root>;
  }
  if (sesion.isError || !sesion.data) {
    if (isAxiosError(sesion.error) && [401, 403].includes(sesion.error.response?.status ?? 0)) return <Navigate to="/karin" replace />;
    return (
      <J40Root className="min-h-dvh grid place-items-center bg-canvas px-4">
        <AlertaError>No pudimos conectar con Jornada40. Recarga la página en un momento.</AlertaError>
      </J40Root>
    );
  }

  const salir = async () => {
    try { await client.post('/karin/salir/', {}); } catch { /* la cookie vence sola */ }
    navigate('/karin', { replace: true });
  };

  return (
    <J40Root className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="max-w-[980px] mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/karin/panel" aria-label="Inicio del acceso Ley Karin" className="no-underline hover:no-underline"><Logo tamano={28} /></Link>
          <span className="text-[15px] font-semibold text-fg-2 hidden min-[520px]:inline">Acceso Ley Karin</span>
          <span className="flex-1" />
          <ToggleTema />
          <Button variante="secundario" onClick={() => void salir()} iconoInicio={<LogOut className="size-4" strokeWidth={2} />}>Salir</Button>
        </div>
      </header>
      <main className="max-w-[980px] mx-auto px-4 py-8 flex flex-col gap-5 pb-20">
        <Outlet context={{ yo: sesion.data, catalogos: catalogos.data } satisfies ContextoKarin} />
      </main>
    </J40Root>
  );
}
