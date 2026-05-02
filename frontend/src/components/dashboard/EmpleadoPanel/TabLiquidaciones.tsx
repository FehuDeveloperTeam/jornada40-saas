import React from 'react';
import { Send, Clock, CheckCircle, XCircle, RotateCcw, Eye } from 'lucide-react';
import type { UseDashboardReturn } from '../../../hooks/useDashboard';
import type { SolicitudFirma } from '../../../types';

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
  solicitudesFirma: UseDashboardReturn['solicitudesFirma'];
  isSendingFirma: UseDashboardReturn['isSendingFirma'];
  enviarAFirma: UseDashboardReturn['enviarAFirma'];
  cancelarFirma: UseDashboardReturn['cancelarFirma'];
  reenviarFirma: UseDashboardReturn['reenviarFirma'];
  onVerDetalleFirma: (s: SolicitudFirma) => void;
};

const inp: React.CSSProperties = {
  width: '100%',
  background: 'var(--c-bg-input)',
  border: '1px solid var(--c-border-input)',
  borderRadius: '0.75rem',
  padding: '0.625rem 1rem',
  color: 'var(--c-text-1)',
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
  color: 'var(--c-text-3)',
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
  solicitudesFirma, isSendingFirma, enviarAFirma, cancelarFirma, reenviarFirma, onVerDetalleFirma,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto">
      {!showLiqForm ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <div>
              <h3 className="text-lg font-extrabold" style={{ color: 'var(--c-text-1)' }}>Historial de Remuneraciones</h3>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--c-text-3)' }}>Nómina mensual, haberes y descuentos legales.</p>
            </div>
            <button onClick={() => setShowLiqForm(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
              style={{ color: 'var(--c-text-2)', background: 'var(--c-bg-input)', border: '1px solid var(--c-border-input)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-input-focus)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--c-bg-input)')}>
              + Calcular Mes
            </button>
          </div>

          {liquidaciones.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--c-bg-card-2)', border: '1px solid var(--c-border)' }}>
              <p className="font-medium" style={{ color: 'var(--c-text-3)' }}>No hay liquidaciones emitidas para este trabajador.</p>
            </div>
          ) : (
            <div className="rounded-[1.5rem] overflow-x-auto" style={{ background: 'var(--c-bg-card-2)', border: '1px solid var(--c-border)' }}>
              <table className="w-full min-w-[520px] text-left border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--c-border-2)', background: 'var(--c-bg-card-2)' }}>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-3)' }}>Periodo</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-3)' }}>Total Imponible</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-3)' }}>Descuentos Legales</th>
                    <th className="p-4 text-xs font-extrabold uppercase tracking-wider text-right" style={{ color: 'var(--c-text-1)' }}>Líquido a Pagar</th>
                  </tr>
                </thead>
                {liquidaciones.map(liq => (
                  <tbody key={liq.id}>
                    <tr
                      onClick={() => setExpandedLiqId(expandedLiqId === liq.id ? null : liq.id!)}
                      className="transition-colors cursor-pointer group"
                      style={{ borderBottom: '1px solid var(--c-border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="p-4 text-sm font-bold flex items-center gap-2" style={{ color: 'var(--c-text-1)' }}>
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={`w-4 h-4 transition-transform ${expandedLiqId === liq.id ? 'rotate-90 text-blue-400' : ''}`} style={{ color: 'var(--c-text-3)' }}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                        {liq.mes}/{liq.anio}
                      </td>
                      <td className="p-4 text-sm font-medium" style={{ color: 'var(--c-text-2)' }}>${liq.total_imponible.toLocaleString('es-CL')}</td>
                      <td className="p-4 text-sm font-medium" style={{ color: '#f87171' }}>-${liq.total_descuentos.toLocaleString('es-CL')}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-3 flex-wrap">
                          <span className="font-extrabold text-lg" style={{ color: '#34d399' }}>${liq.sueldo_liquido.toLocaleString('es-CL')}</span>
                          {(() => {
                            const solicitudActiva = solicitudesFirma
                              .filter(s => s.tipo_documento === 'LIQUIDACION' && s.liquidacion === liq.id)
                              .sort((a, b) => new Date(b.enviado_en).getTime() - new Date(a.enviado_en).getTime())[0];
                            const sending = !!isSendingFirma[`LIQUIDACION${liq.id}`];
                            return (
                              <>
                                {(!solicitudActiva || solicitudActiva.estado === 'CANCELADO' || solicitudActiva.estado === 'EXPIRADO') && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); enviarAFirma('LIQUIDACION', { liquidacionId: liq.id }); }}
                                    disabled={sending}
                                    className="text-xs font-semibold flex items-center gap-1 transition-colors"
                                    style={{ color: '#a5b4fc', opacity: sending ? 0.5 : 1 }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#c7d2fe')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#a5b4fc')}
                                  >
                                    {sending
                                      ? <><div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />Enviando...</>
                                      : <><Send className="w-3 h-3" />Firma</>}
                                  </button>
                                )}
                                {solicitudActiva?.estado === 'PENDIENTE' && (
                                  <>
                                    <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#fbbf24' }}>
                                      <Clock className="w-3 h-3" />Pendiente
                                    </span>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); reenviarFirma(solicitudActiva.id); }}
                                      className="text-xs transition-colors" style={{ color: 'var(--c-text-3)' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-text-2)')}
                                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-3)')}>
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); cancelarFirma(solicitudActiva.id); }}
                                      className="text-xs transition-colors" style={{ color: 'rgba(239,68,68,0.5)' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.5)')}>
                                      <XCircle className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                                {solicitudActiva?.estado === 'FIRMADO' && (
                                  <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#34d399' }}>
                                      <CheckCircle className="w-3 h-3" />Firmado
                                    </span>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); onVerDetalleFirma(solicitudActiva); }}
                                      className="text-xs font-semibold flex items-center gap-1 transition-colors"
                                      style={{ color: 'var(--c-text-3)' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = '#60a5fa')}
                                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-3)')}>
                                      <Eye className="w-3 h-3" />Ver
                                    </button>
                                  </div>
                                )}
                                {solicitudActiva?.estado === 'RECHAZADO' && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#f87171' }}>
                                      <XCircle className="w-3 h-3" />Rechazado
                                    </span>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); onVerDetalleFirma(solicitudActiva); }}
                                      className="text-xs font-semibold flex items-center gap-1 transition-colors"
                                      style={{ color: 'var(--c-text-3)' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = '#60a5fa')}
                                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-3)')}>
                                      <Eye className="w-3 h-3" />Ver motivo
                                    </button>
                                    <button type="button"
                                      onClick={(e) => { e.stopPropagation(); enviarAFirma('LIQUIDACION', { liquidacionId: liq.id }); }}
                                      disabled={sending}
                                      className="text-xs font-semibold flex items-center gap-1 transition-colors"
                                      style={{ color: sending ? 'var(--c-text-4)' : 'var(--c-text-3)', cursor: sending ? 'not-allowed' : 'pointer' }}
                                      onMouseEnter={e => { if (!sending) e.currentTarget.style.color = 'var(--c-text-2)'; }}
                                      onMouseLeave={e => { if (!sending) e.currentTarget.style.color = 'var(--c-text-3)'; }}>
                                      {sending
                                        ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white/60 rounded-full animate-spin" />Enviando...</>
                                        : <><RotateCcw className="w-3 h-3" />Re-enviar</>}
                                    </button>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <button
                            onClick={(e) => { e.stopPropagation(); descargarLiquidacionPDF(liq.id!, liq.mes, liq.anio); }}
                            className="p-2 rounded-lg transition-colors"
                            style={{ background: 'var(--c-bg-input)', color: 'var(--c-text-2)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.3)'; e.currentTarget.style.color = '#93c5fd'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-bg-input)'; e.currentTarget.style.color = 'var(--c-text-2)'; }}
                            title="Descargar Liquidación Oficial"
                          >
                            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedLiqId === liq.id && (
                      <tr style={{ background: 'var(--c-bg-card-2)', borderBottom: '1px solid var(--c-border)' }}>
                        <td colSpan={4} className="p-6">
                          <div className="grid grid-cols-2 gap-10">
                            <div className="space-y-2">
                              <h5 className="text-xs font-extrabold uppercase tracking-widest pb-2 mb-3" style={{ color: 'var(--c-text-3)', borderBottom: '1px solid var(--c-border)' }}>Detalle de Haberes</h5>
                              <div className="flex justify-between text-sm"><span style={{ color: 'var(--c-text-2)' }}>Sueldo Base ({liq.dias_trabajados}d)</span><span className="font-bold" style={{ color: 'var(--c-text-1)' }}>${liq.sueldo_base.toLocaleString('es-CL')}</span></div>
                              <div className="flex justify-between text-sm"><span style={{ color: 'var(--c-text-2)' }}>Gratificación Legal</span><span className="font-bold" style={{ color: 'var(--c-text-1)' }}>${liq.gratificacion.toLocaleString('es-CL')}</span></div>
                              {liq.detalle_horas_extras?.map((extra, i) => (
                                <div key={`he-${i}`} className="flex justify-between text-sm">
                                  <span style={{ color: 'var(--c-text-2)' }}>{extra.glosa} ({extra.horas}h)</span>
                                  <span className="font-bold" style={{ color: 'var(--c-text-1)' }}>${extra.valor.toLocaleString('es-CL')}</span>
                                </div>
                              ))}
                              {liq.detalle_haberes_no_imponibles?.map((noimp, i) => (
                                <div key={`ni-${i}`} className="flex justify-between text-sm">
                                  <span style={{ color: 'var(--c-text-2)' }}>{noimp.glosa}</span>
                                  <span className="font-bold" style={{ color: 'var(--c-text-1)' }}>${noimp.valor.toLocaleString('es-CL')}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-sm pt-2 mt-2" style={{ borderTop: '1px solid var(--c-border)' }}>
                                <span className="font-extrabold" style={{ color: 'var(--c-text-1)' }}>Total Haberes</span>
                                <span className="font-extrabold" style={{ color: 'var(--c-text-1)' }}>${liq.total_haberes.toLocaleString('es-CL')}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h5 className="text-xs font-extrabold uppercase tracking-widest pb-2 mb-3" style={{ color: 'var(--c-text-3)', borderBottom: '1px solid var(--c-border)' }}>Detalle de Descuentos</h5>
                              <div className="flex justify-between text-sm"><span style={{ color: 'var(--c-text-2)' }}>AFP {liq.afp_nombre}</span><span className="font-bold" style={{ color: '#f87171' }}>-${liq.afp_monto.toLocaleString('es-CL')}</span></div>
                              <div className="flex justify-between text-sm"><span style={{ color: 'var(--c-text-2)' }}>Salud {liq.salud_nombre}</span><span className="font-bold" style={{ color: '#f87171' }}>-${liq.salud_monto.toLocaleString('es-CL')}</span></div>
                              <div className="flex justify-between text-sm"><span style={{ color: 'var(--c-text-2)' }}>Seguro de Cesantía</span><span className="font-bold" style={{ color: '#f87171' }}>-${liq.seguro_cesantia.toLocaleString('es-CL')}</span></div>
                              {liq.anticipo_quincena > 0 && (
                                <div className="flex justify-between text-sm"><span style={{ color: 'var(--c-text-2)' }}>Anticipo Quincena</span><span className="font-bold" style={{ color: '#f87171' }}>-${liq.anticipo_quincena.toLocaleString('es-CL')}</span></div>
                              )}
                              <div className="flex justify-between text-sm pt-2 mt-2" style={{ borderTop: '1px solid var(--c-border)' }}>
                                <span className="font-extrabold" style={{ color: 'var(--c-text-1)' }}>Total Descuentos</span>
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
        <form id="liqForm" onSubmit={generarLiquidacion} className="p-8 rounded-[1.5rem] space-y-8" style={{ background: 'var(--c-bg-card-2)', border: '1px solid var(--c-border)' }}>
          <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <div>
              <h3 className="text-lg font-extrabold" style={{ color: 'var(--c-text-1)' }}>Configurar Liquidación de Sueldo</h3>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--c-text-3)' }}>AFP {selectedEmpleado?.afp || 'MODELO'} y Salud {selectedEmpleado?.sistema_salud || 'FONASA'} se calcularán automáticamente.</p>
            </div>
            <button type="button" onClick={() => setShowLiqForm(false)}
              className="text-sm font-bold transition-colors"
              style={{ color: 'var(--c-text-3)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-text-2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-3)')}>✕ Cancelar</button>
          </div>

          <div className="p-6 rounded-2xl" style={{ background: 'var(--c-bg-card-2)', border: '1px solid var(--c-border)' }}>
            <h4 className="text-xs font-extrabold uppercase tracking-widest mb-4" style={{ color: 'var(--c-text-3)' }}>1. Periodo y Asistencia</h4>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <label style={lbl}>Mes</label>
                <select required value={liqMes} onChange={(e) => setLiqMes(Number(e.target.value))} style={{ ...inp, cursor: 'pointer' }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m} style={{ background: 'var(--c-bg-modal)' }}>Mes {m}</option>)}
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
              <h4 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>2. Otros Haberes Imponibles</h4>
              <button type="button" onClick={() => setHaberesImponiblesList([...haberesImponiblesList, { glosa: '', valor: 0 }])}
                className="text-xs font-bold transition-colors" style={{ color: '#60a5fa' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}>+ Añadir Bono</button>
            </div>
            {haberesImponiblesList.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--c-text-3)' }}>No hay bonos imponibles extra (El Sueldo Base y Gratificación se calculan solos).</p>
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
              <h4 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>3. Horas Extras (Sobresueldo)</h4>
              <button type="button" onClick={() => setHorasExtrasList([...horasExtrasList, { glosa: 'Horas Extras al 50%', horas: 0, recargo: 50, valor: 0 }])}
                className="text-xs font-bold transition-colors" style={{ color: '#60a5fa' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}>+ Añadir Horas Extras</button>
            </div>
            {horasExtrasList.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--c-text-3)' }}>No se registran horas extras este mes.</p>
            ) : (
              <div className="space-y-3">
                {horasExtrasList.map((item, index) => (
                  <div key={index} className="flex gap-4 items-center">
                    <input type="text" placeholder="Glosa" value={item.glosa} onChange={(e) => { const newL = [...horasExtrasList]; newL[index].glosa = e.target.value; setHorasExtrasList(newL); }} style={inp} />
                    <div className="w-24 relative">
                      <span className="absolute text-xs top-[-16px] left-1" style={{ color: 'var(--c-text-3)' }}>Hrs</span>
                      <input type="number" placeholder="0" value={item.horas || ''} onChange={(e) => { const val = Number(e.target.value); const newL = [...horasExtrasList]; newL[index].horas = val; newL[index].valor = calcularValorHorasExtras(val, newL[index].recargo); setHorasExtrasList(newL); }} style={{ ...inp, width: '100%', textAlign: 'center' }} />
                    </div>
                    <div className="w-24 relative">
                      <span className="absolute text-xs top-[-16px] left-1" style={{ color: 'var(--c-text-3)' }}>% Recargo</span>
                      <input type="number" value={item.recargo} onChange={(e) => { const val = Number(e.target.value); const newL = [...horasExtrasList]; newL[index].recargo = val; newL[index].valor = calcularValorHorasExtras(newL[index].horas, val); setHorasExtrasList(newL); }} style={{ ...inp, width: '100%', textAlign: 'center' }} />
                    </div>
                    <div className="w-36 relative">
                      <span className="absolute text-xs top-[-16px] left-1" style={{ color: 'var(--c-text-3)' }}>Total Calculado</span>
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
              <h4 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>4. Haberes NO Imponibles</h4>
              <button type="button" onClick={() => setHaberesNoImponiblesList([...haberesNoImponiblesList, { glosa: 'Asignación Colación', valor: 0 }])}
                className="text-xs font-bold transition-colors" style={{ color: '#60a5fa' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}>+ Añadir Asignación</button>
            </div>
            {haberesNoImponiblesList.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--c-text-3)' }}>No hay haberes no imponibles.</p>
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

          <div className="pt-6 flex justify-end" style={{ borderTop: '1px solid var(--c-border)' }}>
            <button type="submit" disabled={isGeneratingLiq}
              className="px-10 py-4 rounded-xl font-bold text-lg transition-colors"
              style={{ color: 'var(--c-text-2)', background: isGeneratingLiq ? 'var(--c-bg-input)' : 'var(--c-bg-input-focus)', border: '1px solid var(--c-border-input)' }}
              onMouseEnter={e => !isGeneratingLiq && (e.currentTarget.style.background = 'var(--c-bg-input-focus)')}
              onMouseLeave={e => (e.currentTarget.style.background = isGeneratingLiq ? 'var(--c-bg-input)' : 'var(--c-bg-input-focus)')}>
              {isGeneratingLiq ? 'Calculando Nómina...' : 'Generar Liquidación'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
