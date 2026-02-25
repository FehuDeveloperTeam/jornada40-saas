import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatRut, validateRut } from '../utils/rutUtils';

interface Empresa {
  id: number;
  nombre_legal: string;
  rut: string;
  alias?: string;
  giro?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  sucursal?: string;
}

export default function LobbyEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Estados para el Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [empresaEditando, setEmpresaEditando] = useState<number | null>(null);
  
  // FormData inicial
  const defaultForm = {
    nombre_legal: '', rut: '', alias: '', giro: '', direccion: '', comuna: '', ciudad: '', sucursal: ''
  };
  const [formData, setFormData] = useState<Partial<Empresa>>(defaultForm);
  const [isValidRut, setIsValidRut] = useState<boolean>(true);
  
  const navigate = useNavigate();
  const apiConfig = { withCredentials: true };

  const fetchEmpresas = async () => {
    try {
      const response = await axios.get('https://jornada40-saas-production.up.railway.app/api/empresas/', apiConfig);
      setEmpresas(response.data);
    } catch (error: any) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, [navigate]);

  const seleccionarEmpresa = (empresaId: number) => {
    localStorage.setItem('empresaActivaId', empresaId.toString());
    navigate('/dashboard'); 
  };

  const cerrarSesion = () => {
    localStorage.removeItem('empresaActivaId');
    navigate('/login');
  };

  const abrirModalCrear = () => {
    setEmpresaEditando(null);
    setFormData(defaultForm);
    setIsValidRut(false);
    setIsModalOpen(true);
  };

  const abrirModalEditar = (e: React.MouseEvent, empresa: Empresa) => {
    e.stopPropagation(); 
    setEmpresaEditando(empresa.id);
    setFormData({ 
      nombre_legal: empresa.nombre_legal, 
      rut: empresa.rut, 
      alias: empresa.alias || '',
      giro: empresa.giro || '',
      direccion: empresa.direccion || '',
      comuna: empresa.comuna || '',
      ciudad: empresa.ciudad || '',
      sucursal: empresa.sucursal || ''
    });
    setIsValidRut(true);
    setIsModalOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'rut') {
      const formateado = formatRut(value);
      setFormData({ ...formData, rut: formateado });
      setIsValidRut(validateRut(formateado));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const guardarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRut || !formData.nombre_legal) return;

    // 🧹 Limpiamos los campos vacíos para que Django no rechace el PATCH/POST
    const payload: any = { ...formData };
    ['alias', 'giro', 'direccion', 'comuna', 'ciudad', 'sucursal'].forEach(field => {
      if (payload[field] === '') delete payload[field];
    });

    try {
      if (empresaEditando) {
        await axios.patch(`https://jornada40-saas-production.up.railway.app/api/empresas/${empresaEditando}/`, payload, apiConfig);
      } else {
        await axios.post('https://jornada40-saas-production.up.railway.app/api/empresas/', payload, apiConfig);
      }
      setIsModalOpen(false);
      setLoading(true);
      fetchEmpresas(); 
    } catch (error: any) {
      console.error("Error al guardar empresa:", error);
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data, null, 2) : "Error desconocido";
      alert(`Django rechazó la operación:\n\n${errorMsg}`);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-6 md:p-10 font-sans relative">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Tus Empresas</h1>
            <p className="text-gray-500 text-lg">Selecciona un espacio de trabajo</p>
          </div>
          <div className="flex gap-4">
            <button onClick={cerrarSesion} className="px-5 py-3 text-gray-500 hover:text-red-500 font-medium transition-colors">Cerrar Sesión</button>
            <button onClick={abrirModalCrear} className="bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition-all shadow-lg flex items-center gap-2">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Nueva Empresa
            </button>
          </div>
        </div>

        {/* LISTA DE EMPRESAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {empresas.map((empresa) => (
            <div key={empresa.id} onClick={() => seleccionarEmpresa(empresa.id)} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl cursor-pointer transition-all group relative overflow-hidden">
              <button onClick={(e) => abrirModalEditar(e, empresa)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Editar datos">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
              </button>

              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold mb-6">
                {empresa.nombre_legal.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1 truncate">{empresa.nombre_legal}</h2>
              {empresa.alias && <p className="text-gray-400 text-sm italic mb-2">"{empresa.alias}"</p>}
              <p className="text-gray-500 font-medium text-sm">RUT: {empresa.rut}</p>
              
              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center text-sm font-semibold text-gray-400 group-hover:text-blue-600 transition-colors">
                <span>Ingresar al panel</span><span className="transform group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= MODAL CREAR/EDITAR ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{empresaEditando ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
            </div>

            <form onSubmit={guardarEmpresa} className="space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social *</label>
                  <input type="text" name="nombre_legal" required value={formData.nombre_legal} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RUT Empresa *</label>
                  <input type="text" name="rut" required value={formData.rut} onChange={handleChange} className={`w-full px-4 py-3 rounded-xl bg-gray-50 border outline-none ${formData.rut!.length > 5 && !isValidRut ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500 focus:bg-white'}`} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alias / Nombre Fantasía</label>
                  <input type="text" name="alias" value={formData.alias} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giro Comercial</label>
                  <input type="text" name="giro" value={formData.giro} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Completa</label>
                  <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comuna</label>
                  <input type="text" name="comuna" value={formData.comuna} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input type="text" name="ciudad" value={formData.ciudad} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal / Casa Matriz</label>
                  <input type="text" name="sucursal" value={formData.sucursal} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 font-medium bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={!isValidRut || !formData.nombre_legal} className="flex-1 py-3 text-white font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-xl transition-colors shadow-md">
                  {empresaEditando ? 'Guardar Cambios' : 'Crear Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}