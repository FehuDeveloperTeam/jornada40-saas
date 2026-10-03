import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Download, LogOut, Mail, PenLine, ShieldCheck } from 'lucide-react';
import { AlertaError, Button, CampoCodigo, CampoRut, Chip, CierreInactividad, Field, FirmaPad, Input, J40Root, Logo, Modal, ToggleTema } from '../../components/j40';
import type { TonoChip } from '../../components/j40';
import { inspeccion, mensajeError } from '../../api/inspeccion';
import type { DocumentoInspeccion, SesionInspeccion, TipoDocumentoInspeccion } from '../../types';
import { fechaCL } from '../../utils/formato';
import { validateRut } from '../../utils/rutUtils';
import { cn } from '../../utils/cn';
import { marcarActividad } from '../../utils/actividad';

const CLAVE_SESION = ['inspeccion', 'yo'] as const;
const CONTROL = 'h-10 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';

const TIPOS: { valor: TipoDocumentoInspeccion; texto: string }[] = [
  { valor: 'CONTRATO', texto: 'Contratos' }, { valor: 'ANEXO', texto: 'Anexos' }, { valor: 'LIQUIDACION', texto: 'Liquidaciones' },
  { valor: 'CARTA', texto: 'Cartas y constancias' }, { valor: 'VACACION', texto: 'Vacaciones y permisos' },
  { valor: 'FINIQUITO', texto: 'Finiquitos' }, { valor: 'PACTO', texto: 'Pactos y autorizaciones' },
];
const ESTADO_FIRMA: Record<string, { texto: string; tono: TonoChip }> = {
  FIRMADO: { texto: 'Firmado', tono: 'ok' }, PENDIENTE: { texto: 'En firma', tono: 'aviso' }, PROCESANDO: { texto: 'En firma', tono: 'aviso' },
  RECHAZADO: { texto: 'Rechazado', tono: 'peligro' }, EXPIRADO: { texto: 'Firma vencida', tono: 'neutro' },
};

/**
 * Portal de fiscalización (Dictamen 0789/15): el inspector de la DT entra con
 * el RUT del empleador y su correo institucional, sin intervención del
 * empleador, y consulta, descarga y ratifica todos los documentos laborales.
 */
export default function Inspeccion() {
  const queryClient = useQueryClient();
  const sesion = useQuery({ queryKey: CLAVE_SESION, queryFn: inspeccion.yo, retry: false });
  const sinSesion = sesion.isError && isAxiosError(sesion.error) && [401, 403].includes(sesion.error.response?.status ?? 0);
  const salir = async () => {
    await inspeccion.salir().catch(() => undefined);
    // Sin la cookie, la sesión vuelve a consultarse y responde 403: se muestra el ingreso.
    queryClient.removeQueries({ queryKey: ['inspeccion'], predicate: (q) => q.queryKey[1] !== 'yo' });
    await queryClient.resetQueries({ queryKey: CLAVE_SESION });
  };

  return (
    <J40Root className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="max-w-[1180px] mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" aria-label="Jornada40, inicio" className="no-underline hover:no-underline"><Logo tamano={28} /></Link>
          <span className="text-[13px] text-fg-3 hidden sm:inline">Portal de fiscalización · Dirección del Trabajo</span>
          <span className="flex-1" />
          <ToggleTema />
          {sesion.data && (
            <Button variante="fantasma" tamano="sm" iconoInicio={<LogOut className="size-4" strokeWidth={2} />}
              onClick={() => void salir()}>
              Salir
            </Button>
          )}
          {sesion.data && (
            <CierreInactividad acceso="inspeccion" minutos={15} alVencer={() => void salir()} latido={inspeccion.yo} />
          )}
        </div>
      </header>
      <main className="max-w-[1180px] mx-auto px-4 py-8 flex flex-col gap-6">
        {sesion.isLoading && <p className="text-[13px] text-fg-3" role="status">Cargando…</p>}
        {sinSesion && <Ingreso alEntrar={(s) => { marcarActividad('inspeccion'); queryClient.setQueryData(CLAVE_SESION, s); }} />}
        {sesion.isError && !sinSesion && <AlertaError>No pudimos conectar. Intenta de nuevo en unos minutos.</AlertaError>}
        {sesion.data && <Fiscalizacion sesion={sesion.data} />}
      </main>
    </J40Root>
  );
}

