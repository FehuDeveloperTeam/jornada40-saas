import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { lista } from '../api/lista';
import type { RespuestaLista } from '../api/lista';
import type { ConceptoRemuneracion, ItemLiquidacion, Liquidacion, TipoConcepto } from '../types';

/** Liquidaciones de una empresa en un período (proceso mensual). */
export function useLiquidacionesPeriodo(empresaId: number | undefined, mes: number, anio: number) {
  return useQuery({
    queryKey: ['liquidaciones', 'periodo', empresaId, mes, anio],
    queryFn: async () => lista((await client.get<RespuestaLista<Liquidacion>>(
      `/liquidaciones/?empresa=${empresaId}&mes=${mes}&anio=${anio}`)).data),
    enabled: Boolean(empresaId),
  });
}

/** Catálogo de conceptos: los del sistema y los de la empresa. */
export function useConceptos(empresaId: number | undefined, incluirInactivos = false) {
  return useQuery({
    queryKey: ['conceptos', empresaId, incluirInactivos],
    queryFn: async () => (await client.get<ConceptoRemuneracion[]>(
      `/conceptos/?empresa=${empresaId}${incluirInactivos ? '&incluir_inactivos=true' : ''}`)).data,
    enabled: Boolean(empresaId),
    staleTime: 5 * 60 * 1000,
  });
}

/** Datos que se envían para emitir, editar o simular una liquidación. */
export interface DatosLiquidacion {
  empleado: number;
  mes: number;
  anio: number;
  dias_trabajados: number;
  dias_licencia: number;
  dias_ausencia: number;
  dias_no_contratados: number;
  detalle_items: ItemEnviado[];
  /** Solo al simular la edición de una existente: usa los términos con que se emitió. */
  liquidacion?: number;
}

/** Ítem tal como lo recibe el backend: el valor de horas extra y comisiones lo calcula él. */
export interface ItemEnviado {
  concepto: number | null;
  glosa: string;
  naturaleza: TipoConcepto;
  valor?: number;
  horas?: number;
  recargo?: number;
  monto_vendido?: number;
}

/** Respuesta de /liquidaciones/simular/: el mismo cálculo que al emitir. */
export interface Simulacion {
  sueldo_base: number;
  gratificacion: number;
  semana_corrida: number;
  detalle_items: ItemLiquidacion[];
  afp_nombre: string | null;
  afp_monto: number;
  salud_nombre: string | null;
  salud_monto: number;
  seguro_cesantia: number;
  impuesto_unico: number;
  anticipo_quincena: number;
  total_imponible: number;
  total_haberes: number;
  total_descuentos: number;
  sueldo_liquido: number;
  horas_semanales_contrato: number;
}

export const TIPO_CONCEPTO: Record<TipoConcepto, string> = {
  HABER_IMPONIBLE: 'Haber imponible',
  HABER_NO_IMPONIBLE: 'Haber no imponible',
  HORA_EXTRA: 'Hora extra',
  COMISION: 'Comisión',
  DESCUENTO: 'Descuento',
};
