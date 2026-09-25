import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Check, CircleCheck, Clock, Copy, ExternalLink, FilePlus2, FileText, Info, MailWarning, PenLine, RotateCcw, Send, TriangleAlert,
} from 'lucide-react';
import { AlertaError, Button, Chip, Drawer, Field, Input, Modal, SegmentedControl } from '../../components/j40';
import type { TonoChip } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import client from '../../api/client';
import { ModalConsentimientoPapel } from '../../components/app/ModalConsentimientoPapel';
import { useRegistroDT } from '../../hooks/usePanel';
import type {
  EstadoRegistroDT, FichaDT as TFichaDT, ItemRegistroDT, PendienteConsentimiento, ResultadoAnexosConsentimiento, TipoRegistroDT,
} from '../../types';
import { cn } from '../../utils/cn';
import { capitalizar, fechaCL, hoyISO } from '../../utils/formato';

type FiltroEstado = 'por_registrar' | 'registrados' | 'todos';
type FiltroTipo = 'todos' | TipoRegistroDT;

const TIPO: Record<TipoRegistroDT, { texto: string; tono: TonoChip }> = {
  CONTRATO: { texto: 'Contrato', tono: 'marca' },
  ANEXO: { texto: 'Anexo', tono: 'neutro' },
  TERMINO: { texto: 'Término', tono: 'aviso' },
};
const FILTROS_TIPO: [FiltroTipo, string][] = [['todos', 'Todos'], ['CONTRATO', 'Contratos'], ['ANEXO', 'Anexos'], ['TERMINO', 'Términos']];
const COINCIDE_ESTADO: Record<FiltroEstado, (e: EstadoRegistroDT) => boolean> = {
  por_registrar: (e) => e !== 'REGISTRADO',
  registrados: (e) => e === 'REGISTRADO',
  todos: () => true,
};
const MI_DT = 'https://midt.dirtrab.cl';

/** Días hábiles que definen "por vencer" (el mismo umbral que usa el backend en resumen.por_vencer). */
const UMBRAL_POR_VENCER = 3;

const COLUMNAS = 'grid-cols-[28px_minmax(200px,1.6fr)_96px_minmax(200px,2fr)_100px_minmax(150px,1.1fr)_260px]';

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Estado del anexo de consentimiento de quien aún no autoriza. */
function estadoAnexo(p: PendienteConsentimiento): { texto: string; tono: TonoChip } {
  if (!p.anexo) return { texto: 'Sin anexo', tono: 'neutro' };
  switch (p.anexo.firma) {
    case null: return { texto: 'Anexo creado sin enviar', tono: 'marca' };
    case 'PENDIENTE': case 'PROCESANDO': return { texto: 'Enviado a firma', tono: 'aviso' };
    case 'RECHAZADO': return { texto: 'Rechazado', tono: 'peligro' };
    case 'EXPIRADO': return { texto: 'Vencido', tono: 'neutro' };
    case 'CANCELADO': return { texto: 'Cancelado', tono: 'neutro' };
    case 'FIRMADO': return { texto: 'Firmado', tono: 'ok' };
    default: return { texto: 'Sin anexo', tono: 'neutro' };
  }
}

