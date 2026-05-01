import React from 'react';
import { Send, Clock, CheckCircle, XCircle, RotateCcw, Eye } from 'lucide-react';
import type { UseDashboardReturn } from '../../../hooks/useDashboard';
import type { SolicitudFirma } from '../../../types';

const CAUSALES = [
  { value: '159_1',  label: 'Art. 159 N°1 — Mutuo acuerdo de las partes' },
  { value: '159_2',  label: 'Art. 159 N°2 — Renuncia voluntaria del trabajador' },
  { value: '159_3',  label: 'Art. 159 N°3 — Muerte del trabajador' },
  { value: '159_4',  label: 'Art. 159 N°4 — Vencimiento del plazo convenido' },
  { value: '159_5',  label: 'Art. 159 N°5 — Conclusión del trabajo o servicio' },
  { value: '159_6',  label: 'Art. 159 N°6 — Caso fortuito o fuerza mayor' },
  { value: '160_1a', label: 'Art. 160 N°1 a) — Falta de probidad' },
  { value: '160_1b', label: 'Art. 160 N°1 b) — Acoso sexual' },
  { value: '160_1c', label: 'Art. 160 N°1 c) — Vías de hecho' },
  { value: '160_1d', label: 'Art. 160 N°1 d) — Injurias al empleador' },
  { value: '160_1e', label: 'Art. 160 N°1 e) — Conducta inmoral grave' },
  { value: '160_1f', label: 'Art. 160 N°1 f) — Acoso laboral (mobbing)' },
  { value: '160_2',  label: 'Art. 160 N°2 — Negociaciones prohibidas' },
  { value: '160_3',  label: 'Art. 160 N°3 — Inasistencias injustificadas' },
  { value: '160_4a', label: 'Art. 160 N°4 a) — Abandono: salida intempestiva' },
  { value: '160_4b', label: 'Art. 160 N°4 b) — Abandono: negativa a trabajar' },
  { value: '160_5',  label: 'Art. 160 N°5 — Actos que afectan la seguridad' },
  { value: '160_6',  label: 'Art. 160 N°6 — Daño material intencional' },
  { value: '160_7',  label: 'Art. 160 N°7 — Incumplimiento grave del contrato' },
  { value: '161_1',  label: 'Art. 161 inc. 1° — Necesidades de la empresa' },
  { value: '161_2',  label: 'Art. 161 inc. 2° — Desahucio del empleador' },
  { value: '163bis', label: 'Art. 163 bis — Liquidación concursal del empleador' },
];

const CAUSALES_CON_INDEMNIZACION = new Set(['161_1', '161_2', '163bis']);

const clp = (n: number) =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const inp: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.625rem',
  padding: '0.625rem 0.75rem',
  color: '#f8fafc',
  fontSize: '0.875rem',
  outline: 'none',
};

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: '0.25rem',
};

type Props = {
  selectedEmpleado:     UseDashboardReturn['selectedEmpleado'];
  finiquitos:           UseDashboardReturn['finiquitos'];
  showFiniquitoForm:    UseDashboardReturn['showFiniquitoForm'];
  setShowFiniquitoForm: UseDashboardReturn['setShowFiniquitoForm'];
  finiquitoData:        UseDashboardReturn['finiquitoData'];
  setFiniquitoData:     UseDashboardReturn['setFiniquitoData'];
  guardarFiniquito:     UseDashboardReturn['guardarFiniquito'];
  isSavingFiniquito:    UseDashboardReturn['isSavingFiniquito'];
  descargarFiniquitoPDF: UseDashboardReturn['descargarFiniquitoPDF'];
  solicitudesFirma:    UseDashboardReturn['solicitudesFirma'];
  isSendingFirma:      UseDashboardReturn['isSendingFirma'];
  enviarAFirma:        UseDashboardReturn['enviarAFirma'];
  cancelarFirma:       UseDashboardReturn['cancelarFirma'];
  reenviarFirma:       UseDashboardReturn['reenviarFirma'];
  onVerDetalleFirma:   (s: SolicitudFirma) => void;
};

