import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { Empresa } from '../types';
import { ArrowLeft, Save } from 'lucide-react';

export default function CrearEmpleado() {
    const navigate = useNavigate();
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [formData, setFormData] = useState({
        rut: '',
        nombres: '',
        apellidos: '',
        cargo: '',
        fecha_ingreso: new Date().toISOString().split('T')[0], // Fecha de hoy por defecto
        empresa: '', // ID de la empresa seleccionada
    });
    const [error, setError] = useState('');

    // 1. Cargar las empresas del usuario al iniciar
    useEffect(() => {
        client.get<Empresa[]>('/empresas/')
            .then(res => {
                setEmpresas(res.data);
                // Si existe al menos una empresa, pre-seleccionamos la primera
                if (res.data.length > 0) {
                    setFormData(prev => ({ ...prev, empresa: res.data[0].id.toString() }));
                }
            })
            .catch(err => {
                setError('No se pudieron cargar las empresas.');
                console.error(err);
            });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    // CORRECCIÓN AQUÍ: Se especifica <HTMLFormElement> para evitar el error de deprecación
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            await client.post('/empleados/', formData);
            navigate('/dashboard'); // Volver al panel si sale bien
        } catch (err) {
            setError('Error al crear el empleado. Verifica los datos.');
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-700">
                        <ArrowLeft />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">Nuevo Colaborador</h1>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Selección de Empresa */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                        <select 
                            name="empresa" 
                            value={formData.empresa} 
                            onChange={handleChange}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border"
                            required
                        >
                            {empresas.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.nombre_legal}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
                            <input 
                                type="text" name="nombres" required
                                value={formData.nombres} onChange={handleChange}
                                className="w-full border-gray-300 rounded-lg shadow-sm p-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                            <input 
                                type="text" name="apellidos" required
                                value={formData.apellidos} onChange={handleChange}
                                className="w-full border-gray-300 rounded-lg shadow-sm p-2 border"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
                            <input 
                                type="text" name="rut" placeholder="12.345.678-9" required
                                value={formData.rut} onChange={handleChange}
                                className="w-full border-gray-300 rounded-lg shadow-sm p-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso</label>
                            <input 
                                type="date" name="fecha_ingreso" required
                                value={formData.fecha_ingreso} onChange={handleChange}
                                className="w-full border-gray-300 rounded-lg shadow-sm p-2 border"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                        <input 
                            type="text" name="cargo" placeholder="Ej: Desarrollador Full Stack" required
                            value={formData.cargo} onChange={handleChange}
                            className="w-full border-gray-300 rounded-lg shadow-sm p-2 border"
                        />
                    </div>

                    <div className="pt-4">
                        <button 
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                        >
                            <Save size={18} /> Guardar Empleado
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}