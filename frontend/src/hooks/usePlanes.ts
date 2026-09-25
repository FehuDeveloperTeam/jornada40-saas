import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { lista } from '../api/lista';
import type { RespuestaLista } from '../api/lista';
import type { Plan } from '../types';

/**
 * Respaldo si /planes/ no responde: el sitio público no puede quedar sin
 * precios porque el backend esté caído. Son los valores que siembra el
 * Procfile; si cambian allá, la API manda y esto solo se ve en una caída.
 */
const PLANES_RESPALDO: Plan[] = [
  { id: 0, nombre: 'Semilla', descripcion: null, precio: 0, max_empresas: 1, limite_trabajadores: 3, nivel: 1, activo: true },
  { id: 0, nombre: 'Starter', descripcion: null, precio: 16990, max_empresas: 1, limite_trabajadores: 10, nivel: 2, activo: true },
  { id: 0, nombre: 'Pyme', descripcion: null, precio: 39990, max_empresas: 3, limite_trabajadores: 75, nivel: 3, activo: true },
  { id: 0, nombre: 'Corporativo', descripcion: null, precio: 89990, max_empresas: 10, limite_trabajadores: 250, nivel: 4, activo: true },
];

/** Planes activos ordenados por nivel. `desdeApi` es falso mientras se usa el
 *  respaldo: sin id real no se puede iniciar un pago con esos planes. */
export function usePlanes() {
  const consulta = useQuery({
    queryKey: ['planes'],
    queryFn: async () => lista((await client.get<RespuestaLista<Plan>>('/planes/')).data),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  // Uno por nivel: si en la base quedara un plan duplicado, el sitio no lo
  // muestra dos veces (las tarjetas se eligen por nivel).
  const porNivel = new Map<number, Plan>();
  for (const p of [...(consulta.data?.length ? consulta.data : PLANES_RESPALDO)].sort((a, b) => a.id - b.id)) {
    if (!porNivel.has(p.nivel)) porNivel.set(p.nivel, p);
  }
  const planes = [...porNivel.values()].sort((a, b) => a.nivel - b.nivel);

  return { planes, cargando: consulta.isLoading, desdeApi: Boolean(consulta.data?.length) };
}

export function formatearPrecio(precio: number): string {
  return `$${Math.round(precio).toLocaleString('es-CL')}`;
}

export function textoTrabajadores(plan: Plan): string {
  return `Hasta ${plan.limite_trabajadores} trabajadores`;
}

export function textoEmpresas(plan: Plan): string {
  return plan.max_empresas === 1 ? '1 empresa' : `Hasta ${plan.max_empresas} empresas`;
}
