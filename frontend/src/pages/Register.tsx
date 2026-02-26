import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { formatRut, validateRut } from '../utils/rutUtils';
import axios from 'axios';

// --- DEFINICIÓN DE PLANES (Front-end mock) ---
const PLANES = [
  {
    id: 1,
    nombre: 'Semilla',
    precio: '0',
    descripcion: 'Ideal para dar el primer paso hacia el cumplimiento de la Ley de 40 Horas sin costo inicial.',
    empresas: 1,
    trabajadores: 3,
    color: 'bg-green-50 text-green-700 border-green-200 ring-green-500',
    boton: 'Comenzar Gratis'
  },
  {
    id: 2,
    nombre: 'Pyme',
    precio: '29.990',
    descripcion: 'La solución definitiva para automatizar la transición de tu plantilla laboral a la normativa.',
    empresas: 3,
    trabajadores: 40,
    color: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-600',
    boton: 'Elegir Plan Pyme',
    destacado: true
  },
  {
    id: 3,
    nombre: 'Corporativo',
    precio: '69.990',
    descripcion: 'Herramienta robusta para holdings o asesores con múltiples razones sociales.',
    empresas: 10,
    trabajadores: 150,
    color: 'bg-gray-50 text-gray-800 border-gray-200 ring-gray-900',
    boton: 'Elegir Corporativo'
  }
];

export default function Register() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [planSeleccionado, setPlanSeleccionado] = useState<number | null>(null);
  
  // Estado del formulario
  const [tipoCliente, setTipoCliente] = useState<'PERSONA' | 'EMPRESA'>('PERSONA');
  const [formData, setFormData] = useState({
    rut: '',
    email: '',
    password: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    razon_social: '',
    telefono: '',
    direccion: ''
  });
  const [isValidRut, setIsValidRut] = useState(true);

  const handleSeleccionarPlan = (id: number) => {
    setPlanSeleccionado(id);
    setPaso(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'rut') {
      const formateado = formatRut(value);
      setFormData({ ...formData, rut: formateado });
      setIsValidRut(validateRut(formateado));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRut) return;

    // Bloqueamos el botón mientras carga (opcional, pero buena práctica)
    const btn = document.getElementById('btn-submit') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Creando cuenta...';
    }

    const payload = {
      ...formData,
      tipoCliente,
      planId: planSeleccionado
    };

    try {
      // Usamos tu URL de Railway o localhost dependiendo de tu entorno
      await axios.post('https://jornada40-saas-production.up.railway.app/api/auth/register/', payload);
      
      alert('¡Cuenta creada con éxito! Ahora puedes iniciar sesión.');
      navigate('/login');
      
    } catch (error: any) {
      console.error("Error en registro:", error);
      const errorMsg = error.response?.data?.error || "Ocurrió un error al crear la cuenta.";
      alert(`Error: ${errorMsg}`);
      
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Crear mi Cuenta';
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* HEADER BÁSICO */}
      <div className="max-w-7xl mx-auto mb-12 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
          Jornada<span className="text-blue-600">40</span>
        </h1>
        <p className="text-lg text-gray-500">
          {paso === 1 ? 'Elige el plan perfecto para tu empresa' : 'Crea tu cuenta y comienza a automatizar'}
        </p>
      </div>

      {/* PASO 1: SELECCIÓN DE PLANES */}
      {paso === 1 && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANES.map((plan) => (
            <div 
              key={plan.id} 
              className={`relative bg-white rounded-3xl p-8 border-2 transition-all duration-300 hover:shadow-xl ${plan.destacado ? 'border-blue-600 shadow-lg scale-105' : 'border-gray-100 hover:border-gray-300'}`}
            >
              {plan.destacado && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
                  Más Elegido
                </div>
              )}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.nombre}</h3>
              <p className="text-gray-500 text-sm h-16 mb-6">{plan.descripcion}</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-gray-900">${plan.precio}</span>
                {plan.precio !== '0' && <span className="text-gray-500 font-medium">/mes</span>}
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  Hasta {plan.empresas} {plan.empresas === 1 ? 'Empresa' : 'Empresas'} (RUTs)
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  Hasta {plan.trabajadores} Trabajadores en total
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  Generación de Anexos PDF
                </li>
              </ul>
              
              <button 
                onClick={() => handleSeleccionarPlan(plan.id)}
                className={`w-full py-3 px-6 rounded-xl font-bold transition-colors ${plan.destacado ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
              >
                {plan.boton}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* PASO 2: FORMULARIO DE REGISTRO */}
      {paso === 2 && (
        <div className="max-w-2xl mx-auto bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Detalles de la Cuenta</h2>
              <p className="text-sm text-gray-500 mt-1">
                Has seleccionado el <span className="font-bold text-blue-600">Plan {PLANES.find(p => p.id === planSeleccionado)?.nombre}</span>.
              </p>
            </div>
            <button onClick={() => setPaso(1)} className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
              Cambiar Plan
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* SELECTOR DE TIPO DE CLIENTE */}
            <div className="bg-gray-50 p-1.5 rounded-xl flex gap-2 mb-6">
              <button type="button" onClick={() => setTipoCliente('PERSONA')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${tipoCliente === 'PERSONA' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Persona Natural
              </button>
              <button type="button" onClick={() => setTipoCliente('EMPRESA')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${tipoCliente === 'EMPRESA' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Empresa (Jurídica)
              </button>
            </div>

            {/* CAMPOS DINÁMICOS */}
            <div className="grid grid-cols-2 gap-5">
              
              {tipoCliente === 'PERSONA' ? (
                <>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombres *</label>
                    <input type="text" name="nombres" required value={formData.nombres} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ap. Paterno *</label>
                    <input type="text" name="apellido_paterno" required value={formData.apellido_paterno} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ap. Materno</label>
                    <input type="text" name="apellido_materno" value={formData.apellido_materno} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social *</label>
                  <input type="text" name="razon_social" required value={formData.razon_social} onChange={handleInputChange} placeholder="Ej: Agrícola Santa Sofía SpA" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              )}

              {/* CAMPOS COMUNES */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">RUT {tipoCliente === 'EMPRESA' ? 'Empresa' : 'Personal'} *</label>
                <input type="text" name="rut" required value={formData.rut} onChange={handleInputChange} placeholder="12.345.678-9" className={`w-full px-4 py-3 rounded-xl border ${!isValidRut && formData.rut ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500'} outline-none`} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono Móvil *</label>
                <input type="text" name="telefono" required value={formData.telefono} onChange={handleInputChange} placeholder="+56 9 1234 5678" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              
              {tipoCliente === 'EMPRESA' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Comercial</label>
                  <input type="text" name="direccion" value={formData.direccion} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              )}

              <div className="col-span-2 mt-4 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Credenciales de Acceso</h3>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico *</label>
                <input type="email" name="email" required value={formData.email} onChange={handleInputChange} placeholder="tu@correo.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                <input type="password" name="password" required value={formData.password} onChange={handleInputChange} placeholder="Mínimo 8 caracteres" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            <button type="submit" id="btn-submit" disabled={!isValidRut} className="w-full py-4 px-6 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-colors mt-8 shadow-lg">
              Crear mi Cuenta
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500">
            ¿Ya tienes una cuenta? <Link to="/login" className="font-semibold text-blue-600 hover:underline">Inicia sesión aquí</Link>
          </p>
        </div>
      )}
    </div>
  );
}