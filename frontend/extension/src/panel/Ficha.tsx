import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleCheck, ExternalLink, Wand2 } from 'lucide-react';
import { Button } from '../../../src/components/j40/Button';
import { Chip } from '../../../src/components/j40/Chip';
import { Field, Input } from '../../../src/components/j40/Field';
import type { FichaDT } from '../../../src/types';
import { fechaCL, hoyISO } from '../../../src/utils/formato';
import { formatRut } from '../../../src/utils/rutUtils';
import { diferencias, enLaPantalla, etapaActual, instrucciones, pantallaPara } from '../mapeo';
import type { Instruccion, Mapeos } from '../mapeo';
import type { RespuestaExito, RespuestaLeer, RespuestaLlenado } from '../mensajes';
import { mensajeDe, pedir } from './api';
import { Aviso, BotonCopiar, Cargando, Casilla, Tarjeta } from './comun';
import { abrirEnMiDT, preguntar } from './pestana';
import type { EmpresaExtension, VerificacionEmpresa } from './tipos';
import type { MiDT } from './useMiDT';

interface Props {
  empresa: EmpresaExtension;
  clave: string;
  mapeos: Mapeos | null;
  midt: MiDT;
  verificacion: VerificacionEmpresa;
  onVolver: () => void;
  onMarcado: (texto: string) => void;
}

/**
 * Ficha de un registro: los datos en el orden del formulario de Mi DT, cada
 * uno con "Copiar", y —cuando el formulario ya está mapeado— "Llenar esta
 * etapa". Al final, marcarlo como registrado en Jornada40.
 */
export function Ficha({ empresa, clave, onVolver, ...resto }: Props) {
  const consulta = useQuery({
    queryKey: ['ficha', empresa.id, clave],
    queryFn: () => pedir<FichaDT>(`/extension/v1/registro/ficha/?empresa=${empresa.id}&clave=${encodeURIComponent(clave)}`),
    // Los datos del trabajador no quedan en memoria al cerrar la ficha.
    gcTime: 0,
  });
  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <Button variante="fantasma" onClick={onVolver} iconoInicio={<ArrowLeft className="size-4" strokeWidth={2} />}>
          Volver a la lista
        </Button>
      </div>
      {consulta.isError && <Aviso tono="peligro">{mensajeDe(consulta.error, 'No pudimos traer la ficha.')}</Aviso>}
      {!consulta.data && !consulta.isError && <Cargando />}
      {consulta.data && <FichaCargada ficha={consulta.data} empresa={empresa} clave={clave} onVolver={onVolver} {...resto} />}
    </div>
  );
}

function chipEstado(ficha: FichaDT) {
  if (ficha.estado === 'REGISTRADO') return <Chip tono="ok">Registrado</Chip>;
  if (ficha.estado === 'VENCIDO') return <Chip tono="peligro">Venció el {fechaCL(ficha.vence)}</Chip>;
  return <Chip tono="aviso">Vence el {fechaCL(ficha.vence)}</Chip>;
}

interface Llenado { etapa: string; respuesta: RespuestaLlenado; faltan: Instruccion[] }

