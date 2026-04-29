import React from 'react';
import { Send, Clock, CheckCircle, XCircle, RotateCcw, Eye, AlertTriangle } from 'lucide-react';
import type { UseDashboardReturn } from '../../../hooks/useDashboard';
import type { SolicitudFirma } from '../../../types';

type Props = {
  selectedEmpleado: UseDashboardReturn['selectedEmpleado'];
  documentosLegales: UseDashboardReturn['documentosLegales'];
  showDocumentoForm: UseDashboardReturn['showDocumentoForm'];
  setShowDocumentoForm: UseDashboardReturn['setShowDocumentoForm'];
  documentoData: UseDashboardReturn['documentoData'];
  setDocumentoData: UseDashboardReturn['setDocumentoData'];
  guardarDocumentoLegal: UseDashboardReturn['guardarDocumentoLegal'];
  isSavingDocumento: UseDashboardReturn['isSavingDocumento'];
  descargarDocumentoPDF: UseDashboardReturn['descargarDocumentoPDF'];
  // Firma electrónica
  solicitudesFirma: UseDashboardReturn['solicitudesFirma'];
  isSendingFirma: UseDashboardReturn['isSendingFirma'];
  enviarAFirma: UseDashboardReturn['enviarAFirma'];
  cancelarFirma: UseDashboardReturn['cancelarFirma'];
  reenviarFirma: UseDashboardReturn['reenviarFirma'];
  onVerDetalleFirma: (s: SolicitudFirma) => void;
};

