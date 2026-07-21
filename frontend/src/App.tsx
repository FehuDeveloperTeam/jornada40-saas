import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import client from './api/client';
import { ToastProvider } from './context/ToastContext';
import Login from './pages/Login';
import LobbyEmpresas from './pages/LobbyEmpresas';
import Dashboard from './pages/Dashboard';
import Register from './pages/Register';
import Landing from './pages/Landing';
import Terminos from './pages/Terminos';
import Suscripcion from './pages/Suscripcion';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import FirmaPublica from './pages/FirmaPublica';
import Reportes from './pages/Reportes';

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
    return <Navigate to="/empresas" replace />;
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
      <Routes>
        {/* Ruta Pública */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/terminos" element={<Terminos />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
        <Route path="/firma/:token" element={<FirmaPublica />} />

        {/* Rutas Privadas y Seguras */}
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
    </BrowserRouter>
    </ToastProvider>
  );
}