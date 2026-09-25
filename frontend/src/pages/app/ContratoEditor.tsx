import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeft, Download, FilePlus, FileScan, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { AlertaError, Button, Casilla, Input } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import { ListaAvisos } from '../../components/app/Avisos';
import client from '../../api/client';
import { descargar } from '../../api/descargas';
import { useAvisosJornada } from '../../hooks/useAvisosJornada';
import { rutaAccion, useIndicadores } from '../../hooks/usePanel';
import { errorHorasSemanales, firmaDe, mensajeErrorCampos } from '../../components/app/carpeta/utiles';
import type { ComisionConfig, Contrato, HorarioSemana, SolicitudFirma } from '../../types';
import { lista } from '../../api/lista';
import type { RespuestaLista } from '../../api/lista';
import { cn } from '../../utils/cn';
import { capitalizar } from '../../utils/formato';
import { formatRut, validateRut } from '../../utils/rutUtils';

type TipoJornada = Contrato['tipo_jornada'];
const DIAS: [string, string][] = [
  ['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'], ['jueves', 'Jueves'],
  ['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo'],
];
const JORNADAS: [TipoJornada, string][] = [
  ['ORDINARIA', 'Ordinaria'], ['PARCIAL', 'Parcial (Art. 40 bis)'], ['ART_22', 'Art. 22 (sin límite de jornada)'],
  ['TURNOS', 'Turnos rotativos'], ['BISMANAL', 'Bisemanal'], ['OTRO', 'Otra (describir)'],
];
const CON_HORARIO: TipoJornada[] = ['ORDINARIA', 'PARCIAL'];
const CONTROL = 'h-10 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';

interface Formulario {
  tipo_contrato: Contrato['tipo_contrato'];
  cargo: string;
  fecha_inicio: string;
  fecha_fin: string;
  es_profesional_titulado: boolean;
  funciones_especificas: string[];
  sueldo_base: string;
  dia_pago: string;
  gratificacion_legal: 'MENSUAL' | 'ANUAL';
  tiene_quincena: boolean;
  dia_quincena: string;
  monto_quincena: string;
  es_comisionista: boolean;
  comisiones_config: ComisionConfig[];
  horas_semanales: string;
  tipo_jornada: TipoJornada;
  jornada_personalizada: string;
  distribucion_horario: HorarioSemana;
  clausulas_especiales: string[];
}

function horarioBase(horas: number): HorarioSemana {
  // Lunes a viernes; la salida se ajusta a las horas pactadas con 1 h de colación.
  const diarias = Math.max(1, horas / 5);
  const salida = 9 * 60 + Math.round(diarias * 60) + 60;
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return Object.fromEntries(DIAS.map(([d], i) => [d, { activo: i < 5, entrada: '09:00', salida: hhmm(salida), colacion: 60 }]));
}

// Etiquetas para los errores del backend por campo.
const ETIQUETAS: Record<string, string> = {
  tipo_contrato: 'Tipo de contrato', cargo: 'Cargo', fecha_inicio: 'Fecha de inicio', fecha_fin: 'Fecha de término',
  es_profesional_titulado: 'Profesional titulado', funciones_especificas: 'Funciones específicas', sueldo_base: 'Sueldo base',
  dia_pago: 'Día de pago', gratificacion_legal: 'Gratificación legal', tiene_quincena: 'Anticipo de quincena',
  dia_quincena: 'Día del anticipo', monto_quincena: 'Monto del anticipo', es_comisionista: 'Comisiones',
  comisiones_config: 'Comisiones por venta', horas_semanales: 'Horas semanales', tipo_jornada: 'Tipo de jornada',
  jornada_personalizada: 'Descripción de la jornada', distribucion_horario: 'Distribución semanal',
  clausulas_especiales: 'Cláusulas especiales', empleado: 'Trabajador',
};

// Firmado o enviado a firma: las condiciones solo cambian con un anexo (Art. 11).
const ESTADOS_SOLO_ANEXO = ['FIRMADO', 'PENDIENTE', 'PROCESANDO'];

