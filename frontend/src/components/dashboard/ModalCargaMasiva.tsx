import { X, UploadCloud, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { UseDashboardReturn } from '../../hooks/useDashboard';

type Props = {
  isUploading: UseDashboardReturn['isUploading'];
  uploadResult: UseDashboardReturn['uploadResult'];
  setUploadResult: UseDashboardReturn['setUploadResult'];
  setIsUploadModalOpen: UseDashboardReturn['setIsUploadModalOpen'];
  handleFileUpload: UseDashboardReturn['handleFileUpload'];
  descargarPlantillaExcel: UseDashboardReturn['descargarPlantillaExcel'];
};

export default function ModalCargaMasiva({
  isUploading, uploadResult, setUploadResult, setIsUploadModalOpen,
  handleFileUpload, descargarPlantillaExcel,
}: Props) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-[100] animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">Carga Masiva de Trabajadores</h3>
            <p className="text-slate-500 text-sm mt-1">Sube tu Excel o descarga la plantilla base.</p>
          </div>
          <button onClick={() => { setIsUploadModalOpen(false); setUploadResult(null); }} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
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
                <button
                  onClick={descargarPlantillaExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                >
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
                    <p className="text-emerald-400 text-sm">
                      <span className="font-bold">{uploadResult.agregados}</span> Nuevos
                    </p>
                    <p className="text-blue-400 text-sm">
                      <span className="font-bold">{uploadResult.actualizados}</span> Actualizados
                    </p>
                  </div>
                </div>
              </div>

              {uploadResult.limite_alcanzado && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                  <div>
                    <h5 className="font-bold text-amber-900">Límite de Plan Alcanzado</h5>
                    <p className="text-amber-700 text-sm mt-1">
                      Se detuvo la carga porque llegaste al límite de trabajadores de tu plan actual. Para ingresar al resto, debes mejorar tu suscripción.
                    </p>
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
                      <div key={index} className="text-sm text-red-800 bg-white p-3 rounded-lg shadow-sm border border-red-50">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setIsUploadModalOpen(false); setUploadResult(null); }}
                className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Aceptar y Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
