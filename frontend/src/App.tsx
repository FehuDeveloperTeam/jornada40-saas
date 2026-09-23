import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import client from './api/client';
import { ToastProvider } from './context/ToastContext';

// Sitio público y acceso: rediseño (paso E). El resto sigue con el diseño
// anterior hasta su propio paso de la migración.
const Landing = lazy(() => import('./pages/sitio/Landing'));
const Login = lazy(() => import('./pages/sitio/Login'));
const Registro = lazy(() => import('./pages/sitio/Registro'));
const Recuperar = lazy(() => import('./pages/sitio/Recuperar'));
const NuevaContrasena = lazy(() => import('./pages/sitio/NuevaContrasena'));
const Bienvenida = lazy(() => import('./pages/sitio/Bienvenida'));

// Panel rediseñado (paso A): shell, inicio, trabajadores y carpeta.
const AppShell = lazy(() => import('./components/app/AppShell'));
const Inicio = lazy(() => import('./pages/app/Inicio'));
const Trabajadores = lazy(() => import('./pages/app/Trabajadores'));
const Carpeta = lazy(() => import('./pages/app/Carpeta'));

const LobbyEmpresas = lazy(() => import('./pages/LobbyEmpresas'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Terminos = lazy(() => import('./pages/Terminos'));
const Suscripcion = lazy(() => import('./pages/Suscripcion'));
const FirmaPublica = lazy(() => import('./pages/FirmaPublica'));
const Reportes = lazy(() => import('./pages/Reportes'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--c-bg-app)' }}>
    <div className="w-12 h-12 rounded-full animate-spin" style={{ border: '3px solid var(--c-border-2)', borderTopColor: '#2563eb' }} />
  </div>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--c-bg-app)' }}>
        <div className="w-12 h-12 rounded-full animate-spin" style={{ border: '3px solid var(--c-border-2)', borderTopColor: '#2563eb' }} />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return <Landing />;
};

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        // Le preguntamos a Django si nuestra cookie actual es válida
        await client.get('/auth/user/');
        // Si responde 200 OK, la sesión es real y segura
        setIsAuthenticated(true);
      } catch {
        // Si responde 401, la cookie expiró o no existe
        setIsAuthenticated(false);
      }
    };

    verifySession();
  }, []);

  // Mientras le preguntamos al backend, mostramos una pantalla de carga
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--c-bg-app)' }}>
        <div className="w-12 h-12 rounded-full animate-spin" style={{ border: '3px solid var(--c-border-2)', borderTopColor: '#2563eb' }} />
      </div>
    );
  }

  // Si el backend dijo que no, lo mandamos al login
  if (isAuthenticated === false) {
    return <Navigate to="/login" replace />;
  }
  
  // Si el backend dijo que sí, lo dejamos entrar a la ruta protegida
  return children;
};

export default function App() {
  return (
    <ToastProvider>
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
        <Route path="/firma/:token" element={<FirmaPublica />} />

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
          <Route path="trabajadores" element={<Trabajadores />} />
          <Route path="trabajadores/:id" element={<Carpeta />} />
        </Route>
        <Route 
          path="/empresas" 
          element={
            <ProtectedRoute>
              <LobbyEmpresas />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/suscripcion"
          element={
            <ProtectedRoute>
              <Suscripcion />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <ProtectedRoute>
              <Reportes />
            </ProtectedRoute>
          }
        />

        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ToastProvider>
  );
}