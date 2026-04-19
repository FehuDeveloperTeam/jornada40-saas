import { useState } from 'react';
import type { UseDashboardReturn } from '../../../hooks/useDashboard';

type Props = {
  contratoData: UseDashboardReturn['contratoData'];
  handleContratoChange: UseDashboardReturn['handleContratoChange'];
  guardarContrato: UseDashboardReturn['guardarContrato'];
  setHayCambiosContrato: UseDashboardReturn['setHayCambiosContrato'];
  funciones: UseDashboardReturn['funciones'];
  setFunciones: UseDashboardReturn['setFunciones'];
  clausulas: UseDashboardReturn['clausulas'];
  setClausulas: UseDashboardReturn['setClausulas'];
  horario: UseDashboardReturn['horario'];
  setHorario: UseDashboardReturn['setHorario'];
  totalHorasCalculadas: UseDashboardReturn['totalHorasCalculadas'];
  hayCambiosContrato: UseDashboardReturn['hayCambiosContrato'];
  descargarContratoPDF: UseDashboardReturn['descargarContratoPDF'];
  descargarAnexoPDF: UseDashboardReturn['descargarAnexoPDF'];
  // Anexos de contrato
  anexosContrato: UseDashboardReturn['anexosContrato'];
  showAnexoContratoForm: UseDashboardReturn['showAnexoContratoForm'];
  setShowAnexoContratoForm: UseDashboardReturn['setShowAnexoContratoForm'];
  isSavingAnexoContrato: UseDashboardReturn['isSavingAnexoContrato'];
  anexoContratoData: UseDashboardReturn['anexoContratoData'];
  setAnexoContratoData: UseDashboardReturn['setAnexoContratoData'];
  guardarAnexoContrato: UseDashboardReturn['guardarAnexoContrato'];
  descargarAnexoContratoPDF: UseDashboardReturn['descargarAnexoContratoPDF'];
};

export default function TabContratos({
  contratoData, handleContratoChange, guardarContrato, setHayCambiosContrato,
  funciones, setFunciones, clausulas, setClausulas,
  horario, setHorario, totalHorasCalculadas,
  hayCambiosContrato, descargarContratoPDF, descargarAnexoPDF,
  anexosContrato, showAnexoContratoForm, setShowAnexoContratoForm,
  isSavingAnexoContrato, anexoContratoData, setAnexoContratoData,
  guardarAnexoContrato, descargarAnexoContratoPDF,
}: Props) {
  const [clausulasAnexo, setClausulasAnexo] = useState<string[]>([]);
  return (
    <>
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
          <div className="space-y-3 overflow-x-auto">
            <div className="min-w-[480px]">
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
            className={`flex-1 px-4 py-3 rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2 ${hayCambiosContrato ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
          >
            {hayCambiosContrato ? '⚠️ Guarda los cambios primero' : '📄 Descargar Contrato Base'}
          </button>
          <button
            type="button"
            onClick={descargarAnexoPDF}
            disabled={hayCambiosContrato}
            className={`flex-1 px-4 py-3 rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2 ${hayCambiosContrato ? 'bg-slate-200 text-slate-500 cursor-not-allowed border-transparent' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            {hayCambiosContrato ? '⚠️ Guarda los cambios primero' : '📄 Descargar Anexo Ley 40h'}
          </button>
        </div>
      )}
    </form>

    {/* ── SECCIÓN ANEXOS DE CONTRATO (fuera del form principal) ── */}
    {contratoData.id && (
      <div className="max-w-4xl mx-auto mt-8 pb-10">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center border-b pb-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">5. Anexos de Contrato</h3>
              <p className="text-sm text-slate-500 mt-0.5">Modificaciones contractuales formalizadas por escrito.</p>
            </div>
            {!showAnexoContratoForm && (
              <button
                onClick={() => {
                  setAnexoContratoData({ fecha_emision: new Date().toISOString().split('T')[0], titulo: '', descripcion: '', clausulas_modificadas: [] });
                  setClausulasAnexo([]);
                  setShowAnexoContratoForm(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                + Nuevo Anexo
              </button>
            )}
          </div>

          {showAnexoContratoForm ? (
            <form
              id="anexoContratoForm"
              onSubmit={(e) => {
                guardarAnexoContrato(e);
                setClausulasAnexo([]);
              }}
              className="space-y-5"
            >
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Título del Anexo</label>
                  <input
                    type="text"
                    required
                    value={anexoContratoData.titulo || ''}
                    onChange={e => setAnexoContratoData({ ...anexoContratoData, titulo: e.target.value })}
                    placeholder="Ej: Modificación de cargo y remuneración"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Emisión</label>
                  <input
                    type="date"
                    required
                    value={anexoContratoData.fecha_emision || ''}
                    onChange={e => setAnexoContratoData({ ...anexoContratoData, fecha_emision: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Antecedentes (opcional)</label>
                  <textarea
                    rows={2}
                    value={anexoContratoData.descripcion || ''}
                    onChange={e => setAnexoContratoData({ ...anexoContratoData, descripcion: e.target.value })}
                    placeholder="Contexto o motivo del anexo..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Cláusulas Modificadas</label>
                {clausulasAnexo.map((cl, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <textarea
                      rows={2}
                      value={cl}
                      onChange={e => {
                        const nueva = [...clausulasAnexo];
                        nueva[i] = e.target.value;
                        setClausulasAnexo(nueva);
                        setAnexoContratoData({ ...anexoContratoData, clausulas_modificadas: nueva });
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 resize-none"
                      placeholder="Ej: El cargo del trabajador pasa a ser Jefe de Área..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nueva = clausulasAnexo.filter((_, j) => j !== i);
                        setClausulasAnexo(nueva);
                        setAnexoContratoData({ ...anexoContratoData, clausulas_modificadas: nueva });
                      }}
                      className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold"
                    >✕</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const nueva = [...clausulasAnexo, ''];
                    setClausulasAnexo(nueva);
                    setAnexoContratoData({ ...anexoContratoData, clausulas_modificadas: nueva });
                  }}
                  className="text-sm text-blue-600 font-semibold mt-1"
                >
                  + Añadir Cláusula
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAnexoContratoForm(false); setClausulasAnexo([]); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingAnexoContrato}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSavingAnexoContrato ? 'Guardando...' : 'Guardar y Generar PDF'}
                </button>
              </div>
            </form>
          ) : anexosContrato.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No hay anexos de contrato registrados.</p>
          ) : (
            <div className="space-y-2">
              {anexosContrato.map(anexo => (
                <div key={anexo.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{anexo.titulo}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{anexo.fecha_emision}</p>
                  </div>
                  <button
                    onClick={() => descargarAnexoContratoPDF(anexo.id, anexo.titulo)}
                    className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-1"
                  >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    PDF
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
