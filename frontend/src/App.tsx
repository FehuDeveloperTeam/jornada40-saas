import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useState, useEffect, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import client, { rutaIngreso } from './api/client';
import { Button, J40Root } from './components/j40';
import { ConPermiso } from './components/app/ConPermiso';
import { MODULOS_DOCUMENTOS } from './hooks/usePermisos';

// Sitio público y acceso: rediseño (paso E). El resto sigue con el diseño
// anterior hasta su propio paso de la migración.
const Landing = lazy(() => import('./pages/sitio/Landing'));
const Login = lazy(() => import('./pages/sitio/Login'));
const Registro = lazy(() => import('./pages/sitio/Registro'));
const Recuperar = lazy(() => import('./pages/sitio/Recuperar'));
const NuevaContrasena = lazy(() => import('./pages/sitio/NuevaContrasena'));
const IngresoEquipo = lazy(() => import('./pages/sitio/IngresoEquipo'));
const ClaveEquipo = lazy(() => import('./pages/sitio/ClaveEquipo'));
const IngresoKarin = lazy(() => import('./pages/sitio/IngresoKarin'));
const KarinShell = lazy(() => import('./components/karin/KarinShell'));
const PanelKarin = lazy(() => import('./pages/karin/Panel'));
const NuevaDenuncia = lazy(() => import('./pages/karin/NuevaDenuncia'));
const ExpedienteKarin = lazy(() => import('./pages/karin/Expediente'));
const Bienvenida = lazy(() => import('./pages/sitio/Bienvenida'));

// Panel rediseñado (paso A): shell, inicio, trabajadores y carpeta.
const AppShell = lazy(() => import('./components/app/AppShell'));
const Inicio = lazy(() => import('./pages/app/Inicio'));
const Trabajadores = lazy(() => import('./pages/app/Trabajadores'));
const Carpeta = lazy(() => import('./pages/app/Carpeta'));
const RemuneracionesPanel = lazy(() => import('./pages/app/Remuneraciones'));
const Conceptos = lazy(() => import('./pages/app/Conceptos'));
const FirmasPanel = lazy(() => import('./pages/app/Firmas'));
const SolicitudesPanel = lazy(() => import('./pages/app/Solicitudes'));
const FiniquitoPanel = lazy(() => import('./pages/app/Finiquito'));
const ImportarPanel = lazy(() => import('./pages/app/Importar'));
const ContratoPanel = lazy(() => import('./pages/app/ContratoEditor'));
const EmpresaPanel = lazy(() => import('./pages/app/Empresa'));
const PlanPanel = lazy(() => import('./pages/app/Plan'));
const CuentaPanel = lazy(() => import('./pages/app/Cuenta'));

const ReportesPanel = lazy(() => import('./pages/app/Reportes'));
const DireccionTrabajoPanel = lazy(() => import('./pages/app/DireccionTrabajo'));
const ReglamentoPanel = lazy(() => import('./pages/app/Reglamento'));
const EmpresasPanel = lazy(() => import('./pages/app/Empresas'));
const EquipoPanel = lazy(() => import('./pages/app/Equipo'));
const Terminos = lazy(() => import('./pages/sitio/Terminos'));
const FirmaPublica = lazy(() => import('./pages/sitio/Firma'));

// Portal del trabajador: sesión propia (cookie del portal), independiente del panel.
const IngresoTrabajador = lazy(() => import('./pages/sitio/Trabajador'));
const PortalShell = lazy(() => import('./components/trabajador/PortalShell'));
const PortalInicio = lazy(() => import('./pages/trabajador/Inicio'));
const PortalLiquidaciones = lazy(() => import('./pages/trabajador/Liquidaciones'));
const PortalDocumentos = lazy(() => import('./pages/trabajador/Documentos'));
const PortalVacaciones = lazy(() => import('./pages/trabajador/Vacaciones'));
const PortalSeguridad = lazy(() => import('./pages/trabajador/Seguridad'));
const PortalSolicitudes = lazy(() => import('./pages/trabajador/Solicitudes'));
const PortalCertificados = lazy(() => import('./pages/trabajador/Certificados'));
const VerificarCertificado = lazy(() => import('./pages/sitio/Verificar'));
const InspeccionDT = lazy(() => import('./pages/sitio/Inspeccion'));

