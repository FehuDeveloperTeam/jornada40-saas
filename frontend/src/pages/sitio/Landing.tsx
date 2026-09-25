import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Minus, Plus } from 'lucide-react';
import { Button, J40Root, Logo } from '../../components/j40';
import { SitioHeader } from '../../components/sitio/SitioHeader';
import {
  FUNCIONES, INCLUYE_POR_NIVEL, NIVEL_DESTACADO, SEGURIDAD, hitosLey, preguntasFrecuentes,
} from '../../components/sitio/contenido';
import { useTheme } from '../../hooks/useTheme';
import { formatearPrecio, precioCiclo, textoCiclo, textoEmpresas, textoTrabajadores, usePlanes } from '../../hooks/usePlanes';
import type { Ciclo } from '../../hooks/usePlanes';
import { SelectorCiclo } from '../../components/sitio/SelectorCiclo';
import { cn } from '../../utils/cn';
import { ETAPAS_LEY_40, diasHasta, jornadaMaximaVigente } from '../../utils/ley40';
import panelClaro from '../../assets/sitio/panel-claro.webp';
import panelOscuro from '../../assets/sitio/panel-oscuro.webp';

// Márgenes laterales y verticales que el handoff repite en cada sección.
const CONTENEDOR = 'max-w-[1200px] mx-auto px-[clamp(16px,3vw,32px)]';
const SEPARACION = 'pt-[clamp(64px,9vw,112px)]';
const TITULO_SECCION = 'text-[clamp(26px,3.4vw,38px)] leading-[1.15] font-semibold tracking-[-0.025em] text-balance';

function Eyebrow({ children, className }: { children: string; className?: string }) {
  return <span className={cn('text-[13px] font-semibold text-brand-text', className)}>{children}</span>;
}

export default function Landing() {
  const navigate = useNavigate();

  // Las anclas del menú (#precios, #ley…) se desplazan suave solo en el sitio.
  useEffect(() => {
    const html = document.documentElement;
    const anterior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'smooth';
    return () => { html.style.scrollBehavior = anterior; };
  }, []);

  return (
    <J40Root>
      <SitioHeader />
      <main>
        <Hero onComenzar={() => navigate('/register')} />
        <VistaProducto />
        <Funciones />
        <CalendarioLey />
        <Seguridad />
        <Precios />
        <PreguntasFrecuentes />
        <LlamadoFinal />
      </main>
      <Pie />
    </J40Root>
  );
}

function Hero({ onComenzar }: { onComenzar: () => void }) {
  return (
    <section className={cn(CONTENEDOR, 'pt-[clamp(48px,8vw,96px)] flex flex-col items-center text-center gap-[22px]')}>
      <a href="#ley"
        className="inline-flex items-center gap-2 h-8 pl-3 pr-3 min-[420px]:pr-1.5 rounded-full border border-line bg-surface text-fg-2 text-[12.5px] font-medium whitespace-nowrap no-underline hover:no-underline hover:border-line-strong">
        <span className="size-[7px] rounded-full bg-brand" aria-hidden />
        Jornada máxima vigente: {jornadaMaximaVigente()} horas
        {/* En teléfonos angostos no cabe: toda la pastilla ya lleva al calendario. */}
        <span className="hidden min-[420px]:inline-flex h-[22px] px-2 rounded-full bg-brand-soft text-brand-text items-center">Ver calendario</span>
      </a>
      <h1 className="max-w-[880px] text-[clamp(34px,5.6vw,62px)] leading-[1.06] font-semibold tracking-[-0.035em] text-balance">
        Personas, contratos y sueldos en regla con la Ley 40 horas.
      </h1>
      <p className="max-w-[620px] text-[clamp(15px,1.6vw,18px)] text-fg-2 text-pretty">
        Jornada40 reúne la carpeta de cada trabajador: contrato, jornada, liquidaciones, vacaciones y documentos
        legales, con firma electrónica incluida. Hecho en Chile para pymes chilenas.
      </p>
      <div className="flex gap-2.5 flex-wrap justify-center">
        <Button tamano="lg" onClick={onComenzar}>Comenzar gratis</Button>
        <a href="#precios"
          className="inline-flex items-center h-12 px-[22px] rounded-[11px] border border-line-strong bg-surface text-fg text-[15px] font-medium no-underline hover:no-underline hover:bg-surface-2">
          Ver precios
        </a>
      </div>
      <ul className="flex gap-x-5 gap-y-2 flex-wrap justify-center text-[12.5px] text-fg-3">
        {['Gratis hasta 3 trabajadores', 'Sin tarjeta de crédito', 'Importa tu nómina desde Excel'].map((t) => (
          <li key={t} className="inline-flex items-center gap-1.5">
            <Check className="size-[17px] text-ok" strokeWidth={2} aria-hidden />{t}
          </li>
        ))}
      </ul>
    </section>
  );
}

