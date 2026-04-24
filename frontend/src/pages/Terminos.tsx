import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terminos() {
  const navigate = useNavigate();

  const handleVolver = () => {
    if (window.opener) {
      window.close();
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: '#060f20' }}>

      {/* Orbe sutil */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">

        {/* Botón volver */}
        <button onClick={handleVolver}
          className="flex items-center gap-2 text-sm font-medium mb-8 transition-colors group"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="group-hover:text-white transition-colors">Volver</span>
        </button>

        {/* Tarjeta */}
        <div className="rounded-3xl p-10 glass-card">

          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 6px 24px rgba(37,99,235,0.35)' }}>
              <span className="text-white text-xl font-black">J</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Términos y Condiciones de Uso</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Última actualización: Marzo de 2026</p>
          </div>

          <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>

            {[
              {
                titulo: '1. Aceptación de los Términos',
                contenido: 'Al registrarse, acceder o utilizar la plataforma Jornada40 (en adelante, "el Servicio" o "el Software"), usted (en adelante, "el Cliente" o "el Usuario") acepta estar legalmente vinculado por estos Términos y Condiciones. Si no está de acuerdo con alguno de los términos, no debe utilizar el Servicio.',
              },
              {
                titulo: '2. Descripción del Servicio',
                contenido: 'Jornada40 es un software como servicio (SaaS) diseñado para facilitar la gestión de recursos humanos, cálculo de liquidaciones y generación de documentos legales para la adaptación a la Ley de 40 Horas en Chile. Aclaración importante: Jornada40 es una herramienta tecnológica de asistencia administrativa y no constituye asesoría legal, contable ni representación ante la Dirección del Trabajo u otros organismos del Estado.',
              },
              {
                titulo: '3. Planes, Facturación y Pagos',
                lista: [
                  'Suscripciones: El Servicio se ofrece mediante planes de suscripción (ej. Semilla, Pyme, Corporativo) con cobro mensual o anual.',
                  'Renovación Automática: Los pagos se procesan a través de pasarelas de pago externas. Al suscribirse, el Cliente autoriza el cargo recurrente automático en su tarjeta al inicio de cada ciclo de facturación.',
                  'Cambios de Plan: El Cliente puede cambiar de plan en cualquier momento. Los cobros se ajustarán de forma prorrateada en el siguiente ciclo.',
                  'No Reembolsos: Los pagos realizados no son reembolsables. Si el Cliente cancela, mantendrá el acceso hasta el final del período ya pagado.',
                ],
              },
              {
                titulo: '4. Obligaciones y Responsabilidad del Cliente',
                lista: [
                  'El Cliente es el único responsable de la veracidad y exactitud de los datos ingresados en la plataforma.',
                  'El Cliente es responsable de mantener la confidencialidad de sus credenciales de acceso.',
                  'Jornada40 no se hace responsable por multas, recargos o sanciones emitidas por la Dirección del Trabajo u otros entes fiscalizadores derivadas de información ingresada incorrectamente por el Usuario o por el mal uso de los documentos generados.',
                ],
              },
              {
                titulo: '5. Privacidad y Protección de Datos',
                contenido: 'En cumplimiento de la Ley N° 19.628 sobre Protección de la Vida Privada de Chile, Jornada40 se compromete a resguardar la información personal y financiera de los trabajadores del Cliente. Los datos ingresados pertenecen exclusivamente al Cliente. Jornada40 actúa únicamente como procesador de dichos datos, garantizando que no serán vendidos ni cedidos a terceros.',
              },
              {
                titulo: '6. Propiedad Intelectual',
                contenido: 'Todo el código fuente, diseño, logotipos, textos y algoritmos de la plataforma son propiedad exclusiva de Fehu Developers (www.fehudevelopers.cl) y Jornada40. El pago de la suscripción otorga una licencia de uso temporal y no exclusiva, no el derecho de propiedad sobre el software.',
              },
              {
                titulo: '7. Contacto',
                contenido: 'Para cualquier duda, solicitud de soporte o cancelación, el Cliente puede contactarnos al correo electrónico: contacto.jornada40@gmail.com.',
              },
            ].map((seccion) => (
              <section key={seccion.titulo}>
                <h2 className="text-base font-bold text-white mb-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                  {seccion.titulo}
                </h2>
                {seccion.contenido && <p>{seccion.contenido}</p>}
                {seccion.lista && (
                  <ul className="space-y-2 pl-4">
                    {seccion.lista.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#2563eb' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
}
