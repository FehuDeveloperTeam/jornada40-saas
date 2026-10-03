/**
 * Avisos cuando el backend creó la solicitud de firma pero el correo al
 * trabajador no salió (`correo_enviado: false` o `correo_fallido` en los envíos
 * masivos). El documento queda pendiente y se puede reenviar.
 */
export const CORREO_NO_ENVIADO =
  'El documento quedó listo para firma, pero no pudimos enviar el correo al trabajador. ' +
  'Usa "Reenviar correo" en Firma electrónica en unos minutos.';

/** Texto para un envío masivo; vacío si todos los correos salieron. */
export function avisoCorreosFallidos(nombres: string[] | undefined): string {
  if (!nombres?.length) return '';
  const lista = nombres.length > 3 ? `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} más` : nombres.join(', ');
  return `No pudimos enviar el correo a ${lista}. Sus documentos quedaron listos para firma: ` +
    'usa "Reenviar correo" en Firma electrónica en unos minutos.';
}

/** `true` si la respuesta de POST /firmas/solicitar/ indica que el correo no salió. */
export function correoFallo(datos: unknown): boolean {
  return typeof datos === 'object' && datos !== null && (datos as { correo_enviado?: boolean }).correo_enviado === false;
}
