import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { Empresa } from '../types';
import { ArrowLeft, Save, AlertCircle, UserPlus } from 'lucide-react';

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.75rem',
  padding: '0.875rem 1rem',
  color: '#f8fafc',
  fontFamily: 'Poppins, sans-serif',
  fontSize: '0.9375rem',
  outline: 'none',
};

export default function CrearEmpleado() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [formData, setFormData] = useState({
    rut: '',
    nombres: '',
    apellidos: '',
    cargo: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    empresa: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    client.get<Empresa[]>('/empresas/')
      .then(res => {
        setEmpresas(res.data);
        if (res.data.length > 0) {
          setFormData(prev => ({ ...prev, empresa: res.data[0].id.toString() }));
        }
      })
      .catch(() => setError('No se pudieron cargar las empresas.'));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await client.post('/empleados/', formData);
      navigate('/dashboard');
    } catch {
      setError('Error al crear el empleado. Verifica los datos.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ background: '#060f20' }}>

      {/* Orbes */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-2xl relative z-10 animate-fade-up">

        {/* Volver */}
        <button onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm font-medium mb-8 transition-colors group"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="group-hover:text-white transition-colors">Volver al Dashboard</span>
        </button>

        {/* Cabecera */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 20px rgba(37,99,235,0.35)' }}>
            <UserPlus size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Nuevo Colaborador</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Completa los datos básicos del trabajador</p>
          </div>
        </div>

        {/* Tarjeta */}
        <div className="rounded-3xl p-8 glass-card">

          {error && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium mb-6"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
              <AlertCircle size={18} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Empresa */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Empresa
              </label>
              <select name="empresa" value={formData.empresa} onChange={handleChange} required
                style={{ ...inputStyle, cursor: 'pointer' }}>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id} style={{ background: '#0c1a35' }}>
                    {emp.nombre_legal}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Nombres
                </label>
                <input type="text" name="nombres" required value={formData.nombres} onChange={handleChange} style={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Apellidos
                </label>
                <input type="text" name="apellidos" required value={formData.apellidos} onChange={handleChange} style={inputStyle} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  RUT
                </label>
                <input type="text" name="rut" placeholder="12.345.678-9" required value={formData.rut} onChange={handleChange} style={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Fecha de Ingreso
                </label>
                <input type="date" name="fecha_ingreso" required value={formData.fecha_ingreso} onChange={handleChange}
                  style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Cargo
              </label>
              <input type="text" name="cargo" placeholder="Ej: Desarrollador Full Stack" required
                value={formData.cargo} onChange={handleChange} style={inputStyle} />
            </div>

            <div className="pt-2">
              <button type="submit" className="btn-primary">
                <Save size={16} /> Guardar Empleado
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
