import type { TonoChip } from '../../../src/components/j40/Chip';
import type { ItemRegistroDT } from '../../../src/types';
import { fechaCL } from '../../../src/utils/formato';

/** "abcd efgh" → "ABCD-EFGH" mientras se escribe (8 letras y números). */
export function formatearCodigo(texto: string): string {
  const s = texto.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

/** Nombre con que se reconoce este navegador en Jornada40 ("Chrome en Windows"). */
export function nombrePorDefecto(ua: string = navigator.userAgent): string {
  const navegador = /Edg\//.test(ua) ? 'Edge' : 'Chrome';
  const sistema = /Windows/.test(ua) ? 'Windows'
    : /CrOS/.test(ua) ? 'ChromeOS'
      : /Mac OS X|Macintosh/.test(ua) ? 'Mac'
        : /Linux/.test(ua) ? 'Linux' : '';
  return sistema ? `${navegador} en ${sistema}` : navegador;
}

/** Lo que falta registrar: vencidos primero y luego por fecha de vencimiento. */
export function porRegistrar(items: ItemRegistroDT[]): ItemRegistroDT[] {
  const peso = (i: ItemRegistroDT) => (i.estado === 'VENCIDO' ? 0 : 1);
  return items
    .filter((i) => i.estado !== 'REGISTRADO')
    .sort((a, b) => peso(a) - peso(b) || a.vence.localeCompare(b.vence) || a.empleado.nombre.localeCompare(b.empleado.nombre));
}

/** Plazo de un registro en palabras, con el tono del chip. */
export function plazo(i: Pick<ItemRegistroDT, 'estado' | 'vence' | 'dias_habiles_restantes'>): { texto: string; tono: TonoChip } {
  if (i.estado === 'REGISTRADO') return { texto: 'Registrado', tono: 'ok' };
  if (i.estado === 'VENCIDO') return { texto: `Venció el ${fechaCL(i.vence)}`, tono: 'peligro' };
  const dias = i.dias_habiles_restantes ?? 0;
  if (dias <= 0) return { texto: 'Vence hoy', tono: 'aviso' };
  return {
    texto: dias === 1 ? `Queda 1 día hábil (${fechaCL(i.vence)})` : `Quedan ${dias} días hábiles (${fechaCL(i.vence)})`,
    tono: dias <= 3 ? 'aviso' : 'neutro',
  };
}

/** Guarda un JSON en Descargas (sin el permiso "downloads": un enlace con `download`). */
export function descargarJSON(nombre: string, datos: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Lo que se copia de un dato de la ficha: los montos van solo con dígitos
 * ("$1.000.000" → "1000000"), que es lo que aceptan los campos de Mi DT.
 */
export function textoParaCopiar(valor: string): string {
  return /^\$\s?[\d.]+$/.test(valor.trim()) ? valor.replace(/\D/g, '') : valor;
}

/** Copia al portapapeles; si el navegador no lo permite, con el método antiguo. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}
