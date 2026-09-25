import { useQuery } from '@tanstack/react-query';
import client from '../../../api/client';
import { lista as comoLista } from '../../../api/lista';
import type { RespuestaLista } from '../../../api/lista';
import type {
  AnexoContrato, DocumentoLegal, Empleado, Finiquito, Liquidacion, SolicitudFirma, VacacionEmpleado,
} from '../../../types';
import { fechaCL, periodo } from '../../../utils/formato';
import { firmaDe } from './utiles';

export interface DocumentoReciente {
  clave: string;
  titulo: string;
  fecha: string;        // ISO, para ordenar
  fechaTexto: string;
  firma: SolicitudFirma | undefined;
  /** Descarga del PDF: ruta de la API y nombre del archivo. */
  pdf?: { url: string; nombre: string };
  /** Datos para POST /firmas/solicitar/; sin él, el documento no se firma en línea. */
  envio?: { tipo_documento: SolicitudFirma['tipo_documento']; [campo: string]: number | string };
}

const TIPO_LEGAL: Record<string, string> = {
  AMONESTACION: 'Carta de amonestación', DESPIDO: 'Carta de término', MUTUO_ACUERDO: 'Término por mutuo acuerdo',
  CONSTANCIA: 'Constancia laboral',
};
// Tipos legales que admite la firma electrónica (el mutuo acuerdo no).
const FIRMA_LEGAL: Partial<Record<DocumentoLegal['tipo'], SolicitudFirma['tipo_documento']>> = {
  AMONESTACION: 'AMONESTACION', DESPIDO: 'DESPIDO', CONSTANCIA: 'CONSTANCIA',
};
const TIPO_VACACION: Record<string, string> = {
  VACACION_LEGAL: 'Comprobante de vacaciones', VACACION_PROGRESIVA: 'Comprobante de feriado progresivo',
  PERMISO_SIN_GOCE: 'Permiso sin goce de sueldo',
};

/**
 * Finiquitos del trabajador. Misma clave que la pantalla del finiquito, así
 * guardar uno ahí refresca la carpeta. El backend filtra por ?empleado=.
 */
export function useFiniquitos(empleadoId: number | undefined) {
  return useQuery({
    queryKey: ['finiquitos', empleadoId],
    queryFn: async () => comoLista((await client.get<RespuestaLista<Finiquito>>(`/finiquitos/?empleado=${empleadoId}`)).data)
      .filter((f) => f.empleado === empleadoId),
    enabled: Boolean(empleadoId),
  });
}

