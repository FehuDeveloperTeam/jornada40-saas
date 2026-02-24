import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// 1. Tipos de TypeScript
interface Empresa {
  id: number;
  nombre_legal: string;
  rut: string;
  giro: string;
}

interface Empleado {
  id: number;
  rut: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  activo: boolean;
  empresa: number; // ID de la empresa a la que pertenece
}

export default function Dashboard() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    // Leemos el ID de la empresa que el usuario eligió en el Lobby
    const empresaActivaId = localStorage.getItem('empresaActivaId');

    // Si por alguna razón entró directo aquí sin elegir empresa, lo devolvemos
    if (!empresaActivaId) {
      navigate('/empresas');
      return;
    }

    const fetchData = async () => {
      try {
        const config = { withCredentials: true };

        // Traemos UNA sola empresa (la seleccionada) y TODOS los empleados
        const [empresaRes, empleadosRes] = await Promise.all([
          axios.get(`https://jornada40-saas-production.up.railway.app/api/empresas/${empresaActivaId}/`, config),
          axios.get('https://jornada40-saas-production.up.railway.app/api/empleados/', config)
        ]);

        setEmpresa(empresaRes.data);
        
        // Filtramos para asegurarnos de mostrar SOLO los empleados de esta empresa específica
        const empleadosFiltrados = empleadosRes.data.filter(
          (emp: Empleado) => emp.empresa === parseInt(empresaActivaId)
        );
        setEmpleados(empleadosFiltrados);

      } catch (error) {
        console.error('Error al cargar el Dashboard:', error);
        // Si hay error de permisos, lo mandamos al login
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const volverAlLobby = () => {
    localStorage.removeItem('empresaActivaId');
    navigate('/empresas');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* BARRA SUPERIOR DE NAVEGACIÓN */}
        <div className="flex justify-between items-center mb-8">
          <button 
            onClick={volverAlLobby}
            className="text-gray-500 hover:text-gray-900 flex items-center gap-2 font-medium transition-colors"
          >
            <span>←</span> Cambiar de Empresa
          </button>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
              {empresa?.nombre_legal.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* SECCIÓN 1: Datos de la Empresa */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                {empresa ? empresa.nombre_legal : 'Mi Empresa'}
              </h1>
              {empresa && (
                <div className="flex gap-4 mt-3 text-sm text-gray-500 font-medium">
                  <span className="bg-gray-100 px-3 py-1 rounded-lg">RUT: {empresa.rut}</span>
                  <span className="bg-gray-100 px-3 py-1 rounded-lg">Giro: {empresa.giro}</span>
                </div>
              )}
            </div>
            
          </div>
        </div>

        {/* SECCIÓN 2: Tabla de Empleados */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Directorio de Empleados</h2>
              <p className="text-sm text-gray-500 mt-1">Total registrados: {empleados.length}</p>
            </div>
            <button className="bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition shadow-lg transform active:scale-95">
              + Nuevo Empleado
            </button>
          </div>

          {empleados.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <p className="text-gray-500 font-medium mb-4">Aún no tienes empleados en esta empresa.</p>
              <button className="text-blue-600 font-semibold hover:underline">
                Agrega tu primer trabajador aquí
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">RUT</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Nombre Completo</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Cargo</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((emp) => (
                    <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-mono text-sm text-gray-600">{emp.rut}</td>
                      <td className="p-4 font-medium text-gray-900">{emp.nombres} {emp.apellidos}</td>
                      <td className="p-4 text-gray-600">{emp.cargo}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          emp.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {emp.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button className="text-blue-600 font-medium hover:text-blue-800 text-sm">
                          Ver Perfil →
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
    </div>
  );
}