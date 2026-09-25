import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Check, CreditCard, Info, RotateCcw, TriangleAlert } from 'lucide-react';
import { AlertaError, Button, Chip, Modal } from '../../components/j40';
import type { TonoChip } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import { INCLUYE_POR_NIVEL, NIVEL_DESTACADO } from '../../components/sitio/contenido';
import client from '../../api/client';
import { irAPagar } from '../../api/pagos';
import type { Checkout as RespuestaCheckout } from '../../api/pagos';
import { useEmpresaActiva } from '../../hooks/usePanel';
import { formatearPrecio, precioCiclo, usePlanes } from '../../hooks/usePlanes';
import type { Ciclo } from '../../hooks/usePlanes';
import { SelectorCiclo } from '../../components/sitio/SelectorCiclo';
import type { Plan as TPlan } from '../../types';
import { cn } from '../../utils/cn';
import { fechaCL } from '../../utils/formato';

const ESTADO: Record<string, { texto: string; tono: TonoChip }> = {
  ACTIVE: { texto: 'Activa', tono: 'ok' }, TRIAL: { texto: 'Prueba', tono: 'marca' },
  PAST_DUE: { texto: 'Pago pendiente', tono: 'aviso' }, CANCELED: { texto: 'Cancelada', tono: 'peligro' },
};
const AVISO: Record<string, { texto: string; accion: string; clase: string }> = {
  PAST_DUE: { texto: 'Tu último pago no se pudo procesar. Regularízalo para mantener las funciones de tu plan.', accion: 'Pagar ahora', clase: 'bg-warn-soft text-warn' },
  TRIAL: { texto: 'Estás en período de prueba. Agrega un medio de pago para no perder el acceso.', accion: 'Agregar medio de pago', clase: 'bg-brand-soft text-brand-text' },
  CANCELED: { texto: 'Tu suscripción está cancelada. Reactívala para volver a emitir documentos.', accion: 'Reactivar', clase: 'bg-danger-soft text-danger' },
};

/** Qué se va a pagar: un plan nuevo o el mismo en otro ciclo. */
interface Eleccion { plan: TPlan; ciclo: Ciclo; modo: 'nuevo' | 'ciclo' }

const errorDe = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

/** Lo que se deja de tener al pasar de un nivel a otro menor. */
function funcionesQueSePierden(desde: number, hasta: number): string[] {
  const perdidas: string[] = [];
  for (let n = hasta + 1; n <= desde; n++) {
    for (const f of INCLUYE_POR_NIVEL[n] ?? []) {
      if (f.startsWith('Todo lo de')) { if (n === 2) perdidas.push('Documentos sin la marca Jornada40'); }
      else perdidas.push(f);
    }
  }
  return perdidas;
}

