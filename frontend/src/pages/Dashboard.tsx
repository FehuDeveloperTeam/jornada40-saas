import { useDashboard } from '../hooks/useDashboard';
import StatsWidgets from '../components/dashboard/StatsWidgets';
import EmpleadosTable from '../components/dashboard/EmpleadosTable';
import ModalDescargaMasiva from '../components/dashboard/ModalDescargaMasiva';
import ModalCargaMasiva from '../components/dashboard/ModalCargaMasiva';
import EmpleadoPanel from '../components/dashboard/EmpleadoPanel';

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
    panelMode, setPanelMode,
    selectedEmpleado,
    isValidRut, setIsValidRut,
    activeTab, setActiveTab,
    // Formulario empleado
    formData, setFormData,
    // Formulario contrato
    contratoData, setContratoData,
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
    ejecutarDescargaMasiva,
    descargarPlantillaExcel,
    handleFileUpload,
    abrirVer, abrirEditar, abrirCrear,
    handleInputChange, handleContratoChange,
    guardarEmpleado, guardarContrato, guardarDocumentoLegal, guardarAnexoContrato,
    descargarAnexoContratoPDF,
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
          descargarContratoPDF={descargarContratoPDF}
          descargarAnexoPDF={descargarAnexoPDF}
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
  );
}