import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart2, Activity } from 'lucide-react';
import type { UseDashboardReturn } from '../../../hooks/useDashboard';
import client from '../../../api/client';

// ─── Tipos ──────────────────────────────────────────────────────────────────

type Props = {
  liquidaciones: UseDashboardReturn['liquidaciones'];
  empleadoId: number | null;
};

interface HistorialStats {
  contrato_sueldo_base: number | null;
  contrato_tipo: string | null;
  promedio_liquido: number;
  tendencia_3m: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const clp = (n: number) =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const clpShort = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return clp(n);
};

// ─── Tooltip personalizado ───────────────────────────────────────────────────

interface TooltipPayload { color: string; name: string; value: number; }

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: TooltipPayload[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl p-3 shadow-xl text-xs space-y-1.5"
      style={{ background: 'var(--c-bg-modal)', border: '1px solid var(--c-border-2)' }}
    >
      <p className="font-bold mb-2" style={{ color: 'var(--c-text-1)' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--c-text-2)' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold" style={{ color: 'var(--c-text-1)' }}>{clp(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Delta badge ─────────────────────────────────────────────────────────────

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: 'var(--c-text-3)' }}>—</span>;
  if (pct === 0) return (
    <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#94a3b8' }}>
      <Minus size={11} /> 0%
    </span>
  );
  const pos = pct > 0;
  return (
    <span className="flex items-center gap-1 text-xs font-bold" style={{ color: pos ? '#34d399' : '#f87171' }}>
      {pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {pos ? '+' : ''}{pct}%
    </span>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function TabHistorialSalarial({ liquidaciones, empleadoId }: Props) {
  const [stats, setStats] = useState<HistorialStats | null>(null);

  useEffect(() => {
    if (!empleadoId) return;
    const controller = new AbortController();
    client.get(`/empleados/${empleadoId}/historial_salarial/`, { signal: controller.signal })
      .then(res => setStats(res.data))
      .catch(() => {});
    return () => controller.abort();
  }, [empleadoId]);

  if (!liquidaciones.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--c-bg-input)' }}
        >
          <Activity size={20} style={{ color: 'var(--c-text-4)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--c-text-3)' }}>
          Sin liquidaciones registradas
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--c-text-4)' }}>
          El historial salarial se construye a partir de las liquidaciones generadas.
        </p>
      </div>
    );
  }

  // Ordenar ascendente
  const ordenadas = [...liquidaciones].sort((a, b) =>
    a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes
  );

  // Datos del gráfico
  const chartData = ordenadas.map((liq, i) => {
    const prev = ordenadas[i - 1];
    const delta = prev
      ? Math.round(((liq.sueldo_liquido - prev.sueldo_liquido) / prev.sueldo_liquido) * 100 * 10) / 10
      : null;
    return {
      periodo: `${MESES[liq.mes - 1]} ${liq.anio}`,
      'Sueldo base':    liq.sueldo_base,
      'Total haberes':  liq.total_haberes,
      'Sueldo líquido': liq.sueldo_liquido,
      delta,
      raw: liq,
    };
  });

  // KPIs
  const ultima = ordenadas[ordenadas.length - 1];
  const penultima = ordenadas.length >= 2 ? ordenadas[ordenadas.length - 2] : null;
  const variacionUlt = penultima
    ? Math.round(((ultima.sueldo_liquido - penultima.sueldo_liquido) / penultima.sueldo_liquido) * 100 * 10) / 10
    : null;
  const maxLiquido = Math.max(...ordenadas.map(l => l.sueldo_liquido));
  const minLiquido = Math.min(...ordenadas.map(l => l.sueldo_liquido));

  // Promedio: preferir valor del servidor, fallback cliente
  const promedio = stats?.promedio_liquido
    ?? Math.round(ordenadas.reduce((s, l) => s + l.sueldo_liquido, 0) / ordenadas.length);

  // Tendencia: preferir valor del servidor, fallback delta último mes
  const tendencia = stats !== null ? stats.tendencia_3m : variacionUlt;

  return (
    <div className="space-y-5 p-1">

      {/* ── KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Último líquido */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-1"
          style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={12} style={{ color: '#60a5fa' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-3)' }}>
              Último líquido
            </span>
          </div>
          <p className="text-lg font-extrabold leading-none" style={{ color: 'var(--c-text-1)' }}>{clpShort(ultima.sueldo_liquido)}</p>
          <div className="mt-1"><DeltaBadge pct={variacionUlt} /></div>
        </div>

        {/* Promedio histórico */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-1"
          style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart2 size={12} style={{ color: '#c084fc' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-3)' }}>
              Promedio
            </span>
          </div>
          <p className="text-lg font-extrabold leading-none" style={{ color: 'var(--c-text-1)' }}>{clpShort(promedio)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--c-text-3)' }}>
            {ordenadas.length} período{ordenadas.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Tendencia 3M */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-1"
          style={{
            background: tendencia === null ? 'var(--c-bg-card-2)'
              : tendencia >= 0 ? 'rgba(52,211,153,0.07)' : 'rgba(239,68,68,0.07)',
            border: tendencia === null ? '1px solid var(--c-border)'
              : tendencia >= 0 ? '1px solid rgba(52,211,153,0.18)' : '1px solid rgba(239,68,68,0.18)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {tendencia === null || tendencia === 0
              ? <Minus size={12} style={{ color: 'var(--c-text-3)' }} />
              : tendencia > 0
                ? <TrendingUp size={12} style={{ color: '#34d399' }} />
                : <TrendingDown size={12} style={{ color: '#f87171' }} />
            }
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-3)' }}>
              Tendencia 3M
            </span>
          </div>
          {tendencia !== null ? (
            <p
              className="text-lg font-extrabold leading-none"
              style={{ color: tendencia >= 0 ? '#34d399' : '#f87171' }}
            >
              {tendencia > 0 ? '+' : ''}{tendencia}%
            </p>
          ) : (
            <p className="text-lg font-extrabold leading-none" style={{ color: 'var(--c-text-4)' }}>—</p>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--c-text-3)' }}>
            {stats !== null ? 'vs 3 meses ant.' : 'vs mes anterior'}
          </p>
        </div>
      </div>

      {/* ── Sueldo contractual (si disponible) ────────────────────── */}
      {stats?.contrato_sueldo_base != null && (
        <div
          className="flex items-center justify-between px-4 py-2.5 rounded-xl text-xs"
          style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)' }}
        >
          <span className="font-bold uppercase tracking-wider" style={{ color: 'rgba(251,191,36,0.7)' }}>
            Sueldo base contractual
          </span>
          <span className="font-extrabold" style={{ color: '#fbbf24' }}>
            {clp(stats.contrato_sueldo_base)}
          </span>
        </div>
      )}

      {/* ── Gráfico ───────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--c-bg-card-2)', border: '1px solid var(--c-border)' }}
      >
        <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--c-text-3)' }}>
          Evolución salarial
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="hgBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="hgHaberes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="hgLiquido" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
            <XAxis
              dataKey="periodo"
              tick={{ fill: 'var(--c-text-3)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--c-border)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={clpShort}
              tick={{ fill: 'var(--c-text-3)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--c-text-3)', paddingTop: 8 }} />

            {stats?.contrato_sueldo_base != null && (
              <ReferenceLine
                y={stats.contrato_sueldo_base}
                stroke="#fbbf24"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{
                  value: `Base: ${clpShort(stats.contrato_sueldo_base)}`,
                  position: 'insideTopRight',
                  fontSize: 9,
                  fill: '#fbbf24',
                }}
              />
            )}

            <Area
              type="monotone" dataKey="Sueldo base"
              stroke="#2563eb" strokeWidth={1.5}
              fill="url(#hgBase)" dot={false}
              activeDot={{ r: 4, fill: '#2563eb' }}
            />
            <Area
              type="monotone" dataKey="Total haberes"
              stroke="#a855f7" strokeWidth={1.5}
              fill="url(#hgHaberes)" dot={false}
              activeDot={{ r: 4, fill: '#a855f7' }}
            />
            <Area
              type="monotone" dataKey="Sueldo líquido"
              stroke="#34d399" strokeWidth={2}
              fill="url(#hgLiquido)" dot={false}
              activeDot={{ r: 4, fill: '#34d399' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Tabla detallada ───────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--c-border)' }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--c-bg-hover)', borderBottom: '1px solid var(--c-border)' }}>
              {['Período', 'Sueldo base', 'Total haberes', 'Descuentos', 'Líquido', 'Var.'].map(h => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left font-bold uppercase tracking-wider"
                  style={{ color: 'var(--c-text-3)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.slice().reverse().map((row, i) => {
              const isMax = row.raw.sueldo_liquido === maxLiquido;
              const isMin = row.raw.sueldo_liquido === minLiquido && ordenadas.length > 1;
              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid var(--c-border)',
                    background: i % 2 === 0 ? 'transparent' : 'var(--c-bg-hover)',
                  }}
                >
                  <td className="px-3 py-2.5 font-bold whitespace-nowrap" style={{ color: 'var(--c-text-1)' }}>{row.periodo}</td>
                  <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--c-text-2)' }}>
                    {clp(row['Sueldo base'])}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--c-text-2)' }}>
                    {clp(row['Total haberes'])}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums" style={{ color: '#f87171' }}>
                    -{clp(row.raw.total_descuentos)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-bold" style={{ color: isMax ? '#34d399' : isMin ? '#f87171' : 'var(--c-text-1)' }}>
                    {clp(row['Sueldo líquido'])}
                    {isMax && <span className="ml-1 text-[10px]" style={{ color: '#34d399' }}>↑ máx</span>}
                    {isMin && <span className="ml-1 text-[10px]" style={{ color: '#f87171' }}>↓ mín</span>}
                  </td>
                  <td className="px-3 py-2.5"><DeltaBadge pct={row.delta} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
