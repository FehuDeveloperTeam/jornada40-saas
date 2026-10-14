import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
    interface AxiosRequestConfig {
        /** Petición ya repetida tras renovar la sesión. */
        _reintento?: boolean;
        /** No intentar renovar la sesión ante un 401 (la propia renovación). */
        _sinRenovar?: boolean;
        /** Petición ya repetida tras confirmar la identidad del empleador. */
        _reconfirmado?: boolean;
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
 * Sesión: el token de acceso dura 5 minutos y el de renovación 15 (se renueva
 * en cada uso; CierreInactividad la mantiene viva mientras hay actividad y la
 * cierra a los 5 minutos sin uso). Ante un 401 se renueva una sola vez —las peticiones
 * que fallen a la vez esperan la misma renovación— y se repite la petición.
 * Si la renovación falla, la sesión terminó: se vuelve al login recordando la
 * página, salvo en las rutas públicas.
 */
// '/trabajador/' y '/karin/': el portal del trabajador y el acceso Ley Karin tienen su propia sesión (responden 403 sin ella).
const SIN_RENOVAR = ['/auth/login/', '/auth/equipo/', '/karin/', '/auth/token/refresh/', '/auth/logout/', '/firma-publica/', '/trabajador/',
    '/inspeccion/ingreso/', '/inspeccion/verificar/', '/inspeccion/yo/', '/inspeccion/salir/', '/inspeccion/trabajadores/',
    '/inspeccion/documentos/', '/inspeccion/descargar/', '/inspeccion/ratificar/'];
let renovando: Promise<boolean> | null = null;

/**
 * Cada token de renovación sirve una sola vez (el servidor lo pone en lista
 * negra al usarlo). Las pestañas comparten las cookies: si dos renovaran a la
 * vez con el mismo token, la segunda fallaría y cerraría la sesión. Por eso la
 * renovación se hace de a una pestaña por vez (Web Locks) y, si otra acaba de
 * renovar, las cookies ya son nuevas y no hace falta volver a hacerlo.
 */
const MARCA_RENOVACION = 'j40-renovada-en';
const RENOVADA_HACE_POCO_MS = 10_000;

function marcarRenovacion() {
    try { localStorage.setItem(MARCA_RENOVACION, String(Date.now())); } catch { /* sin almacenamiento */ }
}
function renovadaHacePoco(): boolean {
    try {
        const marca = Number(localStorage.getItem(MARCA_RENOVACION) || 0);
        return Date.now() - marca < RENOVADA_HACE_POCO_MS;
    } catch {
        return false;
    }
}

async function renovarEnServidor(): Promise<boolean> {
    if (renovadaHacePoco()) return true;
    try {
        await client.post('/auth/token/refresh/', {}, { _sinRenovar: true });
    } catch {
        return false;
    }
    marcarRenovacion();
    return true;
}

async function renovarDeAUnaPestana(): Promise<boolean> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    return locks ? locks.request('j40-renovar-sesion', renovarEnServidor) : renovarEnServidor();
}

/** Renueva la sesión del panel (una vez para todas las peticiones que esperan). */
export function renovarSesion(): Promise<boolean> {
    renovando ??= renovarDeAUnaPestana()
        .finally(() => { setTimeout(() => { renovando = null; }, 0); });
    return renovando;
}

/**
 * El titular y los usuarios del equipo entran por puertas distintas: se
 * recuerda por cuál entró este navegador para devolverlo a la misma.
 */
const CLAVE_INGRESO = 'j40-ingreso';
export function recordarIngreso(tipo: 'titular' | 'equipo') {
    try { localStorage.setItem(CLAVE_INGRESO, tipo); } catch { /* sin almacenamiento: vuelve al ingreso del titular */ }
}
export function rutaIngreso(volver?: string): string {
    let tipo: string | null = null;
    try { tipo = localStorage.getItem(CLAVE_INGRESO); } catch { /* sin almacenamiento */ }
    const base = tipo === 'equipo' ? '/equipo' : '/login';
    return volver ? `${base}?volver=${encodeURIComponent(volver)}` : base;
}

export function irAlLogin() {
    const { pathname, search } = window.location;
    if (!pathname.startsWith('/app') && !pathname.startsWith('/bienvenida')) return;
    window.location.assign(rutaIngreso(pathname + search));
}

/**
 * Firmar como empleador exige confirmar la clave (vale unos minutos). Si el
 * backend responde 428 con codigo 'confirmar_identidad', el panel muestra el
 * modal registrado aquí y, confirmada, se repite la petición una vez. Las
 * peticiones simultáneas esperan el mismo modal.
 */
let pedirConfirmacion: (() => Promise<boolean>) | null = null;
let confirmando: Promise<boolean> | null = null;
export function registrarConfirmacionIdentidad(fn: (() => Promise<boolean>) | null) {
    pedirConfirmacion = fn;
}

client.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config: InternalAxiosRequestConfig | undefined = error.config;
    const url = config?.url ?? '';
    const codigo = (error.response?.data as { codigo?: string } | undefined)?.codigo;
    if (error.response?.status === 428 && codigo === 'confirmar_identidad' && config && !config._reconfirmado && pedirConfirmacion) {
        confirmando ??= pedirConfirmacion().finally(() => { setTimeout(() => { confirmando = null; }, 0); });
        if (await confirmando) {
            config._reconfirmado = true;
            return client(config);
        }
        return Promise.reject(error);
    }
    // El cerco del equipo responde 403 con `detail`: las pantallas muestran `error`.
    const datos = error.response?.data as { detail?: unknown; error?: unknown } | undefined;
    if (error.response?.status === 403 && datos && typeof datos === 'object' && typeof datos.detail === 'string' && !datos.error) {
        datos.error = datos.detail;
    }
    if (error.response?.status !== 401 || !config || config._reintento || config._sinRenovar
        || SIN_RENOVAR.some((ruta) => url.includes(ruta))) {
        return Promise.reject(error);
    }
    if (await renovarSesion() || renovadaHacePoco()) {
        // Sin Web Locks, otra pestaña pudo renovar justo antes con el mismo token:
        // sus cookies nuevas ya sirven, así que se repite una vez antes de salir.
        config._reintento = true;
        return client(config);
    }
    // La verificación de sesión de las rutas protegidas decide por sí misma.
    if (!url.includes('/auth/user/')) irAlLogin();
    return Promise.reject(error);
});

export default client;
