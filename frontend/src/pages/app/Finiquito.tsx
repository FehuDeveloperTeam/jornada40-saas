import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeft, Check, Download, FileText, Info, Lock, Save, Send } from 'lucide-react';
import { AlertaError, Button, Casilla, Chip, SegmentedControl } from '../../components/j40';
import type { TonoChip } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import client from '../../api/client';
import { descargar } from '../../api/descargas';
import { lista } from '../../api/lista';
import type { RespuestaLista } from '../../api/lista';
import { rutaClasica } from '../../hooks/usePanel';
import type { Finiquito as TFiniquito, SimulacionFiniquito, SolicitudFirma } from '../../types';
import { cn } from '../../utils/cn';
import { antiguedad, capitalizar, clp, decimalCL, fechaCL, iniciales } from '../../utils/formato';

// Mismas causales que el backend (Finiquito.CAUSAL_ARTICULO_CHOICES), agrupadas por artículo.
const CAUSALES: { grupo: string; items: [string, string][] }[] = [
  { grupo: 'Art. 159 — Causales objetivas', items: [
    ['159_1', 'N°1 — Mutuo acuerdo de las partes'], ['159_2', 'N°2 — Renuncia voluntaria del trabajador'],
    ['159_3', 'N°3 — Muerte del trabajador'], ['159_4', 'N°4 — Vencimiento del plazo convenido'],
    ['159_5', 'N°5 — Conclusión del trabajo o servicio'], ['159_6', 'N°6 — Caso fortuito o fuerza mayor'],
  ] },
  { grupo: 'Art. 160 — Causales disciplinarias', items: [
    ['160_1a', 'N°1 a) — Falta de probidad'], ['160_1b', 'N°1 b) — Acoso sexual'],
    ['160_1c', 'N°1 c) — Vías de hecho'], ['160_1d', 'N°1 d) — Injurias al empleador'],
    ['160_1e', 'N°1 e) — Conducta inmoral grave'], ['160_1f', 'N°1 f) — Acoso laboral'],
    ['160_2', 'N°2 — Negociaciones prohibidas'], ['160_3', 'N°3 — Inasistencias injustificadas'],
    ['160_4a', 'N°4 a) — Salida intempestiva'], ['160_4b', 'N°4 b) — Negativa injustificada a trabajar'],
    ['160_5', 'N°5 — Actos que afectan la seguridad'], ['160_6', 'N°6 — Daño material intencional'],
    ['160_7', 'N°7 — Incumplimiento grave del contrato'],
  ] },
  { grupo: 'Art. 161 — Decisión del empleador', items: [
    ['161_1', 'Inc. 1° — Necesidades de la empresa'], ['161_2', 'Inc. 2° — Desahucio del empleador'],
  ] },
  { grupo: 'Otras', items: [['163bis', 'Art. 163 bis — Liquidación concursal del empleador']] },
];

function notaLegal(causal: string): string {
  if (causal.startsWith('161') || causal === '163bis') {
    return 'Corresponde indemnización por años de servicio (30 días por año y fracción superior a 6 meses, tope 11 años, base con tope de 90 UF). Si no avisaste con 30 días de anticipación, también la sustitutiva del aviso previo. La carta de término debe enviarse con copia a la Inspección del Trabajo.';
  }
  if (causal.startsWith('160')) {
    return 'Las causales del Art. 160 no dan derecho a indemnización. La carta debe detallar los hechos; si el trabajador reclama y el tribunal no los acredita, la indemnización se recarga (Art. 168).';
  }
  if (causal === '159_4' || causal === '159_5' || causal === '159_6') {
    return 'No corresponde indemnización por años de servicio, salvo que se haya pactado. Se pagan el feriado pendiente y proporcional y la remuneración del último mes.';
  }
  return 'No corresponde indemnización por años de servicio, salvo pacto. Se pagan el feriado pendiente y proporcional y la remuneración del último mes.';
}

const sinCarta = (causal: string) => ['159_1', '159_2', '159_3'].includes(causal);
const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;
const CONTROL = 'h-10 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:opacity-60';

interface Formulario {
  causal_articulo: string;
  fecha_termino: string;
  dias_trabajados_ultimo_mes: string;
  aviso_previo_dado: boolean;
  modalidad: 'ELECTRONICO' | 'PRESENCIAL';
  otros_haberes: string;
  otros_descuentos: string;
}

const hoyISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });

