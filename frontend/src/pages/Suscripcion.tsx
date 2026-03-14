import { useState, useEffect } from 'react';
import axios from 'axios';
import { Check, CreditCard, AlertCircle, Zap } from 'lucide-react';

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
  trabajadores_actuales: number; // Dato calculado que enviaremos desde el back
}

export default function Suscripcion() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [miSuscripcion, setMiSuscripcion] = useState<MiSuscripcion | null>(null);
  const [loading, setLoading] = useState(true);

  // Configuración de Axios
  const apiConfig = { withCredentials: true };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [planesRes, subRes] = await Promise.all([
          axios.get('https://jornada40-saas-production.up.railway.app/api/planes/', apiConfig),
          axios.get('https://jornada40-saas-production.up.railway.app/api/clientes/mi_suscripcion/', apiConfig)
        ]);
        
        setPlanes(planesRes.data);
        setMiSuscripcion(subRes.data);
      } catch (error) {
        console.error("Error cargando suscripción:", error);
      } finally {
        // Esto apaga el mensaje de "Cargando..." y arregla el error de setLoading
        setLoading(false); 
      }
    };

    fetchData(); // Aquí llamamos a la función interna
  }, []);

  const handlePagar = async (planId: number) => {
    // Aquí conectaremos Mercado Pago o Fintoc
    alert(`Iniciando pasarela de pago para el plan ${planId}...`);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando información de facturación...</div>;

  const porcentajeUso = miSuscripcion 
    ? Math.round((miSuscripcion.trabajadores_actuales / miSuscripcion.plan.limite_trabajadores) * 100) 
    : 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Mi Suscripción</h1>
        <p className="text-slate-500 mt-2">Gestiona tu plan, límites de trabajadores y métodos de pago.</p>
      </div>

      {/* ESTADO ACTUAL */}
      {miSuscripcion && (
        <div className={`p-6 rounded-2xl border ${miSuscripcion.estado === 'PAST_DUE' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'} shadow-sm flex flex-col md:flex-row gap-6 justify-between items-center`}>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-slate-800">Plan Actual: {miSuscripcion.plan.nombre}</h2>
              {miSuscripcion.estado === 'ACTIVE' && <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><Check size={14}/> Activa</span>}
              {miSuscripcion.estado === 'PAST_DUE' && <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><AlertCircle size={14}/> Pago Pendiente</span>}
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between text-sm font-medium text-slate-600 mb-1">
                <span>Trabajadores ingresados</span>
                <span>{miSuscripcion.trabajadores_actuales} / {miSuscripcion.plan.limite_trabajadores}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full ${porcentajeUso >= 90 ? 'bg-red-500' : porcentajeUso >= 75 ? 'bg-yellow-400' : 'bg-blue-600'}`} style={{ width: `${porcentajeUso}%` }}></div>
              </div>
              {porcentajeUso >= 100 && <p className="text-xs text-red-600 mt-2 font-semibold">Has alcanzado el límite de tu plan. Necesitas actualizar para ingresar más trabajadores.</p>}
            </div>
          </div>

          <div className="w-full md:w-auto min-w-[250px] bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-600 mb-2 font-medium">
              <CreditCard size={18} />
              <span>Método de Pago</span>
            </div>
            <p className="text-slate-900 font-bold">{miSuscripcion.metodo_pago_glosa || 'No registrado'}</p>
            <p className="text-sm text-slate-500 mt-1">Próximo cobro: {miSuscripcion.fecha_proximo_cobro || '-'}</p>
          </div>
        </div>
      )}

      {/* TARJETAS DE PLANES */}
      <div className="mt-12">
        <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Zap className="text-blue-600" /> Mejora tu Plan
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planes.map((plan) => (
            <div key={plan.id} className={`relative flex flex-col p-6 rounded-2xl border ${miSuscripcion?.plan.id === plan.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'} bg-white hover:shadow-lg transition-shadow`}>
              
              {miSuscripcion?.plan.id === plan.id && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl">
                  TU PLAN
                </div>
              )}

              <h4 className="text-lg font-bold text-slate-900">{plan.nombre}</h4>
              <p className="text-sm text-slate-500 mt-1 h-10">{plan.descripcion}</p>
              
              <div className="my-6">
                <span className="text-4xl font-extrabold text-slate-900">${plan.precio.toLocaleString('es-CL')}</span>
                <span className="text-slate-500 font-medium"> /mes</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-2 text-sm text-slate-700">
                  <Check size={16} className="text-blue-500" /> 
                  Hasta <strong>{plan.limite_trabajadores}</strong> trabajadores
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-700">
                  <Check size={16} className="text-blue-500" /> 
                  Soporte Legislación DT
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-700">
                  <Check size={16} className="text-blue-500" /> 
                  Generación de Anexos PDF
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
                {miSuscripcion?.plan.id === plan.id ? 'Plan Actual' : 'Seleccionar Plan'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}