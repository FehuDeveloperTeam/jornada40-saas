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
  descargarContratoPDF: UseDashboardReturn['descargarContratoPDF'];
  descargarAnexoPDF: UseDashboardReturn['descargarAnexoPDF'];
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
};

export default function EmpleadoPanel({
  setIsPanelOpen, panelMode, setPanelMode, selectedEmpleado,
  activeTab, setActiveTab, isValidRut, setIsValidRut, formData, setFormData,
  isSavingContrato, contratoData, totalHorasCalculadas,
  showDocumentoForm, setShowDocumentoForm, isSavingDocumento,
  handleInputChange, guardarEmpleado,
  handleContratoChange, guardarContrato, setHayCambiosContrato,
  funciones, setFunciones, clausulas, setClausulas, horario, setHorario,
  hayCambiosContrato, descargarContratoPDF, descargarAnexoPDF,
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
}: Props) {
  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={(e) => { e.stopPropagation(); setIsPanelOpen(false); }}
      />

      <div className="absolute inset-y-0 right-0 max-w-4xl w-full flex shadow-2xl">
        <div className="h-full w-full bg-white flex flex-col transform transition-transform duration-300" onClick={(e) => e.stopPropagation()}>

          {/* HEADER */}
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
                <button
                  onClick={() => { setFormData({ ...selectedEmpleado }); setIsValidRut(true); setPanelMode('edit'); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                >
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                  Editar Ficha
                </button>
              )}
              <button onClick={() => setIsPanelOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* TABS NAV */}
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

          {/* BODY */}
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
            {activeTab === 'perfil' && (
              <TabPerfil
                panelMode={panelMode}
                selectedEmpleado={selectedEmpleado}
                formData={formData}
                isValidRut={isValidRut}
                handleInputChange={handleInputChange}
                guardarEmpleado={guardarEmpleado}
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
              />
            )}
          </div>

          {/* FOOTER */}
          <div className="px-8 py-4 border-t border-gray-200 bg-white flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {panelMode === 'view' && activeTab === 'perfil' ? (
              <div className="w-full flex justify-end">
                <button onClick={() => setIsPanelOpen(false)} className="px-6 py-2.5 text-slate-700 font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">
                  Cerrar Ficha
                </button>
              </div>
            ) : (
              <div className="flex w-full justify-end gap-3">
                {(!showDocumentoForm || activeTab !== 'legal') && (
                  <button type="button" onClick={() => { setIsPanelOpen(false); setActiveTab('perfil'); }} className="px-6 py-2.5 text-slate-600 font-semibold bg-transparent hover:bg-slate-100 rounded-xl transition-colors">
                    Cancelar
                  </button>
                )}
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
  );
}
