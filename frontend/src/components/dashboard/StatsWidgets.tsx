import React from 'react';
import { BarChart2, Undo2, Users, Laptop, Globe, CircleDollarSign, Landmark, FileText, AlertTriangle, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import type { UseDashboardReturn } from '../../hooks/useDashboard';

type Props = {
  stats: NonNullable<UseDashboardReturn['stats']>;
  flippedWidgets: UseDashboardReturn['flippedWidgets'];
  toggleWidget: UseDashboardReturn['toggleWidget'];
};

const widgetStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  borderRadius: '1rem',
  padding: '1.5rem',
  minHeight: '140px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  position: 'relative',
};

const flipBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1rem',
  right: '1rem',
  padding: '0.375rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '0.5rem',
  color: 'rgba(255,255,255,0.35)',
  cursor: 'pointer',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const labelStyle: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: '0.25rem' };
const valueStyle: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 800, color: '#fff' };
const subStyle:  React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginTop: '0.25rem' };

const iconBox = (color: string) => ({
  width: '3rem', height: '3rem', borderRadius: '0.75rem', flexShrink: 0,
  background: `${color}20`, border: `1px solid ${color}30`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
} as React.CSSProperties);

export default function StatsWidgets({ stats, flippedWidgets, toggleWidget }: Props) {
  const chartAxis = { fontSize: 9, fill: 'rgba(255,255,255,0.35)' };
  const tooltip   = { background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">

      {/* ── 1. Total Trabajadores ─────────────────────────── */}
      <div style={widgetStyle}>
        <button onClick={() => toggleWidget('w_total')} style={flipBtnStyle}>
          {flippedWidgets['w_total'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
        </button>
        {!flippedWidgets['w_total'] ? (
          <div className="flex items-center gap-4">
            <div style={iconBox('#2563eb')}><Users size={20} style={{ color: '#60a5fa' }} /></div>
            <div>
              <p style={labelStyle}>Total Trabajadores</p>
              <h4 style={valueStyle}>{stats.activos}</h4>
              {stats.inactivos > 0 && <p style={subStyle}>{stats.inactivos} inactivos</p>}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-1">
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={stats.chartTotal} cx="50%" cy="50%" innerRadius={26} outerRadius={42} dataKey="valor" paddingAngle={3} strokeWidth={0}>
                  {stats.chartTotal.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── 2. Distribución Género ────────────────────────── */}
      <div style={widgetStyle}>
        <button onClick={() => toggleWidget('w_genero')} style={flipBtnStyle}>
          {flippedWidgets['w_genero'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
        </button>
        {!flippedWidgets['w_genero'] ? (
          <div className="flex items-center gap-4">
            <div style={iconBox('#a855f7')}><Users size={20} style={{ color: '#c084fc' }} /></div>
            <div className="w-full pr-8">
              <p style={labelStyle}>Distribución Género</p>
              <div className="flex justify-between items-center w-full">
                <span style={{ ...valueStyle, fontSize: '1rem' }}>{stats.mujeres} <span style={subStyle}>Muj.</span></span>
                <span style={{ ...valueStyle, fontSize: '1rem' }}>{stats.hombres} <span style={subStyle}>Hom.</span></span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden flex mt-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div style={{ width: `${stats.total > 0 ? (stats.mujeres / stats.total) * 100 : 0}%`, background: '#c084fc' }} className="h-full" />
                <div style={{ width: `${stats.total > 0 ? (stats.hombres / stats.total) * 100 : 0}%`, background: '#60a5fa' }} className="h-full" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-1">
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={stats.chartGenero} cx="50%" cy="50%" innerRadius={26} outerRadius={42} dataKey="valor" paddingAngle={3} strokeWidth={0}>
                  {stats.chartGenero.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── 3. Modalidad (corregido: Presencial / Remoto / Híbrido) ── */}
      <div style={widgetStyle}>
        <button onClick={() => toggleWidget('w_modalidad')} style={flipBtnStyle}>
          {flippedWidgets['w_modalidad'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
        </button>
        {!flippedWidgets['w_modalidad'] ? (
          <div className="flex items-center gap-4">
            <div style={iconBox('#10b981')}><Laptop size={20} style={{ color: '#34d399' }} /></div>
            <div className="w-full pr-8">
              <p style={labelStyle}>Modalidad</p>
              <div className="flex gap-5 mt-1">
                <div>
                  <div style={{ ...valueStyle, fontSize: '1.125rem' }}>{stats.presencial}</div>
                  <div style={subStyle}>Presencial</div>
                </div>
                <div>
                  <div style={{ ...valueStyle, fontSize: '1.125rem', color: '#34d399' }}>{stats.remoto}</div>
                  <div style={subStyle}>Remoto</div>
                </div>
                <div>
                  <div style={{ ...valueStyle, fontSize: '1.125rem', color: '#22d3ee' }}>{stats.hibrido}</div>
                  <div style={subStyle}>Híbrido</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-1">
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={stats.chartModalidad} cx="50%" cy="50%" innerRadius={26} outerRadius={42} dataKey="valor" paddingAngle={3} strokeWidth={0}>
                  {stats.chartModalidad.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── 4. Tipos de Contrato ──────────────────────────── */}
      <div style={widgetStyle}>
        <button onClick={() => toggleWidget('w_contratos')} style={flipBtnStyle}>
          {flippedWidgets['w_contratos'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
        </button>
        {!flippedWidgets['w_contratos'] ? (
          <div className="flex items-center gap-4">
            <div style={iconBox('#6366f1')}><FileText size={20} style={{ color: '#818cf8' }} /></div>
            <div className="w-full pr-8">
              <p style={labelStyle}>Tipos de Contrato</p>
              <div className="flex gap-5 mt-1">
                <div>
                  <div style={{ ...valueStyle, fontSize: '1.125rem', color: '#60a5fa' }}>{stats.indefinido}</div>
                  <div style={subStyle}>Indefinido</div>
                </div>
                <div>
                  <div style={{ ...valueStyle, fontSize: '1.125rem', color: '#fbbf24' }}>{stats.plazoFijo}</div>
                  <div style={subStyle}>Plazo Fijo</div>
                </div>
                <div>
                  <div style={{ ...valueStyle, fontSize: '1.125rem', color: '#fb923c' }}>{stats.obraFaena}</div>
                  <div style={subStyle}>Obra/Faena</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-1">
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={stats.chartTiposContrato} cx="50%" cy="50%" innerRadius={26} outerRadius={42} dataKey="valor" paddingAngle={3} strokeWidth={0}>
                  {stats.chartTiposContrato.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── 5. Cuota Extranjería ──────────────────────────── */}
      <div style={{ ...widgetStyle, borderColor: stats.pctExtranjeros > 15 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)' }}>
        <button onClick={() => toggleWidget('w2')} style={flipBtnStyle}>
          {flippedWidgets['w2'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
        </button>
        {!flippedWidgets['w2'] ? (
          <div className="flex items-center gap-4">
            <div style={iconBox(stats.pctExtranjeros > 15 ? '#ef4444' : '#2563eb')}>
              <Globe size={20} style={{ color: stats.pctExtranjeros > 15 ? '#f87171' : '#60a5fa' }} />
            </div>
            <div>
              <p style={labelStyle}>Cuota Extranjería</p>
              <h4 style={valueStyle}>{stats.extranjeros} <span style={subStyle}>extranjeros</span></h4>
              <p style={{ ...subStyle, color: stats.pctExtranjeros > 15 ? '#f87171' : 'rgba(255,255,255,0.35)' }}>
                {stats.pctExtranjeros.toFixed(1)}% (Límite 15%)
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-1">
            <ResponsiveContainer width="100%" height={72}>
              <PieChart>
                {/* Track gris de fondo (0-30% como máximo visual) */}
                <Pie
                  data={[{ value: 100 }]}
                  cx="50%" cy="100%"
                  startAngle={180} endAngle={0}
                  innerRadius={32} outerRadius={46}
                  dataKey="value" strokeWidth={0}
                >
                  <Cell fill="rgba(255,255,255,0.06)" />
                </Pie>
                {/* Arco de valor actual (escala: 30% = arco completo) */}
                <Pie
                  data={[
                    { value: Math.min((stats.pctExtranjeros / 30) * 100, 100) },
                    { value: Math.max(0, 100 - Math.min((stats.pctExtranjeros / 30) * 100, 100)) },
                  ]}
                  cx="50%" cy="100%"
                  startAngle={180} endAngle={0}
                  innerRadius={32} outerRadius={46}
                  dataKey="value" paddingAngle={0} strokeWidth={0}
                >
                  <Cell fill={stats.pctExtranjeros > 15 ? '#ef4444' : '#6366f1'} />
                  <Cell fill="transparent" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: '-0.25rem' }}>
              {stats.pctExtranjeros.toFixed(1)}% actual · límite 15%
            </p>
          </div>
        )}
      </div>

      {/* ── 6. Masa Salarial (+ promedio) ─────────────────── */}
      <div style={widgetStyle}>
        <button onClick={() => toggleWidget('w3')} style={flipBtnStyle}>
          {flippedWidgets['w3'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
        </button>
        {!flippedWidgets['w3'] ? (
          <div className="flex items-center gap-4">
            <div style={iconBox('#10b981')}><CircleDollarSign size={20} style={{ color: '#34d399' }} /></div>
            <div>
              <p style={labelStyle}>Masa Salarial Total</p>
              <h4 style={{ ...valueStyle, fontSize: '1.25rem' }}>${stats.masaSalarial.toLocaleString('es-CL')}</h4>
              <p style={subStyle}>Prom. ${stats.promedioSalarial.toLocaleString('es-CL')} / trabajador</p>
            </div>
          </div>
        ) : (
          <div className="h-full w-full pt-1">
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={stats.chartCentros} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category" dataKey="name" axisLine={false} tickLine={false} width={72}
                  tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.4)' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={tooltip}
                  formatter={(v) => `$${Number(v || 0).toLocaleString('es-CL')}`}
                />
                <Bar dataKey="valor" fill="#10b981" radius={[0,4,4,0]} maxBarSize={11} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── 7. Sistema de Salud ───────────────────────────── */}
      <div style={widgetStyle}>
        <button onClick={() => toggleWidget('w_salud')} style={flipBtnStyle}>
          {flippedWidgets['w_salud'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
        </button>
        {!flippedWidgets['w_salud'] ? (
          <div className="flex items-center gap-4">
            <div style={iconBox('#10b981')}><Activity size={20} style={{ color: '#34d399' }} /></div>
            <div className="w-full pr-8">
              <p style={labelStyle}>Sistema de Salud</p>
              <div className="flex justify-between items-center w-full mt-1">
                <span style={{ ...valueStyle, fontSize: '1rem' }}>{stats.fonasa} <span style={subStyle}>FONASA</span></span>
                <span style={{ ...valueStyle, fontSize: '1rem', color: '#34d399' }}>{stats.isapre} <span style={subStyle}>ISAPRE</span></span>
              </div>
              {(stats.fonasa + stats.isapre) > 0 && (
                <div className="w-full h-1.5 rounded-full overflow-hidden flex mt-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ width: `${(stats.fonasa / (stats.fonasa + stats.isapre)) * 100}%`, background: '#3b82f6' }} className="h-full" />
                  <div style={{ width: `${(stats.isapre / (stats.fonasa + stats.isapre)) * 100}%`, background: '#10b981' }} className="h-full" />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-1">
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={stats.chartSalud} cx="50%" cy="50%" innerRadius={26} outerRadius={42} dataKey="valor" paddingAngle={3} strokeWidth={0}>
                  {stats.chartSalud.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── 8. Contratos por Vencer ───────────────────────── */}
      <div style={{
        ...widgetStyle,
        borderColor: stats.contratosVencen.length > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)',
      }}>
        <button onClick={() => toggleWidget('w_vencen')} style={flipBtnStyle}>
          {flippedWidgets['w_vencen'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
        </button>
        {!flippedWidgets['w_vencen'] ? (
          <div className="flex items-center gap-4">
            <div style={iconBox(stats.contratosVencen.length > 0 ? '#ef4444' : '#10b981')}>
              <AlertTriangle size={20} style={{ color: stats.contratosVencen.length > 0 ? '#f87171' : '#34d399' }} />
            </div>
            <div>
              <p style={labelStyle}>Contratos por Vencer</p>
              <h4 style={valueStyle}>{stats.contratosVencen.length}</h4>
              <p style={{ ...subStyle, color: stats.contratosVencen.length > 0 ? '#f87171' : '#34d399' }}>
                {stats.contratosVencen.length > 0 ? 'vencen en ≤ 30 días' : 'ninguno próximo'}
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {stats.contratosVencen.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                No hay contratos próximos a vencer
              </p>
            ) : (
              <div className="space-y-2">
                {stats.contratosVencen.slice(0, 4).map((c, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span style={{ fontSize: '0.775rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                      {c.nombre}
                    </span>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700,
                      color: c.diasRestantes <= 7 ? '#f87171' : c.diasRestantes <= 15 ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                      background: c.diasRestantes <= 7 ? 'rgba(239,68,68,0.12)' : c.diasRestantes <= 15 ? 'rgba(251,191,36,0.1)' : 'transparent',
                      padding: '0.15rem 0.5rem', borderRadius: '1rem',
                    }}>
                      {c.diasRestantes}d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 9. Bancarización ──────────────────────────────── */}
      <div style={widgetStyle}>
        <button onClick={() => toggleWidget('w6')} style={flipBtnStyle}>
          {flippedWidgets['w6'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
        </button>
        {!flippedWidgets['w6'] ? (
          <div className="flex items-center gap-4">
            <div style={iconBox('#06b6d4')}><Landmark size={20} style={{ color: '#22d3ee' }} /></div>
            <div>
              <p style={labelStyle}>Bancarización (Pagos)</p>
              <h4 style={valueStyle}>{stats.bancarizados} <span style={subStyle}>digital</span></h4>
              {stats.noBancarizados > 0 && <p style={{ ...subStyle, color: '#fbbf24' }}>{stats.noBancarizados} pagos manuales</p>}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-1">
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={stats.chartBancos} cx="50%" cy="50%" innerRadius={26} outerRadius={42} dataKey="valor" paddingAngle={3} strokeWidth={0}>
                  {stats.chartBancos.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

    </div>
  );
}
