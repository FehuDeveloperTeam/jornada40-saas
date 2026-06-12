import { Link } from 'react-router-dom';
import {
  FileText, DollarSign, PenLine, FileCheck,
  AlertTriangle, Calendar, BarChart2, Clock,
  Check, ArrowRight, Zap, Shield, Users,
  Lock, Mail, Download, Building2, ChevronRight,
} from 'lucide-react';

// Cuando el video esté disponible, asignar la ruta aquí (ej: '/hero-bg.mp4')
const VIDEO_HERO_SRC = 'https://jornada40.cl/public/J40Landing.mp4';

const FEATURES = [
  {
    icon: FileText,
    titulo: 'Contratos de Trabajo',
    descripcion: 'Indefinidos, a plazo fijo y por obra/faena con distribución horaria semanal. Incluye Anexo Ley 40 Horas automático.',
    color: '#2563eb',
  },
  {
    icon: DollarSign,
    titulo: 'Liquidaciones de Sueldo',
    descripcion: 'Calcula AFP, ISAPRE y seguro cesantía. Exporta el Libro de Remuneraciones en Excel y el archivo para Previred.',
    color: '#10b981',
  },
  {
    icon: PenLine,
    titulo: 'Firma Electrónica Simple',
    descripcion: 'Envía cualquier documento a firma por email. El trabajador confirma su identidad con OTP y firma desde el navegador.',
    color: '#6366f1',
  },
  {
    icon: FileCheck,
    titulo: 'Finiquitos',
    descripcion: 'Calcula indemnización, feriado proporcional y gratificación. PDF listo para firmar electrónicamente.',
    color: '#f59e0b',
  },
  {
    icon: AlertTriangle,
    titulo: 'Documentos Legales',
    descripcion: 'Amonestaciones escritas, cartas de despido y constancias laborales generadas en PDF con un clic.',
    color: '#ef4444',
  },
  {
    icon: Calendar,
    titulo: 'Vacaciones y Permisos',
    descripcion: 'Controla el saldo de vacaciones, feriado progresivo (Art. 68) y permisos sin goce de cada trabajador.',
    color: '#8b5cf6',
  },
  {
    icon: BarChart2,
    titulo: 'Reportes y Exportaciones',
    descripcion: 'Expediente completo en ZIP por trabajador, Libro de Remuneraciones y panel de estadísticas del equipo.',
    color: '#14b8a6',
  },
  {
    icon: Clock,
    titulo: 'Control de Jornada 40h',
    descripcion: 'Monitorea que ningún trabajador supere los límites semanales. Mantén tu empresa en regla automáticamente.',
    color: '#f97316',
  },
];

const FIRMA_PASOS = [
  { icon: FileText, label: 'El sistema genera el PDF del documento' },
  { icon: Mail,     label: 'El trabajador recibe el enlace por email' },
  { icon: Lock,     label: 'Verifica su identidad con código OTP de un solo uso' },
  { icon: PenLine,  label: 'Firma manuscrita desde cualquier dispositivo' },
  { icon: Download, label: 'PDF certificado guardado y enviado a ambas partes' },
];

const PASOS = [
  {
    numero: '01',
    titulo: 'Registra tu empresa y trabajadores',
    descripcion: 'Ingresa los datos de tu empresa y agrega a tu equipo. Sin instalaciones ni configuraciones técnicas.',
  },
  {
    numero: '02',
    titulo: 'Configura contratos y jornadas',
    descripcion: 'Define tipo de contrato, distribución horaria semanal y remuneración. El Anexo 40 Horas se genera automáticamente.',
  },
  {
    numero: '03',
    titulo: 'Genera documentos y recibe firmas',
    descripcion: 'Emite liquidaciones, contratos y documentos legales. Envíalos a firma electrónica directamente desde la plataforma.',
  },
  {
    numero: '04',
    titulo: 'Exporta y mantén todo en regla',
    descripcion: 'Descarga expedientes completos, el Libro de Remuneraciones y el archivo Previred con un solo clic.',
  },
];