/** Todos los documentos emitidos del trabajador, del más reciente al más antiguo. */
export function documentosDe(
  empleado: Empleado,
  datos: {
    liquidaciones?: Liquidacion[]; documentos?: DocumentoLegal[]; anexos?: AnexoContrato[];
    vacaciones?: VacacionEmpleado[]; finiquitos?: Finiquito[]; firmas?: SolicitudFirma[];
  },
): DocumentoReciente[] {
  const { liquidaciones = [], documentos = [], anexos = [], vacaciones = [], finiquitos = [], firmas = [] } = datos;
  const rut = empleado.rut;
  const lista: DocumentoReciente[] = [];
  const contrato = empleado.contrato_activo;

  if (contrato) {
    lista.push({
      clave: `c${contrato.id}`, titulo: 'Contrato de trabajo', fecha: contrato.fecha_inicio,
      fechaTexto: `Desde el ${fechaCL(contrato.fecha_inicio)}`, firma: firmaDe(firmas, 'contrato', contrato.id, 'CONTRATO'),
      pdf: { url: `/contratos/${contrato.id}/descargar_contrato/`, nombre: `Contrato_${rut}.pdf` },
      envio: { tipo_documento: 'CONTRATO', contrato_id: contrato.id },
    });
    // Anexo Ley 40 horas: se lista si ya se generó, se envió a firma o la jornada supera el máximo.
    const firmaAnexo40 = firmaDe(firmas, 'contrato', contrato.id, 'ANEXO_40H');
    if (contrato.tiene_anexo_40h_pdf || firmaAnexo40 || contrato.avisos_jornada?.some((x) => x.codigo === 'EXCEDE_MAXIMO')) {
      lista.push({
        clave: `a40-${contrato.id}`, titulo: 'Anexo Ley 40 horas', fecha: contrato.fecha_inicio,
        fechaTexto: 'Reducción de jornada al máximo legal', firma: firmaAnexo40,
        pdf: { url: `/contratos/${contrato.id}/descargar_anexo_40h/`, nombre: `Anexo_40h_${rut}.pdf` },
        envio: { tipo_documento: 'ANEXO_40H', contrato_id: contrato.id },
      });
    }
  }
  for (const l of liquidaciones) {
    lista.push({
      clave: `l${l.id}`, titulo: `Liquidación de sueldo · ${periodo(l.mes, l.anio)}`, fecha: l.fecha_emision,
      fechaTexto: fechaCL(l.fecha_emision), firma: firmaDe(firmas, 'liquidacion', l.id),
      pdf: { url: `/liquidaciones/${l.id}/generar_pdf/`, nombre: `Liquidacion_${rut}_${l.anio}-${String(l.mes).padStart(2, '0')}.pdf` },
      envio: { tipo_documento: 'LIQUIDACION', liquidacion_id: l.id },
    });
  }
  for (const d of documentos) {
    lista.push({
      clave: `d${d.id}`, titulo: TIPO_LEGAL[d.tipo] ?? 'Documento legal', fecha: d.fecha_emision,
      fechaTexto: fechaCL(d.fecha_emision), firma: firmaDe(firmas, 'documento_legal', d.id),
      pdf: { url: `/documentos_legales/${d.id}/generar_pdf/`, nombre: `${d.tipo}_${rut}_${d.fecha_emision}.pdf` },
      envio: FIRMA_LEGAL[d.tipo] && { tipo_documento: FIRMA_LEGAL[d.tipo]!, documento_legal_id: d.id },
    });
  }
  for (const a of anexos) {
    lista.push({
      clave: `a${a.id}`, titulo: `Anexo · ${a.titulo}`, fecha: a.fecha_emision,
      fechaTexto: fechaCL(a.fecha_emision), firma: firmaDe(firmas, 'anexo_contrato', a.id),
      pdf: { url: `/anexos_contrato/${a.id}/generar_pdf/`, nombre: `Anexo_${rut}_${a.fecha_emision}.pdf` },
      envio: { tipo_documento: 'ANEXO_CONTRATO', anexo_contrato_id: a.id },
    });
  }
  for (const v of vacaciones) {
    lista.push({
      clave: `v${v.id}`, titulo: TIPO_VACACION[v.tipo] ?? 'Comprobante de vacaciones', fecha: v.fecha_inicio,
      fechaTexto: `${fechaCL(v.fecha_inicio)} al ${fechaCL(v.fecha_fin)}`, firma: firmaDe(firmas, 'vacacion', v.id),
      pdf: { url: `/vacaciones/${v.id}/generar_pdf/`, nombre: `Vacaciones_${rut}_${v.fecha_inicio}.pdf` },
      envio: { tipo_documento: 'VACACION', vacacion_id: v.id },
    });
  }
  for (const f of finiquitos) {
    lista.push({
      clave: `f${f.id}`, titulo: 'Finiquito', fecha: f.fecha_emision,
      fechaTexto: `Término el ${fechaCL(f.fecha_termino)}${f.modalidad === 'PRESENCIAL' ? ' · ante ministro de fe' : ''}`,
      firma: firmaDe(firmas, 'finiquito', f.id, 'FINIQUITO'),
      // El backend entrega la versión firmada si la hay (nombre _firmado.pdf).
      pdf: { url: `/finiquitos/${f.id}/generar_pdf/`, nombre: `Finiquito_${rut}_${f.fecha_termino}.pdf` },
      // Solo el finiquito electrónico se firma en línea; el presencial se ratifica ante ministro de fe.
      envio: f.modalidad === 'ELECTRONICO' ? { tipo_documento: 'FINIQUITO', finiquito_id: f.id } : undefined,
    });
  }
  return lista.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
}
