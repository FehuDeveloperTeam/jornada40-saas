import { afterEach, describe, expect, it } from 'vitest';
import { encabezados, levantarPantalla, selectorDe } from './levantar';

afterEach(() => {
  document.body.innerHTML = '';
  document.title = '';
});

function montarFormulario() {
  document.title = 'Mi DT';
  document.body.innerHTML = `
    <header><span class="empleador-rut">Empleador: 76.123.456-7</span></header>
    <h2 class="card-title">Datos del trabajador</h2>
    <div class="form-group">
      <div class="label-form" for="rut">RUT del trabajador (*)</div>
      <input id="rut" name="rut" type="text">
    </div>
    <label for="correo">Correo electrónico</label>
    <input id="correo" name="correoElectronico" type="email">
    <label>Observaciones <textarea name="obs"></textarea></label>
    <label for="comuna">Comuna *</label>
    <select id="comuna" name="comuna">
      <option value="">Seleccione</option>
      <option value="13101">Santiago</option>
      <option value="13114">Las Condes</option>
    </select>
    <label><input type="radio" name="cambio" value="S"> Sí</label>
    <label><input type="radio" name="cambio" value="N"> No</label>
    <input type="hidden" name="csrf" value="token-secreto">
    <input type="password" name="clave">
    <button type="button">Siguiente</button>
  `;
  // Lo que la persona ya escribió: nunca debe salir en el levantamiento.
  (document.getElementById('rut') as HTMLInputElement).value = '12.345.678-5';
  (document.getElementById('correo') as HTMLInputElement).value = 'juan.perez@gmail.com';
  (document.querySelector('textarea') as HTMLTextAreaElement).value = 'Texto privado del trabajador';
}

describe('levantarPantalla', () => {
  it('registra la estructura: etiquetas, tipos, obligatorios y opciones', () => {
    montarFormulario();
    const p = levantarPantalla(document, '/empleador/registro-electronico-laboral/registroContratoTrabajo');
    expect(p.ruta).toBe('/empleador/registro-electronico-laboral/registroContratoTrabajo');
    expect(p.encabezados).toContain('Datos del trabajador');
    expect(p.campos.map((c) => [c.name, c.tipo, c.etiqueta, c.requerido])).toEqual([
      ['rut', 'text', 'RUT del trabajador (*)', true],
      ['correoElectronico', 'email', 'Correo electrónico', false],
      ['obs', 'textarea', 'Observaciones', false],
      ['comuna', 'select', 'Comuna *', true],
      ['cambio', 'radio', 'Sí', false],
      ['cambio', 'radio', 'No', false],
    ]);
    expect(p.campos.find((c) => c.name === 'comuna')?.opciones).toEqual([
      { codigo: '', texto: 'Seleccione' }, { codigo: '13101', texto: 'Santiago' }, { codigo: '13114', texto: 'Las Condes' },
    ]);
    expect(p.botones).toEqual(['Siguiente']);
  });

  it('nunca incluye lo escrito, campos ocultos ni contraseñas, y tapa los RUT de la pantalla', () => {
    montarFormulario();
    const texto = JSON.stringify(levantarPantalla(document, '/x'));
    for (const privado of ['12.345.678-5', 'juan.perez@gmail.com', 'Texto privado', 'token-secreto', '76.123.456-7']) {
      expect(texto).not.toContain(privado);
    }
    expect(texto).not.toContain('"clave"');
  });

  it('anota dónde aparece un RUT (para leer el del empleador), con el RUT tapado', () => {
    montarFormulario();
    const p = levantarPantalla(document, '/x');
    expect(p.rut_en_pantalla).toEqual([{ selector: 'header > span.empleador-rut', texto: 'Empleador: [rut]' }]);
    expect(document.querySelector(p.rut_en_pantalla[0].selector)?.textContent).toContain('76.123.456-7');
  });
});

describe('selectorDe', () => {
  it('usa el id si lo hay y si no la posición entre hermanos', () => {
    document.body.innerHTML = '<div id="cabecera"><ul><li>a</li><li class="activo x">b</li></ul></div>';
    const li = document.querySelectorAll('li')[1];
    expect(selectorDe(li)).toBe('#cabecera > ul > li.activo.x:nth-of-type(2)');
    expect(document.querySelector(selectorDe(li))).toBe(li);
  });
});

describe('encabezados', () => {
  it('no repite títulos y tapa datos personales', () => {
    document.body.innerHTML = '<h1>Registro</h1><h2>Registro</h2><h3>Trabajador 12.345.678-5</h3>';
    expect(encabezados(document)).toEqual(['Registro', 'Trabajador [rut]']);
  });
});
