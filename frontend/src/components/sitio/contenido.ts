import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck, ClipboardCheck, FilePenLine, FileUp, Gavel, HardHat, HeartHandshake, History, Inbox, Landmark,
  Lock, Mail, QrCode, Receipt, ScrollText, ShieldAlert, KeyRound, ShieldCheck, Signature, TreePalm, Users,
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
  { icono: FilePenLine, titulo: 'Contratos y anexos', texto: 'Alta del trabajador en un paso, con jornada con horario o Art. 22. Detecta los contratos sobre el máximo vigente y genera el anexo con el horario propuesto.' },
  { icono: Receipt, titulo: 'Liquidaciones de sueldo', texto: 'Gratificación con tope, horas extra, asignación familiar, AFP, salud, cesantía e impuesto único, con los parámetros que regían en cada período.' },
  { icono: Signature, titulo: 'Firma electrónica', texto: 'El trabajador firma desde su correo con un código de verificación. Tú confirmas tu identidad al enviar, y el PDF firmado queda en la carpeta.' },
  { icono: TreePalm, titulo: 'Vacaciones y permisos', texto: 'Feriado legal y progresivo al día, permisos legales con sus días calculados y días libres por horas extra (Ley 21.561).' },
  { icono: Gavel, titulo: 'Pactos y documentos', texto: 'Pactos de horas extra, descuentos autorizados, teletrabajo, indemnización a todo evento, amonestaciones, cartas de término y finiquitos.' },
  { icono: FileUp, titulo: 'Previred, LRE y SII', texto: 'Archivo Previred, Libro de Remuneraciones Electrónico para Mi DT, Certificado N°6 y apoyo para la DJ 1887.' },
  { icono: Landmark, titulo: 'Dirección del Trabajo', texto: 'Plazos de registro en Mi DT con los datos listos para copiar, y un portal para que el fiscalizador revise los documentos en línea.' },
  { icono: ScrollText, titulo: 'Reglamento y seguridad', texto: 'Guía de reglamento interno por rubro, entrega firmada a cada trabajador, información de riesgos y entrega de EPP.' },
  { icono: Mail, titulo: 'Resumen por correo', texto: 'Cada día o cada lunes, lo pendiente en un correo simple: firmas por vencer, plazos de la DT y solicitudes de tu equipo.' },
];

/** Lo que el trabajador hace solo desde su portal (plan Pyme en adelante). */
export const PORTAL: Destacado[] = [
  { icono: Receipt, titulo: 'Sus documentos', texto: 'Contrato, liquidaciones y documentos firmados, siempre disponibles. También firma lo pendiente desde ahí.' },
  { icono: QrCode, titulo: 'Certificados al instante', texto: 'Antigüedad, renta, cotizaciones, vacaciones y jornada, con tu firma y un código QR que cualquiera puede verificar.' },
  { icono: Inbox, titulo: 'Solicitudes', texto: 'Pide vacaciones, permisos legales o documentos que falten. Tú respondes desde el panel y le llega el aviso por correo.' },
  { icono: HeartHandshake, titulo: 'Conciliación familiar', texto: 'Quien cuida a un menor o a una persona con discapacidad pide teletrabajo o cambio de jornada (Ley 21.645), con los plazos de respuesta a la vista.' },
];

/** Obligaciones con plazos legales que el sistema sigue por ti. */
export const CUMPLIMIENTO: Destacado[] = [
  { icono: ShieldAlert, titulo: 'Ley Karin', texto: 'Canal de denuncias desde el portal, acceso separado y reservado para el encargado, plazos del DS 21 y documentos del expediente.' },
  { icono: HardHat, titulo: 'Higiene y seguridad', texto: 'Reglamento con su remisión a la DT y la Seremi, información de riesgos de cada cargo y capacitación en el uso de EPP.' },
  { icono: BadgeCheck, titulo: 'Protecciones especiales', texto: 'Avisos de fuero maternal (calculado desde el parto), sindical y otros, cuidado de personas (Ley 21.645) y Ley SANNA antes de un término.' },
  { icono: Landmark, titulo: 'Registro en Mi DT', texto: 'Contratos, anexos y términos con su plazo en días hábiles, y la ficha con los datos en el orden del formulario.' },
];

