import { etiquetaFor } from './levantar';
import type { Instruccion } from './mapeo';
import { normalizar } from './textos';

/**
 * Llena campos de Mi DT como lo haría una persona. Mi DT es una aplicación
 * React: si solo se cambia `value`, React no se entera. Por eso se escribe con
 * el método nativo del navegador y luego se avisan los eventos que dispara el
 * teclado (input, change y blur). Nunca presiona botones: "Siguiente" y
 * "Registrar" los presiona la persona.
 */
export type EstadoLlenado = 'ok' | 'no_encontrado' | 'sin_opcion' | 'error';
export interface ResultadoLlenado { clave: string; etiqueta: string; estado: EstadoLlenado; detalle?: string }

const VERDE = '3px solid #16a34a';
const AMARILLO = '3px solid #f59e0b';

function avisar(el: Element, ...eventos: string[]) {
  for (const e of eventos) el.dispatchEvent(new Event(e, { bubbles: true }));
}

function escribir(el: HTMLInputElement | HTMLTextAreaElement, valor: string) {
  const prototipo = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototipo, 'value')?.set;
  el.focus();
  if (setter) setter.call(el, valor);
  else el.value = valor;
  avisar(el, 'input', 'change');
  el.blur();
}

function elegir(select: HTMLSelectElement, valor: string): boolean {
  const buscado = normalizar(valor);
  const opciones = Array.from(select.options);
  const opcion = opciones.find((o) => normalizar(o.text) === buscado || normalizar(o.value) === buscado)
    ?? opciones.find((o) => buscado && normalizar(o.text).startsWith(buscado))
    ?? opciones.find((o) => buscado.length > 3 && normalizar(o.text).includes(buscado));
  if (!opcion) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  select.focus();
  if (setter) setter.call(select, opcion.value);
  else select.value = opcion.value;
  avisar(select, 'input', 'change');
  select.blur();
  return true;
}

function textoDeOpcion(doc: Document, input: HTMLInputElement): string {
  return etiquetaFor(doc, input.id)?.textContent ?? input.closest('label')?.textContent ?? input.value;
}

const SI = new Set(['si', 'sí', 'true', '1', 'yes']);

export function marcar(el: Element, color: 'verde' | 'amarillo') {
  const html = el as HTMLElement;
  html.style.outline = color === 'verde' ? VERDE : AMARILLO;
  html.style.outlineOffset = '2px';
  html.dataset.jornada40 = color;
}

export function llenarCampo(doc: Document, i: Instruccion): ResultadoLlenado {
  const base = { clave: i.clave, etiqueta: i.etiqueta };
  try {
    if (i.tipo === 'radio') {
      const opciones = Array.from(doc.querySelectorAll<HTMLInputElement>(i.selector)).filter((r) => r.type === 'radio');
      if (opciones.length === 0) return { ...base, estado: 'no_encontrado' };
      const buscado = normalizar(i.valor);
      const radio = opciones.find((r) => normalizar(textoDeOpcion(doc, r)) === buscado || normalizar(r.value) === buscado);
      if (!radio) return { ...base, estado: 'sin_opcion', detalle: i.valor };
      if (!radio.checked) radio.click();
      marcar(radio.closest('label') ?? radio, 'verde');
      return { ...base, estado: 'ok' };
    }
    const el = doc.querySelector(i.selector);
    if (!el) return { ...base, estado: 'no_encontrado' };
    if (i.tipo === 'casilla') {
      const casilla = el as HTMLInputElement;
      if (casilla.checked !== SI.has(normalizar(i.valor))) casilla.click();
    } else if (el instanceof HTMLSelectElement) {
      if (!elegir(el, i.valor)) {
        marcar(el, 'amarillo');
        return { ...base, estado: 'sin_opcion', detalle: i.valor };
      }
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      escribir(el, i.valor);
    } else {
      return { ...base, estado: 'no_encontrado' };
    }
    marcar(el, 'verde');
    return { ...base, estado: 'ok' };
  } catch (e) {
    return { ...base, estado: 'error', detalle: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Llena una etapa completa. Si falta en la pantalla algún campo del mapeo que
 * no sea opcional, no llena nada: Mi DT cambió y es mejor copiar a mano que
 * dejar un formulario a medias (principio "si algo no calza, no se llena").
 */
export function llenarEtapa(doc: Document, instrucciones: Instruccion[], pendientes: string[]):
  { resultados: ResultadoLlenado[]; pendientes: number; detenido: boolean } {
  const ausentes = instrucciones.filter((i) => !i.opcional && doc.querySelector(i.selector) === null);
  if (ausentes.length > 0) {
    return {
      resultados: ausentes.map((i) => ({ clave: i.clave, etiqueta: i.etiqueta, estado: 'no_encontrado' as const })),
      pendientes: 0,
      detenido: true,
    };
  }
  const presentes = instrucciones.filter((i) => doc.querySelector(i.selector) !== null);
  return {
    resultados: presentes.map((i) => llenarCampo(doc, i)),
    pendientes: resaltarPendientes(doc, pendientes),
    detenido: false,
  };
}

/** Marca en amarillo los campos que la persona debe completar (Jornada40 no tiene el dato). */
export function resaltarPendientes(doc: Document, selectores: string[]): number {
  let n = 0;
  for (const s of selectores) {
    for (const el of Array.from(doc.querySelectorAll(s))) {
      marcar(el, 'amarillo');
      n++;
    }
  }
  return n;
}

/**
 * Texto que la persona ve en la página: sin scripts, estilos ni elementos
 * ocultos (Mi DT puede tener el aviso de éxito escondido antes de mostrarlo).
 */
export function textoVisible(doc: Document): string {
  const body = doc.body;
  if (!body) return '';
  if (typeof body.innerText === 'string') return body.innerText;
  // jsdom (pruebas) no calcula el diseño ni tiene innerText: se saltan scripts y lo marcado oculto.
  const partes: string[] = [];
  const recorrido = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
    const padre = n.parentElement;
    if (padre && !padre.closest('script, style, noscript, template, [hidden], [style*="display: none"], [style*="display:none"]')) {
      partes.push(n.textContent ?? '');
    }
  }
  return partes.join(' ');
}

/** Si Mi DT muestra el mensaje de éxito, y el número de comprobante si se puede leer. */
export function leerExito(doc: Document, exito: { texto: string; comprobante?: string }): { registrado: boolean; comprobante: string } {
  const texto = textoVisible(doc);
  const registrado = normalizar(texto).includes(normalizar(exito.texto));
  let comprobante = '';
  if (registrado && exito.comprobante) {
    const m = new RegExp(exito.comprobante, 'i').exec(texto);
    comprobante = (m?.[1] ?? m?.[0] ?? '').trim().slice(0, 60);
  }
  return { registrado, comprobante };
}

/**
 * Lee lo que Mi DT puso en ciertos campos (solo los que el mapeo pide
 * verificar, como el nombre que trae del Registro Civil). Nada más se lee.
 */
export function leerCampos(doc: Document, selectores: string[]): Record<string, string | null> {
  const salida: Record<string, string | null> = {};
  for (const s of selectores.slice(0, 10)) {
    const el = doc.querySelector(s);
    if (!el) salida[s] = null;
    else if (el instanceof HTMLSelectElement) salida[s] = el.selectedOptions[0]?.text ?? '';
    else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) salida[s] = el.value;
    else salida[s] = el.textContent ?? '';
    if (salida[s]) salida[s] = (salida[s] as string).slice(0, 200);
  }
  return salida;
}
