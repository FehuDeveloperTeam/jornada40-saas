import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, FilePlus2, TriangleAlert } from 'lucide-react';
import { mensajeError, portal } from '../../api/portal';
import { CLAVE_PORTAL } from '../../hooks/usePortal';
import type { ConciliacionPedida, PeticionesPortal, PermisoPedido, VacacionPedida } from '../../types';
import { fechaCL, hoyISO } from '../../utils/formato';
import { AlertaError, Button, Chip, Input, Modal } from '../j40';
import type { TonoChip } from '../j40';
import { usePortal } from './PortalShell';

/**
 * Lo que el trabajador pide desde su portal (vacaciones, permisos legales y
 * conciliación, Ley 21.645). El backend calcula días y avisos; aquí solo se
 * elige de listas cerradas y se muestran las respuestas.
 */
const CONTROL = 'h-11 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[15px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';
const TONO: Record<string, TonoChip> = {
  PENDIENTE: 'aviso', APROBADO: 'ok', APROBADA: 'ok', ACEPTADA: 'ok', ALTERNATIVA: 'marca', RECHAZADO: 'neutro', RECHAZADA: 'neutro',
};
const enUnAnio = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
};

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5"><span className="text-[13px] font-medium text-fg-2">{etiqueta}</span>{children}</label>;
}

function Avisos({ avisos }: { avisos: string[] }) {
  if (!avisos.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {avisos.map((a) => (
        <p key={a} className="flex gap-2 rounded-j40-card bg-warn-soft text-warn px-3.5 py-2.5 text-[13.5px]">
          <TriangleAlert className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />{a}
        </p>
      ))}
    </div>
  );
}

export function Fila({ titulo, detalle, estado, estadoTexto, motivo }: {
  titulo: string; detalle: string; estado: string; estadoTexto: string; motivo?: string;
}) {
  return (
    <li className="flex flex-wrap gap-x-4 gap-y-1 items-center px-[18px] py-3 border-b border-line last:border-b-0">
      <span className="flex-1 min-w-[180px] flex flex-col">
        <span className="text-[14px] font-medium">{titulo}</span>
        <span className="text-[12px] text-fg-3 j40-num">{detalle}</span>
        {motivo && <span className="text-[12.5px] text-fg-2">Motivo: {motivo}</span>}
      </span>
      <Chip tono={TONO[estado] ?? 'neutro'}>{estadoTexto}</Chip>
    </li>
  );
}

/** Vacaciones y permisos pedidos, con botones para pedir (página Vacaciones). */
export function PeticionesVacaciones({ empleo }: { empleo: PeticionesPortal }) {
  const [vacacion, setVacacion] = useState(false);
  const [permiso, setPermiso] = useState(false);
  const lista: (VacacionPedida | PermisoPedido)[] = [...empleo.vacaciones, ...empleo.permisos]
    .sort((a, b) => b.pedida_en.localeCompare(a.pedida_en));
  return (
    <div className="border-t border-line">
      <div className="flex flex-wrap items-center gap-2.5 px-[18px] py-3">
        <h3 className="w-full sm:w-auto sm:flex-1 text-[12.5px] font-semibold text-fg-2">Mis solicitudes</h3>
        <Button tamano="lg" className="flex-1 sm:flex-none" onClick={() => setVacacion(true)} iconoInicio={<CalendarPlus className="size-5" strokeWidth={2} />}>Pedir vacaciones</Button>
        <Button tamano="lg" className="flex-1 sm:flex-none" variante="secundario" onClick={() => setPermiso(true)} iconoInicio={<FilePlus2 className="size-5" strokeWidth={2} />}>Pedir permiso</Button>
      </div>
      {lista.length === 0 && <p className="px-[18px] pb-4 text-[13px] text-fg-3">Aún no has pedido vacaciones ni permisos desde aquí.</p>}
      <ul className="flex flex-col">
        {lista.map((p) => 'tipo_texto' in p ? (
          <Fila key={`v${p.id}`} titulo={p.tipo_texto} detalle={`${fechaCL(p.desde)} al ${fechaCL(p.hasta)} · ${p.dias} ${p.dias === 1 ? 'día' : 'días'}`}
            estado={p.estado} estadoTexto={p.estado_texto} motivo={p.motivo} />
        ) : (
          <Fila key={`p${p.id}`} titulo={`Permiso: ${p.permiso_texto}`} detalle={`Hecho el ${fechaCL(p.fecha_hecho)}${p.inicio ? ` · desde el ${fechaCL(p.inicio)}` : ''}`}
            estado={p.estado} estadoTexto={p.estado_texto} motivo={p.motivo} />
        ))}
      </ul>
      {vacacion && <PedirVacaciones empleo={empleo} onCerrar={() => setVacacion(false)} />}
      {permiso && <PedirPermiso empleo={empleo} onCerrar={() => setPermiso(false)} />}
    </div>
  );
}

