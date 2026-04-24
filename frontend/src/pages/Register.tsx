import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { formatRut, validateRut } from '../utils/rutUtils';
import axios from 'axios';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { Check, Zap, ArrowLeft, Building2, ArrowRight, User } from 'lucide-react';

const PLANES = [
  {
    id: 1,
    nombre: 'Semilla',
    precioMensual: 0,
    precioAnual: 0,
    descripcion: 'Para dar el primer paso hacia la gestión laboral digital.',
    trabajadores: 3,
    empresas: 1,
    features: ['Contratos de trabajo (PDF)', 'Liquidaciones de sueldo', 'Documentos legales', 'Asesoría Ley 40 horas'],
    boton: 'Comenzar Gratis',
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
    features: ['Todo lo del plan Semilla', 'Importación masiva de trabajadores', 'Múltiples empresas en un panel', 'Soporte por correo'],
    boton: 'Elegir Plan Pyme',
    destacado: true,
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
    features: ['Todo lo del plan Pyme', 'Panel multi-empresa unificado', 'Soporte prioritario', 'Acceso anticipado a nuevas funciones'],
    boton: 'Contactar Ventas',
  },
];

export default function Register() {
  const navigate = useNavigate();
  const showToast = useToast();

  const [step, setStep] = useState(1);
  const [billingCycle, setBillingCycle] = useState<'mensual' | 'anual'>('mensual');
  const [isLoading, setIsLoading] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [tipoCliente, setTipoCliente] = useState<'PERSONA' | 'EMPRESA'>('EMPRESA');
  const [formData, setFormData] = useState({
    rut: '', rut_representante: '', nombres: '',
    apellido_paterno: '', apellido_materno: '', email: '', password: '',
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

  const handleCrearCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await client.post('/auth/register/', { ...formData, tipo_cliente: tipoCliente, plan_id: 1 });
      if (response.status === 201) {
        try {
          await client.post('/auth/login/', { username: formData.rut, password: formData.password });
          setStep(2);
        } catch {
          showToast('Cuenta creada con éxito. Por favor, inicia sesión para continuar.', 'success');
          navigate('/login');
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        showToast(error.response?.data?.error || 'Error al crear la cuenta. Inténtalo de nuevo.', 'error');
      } else {
        showToast('Ocurrió un error inesperado. Inténtalo de nuevo.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeleccionarPlan = async (planId: number) => {
    if (planId === 1) { navigate('/login'); return; }
    try {
      const response = await client.post('/pagos/crear_checkout/', { plan_id: planId, ciclo: billingCycle });
      window.location.href = response.data.url;
    } catch {
      showToast('Hubo un problema al conectar con la pasarela de pago.', 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: '#060f20' }}>

      {/* Orbes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-60 -left-40 w-[700px] h-[700px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
        <div className="absolute -bottom-60 -right-60 w-[700px] h-[700px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 w-full p-6 z-20">
        <button
          onClick={() => step === 1 ? navigate('/') : navigate('/login')}
          className="flex items-center gap-2 text-sm font-medium transition-colors group"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="group-hover:text-white transition-colors">Volver</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 relative z-10">

        {/* Cabecera */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 8px 32px rgba(37,99,235,0.35)' }}>
            <span className="text-white text-xl font-black">J</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Jornada<span style={{ color: '#60a5fa' }}>40</span>
          </h1>

          {/* Progress */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: step >= 1 ? '#2563eb' : 'rgba(255,255,255,0.08)', color: '#fff' }}>
                {step > 1 ? <Check size={14} /> : '1'}
              </div>
              <span className="text-xs font-medium" style={{ color: step >= 1 ? '#60a5fa' : 'rgba(255,255,255,0.35)' }}>
                Tu cuenta
              </span>
            </div>
            <div className="w-12 h-px" style={{ background: step >= 2 ? '#2563eb' : 'rgba(255,255,255,0.12)' }} />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: step >= 2 ? '#2563eb' : 'rgba(255,255,255,0.08)', color: step >= 2 ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                2
              </div>
              <span className="text-xs font-medium" style={{ color: step >= 2 ? '#60a5fa' : 'rgba(255,255,255,0.35)' }}>
                Elige tu plan
              </span>
            </div>
          </div>
        </div>

        {step === 1 ? (
          /* ─── PASO 1: DATOS ─── */
          <div className="w-full max-w-2xl animate-fade-up">
            <div className="rounded-3xl p-8 glass-card">
              <h2 className="text-xl font-bold text-white mb-6">Crea tu cuenta</h2>

              {/* Toggle tipo cliente */}
              <div className="flex gap-2 mb-7 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {(['EMPRESA', 'PERSONA'] as const).map((tipo) => (
                  <button
                    key={tipo}
                    onClick={() => setTipoCliente(tipo)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: tipoCliente === tipo ? 'rgba(37,99,235,0.7)' : 'transparent',
                      color: tipoCliente === tipo ? '#fff' : 'rgba(255,255,255,0.4)',
                      border: tipoCliente === tipo ? '1px solid rgba(37,99,235,0.5)' : '1px solid transparent',
                    }}
                  >
                    {tipo === 'EMPRESA' ? 'Empresa' : 'Persona Natural'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleCrearCuenta} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  {/* RUT */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {tipoCliente === 'EMPRESA' ? 'RUT Empresa *' : 'RUT *'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Building2 size={15} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      </div>
                      <input type="text" name="rut" required value={formData.rut} onChange={handleInputChange}
                        placeholder="12.345.678-9"
                        className={`input-dark ${formData.rut && !isValidRut ? 'error' : ''}`} />
                    </div>
                  </div>

                  {/* RUT representante (solo empresa) */}
                  {tipoCliente === 'EMPRESA' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        RUT Representante Legal *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <User size={15} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        </div>
                        <input type="text" name="rut_representante" required value={formData.rut_representante} onChange={handleInputChange}
                          placeholder="12.345.678-9"
                          className={`input-dark ${formData.rut_representante && !isValidRutRep ? 'error' : ''}`} />
                      </div>
                    </div>
                  )}

                  {/* Nombres / Razón Social */}
                  <div className={`space-y-1.5 ${tipoCliente === 'PERSONA' ? 'md:col-span-2' : ''}`}>
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {tipoCliente === 'EMPRESA' ? 'Razón Social *' : 'Nombres *'}
                    </label>
                    <input type="text" name="nombres" required value={formData.nombres} onChange={handleInputChange}
                      className="input-dark" style={{ paddingLeft: '1rem' }} />
                  </div>

                  {/* Apellido paterno / Nombre Fantasía */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {tipoCliente === 'EMPRESA' ? 'Nombre Fantasía' : 'Apellido Paterno *'}
                    </label>
                    <input type="text" name="apellido_paterno" required={tipoCliente === 'PERSONA'}
                      value={formData.apellido_paterno} onChange={handleInputChange}
                      className="input-dark" style={{ paddingLeft: '1rem' }} />
                  </div>

                  {tipoCliente === 'PERSONA' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Apellido Materno
                      </label>
                      <input type="text" name="apellido_materno" value={formData.apellido_materno} onChange={handleInputChange}
                        className="input-dark" style={{ paddingLeft: '1rem' }} />
                    </div>
                  )}

                  {/* Email */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Correo Electrónico *
                    </label>
                    <input type="email" name="email" required value={formData.email} onChange={handleInputChange}
                      placeholder="tu@correo.com" className="input-dark" style={{ paddingLeft: '1rem' }} />
                  </div>

                  {/* Contraseña */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Contraseña *
                    </label>
                    <input type="password" name="password" required value={formData.password} onChange={handleInputChange}
                      placeholder="Mínimo 8 caracteres" className="input-dark" style={{ paddingLeft: '1rem' }} />
                  </div>
                </div>

                {/* Términos */}
                <label className="flex items-start gap-3 cursor-pointer mt-2">
                  <input type="checkbox" required checked={aceptaTerminos} onChange={(e) => setAceptaTerminos(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-blue-500 cursor-pointer" />
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    He leído y acepto los{' '}
                    <Link to="/terminos" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-semibold">
                      Términos y Condiciones
                    </Link>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading || !isValidRut || (tipoCliente === 'EMPRESA' && !isValidRutRep) || !aceptaTerminos}
                  className="btn-primary mt-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                  ) : (
                    <>Continuar al Paso 2 <ArrowRight size={16} /></>
                  )}
                </button>
              </form>
            </div>

            <p className="text-center mt-5 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                Inicia sesión
              </Link>
            </p>
          </div>

        ) : (
          /* ─── PASO 2: SELECCIÓN DE PLAN ─── */
          <div className="w-full max-w-5xl animate-fade-up">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">¡Cuenta creada con éxito!</h2>
              <p className="text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Elige el plan que mejor se adapte a tu empresa
              </p>
            </div>

            {/* Toggle mensual / anual */}
            <div className="flex justify-center mb-10">
              <div className="flex p-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {(['mensual', 'anual'] as const).map((ciclo) => (
                  <button
                    key={ciclo}
                    onClick={() => setBillingCycle(ciclo)}
                    className="px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2"
                    style={{
                      background: billingCycle === ciclo ? (ciclo === 'anual' ? '#2563eb' : 'rgba(255,255,255,0.1)') : 'transparent',
                      color: billingCycle === ciclo ? '#fff' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {ciclo === 'mensual' ? 'Pago Mensual' : 'Pago Anual'}
                    {ciclo === 'anual' && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: billingCycle === 'anual' ? 'rgba(52,211,153,0.2)' : 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                        Ahorra 20%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Cards de planes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANES.map((plan) => (
                <div key={plan.id} className="relative rounded-3xl p-7 flex flex-col transition-transform hover:-translate-y-1"
                  style={{
                    background: plan.destacado ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.04)',
                    border: plan.destacado ? '1px solid rgba(37,99,235,0.45)' : '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(20px)',
                  }}>

                  {plan.destacado && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}>
                        <Zap size={12} /> Más Popular
                      </span>
                    </div>
                  )}

                  <h3 className="text-xl font-bold text-white mt-2">{plan.nombre}</h3>
                  <p className="text-sm mt-1.5 mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>{plan.descripcion}</p>

                  <div className="mb-6">
                    {plan.precioMensual === 0 ? (
                      <span className="text-4xl font-bold text-white">Gratis</span>
                    ) : (
                      <div>
                        {billingCycle === 'anual' && plan.precioAnualNormal && (
                          <span className="text-sm line-through mb-1 block" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            ${plan.precioAnualNormal.toLocaleString('es-CL')}
                          </span>
                        )}
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-white">
                            ${(billingCycle === 'mensual' ? plan.precioMensual : plan.precioAnual).toLocaleString('es-CL')}
                          </span>
                          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            /{billingCycle === 'mensual' ? 'mes' : 'año'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-7 flex-1">
                    <li className="flex items-start gap-2.5">
                      <Building2 size={16} className="text-blue-400 shrink-0 mt-0.5" />
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Hasta <strong className="text-white">{plan.empresas} {plan.empresas === 1 ? 'empresa' : 'empresas'}</strong>
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={16} className="text-blue-400 shrink-0 mt-0.5" />
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Hasta <strong className="text-white">{plan.trabajadores} trabajadores</strong>
                      </span>
                    </li>
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check size={16} className="text-blue-400 shrink-0 mt-0.5" />
                        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSeleccionarPlan(plan.id)}
                    className={plan.destacado ? 'btn-primary' : 'btn-secondary'}
                  >
                    {plan.boton}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
