import { useState } from 'react';
import type { UseDashboardReturn } from '../../hooks/useDashboard';
import type { DocumentosDisponibles } from '../../types';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';

type Props = {
  empleados: UseDashboardReturn['empleados'];
  filteredEmpleados: UseDashboardReturn['filteredEmpleados'];
  selectedEmpleadosIds: UseDashboardReturn['selectedEmpleadosIds'];
  setSelectedEmpleadosIds: UseDashboardReturn['setSelectedEmpleadosIds'];
  isGeneratingZip: UseDashboardReturn['isGeneratingZip'];
  setIsGeneratingZip: UseDashboardReturn['setIsGeneratingZip'];
  setIsModalMasivoOpen: UseDashboardReturn['setIsModalMasivoOpen'];
  empresaActivaId: UseDashboardReturn['empresaActivaId'];
};

type DocsMap = Record<number, DocumentosDisponibles>;

type DocItemProps = {
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  badge: string;
  children?: React.ReactNode;
};

function DocItem({ label, checked, disabled, onToggle, badge, children }: DocItemProps) {
  return (
    <label
      className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
        disabled
          ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
          : checked
            ? 'border-blue-200 bg-blue-50 cursor-pointer'
            : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="mt-0.5 w-4 h-4 text-blue-600 rounded disabled:opacity-50 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <span className={`font-semibold text-sm ${disabled ? 'text-slate-400' : 'text-slate-800'}`}>
          {label}
        </span>
        {children}
      </div>
      <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap shrink-0">
        {badge}
      </span>
    </label>
  );
}