/** `maximo`: jornada máxima vigente que informa el backend (horas por defecto de un contrato nuevo). */
function desde(c: Contrato | null | undefined, cargo: string, maximo: number | undefined): Formulario {
  const horas = Number(c?.horas_semanales ?? maximo ?? 0);
  return {
    tipo_contrato: c?.tipo_contrato ?? 'INDEFINIDO',
    cargo: c?.cargo ?? cargo,
    fecha_inicio: c?.fecha_inicio ?? '',
    fecha_fin: c?.fecha_fin ?? '',
    es_profesional_titulado: c?.es_profesional_titulado ?? false,
    funciones_especificas: c?.funciones_especificas ?? [],
    sueldo_base: String(c?.sueldo_base ?? ''),
    dia_pago: String(c?.dia_pago ?? 30),
    gratificacion_legal: c?.gratificacion_legal ?? 'MENSUAL',
    tiene_quincena: c?.tiene_quincena ?? false,
    dia_quincena: String(c?.dia_quincena ?? 15),
    monto_quincena: String(c?.monto_quincena ?? ''),
    es_comisionista: c?.es_comisionista ?? false,
    comisiones_config: c?.comisiones_config ?? [],
    horas_semanales: horas ? String(horas) : '',
    tipo_jornada: c?.tipo_jornada ?? 'ORDINARIA',
    jornada_personalizada: c?.jornada_personalizada ?? '',
    distribucion_horario: c?.distribucion_horario && Object.keys(c.distribucion_horario).length ? c.distribucion_horario : horarioBase(horas || 40),
    clausulas_especiales: c?.clausulas_especiales ?? [],
  };
}

const minutos = (h: string) => { const [a, b] = h.split(':').map(Number); return (a || 0) * 60 + (b || 0); };
const horasDia = (d: { entrada: string; salida: string; colacion: number }) => {
  let t = minutos(d.salida) - minutos(d.entrada);
  if (t < 0) t += 1440;
  return Math.max(0, (t - (d.colacion || 0)) / 60);
};

export default function ContratoEditor() {
  const { id } = useParams();
  const { empresa, trabajadores, cargandoTrabajadores } = usePanelContexto();
  const indicadores = useIndicadores();
  const empleado = trabajadores.find((t) => t.id === Number(id));
  if (!empleado) {
    return (
      <div className="max-w-[1100px] mx-auto flex flex-col gap-4 items-start">
        <Link to="/app/trabajadores" className="inline-flex items-center gap-1.5 text-[13px] text-fg-2">
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />Trabajadores
        </Link>
        <p className="text-[14px] text-fg-2" role="status">
          {cargandoTrabajadores ? 'Cargando…' : `No encontramos este trabajador en ${capitalizar(empresa.nombre_legal)}.`}
        </p>
      </div>
    );
  }
  // Un contrato nuevo parte en el máximo vigente que informa el backend.
  const maximo = empleado.contrato_activo?.jornada_maxima_vigente ?? indicadores.data?.jornada_maxima_vigente;
  if (!empleado.contrato_activo && indicadores.isLoading) return <p className="text-[14px] text-fg-3" role="status">Cargando…</p>;
  return <Editor key={`${empleado.id}-${empleado.contrato_activo?.id ?? 'nuevo'}`} empleadoId={empleado.id} maximoInicial={maximo} />;
}

