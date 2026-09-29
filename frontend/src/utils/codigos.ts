/** Largo útil del código de verificación de certificados (sin guiones). */
export const LARGO_CODIGO = 12;

/**
 * Normaliza lo que se escribe o se copia del PDF al formato impreso
 * XXXX-XXXX-XXXX: mayúsculas, sin espacios ni símbolos, máximo 12 caracteres.
 */
export function normalizarCodigo(valor: string): string {
  const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LARGO_CODIGO);
  return limpio.match(/.{1,4}/g)?.join('-') ?? '';
}

export const codigoCompleto = (valor: string) => normalizarCodigo(valor).length === LARGO_CODIGO + 2;
