import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { CirclePlus } from 'lucide-react';
import client from '../../../api/client';
import { usePermisos } from '../../../hooks/usePermisos';
import type { Empleado, OpcionesConciliacion, SolicitudConciliacion } from '../../../types';
import { fechaCL, hoyISO } from '../../../utils/formato';
import { AlertaError, Button, Chip, Input, Modal, SegmentedControl } from '../../j40';
import type { TonoChip } from '../../j40';
import { Seccion } from './comun';

/**
 * Solicitudes de un trabajador con responsabilidades de cuidado (Ley 21.645):
 * teletrabajo (respuesta en 15 días) y cambio transitorio de jornada en
 * vacaciones escolares (10 días; se propone con 30 de anticipación). El backend
 * calcula plazos y avisos (views/conciliacion.py); aquí solo se registran.
 */
const CONTROL = 'h-10 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';
const TONO: Record<SolicitudConciliacion['estado'], TonoChip> = { PENDIENTE: 'aviso', ACEPTADA: 'ok', ALTERNATIVA: 'marca', RECHAZADA: 'neutro' };
type Avisar = (t: string) => void;

const mensaje = (err: unknown, porDefecto: string) => {
  const d = isAxiosError(err) ? (err.response?.data as Record<string, unknown> | undefined) : undefined;
  if (!d) return porDefecto;
  const primero = d.error ?? Object.values(d)[0];
  return Array.isArray(primero) ? String(primero[0]) : typeof primero === 'string' ? primero : porDefecto;
};

export function Conciliacion({ empleado, avisar }: { empleado: Empleado; avisar: Avisar }) {
  const gestionar = usePermisos().puede('TRABAJADORES', true);
  const clave = ['solicitudes-conciliacion', empleado.id];
  const lista = useQuery({
    queryKey: clave,
    queryFn: async () => (await client.get<SolicitudConciliacion[] | { results: SolicitudConciliacion[] }>(
      `/solicitudes-conciliacion/?empleado=${empleado.id}`)).data,
    select: (d) => Array.isArray(d) ? d : d.results,
  });
  const opciones = useQuery({
    queryKey: ['solicitudes-conciliacion', 'opciones'],
    queryFn: async () => (await client.get<OpcionesConciliacion>('/solicitudes-conciliacion/opciones/')).data,
    staleTime: 60 * 60_000,
  });
  const [nueva, setNueva] = useState(false);
  const [responder, setResponder] = useState<SolicitudConciliacion | null>(null);
  const solicitudes = lista.data ?? [];
  // Se muestra a quien cuida o a quien pidió algo desde su portal (declarando a quién cuida).
  if (!empleado.cuidado_de && solicitudes.length === 0) return null;

  return (
    <Seccion titulo="Solicitudes por responsabilidades de cuidado (Ley 21.645)"
      accion={gestionar && <Button variante="secundario" tamano="sm" onClick={() => setNueva(true)}
        iconoInicio={<CirclePlus className="size-4" strokeWidth={2} />}>Registrar solicitud</Button>}>
      <p className="px-[18px] pt-3 text-[13px] text-fg-2">
        Registra aquí lo que el trabajador te pidió por escrito: teletrabajo (respondes en 15 días) o un cambio de turnos o
        jornada en vacaciones escolares (respondes en 10). Si rechazas u ofreces otra fórmula, debes explicar por qué.
      </p>
      {solicitudes.length === 0 && <p className="px-[18px] py-4 text-[13px] text-fg-3">No hay solicitudes registradas.</p>}
      {!empleado.cuidado_de && (
        <p className="px-[18px] pt-2 text-[12.5px] text-warn">
          Su ficha aún no indica responsabilidades de cuidado: lo declaró al pedir desde su portal. Al responder, queda en
          su ficha (salvo que rechaces porque no las acreditó).
        </p>
      )}
      {solicitudes.map((s) => (
        <div key={s.id} className="flex flex-col gap-1.5 px-[18px] py-3 border-t border-line first-of-type:border-t-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[14px] font-medium flex-1 min-w-[200px]">{s.tipo_texto}</span>
            <Chip tono={TONO[s.estado]}>{s.estado_texto}</Chip>
            {s.estado === 'PENDIENTE' && gestionar && (
              <Button tamano="sm" onClick={() => setResponder(s)}>Registrar respuesta</Button>
            )}
          </div>
          <span className="text-[12.5px] text-fg-3">
            Presentada el {fechaCL(s.presentada_el)}
            {s.desde ? ` · desde el ${fechaCL(s.desde)}${s.hasta ? ` al ${fechaCL(s.hasta)}` : ''}` : ''}
            {s.estado === 'PENDIENTE' ? ` · responder a más tardar el ${fechaCL(s.vence_el)}` : s.respondida_el ? ` · respondida el ${fechaCL(s.respondida_el)}` : ''}
          </span>
          {s.motivo_texto && <span className="text-[12.5px] text-fg-2">Motivo: {s.motivo_texto}. {s.fundamento}</span>}
          {s.avisos.map((a) => <span key={a} className="text-[12.5px] text-warn">{a}</span>)}
        </div>
      ))}
      {nueva && opciones.data && (
        <NuevaSolicitud empleado={empleado} opciones={opciones.data} onCerrar={() => setNueva(false)} avisar={avisar} />
      )}
      {responder && opciones.data && (
        <Responder solicitud={responder} opciones={opciones.data} onCerrar={() => setResponder(null)} avisar={avisar} />
      )}
    </Seccion>
  );
}

