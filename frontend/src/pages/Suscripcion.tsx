import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Check, CreditCard, User, Shield, ArrowLeft } from 'lucide-react';

// --- INTERFACES ---
interface Plan {
  id: number;
  nombre: string;
  precio: number;
  limite_trabajadores: number;
  descripcion: string;
}

interface MiSuscripcion {
  estado: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  plan: Plan;
  fecha_proximo_cobro?: string;
  metodo_pago_glosa?: string;
  trabajadores_actuales: number;
}

export default function Suscripcion() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'cuenta' | 'suscripcion' | 'seguridad'>('cuenta');

  // Estados reales
  const [loading, setLoading] = useState(true);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [miSuscripcion, setMiSuscripcion] = useState<MiSuscripcion | null>(null);
  
  // Datos temporales de usuario (hasta que conectemos un endpoint de perfil)
  const [userData, setUserData] = useState({ nombres: '', email: '', rut: '' });

  const apiConfig = { withCredentials: true };

  // Efecto para cargar los datos al abrir la pantalla
useEffect(() => {
    const fetchDatos = async () => {
      try {
        // Agregamos el perfil a la promesa múltiple
        const [planesRes, subRes, perfilRes] = await Promise.all([
          axios.get('https://jornada40-saas-production.up.railway.app/api/planes/', apiConfig),
          // CORRECCIÓN: Cambiamos 'suscripciones' por 'clientes' en la URL
          axios.get('https://jornada40-saas-production.up.railway.app/api/clientes/mi_suscripcion/', apiConfig),
          // NUEVA LLAMADA: Trae el nombre, email y RUT del cliente
          axios.get('https://jornada40-saas-production.up.railway.app/api/clientes/perfil/', apiConfig)
        ]);
        
        setPlanes(planesRes.data);
        setMiSuscripcion(subRes.data);
        setUserData(perfilRes.data); // Llenamos los inputs con los datos reales

      } catch (error) {
        console.error("Error al cargar datos de suscripción o perfil:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDatos();
  }, []);

  // ---> NUEVA FUNCIÓN PARA GUARDAR LOS CAMBIOS <---
  const handleActualizarPerfil = async () => {
    try {
      await axios.put('https://jornada40-saas-production.up.railway.app/api/clientes/perfil/', userData, apiConfig);
      alert("¡Perfil actualizado con éxito!");
    } catch (error) {
      console.error("Error al actualizar perfil", error);
      alert("Hubo un error al guardar los cambios.");
    }
  };

  // Función para procesar pagos (Upgrades)
  const handlePagar = async (planId: number) => {
    try {
      const response = await axios.post(
        'https://jornada40-saas-production.up.railway.app/api/pagos/crear_checkout/',
        { plan_id: planId, ciclo: 'mensual' },
        apiConfig
      );
      window.location.href = response.data.url;
    } catch (error) {
      console.error("Error al iniciar el pago:", error);
      alert("Hubo un problema al conectar con la pasarela de pago.");
    }
  };

  // Pantalla de carga mientras trae los datos
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        
        {/* BOTÓN VOLVER */}
        <button 
          onClick={() => navigate('/empresas')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 hover:shadow mb-8 w-fit"
        >
          <ArrowLeft size={18} />
          Volver al Lobby
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900">Configuración de Cuenta</h1>
          <p className="text-slate-500 mt-2">Administra tus datos personales, seguridad y planes de facturación.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          
          {/* ================= MENU LATERAL ================= */}
          <div className="w-full md:w-64 shrink-0 space-y-2">
            <button 
              onClick={() => setActiveTab('cuenta')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'cuenta' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200 bg-transparent'}`}
            >
              <User size={20} /> Perfil de Usuario
            </button>
            <button 
              onClick={() => setActiveTab('suscripcion')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'suscripcion' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200 bg-transparent'}`}
            >
              <CreditCard size={20} /> Plan y Facturación
            </button>
            <button 
              onClick={() => setActiveTab('seguridad')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'seguridad' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200 bg-transparent'}`}
            >
              <Shield size={20} /> Seguridad
            </button>
          </div>

          {/* ================= CONTENIDO PRINCIPAL ================= */}
          <div className="flex-1 bg-white p-8 rounded-3xl shadow-sm border border-slate-200 min-h-[500px]">
            
            {/* PESTAÑA: PERFIL DE USUARIO */}
            {activeTab === 'cuenta' && (
              <div className="space-y-6 max-w-2xl animate-fade-in">
                <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">Datos Personales</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-500 mb-2">Nombre Completo</label>
                    <input 
                      type="text" 
                      value={userData.nombres}
                      onChange={(e) => setUserData({...userData, nombres: e.target.value})}
                      placeholder="Ej: Juan Pérez" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none font-medium" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Correo Electrónico</label>
                    <input 
                      type="email" 
                      value={userData.email}
                      onChange={(e) => setUserData({...userData, email: e.target.value})}
                      placeholder="correo@empresa.com" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none font-medium" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">RUT Titular</label>
                    <input 
                      type="text" 
                      value={userData.rut}
                      disabled 
                      placeholder="12.345.678-9" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 outline-none font-medium text-slate-400 cursor-not-allowed" 
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    onClick={handleActualizarPerfil} 
                      className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-colors"
                    >
                      Guardar Cambios
                  </button>
                </div>
              </div>
            )}

            {/* PESTAÑA: SUSCRIPCIÓN Y FACTURACIÓN */}
            {activeTab === 'suscripcion' && (
              <div className="space-y-8 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4 mb-6">Tu Plan Actual</h2>
                  {miSuscripcion ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <span className="bg-emerald-200 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
                          Plan {miSuscripcion.estado === 'ACTIVE' ? 'Activo' : 'Trial'}
                        </span>
                        <h3 className="text-2xl font-bold text-slate-900">{miSuscripcion.plan.nombre}</h3>
                        <p className="text-emerald-700 font-medium mt-1">
                          Límite: {miSuscripcion.plan.limite_trabajadores} Trabajadores (Usados: {miSuscripcion.trabajadores_actuales})
                        </p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-3xl font-extrabold text-slate-900">
                          ${miSuscripcion.plan.precio.toLocaleString('es-CL')}
                        </p>
                        {miSuscripcion.fecha_proximo_cobro && (
                          <p className="text-sm text-slate-500">Próximo cobro: {miSuscripcion.fecha_proximo_cobro}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500">No se encontraron datos de tu suscripción actual.</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Mejorar Plan (Upgrade)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {planes.map((plan) => (
                      <div key={plan.id} className="border border-slate-200 rounded-2xl p-6 flex flex-col hover:border-blue-300 transition-colors">
                        <h4 className="text-xl font-bold text-slate-900">{plan.nombre}</h4>
                        <p className="text-2xl font-extrabold text-slate-900 my-2">
                          ${plan.precio.toLocaleString('es-CL')}<span className="text-sm font-medium text-slate-500">/mes</span>
                        </p>
                        <ul className="space-y-2 mb-6 flex-1">
                          <li className="flex items-center gap-2 text-sm text-slate-600">
                            <Check size={16} className="text-blue-500" /> Hasta {plan.limite_trabajadores} trabajadores
                          </li>
                          <li className="flex items-center gap-2 text-sm text-slate-600">
                            <Check size={16} className="text-blue-500" /> Soporte Legislación DT
                          </li>
                          <li className="flex items-center gap-2 text-sm text-slate-600">
                            <Check size={16} className="text-blue-500" /> Anexos Ley 40h
                          </li>
                        </ul>
                        <button 
                          onClick={() => handlePagar(plan.id)}
                          disabled={miSuscripcion?.plan.id === plan.id}
                          className={`w-full py-3 rounded-xl font-bold transition-colors ${
                            miSuscripcion?.plan.id === plan.id 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md'
                          }`}
                        >
                          {miSuscripcion?.plan.id === plan.id ? 'Plan Actual' : 'Cambiar a este plan'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PESTAÑA: SEGURIDAD */}
            {activeTab === 'seguridad' && (
              <div className="space-y-6 max-w-2xl animate-fade-in">
                <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">Cambiar Contraseña</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Contraseña Actual</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Nueva Contraseña</label>
                    <input type="password" placeholder="Mínimo 8 caracteres" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Repetir Nueva Contraseña</label>
                    <input type="password" placeholder="Mínimo 8 caracteres" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none" />
                  </div>
                </div>
                <div className="pt-4">
                  <button className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-colors">Actualizar Contraseña</button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}