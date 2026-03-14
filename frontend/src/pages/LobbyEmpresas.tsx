import { useState, useEffect } from 'react';
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
    } catch (error) {
      // Reemplazamos el 'any' preguntándole a TS si el error es de Axios
      if (axios.isAxiosError(error) && error.response && (error.response.status === 401 || error.response.status === 403)) {
        navigate('/login');
      }
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

    // En lugar de 'any', usamos Record<string, unknown> que es el estándar estricto
    const payload: Record<string, unknown> = { ...formData } as Record<string, unknown>;
    
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
    } catch (error) {
      console.error("Error al guardar empresa:", error);
      
      // Manejo estricto del error sin usar 'any'
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data ? JSON.stringify(error.response.data, null, 2) : "Error desconocido";
        alert(`Django rechazó la operación:\n\n${errorMsg}`);
      } else {
        alert("Ocurrió un error desconocido al guardar la empresa.");
      }
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans relative overflow-hidden selection:bg-blue-100 selection:text-blue-900">
      
      {/* ========================================== */}
      {/* FONDOS ABSTRACTOS (ESTILO 2026)            */}
      {/* ========================================== */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wNSkiLz48L3N2Zz4=')] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] opacity-60"></div>
        <div className="absolute -top-40 w-[800px] h-[400px] bg-blue-500/10 blur-[100px] rounded-[100%]"></div>
      </div>

      {/* ========================================== */}
      {/* TOP BAR / NAVEGACIÓN                       */}
      {/* ========================================== */}
      <div className="relative z-20 w-full px-6 py-6 md:px-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* Izquierda: Botón Cerrar Sesión */}
        <button 
          onClick={cerrarSesion} 
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors group outline-none rounded-lg pr-2"
        >
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all group-hover:-translate-x-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
          </div>
          Cerrar Sesión
        </button>

        {/* Derecha: Badge de Seguridad y Botón Nueva Empresa */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-slate-400 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <span className="text-xs font-bold tracking-widest uppercase text-slate-500">Conexión Segura</span>
          </div>
          <button 
            onClick={abrirModalCrear} 
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10 flex items-center gap-2 group"
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 group-hover:scale-110 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Nueva Empresa
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* CONTENIDO PRINCIPAL                        */}
      {/* ========================================== */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <div className="mb-12 mt-6">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-[1rem] flex items-center justify-center mb-6 shadow-xl shadow-slate-900/20 ring-1 ring-slate-900/5">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-3">Tus Empresas</h1>
          <p className="text-slate-500 text-lg">Selecciona un espacio de trabajo para administrar su personal.</p>
        </div>

        {/* GRID DE EMPRESAS */}
        {empresas.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-xl border border-white p-12 rounded-[2rem] text-center shadow-sm">
            <p className="text-slate-500 font-medium text-lg">Aún no tienes empresas registradas.</p>
            <button onClick={abrirModalCrear} className="mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors">
              + Crea tu primera empresa aquí
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {empresas.map((empresa) => (
              <div 
                key={empresa.id} 
                onClick={() => seleccionarEmpresa(empresa.id)} 
                className="bg-white/80 backdrop-blur-2xl p-8 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 cursor-pointer transition-all duration-300 group relative"
              >
                {/* Botón Editar Empresa */}
                <button 
                  onClick={(e) => abrirModalEditar(e, empresa)} 
                  className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all opacity-0 group-hover:opacity-100" 
                  title="Editar datos"
                >
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                </button>

                {/* Avatar Empresa */}
                <div className="w-14 h-14 bg-slate-100 text-slate-900 rounded-[1.2rem] flex items-center justify-center text-2xl font-bold mb-6 border border-slate-200/50 shadow-sm group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  {empresa.nombre_legal.charAt(0).toUpperCase()}
                </div>
                
                {/* Info Empresa */}
                <h2 className="text-xl font-extrabold text-slate-900 mb-1 truncate">{empresa.nombre_legal}</h2>
                {empresa.alias && <p className="text-slate-500 text-sm font-medium mb-3 truncate">"{empresa.alias}"</p>}
                
                <div className="flex items-center gap-2 mt-4">
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-md tracking-wide">
                    RUT: {empresa.rut}
                  </span>
                </div>
                
                {/* Flecha inferior */}
                <div className="mt-8 pt-5 border-t border-slate-100 flex justify-between items-center text-sm font-bold text-slate-400 group-hover:text-slate-900 transition-colors">
                  <span>Abrir Dashboard</span>
                  <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* MODAL CREAR / EDITAR EMPRESA               */}
      {/* ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Fondo oscuro con Blur */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative bg-white rounded-[2rem] p-8 sm:p-10 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto border border-slate-100">
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {empresaEditando ? 'Editar Razón Social' : 'Registrar Empresa'}
                </h2>
                <p className="text-sm text-slate-500 mt-1 font-medium">Completa los datos legales para los contratos.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={guardarEmpresa} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Razón Social *</label>
                  <input type="text" name="nombre_legal" required value={formData.nombre_legal} onChange={handleChange} className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none font-medium text-slate-900 transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">RUT Empresa *</label>
                  <input type="text" name="rut" required value={formData.rut} onChange={handleChange} className={`w-full px-4 py-3.5 rounded-xl bg-slate-50 border outline-none font-medium transition-all ${formData.rut!.length > 5 && !isValidRut ? 'border-red-300 focus:ring-red-400 text-red-900' : 'border-slate-200 focus:ring-slate-900 focus:bg-white text-slate-900'}`} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre Fantasía</label>
                  <input type="text" name="alias" value={formData.alias} onChange={handleChange} className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none font-medium text-slate-900 transition-all" />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Giro Comercial</label>
                  <input type="text" name="giro" value={formData.giro} onChange={handleChange} className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none font-medium text-slate-900 transition-all" />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dirección Completa</label>
                  <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none font-medium text-slate-900 transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Comuna</label>
                  <input type="text" name="comuna" value={formData.comuna} onChange={handleChange} className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none font-medium text-slate-900 transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ciudad</label>
                  <input type="text" name="ciudad" value={formData.ciudad} onChange={handleChange} className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none font-medium text-slate-900 transition-all" />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sucursal / Casa Matriz</label>
                  <input type="text" name="sucursal" value={formData.sucursal} onChange={handleChange} className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none font-medium text-slate-900 transition-all" />
                </div>
              </div>

              <div className="pt-6 mt-8 border-t border-slate-100 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-600 font-bold bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={!isValidRut || !formData.nombre_legal} className="flex-1 py-4 text-white font-bold bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 rounded-xl transition-all shadow-md shadow-slate-900/10">
                  {empresaEditando ? 'Guardar Cambios' : 'Registrar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}