function Ingreso({ alEntrar }: { alEntrar: (s: SesionInspeccion) => void }) {
  const [datos, setDatos] = useState({ rut_empresa: '', nombre: '', rut: '', correo: '' });
  const [paso, setPaso] = useState<'datos' | 'codigo'>('datos');
  const [codigo, setCodigo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const poner = (k: keyof typeof datos, v: string) => { setDatos((d) => ({ ...d, [k]: v })); setError(''); };

  const pedir = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!validateRut(datos.rut_empresa)) return setError('Ingresa un RUT de empleador válido.');
    if (datos.nombre.trim().length < 5 || !validateRut(datos.rut)) return setError('Ingresa tu nombre completo y tu RUT.');
    setEnviando(true);
    setError('');
    try {
      setMensaje((await inspeccion.ingreso(datos)).mensaje);
      setCodigo('');
      setPaso('codigo');
    } catch (err) {
      setError(mensajeError(err, 'No pudimos enviar el código.'));
    } finally {
      setEnviando(false);
    }
  };

  const verificar = async (valor: string) => {
    setEnviando(true);
    setError('');
    try {
      alEntrar(await inspeccion.verificar({ rut_empresa: datos.rut_empresa, correo: datos.correo, codigo: valor }));
    } catch (err) {
      setError(mensajeError(err, 'No pudimos verificar el código.'));
      setCodigo('');
      setEnviando(false);
    }
  };

  return (
    <section className="max-w-[520px] w-full mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-[clamp(22px,3vw,28px)] font-semibold tracking-[-0.02em]">Acceso para fiscalización</h1>
        <p className="text-[14px] text-fg-2 mt-1">
          Para inspectores de la Dirección del Trabajo. Ingresa el RUT del empleador y tu correo institucional: te enviamos un código de un
          solo uso. El acceso queda registrado.
        </p>
      </div>
      {error && <AlertaError>{error}</AlertaError>}
      {paso === 'datos' ? (
        <form onSubmit={pedir} className="flex flex-col gap-4" noValidate>
          <CampoRut etiqueta="RUT del empleador" valor={datos.rut_empresa} onChange={(v) => poner('rut_empresa', v)} />
          <Field etiqueta="Tu nombre completo">{(p) => <Input {...p} value={datos.nombre} onChange={(e) => poner('nombre', e.target.value)} autoComplete="name" />}</Field>
          <CampoRut etiqueta="Tu RUT" valor={datos.rut} onChange={(v) => poner('rut', v)} />
          <Field etiqueta="Correo institucional" ayuda="Solo correos @dt.gob.cl.">
            {(p) => <Input {...p} type="email" value={datos.correo} onChange={(e) => poner('correo', e.target.value)} autoComplete="email" placeholder="nombre@dt.gob.cl" />}
          </Field>
          <Button type="submit" cargando={enviando} className="self-start" iconoInicio={<Mail className="size-4" strokeWidth={2} />}>Enviar código</Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] text-fg-2" role="status">{mensaje}</p>
          <CampoCodigo autoFocus valor={codigo} onChange={setCodigo} onCompleto={(v) => void verificar(v)} deshabilitado={enviando} />
          <button type="button" onClick={() => setPaso('datos')} className="self-start text-[13px] font-medium text-brand-text cursor-pointer">
            Corregir los datos o pedir otro código
          </button>
        </div>
      )}
    </section>
  );
}

