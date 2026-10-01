import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Banknote, CalendarDays, Check, CircleAlert, Clock, FilePlus2, FileText, Info, LayoutDashboard, LogOut, Scale, ShieldCheck, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, J40Root, Logo, Modal, ToggleTema } from '../j40';
import { portal, sinSesion } from '../../api/portal';
import { CLAVE_CUENTA, CLAVE_PORTAL, useCuentaTrabajador } from '../../hooks/usePortal';
import type { CuentaTrabajador } from '../../types';
import { cn } from '../../utils/cn';
import { capitalizar, fechaCL, iniciales } from '../../utils/formato';
import { FormularioClave } from './FormularioClave';

// ── Contexto del portal ──────────────────────────────────────────────────────

export type TipoAvisoPortal = 'ok' | 'error' | 'info';
const DURACION_AVISO: Record<TipoAvisoPortal, number> = { ok: 3000, error: 8000, info: 8000 };

interface PortalContexto {
  cuenta: CuentaTrabajador;
  /** Con más de un empleo, cada ítem muestra su empresa. */
  variasEmpresas: boolean;
  avisar: (texto: string, tipo?: TipoAvisoPortal) => void;
  /** Reemplaza los datos de la cuenta (tras vincular un empleo) y recarga lo demás. */
  actualizarCuenta: (cuenta?: CuentaTrabajador) => void;
}

const Contexto = createContext<PortalContexto | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function usePortal(): PortalContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('usePortal debe usarse dentro de PortalShell');
  return ctx;
}

// ── Navegación ───────────────────────────────────────────────────────────────

interface ItemNav { a: string; etiqueta: string; corta: string; Icono: LucideIcon; fin?: boolean; soloLateral?: boolean; karin?: boolean }

const RAIZ = '/trabajador/portal';
const NAV: ItemNav[] = [
  { a: RAIZ, etiqueta: 'Inicio', corta: 'Inicio', Icono: LayoutDashboard, fin: true },
  { a: `${RAIZ}/liquidaciones`, etiqueta: 'Liquidaciones', corta: 'Sueldos', Icono: Banknote },
  { a: `${RAIZ}/documentos`, etiqueta: 'Documentos', corta: 'Docs', Icono: FileText },
  { a: `${RAIZ}/certificados`, etiqueta: 'Certificados', corta: 'Certificados', Icono: BadgeCheck },
  { a: `${RAIZ}/vacaciones`, etiqueta: 'Vacaciones', corta: 'Vacaciones', Icono: CalendarDays },
  { a: `${RAIZ}/solicitudes`, etiqueta: 'Solicitudes', corta: 'Pedir', Icono: FilePlus2 },
  { a: `${RAIZ}/seguridad`, etiqueta: 'Seguridad', corta: 'Seguridad', Icono: ShieldCheck, soloLateral: true },
  // Canal de denuncias y casos en que participa; en móvil se entra desde Inicio.
  { a: `${RAIZ}/ley-karin`, etiqueta: 'Ley Karin', corta: 'Ley Karin', Icono: Scale, soloLateral: true },
];

// ── Shell ────────────────────────────────────────────────────────────────────

/**
 * Marco del portal del trabajador: menú lateral en escritorio y barra
 * inferior en móvil, como el panel del empleador, pero con su propia sesión
 * (GET /trabajador/yo/). Sin sesión (403) vuelve al ingreso.
 */
