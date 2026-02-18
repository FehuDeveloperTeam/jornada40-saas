import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard'; // <--- IMPORTAR
import { useAuth } from './context/AuthContext';
import type { ReactNode } from 'react';
import CrearEmpleado from './pages/CrearEmpleado';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const { user, isLoading } = useAuth();
    if (isLoading) return <div>Cargando...</div>;
    if (!user) return <Navigate to="/login" />;
    return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Usamos el componente Dashboard real aquí */}
        <Route path="/dashboard" element={
            <ProtectedRoute>
                <Dashboard />
            </ProtectedRoute>
        } />

        <Route path="/crear-empleado" element={
          <ProtectedRoute>
            <CrearEmpleado />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App;