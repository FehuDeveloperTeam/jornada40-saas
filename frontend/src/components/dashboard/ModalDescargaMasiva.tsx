import type { UseDashboardReturn } from '../../hooks/useDashboard';
import client from '../../api/client';

type Props = {
  empleados: UseDashboardReturn['empleados'];
  filteredEmpleados: UseDashboardReturn['filteredEmpleados'];
  selectedEmpleadosIds: UseDashboardReturn['selectedEmpleadosIds'];
  setSelectedEmpleadosIds: UseDashboardReturn['setSelectedEmpleadosIds'];
  isGeneratingZip: UseDashboardReturn['isGeneratingZip'];
  setIsGeneratingZip: UseDashboardReturn['setIsGeneratingZip'];
  setIsModalMasivoOpen: UseDashboardReturn['setIsModalMasivoOpen'];
};

export default function ModalDescargaMasiva({
  empleados, filteredEmpleados, selectedEmpleadosIds, setSelectedEmpleadosIds,
  isGeneratingZip, setIsGeneratingZip, setIsModalMasivoOpen,
}: Props) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Selecciona los trabajadores</h2>
          <button onClick={() => setIsModalMasivoOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
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
          <button onClick={() => setIsModalMasivoOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
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
                setIsModalMasivoOpen(false);
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
  );
}
