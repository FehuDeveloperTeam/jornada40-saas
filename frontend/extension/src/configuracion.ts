/* Valores que fija el script de compilación (construir.mjs) según el entorno. */
declare const __API__: string;
declare const __ENTORNO__: string;
declare const __VERSION__: string;

export const API: string = typeof __API__ === 'string' ? __API__ : 'http://127.0.0.1:8000/api';
export const ENTORNO: string = typeof __ENTORNO__ === 'string' ? __ENTORNO__ : 'desarrollo';
export const VERSION: string = typeof __VERSION__ === 'string' ? __VERSION__ : '0.0.0';
/** Dónde se pide el código para conectar la extensión. */
export const SITIO: string = API.replace('://api-staging.', '://staging.').replace('://api.', '://').replace(/\/api$/, '');
export const MI_DT = 'https://midt.dirtrab.cl';
