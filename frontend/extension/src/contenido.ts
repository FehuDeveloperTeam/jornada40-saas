/**
 * Script que corre dentro de Mi DT (https://midt.dirtrab.cl). Solo responde lo
 * que pide el panel de la extensión: en qué pantalla está, la estructura de la
 * pantalla (levantamiento), llenar los campos de una etapa y si apareció el
 * mensaje de registro exitoso. No envía nada por su cuenta y nunca presiona
 * botones. De lo escrito en los campos solo lee lo que el mapeo pide verificar
 * (el nombre que Mi DT trae del Registro Civil), para compararlo con la ficha.
 */
import { encabezados, levantarPantalla } from './levantar';
import { leerCampos, leerExito, llenarEtapa } from './llenar';
import type { EstadoPagina, Mensaje } from './mensajes';
import { rutLimpio } from './textos';

const RUT = /\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]/;

function estado(empleador: { selector: string } | null): EstadoPagina {
  let rut: string | null = null;
  if (empleador?.selector) {
    const texto = document.querySelector(empleador.selector)?.textContent ?? '';
    const m = RUT.exec(texto);
    rut = m ? rutLimpio(m[0]) : null;
  }
  return { ruta: location.pathname, titulo: document.title, encabezados: encabezados(document), empleador: rut };
}

chrome.runtime.onMessage.addListener((mensaje: Mensaje, _remitente, responder) => {
  switch (mensaje.tipo) {
    case 'estado':
      responder(estado(mensaje.empleador));
      break;
    case 'levantar':
      responder(levantarPantalla(document, location.pathname));
      break;
    case 'llenar':
      responder(llenarEtapa(document, mensaje.instrucciones, mensaje.pendientes));
      break;
    case 'exito':
      responder(leerExito(document, mensaje.exito));
      break;
    case 'leer':
      responder(leerCampos(document, mensaje.selectores));
      break;
  }
  return false;
});
