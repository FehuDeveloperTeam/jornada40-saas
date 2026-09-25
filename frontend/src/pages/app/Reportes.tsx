import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Lock } from 'lucide-react';
import { AlertaError, Button, SegmentedControl } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import client from '../../api/client';
import { descargar } from '../../api/descargas';
import { cn } from '../../utils/cn';
import { capitalizar, clp, nombreMes } from '../../utils/formato';

interface Consolidado {
  periodo: { anio: number; mes: number | null; mes_nombre: string | null };
  kpis: { masa_salarial: number; trabajadores: number; costo_empleador: number; liquido_total: number };
  empresas: { id: number; nombre: string; rut: string; trabajadores: number; masa_salarial: number; liquido_total: number; costo_empleador: number }[];
  evolucion: { mes: number; mes_nombre: string; masa_salarial: number; liquido_total: number; costo_empleador: number; trabajadores: number }[];
}

/** Consolidado de remuneraciones de todas las empresas de la cuenta (plan Pyme+). */
export default function Reportes() {
  const { nivel, avisar, cargandoPlan } = usePanelContexto();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState<number | null>(hoy.getMonth() + 1);
  const [bajando, setBajando] = useState<string | null>(null);
  const consulta = `anio=${anio}${mes ? `&mes=${mes}` : ''}`;
  const datos = useQuery({
    queryKey: ['consolidado', anio, mes],
    queryFn: async () => {
      try {
        return (await client.get<Consolidado>(`/liquidaciones/consolidado/?${consulta}`)).data;
      } catch (err) {
        // El backend responde 404 cuando el período no tiene liquidaciones: es un estado vacío, no un error.
        if (isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: !cargandoPlan && nivel >= 3,
    retry: false,
  });

  // Mientras llega la suscripción no se sabe el nivel: no mostrar un bloqueo que quizá no corresponde.
  if (cargandoPlan) {
    return <Marco><p className="text-[14px] text-fg-3" role="status">Cargando…</p></Marco>;
  }

  if (nivel < 3) {
    return (
      <Marco>
        <section className="bg-surface border border-line rounded-j40-card shadow-card p-6 flex flex-col gap-3 items-start">
          <span className="inline-flex items-center gap-2 text-[14px] font-medium"><Lock className="size-4" strokeWidth={2} aria-hidden />Reportes multiempresa desde el plan Pyme</span>
          <p className="text-[13px] text-fg-3 max-w-[520px]">Masa salarial, costo empleador y líquido de todas tus empresas en un solo lugar, por mes o por año.</p>
          <Link to="/app/plan" className="text-[13px] font-medium">Ver planes</Link>
        </section>
      </Marco>
    );
  }

  const exportar = async (formato: 'excel' | 'pdf') => {
    setBajando(formato);
    const e = await descargar(`/liquidaciones/consolidado/?${consulta}&formato=${formato}`,
      `Consolidado_${mes ? `${nombreMes(mes)}_` : ''}${anio}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`);
    setBajando(null);
    if (e) avisar(e, 'error'); else avisar('Reporte descargado');
  };

  const d = datos.data;
  const maxMes = Math.max(1, ...(d?.evolucion ?? []).map((p) => p.costo_empleador));
  const maxEmpresa = Math.max(1, ...(d?.empresas ?? []).map((e) => e.costo_empleador));

  return (
    <Marco acciones={
      <>
        <Button variante="secundario" cargando={bajando === 'excel'} onClick={() => exportar('excel')} iconoInicio={<FileSpreadsheet className="size-4" strokeWidth={2} />}>Excel</Button>
        <Button variante="secundario" cargando={bajando === 'pdf'} onClick={() => exportar('pdf')} iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>
      </>
    }>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-[10px] bg-sunken p-[3px]">
          <Button variante="fantasma" tamano="sm" soloIcono aria-label="Año anterior" onClick={() => setAnio(anio - 1)}><ChevronLeft className="size-4" strokeWidth={2} /></Button>
          <span className="px-2 text-[13.5px] font-semibold j40-num">{anio}</span>
          <Button variante="fantasma" tamano="sm" soloIcono aria-label="Año siguiente" onClick={() => setAnio(anio + 1)}><ChevronRight className="size-4" strokeWidth={2} /></Button>
        </div>
        <SegmentedControl etiqueta="Período" valor={mes ? 'mes' : 'anio'} onChange={(v) => setMes(v === 'mes' ? hoy.getMonth() + 1 : null)}
          opciones={[{ valor: 'mes', etiqueta: 'Un mes' }, { valor: 'anio', etiqueta: 'Todo el año' }]} />
        {mes && (
          <select aria-label="Mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}
            className="h-9 px-3 rounded-j40-control border border-line-strong bg-surface text-[13.5px]">
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{nombreMes(i + 1)}</option>)}
          </select>
        )}
      </div>

      {datos.error && <AlertaError>{(isAxiosError(datos.error) && (datos.error.response?.data as { error?: string } | undefined)?.error) || 'No pudimos cargar el reporte.'}</AlertaError>}
      {datos.isLoading ? <p className="text-[14px] text-fg-3" role="status">Cargando…</p>
        : d === null ? (
          <section className="bg-surface border border-line rounded-j40-card shadow-card p-6 text-[13.5px] text-fg-2">
            No hay liquidaciones emitidas en {mes ? `${nombreMes(mes).toLowerCase()} de ${anio}` : anio}. Emítelas en Remuneraciones para verlas aquí.
          </section>
        ) : !d ? null : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
            <Kpi t="Masa salarial (haberes)" v={clp(d.kpis.masa_salarial)} />
            <Kpi t="Costo empleador" v={clp(d.kpis.costo_empleador)} destacado />
            <Kpi t="Líquido a pagar" v={clp(d.kpis.liquido_total)} />
            <Kpi t="Trabajadores liquidados" v={String(d.kpis.trabajadores)} />
          </div>

          {!mes && (
            <Seccion titulo={`Costo empleador por mes · ${anio}`}>
              <div className="flex items-end gap-2 h-[200px] pt-4" role="img" aria-label="Costo empleador por mes">
                {d.evolucion.map((p) => (
                  <div key={p.mes} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1.5" title={`${p.mes_nombre}: ${clp(p.costo_empleador)}`}>
                    <div className="w-full max-w-[40px] rounded-t-[5px] bg-brand" style={{ height: `${(p.costo_empleador / maxMes) * 100}%` }} />
                    <span className="text-[11px] text-fg-3">{p.mes_nombre.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
            </Seccion>
          )}

          <Seccion titulo={`Por empresa · ${d.periodo.mes_nombre ? `${d.periodo.mes_nombre} ` : ''}${d.periodo.anio}`}>
            {d.empresas.length === 0 && <p className="text-[13px] text-fg-3">No hay liquidaciones emitidas en este período.</p>}
            {d.empresas.map((e) => (
              <div key={e.id} className="flex flex-col gap-1.5 py-2.5 border-b border-line last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-medium">{capitalizar(e.nombre)} <span className="text-fg-3 j40-mono text-[12px]">{e.rut}</span></span>
                  <span className="text-fg-2 j40-num">{e.trabajadores} trab. · haberes {clp(e.masa_salarial)} · líquido {clp(e.liquido_total)} · <strong className="text-fg">costo {clp(e.costo_empleador)}</strong></span>
                </div>
                <span className="h-2 rounded-full bg-sunken overflow-hidden"><span className={cn('block h-full rounded-full bg-brand')} style={{ width: `${(e.costo_empleador / maxEmpresa) * 100}%` }} /></span>
              </div>
            ))}
          </Seccion>
        </>
      )}
    </Marco>
  );
}

function Marco({ acciones, children }: { acciones?: ReactNode; children: ReactNode }) {
  return (
    <div className="max-w-[1280px] mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Reportes multiempresa</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">Consolidado de remuneraciones de todas tus empresas</p>
        </div>
        <div className="flex gap-2">{acciones}</div>
      </div>
      {children}
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="bg-surface border border-line rounded-j40-card shadow-card p-[18px] flex flex-col gap-2"><h2 className="text-[14px] font-semibold">{titulo}</h2>{children}</section>;
}

function Kpi({ t, v, destacado }: { t: string; v: string; destacado?: boolean }) {
  return (
    <div className="bg-surface border border-line rounded-j40-card shadow-card px-4 py-3.5 flex flex-col gap-1 min-w-0">
      <span className="text-[12px] text-fg-3">{t}</span>
      <span className={cn('text-[22px] font-semibold j40-num truncate', destacado && 'text-brand-text')}>{v}</span>
    </div>
  );
}
