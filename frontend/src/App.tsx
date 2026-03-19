import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import type { ReactNode } from 'react';
import Login from './pages/Login'; 
import LobbyEmpresas from './pages/LobbyEmpresas'; 
import Dashboard from './pages/Dashboard'; 
import Register from './pages/Register';
import Landing from './pages/Landing';
import Terminos from './pages/Terminos';
import Suscripcion from './pages/Suscripcion';

// 🛡️ EL GUARDIÁN REAL (Consulta al Backend)
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        // Le preguntamos a Django si nuestra cookie actual es válida
        await axios.get('https://jornada40-saas-production.up.railway.app/api/auth/user/', {
          withCredentials: true
        });
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
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
    <BrowserRouter>
      <Routes>
        {/* Ruta Pública */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/terminos" element={<Terminos />} />
        

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

        <Route path="/" element={<Navigate to="/empresas" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}