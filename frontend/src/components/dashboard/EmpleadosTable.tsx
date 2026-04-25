import { Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
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
  isDownloading: UseDashboardReturn['isDownloading'];
  handleSelectAll: UseDashboardReturn['handleSelectAll'];
  handleSelectEmpleado: UseDashboardReturn['handleSelectEmpleado'];
  toggleArrayItem: UseDashboardReturn['toggleArrayItem'];
  toggleSelectAll: UseDashboardReturn['toggleSelectAll'];
  abrirVer: UseDashboardReturn['abrirVer'];
  abrirEditar: UseDashboardReturn['abrirEditar'];
  abrirCrear: UseDashboardReturn['abrirCrear'];
  setIsModalMasivoOpen: UseDashboardReturn['setIsModalMasivoOpen'];
  setIsUploadModalOpen: UseDashboardReturn['setIsUploadModalOpen'];
};

export default function EmpleadosTable({
  empleados, filteredEmpleados, searchTerm, setSearchTerm,
  selectedCargos, setSelectedCargos, selectedDeptos, setSelectedDeptos,
  selectedStatuses, setSelectedStatuses, openFilterDropdown, setOpenFilterDropdown,
  allCargos, allDeptos, selectedEmpleadosIds,
  isDownloading, handleSelectAll, handleSelectEmpleado,
  toggleArrayItem, toggleSelectAll,
  abrirVer, abrirEditar, abrirCrear,
  setIsModalMasivoOpen, setIsUploadModalOpen,
}: Props) {
  return (
    <div className="rounded-3xl p-7 min-h-[500px] overflow-hidden glass-card">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">Directorio de Empleados</h2>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Mostrando {filteredEmpleados?.length || 0} de {empleados?.length || 0}
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Buscar rut, nombre, ciudad..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"
            className="w-4 h-4 absolute left-3 top-2.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Carga Masiva</span>
          </button>

          <button type="button" onClick={abrirCrear}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 2px 10px rgba(37,99,235,0.3)' }}>
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
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
          <button
            onClick={() => { setIsModalMasivoOpen(true); }}
            disabled={isDownloading}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isDownloading ? (
              <span className="animate-pulse">Generando documentos...</span>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Descargar Documentos ({selectedEmpleadosIds.length})
              </>
            )}
          </button>
        </div>
      )}

      {empleados?.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
          <p className="font-medium mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Aún no tienes empleados en esta empresa.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-7 px-7 pb-4">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className="px-3 py-4 text-left">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      className="w-4 h-4 rounded accent-blue-500"
                      onChange={handleSelectAll}
                      checked={selectedEmpleadosIds.length === filteredEmpleados.length && filteredEmpleados.length > 0}
                    />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Acciones</span>
                  </div>
                </th>
                {['RUT', 'Nombre Completo', 'Email'].map(h => (
                  <th key={h} className="p-4 text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{h}</th>
                ))}

                {[
                  { key: 'depto', label: 'Departamento', items: allDeptos, selected: selectedDeptos, setSelected: setSelectedDeptos },
                  { key: 'cargo', label: 'Cargo', items: allCargos, selected: selectedCargos, setSelected: setSelectedCargos },
                ].map(({ key, label, items, selected, setSelected }) => (
                  <th key={key} className="p-4 text-xs font-bold uppercase tracking-wider relative" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <button onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(openFilterDropdown === key ? null : key as 'cargo' | 'depto' | 'estado'); }}
                      className="flex items-center gap-1 outline-none hover:text-white transition-colors">
                      {label}
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-3 h-3 transition-transform ${openFilterDropdown === key ? 'rotate-180' : ''}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {openFilterDropdown === key && (
                      <div onClick={(e) => e.stopPropagation()}
                        className="absolute top-10 left-0 w-60 rounded-xl p-2 z-50 max-h-64 overflow-y-auto"
                        style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}>
                        <label className="flex items-center p-2 rounded cursor-pointer" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          <input type="checkbox" checked={selected.length === items.length} onChange={() => toggleSelectAll(items, selected, setSelected)} className="w-4 h-4 accent-blue-500 rounded" />
                          <span className="ml-3 font-semibold text-white text-sm">Seleccionar todos</span>
                        </label>
                        {items.map(item => (
                          <label key={String(item)} className="flex items-center p-2 rounded cursor-pointer hover:bg-white/5">
                            <input type="checkbox" checked={selected.includes(item as never)} onChange={() => toggleArrayItem(selected, setSelected, item as never)} className="w-4 h-4 accent-blue-500 rounded" />
                            <span className="ml-3 text-sm capitalize" style={{ color: 'rgba(255,255,255,0.7)' }}>{String(item).toLowerCase()}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </th>
                ))}

                <th className="p-4 text-xs font-bold uppercase tracking-wider relative" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <button onClick={(e) => { e.stopPropagation(); setOpenFilterDropdown(openFilterDropdown === 'estado' ? null : 'estado'); }}
                    className="flex items-center gap-1 outline-none hover:text-white transition-colors">
                    Estado
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-3 h-3 transition-transform ${openFilterDropdown === 'estado' ? 'rotate-180' : ''}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {openFilterDropdown === 'estado' && (
                    <div onClick={(e) => e.stopPropagation()}
                      className="absolute top-10 left-0 w-52 rounded-xl p-2 z-50"
                      style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}>
                      <label className="flex items-center p-2 rounded cursor-pointer hover:bg-white/5">
                        <input type="checkbox" checked={selectedStatuses.includes(true)} onChange={() => toggleArrayItem(selectedStatuses, setSelectedStatuses, true)} className="w-4 h-4 accent-blue-500 rounded" />
                        <span className="ml-3 text-sm text-emerald-400 font-medium">Vigentes</span>
                      </label>
                      <label className="flex items-center p-2 rounded cursor-pointer hover:bg-white/5">
                        <input type="checkbox" checked={selectedStatuses.includes(false)} onChange={() => toggleArrayItem(selectedStatuses, setSelectedStatuses, false)} className="w-4 h-4 accent-blue-500 rounded" />
                        <span className="ml-3 text-sm text-red-400 font-medium">Desvinculados</span>
                      </label>
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEmpleados?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    No se encontraron trabajadores con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredEmpleados.map((emp) => (
                  <tr key={emp.id} className="group transition-colors"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      opacity: !emp.activo ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <input type="checkbox" aria-label={`Seleccionar a ${emp.nombres}`}
                          className="w-4 h-4 rounded accent-blue-500 shrink-0"
                          checked={selectedEmpleadosIds.includes(emp.id)}
                          onChange={() => handleSelectEmpleado(emp.id)}
                          onClick={(e) => e.stopPropagation()} />
                        <button onClick={(e) => { e.stopPropagation(); abrirVer(emp); }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'rgba(255,255,255,0.35)' }}
                          title="Ver Perfil"
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.background = 'rgba(37,99,235,0.15)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent'; }}>
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); abrirEditar(emp); }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'rgba(255,255,255,0.35)' }}
                          title="Editar"
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#fb923c'; e.currentTarget.style.background = 'rgba(249,115,22,0.15)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent'; }}>
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{emp.rut}</td>
                    <td className="p-4 font-medium text-white">{emp.nombres} {emp.apellido_paterno}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{emp.email || '—'}</td>
                    <td className="p-4 capitalize text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{emp.departamento?.toLowerCase() || 'No especificado'}</td>
                    <td className="p-4 capitalize text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{emp.cargo.toLowerCase()}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                        style={emp.activo
                          ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }
                          : { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                        {emp.activo ? 'Vigente' : 'Desvinculado'}
                      </span>
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
