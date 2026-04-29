import React from 'react';
import type { UseDashboardReturn } from '../../../hooks/useDashboard';

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
};

export default function TabVacaciones({
  selectedEmpleado, vacaciones, saldoVacaciones,
  showVacacionForm, setShowVacacionForm,
  vacacionData, setVacacionData,
  guardarVacacion, isSavingVacacion, descargarVacacionPDF,
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
                  color: 'rgba(255,255,255,0.6)',
                  bg: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
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
                  <p className="text-xs mt-1 font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>{card.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Cargando saldo de vacaciones...</p>
            </div>
          )}

          {saldoVacaciones && saldoVacaciones.dias_progresivos > 0 && (
            <p className="text-xs px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Incluye <strong style={{ color: '#a78bfa' }}>{saldoVacaciones.dias_progresivos} día{saldoVacaciones.dias_progresivos > 1 ? 's' : ''} de feriado progresivo</strong> (Art. 68 — {saldoVacaciones.anos_servicio} años de servicio).
            </p>
          )}

          {/* HISTORIAL */}
          <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <h3 className="text-lg font-bold text-white">Historial de Vacaciones</h3>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
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
            <div className="text-center py-16 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                No hay vacaciones registradas para {selectedEmpleado?.nombres}.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Período', 'Días hábiles', 'Tipo', 'Estado', ''].map(h => (
                      <th key={h} className="p-4 text-xs font-semibold uppercase"
                        style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vacaciones.map(vac => (
                    <tr key={vac.id}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="p-4 text-sm text-white font-medium">
                        {vac.fecha_inicio} → {vac.fecha_fin}
                      </td>
                      <td className="p-4 text-sm font-bold" style={{ color: '#60a5fa' }}>
                        {vac.dias_habiles}d
                      </td>
                      <td className="p-4 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {TIPO_LABEL[vac.tipo] ?? vac.tipo}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                          style={ESTADO_STYLE[vac.estado] ?? {}}>
                          {vac.estado}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => descargarVacacionPDF(vac.id)}
                          className="text-sm font-semibold flex items-center gap-1 ml-auto transition-colors"
                          style={{ color: '#60a5fa' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          PDF
                        </button>
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
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex justify-between items-center pb-4 mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <h3 className="text-lg font-bold text-white">Registrar Vacación o Permiso</h3>
            <button type="button" onClick={() => setShowVacacionForm(false)}
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>✕</button>
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
                <option value="VACACION_LEGAL"      style={{ background: '#0c1a35' }}>Vacación Legal (Art. 67)</option>
                <option value="VACACION_PROGRESIVA"  style={{ background: '#0c1a35' }}>Feriado Progresivo (Art. 68)</option>
                <option value="PERMISO_SIN_GOCE"     style={{ background: '#0c1a35' }}>Permiso Sin Goce de Sueldo</option>
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
                style={{ ...inp, colorScheme: 'dark' }}
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
                style={{ ...inp, colorScheme: 'dark' }}
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
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
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
                <option value="APROBADO"  style={{ background: '#0c1a35' }}>Aprobado</option>
                <option value="PENDIENTE" style={{ background: '#0c1a35' }}>Pendiente de aprobación</option>
                <option value="RECHAZADO" style={{ background: '#0c1a35' }}>Rechazado</option>
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
            <p className="text-sm text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>Registrando vacación...</p>
          )}
        </form>
      )}
    </div>
  );
}
