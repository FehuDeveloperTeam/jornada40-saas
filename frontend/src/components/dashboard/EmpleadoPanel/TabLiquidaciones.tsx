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

const inp: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.75rem',
  padding: '0.625rem 1rem',
  color: '#f8fafc',
  fontSize: '0.875rem',
  fontWeight: 700,
  outline: 'none',
};

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: '0.25rem',
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
          <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <h3 className="text-lg font-extrabold text-white">Historial de Remuneraciones</h3>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Nómina mensual, haberes y descuentos legales.</p>
            </div>
            <button onClick={() => setShowLiqForm(true)}
              className="px-5 py-2.5 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}>
              + Calcular Mes
            </button>
          </div>

          {liquidaciones.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>No hay liquidaciones emitidas para este trabajador.</p>
            </div>
          ) : (
            <div className="rounded-[1.5rem] overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <table className="w-full min-w-[520px] text-left border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Periodo</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Imponible</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Descuentos Legales</th>
                    <th className="p-4 text-xs font-extrabold uppercase tracking-wider text-right text-white">Líquido a Pagar</th>
                  </tr>
                </thead>
                {liquidaciones.map(liq => (
                  <tbody key={liq.id}>
                    <tr
                      onClick={() => setExpandedLiqId(expandedLiqId === liq.id ? null : liq.id!)}
                      className="transition-colors cursor-pointer group"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="p-4 text-sm font-bold text-white flex items-center gap-2">
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={`w-4 h-4 transition-transform ${expandedLiqId === liq.id ? 'rotate-90 text-blue-400' : ''}`} style={{ color: 'rgba(255,255,255,0.3)' }}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                        {liq.mes}/{liq.anio}
                      </td>
                      <td className="p-4 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>${liq.total_imponible.toLocaleString('es-CL')}</td>
                      <td className="p-4 text-sm font-medium" style={{ color: '#f87171' }}>-${liq.total_descuentos.toLocaleString('es-CL')}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-4">
                          <span className="font-extrabold text-lg" style={{ color: '#34d399' }}>${liq.sueldo_liquido.toLocaleString('es-CL')}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); descargarLiquidacionPDF(liq.id!, liq.mes, liq.anio); }}
                            className="p-2 rounded-lg transition-colors"
                            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.3)'; e.currentTarget.style.color = '#93c5fd'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                            title="Descargar Liquidación Oficial"
                          >
                            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedLiqId === liq.id && (
                      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <td colSpan={4} className="p-6">
                          <div className="grid grid-cols-2 gap-10">
                            <div className="space-y-2">
                              <h5 className="text-xs font-extrabold uppercase tracking-widest pb-2 mb-3" style={{ color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>Detalle de Haberes</h5>
                              <div className="flex justify-between text-sm"><span style={{ color: 'rgba(255,255,255,0.5)' }}>Sueldo Base ({liq.dias_trabajados}d)</span><span className="font-bold text-white">${liq.sueldo_base.toLocaleString('es-CL')}</span></div>
                              <div className="flex justify-between text-sm"><span style={{ color: 'rgba(255,255,255,0.5)' }}>Gratificación Legal</span><span className="font-bold text-white">${liq.gratificacion.toLocaleString('es-CL')}</span></div>
                              {liq.detalle_horas_extras?.map((extra, i) => (
                                <div key={`he-${i}`} className="flex justify-between text-sm">
                                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{extra.glosa} ({extra.horas}h)</span>
                                  <span className="font-bold text-white">${extra.valor.toLocaleString('es-CL')}</span>
                                </div>
                              ))}
                              {liq.detalle_haberes_no_imponibles?.map((noimp, i) => (
                                <div key={`ni-${i}`} className="flex justify-between text-sm">
                                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{noimp.glosa}</span>
                                  <span className="font-bold text-white">${noimp.valor.toLocaleString('es-CL')}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-sm pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                <span className="font-extrabold text-white">Total Haberes</span>
                                <span className="font-extrabold text-white">${liq.total_haberes.toLocaleString('es-CL')}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h5 className="text-xs font-extrabold uppercase tracking-widest pb-2 mb-3" style={{ color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>Detalle de Descuentos</h5>
                              <div className="flex justify-between text-sm"><span style={{ color: 'rgba(255,255,255,0.5)' }}>AFP {liq.afp_nombre}</span><span className="font-bold" style={{ color: '#f87171' }}>-${liq.afp_monto.toLocaleString('es-CL')}</span></div>
                              <div className="flex justify-between text-sm"><span style={{ color: 'rgba(255,255,255,0.5)' }}>Salud {liq.salud_nombre}</span><span className="font-bold" style={{ color: '#f87171' }}>-${liq.salud_monto.toLocaleString('es-CL')}</span></div>
                              <div className="flex justify-between text-sm"><span style={{ color: 'rgba(255,255,255,0.5)' }}>Seguro de Cesantía</span><span className="font-bold" style={{ color: '#f87171' }}>-${liq.seguro_cesantia.toLocaleString('es-CL')}</span></div>
                              {liq.anticipo_quincena > 0 && (
                                <div className="flex justify-between text-sm"><span style={{ color: 'rgba(255,255,255,0.5)' }}>Anticipo Quincena</span><span className="font-bold" style={{ color: '#f87171' }}>-${liq.anticipo_quincena.toLocaleString('es-CL')}</span></div>
                              )}
                              <div className="flex justify-between text-sm pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                <span className="font-extrabold text-white">Total Descuentos</span>
                                <span className="font-extrabold" style={{ color: '#f87171' }}>-${liq.total_descuentos.toLocaleString('es-CL')}</span>
                              </div>
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
        <form id="liqForm" onSubmit={generarLiquidacion} className="p-8 rounded-[1.5rem] space-y-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <h3 className="text-lg font-extrabold text-white">Configurar Liquidación de Sueldo</h3>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>AFP {selectedEmpleado?.afp || 'MODELO'} y Salud {selectedEmpleado?.sistema_salud || 'FONASA'} se calcularán automáticamente.</p>
            </div>
            <button type="button" onClick={() => setShowLiqForm(false)}
              className="text-sm font-bold transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>✕ Cancelar</button>
          </div>

          <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h4 className="text-xs font-extrabold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>1. Periodo y Asistencia</h4>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <label style={lbl}>Mes</label>
                <select required value={liqMes} onChange={(e) => setLiqMes(Number(e.target.value))} style={{ ...inp, cursor: 'pointer' }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m} style={{ background: '#0c1a35' }}>Mes {m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Año</label>
                <input type="number" required value={liqAnio} onChange={(e) => setLiqAnio(Number(e.target.value))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Días Trabajados</label>
                <input type="number" min="0" max="30" required value={liqDiasTrabajados} onChange={(e) => setLiqDiasTrabajados(Number(e.target.value))} style={inp} />
              </div>
              <div>
                <label style={{ ...lbl, color: '#fca5a5' }}>Días Ausente</label>
                <input type="number" min="0" max="30" required value={liqAusencias} onChange={(e) => setLiqAusencias(Number(e.target.value))} style={{ ...inp, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-4">
              <h4 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>2. Otros Haberes Imponibles</h4>
              <button type="button" onClick={() => setHaberesImponiblesList([...haberesImponiblesList, { glosa: '', valor: 0 }])}
                className="text-xs font-bold transition-colors" style={{ color: '#60a5fa' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}>+ Añadir Bono</button>
            </div>
            {haberesImponiblesList.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.3)' }}>No hay bonos imponibles extra (El Sueldo Base y Gratificación se calculan solos).</p>
            ) : (
              <div className="space-y-3">
                {haberesImponiblesList.map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <input type="text" placeholder="Glosa (Ej: Bono Producción)" value={item.glosa} onChange={(e) => { const newL = [...haberesImponiblesList]; newL[index].glosa = e.target.value; setHaberesImponiblesList(newL); }} style={inp} />
                    <input type="number" placeholder="Valor ($)" value={item.valor || ''} onChange={(e) => { const newL = [...haberesImponiblesList]; newL[index].valor = Number(e.target.value); setHaberesImponiblesList(newL); }} style={{ ...inp, width: '10rem', textAlign: 'right' }} />
                    <button type="button" onClick={() => setHaberesImponiblesList(haberesImponiblesList.filter((_, i) => i !== index))}
                      className="font-bold px-3 rounded-lg transition-colors" style={{ color: '#f87171' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-end mb-4">
              <h4 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>3. Horas Extras (Sobresueldo)</h4>
              <button type="button" onClick={() => setHorasExtrasList([...horasExtrasList, { glosa: 'Horas Extras al 50%', horas: 0, recargo: 50, valor: 0 }])}
                className="text-xs font-bold transition-colors" style={{ color: '#60a5fa' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}>+ Añadir Horas Extras</button>
            </div>
            {horasExtrasList.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.3)' }}>No se registran horas extras este mes.</p>
            ) : (
              <div className="space-y-3">
                {horasExtrasList.map((item, index) => (
                  <div key={index} className="flex gap-4 items-center">
                    <input type="text" placeholder="Glosa" value={item.glosa} onChange={(e) => { const newL = [...horasExtrasList]; newL[index].glosa = e.target.value; setHorasExtrasList(newL); }} style={inp} />
                    <div className="w-24 relative">
                      <span className="absolute text-xs top-[-16px] left-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Hrs</span>
                      <input type="number" placeholder="0" value={item.horas || ''} onChange={(e) => { const val = Number(e.target.value); const newL = [...horasExtrasList]; newL[index].horas = val; newL[index].valor = calcularValorHorasExtras(val, newL[index].recargo); setHorasExtrasList(newL); }} style={{ ...inp, width: '100%', textAlign: 'center' }} />
                    </div>
                    <div className="w-24 relative">
                      <span className="absolute text-xs top-[-16px] left-1" style={{ color: 'rgba(255,255,255,0.3)' }}>% Recargo</span>
                      <input type="number" value={item.recargo} onChange={(e) => { const val = Number(e.target.value); const newL = [...horasExtrasList]; newL[index].recargo = val; newL[index].valor = calcularValorHorasExtras(newL[index].horas, val); setHorasExtrasList(newL); }} style={{ ...inp, width: '100%', textAlign: 'center' }} />
                    </div>
                    <div className="w-36 relative">
                      <span className="absolute text-xs top-[-16px] left-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Total Calculado</span>
                      <input type="number" readOnly value={item.valor || 0} style={{ ...inp, width: '100%', textAlign: 'right', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.25)', color: '#93c5fd', cursor: 'not-allowed' }} />
                    </div>
                    <button type="button" onClick={() => setHorasExtrasList(horasExtrasList.filter((_, i) => i !== index))}
                      className="font-bold px-3 rounded-lg mt-2 transition-colors" style={{ color: '#f87171' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-end mb-4">
              <h4 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>4. Haberes NO Imponibles</h4>
              <button type="button" onClick={() => setHaberesNoImponiblesList([...haberesNoImponiblesList, { glosa: 'Asignación Colación', valor: 0 }])}
                className="text-xs font-bold transition-colors" style={{ color: '#60a5fa' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}>+ Añadir Asignación</button>
            </div>
            {haberesNoImponiblesList.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.3)' }}>No hay haberes no imponibles.</p>
            ) : (
              <div className="space-y-3">
                {haberesNoImponiblesList.map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <input type="text" placeholder="Glosa (Ej: Colación, Movilización, Viático)" value={item.glosa} onChange={(e) => { const newL = [...haberesNoImponiblesList]; newL[index].glosa = e.target.value; setHaberesNoImponiblesList(newL); }} style={inp} />
                    <input type="number" placeholder="Valor ($)" value={item.valor || ''} onChange={(e) => { const newL = [...haberesNoImponiblesList]; newL[index].valor = Number(e.target.value); setHaberesNoImponiblesList(newL); }} style={{ ...inp, width: '10rem', textAlign: 'right' }} />
                    <button type="button" onClick={() => setHaberesNoImponiblesList(haberesNoImponiblesList.filter((_, i) => i !== index))}
                      className="font-bold px-3 rounded-lg transition-colors" style={{ color: '#f87171' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-6 flex justify-end" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button type="submit" disabled={isGeneratingLiq}
              className="px-10 py-4 text-white rounded-xl font-bold text-lg transition-colors"
              style={{ background: isGeneratingLiq ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
              onMouseEnter={e => !isGeneratingLiq && (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = isGeneratingLiq ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.12)')}>
              {isGeneratingLiq ? 'Calculando Nómina...' : 'Generar Liquidación'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
