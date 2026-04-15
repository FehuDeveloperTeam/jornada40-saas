import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { formatRut, validateRut } from '../utils/rutUtils';
import axios from 'axios';
import client from '../api/client';
import { Check, Zap, ArrowLeft, Building } from 'lucide-react';

// --- DEFINICIÓN DE PLANES ---
const PLANES = [
  {
    id: 1,
    nombre: 'Semilla',
    precioMensual: 0,
    precioAnual: 0,
    descripcion: 'Para dar el primer paso hacia la gestión laboral digital.',
    trabajadores: 3,
    empresas: 1,
    features: [
      'Contratos de trabajo (PDF)',
      'Liquidaciones de sueldo',
      'Documentos legales',
      'Asesoría Ley 40 horas',
    ],
    color: 'border-green-200 ring-green-500 bg-green-50',
    boton: 'Comenzar Gratis'
  },
  {
    id: 2,
    nombre: 'Pyme',
    precioMensual: 29990,
    precioAnual: 287904,
    precioAnualNormal: 359880,
    descripcion: 'La solución completa para gestionar tu plantilla laboral.',
    trabajadores: 40,
    empresas: 3,
    features: [
      'Todo lo del plan Semilla',
      'Importación masiva de trabajadores',
      'Múltiples empresas en un panel',
      'Soporte por correo',
    ],
    color: 'border-blue-200 ring-blue-600 bg-blue-50',
    boton: 'Elegir Plan Pyme',
    destacado: true
  },
  {
    id: 3,
    nombre: 'Corporativo',
    precioMensual: 69990,
    precioAnual: 671904,
    precioAnualNormal: 839880,
    descripcion: 'Control total para grandes organizaciones y holdings.',
    trabajadores: 200,
    empresas: 10,
    features: [
      'Todo lo del plan Pyme',
      'Panel multi-empresa unificado',
      'Soporte prioritario',
      'Acceso anticipado a nuevas funciones',
    ],
    color: 'border-slate-200 ring-slate-800 bg-slate-50',
    boton: 'Contactar Ventas'
  }
];