function FichaCargada({ ficha, empresa, mapeos, midt, verificacion, onMarcado }: Props & { ficha: FichaDT }) {
  const [confirmada, setConfirmada] = useState(false);
  const [llenado, setLlenado] = useState<Llenado | null>(null);
  const [llenando, setLlenando] = useState(false);
  const [errorLlenado, setErrorLlenado] = useState<string | null>(null);
  const [distintos, setDistintos] = useState<{ etiqueta: string; ficha: string; midt: string }[]>([]);
  const [exito, setExito] = useState<RespuestaExito | null>(null);

  const pantalla = pantallaPara(mapeos, ficha.tipo);
  const pagina = midt.pagina;
  const enFormulario = Boolean(pantalla && pagina && enLaPantalla(pantalla, pagina.ruta));
  const etapa = pantalla && pagina && enFormulario ? etapaActual(pantalla, pagina.encabezados) : null;
  const puedeLlenar = verificacion === 'coincide' || (verificacion === 'sin_leer' && confirmada);
  const resultado = llenado && etapa && llenado.etapa === etapa.titulo ? llenado : null;

  // Después de llenar: compara lo que Mi DT trae por su cuenta (el nombre del Registro Civil) con la ficha.
  useEffect(() => {
    const pestana = midt.pestana;
    if (!resultado || !etapa?.verificar?.length || !pestana) return;
    const selectores = etapa.verificar.map((v) => v.selector);
    const revisar = async () => {
      const leidos = await preguntar<RespuestaLeer>(pestana, { tipo: 'leer', selectores });
      if (leidos) setDistintos(diferencias(etapa, ficha, leidos));
    };
    const t = window.setInterval(() => void revisar(), 2000);
    return () => window.clearInterval(t);
  }, [resultado, etapa, ficha, midt.pestana]);

  // Mensaje de registro exitoso de Mi DT (si el mapeo dice cómo reconocerlo). Si ya estaba en
  // pantalla al abrir la ficha, es de otro registro: cuenta solo uno que aparezca después.
  const exitoPrevio = useRef<boolean | null>(null);
  useEffect(() => {
    const pestana = midt.pestana;
    const regla = pantalla?.exito;
    if (!regla || !pestana?.enMiDT || exito?.registrado || ficha.estado === 'REGISTRADO') return;
    const revisar = async () => {
      const r = await preguntar<RespuestaExito>(pestana, { tipo: 'exito', exito: regla });
      if (!r) return;
      if (exitoPrevio.current === null || !r.registrado) {
        exitoPrevio.current = r.registrado;
        return;
      }
      if (!exitoPrevio.current) setExito(r);
    };
    void revisar();
    const t = window.setInterval(() => void revisar(), 2500);
    return () => window.clearInterval(t);
  }, [pantalla, midt.pestana, exito, ficha.estado]);

  const llenar = async () => {
    const pestana = midt.pestana;
    if (!etapa || !pestana) return;
    const { llenar: lista, faltan } = instrucciones(etapa, ficha);
    setLlenando(true);
    setErrorLlenado(null);
    setDistintos([]);
    const respuesta = await preguntar<RespuestaLlenado>(pestana, {
      tipo: 'llenar', instrucciones: lista, pendientes: faltan.map((f) => f.selector),
    });
    setLlenando(false);
    if (!respuesta) {
      setErrorLlenado('Mi DT no respondió. Recarga la página de Mi DT (tecla F5) e intenta de nuevo.');
      return;
    }
    setLlenado({ etapa: etapa.titulo, respuesta, faltan });
  };

  const rutaFormulario = pantalla?.ruta || '/';
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[18px] font-semibold leading-snug">{ficha.titulo}</h2>
        <div>{chipEstado(ficha)}</div>
      </div>
      {ficha.avisos.map((a) => <Aviso key={a} tono="aviso">{a}</Aviso>)}

      {exito?.registrado && ficha.estado !== 'REGISTRADO' && (
        <Aviso tono="ok" titulo="Mi DT confirmó el registro">
          {exito.comprobante ? `Comprobante N° ${exito.comprobante}. ` : ''}Márcalo como registrado en Jornada40 aquí abajo.
        </Aviso>
      )}

      <Tarjeta titulo="En Mi DT">
        <p className="text-[13.5px] text-fg-2">{ficha.ruta_mi_dt}</p>
        {exito?.registrado ? (
          <p className="text-[14px]">El registro en Mi DT está terminado.</p>
        ) : !midt.pestana?.enMiDT ? (
          <>
            <p className="text-[14px]">Abre Mi DT y entra con tu Clave Única, como siempre.</p>
            <div>
              <Button onClick={() => void abrirEnMiDT(rutaFormulario, midt.pestana)}
                iconoFin={<ExternalLink className="size-4" strokeWidth={2} />}>Abrir Mi DT</Button>
            </div>
          </>
        ) : midt.sinScript ? (
          <Aviso tono="aviso" titulo="Recarga la página de Mi DT">
            Presiona F5 en la pestaña de Mi DT para que la extensión pueda verla.
          </Aviso>
        ) : !pantalla || pantalla.etapas.length === 0 ? (
          <>
            {pantalla?.ruta && !enFormulario && (
              <div>
                <Button variante="secundario" onClick={() => void abrirEnMiDT(pantalla.ruta, midt.pestana)}>
                  Abrir el formulario en Mi DT
                </Button>
              </div>
            )}
            <Aviso tono="info">
              El llenado automático de este formulario estará listo pronto. Mientras, copia cada dato con su botón «Copiar».
            </Aviso>
          </>
        ) : !enFormulario ? (
          <div>
            <Button onClick={() => void abrirEnMiDT(pantalla.ruta, midt.pestana)}>Abrir el formulario en Mi DT</Button>
          </div>
        ) : !etapa ? (
          <Aviso tono="aviso">
            No reconocemos esta parte del formulario. Copia los datos con los botones «Copiar».
          </Aviso>
        ) : (
          <>
            <p className="text-[14px]">Estás en: <b>{etapa.titulo}</b></p>
            {verificacion === 'distinta' && (
              <Aviso tono="peligro">
                Entraste a Mi DT con otra empresa. No llenamos nada hasta que sea {empresa.nombre}.
              </Aviso>
            )}
            {verificacion === 'sin_leer' && (
              <Casilla marcada={confirmada} onChange={setConfirmada}>
                Confirmo que en Mi DT entré con <b>{empresa.nombre}</b> (RUT {formatRut(empresa.rut)}).
              </Casilla>
            )}
            <Button tamano="lg" bloque disabled={!puedeLlenar} cargando={llenando} onClick={() => void llenar()}
              iconoInicio={<Wand2 className="size-5" strokeWidth={2} />}>
              {llenando ? 'Llenando…' : 'Llenar esta etapa'}
            </Button>
            {errorLlenado && <Aviso tono="peligro">{errorLlenado}</Aviso>}
            {resultado && <ResultadoLlenado llenado={resultado} />}
            {distintos.map((d) => (
              <Aviso key={d.etiqueta} tono="peligro" titulo="El dato de Mi DT no coincide con Jornada40">
                {d.etiqueta}: Mi DT dice «{d.midt}» y la ficha dice «{d.ficha}». Revisa el RUT antes de seguir.
              </Aviso>
            ))}
          </>
        )}
      </Tarjeta>

      <section aria-label="Datos para Mi DT" className="flex flex-col gap-3">
        {ficha.secciones.map((s) => (
          <Tarjeta key={s.titulo} titulo={s.titulo}>
            <dl className="flex flex-col divide-y divide-line -my-1">
              {s.campos.map((c) => (
                <div key={`${s.titulo}|${c.clave}|${c.etiqueta}`} className="py-2.5 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <dt className="text-[13px] text-fg-3">{c.etiqueta}</dt>
                    {c.valor && <BotonCopiar texto={c.valor} etiqueta={c.etiqueta} />}
                  </div>
                  <dd className={c.valor.length > 80
                    ? 'whitespace-pre-wrap break-words rounded-[8px] bg-sunken px-3 py-2 text-[13.5px] leading-relaxed'
                    : 'text-[15px] break-words'}>
                    {c.valor || <span className="text-fg-3">—</span>}
                  </dd>
                  {c.nota && <p className="text-[12.5px] text-fg-3">{c.nota}</p>}
                </div>
              ))}
            </dl>
          </Tarjeta>
        ))}
      </section>

      {ficha.estado !== 'REGISTRADO' && (
        <MarcarRegistrado key={exito?.comprobante ?? ''} empresa={empresa} clave={ficha.clave} comprobante={exito?.comprobante ?? ''}
          destacado={Boolean(exito?.registrado)} onMarcado={onMarcado} />
      )}
      <p className="text-[12.5px] text-fg-3">
        Revisa cada dato antes de enviar: al final Mi DT te pide una declaración jurada de veracidad (Art. 210 del Código Penal).
      </p>
    </>
  );
}

