import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Info, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { AlertaError, Button, Casilla, Drawer, Input, SegmentedControl } from '../../j40';
import client from '../../../api/client';
import type { Empleado, SaldoVacaciones, SimulacionFiniquito } from '../../../types';
import { cn } from '../../../utils/cn';
import { capitalizar, clp, decimalCL, hoyISO } from '../../../utils/formato';
import { CAUSALES, CAUSALES_CON_INDEMNIZACION, etiquetaCausal } from '../causales';
import { TIPO_JORNADA } from '../trabajador';
import { CAMPOS_ANEXO, errorHorasSemanales, HORAS_SEMANALES_MAXIMAS } from './utiles';
import type { CampoAnexo } from './utiles';

const CONTROL = 'h-10 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';

function mensaje(err: unknown, porDefecto: string): string {
  if (!isAxiosError(err)) return porDefecto;
  const d = err.response?.data as Record<string, unknown> | undefined;
  if (!d) return porDefecto;
  if (typeof d.error === 'string') return d.error;
  if (typeof d.detail === 'string') return d.detail;
  const primero = Object.values(d).flat()[0];
  return typeof primero === 'string' ? primero : porDefecto;
}

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[12.5px] font-medium text-fg-2">{etiqueta}</span>{children}
      {ayuda && <span className="text-[11.5px] text-fg-3">{ayuda}</span>}
    </label>
  );
}

function Acciones({ onCerrar, onGuardar, guardando, texto, deshabilitado }: {
  onCerrar: () => void; onGuardar: () => void; guardando: boolean; texto: string; deshabilitado?: boolean;
}) {
  return (
    <>
      <Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
      <Button onClick={onGuardar} cargando={guardando} disabled={deshabilitado}>{texto}</Button>
    </>
  );
}

// ── Anexo de contrato ────────────────────────────────────────────────────────


/** Anexo de contrato (Art. 11). Los cambios estructurados se aplican al contrato cuando el trabajador lo firma. */
/** Título sugerido cuando el anexo se abre desde "Cambiar con anexo". */
const TITULO_ANEXO: Partial<Record<CampoAnexo, string>> = {
  sueldo_base: 'Modificación del sueldo base', horas_semanales: 'Modificación de la jornada',
};

