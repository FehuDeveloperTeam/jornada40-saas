import type { DashboardDocumentoLegal, DashboardEmpleado } from '../../types/dashboard';

interface Props {
  selectedEmpleado: DashboardEmpleado | null;
  documentosLegales: DashboardDocumentoLegal[];
  documentoData: Partial<DashboardDocumentoLegal>;
  setDocumentoData: React.Dispatch<React.SetStateAction<Partial<DashboardDocumentoLegal>>>;
  showDocumentoForm: boolean;
  setShowDocumentoForm: (v: boolean) => void;
  isSavingDocumento: boolean;
  guardarDocumentoLegal: (e: React.FormEvent) => void;
  descargarDocumentoPDF: (docId: number, tipo: string) => void;
}

export default function TabLegal({
  selectedEmpleado,
  documentosLegales,
  documentoData, setDocumentoData,
  showDocumentoForm, setShowDocumentoForm,
  isSavingDocumento,
  guardarDocumentoLegal,
  descargarDocumentoPDF,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto">
      {!showDocumentoForm ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Historial de Documentos</h3>
              <p className="text-sm text-slate-500">Cartas de amonestación, despidos y constancias.</p>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              + Nuevo Documento
            </button>
          </div>

          {documentosLegales.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <p className="text-slate-500 font-medium">No hay documentos legales registrados para este trabajador.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Tipo Documento</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {documentosLegales.map(doc => (
                    <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-900">{doc.fecha_emision}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          doc.tipo === 'DESPIDO' ? 'bg-red-100 text-red-700' :
                          doc.tipo === 'AMONESTACION' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {doc.tipo.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => descargarDocumentoPDF(doc.id!, doc.tipo)}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center justify-end gap-1 ml-auto"
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Descargar PDF
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
        <form id="documentoForm" onSubmit={guardarDocumentoLegal} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center border-b pb-4 mb-4">
            <h3 className="text-lg font-bold text-slate-900">Redactar Documento Legal</h3>
            <button type="button" onClick={() => setShowDocumentoForm(false)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Documento</label>
              <select
                required
                value={documentoData.tipo}
                onChange={(e) => setDocumentoData({ ...documentoData, tipo: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-slate-50 font-medium"
              >
                <option value="AMONESTACION">Carta de Amonestación</option>
                <option value="DESPIDO">Carta de Despido (Término de Contrato)</option>
                <option value="CONSTANCIA">Constancia Laboral</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Emisión</label>
              <input
                type="date"
                required
                value={documentoData.fecha_emision}
                onChange={(e) => setDocumentoData({ ...documentoData, fecha_emision: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-slate-50"
              />
            </div>

            {documentoData.tipo === 'DESPIDO' && (
              <>
                <div className="col-span-2 bg-red-50 p-4 rounded-xl border border-red-100">
                  <label className="block text-xs font-bold text-red-800 mb-1">Causal Legal a Invocar</label>
                  <input
                    type="text"
                    required
                    value={documentoData.causal_legal || ''}
                    onChange={(e) => setDocumentoData({ ...documentoData, causal_legal: e.target.value })}
                    placeholder="Ej: Artículo 161 inc. 1 (Necesidades de la Empresa)"
                    className="w-full px-3 py-2 rounded-lg border border-red-200 outline-none"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={documentoData.aviso_previo_pagado}
                    onChange={(e) => setDocumentoData({ ...documentoData, aviso_previo_pagado: e.target.checked })}
                    className="w-5 h-5 text-blue-600"
                  />
                  <label className="font-semibold text-slate-700">Se pagará el mes de aviso previo (indemnización sustitutiva)</label>
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Relato de los Hechos (Fundamento Legal)</label>
              <textarea
                required
                rows={5}
                value={documentoData.hechos}
                onChange={(e) => setDocumentoData({ ...documentoData, hechos: e.target.value })}
                placeholder="Redacte detalladamente los hechos y motivos que fundamentan este documento..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDocumentoForm(false)}
              className="px-6 py-2.5 text-slate-600 font-semibold bg-transparent hover:bg-slate-100 rounded-xl transition-colors"
            >
              Volver al Historial
            </button>
            <button
              type="submit"
              disabled={isSavingDocumento}
              className="px-8 py-2.5 text-white font-semibold bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 rounded-xl transition-colors shadow-md"
            >
              {isSavingDocumento ? 'Generando...' : 'Guardar y Generar Documento'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
