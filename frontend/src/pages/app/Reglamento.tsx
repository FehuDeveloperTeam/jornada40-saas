import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { CircleCheck, Download, FileText, Lock, Megaphone, Send, ShieldAlert, TriangleAlert, Upload } from 'lucide-react';
import { AlertaError, Button, Casilla, Chip, Field, Input } from '../../components/j40';
import type { TonoChip } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import { BotonEnlace } from '../../components/app/carpeta/comun';
import client from '../../api/client';
import { descargar } from '../../api/descargas';
import { usePermisos } from '../../hooks/usePermisos';
import type { EntregaTrabajador, EnvioMasivo, EstadoLeyKarin, EstadoReglamento } from '../../types';
import { fechaCL, hoyISO } from '../../utils/formato';

const CONTROL = 'h-11 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[15px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';
const TIPO_TEXTO = { RIOHS: 'Reglamento Interno de Orden, Higiene y Seguridad', RIHS: 'Reglamento Interno de Higiene y Seguridad' };
const ESTADO: Record<string, { texto: string; tono: TonoChip }> = {
  FIRMADO: { texto: 'Firmó', tono: 'ok' }, PENDIENTE: { texto: 'Por firmar', tono: 'aviso' },
  PROCESANDO: { texto: 'Por firmar', tono: 'aviso' }, RECHAZADO: { texto: 'Rechazó', tono: 'peligro' },
  EXPIRADO: { texto: 'Venció', tono: 'peligro' }, SIN_ENVIAR: { texto: 'Sin enviar', tono: 'neutro' },
};

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

function Paso({ numero, titulo, children, icono }: { numero?: number; titulo: string; children: ReactNode; icono?: ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card p-5 flex flex-col gap-4">
      <h2 className="flex items-center gap-3 text-[18px] font-semibold">
        {numero != null
          ? <span className="size-8 shrink-0 rounded-full bg-brand text-white grid place-items-center text-[15px]" aria-hidden>{numero}</span>
          : icono}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2.5 items-start rounded-[10px] bg-warn-soft text-warn px-4 py-3 text-[14px] leading-relaxed">
      <TriangleAlert className="size-5 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />{children}
    </p>
  );
}

