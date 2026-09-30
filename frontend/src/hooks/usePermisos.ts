import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import type { ModuloPanel, SesionPanel } from '../types';

/** Módulos que muestran documentos de un trabajador (firmas, historial de documentos). */
export const MODULOS_DOCUMENTOS: ModuloPanel[] = ['DOCUMENTOS', 'TERMINO', 'VACACIONES', 'SEGURIDAD', 'CONTRATOS', 'REMUNERACIONES'];

/** Nombres de los módulos (los mismos de core/permisos.py). */
export const NOMBRES_MODULOS: Record<ModuloPanel, string> = {
  TRABAJADORES: 'Trabajadores', CONTRATOS: 'Contratos y anexos', REMUNERACIONES: 'Remuneraciones',
  VACACIONES: 'Vacaciones y permisos', DOCUMENTOS: 'Documentos y pactos', TERMINO: 'Término de contrato',
  DIRECCION_TRABAJO: 'Dirección del Trabajo', SEGURIDAD: 'Reglamento y seguridad', SOLICITUDES: 'Solicitudes del portal',
  REPORTES: 'Reportes y expedientes',
};

export interface Permisos {
  sesion: SesionPanel | undefined;
  cargando: boolean;
  esTitular: boolean;
  /** Si puede ver (o gestionar) alguno de los módulos. El titular puede todo. */
  puede: (modulos: ModuloPanel | ModuloPanel[], gestionar?: boolean) => boolean;
}

/**
 * Permisos de quien está conectado. El backend manda (el cerco rechaza lo que
 * no corresponde); esto solo evita mostrar pantallas, botones y consultas que
 * responderían "sin permiso". Mientras carga, se asume titular para no ocultar
 * nada a la cuenta principal por un instante.
 */
export function usePermisos(): Permisos {
  const sesion = useQuery({
    queryKey: ['sesion'],
    queryFn: async () => (await client.get<SesionPanel>('/auth/sesion/')).data,
    staleTime: 5 * 60_000,
  });
  const datos = sesion.data;
  const esTitular = !datos || datos.tipo === 'TITULAR';
  const puede = (modulos: ModuloPanel | ModuloPanel[], gestionar = false) => {
    if (esTitular) return true;
    const permisos = datos?.permisos ?? {};
    const lista = Array.isArray(modulos) ? modulos : [modulos];
    if (lista.some((m) => permisos[m] === 'GESTIONAR' || (!gestionar && permisos[m] === 'VER'))) return true;
    // Quien tiene cualquier módulo puede ver las fichas de los trabajadores.
    return !gestionar && lista.includes('TRABAJADORES') && Object.keys(permisos).length > 0;
  };
  return { sesion: datos, cargando: sesion.isLoading, esTitular, puede };
}
