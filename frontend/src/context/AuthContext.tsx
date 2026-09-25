import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react'; 
import { useQueryClient } from '@tanstack/react-query';
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
    const queryClient = useQueryClient();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Verificar sesión al cargar la página por primera vez. La página pública
    // de firma no la necesita (el trabajador no tiene cuenta).
    useEffect(() => {
        if (window.location.pathname.startsWith('/firma/')) { setLoading(false); return; }
        client.get<User>('/auth/user/')
            .then((res) => setUser(res.data), () => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = async (data: LoginData) => {
        // 1. Enviar credenciales (Django responde con Set-Cookie)
        await client.post('/auth/login/', data);
        // 2. Confirmar que la cookie quedó: si el navegador la bloqueó, el
        // login "funciona" pero la sesión no existe; mejor decirlo aquí.
        queryClient.clear();
        const res = await client.get<User>('/auth/user/');
        setUser(res.data);
    };

    const logout = async () => {
        try {
            await client.post('/auth/logout/');
        } catch (error) {
            console.error("Error al salir", error);
        } finally {
            // Nada del usuario anterior debe quedar a la vista del siguiente.
            setUser(null);
            queryClient.clear();
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};