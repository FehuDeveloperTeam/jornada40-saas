import type { ModuloPanel } from '../types';

/** Módulo del panel al que pertenece cada tipo de documento (igual que MODULO_POR_TIPO en core/permisos.py). */
const MODULO_POR_TIPO: Record<string, ModuloPanel> = {
  CONTRATO: 'CONTRATOS', ANEXO_40H: 'CONTRATOS', ANEXO_CONTRATO: 'CONTRATOS',
  LIQUIDACION: 'REMUNERACIONES', VACACION: 'VACACIONES', PERMISO_LEGAL: 'VACACIONES',
  FINIQUITO: 'TERMINO', DESPIDO: 'TERMINO', MUTUO_ACUERDO: 'TERMINO',
  AMONESTACION: 'DOCUMENTOS', CONSTANCIA: 'DOCUMENTOS', HORAS_EXTRA: 'DOCUMENTOS',
  DESCUENTO: 'DOCUMENTOS', INDEMNIZACION: 'DOCUMENTOS', REVOCACION_DESCUENTO: 'DOCUMENTOS',
  REGLAMENTO: 'SEGURIDAD', CANALES_DENUNCIA: 'SEGURIDAD', ENTREGA_EPP: 'SEGURIDAD', INFORMACION_RIESGOS: 'SEGURIDAD',
  // El pacto de teletrabajo es un anexo de contrato (Ley 21.220).
  TELETRABAJO: 'CONTRATOS',
};

/** Módulo de un tipo de documento; los anexos (ANEXO_*) van a Contratos y lo desconocido a Documentos. */
export function moduloDeTipo(tipo: string | null | undefined): ModuloPanel {
  if (!tipo) return 'DOCUMENTOS';
  return MODULO_POR_TIPO[tipo] ?? (tipo.startsWith('ANEXO') ? 'CONTRATOS' : 'DOCUMENTOS');
}
