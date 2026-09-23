import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, Banknote, ChartColumn, Building2, Check, ChevronDown, ChevronRight, ChevronsUpDown, FileUp,
  LayoutDashboard, LogOut, Plus, Search, Shapes, Signature, TriangleAlert, UserPlus, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Chip, J40Root, Logo, ToggleTema } from '../j40';
import { useAuth } from '../../context/AuthContext';
import {
  useEmpresaActiva, useIndicadores, useSuscripcion, useTrabajadores,
} from '../../hooks/usePanel';
import type { Suscripcion } from '../../hooks/usePanel';
import type { Empleado, Empresa } from '../../types';
import { cn } from '../../utils/cn';
import { capitalizar, decimalCL, iniciales } from '../../utils/formato';
import { DrawerTrabajador } from './DrawerTrabajador';

// ── Contexto del panel ───────────────────────────────────────────────────────

interface PanelContexto {
  empresa: Empresa;
  nivel: number;
  suscripcion: Suscripcion | undefined;
  trabajadores: Empleado[];
  cargandoTrabajadores: boolean;
  agregarTrabajador: () => void;
  avisar: (texto: string) => void;
  cambiarEmpresa: (id: number) => void;
}

const Contexto = createContext<PanelContexto | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function usePanelContexto(): PanelContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('usePanelContexto debe usarse dentro de AppShell');
  return ctx;
}

// ── Navegación ───────────────────────────────────────────────────────────────

interface ItemNav {
  a: string;
  etiqueta: string;
  corta: string;
  Icono: LucideIcon;
  /** Aún no migrado: abre el panel anterior. */
  clasico?: boolean;
  /** Pantallas hijas que marcan este ítem como activo (p. ej. Plan → Empresa). */
  hijas?: string[];
  fin?: boolean;
}

const NAV: ItemNav[] = [
  { a: '/app', etiqueta: 'Inicio', corta: 'Inicio', Icono: LayoutDashboard, fin: true },
  { a: '/app/trabajadores', etiqueta: 'Trabajadores', corta: 'Personal', Icono: Users },
  { a: '/app/remuneraciones', etiqueta: 'Remuneraciones', corta: 'Sueldos', Icono: Banknote },
  { a: '/app/firmas', etiqueta: 'Firma electrónica', corta: 'Firmas', Icono: Signature },
  { a: '/app/reportes', etiqueta: 'Reportes', corta: 'Reportes', Icono: ChartColumn },
  { a: '/app/empresa', etiqueta: 'Empresa', corta: 'Empresa', Icono: Building2, hijas: ['/app/plan', '/app/empresas'] },
];

const ESTADO_SUSCRIPCION: Record<string, { texto: string; tono: 'ok' | 'marca' | 'aviso' | 'peligro' }> = {
  ACTIVE: { texto: 'Activa', tono: 'ok' },
  TRIAL: { texto: 'Prueba', tono: 'marca' },
  PAST_DUE: { texto: 'Pago pendiente', tono: 'aviso' },
  CANCELED: { texto: 'Cancelada', tono: 'peligro' },
};

const AVISO_SUSCRIPCION: Record<string, { titulo: string; detalle: string; clase: string }> = {
  TRIAL: { titulo: 'Estás en período de prueba', detalle: 'Agrega un medio de pago para no perder el acceso a las funciones de tu plan.', clase: 'bg-brand-soft text-brand-text' },
  PAST_DUE: { titulo: 'Tu pago está pendiente', detalle: 'Regulariza el pago para mantener activas las funciones de tu plan.', clase: 'bg-warn-soft text-warn' },
  CANCELED: { titulo: 'Tu suscripción está cancelada', detalle: 'Reactívala para volver a emitir documentos y liquidaciones.', clase: 'bg-danger-soft text-danger' },
};

// ── Shell ────────────────────────────────────────────────────────────────────

