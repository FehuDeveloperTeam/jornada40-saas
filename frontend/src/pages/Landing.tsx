import { Link } from 'react-router-dom';
import { FileText, DollarSign, AlertTriangle, Clock, Check, ChevronRight } from 'lucide-react';

const FEATURES = [
  {
    icon: FileText,
    titulo: 'Contratos de Trabajo',
    descripcion: 'Genera contratos indefinidos, a plazo fijo y por obra/faena con distribución horaria. Listos para imprimir en PDF.',
    colorCard: 'bg-blue-50 border-blue-100',
    colorIcon: 'text-blue-600',
  },
  {
    icon: DollarSign,
    titulo: 'Liquidaciones de Sueldo',
    descripcion: 'Calcula y emite liquidaciones mensuales con descuentos legales (AFP, ISAPRE, seguro cesantía) por trabajador.',
    colorCard: 'bg-green-50 border-green-100',
    colorIcon: 'text-green-600',
  },
  {
    icon: AlertTriangle,
    titulo: 'Documentos Legales',
    descripcion: 'Crea amonestaciones escritas, cartas de término de contrato y finiquitos en PDF listos para firmar.',
    colorCard: 'bg-amber-50 border-amber-100',
    colorIcon: 'text-amber-600',
  },
  {
    icon: Clock,
    titulo: 'Control de Jornada',
    descripcion: 'Monitorea que ningún trabajador supere los límites semanales y mantén tu empresa en regla con la Ley 40 Horas.',
    colorCard: 'bg-purple-50 border-purple-100',
    colorIcon: 'text-purple-600',
  },
];

const PASOS = [
  {
    numero: '01',
    titulo: 'Registra tu empresa y trabajadores',
    descripcion: 'Ingresa los datos de tu empresa y agrega a tu equipo en minutos. Sin instalaciones ni configuraciones complejas.',
  },
  {
    numero: '02',
    titulo: 'Configura contratos y jornadas',
    descripcion: 'Define el tipo de contrato, la distribución horaria semanal y los datos de remuneración de cada trabajador.',
  },
  {
    numero: '03',
    titulo: 'Genera documentos con un clic',
    descripcion: 'Emite liquidaciones, contratos y documentos legales en PDF listos para descargar, imprimir o enviar.',
  },
];