function ResultadoLlenado({ llenado }: { llenado: Llenado }) {
  const { respuesta, faltan } = llenado;
  if (respuesta.detenido) {
    return (
      <Aviso tono="peligro" titulo="No llenamos nada">
        Esta parte de Mi DT cambió y no encontramos: {respuesta.resultados.map((r) => r.etiqueta).join(', ')}.
        Copia los datos con los botones «Copiar». Avísanos para corregirlo.
      </Aviso>
    );
  }
  const ok = respuesta.resultados.filter((r) => r.estado === 'ok');
  const problemas = respuesta.resultados.filter((r) => r.estado !== 'ok');
  return (
    <>
      <Aviso tono="ok" titulo={`Llenamos ${ok.length} ${ok.length === 1 ? 'dato' : 'datos'} (marcados en verde)`}>
        Revisa todo y presiona «Siguiente» en Mi DT.
      </Aviso>
      {problemas.length > 0 && (
        <Aviso tono="aviso" titulo="Estos no se pudieron llenar: cópialos con su botón «Copiar»">
          <Lista textos={problemas.map((r) => r.etiqueta)} />
        </Aviso>
      )}
      {faltan.length > 0 && (
        <Aviso tono="aviso" titulo="Complétalos tú en Mi DT (marcados en amarillo)">
          <Lista textos={faltan.map((f) => f.etiqueta)} />
        </Aviso>
      )}
    </>
  );
}

