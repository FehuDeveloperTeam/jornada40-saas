import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { J40Root, Logo, ToggleTema } from '../../components/j40';

interface Seccion { titulo: string; contenido?: string; lista?: string[] }

/**
 * Política de privacidad de la extensión "Jornada40 para Mi DT". Las tiendas
 * de Chrome y Edge piden una URL pública con lo que la extensión lee, envía y
 * guarda; si la extensión cambia lo que hace con los datos, se actualiza aquí.
 */
const SECCIONES: Seccion[] = [
  {
    titulo: '1. Qué es la extensión',
    contenido: 'Jornada40 para Mi DT es una extensión para Chrome y Edge que ayuda a los empleadores que usan Jornada40 a registrar en Mi DT (midt.dirtrab.cl, de la Dirección del Trabajo) sus contratos, anexos y términos de contrato. Muestra en un panel lateral lo que falta registrar y, en los formularios de Mi DT, escribe los datos que ya están en Jornada40. La persona revisa todo y presiona ella misma los botones de Mi DT.',
  },
  {
    titulo: '2. Qué datos usa y para qué',
    lista: [
      'Conexión: al conectar la extensión con un código de Jornada40 se crea una clave propia de ese navegador. Queda guardada en el navegador; Jornada40 guarda solo una huella cifrada de ella, el nombre que le diste al computador y la fecha de último uso.',
      'Tu cuenta: tu nombre, el de la cuenta y las empresas a las que tienes acceso, para mostrar lo que te corresponde.',
      'Datos de los trabajadores (RUT, nombre, domicilio, datos del contrato): la extensión los pide a Jornada40 solo cuando abres la ficha de un registro, para mostrarlos y escribirlos en el formulario de Mi DT. No los guarda en el navegador y los olvida al cerrar la ficha.',
      'Lo que lee de Mi DT: la dirección y los títulos de la pantalla (para saber en qué formulario y etapa estás), el RUT del empleador con que entraste (para comprobar que es la empresa correcta), el nombre que Mi DT trae del Registro Civil al escribir un RUT (para compararlo con la ficha) y el mensaje de registro exitoso con su número de comprobante.',
      'Lo que envía a Jornada40: solo cuando tú lo indicas, que un registro quedó hecho, con su fecha y número de comprobante. Queda en la bitácora de tu cuenta con tu nombre.',
      'Modo levantamiento (opcional, lo inicias tú): envía a Jornada40 la estructura de una pantalla de Mi DT —nombres de los campos, tipos y opciones de las listas— para mantener al día el llenado automático. Nunca lo escrito en los campos; los RUT y correos que aparezcan se reemplazan por [rut] y [correo] antes de enviarse.',
    ],
  },
  {
    titulo: '3. Lo que la extensión no hace',
    lista: [
      'No ve, no pide ni guarda tu Clave Única. Entras a Mi DT como siempre.',
      'No inicia sesión en Mi DT por ti ni presiona los botones de avance o envío: eso lo haces tú.',
      'No funciona ni lee nada en otros sitios: solo en midt.dirtrab.cl y en la API de Jornada40.',
      'No vende ni comparte datos con terceros, no los usa para publicidad ni para crear perfiles, y no carga código desde internet.',
    ],
  },
  {
    titulo: '4. Uso limitado',
    contenido: 'El uso de la información que recibe la extensión se ajusta a la Política de datos de usuario de Chrome Web Store, incluidos sus requisitos de uso limitado, y a las políticas de Microsoft Edge Add-ons: se usa solo para el propósito descrito en esta página.',
  },
  {
    titulo: '5. Dónde se guarda y protección de datos',
    contenido: 'Lo que se envía a Jornada40 queda en sus servidores con las mismas medidas que el resto de la plataforma, en cumplimiento de la Ley N° 19.628 sobre Protección de la Vida Privada. Los datos pertenecen al empleador; Jornada40 actúa como encargado de su tratamiento.',
  },
  {
    titulo: '6. Cómo desconectarla y borrar lo guardado',
    lista: [
      'En el panel de la extensión: «Desconectar este navegador».',
      'En Jornada40 → Dirección del Trabajo → Extensión para Mi DT: «Desconectar» junto al navegador.',
      'Un navegador sin uso por 90 días se desconecta solo. Al desinstalar la extensión, el navegador borra lo que ella guardó.',
    ],
  },
  {
    titulo: '7. Permisos que pide y por qué',
    lista: [
      'Almacenamiento: guardar la conexión y la empresa elegida en este navegador.',
      'Panel lateral: mostrar la extensión junto a Mi DT.',
      'Acceso a midt.dirtrab.cl: reconocer el formulario y escribir los datos en él.',
      'Acceso a api.jornada40.cl: pedir a Jornada40 lo que falta registrar y marcarlo como registrado.',
    ],
  },
  {
    titulo: '8. Contacto',
    contenido: 'Para dudas sobre esta política o para pedir información sobre tus datos, escríbenos a contacto.jornada40@gmail.com.',
  },
];

export default function PrivacidadExtension() {
  const navigate = useNavigate();
  const volver = () => {
    if (window.history.length > 1) navigate(-1);
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
          <h1 className="text-[clamp(24px,3vw,32px)] font-semibold tracking-[-0.02em]">Política de privacidad de la extensión Jornada40 para Mi DT</h1>
          <p className="text-[13px] text-fg-3 mt-1">Última actualización: 9 de octubre de 2026</p>
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