const PLANES_PREVIEW = [
  {
    nombre: 'Semilla',
    precio: 0,
    descripcion: 'Para dar el primer paso hacia la gestión laboral digital.',
    features: ['1 empresa', 'Hasta 3 trabajadores', 'Contratos de trabajo', 'Liquidaciones de sueldo', 'Documentos legales'],
    destacado: false,
    cta: 'Comenzar Gratis',
  },
  {
    nombre: 'Pyme',
    precio: 29990,
    descripcion: 'La solución completa para gestionar tu plantilla laboral.',
    features: ['3 empresas', 'Hasta 40 trabajadores', 'Todo lo del plan Semilla', 'Importación masiva de trabajadores', 'Soporte por correo'],
    destacado: true,
    cta: 'Elegir Plan Pyme',
  },
  {
    nombre: 'Corporativo',
    precio: 69990,
    descripcion: 'Control total para grandes organizaciones y holdings.',
    features: ['10 empresas', 'Hasta 200 trabajadores', 'Todo lo del plan Pyme', 'Panel multi-empresa unificado', 'Soporte prioritario'],
    destacado: false,
    cta: 'Contactar Ventas',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col text-slate-900">

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="flex justify-between items-center py-4 px-6 max-w-7xl mx-auto w-full">
          <div className="text-2xl font-extrabold tracking-tight">
            Jornada<span className="text-blue-600">40</span>
          </div>
          <div className="flex gap-3 items-center">
            <Link to="/login" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
              Iniciar Sesión
            </Link>
            <Link to="/register" className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm">
              Crear Cuenta
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="py-20 px-6 text-center bg-gradient-to-b from-blue-50/60 to-white">
        <div className="max-w-4xl mx-auto space-y-6">
          <span className="inline-block text-xs font-bold text-blue-600 bg-blue-100 px-4 py-1.5 rounded-full uppercase tracking-widest">
            Plataforma RRHH para Pymes Chilenas
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Gestión laboral completa<br />
            <span className="text-blue-600">para cumplir la Ley de 40 Horas</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Crea contratos, liquida sueldos y genera documentos legales para todos tus trabajadores desde un solo lugar. Simple, rápido y 100% en línea.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              to="/register"
              className="px-8 py-4 text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Comienza Gratis Hoy
            </Link>
            <a
              href="#como-funciona"
              className="px-8 py-4 text-lg font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"
            >
              ¿Cómo funciona?
            </a>
          </div>
          <p className="text-sm text-slate-400">
            Plan Semilla incluye 1 empresa y hasta 3 trabajadores — gratis de por vida.
          </p>
        </div>
      </section>

      {/* QUÉ PUEDES HACER */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-slate-900">
              Todo lo que necesitas para gestionar tu personal
            </h2>
            <p className="text-slate-500 mt-3 text-lg">
              Un sistema diseñado para que cumplir la ley no sea un problema.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.titulo} className={`rounded-2xl border p-6 flex flex-col gap-4 ${f.colorCard}`}>
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <f.icon size={22} className={f.colorIcon} />
                </div>
                <h3 className="font-bold text-lg text-slate-900">{f.titulo}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-slate-900">¿Cómo funciona?</h2>
            <p className="text-slate-500 mt-3 text-lg">En tres pasos tienes tu empresa lista para operar.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PASOS.map((paso) => (
              <div key={paso.numero} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 flex flex-col gap-4">
                <span className="text-5xl font-extrabold text-blue-100 leading-none">{paso.numero}</span>
                <h3 className="font-bold text-lg text-slate-900">{paso.titulo}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{paso.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-slate-900">
              Planes para cada etapa de tu empresa
            </h2>
            <p className="text-slate-500 mt-3 text-lg">
              Comienza gratis y escala cuando lo necesites.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {PLANES_PREVIEW.map((plan) => (
              <div
                key={plan.nombre}
                className={`relative rounded-3xl border-2 p-8 flex flex-col gap-6 ${
                  plan.destacado
                    ? 'border-blue-500 shadow-xl shadow-blue-100/50 bg-blue-50/30'
                    : 'border-slate-100 bg-white shadow-sm'
                }`}
              >
                {plan.destacado && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                      Más Popular
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{plan.nombre}</h3>
                  <p className="text-sm text-slate-500 mt-1">{plan.descripcion}</p>
                </div>
                <div>
                  {plan.precio === 0 ? (
                    <span className="text-4xl font-extrabold text-slate-900">Gratis</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-slate-900">
                        ${plan.precio.toLocaleString('es-CL')}
                      </span>
                      <span className="text-slate-500 font-medium">/mes</span>
                    </div>
                  )}
                </div>
                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                      <Check size={15} className="text-blue-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`w-full py-3 rounded-xl font-bold text-center transition-all ${
                    plan.destacado
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 px-6 bg-slate-900 text-white text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-extrabold">¿Listo para poner tu empresa al día?</h2>
          <p className="text-slate-400 text-lg">
            Únete a las empresas que ya gestionan su personal con Jornada40.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg"
          >
            Crear Cuenta Gratis <ChevronRight size={20} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-400">
          <span className="font-bold text-slate-700 text-base">
            Jornada<span className="text-blue-600">40</span>
          </span>
          <span>© 2025 Jornada40. Todos los derechos reservados.</span>
          <Link to="/terminos" className="hover:text-slate-700 transition-colors">
            Términos y Condiciones
          </Link>
        </div>
      </footer>
    </div>
  );
}
