import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Download, Send } from 'lucide-react';
import { Button } from '../../../src/components/j40/Button';
import { VERSION } from '../configuracion';
import type { RespuestaLevantar } from '../mensajes';
import { anotarLevantada, leerLevantadas } from './almacen';
import type { Levantada } from './almacen';
import { mensajeDe, pedir } from './api';
import { Aviso, Tarjeta } from './comun';
import { abrirEnMiDT, preguntar } from './pestana';
import type { MiDT } from './useMiDT';
import { descargarJSON } from './util';

/** Pantallas de Mi DT que se necesitan para los mapeos (rutas vistas en el código público de Mi DT). */
const PANTALLAS: { nombre: string; ruta: string; capturas: number }[] = [
  { nombre: 'Registrar contrato (sus 4 etapas)', ruta: '/empleador/registro-electronico-laboral/registroContratoTrabajo', capturas: 4 },
  { nombre: 'Anexo de contrato', ruta: '/empleador/registro-electronico-laboral/anexo', capturas: 1 },
  { nombre: 'Término de contrato', ruta: '/empleador/registro-electronico-laboral-termino/registroTerminoTabla', capturas: 1 },
  { nombre: 'Libro de Remuneraciones (LRE)', ruta: '/empleador/lre', capturas: 1 },
  { nombre: 'Teletrabajo', ruta: '/empleador/teletrabajo/ingreso', capturas: 1 },
  { nombre: 'Finiquito', ruta: '/empleador/finiquitos/IngresoIndividualPasos', capturas: 1 },
  { nombre: 'Registro masivo de contratos', ruta: '/empleador/registroContratoMasivo', capturas: 1 },
];

const deLaPantalla = (l: Levantada, ruta: string) => l.ruta.toLowerCase().startsWith(ruta.toLowerCase());

/**
 * Modo levantamiento (Fase 0 del plan): registra la estructura de una pantalla
 * de Mi DT —nombres de campos, tipos y opciones, nunca lo escrito— para armar
 * los mapeos del llenado automático. Se envía a Jornada40 o se guarda como archivo.
 */
