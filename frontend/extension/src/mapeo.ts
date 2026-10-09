import type { FichaDT, TipoFichaDT } from '../../src/types';
import { normalizar } from './textos';

/**
 * Mapeos de Mi DT (core/datos/mapeos_midt.json, servidos por la API): qué dato
 * de la ficha va en qué campo de cada etapa. Son datos, no código, así un
 * cambio de Mi DT se corrige sin publicar otra versión de la extensión.
 */
export type TipoCampo = 'texto' | 'numero' | 'fecha' | 'seleccion' | 'radio' | 'casilla' | 'texto_largo';
export type Formato = 'sin_puntos' | 'solo_digitos' | 'aaaa-mm-dd' | 'dd-mm-aaaa' | 'dd/mm/aaaa';

export interface CampoMapeo {
  /** `clave` del campo en la ficha de Jornada40 (p. ej. "rut-del-trabajador"). */
  ficha: string;
  /** Selector CSS del campo en Mi DT (para un radio, el del grupo: `input[name="…"]`). */
  selector: string;
  tipo: TipoCampo;
  formato?: Formato;
  /** Campo que Mi DT muestra solo a veces (según otra respuesta): si no está, no detiene el llenado. */
  opcional?: boolean;
}
export interface EtapaMapeo {
  titulo: string;
  /** Texto de un título de la pantalla que identifica la etapa. */
  detectar: string;
  campos: CampoMapeo[];
  /**
   * Datos que Mi DT trae por su cuenta (p. ej. el nombre desde el Registro
   * Civil al escribir el RUT) y que se comparan con la ficha antes de seguir.
   */
  verificar?: { ficha: string; selector: string }[];
}
export interface PantallaMapeo {
  /** Ruta del formulario dentro de Mi DT ("Abrir formulario"). */
  ruta: string;
  etapas: EtapaMapeo[];
  /** Mensaje de Mi DT tras registrar y, si lo hay, cómo leer el número del comprobante. */
  exito?: { texto: string; comprobante?: string };
}
export interface Mapeos {
  version: number;
  /** Dónde muestra Mi DT el RUT del empleador con que se ingresó. */
  empleador: { selector: string } | null;
  pantallas: Partial<Record<string, PantallaMapeo>>;
}

export interface Instruccion {
  clave: string;
  etiqueta: string;
  selector: string;
  tipo: TipoCampo;
  valor: string;
  opcional?: boolean;
}

/** El anexo Ley 40 horas se registra en el mismo formulario que cualquier anexo. */
export function pantallaPara(mapeos: Mapeos | null | undefined, tipo: TipoFichaDT): PantallaMapeo | null {
  if (!mapeos) return null;
  const clave = tipo === 'ANEXO40H' ? 'ANEXO' : tipo;
  return mapeos.pantallas[clave] ?? null;
}

const sinBarraFinal = (ruta: string) => ruta.replace(/\/+$/, '').toLowerCase();

/** Si la pestaña está en el formulario de esa pantalla. */
export function enLaPantalla(pantalla: PantallaMapeo, ruta: string): boolean {
  return Boolean(pantalla.ruta) && sinBarraFinal(ruta).startsWith(sinBarraFinal(pantalla.ruta));
}

/** Etapa en que está la pantalla, según sus títulos visibles. */
export function etapaActual(pantalla: PantallaMapeo, encabezados: string[]): EtapaMapeo | null {
  const textos = encabezados.map(normalizar);
  return pantalla.etapas.find((e) => textos.some((t) => t.includes(normalizar(e.detectar)))) ?? null;
}

const FECHA_CHILENA = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;

/** Ajusta el valor de la ficha a lo que espera el campo de Mi DT. */
export function transformar(valor: string, tipo: TipoCampo, formato?: Formato): string {
  const v = valor.trim();
  if (formato === 'sin_puntos') return v.replace(/\./g, '').toUpperCase();
  if (formato === 'solo_digitos' || tipo === 'numero') return v.replace(/[^\d]/g, '');
  if (tipo === 'fecha' || formato) {
    const m = FECHA_CHILENA.exec(v);
    if (m) {
      const [d, mes, a] = [m[1].padStart(2, '0'), m[2].padStart(2, '0'), m[3]];
      if (formato === 'dd-mm-aaaa') return `${d}-${mes}-${a}`;
      if (formato === 'dd/mm/aaaa') return `${d}/${mes}/${a}`;
      return `${a}-${mes}-${d}`;            // <input type="date"> y "aaaa-mm-dd"
    }
  }
  return v;
}

/**
 * Instrucciones para llenar una etapa: un campo por cada dato que la ficha trae.
 * `faltan` son los campos que la etapa pide y Jornada40 no tiene (los completa la persona).
 */
export function instrucciones(etapa: EtapaMapeo, ficha: FichaDT): { llenar: Instruccion[]; faltan: Instruccion[] } {
  const campos = new Map(ficha.secciones.flatMap((s) => s.campos).map((c) => [c.clave, c]));
  const llenar: Instruccion[] = [];
  const faltan: Instruccion[] = [];
  for (const m of etapa.campos) {
    const dato = campos.get(m.ficha);
    const instruccion: Instruccion = {
      clave: m.ficha, etiqueta: dato?.etiqueta ?? m.ficha, selector: m.selector, tipo: m.tipo,
      valor: dato ? transformar(dato.valor, m.tipo, m.formato) : '',
      ...(m.opcional ? { opcional: true } : {}),
    };
    (instruccion.valor ? llenar : faltan).push(instruccion);
  }
  return { llenar, faltan };
}

/**
 * Compara el nombre que trae Mi DT con el de la ficha sin exigir el mismo
 * orden ni los dos apellidos: basta que todas las palabras del más corto estén
 * en el otro ("PÉREZ SOTO, JUAN ANDRÉS" calza con "Juan Pérez").
 */
export function mismoNombre(a: string, b: string): boolean {
  const palabras = (t: string) => normalizar(t).replace(/[^a-zñ ]/g, ' ').split(' ').filter((w) => w.length > 1);
  const [x, y] = [palabras(a), palabras(b)];
  if (x.length === 0 || y.length === 0) return true;   // sin dato que comparar
  const [corto, largo] = x.length <= y.length ? [x, new Set(y)] : [y, new Set(x)];
  return corto.every((w) => largo.has(w));
}

/** Diferencias entre lo que Mi DT trajo y la ficha (solo los datos con valor en ambos lados). */
export function diferencias(etapa: EtapaMapeo, ficha: FichaDT, leidos: Record<string, string | null>): { etiqueta: string; ficha: string; midt: string }[] {
  const campos = new Map(ficha.secciones.flatMap((s) => s.campos).map((c) => [c.clave, c]));
  const salida: { etiqueta: string; ficha: string; midt: string }[] = [];
  for (const v of etapa.verificar ?? []) {
    const dato = campos.get(v.ficha);
    const midt = (leidos[v.selector] ?? '').trim();
    if (dato?.valor && midt && !mismoNombre(dato.valor, midt)) salida.push({ etiqueta: dato.etiqueta, ficha: dato.valor, midt });
  }
  return salida;
}
