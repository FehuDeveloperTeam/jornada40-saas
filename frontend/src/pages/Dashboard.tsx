import { useDashboard } from '../hooks/useDashboard';
import StatsWidgets from '../components/dashboard/StatsWidgets';
import EmpleadosTable from '../components/dashboard/EmpleadosTable';
import ModalDescargaMasiva from '../components/dashboard/ModalDescargaMasiva';
import ModalCargaMasiva from '../components/dashboard/ModalCargaMasiva';
import EmpleadoPanel from '../components/dashboard/EmpleadoPanel';

export default function Dashboard() {
  const {
    // Estado de datos
    empresa, empleados, loading,
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
    isDownloading,
    isUploadModalOpen, setIsUploadModalOpen,
    uploadResult, setUploadResult,
    // Panel lateral
    isPanelOpen, setIsPanelOpen,
    panelMode, setPanelMode,
    selectedEmpleado,
    isValidRut, setIsValidRut,
    activeTab, setActiveTab,
    // Formulario empleado
    formData, setFormData,
    // Formulario contrato
    contratoData,
    isSavingContrato, hayCambiosContrato, setHayCambiosContrato,
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
    // Anexos de contrato
    anexosContrato,
    showAnexoContratoForm, setShowAnexoContratoForm,
    isSavingAnexoContrato,
    anexoContratoData, setAnexoContratoData,
    // Widgets BI
    flippedWidgets,
    // Handlers
    handleSelectAll, handleSelectEmpleado,
    descargarPlantillaExcel,
    handleFileUpload,
    abrirVer, abrirEditar, abrirCrear,
    handleInputChange, handleContratoChange,
    guardarEmpleado, guardarContrato, guardarDocumentoLegal, guardarAnexoContrato,
    descargarAnexoContratoPDF,
    calcularValorHorasExtras,
    generarLiquidacion,
    descargarLiquidacionPDF, descargarDocumentoPDF,
    generarContratoPDF, descargarContratoGuardado,
    generarAnexo40hPDF, descargarAnexo40hGuardado,
    isGeneratingContratoPDF, isGeneratingAnexo40hPDF,
    toggleWidget, toggleArrayItem, toggleSelectAll,
    volverAlLobby,
    empresaActivaId,
  } = useDashboard();


  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#060f20' }}>
      <div className="w-12 h-12 border-2 rounded-full animate-spin"
        style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#2563eb' }} />
    </div>
  );

  return (
    <div className="p-6 md:p-10 min-h-screen font-sans flex" style={{ background: '#060f20' }} onClick={() => setOpenFilterDropdown(null)}>
      <div className={`max-w-7xl mx-auto w-full min-w-0 transition-all duration-300 ${isPanelOpen ? 'md:mr-[900px]' : ''}`}>

        <div className="flex justify-between items-center mb-8">
          <button onClick={volverAlLobby}
            className="flex items-center gap-2 text-sm font-medium transition-colors group"
            style={{ color: 'rgba(255,255,255,0.4)' }}>
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
            <span className="group-hover:text-white transition-colors">Cambiar de Empresa</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
              {empresa?.nombre_legal?.charAt(0)?.toUpperCase() || 'E'}
            </div>
          </div>
        </div>

        <div className="rounded-3xl p-7 mb-8 glass-card">
          <h1 className="text-2xl font-bold text-white tracking-tight">{empresa?.nombre_legal}</h1>
          <div className="flex gap-3 mt-3 text-sm font-medium">
            <span className="px-3 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
              RUT: {empresa?.rut}
            </span>
            {empresa?.giro && (
              <span className="px-3 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                Giro: {empresa.giro}
              </span>
            )}
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
          isDownloading={isDownloading}
          handleSelectAll={handleSelectAll}
          handleSelectEmpleado={handleSelectEmpleado}
          toggleArrayItem={toggleArrayItem}
          toggleSelectAll={toggleSelectAll}
          abrirVer={abrirVer}
          abrirEditar={abrirEditar}
          abrirCrear={abrirCrear}
          setIsModalMasivoOpen={setIsModalMasivoOpen}
          setIsUploadModalOpen={setIsUploadModalOpen}
        />

      {/* === SLIDE-OVER PANEL LATERAL === */}
      {isPanelOpen && (
        <EmpleadoPanel
          setIsPanelOpen={setIsPanelOpen}
          panelMode={panelMode}
          setPanelMode={setPanelMode}
          selectedEmpleado={selectedEmpleado}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isValidRut={isValidRut}
          setIsValidRut={setIsValidRut}
          formData={formData}
          setFormData={setFormData}
          isSavingContrato={isSavingContrato}
          contratoData={contratoData}
          totalHorasCalculadas={totalHorasCalculadas}
          showDocumentoForm={showDocumentoForm}
          setShowDocumentoForm={setShowDocumentoForm}
          isSavingDocumento={isSavingDocumento}
          handleInputChange={handleInputChange}
          guardarEmpleado={guardarEmpleado}
          handleContratoChange={handleContratoChange}
          guardarContrato={guardarContrato}
          setHayCambiosContrato={setHayCambiosContrato}
          funciones={funciones}
          setFunciones={setFunciones}
          clausulas={clausulas}
          setClausulas={setClausulas}
          horario={horario}
          setHorario={setHorario}
          hayCambiosContrato={hayCambiosContrato}
          generarContratoPDF={generarContratoPDF}
          descargarContratoGuardado={descargarContratoGuardado}
          generarAnexo40hPDF={generarAnexo40hPDF}
          descargarAnexo40hGuardado={descargarAnexo40hGuardado}
          isGeneratingContratoPDF={isGeneratingContratoPDF}
          isGeneratingAnexo40hPDF={isGeneratingAnexo40hPDF}
          anexosContrato={anexosContrato}
          showAnexoContratoForm={showAnexoContratoForm}
          setShowAnexoContratoForm={setShowAnexoContratoForm}
          isSavingAnexoContrato={isSavingAnexoContrato}
          anexoContratoData={anexoContratoData}
          setAnexoContratoData={setAnexoContratoData}
          guardarAnexoContrato={guardarAnexoContrato}
          descargarAnexoContratoPDF={descargarAnexoContratoPDF}
          liquidaciones={liquidaciones}
          showLiqForm={showLiqForm}
          setShowLiqForm={setShowLiqForm}
          expandedLiqId={expandedLiqId}
          setExpandedLiqId={setExpandedLiqId}
          liqMes={liqMes}
          setLiqMes={setLiqMes}
          liqAnio={liqAnio}
          setLiqAnio={setLiqAnio}
          liqDiasTrabajados={liqDiasTrabajados}
          setLiqDiasTrabajados={setLiqDiasTrabajados}
          liqAusencias={liqAusencias}
          setLiqAusencias={setLiqAusencias}
          haberesImponiblesList={haberesImponiblesList}
          setHaberesImponiblesList={setHaberesImponiblesList}
          haberesNoImponiblesList={haberesNoImponiblesList}
          setHaberesNoImponiblesList={setHaberesNoImponiblesList}
          horasExtrasList={horasExtrasList}
          setHorasExtrasList={setHorasExtrasList}
          isGeneratingLiq={isGeneratingLiq}
          generarLiquidacion={generarLiquidacion}
          descargarLiquidacionPDF={descargarLiquidacionPDF}
          calcularValorHorasExtras={calcularValorHorasExtras}
          documentosLegales={documentosLegales}
          documentoData={documentoData}
          setDocumentoData={setDocumentoData}
          guardarDocumentoLegal={guardarDocumentoLegal}
          descargarDocumentoPDF={descargarDocumentoPDF}
        />
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
          empresaActivaId={empresaActivaId}
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
    </div>
  );
}