function desde(f: TFiniquito | undefined): Formulario {
  return {
    causal_articulo: f?.causal_articulo ?? '',
    fecha_termino: f?.fecha_termino ?? hoyISO(),
    dias_trabajados_ultimo_mes: String(f?.dias_trabajados_ultimo_mes ?? Number(hoyISO().slice(8, 10))),
    aviso_previo_dado: f?.aviso_previo_dado ?? false,
    modalidad: f?.modalidad ?? 'ELECTRONICO',
    otros_haberes: String(f?.otros_haberes ?? 0),
    otros_descuentos: String(f?.otros_descuentos ?? 0),
  };
}

export default function Finiquito() {
  const { id } = useParams();
  const { trabajadores, nivel, avisar } = usePanelContexto();
  const empleado = trabajadores.find((t) => t.id === Number(id));
  const finiquitos = useQuery({
    queryKey: ['finiquitos', Number(id)],
    queryFn: async () => lista((await client.get<RespuestaLista<TFiniquito>>(`/finiquitos/?empleado=${id}`)).data),
    enabled: Boolean(empleado) && nivel >= 2,
  });
  const firmas = useQuery({
    queryKey: ['firmas', Number(id)],
    queryFn: async () => lista((await client.get<RespuestaLista<SolicitudFirma>>(`/firmas/?empleado_id=${id}`)).data),
    enabled: Boolean(empleado),
  });

  if (nivel < 2) {
    return (
      <Marco id={id}>
        <section className="bg-surface border border-line rounded-j40-card shadow-card p-6 flex flex-col gap-3 items-start">
          <span className="inline-flex items-center gap-2 text-[14px] font-medium"><Lock className="size-4" strokeWidth={2} aria-hidden />Finiquitos desde el plan Starter</span>
          <p className="text-[13px] text-fg-3 max-w-[520px]">Calcula el finiquito según la causal, emite el documento y envíalo a firma electrónica.</p>
          <Link to="/app/plan" className="text-[13px] font-medium">Ver planes</Link>
        </section>
      </Marco>
    );
  }
  if (!empleado || finiquitos.isLoading) return <Marco id={id}><p className="text-[14px] text-fg-3" role="status">Cargando…</p></Marco>;

  const ultimo = finiquitos.data?.[0];
  return <Editor key={ultimo?.id ?? 'nuevo'} empleadoId={empleado.id} existente={ultimo} firmas={firmas.data ?? []} avisar={avisar} />;
}

function Marco({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div className="max-w-[1280px] mx-auto flex flex-col gap-5">
      <Link to={`/app/trabajadores/${id}?tab=documentos`} className="inline-flex items-center gap-1.5 text-[13px] text-fg-2 self-start">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />Carpeta del trabajador
      </Link>
      {children}
    </div>
  );
}

