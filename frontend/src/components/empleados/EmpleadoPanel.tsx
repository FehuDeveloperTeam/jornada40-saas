import type { DashboardEmpleado, DashboardContrato, DashboardDocumentoLegal, HorarioSemana, DashboardLiquidacion, ItemDinamico, HoraExtraItem } from '../../types/dashboard';
import TabPerfil from '../tabs/TabPerfil';
import TabContratos from '../tabs/TabContratos';
import TabLiquidaciones from '../tabs/TabLiquidaciones';
import TabLegal from '../tabs/TabLegal';

interface Props {
  isPanelOpen: boolean;
  setIsPanelOpen: (v: boolean) => void;
  panelMode: 'create' | 'edit' | 'view';
  setPanelMode: (v: 'create' | 'edit' | 'view') => void;
  selectedEmpleado: DashboardEmpleado | null;
  activeTab: 'perfil' | 'contratos' | 'liquidaciones' | 'legal';
  setActiveTab: (v: 'perfil' | 'contratos' | 'liquidaciones' | 'legal') => void;
  formData: Partial<DashboardEmpleado>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<DashboardEmpleado>>>;
  isValidRut: boolean;
  setIsValidRut: (v: boolean) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  guardarEmpleado: (e: React.FormEvent) => void;
  contratoData: Partial<DashboardContrato>;
  funciones: string[];
  setFunciones: React.Dispatch<React.SetStateAction<string[]>>;
  clausulas: string[];
  setClausulas: React.Dispatch<React.SetStateAction<string[]>>;
  horario: HorarioSemana;
  setHorario: React.Dispatch<React.SetStateAction<HorarioSemana>>;
  totalHorasCalculadas: number;
  hayCambiosContrato: boolean;
  setHayCambiosContrato: (v: boolean) => void;
  isSavingContrato: boolean;
  handleContratoChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  guardarContrato: (e: React.FormEvent) => void;
  descargarContratoPDF: () => void;
  descargarAnexoPDF: () => void;
  liquidaciones: DashboardLiquidacion[];
  showLiqForm: boolean;
  setShowLiqForm: (v: boolean) => void;
  isGeneratingLiq: boolean;
  expandedLiqId: number | null;
  setExpandedLiqId: (v: number | null) => void;
  liqMes: number;
  setLiqMes: (v: number) => void;
  liqAnio: number;
  setLiqAnio: (v: number) => void;
  liqDiasTrabajados: number;
  setLiqDiasTrabajados: (v: number) => void;
  liqAusencias: number;
  setLiqAusencias: (v: number) => void;
  haberesImponiblesList: ItemDinamico[];
  setHaberesImponiblesList: React.Dispatch<React.SetStateAction<ItemDinamico[]>>;
  haberesNoImponiblesList: ItemDinamico[];
  setHaberesNoImponiblesList: React.Dispatch<React.SetStateAction<ItemDinamico[]>>;
  horasExtrasList: HoraExtraItem[];
  setHorasExtrasList: React.Dispatch<React.SetStateAction<HoraExtraItem[]>>;
  calcularValorHorasExtras: (horas: number, recargo: number) => number;
  generarLiquidacion: (e: React.FormEvent) => void;
  descargarLiquidacionPDF: (liqId: number, mes: number, anio: number) => void;
  documentosLegales: DashboardDocumentoLegal[];
  documentoData: Partial<DashboardDocumentoLegal>;
  setDocumentoData: React.Dispatch<React.SetStateAction<Partial<DashboardDocumentoLegal>>>;
  showDocumentoForm: boolean;
  setShowDocumentoForm: (v: boolean) => void;
  isSavingDocumento: boolean;
  guardarDocumentoLegal: (e: React.FormEvent) => void;
  descargarDocumentoPDF: (docId: number, tipo: string) => void;
}

