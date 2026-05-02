import React from 'react';
import { Send, Clock, CheckCircle, XCircle, RotateCcw, Eye } from 'lucide-react';
import type { UseDashboardReturn } from '../../../hooks/useDashboard';
import type { SolicitudFirma } from '../../../types';

// Feriados fijos chilenos MM-DD (Art. 67 Código del Trabajo)
const FERIADOS_FIJOS = new Set([
  '01-01', '05-01', '05-21', '06-29', '07-16',
  '08-15', '09-18', '09-19', '10-12', '10-31',
  '11-01', '12-08', '12-25',
]);

function calcularDiasHabiles(inicio: string, fin: string): number {
  if (!inicio || !fin) return 0;
  const start = new Date(inicio + 'T12:00:00');
  const end   = new Date(fin   + 'T12:00:00');
  if (start > end) return 0;
  let dias = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow  = cur.getDay(); // 0 = domingo
    const mmdd = String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
    if (dow !== 0 && !FERIADOS_FIJOS.has(mmdd)) dias++;
    cur.setDate(cur.getDate() + 1);
  }
  return dias;
}

const TIPO_LABEL: Record<string, string> = {
  VACACION_LEGAL:      'Vacación Legal (Art. 67)',
  VACACION_PROGRESIVA: 'Feriado Progresivo (Art. 68)',
  PERMISO_SIN_GOCE:    'Permiso Sin Goce de Sueldo',
};

const ESTADO_STYLE: Record<string, React.CSSProperties> = {
  APROBADO:  { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' },
  PENDIENTE: { background: 'rgba(251,191,36,0.12)',  border: '1px solid rgba(251,191,36,0.25)',  color: '#fbbf24' },
  RECHAZADO: { background: 'rgba(239,68,68,0.12)',   border: '1px solid rgba(239,68,68,0.25)',   color: '#f87171' },
};

const inp: React.CSSProperties = {
  width: '100%',
  background: 'var(--c-bg-input)',
  border: '1px solid var(--c-border-input)',
  borderRadius: '0.625rem',
  padding: '0.625rem 0.75rem',
  color: 'var(--c-text-1)',
  fontSize: '0.875rem',
  outline: 'none',
};

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--c-text-3)',
  marginBottom: '0.25rem',
};

type Props = {
  selectedEmpleado:    UseDashboardReturn['selectedEmpleado'];
  vacaciones:          UseDashboardReturn['vacaciones'];
  saldoVacaciones:     UseDashboardReturn['saldoVacaciones'];
  showVacacionForm:    UseDashboardReturn['showVacacionForm'];
  setShowVacacionForm: UseDashboardReturn['setShowVacacionForm'];
  vacacionData:        UseDashboardReturn['vacacionData'];
  setVacacionData:     UseDashboardReturn['setVacacionData'];
  guardarVacacion:     UseDashboardReturn['guardarVacacion'];
  isSavingVacacion:    UseDashboardReturn['isSavingVacacion'];
  descargarVacacionPDF: UseDashboardReturn['descargarVacacionPDF'];
  solicitudesFirma:    UseDashboardReturn['solicitudesFirma'];
  isSendingFirma:      UseDashboardReturn['isSendingFirma'];
  enviarAFirma:        UseDashboardReturn['enviarAFirma'];
  cancelarFirma:       UseDashboardReturn['cancelarFirma'];
  reenviarFirma:       UseDashboardReturn['reenviarFirma'];
  onVerDetalleFirma:   (s: SolicitudFirma) => void;
};