function PedirVacaciones({ empleo, onCerrar }: { empleo: PeticionesPortal; onCerrar: () => void }) {
  const { avisar } = usePortal();
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState(empleo.opciones.tipos_vacacion[0]?.valor ?? 'VACACION_LEGAL');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [enEspera, setEnEspera] = useState({ tipo, desde, hasta });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setEnEspera({ tipo, desde, hasta }), 300); return () => window.clearTimeout(t); }, [tipo, desde, hasta]);
  const calculo = useQuery({
    queryKey: [CLAVE_PORTAL, 'calcular', empleo.id, enEspera],
    queryFn: () => portal.calcularPeticion({ empleo: empleo.id, ...enEspera }),
    enabled: Boolean(enEspera.desde && enEspera.hasta),
    retry: false,
  });

  const enviar = async () => {
    setEnviando(true);
    setError('');
    try {
      await portal.pedirVacaciones({ empleo: empleo.id, tipo, desde, hasta });
      await queryClient.invalidateQueries({ queryKey: [CLAVE_PORTAL, 'peticiones'] });
      avisar('Listo: tu empleador recibió tu solicitud. Te avisaremos por correo cuando responda.');
      onCerrar();
    } catch (err) {
      setError(mensajeError(err, 'No pudimos enviar tu solicitud.'));
      setEnviando(false);
    }
  };

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Pedir vacaciones" subtitulo={empleo.empresa}
      acciones={<><Button variante="secundario" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
        <Button tamano="lg" onClick={() => void enviar()} cargando={enviando} disabled={!desde || !hasta || calculo.isError}>Enviar solicitud</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <AlertaError>{error}</AlertaError>}
        <Campo etiqueta="¿Qué necesitas?">
          <select className={CONTROL} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {empleo.opciones.tipos_vacacion.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Desde"><Input tamano="lg" type="date" value={desde} min={hoyISO()} max={enUnAnio()}
            onChange={(e) => { setDesde(e.target.value); if (!hasta || hasta < e.target.value) setHasta(e.target.value); }} /></Campo>
          <Campo etiqueta="Hasta"><Input tamano="lg" type="date" value={hasta} min={desde || hoyISO()} max={enUnAnio()}
            onChange={(e) => setHasta(e.target.value)} /></Campo>
        </div>
        {calculo.isError && <AlertaError>{mensajeError(calculo.error, 'Revisa las fechas.')}</AlertaError>}
        {calculo.data && (
          <div className="rounded-j40-card bg-sunken px-4 py-3 text-[14.5px] j40-num">
            <b>{calculo.data.dias} {calculo.data.dias === 1 ? 'día' : 'días'}</b> {tipo === 'DIA_COMPENSATORIO' ? 'libres' : 'hábiles'}
            {calculo.data.saldo !== null && ['VACACION_LEGAL', 'VACACION_PROGRESIVA'].includes(tipo) && (
              <span className="text-fg-2"> · tienes {calculo.data.saldo} disponibles</span>
            )}
          </div>
        )}
        <Avisos avisos={calculo.data?.avisos ?? []} />
        <p className="text-[12.5px] text-fg-3">Puedes pedir desde hoy y hasta 12 meses adelante. Tu empleador la aprueba o la rechaza; te avisaremos por correo.</p>
      </div>
    </Modal>
  );
}

function PedirPermiso({ empleo, onCerrar }: { empleo: PeticionesPortal; onCerrar: () => void }) {
  const { avisar } = usePortal();
  const queryClient = useQueryClient();
  const [permiso, setPermiso] = useState('');
  const [hecho, setHecho] = useState('');
  const [inicio, setInicio] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const elegido = empleo.opciones.permisos.find((p) => p.valor === permiso);

  const enviar = async () => {
    setEnviando(true);
    setError('');
    try {
      const r = await portal.pedirPermiso({ empleo: empleo.id, permiso, fecha_hecho: hecho, ...(inicio ? { inicio } : {}) });
      await queryClient.invalidateQueries({ queryKey: [CLAVE_PORTAL, 'peticiones'] });
      avisar(`Listo: pediste ${r.resumen}. Te avisaremos por correo cuando responda tu empleador.`);
      onCerrar();
    } catch (err) {
      setError(mensajeError(err, 'No pudimos enviar tu solicitud.'));
      setEnviando(false);
    }
  };

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Pedir permiso con goce de sueldo" subtitulo={empleo.empresa}
      acciones={<><Button variante="secundario" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
        <Button tamano="lg" onClick={() => void enviar()} cargando={enviando} disabled={!permiso || !hecho}>Enviar solicitud</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <AlertaError>{error}</AlertaError>}
        <Campo etiqueta="Motivo">
          <select className={CONTROL} value={permiso} onChange={(e) => setPermiso(e.target.value)}>
            <option value="">Elige el motivo…</option>
            {empleo.opciones.permisos.map((p) => <option key={p.valor} value={p.valor}>{p.texto} ({p.dias} días {p.tipo_dias})</option>)}
          </select>
        </Campo>
        <Campo etiqueta={permiso.startsWith('FALLECIMIENTO') ? 'Fecha del fallecimiento' : permiso === 'MATRIMONIO' ? 'Fecha del matrimonio' : 'Fecha del nacimiento o adopción'}>
          <Input tamano="lg" type="date" value={hecho} onChange={(e) => setHecho(e.target.value)} />
        </Campo>
        {elegido && !elegido.desde_el_hecho && (
          <Campo etiqueta="¿Desde qué día quieres usarlo?">
            <Input tamano="lg" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
        )}
        <p className="text-[12.5px] text-fg-3">Es un permiso pagado que da la ley. Tu empleador puede pedirte el certificado que lo acredita.</p>
      </div>
    </Modal>
  );
}

