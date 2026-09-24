import type { SolicitudFirma } from '../../../types';

type TipoFirma = SolicitudFirma['tipo_documento'];

/** Última solicitud de firma de un documento, si existe. */
export function firmaDe(firmas: SolicitudFirma[] | undefined, campo: keyof SolicitudFirma, id: number, tipo?: TipoFirma) {
  return (firmas ?? [])
    .filter((f) => f[campo] === id && (!tipo || f.tipo_documento === tipo))
    .sort((a, b) => b.enviado_en.localeCompare(a.enviado_en))[0];
}

export const AFPS = ['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO'];

// ── Anexo de contrato: campos que puede modificar ─────────────────────────────
export type CampoAnexo = 'cargo' | 'sueldo_base' | 'horas_semanales' | 'tipo_jornada' | 'gratificacion_legal' | 'tiene_quincena';
export const CAMPOS_ANEXO: [CampoAnexo, string][] = [
  ['cargo', 'Cargo'], ['sueldo_base', 'Sueldo base'], ['horas_semanales', 'Horas semanales'],
  ['tipo_jornada', 'Tipo de jornada'], ['gratificacion_legal', 'Gratificación legal'], ['tiene_quincena', 'Anticipo quincenal'],
];

export function esCampoAnexo(v: string | null): v is CampoAnexo {
  return CAMPOS_ANEXO.some(([c]) => c === v);
}