function Editor({ empleadoId, existente, firmas, avisar }: {
  empleadoId: number; existente?: TFiniquito; firmas: SolicitudFirma[]; avisar: (t: string) => void;
}) {
  const { trabajadores } = usePanelContexto();
  const empleado = trabajadores.find((t) => t.id === empleadoId)!;
  const queryClient = useQueryClient();
  const [f, setF] = useState<Formulario>(() => desde(existente));
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState('');

  const firma = existente ? firmas.filter((s) => s.finiquito === existente.id).sort((a, b) => b.enviado_en.localeCompare(a.enviado_en))[0] : undefined;
  const bloqueado = firma?.estado === 'FIRMADO' || firma?.estado === 'PENDIENTE';
  const estado: { texto: string; tono: TonoChip } = !existente ? { texto: 'Nuevo', tono: 'neutro' }
    : firma?.estado === 'FIRMADO' ? { texto: 'Firmado', tono: 'ok' }
      : firma?.estado === 'PENDIENTE' ? { texto: 'En firma', tono: 'aviso' }
        : { texto: 'Borrador', tono: 'marca' };
  const paso = !existente ? 0 : firma?.estado === 'FIRMADO' ? 3 : firma ? 2 : 1;

  const cambiar = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }));
  const es161 = f.causal_articulo.startsWith('161') || f.causal_articulo === '163bis';

  const datos = useMemo(() => ({
    empleado: empleadoId, causal_articulo: f.causal_articulo, fecha_termino: f.fecha_termino,
    dias_trabajados_ultimo_mes: Number(f.dias_trabajados_ultimo_mes) || 0, aviso_previo_dado: es161 && f.aviso_previo_dado,
    otros_haberes: Number(f.otros_haberes) || 0, otros_descuentos: Number(f.otros_descuentos) || 0,
  }), [empleadoId, f, es161]);

  // La vista previa espera a que se deje de escribir.
  const [enEspera, setEnEspera] = useState(datos);
  useEffect(() => { const t = window.setTimeout(() => setEnEspera(datos), 350); return () => window.clearTimeout(t); }, [datos]);
  const sim = useQuery({
    queryKey: ['simular-finiquito', enEspera],
    queryFn: async () => (await client.post<SimulacionFiniquito>('/finiquitos/simular/', enEspera)).data,
    enabled: Boolean(enEspera.causal_articulo && enEspera.fecha_termino),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const errorSim = sim.error ? mensaje(sim.error, 'No pudimos calcular el finiquito.') : '';

  const guardar = async () => {
    setGuardando('guardar');
    setError('');
    try {
      const cuerpo = { ...datos, modalidad: f.modalidad };
      if (existente) await client.patch(`/finiquitos/${existente.id}/`, cuerpo);
      else await client.post('/finiquitos/', cuerpo);
      await queryClient.invalidateQueries({ queryKey: ['finiquitos', empleadoId] });
      avisar('Finiquito guardado');
    } catch (err) {
      setError(mensaje(err, 'No pudimos guardar el finiquito.'));
    } finally {
      setGuardando(null);
    }
  };

  const pdf = async () => {
    if (!existente) return;
    setGuardando('pdf');
    const e = await descargar(`/finiquitos/${existente.id}/generar_pdf/`, `Finiquito_${empleado.rut}.pdf`);
    setGuardando(null);
    if (e) setError(e);
  };

  const enviarAFirma = async () => {
    if (!existente) return;
    setGuardando('firma');
    setError('');
    try {
      await client.post('/firmas/solicitar/', { empleado_id: empleado.id, tipo_documento: 'FINIQUITO', finiquito_id: existente.id });
      await queryClient.invalidateQueries({ queryKey: ['firmas'] });
      avisar('Finiquito enviado a firma');
    } catch (err) {
      setError(mensaje(err, 'No pudimos enviar el finiquito a firma.'));
    } finally {
      setGuardando(null);
    }
  };

  const nombre = capitalizar(`${empleado.nombres} ${empleado.apellido_paterno} ${empleado.apellido_materno ?? ''}`);
  const pasos = ['Cálculo', 'Documento PDF', f.modalidad === 'ELECTRONICO' ? 'Firma electrónica del trabajador' : 'Ratificación ante ministro de fe'];

  return (
    <Marco id={String(empleadoId)}>
      <header className="flex items-center gap-4 flex-wrap">
        <span className="size-12 rounded-full bg-brand-soft text-brand-text grid place-items-center text-[16px] font-semibold" aria-hidden>
          {iniciales(empleado.nombres, empleado.apellido_paterno)}
        </span>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Finiquito · {nombre}</h1>
            <Chip tono={estado.tono}>{estado.texto}</Chip>
          </div>
          <p className="text-[13px] text-fg-3">{empleado.rut} · ingreso {fechaCL(empleado.fecha_ingreso)} · {antiguedad(empleado.fecha_ingreso)}</p>
        </div>
      </header>

      <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-2.5">
        {pasos.map((t, i) => (
          <li key={t} className={cn('flex items-center gap-3 rounded-j40-card border px-3.5 py-3 bg-surface', i === paso ? 'border-brand' : 'border-line')}>
            <span className={cn('size-7 shrink-0 rounded-full grid place-items-center text-[12.5px] font-semibold',
              i < paso ? 'bg-ok text-white' : i === paso ? 'bg-brand-btn text-white' : 'border border-line-strong text-fg-3')}>
              {i < paso ? <Check className="size-4" strokeWidth={2.5} aria-hidden /> : i + 1}
            </span>
            <span className={cn('text-[13px] font-medium', i > paso && 'text-fg-3')}>{t}</span>
          </li>
        ))}
      </ol>

      {error && <AlertaError>{error}</AlertaError>}
      {bloqueado && (
        <div className="flex gap-2.5 items-start rounded-[10px] bg-warn-soft text-warn px-3.5 py-3 text-[13px]">
          <Lock className="size-4 mt-0.5 shrink-0" strokeWidth={2} aria-hidden />
          {firma?.estado === 'FIRMADO' ? 'El trabajador firmó este finiquito: ya no se puede modificar.' : 'El finiquito está en firma. Cancela la solicitud en Firma electrónica para modificarlo.'}
        </div>
      )}

      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">
        <fieldset disabled={bloqueado} className="flex flex-col gap-5 min-w-0">
          <Seccion titulo="Término de la relación laboral">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-fg-2">Causal de término</span>
              <select className={CONTROL} value={f.causal_articulo} onChange={(e) => cambiar('causal_articulo', e.target.value)}>
                <option value="">Selecciona la causal…</option>
                {CAUSALES.map((g) => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.items.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium text-fg-2">Fecha de término</span>
                <input type="date" className={CONTROL} value={f.fecha_termino}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Los días del último mes siguen a la fecha de término (se pueden corregir a mano).
                    setF((x) => ({ ...x, fecha_termino: v, dias_trabajados_ultimo_mes: v ? String(Math.min(30, Number(v.slice(8, 10)))) : x.dias_trabajados_ultimo_mes }));
                  }} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium text-fg-2">Días trabajados del último mes</span>
                <input inputMode="numeric" className={CONTROL} value={f.dias_trabajados_ultimo_mes}
                  onChange={(e) => cambiar('dias_trabajados_ultimo_mes', String(Math.min(30, Number(e.target.value.replace(/\D/g, '')) || 0)))} />
              </label>
            </div>
            {es161 && (
              <Casilla marcada={f.aviso_previo_dado} onChange={(v) => cambiar('aviso_previo_dado', v)}>
                Di el aviso por escrito con 30 días de anticipación (si no, corresponde la indemnización sustitutiva).
              </Casilla>
            )}
            {f.causal_articulo && (
              <p className="flex gap-2 text-[12.5px] text-fg-2 rounded-[10px] bg-sunken px-3 py-2.5">
                <Info className="size-4 shrink-0 mt-0.5 text-fg-3" strokeWidth={2} aria-hidden />{notaLegal(f.causal_articulo)}
              </p>
            )}
          </Seccion>

          <Seccion titulo="Modalidad de firma">
            <SegmentedControl etiqueta="Modalidad" valor={f.modalidad} onChange={(v) => cambiar('modalidad', v)} bloque
              opciones={[{ valor: 'ELECTRONICO', etiqueta: 'Electrónica' }, { valor: 'PRESENCIAL', etiqueta: 'Presencial' }]} />
            <p className="text-[12.5px] text-fg-3">
              {f.modalidad === 'ELECTRONICO'
                ? 'El trabajador lo firma con su correo y un código. Es voluntario para él: puede preferir ratificarlo ante un ministro de fe.'
                : 'Se imprime y se ratifica ante un ministro de fe (notario o Inspección del Trabajo).'}
            </p>
          </Seccion>

          <Seccion titulo="Otros haberes y descuentos" nota="Montos voluntarios o pactados. Los legales los calcula el sistema.">
            <div className="grid grid-cols-2 gap-3">
              <Monto etiqueta="Otros haberes" valor={f.otros_haberes} onCambio={(v) => cambiar('otros_haberes', v)} />
              <Monto etiqueta="Otros descuentos" valor={f.otros_descuentos} onCambio={(v) => cambiar('otros_descuentos', v)} />
            </div>
          </Seccion>

          {f.causal_articulo && !sinCarta(f.causal_articulo) && (
            <Seccion titulo="Carta de término">
              <div className="flex items-center gap-3 flex-wrap">
                <FileText className="size-5 text-brand-text" strokeWidth={2} aria-hidden />
                <p className="flex-1 min-w-[200px] text-[13px] text-fg-2">Esta causal exige comunicar el término por escrito, con los hechos y la causal (Art. 162).</p>
                <Link to={rutaClasica(empleado.id, 'legal')} className="text-[13px] font-medium">Emitir carta</Link>
              </div>
            </Seccion>
          )}
        </fieldset>

        <aside className="min-[1100px]:sticky min-[1100px]:top-[78px] bg-surface border border-line rounded-j40-card shadow-card p-[18px] flex flex-col gap-2 j40-num" aria-live="polite">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Cálculo</h2>
            <span className="text-[11.5px] text-fg-3">{sim.isFetching ? 'Calculando…' : 'Calculado por el servidor'}</span>
          </div>
          {!f.causal_articulo ? <p className="text-[13px] text-fg-3 py-4">Elige la causal para calcular.</p>
            : errorSim ? <AlertaError>{errorSim}</AlertaError>
              : !sim.data ? <p className="text-[13px] text-fg-3 py-4">Calculando…</p> : (
                <Calculo s={sim.data} />
              )}
          <div className="flex flex-col gap-2 pt-3 mt-1 border-t border-line">
            {!bloqueado && (
              <Button onClick={guardar} cargando={guardando === 'guardar'} disabled={!f.causal_articulo || Boolean(errorSim)}
                iconoInicio={<Save className="size-4" strokeWidth={2} />}>{existente ? 'Guardar cambios' : 'Guardar borrador'}</Button>
            )}
            {existente && (
              <Button variante="secundario" onClick={pdf} cargando={guardando === 'pdf'} iconoInicio={<Download className="size-4" strokeWidth={2} />}>
                {f.modalidad === 'PRESENCIAL' ? 'Descargar para ratificar' : 'Descargar PDF'}
              </Button>
            )}
            {existente && f.modalidad === 'ELECTRONICO' && !firma?.estado?.match(/FIRMADO|PENDIENTE/) && (
              <Button variante="secundario" onClick={enviarAFirma} cargando={guardando === 'firma'} iconoInicio={<Send className="size-4" strokeWidth={2} />}>
                Enviar a firma
              </Button>
            )}
            {firma?.estado === 'PENDIENTE' && <Link to="/app/firmas" className="text-[12.5px] font-medium text-center">Ver la solicitud de firma</Link>}
          </div>
        </aside>
      </div>
    </Marco>
  );
}

function Calculo({ s }: { s: SimulacionFiniquito }) {
  const d = s.detalle;
  return (
    <>
      <Grupo titulo="Haberes">
        <Linea t={`Sueldo proporcional (${s.dias_trabajados_ultimo_mes} días)`} v={d.sueldo_proporcional} />
        {s.gratificacion_proporcional > 0 && <Linea t="Gratificación proporcional" v={s.gratificacion_proporcional} />}
        <Linea t="Feriado pendiente y proporcional" v={s.feriado_proporcional}
          nota={`${decimalCL(d.feriado_dias_habiles, 2)} días hábiles (${decimalCL(d.feriado_dias_saldo, 0)} de saldo + ${decimalCL(d.feriado_dias_proporcionales, 2)} proporcionales) → ${decimalCL(d.feriado_dias_corridos, 2)} corridos`} />
        {d.con_indemnizacion && (
          <>
            <Linea t="Indemnización por años de servicio" v={s.indemnizacion_anos_servicio}
              nota={d.anios_indemnizacion ? `${d.anios_indemnizacion} ${d.anios_indemnizacion === 1 ? 'año' : 'años'} × ${clp(d.base_indemnizacion)}${d.base_indemnizacion_topada ? ' (tope 90 UF)' : ''}` : 'Menos de un año de contrato: no corresponde'} />
            <Linea t="Sustitutiva del aviso previo" v={s.indemnizacion_sustitutiva_aviso}
              nota={s.indemnizacion_sustitutiva_aviso ? 'Una remuneración: no se dio el aviso de 30 días' : 'Se dio el aviso con 30 días'} />
          </>
        )}
        {s.otros_haberes > 0 && <Linea t="Otros haberes" v={s.otros_haberes} />}
      </Grupo>
      <Grupo titulo="Descuentos">
        <Linea t={`AFP ${capitalizar(d.afp_nombre)}`} v={-d.afp} />
        <Linea t={`Salud ${capitalizar(d.salud_nombre)}`} v={-d.salud} />
        {d.seguro_cesantia > 0 && <Linea t="Seguro de cesantía" v={-d.seguro_cesantia} />}
        {d.impuesto_unico > 0 && <Linea t="Impuesto único" v={-d.impuesto_unico} />}
        {s.otros_descuentos > 0 && <Linea t="Otros descuentos" v={-s.otros_descuentos} />}
      </Grupo>
      <div className="flex items-baseline justify-between pt-2 border-t border-line">
        <span className="text-[13px] font-medium">Total a pagar</span>
        <span className="text-[24px] font-semibold tracking-[-0.01em]">{clp(s.total_a_pagar)}</span>
      </div>
    </>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <span className="text-[11.5px] font-medium text-fg-3 uppercase tracking-[0.04em]">{titulo}</span>
      {children}
    </div>
  );
}

function Linea({ t, v, nota }: { t: string; v: number; nota?: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex justify-between gap-3 text-[13px] text-fg-2"><span>{t}</span><span>{v < 0 ? `− ${clp(-v)}` : clp(v)}</span></div>
      {nota && <span className="text-[11.5px] text-fg-3">{nota}</span>}
    </div>
  );
}

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card p-[18px] flex flex-col gap-3.5">
      <div>
        <h2 className="text-[14px] font-semibold">{titulo}</h2>
        {nota && <p className="text-[12px] text-fg-3">{nota}</p>}
      </div>
      {children}
    </section>
  );
}

function Monto({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-fg-2">{etiqueta}</span>
      <span className="relative">
        <span className="absolute left-3 top-2.5 text-fg-3 text-[14px] pointer-events-none">$</span>
        <input inputMode="numeric" className={cn(CONTROL, 'pl-6')} value={valor === '0' ? '' : Number(valor).toLocaleString('es-CL')}
          placeholder="0" onChange={(e) => onCambio(e.target.value.replace(/\D/g, '') || '0')} />
      </span>
    </label>
  );
}