function NuevaSolicitud({ empleado, opciones, onCerrar, avisar }: {
  empleado: Empleado; opciones: OpcionesConciliacion; onCerrar: () => void; avisar: Avisar;
}) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState(opciones.tipos[0]?.valor ?? 'TELETRABAJO');
  const [presentada, setPresentada] = useState(hoyISO());
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambio = tipo === 'CAMBIO_JORNADA';

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      await client.post('/solicitudes-conciliacion/', {
        empleado: empleado.id, tipo, presentada_el: presentada, desde: cambio ? desde || null : null, hasta: cambio ? hasta || null : null,
      });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['solicitudes-conciliacion', empleado.id] }),
        queryClient.invalidateQueries({ queryKey: ['empleados'] })]);
      avisar('Solicitud registrada');
      onCerrar();
    } catch (err) {
      setError(mensaje(err, 'No pudimos registrar la solicitud.'));
      setGuardando(false);
    }
  };

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Registrar solicitud"
      acciones={<><Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button onClick={() => void guardar()} cargando={guardando}>Registrar</Button></>}>
      <div className="flex flex-col gap-3.5">
        {error && <AlertaError>{error}</AlertaError>}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-2">¿Qué pidió?</span>
          <select className={CONTROL} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            {opciones.tipos.map((t) => <option key={t.valor} value={t.valor}>{t.texto} (respondes en {t.plazo_dias} días)</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-2">Fecha en que lo pidió por escrito</span>
          <Input type="date" value={presentada} max={hoyISO()} onChange={(e) => setPresentada(e.target.value)} />
        </label>
        {cambio && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5"><span className="text-[12.5px] font-medium text-fg-2">Desde</span>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
            <label className="flex flex-col gap-1.5"><span className="text-[12.5px] font-medium text-fg-2">Hasta</span>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Responder({ solicitud, opciones, onCerrar, avisar }: {
  solicitud: SolicitudConciliacion; opciones: OpcionesConciliacion; onCerrar: () => void; avisar: Avisar;
}) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<'ACEPTADA' | 'ALTERNATIVA' | 'RECHAZADA'>('ACEPTADA');
  const [motivo, setMotivo] = useState('');
  const [fundamento, setFundamento] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      await client.post(`/solicitudes-conciliacion/${solicitud.id}/responder/`, { estado, motivo, fundamento, respondida_el: fecha });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['solicitudes-conciliacion', solicitud.empleado] }),
        queryClient.invalidateQueries({ queryKey: ['empleados'] })]);
      avisar('Respuesta registrada');
      onCerrar();
    } catch (err) {
      setError(mensaje(err, 'No pudimos registrar la respuesta.'));
      setGuardando(false);
    }
  };

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Registrar respuesta" subtitulo={solicitud.tipo_texto}
      acciones={<><Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button onClick={() => void guardar()} cargando={guardando}>Guardar respuesta</Button></>}>
      <div className="flex flex-col gap-3.5">
        {error && <AlertaError>{error}</AlertaError>}
        <SegmentedControl etiqueta="Respuesta" valor={estado} bloque onChange={setEstado}
          opciones={[{ valor: 'ACEPTADA', etiqueta: 'Aceptar' }, { valor: 'ALTERNATIVA', etiqueta: 'Otra fórmula' }, { valor: 'RECHAZADA', etiqueta: 'Rechazar' }]} />
        {estado !== 'ACEPTADA' && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-fg-2">Motivo</span>
              <select className={CONTROL} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option value="">Elige el motivo…</option>
                {opciones.motivos.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-fg-2">
                {estado === 'ALTERNATIVA' ? 'Qué le ofreces y por qué' : 'Circunstancias que lo justifican'}
              </span>
              <textarea rows={3} maxLength={500} className={`${CONTROL} h-auto py-2`} value={fundamento} onChange={(e) => setFundamento(e.target.value)} />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-2">Fecha de la respuesta</span>
          <Input type="date" value={fecha} min={solicitud.presentada_el} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <p className="text-[12.5px] text-fg-3">Entrégale la respuesta por escrito. Aquí queda el registro con su fecha.</p>
      </div>
    </Modal>
  );
}
