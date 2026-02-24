import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatRut, validateRut } from '../utils/rutUtils';

// --- TIPOS ---
interface Empresa {
  id: number;
  nombre_legal: string;
  rut: string;
  giro?: string;
}

interface Empleado {
  id: number;
  rut: string;
  nombres: string;
  apellidos: string;
  sexo?: string;
  fecha_nacimiento?: string;
  nacionalidad?: string;
  estado_civil?: string;
  comuna?: string;
  departamento?: string;
  cargo: string;
  sucursal?: string;
  modalidad?: string;
  sueldo_base?: number;
  afp?: string;
  sistema_salud?: string;
  fecha_ingreso?: string;
  activo: boolean;
  empresa: number;
}

export default function Dashboard() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Estados del Panel Lateral (Slide-over)
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [isValidRut, setIsValidRut] = useState<boolean>(true);

  // Formulario temporal
  const [formData, setFormData] = useState<Partial<Empleado>>({});

  const navigate = useNavigate();
  const apiConfig = { withCredentials: true };
  const empresaActivaId = localStorage.getItem('empresaActivaId');

  const fetchData = async () => {
    if (!empresaActivaId) {
      navigate('/empresas');
      return;
    }
    try {
      const [empresaRes, empleadosRes] = await Promise.all([
        axios.get(`https://jornada40-saas-production.up.railway.app/api/empresas/${empresaActivaId}/`, apiConfig),
        axios.get('https://jornada40-saas-production.up.railway.app/api/empleados/', apiConfig)
      ]);
      setEmpresa(empresaRes.data);
      const empleadosFiltrados = empleadosRes.data.filter(
        (emp: Empleado) => emp.empresa === parseInt(empresaActivaId)
      );
      setEmpleados(empleadosFiltrados);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const volverAlLobby = () => {
    localStorage.removeItem('empresaActivaId');
    navigate('/empresas');
  };

  // --- LÓGICA DEL PANEL ---
  const abrirCrear = () => {
    setPanelMode('create');
    setFormData({ 
      activo: true, 
      nacionalidad: 'Chilena', 
      modalidad: 'PRESENCIAL',
      empresa: parseInt(empresaActivaId!) 
    });
    setIsValidRut(false);
    setIsPanelOpen(true);
  };

  const abrirVer = (emp: Empleado) => {
    setSelectedEmpleado(emp);
    setPanelMode('view');
    setIsPanelOpen(true);
  };

  const abrirEditar = (emp: Empleado) => {
    setSelectedEmpleado(emp);
    setFormData({ ...emp });
    setIsValidRut(true);
    setPanelMode('edit');
    setIsPanelOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (name === 'rut') {
      const formateado = formatRut(value);
      setFormData(prev => ({ ...prev, rut: formateado }));
      setIsValidRut(validateRut(formateado));
    } else {
      setFormData(prev => ({
        ...prev,
        // Si es un checkbox (como activo/inactivo), guardamos el boolean
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
  };

  const guardarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRut || !formData.nombres || !formData.apellidos) return;

    try {
      if (panelMode === 'edit' && selectedEmpleado) {
        await axios.put(`https://jornada40-saas-production.up.railway.app/api/empleados/${selectedEmpleado.id}/`, formData, apiConfig);
      } else {
        await axios.post('https://jornada40-saas-production.up.railway.app/api/empleados/', formData, apiConfig);
      }
      setIsPanelOpen(false);
      setLoading(true);
      fetchData(); // Recargar la tabla
    } catch (error) {
      console.error("Error al guardar empleado:", error);
      alert("Error al guardar. Revisa que todos los campos obligatorios estén llenos.");
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>;

  return (
    <div className="p-6 md:p-10 bg-gray-50 min-h-screen font-sans flex">
      <div className={`max-w-7xl mx-auto w-full transition-all duration-300 ${isPanelOpen ? 'md:mr-[400px]' : ''}`}>
        
        {/* NAVEGACIÓN */}
        <div className="flex justify-between items-center mb-8">
          <button onClick={volverAlLobby} className="text-gray-500 hover:text-gray-900 flex items-center gap-2 font-medium transition-colors">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
            Cambiar de Empresa
          </button>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
              {empresa?.nombre_legal.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* HEADER EMPRESA */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{empresa?.nombre_legal}</h1>
          <div className="flex gap-4 mt-3 text-sm text-gray-500 font-medium">
            <span className="bg-gray-100 px-3 py-1 rounded-lg">RUT: {empresa?.rut}</span>
            {empresa?.giro && <span className="bg-gray-100 px-3 py-1 rounded-lg">Giro: {empresa.giro}</span>}
          </div>
        </div>

        {/* TABLA DE EMPLEADOS */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Directorio de Empleados</h2>
              <p className="text-sm text-gray-500 mt-1">Total registrados: {empleados.length}</p>
            </div>
            <button onClick={abrirCrear} className="bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition shadow-lg flex items-center gap-2">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Nuevo Empleado
            </button>
          </div>

          {empleados.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <p className="text-gray-500 font-medium mb-4">Aún no tienes empleados en esta empresa.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase">RUT</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase">Nombre</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase">Cargo</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase">Estado</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((emp) => (
                    <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                      <td className="p-4 font-mono text-sm text-gray-600">{emp.rut}</td>
                      <td className="p-4 font-medium text-gray-900">{emp.nombres} {emp.apellidos}</td>
                      <td className="p-4 text-gray-600">{emp.cargo}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${emp.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {emp.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-4 text-right flex justify-end gap-3">
                        {/* BOTÓN VER (OJO) */}
                        <button onClick={() => abrirVer(emp)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver Perfil">
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                        </button>
                        {/* BOTÓN EDITAR (LÁPIZ) */}
                        <button onClick={() => abrirEditar(emp)} className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="Editar Trabajador">
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ================= SLIDE-OVER PANEL (Lateral) ================= */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Fondo oscuro translúcido */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setIsPanelOpen(false)}></div>
          
          <div className="absolute inset-y-0 right-0 max-w-md w-full flex">
            <div className="h-full w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300 translate-x-0">
              
              {/* HEADER DEL PANEL */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-xl font-bold text-gray-900">
                  {panelMode === 'create' ? 'Nuevo Trabajador' : panelMode === 'edit' ? 'Editar Trabajador' : 'Perfil del Trabajador'}
                </h2>
                <div className="flex items-center gap-2">
                  {/* Botón rápido de editar dentro de la vista de perfil */}
                  {panelMode === 'view' && selectedEmpleado && (
                    <button onClick={() => abrirEditar(selectedEmpleado)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Cambiar a modo edición">
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                    </button>
                  )}
                  <button onClick={() => setIsPanelOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* BODY DEL PANEL (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6">
                
                {/* MODO LECTURA (VIEW) */}
                {panelMode === 'view' && selectedEmpleado ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
                        {selectedEmpleado.nombres.charAt(0)}{selectedEmpleado.apellidos.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{selectedEmpleado.nombres} {selectedEmpleado.apellidos}</h3>
                        <p className="text-gray-500">{selectedEmpleado.cargo}</p>
                        <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${selectedEmpleado.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {selectedEmpleado.activo ? 'Vigente' : 'Desvinculado'}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Datos Personales</h4>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                        <div><dt className="text-gray-500">RUT</dt><dd className="font-medium text-gray-900 font-mono">{selectedEmpleado.rut}</dd></div>
                        <div><dt className="text-gray-500">Nacionalidad</dt><dd className="font-medium text-gray-900">{selectedEmpleado.nacionalidad || '-'}</dd></div>
                        <div><dt className="text-gray-500">Fecha Nac.</dt><dd className="font-medium text-gray-900">{selectedEmpleado.fecha_nacimiento || '-'}</dd></div>
                        <div><dt className="text-gray-500">Comuna</dt><dd className="font-medium text-gray-900">{selectedEmpleado.comuna || '-'}</dd></div>
                      </dl>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 mt-6">Datos Laborales</h4>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                        <div><dt className="text-gray-500">Departamento</dt><dd className="font-medium text-gray-900">{selectedEmpleado.departamento || '-'}</dd></div>
                        <div><dt className="text-gray-500">Fecha Ingreso</dt><dd className="font-medium text-gray-900">{selectedEmpleado.fecha_ingreso || '-'}</dd></div>
                        <div><dt className="text-gray-500">Modalidad</dt><dd className="font-medium text-gray-900">{selectedEmpleado.modalidad || '-'}</dd></div>
                        <div><dt className="text-gray-500">Sueldo Base</dt><dd className="font-medium text-gray-900">${selectedEmpleado.sueldo_base?.toLocaleString('es-CL') || '0'}</dd></div>
                        <div><dt className="text-gray-500">AFP</dt><dd className="font-medium text-gray-900">{selectedEmpleado.afp || '-'}</dd></div>
                        <div><dt className="text-gray-500">Previsión Salud</dt><dd className="font-medium text-gray-900">{selectedEmpleado.sistema_salud || '-'}</dd></div>
                      </dl>
                    </div>
                  </div>
                ) : (
                  
                  /* MODO EDICIÓN / CREACIÓN (FORMULARIO) */
                  <form id="empleadoForm" onSubmit={guardarEmpleado} className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2">Datos Personales</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
                          <input type="text" name="rut" required value={formData.rut || ''} onChange={handleInputChange} placeholder="12.345.678-9" 
                                 className={`w-full px-3 py-2 rounded-lg border ${!isValidRut && formData.rut ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500'} focus:outline-none focus:ring-2`} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
                          <input type="text" name="nombres" required value={formData.nombres || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                          <input type="text" name="apellidos" required value={formData.apellidos || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">F. Nacimiento</label>
                          <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                          <select name="sexo" value={formData.sexo || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                            <option value="">Seleccione...</option>
                            <option value="M">Masculino</option>
                            <option value="F">Femenino</option>
                            <option value="O">Otro</option>
                          </select>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2 pt-4">Datos Laborales</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                          <input type="text" name="cargo" required value={formData.cargo || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">F. Ingreso</label>
                          <input type="date" name="fecha_ingreso" required value={formData.fecha_ingreso || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
                          <select name="modalidad" value={formData.modalidad || 'PRESENCIAL'} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                            <option value="PRESENCIAL">Presencial</option>
                            <option value="REMOTO">Remoto</option>
                            <option value="HIBRIDO">Híbrido</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">AFP</label>
                          <input type="text" name="afp" value={formData.afp || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sistema Salud</label>
                          <select name="sistema_salud" value={formData.sistema_salud || ''} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                            <option value="">Seleccione...</option>
                            <option value="FONASA">Fonasa</option>
                            <option value="ISAPRE">Isapre</option>
                          </select>
                        </div>
                        <div className="col-span-2 flex items-center gap-2 mt-2">
                          <input type="checkbox" id="activo" name="activo" checked={formData.activo} onChange={handleInputChange} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                          <label htmlFor="activo" className="text-sm font-medium text-gray-700">Trabajador Vigente (Activo)</label>
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {/* FOOTER DEL PANEL (Botones) */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                {panelMode === 'view' ? (
                  <button onClick={() => setIsPanelOpen(false)} className="px-5 py-2 text-gray-700 font-medium bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors">
                    Cerrar
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => setIsPanelOpen(false)} className="px-5 py-2 text-gray-600 font-medium bg-transparent hover:bg-gray-200 rounded-xl transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" form="empleadoForm" disabled={!isValidRut} className="px-5 py-2 text-white font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-xl transition-colors shadow-md">
                      {panelMode === 'create' ? 'Crear Trabajador' : 'Guardar Cambios'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}