// 23 causales del Código del Trabajo chileno
const CAUSALES = [
  { group: 'Artículo 159 — Causales objetivas', options: [
    { value: '159_1', label: 'Art. 159 N°1 — Mutuo acuerdo de las partes', descripcion: 'Las partes, de común acuerdo, han convenido poner término al contrato de trabajo.', requiere_indemnizacion: false },
    { value: '159_2', label: 'Art. 159 N°2 — Renuncia voluntaria del trabajador', descripcion: 'El trabajador ha presentado su renuncia voluntaria al cargo, con la anticipación mínima exigida por la ley.', requiere_indemnizacion: false },
    { value: '159_3', label: 'Art. 159 N°3 — Muerte del trabajador', descripcion: 'El contrato de trabajo se extingue por el fallecimiento del trabajador.', requiere_indemnizacion: false },
    { value: '159_4', label: 'Art. 159 N°4 — Vencimiento del plazo convenido', descripcion: 'Se ha cumplido el plazo estipulado en el contrato a plazo fijo suscrito entre las partes.', requiere_indemnizacion: false },
    { value: '159_5', label: 'Art. 159 N°5 — Conclusión del trabajo o servicio', descripcion: 'Se ha concluido el trabajo o servicio que dio origen al contrato, de conformidad con lo pactado.', requiere_indemnizacion: false },
    { value: '159_6', label: 'Art. 159 N°6 — Caso fortuito o fuerza mayor', descripcion: 'La terminación del contrato obedece a un caso fortuito o fuerza mayor que imposibilita su cumplimiento.', requiere_indemnizacion: false },
  ]},
  { group: 'Artículo 160 — Causales imputables al trabajador', options: [
    { value: '160_1a', label: 'Art. 160 N°1 a) — Falta de probidad', descripcion: 'El trabajador ha incurrido en falta de probidad en el desempeño de sus funciones.', requiere_indemnizacion: false },
    { value: '160_1b', label: 'Art. 160 N°1 b) — Acoso sexual', descripcion: 'El trabajador ha incurrido en conductas de acoso sexual debidamente acreditadas.', requiere_indemnizacion: false },
    { value: '160_1c', label: 'Art. 160 N°1 c) — Vías de hecho contra el empleador u otro trabajador', descripcion: 'El trabajador ha ejercido vías de hecho en contra del empleador o de otro trabajador.', requiere_indemnizacion: false },
    { value: '160_1d', label: 'Art. 160 N°1 d) — Injurias al empleador', descripcion: 'El trabajador ha proferido injurias en contra del empleador.', requiere_indemnizacion: false },
    { value: '160_1e', label: 'Art. 160 N°1 e) — Conducta inmoral grave', descripcion: 'El trabajador ha incurrido en conducta inmoral grave que afecta a la empresa.', requiere_indemnizacion: false },
    { value: '160_1f', label: 'Art. 160 N°1 f) — Acoso laboral (mobbing)', descripcion: 'El trabajador ha incurrido en conductas de acoso laboral debidamente acreditadas, conforme al Artículo 2° del Código del Trabajo.', requiere_indemnizacion: false },
    { value: '160_2',  label: 'Art. 160 N°2 — Negociaciones prohibidas', descripcion: 'El trabajador ha realizado negociaciones dentro del giro del negocio que han sido expresamente prohibidas en el contrato.', requiere_indemnizacion: false },
    { value: '160_3',  label: 'Art. 160 N°3 — Inasistencias injustificadas', descripcion: 'El trabajador no concurrió a sus labores sin causa justificada dos días seguidos, dos lunes en el mes, o un total de tres días durante igual período.', requiere_indemnizacion: false },
    { value: '160_4a', label: 'Art. 160 N°4 a) — Abandono: salida intempestiva', descripcion: 'El trabajador abandonó el trabajo durante la jornada laboral sin causa justificada.', requiere_indemnizacion: false },
    { value: '160_4b', label: 'Art. 160 N°4 b) — Abandono: negativa a trabajar', descripcion: 'El trabajador se negó a trabajar sin causa justificada en faenas convenidas en el contrato.', requiere_indemnizacion: false },
    { value: '160_5',  label: 'Art. 160 N°5 — Actos que afectan la seguridad', descripcion: 'El trabajador realizó actos, omisiones o imprudencias temerarias que afectan la seguridad o el funcionamiento del establecimiento.', requiere_indemnizacion: false },
    { value: '160_6',  label: 'Art. 160 N°6 — Daño material intencional', descripcion: 'El trabajador causó perjuicios materiales intencionados en las instalaciones, maquinarias, herramientas, útiles de trabajo, productos o mercaderías.', requiere_indemnizacion: false },
    { value: '160_7',  label: 'Art. 160 N°7 — Incumplimiento grave del contrato', descripcion: 'El trabajador incurrió en incumplimiento grave de las obligaciones que impone el contrato de trabajo.', requiere_indemnizacion: false },
  ]},
  { group: 'Artículo 161 — Por decisión del empleador', options: [
    { value: '161_1', label: 'Art. 161 inc. 1° — Necesidades de la empresa', descripcion: 'La empresa invoca necesidades de la empresa, establecimiento o servicio, tales como las derivadas de la racionalización o modernización de los mismos, bajas en la productividad, cambios en las condiciones del mercado o de la economía.', requiere_indemnizacion: true },
    { value: '161_2', label: 'Art. 161 inc. 2° — Desahucio del empleador', descripcion: 'La empresa hace uso de la facultad de desahucio respecto del trabajador, conforme al inciso segundo del Artículo 161 del Código del Trabajo.', requiere_indemnizacion: true },
  ]},
  { group: 'Artículo 163 bis — Liquidación concursal', options: [
    { value: '163bis', label: 'Art. 163 bis — Liquidación concursal del empleador', descripcion: 'El empleador ha sido declarado en liquidación concursal, de conformidad con lo dispuesto en el Artículo 163 bis del Código del Trabajo.', requiere_indemnizacion: true },
  ]},
] as const;

const getCausalInfo = (value: string) => {
  for (const group of CAUSALES) {
    const found = group.options.find(o => o.value === value);
    if (found) return found;
  }
  return null;
};

