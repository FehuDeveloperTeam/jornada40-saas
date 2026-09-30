import { useQuery } from '@tanstack/react-query';
import client from '../../../api/client';
import type { BolsaCompensatoria } from '../../../types';

/** Consulta la bolsa de horas de descanso ganadas con horas extra (la calcula el servidor). */
export function useBolsaCompensatoria(empleadoId: number, activa = true) {
  return useQuery({
    queryKey: ['compensatorias', empleadoId],
    queryFn: async () => (await client.get<BolsaCompensatoria>(`/vacaciones/compensatorias/?empleado=${empleadoId}`)).data,
    enabled: activa,
  });
}