const PLANES_PREVIEW = [
  {
    nombre: 'Semilla',
    precio: 0,
    descripcion: 'Para dar el primer paso hacia la gestión laboral digital.',
    features: [
      '1 empresa · hasta 3 trabajadores',
      'Contratos + Anexo 40 Horas',
      'Liquidaciones de sueldo',
      'Documentos legales (amonestaciones, constancias)',
      'Firma electrónica simple',
    ],
    cta: 'Comenzar Gratis',
  },
  {
    nombre: 'Starter',
    precio: 16990,
    descripcion: 'Todo lo esencial para gestionar tu equipo sin límites básicos.',
    features: [
      '1 empresa · hasta 10 trabajadores',
      'Todo lo del plan Semilla',
      'Finiquitos con cálculo automático',
      'Gestión de vacaciones y permisos',
    ],
    cta: 'Elegir Starter',
  },
  {
    nombre: 'Pyme',
    precio: 39990,
    descripcion: 'La solución completa para empresas en crecimiento.',
    features: [
      '3 empresas · hasta 75 trabajadores',
      'Todo lo del plan Starter',
      'Libro de Remuneraciones + Previred',
      'Expediente digital completo en ZIP',
      'Importación masiva por Excel',
    ],
    destacado: true,
    cta: 'Elegir Plan Pyme',
  },
  {
    nombre: 'Corporativo',
    precio: 89990,
    descripcion: 'Control total para holdings y grandes organizaciones.',
    features: [
      '10 empresas · hasta 250 trabajadores',
      'Todo lo del plan Pyme',
      'Panel multi-empresa unificado',
      'Soporte prioritario',
    ],
    cta: 'Contactar Ventas',
  },
];

