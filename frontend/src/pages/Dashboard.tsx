import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import type { Empleado } from '../types';
import { FileText, Plus, Users } from 'lucide-react';

export default function Dashboard() {
    // 1. Obtener empleados desde la API
    const { data: empleados, isLoading, error } = useQuery({
        queryKey: ['empleados'],
        queryFn: async () => {
            const { data } = await client.get<Empleado[]>('/empleados/');
            return data;
        }
    });

    // 2. Función para descargar el PDF
    const handleDownloadPdf = async (contratoId: number, nombreEmpleado: string) => {
        try {
            const response = await client.get(`/contratos/${contratoId}/generar_pdf/`, {
                responseType: 'blob' // Importante para descargar archivos binarios
            });
            
            // Crear un link invisible para forzar la descarga en el navegador
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Anexo_40h_${nombreEmpleado}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('Error al generar el PDF. Verifica que el empleado tenga contrato.');
            console.error(err);
        }
    };

    if (isLoading) return <div className="p-10">Cargando datos...</div>;
    if (error) return <div className="p-10 text-red-600">Error al cargar empleados</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header / Navbar simple */}
            <nav className="bg-white shadow-sm border-b px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xl">
                    <Users /> Jornada 40h SaaS
                </div>
                <div className="text-sm text-gray-500">Panel de Administración</div>
            </nav>

            <main className="max-w-6xl mx-auto p-8">
                
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Mis Colaboradores</h1>
                        <p className="text-gray-500">Gestiona los anexos de contrato y turnos.</p>
                    </div>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition">
                        <Plus size={16} /> Nuevo Empleado
                    </button>
                </div>

                {/* Tabla de Empleados */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                            <tr>
                                <th className="p-4 border-b">Nombre</th>
                                <th className="p-4 border-b">RUT</th>
                                <th className="p-4 border-b">Cargo</th>
                                <th className="p-4 border-b">Jornada</th>
                                <th className="p-4 border-b text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {empleados?.map((emp) => (
                                <tr key={emp.id} className="hover:bg-gray-50 transition">
                                    <td className="p-4 font-medium text-gray-900">
                                        {emp.nombres} {emp.apellidos}
                                    </td>
                                    <td className="p-4 text-gray-500">{emp.rut}</td>
                                    <td className="p-4 text-gray-500">{emp.cargo}</td>
                                    <td className="p-4">
                                        {emp.contrato_activo ? (
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                                                {emp.contrato_activo.horas_semanales} Horas
                                            </span>
                                        ) : (
                                            <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs">
                                                Sin Contrato
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        {emp.contrato_activo && (
                                            <button 
                                                onClick={() => handleDownloadPdf(emp.contrato_activo!.id, emp.apellidos)}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center gap-1"
                                                title="Descargar Anexo Legal"
                                            >
                                                <FileText size={16} /> Anexo PDF
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            
                            {empleados?.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">
                                        No hay empleados registrados aún.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}