export default function AppShell() {
  const navigate = useNavigate();
  const { empresa, empresas, cambiar, cargando, error } = useEmpresaActiva();
  const { suscripcion, nivel, maxEmpresas } = useSuscripcion();
  const trabajadores = useTrabajadores(empresa?.id);
  const [drawerTrabajador, setDrawerTrabajador] = useState(false);
  // Cambia en cada apertura: el formulario se monta de nuevo y parte vacío.
  const [aperturaDrawer, setAperturaDrawer] = useState(0);
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  // El id distingue dos avisos con el mismo texto (reinicia el temporizador).
  const [toast, setToast] = useState<{ texto: string; id: number } | null>(null);

  const avisar = useCallback((texto: string) => setToast((t) => ({ texto, id: (t?.id ?? 0) + 1 })), []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ⌘K / Ctrl K abre el buscador desde cualquier pantalla del panel.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletaAbierta((v) => !v);
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, []);

  // Sin empresas no hay panel: la cuenta todavía no completa el onboarding.
  useEffect(() => {
    if (!cargando && !error && empresas.length === 0) navigate('/bienvenida', { replace: true });
  }, [cargando, error, empresas.length, navigate]);

  const contexto = useMemo<PanelContexto | null>(() => empresa && ({
    empresa,
    nivel,
    suscripcion,
    trabajadores: trabajadores.data ?? [],
    cargandoTrabajadores: trabajadores.isLoading,
    agregarTrabajador: () => { setAperturaDrawer((n) => n + 1); setDrawerTrabajador(true); },
    avisar,
    cambiarEmpresa: cambiar,
  }), [empresa, nivel, suscripcion, trabajadores.data, trabajadores.isLoading, avisar, cambiar]);

  if (!contexto) {
    return (
      <J40Root className="grid place-items-center">
        <span className="text-fg-3 text-[13px]" role="status">{error ? 'No pudimos cargar tu panel.' : 'Cargando tu panel…'}</span>
      </J40Root>
    );
  }

  const aviso = suscripcion && AVISO_SUSCRIPCION[suscripcion.estado];

  return (
    <Contexto.Provider value={contexto}>
      <J40Root className="flex leading-[1.45]">
        <Sidebar empresa={contexto.empresa} empresas={empresas} cambiarEmpresa={cambiar} maxEmpresas={maxEmpresas}
          suscripcion={suscripcion} totalTrabajadores={contexto.trabajadores.length}
          abrirPaleta={() => setPaletaAbierta(true)} />
        <div className="flex-1 min-w-0 flex flex-col">
          <Encabezado empresa={contexto.empresa} empresas={empresas} cambiarEmpresa={cambiar}
            abrirPaleta={() => setPaletaAbierta(true)} agregarTrabajador={contexto.agregarTrabajador} />
          <main className="flex-1 p-[clamp(16px,2.4vw,32px)] pb-24 min-[720px]:pb-[clamp(16px,2.4vw,32px)]">
            {aviso && (
              <div role="status" className={cn('max-w-[1440px] mx-auto mb-[18px] flex gap-3 items-center flex-wrap px-4 py-3 rounded-j40-card', aviso.clase)}>
                <TriangleAlert className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                <div className="flex-[1_1_260px] flex flex-col">
                  <span className="text-[13.5px] font-semibold">{aviso.titulo}</span>
                  <span className="text-[12.5px]">{aviso.detalle}</span>
                </div>
                <Link to="/app/plan" className="h-[34px] px-3.5 inline-flex items-center rounded-[8px] border border-current text-inherit text-[13px] font-semibold no-underline hover:no-underline">
                  Ver plan
                </Link>
              </div>
            )}
            <Outlet />
          </main>
        </div>
        <BarraInferior />
        <Paleta key={String(paletaAbierta)} abierta={paletaAbierta} onCerrar={() => setPaletaAbierta(false)} trabajadores={contexto.trabajadores}
          agregarTrabajador={contexto.agregarTrabajador} />
        <DrawerTrabajador key={aperturaDrawer} abierto={drawerTrabajador} onCerrar={() => setDrawerTrabajador(false)} />
        {toast && (
          <div key={toast.id} role="status" className="fixed left-1/2 -translate-x-1/2 bottom-[84px] min-[720px]:bottom-6 z-[90] flex items-center gap-2.5 max-w-[calc(100vw-32px)] px-4 py-3 rounded-[10px] bg-[#18212D] text-white text-[13px] shadow-pop j40-anim-pop">
            <Check className="size-[18px] text-[#5BC293]" strokeWidth={2.5} aria-hidden />{toast.texto}
          </div>
        )}
      </J40Root>
    </Contexto.Provider>
  );
}

// ── Barra lateral ────────────────────────────────────────────────────────────