function ListaEntrega({ filas }: { filas: EntregaTrabajador[] }) {
  if (filas.length === 0) return <p className="text-[14px] text-fg-3">No hay trabajadores activos.</p>;
  return (
    <ul className="flex flex-col border border-line rounded-[10px]" aria-label="Trabajadores">
      {filas.map((f) => {
        const e = f.estado ? ESTADO[f.estado] ?? ESTADO.SIN_ENVIAR : ESTADO.SIN_ENVIAR;
        return (
          <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-b border-line last:border-b-0 text-[14px]">
            <span className="flex-1 min-w-[160px]">{f.nombre}</span>
            {!f.correo && <span className="text-[12.5px] text-fg-3">Sin correo</span>}
            <Chip tono={e.tono}>{e.texto}</Chip>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Reglamento interno (plantilla por rubro, versión vigente, plazos y entrega)
 * y aviso semestral de canales de denuncia de la Ley Karin. Plan Pyme.
 */
export default function Reglamento() {
  const { empresa, nivel, cargandoPlan } = usePanelContexto();
  // Solo lectura en Seguridad: se ve el estado y se descargan plantilla y reglamento, sin subir ni enviar.
  const gestionar = usePermisos().puede('SEGURIDAD', true);
  const reglamento = useQuery({
    queryKey: ['reglamento', empresa.id],
    queryFn: async () => (await client.get<EstadoReglamento>(`/reglamentos/?empresa=${empresa.id}`)).data,
  });
  const karin = useQuery({
    queryKey: ['ley-karin', empresa.id],
    queryFn: async () => (await client.get<EstadoLeyKarin>(`/ley-karin/?empresa=${empresa.id}`)).data,
  });

  return (
    <div className="max-w-[900px] mx-auto flex flex-col gap-5 pb-20">
      <div>
        <h1 className="text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.015em]">Reglamento y seguridad</h1>
        <p className="text-[14px] text-fg-3 mt-1">El reglamento interno, la información de riesgos a sus trabajadores y el aviso de canales de denuncia (Ley Karin).</p>
      </div>
      {cargandoPlan || reglamento.isLoading ? <p className="text-[15px] text-fg-3" role="status">Cargando…</p>
        : !reglamento.data ? <AlertaError>{mensaje(reglamento.error, 'No pudimos cargar el reglamento.')}</AlertaError>
          : nivel < 3 || !reglamento.data.permitido ? (
            <Paso titulo="Disponible desde el plan Pyme" icono={<Lock className="size-6 text-fg-3" strokeWidth={2} aria-hidden />}>
              <p className="text-[15px] text-fg-2 leading-relaxed">
                Prepare su reglamento con una plantilla para su rubro, entréguelo a sus trabajadores con firma electrónica
                y cumpla el aviso semestral de canales de denuncia de la Ley Karin.
              </p>
              <BotonEnlace a="/app/plan" primario>Ver planes</BotonEnlace>
            </Paso>
          ) : (
            <>
              {reglamento.data.avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
              <PasoPlantilla estado={reglamento.data} />
              {gestionar && <PasoSubir estado={reglamento.data} />}
              {reglamento.data.actual && <PasoVigente estado={reglamento.data} />}
              <SeccionRiesgos estado={reglamento.data} />
              {karin.data && <SeccionLeyKarin estado={karin.data} />}
            </>
          )}
    </div>
  );
}

function PasoPlantilla({ estado }: { estado: EstadoReglamento }) {
  const { empresa, avisar } = usePanelContexto();
  const [rubro, setRubro] = useState('');
  const [bajando, setBajando] = useState<string | null>(null);
  const bajar = async (formato: 'docx' | 'pdf') => {
    setBajando(formato);
    const error = await descargar(`/reglamentos/plantilla/?empresa=${empresa.id}&rubro=${rubro}&formato=${formato}`,
      `Plantilla_reglamento.${formato}`);
    setBajando(null);
    if (error) avisar(error, 'error');
  };
  return (
    <Paso numero={1} titulo="Prepare su reglamento con la plantilla">
      <p className="text-[15px] leading-relaxed">
        Su empresa tiene <b>{estado.trabajadores} {estado.trabajadores === 1 ? 'trabajador' : 'trabajadores'}</b>:
        le corresponde un <b>{TIPO_TEXTO[estado.tipo_sugerido]}</b>
        {estado.tipo_sugerido === 'RIHS' ? ' (con 10 o más trabajadores pasa a ser de Orden, Higiene y Seguridad)' : ''}.
      </p>
      <Field etiqueta="Rubro de su empresa">
        {(props) => (
          <select {...props} className={CONTROL} value={rubro} onChange={(e) => setRubro(e.target.value)}>
            <option value="">Elija su rubro…</option>
            {estado.rubros.map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
          </select>
        )}
      </Field>
      <Aviso>
        La plantilla es solo una guía. Complétela con las reglas propias de su negocio (lo marcado en amarillo),
        idealmente con su asesor o su mutualidad, antes de publicarla.
      </Aviso>
      <div className="flex flex-wrap gap-2.5">
        <Button tamano="lg" disabled={!rubro} cargando={bajando === 'docx'} onClick={() => void bajar('docx')}
          iconoInicio={<Download className="size-5" strokeWidth={2} />}>Descargar en Word para completar</Button>
        <Button tamano="lg" variante="secundario" disabled={!rubro} cargando={bajando === 'pdf'} onClick={() => void bajar('pdf')}
          iconoInicio={<FileText className="size-5" strokeWidth={2} />}>Ver en PDF</Button>
      </div>
    </Paso>
  );
}

function PasoSubir({ estado }: { estado: EstadoReglamento }) {
  const { empresa, avisar } = usePanelContexto();
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<'RIOHS' | 'RIHS'>(estado.tipo_sugerido);
  const [fecha, setFecha] = useState(hoyISO());
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  const subir = async () => {
    if (!archivo) return;
    setSubiendo(true);
    setError('');
    const datos = new FormData();
    datos.append('empresa', String(empresa.id));
    datos.append('tipo', tipo);
    datos.append('publicado_en', fecha);
    datos.append('archivo', archivo);
    try {
      await client.post('/reglamentos/', datos, { headers: { 'Content-Type': 'multipart/form-data' } });
      await queryClient.invalidateQueries({ queryKey: ['reglamento', empresa.id] });
      setArchivo(null);
      avisar('Reglamento guardado');
    } catch (err) {
      setError(mensaje(err, 'No pudimos guardar el reglamento.'));
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <Paso numero={2} titulo={estado.actual ? 'Suba una versión nueva (si lo cambió)' : 'Suba su reglamento terminado'}>
      {error && <AlertaError>{error}</AlertaError>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3.5">
        <Field etiqueta="Tipo de reglamento">
          {(props) => (
            <select {...props} className={CONTROL} value={tipo} onChange={(e) => setTipo(e.target.value as 'RIOHS' | 'RIHS')}>
              <option value="RIOHS">{TIPO_TEXTO.RIOHS}</option>
              <option value="RIHS">{TIPO_TEXTO.RIHS}</option>
            </select>
          )}
        </Field>
        <Field etiqueta="Día en que lo da a conocer a sus trabajadores" ayuda="Rige 30 días después (Art. 156).">
          {(props) => <Input {...props} type="date" max={hoyISO()} value={fecha} onChange={(e) => setFecha(e.target.value)} />}
        </Field>
      </div>
      <Field etiqueta="Archivo del reglamento (PDF)">
        {(props) => (
          <input {...props} type="file" accept="application/pdf,.pdf" className="text-[15px] file:mr-3 file:h-10 file:px-4 file:rounded-[8px] file:border file:border-line-strong file:bg-surface-2 file:text-fg file:font-medium"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        )}
      </Field>
      <p className="text-[13.5px] text-fg-2">Desde ese día, publíquelo en dos lugares visibles de su lugar de trabajo.</p>
      <Button tamano="lg" className="self-start" disabled={!archivo} cargando={subiendo} onClick={() => void subir()}
        iconoInicio={<Upload className="size-5" strokeWidth={2} />}>Guardar reglamento</Button>
    </Paso>
  );
}

function PasoVigente({ estado }: { estado: EstadoReglamento }) {
  const { empresa, avisar } = usePanelContexto();
  const queryClient = useQueryClient();
  const r = estado.actual!;
  const gestionar = usePermisos().puede('SEGURIDAD', true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [omitidas, setOmitidas] = useState<EnvioMasivo['omitidas']>([]);
  const faltan = estado.entrega.trabajadores.filter((t) => !t.estado || !['FIRMADO', 'PENDIENTE', 'PROCESANDO'].includes(t.estado));
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['reglamento', empresa.id] });

  const remitir = async (destino: 'DT' | 'SALUD', deshacer = false) => {
    setOcupado(destino);
    try {
      await client.post(`/reglamentos/${r.id}/remision/`, { destino, deshacer });
      await refrescar();
    } catch (err) {
      avisar(mensaje(err, 'No pudimos guardar el cambio.'), 'error');
    } finally {
      setOcupado(null);
    }
  };
  const entregar = async () => {
    setOcupado('entregar');
    try {
      const { data } = await client.post<EnvioMasivo>(`/reglamentos/${r.id}/entregar/`, {});
      setOmitidas(data.omitidas);
      await refrescar();
      avisar(data.enviadas ? `Reglamento enviado a firma a ${data.enviadas} ${data.enviadas === 1 ? 'trabajador' : 'trabajadores'}` : 'No había a quién enviar');
    } catch (err) {
      avisar(mensaje(err, 'No pudimos enviar el reglamento.'), 'error');
    } finally {
      setOcupado(null);
    }
  };
  const pdf = async () => {
    const error = await descargar(`/reglamentos/${r.id}/pdf/`, `Reglamento_v${r.version}.pdf`);
    if (error) avisar(error, 'error');
  };

  const Remision = ({ destino, texto, fecha }: { destino: 'DT' | 'SALUD'; texto: string; fecha: string | null }) => (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 text-[14.5px]">
      {fecha ? <CircleCheck className="size-5 text-ok" strokeWidth={2} aria-hidden /> : <Send className="size-5 text-fg-3" strokeWidth={2} aria-hidden />}
      <span className="flex-1 min-w-[200px]">{texto}{fecha ? ` · enviado el ${fechaCL(fecha)}` : ''}</span>
      {!gestionar ? null : fecha
        ? <Button variante="fantasma" tamano="sm" cargando={ocupado === destino} onClick={() => void remitir(destino, true)}>Deshacer</Button>
        : <Button variante="secundario" cargando={ocupado === destino} onClick={() => void remitir(destino)}>Ya lo envié</Button>}
    </li>
  );

  return (
    <Paso numero={3} titulo="Entréguelo y envíelo a las autoridades">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 min-w-[240px] text-[15px] leading-relaxed">
          <b>{r.tipo_texto}</b>, versión {r.version}. {r.rige ? 'Rige' : 'Regirá'} desde el <b>{fechaCL(r.vigente_desde)}</b>.
        </p>
        <Button variante="secundario" onClick={() => void pdf()} iconoInicio={<Download className="size-4" strokeWidth={2} />}>Ver reglamento</Button>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[15.5px] font-semibold">Envíelo a más tardar el {fechaCL(r.plazo_remision)}</h3>
        <ul className="flex flex-col border border-line rounded-[10px]">
          <Remision destino="DT" texto="Dirección del Trabajo (en Mi DT, trámite «Reglamento interno»)" fecha={r.remitido_dt_en} />
          <Remision destino="SALUD" texto="Seremi de Salud de su región" fecha={r.remitido_salud_en} />
        </ul>
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-[15.5px] font-semibold">
          Entrega a sus trabajadores: {estado.entrega.firmados} de {estado.entrega.total} firmaron la recepción
        </h3>
        <p className="text-[13.5px] text-fg-2">
          Cada trabajador recibe por correo el reglamento completo y firma una constancia de recepción (Art. 156). A los trabajadores nuevos se les envía solo, junto con su contrato.
        </p>
        {faltan.length > 0 && gestionar && (
          <Button tamano="lg" className="self-start" cargando={ocupado === 'entregar'} onClick={() => void entregar()}
            iconoInicio={<Send className="size-5" strokeWidth={2} />}>
            Enviar a firma a {faltan.length === 1 ? '1 trabajador' : `${faltan.length} trabajadores`}
          </Button>
        )}
        {omitidas.length > 0 && (
          <Aviso>No se envió a: {omitidas.map((o) => `${o.nombre} (${o.motivo.replace(/\.$/, '').toLowerCase()})`).join(', ')}.</Aviso>
        )}
        <ListaEntrega filas={estado.entrega.trabajadores} />
      </div>
    </Paso>
  );
}

function SeccionLeyKarin({ estado }: { estado: EstadoLeyKarin }) {
  const { empresa, avisar } = usePanelContexto();
  const queryClient = useQueryClient();
  const [responsable, setResponsable] = useState(estado.canal.responsable);
  const [correo, setCorreo] = useState(estado.canal.correo);
  const gestionar = usePermisos().puede('SEGURIDAD', true);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [omitidas, setOmitidas] = useState<EnvioMasivo['omitidas']>([]);
  const guardado = Boolean(estado.canal.responsable && estado.canal.correo);
  const cambios = responsable !== estado.canal.responsable || correo !== estado.canal.correo;
  const faltan = estado.avance.total - estado.avance.enviados;
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['ley-karin', empresa.id] });

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      await client.post('/ley-karin/canal/', { empresa: empresa.id, responsable, correo });
      await refrescar();
      avisar('Canal de denuncias guardado');
    } catch (err) {
      setError(mensaje(err, 'No pudimos guardar el canal.'));
    } finally {
      setGuardando(false);
    }
  };
  const informar = async () => {
    setEnviando(true);
    try {
      const { data } = await client.post<EnvioMasivo>('/ley-karin/informar/', { empresa: empresa.id });
      setOmitidas(data.omitidas);
      await refrescar();
      avisar(data.enviadas ? `Aviso enviado a firma a ${data.enviadas} ${data.enviadas === 1 ? 'trabajador' : 'trabajadores'}` : 'No había a quién enviar');
    } catch (err) {
      avisar(mensaje(err, 'No pudimos enviar el aviso.'), 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Paso titulo="Ley Karin: aviso de canales de denuncia" icono={<Megaphone className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
      <p className="text-[15px] leading-relaxed">
        Cada semestre debe informar a todos sus trabajadores dónde denunciar acoso o violencia en el trabajo. El aviso
        incluye su canal interno, la Dirección del Trabajo, {estado.mutual} y la Superintendencia de Seguridad Social, y cada
        trabajador firma que lo recibió.
      </p>
      {error && <AlertaError>{error}</AlertaError>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3.5">
        <Field etiqueta="Quién recibe las denuncias (persona o cargo)">
          {(props) => <Input {...props} disabled={!gestionar} value={responsable} maxLength={120} onChange={(e) => setResponsable(e.target.value)} placeholder="Ej.: Jefa de personas" />}
        </Field>
        <Field etiqueta="Correo para denuncias">
          {(props) => <Input {...props} disabled={!gestionar} type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="denuncias@suempresa.cl" />}
        </Field>
      </div>
      {cambios && gestionar && (
        <Button variante="secundario" className="self-start" cargando={guardando} onClick={() => void guardar()}>Guardar canal</Button>
      )}
      <div className="flex flex-col gap-2.5 pt-2 border-t border-line">
        <h3 className="text-[15.5px] font-semibold">
          {estado.semestre.texto[0].toUpperCase() + estado.semestre.texto.slice(1)}: informado a {estado.avance.enviados} de {estado.avance.total}
          {' '}· plazo {fechaCL(estado.semestre.hasta)}
        </h3>
        {faltan > 0 && gestionar && (
          <Button tamano="lg" className="self-start" disabled={!guardado || cambios} cargando={enviando} onClick={() => void informar()}
            iconoInicio={<Send className="size-5" strokeWidth={2} />}>
            Enviar el aviso a {faltan === 1 ? '1 trabajador' : `${faltan} trabajadores`}
          </Button>
        )}
        {!guardado && gestionar && <p className="text-[13.5px] text-fg-3">Primero guarde su canal interno de denuncias.</p>}
        {omitidas.length > 0 && (
          <Aviso>No se envió a: {omitidas.map((o) => `${o.nombre} (${o.motivo.replace(/\.$/, '').toLowerCase()})`).join(', ')}.</Aviso>
        )}
        <ListaEntrega filas={estado.avance.trabajadores} />
      </div>
    </Paso>
  );
}

function SeccionRiesgos({ estado }: { estado: EstadoReglamento }) {
  const { empresa, avisar } = usePanelContexto();
  const queryClient = useQueryClient();
  const r = estado.riesgos;
  const gestionar = usePermisos().puede('SEGURIDAD', true);
  const [rubro, setRubro] = useState(r.rubro);
  const [marcados, setMarcados] = useState<string[]>(r.rubro ? r.por_rubro[r.rubro] ?? [] : []);
  const [fecha, setFecha] = useState(hoyISO());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [omitidas, setOmitidas] = useState<EnvioMasivo['omitidas']>([]);
  const faltan = r.trabajadores.filter((t) => !t.estado || !['FIRMADO', 'PENDIENTE', 'PROCESANDO'].includes(t.estado)).length;
  const visibles = r.catalogo.filter((c) => marcados.includes(c.valor) || (rubro && (c.valor.startsWith(`${rubro}_`) || c.valor.startsWith('COMUN_'))));

  const informar = async () => {
    setEnviando(true);
    setError('');
    try {
      const { data } = await client.post<EnvioMasivo>('/reglamentos/informar_riesgos/', {
        empresa: empresa.id, rubro, riesgos: marcados, fecha_capacitacion: fecha });
      setOmitidas(data.omitidas);
      await queryClient.invalidateQueries({ queryKey: ['reglamento', empresa.id] });
      avisar(data.enviadas ? `Información de riesgos enviada a firma a ${data.enviadas} ${data.enviadas === 1 ? 'trabajador' : 'trabajadores'}` : 'No había a quién enviar');
    } catch (err) {
      setError(mensaje(err, 'No pudimos enviar la información de riesgos.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Paso titulo="Información de riesgos del trabajo" icono={<ShieldAlert className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
      <p className="text-[15px] leading-relaxed">
        Antes de empezar a trabajar, y cada vez que cambie de puesto o de proceso, cada trabajador debe conocer los riesgos
        de su trabajo y cómo prevenirlos (Art. 15 del DS 44). Aquí lo informa a todos los que faltan; para uno en particular
        o para la entrega de elementos de protección, use la carpeta del trabajador → Documentos.
      </p>
      {error && <AlertaError>{error}</AlertaError>}
      {gestionar && (
        <>
          <Field etiqueta="Rubro de su empresa">
            {(props) => (
              <select {...props} className={CONTROL} value={rubro}
                onChange={(e) => { setRubro(e.target.value); setMarcados(r.por_rubro[e.target.value] ?? []); }}>
                <option value="">Elija su rubro…</option>
                {estado.rubros.map((x) => <option key={x.valor} value={x.valor}>{x.texto}</option>)}
              </select>
            )}
          </Field>
          {visibles.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[13.5px] font-medium text-fg-2 mb-1">Riesgos que se informan (desmarque los que no apliquen)</legend>
              {visibles.map((c) => (
                <Casilla key={c.valor} marcada={marcados.includes(c.valor)}
                  onChange={(m) => setMarcados((x) => (m ? [...x, c.valor] : x.filter((y) => y !== c.valor)))}>{c.texto}</Casilla>
              ))}
            </fieldset>
          )}
          <Field etiqueta="Fecha de la capacitación presencial en procedimientos de trabajo seguro"
            ayuda="Se enseñan en persona (DT, ORD 374/2024); la constancia deja registro de lo informado.">
            {(props) => <Input {...props} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />}
          </Field>
        </>
      )}
      <div className="flex flex-col gap-2.5 pt-2 border-t border-line">
        <h3 className="text-[15.5px] font-semibold">Informados: {r.firmados} de {r.total} firmaron</h3>
        {faltan > 0 && gestionar && (
          <Button tamano="lg" className="self-start" disabled={!rubro || marcados.length === 0 || !fecha} cargando={enviando}
            onClick={() => void informar()} iconoInicio={<Send className="size-5" strokeWidth={2} />}>
            Enviar a firma a {faltan === 1 ? '1 trabajador' : `${faltan} trabajadores`}
          </Button>
        )}
        {omitidas.length > 0 && (
          <Aviso>No se envió a: {omitidas.map((o) => `${o.nombre} (${o.motivo.replace(/\.$/, '').toLowerCase()})`).join(', ')}.</Aviso>
        )}
        <ListaEntrega filas={r.trabajadores} />
      </div>
    </Paso>
  );
}
