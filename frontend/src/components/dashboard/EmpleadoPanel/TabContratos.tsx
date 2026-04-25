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
  generarContratoPDF: UseDashboardReturn['generarContratoPDF'];
  descargarContratoGuardado: UseDashboardReturn['descargarContratoGuardado'];
  generarAnexo40hPDF: UseDashboardReturn['generarAnexo40hPDF'];
  descargarAnexo40hGuardado: UseDashboardReturn['descargarAnexo40hGuardado'];
  isGeneratingContratoPDF: UseDashboardReturn['isGeneratingContratoPDF'];
  isGeneratingAnexo40hPDF: UseDashboardReturn['isGeneratingAnexo40hPDF'];
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
  hayCambiosContrato,
  generarContratoPDF, descargarContratoGuardado,
  generarAnexo40hPDF, descargarAnexo40hGuardado,
  isGeneratingContratoPDF, isGeneratingAnexo40hPDF,
  anexosContrato, showAnexoContratoForm, setShowAnexoContratoForm,
  isSavingAnexoContrato, anexoContratoData, setAnexoContratoData,
  guardarAnexoContrato, descargarAnexoContratoPDF,
}: Props) {
  const [clausulasAnexo, setClausulasAnexo] = useState<string[]>([]);
  return (
    <>
    <form id="contratoForm" onSubmit={guardarContrato} onChange={() => setHayCambiosContrato(true)} className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-lg font-bold text-white mb-4 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>1. Condiciones Generales</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Tipo de Contrato</label>
            <select name="tipo_contrato" required value={contratoData.tipo_contrato || 'INDEFINIDO'} onChange={handleContratoChange} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.625rem', padding:'0.625rem 0.75rem', color:'#f8fafc', outline:'none', cursor:'pointer' }}>
              <option value="INDEFINIDO" style={{ background:'#0c1a35' }}>Indefinido</option>
              <option value="PLAZO_FIJO" style={{ background:'#0c1a35' }}>Plazo Fijo</option>
              <option value="OBRA_FAENA" style={{ background:'#0c1a35' }}>Por Obra o Faena</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Fecha de Inicio</label>
            <input type="date" name="fecha_inicio" required value={contratoData.fecha_inicio || ''} onChange={handleContratoChange} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.625rem', padding:'0.625rem 0.75rem', color:'#f8fafc', outline:'none', colorScheme:'dark' }} />
          </div>
          {contratoData.tipo_contrato === 'PLAZO_FIJO' && (
            <div className="col-span-2 p-4 rounded-xl flex gap-4" style={{ background:'rgba(251,146,60,0.08)', border:'1px solid rgba(251,146,60,0.25)' }}>
              <div className="w-1/2">
                <label className="block text-xs font-semibold mb-1" style={{ color:'#fdba74' }}>Fecha de Término</label>
                <input type="date" name="fecha_fin" required value={contratoData.fecha_fin || ''} onChange={handleContratoChange} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(251,146,60,0.3)', borderRadius:'0.5rem', padding:'0.5rem 0.75rem', color:'#fdba74', outline:'none', colorScheme:'dark' }} />
              </div>
              <p className="w-1/2 text-xs flex items-center" style={{ color:'rgba(253,186,116,0.7)' }}>Indica la fecha exacta en la que terminará la relación laboral.</p>
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Funciones a Desempeñar (Opcional)</label>
            <p className="text-xs mb-2" style={{ color:'rgba(255,255,255,0.3)' }}>Por defecto se incluirá un texto legal genérico. Si agregas ítems aquí, se listarán en el contrato.</p>
            {funciones.map((func, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input type="text" value={func} onChange={(e) => { const newF = [...funciones]; newF[index] = e.target.value; setFunciones(newF); setHayCambiosContrato(true); }} style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.5rem', padding:'0.5rem 0.75rem', color:'#f8fafc', outline:'none' }} placeholder="Ej: Atención a público y ventas..." />
                <button type="button" onClick={() => { setFunciones(funciones.filter((_, i) => i !== index)); setHayCambiosContrato(true); }} className="px-3 py-2 rounded-lg font-bold" style={{ background:'rgba(239,68,68,0.1)', color:'#f87171' }}>✕</button>
              </div>
            ))}
            <button type="button" onClick={() => { setFunciones([...funciones, ""]); setHayCambiosContrato(true); }} className="text-sm font-semibold mt-1" style={{ color:'#60a5fa' }}>+ Agregar Función Específica</button>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-lg font-bold text-white mb-4 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>2. Remuneraciones y Quincena</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color:'rgba(255,255,255,0.4)' }}>Día de Pago (Mensual)</label>
            <input type="number" min="1" max="31" name="dia_pago" required value={contratoData.dia_pago || 5} onChange={handleContratoChange} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.625rem', padding:'0.625rem 0.75rem', color:'#f8fafc', outline:'none' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color:'rgba(255,255,255,0.4)' }}>Gratificación Legal</label>
            <select name="gratificacion_legal" value={contratoData.gratificacion_legal || 'MENSUAL'} onChange={handleContratoChange} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.625rem', padding:'0.625rem 0.75rem', color:'#f8fafc', outline:'none', cursor:'pointer' }}>
              <option value="MENSUAL" style={{ background:'#0c1a35' }}>Mensual (Art. 50 - 25% con tope)</option>
              <option value="ANUAL" style={{ background:'#0c1a35' }}>Anual (Art. 47 - 30% utilidades)</option>
            </select>
          </div>

          <div className="col-span-2 flex items-center gap-3">
            <input type="checkbox" name="tiene_quincena" checked={contratoData.tiene_quincena || false} onChange={handleContratoChange} className="w-5 h-5 text-blue-600" />
            <label className="font-semibold" style={{ color:'rgba(255,255,255,0.7)' }}>El trabajador recibirá Anticipo Quincenal</label>
          </div>

          {contratoData.tiene_quincena && (
            <div className="col-span-2 grid grid-cols-2 gap-4 p-4 rounded-xl" style={{ background:'rgba(37,99,235,0.08)', border:'1px solid rgba(37,99,235,0.25)' }}>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color:'#93c5fd' }}>Día de la Quincena</label>
                <input type="number" min="1" max="31" name="dia_quincena" value={contratoData.dia_quincena || 15} onChange={handleContratoChange} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(37,99,235,0.3)', borderRadius:'0.5rem', padding:'0.5rem 0.75rem', color:'#bfdbfe', outline:'none' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color:'#93c5fd' }}>Monto de la Quincena ($)</label>
                <input type="number" min="10000" max={contratoData.sueldo_base || 5000000} name="monto_quincena" value={contratoData.monto_quincena || ''} onChange={handleContratoChange} placeholder="Ej: 150000" style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(37,99,235,0.3)', borderRadius:'0.5rem', padding:'0.5rem 0.75rem', color:'#bfdbfe', outline:'none' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex justify-between items-end mb-4 pb-2" style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-lg font-bold text-white">3. Jornada Laboral</h3>
          <div className="text-right">
            <label className="block text-xs font-semibold mb-1" style={{ color:'rgba(255,255,255,0.4)' }}>Límite Legal (Hrs Semanales)</label>
            <input type="number" step="0.5" name="horas_semanales" value={contratoData.horas_semanales || 44} onChange={handleContratoChange} style={{ width:'6rem', padding:'0.25rem 0.5rem', textAlign:'center', fontWeight:700, background:'rgba(37,99,235,0.12)', border:'1px solid rgba(37,99,235,0.3)', borderRadius:'0.5rem', color:'#93c5fd', outline:'none' }} />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold mb-1" style={{ color:'rgba(255,255,255,0.4)' }}>Tipo de Jornada</label>
          <select name="tipo_jornada" required value={contratoData.tipo_jornada || 'ORDINARIA'} onChange={handleContratoChange} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.625rem', padding:'0.625rem 0.75rem', color:'#f8fafc', outline:'none', cursor:'pointer' }}>
            <option value="ORDINARIA" style={{ background:'#0c1a35' }}>Ordinaria (Asignar Horarios)</option>
            <option value="ART_22" style={{ background:'#0c1a35' }}>Artículo 22 (Sin límite de horario)</option>
            <option value="OTRO" style={{ background:'#0c1a35' }}>Otra (Redactar manualmente)</option>
          </select>
        </div>

        {contratoData.tipo_jornada === 'OTRO' && (
          <div className="p-4 rounded-xl mb-4" style={{ background:'rgba(37,99,235,0.08)', border:'1px solid rgba(37,99,235,0.25)' }}>
            <label className="block text-xs font-semibold mb-1" style={{ color:'#93c5fd' }}>Detalle de la Jornada</label>
            <textarea name="jornada_personalizada" rows={3} value={contratoData.jornada_personalizada || ''} onChange={handleContratoChange} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(37,99,235,0.3)', borderRadius:'0.5rem', padding:'0.5rem 0.75rem', color:'#bfdbfe', outline:'none', resize:'none' }} />
          </div>
        )}

        {contratoData.tipo_jornada === 'ORDINARIA' && (
          <div className="space-y-3 overflow-x-auto">
            <div className="min-w-[480px]">
            <div className="grid grid-cols-12 gap-2 text-xs font-bold uppercase text-center px-2" style={{ color:'rgba(255,255,255,0.3)' }}>
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
                <div key={dia} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg" style={{ background: datos.activo ? 'rgba(37,99,235,0.08)' : 'rgba(255,255,255,0.02)', border: datos.activo ? '1px solid rgba(37,99,235,0.2)' : '1px solid rgba(255,255,255,0.05)', opacity: datos.activo ? 1 : 0.5 }}>
                  <div className="col-span-1 text-xs font-bold text-center" style={{ color:'rgba(255,255,255,0.4)' }}>{dia.substring(0,2).toUpperCase()}</div>
                  <div className="col-span-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={datos.activo} onChange={(e) => { setHorario({...horario, [dia]: {...datos, activo: e.target.checked}}); setHayCambiosContrato(true); }} className="sr-only peer" />
                      <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" style={{ background:'rgba(255,255,255,0.15)' }}></div>
                    </label>
                  </div>
                  <div className="col-span-2"><input type="time" disabled={!datos.activo} value={datos.entrada} onChange={(e) => { setHorario({...horario, [dia]: {...datos, entrada: e.target.value}}); setHayCambiosContrato(true); }} style={{ width:'100%', fontSize:'0.75rem', padding:'0.25rem', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.375rem', color:'#f8fafc', outline:'none', colorScheme:'dark' }} /></div>
                  <div className="col-span-2"><input type="time" disabled={!datos.activo} value={datos.salida} onChange={(e) => { setHorario({...horario, [dia]: {...datos, salida: e.target.value}}); setHayCambiosContrato(true); }} style={{ width:'100%', fontSize:'0.75rem', padding:'0.25rem', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.375rem', color:'#f8fafc', outline:'none', colorScheme:'dark' }} /></div>
                  <div className="col-span-2"><input type="number" step="15" disabled={!datos.activo} value={datos.colacion} onChange={(e) => { setHorario({...horario, [dia]: {...datos, colacion: Number(e.target.value)}}); setHayCambiosContrato(true); }} style={{ width:'100%', fontSize:'0.75rem', padding:'0.25rem', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.375rem', color:'#f8fafc', outline:'none', textAlign:'center' }} /></div>
                  <div className="col-span-2 text-center font-mono font-bold" style={{ color: datos.activo ? '#93c5fd' : 'rgba(255,255,255,0.3)' }}>{horasDia.toFixed(1)}h</div>
                </div>
              );
            })}

            {(() => {
              const excede = totalHorasCalculadas > (Number(contratoData.horas_semanales) || 44);
              return (
                <div className="mt-4 p-4 rounded-xl flex justify-between items-center" style={{ background: excede ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${excede ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}` }}>
                  <span className="font-bold" style={{ color:'rgba(255,255,255,0.7)' }}>Horas asignadas en la semana:</span>
                  <div className="text-right">
                    <span className="text-2xl font-black" style={{ color: excede ? '#f87171' : '#34d399' }}>
                      {totalHorasCalculadas.toFixed(1)} / {contratoData.horas_semanales || 44}
                    </span>
                    <p className="text-xs font-bold uppercase mt-1" style={{ color: excede ? '#f87171' : '#34d399' }}>
                      {excede ? '¡Has sobrepasado el límite!' : `Quedan ${((Number(contratoData.horas_semanales) || 44) - totalHorasCalculadas).toFixed(1)} horas libres`}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
          </div>
        )}
      </div>

      <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-lg font-bold text-white mb-4 pb-2" style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>4. Cláusulas Adicionales</h3>
        {clausulas.map((clausula, index) => (
          <div key={index} className="flex gap-2 mb-3">
            <textarea rows={2} value={clausula} onChange={(e) => { const newC = [...clausulas]; newC[index] = e.target.value; setClausulas(newC); setHayCambiosContrato(true); }} style={{ flex:1, padding:'0.5rem 0.75rem', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.5rem', color:'#f8fafc', outline:'none', resize:'none' }} placeholder="Ej: Se acuerda un bono de productividad de..." />
            <button type="button" onClick={() => { setClausulas(clausulas.filter((_, i) => i !== index)); setHayCambiosContrato(true); }} className="px-3 py-2 rounded-lg font-bold" style={{ background:'rgba(239,68,68,0.1)', color:'#f87171' }}>✕</button>
          </div>
        ))}
        <button type="button" onClick={() => { setClausulas([...clausulas, ""]); setHayCambiosContrato(true); }} className="text-sm font-semibold" style={{ color:'#60a5fa' }}>+ Añadir Nueva Cláusula</button>
      </div>

      {contratoData.id && (
        <div className="rounded-2xl overflow-hidden" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-6 py-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
            <h3 className="text-base font-bold text-white">5. Documentos del Contrato</h3>
            <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.4)' }}>Genera y almacena los PDFs oficiales. Puedes regenerarlos si actualizas los datos.</p>
          </div>

          {hayCambiosContrato && (
            <div className="mx-6 mt-4 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2" style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', color:'#fcd34d' }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
              Guarda el contrato antes de generar PDFs
            </div>
          )}

          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center" style={{ background:'rgba(37,99,235,0.2)', color:'#60a5fa' }}>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Contrato Laboral</p>
                  <p className="text-xs" style={{ color:'rgba(255,255,255,0.4)' }}>{contratoData.tiene_contrato_pdf ? 'PDF generado ✓' : 'Sin PDF generado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {contratoData.tiene_contrato_pdf && (
                  <button type="button" onClick={descargarContratoGuardado} className="px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5" style={{ color:'#60a5fa', background:'rgba(37,99,235,0.12)', border:'1px solid rgba(37,99,235,0.25)' }}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                    Descargar
                  </button>
                )}
                <button type="button" onClick={generarContratoPDF} disabled={hayCambiosContrato || isGeneratingContratoPDF} className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5" style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', opacity: (hayCambiosContrato || isGeneratingContratoPDF) ? 0.4 : 1, cursor: (hayCambiosContrato || isGeneratingContratoPDF) ? 'not-allowed' : 'pointer' }}>
                  {isGeneratingContratoPDF ? (<><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Generando...</>) : (<>{contratoData.tiene_contrato_pdf ? 'Regenerar PDF' : 'Generar PDF'}</>)}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center" style={{ background:'rgba(16,185,129,0.2)', color:'#34d399' }}>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Anexo Ley 40 Horas</p>
                  <p className="text-xs" style={{ color:'rgba(255,255,255,0.4)' }}>{contratoData.tiene_anexo_40h_pdf ? 'PDF generado ✓' : 'Sin PDF generado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {contratoData.tiene_anexo_40h_pdf && (
                  <button type="button" onClick={descargarAnexo40hGuardado} className="px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5" style={{ color:'#34d399', background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.25)' }}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                    Descargar
                  </button>
                )}
                <button type="button" onClick={generarAnexo40hPDF} disabled={hayCambiosContrato || isGeneratingAnexo40hPDF} className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5" style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', opacity: (hayCambiosContrato || isGeneratingAnexo40hPDF) ? 0.4 : 1, cursor: (hayCambiosContrato || isGeneratingAnexo40hPDF) ? 'not-allowed' : 'pointer' }}>
                  {isGeneratingAnexo40hPDF ? (<><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Generando...</>) : (<>{contratoData.tiene_anexo_40h_pdf ? 'Regenerar PDF' : 'Generar PDF'}</>)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>

    {/* ── SECCIÓN ANEXOS DE CONTRATO (fuera del form principal) ── */}
    {contratoData.id && (
      <div className="max-w-4xl mx-auto mt-8 pb-10">
        <div className="p-6 rounded-2xl" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex justify-between items-center pb-4 mb-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <h3 className="text-lg font-bold text-white">5. Anexos de Contrato</h3>
              <p className="text-sm mt-0.5" style={{ color:'rgba(255,255,255,0.4)' }}>Modificaciones contractuales formalizadas por escrito.</p>
            </div>
            {!showAnexoContratoForm && (
              <button
                onClick={() => {
                  setAnexoContratoData({ fecha_emision: new Date().toISOString().split('T')[0], titulo: '', descripcion: '', clausulas_modificadas: [] });
                  setClausulasAnexo([]);
                  setShowAnexoContratoForm(true);
                }}
                className="px-4 py-2 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                style={{ background:'linear-gradient(135deg,#2563eb,#1d4ed8)' }}
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
                  <label className="block text-xs font-semibold mb-1" style={{ color:'rgba(255,255,255,0.4)' }}>Título del Anexo</label>
                  <input type="text" required value={anexoContratoData.titulo || ''} onChange={e => setAnexoContratoData({ ...anexoContratoData, titulo: e.target.value })} placeholder="Ej: Modificación de cargo y remuneración" style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.625rem', padding:'0.625rem 0.75rem', color:'#f8fafc', outline:'none' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color:'rgba(255,255,255,0.4)' }}>Fecha de Emisión</label>
                  <input type="date" required value={anexoContratoData.fecha_emision || ''} onChange={e => setAnexoContratoData({ ...anexoContratoData, fecha_emision: e.target.value })} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.625rem', padding:'0.625rem 0.75rem', color:'#f8fafc', outline:'none', colorScheme:'dark' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color:'rgba(255,255,255,0.4)' }}>Antecedentes (opcional)</label>
                  <textarea rows={2} value={anexoContratoData.descripcion || ''} onChange={e => setAnexoContratoData({ ...anexoContratoData, descripcion: e.target.value })} placeholder="Contexto o motivo del anexo..." style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.5rem', padding:'0.5rem 0.75rem', color:'#f8fafc', outline:'none', resize:'none' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color:'rgba(255,255,255,0.4)' }}>Cláusulas Modificadas</label>
                {clausulasAnexo.map((cl, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <textarea rows={2} value={cl} onChange={e => { const nueva = [...clausulasAnexo]; nueva[i] = e.target.value; setClausulasAnexo(nueva); setAnexoContratoData({ ...anexoContratoData, clausulas_modificadas: nueva }); }} style={{ flex:1, padding:'0.5rem 0.75rem', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.5rem', color:'#f8fafc', outline:'none', resize:'none' }} placeholder="Ej: El cargo del trabajador pasa a ser Jefe de Área..." />
                    <button type="button" onClick={() => { const nueva = clausulasAnexo.filter((_, j) => j !== i); setClausulasAnexo(nueva); setAnexoContratoData({ ...anexoContratoData, clausulas_modificadas: nueva }); }} className="px-3 py-2 rounded-lg font-bold" style={{ background:'rgba(239,68,68,0.1)', color:'#f87171' }}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => { const nueva = [...clausulasAnexo, '']; setClausulasAnexo(nueva); setAnexoContratoData({ ...anexoContratoData, clausulas_modificadas: nueva }); }} className="text-sm font-semibold mt-1" style={{ color:'#60a5fa' }}>
                  + Añadir Cláusula
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAnexoContratoForm(false); setClausulasAnexo([]); }} className="px-4 py-2 text-sm rounded-lg transition-colors" style={{ color:'rgba(255,255,255,0.5)' }} onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.07)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSavingAnexoContrato} className="px-6 py-2 text-white rounded-xl text-sm font-semibold transition-colors" style={{ background:'linear-gradient(135deg,#2563eb,#1d4ed8)', opacity: isSavingAnexoContrato ? 0.5 : 1 }}>
                  {isSavingAnexoContrato ? 'Guardando...' : 'Guardar y Generar PDF'}
                </button>
              </div>
            </form>
          ) : anexosContrato.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color:'rgba(255,255,255,0.3)' }}>No hay anexos de contrato registrados.</p>
          ) : (
            <div className="space-y-2">
              {anexosContrato.map(anexo => {
                const creadoEn = new Date(anexo.creado_en);
                const fechaHora = creadoEn.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  + ' ' + creadoEn.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={anexo.id} className="flex items-center justify-between p-4 rounded-xl transition-colors" style={{ border:'1px solid rgba(255,255,255,0.07)' }} onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.04)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <div>
                      <p className="font-semibold text-sm text-white">{anexo.titulo}</p>
                      <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.4)' }}>Emitido: {anexo.fecha_emision} · Generado: {fechaHora}</p>
                    </div>
                    <button
                      onClick={() => descargarAnexoContratoPDF(anexo.id, anexo.titulo)}
                      className="font-semibold text-sm flex items-center gap-1 transition-colors"
                      style={{ color:'#60a5fa' }}
                      onMouseEnter={e=>(e.currentTarget.style.color='#93c5fd')}
                      onMouseLeave={e=>(e.currentTarget.style.color='#60a5fa')}
                    >
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      PDF
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