const tipoDocToFirma: Record<string, SolicitudFirma['tipo_documento']> = {
  AMONESTACION: 'AMONESTACION',
  DESPIDO: 'DESPIDO',
  CONSTANCIA: 'CONSTANCIA',
  MUTUO_ACUERDO: 'CONSTANCIA',
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

function DespidoFields({
  documentoData,
  setDocumentoData,
}: {
  documentoData: UseDashboardReturn['documentoData'];
  setDocumentoData: UseDashboardReturn['setDocumentoData'];
}) {
  const causalInfo = documentoData.causal_articulo ? getCausalInfo(documentoData.causal_articulo) : null;
  const requiereIndemnizacion = causalInfo?.requiere_indemnizacion ?? false;
  const es161 = documentoData.causal_articulo === '161_1' || documentoData.causal_articulo === '161_2';

  const set = (patch: Partial<UseDashboardReturn['documentoData']>) =>
    setDocumentoData({ ...documentoData, ...patch });

  return (
    <>
      {/* Causal dropdown */}
      <div className="col-span-2 p-5 rounded-xl space-y-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <div>
          <label style={{ ...lbl, color: '#fca5a5' }}>Causal Legal a Invocar *</label>
          <select
            required
            value={documentoData.causal_articulo || ''}
            onChange={(e) => {
              const info = getCausalInfo(e.target.value);
              set({
                causal_articulo: e.target.value || undefined,
                causal_legal: info?.label || '',
                aviso_previo_dias: info?.requiere_indemnizacion ? undefined : undefined,
                monto_indemnizacion_anos: undefined,
                monto_indemnizacion_sustitutiva: undefined,
              });
            }}
            style={{ ...inp, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}
          >
            <option value="" style={{ background: '#0c1a35' }}>— Seleccione la causal —</option>
            {CAUSALES.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map(o => (
                  <option key={o.value} value={o.value} style={{ background: '#0c1a35' }}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {causalInfo && (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
            {causalInfo.descripcion}
          </div>
        )}
      </div>

      {/* Fecha último día */}
      <div>
        <label style={lbl}>Fecha Efectiva de Término</label>
        <input
          type="date"
          value={documentoData.fecha_ultimo_dia || ''}
          onChange={(e) => set({ fecha_ultimo_dia: e.target.value || undefined })}
          style={{ ...inp, colorScheme: 'dark' }}
        />
      </div>

      {/* Aviso previo (solo Art. 161) */}
      {es161 && (
        <div>
          <label style={lbl}>Aviso Previo</label>
          <select
            value={documentoData.aviso_previo_dias ?? ''}
            onChange={(e) => set({ aviso_previo_dias: e.target.value === '' ? undefined : Number(e.target.value) })}
            style={{ ...inp, cursor: 'pointer' }}
          >
            <option value="" style={{ background: '#0c1a35' }}>— Seleccione —</option>
            <option value="30" style={{ background: '#0c1a35' }}>30 días de aviso previo (Art. 161)</option>
            <option value="0" style={{ background: '#0c1a35' }}>Pago sustitutivo del mes de aviso (Art. 162 inc. 2°)</option>
          </select>
        </div>
      )}

      {/* Indemnizaciones (solo Art. 161 / 163 bis) */}
      {requiereIndemnizacion && (
        <>
          <div>
            <label style={lbl}>Indemnización por Años de Servicio (Art. 163) — $</label>
            <input
              type="number"
              min={0}
              value={documentoData.monto_indemnizacion_anos ?? ''}
              onChange={(e) => set({ monto_indemnizacion_anos: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Ingrese monto en pesos"
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>Indemnización Sustitutiva de Aviso (Art. 162 inc. 2°) — $</label>
            <input
              type="number"
              min={0}
              value={documentoData.monto_indemnizacion_sustitutiva ?? ''}
              onChange={(e) => set({ monto_indemnizacion_sustitutiva: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Ingrese monto en pesos"
              style={inp}
            />
          </div>
        </>
      )}

      {/* Cotizaciones al día — Ley Bustos */}
      <div className="col-span-2">
        <label style={lbl}>Estado de Cotizaciones Previsionales</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              type="radio"
              name="cotizaciones"
              checked={documentoData.cotizaciones_al_dia === true}
              onChange={() => set({ cotizaciones_al_dia: true })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium" style={{ color: '#86efac' }}>Cotizaciones al día (Art. 162 inc. 5°)</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              type="radio"
              name="cotizaciones"
              checked={documentoData.cotizaciones_al_dia === false}
              onChange={() => set({ cotizaciones_al_dia: false })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium" style={{ color: '#fca5a5' }}>Cotizaciones con deuda pendiente</span>
          </label>
        </div>
        {documentoData.cotizaciones_al_dia === false && (
          <div className="mt-3 flex gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f87171' }} />
            <p className="text-xs" style={{ color: '#fca5a5' }}>
              <strong>Ley Bustos (N°19.631):</strong> El despido quedará en suspenso hasta que el empleador pague íntegramente las cotizaciones adeudadas. Mientras no se regularice, deberá continuar pagando las remuneraciones del trabajador.
            </p>
          </div>
        )}
      </div>

      {/* Modalidad finiquito */}
      <div>
        <label style={lbl}>Modalidad de Finiquito</label>
        <select
          value={documentoData.modalidad_finiquito || ''}
          onChange={(e) => set({ modalidad_finiquito: (e.target.value || undefined) as 'PRESENCIAL' | 'ELECTRONICO' | undefined })}
          style={{ ...inp, cursor: 'pointer' }}
        >
          <option value="" style={{ background: '#0c1a35' }}>— Seleccione —</option>
          <option value="PRESENCIAL" style={{ background: '#0c1a35' }}>Presencial ante ministro de fe</option>
          <option value="ELECTRONICO" style={{ background: '#0c1a35' }}>Electrónico (voluntario para el trabajador)</option>
        </select>
      </div>

      {/* Copia Inspección del Trabajo */}
      <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <input
          type="checkbox"
          id="copia_inspeccion"
          checked={documentoData.copia_inspeccion_trabajo === true}
          onChange={(e) => set({ copia_inspeccion_trabajo: e.target.checked })}
          className="w-5 h-5 text-blue-600"
        />
        <label htmlFor="copia_inspeccion" className="text-sm font-semibold cursor-pointer" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Enviar copia a la Inspección del Trabajo (Art. 162)
        </label>
      </div>
    </>
  );
}

export default function TabLegal({
  selectedEmpleado, documentosLegales, showDocumentoForm, setShowDocumentoForm,
  documentoData, setDocumentoData, guardarDocumentoLegal, isSavingDocumento, descargarDocumentoPDF,
  solicitudesFirma, isSendingFirma, enviarAFirma, cancelarFirma, reenviarFirma,
  onVerDetalleFirma,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto">
      {!showDocumentoForm ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <h3 className="text-lg font-bold text-white">Historial de Documentos</h3>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Cartas de amonestación, despidos y constancias.</p>
            </div>
            <button
              onClick={() => {
                setDocumentoData({
                  empleado: selectedEmpleado?.id,
                  tipo: 'AMONESTACION',
                  fecha_emision: new Date().toISOString().split('T')[0],
                  hechos: '',
                  causal_legal: '',
                  aviso_previo_pagado: false,
                  causal_articulo: undefined,
                  fecha_ultimo_dia: undefined,
                  cotizaciones_al_dia: undefined,
                  aviso_previo_dias: undefined,
                  monto_indemnizacion_anos: undefined,
                  monto_indemnizacion_sustitutiva: undefined,
                  modalidad_finiquito: undefined,
                  copia_inspeccion_trabajo: undefined,
                });
                setShowDocumentoForm(true);
              }}
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl flex items-center gap-2 transition-colors"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
            >
              + Nuevo Documento
            </button>
          </div>

          {documentosLegales.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>No hay documentos legales registrados para este trabajador.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th className="p-4 text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}>Fecha</th>
                    <th className="p-4 text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}>Tipo Documento</th>
                    <th className="p-4 text-xs font-semibold uppercase text-right" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {documentosLegales.map(doc => {
                    const firmaKey = tipoDocToFirma[doc.tipo];
                    const solicitudActiva = firmaKey
                      ? solicitudesFirma
                          .filter(s => s.tipo_documento === firmaKey && s.documento_legal === doc.id)
                          .sort((a, b) => new Date(b.enviado_en).getTime() - new Date(a.enviado_en).getTime())[0]
                      : undefined;
                    const sending = !!isSendingFirma[`${firmaKey}${doc.id}`];
                    return (
                      <tr key={doc.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td className="p-4 text-sm font-medium text-white">{doc.fecha_emision}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            doc.tipo === 'DESPIDO'
                              ? 'bg-red-500/15 text-red-400'
                              : doc.tipo === 'AMONESTACION'
                                ? 'bg-orange-500/15 text-orange-400'
                                : 'bg-white/10 text-white/60'
                          }`}>
                            {doc.tipo.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-3 flex-wrap">
                            {firmaKey && (!solicitudActiva || solicitudActiva.estado === 'CANCELADO' || solicitudActiva.estado === 'EXPIRADO') && (
                              <button
                                type="button"
                                onClick={() => enviarAFirma(firmaKey, { documentoLegalId: doc.id })}
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
                            <button
                              onClick={() => descargarDocumentoPDF(doc.id!, doc.tipo)}
                              className="text-sm font-semibold flex items-center gap-1 transition-colors"
                              style={{ color: '#60a5fa' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}
                            >
                              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                              PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <form id="documentoForm" onSubmit={guardarDocumentoLegal} className="p-8 rounded-2xl space-y-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex justify-between items-center pb-4 mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <h3 className="text-lg font-bold text-white">Redactar Documento Legal</h3>
            <button type="button" onClick={() => setShowDocumentoForm(false)} style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>✕</button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label style={lbl}>Tipo de Documento</label>
              <select
                required
                value={documentoData.tipo}
                onChange={(e) => setDocumentoData({...documentoData, tipo: e.target.value as 'AMONESTACION' | 'DESPIDO' | 'MUTUO_ACUERDO' | 'CONSTANCIA'})}
                style={{ ...inp, cursor: 'pointer' }}
              >
                <option value="AMONESTACION" style={{ background: '#0c1a35' }}>Carta de Amonestación</option>
                <option value="DESPIDO" style={{ background: '#0c1a35' }}>Carta de Despido (Término de Contrato)</option>
                <option value="CONSTANCIA" style={{ background: '#0c1a35' }}>Constancia Laboral</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Fecha de Emisión</label>
              <input
                type="date"
                required
                value={documentoData.fecha_emision}
                onChange={(e) => setDocumentoData({...documentoData, fecha_emision: e.target.value})}
                style={{ ...inp, colorScheme: 'dark' }}
              />
            </div>

            {documentoData.tipo === 'DESPIDO' && (
              <DespidoFields documentoData={documentoData} setDocumentoData={setDocumentoData} />
            )}

            <div className="col-span-2">
              <label style={lbl}>Relato de los Hechos (Fundamento Legal)</label>
              <textarea
                required
                rows={5}
                value={documentoData.hechos}
                onChange={(e) => setDocumentoData({...documentoData, hechos: e.target.value})}
                placeholder="Redacte detalladamente los hechos y motivos que fundamentan este documento..."
                style={{ ...inp, resize: 'none' }}
              />
            </div>
          </div>

          {isSavingDocumento && (
            <p className="text-sm text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>Generando documento...</p>
          )}
        </form>
      )}
    </div>
  );
}
