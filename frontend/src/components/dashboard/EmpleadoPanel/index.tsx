import type { UseDashboardReturn } from '../../../hooks/useDashboard';
import type { SolicitudFirma } from '../../../types';
import TabPerfil from './TabPerfil';
import TabContratos from './TabContratos';
import TabLiquidaciones from './TabLiquidaciones';
import TabLegal from './TabLegal';
import TabVacaciones from './TabVacaciones';
import TabFiniquito from './TabFiniquito';
import TabHistorialSalarial from './TabHistorialSalarial';

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
  onVerDetalleFirma: (s: SolicitudFirma) => void;
  // Digitalización
  isDigitalizando: UseDashboardReturn['isDigitalizando'];
  digitalizarContrato: UseDashboardReturn['digitalizarContrato'];
  // Tab: Vacaciones
  vacaciones: UseDashboardReturn['vacaciones'];
  saldoVacaciones: UseDashboardReturn['saldoVacaciones'];
  showVacacionForm: UseDashboardReturn['showVacacionForm'];
  setShowVacacionForm: UseDashboardReturn['setShowVacacionForm'];
  vacacionData: UseDashboardReturn['vacacionData'];
  setVacacionData: UseDashboardReturn['setVacacionData'];
  guardarVacacion: UseDashboardReturn['guardarVacacion'];
  isSavingVacacion: UseDashboardReturn['isSavingVacacion'];
  descargarVacacionPDF: UseDashboardReturn['descargarVacacionPDF'];
  // Tab: Finiquito
  finiquitos: UseDashboardReturn['finiquitos'];
  showFiniquitoForm: UseDashboardReturn['showFiniquitoForm'];
  setShowFiniquitoForm: UseDashboardReturn['setShowFiniquitoForm'];
  finiquitoData: UseDashboardReturn['finiquitoData'];
  setFiniquitoData: UseDashboardReturn['setFiniquitoData'];
  guardarFiniquito: UseDashboardReturn['guardarFiniquito'];
  isSavingFiniquito: UseDashboardReturn['isSavingFiniquito'];
  descargarFiniquitoPDF: UseDashboardReturn['descargarFiniquitoPDF'];
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
  onVerDetalleFirma,
  isDigitalizando, digitalizarContrato,
  vacaciones, saldoVacaciones,
  showVacacionForm, setShowVacacionForm,
  vacacionData, setVacacionData,
  guardarVacacion, isSavingVacacion, descargarVacacionPDF,
  finiquitos,
  showFiniquitoForm, setShowFiniquitoForm,
  finiquitoData, setFiniquitoData,
  guardarFiniquito, isSavingFiniquito, descargarFiniquitoPDF,
}: Props) {
  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      <div
        className="absolute inset-0 backdrop-blur-sm transition-opacity"
        style={{ background: 'var(--c-overlay)' }}
        onClick={(e) => { e.stopPropagation(); setIsPanelOpen(false); }}
      />

      <div className="absolute inset-y-0 right-0 max-w-4xl w-full flex shadow-2xl">
        <div className="h-full w-full flex flex-col" style={{ background: 'var(--c-bg-modal)', borderLeft: '1px solid var(--c-border)' }} onClick={(e) => e.stopPropagation()}>

          {/* HEADER */}
          <div className="px-6 py-5 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid var(--c-border)' }}>
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
                <h2 className="text-lg font-bold tracking-tight truncate" style={{ color: 'var(--c-text-1)' }}>
                  {panelMode === 'create' ? 'Nuevo Trabajador' : `${selectedEmpleado?.nombres} ${selectedEmpleado?.apellido_paterno}`}
                </h2>
                {panelMode !== 'create' && selectedEmpleado && (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-sm" style={{ color: 'var(--c-text-2)' }}>{selectedEmpleado.cargo}</span>
                    <span style={{ color: 'var(--c-text-4)' }}>•</span>
                    <span className="font-mono text-sm" style={{ color: 'var(--c-text-3)' }}>{selectedEmpleado.rut}</span>
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
              style={{ color: 'var(--c-text-3)', background: 'var(--c-bg-input)' }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* BANNER RECHAZOS */}
          {panelMode !== 'create' && (() => {
            const TAB_POR_TIPO: Record<string, string> = {
              CONTRATO: 'contratos', ANEXO_40H: 'contratos', ANEXO_CONTRATO: 'contratos',
              AMONESTACION: 'legal', DESPIDO: 'legal', CONSTANCIA: 'legal',
              LIQUIDACION: 'liquidaciones', VACACION: 'vacaciones',
              FINIQUITO: 'finiquito',
            };
            const LABEL_POR_TIPO: Record<string, string> = {
              CONTRATO: 'Contrato', ANEXO_40H: 'Anexo 40H', ANEXO_CONTRATO: 'Anexo de Contrato',
              AMONESTACION: 'Amonestación', DESPIDO: 'Carta de Despido', CONSTANCIA: 'Constancia',
              LIQUIDACION: 'Liquidación', VACACION: 'Vacación', FINIQUITO: 'Finiquito',
            };
            const rechazados = solicitudesFirma.filter(s => s.estado === 'RECHAZADO');
            if (rechazados.length === 0) return null;
            const tiposUnicos = [...new Set(rechazados.map(s => s.tipo_documento))];
            return (
              <div
                className="px-6 py-3 flex items-center gap-3 flex-wrap shrink-0"
                style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.18)' }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0" style={{ color: '#f87171' }}>
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-semibold shrink-0" style={{ color: '#fca5a5' }}>
                  {rechazados.length === 1 ? 'Documento rechazado:' : `${rechazados.length} documentos rechazados:`}
                </span>
                <div className="flex gap-2 flex-wrap">
                  {tiposUnicos.map(tipo => (
                    <button
                      key={tipo}
                      onClick={() => setActiveTab(TAB_POR_TIPO[tipo] as 'perfil' | 'contratos' | 'liquidaciones' | 'legal' | 'vacaciones' | 'finiquito')}
                      className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.28)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#fca5a5'; }}
                    >
                      {LABEL_POR_TIPO[tipo] ?? tipo} →
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* TABS NAV */}
          {panelMode !== 'create' && (
            <div style={{ borderBottom: '1px solid var(--c-border)' }}>
              <nav className="flex gap-0 overflow-x-auto px-4">
                {[
                  { id: 'perfil', label: 'Datos Generales' },
                  { id: 'contratos', label: 'Contratos y Anexos' },
                  { id: 'liquidaciones', label: 'Liquidaciones' },
                  { id: 'historial', label: 'Historial Salarial' },
                  { id: 'legal', label: 'Historial Legal' },
                  { id: 'vacaciones', label: 'Vacaciones' },
                  { id: 'finiquito', label: 'Finiquito' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'perfil' | 'contratos' | 'liquidaciones' | 'legal' | 'vacaciones' | 'finiquito')}

                    className="py-3.5 px-4 text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0"
                    style={{
                      borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                      color: activeTab === tab.id ? '#60a5fa' : 'var(--c-text-3)',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* BODY */}
          <div className="flex-1 overflow-y-auto p-7" style={{ background: 'var(--c-bg-modal)' }}>
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
                onVerDetalleFirma={onVerDetalleFirma}
                isDigitalizando={isDigitalizando}
                digitalizarContrato={digitalizarContrato}
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
                solicitudesFirma={solicitudesFirma}
                isSendingFirma={isSendingFirma}
                enviarAFirma={enviarAFirma}
                cancelarFirma={cancelarFirma}
                reenviarFirma={reenviarFirma}
                onVerDetalleFirma={onVerDetalleFirma}
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
                onVerDetalleFirma={onVerDetalleFirma}
              />
            )}
            {activeTab === 'vacaciones' && (
              <TabVacaciones
                selectedEmpleado={selectedEmpleado}
                vacaciones={vacaciones}
                saldoVacaciones={saldoVacaciones}
                showVacacionForm={showVacacionForm}
                setShowVacacionForm={setShowVacacionForm}
                vacacionData={vacacionData}
                setVacacionData={setVacacionData}
                guardarVacacion={guardarVacacion}
                isSavingVacacion={isSavingVacacion}
                descargarVacacionPDF={descargarVacacionPDF}
                solicitudesFirma={solicitudesFirma}
                isSendingFirma={isSendingFirma}
                enviarAFirma={enviarAFirma}
                cancelarFirma={cancelarFirma}
                reenviarFirma={reenviarFirma}
                onVerDetalleFirma={onVerDetalleFirma}
              />
            )}
            {activeTab === 'finiquito' && (
              <TabFiniquito
                selectedEmpleado={selectedEmpleado}
                finiquitos={finiquitos}
                showFiniquitoForm={showFiniquitoForm}
                setShowFiniquitoForm={setShowFiniquitoForm}
                finiquitoData={finiquitoData}
                setFiniquitoData={setFiniquitoData}
                guardarFiniquito={guardarFiniquito}
                isSavingFiniquito={isSavingFiniquito}
                descargarFiniquitoPDF={descargarFiniquitoPDF}
                solicitudesFirma={solicitudesFirma}
                isSendingFirma={isSendingFirma}
                enviarAFirma={enviarAFirma}
                cancelarFirma={cancelarFirma}
                reenviarFirma={reenviarFirma}
                onVerDetalleFirma={onVerDetalleFirma}
              />
            )}
            {activeTab === 'historial' && (
              <TabHistorialSalarial
                liquidaciones={liquidaciones}
                empleadoId={selectedEmpleado?.id ?? null}
              />
            )}
          </div>

          {/* FOOTER */}
          {!(panelMode === 'view' && activeTab === 'perfil') && (
            <div className="px-8 py-4 flex justify-between items-center" style={{ borderTop: '1px solid var(--c-border)', background: 'var(--c-bg-modal)' }}>
              <div className="flex w-full justify-end gap-3">
                {(!showDocumentoForm || activeTab !== 'legal') && (
                  <button type="button" onClick={() => setIsPanelOpen(false)}
                    className="px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                    style={{ color: 'var(--c-text-2)', background: 'var(--c-bg-input)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-input-focus)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--c-bg-input)')}>
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
                ) : (activeTab === 'vacaciones' && showVacacionForm) ? (
                  <>
                    <button type="button" onClick={() => setShowVacacionForm(false)}
                      className="px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                      style={{ color: 'var(--c-text-2)', background: 'var(--c-bg-input)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-input-focus)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--c-bg-input)')}>
                      Volver al Historial
                    </button>
                    <button
                      type="submit"
                      form="vacacionForm"
                      disabled={isSavingVacacion}
                      className="px-8 py-2.5 text-sm text-white font-semibold rounded-xl transition-colors"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                    >
                      {isSavingVacacion ? 'Registrando...' : 'Registrar Vacación'}
                    </button>
                  </>
                ) : (activeTab === 'legal' && showDocumentoForm) ? (
                  <>
                    <button type="button" onClick={() => setShowDocumentoForm(false)}
                      className="px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                      style={{ color: 'var(--c-text-2)', background: 'var(--c-bg-input)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-input-focus)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--c-bg-input)')}>
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
                ) : (activeTab === 'finiquito' && showFiniquitoForm) ? (
                  <>
                    <button type="button" onClick={() => setShowFiniquitoForm(false)}
                      className="px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                      style={{ color: 'var(--c-text-2)', background: 'var(--c-bg-input)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-input-focus)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--c-bg-input)')}>
                      Volver al Historial
                    </button>
                    <button
                      type="submit"
                      form="finiquitoForm"
                      disabled={isSavingFiniquito}
                      className="px-8 py-2.5 text-sm text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                    >
                      {isSavingFiniquito ? 'Generando...' : 'Generar Finiquito'}
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
