import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useToast } from '../hooks/useToast';
import { Check, CreditCard, User, Shield, ArrowLeft, Zap } from 'lucide-react';

interface Plan {
  id: number;
  nombre: string;
  precio: number;
  limite_trabajadores: number;
  max_empresas: number;
  descripcion: string;
  nivel: number;
}

interface MiSuscripcion {
  estado: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  plan: Plan;
  fecha_proximo_cobro?: string;
  metodo_pago_glosa?: string;
  trabajadores_actuales: number;
}

const TABS = [
  { id: 'cuenta' as const, label: 'Datos Personales', icon: User },
  { id: 'suscripcion' as const, label: 'Mi Suscripción', icon: CreditCard },
  { id: 'seguridad' as const, label: 'Seguridad', icon: Shield },
];

const inputDark = {
  width: '100%',
  background: 'var(--c-bg-input)',
  border: '1px solid var(--c-border-input)',
  borderRadius: '0.75rem',
  padding: '0.875rem 1rem',
  color: 'var(--c-text-1)',
  fontFamily: 'Poppins, sans-serif',
  fontSize: '0.9375rem',
  outline: 'none',
} as React.CSSProperties;

export default function Suscripcion() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [activeTab, setActiveTab] = useState<'cuenta' | 'suscripcion' | 'seguridad'>('cuenta');
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [miSuscripcion, setMiSuscripcion] = useState<MiSuscripcion | null>(null);
  const [planesDisponibles, setPlanesDisponibles] = useState<Plan[]>([]);
  const [userData, setUserData] = useState({ nombres: '', apellido_paterno: '', apellido_materno: '', email: '', rut: '' });

  useEffect(() => {
    const fetchDatos = async () => {
      try {
        const [subRes, perfilRes, planesRes] = await Promise.all([
          client.get('/clientes/mi_suscripcion/'),
          client.get('/clientes/perfil/'),
          client.get('/planes/'),
        ]);
        setMiSuscripcion(subRes.data);
        setPlanesDisponibles(Array.isArray(planesRes.data) ? planesRes.data : (planesRes.data.results ?? []));
        setUserData({
          nombres: perfilRes.data.nombres || '',
          apellido_paterno: perfilRes.data.apellido_paterno || '',
          apellido_materno: perfilRes.data.apellido_materno || '',
          email: perfilRes.data.email || '',
          rut: perfilRes.data.rut || ''
        });
      } catch {
        setErrorCarga(true);
      } finally {
        setLoading(false);
      }
    };
    fetchDatos();
  }, []);

  const handleActualizarPerfil = async () => {
    try {
      await client.put('/clientes/perfil/', userData);
      showToast('¡Perfil actualizado con éxito!', 'success');
    } catch {
      showToast('Hubo un error al guardar los cambios.', 'error');
    }
  };

  const handleMejorarPlan = async (planId: number, ciclo: string) => {
    setProcesandoPago(true);
    try {
      const response = await client.post('/pagos/crear-checkout/', { plan_id: planId, ciclo });
      if (response.data.url) window.location.href = response.data.url;
    } catch {
      showToast('Hubo un error al conectar con la pasarela de pagos.', 'error');
    } finally {
      setProcesandoPago(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--c-bg-app)' }}>
      <div className="w-10 h-10 border-2 rounded-full animate-spin"
        style={{ borderColor: 'var(--c-border-input)', borderTopColor: '#2563eb' }} />
    </div>
  );

  if (errorCarga) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--c-bg-app)' }}>
      <div className="text-center space-y-4">
        <p className="font-semibold text-lg" style={{ color: 'var(--c-text-1)' }}>No se pudo cargar la información de tu cuenta.</p>
        <p className="text-sm" style={{ color: 'var(--c-text-3)' }}>Verifica tu conexión e intenta nuevamente.</p>
        <button onClick={() => window.location.reload()} className="btn-primary" style={{ width: 'auto', display: 'inline-flex' }}>
          Reintentar
        </button>
      </div>
    </div>
  );

  const porcentajeUso = miSuscripcion
    ? Math.min((miSuscripcion.trabajadores_actuales / miSuscripcion.plan.limite_trabajadores) * 100, 100)
    : 0;

  const nivelActual = miSuscripcion?.plan?.nivel ?? 1;
  const planesUpgrade = planesDisponibles
    .filter(p => p.nivel > nivelActual)
    .sort((a, b) => a.nivel - b.nivel);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: 'var(--c-bg-app)' }}>

      {/* Orbes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto w-full px-6 py-12">

        {/* Volver */}
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium mb-10 transition-colors group"
          style={{ color: 'var(--c-text-3)' }}>
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="group-hover:text-white transition-colors">Volver al Dashboard</span>
        </button>

        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--c-text-1)' }}>Configuración de Cuenta</h1>
          <p className="text-base" style={{ color: 'var(--c-text-3)' }}>
            Administra tus datos personales y plan de suscripción.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar tabs */}
          <div className="lg:col-span-1 space-y-1">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: activeTab === tab.id ? 'rgba(37,99,235,0.2)' : 'var(--c-bg-card-2)',
                  border: activeTab === tab.id ? '1px solid rgba(37,99,235,0.35)' : '1px solid var(--c-border)',
                  color: activeTab === tab.id ? '#60a5fa' : 'var(--c-text-3)',
                }}>
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Contenido */}
          <div className="lg:col-span-3 rounded-3xl p-8 glass-card animate-fade-in">

            {/* Tab: Cuenta */}
            {activeTab === 'cuenta' && (
              <div className="space-y-7">
                <h2 className="text-xl font-bold pb-4" style={{ color: 'var(--c-text-1)', borderBottom: '1px solid var(--c-border)' }}>
                  Información del Perfil
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Nombres', key: 'nombres' as const },
                    { label: 'Apellido Paterno', key: 'apellido_paterno' as const },
                    { label: 'Apellido Materno', key: 'apellido_materno' as const },
                  ].map(({ label, key }) => (
                    <div key={key} className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-3)' }}>
                        {label}
                      </label>
                      <input type="text" value={userData[key]}
                        onChange={(e) => setUserData({ ...userData, [key]: e.target.value })}
                        style={inputDark} />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-3)' }}>
                      Correo Electrónico
                    </label>
                    <input type="email" value={userData.email}
                      onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                      style={inputDark} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-3)' }}>
                      RUT
                    </label>
                    <input type="text" value={userData.rut} disabled
                      style={{ ...inputDark, opacity: 0.4, cursor: 'not-allowed' }} />
                  </div>
                </div>

                <div className="pt-4" style={{ borderTop: '1px solid var(--c-border)' }}>
                  <button onClick={handleActualizarPerfil} className="btn-primary" style={{ width: 'auto', display: 'inline-flex' }}>
                    Guardar Cambios
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Suscripción */}
            {activeTab === 'suscripcion' && (
              <div className="space-y-7">

                {/* Plan actual */}
                <div className="rounded-2xl p-6" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--c-text-3)' }}>
                        Plan Actual
                      </p>
                      <h3 className="text-2xl font-bold" style={{ color: 'var(--c-text-1)' }}>{miSuscripcion?.plan?.nombre?.toUpperCase() || '…'}</h3>
                    </div>
                    <span className="px-4 py-1.5 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
                      Activo
                    </span>
                  </div>

                  <div className="mb-2 flex justify-between text-sm font-medium">
                    <span style={{ color: 'var(--c-text-2)' }}>Uso de Trabajadores</span>
                    <span className="font-bold" style={{ color: 'var(--c-text-1)' }}>
                      {miSuscripcion?.trabajadores_actuales || 0} / {miSuscripcion?.plan?.limite_trabajadores || 0}
                    </span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ background: 'var(--c-border)' }}>
                    <div className="h-2 rounded-full transition-all duration-700"
                      style={{
                        width: `${porcentajeUso}%`,
                        background: porcentajeUso >= 100 ? '#ef4444' : 'linear-gradient(90deg, #2563eb, #60a5fa)',
                      }} />
                  </div>
                </div>

                {/* Planes de mejora */}
                {planesUpgrade.length === 0 ? (
                  <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
                      <Check size={28} className="text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--c-text-1)' }}>¡Tienes el plan máximo!</h3>
                    <p style={{ color: 'var(--c-text-3)' }}>Disfrutas de todas las herramientas premium de Jornada40.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h2 className="text-base font-bold" style={{ color: 'var(--c-text-1)' }}>Mejorar Plan</h2>
                    {planesUpgrade.map((plan, idx) => {
                      const esPyme = plan.nombre.toUpperCase().includes('PYME');
                      const isFirst = idx === 0;
                      return (
                        <div key={plan.id} className="rounded-2xl p-6 relative transition-all"
                          style={{
                            background: isFirst ? 'rgba(37,99,235,0.08)' : 'var(--c-bg-card-2)',
                            border: isFirst ? '1px solid rgba(37,99,235,0.3)' : '1px solid var(--c-border)',
                          }}>
                          {esPyme && (
                            <div className="absolute top-4 right-4">
                              <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                                <Zap size={10} /> Popular
                              </span>
                            </div>
                          )}
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                            <div>
                              <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--c-text-1)' }}>
                                Plan {plan.nombre}
                              </h3>
                              <p className="text-sm mb-2" style={{ color: 'var(--c-text-3)' }}>
                                {plan.max_empresas} {plan.max_empresas === 1 ? 'empresa' : 'empresas'} · hasta {plan.limite_trabajadores} trabajadores
                              </p>
                              <p className="text-2xl font-bold" style={{ color: 'var(--c-text-1)' }}>
                                ${plan.precio.toLocaleString('es-CL')}{' '}
                                <span className="text-sm font-normal" style={{ color: 'var(--c-text-3)' }}>/ mes</span>
                              </p>
                            </div>
                            <button
                              onClick={() => handleMejorarPlan(plan.id, 'mensual')}
                              disabled={procesandoPago}
                              className={isFirst ? 'btn-primary' : 'btn-secondary'}
                              style={{ width: 'auto', display: 'inline-flex' }}>
                              {procesandoPago ? 'Procesando…' : `Mejorar a ${plan.nombre}`}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Seguridad */}
            {activeTab === 'seguridad' && (
              <div className="space-y-7">
                <h2 className="text-xl font-bold pb-4" style={{ color: 'var(--c-text-1)', borderBottom: '1px solid var(--c-border)' }}>
                  Cambiar Contraseña
                </h2>
                <div className="space-y-4">
                  {[
                    { label: 'Contraseña Actual', placeholder: '••••••••' },
                    { label: 'Nueva Contraseña', placeholder: 'Mínimo 8 caracteres' },
                    { label: 'Repetir Nueva Contraseña', placeholder: 'Mínimo 8 caracteres' },
                  ].map(({ label, placeholder }) => (
                    <div key={label} className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-3)' }}>
                        {label}
                      </label>
                      <input type="password" placeholder={placeholder} style={inputDark} />
                    </div>
                  ))}
                </div>
                <div className="pt-4" style={{ borderTop: '1px solid var(--c-border)' }}>
                  <button className="btn-primary" style={{ width: 'auto', display: 'inline-flex' }}>
                    Actualizar Contraseña
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