export function DrawerAnexo({ empleado, onCerrar, avisar, preseleccion }: {
  empleado: Empleado; onCerrar: () => void; avisar: (t: string) => void; preseleccion?: CampoAnexo;
}) {
  const contrato = empleado.contrato_activo!;
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState(preseleccion ? TITULO_ANEXO[preseleccion] ?? '' : '');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [vigencia, setVigencia] = useState(hoyISO());
  const [clausulas, setClausulas] = useState<string[]>([]);
  const [elegidos, setElegidos] = useState<CampoAnexo[]>(preseleccion ? [preseleccion] : []);
  const [valores, setValores] = useState({
    cargo: contrato.cargo, sueldo_base: String(contrato.sueldo_base), horas_semanales: String(Number(contrato.horas_semanales)),
    tipo_jornada: contrato.tipo_jornada, gratificacion_legal: contrato.gratificacion_legal, tiene_quincena: contrato.tiene_quincena,
    dia_quincena: String(contrato.dia_quincena ?? 15), monto_quincena: String(contrato.monto_quincena ?? ''),
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const alternar = (c: CampoAnexo) => setElegidos((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));
  const errorHoras = elegidos.includes('horas_semanales') ? errorHorasSemanales(valores.horas_semanales) : null;

  const guardar = async () => {
    if (!titulo.trim()) { setError('Ponle un título al anexo.'); return; }
    if (!elegidos.length && !clausulas.some((c) => c.trim()) && !descripcion.trim()) { setError('Indica qué cambia: un campo del contrato, una cláusula o una descripción.'); return; }
    if (errorHoras) { setError(`Horas semanales: ${errorHoras}`); return; }
    const cambios: Record<string, unknown> = {};
    for (const c of elegidos) {
      if (c === 'sueldo_base') cambios.sueldo_base = Number(valores.sueldo_base) || 0;
      else if (c === 'horas_semanales') cambios.horas_semanales = Number(valores.horas_semanales) || 0;
      else if (c === 'tiene_quincena') {
        cambios.tiene_quincena = valores.tiene_quincena;
        if (valores.tiene_quincena) { cambios.dia_quincena = Number(valores.dia_quincena) || 15; cambios.monto_quincena = Number(valores.monto_quincena) || 0; }
      } else cambios[c] = valores[c];
    }
    setGuardando(true);
    setError('');
    try {
      await client.post('/anexos_contrato/', {
        contrato: contrato.id, titulo: titulo.trim(), fecha_emision: fecha, descripcion: descripcion.trim(),
        clausulas_modificadas: clausulas.map((c) => c.trim()).filter(Boolean),
        ...(elegidos.length ? { cambios, vigencia_desde: vigencia } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['anexos', empleado.id] });
      avisar('Anexo creado: envíalo a firma desde Documentos');
      onCerrar();
    } catch (err) {
      setError(mensaje(err, 'No pudimos crear el anexo.'));
      setGuardando(false);
    }
  };

  return (
    <Drawer abierto onCerrar={onCerrar} titulo="Anexo de contrato" subtitulo={capitalizar(`${empleado.nombres} ${empleado.apellido_paterno}`)}
      acciones={<Acciones onCerrar={onCerrar} onGuardar={guardar} guardando={guardando} texto="Crear anexo" />}>
      <div className="flex flex-col gap-4">
        {error && <AlertaError>{error}</AlertaError>}
        <Campo etiqueta="Título"><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Aumento de sueldo" /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha de emisión"><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
          {elegidos.length > 0 && <Campo etiqueta="Rige desde"><Input type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} /></Campo>}
        </div>
        <Campo etiqueta="Antecedentes (opcional)">
          <textarea rows={3} className={cn(CONTROL, 'h-auto py-2')} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </Campo>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium text-fg-2">Qué cambia en el contrato</span>
          <p className="text-[12px] text-fg-3">Se aplica al contrato cuando el trabajador firme el anexo.</p>
          {CAMPOS_ANEXO.map(([c, t]) => (
            <div key={c} className="rounded-[10px] border border-line p-3 flex flex-col gap-2.5">
              <Casilla marcada={elegidos.includes(c)} onChange={() => alternar(c)}>{t}</Casilla>
              {elegidos.includes(c) && (
                c === 'cargo' ? <Input value={valores.cargo} onChange={(e) => setValores((v) => ({ ...v, cargo: e.target.value }))} />
                  : c === 'sueldo_base' ? <Input inputMode="numeric" value={valores.sueldo_base ? Number(valores.sueldo_base).toLocaleString('es-CL') : ''}
                    onChange={(e) => setValores((v) => ({ ...v, sueldo_base: e.target.value.replace(/\D/g, '') }))} />
                  : c === 'horas_semanales' ? (
                    <div className="flex flex-col gap-1">
                      <Input inputMode="decimal" aria-label="Horas semanales" aria-invalid={errorHoras ? true : undefined} value={valores.horas_semanales}
                        onChange={(e) => setValores((v) => ({ ...v, horas_semanales: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') }))} />
                      <span className={cn('text-[11.5px]', errorHoras ? 'text-danger' : 'text-fg-3')}>
                        {errorHoras ?? `Hasta ${String(HORAS_SEMANALES_MAXIMAS).replace('.', ',')} h, con un decimal como máximo.`}
                      </span>
                    </div>)
                  : c === 'tipo_jornada' ? (
                    <select className={CONTROL} value={valores.tipo_jornada} onChange={(e) => setValores((v) => ({ ...v, tipo_jornada: e.target.value as typeof v.tipo_jornada }))}>
                      {Object.entries(TIPO_JORNADA).map(([k, t2]) => <option key={k} value={k}>{t2}</option>)}
                    </select>)
                  : c === 'gratificacion_legal' ? (
                    <SegmentedControl etiqueta="Gratificación" valor={valores.gratificacion_legal} bloque
                      onChange={(g) => setValores((v) => ({ ...v, gratificacion_legal: g }))}
                      opciones={[{ valor: 'MENSUAL', etiqueta: 'Mensual (Art. 50)' }, { valor: 'ANUAL', etiqueta: 'Anual (Art. 47)' }]} />)
                  : (
                    <div className="flex flex-col gap-2">
                      <Casilla marcada={valores.tiene_quincena} onChange={(b) => setValores((v) => ({ ...v, tiene_quincena: b }))}>Con anticipo quincenal</Casilla>
                      {valores.tiene_quincena && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input aria-label="Día del anticipo" value={valores.dia_quincena} onChange={(e) => setValores((v) => ({ ...v, dia_quincena: e.target.value.replace(/\D/g, '') }))} />
                          <Input aria-label="Monto del anticipo" inputMode="numeric" value={valores.monto_quincena ? Number(valores.monto_quincena).toLocaleString('es-CL') : ''}
                            onChange={(e) => setValores((v) => ({ ...v, monto_quincena: e.target.value.replace(/\D/g, '') }))} />
                        </div>
                      )}
                    </div>)
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium text-fg-2">Otras cláusulas modificadas (texto libre)</span>
          {clausulas.map((x, i) => (
            <div key={i} className="flex gap-2">
              <Input value={x} onChange={(e) => setClausulas(clausulas.map((y, j) => (j === i ? e.target.value : y)))} />
              <Button variante="fantasma" soloIcono aria-label="Quitar" onClick={() => setClausulas(clausulas.filter((_, j) => j !== i))}><Trash2 className="size-4" strokeWidth={2} /></Button>
            </div>
          ))}
          <Button variante="secundario" tamano="sm" className="self-start" iconoInicio={<Plus className="size-4" strokeWidth={2} />} onClick={() => setClausulas([...clausulas, ''])}>Agregar cláusula</Button>
        </div>
      </div>
    </Drawer>
  );
}

// ── Documento legal (amonestación, constancia, carta de término) ─────────────

export type TipoDocumento = 'AMONESTACION' | 'CONSTANCIA' | 'DESPIDO';

export function DrawerDocumento({ empleado, tipoInicial, nivel, onCerrar, avisar }: {
  empleado: Empleado; tipoInicial: TipoDocumento; nivel: number; onCerrar: () => void; avisar: (t: string) => void;
}) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<TipoDocumento>(tipoInicial);
  const [fecha, setFecha] = useState(hoyISO());
  const [hechos, setHechos] = useState('');
  const [causal, setCausal] = useState('');
  const [ultimoDia, setUltimoDia] = useState(hoyISO());
  const [aviso, setAviso] = useState(false);
  const [cotizaciones, setCotizaciones] = useState<boolean | null>(null);
  const [modalidad, setModalidad] = useState<'ELECTRONICO' | 'PRESENCIAL'>('ELECTRONICO');
  const [copiaInspeccion, setCopiaInspeccion] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const despido = tipo === 'DESPIDO';
  const conIndemnizacion = despido && CAUSALES_CON_INDEMNIZACION.includes(causal);

  // Vista previa de las indemnizaciones con el mismo motor del finiquito.
  const [consulta, setConsulta] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setConsulta(conIndemnizacion ? JSON.stringify({ causal, ultimoDia, aviso }) : null), 350);
    return () => window.clearTimeout(t);
  }, [conIndemnizacion, causal, ultimoDia, aviso]);
  const sim = useQuery({
    queryKey: ['simular-carta', empleado.id, consulta],
    queryFn: async () => (await client.post<SimulacionFiniquito>('/finiquitos/simular/', {
      empleado: empleado.id, causal_articulo: causal, fecha_termino: ultimoDia, dias_trabajados_ultimo_mes: 30, aviso_previo_dado: aviso,
    })).data,
    enabled: Boolean(consulta),
    retry: false,
  });

  const guardar = async () => {
    if (!hechos.trim()) { setError('Describe los hechos: son la base del documento.'); return; }
    if (despido && !causal) { setError('Elige la causal de término.'); return; }
    if (despido && cotizaciones === null) { setError('Indica si las cotizaciones previsionales están al día.'); return; }
    setGuardando(true);
    setError('');
    try {
      await client.post('/documentos_legales/', {
        empleado: empleado.id, tipo, fecha_emision: fecha, hechos: hechos.trim(), aviso_previo_pagado: false,
        ...(despido ? {
          causal_articulo: causal, causal_legal: etiquetaCausal(causal), fecha_ultimo_dia: ultimoDia,
          aviso_previo_dias: conIndemnizacion && aviso ? 30 : 0, cotizaciones_al_dia: cotizaciones,
          modalidad_finiquito: modalidad, copia_inspeccion_trabajo: copiaInspeccion,
        } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['documentos', empleado.id] });
      avisar(despido ? 'Carta de término creada' : tipo === 'AMONESTACION' ? 'Amonestación creada' : 'Constancia creada');
      onCerrar();
    } catch (err) {
      setError(mensaje(err, 'No pudimos crear el documento.'));
      setGuardando(false);
    }
  };

  return (
    <Drawer abierto onCerrar={onCerrar} titulo="Documento legal" subtitulo={capitalizar(`${empleado.nombres} ${empleado.apellido_paterno}`)}
      acciones={<Acciones onCerrar={onCerrar} onGuardar={guardar} guardando={guardando} texto="Crear documento" />}>
      <div className="flex flex-col gap-4">
        {error && <AlertaError>{error}</AlertaError>}
        <SegmentedControl etiqueta="Tipo de documento" valor={tipo} bloque onChange={setTipo}
          opciones={[{ valor: 'AMONESTACION', etiqueta: 'Amonestación' }, { valor: 'CONSTANCIA', etiqueta: 'Constancia' },
            ...(nivel >= 2 ? [{ valor: 'DESPIDO' as const, etiqueta: 'Carta de término' }] : [])]} />
        {nivel < 2 && <p className="text-[12px] text-fg-3">Las cartas de término están disponibles desde el plan Starter.</p>}
        <Campo etiqueta="Fecha de emisión"><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
        {despido && (
          <>
            <Campo etiqueta="Causal de término">
              <select className={CONTROL} value={causal} onChange={(e) => setCausal(e.target.value)}>
                <option value="">Selecciona la causal…</option>
                {CAUSALES.map((g) => <optgroup key={g.grupo} label={g.grupo}>{g.items.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</optgroup>)}
              </select>
            </Campo>
            <Campo etiqueta="Último día de trabajo"><Input type="date" value={ultimoDia} onChange={(e) => setUltimoDia(e.target.value)} /></Campo>
            {conIndemnizacion && (
              <Casilla marcada={aviso} onChange={setAviso}>Se dio el aviso con 30 días de anticipación</Casilla>
            )}
          </>
        )}
        <Campo etiqueta="Hechos" ayuda={despido ? 'Detalla los hechos concretos en que se funda la causal (Art. 162): fechas, lugares y conductas.' : undefined}>
          <textarea rows={6} className={cn(CONTROL, 'h-auto py-2')} value={hechos} onChange={(e) => setHechos(e.target.value)} />
        </Campo>
        {despido && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-fg-2">¿Las cotizaciones previsionales están al día?</span>
              <SegmentedControl etiqueta="Cotizaciones al día" valor={cotizaciones === null ? '' : cotizaciones ? 'si' : 'no'} bloque
                onChange={(v) => setCotizaciones(v === 'si')} opciones={[{ valor: 'si', etiqueta: 'Sí' }, { valor: 'no', etiqueta: 'No' }]} />
              {cotizaciones === false && (
                <p className="flex gap-2 text-[12.5px] text-danger"><TriangleAlert className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
                  Con cotizaciones impagas el despido no produce el efecto de poner término al contrato (Ley Bustos, Art. 162 inc. 5°): las remuneraciones siguen corriendo hasta que se paguen.</p>
              )}
            </div>
            <SegmentedControl etiqueta="Modalidad del finiquito" valor={modalidad} bloque onChange={setModalidad}
              opciones={[{ valor: 'ELECTRONICO', etiqueta: 'Finiquito electrónico' }, { valor: 'PRESENCIAL', etiqueta: 'Ante ministro de fe' }]} />
            <Casilla marcada={copiaInspeccion} onChange={setCopiaInspeccion}>Se enviará copia a la Inspección del Trabajo (obligatorio, Art. 162)</Casilla>
            {conIndemnizacion && (
              <div className="rounded-[10px] bg-sunken p-3.5 flex flex-col gap-1.5 text-[13px] j40-num" aria-live="polite">
                <span className="flex items-center gap-1.5 font-semibold"><Info className="size-4" strokeWidth={2} aria-hidden />Indemnizaciones que informará la carta</span>
                {!sim.data ? <span className="text-fg-3">{sim.isFetching ? 'Calculando…' : 'Elige la fecha para calcular.'}</span> : (
                  <>
                    <div className="flex justify-between"><span>Por años de servicio ({sim.data.detalle.anios_indemnizacion} {sim.data.detalle.anios_indemnizacion === 1 ? 'año' : 'años'})</span><span>{clp(sim.data.indemnizacion_anos_servicio)}</span></div>
                    <div className="flex justify-between"><span>Sustitutiva del aviso previo</span><span>{clp(sim.data.indemnizacion_sustitutiva_aviso)}</span></div>
                    <span className="text-[11.5px] text-fg-3">Las calcula el sistema según la ley; no se editan.</span>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

// ── Vacaciones y permisos ────────────────────────────────────────────────────

export function DrawerVacacion({ empleado, saldo, onCerrar, avisar }: {
  empleado: Empleado; saldo: SaldoVacaciones | undefined; onCerrar: () => void; avisar: (t: string) => void;
}) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<'VACACION_LEGAL' | 'VACACION_PROGRESIVA' | 'PERMISO_SIN_GOCE'>('VACACION_LEGAL');
  const [inicio, setInicio] = useState(hoyISO());
  const [fin, setFin] = useState(hoyISO());
  const [estado, setEstado] = useState<'APROBADO' | 'PENDIENTE'>('APROBADO');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const dias = useQuery({
    queryKey: ['dias-habiles', inicio, fin],
    queryFn: async () => (await client.get<{ dias_habiles: number }>(`/vacaciones/dias_habiles/?inicio=${inicio}&fin=${fin}`)).data.dias_habiles,
    enabled: Boolean(inicio && fin && fin >= inicio),
  });
  const excede = tipo !== 'PERMISO_SIN_GOCE' && saldo && dias.data != null && dias.data > saldo.dias_disponibles;

  const guardar = async () => {
    if (!inicio || !fin || fin < inicio) { setError('Revisa las fechas: el término no puede ser anterior al inicio.'); return; }
    setGuardando(true);
    setError('');
    try {
      await client.post('/vacaciones/', { empleado: empleado.id, empresa: empleado.empresa, tipo, fecha_inicio: inicio, fecha_fin: fin, estado, observaciones });
      await queryClient.invalidateQueries({ queryKey: ['vacaciones'] });
      await queryClient.invalidateQueries({ queryKey: ['saldo-vacaciones', empleado.id] });
      avisar('Vacaciones registradas');
      onCerrar();
    } catch (err) {
      setError(mensaje(err, 'No pudimos registrar las vacaciones.'));
      setGuardando(false);
    }
  };

  return (
    <Drawer abierto onCerrar={onCerrar} titulo="Registrar vacaciones o permiso" subtitulo={capitalizar(`${empleado.nombres} ${empleado.apellido_paterno}`)}
      acciones={<Acciones onCerrar={onCerrar} onGuardar={guardar} guardando={guardando} texto="Registrar" />}>
      <div className="flex flex-col gap-4">
        {error && <AlertaError>{error}</AlertaError>}
        <Campo etiqueta="Tipo">
          <select className={CONTROL} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="VACACION_LEGAL">Feriado legal</option><option value="VACACION_PROGRESIVA">Feriado progresivo</option><option value="PERMISO_SIN_GOCE">Permiso sin goce de sueldo</option>
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Desde"><Input type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); if (fin < e.target.value) setFin(e.target.value); }} /></Campo>
          <Campo etiqueta="Hasta"><Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></Campo>
        </div>
        <div className="rounded-[10px] bg-sunken px-3.5 py-3 text-[13px] flex flex-col gap-1 j40-num">
          <span><strong className="font-semibold">{dias.data ?? '—'}</strong> días hábiles <span className="text-fg-3">(sábados, domingos y feriados no cuentan, Art. 69)</span></span>
          {saldo && tipo !== 'PERMISO_SIN_GOCE' && <span className="text-fg-3">Saldo disponible: {decimalCL(saldo.dias_disponibles, 0)} días</span>}
          {excede && <span className="text-warn">Supera el saldo disponible. Puedes registrarlo igual si lo acordaron (feriado anticipado).</span>}
        </div>
        <SegmentedControl etiqueta="Estado" valor={estado} bloque onChange={setEstado}
          opciones={[{ valor: 'APROBADO', etiqueta: 'Aprobado' }, { valor: 'PENDIENTE', etiqueta: 'Pendiente' }]} />
        <Campo etiqueta="Observaciones (opcional)">
          <textarea rows={3} className={cn(CONTROL, 'h-auto py-2')} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </Campo>
      </div>
    </Drawer>
  );
}