function Lista({ textos }: { textos: string[] }) {
  return <ul className="list-disc pl-5 flex flex-col gap-0.5">{textos.map((t) => <li key={t}>{t}</li>)}</ul>;
}

function MarcarRegistrado({ empresa, clave, comprobante: inicial, destacado, onMarcado }: {
  empresa: EmpresaExtension; clave: string; comprobante: string; destacado: boolean; onMarcado: (texto: string) => void;
}) {
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoyISO);
  const [comprobante, setComprobante] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visible = abierto || destacado;

  const marcar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await pedir('/extension/v1/registro/marcar/', {
        metodo: 'POST', cuerpo: { empresa: empresa.id, claves: [clave], fecha, comprobante: comprobante.trim() },
      });
      await queryClient.invalidateQueries({ queryKey: ['registro', empresa.id] });
      onMarcado('Listo: quedó marcado como registrado en Jornada40.');
    } catch (err) {
      setError(mensajeDe(err));
      setEnviando(false);
    }
  };

  if (!visible) {
    return (
      <div>
        <Button variante="secundario" tamano="lg" bloque onClick={() => setAbierto(true)}
          iconoInicio={<CircleCheck className="size-5" strokeWidth={2} />}>Ya lo registré en Mi DT</Button>
      </div>
    );
  }
  return (
    <Tarjeta titulo="Marcar como registrado">
      <form onSubmit={(e) => void marcar(e)} className="flex flex-col gap-3" noValidate>
        <Field etiqueta="Fecha en que lo registraste">
          {(p) => <Input {...p} tamano="lg" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />}
        </Field>
        <Field etiqueta="N° de comprobante de Mi DT (si lo muestra)">
          {(p) => <Input {...p} tamano="lg" value={comprobante} maxLength={60} onChange={(e) => setComprobante(e.target.value)} />}
        </Field>
        {error && <Aviso tono="peligro">{error}</Aviso>}
        <Button type="submit" tamano="lg" bloque cargando={enviando}>{enviando ? 'Guardando…' : 'Marcar como registrado'}</Button>
      </form>
    </Tarjeta>
  );
}
