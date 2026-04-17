import { useCallback } from 'react';
import client from '../api/client';
import { defaultHorario } from '../types/dashboard';
import type { DashboardEmpleado } from '../types/dashboard';

import { useEmpleados } from '../hooks/useEmpleados';
import { useEmpleadoPanel } from '../hooks/useEmpleadoPanel';
import { useContratoForm } from '../hooks/useContratoForm';
import { useLiquidaciones } from '../hooks/useLiquidaciones';
import { useLegalDocs } from '../hooks/useLegalDocs';

import StatsWidgets from '../components/dashboard/StatsWidgets';
import BulkActions from '../components/dashboard/BulkActions';
import EmpleadoTable from '../components/empleados/EmpleadoTable';
import EmpleadoPanel from '../components/empleados/EmpleadoPanel';

export default function Dashboard() {
  const emp = useEmpleados();
  const panel = useEmpleadoPanel(emp.empresaActivaId);
  const contrato = useContratoForm();
  const liq = useLiquidaciones(panel.selectedEmpleado);
  const legal = useLegalDocs(panel.selectedEmpleado);

  const fetchContratoYDocumentos = useCallback(async (empleadoId: number) => {
    try {
      const resContrato = await client.get(`/contratos/?empleado=${empleadoId}`);
      if (resContrato.data && resContrato.data.length > 0) {
        const c = resContrato.data[0];
        contrato.setContratoData(c);
        contrato.setFunciones(c.funciones_especificas || []);
        contrato.setClausulas(c.clausulas_especiales || []);
        if (c.distribucion_horario && Object.keys(c.distribucion_horario).length > 0) {
          contrato.setHorario(c.distribucion_horario);
        } else {
          contrato.setHorario(defaultHorario);
        }
      } else {
        const empleado = emp.empleados.find(e => e.id === empleadoId);
        contrato.setContratoData({
          empleado: empleadoId,
          tipo_contrato: 'INDEFINIDO',
          tipo_jornada: 'ORDINARIA',
          cargo: empleado?.cargo || 'NO ESPECIFICADO',
          sueldo_base: empleado?.sueldo_base || 0,
          horas_semanales: 44,
          distribucion_dias: 5,
          fecha_inicio: empleado?.fecha_ingreso || new Date().toISOString().split('T')[0],
          tiene_colacion_imputable: false,
          dia_pago: 5,
          gratificacion_legal: 'MENSUAL',
          tiene_quincena: false,
        });
        contrato.setFunciones([]);
        contrato.setClausulas([]);
        contrato.setHorario(defaultHorario);
      }
      contrato.setHayCambiosContrato(false);

      const resDocs = await client.get(`/documentos_legales/?empleado=${empleadoId}`);
      legal.setDocumentosLegales(resDocs.data);
      legal.setShowDocumentoForm(false);

      const resLiq = await client.get(`/liquidaciones/?empleado=${empleadoId}`);
      liq.setLiquidaciones(resLiq.data);
      liq.setShowLiqForm(false);
    } catch (error) {
      console.error("Error al cargar datos del panel:", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp.empleados]);

  const abrirVer = (e: DashboardEmpleado) => panel.abrirVer(e, fetchContratoYDocumentos);
  const abrirEditar = (e: DashboardEmpleado) => panel.abrirEditar(e, fetchContratoYDocumentos);

  const handleGuardarEmpleado = (e: React.FormEvent) => {
    panel.guardarEmpleado(e, {
      contratoId: contrato.contratoData.id,
      onSuccess: () => { emp.fetchData(); },
    });
  };

  if (emp.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="p-6 md:p-10 bg-gray-50 min-h-screen font-sans flex"
      onClick={() => emp.setOpenFilterDropdown(null)}
    >
      <div className={`max-w-7xl mx-auto w-full transition-all duration-300 ${panel.isPanelOpen ? 'md:mr-[450px]' : ''}`}>

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={emp.volverAlLobby}
            className="text-gray-500 hover:text-gray-900 flex items-center gap-2 font-medium transition-colors"
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Cambiar de Empresa
          </button>
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
            {emp.empresa?.nombre_legal?.charAt(0)?.toUpperCase() || 'E'}
          </div>
        </div>

        {/* EMPRESA CARD */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{emp.empresa?.nombre_legal}</h1>
          <div className="flex gap-4 mt-3 text-sm text-gray-500 font-medium">
            <span className="bg-gray-100 px-3 py-1 rounded-lg">RUT: {emp.empresa?.rut}</span>
            {emp.empresa?.giro && <span className="bg-gray-100 px-3 py-1 rounded-lg">Giro: {emp.empresa.giro}</span>}
          </div>
        </div>

        {/* STATS */}
        {emp.stats && (
          <StatsWidgets
            stats={emp.stats}
            flippedWidgets={emp.flippedWidgets}
            toggleWidget={emp.toggleWidget}
          />
        )}

        {/* ACCIONES MASIVAS */}
        <BulkActions
          selectedEmpleadosIds={emp.selectedEmpleadosIds}
          isDownloadMenuOpen={emp.isDownloadMenuOpen}
          setIsDownloadMenuOpen={emp.setIsDownloadMenuOpen}
          isDownloading={emp.isDownloading}
          ejecutarDescargaMasiva={emp.ejecutarDescargaMasiva}
          setIsUploadModalOpen={emp.setIsUploadModalOpen}
          setIsModalMasivoOpen={emp.setIsModalMasivoOpen}
          abrirCrear={panel.abrirCrear}
          isModalMasivoOpen={emp.isModalMasivoOpen}
          empleados={emp.empleados}
          filteredEmpleados={emp.filteredEmpleados}
          setSelectedEmpleadosIds={emp.setSelectedEmpleadosIds}
          isGeneratingZip={emp.isGeneratingZip}
          setIsGeneratingZip={emp.setIsGeneratingZip}
          onCloseModalMasivo={() => emp.setIsModalMasivoOpen(false)}
          isUploadModalOpen={emp.isUploadModalOpen}
          isUploading={emp.isUploading}
          uploadResult={emp.uploadResult}
          setUploadResult={emp.setUploadResult}
          handleFileUpload={emp.handleFileUpload}
          descargarPlantillaExcel={emp.descargarPlantillaExcel}
          onCloseUploadModal={() => emp.setIsUploadModalOpen(false)}
        />

        {/* TABLA */}
        <EmpleadoTable
          empleados={emp.empleados}
          filteredEmpleados={emp.filteredEmpleados}
          selectedEmpleadosIds={emp.selectedEmpleadosIds}
          downloadingId={emp.downloadingId}
          searchTerm={emp.searchTerm}
          setSearchTerm={emp.setSearchTerm}
          openFilterDropdown={emp.openFilterDropdown}
          setOpenFilterDropdown={emp.setOpenFilterDropdown}
          selectedCargos={emp.selectedCargos}
          setSelectedCargos={emp.setSelectedCargos}
          selectedDeptos={emp.selectedDeptos}
          setSelectedDeptos={emp.setSelectedDeptos}
          selectedStatuses={emp.selectedStatuses}
          setSelectedStatuses={emp.setSelectedStatuses}
          allCargos={emp.allCargos}
          allDeptos={emp.allDeptos}
          handleSelectAll={emp.handleSelectAll}
          handleSelectEmpleado={emp.handleSelectEmpleado}
          generarYDescargarPDF={emp.generarYDescargarPDF}
          abrirVer={abrirVer}
          abrirEditar={abrirEditar}
        />
      </div>

      {/* PANEL LATERAL */}
      <EmpleadoPanel
        isPanelOpen={panel.isPanelOpen}
        setIsPanelOpen={panel.setIsPanelOpen}
        panelMode={panel.panelMode}
        setPanelMode={panel.setPanelMode}
        selectedEmpleado={panel.selectedEmpleado}
        activeTab={panel.activeTab}
        setActiveTab={panel.setActiveTab}
        formData={panel.formData}
        setFormData={panel.setFormData}
        isValidRut={panel.isValidRut}
        setIsValidRut={panel.setIsValidRut}
        handleInputChange={panel.handleInputChange}
        guardarEmpleado={handleGuardarEmpleado}
        contratoData={contrato.contratoData}
        funciones={contrato.funciones}
        setFunciones={contrato.setFunciones}
        clausulas={contrato.clausulas}
        setClausulas={contrato.setClausulas}
        horario={contrato.horario}
        setHorario={contrato.setHorario}
        totalHorasCalculadas={contrato.totalHorasCalculadas}
        hayCambiosContrato={contrato.hayCambiosContrato}
        setHayCambiosContrato={contrato.setHayCambiosContrato}
        isSavingContrato={contrato.isSavingContrato}
        handleContratoChange={contrato.handleContratoChange}
        guardarContrato={contrato.guardarContrato}
        descargarContratoPDF={() => contrato.descargarContratoPDF(panel.selectedEmpleado?.rut || '')}
        descargarAnexoPDF={() => contrato.descargarAnexoPDF(panel.selectedEmpleado?.rut || '')}
        liquidaciones={liq.liquidaciones}
        showLiqForm={liq.showLiqForm}
        setShowLiqForm={liq.setShowLiqForm}
        isGeneratingLiq={liq.isGeneratingLiq}
        expandedLiqId={liq.expandedLiqId}
        setExpandedLiqId={liq.setExpandedLiqId}
        liqMes={liq.liqMes}
        setLiqMes={liq.setLiqMes}
        liqAnio={liq.liqAnio}
        setLiqAnio={liq.setLiqAnio}
        liqDiasTrabajados={liq.liqDiasTrabajados}
        setLiqDiasTrabajados={liq.setLiqDiasTrabajados}
        liqAusencias={liq.liqAusencias}
        setLiqAusencias={liq.setLiqAusencias}
        haberesImponiblesList={liq.haberesImponiblesList}
        setHaberesImponiblesList={liq.setHaberesImponiblesList}
        haberesNoImponiblesList={liq.haberesNoImponiblesList}
        setHaberesNoImponiblesList={liq.setHaberesNoImponiblesList}
        horasExtrasList={liq.horasExtrasList}
        setHorasExtrasList={liq.setHorasExtrasList}
        calcularValorHorasExtras={liq.calcularValorHorasExtras}
        generarLiquidacion={liq.generarLiquidacion}
        descargarLiquidacionPDF={liq.descargarLiquidacionPDF}
        documentosLegales={legal.documentosLegales}
        documentoData={legal.documentoData}
        setDocumentoData={legal.setDocumentoData}
        showDocumentoForm={legal.showDocumentoForm}
        setShowDocumentoForm={legal.setShowDocumentoForm}
        isSavingDocumento={legal.isSavingDocumento}
        guardarDocumentoLegal={legal.guardarDocumentoLegal}
        descargarDocumentoPDF={legal.descargarDocumentoPDF}
      />
    </div>
  );
}
