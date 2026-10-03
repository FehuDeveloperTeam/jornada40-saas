import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react'; 
import { useQueryClient } from '@tanstack/react-query';
import client, { recordarIngreso } from '../api/client';
import type { User } from '../types';
import { marcarActividad } from '../utils/actividad';

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
    /** Ingreso de un usuario del equipo. Si su clave vale en varias cuentas, devuelve cuáles para elegir. */
    loginEquipo: (rut: string, clave: string, cuenta?: number) => Promise<CuentaParaElegir[] | null>;
    logout: () => void;
}

export interface CuentaParaElegir { cuenta: number; nombre: string }

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
    // de firma y el portal del trabajador no la necesitan (tienen su propia sesión).
    useEffect(() => {
        const ruta = window.location.pathname;
        if (ruta.startsWith('/firma/') || ruta === '/trabajador' || ruta.startsWith('/trabajador/') || ruta === '/karin' || ruta.startsWith('/karin/')) { setLoading(false); return; }
        client.get<User>('/auth/user/')
            .then((res) => setUser(res.data), () => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = async (data: LoginData) => {
        // 1. Enviar credenciales (Django responde con Set-Cookie)
        await client.post('/auth/login/', data);
        recordarIngreso('titular');
        marcarActividad('panel');
        // 2. Confirmar que la cookie quedó: si el navegador la bloqueó, el
        // login "funciona" pero la sesión no existe; mejor decirlo aquí.
        queryClient.clear();
        const res = await client.get<User>('/auth/user/');
        setUser(res.data);
    };

    const loginEquipo = async (rut: string, clave: string, cuenta?: number) => {
        const res = await client.post<{ elegir_cuenta?: CuentaParaElegir[] }>('/auth/equipo/ingresar/', { rut, clave, cuenta });
        if (res.data.elegir_cuenta) return res.data.elegir_cuenta;
        recordarIngreso('equipo');
        marcarActividad('panel');
        queryClient.clear();
        const usuario = await client.get<User>('/auth/user/');
        setUser(usuario.data);
        return null;
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
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, loginEquipo, logout }}>
            {children}
        </AuthContext.Provider>
    );
};