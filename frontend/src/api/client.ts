import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
    interface AxiosRequestConfig {
        /** Petición ya repetida tras renovar la sesión. */
        _reintento?: boolean;
        /** No intentar renovar la sesión ante un 401 (la propia renovación). */
        _sinRenovar?: boolean;
    }
}

const baseURL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
    baseURL: baseURL,
    withCredentials: true,
    xsrfCookieName: 'csrftoken',
    xsrfHeaderName: 'X-CSRFToken',
    headers: {
        'Content-Type': 'application/json',
    }
});

/**
 * Sesión: el token de acceso dura 30 minutos y el de renovación 2 horas (se
 * renueva en cada uso). Ante un 401 se renueva una sola vez —las peticiones
 * que fallen a la vez esperan la misma renovación— y se repite la petición.
 * Si la renovación falla, la sesión terminó: se vuelve al login recordando la
 * página, salvo en las rutas públicas.
 */
const SIN_RENOVAR = ['/auth/login/', '/auth/token/refresh/', '/auth/logout/', '/firma-publica/'];
let renovando: Promise<boolean> | null = null;

function renovarSesion(): Promise<boolean> {
    renovando ??= client.post('/auth/token/refresh/', {}, { _sinRenovar: true })
        .then(() => true, () => false)
        .finally(() => { setTimeout(() => { renovando = null; }, 0); });
    return renovando;
}

export function irAlLogin() {
    const { pathname, search } = window.location;
    if (!pathname.startsWith('/app') && !pathname.startsWith('/bienvenida')) return;
    window.location.assign(`/login?volver=${encodeURIComponent(pathname + search)}`);
}

client.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config: InternalAxiosRequestConfig | undefined = error.config;
    const url = config?.url ?? '';
    if (error.response?.status !== 401 || !config || config._reintento || config._sinRenovar
        || SIN_RENOVAR.some((ruta) => url.includes(ruta))) {
        return Promise.reject(error);
    }
    if (await renovarSesion()) {
        config._reintento = true;
        return client(config);
    }
    // La verificación de sesión de las rutas protegidas decide por sí misma.
    if (!url.includes('/auth/user/')) irAlLogin();
    return Promise.reject(error);
});

export default client;
