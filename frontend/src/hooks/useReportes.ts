import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

export interface EmpresaConsolidado {
  id: number;
  nombre: string;
  rut: string;
  trabajadores: number;
  masa_salarial: number;
  liquido_total: number;
  costo_empleador: number;
}

export interface PuntoEvolucion {
  mes: number;
  mes_nombre: string;
  masa_salarial: number;
  liquido_total: number;
  costo_empleador: number;
  trabajadores: number;
}

export interface ConsolidadoData {
  periodo: {
    anio: number;
    mes: number | null;
    mes_nombre: string | null;
  };
  kpis: {
    masa_salarial: number;
    trabajadores: number;
    costo_empleador: number;
    liquido_total: number;
  };
  empresas: EmpresaConsolidado[];
  evolucion: PuntoEvolucion[];
}

export function useReportes() {
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState<number | null>(now.getMonth() + 1);

  const [data, setData] = useState<ConsolidadoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchConsolidado = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { anio };
      if (mes) params.mes = mes;
      const res = await client.get('/liquidaciones/consolidado/', { params });
      setData(res.data);
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number } };
      if (anyErr.response?.status === 404) {
        setData(null);
        setError('No hay liquidaciones generadas para el período seleccionado.');
      } else {
        setError('Error al cargar los reportes. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  }, [anio, mes]);

  useEffect(() => {
    fetchConsolidado();
  }, [fetchConsolidado]);

  return {
    anio, setAnio,
    mes, setMes,
    data, loading, error,
    refetch: fetchConsolidado,
  };
}