function VistaProducto() {
  const { theme } = useTheme();
  return (
    <section id="producto" className="max-w-[1200px] mx-auto px-[clamp(12px,3vw,32px)] pt-[clamp(36px,5vw,56px)]">
      <div className="rounded-2xl border border-line bg-surface shadow-pop-lg overflow-hidden">
        <div className="flex items-center gap-2 h-10 px-3.5 border-b border-line bg-surface-2" aria-hidden>
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="flex-1 text-center text-[12px] text-fg-3 j40-mono truncate pr-10">
            app.jornada40.cl · Carpeta del trabajador
          </span>
        </div>
        {/* Captura del panel rediseñado (1440×900), en el tema activo. */}
        <img
          src={theme === 'dark' ? panelOscuro : panelClaro}
          alt="Carpeta de un trabajador en Jornada40: datos del contrato, última liquidación y alerta de jornada sobre el máximo vigente."
          width={2000}
          height={1250}
          className="block w-full h-auto aspect-[16/10] bg-canvas"
          fetchPriority="high"
        />
      </div>
    </section>
  );
}

function Funciones() {
  return (
    <section className={cn(CONTENEDOR, SEPARACION)}>
      <div className="flex flex-col gap-2.5 max-w-[640px] mb-9">
        <Eyebrow>Una carpeta por trabajador</Eyebrow>
        <h2 className={TITULO_SECCION}>Todo lo que exige la relación laboral, a un clic.</h2>
      </div>
      {/* Bordes compartidos: la grilla pone arriba e izquierda; cada celda, derecha y abajo. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] border-t border-l border-line">
        {FUNCIONES.map(({ icono: Icono, titulo, texto }) => (
          <div key={titulo} className="flex flex-col gap-3 px-[26px] py-7 border-r border-b border-line bg-surface">
            <span className="grid place-items-center size-10 rounded-[10px] bg-brand-soft text-brand-text">
              <Icono className="size-[22px]" strokeWidth={2} aria-hidden />
            </span>
            <h3 className="text-[16px] font-semibold">{titulo}</h3>
            <p className="text-[14px] text-fg-2 text-pretty">{texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CalendarioLey() {
  const hoy = new Date();
  const hitos = hitosLey(hoy);
  const meta = ETAPAS_LEY_40[ETAPAS_LEY_40.length - 1];
  const faltan = meta.desde ? diasHasta(meta.desde, hoy) : 0;

  return (
    <section id="ley" className={cn(CONTENEDOR, SEPARACION)}>
      <div className="rounded-[20px] bg-ink text-white p-[clamp(28px,5vw,56px)] flex flex-col gap-9">
        <div className="flex flex-wrap justify-between items-end gap-6">
          <div className="flex flex-col gap-2.5 max-w-[580px]">
            <span className="text-[13px] font-semibold text-[#86BDF5]">Ley 21.561 · calendario de reducción</span>
            <h2 className={TITULO_SECCION}>La jornada baja por etapas. Tus contratos también.</h2>
            <p className="text-white/72 text-[15px] text-pretty">
              Jornada40 compara cada contrato con el máximo vigente y te avisa antes de cada cambio, con el anexo
              listo para firmar.
            </p>
          </div>
          {/* Cuando la meta de 40 h ya rige no hay nada que contar. */}
          {faltan > 0 && (
            <div className="flex flex-col items-start">
              <span className="text-[clamp(40px,6vw,64px)] font-semibold tracking-[-0.03em] leading-none j40-num">
                {faltan.toLocaleString('es-CL')}
              </span>
              <span className="text-[13px] text-white/66">días para la jornada de 40 horas</span>
            </div>
          )}
        </div>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
          {hitos.map((h) => (
            <li key={h.horas}
              aria-current={h.vigente ? 'step' : undefined}
              className={cn(
                'flex flex-col gap-1 p-[18px] rounded-j40-card border',
                h.vigente ? 'bg-brand-btn border-brand-btn text-white' : 'bg-surface border-line text-fg',
              )}>
              <span className={cn('text-[12px] j40-num', h.vigente ? 'text-white/82' : 'text-fg-3')}>{h.fecha}</span>
              <span className="text-[32px] font-semibold tracking-[-0.02em]">{h.horas}</span>
              <span className={cn('text-[13px]', h.vigente ? 'text-white/82' : 'text-fg-3')}>{h.texto}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Seguridad() {
  return (
    <section id="seguridad"
      className={cn(CONTENEDOR, SEPARACION, 'grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-[clamp(28px,5vw,64px)] items-start')}>
      <div className="flex flex-col gap-3">
        <Eyebrow>Seguridad</Eyebrow>
        <h2 className={TITULO_SECCION}>Datos sensibles, tratados con el cuidado que merecen.</h2>
        <p className="text-fg-2 text-[15px] text-pretty">
          RUT, sueldos, cuentas bancarias y previsión de tu equipo. Cada decisión técnica de Jornada40 parte de esa
          responsabilidad.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
        {SEGURIDAD.map(({ icono: Icono, titulo, texto }) => (
          <div key={titulo} className="flex flex-col gap-2.5 p-5 rounded-j40-modal border border-line bg-surface">
            <Icono className="size-6 text-fg" strokeWidth={2} aria-hidden />
            <h3 className="text-[15px] font-semibold">{titulo}</h3>
            <p className="text-[13.5px] text-fg-2 text-pretty">{texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Precios() {
  const navigate = useNavigate();
  const { planes } = usePlanes();
  const [ciclo, setCiclo] = useState<Ciclo>('mensual');

  return (
    <section id="precios" className={cn(CONTENEDOR, SEPARACION)}>
      <div className="flex flex-col gap-2.5 items-center text-center mb-9">
        <Eyebrow>Precios</Eyebrow>
        <h2 className={TITULO_SECCION}>Paga según el tamaño de tu equipo.</h2>
        <p className="text-fg-2 text-[15px]">Precios en pesos chilenos. Cambia de plan cuando quieras.</p>
        <SelectorCiclo valor={ciclo} onChange={setCiclo} className="mt-1" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-3.5 items-stretch">
        {planes.map((plan) => {
          const destacado = plan.nivel === NIVEL_DESTACADO;
          const gratis = plan.precio === 0;
          return (
            <div key={plan.nivel}
              className={cn(
                'relative flex flex-col gap-[18px] p-6 rounded-2xl border-[1.5px] bg-surface',
                destacado ? 'border-brand' : 'border-line',
              )}>
              {destacado && (
                <span className="absolute -top-3 left-[22px] h-6 px-2.5 rounded-full bg-brand-btn text-white text-[11.5px] font-semibold inline-flex items-center">
                  Más elegido
                </span>
              )}
              <div className="flex flex-col gap-1">
                <h3 className="text-[15px] font-semibold">{plan.nombre}</h3>
                <span className="text-[12.5px] text-fg-3">{textoEmpresas(plan)} · {textoTrabajadores(plan)}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[34px] font-semibold tracking-[-0.03em] j40-num">{formatearPrecio(precioCiclo(plan, ciclo))}</span>
                <span className="text-[13px] text-fg-3">{textoCiclo(plan, ciclo)}</span>
              </div>
              <Button
                variante={destacado ? 'primario' : 'secundario'}
                className="h-11 rounded-[10px] text-[14px]"
                onClick={() => navigate(`/register?plan=${plan.nivel}${ciclo === 'anual' && !gratis ? '&ciclo=anual' : ''}`)}
              >
                {gratis ? 'Comenzar gratis' : `Elegir ${plan.nombre}`}
              </Button>
              <ul className="flex flex-col gap-2.5 pt-4 border-t border-line">
                {(INCLUYE_POR_NIVEL[plan.nivel] ?? []).map((item) => (
                  <li key={item} className="flex gap-2.5 text-[13.5px] text-fg-2">
                    <Check className="size-[18px] shrink-0 mt-px text-ok" strokeWidth={2} aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PreguntasFrecuentes() {
  const [abierta, setAbierta] = useState(0);
  const base = useId();
  const preguntas = preguntasFrecuentes();

  return (
    <section className={cn('max-w-[820px] mx-auto px-[clamp(16px,3vw,32px)]', SEPARACION)}>
      <h2 className="mb-6 text-[clamp(24px,3vw,32px)] font-semibold tracking-[-0.02em] text-center">
        Preguntas frecuentes
      </h2>
      <div className="border-t border-line">
        {preguntas.map(({ pregunta, respuesta }, i) => {
          const abiertaAhora = abierta === i;
          const idRespuesta = `${base}-r${i}`;
          return (
            <div key={pregunta} className="border-b border-line">
              <h3>
                <button
                  type="button"
                  aria-expanded={abiertaAhora}
                  aria-controls={idRespuesta}
                  onClick={() => setAbierta(abiertaAhora ? -1 : i)}
                  className="w-full flex items-center gap-4 px-1 py-5 bg-transparent text-fg text-[15.5px] font-medium text-left cursor-pointer"
                >
                  <span className="flex-1">{pregunta}</span>
                  {abiertaAhora
                    ? <Minus className="size-[22px] text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
                    : <Plus className="size-[22px] text-fg-3 shrink-0" strokeWidth={2} aria-hidden />}
                </button>
              </h3>
              <p id={idRespuesta} hidden={!abiertaAhora} className="pl-1 pr-11 pb-[22px] text-fg-2 text-[14.5px] text-pretty">
                {respuesta}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LlamadoFinal() {
  const navigate = useNavigate();
  return (
    <section className={cn(CONTENEDOR, 'py-[clamp(64px,9vw,112px)]')}>
      <div className="flex flex-wrap items-center justify-between gap-6 p-[clamp(32px,5vw,56px)] rounded-[20px] border border-line bg-surface">
        <div className="flex flex-col gap-2 max-w-[560px]">
          <h2 className="text-[clamp(24px,3vw,34px)] leading-[1.15] font-semibold tracking-[-0.025em] text-balance">
            Ordena la carpeta de tu equipo esta semana.
          </h2>
          <p className="text-fg-2 text-[15px]">
            Crea tu cuenta, registra tu empresa e importa a tus trabajadores en menos de 15 minutos.
          </p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <Button tamano="lg" onClick={() => navigate('/register')}>Comenzar gratis</Button>
          <Button tamano="lg" variante="secundario" onClick={() => navigate('/login')}>Iniciar sesión</Button>
        </div>
      </div>
    </section>
  );
}

function Pie() {
  return (
    <footer className="border-t border-line">
      <div className="max-w-[1200px] mx-auto px-[clamp(16px,3vw,32px)] pt-7 pb-[calc(28px+env(safe-area-inset-bottom))] flex flex-wrap items-center justify-between gap-4 text-[13px] text-fg-3">
        <div className="flex items-center gap-2.5">
          <Logo soloIcono tamano={28} />
          <span>© {new Date().getFullYear()} Jornada40 · Santiago, Chile</span>
        </div>
        <nav aria-label="Legal" className="flex gap-5 flex-wrap">
          <Link to="/terminos" className="text-fg-2">Términos y condiciones</Link>
          <Link to="/terminos" className="text-fg-2">Privacidad</Link>
          <a href="mailto:contacto.jornada40@gmail.com" className="text-fg-2">contacto.jornada40@gmail.com</a>
        </nav>
      </div>
    </footer>
  );
}