// Direcciones del panel anterior: se mantienen para enlaces guardados y correos.
const DESDE_CLASICO: Record<string, string> = {
  perfil: 'personal', contratos: 'contrato', liquidaciones: 'remuneraciones', historial: 'remuneraciones',
  vacaciones: 'vacaciones', legal: 'documentos', finiquito: 'documentos',
};
function RedireccionDashboard() {
  const [params] = useSearchParams();
  const empleado = Number(params.get('empleado'));
  const tab = DESDE_CLASICO[params.get('tab') ?? ''];
  return <Navigate to={empleado ? `/app/trabajadores/${empleado}${tab ? `?tab=${tab}` : ''}` : '/app'} replace />;
}

const PageLoader = () => (
  <J40Root className="min-h-dvh grid place-items-center bg-canvas">
    <span role="status" aria-label="Cargando" className="size-10 rounded-full border-[3px] border-line border-t-brand animate-spin" />
  </J40Root>
);

const RootRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        await client.get('/auth/user/');
        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
      }
    };
    verifySession();
  }, []);

  if (isAuthenticated === null) {
    return (
      <PageLoader />
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return <Landing />;
};

type EstadoSesion = 'verificando' | 'ok' | 'sin-sesion' | 'error';

/**
 * Solo un 401/403 significa que no hay sesión (el cliente ya intentó
 * renovarla). Un 429, un 5xx o la red caída durante un despliegue no deben
 * sacar al usuario: se muestra un aviso con reintentar.
 */
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const [estado, setEstado] = useState<EstadoSesion>('verificando');
  const [intento, setIntento] = useState(0);
  const { pathname, search } = useLocation();

  useEffect(() => {
    client.get('/auth/user/')
      .then(() => setEstado('ok'))
      .catch((err) => setEstado(isAxiosError(err) && [401, 403].includes(err.response?.status ?? 0) ? 'sin-sesion' : 'error'));
  }, [intento]);

  if (estado === 'verificando') return <PageLoader />;
  if (estado === 'sin-sesion') return <Navigate to={rutaIngreso(pathname + search)} replace />;
  if (estado === 'error') {
    return (
      <J40Root className="min-h-dvh grid place-items-center bg-canvas px-4">
        <div className="max-w-sm text-center flex flex-col items-center gap-3">
          <p className="text-[16px] font-semibold">No pudimos conectar con Jornada40</p>
          <p className="text-[14px] text-fg-2">Puede ser tu conexión o una actualización en curso. Espera un momento e intenta de nuevo.</p>
          <Button onClick={() => { setEstado('verificando'); setIntento((n) => n + 1); }}>Reintentar</Button>
        </div>
      </J40Root>
    );
  }
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Ruta Pública */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Registro />} />
        <Route path="/terminos" element={<Terminos />} />
        <Route path="/forgot-password" element={<Recuperar />} />
        {/* La ruta la fija el backend en el correo (PASSWORD_RESET_CONFIRM_URL). */}
        <Route path="/reset-password/:uid/:token" element={<NuevaContrasena />} />
        <Route path="/equipo" element={<IngresoEquipo />} />
        <Route path="/equipo/clave/:uid/:token" element={<ClaveEquipo />} />
        {/* Acceso Ley Karin: puerta y sesión propias, fuera del panel. */}
        <Route path="/karin" element={<IngresoKarin />} />
        <Route path="/karin/clave/:uid/:token" element={<ClaveEquipo acceso="karin" />} />
        <Route element={<KarinShell />}>
          <Route path="/karin/panel" element={<PanelKarin />} />
          <Route path="/karin/denuncias/nueva" element={<NuevaDenuncia />} />
          <Route path="/karin/denuncias/:id" element={<ExpedienteKarin />} />
        </Route>
        <Route path="/firma/:token" element={<FirmaPublica />} />
        <Route path="/inspeccion" element={<InspeccionDT />} />
        <Route path="/verificar" element={<VerificarCertificado />} />
        <Route path="/verificar/:codigo" element={<VerificarCertificado />} />
        <Route path="/trabajador" element={<IngresoTrabajador />} />
        {/* PortalShell verifica la sesión del portal (GET /trabajador/yo/) y sin ella vuelve a /trabajador. */}
        <Route path="/trabajador/portal" element={<PortalShell />}>
          <Route index element={<PortalInicio />} />
          <Route path="liquidaciones" element={<PortalLiquidaciones />} />
          <Route path="documentos" element={<PortalDocumentos />} />
          <Route path="vacaciones" element={<PortalVacaciones />} />
          <Route path="certificados" element={<PortalCertificados />} />
          <Route path="solicitudes" element={<PortalSolicitudes />} />
          <Route path="seguridad" element={<PortalSeguridad />} />
          <Route path="*" element={<Navigate to="/trabajador/portal" replace />} />
        </Route>

        {/* Rutas Privadas y Seguras */}
        <Route
          path="/bienvenida"
          element={
            <ProtectedRoute>
              <Bienvenida />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Inicio />} />
          <Route path="trabajadores" element={<ConPermiso modulos={['TRABAJADORES']}><Trabajadores /></ConPermiso>} />
          <Route path="trabajadores/:id" element={<ConPermiso modulos={['TRABAJADORES']} avisoLectura={false}><Carpeta /></ConPermiso>} />
          <Route path="trabajadores/importar" element={<ConPermiso modulos={['TRABAJADORES']} gestionar><ImportarPanel /></ConPermiso>} />
          <Route path="trabajadores/:id/finiquito" element={<ConPermiso modulos={['TERMINO']}><FiniquitoPanel /></ConPermiso>} />
          <Route path="trabajadores/:id/contrato" element={<ConPermiso modulos={['CONTRATOS']}><ContratoPanel /></ConPermiso>} />
          <Route path="empresa" element={<ConPermiso titular><EmpresaPanel /></ConPermiso>} />
          <Route path="plan" element={<ConPermiso titular><PlanPanel /></ConPermiso>} />
          <Route path="cuenta" element={<CuentaPanel />} />
          <Route path="remuneraciones" element={<ConPermiso modulos={['REMUNERACIONES']}><RemuneracionesPanel /></ConPermiso>} />
          <Route path="remuneraciones/conceptos" element={<ConPermiso modulos={['REMUNERACIONES']}><Conceptos /></ConPermiso>} />
          <Route path="firmas" element={<ConPermiso modulos={MODULOS_DOCUMENTOS} avisoLectura={false}><FirmasPanel /></ConPermiso>} />
          <Route path="solicitudes" element={<ConPermiso modulos={['SOLICITUDES']}><SolicitudesPanel /></ConPermiso>} />
          <Route path="reportes" element={<ConPermiso modulos={['REPORTES']}><ReportesPanel /></ConPermiso>} />
          <Route path="dt" element={<ConPermiso modulos={['DIRECCION_TRABAJO']}><DireccionTrabajoPanel /></ConPermiso>} />
          <Route path="reglamento" element={<ConPermiso modulos={['SEGURIDAD']}><ReglamentoPanel /></ConPermiso>} />
          <Route path="empresas" element={<ConPermiso titular><EmpresasPanel /></ConPermiso>} />
          <Route path="equipo" element={<ConPermiso titular><EquipoPanel /></ConPermiso>} />
        </Route>
        <Route path="/dashboard" element={<RedireccionDashboard />} />
        <Route path="/empresas" element={<Navigate to="/app/empresas" replace />} />
        <Route path="/suscripcion" element={<Navigate to="/app/plan" replace />} />
        <Route path="/reportes" element={<Navigate to="/app/reportes" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}