const STATS = [
  { icon: Users,     value: '500+',    label: 'Empresas activas' },
  { icon: FileText,  value: '12.000+', label: 'Documentos generados' },
  { icon: Shield,    value: '100%',    label: 'Cumplimiento legal' },
  { icon: Zap,       value: '< 2 min', label: 'Por liquidación' },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--c-bg-app)', color: 'var(--c-text-1)' }}>

      {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50"
        style={{ background: 'var(--c-bg-navbar)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex justify-between items-center py-4 px-6 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="Jornada40" className="w-7 h-7 rounded-lg" />
            <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--c-text-1)' }}>
              Jornada<span style={{ color: '#60a5fa' }}>40</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#funcionalidades" style={{ color: 'var(--c-text-2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-text-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-2)')}>
              Funcionalidades
            </a>
            <a href="#firma-electronica" style={{ color: 'var(--c-text-2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-text-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-2)')}>
              Firma Electrónica
            </a>
            <a href="#planes" style={{ color: 'var(--c-text-2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-text-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-2)')}>
              Planes
            </a>
          </div>
          <div className="flex gap-3 items-center">
            <Link to="/login" className="px-4 py-2 text-sm font-semibold transition-colors"
              style={{ color: 'var(--c-text-2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-text-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-2)')}>
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

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative flex items-center justify-center overflow-hidden" style={{ minHeight: '92vh' }}>

        {/* Video de fondo — se activa cuando VIDEO_HERO_SRC tenga valor */}
        {VIDEO_HERO_SRC && (
          <video
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
            src={VIDEO_HERO_SRC}
          />
        )}

        {/* Capa de color sobre el video */}
        <div className="absolute inset-0" style={{ background: 'rgba(6,15,32,0.78)' }} />

        {/* Decoración */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[600px] rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 65%)' }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(var(--c-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--c-grid-line) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10 py-24">
          <span className="inline-block text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest mb-8"
            style={{ background: 'rgba(37,99,235,0.18)', border: '1px solid rgba(37,99,235,0.4)', color: '#93c5fd' }}>
            Plataforma RRHH para Pymes Chilenas · Ley 40 Horas
          </span>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6 text-white">
            Gestión laboral<br />
            <span style={{ background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              sin complicaciones
            </span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-4 text-white/70">
            Contratos, liquidaciones, finiquitos, vacaciones y firma electrónica para todos tus trabajadores.
            Desde un solo lugar. Simple, rápido y 100% en línea.
          </p>
          <p className="text-sm mb-10 text-white/40">
            Cumple la Ley de 40 Horas y la normativa laboral vigente sin depender de un estudio contable.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-bold text-white rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 28px rgba(37,99,235,0.45)' }}>
              Crear cuenta gratis <ArrowRight size={18} />
            </Link>
            <a href="#funcionalidades"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-bold rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)' }}>
              Ver funcionalidades
            </a>
          </div>

          <p className="mt-6 text-sm text-white/30">
            Plan Semilla: 1 empresa, hasta 3 trabajadores — gratis de por vida. Sin tarjeta de crédito.
          </p>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────────────── */}
      <section className="py-14 px-6" style={{ borderTop: '1px solid var(--c-border)', borderBottom: '1px solid var(--c-border)' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.2)' }}>
                <stat.icon size={18} style={{ color: '#60a5fa' }} />
              </div>
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--c-text-1)' }}>{stat.value}</div>
              <div className="text-xs font-medium" style={{ color: 'var(--c-text-3)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FUNCIONALIDADES ────────────────────────────────────────────── */}
      <section id="funcionalidades" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4"
              style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)', color: '#60a5fa' }}>
              Todo en uno
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--c-text-1)' }}>
              Cada módulo que necesita tu empresa
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--c-text-3)' }}>
              Un sistema diseñado para que cumplir la ley laboral no dependa de terceros.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f.titulo}
                className="rounded-2xl p-6 flex flex-col gap-3 transition-transform hover:-translate-y-1"
                style={{ background: 'var(--c-bg-card-2)', border: '1px solid var(--c-border)', backdropFilter: 'blur(12px)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${f.color}18`, border: `1px solid ${f.color}28` }}>
                  <f.icon size={18} style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--c-text-1)' }}>{f.titulo}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--c-text-3)' }}>{f.descripcion}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all"
              style={{ background: 'var(--c-bg-input)', border: '1px solid var(--c-border-2)', color: 'var(--c-text-2)' }}>
              Explorar todas las funciones <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FIRMA ELECTRÓNICA ──────────────────────────────────────────── */}
      <section id="firma-electronica" className="py-28 px-6 relative overflow-hidden"
        style={{ background: 'var(--c-bg-card-2)', borderTop: '1px solid var(--c-border)', borderBottom: '1px solid var(--c-border)' }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Texto */}
            <div>
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-5"
                style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                Incluida en todos los planes
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mb-5 leading-tight" style={{ color: 'var(--c-text-1)' }}>
                Firma Electrónica Simple<br />
                <span style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  integrada en el flujo
                </span>
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--c-text-2)' }}>
                Envía contratos, liquidaciones, finiquitos y cualquier documento laboral a la firma del trabajador
                sin salir de Jornada40. Sin aplicaciones externas, sin costos adicionales.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                {['Ley N° 19.799', 'OTP por email', 'PDF certificado', 'Registro de IP y fecha'].map(tag => (
                  <span key={tag} className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                    {tag}
                  </span>
                ))}
              </div>
              <Link to="/register"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold text-white rounded-xl transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
                Probar gratis <ArrowRight size={16} />
              </Link>
            </div>

            {/* Flujo paso a paso */}
            <div className="flex flex-col gap-3">
              {FIRMA_PASOS.map((paso, i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl px-5 py-4 transition-colors"
                  style={{ background: 'var(--c-bg-input)', border: '1px solid var(--c-border)' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <paso.icon size={16} style={{ color: '#818cf8' }} />
                  </div>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xs font-bold tabular-nums" style={{ color: 'rgba(99,102,241,0.7)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--c-text-2)' }}>{paso.label}</span>
                  </div>
                  {i < FIRMA_PASOS.length - 1 && (
                    <ChevronRight size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
                  )}
                  {i === FIRMA_PASOS.length - 1 && (
                    <Check size={14} style={{ color: '#34d399', flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ──────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--c-text-1)' }}>
              ¿Cómo funciona?
            </h2>
            <p className="text-lg" style={{ color: 'var(--c-text-3)' }}>
              En cuatro pasos tienes tu empresa lista para operar.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PASOS.map((paso, i) => (
              <div key={paso.numero} className="rounded-2xl p-7 flex flex-col gap-4 relative overflow-hidden"
                style={{ background: 'var(--c-bg-card-2)', border: '1px solid var(--c-border)', backdropFilter: 'blur(12px)' }}>
                <div className="absolute top-3 right-4 text-7xl font-black leading-none select-none"
                  style={{ color: 'var(--c-bg-card-2)', WebkitTextStroke: '1px var(--c-border)' }}>
                  {paso.numero}
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white relative z-10"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                  {i + 1}
                </div>
                <h3 className="font-bold text-sm leading-snug" style={{ color: 'var(--c-text-1)' }}>{paso.titulo}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--c-text-3)' }}>{paso.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANES ─────────────────────────────────────────────────────── */}
      <section id="planes" className="py-28 px-6"
        style={{ background: 'var(--c-bg-card-2)', borderTop: '1px solid var(--c-border)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4"
              style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)', color: '#60a5fa' }}>
              Precios
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--c-text-1)' }}>
              Planes para cada etapa
            </h2>
            <p className="text-lg" style={{ color: 'var(--c-text-3)' }}>
              Comienza gratis y escala cuando lo necesites. Sin contratos de permanencia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANES_PREVIEW.map((plan) => (
              <div key={plan.nombre} className="relative rounded-3xl p-8 flex flex-col transition-transform hover:-translate-y-1"
                style={{
                  background: plan.destacado ? 'rgba(37,99,235,0.1)' : 'var(--c-bg-card)',
                  border: plan.destacado ? '1px solid rgba(37,99,235,0.45)' : '1px solid var(--c-border)',
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

                <h3 className="text-xl font-bold mt-2 mb-1" style={{ color: 'var(--c-text-1)' }}>{plan.nombre}</h3>
                <p className="text-sm mb-5" style={{ color: 'var(--c-text-3)' }}>{plan.descripcion}</p>

                <div className="mb-7">
                  {plan.precio === 0 ? (
                    <div>
                      <span className="text-4xl font-black" style={{ color: 'var(--c-text-1)' }}>Gratis</span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--c-text-3)' }}>de por vida</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black" style={{ color: 'var(--c-text-1)' }}>
                          ${plan.precio.toLocaleString('es-CL')}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--c-text-3)' }}>/mes</span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--c-text-4)' }}>IVA incluido · Sin permanencia</p>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--c-text-2)' }}>
                      <Check size={14} className="shrink-0 mt-0.5" style={{ color: plan.destacado ? '#60a5fa' : '#34d399' }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link to="/register"
                  className={`w-full py-3.5 rounded-xl font-bold text-center text-sm transition-all ${plan.destacado ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {plan.cta} <ArrowRight size={15} />
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs mt-8" style={{ color: 'var(--c-text-4)' }}>
            ¿Necesitas un plan a medida para más de 250 trabajadores?{' '}
            <a href="mailto:hola@jornada40.cl" className="underline" style={{ color: 'var(--c-text-3)' }}>
              Contáctanos
            </a>
          </p>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────────────── */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-08"
            style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
        </div>
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
            style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)' }}>
            <Building2 size={28} style={{ color: '#60a5fa' }} />
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-5 leading-tight" style={{ color: 'var(--c-text-1)' }}>
            ¿Listo para poner tu empresa<br />
            <span style={{ background: 'linear-gradient(135deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              al día con la ley?
            </span>
          </h2>
          <p className="text-lg mb-10" style={{ color: 'var(--c-text-3)' }}>
            Únete a las empresas que ya gestionan su personal con Jornada40.
            Comienza gratis hoy, sin tarjeta de crédito.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register"
              className="inline-flex items-center gap-2 px-10 py-4 text-base font-bold text-white rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 32px rgba(37,99,235,0.45)' }}>
              Crear cuenta gratis <ArrowRight size={18} />
            </Link>
            <Link to="/login"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-bold rounded-xl transition-all"
              style={{ background: 'var(--c-bg-input)', border: '1px solid var(--c-border-2)', color: 'var(--c-text-2)' }}>
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6" style={{ borderTop: '1px solid var(--c-border)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/favicon.svg" alt="Jornada40" className="w-6 h-6 rounded" />
                <span className="font-bold text-base" style={{ color: 'var(--c-text-1)' }}>
                  Jornada<span style={{ color: '#60a5fa' }}>40</span>
                </span>
              </div>
              <p className="text-sm max-w-xs" style={{ color: 'var(--c-text-3)' }}>
                Plataforma de gestión laboral para pymes chilenas. Cumple la Ley de 40 Horas desde el día uno.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-4)' }}>Producto</span>
                <a href="#funcionalidades" style={{ color: 'var(--c-text-3)' }}>Funcionalidades</a>
                <a href="#firma-electronica" style={{ color: 'var(--c-text-3)' }}>Firma Electrónica</a>
                <a href="#planes" style={{ color: 'var(--c-text-3)' }}>Planes y Precios</a>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-4)' }}>Legal</span>
                <Link to="/terminos" style={{ color: 'var(--c-text-3)' }}>Términos y Condiciones</Link>
                <a href="mailto:hola@jornada40.cl" style={{ color: 'var(--c-text-3)' }}>Contacto</a>
              </div>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs"
            style={{ borderTop: '1px solid var(--c-border)', color: 'var(--c-text-4)' }}>
            <span>© 2025 Jornada40. Todos los derechos reservados.</span>
            <span>Firma Electrónica Simple bajo Ley N° 19.799 · Chile</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