export default function Register() {
  const navigate = useNavigate();
  
  // --- ESTADOS DE FLUJO ---
  const [step, setStep] = useState(1);
  const [billingCycle, setBillingCycle] = useState<'mensual' | 'anual'>('mensual');
  const [isLoading, setIsLoading] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  // --- ESTADOS DE FORMULARIO ---
  const [tipoCliente, setTipoCliente] = useState<'PERSONA' | 'EMPRESA'>('EMPRESA');
  const [formData, setFormData] = useState({
    rut: '',
    rut_representante: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    email: '',
    password: ''
  });

  const isValidRut = validateRut(formData.rut);
  const isValidRutRep = validateRut(formData.rut_representante);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'rut' || name === 'rut_representante') {
      setFormData({ ...formData, [name]: formatRut(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // --- PASO 1: CREAR CUENTA ---
  const handleCrearCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await client.post('/auth/register/', {
        ...formData,
        tipo_cliente: tipoCliente,
        plan_id: 1
      });

      if (response.status === 201) {
        // AUTO-LOGIN SILENCIOSO
        try {
          await client.post('/auth/login/', {
            username: formData.rut,
            password: formData.password
          });
          
          setStep(2);

        } catch (loginError) {
          console.error("Error en auto-login:", loginError);
          alert("Cuenta creada con éxito. Por favor, inicia sesión para continuar.");
          navigate('/login');
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || "Error al crear la cuenta. Inténtalo de nuevo.");
      } else {
        alert("Ocurrió un error inesperado. Inténtalo de nuevo.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- PASO 2: PAGAR PLAN ---
  const handleSeleccionarPlan = async (planId: number) => {
    if (planId === 1) {
      navigate('/login');
      return;
    }
    
    try {
      const response = await client.post('/pagos/crear_checkout/', {
        plan_id: planId,
        ciclo: billingCycle
      });
      
      window.location.href = response.data.url;
      
    } catch (error) {
      console.error("Error al iniciar el pago:", error);
      alert("Hubo un problema al conectar con la pasarela de pago.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      
      {/* BOTÓN VOLVER */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8">
        <button 
          onClick={() => step === 1 ? navigate(-1) : navigate('/login')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 hover:shadow"
        >
          <ArrowLeft size={18} />
          Volver
        </button>
      </div>

      {/* HEADER LOGO */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8 text-center mt-10 sm:mt-0 font-sans flex flex-col items-center">
        <img 
          src="/vite.svg" 
          alt="Logo Jornada40" 
          className="h-16 w-auto mb-2 drop-shadow-sm" 
        />
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Jornada<span className="text-blue-600">40</span></h1>
      </div>

      {step === 1 ? (
        /* ================= PASO 1: CAPTURA DE DATOS ================= */
        <div className="sm:mx-auto sm:w-full sm:max-w-2xl bg-white py-8 px-4 shadow-xl rounded-3xl sm:px-10 border border-slate-100">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">Crea tu cuenta</h2>
            <p className="text-slate-500 mt-2">Paso 1 de 2: Información de tu empresa</p>
          </div>

          <div className="flex gap-4 mb-8 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setTipoCliente('EMPRESA')}
              className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${tipoCliente === 'EMPRESA' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Empresa
            </button>
            <button
              onClick={() => setTipoCliente('PERSONA')}
              className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${tipoCliente === 'PERSONA' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Persona Natural
            </button>
          </div>

          <form onSubmit={handleCrearCuenta} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{tipoCliente === 'EMPRESA' ? 'RUT Empresa *' : 'RUT *'}</label>
                <input type="text" name="rut" required value={formData.rut} onChange={handleInputChange} placeholder="12.345.678-9" className={`w-full px-4 py-3 rounded-xl border ${formData.rut && !isValidRut ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'} focus:ring-2 outline-none`} />
              </div>
              
              {tipoCliente === 'EMPRESA' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">RUT Representante Legal *</label>
                  <input type="text" name="rut_representante" required value={formData.rut_representante} onChange={handleInputChange} placeholder="12.345.678-9" className={`w-full px-4 py-3 rounded-xl border ${formData.rut_representante && !isValidRutRep ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'} focus:ring-2 outline-none`} />
                </div>
              )}

              <div className={tipoCliente === 'PERSONA' ? 'md:col-span-2' : ''}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{tipoCliente === 'EMPRESA' ? 'Razón Social *' : 'Nombres *'}</label>
                <input type="text" name="nombres" required value={formData.nombres} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{tipoCliente === 'EMPRESA' ? 'Nombre Fantasía' : 'Apellido Paterno *'}</label>
                <input type="text" name="apellido_paterno" required={tipoCliente === 'PERSONA'} value={formData.apellido_paterno} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              {tipoCliente === 'PERSONA' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apellido Materno</label>
                  <input type="text" name="apellido_materno" value={formData.apellido_materno} onChange={handleInputChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico *</label>
                <input type="email" name="email" required value={formData.email} onChange={handleInputChange} placeholder="tu@correo.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña *</label>
                <input type="password" name="password" required value={formData.password} onChange={handleInputChange} placeholder="Mínimo 8 caracteres" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            {/* CHECKBOX DE TÉRMINOS Y CONDICIONES */}
            <div className="flex items-start mt-4">
              <input
                type="checkbox"
                id="terminos"
                required
                checked={aceptaTerminos}
                onChange={(e) => setAceptaTerminos(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
              />
              <label htmlFor="terminos" className="ml-2 block text-sm text-slate-500 cursor-pointer">
                He leído y acepto los{' '}
                <Link to="/terminos" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                  Términos y Condiciones
                </Link>
              </label>
            </div>

            {/* BOTÓN BLOQUEADO SI NO ACEPTA TÉRMINOS */}
            <button 
              type="submit" 
              disabled={isLoading || !isValidRut || (tipoCliente === 'EMPRESA' && !isValidRutRep) || !aceptaTerminos} 
              className="w-full py-4 px-6 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors mt-8 shadow-md"
            >
              {isLoading ? 'Creando cuenta...' : 'Continuar al Paso 2'}
            </button>
          </form>
          <p className="text-center mt-6 text-sm text-slate-500">¿Ya tienes cuenta? <Link to="/login" className="font-bold text-blue-600 hover:underline">Inicia sesión</Link></p>
        </div>

      ) : (

        /* ================= PASO 2: SELECCIÓN DE PLAN Y PAGO ================= */
        <div className="sm:mx-auto sm:w-full max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold text-slate-900">¡Cuenta creada con éxito!</h2>
            <p className="text-lg text-slate-600 mt-2">Paso 2 de 2: Elige el plan que mejor se adapte a tu empresa</p>
          </div>

          {/* TOGGLE MENSUAL / ANUAL */}
          <div className="flex justify-center mb-12">
            <div className="bg-slate-200 p-1 rounded-full flex items-center shadow-inner">
              <button 
                onClick={() => setBillingCycle('mensual')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${billingCycle === 'mensual' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Pago Mensual
              </button>
              <button 
                onClick={() => setBillingCycle('anual')}
                className={`px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${billingCycle === 'anual' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Pago Anual 
                <span className={`${billingCycle === 'anual' ? 'bg-emerald-400 text-emerald-950 shadow-sm' : 'bg-emerald-100 text-emerald-700'} text-xs px-2.5 py-0.5 rounded-full transition-colors`}>
                  Ahorra 20%
                </span>
              </button>
            </div>
          </div>

          {/* TARJETAS DE PLANES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PLANES.map((plan) => (
              <div key={plan.id} className={`relative bg-white rounded-3xl p-8 shadow-lg border-2 ${plan.destacado ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-100'} flex flex-col`}>
                
                {plan.destacado && (
                  <div className="absolute -top-5 left-0 right-0 flex justify-center">
                    <span className="bg-blue-500 text-white text-xs font-extrabold px-4 py-1.5 rounded-full flex items-center gap-1 uppercase tracking-wide shadow-md">
                      <Zap size={14} /> Más Popular
                    </span>
                  </div>
                )}

                <h3 className="text-2xl font-bold text-slate-900">{plan.nombre}</h3>
                <p className="text-sm text-slate-500 mt-2 min-h-[40px]">{plan.descripcion}</p>

                <div className="my-6">
                  {plan.precioMensual === 0 ? (
                    <span className="text-5xl font-extrabold text-slate-900">Gratis</span>
                  ) : (
                    <div className="flex flex-col min-h-[80px] justify-end">
                      {/* Precio Ancla: Aparece tachado solo en modalidad anual */}
                      {billingCycle === 'anual' && plan.precioAnualNormal && (
                        <span className="text-sm font-bold text-slate-400 line-through mb-1 ml-1 transition-opacity animate-fade-in">
                          ${plan.precioAnualNormal.toLocaleString('es-CL')}
                        </span>
                      )}
                      
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-extrabold text-slate-900 transition-all">
                          ${billingCycle === 'mensual' ? plan.precioMensual.toLocaleString('es-CL') : plan.precioAnual.toLocaleString('es-CL')}
                        </span>
                        <span className="text-slate-500 font-medium">
                          /{billingCycle === 'mensual' ? 'mes' : 'año'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-start gap-3">
                    <Building className="text-blue-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-slate-700">
                      Gestiona hasta <strong>{plan.empresas} {plan.empresas === 1 ? 'empresa' : 'empresas'}</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="text-blue-500 shrink-0 mt-0.5" size={18} />
                    <span className="text-slate-700">Hasta <strong>{plan.trabajadores} trabajadores</strong></span>
                  </li>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="text-blue-500 shrink-0 mt-0.5" size={18} />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => handleSeleccionarPlan(plan.id)}
                  className={`w-full py-4 rounded-xl font-bold transition-all ${
                    plan.destacado 
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg' 
                      : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {plan.boton}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}