export default function PortalShell() {
  const consulta = useCuentaTrabajador();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ texto: string; tipo: TipoAvisoPortal; id: number } | null>(null);
  const [invitacionCerrada, setInvitacionCerrada] = useState(false);

  const avisar = useCallback((texto: string, tipo: TipoAvisoPortal = 'ok') =>
    setToast((t) => ({ texto, tipo, id: (t?.id ?? 0) + 1 })), []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), DURACION_AVISO[toast.tipo]);
    return () => window.clearTimeout(t);
  }, [toast]);

  const actualizarCuenta = useCallback((cuenta?: CuentaTrabajador) => {
    if (cuenta) queryClient.setQueryData(CLAVE_CUENTA, cuenta);
    void queryClient.invalidateQueries({ queryKey: [CLAVE_PORTAL] });
  }, [queryClient]);

  const salir = useCallback(async () => {
    try { await portal.salir(); } catch { /* la cookie vence sola; igual se limpia la pantalla */ }
    // Nada del trabajador debe quedar a la vista de quien use el equipo después.
    queryClient.removeQueries({ queryKey: [CLAVE_PORTAL] });
    navigate('/trabajador', { replace: true });
  }, [queryClient, navigate]);

  const cuenta = consulta.data;
  const contexto = useMemo<PortalContexto | null>(() => cuenta ? ({
    cuenta, variasEmpresas: cuenta.empleos.length > 1, avisar, actualizarCuenta,
  }) : null, [cuenta, avisar, actualizarCuenta]);

  if (consulta.isError && sinSesion(consulta.error)) return <Navigate to="/trabajador" replace />;
  if (consulta.isError) {
    return (
      <J40Root className="min-h-dvh grid place-items-center bg-canvas px-4">
        <div className="max-w-sm text-center flex flex-col items-center gap-3">
          <p className="text-[16px] font-semibold">No pudimos conectar con Jornada40</p>
          <p className="text-[14px] text-fg-2">Puede ser tu conexión o una actualización en curso. Espera un momento e intenta de nuevo.</p>
          <Button onClick={() => void consulta.refetch()}>Reintentar</Button>
        </div>
      </J40Root>
    );
  }
  if (!contexto || !cuenta) {
    return (
      <J40Root className="min-h-dvh grid place-items-center bg-canvas">
        <span role="status" aria-label="Cargando" className="size-10 rounded-full border-[3px] border-line border-t-brand animate-spin" />
      </J40Root>
    );
  }

  const omitirInvitacion = () => {
    setInvitacionCerrada(true);
    avisar('Puedes crear tu clave cuando quieras desde Seguridad, en el menú.', 'info');
    // El backend lo recuerda: no vuelve a aparecer en el próximo ingreso.
    portal.omitirInvitacion().then(() => actualizarCuenta(), () => undefined);
  };
  const desvinculados = cuenta.empleos.filter((e) => e.acceso_hasta);

  return (
    <Contexto.Provider value={contexto}>
      <J40Root className="flex leading-[1.45]">
        <Lateral cuenta={cuenta} salir={salir} />
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-2.5 h-[60px] px-[clamp(12px,2.4vw,32px)] bg-canvas-blur backdrop-blur-md border-b border-line">
            <Link to={RAIZ} className="min-[720px]:hidden flex items-center gap-2 min-w-0 no-underline hover:no-underline text-fg" aria-label="Inicio del portal">
              <Logo soloIcono tamano={32} />
              <span className="text-[14px] font-semibold truncate">Portal del trabajador</span>
            </Link>
            <span className="hidden min-[720px]:inline text-[13px] text-fg-3">Portal del trabajador</span>
            <div className="flex-1" />
            <ToggleTema />
            {/* En el teléfono, Seguridad no cabe en la barra inferior: va aquí. */}
            <NavLink to={`${RAIZ}/seguridad`} aria-label="Seguridad" title="Seguridad"
              className={({ isActive }) => cn('min-[720px]:hidden grid place-items-center size-9 rounded-[8px] no-underline hover:no-underline',
                isActive ? 'text-brand-text bg-brand-soft' : 'text-fg-2 hover:bg-sunken')}>
              <ShieldCheck className="size-[19px]" strokeWidth={2} aria-hidden />
            </NavLink>
            <Button variante="fantasma" onClick={salir} aria-label="Salir" className="min-[720px]:hidden px-2.5"
              iconoInicio={<LogOut className="size-[19px]" strokeWidth={2} />}>Salir</Button>
          </header>
          <main className="flex-1 w-full max-w-[1080px] mx-auto p-[clamp(16px,2.4vw,32px)] pb-24 min-[720px]:pb-[clamp(16px,2.4vw,32px)] flex flex-col gap-4">
            {desvinculados.map((e) => (
              <div key={e.id} role="status" className="flex gap-2.5 items-center px-4 py-3 rounded-j40-card bg-warn-soft text-warn text-[13px]">
                <Clock className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
                <span>Tu acceso a <strong className="font-semibold">{e.empresa}</strong> termina el {fechaCL(e.acceso_hasta)}. Descarga antes lo que necesites guardar.</span>
              </div>
            ))}
            <Outlet />
          </main>
        </div>
        <BarraInferior />

        <Modal abierto={cuenta.mostrar_invitacion_clave && !invitacionCerrada} onCerrar={omitirInvitacion}
          titulo="Crea tu clave de acceso"
          subtitulo="Con una clave entras con tu RUT sin esperar un código en el correo.">
          <FormularioClave cuenta={cuenta}
            onGuardada={() => {
              setInvitacionCerrada(true);
              avisar('Tu clave quedó creada. La próxima vez entra con tu RUT y tu clave.');
              actualizarCuenta();
            }}
            pie={(enviando) => (
              <div className="flex justify-end gap-2 flex-wrap pt-1">
                <Button variante="secundario" onClick={omitirInvitacion} disabled={enviando}>Omitir</Button>
                <Button type="submit" cargando={enviando}>{enviando ? 'Creando…' : 'Crear clave'}</Button>
              </div>
            )} />
        </Modal>

        {toast && <Toast toast={toast} cerrar={() => setToast(null)} />}
      </J40Root>
    </Contexto.Provider>
  );
}

