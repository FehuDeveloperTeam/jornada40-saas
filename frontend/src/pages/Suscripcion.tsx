import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
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
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [miSuscripcion, setMiSuscripcion] = useState<MiSuscripcion | null>(null);
  
  // Datos reales del perfil (ahora con paterno y materno)
  const [userData, setUserData] = useState({ 
    nombres: '', 
    apellido_paterno: '', 
    apellido_materno: '', 
    email: '', 
    rut: '' 
  });

 

  useEffect(() => {
    const fetchDatos = async () => {
      try {
        const [subRes, perfilRes] = await Promise.all([
          client.get('/clientes/mi_suscripcion/'),
          client.get('/clientes/perfil/')
        ]);
        
        setMiSuscripcion(subRes.data);
        
        // Evitamos undefined si vienen vacíos desde Django
        setUserData({
          nombres: perfilRes.data.nombres || '',
          apellido_paterno: perfilRes.data.apellido_paterno || '',
          apellido_materno: perfilRes.data.apellido_materno || '',
          email: perfilRes.data.email || '',
          rut: perfilRes.data.rut || ''
        });

      } catch (error) {
        console.error("Error al cargar datos de suscripción o perfil:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDatos();
  }, []);

  // Función para guardar los datos del cliente
  const handleActualizarPerfil = async () => {
    try {
      await client.put('/clientes/perfil/', userData);
      alert("¡Perfil actualizado con éxito!");
    } catch (error) {
      console.error("Error al actualizar perfil", error);
      alert("Hubo un error al guardar los cambios.");
    }
  };

  // Función para ir a la pasarela de pago
  const handleMejorarPlan = async (planId: number, ciclo: string) => {
    setProcesandoPago(true);
    try {
      const response = await client.post('/pagos/crear-checkout/', {
        plan_id: planId,
        ciclo: ciclo
      });
      
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error("Error al generar link de pago", error);
      alert("Hubo un error al conectar con la pasarela de pagos.");
    } finally {
      setProcesandoPago(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const porcentajeUso = miSuscripcion 
    ? Math.min((miSuscripcion.trabajadores_actuales / miSuscripcion.plan.limite_trabajadores) * 100, 100) 
    : 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans relative overflow-hidden">
      {/* Fondos Abstractos */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center z-0 overflow-hidden">
        <div className="absolute -top-40 w-[800px] h-[400px] bg-blue-500/10 blur-[100px] rounded-[100%]"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Cabecera */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8 font-semibold">
          <ArrowLeft className="w-5 h-5" /> Volver al Dashboard
        </button>

        <div className="mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">Configuración de Cuenta</h1>
          <p className="text-slate-500 text-lg">Administra tus datos personales y plan de suscripción.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Menú Lateral (Tabs) */}
          <div className="lg:col-span-1 space-y-2">
            <button 
              onClick={() => setActiveTab('cuenta')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'cuenta' ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
            >
              <User className="w-5 h-5" /> Datos Personales
            </button>
            <button 
              onClick={() => setActiveTab('suscripcion')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'suscripcion' ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
            >
              <CreditCard className="w-5 h-5" /> Mi Suscripción
            </button>
            <button 
              onClick={() => setActiveTab('seguridad')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'seguridad' ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
            >
              <Shield className="w-5 h-5" /> Seguridad
            </button>
          </div>

          {/* Área de Contenido Principal */}
          <div className="lg:col-span-3 bg-white/80 backdrop-blur-xl rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8">
            
            {/* Taba: Cuenta */}
            {activeTab === 'cuenta' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-2xl font-extrabold text-slate-900 border-b border-slate-100 pb-4">Información del Perfil</h2>
                
                <div className="space-y-6">
                  {/* Grid 3 columnas para Nombres y Apellidos */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">Nombres</label>
                      <input 
                        type="text" 
                        value={userData.nombres}
                        onChange={(e) => setUserData({...userData, nombres: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">Apellido Paterno</label>
                      <input 
                        type="text" 
                        value={userData.apellido_paterno}
                        onChange={(e) => setUserData({...userData, apellido_paterno: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">Apellido Materno</label>
                      <input 
                        type="text" 
                        value={userData.apellido_materno}
                        onChange={(e) => setUserData({...userData, apellido_materno: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none" 
                      />
                    </div>
                  </div>

                  {/* Grid 2 columnas para Correo y RUT */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">Correo Electrónico</label>
                      <input 
                        type="email" 
                        value={userData.email}
                        onChange={(e) => setUserData({...userData, email: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">RUT Empresa / Cliente</label>
                      <input 
                        type="text" 
                        value={userData.rut} 
                        disabled
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed outline-none" 
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button 
                    onClick={handleActualizarPerfil}
                    className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-colors"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Suscripción */}
            {activeTab === 'suscripcion' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                
                {/* Estado Actual */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Plan Actual</p>
                      <h3 className="text-2xl font-black text-slate-900">{miSuscripcion?.plan?.nombre?.toUpperCase() || 'Cargando...'}</h3>
                    </div>
                    <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 font-bold rounded-full text-sm">
                      Estado: Activo
                    </span>
                  </div>

                  <div className="mb-2 flex justify-between text-sm font-bold">
                    <span className="text-slate-600">Uso de Trabajadores</span>
                    <span className="text-slate-900">{miSuscripcion?.trabajadores_actuales || 0} / {miSuscripcion?.plan?.limite_trabajadores || 0}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-1000 ${porcentajeUso >= 100 ? 'bg-red-500' : 'bg-slate-900'}`} 
                      style={{ width: `${porcentajeUso}%` }}
                    ></div>
                  </div>
                </div>

                {/* LOGICA INTELIGENTE DE PLANES */}
                {/* Si tiene el plan Corporativo (el máximo), mostramos un mensaje de éxito */}
                {miSuscripcion?.plan?.nombre?.toUpperCase().includes('CORPO') ? (
                  <div className="bg-slate-900 rounded-2xl p-8 text-center border border-slate-800">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-white mb-2">¡Tienes el plan máximo!</h3>
                    <p className="text-slate-400">Disfrutas de trabajadores ilimitados y todas las herramientas premium de Jornada40.</p>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-extrabold text-slate-900 pt-4">Mejorar Plan</h2>

                    {/* Mostrar Plan PYME SOLO si su plan actual NO incluye la palabra PYME */}
                    {!miSuscripcion?.plan?.nombre?.toUpperCase().includes('PYME') && (
                      <div className="bg-white rounded-2xl p-6 border-2 border-blue-100 hover:border-blue-500 transition-colors relative">
                        <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                          <div>
                            <h3 className="text-xl font-extrabold text-slate-900 mb-1">Plan PYME</h3>
                            <p className="text-slate-500 text-sm">Hasta 40 trabajadores. Ideal para empresas en crecimiento.</p>
                            <p className="text-2xl font-black text-slate-900 mt-2">$29.990 <span className="text-xs text-slate-400 font-medium">/ mes</span></p>
                          </div>
                          <button 
                            onClick={() => handleMejorarPlan(2, 'mensual')}
                            disabled={procesandoPago}
                            className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:bg-slate-300"
                          >
                            {procesandoPago ? 'Procesando...' : 'Mejorar a PYME'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Plan Corporativo (Siempre se muestra a menos que ya sea Corporativo, lo cual filtramos arriba) */}
                    <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                          <h3 className="text-xl font-extrabold text-white mb-1">Plan Corporativo</h3>
                          <p className="text-slate-400 text-sm">Hasta 200 trabajadores. Cargas masivas y soporte 24/7.</p>
                          <p className="text-2xl font-black text-white mt-2">$69.990 <span className="text-xs text-slate-500 font-medium">/ mes</span></p>
                        </div>
                        <button 
                          onClick={() => handleMejorarPlan(3, 'mensual')}
                          disabled={procesandoPago}
                          className="w-full md:w-auto px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-all disabled:bg-slate-700 disabled:text-slate-500"
                        >
                          {procesandoPago ? 'Procesando...' : 'Obtener Corporativo'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab: Seguridad */}
            {activeTab === 'seguridad' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-2xl font-extrabold text-slate-900 border-b border-slate-100 pb-4">Cambiar Contraseña</h2>
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
                  <button className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-colors">
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