export default function TabVacaciones({
  selectedEmpleado, vacaciones, saldoVacaciones,
  showVacacionForm, setShowVacacionForm,
  vacacionData, setVacacionData,
  guardarVacacion, isSavingVacacion, descargarVacacionPDF,
  solicitudesFirma, isSendingFirma, enviarAFirma, cancelarFirma, reenviarFirma, onVerDetalleFirma,
}: Props) {
  const diasPreview = calcularDiasHabiles(
    vacacionData.fecha_inicio ?? '',
    vacacionData.fecha_fin    ?? '',
  );
  const excedeSaldo =
    saldoVacaciones !== null &&
    vacacionData.tipo !== 'PERMISO_SIN_GOCE' &&
    diasPreview > saldoVacaciones.dias_disponibles;

  const set = (patch: Partial<UseDashboardReturn['vacacionData']>) =>
    setVacacionData({ ...vacacionData, ...patch });

  return (
    <div className="max-w-4xl mx-auto">
      {!showVacacionForm ? (
        <div className="space-y-6">

          {/* SALDO */}
          {saldoVacaciones ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  label: 'Días disponibles',
                  value: saldoVacaciones.dias_disponibles,
                  color: saldoVacaciones.dias_disponibles > 0 ? '#34d399' : '#f87171',
                  bg: saldoVacaciones.dias_disponibles > 0
                    ? 'rgba(16,185,129,0.08)'
                    : 'rgba(239,68,68,0.08)',
                  border: saldoVacaciones.dias_disponibles > 0
                    ? '1px solid rgba(16,185,129,0.2)'
                    : '1px solid rgba(239,68,68,0.2)',
                },
                {
                  label: 'Días devengados',
                  value: saldoVacaciones.dias_devengados,
                  color: '#60a5fa',
                  bg: 'rgba(37,99,235,0.08)',
                  border: '1px solid rgba(37,99,235,0.2)',
                },
                {
                  label: 'Días usados',
                  value: saldoVacaciones.dias_usados,
                  color: 'var(--c-text-2)',
                  bg: 'var(--c-bg-card-2)',
                  border: '1px solid var(--c-border)',
                },
                {
                  label: 'Años de servicio',
                  value: saldoVacaciones.anos_servicio,
                  color: '#a78bfa',
                  bg: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.2)',
                },
              ].map(card => (
                <div key={card.label} className="p-4 rounded-2xl text-center" style={{ background: card.bg, border: card.border }}>
                  <p className="text-3xl font-bold" style={{ color: card.color }}>{card.value}</p>
                  <p className="text-xs mt-1 font-medium" style={{ color: 'var(--c-text-3)' }}>{card.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl text-center" style={{ background: 'var(--c-bg-card-2)', border: '1px solid var(--c-border)' }}>
              <p className="text-sm" style={{ color: 'var(--c-text-3)' }}>Cargando saldo de vacaciones...</p>
            </div>
          )}

          {saldoVacaciones && saldoVacaciones.dias_progresivos > 0 && (
            <p className="text-xs px-1" style={{ color: 'var(--c-text-3)' }}>
              Incluye <strong style={{ color: '#a78bfa' }}>{saldoVacaciones.dias_progresivos} día{saldoVacaciones.dias_progresivos > 1 ? 's' : ''} de feriado progresivo</strong> (Art. 68 — {saldoVacaciones.anos_servicio} años de servicio).
            </p>
          )}

          {/* HISTORIAL */}
          <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--c-text-1)' }}>Historial de Vacaciones</h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--c-text-3)' }}>
                Feriados legales, progresivos y permisos sin goce de sueldo.
              </p>
            </div>
            <button
              onClick={() => {
                setVacacionData({
                  tipo:    'VACACION_LEGAL',
                  estado:  'APROBADO',
                  observaciones: '',
                });
                setShowVacacionForm(true);
              }}
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl flex items-center gap-2 transition-colors"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
            >
              + Registrar Vacación
            </button>
          </div>

          {vacaciones.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--c-bg-card-2)', border: '1px solid var(--c-border)' }}>
              <p className="font-medium" style={{ color: 'var(--c-text-3)' }}>
                No hay vacaciones registradas para {selectedEmpleado?.nombres}.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--c-bg-card-2)', border: '1px solid var(--c-border)' }}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--c-border-2)' }}>
                    {['Período', 'Días hábiles', 'Tipo', 'Estado', ''].map(h => (
                      <th key={h} className="p-4 text-xs font-semibold uppercase"
                        style={{ color: 'var(--c-text-3)', background: 'var(--c-bg-card-2)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vacaciones.map(vac => (
                    <tr key={vac.id}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid var(--c-border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="p-4 text-sm font-medium" style={{ color: 'var(--c-text-1)' }}>
                        {vac.fecha_inicio} → {vac.fecha_fin}
                      </td>
                      <td className="p-4 text-sm font-bold" style={{ color: '#60a5fa' }}>
                        {vac.dias_habiles}d
                      </td>
                      <td className="p-4 text-sm" style={{ color: 'var(--c-text-2)' }}>
                        {TIPO_LABEL[vac.tipo] ?? vac.tipo}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                          style={ESTADO_STYLE[vac.estado] ?? {}}>
                          {vac.estado}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-3 flex-wrap">
                          {(() => {
                            const solicitudActiva = solicitudesFirma
                              .filter(s => s.tipo_documento === 'VACACION' && s.vacacion === vac.id)
                              .sort((a, b) => new Date(b.enviado_en).getTime() - new Date(a.enviado_en).getTime())[0];
                            const sending = !!isSendingFirma[`VACACION${vac.id}`];
                            return (
                              <>
                                {(!solicitudActiva || solicitudActiva.estado === 'CANCELADO' || solicitudActiva.estado === 'EXPIRADO') && (
                                  <button
                                    type="button"
                                    onClick={() => enviarAFirma('VACACION', { vacacionId: vac.id })}
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
                                      className="text-xs transition-colors" style={{ color: 'var(--c-text-3)' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-text-2)')}
                                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-3)')}>
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
                                    <button type="button" onClick={() => onVerDetalleFirma(solicitudActiva)}
                                      className="text-xs font-semibold flex items-center gap-1 transition-colors"
                                      style={{ color: 'var(--c-text-3)' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = '#60a5fa')}
                                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-3)')}>
                                      <Eye className="w-3 h-3" />Ver motivo
                                    </button>
                                    <button type="button"
                                      onClick={() => enviarAFirma('VACACION', { vacacionId: vac.id })}
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
                            onClick={() => descargarVacacionPDF(vac.id)}
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
          id="vacacionForm"
          onSubmit={guardarVacacion}
          className="p-8 rounded-2xl space-y-6"
          style={{ background: 'var(--c-bg-card-2)', border: '1px solid var(--c-border)' }}
        >
          <div className="flex justify-between items-center pb-4 mb-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <h3 className="text-lg font-bold" style={{ color: 'var(--c-text-1)' }}>Registrar Vacación o Permiso</h3>
            <button type="button" onClick={() => setShowVacacionForm(false)}
              style={{ color: 'var(--c-text-3)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-text-2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-3)')}>✕</button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Tipo */}
            <div className="col-span-2">
              <label style={lbl}>Tipo de Permiso</label>
              <select
                required
                value={vacacionData.tipo ?? 'VACACION_LEGAL'}
                onChange={e => set({ tipo: e.target.value as 'VACACION_LEGAL' | 'VACACION_PROGRESIVA' | 'PERMISO_SIN_GOCE' })}
                style={{ ...inp, cursor: 'pointer' }}
              >
                <option value="VACACION_LEGAL"      style={{ background: 'var(--c-bg-modal)' }}>Vacación Legal (Art. 67)</option>
                <option value="VACACION_PROGRESIVA"  style={{ background: 'var(--c-bg-modal)' }}>Feriado Progresivo (Art. 68)</option>
                <option value="PERMISO_SIN_GOCE"     style={{ background: 'var(--c-bg-modal)' }}>Permiso Sin Goce de Sueldo</option>
              </select>
            </div>

            {/* Fechas */}
            <div>
              <label style={lbl}>Fecha de Inicio</label>
              <input
                type="date"
                required
                value={vacacionData.fecha_inicio ?? ''}
                onChange={e => set({ fecha_inicio: e.target.value })}
                style={{ ...inp }}
              />
            </div>
            <div>
              <label style={lbl}>Fecha de Término</label>
              <input
                type="date"
                required
                value={vacacionData.fecha_fin ?? ''}
                min={vacacionData.fecha_inicio ?? ''}
                onChange={e => set({ fecha_fin: e.target.value })}
                style={{ ...inp }}
              />
            </div>

            {/* Preview días hábiles */}
            {vacacionData.fecha_inicio && vacacionData.fecha_fin && (
              <div className="col-span-2">
                <div className={`flex items-center gap-3 p-4 rounded-xl ${excedeSaldo ? 'border' : 'border'}`}
                  style={excedeSaldo
                    ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }
                    : { background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
                  <p className="text-sm font-semibold" style={{ color: excedeSaldo ? '#fca5a5' : '#93c5fd' }}>
                    Período seleccionado: <strong>{diasPreview} día{diasPreview !== 1 ? 's' : ''} hábil{diasPreview !== 1 ? 'es' : ''}</strong>
                    {saldoVacaciones && vacacionData.tipo !== 'PERMISO_SIN_GOCE' && (
                      <span style={{ color: 'var(--c-text-3)', fontWeight: 400 }}>
                        {' '}(saldo disponible: {saldoVacaciones.dias_disponibles}d)
                      </span>
                    )}
                  </p>
                  {excedeSaldo && (
                    <p className="text-xs ml-auto shrink-0" style={{ color: '#fca5a5' }}>
                      Excede el saldo disponible
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Estado */}
            <div>
              <label style={lbl}>Estado</label>
              <select
                value={vacacionData.estado ?? 'APROBADO'}
                onChange={e => set({ estado: e.target.value as 'APROBADO' | 'PENDIENTE' | 'RECHAZADO' })}
                style={{ ...inp, cursor: 'pointer' }}
              >
                <option value="APROBADO"  style={{ background: 'var(--c-bg-modal)' }}>Aprobado</option>
                <option value="PENDIENTE" style={{ background: 'var(--c-bg-modal)' }}>Pendiente de aprobación</option>
                <option value="RECHAZADO" style={{ background: 'var(--c-bg-modal)' }}>Rechazado</option>
              </select>
            </div>

            {/* Observaciones */}
            <div className="col-span-2">
              <label style={lbl}>Observaciones (opcional)</label>
              <textarea
                rows={3}
                value={vacacionData.observaciones ?? ''}
                onChange={e => set({ observaciones: e.target.value })}
                placeholder="Notas adicionales sobre este período de vacaciones o permiso..."
                style={{ ...inp, resize: 'none' }}
              />
            </div>
          </div>

          {isSavingVacacion && (
            <p className="text-sm text-right" style={{ color: 'var(--c-text-3)' }}>Registrando vacación...</p>
          )}
        </form>
      )}
    </div>
  );
}
