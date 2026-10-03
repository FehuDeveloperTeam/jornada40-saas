import type { Empleado } from '../../types';

export const TIPO_CONTRATO: Record<string, string> = {
  INDEFINIDO: 'Indefinido', PLAZO_FIJO: 'Plazo fijo', OBRA_FAENA: 'Obra o faena',
};

export const TIPO_JORNADA: Record<string, string> = {
  ORDINARIA: 'Ordinaria', TURNOS: 'Turnos rotativos', BISMANAL: 'Bisemanal', ART_22: 'Artículo 22',
  PARCIAL: 'Parcial', OTRO: 'Otra',
};

/**
 * Bancos e instituciones de pago: lista cerrada, igual a core/bancos.py
 * (el backend guarda el nombre en mayúsculas). Si se agrega una, va en los dos lados.
 */
export const BANCOS = [
  'Banco de Chile', 'BancoEstado', 'Santander', 'BCI', 'Scotiabank', 'Itaú', 'BICE', 'Security',
  'Banco Falabella', 'Banco Ripley', 'Banco Consorcio', 'Banco Internacional', 'BTG Pactual', 'HSBC',
  'Coopeuch', 'Tenpo', 'Mercado Pago', 'MACH', 'Prepago Los Héroes', 'Otra institución',
] as const;

export function estadoTrabajador(t: Empleado, deVacaciones: boolean) {
  if (!t.activo) return { texto: 'Desvinculado', tono: 'neutro' as const };
  if (deVacaciones) return { texto: 'De vacaciones', tono: 'marca' as const };
  return { texto: 'Vigente', tono: 'ok' as const };
}
