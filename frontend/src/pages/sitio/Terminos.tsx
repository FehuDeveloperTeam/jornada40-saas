import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { J40Root, Logo, ToggleTema } from '../../components/j40';

interface Seccion { titulo: string; contenido?: string; lista?: string[] }

const SECCIONES: Seccion[] = [
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
                  'Suscripciones: El Servicio se ofrece mediante planes de suscripción (Semilla, Starter, Pyme y Corporativo) con cobro mensual o anual.',
                  'Renovación Automática: Los pagos se procesan a través de pasarelas de pago externas. Al suscribirse, el Cliente autoriza el cargo recurrente automático en su tarjeta al inicio de cada ciclo de facturación.',
                  'Cambios de Plan: El Cliente puede subir de plan en cualquier momento. El nuevo plan rige desde su pago; el período en curso del plan anterior no se prorratea ni se reembolsa. La baja de plan se programa desde el panel para el siguiente cobro: hasta entonces se mantiene el plan vigente, y solo procede si la cuenta cumple los límites del plan menor.',
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
];

export default function Terminos() {
  const navigate = useNavigate();
  // Con historial vuelve a la página anterior; abierta en una pestaña nueva
  // desde el registro, la cierra; si no, va al inicio.
  const volver = () => {
    if (window.history.length > 1) navigate(-1);
    else if (window.opener) window.close();
    else navigate('/');
  };

  return (
    <J40Root className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="max-w-[760px] mx-auto px-4 h-14 flex items-center gap-3">
          <button type="button" onClick={volver} className="inline-flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg">
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />Volver
          </button>
          <span className="flex-1" />
          <Logo tamano={28} />
          <ToggleTema />
        </div>
      </header>
      <main className="max-w-[760px] mx-auto px-4 py-10 flex flex-col gap-8">
        <div>
          <h1 className="text-[clamp(24px,3vw,32px)] font-semibold tracking-[-0.02em]">Términos y condiciones de uso</h1>
          <p className="text-[13px] text-fg-3 mt-1">Última actualización: marzo de 2026</p>
        </div>
        {SECCIONES.map((s) => (
          <section key={s.titulo} className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold pb-2 border-b border-line">{s.titulo}</h2>
            {s.contenido && <p className="text-[14px] text-fg-2 leading-relaxed">{s.contenido}</p>}
            {s.lista && (
              <ul className="flex flex-col gap-2 pl-1">
                {s.lista.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[14px] text-fg-2 leading-relaxed">
                    <span className="mt-2 size-1.5 rounded-full bg-brand shrink-0" aria-hidden />{item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
    </J40Root>
  );
}
