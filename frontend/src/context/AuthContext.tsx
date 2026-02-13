import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import client from '../api/client';
import type { User } from '../types'; // <--- Aquí agregamos 'type'

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (credentials: any) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Verificar sesión al cargar la app
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            // dj-rest-auth endpoint para ver usuario actual
            const { data } = await client.get('/auth/user/');
            setUser(data);
        } catch (error) {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (credentials: any) => {
        // Login retorna un Token que se guarda en cookie HttpOnly automáticamente
        await client.post('/auth/login/', credentials);
        await checkAuth(); // Recargamos el usuario
    };

    const logout = async () => {
        await client.post('/auth/logout/');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
    return context;
};