import { X, CheckCircle2, AlertCircle, UploadCloud, Download, Layers, FileSpreadsheet, FileSignature, FileText, Briefcase, AlertTriangle, FolderArchive, ChevronDown } from 'lucide-react';
import type { DashboardEmpleado } from '../../types/dashboard';

interface BulkActionsProps {
  // Inline selection bar
  selectedEmpleadosIds: number[];
  isDownloadMenuOpen: boolean;
  setIsDownloadMenuOpen: (v: boolean) => void;
  isDownloading: boolean;
  ejecutarDescargaMasiva: (tipo: string) => void;

  // Button triggers
  setIsUploadModalOpen: (v: boolean) => void;
  setIsModalMasivoOpen: (v: boolean) => void;
  abrirCrear: () => void;

  // Bulk annexes modal (old)
  isModalMasivoOpen: boolean;
  empleados: DashboardEmpleado[];
  filteredEmpleados: DashboardEmpleado[];
  setSelectedEmpleadosIds: React.Dispatch<React.SetStateAction<number[]>>;
  isGeneratingZip: boolean;
  setIsGeneratingZip: (v: boolean) => void;
  onCloseModalMasivo: () => void;

  // Excel upload modal
  isUploadModalOpen: boolean;
  isUploading: boolean;
  uploadResult: { agregados: number; actualizados: number; errores: string[]; limite_alcanzado: boolean } | null;
  setUploadResult: (v: null) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  descargarPlantillaExcel: () => void;
  onCloseUploadModal: () => void;
}

import client from '../../api/client';

