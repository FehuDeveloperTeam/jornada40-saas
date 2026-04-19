import type { UseDashboardReturn } from '../../../hooks/useDashboard';

type Props = {
  selectedEmpleado: UseDashboardReturn['selectedEmpleado'];
  liquidaciones: UseDashboardReturn['liquidaciones'];
  showLiqForm: UseDashboardReturn['showLiqForm'];
  setShowLiqForm: UseDashboardReturn['setShowLiqForm'];
  expandedLiqId: UseDashboardReturn['expandedLiqId'];
  setExpandedLiqId: UseDashboardReturn['setExpandedLiqId'];
  liqMes: UseDashboardReturn['liqMes'];
  setLiqMes: UseDashboardReturn['setLiqMes'];
  liqAnio: UseDashboardReturn['liqAnio'];
  setLiqAnio: UseDashboardReturn['setLiqAnio'];
  liqDiasTrabajados: UseDashboardReturn['liqDiasTrabajados'];
  setLiqDiasTrabajados: UseDashboardReturn['setLiqDiasTrabajados'];
  liqAusencias: UseDashboardReturn['liqAusencias'];
  setLiqAusencias: UseDashboardReturn['setLiqAusencias'];
  haberesImponiblesList: UseDashboardReturn['haberesImponiblesList'];
  setHaberesImponiblesList: UseDashboardReturn['setHaberesImponiblesList'];
  haberesNoImponiblesList: UseDashboardReturn['haberesNoImponiblesList'];
  setHaberesNoImponiblesList: UseDashboardReturn['setHaberesNoImponiblesList'];
  horasExtrasList: UseDashboardReturn['horasExtrasList'];
  setHorasExtrasList: UseDashboardReturn['setHorasExtrasList'];
  isGeneratingLiq: UseDashboardReturn['isGeneratingLiq'];
  generarLiquidacion: UseDashboardReturn['generarLiquidacion'];
  descargarLiquidacionPDF: UseDashboardReturn['descargarLiquidacionPDF'];
  calcularValorHorasExtras: UseDashboardReturn['calcularValorHorasExtras'];
};

