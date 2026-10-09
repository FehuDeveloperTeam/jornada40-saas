import { describe, expect, it } from 'vitest';
import type { FichaDT } from '../../src/types';
import { diferencias, enLaPantalla, etapaActual, instrucciones, mismoNombre, pantallaPara, transformar } from './mapeo';
import type { EtapaMapeo, Mapeos } from './mapeo';

const ETAPA: EtapaMapeo = {
  titulo: 'Etapa 1: datos del trabajador',
  detectar: 'Datos del trabajador',
  campos: [
    { ficha: 'rut-del-trabajador', selector: '#rut', tipo: 'texto', formato: 'sin_puntos' },
    { ficha: 'fecha-de-inicio', selector: '#inicio', tipo: 'fecha' },
    { ficha: 'comuna', selector: '#comuna', tipo: 'seleccion' },
    { ficha: 'cambio-de-domicilio', selector: '#cambio', tipo: 'radio' },
    { ficha: 'telefono', selector: '#telefono', tipo: 'numero', opcional: true },
  ],
  verificar: [{ ficha: 'nombre', selector: '#nombre' }],
};

const MAPEOS: Mapeos = {
  version: 1,
  empleador: { selector: '#empleador' },
  pantallas: {
    CONTRATO: { ruta: '/empleador/registro-electronico-laboral/registroContratoTrabajo', etapas: [ETAPA] },
    ANEXO: { ruta: '/empleador/registro-electronico-laboral/anexo', etapas: [] },
  },
};

const FICHA: FichaDT = {
  clave: 'CONTRATO:7',
  tipo: 'CONTRATO',
  titulo: 'Contrato de Juan Pérez',
  ruta_mi_dt: 'Registro Electrónico Laboral → Registrar contrato',
  avisos: [],
  estado: 'PENDIENTE',
  vence: '2026-10-20',
  secciones: [{
    titulo: 'Etapa 1',
    campos: [
      { clave: 'rut-del-trabajador', etiqueta: 'RUT del trabajador', valor: '12.345.678-5', copiar: false, nota: '' },
      { clave: 'nombre', etiqueta: 'Nombre', valor: 'Juan Andrés Pérez Soto', copiar: false, nota: '' },
      { clave: 'fecha-de-inicio', etiqueta: 'Fecha de inicio', valor: '05-03-2026', copiar: false, nota: '' },
      { clave: 'comuna', etiqueta: 'Comuna', valor: 'Las Condes', copiar: false, nota: '' },
      { clave: 'telefono', etiqueta: 'Teléfono', valor: '+56 9 1234 5678', copiar: false, nota: '' },
    ],
  }],
};

describe('transformar', () => {
  it('pasa fechas chilenas al formato que pide el campo', () => {
    expect(transformar('05-03-2026', 'fecha')).toBe('2026-03-05');
    expect(transformar('5/3/2026', 'fecha')).toBe('2026-03-05');
    expect(transformar('05-03-2026', 'texto', 'dd/mm/aaaa')).toBe('05/03/2026');
    expect(transformar('2026-03-05', 'fecha')).toBe('2026-03-05');
  });

  it('limpia RUT y números', () => {
    expect(transformar('12.345.678-k', 'texto', 'sin_puntos')).toBe('12345678-K');
    expect(transformar('$ 1.250.000', 'numero')).toBe('1250000');
    expect(transformar('  Ordinaria ', 'seleccion')).toBe('Ordinaria');
  });
});

describe('pantallas y etapas', () => {
  it('el anexo Ley 40 horas usa el formulario de anexo', () => {
    expect(pantallaPara(MAPEOS, 'ANEXO40H')?.ruta).toBe('/empleador/registro-electronico-laboral/anexo');
    expect(pantallaPara(MAPEOS, 'TERMINO')).toBeNull();
    expect(pantallaPara(null, 'CONTRATO')).toBeNull();
  });

  it('reconoce la ruta del formulario aunque cambie una barra o mayúscula', () => {
    const contrato = MAPEOS.pantallas.CONTRATO!;
    expect(enLaPantalla(contrato, '/empleador/registro-electronico-laboral/registroContratoTrabajo/')).toBe(true);
    expect(enLaPantalla(contrato, '/Empleador/Registro-Electronico-Laboral/registrocontratotrabajo')).toBe(true);
    expect(enLaPantalla(contrato, '/empleador/registro-electronico-laboral/anexo')).toBe(false);
  });

  it('detecta la etapa por sus títulos, sin importar tildes ni mayúsculas', () => {
    const contrato = MAPEOS.pantallas.CONTRATO!;
    expect(etapaActual(contrato, ['Registro de contrato', 'DATOS DEL TRABAJADOR'])).toBe(ETAPA);
    expect(etapaActual(contrato, ['Datos del empleador'])).toBeNull();
  });
});

describe('instrucciones', () => {
  it('llena lo que la ficha trae y deja aparte lo que la persona debe completar', () => {
    const { llenar, faltan } = instrucciones(ETAPA, FICHA);
    expect(llenar.map((i) => [i.selector, i.valor])).toEqual([
      ['#rut', '12345678-5'],
      ['#inicio', '2026-03-05'],
      ['#comuna', 'Las Condes'],
      ['#telefono', '56912345678'],
    ]);
    expect(llenar.find((i) => i.selector === '#telefono')?.opcional).toBe(true);
    expect(faltan.map((i) => i.selector)).toEqual(['#cambio']);
  });
});

describe('verificar el nombre que trae Mi DT', () => {
  it('acepta otro orden y un solo apellido', () => {
    expect(mismoNombre('PÉREZ SOTO, JUAN ANDRÉS', 'Juan Andrés Pérez Soto')).toBe(true);
    expect(mismoNombre('Juan Pérez', 'Juan Andrés Pérez Soto')).toBe(true);
    expect(mismoNombre('María González', 'Juan Andrés Pérez Soto')).toBe(false);
  });

  it('avisa solo cuando hay dato en ambos lados y no calza', () => {
    expect(diferencias(ETAPA, FICHA, { '#nombre': 'PEREZ SOTO JUAN ANDRES' })).toEqual([]);
    expect(diferencias(ETAPA, FICHA, { '#nombre': '' })).toEqual([]);
    expect(diferencias(ETAPA, FICHA, { '#nombre': 'MARÍA GONZÁLEZ' })).toEqual([
      { etiqueta: 'Nombre', ficha: 'Juan Andrés Pérez Soto', midt: 'MARÍA GONZÁLEZ' },
    ]);
  });
});