function Editor({ empleadoId, maximoInicial }: { empleadoId: number; maximoInicial: number | undefined }) {
  const { trabajadores, avisar } = usePanelContexto();
  const empleado = trabajadores.find((t) => t.id === empleadoId)!;
  const contrato = empleado.contrato_activo;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [f, setF] = useState<Formulario>(() => desde(contrato, empleado.cargo, maximoInicial));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  const [extraidos, setExtraidos] = useState<Record<string, string> | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const firmas = useQuery({
    queryKey: ['firmas', empleado.id],
    queryFn: async () => lista((await client.get<RespuestaLista<SolicitudFirma>>(`/firmas/?empleado_id=${empleado.id}`)).data),
  });
  // Última solicitud de firma del contrato: si está firmado o en firma, solo lectura.
  const firmaContrato = contrato ? firmaDe(firmas.data, 'contrato', contrato.id, 'CONTRATO') : undefined;
  const soloLectura = ESTADOS_SOLO_ANEXO.includes(firmaContrato?.estado ?? '');

  const conHorario = CON_HORARIO.includes(f.tipo_jornada);
  const esArt22 = f.tipo_jornada === 'ART_22';
  const { avisos, maximo: maximoEvaluado } = useAvisosJornada({
    tipo_jornada: f.tipo_jornada, horas_semanales: esArt22 ? maximoInicial : f.horas_semanales,
    distribucion_horario: conHorario ? f.distribucion_horario : null, sueldo_base: f.sueldo_base,
  });
  const maximo = maximoEvaluado ?? maximoInicial;
  const errorHoras = esArt22 ? null : errorHorasSemanales(f.horas_semanales);
  const cambiar = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }));
  const totalHorario = DIAS.reduce((s, [d]) => s + (f.distribucion_horario[d]?.activo ? horasDia(f.distribucion_horario[d]) : 0), 0);

  const payload = () => ({
    empleado: empleado.id, tipo_contrato: f.tipo_contrato, cargo: f.cargo.trim(), fecha_inicio: f.fecha_inicio,
    fecha_fin: f.tipo_contrato === 'INDEFINIDO' ? null : f.fecha_fin || null,
    es_profesional_titulado: f.tipo_contrato === 'PLAZO_FIJO' && f.es_profesional_titulado,
    funciones_especificas: f.funciones_especificas.map((x) => x.trim()).filter(Boolean),
    sueldo_base: Number(f.sueldo_base) || 0, dia_pago: Number(f.dia_pago) || 30, gratificacion_legal: f.gratificacion_legal,
    tiene_quincena: f.tiene_quincena, dia_quincena: f.tiene_quincena ? Number(f.dia_quincena) || 15 : null,
    monto_quincena: f.tiene_quincena ? Number(f.monto_quincena) || 0 : null,
    es_comisionista: f.es_comisionista,
    comisiones_config: f.es_comisionista ? f.comisiones_config.filter((c) => (c.glosa ?? '').trim()) : [],
    // Art. 22 no pacta horas (el campo está oculto): se guarda el máximo vigente,
    // que es el valor por defecto del backend, en vez de horas viejas que no se ven.
    ...(esArt22 ? (maximo ? { horas_semanales: maximo } : {}) : { horas_semanales: f.horas_semanales }),
    tipo_jornada: f.tipo_jornada,
    jornada_personalizada: f.tipo_jornada === 'OTRO' ? f.jornada_personalizada : null,
    distribucion_horario: conHorario ? f.distribucion_horario : {},
    clausulas_especiales: f.clausulas_especiales.map((x) => x.trim()).filter(Boolean),
  });

  const guardar = async () => {
    if (!f.fecha_inicio) { setError('Indica la fecha de inicio del contrato.'); return; }
    if (!f.cargo.trim()) { setError('Indica el cargo.'); return; }
    if (errorHoras) { setError(`Horas semanales: ${errorHoras}`); return; }
    setGuardando('guardar');
    setError('');
    try {
      if (contrato) await client.patch(`/contratos/${contrato.id}/`, payload());
      else await client.post('/contratos/', payload());
      await queryClient.invalidateQueries({ queryKey: ['empleados'] });
      avisar(contrato ? 'Contrato actualizado' : 'Contrato creado');
      navigate(`/app/trabajadores/${empleado.id}?tab=contrato`);
    } catch (err) {
      setError(mensajeErrorCampos(isAxiosError(err) ? err.response?.data : undefined, ETIQUETAS, 'No pudimos guardar el contrato.'));
    } finally {
      setGuardando(null);
    }
  };

  const pdf = async (tipo: 'contrato' | 'anexo') => {
    if (!contrato) return;
    setGuardando(tipo);
    const e = tipo === 'contrato'
      ? await descargar(`/contratos/${contrato.id}/descargar_contrato/`, `Contrato_${empleado.rut}.pdf`)
      : await descargar(`/contratos/${contrato.id}/descargar_anexo_40h/`, `Anexo_40h_${empleado.rut}.pdf`);
    setGuardando(null);
    if (e) setError(e);
  };

  const digitalizar = async (file: File) => {
    setGuardando('ia');
    setError('');
    try {
      const datos = new FormData();
      datos.append('file', file);
      const { data } = await client.post<Record<string, unknown>>(`/empleados/${empleado.id}/digitalizar_contrato/`, datos,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      const hay = (k: string) => data[k] !== null && data[k] !== undefined && data[k] !== '';
      setF((x) => ({
        ...x,
        ...(hay('cargo') && { cargo: String(data.cargo) }),
        ...(hay('tipo_contrato') && { tipo_contrato: data.tipo_contrato as Formulario['tipo_contrato'] }),
        ...(hay('fecha_inicio') && { fecha_inicio: String(data.fecha_inicio) }),
        ...(hay('fecha_fin') && { fecha_fin: String(data.fecha_fin) }),
        ...(hay('sueldo_base') && { sueldo_base: String(data.sueldo_base) }),
        ...(hay('dia_pago') && { dia_pago: String(data.dia_pago) }),
        ...(hay('horas_semanales') && { horas_semanales: String(data.horas_semanales) }),
        ...(hay('gratificacion_legal') && { gratificacion_legal: data.gratificacion_legal as Formulario['gratificacion_legal'] }),
        ...(hay('tiene_quincena') && { tiene_quincena: Boolean(data.tiene_quincena) }),
        ...(hay('dia_quincena') && { dia_quincena: String(data.dia_quincena) }),
        ...(hay('monto_quincena') && { monto_quincena: String(data.monto_quincena) }),
      }));
      // Los datos del trabajador no se aplican solos: se muestran para confirmarlos.
      const personales = ['nombres', 'apellido_paterno', 'apellido_materno', 'fecha_nacimiento', 'estado_civil', 'nacionalidad',
        'direccion', 'comuna', 'afp', 'sistema_salud']
        .filter((k) => hay(k) && String(data[k]).toUpperCase() !== String(empleado[k as keyof typeof empleado] ?? '').toUpperCase());
      const rutLeido = hay('rut') ? formatRut(String(data.rut)) : '';
      if (rutLeido && validateRut(rutLeido) && rutLeido !== empleado.rut) {
        setError(`Atención: el documento es de otro RUT (${rutLeido}). Revisa que sea el contrato de ${capitalizar(empleado.nombres)}.`);
      }
      setExtraidos(personales.length ? Object.fromEntries(personales.map((k) => [k, String(data[k])])) : null);
      avisar('Documento leído: revisa los datos antes de guardar');
    } catch (err) {
      setError((isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || 'No pudimos leer el documento.');
    } finally {
      setGuardando(null);
    }
  };

  const aplicarPersonales = async () => {
    if (!extraidos) return;
    try {
      await client.patch(`/empleados/${empleado.id}/`, extraidos);
      await queryClient.invalidateQueries({ queryKey: ['empleados'] });
      setExtraidos(null);
      avisar('Datos personales actualizados');
    } catch {
      setError('No pudimos actualizar los datos personales.');
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-5 pb-24">
      <Link to={`/app/trabajadores/${empleado.id}?tab=contrato`} className="inline-flex items-center gap-1.5 text-[13px] text-fg-2 self-start">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />Carpeta del trabajador
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">{!contrato ? 'Nuevo contrato' : soloLectura ? 'Contrato' : 'Editar contrato'}</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">{capitalizar(`${empleado.nombres} ${empleado.apellido_paterno}`)} · {empleado.rut}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={archivo} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only"
            onChange={(e) => { const x = e.target.files?.[0]; if (x) void digitalizar(x); e.target.value = ''; }} />
          {!soloLectura && (
            <Button variante="secundario" cargando={guardando === 'ia'} onClick={() => archivo.current?.click()}
              iconoInicio={<FileScan className="size-4" strokeWidth={2} />}>{guardando === 'ia' ? 'Leyendo…' : 'Digitalizar contrato en papel'}</Button>
          )}
          {contrato && <Button variante="secundario" cargando={guardando === 'contrato'} onClick={() => pdf('contrato')} iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>}
        </div>
      </div>

      {error && <AlertaError>{error}</AlertaError>}
      {soloLectura && (
        <div className="flex gap-3 items-start flex-wrap rounded-[10px] bg-warn-soft text-warn px-3.5 py-3 text-[13px]">
          <Lock className="size-4 mt-0.5 shrink-0" strokeWidth={2} aria-hidden />
          <p className="flex-1 min-w-[220px]">
            {firmaContrato?.estado === 'FIRMADO'
              ? 'El trabajador firmó este contrato: sus condiciones solo cambian con un anexo firmado por ambas partes (Art. 11).'
              : 'Este contrato está en firma: mientras tanto sus condiciones no se editan. Para cambiarlas, cancela la solicitud en Firma electrónica o pacta el cambio con un anexo (Art. 11).'}
          </p>
          <Link to={rutaAccion(empleado.id, 'anexo')} className="inline-flex items-center gap-1.5 font-medium">
            <FilePlus className="size-4" strokeWidth={2} aria-hidden />Crear anexo
          </Link>
        </div>
      )}
      {extraidos && (
        <div className="rounded-[10px] border border-brand bg-brand-soft px-4 py-3 flex flex-col gap-2 text-[13px]">
          <strong className="font-semibold">El documento trae datos personales distintos a los guardados:</strong>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1">
            {Object.entries(extraidos).map(([k, v]) => <li key={k}><span className="text-fg-3">{k.replace(/_/g, ' ')}:</span> {v}</li>)}
          </ul>
          <div className="flex gap-2">
            <Button tamano="sm" onClick={aplicarPersonales}>Actualizar datos personales</Button>
            <Button tamano="sm" variante="secundario" onClick={() => setExtraidos(null)}>Ignorar</Button>
          </div>
        </div>
      )}

      <fieldset disabled={soloLectura} className="flex flex-col gap-5 min-w-0">
      <Seccion titulo="1. Condiciones generales">
        <Rejilla>
          <Campo etiqueta="Tipo de contrato">
            <select className={CONTROL} value={f.tipo_contrato} onChange={(e) => cambiar('tipo_contrato', e.target.value as Formulario['tipo_contrato'])}>
              <option value="INDEFINIDO">Indefinido</option><option value="PLAZO_FIJO">Plazo fijo</option><option value="OBRA_FAENA">Obra o faena</option>
            </select>
          </Campo>
          <Campo etiqueta="Cargo"><Input value={f.cargo} onChange={(e) => cambiar('cargo', e.target.value)} /></Campo>
          <Campo etiqueta="Fecha de inicio"><Input type="date" value={f.fecha_inicio} onChange={(e) => cambiar('fecha_inicio', e.target.value)} /></Campo>
          {f.tipo_contrato !== 'INDEFINIDO' && (
            <Campo etiqueta={f.tipo_contrato === 'PLAZO_FIJO' ? 'Fecha de término' : 'Término estimado'}>
              <Input type="date" value={f.fecha_fin} onChange={(e) => cambiar('fecha_fin', e.target.value)} />
            </Campo>
          )}
        </Rejilla>
        {f.tipo_contrato === 'PLAZO_FIJO' && (
          <Casilla marcada={f.es_profesional_titulado} onChange={(v) => cambiar('es_profesional_titulado', v)}>
            Profesional o técnico titulado (el plazo fijo puede durar hasta 2 años en vez de 1)
          </Casilla>
        )}
        <ListaEditable titulo="Funciones específicas" nota="Opcional: si no agregas, el contrato usa un texto legal genérico."
          items={f.funciones_especificas} onCambio={(v) => cambiar('funciones_especificas', v)} placeholder="Atender a clientes en caja" />
      </Seccion>

      <Seccion titulo="2. Remuneración">
        <Rejilla>
          <Campo etiqueta="Sueldo base mensual"><Pesos valor={f.sueldo_base} onCambio={(v) => cambiar('sueldo_base', v)} /></Campo>
          <Campo etiqueta="Día de pago"><Input inputMode="numeric" value={f.dia_pago} onChange={(e) => cambiar('dia_pago', String(Math.min(31, Number(e.target.value.replace(/\D/g, '')) || 0)))} /></Campo>
          <Campo etiqueta="Gratificación legal">
            <select className={CONTROL} value={f.gratificacion_legal} onChange={(e) => cambiar('gratificacion_legal', e.target.value as Formulario['gratificacion_legal'])}>
              <option value="MENSUAL">Mensual (Art. 50, 25 % con tope)</option><option value="ANUAL">Anual (Art. 47)</option>
            </select>
          </Campo>
        </Rejilla>
        <Casilla marcada={f.tiene_quincena} onChange={(v) => cambiar('tiene_quincena', v)}>Recibe anticipo de quincena</Casilla>
        {f.tiene_quincena && (
          <Rejilla>
            <Campo etiqueta="Día del anticipo"><Input inputMode="numeric" value={f.dia_quincena} onChange={(e) => cambiar('dia_quincena', e.target.value.replace(/\D/g, ''))} /></Campo>
            <Campo etiqueta="Monto del anticipo"><Pesos valor={f.monto_quincena} onCambio={(v) => cambiar('monto_quincena', v)} /></Campo>
          </Rejilla>
        )}
        <Casilla marcada={f.es_comisionista} onChange={(v) => cambiar('es_comisionista', v)}>Recibe comisiones por venta (remuneración variable)</Casilla>
        {f.es_comisionista && (
          <div className="flex flex-col gap-2">
            {f.comisiones_config.map((c, i) => (
              <div key={i} className="flex gap-2 items-end">
                <Campo etiqueta="Categoría"><Input value={c.glosa ?? ''} onChange={(e) => cambiar('comisiones_config', f.comisiones_config.map((x, j) => (j === i ? { ...x, glosa: e.target.value } : x)))} /></Campo>
                <Campo etiqueta="% sobre lo vendido">
                  <Input inputMode="decimal" value={String(c.porcentaje ?? '')} className="w-28"
                    onChange={(e) => cambiar('comisiones_config', f.comisiones_config.map((x, j) => (j === i ? { ...x, porcentaje: Number(e.target.value.replace(',', '.')) || 0 } : x)))} />
                </Campo>
                <Button variante="fantasma" soloIcono aria-label="Quitar categoría" onClick={() => cambiar('comisiones_config', f.comisiones_config.filter((_, j) => j !== i))}><Trash2 className="size-4" strokeWidth={2} /></Button>
              </div>
            ))}
            <Button variante="secundario" tamano="sm" className="self-start" iconoInicio={<Plus className="size-4" strokeWidth={2} />}
              onClick={() => cambiar('comisiones_config', [...f.comisiones_config, { glosa: '', porcentaje: 0 }])}>Agregar categoría</Button>
          </div>
        )}
      </Seccion>

      <Seccion titulo="3. Jornada">
        <Rejilla>
          <Campo etiqueta="Tipo de jornada">
            <select className={CONTROL} value={f.tipo_jornada} onChange={(e) => cambiar('tipo_jornada', e.target.value as TipoJornada)}>
              {JORNADAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </Campo>
          {!esArt22 && (
            <Campo etiqueta={maximo ? `Horas semanales (máximo vigente ${maximo} h)` : 'Horas semanales'}>
              <Input inputMode="decimal" value={f.horas_semanales} aria-invalid={errorHoras ? true : undefined}
                onChange={(e) => cambiar('horas_semanales', e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} />
              {errorHoras && <span className="text-[11.5px] text-danger">{errorHoras}</span>}
            </Campo>
          )}
        </Rejilla>
        {f.tipo_jornada === 'OTRO' && (
          <Campo etiqueta="Describe la jornada">
            <textarea rows={3} className={cn(CONTROL, 'h-auto py-2')} value={f.jornada_personalizada} onChange={(e) => cambiar('jornada_personalizada', e.target.value)} />
          </Campo>
        )}
        {conHorario && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-fg-2">Distribución semanal</span>
              <span className={cn('text-[12.5px] j40-num', Math.abs(totalHorario - Number(f.horas_semanales)) > 0.01 ? 'text-warn' : 'text-fg-3')}>
                Total {totalHorario.toLocaleString('es-CL', { maximumFractionDigits: 1 })} h de {f.horas_semanales} h pactadas
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[560px] flex flex-col gap-1.5">
                {DIAS.map(([d, nombre]) => {
                  const h = f.distribucion_horario[d] ?? { activo: false, entrada: '09:00', salida: '18:00', colacion: 60 };
                  const poner = (c: Partial<typeof h>) => cambiar('distribucion_horario', { ...f.distribucion_horario, [d]: { ...h, ...c } });
                  return (
                    <div key={d} className={cn('grid grid-cols-[120px_1fr_1fr_1fr_70px] gap-2 items-center', !h.activo && 'opacity-55')}>
                      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={h.activo} onChange={(e) => poner({ activo: e.target.checked })} className="size-4 accent-brand" />{nombre}</label>
                      <input type="time" aria-label={`Entrada ${nombre}`} className={CONTROL} value={h.entrada} disabled={!h.activo} onChange={(e) => poner({ entrada: e.target.value })} />
                      <input type="time" aria-label={`Salida ${nombre}`} className={CONTROL} value={h.salida} disabled={!h.activo} onChange={(e) => poner({ salida: e.target.value })} />
                      <label className="relative"><span className="sr-only">Colación {nombre}</span>
                        <input inputMode="numeric" className={cn(CONTROL, 'pr-12')} value={h.colacion} disabled={!h.activo} onChange={(e) => poner({ colacion: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
                        <span className="absolute right-3 top-2.5 text-[12px] text-fg-3">min</span></label>
                      <span className="text-[12.5px] text-fg-2 j40-num text-right">{h.activo ? `${horasDia(h).toLocaleString('es-CL', { maximumFractionDigits: 1 })} h` : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <ListaAvisos avisos={avisos} />
      </Seccion>

      <Seccion titulo="4. Cláusulas especiales">
        <ListaEditable titulo="" items={f.clausulas_especiales} onCambio={(v) => cambiar('clausulas_especiales', v)}
          placeholder="El trabajador podrá realizar teletrabajo los viernes" />
      </Seccion>
      </fieldset>

      {contrato && (
        <Seccion titulo="Anexo Ley 40 horas">
          <p className="text-[13px] text-fg-2">Reduce la jornada al máximo legal vigente. Se genera con los datos de este contrato.</p>
          <Button variante="secundario" className="self-start" cargando={guardando === 'anexo'} onClick={() => pdf('anexo')} iconoInicio={<Download className="size-4" strokeWidth={2} />}>Descargar anexo 40 horas</Button>
        </Seccion>
      )}

      <div className="fixed left-1/2 -translate-x-1/2 bottom-[84px] min-[720px]:bottom-6 z-[60] flex items-center gap-3 px-4 py-2.5 rounded-[12px] bg-surface border border-line-strong shadow-pop w-[min(620px,calc(100vw-24px))]">
        {soloLectura ? (
          <>
            <span className="flex-1 text-[13px]">Para cambiar las condiciones, crea un anexo.</span>
            <Button variante="secundario" onClick={() => navigate(`/app/trabajadores/${empleado.id}?tab=contrato`)}>Volver</Button>
            <Button onClick={() => navigate(rutaAccion(empleado.id, 'anexo'))} iconoInicio={<FilePlus className="size-4" strokeWidth={2} />}>Crear anexo</Button>
          </>
        ) : (
          <>
            <span className="flex-1 text-[13px]">{avisos.some((a) => a.gravedad === 'alta') ? 'Hay avisos de jornada: revísalos antes de guardar.' : 'Revisa los datos y guarda.'}</span>
            <Button variante="secundario" onClick={() => navigate(`/app/trabajadores/${empleado.id}?tab=contrato`)} disabled={guardando === 'guardar'}>Cancelar</Button>
            <Button onClick={guardar} cargando={guardando === 'guardar'} disabled={firmas.isLoading && Boolean(contrato)}
              iconoInicio={<Save className="size-4" strokeWidth={2} />}>{contrato ? 'Guardar cambios' : 'Crear contrato'}</Button>
          </>
        )}
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="bg-surface border border-line rounded-j40-card shadow-card p-[18px] flex flex-col gap-4"><h2 className="text-[15px] font-semibold">{titulo}</h2>{children}</section>;
}
function Rejilla({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3.5">{children}</div>;
}
function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 min-w-0 flex-1"><span className="text-[12.5px] font-medium text-fg-2">{etiqueta}</span>{children}</label>;
}
function Pesos({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  return (
    <span className="relative">
      <span className="absolute left-3 top-2.5 text-fg-3 text-[14px] pointer-events-none">$</span>
      <input inputMode="numeric" className={cn(CONTROL, 'pl-6 j40-num')} value={valor ? Number(valor).toLocaleString('es-CL') : ''}
        onChange={(e) => onCambio(e.target.value.replace(/\D/g, ''))} />
    </span>
  );
}
function ListaEditable({ titulo, nota, items, onCambio, placeholder }: {
  titulo: string; nota?: string; items: string[]; onCambio: (v: string[]) => void; placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {titulo && <div><span className="text-[12.5px] font-medium text-fg-2">{titulo}</span>{nota && <p className="text-[12px] text-fg-3">{nota}</p>}</div>}
      {items.map((x, i) => (
        <div key={i} className="flex gap-2">
          <Input value={x} placeholder={placeholder} onChange={(e) => onCambio(items.map((y, j) => (j === i ? e.target.value : y)))} />
          <Button variante="fantasma" soloIcono aria-label="Quitar" onClick={() => onCambio(items.filter((_, j) => j !== i))}><Trash2 className="size-4" strokeWidth={2} /></Button>
        </div>
      ))}
      <Button variante="secundario" tamano="sm" className="self-start" iconoInicio={<Plus className="size-4" strokeWidth={2} />} onClick={() => onCambio([...items, ''])}>Agregar</Button>
    </div>
  );
}
