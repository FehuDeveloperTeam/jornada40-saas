import { Download, FileSpreadsheet, CheckCircle2, ChevronDown, FileSignature, FileText, Briefcase, AlertTriangle, FolderArchive, Layers } from 'lucide-react';
import type { UseDashboardReturn } from '../../hooks/useDashboard';

type Props = {
  empleados: UseDashboardReturn['empleados'];
  filteredEmpleados: UseDashboardReturn['filteredEmpleados'];
  searchTerm: UseDashboardReturn['searchTerm'];
  setSearchTerm: UseDashboardReturn['setSearchTerm'];
  selectedCargos: UseDashboardReturn['selectedCargos'];
  setSelectedCargos: UseDashboardReturn['setSelectedCargos'];
  selectedDeptos: UseDashboardReturn['selectedDeptos'];
  setSelectedDeptos: UseDashboardReturn['setSelectedDeptos'];
  selectedStatuses: UseDashboardReturn['selectedStatuses'];
  setSelectedStatuses: UseDashboardReturn['setSelectedStatuses'];
  openFilterDropdown: UseDashboardReturn['openFilterDropdown'];
  setOpenFilterDropdown: UseDashboardReturn['setOpenFilterDropdown'];
  allCargos: UseDashboardReturn['allCargos'];
  allDeptos: UseDashboardReturn['allDeptos'];
  selectedEmpleadosIds: UseDashboardReturn['selectedEmpleadosIds'];
  isDownloadMenuOpen: UseDashboardReturn['isDownloadMenuOpen'];
  setIsDownloadMenuOpen: UseDashboardReturn['setIsDownloadMenuOpen'];
  isDownloading: UseDashboardReturn['isDownloading'];
  downloadingId: UseDashboardReturn['downloadingId'];
  handleSelectAll: UseDashboardReturn['handleSelectAll'];
  handleSelectEmpleado: UseDashboardReturn['handleSelectEmpleado'];
  ejecutarDescargaMasiva: UseDashboardReturn['ejecutarDescargaMasiva'];
  toggleArrayItem: UseDashboardReturn['toggleArrayItem'];
  toggleSelectAll: UseDashboardReturn['toggleSelectAll'];
  abrirVer: UseDashboardReturn['abrirVer'];
  abrirEditar: UseDashboardReturn['abrirEditar'];
  abrirCrear: UseDashboardReturn['abrirCrear'];
  generarYDescargarPDF: UseDashboardReturn['generarYDescargarPDF'];
  setIsModalMasivoOpen: UseDashboardReturn['setIsModalMasivoOpen'];
  setIsUploadModalOpen: UseDashboardReturn['setIsUploadModalOpen'];
};

