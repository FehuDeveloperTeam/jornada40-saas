/**
 * Puntaje de 0 a 4 del medidor de contraseña del handoff:
 * +1 por 8 caracteres o más, +1 por mezclar mayúsculas y minúsculas,
 * +1 por tener números y +1 por símbolos o 12 caracteres o más.
 */
export function puntajeContrasena(clave: string): number {
  let puntaje = 0;
  if (clave.length >= 8) puntaje++;
  if (/[A-Z]/.test(clave) && /[a-z]/.test(clave)) puntaje++;
  if (/\d/.test(clave)) puntaje++;
  if (/[^A-Za-z0-9]/.test(clave) || clave.length >= 12) puntaje++;
  return puntaje;
}

// Unas pocas de las más usadas: el backend (CommonPasswordValidator de
// Django) tiene la lista completa; esto solo evita el viaje en las obvias.
const COMUNES = new Set([
  'password', 'password1', 'password123', 'contrasena', 'contraseña', 'qwerty123', 'qwertyui', 'abcd1234',
  'abc12345', 'iloveyou', 'asdf1234', 'jornada40', 'chile123', 'bienvenido', 'bienvenida',
]);

/** Requisitos de una contraseña nueva, en el orden en que se explican. */
export const REGLA_CONTRASENA = 'Usa al menos 8 caracteres, que no sean solo números, y combina mayúsculas y minúsculas, números o símbolos.';

/**
 * Qué le falta a una contraseña nueva, o null si se acepta.
 *
 * Replica en el cliente lo que el backend exige con AUTH_PASSWORD_VALIDATORS
 * (largo mínimo 8, no solo números, no una contraseña común) y suma una
 * mezcla mínima: 8 caracteres más uno de mayúsculas y minúsculas, números,
 * símbolos o 12 caracteres (puntaje 2 del medidor). "abcdefg1" se acepta.
 * La similitud con el nombre o el correo solo la revisa el backend.
 */
export function problemaContrasena(clave: string): string | null {
  if (clave.length < 8) return 'Usa al menos 8 caracteres.';
  if (/^\d+$/.test(clave)) return 'No puede tener solo números.';
  if (COMUNES.has(clave.toLowerCase())) return 'Es una contraseña muy común. Elige otra.';
  if (puntajeContrasena(clave) < 2) return 'Combina mayúsculas y minúsculas, números o símbolos (o usa 12 caracteres o más).';
  return null;
}

export function contrasenaAceptable(clave: string): boolean {
  return problemaContrasena(clave) === null;
}

export const ETIQUETAS_PUNTAJE = ['Ingresa al menos 8 caracteres', 'Débil', 'Aceptable', 'Buena', 'Segura'];
