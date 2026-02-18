import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react'; // <--- CORRECCIÓN AQUÍ (type import)
import client from '../api/client';
import type { User } from '../types';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (data: any) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    // Verificar sesión al cargar la página por primera vez
    useEffect(() => {
        checkAuth();
    }, []);

    const login = async (data: any) => {
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