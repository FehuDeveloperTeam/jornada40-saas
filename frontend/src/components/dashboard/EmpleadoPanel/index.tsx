import type { UseDashboardReturn } from '../../../hooks/useDashboard';
import TabPerfil from './TabPerfil';
import TabContratos from './TabContratos';
import TabLiquidaciones from './TabLiquidaciones';
import TabLegal from './TabLegal';

type Props = {
  setIsPanelOpen: UseDashboardReturn['setIsPanelOpen'];
  panelMode: UseDashboardReturn['panelMode'];
  setPanelMode: UseDashboardReturn['setPanelMode'];
  selectedEmpleado: UseDashboardReturn['selectedEmpleado'];
  activeTab: UseDashboardReturn['activeTab'];
  setActiveTab: UseDashboardReturn['setActiveTab'];
  isValidRut: UseDashboardReturn['isValidRut'];
  setIsValidRut: UseDashboardReturn['setIsValidRut'];
  formData: UseDashboardReturn['formData'];
  setFormData: UseDashboardReturn['setFormData'];
  isSavingContrato: UseDashboardReturn['isSavingContrato'];
  contratoData: UseDashboardReturn['contratoData'];
  totalHorasCalculadas: UseDashboardReturn['totalHorasCalculadas'];
  showDocumentoForm: UseDashboardReturn['showDocumentoForm'];
  setShowDocumentoForm: UseDashboardReturn['setShowDocumentoForm'];
  isSavingDocumento: UseDashboardReturn['isSavingDocumento'];
  // Tab: Perfil
  handleInputChange: UseDashboardReturn['handleInputChange'];
  guardarEmpleado: UseDashboardReturn['guardarEmpleado'];
  // Tab: Contratos
  handleContratoChange: UseDashboardReturn['handleContratoChange'];
  guardarContrato: UseDashboardReturn['guardarContrato'];
  setHayCambiosContrato: UseDashboardReturn['setHayCambiosContrato'];
  funciones: UseDashboardReturn['funciones'];
  setFunciones: UseDashboardReturn['setFunciones'];
  clausulas: UseDashboardReturn['clausulas'];
  setClausulas: UseDashboardReturn['setClausulas'];
  horario: UseDashboardReturn['horario'];
  setHorario: UseDashboardReturn['setHorario'];
  hayCambiosContrato: UseDashboardReturn['hayCambiosContrato'];
  generarContratoPDF: UseDashboardReturn['generarContratoPDF'];
  descargarContratoGuardado: UseDashboardReturn['descargarContratoGuardado'];
  generarAnexo40hPDF: UseDashboardReturn['generarAnexo40hPDF'];
  descargarAnexo40hGuardado: UseDashboardReturn['descargarAnexo40hGuardado'];
  isGeneratingContratoPDF: UseDashboardReturn['isGeneratingContratoPDF'];
  isGeneratingAnexo40hPDF: UseDashboardReturn['isGeneratingAnexo40hPDF'];
  anexosContrato: UseDashboardReturn['anexosContrato'];
  showAnexoContratoForm: UseDashboardReturn['showAnexoContratoForm'];
  setShowAnexoContratoForm: UseDashboardReturn['setShowAnexoContratoForm'];
  isSavingAnexoContrato: UseDashboardReturn['isSavingAnexoContrato'];
  anexoContratoData: UseDashboardReturn['anexoContratoData'];
  setAnexoContratoData: UseDashboardReturn['setAnexoContratoData'];
  guardarAnexoContrato: UseDashboardReturn['guardarAnexoContrato'];
  descargarAnexoContratoPDF: UseDashboardReturn['descargarAnexoContratoPDF'];
  // Tab: Liquidaciones
  liquidaciones: UseDashboardReturn['liquidaciones'];
  showLiqForm: UseDashboardReturn['showLiqForm'];
  setShowLiqForm: UseDashboardReturn['setShowLiqForm'];
  expandedLiqId: UseDashboardReturn['expandedLiqId'];
  setExpandedLiqId: UseDashboardReturn['setExpandedLiqId'];
  liqMes: UseDashboardReturn['liqMes'];
  setLiqMes: UseDashboardReturn['setLiqMes'];
  liqAnio: UseDashboardReturn['liqAnio'];
  setLiqAnio: UseDashboardReturn['setLiqAnio'];
  liqDiasTrabajados: UseDashboardReturn['liqDiasTrabajados'];
  setLiqDiasTrabajados: UseDashboardReturn['setLiqDiasTrabajados'];
  liqAusencias: UseDashboardReturn['liqAusencias'];
  setLiqAusencias: UseDashboardReturn['setLiqAusencias'];
  haberesImponiblesList: UseDashboardReturn['haberesImponiblesList'];
  setHaberesImponiblesList: UseDashboardReturn['setHaberesImponiblesList'];
  haberesNoImponiblesList: UseDashboardReturn['haberesNoImponiblesList'];
  setHaberesNoImponiblesList: UseDashboardReturn['setHaberesNoImponiblesList'];
  horasExtrasList: UseDashboardReturn['horasExtrasList'];
  setHorasExtrasList: UseDashboardReturn['setHorasExtrasList'];
  isGeneratingLiq: UseDashboardReturn['isGeneratingLiq'];
  generarLiquidacion: UseDashboardReturn['generarLiquidacion'];
  descargarLiquidacionPDF: UseDashboardReturn['descargarLiquidacionPDF'];
  calcularValorHorasExtras: UseDashboardReturn['calcularValorHorasExtras'];
  // Tab: Legal
  documentosLegales: UseDashboardReturn['documentosLegales'];
  documentoData: UseDashboardReturn['documentoData'];
  setDocumentoData: UseDashboardReturn['setDocumentoData'];
  guardarDocumentoLegal: UseDashboardReturn['guardarDocumentoLegal'];
  descargarDocumentoPDF: UseDashboardReturn['descargarDocumentoPDF'];
  // Firma electrónica
  solicitudesFirma: UseDashboardReturn['solicitudesFirma'];
  isSendingFirma: UseDashboardReturn['isSendingFirma'];
  enviarAFirma: UseDashboardReturn['enviarAFirma'];
  cancelarFirma: UseDashboardReturn['cancelarFirma'];
  reenviarFirma: UseDashboardReturn['reenviarFirma'];
};

