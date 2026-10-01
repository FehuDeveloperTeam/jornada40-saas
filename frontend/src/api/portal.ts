import { isAxiosError } from 'axios';
import client from './client';
import { descargar } from './descargas';
import type {
  CasoKarinPortal, CertificadoEmitido, CertificadosPortal, CuentaTrabajador, DocumentoPortal, FirmaPendientePortal, LiquidacionPortal,
  OpcionesSolicitudPortal, RespuestaIngresoPortal, SolicitudDocumentoPortal, TipoCertificado, TipoDocumentoPortal,
  TipoSolicitudDocumento, VacacionesPortal,
} from '../types';

/**
 * Portal del trabajador. Su sesión es una cookie propia (httpOnly), distinta
 * de la del empleador; sin ella el backend responde 403, nunca 401, así que
 * el interceptor de client.ts (que renueva la sesión del empleador ante un
 * 401) no interviene. Igual se excluye '/trabajador/' ahí por si acaso.
 */
const BASE = '/trabajador';

/** Mensaje de error del backend ({error}) o el indicado. */
export function mensajeError(err: unknown, porDefecto: string): string {
  if (isAxiosError(err)) {
    const datos = err.response?.data as { error?: string; detail?: string } | undefined;
    if (datos?.error) return datos.error;
    if (err.response?.status === 429) return 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
  }
  return porDefecto;
}

/** El backend responde 403 cuando no hay sesión del portal. */
export const sinSesion = (err: unknown) => isAxiosError(err) && [401, 403].includes(err.response?.status ?? 0);

/** 429 por pedir otro código antes del minuto: el anterior sigue sirviendo. */
export const esperaDeCodigo = (err: unknown) =>
  isAxiosError(err) && err.response?.status === 429 && /minuto/i.test(mensajeError(err, ''));

const obtener = async <T>(ruta: string) => (await client.get<T>(`${BASE}${ruta}`)).data;
const enviar = async <T>(ruta: string, datos: unknown = {}) => (await client.post<T>(`${BASE}${ruta}`, datos)).data;

export const portal = {
  ingreso: (rut: string) => enviar<RespuestaIngresoPortal>('/ingreso/', { rut }),
  pedirCodigo: (rut: string) => enviar<RespuestaIngresoPortal>('/codigo/', { rut }),
  verificarCodigo: (rut: string, codigo: string) => enviar<CuentaTrabajador>('/codigo/verificar/', { rut, codigo }),
  ingresarConClave: (rut: string, clave: string) => enviar<CuentaTrabajador>('/clave/ingresar/', { rut, clave }),
  salir: () => enviar<{ ok: boolean }>('/salir/'),
  yo: () => obtener<CuentaTrabajador>('/yo/'),
  fijarClave: (claveNueva: string, claveActual?: string) =>
    enviar<{ ok: boolean }>('/clave/', claveActual ? { clave_nueva: claveNueva, clave_actual: claveActual } : { clave_nueva: claveNueva }),
  omitirInvitacion: () => enviar<{ ok: boolean }>('/invitacion/omitir/'),
  vincularEmpleo: (ficha: number) => enviar<{ destino: string }>('/empleos/vincular/', { ficha }),
  confirmarEmpleo: (codigo: string) => enviar<CuentaTrabajador>('/empleos/confirmar/', { codigo }),
  liquidaciones: () => obtener<LiquidacionPortal[]>('/liquidaciones/'),
  documentos: () => obtener<DocumentoPortal[]>('/documentos/'),
  vacaciones: () => obtener<VacacionesPortal[]>('/vacaciones/'),
  firmas: () => obtener<FirmaPendientePortal[]>('/firmas/'),
  /** Inicia la firma de una liquidación de un mes cerrado; devuelve el enlace del flujo de firma. */
  firmar: (liquidacion: number) => enviar<{ enlace: string }>('/firmar/', { liquidacion }),
  solicitudes: () => obtener<{ opciones: OpcionesSolicitudPortal[]; solicitudes: SolicitudDocumentoPortal[] }>('/solicitudes/'),
  solicitar: (datos: { empleo: number; tipo: TipoSolicitudDocumento; opcion?: string }) =>
    enviar<SolicitudDocumentoPortal>('/solicitudes/', datos),
  certificados: () => obtener<CertificadosPortal>('/certificados/'),
  emitirCertificado: (datos: { empleo: number; tipo: TipoCertificado; opcion?: string }) =>
    enviar<CertificadoEmitido>('/certificados/', datos),
  karin: () => obtener<{ casos: CasoKarinPortal[] }>('/karin/'),
  descargarKarin: (denuncia: number, tipo: string, participante: string, nombre: string) =>
    descargar(`${BASE}/karin/documento/?denuncia=${denuncia}&tipo=${tipo}&participante=${participante}`, nombre),
  /** Descarga el PDF (firmado si lo está). Devuelve el error a mostrar o null. */
  descargar: (tipo: TipoDocumentoPortal, id: number, nombre: string) =>
    descargar(`${BASE}/descargar/?tipo=${tipo}&id=${id}`, nombre),
};
