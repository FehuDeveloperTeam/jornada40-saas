import { Undo2, BarChart2, Users, Laptop, Clock, Globe, CircleDollarSign, Building2, Landmark } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface StatsData {
  chartTotal: { name: string; valor: number; color: string }[];
  total: number;
  inactivos: number;
  mujeres: number;
  hombres: number;
  chartGenero: { name: string; valor: number; color: string }[];
  teletrabajo: number;
  presencial: number;
  chartModalidad: { name: string; valor: number; color: string }[];
  jornada40: number;
  jornadaMayor: number;
  chartJornada: { name: string; valor: number; color: string }[];
  extranjeros: number;
  pctExtranjeros: number;
  chartNacionalidad: { name: string; valor: number; color: string }[];
  masaSalarial: number;
  topCentro: { name: string; valor: number };
  chartCentros: { name: string; valor: number }[];
  menores30: number;
  entre30y50: number;
  mayores50: number;
  chartGeneraciones: { name: string; valor: number; color: string }[];
  bancarizados: number;
  noBancarizados: number;
  chartBancos: { name: string; valor: number; color: string }[];
}

interface Props {
  stats: StatsData;
  flippedWidgets: Record<string, boolean>;
  toggleWidget: (id: string) => void;
}

export default function StatsWidgets({ stats, flippedWidgets, toggleWidget }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8 animate-in slide-in-from-bottom-4 fade-in duration-500">

      {/* WIDGET A: Total Trabajadores */}
      <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
        <button onClick={() => toggleWidget('w_total')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
          {flippedWidgets['w_total'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
        </button>
        {!flippedWidgets['w_total'] ? (
          <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0"><Users className="w-7 h-7" /></div>
            <div>
              <p className="text-sm font-bold text-slate-500">Total Trabajadores</p>
              <h4 className="text-2xl font-extrabold text-slate-900">{stats.total}</h4>
              {stats.inactivos > 0 && <p className="text-xs font-bold text-slate-400 mt-1">{stats.inactivos} inactivos</p>}
            </div>
          </div>
        ) : (
          <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={stats.chartTotal}>
                <Tooltip cursor={{fill: 'transparent'}} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {stats.chartTotal.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* WIDGET B: Distribución de Género */}
      <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
        <button onClick={() => toggleWidget('w_genero')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
          {flippedWidgets['w_genero'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
        </button>
        {!flippedWidgets['w_genero'] ? (
          <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-fuchsia-50 text-fuchsia-500 rounded-xl flex items-center justify-center shrink-0"><Users className="w-7 h-7" /></div>
            <div className="w-full pr-6">
              <p className="text-sm font-bold text-slate-500 mb-1">Distribución Género</p>
              <div className="flex justify-between items-center w-full">
                <span className="text-sm font-extrabold text-slate-900">{stats.mujeres} <span className="text-xs text-slate-400 font-normal">Muj.</span></span>
                <span className="text-sm font-extrabold text-slate-900">{stats.hombres} <span className="text-xs text-slate-400 font-normal">Hom.</span></span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex mt-2">
                <div style={{ width: `${(stats.mujeres / stats.total) * 100}%` }} className="bg-fuchsia-400 h-full"></div>
                <div style={{ width: `${(stats.hombres / stats.total) * 100}%` }} className="bg-blue-400 h-full"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={stats.chartGenero}>
                <Tooltip cursor={{fill: 'transparent'}} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {stats.chartGenero.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* WIDGET C: Modalidad de Trabajo */}
      <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
        <button onClick={() => toggleWidget('w_modalidad')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
          {flippedWidgets['w_modalidad'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
        </button>
        {!flippedWidgets['w_modalidad'] ? (
          <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shrink-0"><Laptop className="w-7 h-7" /></div>
            <div>
              <p className="text-sm font-bold text-slate-500">Teletrabajo</p>
              <h4 className="text-2xl font-extrabold text-slate-900">{stats.teletrabajo} <span className="text-sm font-medium text-slate-400">/ {stats.presencial} Ofi.</span></h4>
            </div>
          </div>
        ) : (
          <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={stats.chartModalidad}>
                <Tooltip cursor={{fill: 'transparent'}} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {stats.chartModalidad.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* WIDGET 1: Jornada */}
      <div className={`relative bg-white rounded-2xl p-6 border ${stats.jornadaMayor > 0 ? 'border-amber-200' : 'border-slate-200'} shadow-sm min-h-[140px] flex flex-col justify-center`}>
        <button onClick={() => toggleWidget('w1')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
          {flippedWidgets['w1'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
        </button>
        {!flippedWidgets['w1'] ? (
          <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${stats.jornadaMayor > 0 ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">Transición 40 Horas</p>
              <h4 className="text-2xl font-extrabold text-slate-900">{stats.jornada40} <span className="text-sm font-medium text-slate-400">listos</span></h4>
              {stats.jornadaMayor > 0 && <p className="text-xs font-bold text-amber-600 mt-1">Faltan {stats.jornadaMayor}</p>}
            </div>
          </div>
        ) : (
          <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={stats.chartJornada}>
                <Tooltip cursor={{fill: 'transparent'}} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {stats.chartJornada.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* WIDGET 2: Extranjería */}
      <div className={`relative bg-white rounded-2xl p-6 border ${stats.pctExtranjeros > 15 ? 'border-red-200' : 'border-slate-200'} shadow-sm min-h-[140px] flex flex-col justify-center`}>
        <button onClick={() => toggleWidget('w2')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
          {flippedWidgets['w2'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
        </button>
        {!flippedWidgets['w2'] ? (
          <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${stats.pctExtranjeros > 15 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
              <Globe className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">Cuota Extranjería</p>
              <h4 className="text-2xl font-extrabold text-slate-900">{stats.extranjeros} <span className="text-sm font-medium text-slate-400">extranjeros</span></h4>
              <p className={`text-xs font-bold mt-1 ${stats.pctExtranjeros > 15 ? 'text-red-600' : 'text-slate-400'}`}>{stats.pctExtranjeros.toFixed(1)}% (Límite 15%)</p>
            </div>
          </div>
        ) : (
          <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={stats.chartNacionalidad}>
                <Tooltip cursor={{fill: 'transparent'}} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {stats.chartNacionalidad.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* WIDGET 3: Masa Salarial */}
      <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
        <button onClick={() => toggleWidget('w3')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
          {flippedWidgets['w3'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
        </button>
        {!flippedWidgets['w3'] ? (
          <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><CircleDollarSign className="w-7 h-7" /></div>
            <div>
              <p className="text-sm font-bold text-slate-500">Masa Salarial Total</p>
              <h4 className="text-2xl font-extrabold text-slate-900">${stats.masaSalarial.toLocaleString('es-CL')}</h4>
            </div>
          </div>
        ) : (
          <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={stats.chartCentros}>
                <Tooltip cursor={{fill: 'transparent'}} formatter={(value) => `$${Number(value || 0).toLocaleString('es-CL')}`} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8}} />
                <Bar dataKey="valor" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* WIDGET 4: Mayor Centro de Costo */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex items-center gap-4">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center shrink-0"><Building2 className="w-7 h-7" /></div>
        <div className="overflow-hidden">
          <p className="text-sm font-bold text-slate-500 truncate">Mayor Centro de Costo</p>
          <h4 className="text-lg font-extrabold text-slate-900 truncate" title={stats.topCentro.name}>{stats.topCentro.name}</h4>
          <p className="text-xs text-indigo-600 font-bold mt-1">${(stats.topCentro.valor as number).toLocaleString('es-CL')}</p>
        </div>
      </div>

      {/* WIDGET 5: Generaciones */}
      <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
        <button onClick={() => toggleWidget('w5')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
          {flippedWidgets['w5'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
        </button>
        {!flippedWidgets['w5'] ? (
          <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-fuchsia-50 text-fuchsia-500 rounded-xl flex items-center justify-center shrink-0"><Users className="w-7 h-7" /></div>
            <div className="w-full pr-6">
              <p className="text-sm font-bold text-slate-500 mb-1">Generaciones</p>
              <div className="flex justify-between items-end text-center w-full">
                <div><div className="text-lg font-extrabold text-slate-900">{stats.menores30}</div><div className="text-[10px] font-bold text-slate-400">{'< 30'}</div></div>
                <div><div className="text-lg font-extrabold text-slate-900">{stats.entre30y50}</div><div className="text-[10px] font-bold text-slate-400">30-50</div></div>
                <div><div className="text-lg font-extrabold text-slate-900">{stats.mayores50}</div><div className="text-[10px] font-bold text-slate-400">{'> 50'}</div></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={stats.chartGeneraciones}>
                <Tooltip cursor={{fill: 'transparent'}} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {stats.chartGeneraciones.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* WIDGET 6: Bancarización */}
      <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-h-[140px] flex flex-col justify-center">
        <button onClick={() => toggleWidget('w6')} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors z-10">
          {flippedWidgets['w6'] ? <Undo2 className="w-4 h-4" /> : <BarChart2 className="w-4 h-4" />}
        </button>
        {!flippedWidgets['w6'] ? (
          <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-cyan-50 text-cyan-500 rounded-xl flex items-center justify-center shrink-0"><Landmark className="w-7 h-7" /></div>
            <div>
              <p className="text-sm font-bold text-slate-500">Bancarización (Pagos)</p>
              <h4 className="text-2xl font-extrabold text-slate-900">{stats.bancarizados} <span className="text-sm font-medium text-slate-400">digital</span></h4>
              {stats.noBancarizados > 0 && <p className="text-xs font-bold text-amber-500 mt-1">{stats.noBancarizados} pagos manuales</p>}
            </div>
          </div>
        ) : (
          <div className="h-full w-full pt-4 animate-in fade-in zoom-in-95 duration-300">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={stats.chartBancos}>
                <Tooltip cursor={{fill: 'transparent'}} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {stats.chartBancos.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

    </div>
  );
}