export default function EmpleadoPanel({
  setIsPanelOpen, panelMode, setPanelMode, selectedEmpleado,
  activeTab, setActiveTab, isValidRut, setIsValidRut, formData, setFormData,
  isSavingContrato, contratoData, totalHorasCalculadas,
  showDocumentoForm, setShowDocumentoForm, isSavingDocumento,
  handleInputChange, guardarEmpleado,
  handleContratoChange, guardarContrato, setHayCambiosContrato,
  funciones, setFunciones, clausulas, setClausulas, horario, setHorario,
  hayCambiosContrato,
  generarContratoPDF, descargarContratoGuardado,
  generarAnexo40hPDF, descargarAnexo40hGuardado,
  isGeneratingContratoPDF, isGeneratingAnexo40hPDF,
  anexosContrato, showAnexoContratoForm, setShowAnexoContratoForm,
  isSavingAnexoContrato, anexoContratoData, setAnexoContratoData,
  guardarAnexoContrato, descargarAnexoContratoPDF,
  liquidaciones, showLiqForm, setShowLiqForm, expandedLiqId, setExpandedLiqId,
  liqMes, setLiqMes, liqAnio, setLiqAnio,
  liqDiasTrabajados, setLiqDiasTrabajados, liqAusencias, setLiqAusencias,
  haberesImponiblesList, setHaberesImponiblesList,
  haberesNoImponiblesList, setHaberesNoImponiblesList,
  horasExtrasList, setHorasExtrasList,
  isGeneratingLiq, generarLiquidacion, descargarLiquidacionPDF, calcularValorHorasExtras,
  documentosLegales, documentoData, setDocumentoData, guardarDocumentoLegal, descargarDocumentoPDF,
  solicitudesFirma, isSendingFirma, enviarAFirma, cancelarFirma, reenviarFirma,
}: Props) {
  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={(e) => { e.stopPropagation(); setIsPanelOpen(false); }}
      />

      <div className="absolute inset-y-0 right-0 max-w-4xl w-full flex shadow-2xl">
        <div className="h-full w-full flex flex-col" style={{ background: '#0c1a35', borderLeft: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>

          {/* HEADER */}
          <div className="px-6 py-5 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3 min-w-0">
              {panelMode !== 'create' && selectedEmpleado ? (
                <div className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-lg font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                  {selectedEmpleado.nombres?.charAt(0) || ''}{selectedEmpleado.apellido_paterno?.charAt(0) || ''}
                </div>
              ) : (
                <div className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-xl font-bold"
                  style={{ background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.3)', color: '#60a5fa' }}>
                  +
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white tracking-tight truncate">
                  {panelMode === 'create' ? 'Nuevo Trabajador' : `${selectedEmpleado?.nombres} ${selectedEmpleado?.apellido_paterno}`}
                </h2>
                {panelMode !== 'create' && selectedEmpleado && (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{selectedEmpleado.cargo}</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                    <span className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{selectedEmpleado.rut}</span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold tracking-wide"
                      style={selectedEmpleado.activo
                        ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }
                        : { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                      {selectedEmpleado.activo ? 'VIGENTE' : 'DESVINCULADO'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setIsPanelOpen(false)}
              className="p-2 rounded-lg transition-colors shrink-0"
              style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)' }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* TABS NAV */}
          {panelMode !== 'create' && (
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <nav className="flex gap-0 overflow-x-auto px-4">
                {[
                  { id: 'perfil', label: 'Datos Generales' },
                  { id: 'contratos', label: 'Contratos y Anexos' },
                  { id: 'liquidaciones', label: 'Liquidaciones' },
                  { id: 'legal', label: 'Historial Legal' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'perfil' | 'contratos' | 'liquidaciones' | 'legal')}
                    className="py-3.5 px-4 text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0"
                    style={{
                      borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                      color: activeTab === tab.id ? '#60a5fa' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* BODY */}
          <div className="flex-1 overflow-y-auto p-7" style={{ background: '#0c1a35' }}>
            {activeTab === 'perfil' && (
              <TabPerfil
                panelMode={panelMode}
                selectedEmpleado={selectedEmpleado}
                formData={formData}
                isValidRut={isValidRut}
                handleInputChange={handleInputChange}
                guardarEmpleado={guardarEmpleado}
                setPanelMode={setPanelMode}
                setFormData={setFormData}
                setIsValidRut={setIsValidRut}
              />
            )}
            {activeTab === 'contratos' && (
              <TabContratos
                contratoData={contratoData}
                handleContratoChange={handleContratoChange}
                guardarContrato={guardarContrato}
                setHayCambiosContrato={setHayCambiosContrato}
                funciones={funciones}
                setFunciones={setFunciones}
                clausulas={clausulas}
                setClausulas={setClausulas}
                horario={horario}
                setHorario={setHorario}
                totalHorasCalculadas={totalHorasCalculadas}
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
                solicitudesFirma={solicitudesFirma}
                isSendingFirma={isSendingFirma}
                enviarAFirma={enviarAFirma}
                cancelarFirma={cancelarFirma}
                reenviarFirma={reenviarFirma}
              />
            )}
            {activeTab === 'liquidaciones' && (
              <TabLiquidaciones
                selectedEmpleado={selectedEmpleado}
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
              />
            )}
            {activeTab === 'legal' && (
              <TabLegal
                selectedEmpleado={selectedEmpleado}
                documentosLegales={documentosLegales}
                showDocumentoForm={showDocumentoForm}
                setShowDocumentoForm={setShowDocumentoForm}
                documentoData={documentoData}
                setDocumentoData={setDocumentoData}
                guardarDocumentoLegal={guardarDocumentoLegal}
                isSavingDocumento={isSavingDocumento}
                descargarDocumentoPDF={descargarDocumentoPDF}
                solicitudesFirma={solicitudesFirma}
                isSendingFirma={isSendingFirma}
                enviarAFirma={enviarAFirma}
                cancelarFirma={cancelarFirma}
                reenviarFirma={reenviarFirma}
              />
            )}
          </div>

          {/* FOOTER */}
          {!(panelMode === 'view' && activeTab === 'perfil') && (
            <div className="px-8 py-4 flex justify-between items-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: '#0c1a35' }}>
              <div className="flex w-full justify-end gap-3">
                {(!showDocumentoForm || activeTab !== 'legal') && (
                  <button type="button" onClick={() => setIsPanelOpen(false)}
                    className="px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                    style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
                    Cerrar
                  </button>
                )}
                {activeTab === 'perfil' ? (
                  <button type="submit" form="empleadoForm" disabled={!isValidRut}
                    className="px-8 py-2.5 text-sm text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                    style={{ background: isValidRut ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'rgba(37,99,235,0.3)', cursor: isValidRut ? 'pointer' : 'not-allowed' }}>
                    {panelMode === 'create' ? 'Crear Trabajador' : 'Guardar Perfil'}
                  </button>
                ) : activeTab === 'contratos' ? (
                  <button
                    type="submit"
                    form="contratoForm"
                    disabled={isSavingContrato || (contratoData.tipo_jornada === 'ORDINARIA' && totalHorasCalculadas > (Number(contratoData.horas_semanales) || 44))}
                    className="px-8 py-2.5 text-sm text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                  >
                    {isSavingContrato ? 'Guardando...' : 'Guardar Contrato'}
                  </button>
                ) : (activeTab === 'legal' && showDocumentoForm) ? (
                  <>
                    <button type="button" onClick={() => setShowDocumentoForm(false)}
                      className="px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                      style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
                      Volver al Historial
                    </button>
                    <button
                      type="submit"
                      form="documentoForm"
                      disabled={isSavingDocumento}
                      className="px-8 py-2.5 text-sm text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                    >
                      {isSavingDocumento ? 'Generando...' : 'Guardar y Generar Documento'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
