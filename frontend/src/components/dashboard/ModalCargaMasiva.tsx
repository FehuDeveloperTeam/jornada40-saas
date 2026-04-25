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
    <div className="fixed inset-0 backdrop-blur-sm flex justify-center items-center p-4 z-[100]"
      style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}>

        <div className="p-6 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
          <div>
            <h3 className="text-xl font-extrabold text-white">Carga Masiva de Trabajadores</h3>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Sube tu Excel o descarga la plantilla base.</p>
          </div>
          <button
            onClick={() => { setIsUploadModalOpen(false); setUploadResult(null); }}
            className="p-2 rounded-full transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto">

          {!uploadResult && (
            <div className="space-y-6">
              <div className="border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center relative transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(37,99,235,0.6)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(37,99,235,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}>
                {isUploading ? (
                  <div className="w-12 h-12 border-2 rounded-full animate-spin mb-4" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#2563eb' }} />
                ) : (
                  <UploadCloud className="w-16 h-16 mb-4" style={{ color: '#60a5fa' }} />
                )}
                <h4 className="text-lg font-bold text-white mb-2">
                  {isUploading ? 'Procesando archivo...' : 'Sube tu archivo Excel'}
                </h4>
                <p className="text-sm mb-6 max-w-md" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Asegúrate de que las columnas coincidan exactamente con la plantilla oficial.
                </p>

                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />

                <button disabled={isUploading}
                  className="px-6 py-2.5 text-white font-bold rounded-xl pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                  Seleccionar Archivo
                </button>
              </div>

              <div className="rounded-2xl p-6 flex items-center justify-between" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div>
                  <h5 className="font-bold mb-1" style={{ color: '#6ee7b7' }}>¿No tienes el formato correcto?</h5>
                  <p className="text-sm" style={{ color: 'rgba(110,231,183,0.7)' }}>Usa nuestra plantilla oficial para evitar errores.</p>
                </div>
                <button
                  onClick={descargarPlantillaExcel}
                  className="flex items-center gap-2 px-4 py-2 font-bold rounded-xl transition-colors text-white"
                  style={{ background: 'rgba(16,185,129,0.25)', border: '1px solid rgba(16,185,129,0.3)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.35)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.25)')}>
                  <Download className="w-4 h-4" /> Plantilla
                </button>
              </div>
            </div>
          )}

          {uploadResult && (
            <div className="space-y-6">

              <div className="rounded-2xl p-6 flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.2)' }}>
                  <CheckCircle2 className="w-6 h-6" style={{ color: '#34d399' }} />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-bold text-lg">Carga Finalizada</h4>
                  <div className="flex gap-4 mt-1">
                    <p className="text-sm" style={{ color: '#34d399' }}>
                      <span className="font-bold">{uploadResult.agregados}</span> Nuevos
                    </p>
                    <p className="text-sm" style={{ color: '#60a5fa' }}>
                      <span className="font-bold">{uploadResult.actualizados}</span> Actualizados
                    </p>
                  </div>
                </div>
              </div>

              {uploadResult.limite_alcanzado && (
                <div className="rounded-2xl p-5 flex gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <AlertCircle className="w-6 h-6 shrink-0" style={{ color: '#fbbf24' }} />
                  <div>
                    <h5 className="font-bold" style={{ color: '#fcd34d' }}>Límite de Plan Alcanzado</h5>
                    <p className="text-sm mt-1" style={{ color: 'rgba(252,211,77,0.7)' }}>
                      Se detuvo la carga porque llegaste al límite de trabajadores de tu plan actual. Para ingresar al resto, debes mejorar tu suscripción.
                    </p>
                  </div>
                </div>
              )}

              {(uploadResult?.errores?.length || 0) > 0 && (
                <div>
                  <h5 className="font-bold text-white mb-3 flex items-center gap-2">
                    <X className="w-5 h-5" style={{ color: '#f87171' }} /> Errores detectados ({uploadResult?.errores?.length})
                  </h5>
                  <div className="rounded-xl max-h-48 overflow-y-auto p-4 space-y-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {uploadResult?.errores?.map((error, index) => (
                      <div key={index} className="text-sm p-3 rounded-lg" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)' }}>
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setIsUploadModalOpen(false); setUploadResult(null); }}
                className="w-full py-4 text-white font-bold rounded-xl transition-colors"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}>
                Aceptar y Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
