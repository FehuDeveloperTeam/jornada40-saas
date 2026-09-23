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

/**
 * Regla para aceptar una contraseña nueva.
 *
 * El prototipo aceptaba con 2 puntos, pero "Ab1" suma 2 sin llegar a 8
 * caracteres. El largo mínimo se exige aparte, que es lo que promete el
 * propio mensaje de error ("al menos 8 caracteres con mayúsculas y números").
 * El backend no valida la contraseña al registrar, así que esta regla es la
 * única barrera en ese flujo.
 */
export function contrasenaAceptable(clave: string): boolean {
  return clave.length >= 8 && puntajeContrasena(clave) >= 2;
}

export const ETIQUETAS_PUNTAJE = ['Ingresa al menos 8 caracteres', 'Débil', 'Aceptable', 'Buena', 'Segura'];
