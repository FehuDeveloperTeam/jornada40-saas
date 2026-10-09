import { useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { leerCampos, leerExito, llenarEtapa } from './llenar';
import type { Instruccion } from './mapeo';

afterEach(cleanup);

/** Formulario controlado por React, como los de Mi DT: si solo se cambia `value`, React no se entera. */
function Formulario() {
  const [rut, setRut] = useState('');
  const [comuna, setComuna] = useState('');
  const [jornada, setJornada] = useState('');
  const [inicio, setInicio] = useState('');
  const [teletrabajo, setTeletrabajo] = useState(false);
  const [funciones, setFunciones] = useState('');
  return (
    <form>
      <h2>Datos del trabajador</h2>
      <label htmlFor="rut">RUT (*)</label>
      <input id="rut" name="rut" value={rut} onChange={(e) => setRut(e.target.value)} />
      <label htmlFor="comuna">Comuna</label>
      <select id="comuna" value={comuna} onChange={(e) => setComuna(e.target.value)}>
        <option value="">Seleccione</option>
        <option value="13101">Santiago</option>
        <option value="13114">Las Condes</option>
      </select>
      <label><input type="radio" name="jornada" value="1" checked={jornada === '1'} onChange={() => setJornada('1')} /> Ordinaria</label>
      <label><input type="radio" name="jornada" value="2" checked={jornada === '2'} onChange={() => setJornada('2')} /> Parcial</label>
      <input id="inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
      <input id="teletrabajo" type="checkbox" checked={teletrabajo} onChange={(e) => setTeletrabajo(e.target.checked)} />
      <textarea id="funciones" value={funciones} onChange={(e) => setFunciones(e.target.value)} />
      <input id="cambio" placeholder="¿Cambio de domicilio?" />
      <output data-testid="estado">{JSON.stringify({ rut, comuna, jornada, inicio, teletrabajo, funciones })}</output>
    </form>
  );
}

const estado = () => JSON.parse(screen.getByTestId('estado').textContent ?? '{}') as Record<string, unknown>;

const i = (selector: string, tipo: Instruccion['tipo'], valor: string, extra: Partial<Instruccion> = {}): Instruccion =>
  ({ clave: selector, etiqueta: selector, selector, tipo, valor, ...extra });

describe('llenarEtapa', () => {
  it('escribe como una persona: React recibe cada valor', () => {
    render(<Formulario />);
    let r: ReturnType<typeof llenarEtapa> | undefined;
    act(() => {
      r = llenarEtapa(document, [
        i('#rut', 'texto', '12345678-5'),
        i('#comuna', 'seleccion', 'las condes'),
        i('input[name="jornada"]', 'radio', 'Parcial'),
        i('#inicio', 'fecha', '2026-03-05'),
        i('#teletrabajo', 'casilla', 'Sí'),
        i('#funciones', 'texto_largo', 'Atención de público\ny caja'),
      ], ['#cambio']);
    });
    expect(estado()).toEqual({
      rut: '12345678-5', comuna: '13114', jornada: '2', inicio: '2026-03-05', teletrabajo: true, funciones: 'Atención de público\ny caja',
    });
    expect(r?.detenido).toBe(false);
    expect(r?.resultados.every((x) => x.estado === 'ok')).toBe(true);
    expect(r?.pendientes).toBe(1);
    expect((document.getElementById('rut') as HTMLElement).dataset.jornada40).toBe('verde');
    expect((document.getElementById('cambio') as HTMLElement).dataset.jornada40).toBe('amarillo');
  });

  it('si falta un campo del mapeo, no llena nada (Mi DT cambió)', () => {
    render(<Formulario />);
    let r: ReturnType<typeof llenarEtapa> | undefined;
    act(() => {
      r = llenarEtapa(document, [i('#rut', 'texto', '12345678-5'), i('#no-existe', 'texto', 'x')], []);
    });
    expect(r?.detenido).toBe(true);
    expect(r?.resultados).toEqual([{ clave: '#no-existe', etiqueta: '#no-existe', estado: 'no_encontrado' }]);
    expect(estado().rut).toBe('');
  });

  it('un campo opcional ausente no detiene el resto', () => {
    render(<Formulario />);
    let r: ReturnType<typeof llenarEtapa> | undefined;
    act(() => {
      r = llenarEtapa(document, [i('#rut', 'texto', '12345678-5'), i('#telefono', 'numero', '56912345678', { opcional: true })], []);
    });
    expect(r?.detenido).toBe(false);
    expect(estado().rut).toBe('12345678-5');
  });

  it('una opción que no existe en la lista queda en amarillo, sin elegir otra', () => {
    render(<Formulario />);
    let r: ReturnType<typeof llenarEtapa> | undefined;
    act(() => {
      r = llenarEtapa(document, [i('#comuna', 'seleccion', 'Valparaíso')], []);
    });
    expect(r?.resultados[0]).toMatchObject({ estado: 'sin_opcion', detalle: 'Valparaíso' });
    expect(estado().comuna).toBe('');
    expect((document.getElementById('comuna') as HTMLElement).dataset.jornada40).toBe('amarillo');
  });
});

describe('leerCampos y leerExito', () => {
  it('lee solo los campos pedidos (el nombre que trae Mi DT)', () => {
    document.body.innerHTML = `<input id="nombre" value="PEREZ SOTO JUAN"><select id="s"><option>Uno</option><option selected>Dos</option></select>`;
    expect(leerCampos(document, ['#nombre', '#s', '#nada'])).toEqual({ '#nombre': 'PEREZ SOTO JUAN', '#s': 'Dos', '#nada': null });
  });

  it('reconoce el mensaje de éxito y el número de comprobante', () => {
    document.body.innerHTML = '<div class="alert">Contrato registrado exitosamente. Folio N° 123456.</div>';
    expect(leerExito(document, { texto: 'registrado exitosamente', comprobante: 'Folio N° (\\d+)' })).toEqual({ registrado: true, comprobante: '123456' });
    expect(leerExito(document, { texto: 'anexo registrado' })).toEqual({ registrado: false, comprobante: '' });
  });

  it('no cuenta el texto de scripts ni de avisos ocultos', () => {
    document.body.innerHTML = `<script>const aviso = "Contrato registrado exitosamente";</script>
      <div class="modal" style="display: none">Contrato registrado exitosamente</div><p>Formulario</p>`;
    expect(leerExito(document, { texto: 'registrado exitosamente' }).registrado).toBe(false);
  });
});
