import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terminos() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        {/* BOTÓN VOLVER */}
        <button 
          onClick={() => {
            // Si tiene pestaña "madre" (se abrió con target="_blank"), la cerramos
            if (window.opener) {
              window.close();
            } else {
              // Si no, navegamos atrás o al registro
              navigate('/register');
            }
          }}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 hover:shadow mb-8"
        >
          <ArrowLeft size={18} />
          Volver
        </button>

        {/* CONTENEDOR DEL TEXTO */}
        <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-slate-200">
          
          <div className="text-center mb-10">
            <img src="/vite.svg" alt="Jornada40" className="h-12 w-auto mx-auto mb-4" />
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Términos y Condiciones de Uso</h1>
            <p className="text-slate-500">Última actualización: Marzo de 2026</p>
          </div>

          <div className="space-y-8 text-slate-600 leading-relaxed">
            
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">1. Aceptación de los Términos</h2>
              <p>Al registrarse, acceder o utilizar la plataforma Jornada40 (en adelante, "el Servicio" o "el Software"), usted (en adelante, "el Cliente" o "el Usuario") acepta estar legalmente vinculado por estos Términos y Condiciones. Si no está de acuerdo con alguno de los términos, no debe utilizar el Servicio.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">2. Descripción del Servicio</h2>
              <p>Jornada40 es un software como servicio (SaaS) diseñado para facilitar la gestión de recursos humanos, cálculo de liquidaciones y generación de documentos legales para la adaptación a la Ley de 40 Horas en Chile. <strong className="text-slate-800">Aclaración importante:</strong> Jornada40 es una herramienta tecnológica de asistencia administrativa y no constituye asesoría legal, contable ni representación ante la Dirección del Trabajo u otros organismos del Estado.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">3. Planes, Facturación y Pagos</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Suscripciones:</strong> El Servicio se ofrece mediante planes de suscripción (ej. Semilla, Pyme, Corporativo) con cobro mensual o anual.</li>
                <li><strong>Renovación Automática:</strong> Los pagos se procesan a través de pasarelas de pago externas. Al suscribirse, el Cliente autoriza el cargo recurrente automático en su tarjeta al inicio de cada ciclo de facturación.</li>
                <li><strong>Cambios de Plan:</strong> El Cliente puede cambiar de plan en cualquier momento. Los cobros se ajustarán de forma prorrateada en el siguiente ciclo.</li>
                <li><strong>No Reembolsos:</strong> Los pagos realizados no son reembolsables. Si el Cliente cancela, mantendrá el acceso hasta el final del período ya pagado.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">4. Obligaciones y Responsabilidad del Cliente</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>El Cliente es el único responsable de la veracidad y exactitud de los datos ingresados en la plataforma.</li>
                <li>El Cliente es responsable de mantener la confidencialidad de sus credenciales de acceso.</li>
                <li>Jornada40 no se hace responsable por multas, recargos o sanciones emitidas por la Dirección del Trabajo u otros entes fiscalizadores derivadas de información ingresada incorrectamente por el Usuario o por el mal uso de los documentos generados.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">5. Privacidad y Protección de Datos</h2>
              <p>En cumplimiento de la Ley N° 19.628 sobre Protección de la Vida Privada de Chile, Jornada40 se compromete a resguardar la información personal y financiera de los trabajadores del Cliente. Los datos ingresados pertenecen exclusivamente al Cliente. Jornada40 actúa únicamente como procesador de dichos datos, garantizando que no serán vendidos ni cedidos a terceros.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">6. Propiedad Intelectual</h2>
              <p>Todo el código fuente, diseño, logotipos, textos y algoritmos de la plataforma son propiedad exclusiva de Fehu Developers (<strong>www.fehudevelopers.cl</strong>) y Jornada40. El pago de la suscripción otorga una licencia de uso temporal y no exclusiva, no el derecho de propiedad sobre el software.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">7. Contacto</h2>
              <p>Para cualquier duda, solicitud de soporte o cancelación, el Cliente puede contactarnos al correo electrónico: <strong>contacto.jornada40@gmail.com</strong>.</p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}