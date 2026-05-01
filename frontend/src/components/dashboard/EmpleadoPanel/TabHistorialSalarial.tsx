import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, DollarSign, Award, Activity } from 'lucide-react';
import type { UseDashboardReturn } from '../../../hooks/useDashboard';

type Props = {
  liquidaciones: UseDashboardReturn['liquidaciones'];
};

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const clp = (n: number) =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const clpShort = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return clp(n);
};

// ─── Tooltip personalizado ──────────────────────────────────────────────────

interface TooltipPayload {
  color: string;
  name: string;
  value: number;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl p-3 shadow-xl text-xs space-y-1.5"
      style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      <p className="font-bold text-white mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-white">{clp(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function TabHistorialSalarial({ liquidaciones }: Props) {
  if (!liquidaciones.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <Activity size={20} style={{ color: 'rgba(255,255,255,0.25)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Sin liquidaciones registradas
        </p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
          El historial salarial se construye a partir de las liquidaciones generadas.
        </p>
      </div>
    );
  }

  // Ordenar ascendente por año+mes
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
  const variacion = penultima
    ? Math.round(((ultima.sueldo_liquido - penultima.sueldo_liquido) / penultima.sueldo_liquido) * 100 * 10) / 10
    : null;
  const maxLiquido = Math.max(...ordenadas.map(l => l.sueldo_liquido));
  const minLiquido = Math.min(...ordenadas.map(l => l.sueldo_liquido));

  const DeltaBadge = ({ pct }: { pct: number | null }) => {
    if (pct === null) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;
    if (pct === 0) return (
      <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#94a3b8' }}>
        <Minus size={11} /> 0%
      </span>
    );
    const pos = pct > 0;
    return (
      <span
        className="flex items-center gap-1 text-xs font-bold"
        style={{ color: pos ? '#34d399' : '#f87171' }}
      >
        {pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {pos ? '+' : ''}{pct}%
      </span>
    );
  };

  return (
    <div className="space-y-5 p-1">

      {/* ── KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Líquido actual */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-1"
          style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={12} style={{ color: '#60a5fa' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Último líquido
            </span>
          </div>
          <p className="text-lg font-extrabold text-white leading-none">{clpShort(ultima.sueldo_liquido)}</p>
          <div className="mt-1"><DeltaBadge pct={variacion} /></div>
        </div>

        {/* Máximo histórico */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-1"
          style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Award size={12} style={{ color: '#34d399' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Máximo
            </span>
          </div>
          <p className="text-lg font-extrabold text-white leading-none">{clpShort(maxLiquido)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>histórico</p>
        </div>

        {/* Períodos */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-1"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Activity size={12} style={{ color: 'rgba(255,255,255,0.35)' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Períodos
            </span>
          </div>
          <p className="text-lg font-extrabold text-white leading-none">{ordenadas.length}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            liquidaciones
          </p>
        </div>
      </div>

      {/* ── Gráfico ───────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Evolución salarial
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradHaberes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradLiquido" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="periodo"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={clpShort}
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', paddingTop: 8 }}
            />
            <Area
              type="monotone"
              dataKey="Sueldo base"
              stroke="#2563eb"
              strokeWidth={1.5}
              fill="url(#gradBase)"
              dot={false}
              activeDot={{ r: 4, fill: '#2563eb' }}
            />
            <Area
              type="monotone"
              dataKey="Total haberes"
              stroke="#a855f7"
              strokeWidth={1.5}
              fill="url(#gradHaberes)"
              dot={false}
              activeDot={{ r: 4, fill: '#a855f7' }}
            />
            <Area
              type="monotone"
              dataKey="Sueldo líquido"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#gradLiquido)"
              dot={false}
              activeDot={{ r: 4, fill: '#34d399' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Tabla detallada ───────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Período', 'Sueldo base', 'Total haberes', 'Descuentos', 'Líquido', 'Var.'].map(h => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left font-bold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
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
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  }}
                >
                  <td className="px-3 py-2.5 font-bold text-white whitespace-nowrap">
                    {row.periodo}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {clp(row['Sueldo base'])}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {clp(row['Total haberes'])}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums" style={{ color: '#f87171' }}>
                    -{clp(row.raw.total_descuentos)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-bold" style={{ color: isMax ? '#34d399' : isMin ? '#f87171' : '#fff' }}>
                    {clp(row['Sueldo líquido'])}
                    {isMax && <span className="ml-1 text-[10px]" style={{ color: '#34d399' }}>↑ máx</span>}
                    {isMin && <span className="ml-1 text-[10px]" style={{ color: '#f87171' }}>↓ mín</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <DeltaBadge pct={row.delta} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