export default function EmpleadoPanel(props: Props) {
  const {
    isPanelOpen, setIsPanelOpen,
    panelMode, setPanelMode,
    selectedEmpleado,
    activeTab, setActiveTab,
    formData, setFormData,
    isValidRut, setIsValidRut,
    handleInputChange, guardarEmpleado,
    contratoData, funciones, setFunciones, clausulas, setClausulas,
    horario, setHorario, totalHorasCalculadas, hayCambiosContrato, setHayCambiosContrato,
    isSavingContrato, handleContratoChange, guardarContrato, descargarContratoPDF, descargarAnexoPDF,
    liquidaciones, showLiqForm, setShowLiqForm, isGeneratingLiq, expandedLiqId, setExpandedLiqId,
    liqMes, setLiqMes, liqAnio, setLiqAnio, liqDiasTrabajados, setLiqDiasTrabajados,
    liqAusencias, setLiqAusencias,
    haberesImponiblesList, setHaberesImponiblesList,
    haberesNoImponiblesList, setHaberesNoImponiblesList,
    horasExtrasList, setHorasExtrasList,
    calcularValorHorasExtras, generarLiquidacion, descargarLiquidacionPDF,
    documentosLegales, documentoData, setDocumentoData,
    showDocumentoForm, setShowDocumentoForm,
    isSavingDocumento, guardarDocumentoLegal, descargarDocumentoPDF,
  } = props;

  if (!isPanelOpen) return null;

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
                  onClick={() => {
                    setFormData({ ...selectedEmpleado });
                    setIsValidRut(true);
                    setPanelMode('edit');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                >
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                  Editar Ficha
                </button>
              )}
              <button
                onClick={() => setIsPanelOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* TABS */}
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
                onSubmit={guardarEmpleado}
              />
            )}
            {activeTab === 'contratos' && (
              <TabContratos
                contratoData={contratoData}
                funciones={funciones}
                setFunciones={setFunciones}
                clausulas={clausulas}
                setClausulas={setClausulas}
                horario={horario}
                setHorario={setHorario}
                totalHorasCalculadas={totalHorasCalculadas}
                hayCambiosContrato={hayCambiosContrato}
                setHayCambiosContrato={setHayCambiosContrato}
                handleContratoChange={handleContratoChange}
                guardarContrato={guardarContrato}
                descargarContratoPDF={descargarContratoPDF}
                descargarAnexoPDF={descargarAnexoPDF}
              />
            )}
            {activeTab === 'liquidaciones' && (
              <TabLiquidaciones
                selectedEmpleado={selectedEmpleado}
                liquidaciones={liquidaciones}
                showLiqForm={showLiqForm}
                setShowLiqForm={setShowLiqForm}
                isGeneratingLiq={isGeneratingLiq}
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
                calcularValorHorasExtras={calcularValorHorasExtras}
                generarLiquidacion={generarLiquidacion}
                descargarLiquidacionPDF={descargarLiquidacionPDF}
              />
            )}
            {activeTab === 'legal' && (
              <TabLegal
                selectedEmpleado={selectedEmpleado}
                documentosLegales={documentosLegales}
                documentoData={documentoData}
                setDocumentoData={setDocumentoData}
                showDocumentoForm={showDocumentoForm}
                setShowDocumentoForm={setShowDocumentoForm}
                isSavingDocumento={isSavingDocumento}
                guardarDocumentoLegal={guardarDocumentoLegal}
                descargarDocumentoPDF={descargarDocumentoPDF}
              />
            )}
          </div>

          {/* FOOTER */}
          <div className="px-8 py-4 border-t border-gray-200 bg-white flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {panelMode === 'view' && activeTab === 'perfil' ? (
              <div className="w-full flex justify-end">
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="px-6 py-2.5 text-slate-700 font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-sm"
                >
                  Cerrar Ficha
                </button>
              </div>
            ) : (
              <div className="flex w-full justify-end gap-3">
                {(!showDocumentoForm || activeTab !== 'legal') && (
                  <button
                    type="button"
                    onClick={() => { setIsPanelOpen(false); setActiveTab('perfil'); }}
                    className="px-6 py-2.5 text-slate-600 font-semibold bg-transparent hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                )}

                {activeTab === 'perfil' ? (
                  <button
                    type="submit"
                    form="empleadoForm"
                    disabled={!isValidRut}
                    className="px-8 py-2.5 text-white font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-xl transition-colors shadow-md"
                  >
                    {panelMode === 'create' ? 'Crear Trabajador' : 'Guardar Perfil'}
                  </button>
                ) : activeTab === 'contratos' ? (
                  <button
                    type="submit"
                    form="contratoForm"
                    disabled={isSavingContrato || (contratoData.tipo_jornada === 'ORDINARIA' && totalHorasCalculadas > (contratoData.horas_semanales || 44))}
                    className="px-8 py-2.5 text-white font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed rounded-xl transition-colors shadow-md"
                  >
                    {isSavingContrato ? 'Guardando...' : 'Guardar Contrato Legal'}
                  </button>
                ) : (activeTab === 'legal' && showDocumentoForm) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowDocumentoForm(false)}
                      className="px-6 py-2.5 text-slate-600 font-semibold bg-transparent hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      Volver al Historial
                    </button>
                    <button
                      type="submit"
                      form="documentoForm"
                      disabled={isSavingDocumento}
                      className="px-8 py-2.5 text-white font-semibold bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 rounded-xl transition-colors shadow-md"
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