export default function ModalDescargaMasiva({
  empleados, filteredEmpleados, selectedEmpleadosIds, setSelectedEmpleadosIds,
  isGeneratingZip, setIsGeneratingZip, setIsModalMasivoOpen, empresaActivaId,
}: Props) {
  const showToast = useToast();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [docsMap, setDocsMap] = useState<DocsMap>({});
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selDocs, setSelDocs] = useState<string[]>([
    'contrato', 'anexo_40h', 'liquidaciones',
    'amonestaciones', 'despidos', 'mutuo_acuerdo', 'constancias', 'anexos_contrato',
  ]);
  const [cantidadLiq, setCantidadLiq] = useState(1);

  const irAlPaso2 = async () => {
    setLoadingDocs(true);
    try {
      const resultados = await Promise.all(
        selectedEmpleadosIds.map(id =>
          client.get<DocumentosDisponibles>(`/empleados/${id}/documentos_disponibles/`)
            .then(r => ({ id, data: r.data }))
        )
      );
      const mapa: DocsMap = {};
      resultados.forEach(({ id, data }) => { mapa[id] = data; });
      setDocsMap(mapa);
      const maxLiq = resultados.reduce((m, r) => Math.max(m, r.data.cantidad_liquidaciones), 0);
      setCantidadLiq(maxLiq > 0 ? 1 : 0);
      setPaso(2);
    } catch {
      showToast('Error al consultar disponibilidad de documentos. Inténtalo de nuevo.', 'error');
    } finally {
      setLoadingDocs(false);
    }
  };

  const toggle = (tipo: string) =>
    setSelDocs(prev => prev.includes(tipo) ? prev.filter(d => d !== tipo) : [...prev, tipo]);

  const total = selectedEmpleadosIds.length;
  const docs = Object.values(docsMap);
  const maxLiq = docs.reduce((m, d) => Math.max(m, d.cantidad_liquidaciones), 0);
  const s = {
    conContrato:    docs.filter(d => d.tiene_contrato).length,
    conAnexo40h:    docs.filter(d => d.tiene_anexo_40h).length,
    maxLiq,
    totalAmon:      docs.reduce((a, d) => a + d.cantidad_amonestaciones, 0),
    empAmon:        docs.filter(d => d.cantidad_amonestaciones > 0).length,
    empDespido:     docs.filter(d => d.tiene_despido).length,
    empMutuo:       docs.filter(d => d.tiene_mutuo_acuerdo).length,
    totalConst:     docs.reduce((a, d) => a + d.cantidad_constancias, 0),
    empConst:       docs.filter(d => d.cantidad_constancias > 0).length,
    totalAnexos:    docs.reduce((a, d) => a + d.cantidad_anexos_contrato, 0),
  };

  const descargar = async () => {
    if (!empresaActivaId) return;
    setIsGeneratingZip(true);
    try {
      const response = await client.post(
        '/empleados/descarga_masiva/',
        {
          empresa_id: parseInt(empresaActivaId),
          empleados: selectedEmpleadosIds,
          documentos: selDocs,
          cantidad_liquidaciones: selDocs.includes('liquidaciones') ? cantidadLiq : 0,
        },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const cd = (response.headers['content-disposition'] as string) || '';
      const match = cd.match(/filename="(.+)"/);
      link.setAttribute('download', match?.[1] ?? 'Expedientes.zip');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      setIsModalMasivoOpen(false);
      setSelectedEmpleadosIds([]);
    } catch {
      showToast('Error al generar el ZIP. Inténtalo de nuevo.', 'error');
    } finally {
      setIsGeneratingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Descarga masiva de documentos</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {paso === 1 ? 'Paso 1 de 2 — Selecciona los trabajadores' : 'Paso 2 de 2 — Elige qué documentos incluir'}
            </p>
          </div>
          <button onClick={() => setIsModalMasivoOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Barra de progreso */}
        <div className="h-1 bg-slate-100">
          <div className={`h-full bg-blue-500 transition-all duration-500 ${paso === 1 ? 'w-1/2' : 'w-full'}`} />
        </div>

        {paso === 1 ? (
          <>
            {/* Sub-header paso 1 */}
            <div className="px-6 py-3 border-b bg-slate-50 flex justify-between items-center">
              <button
                onClick={() => setSelectedEmpleadosIds(empleados.filter(e => e.activo).map(e => e.id))}
                className="text-sm font-semibold text-blue-600 hover:text-blue-800"
              >
                Seleccionar todos (vigentes)
              </button>
              <button
                onClick={() => setSelectedEmpleadosIds([])}
                className="text-sm font-semibold text-red-500 hover:text-red-700"
              >
                Deseleccionar todos
              </button>
            </div>

            {/* Lista de empleados */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                {filteredEmpleados.map(emp => (
                  <label
                    key={emp.id}
                    className={`flex items-center p-3 border rounded-xl transition-colors ${
                      emp.activo
                        ? selectedEmpleadosIds.includes(emp.id)
                          ? 'border-blue-200 bg-blue-50 cursor-pointer'
                          : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                        : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded shrink-0"
                      checked={selectedEmpleadosIds.includes(emp.id)}
                      disabled={!emp.activo}
                      onChange={e => {
                        if (e.target.checked) setSelectedEmpleadosIds(prev => [...prev, emp.id]);
                        else setSelectedEmpleadosIds(prev => prev.filter(id => id !== emp.id));
                      }}
                    />
                    <div className="ml-3">
                      <p className="font-semibold text-sm text-slate-800">{emp.nombres} {emp.apellido_paterno}</p>
                      <p className="text-xs text-slate-500">{emp.rut} · {emp.cargo}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Footer paso 1 */}
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-between items-center">
              <span className="text-sm text-slate-500">
                {selectedEmpleadosIds.length} seleccionado{selectedEmpleadosIds.length !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsModalMasivoOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={irAlPaso2}
                  disabled={selectedEmpleadosIds.length === 0 || loadingDocs}
                  className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {loadingDocs ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Consultando...
                    </>
                  ) : (
                    <>
                      Siguiente
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Sub-header paso 2 */}
            <div className="px-6 py-3 border-b bg-slate-50 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-700">
                {total} trabajador{total !== 1 ? 'es' : ''} seleccionado{total !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-3">
                <button onClick={() => setSelDocs(['contrato','anexo_40h','liquidaciones','amonestaciones','despidos','mutuo_acuerdo','constancias','anexos_contrato'])} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                  Marcar todos
                </button>
                <button onClick={() => setSelDocs([])} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
                  Desmarcar todos
                </button>
              </div>
            </div>

            {/* Lista de tipos de documentos */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              <DocItem
                label="Contrato de Trabajo"
                checked={selDocs.includes('contrato')}
                disabled={s.conContrato === 0}
                onToggle={() => toggle('contrato')}
                badge={`${s.conContrato}/${total} trabajadores`}
              />
              <DocItem
                label="Anexo Ley 40 Horas"
                checked={selDocs.includes('anexo_40h')}
                disabled={s.conAnexo40h === 0}
                onToggle={() => toggle('anexo_40h')}
                badge={`${s.conAnexo40h}/${total} trabajadores`}
              />
              <DocItem
                label="Liquidaciones de Sueldo"
                checked={selDocs.includes('liquidaciones')}
                disabled={s.maxLiq === 0}
                onToggle={() => toggle('liquidaciones')}
                badge={s.maxLiq > 0 ? `máx. ${s.maxLiq} disponibles` : 'Sin liquidaciones'}
              >
                {selDocs.includes('liquidaciones') && s.maxLiq > 0 && (
                  <div
                    className="flex items-center gap-2 mt-2"
                    onClick={e => e.preventDefault()}
                  >
                    <span className="text-xs text-slate-500">Incluir las</span>
                    <input
                      type="number"
                      min={1}
                      max={s.maxLiq}
                      value={cantidadLiq}
                      onChange={e => setCantidadLiq(Math.min(s.maxLiq, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-16 text-center text-sm font-bold border border-slate-300 rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <span className="text-xs text-slate-500">más recientes</span>
                  </div>
                )}
              </DocItem>
              <DocItem
                label="Cartas de Amonestación"
                checked={selDocs.includes('amonestaciones')}
                disabled={s.totalAmon === 0}
                onToggle={() => toggle('amonestaciones')}
                badge={s.totalAmon > 0 ? `${s.totalAmon} cartas · ${s.empAmon} trab.` : 'Ninguna registrada'}
              />
              <DocItem
                label="Carta de Término de Contrato"
                checked={selDocs.includes('despidos')}
                disabled={s.empDespido === 0}
                onToggle={() => toggle('despidos')}
                badge={`${s.empDespido}/${total} trabajadores`}
              />
              <DocItem
                label="Renuncia / Mutuo Acuerdo"
                checked={selDocs.includes('mutuo_acuerdo')}
                disabled={s.empMutuo === 0}
                onToggle={() => toggle('mutuo_acuerdo')}
                badge={`${s.empMutuo}/${total} trabajadores`}
              />
              <DocItem
                label="Constancias Laborales"
                checked={selDocs.includes('constancias')}
                disabled={s.totalConst === 0}
                onToggle={() => toggle('constancias')}
                badge={s.totalConst > 0 ? `${s.totalConst} doc · ${s.empConst} trab.` : 'Ninguna registrada'}
              />
              <DocItem
                label="Anexos de Contrato"
                checked={selDocs.includes('anexos_contrato')}
                disabled={s.totalAnexos === 0}
                onToggle={() => toggle('anexos_contrato')}
                badge={s.totalAnexos > 0 ? `${s.totalAnexos} documentos` : 'Ninguno registrado'}
              />
            </div>

            {/* Footer paso 2 */}
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-between items-center">
              <button
                onClick={() => setPaso(1)}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Volver
              </button>
              <button
                onClick={descargar}
                disabled={selDocs.length === 0 || isGeneratingZip}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {isGeneratingZip ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generando ZIP...
                  </>
                ) : (
                  <>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Descargar ZIP
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
