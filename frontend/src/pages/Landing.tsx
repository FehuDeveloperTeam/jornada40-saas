import { Link } from 'react-router-dom';
import { FileText, DollarSign, AlertTriangle, Clock, Check, ArrowRight, Zap, Shield, Users } from 'lucide-react';

const FEATURES = [
  {
    icon: FileText,
    titulo: 'Contratos de Trabajo',
    descripcion: 'Genera contratos indefinidos, a plazo fijo y por obra/faena con distribución horaria. Listos para imprimir en PDF.',
    color: '#2563eb',
  },
  {
    icon: DollarSign,
    titulo: 'Liquidaciones de Sueldo',
    descripcion: 'Calcula y emite liquidaciones mensuales con descuentos legales (AFP, ISAPRE, seguro cesantía) por trabajador.',
    color: '#10b981',
  },
  {
    icon: AlertTriangle,
    titulo: 'Documentos Legales',
    descripcion: 'Crea amonestaciones escritas, cartas de término de contrato y finiquitos en PDF listos para firmar.',
    color: '#f59e0b',
  },
  {
    icon: Clock,
    titulo: 'Control de Jornada',
    descripcion: 'Monitorea que ningún trabajador supere los límites semanales y mantén tu empresa en regla con la Ley 40 Horas.',
    color: '#8b5cf6',
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
    cta: 'Contactar Ventas',
  },
];

const STATS = [
  { icon: Users, value: '500+', label: 'Empresas activas' },
  { icon: FileText, value: '12.000+', label: 'Contratos generados' },
  { icon: Shield, value: '100%', label: 'Cumplimiento legal' },
  { icon: Zap, value: '< 2 min', label: 'Por liquidación' },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#060f20', color: '#f8fafc' }}>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50" style={{ background: 'rgba(6,15,32,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex justify-between items-center py-4 px-6 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="Jornada40" className="w-7 h-7 rounded-lg" />
            <span className="text-xl font-bold tracking-tight text-white">Jornada<span style={{ color: '#60a5fa' }}>40</span></span>
          </div>
          <div className="flex gap-3 items-center">
            <Link to="/login" className="px-4 py-2 text-sm font-semibold transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
              Iniciar Sesión
            </Link>
            <Link to="/register"
              className="px-4 py-2 text-sm font-bold text-white rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 2px 12px rgba(37,99,235,0.35)' }}>
              Crear Cuenta
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative py-28 px-6 text-center overflow-hidden">
        {/* Orbes decorativos */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 65%)' }} />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }} />
          {/* Grid sutil */}
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <span className="inline-block text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest mb-6 animate-fade-up"
            style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.35)', color: '#60a5fa' }}>
            Plataforma RRHH para Pymes Chilenas
          </span>

          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight leading-tight mb-6 animate-fade-up delay-100">
            Gestión laboral completa<br />
            <span style={{ background: 'linear-gradient(135deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              para cumplir la Ley de 40 Horas
            </span>
          </h1>

          <p className="text-lg max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-up delay-200"
            style={{ color: 'rgba(255,255,255,0.5)' }}>
            Crea contratos, liquida sueldos y genera documentos legales para todos tus trabajadores desde un solo lugar. Simple, rápido y 100% en línea.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up delay-300">
            <Link to="/register"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-bold text-white rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 24px rgba(37,99,235,0.4)' }}>
              Comienza Gratis Hoy <ArrowRight size={18} />
            </Link>
            <a href="#como-funciona"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-bold rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
              ¿Cómo funciona?
            </a>
          </div>

          <p className="mt-6 text-sm animate-fade-up delay-400" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Plan Semilla: 1 empresa, hasta 3 trabajadores — gratis de por vida.
          </p>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.2)' }}>
                <stat.icon size={18} style={{ color: '#60a5fa' }} />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">
              Todo lo que necesitas para gestionar tu personal
            </h2>
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Un sistema diseñado para que cumplir la ley no sea un problema.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div key={f.titulo} className="rounded-2xl p-6 flex flex-col gap-4 glass-card transition-transform hover:-translate-y-1">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: `${f.color}20`, border: `1px solid ${f.color}30` }}>
                  <f.icon size={20} style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-base text-white">{f.titulo}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{f.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">¿Cómo funciona?</h2>
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.4)' }}>
              En tres pasos tienes tu empresa lista para operar.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PASOS.map((paso, i) => (
              <div key={paso.numero} className="rounded-2xl p-7 flex flex-col gap-4 glass-card relative overflow-hidden">
                <div className="absolute top-4 right-4 text-6xl font-black leading-none select-none"
                  style={{ color: 'rgba(255,255,255,0.04)' }}>{paso.numero}</div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white relative z-10"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                  {i + 1}
                </div>
                <h3 className="font-bold text-base text-white leading-snug">{paso.titulo}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{paso.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">
              Planes para cada etapa de tu empresa
            </h2>
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Comienza gratis y escala cuando lo necesites.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANES_PREVIEW.map((plan) => (
              <div key={plan.nombre} className="relative rounded-3xl p-7 flex flex-col transition-transform hover:-translate-y-1"
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

                <h3 className="text-xl font-bold text-white mt-2 mb-1">{plan.nombre}</h3>
                <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>{plan.descripcion}</p>

                <div className="mb-6">
                  {plan.precio === 0 ? (
                    <span className="text-4xl font-bold text-white">Gratis</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">${plan.precio.toLocaleString('es-CL')}</span>
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>/mes</span>
                    </div>
                  )}
                </div>

                <ul className="space-y-2.5 flex-1 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <Check size={14} className="text-blue-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link to="/register"
                  className={`w-full py-3 rounded-xl font-bold text-center text-sm transition-all ${plan.destacado ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 px-6 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
        </div>
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <h2 className="text-4xl font-bold text-white mb-4">¿Listo para poner tu empresa al día?</h2>
          <p className="text-lg mb-10" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Únete a las empresas que ya gestionan su personal con Jornada40.
          </p>
          <Link to="/register"
            className="inline-flex items-center gap-2 px-10 py-4 text-base font-bold text-white rounded-xl transition-all"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 28px rgba(37,99,235,0.4)' }}>
            Crear Cuenta Gratis <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
          <span className="font-bold text-white text-base">
            Jornada<span style={{ color: '#60a5fa' }}>40</span>
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>© 2025 Jornada40. Todos los derechos reservados.</span>
          <Link to="/terminos" className="transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Términos y Condiciones
          </Link>
        </div>
      </footer>
    </div>
  );
}