function Sidebar({ empresa, empresas, cambiarEmpresa, maxEmpresas, suscripcion, totalTrabajadores, abrirPaleta }: {
  empresa: Empresa; empresas: Empresa[]; cambiarEmpresa: (id: number) => void; maxEmpresas: number;
  suscripcion: Suscripcion | undefined; totalTrabajadores: number; abrirPaleta: () => void;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const esMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const estado = suscripcion ? ESTADO_SUSCRIPCION[suscripcion.estado] : undefined;
  const limite = suscripcion?.plan.limite_trabajadores ?? 0;
  const uso = limite ? Math.min(100, Math.round(((suscripcion?.trabajadores_actuales ?? 0) / limite) * 100)) : 0;

  const salir = async () => { await logout(); navigate('/login'); };

  return (
    <aside className="hidden min-[720px]:flex sticky top-0 h-screen shrink-0 w-[72px] min-[1080px]:w-[252px] flex-col gap-1 px-3 py-3.5 bg-surface border-r border-line z-30">
      <Link to="/app" className="flex items-center gap-2.5 h-10 px-1 no-underline hover:no-underline" aria-label="Inicio">
        <Logo soloIcono />
        <span className="hidden min-[1080px]:inline text-[16px] font-semibold tracking-[-0.01em] text-fg">Jornada<span className="text-brand">40</span></span>
      </Link>

      <SelectorEmpresa empresa={empresa} empresas={empresas} cambiar={cambiarEmpresa} maxEmpresas={maxEmpresas} variante="lateral" />

      <button type="button" onClick={abrirPaleta} title="Buscar o ejecutar"
        className="mt-2 mb-2.5 flex items-center gap-2.5 w-full h-9 px-2.5 rounded-[8px] border border-line bg-surface text-fg-3 text-[13px] cursor-pointer hover:border-line-strong justify-center min-[1080px]:justify-start">
        <Search className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
        <span className="hidden min-[1080px]:inline flex-1 min-w-0 text-left truncate">Buscar…</span>
        <kbd className="hidden min-[1080px]:inline shrink-0 whitespace-nowrap text-[11px] px-1.5 py-0.5 border border-line rounded-[5px] j40-mono">{esMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <nav aria-label="Principal" className="flex flex-col gap-1">
        {NAV.map((item) => (
          <ItemLateral key={item.etiqueta} item={item} badge={item.a === '/app/trabajadores' ? totalTrabajadores : undefined} />
        ))}
      </nav>

      <div className="flex-1" />

      <Link to="/app/plan" title="Plan y facturación"
        className="hidden min-[1080px]:flex flex-col gap-2 p-3 mb-2 rounded-[10px] border border-line bg-surface text-fg no-underline hover:no-underline hover:border-line-strong">
        <span className="flex items-center justify-between w-full">
          <span className="text-[12.5px] font-semibold">Plan {suscripcion?.plan.nombre ?? '…'}</span>
          {estado && <Chip tono={estado.tono}>{estado.texto}</Chip>}
        </span>
        <span className="h-[5px] rounded-full bg-sunken overflow-hidden" aria-hidden>
          {/* Ancho calculado: no hay clase de Tailwind para un porcentaje variable. */}
          <span className="block h-full bg-brand" style={{ width: `${uso}%` }} />
        </span>
        <span className="text-[11.5px] text-fg-3">
          {suscripcion?.trabajadores_actuales ?? 0} de {limite} trabajadores · {empresas.length} de {maxEmpresas} {maxEmpresas === 1 ? 'empresa' : 'empresas'}
        </span>
      </Link>

      <div className="flex items-center gap-2.5 px-1 py-1.5">
        <Link to="/app/cuenta" title="Mi cuenta" className="flex flex-1 min-w-0 items-center gap-2.5 rounded-[8px] no-underline hover:no-underline text-fg hover:bg-sunken">
          <span className="grid place-items-center size-8 shrink-0 rounded-full bg-sunken text-fg-2 text-[12px] font-semibold">
            {iniciales(user?.first_name, user?.last_name) || '·'}
          </span>
          <span className="hidden min-[1080px]:flex flex-1 min-w-0 flex-col">
            <span className="text-[13px] font-medium truncate">{capitalizar(user?.first_name) || 'Mi cuenta'}</span>
            <span className="text-[11.5px] text-fg-3 truncate j40-mono">{user?.username}</span>
          </span>
        </Link>
        <Button variante="fantasma" soloIcono tamano="sm" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={salir}
          className="hidden min-[1080px]:grid">
          <LogOut className="size-[19px]" strokeWidth={2} />
        </Button>
      </div>
    </aside>
  );
}

function ItemLateral({ item, badge }: { item: ItemNav; badge?: number }) {
  const { Icono } = item;
  const { pathname } = useLocation();
  const hija = (item.hijas ?? []).some((h) => pathname.startsWith(h));
  const base = 'relative flex items-center gap-3 w-full h-10 px-[11px] rounded-[8px] text-[13.5px] no-underline hover:no-underline justify-center min-[1080px]:justify-start';
  const contenido = (
    <>
      <Icono className="size-[21px] shrink-0" strokeWidth={2} aria-hidden />
      <span className="hidden min-[1080px]:inline flex-1">{item.etiqueta}</span>
      {badge !== undefined && <span className="hidden min-[1080px]:inline text-[11.5px] font-medium text-fg-3 j40-num">{badge}</span>}
      {item.clasico && <ArrowUpRight className="hidden min-[1080px]:block size-3.5 text-fg-3" strokeWidth={2} aria-label="Se abre en el panel anterior" />}
    </>
  );
  if (item.clasico) {
    return (
      <Link to={item.a} title={`${item.etiqueta} · se abre en el panel anterior`} className={cn(base, 'text-fg-2 hover:bg-sunken hover:text-fg')}>
        {contenido}
      </Link>
    );
  }
  return (
    <NavLink to={item.a} end={item.fin} title={item.etiqueta}
      className={({ isActive }) => cn(base, isActive || hija ? 'bg-brand-soft text-brand-text font-semibold' : 'text-fg-2 hover:bg-sunken hover:text-fg')}>
      {contenido}
    </NavLink>
  );
}

// ── Selector de empresa ──────────────────────────────────────────────────────

function SelectorEmpresa({ empresa, empresas, cambiar, maxEmpresas, variante }: {
  empresa: Empresa; empresas: Empresa[]; cambiar: (id: number) => void; maxEmpresas: number;
  variante: 'lateral' | 'movil';
}) {
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  const avatar = (e: Empresa, clase = 'size-8 rounded-[7px] text-[12px]') => (
    <span className={cn('grid place-items-center shrink-0 bg-navy text-white font-semibold', clase)}>
      {iniciales(...(e.alias || e.nombre_legal).split(/\s+/).slice(0, 2))}
    </span>
  );

  return (
    <div className="relative">
      {variante === 'lateral' ? (
        <button type="button" onClick={() => setAbierto((v) => !v)} title="Cambiar empresa" aria-expanded={abierto}
          className="mt-2.5 flex items-center gap-2.5 w-full p-2 rounded-[10px] border border-line bg-surface-2 text-fg text-left cursor-pointer hover:border-line-strong justify-center min-[1080px]:justify-start">
          {avatar(empresa)}
          <span className="hidden min-[1080px]:flex flex-1 min-w-0 flex-col">
            <span className="text-[13px] font-semibold truncate">{capitalizar(empresa.alias || empresa.nombre_legal)}</span>
            <span className="text-[11.5px] text-fg-3 j40-mono">{empresa.rut}</span>
          </span>
          <ChevronsUpDown className="hidden min-[1080px]:block size-[18px] text-fg-3" strokeWidth={2} aria-hidden />
        </button>
      ) : (
        <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}
          className="flex items-center gap-1 min-w-0 h-9 px-2 rounded-[8px] bg-transparent text-fg text-[14px] font-semibold cursor-pointer">
          <span className="truncate max-w-[40vw]">{capitalizar(empresa.alias || empresa.nombre_legal)}</span>
          <ChevronDown className="size-[18px] text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
        </button>
      )}
      {abierto && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setAbierto(false)} aria-hidden />
          <div role="menu" className={cn(
            'absolute z-[61] w-[min(300px,calc(100vw-24px))] p-1.5 rounded-j40-card border border-line bg-surface shadow-pop j40-anim-pop',
            variante === 'lateral' ? 'top-full mt-1 left-0' : 'top-full mt-1 left-0',
          )}>
            <div className="text-[11.5px] text-fg-3 px-2.5 pt-2 pb-1.5">Tus empresas · {empresas.length} de {maxEmpresas} en uso</div>
            {empresas.map((e) => (
              <button key={e.id} type="button" role="menuitemradio" aria-checked={e.id === empresa.id}
                onClick={() => { cambiar(e.id); setAbierto(false); }}
                className={cn('flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[8px] text-left cursor-pointer',
                  e.id === empresa.id ? 'bg-brand-soft' : 'hover:bg-sunken')}>
                {avatar(e, 'size-[30px] rounded-[7px] text-[11.5px]')}
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[13px] font-semibold truncate">{capitalizar(e.nombre_legal)}</span>
                  <span className="text-[11.5px] text-fg-3 j40-mono">{e.rut}</span>
                </span>
                {e.id === empresa.id && <Check className="size-[18px] text-brand-text" strokeWidth={2} aria-hidden />}
              </button>
            ))}
            <button type="button" role="menuitem" onClick={() => navigate('/app/empresas')}
              className="flex items-center gap-2.5 w-full mt-1 p-2.5 rounded-[8px] text-fg-2 text-[13px] text-left cursor-pointer hover:bg-sunken">
              <Plus className="size-[19px]" strokeWidth={2} aria-hidden />Agregar o administrar empresas
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Encabezado ───────────────────────────────────────────────────────────────

function Encabezado({ empresa, empresas, cambiarEmpresa, abrirPaleta, agregarTrabajador }: {
  empresa: Empresa; empresas: Empresa[]; cambiarEmpresa: (id: number) => void;
  abrirPaleta: () => void; agregarTrabajador: () => void;
}) {
  const indicadores = useIndicadores();
  const migas = useMigas(empresa);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2.5 h-[60px] px-[clamp(12px,2.4vw,32px)] bg-canvas-blur backdrop-blur-md border-b border-line">
      <span className="min-[720px]:hidden flex items-center gap-1 min-w-0">
        <Logo soloIcono tamano={34} />
        <SelectorEmpresa empresa={empresa} empresas={empresas} cambiar={cambiarEmpresa} maxEmpresas={empresas.length} variante="movil" />
      </span>
      <nav aria-label="Ruta" className="hidden min-[720px]:flex items-center gap-1.5 min-w-0 text-[13px]">
        {migas.map((m, i) => (
          <span key={m.texto} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight className="size-4 text-fg-3 shrink-0" strokeWidth={2} aria-hidden />}
            {m.a ? (
              <Link to={m.a} className="px-0.5 py-1 text-fg-3 whitespace-nowrap no-underline hover:no-underline hover:text-fg">{m.texto}</Link>
            ) : (
              <span aria-current="page" className="px-0.5 py-1 font-semibold text-fg truncate">{m.texto}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex-1" />
      {indicadores.data && (
        <div title={`Indicadores del día${indicadores.data.respaldo ? ' · valores de respaldo: mindicador.cl no responde' : ''}`}
          className="hidden min-[900px]:flex items-center gap-3.5 h-[34px] px-3 rounded-[8px] border border-line bg-surface text-[12px] text-fg-3 whitespace-nowrap">
          <span>UF <strong className="text-fg font-semibold j40-num">${decimalCL(indicadores.data.uf)}</strong></span>
          <span className="w-px h-3.5 bg-line" aria-hidden />
          <span>UTM <strong className="text-fg font-semibold j40-num">${Math.round(indicadores.data.utm).toLocaleString('es-CL')}</strong></span>
        </div>
      )}
      <Button variante="fantasma" soloIcono aria-label="Buscar" onClick={abrirPaleta} className="min-[720px]:hidden size-10">
        <Search className="size-[22px]" strokeWidth={2} />
      </Button>
      <ToggleTema />
      <Button onClick={agregarTrabajador} className="hidden min-[720px]:inline-flex h-[38px] pl-2.5 pr-3.5"
        iconoInicio={<Plus className="size-5" strokeWidth={2} />}>
        Agregar trabajador
      </Button>
    </header>
  );
}

function useMigas(empresa: Empresa): { texto: string; a?: string }[] {
  const { pathname } = useLocation();
  const carpeta = useMatch('/app/trabajadores/:id');
  const finiquito = useMatch('/app/trabajadores/:id/finiquito');
  const editorContrato = useMatch('/app/trabajadores/:id/contrato');
  const ctx = useContext(Contexto);
  const nombreEmpresa = capitalizar(empresa.alias || empresa.nombre_legal);
  if (pathname.startsWith('/app/trabajadores/importar')) {
    return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Trabajadores', a: '/app/trabajadores' }, { texto: 'Importar' }];
  }
  const subpagina = finiquito ?? editorContrato;
  if (subpagina) {
    const t = ctx?.trabajadores.find((e) => String(e.id) === subpagina.params.id);
    return [
      { texto: nombreEmpresa, a: '/app' },
      { texto: t ? capitalizar(`${t.nombres.split(' ')[0]} ${t.apellido_paterno}`) : 'Trabajador', a: `/app/trabajadores/${subpagina.params.id}` },
      { texto: finiquito ? 'Finiquito' : 'Contrato' },
    ];
  }
  if (carpeta) {
    const t = ctx?.trabajadores.find((e) => String(e.id) === carpeta.params.id);
    return [
      { texto: nombreEmpresa, a: '/app' },
      { texto: 'Trabajadores', a: '/app/trabajadores' },
      { texto: t ? capitalizar(`${t.nombres.split(' ')[0]} ${t.apellido_paterno}`) : 'Trabajador' },
    ];
  }
  if (pathname.startsWith('/app/trabajadores')) return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Trabajadores' }];
  if (pathname.startsWith('/app/remuneraciones/conceptos')) {
    return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Remuneraciones', a: '/app/remuneraciones' }, { texto: 'Conceptos' }];
  }
  if (pathname.startsWith('/app/trabajadores/importar')) return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Trabajadores', a: '/app/trabajadores' }, { texto: 'Importar' }];
  if (pathname.startsWith('/app/reportes')) return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Reportes' }];
  if (pathname.startsWith('/app/empresas')) return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Empresa', a: '/app/empresa' }, { texto: 'Todas las empresas' }];
  if (pathname.startsWith('/app/empresa')) return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Empresa' }];
  if (pathname.startsWith('/app/plan')) return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Empresa', a: '/app/empresa' }, { texto: 'Plan y facturación' }];
  if (pathname.startsWith('/app/cuenta')) return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Mi cuenta' }];
  if (pathname.startsWith('/app/firmas')) return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Firma electrónica' }];
  if (pathname.startsWith('/app/remuneraciones')) return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Remuneraciones' }];
  return [{ texto: nombreEmpresa, a: '/app' }, { texto: 'Inicio' }];
}

// ── Barra inferior (móvil) ───────────────────────────────────────────────────

function BarraInferior() {
  return (
    <nav aria-label="Principal" className="min-[720px]:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] bg-surface border-t border-line">
      {NAV.filter((n) => n.a !== '/app/reportes').map(({ a, corta, Icono, fin, clasico, etiqueta }) => (
        <NavLink key={etiqueta} to={a} end={fin}
          className={({ isActive }) => cn(
            'flex flex-col items-center justify-center gap-[3px] h-[52px] text-[10.5px] font-medium no-underline hover:no-underline',
            isActive && !clasico ? 'text-brand-text' : 'text-fg-3',
          )}>
          <Icono className="size-[23px]" strokeWidth={2} aria-hidden />{corta}
        </NavLink>
      ))}
    </nav>
  );
}

// ── Buscador ⌘K ──────────────────────────────────────────────────────────────

interface Resultado { clave: string; Icono: LucideIcon; texto: string; detalle?: string; ejecutar: () => void }

function Paleta({ abierta, onCerrar, trabajadores, agregarTrabajador }: {
  abierta: boolean; onCerrar: () => void; trabajadores: Empleado[]; agregarTrabajador: () => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  const ir = (fn: () => void) => () => { onCerrar(); fn(); };
  const texto = q.trim().toLowerCase();
  const limpio = texto.replace(/[^0-9k]/g, '');

  const personas: Resultado[] = trabajadores
    .filter((t) => !texto
      || `${t.nombres} ${t.apellido_paterno} ${t.apellido_materno ?? ''} ${t.cargo}`.toLowerCase().includes(texto)
      || (limpio.length >= 3 && t.rut.replace(/[^0-9kK]/g, '').toLowerCase().includes(limpio)))
    .slice(0, 6)
    .map((t) => ({
      clave: `t${t.id}`, Icono: Users,
      texto: capitalizar(`${t.nombres} ${t.apellido_paterno}`), detalle: `${t.rut} · ${capitalizar(t.cargo)}`,
      ejecutar: ir(() => navigate(`/app/trabajadores/${t.id}`)),
    }));

  const acciones: Resultado[] = ([
    { clave: 'agregar', Icono: UserPlus, texto: 'Agregar trabajador', ejecutar: ir(agregarTrabajador) },
    { clave: 'trab', Icono: Users, texto: 'Ver trabajadores', ejecutar: ir(() => navigate('/app/trabajadores')) },
    { clave: 'inicio', Icono: LayoutDashboard, texto: 'Ir a Inicio', ejecutar: ir(() => navigate('/app')) },
    { clave: 'rem', Icono: Banknote, texto: 'Remuneraciones del mes', ejecutar: ir(() => navigate('/app/remuneraciones')) },
    { clave: 'liq', Icono: Banknote, texto: 'Nueva liquidación', ejecutar: ir(() => navigate('/app/remuneraciones')) },
    { clave: 'firmas', Icono: Signature, texto: 'Firma electrónica', ejecutar: ir(() => navigate('/app/firmas')) },
    { clave: 'conc', Icono: Shapes, texto: 'Catálogo de conceptos', ejecutar: ir(() => navigate('/app/remuneraciones/conceptos')) },
    { clave: 'imp', Icono: FileUp, texto: 'Importar trabajadores desde Excel', ejecutar: ir(() => navigate('/app/trabajadores/importar')) },
    { clave: 'plan', Icono: Building2, texto: 'Plan y facturación', ejecutar: ir(() => navigate('/app/plan')) },
    { clave: 'empresa', Icono: Building2, texto: 'Datos de la empresa', ejecutar: ir(() => navigate('/app/empresa')) },
    { clave: 'empresas', Icono: Building2, texto: 'Agregar o administrar empresas', ejecutar: ir(() => navigate('/app/empresas')) },
    { clave: 'reportes', Icono: ChartColumn, texto: 'Reportes multiempresa', ejecutar: ir(() => navigate('/app/reportes')) },
    { clave: 'cuenta', Icono: Users, texto: 'Mi cuenta', ejecutar: ir(() => navigate('/app/cuenta')) },
  ] as Resultado[]).filter((a) => !texto || a.texto.toLowerCase().includes(texto));

  const todos = [...personas, ...acciones];

  const grupo = (titulo: string, items: Resultado[]) => items.length > 0 && (
    <div role="group" aria-label={titulo}>
      <div className="text-[11.5px] text-fg-3 px-2.5 pt-2.5 pb-1">{titulo}</div>
      {items.map(({ clave, Icono, texto: t, detalle, ejecutar }) => (
        <button key={clave} type="button" onClick={ejecutar}
          className="flex items-center gap-3 w-full px-2.5 py-2.5 rounded-[8px] text-left text-fg cursor-pointer hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none">
          <Icono className="size-[19px] text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
          <span className="flex-1 min-w-0 truncate text-[13.5px]">{t}</span>
          {detalle && <span className="text-[12px] text-fg-3 truncate">{detalle}</span>}
        </button>
      ))}
    </div>
  );

  const tema = document.querySelector('[data-j40]')?.getAttribute('data-j40') ?? 'claro';
  return (
    <div data-j40={tema} className="font-sans text-fg">
      <div className="fixed inset-0 z-[80] bg-overlay" onClick={onCerrar} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Buscar o ejecutar"
        className="fixed top-[min(14vh,120px)] left-1/2 -translate-x-1/2 z-[81] w-[min(620px,calc(100vw-24px))] rounded-j40-modal border border-line bg-surface shadow-pop overflow-hidden j40-anim-pop">
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-line">
          <Search className="size-[21px] text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && todos[0]) todos[0].ejecutar(); }}
            placeholder="Buscar trabajador por nombre o RUT, o escribe una acción" aria-label="Buscar"
            className="flex-1 min-w-0 border-0 outline-none bg-transparent text-fg text-[15px] placeholder:text-fg-3" />
          <kbd className="text-[11px] px-1.5 py-0.5 border border-line rounded-[5px] text-fg-3">Esc</kbd>
        </div>
        <div className="max-h-[min(60vh,440px)] overflow-y-auto p-1.5">
          {grupo('Trabajadores', personas)}
          {grupo('Acciones', acciones)}
          {todos.length === 0 && <div className="p-7 text-center text-[13px] text-fg-3">Sin resultados</div>}
        </div>
      </div>
    </div>
  );
}

