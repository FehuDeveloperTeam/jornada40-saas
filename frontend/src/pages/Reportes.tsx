import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

import { ArrowLeft, TrendingUp, Users, Wallet, BadgeDollarSign, AlertCircle, BarChart3, Download } from 'lucide-react';
import { useReportes } from '../hooks/useReportes';
import ModalExportarConsolidado from '../components/dashboard/ModalExportarConsolidado';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function clp(n: number): string {
  if (!n) return '$0';
  return '$' + n.toLocaleString('es-CL');
}

function clpCompacto(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return clp(n);
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}

function KpiCard({ label, value, sub, icon, color, bg, border }: KpiCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {label}
        </span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + '22' }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{sub}</p>}
      </div>
    </div>
  );
}

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  color?: string;
  value?: number;
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm shadow-2xl"
      style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <p className="font-bold text-white mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={p.dataKey ?? i} style={{ color: p.color }} className="text-xs">
          {p.name}: {clp(p.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

export default function Reportes() {
  const navigate = useNavigate();
  const { anio, setAnio, mes, setMes, data, loading, error } = useReportes();
  const [showExportModal, setShowExportModal] = useState(false);

  const now = new Date();
  const aniosDisponibles = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const maxMasaSalarial = data
    ? Math.max(...data.empresas.map(e => e.masa_salarial), 1)
    : 1;

  return (
    <div className="min-h-screen" style={{ background: '#070f1e', color: '#fff' }}>

      {/* ── Top bar ── */}
      <div
        className="sticky top-0 z-30 px-6 py-4 flex items-center justify-between gap-4"
        style={{ background: 'rgba(7,15,30,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/empresas')}
            className="flex items-center gap-2 text-sm font-medium transition-colors group"
            style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
          >
            <ArrowLeft size={16} />
            Empresas
          </button>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <div className="flex items-center gap-2">
            <BarChart3 size={16} style={{ color: '#818cf8' }} />
            <span className="text-sm font-bold text-white">Reportes Consolidados</span>
          </div>
        </div>

        {/* Right: export button + period selector */}
        <div className="flex items-center gap-3">
          {data && (
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: 'rgba(129,140,248,0.12)',
                border: '1px solid rgba(129,140,248,0.3)',
                color: '#818cf8',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.22)'; e.currentTarget.style.borderColor = 'rgba(129,140,248,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.12)'; e.currentTarget.style.borderColor = 'rgba(129,140,248,0.3)'; }}
            >
              <Download size={13} />
              Exportar
            </button>
          )}
          <select
            value={mes ?? 0}
            onChange={e => setMes(Number(e.target.value) || null)}
            className="rounded-xl px-3 py-2 text-xs font-bold text-white appearance-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', minWidth: 130 }}
          >
            <option value={0} style={{ background: '#0c1a35' }}>Año completo</option>
            {MESES.map((nombre, i) => (
              <option key={i + 1} value={i + 1} style={{ background: '#0c1a35' }}>{nombre}</option>
            ))}
          </select>
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="rounded-xl px-3 py-2 text-xs font-bold text-white appearance-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
          >
            {aniosDisponibles.map(a => (
              <option key={a} value={a} style={{ background: '#0c1a35' }}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div style={{
              width: 40, height: 40,
              border: '3px solid rgba(255,255,255,0.08)',
              borderTopColor: '#818cf8',
              borderRadius: '50%',
              animation: 'spin 0.9s linear infinite',
            }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Cargando reportes…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            className="flex items-start gap-3 p-5 rounded-2xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AlertCircle size={18} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-sm font-bold" style={{ color: '#fca5a5' }}>{error}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Cambia el período de búsqueda o genera liquidaciones para el mes seleccionado.
              </p>
            </div>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Period label */}
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {data.periodo.mes_nombre ? `${data.periodo.mes_nombre} ${data.periodo.anio}` : `Año ${data.periodo.anio}`}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {data.empresas.length} empresa{data.empresas.length !== 1 ? 's' : ''} · {data.kpis.trabajadores} trabajadore{data.kpis.trabajadores !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* ── KPI cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Masa salarial"
                value={clpCompacto(data.kpis.masa_salarial)}
                sub={clp(data.kpis.masa_salarial)}
                icon={<TrendingUp size={16} />}
                color="#818cf8"
                bg="rgba(129,140,248,0.07)"
                border="rgba(129,140,248,0.18)"
              />
              <KpiCard
                label="Trabajadores"
                value={String(data.kpis.trabajadores)}
                sub="con liquidación en el período"
                icon={<Users size={16} />}
                color="#34d399"
                bg="rgba(52,211,153,0.07)"
                border="rgba(52,211,153,0.18)"
              />
              <KpiCard
                label="Costo empleador"
                value={clpCompacto(data.kpis.costo_empleador)}
                sub="SIS + Mutual + AFC empleador"
                icon={<BadgeDollarSign size={16} />}
                color="#fb923c"
                bg="rgba(251,146,60,0.07)"
                border="rgba(251,146,60,0.18)"
              />
              <KpiCard
                label="Líquido a pagar"
                value={clpCompacto(data.kpis.liquido_total)}
                sub={clp(data.kpis.liquido_total)}
                icon={<Wallet size={16} />}
                color="#c084fc"
                bg="rgba(192,132,252,0.07)"
                border="rgba(192,132,252,0.18)"
              />
            </div>

            {/* ── Evolution chart ── */}
            <div
              className="rounded-2xl p-6"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-white">Evolución mensual {data.periodo.anio}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Masa salarial vs. líquido a pagar
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded inline-block" style={{ background: '#818cf8' }} />
                    Masa salarial
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded inline-block" style={{ background: '#34d399' }} />
                    Líquido
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.evolucion} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradMasa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLiquido" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="mes_nombre"
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => clpCompacto(v as number)}
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="masa_salarial"
                    name="Masa salarial"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fill="url(#gradMasa)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#818cf8' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="liquido_total"
                    name="Líquido"
                    stroke="#34d399"
                    strokeWidth={2}
                    fill="url(#gradLiquido)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#34d399' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ── Companies table ── */}
            {data.empresas.length > 0 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div
                  className="px-6 py-4 flex items-center justify-between"
                  style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <h3 className="text-sm font-bold text-white">Desglose por empresa</h3>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {data.empresas.length} empresa{data.empresas.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {/* Header */}
                  <div
                    className="grid gap-4 px-6 py-3 text-xs font-bold uppercase tracking-wider"
                    style={{
                      gridTemplateColumns: '1fr 80px 140px 140px 140px 80px',
                      color: 'rgba(255,255,255,0.35)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <span>Empresa</span>
                    <span className="text-right">Trabaj.</span>
                    <span className="text-right">Masa salarial</span>
                    <span className="text-right">Costo empleador</span>
                    <span className="text-right">Líquido</span>
                    <span className="text-right">% del total</span>
                  </div>

                  {/* Rows */}
                  {data.empresas.map((emp, idx) => {
                    const pct = data.kpis.masa_salarial > 0
                      ? Math.round((emp.masa_salarial / data.kpis.masa_salarial) * 100)
                      : 0;
                    const barPct = maxMasaSalarial > 0
                      ? (emp.masa_salarial / maxMasaSalarial) * 100
                      : 0;
                    return (
                      <div
                        key={emp.id}
                        className="grid gap-4 px-6 py-4 items-center"
                        style={{
                          gridTemplateColumns: '1fr 80px 140px 140px 140px 80px',
                          borderBottom: idx < data.empresas.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Nombre + barra */}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{emp.nombre}</p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{emp.rut}</p>
                          <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${barPct}%`, background: 'linear-gradient(90deg, #818cf8, #c084fc)' }}
                            />
                          </div>
                        </div>
                        <p className="text-sm font-bold text-right text-white">{emp.trabajadores}</p>
                        <p className="text-sm font-bold text-right" style={{ color: '#818cf8' }}>
                          {clp(emp.masa_salarial)}
                        </p>
                        <p className="text-sm text-right" style={{ color: '#fb923c' }}>
                          {clp(emp.costo_empleador)}
                        </p>
                        <p className="text-sm font-bold text-right" style={{ color: '#34d399' }}>
                          {clp(emp.liquido_total)}
                        </p>
                        <p className="text-sm font-bold text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {pct}%
                        </p>
                      </div>
                    );
                  })}

                  {/* Totals row */}
                  <div
                    className="grid gap-4 px-6 py-4 items-center"
                    style={{
                      gridTemplateColumns: '1fr 80px 140px 140px 140px 80px',
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.025)',
                    }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Total consolidado
                    </p>
                    <p className="text-sm font-bold text-right text-white">{data.kpis.trabajadores}</p>
                    <p className="text-sm font-bold text-right" style={{ color: '#818cf8' }}>
                      {clp(data.kpis.masa_salarial)}
                    </p>
                    <p className="text-sm font-bold text-right" style={{ color: '#fb923c' }}>
                      {clp(data.kpis.costo_empleador)}
                    </p>
                    <p className="text-sm font-bold text-right" style={{ color: '#34d399' }}>
                      {clp(data.kpis.liquido_total)}
                    </p>
                    <p className="text-sm font-bold text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      100%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cost breakdown note */}
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Costo empleador estimado: SIS 1.49% + Mutual AT/EP 0.93% + AFC empleador 2.4% (indefinido) / 3.0% (plazo fijo)
            </p>
          </>
        )}
      </div>

      {showExportModal && (
        <ModalExportarConsolidado
          anioInicial={anio}
          mesInicial={mes}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