export default function TabLiquidaciones({
  selectedEmpleado, liquidaciones, showLiqForm, setShowLiqForm,
  expandedLiqId, setExpandedLiqId,
  liqMes, setLiqMes, liqAnio, setLiqAnio,
  liqDiasTrabajados, setLiqDiasTrabajados, liqAusencias, setLiqAusencias,
  haberesImponiblesList, setHaberesImponiblesList,
  haberesNoImponiblesList, setHaberesNoImponiblesList,
  horasExtrasList, setHorasExtrasList,
  isGeneratingLiq, generarLiquidacion, descargarLiquidacionPDF, calcularValorHorasExtras,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto">
      {!showLiqForm ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Historial de Remuneraciones</h3>
              <p className="text-sm font-medium text-slate-500">Nómina mensual, haberes y descuentos legales.</p>
            </div>
            <button onClick={() => setShowLiqForm(true)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-md shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center gap-2">
              + Calcular Mes
            </button>
          </div>

          {liquidaciones.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <p className="text-slate-500 font-medium">No hay liquidaciones emitidas para este trabajador.</p>
            </div>
          ) : (
            <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Periodo</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Total Imponible</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Descuentos Legales</th>
                    <th className="p-4 text-xs font-extrabold text-slate-900 uppercase tracking-wider text-right">Líquido a Pagar</th>
                  </tr>
                </thead>
                {liquidaciones.map(liq => (
                  <tbody key={liq.id}>
                    <tr
                      onClick={() => setExpandedLiqId(expandedLiqId === liq.id ? null : liq.id!)}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 text-sm font-bold text-slate-900 flex items-center gap-2">
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={`w-4 h-4 text-slate-400 transition-transform ${expandedLiqId === liq.id ? 'rotate-90 text-blue-600' : 'group-hover:text-slate-600'}`}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                        {liq.mes}/{liq.anio}
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-600">${liq.total_imponible.toLocaleString('es-CL')}</td>
                      <td className="p-4 text-sm font-medium text-rose-600">-${liq.total_descuentos.toLocaleString('es-CL')}</td>
                      <td className="p-4 flex items-center justify-end gap-4">
                        <span className="font-extrabold text-emerald-600 text-lg">${liq.sueldo_liquido.toLocaleString('es-CL')}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); descargarLiquidacionPDF(liq.id!, liq.mes, liq.anio); }}
                          className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white rounded-lg transition-colors shadow-sm"
                          title="Descargar Liquidación Oficial"
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        </button>
                      </td>
                    </tr>

                    {expandedLiqId === liq.id && (
                      <tr className="bg-slate-50/80 border-b border-slate-200">
                        <td colSpan={4} className="p-6">
                          <div className="grid grid-cols-2 gap-10">
                            <div className="space-y-2">
                              <h5 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">Detalle de Haberes</h5>
                              <div className="flex justify-between text-sm"><span className="text-slate-600">Sueldo Base ({liq.dias_trabajados}d)</span><span className="font-bold text-slate-900">${liq.sueldo_base.toLocaleString('es-CL')}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-slate-600">Gratificación Legal</span><span className="font-bold text-slate-900">${liq.gratificacion.toLocaleString('es-CL')}</span></div>
                              {liq.detalle_horas_extras?.map((extra, i) => (
                                <div key={`he-${i}`} className="flex justify-between text-sm">
                                  <span className="text-slate-600">{extra.glosa} ({extra.horas}h)</span>
                                  <span className="font-bold text-slate-900">${extra.valor.toLocaleString('es-CL')}</span>
                                </div>
                              ))}
                              {liq.detalle_haberes_no_imponibles?.map((noimp, i) => (
                                <div key={`ni-${i}`} className="flex justify-between text-sm">
                                  <span className="text-slate-600">{noimp.glosa}</span>
                                  <span className="font-bold text-slate-900">${noimp.valor.toLocaleString('es-CL')}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-sm pt-2 mt-2 border-t border-slate-200"><span className="font-extrabold text-slate-900">Total Haberes</span><span className="font-extrabold text-slate-900">${liq.total_haberes.toLocaleString('es-CL')}</span></div>
                            </div>
                            <div className="space-y-2">
                              <h5 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">Detalle de Descuentos</h5>
                              <div className="flex justify-between text-sm"><span className="text-slate-600">AFP {liq.afp_nombre}</span><span className="font-bold text-rose-600">-${liq.afp_monto.toLocaleString('es-CL')}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-slate-600">Salud {liq.salud_nombre}</span><span className="font-bold text-rose-600">-${liq.salud_monto.toLocaleString('es-CL')}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-slate-600">Seguro de Cesantía</span><span className="font-bold text-rose-600">-${liq.seguro_cesantia.toLocaleString('es-CL')}</span></div>
                              {liq.anticipo_quincena > 0 && (
                                <div className="flex justify-between text-sm"><span className="text-slate-600">Anticipo Quincena</span><span className="font-bold text-rose-600">-${liq.anticipo_quincena.toLocaleString('es-CL')}</span></div>
                              )}
                              <div className="flex justify-between text-sm pt-2 mt-2 border-t border-slate-200"><span className="font-extrabold text-slate-900">Total Descuentos</span><span className="font-extrabold text-rose-600">-${liq.total_descuentos.toLocaleString('es-CL')}</span></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </div>
      ) : (
        <form id="liqForm" onSubmit={generarLiquidacion} className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-slate-200 space-y-8">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Configurar Liquidación de Sueldo</h3>
              <p className="text-sm font-medium text-slate-500">AFP {selectedEmpleado?.afp || 'MODELO'} y Salud {selectedEmpleado?.sistema_salud || 'FONASA'} se calcularán automáticamente.</p>
            </div>
            <button type="button" onClick={() => setShowLiqForm(false)} className="text-slate-400 hover:text-slate-900 font-bold">✕ Cancelar</button>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">1. Periodo y Asistencia</h4>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mes</label>
                <select required value={liqMes} onChange={(e) => setLiqMes(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-bold text-slate-700">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>Mes {m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Año</label>
                <input type="number" required value={liqAnio} onChange={(e) => setLiqAnio(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-bold text-slate-700" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Días Trabajados</label>
                <input type="number" min="0" max="30" required value={liqDiasTrabajados} onChange={(e) => setLiqDiasTrabajados(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-bold text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">Días Ausente</label>
                <input type="number" min="0" max="30" required value={liqAusencias} onChange={(e) => setLiqAusencias(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-rose-200 focus:ring-rose-500 bg-rose-50 outline-none font-bold text-rose-700" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-4">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">2. Otros Haberes Imponibles</h4>
              <button type="button" onClick={() => setHaberesImponiblesList([...haberesImponiblesList, { glosa: '', valor: 0 }])} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Añadir Bono</button>
            </div>
            {haberesImponiblesList.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No hay bonos imponibles extra (El Sueldo Base y Gratificación se calculan solos).</p>
            ) : (
              <div className="space-y-3">
                {haberesImponiblesList.map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <input type="text" placeholder="Glosa (Ej: Bono Producción)" value={item.glosa} onChange={(e) => { const newL = [...haberesImponiblesList]; newL[index].glosa = e.target.value; setHaberesImponiblesList(newL); }} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none" />
                    <input type="number" placeholder="Valor ($)" value={item.valor || ''} onChange={(e) => { const newL = [...haberesImponiblesList]; newL[index].valor = Number(e.target.value); setHaberesImponiblesList(newL); }} className="w-40 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none text-right" />
                    <button type="button" onClick={() => setHaberesImponiblesList(haberesImponiblesList.filter((_, i) => i !== index))} className="text-rose-500 font-bold px-3 hover:bg-rose-50 rounded-lg">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-end mb-4">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">3. Horas Extras (Sobresueldo)</h4>
              <button type="button" onClick={() => setHorasExtrasList([...horasExtrasList, { glosa: 'Horas Extras al 50%', horas: 0, recargo: 50, valor: 0 }])} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Añadir Horas Extras</button>
            </div>
            {horasExtrasList.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No se registran horas extras este mes.</p>
            ) : (
              <div className="space-y-3">
                {horasExtrasList.map((item, index) => (
                  <div key={index} className="flex gap-4 items-center">
                    <input type="text" placeholder="Glosa" value={item.glosa} onChange={(e) => { const newL = [...horasExtrasList]; newL[index].glosa = e.target.value; setHorasExtrasList(newL); }} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none" />
                    <div className="w-24 relative">
                      <span className="absolute text-xs text-slate-400 top-[-16px] left-1">Hrs</span>
                      <input type="number" placeholder="0" value={item.horas || ''} onChange={(e) => { const val = Number(e.target.value); const newL = [...horasExtrasList]; newL[index].horas = val; newL[index].valor = calcularValorHorasExtras(val, newL[index].recargo); setHorasExtrasList(newL); }} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 outline-none text-center" />
                    </div>
                    <div className="w-24 relative">
                      <span className="absolute text-xs text-slate-400 top-[-16px] left-1">% Recargo</span>
                      <input type="number" value={item.recargo} onChange={(e) => { const val = Number(e.target.value); const newL = [...horasExtrasList]; newL[index].recargo = val; newL[index].valor = calcularValorHorasExtras(newL[index].horas, val); setHorasExtrasList(newL); }} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 outline-none text-center" />
                    </div>
                    <div className="w-36 relative">
                      <span className="absolute text-xs text-slate-400 top-[-16px] left-1">Total Calculado</span>
                      <input type="number" readOnly value={item.valor || 0} className="w-full px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50/50 font-extrabold text-blue-800 outline-none text-right cursor-not-allowed" />
                    </div>
                    <button type="button" onClick={() => setHorasExtrasList(horasExtrasList.filter((_, i) => i !== index))} className="text-rose-500 font-bold px-3 hover:bg-rose-50 rounded-lg mt-2">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-end mb-4">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">4. Haberes NO Imponibles</h4>
              <button type="button" onClick={() => setHaberesNoImponiblesList([...haberesNoImponiblesList, { glosa: 'Asignación Colación', valor: 0 }])} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Añadir Asignación</button>
            </div>
            {haberesNoImponiblesList.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No hay haberes no imponibles.</p>
            ) : (
              <div className="space-y-3">
                {haberesNoImponiblesList.map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <input type="text" placeholder="Glosa (Ej: Colación, Movilización, Viático)" value={item.glosa} onChange={(e) => { const newL = [...haberesNoImponiblesList]; newL[index].glosa = e.target.value; setHaberesNoImponiblesList(newL); }} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none" />
                    <input type="number" placeholder="Valor ($)" value={item.valor || ''} onChange={(e) => { const newL = [...haberesNoImponiblesList]; newL[index].valor = Number(e.target.value); setHaberesNoImponiblesList(newL); }} className="w-40 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none text-right" />
                    <button type="button" onClick={() => setHaberesNoImponiblesList(haberesNoImponiblesList.filter((_, i) => i !== index))} className="text-rose-500 font-bold px-3 hover:bg-rose-50 rounded-lg">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button type="submit" disabled={isGeneratingLiq} className="px-10 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:bg-slate-300 transition-all shadow-xl shadow-slate-900/10 text-lg">
              {isGeneratingLiq ? 'Calculando Nómina...' : 'Generar Liquidación'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