export default function EmpleadosTable({
  empleados, filteredEmpleados, searchTerm, setSearchTerm,
  selectedCargos, setSelectedCargos, selectedDeptos, setSelectedDeptos,
  selectedStatuses, setSelectedStatuses, openFilterDropdown, setOpenFilterDropdown,
  allCargos, allDeptos, selectedEmpleadosIds, isDownloadMenuOpen, setIsDownloadMenuOpen,
  isDownloading, downloadingId, handleSelectAll, handleSelectEmpleado,
  ejecutarDescargaMasiva, toggleArrayItem, toggleSelectAll,
  abrirVer, abrirEditar, abrirCrear, generarYDescargarPDF,
  setIsModalMasivoOpen, setIsUploadModalOpen,
}: Props) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[500px] overflow-hidden">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Directorio de Empleados</h2>
          <p className="text-sm text-gray-500 mt-1">Mostrando {filteredEmpleados?.length || 0} de {empleados?.length || 0}</p>
        </div>

        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Buscar rut, nombre, ciudad..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 absolute left-3 top-2.5 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>

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
      </div>

      {selectedEmpleadosIds.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-4 mb-6 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
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
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
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

      {empleados?.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-500 font-medium mb-4">Aún no tienes empleados en esta empresa.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-8 px-8 pb-4">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="px-6 py-4 text-left w-10">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los trabajadores"
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    onChange={handleSelectAll}
                    checked={selectedEmpleadosIds.length === filteredEmpleados.length && filteredEmpleados.length > 0}
                  />
                </th>
                <th className="p-4 text-sm font-semibold text-gray-400 uppercase">RUT</th>
                <th className="p-4 text-sm font-semibold text-gray-400 uppercase">Nombre Completo</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>

                <th className="p-4 text-sm font-semibold text-gray-400 uppercase relative">
                  <button onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(openFilterDropdown === 'depto' ? null : 'depto'); }} className="flex items-center gap-1 hover:text-gray-600 outline-none">
                    DEPARTAMENTO
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-4 h-4 transition-transform ${openFilterDropdown === 'depto' ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                  </button>
                  {openFilterDropdown === 'depto' && (
                    <div onClick={(e) => e.stopPropagation()} className="absolute top-12 left-0 w-64 bg-white border border-gray-100 shadow-xl rounded-xl p-3 z-50 max-h-64 overflow-y-auto">
                      <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer border-b mb-1">
                        <input type="checkbox" checked={selectedDeptos.length === allDeptos.length} onChange={() => toggleSelectAll(allDeptos, selectedDeptos, setSelectedDeptos)} className="w-4 h-4 text-blue-600 rounded" />
                        <span className="ml-3 font-semibold text-gray-900">Seleccionar todos</span>
                      </label>
                      {allDeptos.map(depto => (
                        <label key={depto} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input type="checkbox" checked={selectedDeptos.includes(depto)} onChange={() => toggleArrayItem(selectedDeptos, setSelectedDeptos, depto)} className="w-4 h-4 text-blue-600 rounded" />
                          <span className="ml-3 text-gray-700 capitalize">{depto.toLowerCase()}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </th>

                <th className="p-4 text-sm font-semibold text-gray-400 uppercase relative">
                  <button onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(openFilterDropdown === 'cargo' ? null : 'cargo'); }} className="flex items-center gap-1 hover:text-gray-600 outline-none">
                    CARGO
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-4 h-4 transition-transform ${openFilterDropdown === 'cargo' ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                  </button>
                  {openFilterDropdown === 'cargo' && (
                    <div onClick={(e) => e.stopPropagation()} className="absolute top-12 left-0 w-64 bg-white border border-gray-100 shadow-xl rounded-xl p-3 z-50 max-h-64 overflow-y-auto">
                      <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer border-b mb-1">
                        <input type="checkbox" checked={selectedCargos.length === allCargos.length} onChange={() => toggleSelectAll(allCargos, selectedCargos, setSelectedCargos)} className="w-4 h-4 text-blue-600 rounded" />
                        <span className="ml-3 font-semibold text-gray-900">Seleccionar todos</span>
                      </label>
                      {allCargos.map(cargo => (
                        <label key={cargo} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input type="checkbox" checked={selectedCargos.includes(cargo)} onChange={() => toggleArrayItem(selectedCargos, setSelectedCargos, cargo)} className="w-4 h-4 text-blue-600 rounded" />
                          <span className="ml-3 text-gray-700 capitalize">{cargo.toLowerCase()}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </th>

                <th className="p-4 text-sm font-semibold text-gray-400 uppercase relative">
                  <button onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(openFilterDropdown === 'estado' ? null : 'estado'); }} className="flex items-center gap-1 hover:text-gray-600 outline-none">
                    ESTADO
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-4 h-4 transition-transform ${openFilterDropdown === 'estado' ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                  </button>
                  {openFilterDropdown === 'estado' && (
                    <div onClick={(e) => e.stopPropagation()} className="absolute top-12 left-0 w-56 bg-white border border-gray-100 shadow-xl rounded-xl p-3 z-50">
                      <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" checked={selectedStatuses.includes(true)} onChange={() => toggleArrayItem(selectedStatuses, setSelectedStatuses, true)} className="w-4 h-4 text-blue-600 rounded" />
                        <span className="ml-3 text-green-700 font-medium">Vigentes</span>
                      </label>
                      <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" checked={selectedStatuses.includes(false)} onChange={() => toggleArrayItem(selectedStatuses, setSelectedStatuses, false)} className="w-4 h-4 text-blue-600 rounded" />
                        <span className="ml-3 text-red-700 font-medium">Desvinculados</span>
                      </label>
                    </div>
                  )}
                </th>

                <th className="p-4 text-sm font-semibold text-gray-400 uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmpleados?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500 font-medium">No se encontraron trabajadores con los filtros aplicados.</td>
                </tr>
              ) : (
                filteredEmpleados.map((emp) => (
                  <tr key={emp.id} className={`border-b border-gray-50 transition-colors group ${!emp.activo ? 'bg-gray-50/70 opacity-80' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-6 py-4"><input type="checkbox" aria-label={`Seleccionar a ${emp.nombres} ${emp.apellido_paterno}`} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={selectedEmpleadosIds.includes(emp.id)} onChange={() => handleSelectEmpleado(emp.id)} onClick={(e) => e.stopPropagation()} /></td>
                    <td className="p-4 font-mono text-sm text-gray-600">{emp.rut}</td>
                    <td className="p-4 font-medium text-gray-900">{emp.nombres} {emp.apellido_paterno}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{emp.email || '---'}</td>
                    <td className="p-4 text-gray-600 capitalize">{emp.departamento?.toLowerCase() || 'No especificado'}</td>
                    <td className="p-4 text-gray-600 capitalize">{emp.cargo.toLowerCase()}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${emp.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {emp.activo ? 'Vigente' : 'Desvinculado'}
                      </span>
                    </td>
                    <td className="p-4 text-right flex justify-end gap-3">
                      <button onClick={(e) => { e.stopPropagation(); generarYDescargarPDF(emp); }} disabled={downloadingId === emp.id || !emp.activo} className={`p-2 rounded-lg transition-colors ${!emp.activo ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`} title={emp.activo ? "Descargar Anexo" : "No disponible para inactivos"}>
                        {downloadingId === emp.id ? (
                          <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        )}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); abrirVer(emp); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver Perfil">
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); abrirEditar(emp); }} className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="Editar Trabajador">
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
