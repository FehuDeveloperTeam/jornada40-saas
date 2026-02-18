import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { useAuth } from './context/AuthContext';
import type { ReactNode } from 'react';
import CrearEmpleado from './pages/CrearEmpleado';

// Componente para proteger rutas
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    // CORRECCIÓN AQUÍ: Cambiamos 'isLoading' por 'loading'
    const { user, loading } = useAuth();

    // Usamos 'loading' para la condición
    if (loading) return <div>Cargando...</div>;

    // Si no hay usuario, mandar al login
    if (!user) return <Navigate to="/login" />;

    return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Ruta protegida para el Dashboard */}
        <Route path="/dashboard" element={
            <ProtectedRoute>
                <Dashboard />
            </ProtectedRoute>
        } />

        {/* Ruta protegida para Crear Empleado */}
        <Route path="/crear-empleado" element={
          <ProtectedRoute>
            <CrearEmpleado />
          </ProtectedRoute>
        } />

        {/* Cualquier ruta desconocida redirige al Dashboard (o al login si no está autenticado) */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App;