import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Dashboard() {
  const [empresa, setEmpresa] = useState(null);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Función para ir a buscar todos los datos al backend
    const fetchData = async () => {
      try {
        const config = {
          withCredentials: true // ¡Vital para enviar la cookie de sesión!
        };

        // Hacemos las dos peticiones al mismo tiempo para que cargue más rápido
        const [empresaRes, empleadosRes] = await Promise.all([
          axios.get('https://jornada40-saas-production.up.railway.app/api/empresas/', config),
          axios.get('https://jornada40-saas-production.up.railway.app/api/empleados/', config)
        ]);

        // Como el backend devuelve una lista (aunque sea solo 1 empresa), tomamos la primera [0]
        if (empresaRes.data.length > 0) {
          setEmpresa(empresaRes.data[0]);
        }
        // Guardamos la lista de empleados
        setEmpleados(empleadosRes.data);

      } catch (error) {
        console.error('Error al cargar los datos del Dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-10 text-center text-xl">Cargando tu espacio de trabajo... ⏳</div>;
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* SECCIÓN 1: Datos de la Empresa */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          {empresa ? empresa.nombre_legal : 'Bienvenido a Jornada 40h SaaS'}
        </h1>
        {empresa && (
          <p className="text-gray-500 mt-2">
            RUT: {empresa.rut} | Giro: {empresa.giro}
          </p>
        )}
      </div>

      {/* SECCIÓN 2: Tabla de Empleados */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-700">Tus Empleados</h2>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
            + Nuevo Empleado
          </button>
        </div>

        {empleados.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Aún no tienes empleados registrados.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3">RUT</th>
                <th className="p-3">Nombre Completo</th>
                <th className="p-3">Cargo</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((emp) => (
                <tr key={emp.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{emp.rut}</td>
                  <td className="p-3">{emp.nombres} {emp.apellidos}</td>
                  <td className="p-3">{emp.cargo}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs text-white ${emp.activo ? 'bg-green-500' : 'bg-red-500'}`}>
                      {emp.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="p-3 text-blue-600 cursor-pointer hover:underline">
                    Ver Contrato
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
