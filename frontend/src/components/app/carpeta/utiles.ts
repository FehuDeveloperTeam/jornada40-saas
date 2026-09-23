import type { SolicitudFirma } from '../../../types';

type TipoFirma = SolicitudFirma['tipo_documento'];

/** Última solicitud de firma de un documento, si existe. */
export function firmaDe(firmas: SolicitudFirma[] | undefined, campo: keyof SolicitudFirma, id: number, tipo?: TipoFirma) {
  return (firmas ?? [])
    .filter((f) => f[campo] === id && (!tipo || f.tipo_documento === tipo))
    .sort((a, b) => b.enviado_en.localeCompare(a.enviado_en))[0];
}

export const AFPS = ['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO'];
