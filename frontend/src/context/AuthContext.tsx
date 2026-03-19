import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react'; 
import client from '../api/client';
import type { User } from '../types';

// 1. Creamos una interfaz estricta para los datos del login
export interface LoginData {
    username?: string;
    email?: string;
    password?: string;
    rut?: string;
    [key: string]: string | undefined; // Permite otros campos si el backend los requiere
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (data: LoginData) => Promise<void>; 
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// 2. SOLUCIÓN AL "FAST REFRESH": Le decimos a ESLint que permita exportar este Hook aquí.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
    return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Función para verificar si hay sesión activa
    const checkAuth = async () => {
        try {
            // Pide al backend "quién soy"
            const res = await client.get('/auth/user/');
            setUser(res.data);
        } catch (error) {
            console.error("No autenticado", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    // Verificar sesión al cargar la página por primera vez
    useEffect(() => {
        checkAuth();
    }, []);

    // <-- Adiós al "any" aquí también
    const login = async (data: LoginData) => {
        // 1. Enviar credenciales (Django responde con Set-Cookie)
        await client.post('/auth/login/', data);
        
        // 2. Inmediatamente pedir los datos del usuario para actualizar la UI
        await checkAuth(); 
    };

    const logout = async () => {
        try {
            await client.post('/auth/logout/');
            setUser(null);
        } catch (error) {
            console.error("Error al salir", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};