import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { lista } from '../api/lista';
import type { RespuestaLista } from '../api/lista';
import type {
  AnexoContrato, DocumentoLegal, Empleado, Empresa, Liquidacion, SaldoVacaciones, SolicitudFirma,
  VacacionEmpleado,
} from '../types';
import { usePlanes } from './usePlanes';

/**
 * Datos del panel rediseñado. Cada recurso es una consulta de react-query
 * con su propia clave, así una mutación puede refrescar solo lo que cambió.
 */

const obtener = async <T,>(url: string) => lista((await client.get<RespuestaLista<T>>(url)).data);

// La empresa activa se guarda en la misma clave que usa el panel anterior:
// cambiar de empresa en uno se refleja en el otro.
const CLAVE_EMPRESA = 'empresaActivaId';

export function useEmpresaActiva() {
  const empresas = useQuery({ queryKey: ['empresas'], queryFn: () => obtener<Empresa>('/empresas/') });
  const [id, setId] = useState<number | null>(() => Number(localStorage.getItem(CLAVE_EMPRESA)) || null);

  const activas = (empresas.data ?? []).filter((e) => e.activo !== false);
  const empresa = activas.find((e) => e.id === id) ?? activas[0] ?? null;

  // Si la guardada ya no existe (o no había), se usa la primera y se recuerda
  // para el panel anterior, que lee la misma clave.
  useEffect(() => {
    if (empresa && empresa.id !== id) localStorage.setItem(CLAVE_EMPRESA, String(empresa.id));
  }, [empresa, id]);

  const cambiar = useCallback((nuevo: number) => {
    localStorage.setItem(CLAVE_EMPRESA, String(nuevo));
    setId(nuevo);
  }, []);

  return { empresa, empresas: activas, cambiar, cargando: empresas.isLoading, error: empresas.isError };
}

export interface Suscripcion {
  estado: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELED';
  plan: { id: number; nombre: string; precio: number; limite_trabajadores: number };
  trabajadores_actuales: number;
  fecha_proximo_cobro: string | null;
}

/** Suscripción con el nivel del plan resuelto (el backend habilita por nivel). */
export function useSuscripcion() {
  const { planes } = usePlanes();
  const consulta = useQuery({
    queryKey: ['mi_suscripcion'],
    queryFn: async () => (await client.get<Suscripcion>('/clientes/mi_suscripcion/')).data,
  });
  const plan = planes.find((p) => p.id === consulta.data?.plan.id);
  return {
    suscripcion: consulta.data,
    nivel: plan?.nivel ?? 1,
    maxEmpresas: plan?.max_empresas ?? 1,
    cargando: consulta.isLoading,
  };
}

export interface Indicadores {
  fecha: string;
  uf: number;
  utm: number;
  jornada_maxima_vigente: number;
  respaldo: boolean;
}

export function useIndicadores() {
  return useQuery({
    queryKey: ['indicadores'],
    queryFn: async () => (await client.get<Indicadores>('/indicadores/')).data,
    staleTime: 60 * 60 * 1000,
  });
}

export function useTrabajadores(empresaId: number | undefined) {
  return useQuery({
    queryKey: ['empleados', empresaId],
    queryFn: () => obtener<Empleado>(`/empleados/?empresa=${empresaId}`),
    enabled: Boolean(empresaId),
  });
}

export function useFirmas() {
  return useQuery({ queryKey: ['firmas'], queryFn: () => obtener<SolicitudFirma>('/firmas/') });
}

export function useVacacionesEmpresa(empresaId: number | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['vacaciones', 'empresa', empresaId],
    queryFn: async () => (await obtener<VacacionEmpleado>('/vacaciones/')).filter((v) => v.empresa === empresaId),
    enabled: Boolean(empresaId) && habilitado,
  });
}

/** Todo lo que muestra la carpeta de un trabajador. */
export function useCarpeta(empleadoId: number | undefined, nivel: number) {
  const activo = Boolean(empleadoId);
  const vacacionesHabilitadas = activo && nivel >= 2;  // vacaciones: plan Starter en adelante
  return {
    liquidaciones: useQuery({
      queryKey: ['liquidaciones', empleadoId],
      queryFn: () => obtener<Liquidacion>(`/liquidaciones/?empleado=${empleadoId}`),
      enabled: activo,
    }),
    vacaciones: useQuery({
      queryKey: ['vacaciones', empleadoId],
      queryFn: () => obtener<VacacionEmpleado>(`/vacaciones/?empleado=${empleadoId}`),
      enabled: vacacionesHabilitadas,
    }),
    saldo: useQuery({
      queryKey: ['saldo-vacaciones', empleadoId],
      queryFn: async () => (await client.get<SaldoVacaciones>(`/vacaciones/saldo/?empleado=${empleadoId}`)).data,
      enabled: vacacionesHabilitadas,
    }),
    documentos: useQuery({
      queryKey: ['documentos', empleadoId],
      queryFn: () => obtener<DocumentoLegal>(`/documentos_legales/?empleado=${empleadoId}`),
      enabled: activo,
    }),
    anexos: useQuery({
      queryKey: ['anexos', empleadoId],
      queryFn: () => obtener<AnexoContrato>(`/anexos_contrato/?empleado=${empleadoId}`),
      enabled: activo,
    }),
    firmas: useQuery({
      queryKey: ['firmas', empleadoId],
      queryFn: () => obtener<SolicitudFirma>(`/firmas/?empleado_id=${empleadoId}`),
      enabled: activo,
    }),
  };
}

/** Ruta del panel anterior abierta en la ficha y pestaña de un trabajador. */
export type PestanaClasica = 'perfil' | 'contratos' | 'liquidaciones' | 'historial' | 'legal' | 'vacaciones' | 'finiquito';
export function rutaClasica(empleadoId?: number, tab?: PestanaClasica): string {
  if (!empleadoId) return '/dashboard';
  return `/dashboard?empleado=${empleadoId}${tab ? `&tab=${tab}` : ''}`;
}