function Fiscalizacion({ sesion }: { sesion: SesionInspeccion }) {
  const [pestana, setPestana] = useState<'documentos' | 'trabajadores'>('documentos');
  const trabajadores = useQuery({ queryKey: ['inspeccion', 'trabajadores'], queryFn: inspeccion.trabajadores });
  return (
    <>
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-[clamp(20px,2.6vw,26px)] font-semibold tracking-[-0.015em]">{sesion.empresa.nombre}</h1>
          <p className="text-[13px] text-fg-3">
            RUT {sesion.empresa.rut}{sesion.empresa.direccion ? ` · ${sesion.empresa.direccion}` : ''}
            {sesion.empresa.representante_legal ? ` · Representante legal: ${sesion.empresa.representante_legal}` : ''}
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-[12.5px] text-fg-2">
          <ShieldCheck className="size-4 text-ok" strokeWidth={2} aria-hidden />
          {sesion.inspector.nombre} · {sesion.inspector.correo}
        </p>
      </div>
      <div className="flex gap-1.5" role="tablist" aria-label="Secciones">
        {(['documentos', 'trabajadores'] as const).map((p) => (
          <button key={p} type="button" role="tab" aria-selected={pestana === p} onClick={() => setPestana(p)}
            className={cn('h-9 px-3.5 rounded-full border text-[13px] font-medium',
              pestana === p ? 'bg-brand-soft border-brand text-brand-text' : 'bg-surface border-line text-fg-2 hover:text-fg')}>
            {p === 'documentos' ? 'Documentos' : `Trabajadores${trabajadores.data ? ` (${trabajadores.data.length})` : ''}`}
          </button>
        ))}
      </div>
      {pestana === 'documentos' ? <Documentos trabajadores={trabajadores.data ?? []} /> : (
        <section className="bg-surface border border-line rounded-j40-card shadow-card overflow-x-auto" aria-label="Trabajadores">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-[0.04em] text-fg-3">
                {['Trabajador', 'RUT', 'Cargo', 'Contrato', 'Ingreso', 'Estado'].map((c) => <th key={c} className="px-4 py-2.5 font-medium border-b border-line">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {(trabajadores.data ?? []).map((t) => (
                <tr key={t.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5 font-medium">{t.nombre}</td>
                  <td className="px-4 py-2.5 j40-num">{t.rut}</td>
                  <td className="px-4 py-2.5">{t.cargo}</td>
                  <td className="px-4 py-2.5">{t.tipo_contrato}{t.horas_semanales ? ` · ${String(t.horas_semanales).replace('.', ',')} h` : ''}</td>
                  <td className="px-4 py-2.5 j40-num">{fechaCL(t.fecha_ingreso)}</td>
                  <td className="px-4 py-2.5">{t.activo ? <Chip tono="ok">Vigente</Chip> : <Chip tono="neutro">{`Desvinculado ${fechaCL(t.fecha_desvinculacion)}`}</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function Documentos({ trabajadores }: { trabajadores: { id: number; nombre: string }[] }) {
  const docs = useQuery({ queryKey: ['inspeccion', 'documentos'], queryFn: inspeccion.documentos });
  const [filtro, setFiltro] = useState({ empleado: '', tipo: '', desde: '', hasta: '' });
  const [aviso, setAviso] = useState('');
  const [ratificar, setRatificar] = useState<DocumentoInspeccion | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);
  const visibles = useMemo(() => (docs.data ?? []).filter((d) =>
    (!filtro.empleado || String(d.empleado) === filtro.empleado) && (!filtro.tipo || d.tipo === filtro.tipo)
    && (!filtro.desde || (d.fecha ?? '') >= filtro.desde) && (!filtro.hasta || (d.fecha ?? '') <= filtro.hasta)), [docs.data, filtro]);

  const bajar = async (d: DocumentoInspeccion) => {
    setDescargando(d.clave);
    const error = await inspeccion.descargar(d.clave, `${d.titulo} - ${d.trabajador}.pdf`);
    setDescargando(null);
    if (error) setAviso(error);
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-3">
        <Field etiqueta="Trabajador">
          {(p) => (
            <select {...p} className={CONTROL} value={filtro.empleado} onChange={(e) => setFiltro((f) => ({ ...f, empleado: e.target.value }))}>
              <option value="">Todos</option>
              {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          )}
        </Field>
        <Field etiqueta="Tipo de documento">
          {(p) => (
            <select {...p} className={CONTROL} value={filtro.tipo} onChange={(e) => setFiltro((f) => ({ ...f, tipo: e.target.value }))}>
              <option value="">Todos</option>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
            </select>
          )}
        </Field>
        <Field etiqueta="Desde">{(p) => <Input {...p} type="date" value={filtro.desde} onChange={(e) => setFiltro((f) => ({ ...f, desde: e.target.value }))} />}</Field>
        <Field etiqueta="Hasta">{(p) => <Input {...p} type="date" value={filtro.hasta} onChange={(e) => setFiltro((f) => ({ ...f, hasta: e.target.value }))} />}</Field>
      </div>
      {aviso && <AlertaError>{aviso}</AlertaError>}
      <section className="bg-surface border border-line rounded-j40-card shadow-card" aria-label="Documentos">
        {docs.isLoading && <p className="px-4 py-6 text-[13px] text-fg-3" role="status">Cargando…</p>}
        {docs.isError && <p className="px-4 py-6 text-[13px] text-danger" role="alert">No pudimos cargar los documentos.</p>}
        {docs.isSuccess && (
          <p className="px-4 py-2.5 text-[12px] text-fg-3 border-b border-line">
            {visibles.length} de {docs.data.length} documentos · la descarga entrega la versión firmada, con su certificación, cuando existe.
          </p>
        )}
        {visibles.map((d) => {
          const firma = d.firma ? ESTADO_FIRMA[d.firma.estado] : undefined;
          return (
            <div key={d.clave} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b border-line last:border-b-0">
              <div className="flex-1 min-w-[240px] flex flex-col gap-0.5">
                <span className="text-[13.5px] font-medium">{d.titulo}</span>
                <span className="text-[12px] text-fg-3 j40-num">
                  {d.trabajador} · {d.rut} · {fechaCL(d.fecha)}{d.firma?.folio ? ` · folio ${d.firma.folio}` : ''}
                </span>
                {d.ratificaciones.length > 0 && (
                  <span className="text-[12px] text-ok">Ratificado por {d.ratificaciones.map((r) => r.inspector).join(', ')}</span>
                )}
              </div>
              {firma ? <Chip tono={firma.tono}>{firma.texto}</Chip> : <Chip tono="neutro">Sin firma electrónica</Chip>}
              <Button variante="secundario" tamano="sm" cargando={descargando === d.clave} onClick={() => void bajar(d)}
                aria-label={`Descargar ${d.titulo} de ${d.trabajador}`} iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>
              <Button variante="fantasma" tamano="sm" onClick={() => setRatificar(d)} aria-label={`Ratificar ${d.titulo} de ${d.trabajador}`}
                iconoInicio={<PenLine className="size-4" strokeWidth={2} />}>Ratificar</Button>
            </div>
          );
        })}
      </section>
      {ratificar && <ModalRatificar doc={ratificar} onCerrar={() => setRatificar(null)} />}
    </section>
  );
}

function ModalRatificar({ doc, onCerrar }: { doc: DocumentoInspeccion; onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const [firma, setFirma] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const confirmar = async () => {
    if (!firma) return setError('Dibuja tu firma.');
    setEnviando(true);
    try {
      await inspeccion.ratificar(doc.clave, firma);
      await queryClient.invalidateQueries({ queryKey: ['inspeccion', 'documentos'] });
      onCerrar();
    } catch (err) {
      setError(mensajeError(err, 'No pudimos registrar la ratificación.'));
      setEnviando(false);
    }
  };
  return (
    <Modal abierto onCerrar={() => !enviando && onCerrar()} titulo="Ratificar documento" subtitulo={`${doc.titulo} · ${doc.trabajador}`}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
        <Button onClick={() => void confirmar()} cargando={enviando}>Ratificar con mi firma</Button>
      </>}>
      <div className="flex flex-col gap-3">
        {error && <AlertaError>{error}</AlertaError>}
        <p className="text-[13px] text-fg-2">Tu firma, nombre, RUT, correo, fecha y hora se agregan como página final del documento y quedan en la bitácora.</p>
        <FirmaPad onChange={(v) => { setFirma(v); setError(''); }} etiqueta="Firma del inspector" />
      </div>
    </Modal>
  );
}