export default function Plan() {
  const { suscripcion, trabajadores, nivel, maxEmpresas, errorSuscripcion, reintentarSuscripcion, avisar } = usePanelContexto();
  const { planes } = usePlanes();
  const { empresas } = useEmpresaActiva();
  const queryClient = useQueryClient();
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);
  const [bajada, setBajada] = useState<TPlan | null>(null);
  const [procesando, setProcesando] = useState(false);

  /** Reanudar la renovación o deshacer una bajada: operaciones sin pago, directo con Reveniu. */
  const operar = async (ruta: string, porDefecto: string) => {
    setProcesando(true);
    try {
      const { data } = await client.post<{ mensaje: string }>(ruta);
      avisar(data.mensaje);
      await queryClient.invalidateQueries({ queryKey: ['mi_suscripcion'] });
    } catch (err) {
      avisar(errorDe(err, porDefecto), 'error');
    } finally {
      setProcesando(false);
    }
  };
  // Parte en el ciclo de la suscripción; al elegir el otro se puede cambiar de ciclo.
  const [cicloElegido, setCiclo] = useState<Ciclo | null>(null);
  const cicloActual: Ciclo = suscripcion?.ciclo === 'anual' ? 'anual' : 'mensual';
  const ciclo = cicloElegido ?? cicloActual;

  const elegir = (plan: TPlan, modo: Eleccion['modo'] = 'nuevo', cicloPago: Ciclo = ciclo) => setEleccion({ plan, ciclo: cicloPago, modo });

  if (!suscripcion) {
    if (errorSuscripcion) {
      return (
        <div className="max-w-[640px] mx-auto flex flex-col gap-3 items-start">
          <AlertaError>No pudimos cargar tu suscripción. Revisa tu conexión e inténtalo de nuevo.</AlertaError>
          <Button variante="secundario" onClick={reintentarSuscripcion} iconoInicio={<RotateCcw className="size-4" strokeWidth={2} />}>Reintentar</Button>
        </div>
      );
    }
    return <p className="text-[14px] text-fg-3" role="status">Cargando…</p>;
  }
  const actual = planes.find((p) => p.id === suscripcion.plan.id);
  // Se canceló la suscripción pagada y la cuenta volvió al plan gratuito: no hay nada que "reactivar".
  const volvioAGratis = suscripcion.estado === 'CANCELED' && !suscripcion.plan.precio;
  const pagado = suscripcion.plan.precio > 0 && !volvioAGratis;
  const precioAnualActual = suscripcion.plan.precio_anual ?? actual?.precio_anual ?? 0;
  const precioActual = !suscripcion.plan.precio ? 'Gratis'
    : cicloActual === 'anual' && precioAnualActual ? `${formatearPrecio(precioAnualActual)} al año`
      : cicloActual === 'anual' ? 'Pago anual'
        : `${formatearPrecio(suscripcion.plan.precio)} al mes`;
  const usoTrabajadores = suscripcion.trabajadores_actuales ?? trabajadores.filter((t) => t.activo).length;
  const usoEmpresas = empresas.length;
  const estado = volvioAGratis ? { texto: 'Plan gratuito', tono: 'neutro' as TonoChip } : ESTADO[suscripcion.estado] ?? ESTADO.ACTIVE;
  const aviso = volvioAGratis ? undefined : AVISO[suscripcion.estado];
  const ordenados = [...planes].sort((a, b) => a.nivel - b.nivel);

  return (
    <div className="max-w-[1280px] mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Plan y facturación</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">Tu suscripción, el uso de la cuenta y los planes disponibles</p>
      </div>

      {aviso && actual && (
        <div className={cn('flex flex-wrap items-center gap-3 rounded-j40-card px-4 py-3', aviso.clase)}>
          <TriangleAlert className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          <p className="flex-1 min-w-[220px] text-[13px]">{aviso.texto}</p>
          <Button tamano="sm" onClick={() => elegir(actual, 'nuevo', cicloActual)}>{aviso.accion}</Button>
        </div>
      )}

      {volvioAGratis && (
        <div className="flex flex-wrap items-center gap-3 rounded-j40-card px-4 py-3 bg-brand-soft text-brand-text">
          <Info className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          <p className="flex-1 min-w-[220px] text-[13px]">
            Tu plan pagado terminó; estás en {suscripcion.plan.nombre}. Tus datos siguen guardados: elige un plan abajo cuando quieras volver.
          </p>
        </div>
      )}

      {suscripcion.renovacion_cancelada && suscripcion.estado === 'ACTIVE' && (
        <div className="flex flex-wrap items-center gap-3 rounded-j40-card px-4 py-3 bg-warn-soft text-warn">
          <TriangleAlert className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          <p className="flex-1 min-w-[220px] text-[13px]">
            Cancelaste la renovación. Mantienes el plan {suscripcion.plan.nombre}
            {suscripcion.fecha_proximo_cobro ? ` hasta el ${fechaCL(suscripcion.fecha_proximo_cobro)}` : ' hasta el fin del período pagado'};
            después la cuenta pasa al plan gratuito sin borrar tus datos.
          </p>
          {/* Reactiva la misma suscripción: no hay un cobro nuevo por el período ya pagado. */}
          <Button tamano="sm" cargando={procesando} onClick={() => operar('/pagos/reanudar/', 'No pudimos reanudar tu plan.')}>
            Reanudar
          </Button>
        </div>
      )}

      {suscripcion.cambio_programado && (
        <div className="flex flex-wrap items-center gap-3 rounded-j40-card px-4 py-3 bg-brand-soft text-brand-text">
          <Info className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          <p className="flex-1 min-w-[220px] text-[13px]">
            Desde {suscripcion.cambio_programado.desde ? `el ${fechaCL(suscripcion.cambio_programado.desde)}` : 'tu próximo cobro'} pasas
            al plan {suscripcion.cambio_programado.plan.nombre}. Hasta entonces mantienes {suscripcion.plan.nombre} con todas sus funciones.
          </p>
          <Button tamano="sm" variante="secundario" cargando={procesando}
            onClick={() => operar('/pagos/cancelar-cambio/', 'No pudimos deshacer el cambio.')}>
            Mantener {suscripcion.plan.nombre}
          </Button>
        </div>
      )}

      <section className="bg-surface border border-line rounded-j40-card shadow-card p-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-fg-3">Plan actual</span>
          <span className="flex items-center gap-2"><span className="text-[22px] font-semibold">{suscripcion.plan.nombre}</span><Chip tono={estado.tono}>{estado.texto}</Chip></span>
          <span className="text-[13px] text-fg-2 j40-num">{precioActual}</span>
        </div>
        <Uso titulo="Trabajadores vigentes" usado={usoTrabajadores} limite={suscripcion.plan.limite_trabajadores} />
        <Uso titulo="Empresas" usado={usoEmpresas} limite={maxEmpresas} />
        {/* Sin plan pagado no hay cobros; sin datos de Reveniu no se muestran filas vacías. */}
        {pagado && (
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-fg-3">{suscripcion.renovacion_cancelada ? 'Acceso hasta' : 'Próximo cobro'}</span>
            {suscripcion.fecha_proximo_cobro
              ? <span className="text-[14px] font-medium">{fechaCL(suscripcion.fecha_proximo_cobro)}</span>
              : <span className="text-[13px] text-fg-2">Lo ves en el correo de Reveniu</span>}
            {suscripcion.metodo_pago_glosa && (
              <span className="text-[12px] text-fg-3 inline-flex items-center gap-1.5"><CreditCard className="size-3.5" strokeWidth={2} aria-hidden />
                {suscripcion.metodo_pago_glosa}</span>
            )}
          </div>
        )}
      </section>

      <SelectorCiclo valor={ciclo} onChange={setCiclo} className="self-start" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3.5">
        {ordenados.map((p) => {
          const esActual = p.id === suscripcion.plan.id;
          const sube = p.nivel > nivel;
          const excede = usoTrabajadores > p.limite_trabajadores ? `Tienes ${usoTrabajadores} trabajadores vigentes; este plan permite ${p.limite_trabajadores}.`
            : usoEmpresas > p.max_empresas ? `Tienes ${usoEmpresas} empresas; este plan permite ${p.max_empresas}.` : '';
          return (
            <section key={p.id} className={cn('bg-surface border rounded-j40-card shadow-card p-[18px] flex flex-col gap-3',
              esActual ? 'border-brand ring-[3px] ring-brand-soft' : 'border-line')}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[16px] font-semibold">{p.nombre}</h2>
                {p.nivel === NIVEL_DESTACADO && !esActual && <Chip tono="marca">Más elegido</Chip>}
                {esActual && <Chip tono="ok">Tu plan</Chip>}
              </div>
              <span className="text-[22px] font-semibold j40-num">{p.precio ? formatearPrecio(precioCiclo(p, ciclo)) : 'Gratis'}<span className="text-[12.5px] font-normal text-fg-3"> {p.precio ? (ciclo === 'anual' && p.precio_anual ? '/ año' : '/ mes') : ''}</span></span>
              <span className="text-[12.5px] text-fg-2">Hasta {p.limite_trabajadores} trabajadores · {p.max_empresas} {p.max_empresas === 1 ? 'empresa' : 'empresas'}</span>
              <ul className="flex flex-col gap-1.5 flex-1">
                {(INCLUYE_POR_NIVEL[p.nivel] ?? []).map((t) => (
                  <li key={t} className="flex gap-2 text-[12.5px] text-fg-2"><Check className="size-4 text-ok shrink-0" strokeWidth={2.5} aria-hidden />{t}</li>
                ))}
              </ul>
              {excede && !esActual && (pagado && !p.precio
                // Pasar al plan gratuito siempre se puede (es no renovar): solo se advierte.
                ? <p className="text-[12px] text-fg-3">{excede} Podrás seguir usando lo que tienes, pero no agregar más.</p>
                : <p className="text-[12px] text-danger">{excede}</p>)}
              {esActual && p.precio > 0 && p.precio_anual > 0 && ciclo !== cicloActual
                ? <Button onClick={() => elegir(p, 'ciclo')}>Cambiar a {ciclo}</Button>
                : esActual ? <Button variante="secundario" disabled>Plan actual{p.precio ? ` · ${cicloActual}` : ''}</Button>
                : sube || (volvioAGratis && p.precio > 0) ? <Button onClick={() => elegir(p)}>{volvioAGratis ? `Elegir ${p.nombre}` : `Subir a ${p.nombre}`}</Button>
                  : !pagado ? null
                  : suscripcion.cambio_programado?.plan.id === p.id ? <Button variante="secundario" disabled>Programado</Button>
                  : <Button variante="secundario" onClick={() => setBajada(p)}
                      disabled={Boolean(excede && p.precio) || Boolean(suscripcion.renovacion_cancelada) || Boolean(suscripcion.cambio_programado)}
                      title={suscripcion.renovacion_cancelada ? 'Reanuda tu plan para cambiarlo'
                        : suscripcion.cambio_programado ? 'Ya tienes un cambio programado' : undefined}>
                      {p.precio ? `Bajar a ${p.nombre}` : `Pasar a ${p.nombre}`}
                    </Button>}
            </section>
          );
        })}
      </div>

      <section className="bg-surface border border-line rounded-j40-card shadow-card p-[18px] flex flex-col gap-2">
        <h2 className="text-[14px] font-semibold">Historial de pagos</h2>
        {!suscripcion.pagos?.length ? <p className="text-[13px] text-fg-3">Aún no hay pagos registrados.</p> : (
          <ul className="flex flex-col">
            {suscripcion.pagos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 border-b border-line last:border-b-0 text-[13px]">
                <span>{p.fecha ? fechaCL(p.fecha) : '—'} · Plan {p.plan ?? '—'}{p.orden && <span className="text-fg-3 j40-mono text-[12px]"> · orden {p.orden}</span>}</span>
                <span className="font-medium j40-num">{formatearPrecio(p.monto)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {eleccion && <Checkout plan={eleccion.plan} ciclo={eleccion.ciclo} modo={eleccion.modo} onCerrar={() => setEleccion(null)} />}
      {bajada && <Bajada plan={bajada} nombreActual={suscripcion.plan.nombre} nivelActual={nivel} ciclo={cicloActual}
        proximoCobro={suscripcion.fecha_proximo_cobro} onCerrar={() => setBajada(null)}
        onListo={(mensaje) => { setBajada(null); avisar(mensaje); void queryClient.invalidateQueries({ queryKey: ['mi_suscripcion'] }); }} />}
    </div>
  );
}

function Uso({ titulo, usado, limite }: { titulo: string; usado: number; limite: number }) {
  const pct = Math.min(100, (usado / Math.max(1, limite)) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-fg-3">{titulo}</span>
      <span className="text-[14px] font-medium j40-num">{usado} de {limite}</span>
      <span className="h-1.5 rounded-full bg-sunken overflow-hidden">
        <span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warn' : 'bg-brand')} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

function Checkout({ plan, ciclo, modo, onCerrar }: { plan: TPlan; ciclo: Ciclo; modo: Eleccion['modo']; onCerrar: () => void }) {
  const anual = ciclo === 'anual' && Boolean(plan.precio_anual);
  const [estado, setEstado] = useState<'resumen' | 'conectando'>('resumen');
  const [error, setError] = useState('');

  const pagar = async () => {
    setEstado('conectando');
    setError('');
    try {
      const { data } = await client.post<RespuestaCheckout>('/pagos/crear-checkout/', { plan_id: plan.id, ciclo: anual ? 'anual' : 'mensual' });
      irAPagar(data);  // el pago se confirma por webhook
    } catch (err) {
      setError(errorDe(err, 'No pudimos conectar con la pasarela de pago.'));
      setEstado('resumen');
    }
  };

  return (
    <Modal abierto onCerrar={() => estado === 'resumen' && onCerrar()} titulo={`Plan ${plan.nombre}`} subtitulo={`Pago ${anual ? 'anual' : 'mensual'} con Reveniu`}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={estado === 'conectando'}>Cancelar</Button>
        <Button onClick={pagar} cargando={estado === 'conectando'}>{estado === 'conectando' ? 'Conectando con Reveniu…' : 'Ir a pagar'}</Button>
      </>}>
      <div className="flex flex-col gap-3">
        {error && <AlertaError>{error}</AlertaError>}
        <div className="flex justify-between text-[14px] rounded-[10px] bg-sunken px-3.5 py-3">
          <span>Plan {plan.nombre} · {anual ? 'anual (2 meses gratis)' : 'mensual'}</span>
          <span className="font-semibold j40-num">{formatearPrecio(precioCiclo(plan, anual ? 'anual' : 'mensual'))}</span>
        </div>
        <p className="text-[13px] text-fg-2">
          {modo === 'ciclo'
            ? `Te llevamos a Reveniu para pagar el ${anual ? 'año' : 'mes'}. Cuando se confirme, cancelamos tu suscripción ${anual ? 'mensual' : 'anual'} anterior en Reveniu. El período en curso no se prorratea ni se reembolsa.`
            : 'Te llevamos a Reveniu para pagar. Cuando el pago se confirme, los nuevos límites y funciones quedan activos en tu cuenta.'}
        </p>
      </div>
    </Modal>
  );
}

function Bajada({ plan, nombreActual, nivelActual, ciclo, proximoCobro, onCerrar, onListo }: {
  plan: TPlan; nombreActual: string; nivelActual: number; ciclo: Ciclo; proximoCobro: string | null;
  onCerrar: () => void; onListo: (mensaje: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const gratis = !plan.precio;
  const cuando = proximoCobro ? `el ${fechaCL(proximoCobro)}` : 'tu próximo cobro';
  const perdidas = funcionesQueSePierden(nivelActual, plan.nivel);

  const confirmar = async () => {
    setEnviando(true);
    setError('');
    try {
      const { data } = await client.post<{ mensaje: string }>('/pagos/bajar-plan/', { plan_id: plan.id });
      onListo(data.mensaje);
    } catch (err) {
      setError(errorDe(err, 'No pudimos programar el cambio.'));
      setEnviando(false);
    }
  };

  return (
    <Modal abierto onCerrar={() => !enviando && onCerrar()} titulo={gratis ? `Pasar a ${plan.nombre}` : `Bajar a ${plan.nombre}`}
      subtitulo={`Rige desde ${cuando}`}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={enviando}>Volver</Button>
        <Button onClick={confirmar} cargando={enviando}>Confirmar cambio</Button>
      </>}>
      <div className="flex flex-col gap-3 text-[13px] text-fg-2">
        {error && <AlertaError>{error}</AlertaError>}
        {gratis ? (
          <p>Tu plan {nombreActual} no se renovará: lo mantienes hasta {cuando} y después la cuenta pasa a {plan.nombre}, sin
            cobros y sin borrar tus datos. Si tienes más trabajadores o empresas de los que permite, no podrás agregar nuevos.</p>
        ) : (
          <>
            <div className="flex justify-between text-[14px] text-fg rounded-[10px] bg-sunken px-3.5 py-3">
              <span>Plan {plan.nombre} · {ciclo}</span>
              <span className="font-semibold j40-num">{formatearPrecio(precioCiclo(plan, ciclo))}</span>
            </div>
            <p>Hasta {cuando} sigues con {nombreActual} y todas sus funciones. Desde ese cobro, Reveniu te cobra el monto
              de {plan.nombre} con la misma tarjeta, sin volver a inscribirla. El período en curso no se prorratea ni se reembolsa.</p>
          </>
        )}
        {perdidas.length > 0 && (
          <div>
            <p className="font-medium text-fg">Dejarás de tener:</p>
            <ul className="list-disc pl-5 mt-1">{perdidas.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