/** Solicitudes de conciliación (Ley 21.645) del portal. */
export function PedirConciliacion({ empleo, tipo, onCerrar }: {
  empleo: PeticionesPortal; tipo: ConciliacionPedida['tipo']; onCerrar: () => void;
}) {
  const { avisar } = usePortal();
  const queryClient = useQueryClient();
  const [cuidado, setCuidado] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const cambio = tipo === 'CAMBIO_JORNADA';
  const opcion = empleo.opciones.conciliacion.find((c) => c.valor === tipo);
  // Sin datos en su ficha, declara a quién cuida. Para el cambio de jornada debe ser un menor:
  // si su ficha dice otra cosa, lo declara aquí y el empleador lo confirma al responder.
  const pedirCuidado = !empleo.cuida || (cambio && !empleo.cuida_menores);
  const opcionesCuidado = cambio ? empleo.opciones.cuidados_menores : empleo.opciones.cuidados;
  const textoFicha = empleo.opciones.cuidados.find((c) => c.valor === empleo.cuida)?.texto;

  const enviar = async () => {
    setEnviando(true);
    setError('');
    try {
      const r = await portal.pedirConciliacion({ empleo: empleo.id, tipo, ...(cambio ? { desde, hasta } : {}), ...(cuidado ? { cuidado } : {}) });
      await queryClient.invalidateQueries({ queryKey: [CLAVE_PORTAL, 'peticiones'] });
      avisar(`Listo: tu empleador debe responderte a más tardar el ${fechaCL(r.vence_el)}.${r.avisos.length ? ` ${r.avisos.join(' ')}` : ''}`);
      onCerrar();
    } catch (err) {
      setError(mensajeError(err, 'No pudimos enviar tu solicitud.'));
      setEnviando(false);
    }
  };

  return (
    <Modal abierto onCerrar={onCerrar} titulo={opcion?.texto ?? 'Solicitud'} subtitulo={empleo.empresa}
      acciones={<><Button variante="secundario" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
        <Button tamano="lg" onClick={() => void enviar()} cargando={enviando}
          disabled={(pedirCuidado && !cuidado) || (cambio && (!desde || !hasta))}>Enviar solicitud</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <AlertaError>{error}</AlertaError>}
        {pedirCuidado && (
          <Campo etiqueta="¿A quién cuidas?">
            <select className={CONTROL} value={cuidado} onChange={(e) => setCuidado(e.target.value)}>
              <option value="">Elige una opción…</option>
              {opcionesCuidado.map((c) => <option key={c.valor} value={c.valor}>{c.texto}</option>)}
            </select>
          </Campo>
        )}
        {pedirCuidado && empleo.cuida && textoFicha && (
          <p className="text-[13px] text-fg-2">
            Tu ficha dice que cuidas a: <b>{textoFicha.toLowerCase()}</b>. El cambio de jornada es para quien cuida a un menor:
            si es tu caso, elígelo arriba y tu empleador lo confirmará al responder.
          </p>
        )}
        {cambio && (
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Desde"><Input tamano="lg" type="date" value={desde} min={hoyISO()} max={enUnAnio()}
              onChange={(e) => { setDesde(e.target.value); if (!hasta || hasta < e.target.value) setHasta(e.target.value); }} /></Campo>
            <Campo etiqueta="Hasta"><Input tamano="lg" type="date" value={hasta} min={desde || hoyISO()} max={enUnAnio()}
              onChange={(e) => setHasta(e.target.value)} /></Campo>
          </div>
        )}
        <p className="text-[13px] text-fg-2">
          {cambio
            ? 'Es para el período de vacaciones escolares. Pídelo con al menos 30 días de anticipación; tu empleador debe responder en 10 días.'
            : 'Si tu cargo se puede hacer a distancia, tu empleador debe responderte en 15 días.'}
          {' '}Si lo rechaza u ofrece otra fórmula, debe explicarte por qué.
        </p>
      </div>
    </Modal>
  );
}
