import { enmascarar } from './textos';

/**
 * Modo levantamiento: describe la estructura de la pantalla de Mi DT (qué
 * campos hay, cómo se llaman y qué opciones ofrecen) para armar los mapeos.
 *
 * Nunca lee lo escrito en un campo: de los <input> y <textarea> solo toma su
 * tipo, id, name y etiqueta. De los <select> toma sus opciones (son catálogos:
 * comunas, tipos de contrato…), y todos los textos pasan por `enmascarar`, que
 * quita RUT y correos.
 */
export interface OpcionLevantada { codigo: string; texto: string }
export interface CampoLevantado {
  orden: number;
  control: 'input' | 'select' | 'textarea';
  tipo: string;
  id: string;
  name: string;
  etiqueta: string;
  requerido: boolean;
  deshabilitado: boolean;
  visible: boolean;
  opciones?: OpcionLevantada[];
}
export interface PantallaLevantada {
  ruta: string;
  titulo: string;
  encabezados: string[];
  campos: CampoLevantado[];
  botones: string[];
  /**
   * Dónde aparece un RUT en la pantalla (selector y texto con el RUT tapado):
   * así se sabe dónde muestra Mi DT el RUT del empleador con que se entró.
   */
  rut_en_pantalla: { selector: string; texto: string }[];
}

const TIPOS_SIN_DATO = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file', 'password']);

/** Texto visible de los títulos de la pantalla (también sirve para saber en qué etapa está). */
export function encabezados(doc: Document): string[] {
  const nodos = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, legend, .card-title, .modal-title, [class*="titulo"], [class*="title"]');
  const vistos = new Set<string>();
  for (const n of Array.from(nodos)) {
    const t = enmascarar(n.textContent);
    if (t && t.length <= 160) vistos.add(t);
  }
  return Array.from(vistos).slice(0, 60);
}

/** El elemento que dice `for="<id>"`: Mi DT usa <label for> y también <div class="label-form" for="…">. */
export function etiquetaFor(doc: Document, id: string | null | undefined): Element | null {
  if (!id) return null;
  return Array.from(doc.querySelectorAll('[for]')).find((e) => e.getAttribute('for') === id) ?? null;
}

function etiquetaDe(doc: Document, el: Element): string {
  const porFor = etiquetaFor(doc, el.getAttribute('id'));
  const candidatos = [
    porFor?.textContent,
    el.closest('label')?.textContent,
    el.getAttribute('aria-label'),
    el.getAttribute('aria-labelledby') ? doc.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent : null,
    el.getAttribute('placeholder'),
    el.getAttribute('title'),
    el.closest('.form-group, .mb-3, .col, [class*="col-"]')?.querySelector('label, .label-form')?.textContent,
  ];
  return enmascarar(candidatos.find((c) => c && c.trim()) ?? '');
}

const NOMBRE_CSS = /^[A-Za-z][\w-]*$/;

/** Selector CSS corto para ubicar un elemento: su id si lo tiene; si no, etiqueta, clases y posición. */
export function selectorDe(el: Element): string {
  const partes: string[] = [];
  let actual: Element | null = el;
  while (actual && actual.tagName !== 'BODY' && actual.tagName !== 'HTML' && partes.length < 6) {
    const nodo: Element = actual;
    const id = nodo.getAttribute('id');
    if (id && NOMBRE_CSS.test(id)) {
      partes.unshift(`#${id}`);
      break;
    }
    let parte = nodo.tagName.toLowerCase();
    const clases = Array.from(nodo.classList).filter((c) => NOMBRE_CSS.test(c)).slice(0, 2);
    if (clases.length) parte += `.${clases.join('.')}`;
    const hermanos = nodo.parentElement ? Array.from(nodo.parentElement.children).filter((h) => h.tagName === nodo.tagName) : [];
    if (hermanos.length > 1) parte += `:nth-of-type(${hermanos.indexOf(nodo) + 1})`;
    partes.unshift(parte);
    actual = nodo.parentElement;
  }
  return partes.join(' > ');
}

const HAY_RUT = /\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]/;

function rutEnPantalla(doc: Document): { selector: string; texto: string }[] {
  const salida: { selector: string; texto: string }[] = [];
  if (!doc.body) return salida;
  const vistos = new Set<Element>();
  const recorrido = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let n = recorrido.nextNode(); n && salida.length < 20; n = recorrido.nextNode()) {
    const el = n.parentElement;
    if (!el || vistos.has(el) || el.closest('script, style, select, option, textarea')) continue;
    if (HAY_RUT.test(n.textContent ?? '')) {
      vistos.add(el);
      salida.push({ selector: selectorDe(el), texto: enmascarar(el.textContent) });
    }
  }
  return salida;
}

function visible(el: Element): boolean {
  const html = el as HTMLElement;
  if (html.hidden || html.closest('[hidden]')) return false;
  // En las pruebas (jsdom) no hay diseño ni cajas: se informa como visible.
  return html.getClientRects().length > 0 || navigator.userAgent.includes('jsdom');
}

export function levantarPantalla(doc: Document, ruta: string): PantallaLevantada {
  const campos: CampoLevantado[] = [];
  const controles = doc.querySelectorAll('input, select, textarea');
  Array.from(controles).forEach((el, orden) => {
    const control = el.tagName.toLowerCase() as CampoLevantado['control'];
    const tipo = control === 'input' ? ((el as HTMLInputElement).type || 'text').toLowerCase() : control;
    if (TIPOS_SIN_DATO.has(tipo)) return;
    const etiqueta = etiquetaDe(doc, el);
    const campo: CampoLevantado = {
      orden, control, tipo,
      id: el.getAttribute('id') ?? '',
      name: el.getAttribute('name') ?? '',
      etiqueta,
      // Mi DT marca los obligatorios con "(*)" o "*" en la etiqueta.
      requerido: (el as HTMLInputElement).required || /\*/.test(etiqueta),
      deshabilitado: (el as HTMLInputElement).disabled,
      visible: visible(el),
    };
    if (control === 'select') {
      campo.opciones = Array.from((el as HTMLSelectElement).options).slice(0, 500)
        .map((o) => ({ codigo: enmascarar(o.value), texto: enmascarar(o.text) }));
    }
    if (tipo === 'radio' || tipo === 'checkbox') {
      // El valor de un radio o casilla es una constante del formulario, no algo escrito.
      campo.opciones = [{ codigo: enmascarar((el as HTMLInputElement).value), texto: campo.etiqueta }];
    }
    campos.push(campo);
  });
  const botones = Array.from(doc.querySelectorAll('button, a.btn, input[type="submit"], input[type="button"]'))
    .map((b) => enmascarar(b.textContent || (b as HTMLInputElement).value))
    .filter(Boolean);
  return {
    ruta,
    titulo: enmascarar(doc.title),
    encabezados: encabezados(doc),
    campos,
    botones: Array.from(new Set(botones)).slice(0, 80),
    rut_en_pantalla: rutEnPantalla(doc),
  };
}
