import { useDashboard } from '../hooks/useDashboard';
import StatsWidgets from '../components/dashboard/StatsWidgets';
import EmpleadosTable from '../components/dashboard/EmpleadosTable';
import ModalDescargaMasiva from '../components/dashboard/ModalDescargaMasiva';
import ModalCargaMasiva from '../components/dashboard/ModalCargaMasiva';

export default function Dashboard() {
  const {
    // Estado de datos
    empresa, empleados, loading, downloadingId,
    // Filtros
    searchTerm, setSearchTerm,
    selectedCargos, setSelectedCargos,
    selectedDeptos, setSelectedDeptos,
    selectedStatuses, setSelectedStatuses,
    openFilterDropdown, setOpenFilterDropdown,
    allCargos, allDeptos, filteredEmpleados, stats,
    // Acciones masivas
    isModalMasivoOpen, setIsModalMasivoOpen,
    isUploading, isGeneratingZip, setIsGeneratingZip,
    selectedEmpleadosIds, setSelectedEmpleadosIds,
    isDownloadMenuOpen, setIsDownloadMenuOpen,
    isDownloading,
    isUploadModalOpen, setIsUploadModalOpen,
    uploadResult, setUploadResult,
    // Panel lateral
    isPanelOpen, setIsPanelOpen,
    panelMode,
    selectedEmpleado,
    isValidRut,
    activeTab, setActiveTab,
    // Formulario empleado
    formData,
    // Formulario contrato
    contratoData, setContratoData,
    isSavingContrato, hayCambiosContrato,
    funciones, setFunciones,
    clausulas, setClausulas,
    horario, setHorario,
    totalHorasCalculadas,
    // Liquidaciones
    liquidaciones,
    showLiqForm, setShowLiqForm,
    isGeneratingLiq,
    expandedLiqId, setExpandedLiqId,
    liqMes, setLiqMes,
    liqAnio, setLiqAnio,
    liqDiasTrabajados, setLiqDiasTrabajados,
    liqAusencias, setLiqAusencias,
    haberesImponiblesList, setHaberesImponiblesList,
    haberesNoImponiblesList, setHaberesNoImponiblesList,
    horasExtrasList, setHorasExtrasList,
    // Documentos legales
    documentosLegales,
    documentoData, setDocumentoData,
    showDocumentoForm, setShowDocumentoForm,
    isSavingDocumento,
    // Widgets BI
    flippedWidgets,
    // Handlers
    handleSelectAll, handleSelectEmpleado,
    ejecutarDescargaMasiva,
    descargarPlantillaExcel,
    handleFileUpload,
    abrirVer, abrirEditar, abrirCrear,
    handleInputChange, handleContratoChange,
    guardarEmpleado, guardarContrato, guardarDocumentoLegal,
    calcularValorHorasExtras,
    generarLiquidacion,
    descargarLiquidacionPDF, descargarDocumentoPDF,
    descargarContratoPDF, descargarAnexoPDF,
    generarYDescargarPDF,
    toggleWidget, toggleArrayItem, toggleSelectAll,
    volverAlLobby,
    empresaActivaId,
  } = useDashboard();


  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>;

  return (
    <div className="p-6 md:p-10 bg-gray-50 min-h-screen font-sans flex" onClick={() => setOpenFilterDropdown(null)}>
      <div className={`max-w-7xl mx-auto w-full transition-all duration-300 ${isPanelOpen ? 'md:mr-[450px]' : ''}`}>
        
        <div className="flex justify-between items-center mb-8">
          <button onClick={volverAlLobby} className="text-gray-500 hover:text-gray-900 flex items-center gap-2 font-medium transition-colors">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
            Cambiar de Empresa
          </button>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
              {empresa?.nombre_legal?.charAt(0)?.toUpperCase() || 'E'}
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{empresa?.nombre_legal}</h1>
          <div className="flex gap-4 mt-3 text-sm text-gray-500 font-medium">
            <span className="bg-gray-100 px-3 py-1 rounded-lg">RUT: {empresa?.rut}</span>
            {empresa?.giro && <span className="bg-gray-100 px-3 py-1 rounded-lg">Giro: {empresa.giro}</span>}
          </div>
        </div>

        {/* ========================================== */}
        {stats && (
          <StatsWidgets stats={stats} flippedWidgets={flippedWidgets} toggleWidget={toggleWidget} />
        )}

        <EmpleadosTable
          empleados={empleados}
          filteredEmpleados={filteredEmpleados}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCargos={selectedCargos}
          setSelectedCargos={setSelectedCargos}
          selectedDeptos={selectedDeptos}
          setSelectedDeptos={setSelectedDeptos}
          selectedStatuses={selectedStatuses}
          setSelectedStatuses={setSelectedStatuses}
          openFilterDropdown={openFilterDropdown}
          setOpenFilterDropdown={setOpenFilterDropdown}
          allCargos={allCargos}
          allDeptos={allDeptos}
          selectedEmpleadosIds={selectedEmpleadosIds}
          isDownloadMenuOpen={isDownloadMenuOpen}
          setIsDownloadMenuOpen={setIsDownloadMenuOpen}
          isDownloading={isDownloading}
          downloadingId={downloadingId}
          handleSelectAll={handleSelectAll}
          handleSelectEmpleado={handleSelectEmpleado}
          ejecutarDescargaMasiva={ejecutarDescargaMasiva}
          toggleArrayItem={toggleArrayItem}
          toggleSelectAll={toggleSelectAll}
          abrirVer={abrirVer}
          abrirEditar={abrirEditar}
          abrirCrear={abrirCrear}
          generarYDescargarPDF={generarYDescargarPDF}
          setIsModalMasivoOpen={setIsModalMasivoOpen}
          setIsUploadModalOpen={setIsUploadModalOpen}
        />

      {/* === SLIDE-OVER PANEL LATERAL === */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-40 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={(e) => { e.stopPropagation(); setIsPanelOpen(false); }}></div>
          
          <div className="absolute inset-y-0 right-0 max-w-4xl w-full flex shadow-2xl">
            <div className="h-full w-full bg-white flex flex-col transform transition-transform duration-300" onClick={(e) => e.stopPropagation()}>
              
              {/* HEADER DEL PANEL */}
              <div className="px-8 py-6 border-b border-gray-200 flex items-start justify-between bg-white">
                <div className="flex items-center gap-5">
                  {panelMode !== 'create' && selectedEmpleado ? (
                    <div className="w-16 h-16 bg-slate-800 text-white rounded-2xl flex items-center justify-center text-2xl font-bold shadow-sm">
                      {selectedEmpleado.nombres?.charAt(0) || ''}{selectedEmpleado.apellido_paterno?.charAt(0) || ''}
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-sm">
                      +
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      {panelMode === 'create' ? 'Nuevo Trabajador' : `${selectedEmpleado?.nombres} ${selectedEmpleado?.apellido_paterno}`}
                    </h2>
                    {panelMode !== 'create' && selectedEmpleado && (
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-slate-500 font-medium">{selectedEmpleado.cargo}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500 font-mono text-sm">{selectedEmpleado.rut}</span>
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-wide ${selectedEmpleado.activo ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'}`}>
                          {selectedEmpleado.activo ? 'VIGENTE' : 'DESVINCULADO'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {panelMode === 'view' && selectedEmpleado && (
                    <button onClick={() => {setFormData({ ...selectedEmpleado });
                      setIsValidRut (true);
                      setPanelMode('edit');}
                     } className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-sm flex items-center gap-2">
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                      Editar Ficha
                    </button>
                  )}
                  <button onClick={() => setIsPanelOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* SISTEMA DE PESTAÑAS (TABS) */}
              {panelMode !== 'create' && (
                <div className="px-8 border-b border-gray-200 bg-slate-50/50">
                  <nav className="flex gap-6 -mb-px">
                    {[
                      { id: 'perfil', label: 'Datos Generales' },
                      { id: 'contratos', label: 'Contratos y Anexos' },
                      { id: 'liquidaciones', label: 'Liquidaciones' },
                      { id: 'legal', label: 'Historial Legal' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'perfil' | 'contratos' | 'liquidaciones' | 'legal')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                          activeTab === tab.id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>
              )}

              {/* BODY DEL PANEL */}
              <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                
                {activeTab === 'perfil' && (
                  <>
                    {panelMode === 'view' && selectedEmpleado ? (
                      <div className="grid grid-cols-2 gap-10">
                        <div className="space-y-6">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Información Personal</h4>
                          <dl className="space-y-4 text-sm">
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Nacionalidad</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.nacionalidad?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Fecha Nac.</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.fecha_nacimiento || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Estado Civil</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.estado_civil?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Teléfono</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.numero_telefono || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Email</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.email?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Comuna</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.comuna?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Dirección</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.direccion?.toLowerCase() || '-'}</dd></div>
                          </dl>
                        </div>

                        <div className="space-y-6">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Condiciones Laborales</h4>
                          <dl className="space-y-4 text-sm">
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Departamento</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.departamento?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Centro de Costo</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.centro_costo || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Ficha N°</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.ficha_numero || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Sucursal</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.sucursal?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Fecha Ingreso</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.fecha_ingreso || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Modalidad</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.modalidad?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Jornada</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.horas_laborales} Hrs.</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Sueldo Base</dt><dd className="col-span-2 font-semibold text-slate-900">${Number(selectedEmpleado.sueldo_base || 0).toLocaleString('es-CL')}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Previsión AFP</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.afp?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Salud</dt><dd className="col-span-2 font-semibold text-slate-900 capitalize">{selectedEmpleado.sistema_salud?.toLowerCase() || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Forma de Pago</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.forma_pago || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">Banco</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.banco || '-'} - {selectedEmpleado.tipo_cuenta || '-'}</dd></div>
                            <div className="grid grid-cols-3 gap-4"><dt className="text-slate-500 font-medium">N° Cuenta</dt><dd className="col-span-2 font-semibold text-slate-900">{selectedEmpleado.numero_cuenta || '-'}</dd></div>
                          </dl>
                        </div>
                      </div>
                    ) : (
                      <form id="empleadoForm" onSubmit={guardarEmpleado} className="grid grid-cols-2 gap-10">
                        <div className="space-y-5">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Datos Personales</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">RUT *</label>
                              <input type="text" name="rut" required value={formData.rut || ''} onChange={handleInputChange} placeholder="12.345.678-9" 
                                     className={`w-full px-3 py-2 rounded-lg border ${!isValidRut && formData.rut ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} outline-none transition-all`} />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombres *</label>
                              <input type="text" name="nombres" required value={formData.nombres || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Ap. Paterno *</label>
                              <input type="text" name="apellido_paterno" required value={formData.apellido_paterno || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Ap. Materno</label>
                              <input type="text" name="apellido_materno" value={formData.apellido_materno || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Nacionalidad</label>
                              <input type="text" name="nacionalidad" value={formData.nacionalidad || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">F. Nacimiento</label>
                              <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Estado Civil</label>
                              <input type="text" name="estado_civil" value={formData.estado_civil || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
                              <div className="relative">
                                {/* El +56 fijo visualmente dentro del input */}
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-slate-500 font-medium">+56</span>
                                </div>
                                <input 
                                  type="text" 
                                  name="numero_telefono" 
                                  value={formData.numero_telefono || ''} 
                                  onChange={handleInputChange} 
                                  placeholder="912345678" 
                                  className="w-full pl-11 pr-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" 
                                  />
                              </div>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Comuna y Dirección</label>
                              <div className="flex gap-2">
                                <input type="text" name="comuna" placeholder="Comuna" value={formData.comuna || ''} onChange={handleInputChange} className="w-1/3 px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                                <input type="text" name="direccion" placeholder="Calle y número" value={formData.direccion || ''} onChange={handleInputChange} className="w-2/3 px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                              </div>
                            </div>
                          </div>
                          <div className="col-span-2 pt-4 border-t border-slate-100 mt-2">
                              <h5 className="text-xs font-bold text-slate-800 mb-3">Datos Bancarios para Pago</h5>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forma de Pago</label>
                                  {/* Nos aseguramos de que los values estén en mayúsculas para que coincidan con la lógica */}
                                  <select name="forma_pago" value={formData.forma_pago || 'TRANSFERENCIA'} onChange={handleInputChange} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none font-medium uppercase">
                                    <option value="TRANSFERENCIA">Transferencia</option>
                                    <option value="DEPOSITO">Depósito</option>
                                    <option value="CHEQUE">Cheque</option>
                                    <option value="EFECTIVO">Efectivo</option>
                                  </select>
                                </div>
                                
                                {/* Ocultamos los campos del banco si es Efectivo o Cheque */}
                                {formData.forma_pago !== 'EFECTIVO' && formData.forma_pago !== 'CHEQUE' && (
                                  <>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Banco</label>
                                      <input type="text" name="banco" value={formData.banco || ''} onChange={handleInputChange} placeholder="Ej: Banco Estado" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none font-medium" />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Cuenta</label>
                                      <select name="tipo_cuenta" value={formData.tipo_cuenta || ''} onChange={handleInputChange} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none font-medium">
                                        <option value="">Seleccione...</option>
                                        <option value="Cuenta Corriente">Cuenta Corriente</option>
                                        <option value="Cuenta Vista / RUT">Cuenta Vista / RUT</option>
                                        <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">N° de Cuenta</label>
                                      <input type="text" name="numero_cuenta" value={formData.numero_cuenta || ''} onChange={handleInputChange} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none font-medium" />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Datos Laborales</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo *</label>
                              <input type="text" name="cargo" required value={formData.cargo || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Departamento</label>
                              <input type="text" name="departamento" value={formData.departamento || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Sucursal</label>
                              <input type="text" name="sucursal" value={formData.sucursal || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha Ingreso *</label>
                              <input type="date" name="fecha_ingreso" required value={formData.fecha_ingreso || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Sueldo Base ($)</label>
                              <input type="number" name="sueldo_base" value={formData.sueldo_base || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Jornada (Horas)</label>
                              <input type="number" name="horas_laborales" value={formData.horas_laborales || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Modalidad</label>
                              <select name="modalidad" value={formData.modalidad || 'PRESENCIAL'} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-700">
                                <option value="PRESENCIAL">PRESENCIAL</option>
                                <option value="REMOTO">REMOTO</option>
                                <option value="HIBRIDO">HÍBRIDO</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">AFP</label>
                              <input type="text" name="afp" value={formData.afp || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Sistema de Salud</label>
                              <select name="sistema_salud" value={formData.sistema_salud || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-slate-700">
                                <option value="">Seleccione...</option>
                                <option value="FONASA">FONASA</option>
                                <option value="ISAPRE">ISAPRE</option>
                              </select>
                              {formData.sistema_salud === 'ISAPRE' && (
                              <div className="col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Valor Plan Isapre (En UF) *</label>
                                <input type="number" step="0.01" min="0" name="plan_isapre_uf" value={formData.plan_isapre_uf || ''} onChange={handleInputChange} placeholder="Ej: 2.15" className="w-full px-3 py-2.5 rounded-xl border border-blue-200 bg-white outline-none font-bold text-blue-900" />
                              </div>
                            )}

                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Centro de Costo</label>
                              <input type="text" name="centro_costo" value={formData.centro_costo || ''} onChange={handleInputChange} placeholder="Ej: Obra Norte" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-medium uppercase transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ficha N°</label>
                              <input type="text" name="ficha_numero" value={formData.ficha_numero || ''} onChange={handleInputChange} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-medium uppercase transition-all" />
                            </div>
                            </div>
                            
                            <div className="col-span-2 flex items-center justify-between mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Estado del Trabajador</p>
                                <p className="text-xs text-slate-500 mt-0.5">Desactivar para marcar como desvinculado</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="activo" checked={formData.activo} onChange={handleInputChange} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              </label>
                            </div>
                          </div>
                        </div>
                      </form>
                    )}
                  </>
                )}

                {/* ========================================== */}
                {/* PESTAÑA 2: CONTRATOS                       */}
                {/* ========================================== */}
                {activeTab === 'contratos' && (
                  <form id="contratoForm" onSubmit={guardarContrato} onChange={() => setHayCambiosContrato(true)} className="max-w-4xl mx-auto space-y-8 pb-10">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">1. Condiciones Generales</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Contrato</label>
                          <select name="tipo_contrato" required value={contratoData.tipo_contrato || 'INDEFINIDO'} onChange={handleContratoChange} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-slate-50">
                            <option value="INDEFINIDO">Indefinido</option>
                            <option value="PLAZO_FIJO">Plazo Fijo</option>
                            <option value="OBRA_FAENA">Por Obra o Faena</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Inicio</label>
                          <input type="date" name="fecha_inicio" required value={contratoData.fecha_inicio || ''} onChange={handleContratoChange} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-slate-50" />
                        </div>
                        {contratoData.tipo_contrato === 'PLAZO_FIJO' && (
                          <div className="col-span-2 bg-orange-50 p-4 rounded-xl border border-orange-100 flex gap-4">
                            <div className="w-1/2">
                              <label className="block text-xs font-semibold text-orange-800 mb-1">Fecha de Término</label>
                              <input type="date" name="fecha_fin" required value={contratoData.fecha_fin || ''} onChange={handleContratoChange} className="w-full px-3 py-2 rounded-lg border border-orange-200" />
                            </div>
                            <p className="w-1/2 text-xs text-orange-700 flex items-center">Indica la fecha exacta en la que terminará la relación laboral.</p>
                          </div>
                        )}
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-2">Funciones a Desempeñar (Opcional)</label>
                          <p className="text-xs text-slate-500 mb-2">Por defecto se incluirá un texto legal genérico. Si agregas ítems aquí, se listarán en el contrato.</p>
                          {funciones.map((func, index) => (
                            <div key={index} className="flex gap-2 mb-2">
                              <input type="text" value={func} onChange={(e) => { const newF = [...funciones]; newF[index] = e.target.value; setFunciones(newF); setHayCambiosContrato(true); }} className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white" placeholder="Ej: Atención a público y ventas..." />
                              <button type="button" onClick={() => { setFunciones(funciones.filter((_, i) => i !== index)); setHayCambiosContrato(true); }} className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold">✕</button>
                            </div>
                          ))}
                          <button type="button" onClick={() => { setFunciones([...funciones, ""]); setHayCambiosContrato(true); }} className="text-sm text-blue-600 font-semibold mt-1">+ Agregar Función Específica</button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">2. Remuneraciones y Quincena</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Día de Pago (Mensual)</label>
                          <input type="number" min="1" max="31" name="dia_pago" required value={contratoData.dia_pago || 5} onChange={handleContratoChange} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-slate-50" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Gratificación Legal</label>
                          <select name="gratificacion_legal" value={contratoData.gratificacion_legal || 'MENSUAL'} onChange={handleContratoChange} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-slate-50">
                            <option value="MENSUAL">Mensual (Art. 50 - 25% con tope)</option>
                            <option value="ANUAL">Anual (Art. 47 - 30% utilidades)</option>
                          </select>
                        </div>
                        
                        <div className="col-span-2 flex items-center gap-3">
                          <input type="checkbox" name="tiene_quincena" checked={contratoData.tiene_quincena || false} onChange={handleContratoChange} className="w-5 h-5 text-blue-600" />
                          <label className="font-semibold text-slate-700">El trabajador recibirá Anticipo Quincenal</label>
                        </div>

                        {contratoData.tiene_quincena && (
                          <div className="col-span-2 grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <div>
                              <label className="block text-xs font-semibold text-blue-800 mb-1">Día de la Quincena</label>
                              <input type="number" min="1" max="31" name="dia_quincena" value={contratoData.dia_quincena || 15} onChange={handleContratoChange} className="w-full px-3 py-2 rounded-lg border border-blue-200" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-blue-800 mb-1">Monto de la Quincena ($)</label>
                              <input type="number" min="10000" max={contratoData.sueldo_base || 5000000} name="monto_quincena" value={contratoData.monto_quincena || ''} onChange={handleContratoChange} placeholder="Ej: 150000" className="w-full px-3 py-2 rounded-lg border border-blue-200" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-end mb-4 border-b pb-2">
                        <h3 className="text-lg font-bold text-slate-900">3. Jornada Laboral</h3>
                        <div className="text-right">
                          <label className="block text-xs font-semibold text-slate-600">Límite Legal (Hrs Semanales)</label>
                          <input type="number" step="0.5" name="horas_semanales" value={contratoData.horas_semanales || 44} onChange={handleContratoChange} className="w-24 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg" />
                        </div>
                      </div>

                      <div className="mb-6">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Jornada</label>
                        <select name="tipo_jornada" required value={contratoData.tipo_jornada || 'ORDINARIA'} onChange={handleContratoChange} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-slate-50">
                          <option value="ORDINARIA">Ordinaria (Asignar Horarios)</option>
                          <option value="ART_22">Artículo 22 (Sin límite de horario)</option>
                          <option value="OTRO">Otra (Redactar manualmente)</option>
                        </select>
                      </div>

                      {contratoData.tipo_jornada === 'OTRO' && (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                          <label className="block text-xs font-semibold text-blue-800 mb-1">Detalle de la Jornada</label>
                          <textarea name="jornada_personalizada" rows={3} value={contratoData.jornada_personalizada || ''} onChange={handleContratoChange} className="w-full px-3 py-2 rounded-lg border border-blue-200 resize-none"></textarea>
                        </div>
                      )}

                      {contratoData.tipo_jornada === 'ORDINARIA' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase text-center px-2">
                            <div className="col-span-1">Día</div>
                            <div className="col-span-3 text-left">Habilitado</div>
                            <div className="col-span-2">Entrada</div>
                            <div className="col-span-2">Salida</div>
                            <div className="col-span-2">Colación (Min)</div>
                            <div className="col-span-2">Total Día</div>
                          </div>
                          
                          {['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map((dia) => {
                            const datos = horario[dia] || { activo: false, entrada: '09:00', salida: '18:00', colacion: 60 };
                            let horasDia = 0;
                            if (datos.activo && datos.entrada && datos.salida) {
                              const [he, me] = datos.entrada.split(':').map(Number);
                              const [hs, ms] = datos.salida.split(':').map(Number);
                              const minsTrabajados = ((hs * 60 + ms) - (he * 60 + me)) - datos.colacion;
                              if (minsTrabajados > 0) horasDia = minsTrabajados / 60;
                            }

                            return (
                              <div key={dia} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${datos.activo ? 'bg-white border-blue-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                <div className="col-span-1 text-xs font-bold text-slate-400 text-center">{dia.substring(0,2).toUpperCase()}</div>
                                <div className="col-span-3">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={datos.activo} onChange={(e) => { setHorario({...horario, [dia]: {...datos, activo: e.target.checked}}); setHayCambiosContrato(true); }} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                  </label>
                                </div>
                                <div className="col-span-2"><input type="time" disabled={!datos.activo} value={datos.entrada} onChange={(e) => { setHorario({...horario, [dia]: {...datos, entrada: e.target.value}}); setHayCambiosContrato(true); }} className="w-full text-sm p-1 border rounded" /></div>
                                <div className="col-span-2"><input type="time" disabled={!datos.activo} value={datos.salida} onChange={(e) => { setHorario({...horario, [dia]: {...datos, salida: e.target.value}}); setHayCambiosContrato(true); }} className="w-full text-sm p-1 border rounded" /></div>
                                <div className="col-span-2"><input type="number" step="15" disabled={!datos.activo} value={datos.colacion} onChange={(e) => { setHorario({...horario, [dia]: {...datos, colacion: Number(e.target.value)}}); setHayCambiosContrato(true); }} className="w-full text-sm p-1 border rounded text-center" /></div>
                                <div className="col-span-2 text-center font-mono font-bold text-slate-700">{horasDia.toFixed(1)}h</div>
                              </div>
                            );
                          })}

                          <div className={`mt-4 p-4 rounded-xl flex justify-between items-center border ${totalHorasCalculadas > (Number(contratoData.horas_semanales) || 44) ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <span className="font-bold text-slate-700">Horas asignadas en la semana:</span>
                            <div className="text-right">
                              <span className={`text-2xl font-black ${totalHorasCalculadas > (Number(contratoData.horas_semanales) || 44) ? 'text-red-600' : 'text-emerald-600'}`}>
                                {totalHorasCalculadas.toFixed(1)} / {contratoData.horas_semanales || 44}
                              </span>
                              <p className={`text-xs font-bold uppercase mt-1 ${totalHorasCalculadas > (Number(contratoData.horas_semanales) || 44) ? 'text-red-500' : 'text-emerald-600'}`}>
                                {totalHorasCalculadas > (Number(contratoData.horas_semanales) || 44) ? '¡Has sobrepasado el límite!' : `Quedan ${((Number(contratoData.horas_semanales) || 44) - totalHorasCalculadas).toFixed(1)} horas libres`}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">4. Cláusulas Adicionales</h3>
                      {clausulas.map((clausula, index) => (
                        <div key={index} className="flex gap-2 mb-3">
                          <textarea rows={2} value={clausula} onChange={(e) => { const newC = [...clausulas]; newC[index] = e.target.value; setClausulas(newC); setHayCambiosContrato(true); }} className="flex-1 px-3 py-2 rounded-lg border border-slate-300 resize-none" placeholder="Ej: Se acuerda un bono de productividad de..." />
                          <button type="button" onClick={() => { setClausulas(clausulas.filter((_, i) => i !== index)); setHayCambiosContrato(true); }} className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold">✕</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => { setClausulas([...clausulas, ""]); setHayCambiosContrato(true); }} className="text-sm text-blue-600 font-semibold">+ Añadir Nueva Cláusula</button>
                    </div>

                    {contratoData.id && (
                      <div className="flex gap-4">
                        <button 
                          type="button" 
                          onClick={descargarContratoPDF} 
                          disabled={hayCambiosContrato}
                          className={`flex-1 px-4 py-3 rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2 ${
                            hayCambiosContrato 
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                              : 'bg-slate-800 text-white hover:bg-slate-900'
                          }`}
                        >
                          {hayCambiosContrato ? '⚠️ Guarda los cambios primero' : '📄 Descargar Contrato Base'}
                        </button>
                        
                        <button 
                          type="button" 
                          onClick={descargarAnexoPDF} 
                          disabled={hayCambiosContrato}
                          className={`flex-1 px-4 py-3 rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2 ${
                            hayCambiosContrato 
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed border-transparent' 
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {hayCambiosContrato ? '⚠️ Guarda los cambios primero' : '📄 Descargar Anexo Ley 40h'}
                        </button>
                      </div>
                    )}
                  </form>
                )}

                {/* ========================================== */}
                {/* PESTAÑA 3: LIQUIDACIONES                   */}
                {/* ========================================== */}
                {activeTab === 'liquidaciones' && (
                  <div className="max-w-4xl mx-auto">
                    
                    {!showLiqForm ? (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-900">Historial de Remuneraciones</h3>
                            <p className="text-sm font-medium text-slate-500">Nómina mensual, haberes y descuentos legales.</p>
                          </div>
                          <button onClick={() => setShowLiqForm(true)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-md shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center gap-2">
                            + Calcular Mes
                          </button>
                        </div>

                        {liquidaciones.length === 0 ? (
                          <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <p className="text-slate-500 font-medium">No hay liquidaciones emitidas para este trabajador.</p>
                          </div>
                        ) : (
                          <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Periodo</th>
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Total Imponible</th>
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Descuentos Legales</th>
                                  <th className="p-4 text-xs font-extrabold text-slate-900 uppercase tracking-wider text-right">Líquido a Pagar</th>
                                </tr>
                              </thead>
                              {liquidaciones.map(liq => (
                                <tbody key={liq.id}>
                                  {/* FILA PRINCIPAL */}
                                  <tr 
                                    onClick={() => setExpandedLiqId(expandedLiqId === liq.id ? null : liq.id!)}
                                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group"
                                  >
                                    <td className="p-4 text-sm font-bold text-slate-900 flex items-center gap-2">
                                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={`w-4 h-4 text-slate-400 transition-transform ${expandedLiqId === liq.id ? 'rotate-90 text-blue-600' : 'group-hover:text-slate-600'}`}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                                      {liq.mes}/{liq.anio}
                                    </td>
                                    <td className="p-4 text-sm font-medium text-slate-600">${liq.total_imponible.toLocaleString('es-CL')}</td>
                                    <td className="p-4 text-sm font-medium text-rose-600">-${liq.total_descuentos.toLocaleString('es-CL')}</td>
                                    <td className="p-4 flex items-center justify-end gap-4">
                                      <span className="font-extrabold text-emerald-600 text-lg">
                                        ${liq.sueldo_liquido.toLocaleString('es-CL')}
                                      </span>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); descargarLiquidacionPDF(liq.id!, liq.mes, liq.anio); }}
                                        className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white rounded-lg transition-colors shadow-sm"
                                        title="Descargar Liquidación Oficial"
                                      >
                                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                      </button>
                                    </td>
                                  </tr>

                                  {/* DETALLE DESPLEGABLE (GRILLA) */}
                                  {expandedLiqId === liq.id && (
                                    <tr className="bg-slate-50/80 border-b border-slate-200">
                                      <td colSpan={4} className="p-6">
                                        <div className="grid grid-cols-2 gap-10">
                                          {/* COLUMNA HABERES */}
                                          <div className="space-y-2">
                                            <h5 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">Detalle de Haberes</h5>
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">Sueldo Base ({liq.dias_trabajados}d)</span><span className="font-bold text-slate-900">${liq.sueldo_base.toLocaleString('es-CL')}</span></div>
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">Gratificación Legal</span><span className="font-bold text-slate-900">${liq.gratificacion.toLocaleString('es-CL')}</span></div>
                                            
                                            {/* Mapear arreglos si existen */}
                                            {liq.detalle_horas_extras?.map((extra, i) => (
                                              <div key={`he-${i}`} className="flex justify-between text-sm">
                                                <span className="text-slate-600">{extra.glosa} ({extra.horas}h)</span>
                                                <span className="font-bold text-slate-900">${extra.valor.toLocaleString('es-CL')}</span>
                                              </div>
                                            ))}
                                            
                                            {liq.detalle_haberes_no_imponibles?.map((noimp, i) => (
                                              <div key={`ni-${i}`} className="flex justify-between text-sm">
                                                <span className="text-slate-600">{noimp.glosa}</span>
                                                <span className="font-bold text-slate-900">${noimp.valor.toLocaleString('es-CL')}</span>
                                              </div>
                                            ))}
                                            
                                            <div className="flex justify-between text-sm pt-2 mt-2 border-t border-slate-200"><span className="font-extrabold text-slate-900">Total Haberes</span><span className="font-extrabold text-slate-900">${liq.total_haberes.toLocaleString('es-CL')}</span></div>
                                          </div>

                                          {/* COLUMNA DESCUENTOS */}
                                          <div className="space-y-2">
                                            <h5 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">Detalle de Descuentos</h5>
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">AFP {liq.afp_nombre}</span><span className="font-bold text-rose-600">-${liq.afp_monto.toLocaleString('es-CL')}</span></div>
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">Salud {liq.salud_nombre}</span><span className="font-bold text-rose-600">-${liq.salud_monto.toLocaleString('es-CL')}</span></div>
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">Seguro de Cesantía</span><span className="font-bold text-rose-600">-${liq.seguro_cesantia.toLocaleString('es-CL')}</span></div>
                                            
                                            {liq.anticipo_quincena > 0 && (
                                              <div className="flex justify-between text-sm"><span className="text-slate-600">Anticipo Quincena</span><span className="font-bold text-rose-600">-${liq.anticipo_quincena.toLocaleString('es-CL')}</span></div>
                                            )}

                                            <div className="flex justify-between text-sm pt-2 mt-2 border-t border-slate-200"><span className="font-extrabold text-slate-900">Total Descuentos</span><span className="font-extrabold text-rose-600">-${liq.total_descuentos.toLocaleString('es-CL')}</span></div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              ))}
                            </table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <form id="liqForm" onSubmit={generarLiquidacion} className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-slate-200 space-y-8">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-900">Configurar Liquidación de Sueldo</h3>
                            <p className="text-sm font-medium text-slate-500">AFP {selectedEmpleado?.afp || 'MODELO'} y Salud {selectedEmpleado?.sistema_salud || 'FONASA'} se calcularán automáticamente.</p>
                          </div>
                          <button type="button" onClick={() => setShowLiqForm(false)} className="text-slate-400 hover:text-slate-900 font-bold">✕ Cancelar</button>
                        </div>

                        {/* 1. PERIODO Y ASISTENCIA */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">1. Periodo y Asistencia</h4>
                          <div className="grid grid-cols-4 gap-6">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mes</label>
                              <select required value={liqMes} onChange={(e) => setLiqMes(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-bold text-slate-700">
                                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>Mes {m}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Año</label>
                              <input type="number" required value={liqAnio} onChange={(e) => setLiqAnio(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-bold text-slate-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Días Trabajados</label>
                              <input type="number" min="0" max="30" required value={liqDiasTrabajados} onChange={(e) => setLiqDiasTrabajados(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-slate-900 bg-white outline-none font-bold text-slate-900" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">Días Ausente</label>
                              <input type="number" min="0" max="30" required value={liqAusencias} onChange={(e) => setLiqAusencias(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-rose-200 focus:ring-rose-500 bg-rose-50 outline-none font-bold text-rose-700" />
                            </div>
                          </div>
                        </div>

                        {/* 2. HABERES IMPONIBLES (Bonos, Comisiones) */}
                        <div>
                          <div className="flex justify-between items-end mb-4">
                            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">2. Otros Haberes Imponibles</h4>
                            <button type="button" onClick={() => setHaberesImponiblesList([...haberesImponiblesList, { glosa: '', valor: 0 }])} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Añadir Bono</button>
                          </div>
                          
                          {haberesImponiblesList.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No hay bonos imponibles extra (El Sueldo Base y Gratificación se calculan solos).</p>
                          ) : (
                            <div className="space-y-3">
                              {haberesImponiblesList.map((item, index) => (
                                <div key={index} className="flex gap-4">
                                  <input type="text" placeholder="Glosa (Ej: Bono Producción)" value={item.glosa} onChange={(e) => { const newL = [...haberesImponiblesList]; newL[index].glosa = e.target.value; setHaberesImponiblesList(newL); }} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none" />
                                  <input type="number" placeholder="Valor ($)" value={item.valor || ''} onChange={(e) => { const newL = [...haberesImponiblesList]; newL[index].valor = Number(e.target.value); setHaberesImponiblesList(newL); }} className="w-40 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none text-right" />
                                  <button type="button" onClick={() => setHaberesImponiblesList(haberesImponiblesList.filter((_, i) => i !== index))} className="text-rose-500 font-bold px-3 hover:bg-rose-50 rounded-lg">✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 3. HORAS EXTRAS (Automatizado) */}
                        <div>
                          <div className="flex justify-between items-end mb-4">
                            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">3. Horas Extras (Sobresueldo)</h4>
                            <button type="button" onClick={() => setHorasExtrasList([...horasExtrasList, { glosa: 'Horas Extras al 50%', horas: 0, recargo: 50, valor: 0 }])} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Añadir Horas Extras</button>
                          </div>
                          
                          {horasExtrasList.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No se registran horas extras este mes.</p>
                          ) : (
                            <div className="space-y-3">
                              {horasExtrasList.map((item, index) => (
                                <div key={index} className="flex gap-4 items-center">
                                  <input 
                                    type="text" 
                                    placeholder="Glosa" 
                                    value={item.glosa} 
                                    onChange={(e) => { const newL = [...horasExtrasList]; newL[index].glosa = e.target.value; setHorasExtrasList(newL); }} 
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none" 
                                  />
                                  
                                  <div className="w-24 relative">
                                    <span className="absolute text-xs text-slate-400 top-[-16px] left-1">Hrs</span>
                                    <input 
                                      type="number" 
                                      placeholder="0" 
                                      value={item.horas || ''} 
                                      onChange={(e) => { 
                                        const val = Number(e.target.value);
                                        const newL = [...horasExtrasList]; 
                                        newL[index].horas = val; 
                                        newL[index].valor = calcularValorHorasExtras(val, newL[index].recargo);
                                        setHorasExtrasList(newL); 
                                      }} 
                                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 outline-none text-center" 
                                    />
                                  </div>

                                  <div className="w-24 relative">
                                    <span className="absolute text-xs text-slate-400 top-[-16px] left-1">% Recargo</span>
                                    <input 
                                      type="number" 
                                      value={item.recargo} 
                                      onChange={(e) => { 
                                        const val = Number(e.target.value);
                                        const newL = [...horasExtrasList]; 
                                        newL[index].recargo = val; 
                                        newL[index].valor = calcularValorHorasExtras(newL[index].horas, val);
                                        setHorasExtrasList(newL); 
                                      }} 
                                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 outline-none text-center" 
                                    />
                                  </div>

                                  <div className="w-36 relative">
                                    <span className="absolute text-xs text-slate-400 top-[-16px] left-1">Total Calculado</span>
                                    <input 
                                      type="number" 
                                      readOnly
                                      value={item.valor || 0} 
                                      className="w-full px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50/50 font-extrabold text-blue-800 outline-none text-right cursor-not-allowed" 
                                    />
                                  </div>

                                  <button type="button" onClick={() => setHorasExtrasList(horasExtrasList.filter((_, i) => i !== index))} className="text-rose-500 font-bold px-3 hover:bg-rose-50 rounded-lg mt-2">✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 4. HABERES NO IMPONIBLES (Colación, Movilización) */}
                        <div>
                          <div className="flex justify-between items-end mb-4">
                            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">4. Haberes NO Imponibles</h4>
                            <button type="button" onClick={() => setHaberesNoImponiblesList([...haberesNoImponiblesList, { glosa: 'Asignación Colación', valor: 0 }])} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Añadir Asignación</button>
                          </div>
                          
                          {haberesNoImponiblesList.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No hay haberes no imponibles.</p>
                          ) : (
                            <div className="space-y-3">
                              {haberesNoImponiblesList.map((item, index) => (
                                <div key={index} className="flex gap-4">
                                  <input type="text" placeholder="Glosa (Ej: Colación, Movilización, Viático)" value={item.glosa} onChange={(e) => { const newL = [...haberesNoImponiblesList]; newL[index].glosa = e.target.value; setHaberesNoImponiblesList(newL); }} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none" />
                                  <input type="number" placeholder="Valor ($)" value={item.valor || ''} onChange={(e) => { const newL = [...haberesNoImponiblesList]; newL[index].valor = Number(e.target.value); setHaberesNoImponiblesList(newL); }} className="w-40 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium outline-none text-right" />
                                  <button type="button" onClick={() => setHaberesNoImponiblesList(haberesNoImponiblesList.filter((_, i) => i !== index))} className="text-rose-500 font-bold px-3 hover:bg-rose-50 rounded-lg">✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex justify-end">
                          <button type="submit" disabled={isGeneratingLiq} className="px-10 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:bg-slate-300 transition-all shadow-xl shadow-slate-900/10 text-lg">
                            {isGeneratingLiq ? 'Calculando Nómina...' : 'Generar Liquidación'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* ========================================== */}
                {/* PESTAÑA 4: HISTORIAL LEGAL         */}
                {/* ========================================== */}
                {activeTab === 'legal' && (
                  <div className="max-w-4xl mx-auto">
                    
                    {!showDocumentoForm ? (
                      /* VISTA: LISTA DE DOCUMENTOS */
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
                                aviso_previo_pagado: false
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
                                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
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

                      /* VISTA: FORMULARIO CREAR DOCUMENTO */
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
                              onChange={(e) => setDocumentoData({...documentoData, tipo: e.target.value})} 
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
                              onChange={(e) => setDocumentoData({...documentoData, fecha_emision: e.target.value})} 
                              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-slate-50" 
                            />
                          </div>

                          {/* CAMPO ESPECÍFICO PARA DESPIDO */}
                          {documentoData.tipo === 'DESPIDO' && (
                            <>
                              <div className="col-span-2 bg-red-50 p-4 rounded-xl border border-red-100">
                                <label className="block text-xs font-bold text-red-800 mb-1">Causal Legal a Invocar</label>
                                <input 
                                  type="text" 
                                  required 
                                  value={documentoData.causal_legal || ''} 
                                  onChange={(e) => setDocumentoData({...documentoData, causal_legal: e.target.value})} 
                                  placeholder="Ej: Artículo 161 inc. 1 (Necesidades de la Empresa)" 
                                  className="w-full px-3 py-2 rounded-lg border border-red-200 outline-none" 
                                />
                              </div>
                              <div className="col-span-2 flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <input 
                                  type="checkbox" 
                                  checked={documentoData.aviso_previo_pagado} 
                                  onChange={(e) => setDocumentoData({...documentoData, aviso_previo_pagado: e.target.checked})} 
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
                              onChange={(e) => setDocumentoData({...documentoData, hechos: e.target.value})} 
                              placeholder="Redacte detalladamente los hechos y motivos que fundamentan este documento..." 
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 resize-none"
                            ></textarea>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                )}

              </div>

              {/* FOOTER DEL PANEL */}
              <div className="px-8 py-4 border-t border-gray-200 bg-white flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                {panelMode === 'view' && activeTab === 'perfil' ? (
                  <div className="w-full flex justify-end">
                    <button onClick={() => setIsPanelOpen(false)} className="px-6 py-2.5 text-slate-700 font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">
                      Cerrar Ficha
                    </button>
                  </div>
                ) : (
                  <div className="flex w-full justify-end gap-3">
                    
                    {/* Botón Cancelar Global */}
                    {(!showDocumentoForm || activeTab !== 'legal') && (
                      <button type="button" onClick={() => { setIsPanelOpen(false); setActiveTab('perfil'); }} className="px-6 py-2.5 text-slate-600 font-semibold bg-transparent hover:bg-slate-100 rounded-xl transition-colors">
                        Cancelar
                      </button>
                    )}
                    
                    {/* BOTÓN DINÁMICO: Cambia según la pestaña y estado activo */}
                    {activeTab === 'perfil' ? (
                      <button type="submit" form="empleadoForm" disabled={!isValidRut} className="px-8 py-2.5 text-white font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-xl transition-colors shadow-md flex items-center gap-2">
                        {panelMode === 'create' ? 'Crear Trabajador' : 'Guardar Perfil'}
                      </button>
                    ) : activeTab === 'contratos' ? (
                      <button 
                        type="submit" 
                        form="contratoForm" 
                        disabled={isSavingContrato || (contratoData.tipo_jornada === 'ORDINARIA' && totalHorasCalculadas > (Number(contratoData.horas_semanales) || 44))}
                        className="px-8 py-2.5 text-white font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed rounded-xl transition-colors shadow-md flex items-center gap-2"
                      >
                        {isSavingContrato ? 'Guardando...' : 'Guardar Contrato Legal'}
                      </button>
                    ) : (activeTab === 'legal' && showDocumentoForm) ? (
                      <>
                        <button type="button" onClick={() => setShowDocumentoForm(false)} className="px-6 py-2.5 text-slate-600 font-semibold bg-transparent hover:bg-slate-100 rounded-xl transition-colors">
                          Volver al Historial
                        </button>
                        <button 
                          type="submit" 
                          form="documentoForm" 
                          disabled={isSavingDocumento} 
                          className="px-8 py-2.5 text-white font-semibold bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 rounded-xl transition-colors shadow-md flex items-center gap-2"
                        >
                          {isSavingDocumento ? 'Generando...' : 'Guardar y Generar Documento'}
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalMasivoOpen && (
        <ModalDescargaMasiva
          empleados={empleados}
          filteredEmpleados={filteredEmpleados}
          selectedEmpleadosIds={selectedEmpleadosIds}
          setSelectedEmpleadosIds={setSelectedEmpleadosIds}
          isGeneratingZip={isGeneratingZip}
          setIsGeneratingZip={setIsGeneratingZip}
          setIsModalMasivoOpen={setIsModalMasivoOpen}
        />
      )}

      {isUploadModalOpen && (
        <ModalCargaMasiva
          isUploading={isUploading}
          uploadResult={uploadResult}
          setUploadResult={setUploadResult}
          setIsUploadModalOpen={setIsUploadModalOpen}
          handleFileUpload={handleFileUpload}
          descargarPlantillaExcel={descargarPlantillaExcel}
        />
      )}


    </div>
  );
}