export const SEGURIDAD: Destacado[] = [
  { icono: Lock, titulo: 'Sesiones protegidas', texto: 'Credenciales en cookies seguras que el navegador no expone al código de la página. La sesión se cierra tras 5 minutos sin uso.' },
  { icono: Users, titulo: 'Usuarios con permisos', texto: 'Invita a tu contador o jefatura con acceso solo a los módulos y empresas que elijas: ver o gestionar.' },
  { icono: History, titulo: 'Bitácora verificable', texto: 'Quién hizo qué y cuándo, encadenado con huellas criptográficas. Puedes descargar una copia con código de verificación.' },
  { icono: ShieldCheck, titulo: 'Firma con verificación', texto: 'Cada firma exige un código de un solo uso enviado al correo del trabajador, con tres intentos y 10 minutos de vigencia.' },
  { icono: KeyRound, titulo: 'Reserva de la Ley Karin', texto: 'Las denuncias se guardan cifradas y solo el encargado las ve. Ni el titular ni su equipo acceden a su contenido.' },
  { icono: ClipboardCheck, titulo: 'Cálculos trazables', texto: 'Topes, tasas y UF quedan congelados en cada liquidación. Los parámetros los revisa el equipo de Jornada40 contra la fuente oficial.' },
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
    { pregunta: '¿Mis trabajadores necesitan instalar algo?', respuesta: 'No. Desde el plan Pyme entran al portal del trabajador con su RUT y un código que llega a su correo. Ahí ven sus liquidaciones firmadas, generan certificados y te envían solicitudes de vacaciones, permisos o documentos.' },
    { pregunta: '¿Cómo me ayuda con la Ley Karin?', respuesta: 'Desde el plan Pyme designas un encargado de denuncias con un acceso separado. Los trabajadores pueden denunciar desde su portal, y el encargado lleva el expediente con los plazos del DS 21. Tú solo ves cuántos casos hay abiertos y si hay plazos vencidos, nunca su contenido.' },
    { pregunta: '¿Qué pasa si llega una fiscalización de la DT?', respuesta: 'El fiscalizador entra al portal de fiscalización con su correo institucional y revisa en línea los contratos, liquidaciones y documentos con su estado de firma. Tú ves en el panel cada acceso y cada descarga.' },
    { pregunta: '¿Puede entrar mi contador o mi administrador?', respuesta: 'Sí, desde el plan Starter. Cada persona tiene su propia clave y solo ve los módulos y empresas que le asignes. Todo lo que hace queda en la bitácora.' },
    { pregunta: '¿Puedo cambiar de plan después?', respuesta: 'Sí, desde Plan y facturación. Al subir, el plan nuevo rige desde el pago. Al bajar, mantienes tu plan hasta el próximo cobro y desde ahí pagas el plan menor, con la misma tarjeta.' },
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
  1: ['Contratos y anexos Ley 40 horas', 'Liquidaciones de sueldo', 'Firma electrónica con código OTP',
      'Certificado N°6 del SII', 'Entrega de EPP', 'Resumen por correo', 'Documentos con marca Jornada40'],
  2: ['Todo lo de Semilla, sin marca', 'Vacaciones y permisos', 'Pactos de horas extra y constancias',
      'Cartas de término y finiquitos', 'Usuarios del equipo con permisos y bitácora'],
  3: ['Todo lo de Starter', 'Portal del trabajador: certificados y solicitudes', 'Previred y Libro de Remuneraciones Electrónico',
      'Reglamento interno e información de riesgos', 'Ley Karin con encargado de denuncias',
      'Horas extra compensadas con días libres', 'Carga masiva desde Excel y descarga en ZIP'],
  4: ['Todo lo de Pyme', 'Más empresas y trabajadores en una sola cuenta', 'Más usuarios del equipo'],
};

/** Plan destacado con la etiqueta "Más elegido". */
export const NIVEL_DESTACADO = 3;
