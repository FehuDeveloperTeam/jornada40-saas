import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function LobbyEmpresas() {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Función para buscar las empresas del usuario logueado
    const fetchEmpresas = async () => {
      try {
        const response = await axios.get('https://jornada40-saas-production.up.railway.app/api/empresas/', {
          withCredentials: true // Vital para que el backend sepa quién es el usuario
        });
        setEmpresas(response.data);
      } catch (error) {
        console.error('Error al cargar las empresas:', error);
        // Si el backend responde que no estamos autorizados (401 o 403), lo devolvemos al login
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresas();
  }, [navigate]);

  const seleccionarEmpresa = (empresaId) => {
    // 1. Guardamos el ID de la empresa seleccionada en la memoria del navegador
    localStorage.setItem('empresaActivaId', empresaId);
    
    // 2. Viajamos mágicamente al Dashboard de esta empresa
    navigate('/dashboard'); 
  };

  const cerrarSesion = () => {
    // Limpiamos la memoria y lo mandamos al login
    localStorage.removeItem('empresaActivaId');
    // Idealmente aquí también harías un POST a /api/auth/logout/ en el backend
    navigate('/login');
  };

  // Pantalla de carga estilo 2026 (suave y minimalista)
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex items-center justify-center">
        <div className="flex flex-col items-center animate-pulse">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium tracking-wide">Cargando tus espacios de trabajo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Tus Empresas</h1>
            <p className="text-gray-500 text-lg font-light">Selecciona un espacio de trabajo para continuar</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={cerrarSesion}
              className="px-5 py-3 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl font-medium transition-colors duration-300"
            >
              Cerrar Sesión
            </button>
            <button className="bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition-all duration-300 transform active:scale-95 shadow-lg shadow-gray-300">
              + Nueva Empresa
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        {empresas.length === 0 ? (
          <div className="text-center py-24 bg-white/60 backdrop-blur-xl rounded-3xl border border-dashed border-gray-300 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">🏢</span>
            </div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-2">Aún no tienes empresas registradas</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto font-light">
              Para comenzar a gestionar los contratos y la jornada de 40 horas, primero debes crear el perfil de tu empresa.
            </p>
            <button className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-all duration-300 shadow-lg shadow-blue-200 transform active:scale-95">
              Crear mi primera empresa
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {empresas.map((empresa) => (
              <div 
                key={empresa.id}
                onClick={() => seleccionarEmpresa(empresa.id)}
                className="bg-white/80 backdrop-blur-lg p-8 rounded-3xl border border-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 cursor-pointer transition-all duration-300 group"
              >
                {/* Ícono de la empresa basado en su primera letra */}
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                  {empresa.nombre_legal.charAt(0).toUpperCase()}
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-1 truncate" title={empresa.nombre_legal}>
                  {empresa.nombre_legal}
                </h2>
                <p className="text-gray-500 font-medium text-sm">RUT: {empresa.rut}</p>
                
                {/* Pie de la tarjeta */}
                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center text-sm font-semibold text-gray-400 group-hover:text-blue-600 transition-colors duration-300">
                  <span>Ingresar al panel</span>
                  <span className="text-lg transform group-hover:translate-x-1 transition-transform duration-300">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}