export default function DireccionTrabajo() {
  const { empresa, avisar } = usePanelContexto();
  const queryClient = useQueryClient();
  const registro = useRegistroDT(empresa.id);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('por_registrar');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  // Claves que se van a marcar como registradas (abre el modal de fecha).
  const [marcar, setMarcar] = useState<string[] | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  // Registro cuya ficha para Mi DT está abierta.
  const [ficha, setFicha] = useState<string | null>(null);

  // La selección es por empresa: al cambiar de empresa parte vacía.
  const [empresaSeleccion, setEmpresaSeleccion] = useState(empresa.id);
  if (empresaSeleccion !== empresa.id) {
    setEmpresaSeleccion(empresa.id);
    setSeleccion(new Set());
  }

  const refrescar = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['registro-dt'] }),
    queryClient.invalidateQueries({ queryKey: ['empleados'] }),
  ]);

  if (registro.isLoading) {
    return <Marco><p className="text-[14px] text-fg-3" role="status">Cargando…</p></Marco>;
  }
  if (!registro.data) {
    return (
      <Marco>
        <div className="flex flex-col gap-3 items-start">
          <AlertaError>{mensaje(registro.error, 'No pudimos cargar el registro en la Dirección del Trabajo.')}</AlertaError>
          <Button variante="secundario" onClick={() => void registro.refetch()} cargando={registro.isFetching}
            iconoInicio={<RotateCcw className="size-4" strokeWidth={2} />}>Reintentar</Button>
        </div>
      </Marco>
    );
  }

  const { items, resumen, consentimiento } = registro.data;
  const visibles = items.filter((i) => COINCIDE_ESTADO[filtroEstado](i.estado) && (filtroTipo === 'todos' || i.tipo === filtroTipo));
  const elegidos = visibles.filter((i) => seleccion.has(i.clave));
  const porMarcar = elegidos.filter((i) => i.estado !== 'REGISTRADO');
  const todosElegidos = visibles.length > 0 && elegidos.length === visibles.length;
  const conteoEstado = (f: FiltroEstado) => items.filter((i) => COINCIDE_ESTADO[f](i.estado)).length;

  const alternar = (clave: string) => setSeleccion((s) => {
    const n = new Set(s);
    if (n.has(clave)) n.delete(clave); else n.add(clave);
    return n;
  });
  const alternarTodos = () => setSeleccion(todosElegidos ? new Set() : new Set(visibles.map((i) => i.clave)));

  const desmarcar = async (item: ItemRegistroDT) => {
    setOcupada(`d${item.clave}`);
    try {
      await client.post('/registro-dt/desmarcar/', { empresa: empresa.id, claves: [item.clave] });
      await refrescar();
      avisar('Registro marcado como pendiente de nuevo');
    } catch (err) {
      avisar(mensaje(err, 'No pudimos deshacer el registro.'), 'error');
    } finally {
      setOcupada(null);
    }
  };

  const filaVence = (i: ItemRegistroDT) => {
    if (i.estado === 'REGISTRADO') {
      return <span className="text-ok">Registrado el {fechaCL(i.registrado_en)}</span>;
    }
    if (i.estado === 'VENCIDO') {
      return <span className="text-danger font-medium">Venció el {fechaCL(i.vence)}</span>;
    }
    const dias = i.dias_habiles_restantes;
    const urgente = dias !== null && dias <= UMBRAL_POR_VENCER;
    return (
      <span className="flex flex-col">
        <span className="j40-num">{fechaCL(i.vence)}</span>
        {dias !== null && (
          <span className={cn('text-[11.5px]', urgente ? 'text-warn font-medium' : 'text-fg-3')}>
            {dias <= 0 ? 'Vence hoy' : `En ${plural(dias, 'día hábil', 'días hábiles')}`}
          </span>
        )}
      </span>
    );
  };

  const accionFila = (i: ItemRegistroDT) => (
    <span className="flex flex-wrap justify-end gap-1.5">
      <Button variante={i.estado === 'REGISTRADO' ? 'fantasma' : 'primario'} tamano="sm" onClick={() => setFicha(i.clave)}
        iconoInicio={<FileText className="size-4" strokeWidth={2} />}>Ver ficha</Button>
      {i.estado === 'REGISTRADO' ? (
        <Button variante="fantasma" tamano="sm" cargando={ocupada === `d${i.clave}`} onClick={() => desmarcar(i)}
          iconoInicio={<RotateCcw className="size-4" strokeWidth={2} />}>Deshacer</Button>
      ) : (
        <Button variante="secundario" tamano="sm" onClick={() => setMarcar([i.clave])}
          iconoInicio={<CircleCheck className="size-4" strokeWidth={2} />}>Marcar registrado</Button>
      )}
    </span>
  );

  const detalle = (i: ItemRegistroDT) => (
    <span className="flex flex-col min-w-0">
      <span className="text-fg-2 break-words">{i.detalle}</span>
      {i.sin_causal && <span className="text-[11.5px] text-warn">Sin causal registrada: plazo más corto (3 días hábiles)</span>}
    </span>
  );

  const casilla = (i: ItemRegistroDT) => (
    <input type="checkbox" checked={seleccion.has(i.clave)} onChange={() => alternar(i.clave)}
      aria-label={`Seleccionar ${TIPO[i.tipo].texto.toLowerCase()} de ${capitalizar(i.empleado.nombre)}`}
      className="size-[18px] accent-brand cursor-pointer" />
  );

  const trabajador = (i: ItemRegistroDT) => (
    <span className="flex flex-col min-w-0">
      <Link to={`/app/trabajadores/${i.empleado.id}`} className="font-medium text-fg truncate">{capitalizar(i.empleado.nombre)}</Link>
      <span className="text-[12px] text-fg-3 j40-mono">{i.empleado.rut}{!i.empleado.activo ? ' · desvinculado' : ''}</span>
    </span>
  );

  const pctConsentimiento = consentimiento.total ? Math.round((consentimiento.con / consentimiento.total) * 100) : 0;

  return (
    <Marco>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi t="Vencidos" v={resumen.VENCIDO} Icono={TriangleAlert} tono={resumen.VENCIDO > 0 ? 'peligro' : undefined}
          sub={resumen.VENCIDO ? 'Regístralos cuanto antes en Mi DT' : 'Ninguno fuera de plazo'} />
        <Kpi t="Por vencer" v={resumen.por_vencer} Icono={Clock} tono={resumen.por_vencer > 0 ? 'aviso' : undefined}
          sub={`Vencen en ${UMBRAL_POR_VENCER} días hábiles o menos`} />
        <Kpi t="Pendientes" v={resumen.PENDIENTE} Icono={Info} sub="Dentro del plazo legal" />
        <Kpi t="Registrados" v={resumen.REGISTRADO} Icono={CircleCheck} sub="Marcados como registrados en Mi DT" />
      </div>

      <section className="bg-surface border border-line rounded-j40-card shadow-card flex flex-col">
        <div className="flex flex-col gap-1.5 px-[18px] py-3.5 border-b border-line">
          <h2 className="text-[14px] font-semibold">Registro electrónico laboral</h2>
          <p className="text-[12.5px] text-fg-3 max-w-[860px]">
            La ley obliga a registrar en Mi DT cada contrato y anexo dentro de 15 días hábiles, y el término según la causal.
            Jornada40 calcula los plazos y te arma una ficha con cada dato en el orden del formulario; el registro lo haces tú en{' '}
            <a href={MI_DT} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium">
              Mi DT<ExternalLink className="size-3" strokeWidth={2} aria-hidden />
            </a>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-[18px] py-3 border-b border-line">
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por estado">
            {([['por_registrar', 'Por registrar'], ['registrados', 'Registrados'], ['todos', 'Todos']] as [FiltroEstado, string][]).map(([f, t]) => (
              <button key={f} type="button" onClick={() => setFiltroEstado(f)} aria-pressed={filtroEstado === f}
                className={cn('inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium whitespace-nowrap cursor-pointer',
                  filtroEstado === f ? 'bg-brand-soft border-brand text-brand-text' : 'bg-surface border-line text-fg-2 hover:text-fg')}>
                {t}<span className="text-[11px] opacity-70 j40-num">{conteoEstado(f)}</span>
              </button>
            ))}
          </div>
          <SegmentedControl etiqueta="Filtrar por tipo" valor={filtroTipo} onChange={setFiltroTipo} className="overflow-x-auto max-w-full"
            opciones={FILTROS_TIPO.map(([valor, etiqueta]) => ({ valor, etiqueta }))} />
        </div>

        <div className="flex items-start gap-2.5 mx-[18px] mt-3 px-3.5 py-2.5 rounded-[10px] bg-brand-soft text-brand-text text-[12.5px]">
          <Info className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
          <span>¿Ya registraste antes estos contratos en Mi DT? Márcalos como registrados con la fecha en que lo hiciste.</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-[18px] py-3">
          <span className="text-[12.5px] text-fg-3 flex-1 min-w-[160px]">
            {elegidos.length ? plural(elegidos.length, 'seleccionado', 'seleccionados') : 'Selecciona filas para actuar sobre varias a la vez'}
          </span>
          {porMarcar.length > 0 && (
            <Button tamano="sm" onClick={() => setMarcar(porMarcar.map((i) => i.clave))}
              iconoInicio={<CircleCheck className="size-4" strokeWidth={2} />}>
              Marcar {porMarcar.length} como {porMarcar.length === 1 ? 'registrado' : 'registrados'}
            </Button>
          )}
        </div>

        {/* Escritorio y tablet: tabla */}
        <div className="hidden min-[720px]:block border-t border-line overflow-x-auto">
          <div className="min-w-[1060px]" role="table" aria-label="Registros en la Dirección del Trabajo">
            <div role="row" className={cn('grid gap-3 items-center px-[18px] py-[11px] text-[11.5px] font-medium text-fg-3 bg-surface-2 border-b border-line', COLUMNAS)}>
              <span role="columnheader">
                <input type="checkbox" checked={todosElegidos} onChange={alternarTodos} disabled={!visibles.length}
                  aria-label="Seleccionar todos" className="size-[18px] accent-brand cursor-pointer" />
              </span>
              {['Trabajador', 'Tipo', 'Detalle', 'Fecha', 'Vence'].map((c) => <span key={c} role="columnheader">{c}</span>)}
              <span role="columnheader" className="text-right">Acción</span>
            </div>
            {visibles.map((i) => (
              <div key={i.clave} role="row"
                className={cn('grid gap-3 items-center px-[18px] py-3 border-b border-line last:border-b-0 text-[13px]', COLUMNAS,
                  seleccion.has(i.clave) && 'bg-brand-soft/40')}>
                <span role="cell">{casilla(i)}</span>
                <span role="cell" className="min-w-0">{trabajador(i)}</span>
                <span role="cell"><Chip tono={TIPO[i.tipo].tono}>{TIPO[i.tipo].texto}</Chip></span>
                <span role="cell" className="min-w-0">{detalle(i)}</span>
                <span role="cell" className="text-fg-2 j40-num">{fechaCL(i.fecha)}</span>
                <span role="cell">{filaVence(i)}</span>
                <span role="cell" className="flex justify-end">{accionFila(i)}</span>
              </div>
            ))}
            {visibles.length === 0 && <Vacio total={items.length} />}
          </div>
        </div>

        {/* Móvil: tarjetas */}
        <div className="min-[720px]:hidden flex flex-col gap-2.5 px-3 pb-3">
          {visibles.length > 0 && (
            <label className="flex items-center gap-2.5 px-1 text-[13px] text-fg-2">
              <input type="checkbox" checked={todosElegidos} onChange={alternarTodos} className="size-[18px] accent-brand" />
              Seleccionar todos
            </label>
          )}
          {visibles.map((i) => (
            <div key={i.clave} className={cn('flex flex-col gap-2.5 p-3.5 rounded-j40-card border border-line bg-surface text-[13px]',
              seleccion.has(i.clave) && 'border-brand')}>
              <div className="flex items-start gap-3">
                <span className="pt-0.5">{casilla(i)}</span>
                <span className="flex-1 min-w-0">{trabajador(i)}</span>
                <Chip tono={TIPO[i.tipo].tono}>{TIPO[i.tipo].texto}</Chip>
              </div>
              {detalle(i)}
              <div className="flex flex-wrap items-end justify-between gap-2">
                <span className="flex flex-col text-[12.5px]">
                  <span className="text-fg-3">Fecha {fechaCL(i.fecha)}</span>
                  {filaVence(i)}
                </span>
                {accionFila(i)}
              </div>
            </div>
          ))}
          {visibles.length === 0 && <Vacio total={items.length} />}
        </div>
      </section>

      <Consentimiento empresaId={empresa.id} datos={consentimiento} pct={pctConsentimiento} avisar={avisar} refrescar={refrescar} />

      <FichaMiDT clave={ficha} empresaId={empresa.id} onCerrar={() => setFicha(null)} avisar={avisar}
        onMarcar={(clave) => setMarcar([clave])} />

      <ModalMarcar claves={marcar} empresaId={empresa.id} onCerrar={() => setMarcar(null)}
        alMarcar={async (n) => {
          await refrescar();
          setSeleccion(new Set());
          avisar(n === 1 ? 'Marcado como registrado en Mi DT' : `${n} registros marcados como registrados en Mi DT`);
        }}
        alFallar={(e) => avisar(e, 'error')} />
    </Marco>
  );
}

