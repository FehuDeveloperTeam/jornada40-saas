import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CalendarClock, Download, FileText, Gavel, Landmark, ListChecks, Paperclip, Pencil, Search, Shield, ShieldAlert, Upload, Users,
} from 'lucide-react';
import client from '../../api/client';
import { descargar } from '../../api/descargas';
import { AlertaError, Button, CampoRut, Casilla, Chip, Drawer } from '../../components/j40';
import { useKarin } from '../../components/karin/KarinShell';
import { AREA, Aviso, ChipPlazo, CONTROL, Seccion, Selector, Texto, mensajeError } from '../../components/karin/comun';
import type { CatalogosKarin, DenunciaKarinDetalle, InformeKarin, OpcionKarin } from '../../types';
import { fechaCL, hoyISO } from '../../utils/formato';
import { FormularioDenuncia } from './NuevaDenuncia';

type Accion = (ruta: string, datos: unknown, ok?: string) => Promise<boolean>;
const texto = (lista: OpcionKarin[], valor: string) => lista.find((o) => o.valor === valor)?.texto ?? valor;

/** Expediente de una denuncia: plazos arriba y cada paso del procedimiento en orden (DS 21). */
export default function Expediente() {
  const { id } = useParams();
  const { catalogos } = useKarin();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState(false);
  const clave = ['karin', 'denuncia', id];
  const consulta = useQuery({
    queryKey: clave,
    queryFn: async () => (await client.get<DenunciaKarinDetalle>(`/karin/denuncias/${id}/`)).data,
  });

  const accion: Accion = async (ruta, datos, ok = 'Guardado') => {
    setError('');
    try {
      const { data } = await client.post<DenunciaKarinDetalle>(`/karin/denuncias/${id}/${ruta}/`, datos);
      queryClient.setQueryData(clave, data);
      void queryClient.invalidateQueries({ queryKey: ['karin', 'denuncias'] });
      setAviso(ok);
      window.setTimeout(() => setAviso(''), 3000);
      return true;
    } catch (err) {
      setError(mensajeError(err, 'No pudimos guardar. Intenta de nuevo.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
  };

  if (consulta.isLoading || !catalogos) return <p className="text-[15px] text-fg-3" role="status">Cargando…</p>;
  if (!consulta.data) return <AlertaError>{mensajeError(consulta.error, 'No encontramos la denuncia.')}</AlertaError>;
  const d = consulta.data;
  const cerrada = d.estado === 'CERRADA';
  const h = d.hitos;

  return (
    <>
      <Link to="/karin/panel" className="inline-flex items-center gap-1.5 text-[14px] text-fg-2"><ArrowLeft className="size-4" strokeWidth={2} aria-hidden />Denuncias</Link>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[240px]">
          <h1 className="text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.015em]">Denuncia {d.folio}</h1>
          <p className="text-[15px] text-fg-3 mt-1">{d.tipo_texto} · {d.empresa.nombre} · recibida el {fechaCL(d.recibida_en)}</p>
        </div>
        <Chip tono={cerrada ? 'ok' : 'marca'}>{d.estado_texto}</Chip>
      </div>
      {error && <AlertaError>{error}</AlertaError>}
      {aviso && <p role="status" className="px-4 py-3 rounded-[10px] bg-ok-soft text-ok text-[14.5px]">{aviso}</p>}
      {d.avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
      {d.posibles_represalias.length > 0 && (
        <Seccion titulo="Posibles represalias por revisar" icono={<ShieldAlert className="size-6 text-danger" strokeWidth={2} aria-hidden />}>
          <p className="text-[14.5px] text-fg-2">
            Desde la denuncia, la empresa emitió estas medidas a quien denunció o declaró. La ley prohíbe las represalias:
            revise si tienen relación con el caso y, si corresponde, adopte medidas. Es un aviso: no bloquea nada, y el titular no lo ve.
          </p>
          <ul className="flex flex-col">
            {d.posibles_represalias.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-4 py-2 border-b border-line last:border-b-0 text-[15px]">
                <span className="j40-num text-fg-3 w-[96px]">{fechaCL(e.fecha)}</span>
                <span className="font-medium">{e.texto}</span>
                <span className="text-fg-2">{e.persona}</span>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      <Plazos d={d} />

      <Seccion titulo="Datos de la denuncia" icono={<FileText className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
        <Datos d={d} catalogos={catalogos} />
        {!cerrada && (
          <Button variante="secundario" className="self-start" onClick={() => setEditando(true)}
            iconoInicio={<Pencil className="size-4" strokeWidth={2} />}>Completar o corregir</Button>
        )}
      </Seccion>

      <Resguardo d={d} catalogos={catalogos} accion={accion} cerrada={cerrada} />
      <Decision d={d} accion={accion} cerrada={cerrada} />

      {h.decision === 'INTERNA' && <>
        <Investigacion d={d} catalogos={catalogos} accion={accion} cerrada={cerrada} />
        <Informe d={d} catalogos={catalogos} accion={accion} cerrada={cerrada} />
      </>}
      {h.decision === 'DT' && (
        <Seccion titulo="Investigación de la Dirección del Trabajo" icono={<Landmark className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
          <p className="text-[15px] text-fg-2">La DT investiga y notifica su informe a la empresa y a las partes. Cuando llegue, regístrelo para calcular el plazo de las medidas.</p>
          <Hito d={d} hito="resultado_dt_en" etiqueta="Llegó el informe de la DT" accion={accion} cerrada={cerrada} />
        </Seccion>
      )}
      {(d.estado === 'MEDIDAS' || d.estado === 'CERRADA') && <Medidas d={d} catalogos={catalogos} accion={accion} cerrada={cerrada} />}
      <Documentos d={d} catalogos={catalogos} onSubido={(nuevo) => queryClient.setQueryData(clave, nuevo)} setError={setError} cerrada={cerrada} />

      {editando && (
        <Drawer abierto onCerrar={() => setEditando(false)} titulo={`Completar o corregir ${d.folio}`}>
          <FormularioDenuncia catalogos={catalogos} inicial={d} onGuardada={(nuevo) => {
            queryClient.setQueryData(clave, nuevo);
            setEditando(false);
            setAviso('Datos actualizados');
          }} />
        </Drawer>
      )}
    </>
  );
}

function Plazos({ d }: { d: DenunciaKarinDetalle }) {
  return (
    <Seccion titulo="Plazos" icono={<CalendarClock className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
      <ul className="flex flex-col">
        {d.plazos.map((p) => (
          <li key={p.clave} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 border-b border-line last:border-b-0">
            <span className="flex-[1_1_260px] min-w-0 flex flex-col">
              <span className="text-[15px] font-medium">{p.texto}</span>
              <span className="text-[12.5px] text-fg-3">{p.norma}</span>
            </span>
            <span className="text-[14px] text-fg-2 j40-num">
              {p.cumplido ? `Hecho el ${fechaCL(p.cumplido)}` : p.vence ? `${p.estado === 'ESPERA' ? 'Hasta' : 'Vence'} el ${fechaCL(p.vence)}` : ''}
            </span>
            <ChipPlazo estado={p.estado} />
          </li>
        ))}
      </ul>
    </Seccion>
  );
}

function Fila({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(140px,30%)_1fr] gap-3 py-2 border-b border-line last:border-b-0 text-[15px]">
      <span className="text-fg-3">{k}</span><span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function Datos({ d, catalogos }: { d: DenunciaKarinDetalle; catalogos: CatalogosKarin }) {
  const p = (x: { nombre: string; rut: string; cargo: string; correo?: string }) =>
    [x.nombre, x.rut && `RUT ${x.rut}`, x.cargo, x.correo].filter(Boolean).join(' · ');
  return (
    <div className="flex flex-col">
      <Fila k="Forma">{d.canal_texto}</Fila>
      <Fila k="Persona afectada">{p(d.datos.afectada)}</Fila>
      {d.datos.denunciante && <Fila k="Denuncia en su nombre">{p(d.datos.denunciante)} ({texto(catalogos.representaciones, d.datos.representacion)})</Fila>}
      {d.datos.denunciados.map((x, i) => (
        <Fila key={i} k={`Persona denunciada ${i + 1}`}>{p(x)} — {texto(catalogos.vinculos, x.vinculo ?? '')}</Fila>
      ))}
      <Fila k="Hechos"><span className="whitespace-pre-line">{d.datos.relato}</span></Fila>
      {d.pide_derivar_dt && <Fila k="Pide">Que investigue la Dirección del Trabajo</Fila>}
    </div>
  );
}

/** Registrar (o deshacer) la fecha de un paso. */
function Hito({ d, hito, etiqueta, accion, cerrada, ayuda }: {
  d: DenunciaKarinDetalle; hito: string; etiqueta: string; accion: Accion; cerrada: boolean; ayuda?: string;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const hecho = d.hitos[hito];
  return (
    <div className="flex flex-wrap items-end gap-3 py-2.5 border-b border-line last:border-b-0">
      <div className="flex-[1_1_260px] min-w-0">
        <p className="text-[15px] font-medium">{etiqueta}</p>
        {ayuda && <p className="text-[13px] text-fg-3">{ayuda}</p>}
      </div>
      {hecho ? (
        <div className="flex items-center gap-3">
          <span className="text-[14.5px] text-ok font-medium">Hecho el {fechaCL(hecho)}</span>
          {!cerrada && <Button variante="fantasma" tamano="sm" onClick={() => void accion('marcar', { hito, deshacer: true }, 'Paso deshecho')}>Deshacer</Button>}
        </div>
      ) : !cerrada && (
        <div className="flex items-end gap-2">
          <input type="date" aria-label={`Fecha: ${etiqueta}`} value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} className={`${CONTROL} w-[170px]`} />
          <Button onClick={() => void accion('marcar', { hito, fecha }, 'Paso registrado')}>Registrar</Button>
        </div>
      )}
    </div>
  );
}

function Resguardo({ d, catalogos, accion, cerrada }: { d: DenunciaKarinDetalle; catalogos: CatalogosKarin; accion: Accion; cerrada: boolean }) {
  const [tipo, setTipo] = useState('');
  const [aplica, setAplica] = useState('DENUNCIADO');
  const [fecha, setFecha] = useState(hoyISO());
  const agregar = async () => {
    if (await accion('resguardo', { medidas: [...d.resguardo, { tipo, aplica_a: aplica, fecha }] }, 'Medida registrada')) setTipo('');
  };
  return (
    <Seccion titulo="Medidas de resguardo" icono={<Shield className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
      <p className="text-[14.5px] text-fg-2">Se adoptan de inmediato y no pueden perjudicar a la persona afectada (Arts. 13 y 20 DS 21). Ofrezca siempre la atención psicológica temprana de la mutual.</p>
      {d.resguardo.length === 0 && <p className="text-[15px] text-danger font-medium">Aún no hay medidas registradas.</p>}
      {d.resguardo.map((m, i) => (
        <div key={i} className="flex flex-wrap items-center gap-3 py-2 border-b border-line text-[15px]">
          <span className="flex-[1_1_260px]">{texto(catalogos.resguardos, m.tipo)}</span>
          <span className="text-fg-3">{texto(catalogos.aplica_a, m.aplica_a)} · desde el {fechaCL(m.fecha)}</span>
          {!cerrada && <Button variante="fantasma" tamano="sm" onClick={() => void accion('resguardo', { medidas: d.resguardo.filter((_, j) => j !== i) }, 'Medida quitada')}>Quitar</Button>}
        </div>
      ))}
      {!cerrada && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3 items-end">
          <Selector id="rg-tipo" etiqueta="Medida" valor={tipo} onChange={setTipo} opciones={catalogos.resguardos} />
          <Selector id="rg-aplica" etiqueta="Se aplica" valor={aplica} onChange={setAplica} opciones={catalogos.aplica_a} vacio="Elige" />
          <Texto id="rg-fecha" tipo="date" etiqueta="Desde" valor={fecha} onChange={setFecha} />
          <Button disabled={!tipo} onClick={() => void agregar()}>Agregar medida</Button>
        </div>
      )}
    </Seccion>
  );
}

function Decision({ d, accion, cerrada }: { d: DenunciaKarinDetalle; accion: Accion; cerrada: boolean }) {
  const [fecha, setFecha] = useState(hoyISO());
  const decision = d.hitos.decision;
  return (
    <Seccion titulo="Investigar o derivar" icono={<Gavel className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
      {!decision ? (
        <>
          <p className="text-[15px] text-fg-2">Dentro de 3 días hábiles: la empresa investiga (y lo informa a la DT) o deriva la denuncia a la Dirección del Trabajo (Art. 12 DS 21).</p>
          {d.derivacion_obligatoria && <Aviso>{d.derivacion_obligatoria}</Aviso>}
          {!cerrada && (
            <div className="flex flex-wrap items-end gap-3">
              <Texto id="dc-fecha" tipo="date" etiqueta="Fecha de la decisión" valor={fecha} onChange={setFecha} />
              <Button tamano="lg" disabled={Boolean(d.derivacion_obligatoria)}
                onClick={() => void accion('decidir', { decision: 'INTERNA', fecha }, 'Decisión registrada')}>Investigar en la empresa</Button>
              <Button tamano="lg" variante="secundario" onClick={() => void accion('decidir', { decision: 'DT', fecha }, 'Decisión registrada')}>Derivar a la DT</Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-[15.5px]">
          {decision === 'INTERNA' ? 'La investiga la empresa' : 'Derivada a la Dirección del Trabajo'} desde el {fechaCL(d.hitos.decision_en)}.
        </p>
      )}
      {decision && <>
        <Hito d={d} hito="denunciante_informado_en" etiqueta="Informé por escrito la decisión a quien denunció" accion={accion} cerrada={cerrada}
          ayuda="Use el documento «Comunicación de la decisión»." />
        {decision === 'INTERNA' && (
          <Hito d={d} hito="inicio_informado_dt_en" etiqueta="Informé a la DT el inicio y las medidas de resguardo" accion={accion} cerrada={cerrada}
            ayuda="Trámite con ClaveÚnica en el sitio de la DT; use «Antecedentes para la DT»." />
        )}
      </>}
    </Seccion>
  );
}

function Investigacion({ d, catalogos, accion, cerrada }: { d: DenunciaKarinDetalle; catalogos: CatalogosKarin; accion: Accion; cerrada: boolean }) {
  const inv = d.investigacion;
  const [inv_nombre, setNombre] = useState(inv.investigador?.nombre ?? '');
  const [inv_rut, setRut] = useState(inv.investigador?.rut ?? '');
  const [inv_correo, setCorreo] = useState(inv.investigador?.correo ?? '');
  const [inv_cargo, setCargo] = useState(inv.investigador?.cargo ?? '');
  const [externo, setExterno] = useState(Boolean(inv.investigador?.externo));
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoRol, setNuevoRol] = useState('');
  const [antecedentes, setAntecedentes] = useState<string[]>(inv.antecedentes ?? []);
  const [citando, setCitando] = useState<string | null>(null);
  const [cita, setCita] = useState({ fecha: '', hora: '', lugar: '' });

  return (
    <Seccion titulo="Investigación" icono={<Search className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
      <h3 className="text-[16px] font-semibold">Quien investiga</h3>
      <p className="text-[14px] text-fg-2">Preferentemente alguien con formación en acoso, género o derechos fundamentales, que no sea parte del caso (Art. 14 DS 21).</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
        <Texto id="in-nombre" etiqueta="Nombre" valor={inv_nombre} onChange={setNombre} />
        <CampoRut etiqueta="RUT" valor={inv_rut} onChange={setRut} />
        <Texto id="in-correo" tipo="email" etiqueta="Correo" valor={inv_correo} onChange={setCorreo} />
        <Texto id="in-cargo" etiqueta="Cargo" valor={inv_cargo} onChange={setCargo} />
      </div>
      {!cerrada && !d.hitos.informe_emitido_en && <>
        <Casilla marcada={externo} onChange={setExterno}><span className="text-[15px]">Es externo a la empresa (asesor)</span></Casilla>
        <Button variante="secundario" className="self-start" onClick={() => void accion('investigador',
          { nombre: inv_nombre, rut: inv_rut, correo: inv_correo, cargo: inv_cargo, externo }, 'Investigador registrado')}>Guardar quien investiga</Button>
      </>}
      <Hito d={d} hito="investigador_informado_en" etiqueta="Informé por escrito a quien denunció quién investiga" accion={accion} cerrada={cerrada} />

      <h3 className="text-[16px] font-semibold flex items-center gap-2 pt-2"><Users className="size-5" strokeWidth={2} aria-hidden />Personas que declaran</h3>
      <p className="text-[14px] text-fg-2">Todas las partes deben ser oídas. Las declaraciones se firman en papel en todas sus hojas y se suben escaneadas (Art. 15 DS 21).</p>
      {(inv.participantes ?? []).map((p) => (
        <div key={p.id} className="flex flex-col gap-2 p-3 rounded-[10px] border border-line">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex-[1_1_220px] text-[15px] font-medium">{p.nombre} <span className="text-fg-3 font-normal">· {texto(catalogos.roles, p.rol)}</span></span>
            {p.declaro_en ? <Chip tono="ok">Declaró el {fechaCL(p.declaro_en)}</Chip> : <Chip tono="aviso">Sin declaración</Chip>}
          </div>
          <p className="text-[14px] text-fg-2">{p.citacion ? `Citado el ${fechaCL(p.citacion.fecha)} a las ${p.citacion.hora} en ${p.citacion.lugar}.` : 'Sin citación.'}</p>
          <div className="flex flex-wrap gap-2">
            {!cerrada && <Button variante="secundario" tamano="sm" onClick={() => { setCitando(p.id); setCita(p.citacion ?? { fecha: '', hora: '', lugar: '' }); }}>Citar</Button>}
            {p.citacion && <Button variante="secundario" tamano="sm" iconoInicio={<Download className="size-4" strokeWidth={2} />}
              onClick={() => void descargar(`/karin/denuncias/${d.id}/documento/?tipo=CITACION&participante=${p.id}`, `${d.folio}_citacion.pdf`)}>Citación</Button>}
            <Button variante="secundario" tamano="sm" iconoInicio={<Download className="size-4" strokeWidth={2} />}
              onClick={() => void descargar(`/karin/denuncias/${d.id}/documento/?tipo=ACTA_DECLARACION&participante=${p.id}`, `${d.folio}_acta.pdf`)}>Acta para firmar</Button>
            {!cerrada && !p.declaro_en && <Button variante="fantasma" tamano="sm" onClick={() => void accion('participantes', { id: p.id, quitar: true }, 'Persona quitada')}>Quitar</Button>}
          </div>
          {citando === p.id && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3 items-end">
              <Texto id={`ct-fecha-${p.id}`} tipo="date" etiqueta="Fecha" valor={cita.fecha} onChange={(v) => setCita((c) => ({ ...c, fecha: v }))} />
              <Texto id={`ct-hora-${p.id}`} tipo="time" etiqueta="Hora" valor={cita.hora} onChange={(v) => setCita((c) => ({ ...c, hora: v }))} />
              <Texto id={`ct-lugar-${p.id}`} etiqueta="Lugar" valor={cita.lugar} onChange={(v) => setCita((c) => ({ ...c, lugar: v }))} />
              <Button onClick={async () => { if (await accion('participantes', { id: p.id, citacion: cita }, 'Citación registrada')) setCitando(null); }}>Guardar citación</Button>
            </div>
          )}
        </div>
      ))}
      {!cerrada && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3 items-end">
          <Texto id="pt-nombre" etiqueta="Nombre" valor={nuevoNombre} onChange={setNuevoNombre} />
          <Selector id="pt-rol" etiqueta="Declara como" valor={nuevoRol} onChange={setNuevoRol} opciones={catalogos.roles} />
          <Button variante="secundario" disabled={!nuevoNombre || !nuevoRol} onClick={async () => {
            if (await accion('participantes', { nombre: nuevoNombre, rol: nuevoRol }, 'Persona agregada')) { setNuevoNombre(''); setNuevoRol(''); }
          }}>Agregar persona</Button>
        </div>
      )}

      <h3 className="text-[16px] font-semibold flex items-center gap-2 pt-2"><ListChecks className="size-5" strokeWidth={2} aria-hidden />Antecedentes revisados</h3>
      <div className="flex flex-col gap-2">
        {catalogos.antecedentes.map((a) => (
          <Casilla key={a.valor} marcada={antecedentes.includes(a.valor)} deshabilitada={cerrada}
            onChange={(v) => setAntecedentes((l) => v ? [...l, a.valor] : l.filter((x) => x !== a.valor))}>
            <span className="text-[15px]">{a.texto}</span>
          </Casilla>
        ))}
      </div>
      {!cerrada && <Button variante="secundario" className="self-start" onClick={() => void accion('antecedentes', { antecedentes }, 'Antecedentes guardados')}>Guardar antecedentes</Button>}
    </Seccion>
  );
}

function Informe({ d, catalogos, accion, cerrada }: { d: DenunciaKarinDetalle; catalogos: CatalogosKarin; accion: Accion; cerrada: boolean }) {
  const inicial: InformeKarin = d.informe ?? { hechos: '', fundamentos: '', conclusion: '', medidas_correctivas: [], sanciones: [], imparcialidad: '' };
  const [inf, setInf] = useState<InformeKarin>(inicial);
  const emitido = Boolean(d.hitos.informe_emitido_en);
  const sancion = (i: number) => inf.sanciones.find((s) => s.persona === i)?.sancion ?? '';
  const ponerSancion = (i: number, v: string) => setInf((x) => ({
    ...x, sanciones: [...x.sanciones.filter((s) => s.persona !== i), ...(v ? [{ persona: i, sancion: v }] : [])],
  }));
  const [resultado, setResultado] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  return (
    <Seccion titulo="Informe de investigación" icono={<FileText className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
      <p className="text-[14px] text-fg-2">Los datos de la empresa, las partes, quien investiga, las medidas y las entrevistas salen solos del expediente (Art. 16 a–e). Complete el resto. Jornada40 no decide si hubo acoso: lo concluye quien investiga.</p>
      <label htmlFor="if-hechos" className="text-[14px] font-medium text-fg-2">f) Hechos denunciados, declaraciones recibidas y alegaciones</label>
      <textarea id="if-hechos" disabled={emitido || cerrada} value={inf.hechos} onChange={(e) => setInf((x) => ({ ...x, hechos: e.target.value }))} className={AREA} />
      <label htmlFor="if-fundamentos" className="text-[14px] font-medium text-fg-2">g) Indicios y razonamientos en que se funda la conclusión</label>
      <textarea id="if-fundamentos" disabled={emitido || cerrada} value={inf.fundamentos} onChange={(e) => setInf((x) => ({ ...x, fundamentos: e.target.value }))} className={AREA} />
      <Selector id="if-conclusion" etiqueta="Conclusión" valor={inf.conclusion} onChange={(v) => setInf((x) => ({ ...x, conclusion: v }))} opciones={catalogos.conclusiones} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[14px] font-medium text-fg-2 mb-1">h) Medidas correctivas propuestas</legend>
        {catalogos.medidas_correctivas.map((m) => (
          <Casilla key={m.valor} marcada={inf.medidas_correctivas.includes(m.valor)} deshabilitada={emitido || cerrada}
            onChange={(v) => setInf((x) => ({ ...x, medidas_correctivas: v ? [...x.medidas_correctivas, m.valor] : x.medidas_correctivas.filter((y) => y !== m.valor) }))}>
            <span className="text-[15px]">{m.texto}</span>
          </Casilla>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-[14px] font-medium text-fg-2 mb-1">i) Sanciones propuestas</legend>
        {d.datos.denunciados.map((p, i) => (
          <Selector key={i} id={`if-sancion-${i}`} etiqueta={p.nombre} valor={sancion(i)} onChange={(v) => ponerSancion(i, v)}
            opciones={catalogos.sanciones} vacio="Sin propuesta" />
        ))}
      </fieldset>
      <Texto id="if-imparcialidad" etiqueta="Antecedentes sobre la imparcialidad de quien investiga (si los hubo)" valor={inf.imparcialidad}
        onChange={(v) => setInf((x) => ({ ...x, imparcialidad: v }))} ayuda="Art. 14 y 16 c) DS 21. Déjelo en blanco si no se presentaron." />
      {!emitido && !cerrada && <Button variante="secundario" className="self-start" onClick={() => void accion('informe', inf, 'Informe guardado')}>Guardar informe</Button>}
      {d.informe && (
        <Button variante="secundario" className="self-start" iconoInicio={<Download className="size-4" strokeWidth={2} />}
          onClick={() => void descargar(`/karin/denuncias/${d.id}/documento/?tipo=INFORME`, `${d.folio}_informe.pdf`)}>Descargar informe</Button>
      )}
      <Hito d={d} hito="informe_emitido_en" etiqueta="Terminé la investigación y emití el informe" accion={accion} cerrada={cerrada}
        ayuda="Después de emitirlo ya no se puede modificar." />
      {emitido && <Hito d={d} hito="informe_enviado_dt_en" etiqueta="Remití el informe a la Dirección del Trabajo" accion={accion} cerrada={cerrada}
        ayuda="Dentro de 2 días hábiles, por el sitio de la DT (Art. 18 DS 21)." />}
      {d.hitos.informe_enviado_dt_en && (
        <div className="flex flex-col gap-3 pt-2 border-t border-line">
          <h3 className="text-[16px] font-semibold">Pronunciamiento de la DT</h3>
          {d.hitos.resultado_dt ? (
            <p className="text-[15px]">{texto(catalogos.resultados_dt, d.hitos.resultado_dt)}{d.hitos.pronunciamiento_en ? `, notificado el ${fechaCL(d.hitos.pronunciamiento_en)}` : ''}.</p>
          ) : !cerrada && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3 items-end">
              <Selector id="pr-resultado" etiqueta="Resultado" valor={resultado} onChange={setResultado} opciones={catalogos.resultados_dt} />
              {resultado !== 'SIN_PRONUNCIAMIENTO' && <Texto id="pr-fecha" tipo="date" etiqueta="Fecha de notificación" valor={fecha} onChange={setFecha} />}
              <Button disabled={!resultado} onClick={() => void accion('pronunciamiento', { resultado, fecha }, 'Pronunciamiento registrado')}>Registrar</Button>
            </div>
          )}
          {d.hitos.resultado_dt === 'SIN_PRONUNCIAMIENTO' && (
            <Hito d={d} hito="partes_notificadas_en" etiqueta="Notifiqué las conclusiones a la persona afectada, denunciante y denunciada" accion={accion} cerrada={cerrada}
              ayuda="Use el documento «Notificación de las conclusiones» (Art. 18 DS 21)." />
          )}
        </div>
      )}
    </Seccion>
  );
}

function Medidas({ d, catalogos, accion, cerrada }: { d: DenunciaKarinDetalle; catalogos: CatalogosKarin; accion: Accion; cerrada: boolean }) {
  const propuestas = d.informe?.sanciones ?? [];
  const [sanciones, setSanciones] = useState(d.medidas?.sanciones ?? propuestas);
  const [correctivas, setCorrectivas] = useState<string[]>(d.medidas?.correctivas ?? d.informe?.medidas_correctivas ?? []);
  const [fecha, setFecha] = useState(hoyISO());
  const [informadas, setInformadas] = useState(false);
  const aplicadas = Boolean(d.hitos.medidas_aplicadas_en);
  const [fechaCierre, setFechaCierre] = useState(hoyISO());
  const sancion = (i: number) => sanciones.find((s) => s.persona === i)?.sancion ?? '';
  return (
    <Seccion titulo="Medidas, sanciones y cierre" icono={<Gavel className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
      <p className="text-[14.5px] text-fg-2">Se aplican dentro de 15 días corridos y se informan a la persona denunciante y a la denunciada (Art. 19 DS 21).</p>
      {d.datos.denunciados.map((p, i) => (
        <Selector key={i} id={`md-sancion-${i}`} etiqueta={`Sanción para ${p.nombre}`} valor={sancion(i)} vacio="Sin sanción"
          onChange={(v) => setSanciones((l) => [...l.filter((s) => s.persona !== i), ...(v ? [{ persona: i, sancion: v }] : [])])}
          opciones={catalogos.sanciones} />
      ))}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[14px] font-medium text-fg-2 mb-1">Medidas correctivas</legend>
        {catalogos.medidas_correctivas.map((m) => (
          <Casilla key={m.valor} marcada={correctivas.includes(m.valor)} deshabilitada={aplicadas}
            onChange={(v) => setCorrectivas((l) => v ? [...l, m.valor] : l.filter((x) => x !== m.valor))}>
            <span className="text-[15px]">{m.texto}</span>
          </Casilla>
        ))}
      </fieldset>
      {aplicadas ? (
        <p className="text-[15px] text-ok font-medium">Medidas aplicadas e informadas el {fechaCL(d.hitos.medidas_aplicadas_en)}.</p>
      ) : !cerrada && <>
        <Texto id="md-fecha" tipo="date" etiqueta="Fecha en que se aplicaron" valor={fecha} onChange={setFecha} />
        <Casilla marcada={informadas} onChange={setInformadas}><span className="text-[15px]">Las informé a la persona denunciante y a la denunciada</span></Casilla>
        <Button className="self-start" disabled={!informadas}
          onClick={() => void accion('medidas', { sanciones, correctivas, fecha, informadas }, 'Medidas registradas')}>Registrar medidas</Button>
      </>}
      {aplicadas && !cerrada && (
        <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-line">
          <Texto id="cr-fecha" tipo="date" etiqueta="Fecha de cierre" valor={fechaCierre} onChange={setFechaCierre} />
          <Button tamano="lg" onClick={() => void accion('cerrar', { fecha: fechaCierre }, 'Expediente cerrado')}>Cerrar el expediente</Button>
        </div>
      )}
      {cerrada && <p className="text-[15px] text-ok font-medium">Expediente cerrado el {fechaCL(d.hitos.cerrada_en)}.</p>}
    </Seccion>
  );
}

function Documentos({ d, catalogos, onSubido, setError, cerrada }: {
  d: DenunciaKarinDetalle; catalogos: CatalogosKarin; onSubido: (d: DenunciaKarinDetalle) => void; setError: (e: string) => void; cerrada: boolean;
}) {
  const [tipo, setTipo] = useState('');
  const [participante, setParticipante] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const generales = catalogos.documentos.filter((x) => !x.participante);
  const bajar = async (t: string) => {
    const e = await descargar(`/karin/denuncias/${d.id}/documento/?tipo=${t}`, `${d.folio}_${t.toLowerCase()}.pdf`);
    if (e) setError(e);
  };
  const subir = async () => {
    if (!archivo || !tipo) return;
    setSubiendo(true);
    const datos = new FormData();
    datos.append('tipo', tipo);
    datos.append('archivo', archivo);
    if (participante) datos.append('participante', participante);
    try {
      const { data } = await client.post<DenunciaKarinDetalle>(`/karin/denuncias/${d.id}/archivos/`, datos,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      onSubido(data);
      setAbierto(false);
      setArchivo(null);
      setTipo('');
    } catch (err) {
      setError(mensajeError(err, 'No pudimos subir el archivo.'));
    } finally {
      setSubiendo(false);
    }
  };
  return (
    <Seccion titulo="Documentos y archivos" icono={<Paperclip className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
      <p className="text-[14px] text-fg-2">Se generan con los datos del expediente para imprimir y firmar. No se guardan: descárguelos cuando los necesite.</p>
      <div className="flex flex-wrap gap-2">
        {generales.map((g) => (
          <Button key={g.valor} variante="secundario" tamano="sm" iconoInicio={<Download className="size-4" strokeWidth={2} />} onClick={() => void bajar(g.valor)}>
            {g.texto}
          </Button>
        ))}
      </div>
      <h3 className="text-[16px] font-semibold pt-2">Archivos del expediente</h3>
      {d.archivos.length === 0 && <p className="text-[15px] text-fg-2">Aún no hay archivos.</p>}
      {d.archivos.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-3 py-2 border-b border-line text-[15px]">
          <span className="flex-[1_1_240px] min-w-0">{a.tipo_texto}<span className="block text-[13px] text-fg-3 truncate">{a.nombre} · {fechaCL(a.subido_en)}</span></span>
          <Button variante="secundario" tamano="sm" iconoInicio={<Download className="size-4" strokeWidth={2} />}
            onClick={() => void descargar(`/karin/denuncias/${d.id}/archivos/${a.id}/`, a.nombre)}>Descargar</Button>
        </div>
      ))}
      {!cerrada && <Button variante="secundario" className="self-start" onClick={() => setAbierto(true)} iconoInicio={<Upload className="size-4" strokeWidth={2} />}>Subir archivo escaneado</Button>}
      {abierto && (
        <Drawer abierto onCerrar={() => !subiendo && setAbierto(false)} titulo="Subir archivo"
          subtitulo="PDF, JPG o PNG de hasta 15 MB. Se guarda cifrado."
          acciones={<>
            <Button variante="secundario" onClick={() => setAbierto(false)} disabled={subiendo}>Cancelar</Button>
            <Button onClick={() => void subir()} cargando={subiendo} disabled={!archivo || !tipo}>Subir</Button>
          </>}>
          <div className="flex flex-col gap-4">
            <Selector id="ar-tipo" etiqueta="Qué es" valor={tipo} onChange={setTipo} opciones={catalogos.archivos} />
            {tipo === 'ACTA_DECLARACION' && (
              <Selector id="ar-participante" etiqueta="De quién es la declaración" valor={participante} onChange={setParticipante}
                opciones={(d.investigacion.participantes ?? []).map((p) => ({ valor: p.id, texto: p.nombre }))} />
            )}
            <label htmlFor="ar-archivo" className="flex flex-col gap-1.5 text-[13.5px] font-medium text-fg-2">
              Archivo
              <input id="ar-archivo" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="text-[15px]" />
            </label>
          </div>
        </Drawer>
      )}
    </Seccion>
  );
}
