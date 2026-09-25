import type { SolicitudFirma } from '../../../types';

type TipoFirma = SolicitudFirma['tipo_documento'];

/** Última solicitud de firma de un documento, si existe. */
export function firmaDe(firmas: SolicitudFirma[] | undefined, campo: keyof SolicitudFirma, id: number, tipo?: TipoFirma) {
  return (firmas ?? [])
    .filter((f) => f[campo] === id && (!tipo || f.tipo_documento === tipo))
    .sort((a, b) => b.enviado_en.localeCompare(a.enviado_en))[0];
}

/**
 * Horas semanales que admite Contrato.horas_semanales (DecimalField de 3
 * dígitos con 1 decimal): hasta 99,9. Un valor mayor o con más decimales el
 * backend lo rechaza (o, dentro de un anexo, falla al aplicarlo al firmar).
 */
export const HORAS_SEMANALES_MAXIMAS = 99.9;

/** Mensaje si las horas no se pueden guardar en el contrato; null si están bien. */
export function errorHorasSemanales(texto: string): string | null {
  const limpio = texto.trim().replace(',', '.');
  if (!limpio) return 'Ingresa las horas semanales.';
  const horas = Number(limpio);
  if (!Number.isFinite(horas) || horas <= 0) return 'Ingresa las horas semanales.';
  if (horas > HORAS_SEMANALES_MAXIMAS) return 'El contrato admite hasta 99,9 horas semanales.';
  if (!/^\d+(\.\d)?$/.test(limpio)) return 'Usa como máximo un decimal (ej. 37,5).';
  return null;
}

/**
 * Mensaje de un error 400 de DRF con las etiquetas en español en vez de la
 * clave técnica del campo ("plan_isapre_uf: …" → "Plan Isapre (UF): …").
 */
export function mensajeErrorCampos(datos: unknown, etiquetas: Record<string, string>, porDefecto: string): string {
  if (!datos || typeof datos !== 'object') return porDefecto;
  const d = datos as Record<string, unknown>;
  if (typeof d.error === 'string') return d.error;
  if (typeof d.detail === 'string') return d.detail;
  const partes = Object.entries(d).map(([k, v]) => {
    const texto = [v].flat().filter((x) => typeof x === 'string').join(' ');
    if (!texto) return '';
    if (k === 'non_field_errors' || k === 'error') return texto;
    return `${etiquetas[k] ?? k.replace(/_/g, ' ')}: ${texto}`;
  }).filter(Boolean);
  return partes.join(' · ') || porDefecto;
}

export const AFPS =['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO'];

// ── Anexo de contrato: campos que puede modificar ─────────────────────────────
export type CampoAnexo = 'cargo' | 'sueldo_base' | 'horas_semanales' | 'tipo_jornada' | 'gratificacion_legal' | 'tiene_quincena';
export const CAMPOS_ANEXO: [CampoAnexo, string][] = [
  ['cargo', 'Cargo'], ['sueldo_base', 'Sueldo base'], ['horas_semanales', 'Horas semanales'],
  ['tipo_jornada', 'Tipo de jornada'], ['gratificacion_legal', 'Gratificación legal'], ['tiene_quincena', 'Anticipo quincenal'],
];

export function esCampoAnexo(v: string | null): v is CampoAnexo {
  return CAMPOS_ANEXO.some(([c]) => c === v);
}
