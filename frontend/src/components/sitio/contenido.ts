import type { LucideIcon } from 'lucide-react';
import {
  ClipboardCheck, FilePenLine, FileUp, Gavel, History, Lock, Receipt,
  ShieldCheck, Signature, TreePalm,
} from 'lucide-react';
import { ETAPAS_LEY_40, fechaCorta, indiceEtapaVigente, proximaEtapa } from '../../utils/ley40';

/**
 * Textos del sitio público. Salen del handoff de diseño, con estas
 * correcciones para que lo que prometen sea cierto en el sistema actual:
 *
 *  - Seguridad: el handoff decía que los parámetros de Previred los confirma
 *    "alguien de tu equipo". Los parámetros son globales y los confirma el
 *    equipo de Jornada40 desde el admin, no cada cliente.
 *  - FAQ Excel: la carga masiva es del plan Pyme en adelante.
 *  - FAQ de la ley: se arma desde utils/ley40 para que siga siendo correcta
 *    cuando cambie la etapa vigente.
 */

export interface Destacado {
  icono: LucideIcon;
  titulo: string;
  texto: string;
}

export const FUNCIONES: Destacado[] = [
  { icono: FilePenLine, titulo: 'Contratos y anexos', texto: 'Contrato con distribución de jornada día a día. Detecta los que superan el máximo vigente y genera el anexo con el horario propuesto.' },
  { icono: Receipt, titulo: 'Liquidaciones de sueldo', texto: 'Gratificación con tope, horas extra, AFP, salud, cesantía e impuesto único, con los parámetros que regían en cada período.' },
  { icono: Signature, titulo: 'Firma electrónica', texto: 'El trabajador firma desde su correo con un código de verificación. Queda registro de fecha, hora e IP.' },
  { icono: TreePalm, titulo: 'Vacaciones y permisos', texto: 'Saldo de feriado legal y progresivo al día, con comprobante listo para firmar.' },
  { icono: Gavel, titulo: 'Documentos legales', texto: 'Amonestaciones, constancias, cartas de término y finiquitos con la causal del Código del Trabajo.' },
  { icono: FileUp, titulo: 'Previred y libro', texto: 'Archivo Previred, libro de remuneraciones y descarga masiva al cierre de cada mes.' },
];

export const SEGURIDAD: Destacado[] = [
  { icono: Lock, titulo: 'Sesiones protegidas', texto: 'Credenciales en cookies seguras que el navegador no expone al código de la página. Las sesiones caducan solas.' },
  { icono: ShieldCheck, titulo: 'Firma con verificación', texto: 'Cada firma exige un código de un solo uso enviado al correo del trabajador, con tres intentos y 10 minutos de vigencia.' },
  { icono: History, titulo: 'Cálculos trazables', texto: 'Topes, tasas y UF quedan congelados en cada liquidación. Recalcular un mes antiguo usa los valores de ese mes.' },
  { icono: ClipboardCheck, titulo: 'Nada se aplica sin revisión', texto: 'Los parámetros leídos desde Previred son solo una propuesta hasta que se verifican contra la fuente oficial.' },
];

const FECHAS_LARGAS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (f: Date) => `${f.getDate()} de ${FECHAS_LARGAS[f.getMonth()]} de ${f.getFullYear()}`;

function respuestaLey(hoy: Date): string {
  const vigente = ETAPAS_LEY_40[indiceEtapaVigente(hoy)];
  const proxima = proximaEtapa(hoy);
  const actual = vigente.desde
    ? `Desde el ${fechaLarga(vigente.desde)} la jornada ordinaria máxima es de ${vigente.horas} horas semanales.`
    : `La jornada ordinaria máxima es de ${vigente.horas} horas semanales.`;
  if (!proxima?.desde) return `${actual} Es la meta final de la ley.`;
  const meta = proxima.horas === 40 ? ', que es la meta final de la ley' : '';
  return `${actual} El ${fechaLarga(proxima.desde)} baja a ${proxima.horas} horas${meta}.`;
}

export function preguntasFrecuentes(hoy: Date = new Date()): { pregunta: string; respuesta: string }[] {
  return [
    { pregunta: '¿Qué exige hoy la Ley 40 horas?', respuesta: respuestaLey(hoy) },
    { pregunta: '¿Tengo que rehacer todos los contratos?', respuesta: 'No. Solo los contratos que superan el máximo vigente necesitan un anexo de jornada. Jornada40 los identifica y genera el anexo con la nueva distribución de horario.' },
    { pregunta: '¿Qué tipo de firma electrónica usan?', respuesta: 'Firma electrónica simple: el trabajador abre un enlace personal, verifica su identidad con un código enviado a su correo y firma. El documento firmado queda en su carpeta con el registro de la operación.' },
    { pregunta: '¿Puedo cargar a mi equipo desde Excel?', respuesta: 'Sí, desde el plan Pyme. Descarga la planilla, complétala con tus trabajadores y súbela. Validamos cada RUT y te mostramos las filas con errores antes de guardar.' },
    { pregunta: '¿Puedo cambiar de plan después?', respuesta: 'Sí, puedes subir o bajar de plan cuando quieras desde la sección Empresa. El cambio se refleja en el siguiente cobro.' },
  ];
}

export interface Hito {
  fecha: string;
  horas: string;
  texto: string;
  vigente: boolean;
}

/** Las cuatro etapas del calendario, con la vigente marcada según la fecha real. */
export function hitosLey(hoy: Date = new Date()): Hito[] {
  const vigente = indiceEtapaVigente(hoy);
  return ETAPAS_LEY_40.map((etapa, i) => ({
    fecha: etapa.desde ? fechaCorta(etapa.desde) : '2023',
    horas: `${etapa.horas} h`,
    texto: i === vigente ? 'Vigente hoy' : etapa.descripcion,
    vigente: i === vigente,
  }));
}

// ── Planes ──────────────────────────────────────────────────────────────────
// Precio y límites vienen de /planes/ (la BD manda). Lo que incluye cada plan
// es texto comercial y se asocia por `nivel`, que es estable aunque cambie el
// nombre del plan.

export const INCLUYE_POR_NIVEL: Record<number, string[]> = {
  1: ['Contratos y anexos Ley 40 horas', 'Liquidaciones de sueldo', 'Firma electrónica con código OTP', 'Documentos con marca Jornada40'],
  2: ['Todo lo de Semilla, sin marca', 'Vacaciones y permisos', 'Finiquitos'],
  3: ['Todo lo de Starter', 'Carga masiva desde Excel', 'Archivo Previred y libro de remuneraciones', 'Descarga masiva de PDF en ZIP'],
  4: ['Todo lo de Pyme', 'Consolidado de remuneraciones multiempresa'],
};

/** Plan destacado con la etiqueta "Más elegido". */
export const NIVEL_DESTACADO = 3;