export function Levantamiento({ midt, onVolver }: { midt: MiDT; onVolver: () => void }) {
  const [levantadas, setLevantadas] = useState<Levantada[]>([]);
  const [captura, setCaptura] = useState<RespuestaLevantar | null>(null);
  const [estado, setEstado] = useState<'listo' | 'capturando' | 'enviando' | 'enviada'>('listo');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    void leerLevantadas().then((l) => { if (vigente) setLevantadas(l); });
    return () => { vigente = false; };
  }, []);

  const capturar = async () => {
    if (!midt.pestana) return;
    setEstado('capturando');
    setError(null);
    const r = await preguntar<RespuestaLevantar>(midt.pestana, { tipo: 'levantar' });
    setEstado('listo');
    if (!r) setError('Mi DT no respondió. Recarga la página de Mi DT (tecla F5) e intenta de nuevo.');
    setCaptura(r);
  };

  const enviar = async () => {
    if (!captura) return;
    setEstado('enviando');
    setError(null);
    try {
      await pedir('/extension/v1/levantamiento/', {
        metodo: 'POST', cuerpo: { ruta: captura.ruta, titulo: captura.titulo, version: VERSION, estructura: captura },
      });
      setLevantadas(await anotarLevantada({ ruta: captura.ruta, etapa: captura.encabezados[0] ?? '', enviada_en: new Date().toISOString() }));
      setEstado('enviada');
    } catch (err) {
      setError(mensajeDe(err, 'No pudimos enviarla. Guarda el archivo y envíalo por correo.'));
      setEstado('listo');
    }
  };

  const guardar = () => {
    if (!captura) return;
    const nombre = captura.ruta.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'inicio';
    descargarJSON(`midt-${nombre}-${Date.now()}.json`, { version_extension: VERSION, pantalla: captura });
  };

  const enMiDT = Boolean(midt.pestana?.enMiDT && !midt.sinScript);
  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <Button variante="fantasma" onClick={onVolver} iconoInicio={<ArrowLeft className="size-4" strokeWidth={2} />}>Volver</Button>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-[18px] font-semibold">Modo levantamiento</h2>
        <p className="text-[14px] text-fg-2">
          Registra cómo es cada formulario de Mi DT para que Jornada40 aprenda a llenarlo. Se guarda solo la
          estructura: nombres de los campos, su tipo y las opciones de las listas. <b>Nunca lo que está escrito</b>,
          y los RUT y correos que aparezcan se tapan.
        </p>
      </div>
      <Aviso tono="aviso" titulo="No presiones «Registrar» ni «Enviar» en Mi DT por esto">
        Para ver la etapa siguiente de un formulario, Mi DT puede pedir que completes la anterior. Lo ideal es usar un
        contrato real que tengas pendiente (copia sus datos desde la lista) y registrarlo al final solo si todo está bien.
      </Aviso>

      <Tarjeta titulo="1. Abre la pantalla en Mi DT">
        <ul className="flex flex-col gap-2">
          {PANTALLAS.map((p) => {
            const n = levantadas.filter((l) => deLaPantalla(l, p.ruta)).length;
            const completa = n >= p.capturas;
            return (
              <li key={p.ruta} className="flex items-center gap-2.5">
                <span className={completa ? 'grid place-items-center size-6 rounded-full bg-ok-soft text-ok shrink-0' : 'grid place-items-center size-6 rounded-full bg-sunken text-fg-3 text-[12px] shrink-0'}>
                  {completa ? <Check className="size-4" strokeWidth={2.5} aria-label="Lista" /> : n}
                </span>
                <span className="flex-1 min-w-0 text-[14px]">
                  {p.nombre}
                  {p.capturas > 1 && <span className="text-fg-3"> · {n} de {p.capturas}</span>}
                </span>
                <Button tamano="sm" variante="secundario" onClick={() => void abrirEnMiDT(p.ruta, midt.pestana)}>Abrir</Button>
              </li>
            );
          })}
        </ul>
        <p className="text-[12.5px] text-fg-3">
          Si «Abrir» no te lleva al formulario, llega a él con el menú de Mi DT: también nos sirve saberlo.
        </p>
      </Tarjeta>

      <Tarjeta titulo="2. Regístrala">
        {!enMiDT ? (
          <p className="text-[14px] text-fg-2">
            {midt.sinScript ? 'Recarga la página de Mi DT (tecla F5) para que la extensión pueda verla.' : 'Abre Mi DT en esta ventana para registrar una pantalla.'}
          </p>
        ) : (
          <Button tamano="lg" bloque cargando={estado === 'capturando'} onClick={() => void capturar()}>
            Registrar esta pantalla
          </Button>
        )}
        {error && <Aviso tono="peligro">{error}</Aviso>}
        {captura && (
          <div className="flex flex-col gap-2.5">
            <dl className="text-[13.5px] flex flex-col gap-1">
              <div><dt className="inline text-fg-3">Pantalla: </dt><dd className="inline break-all">{captura.ruta}</dd></div>
              {captura.encabezados.length > 0 && (
                <div><dt className="inline text-fg-3">Títulos: </dt><dd className="inline">{captura.encabezados.slice(0, 4).join(' · ')}</dd></div>
              )}
              <div><dt className="inline text-fg-3">Campos: </dt><dd className="inline">{captura.campos.length}</dd></div>
            </dl>
            {captura.campos.length > 0 && (
              <details className="text-[13px]">
                <summary className="cursor-pointer text-brand-text">Ver qué se registró</summary>
                <ul className="mt-1.5 flex flex-col gap-0.5 text-fg-2">
                  {captura.campos.map((c) => (
                    <li key={`${c.orden}-${c.id}-${c.name}`}>
                      {c.etiqueta || c.name || c.id || '(sin nombre)'} <span className="text-fg-3">· {c.tipo}{c.opciones && c.control === 'select' ? ` · ${c.opciones.length} opciones` : ''}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {estado === 'enviada' ? (
              <Aviso tono="ok" titulo="Enviada a Jornada40">Sigue con la etapa o pantalla siguiente.</Aviso>
            ) : (
              <div className="flex flex-col gap-2">
                <Button tamano="lg" bloque cargando={estado === 'enviando'} onClick={() => void enviar()}
                  iconoInicio={<Send className="size-4" strokeWidth={2} />}>Enviar a Jornada40</Button>
                <Button variante="secundario" bloque onClick={guardar} iconoInicio={<Download className="size-4" strokeWidth={2} />}>
                  Guardar archivo
                </Button>
              </div>
            )}
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