export default function TabFiniquito({
  selectedEmpleado,
  finiquitos,
  showFiniquitoForm, setShowFiniquitoForm,
  finiquitoData, setFiniquitoData,
  guardarFiniquito, isSavingFiniquito, descargarFiniquitoPDF,
  solicitudesFirma, isSendingFirma, enviarAFirma, cancelarFirma, reenviarFirma, onVerDetalleFirma,
}: Props) {
  const set = (patch: Partial<UseDashboardReturn['finiquitoData']>) =>
    setFiniquitoData({ ...finiquitoData, ...patch });

  const totalPreview = Math.round(
    (finiquitoData.sueldo_base ?? 0) * (finiquitoData.dias_trabajados_ultimo_mes ?? 30) / 30 +
    (finiquitoData.gratificacion_proporcional ?? 0) +
    (finiquitoData.feriado_proporcional ?? 0) +
    (finiquitoData.indemnizacion_anos_servicio ?? 0) +
    (finiquitoData.indemnizacion_sustitutiva_aviso ?? 0) +
    (finiquitoData.otros_haberes ?? 0) -
    (finiquitoData.otros_descuentos ?? 0) -
    (finiquitoData.descuentos_prevision ?? 0),
  );

  const tieneIndemnizacion = CAUSALES_CON_INDEMNIZACION.has(finiquitoData.causal_articulo ?? '');

  const abrirFormulario = () => {
    setFiniquitoData({
      sueldo_base: selectedEmpleado?.sueldo_base ?? 0,
      dias_trabajados_ultimo_mes: 30,
      fecha_emision: new Date().toISOString().split('T')[0],
      gratificacion_proporcional: 0,
      feriado_proporcional: 0,
      indemnizacion_anos_servicio: 0,
      indemnizacion_sustitutiva_aviso: 0,
      otros_haberes: 0,
      otros_descuentos: 0,
      descuentos_prevision: 0,
      modalidad: 'PRESENCIAL',
    });
    setShowFiniquitoForm(true);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {!showFiniquitoForm ? (
        <div className="space-y-6">

          {/* ENCABEZADO HISTORIAL */}
          <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <h3 className="text-lg font-bold text-white">Historial de Finiquitos</h3>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Documentos de término de relación laboral del trabajador.
              </p>
            </div>
            <button
              onClick={abrirFormulario}
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl flex items-center gap-2 transition-colors"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
            >
              + Crear Finiquito
            </button>
          </div>

          {/* AVISO: el finiquito no desvincula al trabajador automáticamente */}
          <div className="px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', color: '#fbbf24' }}>
            El finiquito es un documento contable. Para desvincular al trabajador del sistema, actualiza su estado en la pestaña <strong>Datos Generales</strong>.
          </div>

          {finiquitos.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                No hay finiquitos registrados para {selectedEmpleado?.nombres}.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Causal', 'Fecha término', 'Fecha emisión', 'Total a pagar', ''].map(h => (
                      <th key={h} className="p-4 text-xs font-semibold uppercase"
                        style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {finiquitos.map(fin => (
                    <tr key={fin.id}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="p-4 text-sm text-white font-medium" style={{ maxWidth: '220px' }}>
                        <span className="line-clamp-2">{fin.causal_articulo_label || fin.causal_articulo}</span>
                      </td>
                      <td className="p-4 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {fin.fecha_termino}
                      </td>
                      <td className="p-4 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {fin.fecha_emision}
                      </td>
                      <td className="p-4 text-sm font-bold" style={{ color: '#34d399' }}>
                        {clp(fin.total_a_pagar)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-3 flex-wrap">
                          {(() => {
                            const solicitudActiva = solicitudesFirma
                              .filter(s => s.tipo_documento === 'FINIQUITO' && s.finiquito === fin.id)
                              .sort((a, b) => new Date(b.enviado_en).getTime() - new Date(a.enviado_en).getTime())[0];
                            const sending = !!isSendingFirma[`FINIQUITO${fin.id}`];
                            return (
                              <>
                                {(!solicitudActiva || solicitudActiva.estado === 'CANCELADO' || solicitudActiva.estado === 'EXPIRADO') && (
                                  <button
                                    type="button"
                                    onClick={() => enviarAFirma('FINIQUITO', { finiquitoId: fin.id })}
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
                                    <button type="button" onClick={() => reenviarFirma(solicitudActiva.id)}
                                      className="text-xs transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                    <button type="button" onClick={() => cancelarFirma(solicitudActiva.id)}
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
                                    <button type="button" onClick={() => onVerDetalleFirma(solicitudActiva)}
                                      className="text-xs font-semibold flex items-center gap-1 transition-colors"
                                      style={{ color: 'rgba(255,255,255,0.4)' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = '#60a5fa')}
                                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
                                      <Eye className="w-3 h-3" />Ver
                                    </button>
                                  </div>
                                )}
                                {solicitudActiva?.estado === 'RECHAZADO' && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#f87171' }}>
                                      <XCircle className="w-3 h-3" />Rechazado
                                    </span>
                                    <button type="button" onClick={() => onVerDetalleFirma(solicitudActiva)}
                                      className="text-xs font-semibold flex items-center gap-1 transition-colors"
                                      style={{ color: 'rgba(255,255,255,0.4)' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = '#60a5fa')}
                                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
                                      <Eye className="w-3 h-3" />Ver motivo
                                    </button>
                                    <button type="button"
                                      onClick={() => enviarAFirma('FINIQUITO', { finiquitoId: fin.id })}
                                      disabled={sending}
                                      className="text-xs font-semibold flex items-center gap-1 transition-colors"
                                      style={{ color: sending ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.4)', cursor: sending ? 'not-allowed' : 'pointer' }}
                                      onMouseEnter={e => { if (!sending) e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                                      onMouseLeave={e => { if (!sending) e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}>
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
                            onClick={() => descargarFiniquitoPDF(fin.id)}
                            className="text-sm font-semibold flex items-center gap-1 transition-colors"
                            style={{ color: '#60a5fa' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}
                          >
                            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* FORMULARIO */
        <form
          id="finiquitoForm"
          onSubmit={guardarFiniquito}
          className="space-y-6"
        >
          <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <h3 className="text-lg font-bold text-white">Nuevo Finiquito</h3>
            <button type="button" onClick={() => setShowFiniquitoForm(false)}
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>✕</button>
          </div>

          {/* SECCIÓN: Causal y fechas */}
          <div className="p-6 rounded-2xl space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 className="text-sm font-bold text-white mb-2">Datos del término</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label style={lbl}>Causal de término</label>
                <select
                  required
                  value={finiquitoData.causal_articulo ?? ''}
                  onChange={e => set({ causal_articulo: e.target.value })}
                  style={{ ...inp, cursor: 'pointer' }}
                >
                  <option value="" style={{ background: '#0c1a35' }}>— Seleccionar causal —</option>
                  {CAUSALES.map(c => (
                    <option key={c.value} value={c.value} style={{ background: '#0c1a35' }}>{c.label}</option>
                  ))}
                </select>
                {tieneIndemnizacion && (
                  <p className="mt-1.5 text-xs" style={{ color: '#fbbf24' }}>
                    Esta causal contempla indemnización por años de servicio.
                  </p>
                )}
              </div>

              <div>
                <label style={lbl}>Fecha de término</label>
                <input
                  type="date"
                  required
                  value={finiquitoData.fecha_termino ?? ''}
                  onChange={e => set({ fecha_termino: e.target.value })}
                  style={{ ...inp, colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label style={lbl}>Fecha de emisión</label>
                <input
                  type="date"
                  required
                  value={finiquitoData.fecha_emision ?? ''}
                  onChange={e => set({ fecha_emision: e.target.value })}
                  style={{ ...inp, colorScheme: 'dark' }}
                />
              </div>

              <div>
                <label style={lbl}>Modalidad de firma</label>
                <select
                  value={finiquitoData.modalidad ?? 'PRESENCIAL'}
                  onChange={e => set({ modalidad: e.target.value as 'PRESENCIAL' | 'ELECTRONICO' })}
                  style={{ ...inp, cursor: 'pointer' }}
                >
                  <option value="PRESENCIAL"  style={{ background: '#0c1a35' }}>Presencial ante ministro de fe</option>
                  <option value="ELECTRONICO" style={{ background: '#0c1a35' }}>Electrónico (voluntario)</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Días trabajados último mes</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  required
                  value={finiquitoData.dias_trabajados_ultimo_mes ?? 30}
                  onChange={e => set({ dias_trabajados_ultimo_mes: Number(e.target.value) })}
                  style={inp}
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN: Haberes */}
          <div className="p-6 rounded-2xl space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 className="text-sm font-bold text-white mb-2">Haberes</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={lbl}>Sueldo base mensual ($)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={finiquitoData.sueldo_base ?? 0}
                  onChange={e => set({ sueldo_base: Number(e.target.value) })}
                  style={inp}
                />
                <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Proporcional: {clp(Math.round((finiquitoData.sueldo_base ?? 0) * (finiquitoData.dias_trabajados_ultimo_mes ?? 30) / 30))}
                </p>
              </div>
              <div>
                <label style={lbl}>Gratificación proporcional ($)</label>
                <input
                  type="number"
                  min={0}
                  value={finiquitoData.gratificacion_proporcional ?? 0}
                  onChange={e => set({ gratificacion_proporcional: Number(e.target.value) })}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Vacaciones proporcionales ($)</label>
                <input
                  type="number"
                  min={0}
                  value={finiquitoData.feriado_proporcional ?? 0}
                  onChange={e => set({ feriado_proporcional: Number(e.target.value) })}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Indemnización años de servicio ($)</label>
                <input
                  type="number"
                  min={0}
                  value={finiquitoData.indemnizacion_anos_servicio ?? 0}
                  onChange={e => set({ indemnizacion_anos_servicio: Number(e.target.value) })}
                  disabled={!tieneIndemnizacion}
                  style={{ ...inp, opacity: tieneIndemnizacion ? 1 : 0.4 }}
                />
                {!tieneIndemnizacion && (
                  <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Solo para Art. 161 y 163 bis</p>
                )}
              </div>
              <div>
                <label style={lbl}>Indemnización sustitutiva de aviso ($)</label>
                <input
                  type="number"
                  min={0}
                  value={finiquitoData.indemnizacion_sustitutiva_aviso ?? 0}
                  onChange={e => set({ indemnizacion_sustitutiva_aviso: Number(e.target.value) })}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Otros haberes ($)</label>
                <input
                  type="number"
                  min={0}
                  value={finiquitoData.otros_haberes ?? 0}
                  onChange={e => set({ otros_haberes: Number(e.target.value) })}
                  style={inp}
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN: Descuentos */}
          <div className="p-6 rounded-2xl space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 className="text-sm font-bold text-white mb-2">Descuentos</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={lbl}>Otros descuentos ($)</label>
                <input
                  type="number"
                  min={0}
                  value={finiquitoData.otros_descuentos ?? 0}
                  onChange={e => set({ otros_descuentos: Number(e.target.value) })}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Descuentos previsión (AFP + Salud) ($)</label>
                <input
                  type="number"
                  min={0}
                  value={finiquitoData.descuentos_prevision ?? 0}
                  onChange={e => set({ descuentos_prevision: Number(e.target.value) })}
                  style={inp}
                />
              </div>
            </div>
          </div>

          {/* TOTAL PREVIEW */}
          <div className="p-5 rounded-2xl flex items-center justify-between"
            style={{ background: totalPreview >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${totalPreview >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
            <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>Total estimado a pagar</span>
            <span className="text-2xl font-bold" style={{ color: totalPreview >= 0 ? '#34d399' : '#f87171' }}>
              {clp(totalPreview)}
            </span>
          </div>

          {isSavingFiniquito && (
            <p className="text-sm text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>Generando finiquito...</p>
          )}
        </form>
      )}
    </div>
  );
}
