import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import type { CatalogosTrabajador } from '../types';

/** Listas cerradas de la ficha del trabajador (bancos, cuidados, fueros): GET /catalogos/trabajador/. */
export function useCatalogosTrabajador() {
  return useQuery({
    queryKey: ['catalogos', 'trabajador'],
    queryFn: async () => (await client.get<CatalogosTrabajador>('/catalogos/trabajador/')).data,
    staleTime: 60 * 60_000,
  });
}
