import { useEffect, useState } from 'react';
import client from '../api/client';
import type { AvisoJornada, HorarioSemana } from '../types';

interface Borrador {
  tipo_jornada?: string;
  horas_semanales?: string | number;
  distribucion_horario?: HorarioSemana | null;
}

/**
 * Avisos de jornada de un contrato que se está editando, calculados por el
 * backend (POST /contratos/evaluar-jornada/). Las reglas viven solo en
 * core/jornada.py: el formulario no las duplica.
 *
 * Espera 400 ms desde el último cambio para no consultar en cada tecla.
 */
export function useAvisosJornada({ tipo_jornada, horas_semanales, distribucion_horario }: Borrador) {
  const [avisos, setAvisos] = useState<AvisoJornada[]>([]);
  const [maximo, setMaximo] = useState<number | null>(null);
  const clave = JSON.stringify([tipo_jornada, horas_semanales, distribucion_horario]);

  useEffect(() => {
    const control = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const { data } = await client.post<{ avisos: AvisoJornada[]; jornada_maxima_vigente: number }>(
          '/contratos/evaluar-jornada/',
          { tipo_jornada, horas_semanales, distribucion_horario },
          { signal: control.signal },
        );
        setAvisos(data.avisos);
        setMaximo(data.jornada_maxima_vigente);
      } catch {
        // Si la evaluación falla no se inventan avisos: el formulario sigue
        // funcionando igual, solo sin la revisión en vivo.
      }
    }, 400);
    return () => { clearTimeout(espera); control.abort(); };
    // `clave` resume los tres valores: evita consultar si el objeto cambió
    // de identidad pero no de contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return { avisos, maximo };
}