// ── Consentimiento ───────────────────────────────────────────────────────────

function Consentimiento({ empresaId, datos, pct, avisar, refrescar }: {
  empresaId: number;
  datos: { total: number; con: number; sin: PendienteConsentimiento[] };
  pct: number;
  avisar: (texto: string, tipo?: 'ok' | 'error') => void;
  refrescar: () => Promise<unknown>;
}) {
  const [creando, setCreando] = useState<'enviar' | 'crear' | null>(null);
  const [resultado, setResultado] = useState<{ enviar: boolean; datos: ResultadoAnexosConsentimiento } | null>(null);
  const [papel, setPapel] = useState<PendienteConsentimiento | null>(null);
  const sinCorreo = datos.sin.filter((p) => !p.email.trim()).length;

  const crearAnexos = async (enviar: boolean) => {
    setCreando(enviar ? 'enviar' : 'crear');
    try {
      const { data } = await client.post<ResultadoAnexosConsentimiento>('/registro-dt/anexos_consentimiento/', { empresa: empresaId, enviar });
      await refrescar();
      setResultado({ enviar, datos: data });
    } catch (err) {
      avisar(mensaje(err, 'No pudimos crear los anexos.'), 'error');
    } finally {
      setCreando(null);
    }
  };

  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card flex flex-col">
      <div className="flex flex-col gap-1.5 px-[18px] py-3.5 border-b border-line">
        <h2 className="text-[14px] font-semibold">Consentimiento para documentos electrónicos</h2>
        <p className="text-[12.5px] text-fg-3 max-w-[860px]">
          La DT exige la autorización expresa del trabajador para firmar y enviarle documentos laborales en forma electrónica (Dictamen 0789/15).
          Los contratos nuevos ya incluyen la cláusula; a los trabajadores vigentes se les envía un anexo para que la firmen.
        </p>
      </div>

      <div className="flex flex-col gap-3 px-[18px] py-4 border-b border-line">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
          <span className="text-fg-2">
            <strong className="text-fg font-semibold j40-num">{datos.con} de {datos.total}</strong> trabajadores autorizados
          </span>
          <span className="text-fg-3 j40-num">{pct} %</span>
        </div>
        <div className="h-2 rounded-full bg-sunken overflow-hidden" aria-hidden>
          {/* Ancho calculado: no hay clase de Tailwind para un porcentaje variable. */}
          <div className={cn('h-full rounded-full', pct === 100 ? 'bg-ok' : 'bg-brand')} style={{ width: `${pct}%` }} />
        </div>
        {datos.sin.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button tamano="sm" cargando={creando === 'enviar'} disabled={creando !== null} onClick={() => crearAnexos(true)}
              iconoInicio={<Send className="size-4" strokeWidth={2} />}>Crear y enviar anexos a firma</Button>
            <Button variante="secundario" tamano="sm" cargando={creando === 'crear'} disabled={creando !== null} onClick={() => crearAnexos(false)}
              iconoInicio={<FilePlus2 className="size-4" strokeWidth={2} />}>Solo crear anexos</Button>
          </div>
        )}
        {sinCorreo > 0 && (
          <p className="flex items-start gap-2 text-[12.5px] text-warn">
            <MailWarning className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
            {plural(sinCorreo, 'trabajador no tiene', 'trabajadores no tienen')} correo: no se les puede enviar el anexo a firma.
            Agrégalo en su carpeta o registra la autorización firmada en papel.
          </p>
        )}
      </div>

      {datos.total === 0 ? (
        <p className="px-[18px] py-6 text-[13px] text-fg-3">No hay trabajadores vigentes en esta empresa.</p>
      ) : datos.sin.length === 0 ? (
        <p className="flex items-center gap-2 px-[18px] py-6 text-[13px] text-ok">
          <CircleCheck className="size-4" strokeWidth={2} aria-hidden />Todos los trabajadores vigentes autorizaron los documentos electrónicos.
        </p>
      ) : (
        <div>
          <p className="px-[18px] pt-3 pb-1 text-[12px] font-medium text-fg-3 uppercase tracking-[0.04em]">Faltan por autorizar</p>
          {datos.sin.map((p) => {
            const e = estadoAnexo(p);
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-[18px] py-3 border-b border-line last:border-b-0">
                <span className="flex-1 min-w-[200px] flex flex-col">
                  <Link to={`/app/trabajadores/${p.id}?tab=personal`} className="text-[13.5px] font-medium text-fg">{capitalizar(p.nombre)}</Link>
                  <span className="text-[12px] text-fg-3">
                    <span className="j40-mono">{p.rut}</span>{' · '}
                    {p.email.trim() ? p.email.toLowerCase() : <span className="text-warn">sin correo</span>}
                  </span>
                </span>
                <Chip tono={e.tono}>{e.texto}</Chip>
                <Button variante="secundario" tamano="sm" onClick={() => setPapel(p)}
                  iconoInicio={<PenLine className="size-4" strokeWidth={2} />}>Firmado en papel</Button>
              </div>
            );
          })}
        </div>
      )}

      <Modal abierto={Boolean(resultado)} onCerrar={() => setResultado(null)}
        titulo={resultado?.enviar ? 'Anexos enviados a firma' : 'Anexos creados'}
        acciones={<Button onClick={() => setResultado(null)}>Entendido</Button>}>
        {resultado && (
          <div className="flex flex-col gap-3 text-[13.5px] text-fg-2">
            <ul className="flex flex-col gap-1">
              <li><strong className="text-fg j40-num">{resultado.datos.creados}</strong> {resultado.datos.creados === 1 ? 'anexo creado' : 'anexos creados'}</li>
              {resultado.enviar && (
                <li><strong className="text-fg j40-num">{resultado.datos.enviados}</strong> {resultado.datos.enviados === 1 ? 'enviado' : 'enviados'} a firma por correo</li>
              )}
            </ul>
            {!resultado.enviar && resultado.datos.creados > 0 && (
              <p className="text-[12.5px] text-fg-3">Los encuentras en la carpeta de cada trabajador, en Documentos, para descargarlos o enviarlos a firma.</p>
            )}
            {resultado.datos.omitidos.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium text-fg">No se {resultado.enviar ? 'enviaron' : 'crearon'} ({resultado.datos.omitidos.length}):</span>
                <ul className="flex flex-col gap-1 rounded-[8px] bg-sunken px-3 py-2 text-[12.5px] max-h-[240px] overflow-y-auto">
                  {resultado.datos.omitidos.map((o, i) => (
                    <li key={i}><span className="font-medium text-fg">{capitalizar(o.nombre)}</span>: {o.motivo}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ModalConsentimientoPapel empleado={papel && { id: papel.id, nombre: papel.nombre }} onCerrar={() => setPapel(null)} avisar={avisar} refrescar={refrescar} />
    </section>
  );
}

// ── Marcar como registrado ───────────────────────────────────────────────────

function ModalMarcar({ claves, empresaId, onCerrar, alMarcar, alFallar }: {
  claves: string[] | null; empresaId: number; onCerrar: () => void;
  alMarcar: (marcados: number) => Promise<void>; alFallar: (texto: string) => void;
}) {
  const [fecha, setFecha] = useState(hoyISO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Cada apertura parte con la fecha de hoy.
  const [abiertoCon, setAbiertoCon] = useState<string[] | null>(null);
  if (claves !== abiertoCon) {
    setAbiertoCon(claves);
    if (claves) { setFecha(hoyISO()); setError(''); }
  }

  const guardar = async () => {
    if (!claves) return;
    if (!fecha) { setError('Indica la fecha en que lo registraste en Mi DT.'); return; }
    if (fecha > hoyISO()) { setError('La fecha no puede ser futura.'); return; }
    setGuardando(true);
    setError('');
    try {
      const { data } = await client.post<{ marcados: number }>('/registro-dt/marcar/', { empresa: empresaId, claves, fecha });
      await alMarcar(data.marcados ?? claves.length);
      onCerrar();
    } catch (err) {
      const texto = mensaje(err, 'No pudimos marcar los registros.');
      if (isAxiosError(err) && err.response?.status === 400) setError(texto); else alFallar(texto);
    } finally {
      setGuardando(false);
    }
  };

  const n = claves?.length ?? 0;
  return (
    <Modal abierto={Boolean(claves)} onCerrar={() => !guardando && onCerrar()}
      titulo={n === 1 ? 'Marcar como registrado en Mi DT' : `Marcar ${n} como registrados en Mi DT`}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button onClick={guardar} cargando={guardando}>Marcar como registrado</Button>
      </>}>
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-fg-2">
          Jornada40 no se conecta con Mi DT: esto solo deja constancia de que ya lo registraste. Usa la fecha en que lo hiciste
          (o la que confirmó la DT en la carga masiva).
        </p>
        <Field etiqueta="Fecha de registro en Mi DT" error={error || undefined}>
          {(p) => <Input {...p} type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────────

/**
 * Ficha para el formulario individual de Mi DT: cada dato en el orden de sus
 * etapas, con botón para copiar los textos que el formulario pide pegar.
 */
function FichaMiDT({ clave, empresaId, onCerrar, onMarcar, avisar }: {
  clave: string | null; empresaId: number; onCerrar: () => void; onMarcar: (clave: string) => void;
  avisar: (texto: string, tipo?: 'error') => void;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const consulta = useQuery({
    queryKey: ['registro-dt-ficha', empresaId, clave],
    queryFn: async () => (await client.get<TFichaDT>('/registro-dt/ficha/', { params: { empresa: empresaId, clave } })).data,
    enabled: Boolean(clave),
  });
  const copiar = async (id: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado((c) => (c === id ? null : c)), 1800);
    } catch {
      avisar('Tu navegador no permitió copiar: selecciona el texto y cópialo a mano.', 'error');
    }
  };
  const datos = consulta.data;

  return (
    <Drawer abierto={Boolean(clave)} onCerrar={onCerrar} titulo={datos?.titulo ?? 'Ficha para Mi DT'}
      subtitulo={datos ? `En Mi DT: ${datos.ruta_mi_dt}` : undefined}
      acciones={<>
        <a href={MI_DT} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] border border-line-strong text-[13px] font-medium text-fg">
          Abrir Mi DT<ExternalLink className="size-3.5" strokeWidth={2} aria-hidden />
        </a>
        {datos && datos.estado !== 'REGISTRADO' && (
          <Button onClick={() => { onMarcar(datos.clave); onCerrar(); }}
            iconoInicio={<CircleCheck className="size-4" strokeWidth={2} />}>Ya lo registré</Button>
        )}
      </>}>
      {consulta.isLoading && <p className="text-[13px] text-fg-3" role="status">Cargando…</p>}
      {consulta.isError && <AlertaError>{mensaje(consulta.error, 'No pudimos armar la ficha.')}</AlertaError>}
      {datos && (
        <div className="flex flex-col gap-4">
          {datos.avisos.map((a) => (
            <div key={a} className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-[10px] bg-warn-soft text-warn text-[12.5px]">
              <TriangleAlert className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden /><span>{a}</span>
            </div>
          ))}
          {datos.secciones.map((s) => (
            <section key={s.titulo} className="flex flex-col rounded-[10px] border border-line">
              <h3 className="px-3.5 py-2.5 text-[13px] font-semibold bg-surface-2 border-b border-line rounded-t-[10px]">{s.titulo}</h3>
              <dl className="flex flex-col divide-y divide-line">
                {s.campos.map((c) => {
                  const id = `${s.titulo}|${c.etiqueta}`;
                  const largo = c.valor.length > 80;
                  return (
                    <div key={id} className="px-3.5 py-2.5 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-[12px] text-fg-3">{c.etiqueta}</dt>
                        {c.copiar && c.valor && (
                          <button type="button" onClick={() => void copiar(id, c.valor)}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-text shrink-0 cursor-pointer">
                            {copiado === id
                              ? <><Check className="size-3.5" strokeWidth={2.5} aria-hidden />Copiado</>
                              : <><Copy className="size-3.5" strokeWidth={2} aria-hidden />Copiar</>}
                          </button>
                        )}
                      </div>
                      <dd className={cn('text-[13.5px] text-fg break-words', largo && 'whitespace-pre-wrap rounded-[8px] bg-sunken px-3 py-2 text-[12.5px] leading-relaxed')}>
                        {c.valor || <span className="text-fg-3">—</span>}
                      </dd>
                      {c.nota && <p className="text-[11.5px] text-fg-3">{c.nota}</p>}
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
          <p className="text-[12px] text-fg-3">
            Revisa cada dato antes de enviar: al final Mi DT te pide una declaración jurada de veracidad (Art. 210 del Código Penal).
          </p>
        </div>
      )}
    </Drawer>
  );
}

function Vacio({ total }: { total: number }) {
  return (
    <p className="px-[18px] py-8 text-center text-[13px] text-fg-3">
      {total === 0
        ? 'No hay contratos, anexos ni términos que registrar todavía.'
        : 'Nada coincide con el filtro.'}
    </p>
  );
}

function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[18px] max-w-[1440px] mx-auto">
      <div>
        <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Dirección del Trabajo</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">Plazos de registro en Mi DT y autorización de documentos electrónicos</p>
      </div>
      {children}
    </div>
  );
}

const TONO_KPI = { peligro: 'text-danger', aviso: 'text-warn' } as const;

function Kpi({ t, v, sub, Icono, tono }: {
  t: string; v: number; sub: string; Icono: typeof Info; tono?: keyof typeof TONO_KPI;
}) {
  return (
    <div className="bg-surface border border-line rounded-j40-card shadow-card px-[18px] py-4 flex flex-col gap-1.5 min-w-0">
      <span className="flex items-center justify-between text-[12.5px] text-fg-3">
        {t}<Icono className={cn('size-[19px]', tono ? TONO_KPI[tono] : 'text-fg-3')} strokeWidth={2} aria-hidden />
      </span>
      <span className={cn('text-[26px] font-semibold tracking-[-0.02em] j40-num', tono && TONO_KPI[tono])}>{v}</span>
      <span className="text-[12px] text-fg-3">{sub}</span>
    </div>
  );
}
