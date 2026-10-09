/** Texto comparable: sin tildes, en minúsculas y con un solo espacio. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g;
const CORREO = /[\w.+-]+@[\w-]+\.[\w.]+/g;

/** Para el levantamiento: nunca sale un RUT ni un correo de la pantalla. */
export function enmascarar(texto: string | null | undefined): string {
  return (texto ?? '').replace(CORREO, '[correo]').replace(RUT, '[rut]').replace(/\s+/g, ' ').trim().slice(0, 300);
}

/** RUT sin puntos ni guion, en mayúsculas ("12.345.678-k" → "12345678K"). */
export function rutLimpio(texto: string | null | undefined): string {
  return (texto ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
}