function Toast({ toast, cerrar }: { toast: { texto: string; tipo: TipoAvisoPortal; id: number }; cerrar: () => void }) {
  const posicion = 'fixed left-1/2 -translate-x-1/2 bottom-[84px] min-[720px]:bottom-6 z-[90] j40-anim-pop shadow-pop text-white text-[13px] rounded-[10px]';
  if (toast.tipo === 'error') {
    return (
      <div key={toast.id} role="alert" className={cn(posicion, 'flex items-start gap-2.5 w-max max-w-[min(560px,calc(100vw-32px))] pl-4 pr-2 py-2.5 bg-[#3A1418] border border-[#E5484D]/60')}>
        <CircleAlert className="size-[18px] shrink-0 mt-[5px] text-[#FF8A8F]" strokeWidth={2.5} aria-hidden />
        <span className="flex-1 min-w-0 py-1 break-words">{toast.texto}</span>
        <button type="button" onClick={cerrar} aria-label="Cerrar aviso"
          className="grid place-items-center size-7 shrink-0 rounded-[7px] text-white/80 cursor-pointer hover:bg-white/10 hover:text-white">
          <X className="size-4" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    );
  }
  const Icono = toast.tipo === 'info' ? Info : Check;
  return (
    <div key={toast.id} role="status" className={cn(posicion, 'flex items-center gap-2.5 w-max max-w-[min(560px,calc(100vw-32px))] px-4 py-3 bg-[#18212D]')}>
      <Icono className={cn('size-[18px] shrink-0', toast.tipo === 'info' ? 'text-[#86BDF5]' : 'text-[#5BC293]')} strokeWidth={2.5} aria-hidden />
      <span className="min-w-0 break-words">{toast.texto}</span>
    </div>
  );
}

// ── Barra lateral (escritorio) ───────────────────────────────────────────────

function Lateral({ cuenta, salir }: { cuenta: CuentaTrabajador; salir: () => void }) {
  const nombre = capitalizar(cuenta.nombre);
  return (
    <aside className="hidden min-[720px]:flex sticky top-0 h-screen shrink-0 w-[72px] min-[1080px]:w-[240px] flex-col gap-1 px-3 py-3.5 bg-surface border-r border-line z-30">
      <Link to={RAIZ} className="flex items-center gap-2.5 h-10 px-1 mb-3 no-underline hover:no-underline" aria-label="Inicio del portal">
        <Logo soloIcono />
        <span className="hidden min-[1080px]:inline text-[16px] font-semibold tracking-[-0.01em] text-fg">Jornada<span className="text-brand">40</span></span>
      </Link>
      <nav aria-label="Portal" className="flex flex-col gap-1">
        {NAV.filter((n) => !n.karin || cuenta.tiene_karin).map(({ a, etiqueta, Icono, fin }) => (
          <NavLink key={a} to={a} end={fin} title={etiqueta}
            className={({ isActive }) => cn(
              'flex items-center gap-3 w-full h-10 px-[11px] rounded-[8px] text-[13.5px] no-underline hover:no-underline justify-center min-[1080px]:justify-start',
              isActive ? 'bg-brand-soft text-brand-text font-semibold' : 'text-fg-2 hover:bg-sunken hover:text-fg',
            )}>
            <Icono className="size-[21px] shrink-0" strokeWidth={2} aria-hidden />
            <span className="hidden min-[1080px]:inline flex-1">{etiqueta}</span>
          </NavLink>
        ))}
      </nav>
      <div className="flex-1" />
      <div className="flex flex-col min-[1080px]:flex-row items-center gap-2.5 px-1 py-1.5">
        <span className="grid place-items-center size-8 shrink-0 rounded-full bg-sunken text-fg-2 text-[12px] font-semibold" aria-hidden>
          {iniciales(...nombre.split(' ').slice(0, 2)) || '·'}
        </span>
        <span className="hidden min-[1080px]:flex flex-1 min-w-0 flex-col">
          <span className="text-[13px] font-medium truncate">{nombre || 'Trabajador'}</span>
          <span className="text-[11.5px] text-fg-3 truncate j40-mono">{cuenta.rut}</span>
        </span>
        <Button variante="fantasma" soloIcono tamano="sm" aria-label="Salir" title="Salir" onClick={salir}>
          <LogOut className="size-[19px]" strokeWidth={2} />
        </Button>
      </div>
    </aside>
  );
}

// ── Barra inferior (móvil) ───────────────────────────────────────────────────

function BarraInferior() {
  return (
    <nav aria-label="Portal" className="min-[720px]:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 px-0.5 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] bg-surface border-t border-line">
      {NAV.filter((n) => !n.soloLateral).map(({ a, corta, Icono, fin }) => (
        <NavLink key={a} to={a} end={fin}
          className={({ isActive }) => cn(
            'flex flex-col items-center justify-center gap-[3px] min-w-0 h-[52px] text-[10px] font-medium no-underline hover:no-underline',
            isActive ? 'text-brand-text' : 'text-fg-3',
          )}>
          <Icono className="size-[23px]" strokeWidth={2} aria-hidden />
          <span className="max-w-full truncate">{corta}</span>
        </NavLink>
      ))}
    </nav>
  );
}
