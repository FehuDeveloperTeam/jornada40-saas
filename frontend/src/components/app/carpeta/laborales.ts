import type { TipoDocumentoLaboral } from '../../../types';

/** Pactos, autorizaciones y constancias (documentos laborales) más el pacto de teletrabajo (anexo). */
export type TipoLaboral = TipoDocumentoLaboral | 'TELETRABAJO';

export const TITULOS_LABORALES: Record<TipoLaboral, string> = {
  HORAS_EXTRA: 'Pacto de horas extraordinarias',
  TELETRABAJO: 'Pacto de teletrabajo',
  DESCUENTO: 'Autorización de descuento',
  PERMISO_LEGAL: 'Constancia de permiso legal',
  INDEMNIZACION: 'Pacto de indemnización a todo evento',
  ENTREGA_EPP: 'Entrega de elementos de protección (EPP)',
  INFORMACION_RIESGOS: 'Información de riesgos del trabajo',
};
