import { Send, Clock, CheckCircle, XCircle, RotateCcw, Eye } from 'lucide-react';
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
              <>
                <div className="col-span-2 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <label style={{ ...lbl, color: '#fca5a5' }}>Causal Legal a Invocar</label>
                  <input
                    type="text"
                    required
                    value={documentoData.causal_legal || ''}
                    onChange={(e) => setDocumentoData({...documentoData, causal_legal: e.target.value})}
                    placeholder="Ej: Artículo 161 inc. 1 (Necesidades de la Empresa)"
                    style={{ ...inp, border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
                  />
                </div>
                <div className="col-span-2 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <input
                    type="checkbox"
                    checked={documentoData.aviso_previo_pagado}
                    onChange={(e) => setDocumentoData({...documentoData, aviso_previo_pagado: e.target.checked})}
                    className="w-5 h-5 text-blue-600"
                  />
                  <label className="font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Se pagará el mes de aviso previo (indemnización sustitutiva)</label>
                </div>
              </>
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