export default function BulkActions({
  selectedEmpleadosIds, isDownloadMenuOpen, setIsDownloadMenuOpen, isDownloading, ejecutarDescargaMasiva,
  setIsUploadModalOpen, setIsModalMasivoOpen, abrirCrear,
  isModalMasivoOpen, empleados, filteredEmpleados, setSelectedEmpleadosIds, isGeneratingZip, setIsGeneratingZip, onCloseModalMasivo,
  isUploadModalOpen, isUploading, uploadResult, setUploadResult, handleFileUpload, descargarPlantillaExcel, onCloseUploadModal,
}: BulkActionsProps) {
  return (
    <>
      {/* PANEL DE ACCIONES MASIVAS INLINE */}
      {selectedEmpleadosIds.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-4 mb-6 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              {selectedEmpleadosIds.length} seleccionados
            </div>
            <span className="text-slate-300 text-sm font-medium">¿Qué deseas generar?</span>
          </div>
          <div className="relative">
            <button
              onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
              disabled={isDownloading}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isDownloading ? (
                <span className="animate-pulse">Generando documentos...</span>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Descarga Masiva
                  <ChevronDown className={`w-4 h-4 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
            {isDownloadMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95">
                <div className="p-2 space-y-1">
                  <button onClick={() => ejecutarDescargaMasiva('contratos')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-slate-700 rounded-lg text-left text-sm font-bold">
                    <Briefcase className="w-5 h-5 text-indigo-500" /> Contratos de Trabajo
                  </button>
                  <button onClick={() => ejecutarDescargaMasiva('anexos')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-slate-700 rounded-lg text-left text-sm font-bold">
                    <FileSignature className="w-5 h-5 text-emerald-500" /> Anexos 40 Horas
                  </button>
                  <div className="h-px bg-slate-100 my-2"></div>
                  <button onClick={() => ejecutarDescargaMasiva('liq_actual')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-slate-700 rounded-lg text-left text-sm font-bold">
                    <FileText className="w-5 h-5 text-blue-500" /> Liquidación (Mes Actual)
                  </button>
                  <button onClick={() => ejecutarDescargaMasiva('liq_12')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-slate-700 rounded-lg text-left text-sm font-bold">
                    <Layers className="w-5 h-5 text-blue-600" /> Últimas 12 Liquidaciones
                  </button>
                  <div className="h-px bg-slate-100 my-2"></div>
                  <button onClick={() => ejecutarDescargaMasiva('amonestacion')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-slate-700 rounded-lg text-left text-sm font-bold">
                    <AlertTriangle className="w-5 h-5 text-amber-500" /> Carta de Amonestación
                  </button>
                  <button onClick={() => ejecutarDescargaMasiva('zip_completo')} className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-900 rounded-lg text-left text-sm font-bold transition-colors">
                    <FolderArchive className="w-5 h-5" /> Expediente Completo (ZIP)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
        >
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <span className="hidden sm:inline">Carga Masiva</span>
        </button>

        <button type="button" onClick={() => setIsModalMasivoOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium flex items-center gap-2">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>
          Descarga Masiva Anexo 40h
        </button>

        <button type="button" onClick={abrirCrear} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium flex items-center gap-2">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nuevo Empleado
        </button>
      </div>

      {/* MODAL: DESCARGA MASIVA ANEXOS ZIP */}
      {isModalMasivoOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Selecciona los trabajadores</h2>
              <button onClick={onCloseModalMasivo} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-6 py-3 border-b bg-gray-50 flex justify-between items-center">
              <button onClick={() => setSelectedEmpleadosIds(empleados.filter(e => e.activo).map(emp => emp.id))} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                Seleccionar todos (vigentes)
              </button>
              <button onClick={() => setSelectedEmpleadosIds([])} className="text-sm font-semibold text-red-600 hover:text-red-800">
                Deseleccionar todos
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-2">
                {filteredEmpleados.map(emp => (
                  <label key={emp.id} className={`flex items-center p-3 border rounded-lg cursor-pointer ${emp.activo ? 'hover:bg-gray-50' : 'bg-gray-100 opacity-60 cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                      checked={selectedEmpleadosIds.includes(emp.id)}
                      disabled={!emp.activo}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedEmpleadosIds(prev => [...prev, emp.id]);
                        else setSelectedEmpleadosIds(prev => prev.filter(id => id !== emp.id));
                      }}
                    />
                    <div className="ml-4">
                      <p className="font-semibold text-gray-800">{emp.nombres} {emp.apellido_paterno}</p>
                      <p className="text-sm text-gray-500">RUT: {emp.rut} • {emp.cargo}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50">
              <button onClick={onCloseModalMasivo} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
              <button
                disabled={selectedEmpleadosIds.length === 0 || isGeneratingZip}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2"
                onClick={async () => {
                  setIsGeneratingZip(true);
                  try {
                    const response = await client.post('/empleados/descargar_anexos_zip/', { empleados: selectedEmpleadosIds }, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', 'Anexos_40h_Masivos.zip');
                    document.body.appendChild(link);
                    link.click();
                    link.parentNode?.removeChild(link);
                    window.URL.revokeObjectURL(url);
                    onCloseModalMasivo();
                    setSelectedEmpleadosIds([]);
                  } catch (error) {
                    console.error("Error al generar ZIP:", error);
                    alert("Hubo un problema al empaquetar los anexos. Inténtalo de nuevo.");
                  } finally {
                    setIsGeneratingZip(false);
                  }
                }}
              >
                {isGeneratingZip ? 'Comprimiendo...' : `Generar ZIP (${selectedEmpleadosIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CARGA MASIVA EXCEL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-[100] animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Carga Masiva de Trabajadores</h3>
                <p className="text-slate-500 text-sm mt-1">Sube tu Excel o descarga la plantilla base.</p>
              </div>
              <button onClick={onCloseUploadModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto">
              {!uploadResult && (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center bg-slate-50/50 relative hover:bg-slate-50 hover:border-blue-400 transition-colors">
                    {isUploading ? (
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    ) : (
                      <UploadCloud className="w-16 h-16 text-blue-500 mb-4" />
                    )}
                    <h4 className="text-lg font-bold text-slate-900 mb-2">
                      {isUploading ? 'Procesando archivo...' : 'Sube tu archivo Excel'}
                    </h4>
                    <p className="text-slate-500 text-sm mb-6 max-w-md">
                      Asegúrate de que las columnas coincidan exactamente con la plantilla oficial.
                    </p>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <button disabled={isUploading} className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md pointer-events-none">
                      Seleccionar Archivo
                    </button>
                  </div>
                  <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-emerald-900 mb-1">¿No tienes el formato correcto?</h5>
                      <p className="text-emerald-700 text-sm">Usa nuestra plantilla oficial para evitar errores.</p>
                    </div>
                    <button onClick={descargarPlantillaExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm">
                      <Download className="w-4 h-4" /> Plantilla
                    </button>
                  </div>
                </div>
              )}
              {uploadResult && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="bg-slate-900 rounded-2xl p-6 flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-bold text-lg">Carga Finalizada</h4>
                      <div className="flex gap-4 mt-1">
                        <p className="text-emerald-400 text-sm"><span className="font-bold">{uploadResult.agregados}</span> Nuevos</p>
                        <p className="text-blue-400 text-sm"><span className="font-bold">{uploadResult.actualizados}</span> Actualizados</p>
                      </div>
                    </div>
                  </div>
                  {uploadResult.limite_alcanzado && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
                      <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                      <div>
                        <h5 className="font-bold text-amber-900">Límite de Plan Alcanzado</h5>
                        <p className="text-amber-700 text-sm mt-1">Se detuvo la carga porque llegaste al límite de trabajadores de tu plan actual. Para ingresar al resto, debes mejorar tu suscripción.</p>
                      </div>
                    </div>
                  )}
                  {(uploadResult?.errores?.length || 0) > 0 && (
                    <div>
                      <h5 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <X className="w-5 h-5 text-red-500" /> Errores detectados ({uploadResult?.errores?.length})
                      </h5>
                      <div className="bg-red-50 border border-red-100 rounded-xl max-h-48 overflow-y-auto p-4 space-y-2">
                        {uploadResult?.errores?.map((error, index) => (
                          <div key={index} className="text-sm text-red-800 bg-white p-3 rounded-lg shadow-sm border border-red-50">{error}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => { onCloseUploadModal(); setUploadResult(null); }}
                    className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    Aceptar y Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
