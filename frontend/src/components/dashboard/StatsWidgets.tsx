import { useState } from 'react';
import { BarChart2, Undo2, Users, Laptop, Clock, Globe, CircleDollarSign, Building2, Landmark, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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
const subStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginTop: '0.25rem' };

const iconBox = (color: string) => ({
  width: '3rem', height: '3rem', borderRadius: '0.75rem', flexShrink: 0,
  background: `${color}20`, border: `1px solid ${color}30`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
} as React.CSSProperties);

export default function StatsWidgets({ stats, flippedWidgets, toggleWidget }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const chartAxis = { fontSize: 9, fill: 'rgba(255,255,255,0.35)' };

  return (
    <div className="mb-8">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all mb-4"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
      >
        <BarChart2 className="w-4 h-4 text-blue-400" />
        Estadísticas del equipo
        <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">

          {/* WIDGET A: Total Trabajadores */}
          <div style={widgetStyle}>
            <button onClick={() => toggleWidget('w_total')} style={flipBtnStyle}>
              {flippedWidgets['w_total'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
            </button>
            {!flippedWidgets['w_total'] ? (
              <div className="flex items-center gap-4">
                <div style={iconBox('#2563eb')}><Users size={20} style={{ color: '#60a5fa' }} /></div>
                <div>
                  <p style={labelStyle}>Total Trabajadores</p>
                  <h4 style={valueStyle}>{stats.total}</h4>
                  {stats.inactivos > 0 && <p style={subStyle}>{stats.inactivos} inactivos</p>}
                </div>
              </div>
            ) : (
              <div className="h-full w-full pt-2">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={stats.chartTotal}>
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxis} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {stats.chartTotal.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* WIDGET B: Género */}
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
                    <div style={{ width: `${(stats.mujeres / stats.total) * 100}%`, background: '#c084fc' }} className="h-full" />
                    <div style={{ width: `${(stats.hombres / stats.total) * 100}%`, background: '#60a5fa' }} className="h-full" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full w-full pt-2">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={stats.chartGenero}>
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxis} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {stats.chartGenero.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* WIDGET C: Modalidad */}
          <div style={widgetStyle}>
            <button onClick={() => toggleWidget('w_modalidad')} style={flipBtnStyle}>
              {flippedWidgets['w_modalidad'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
            </button>
            {!flippedWidgets['w_modalidad'] ? (
              <div className="flex items-center gap-4">
                <div style={iconBox('#10b981')}><Laptop size={20} style={{ color: '#34d399' }} /></div>
                <div>
                  <p style={labelStyle}>Teletrabajo</p>
                  <h4 style={valueStyle}>{stats.teletrabajo} <span style={subStyle}>/ {stats.presencial} Ofi.</span></h4>
                </div>
              </div>
            ) : (
              <div className="h-full w-full pt-2">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={stats.chartModalidad}>
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxis} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {stats.chartModalidad.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* WIDGET 1: Jornada */}
          <div style={{ ...widgetStyle, borderColor: stats.jornadaMayor > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)' }}>
            <button onClick={() => toggleWidget('w1')} style={flipBtnStyle}>
              {flippedWidgets['w1'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
            </button>
            {!flippedWidgets['w1'] ? (
              <div className="flex items-center gap-4">
                <div style={iconBox(stats.jornadaMayor > 0 ? '#f59e0b' : '#10b981')}>
                  <Clock size={20} style={{ color: stats.jornadaMayor > 0 ? '#fbbf24' : '#34d399' }} />
                </div>
                <div>
                  <p style={labelStyle}>Transición 40 Horas</p>
                  <h4 style={valueStyle}>{stats.jornada40} <span style={subStyle}>listos</span></h4>
                  {stats.jornadaMayor > 0 && <p style={{ ...subStyle, color: '#fbbf24' }}>Faltan {stats.jornadaMayor}</p>}
                </div>
              </div>
            ) : (
              <div className="h-full w-full pt-2">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={stats.chartJornada}>
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxis} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {stats.chartJornada.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* WIDGET 2: Extranjería */}
          <div style={{ ...widgetStyle, borderColor: stats.pctExtranjeros > 15 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)' }}>
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
              <div className="h-full w-full pt-2">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={stats.chartNacionalidad}>
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxis} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {stats.chartNacionalidad.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* WIDGET 3: Masa Salarial */}
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
                </div>
              </div>
            ) : (
              <div className="h-full w-full pt-2">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={stats.chartCentros}>
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }} formatter={(v) => `$${Number(v || 0).toLocaleString('es-CL')}`} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ ...chartAxis, fontSize: 8 }} />
                    <Bar dataKey="valor" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* WIDGET 4: Top Centro */}
          <div style={{ ...widgetStyle, flexDirection: 'row', alignItems: 'center', gap: '1rem' }}>
            <div style={iconBox('#6366f1')}><Building2 size={20} style={{ color: '#818cf8' }} /></div>
            <div className="overflow-hidden">
              <p style={labelStyle}>Mayor Centro de Costo</p>
              <h4 className="truncate" style={{ ...valueStyle, fontSize: '1rem' }} title={stats.topCentro.name}>{stats.topCentro.name}</h4>
              <p style={{ ...subStyle, color: '#818cf8' }}>${(stats.topCentro.valor as number).toLocaleString('es-CL')}</p>
            </div>
          </div>

          {/* WIDGET 5: Generaciones */}
          <div style={widgetStyle}>
            <button onClick={() => toggleWidget('w5')} style={flipBtnStyle}>
              {flippedWidgets['w5'] ? <Undo2 size={14} /> : <BarChart2 size={14} />}
            </button>
            {!flippedWidgets['w5'] ? (
              <div className="flex items-center gap-4">
                <div style={iconBox('#a855f7')}><Users size={20} style={{ color: '#c084fc' }} /></div>
                <div className="w-full pr-8">
                  <p style={labelStyle}>Generaciones</p>
                  <div className="flex justify-between items-end text-center w-full mt-1">
                    {[[stats.menores30, '< 30'], [stats.entre30y50, '30-50'], [stats.mayores50, '> 50']].map(([v, lbl]) => (
                      <div key={String(lbl)}>
                        <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#fff' }}>{v}</div>
                        <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>{lbl}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full w-full pt-2">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={stats.chartGeneraciones}>
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxis} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {stats.chartGeneraciones.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* WIDGET 6: Bancarización */}
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
              <div className="h-full w-full pt-2">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={stats.chartBancos}>
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxis} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {stats.chartBancos.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
