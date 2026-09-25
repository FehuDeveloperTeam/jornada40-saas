import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Check, CreditCard, TriangleAlert } from 'lucide-react';
import { AlertaError, Button, Chip, Modal } from '../../components/j40';
import type { TonoChip } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import { INCLUYE_POR_NIVEL, NIVEL_DESTACADO } from '../../components/sitio/contenido';
import client from '../../api/client';
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

export default function Plan() {
  const { suscripcion, trabajadores, nivel, maxEmpresas } = usePanelContexto();
  const { planes } = usePlanes();
  const { empresas } = useEmpresaActiva();
  const [elegido, setElegido] = useState<TPlan | null>(null);
  // Parte en el ciclo de la suscripción; al elegir el otro se puede cambiar de ciclo.
  const [cicloElegido, setCiclo] = useState<Ciclo | null>(null);
  const cicloActual: Ciclo = suscripcion?.ciclo === 'anual' ? 'anual' : 'mensual';
  const ciclo = cicloElegido ?? cicloActual;

  if (!suscripcion) return <p className="text-[14px] text-fg-3" role="status">Cargando…</p>;
  const actual = planes.find((p) => p.id === suscripcion.plan.id);
  const usoTrabajadores = suscripcion.trabajadores_actuales ?? trabajadores.filter((t) => t.activo).length;
  const usoEmpresas = empresas.length;
  const estado = ESTADO[suscripcion.estado] ?? ESTADO.ACTIVE;
  const aviso = AVISO[suscripcion.estado];
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
          <Button tamano="sm" onClick={() => setElegido(actual)}>{aviso.accion}</Button>
        </div>
      )}

      {suscripcion.renovacion_cancelada && suscripcion.estado === 'ACTIVE' && (
        <div className="flex items-center gap-3 rounded-j40-card px-4 py-3 bg-warn-soft text-warn">
          <TriangleAlert className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          <p className="flex-1 text-[13px]">Cancelaste la renovación. Mantienes el plan {suscripcion.plan.nombre} hasta el fin del período pagado; después la cuenta pasa al plan gratuito sin borrar tus datos.</p>
        </div>
      )}

      <section className="bg-surface border border-line rounded-j40-card shadow-card p-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-fg-3">Plan actual</span>
          <span className="flex items-center gap-2"><span className="text-[22px] font-semibold">{suscripcion.plan.nombre}</span><Chip tono={estado.tono}>{estado.texto}</Chip></span>
          <span className="text-[13px] text-fg-2 j40-num">{suscripcion.plan.precio ? `${formatearPrecio(suscripcion.plan.precio)} al mes` : 'Gratis'}</span>
        </div>
        <Uso titulo="Trabajadores vigentes" usado={usoTrabajadores} limite={suscripcion.plan.limite_trabajadores} />
        <Uso titulo="Empresas" usado={usoEmpresas} limite={maxEmpresas} />
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-fg-3">Próximo cobro</span>
          <span className="text-[14px] font-medium">{suscripcion.fecha_proximo_cobro ? fechaCL(suscripcion.fecha_proximo_cobro) : '—'}</span>
          <span className="text-[12px] text-fg-3 inline-flex items-center gap-1.5"><CreditCard className="size-3.5" strokeWidth={2} aria-hidden />
            {suscripcion.metodo_pago_glosa || 'Medio de pago en Reveniu'}</span>
        </div>
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
              {excede && !esActual && <p className="text-[12px] text-danger">{excede}</p>}
              {esActual && p.precio > 0 && p.precio_anual > 0 && ciclo !== cicloActual
                ? <Button onClick={() => setElegido(p)}>Cambiar a {ciclo}</Button>
                : esActual ? <Button variante="secundario" disabled>Plan actual{p.precio ? ` · ${cicloActual}` : ''}</Button>
                : sube ? <Button onClick={() => setElegido(p)}>Subir a {p.nombre}</Button>
                  : <Button variante="secundario" disabled title="Bajar de plan aún se gestiona con soporte">Bajar de plan</Button>}
            </section>
          );
        })}
      </div>
      <p className="text-[12px] text-fg-3">
        Para bajar de plan, escríbenos a <a href="mailto:contacto.jornada40@gmail.com?subject=Cambio%20de%20plan">contacto.jornada40@gmail.com</a>:
        lo programamos para tu próximo cobro y te indicamos qué funciones dejarás de tener.
      </p>

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

      {elegido && <Checkout plan={elegido} ciclo={ciclo} cambioDeCiclo={elegido.id === suscripcion.plan.id} onCerrar={() => setElegido(null)} />}
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

function Checkout({ plan, ciclo, cambioDeCiclo, onCerrar }: { plan: TPlan; ciclo: Ciclo; cambioDeCiclo: boolean; onCerrar: () => void }) {
  const anual = ciclo === 'anual' && Boolean(plan.precio_anual);
  const [estado, setEstado] = useState<'resumen' | 'conectando'>('resumen');
  const [error, setError] = useState('');

  const pagar = async () => {
    setEstado('conectando');
    setError('');
    try {
      const { data } = await client.post<{ url: string }>('/pagos/crear-checkout/', { plan_id: plan.id, ciclo: anual ? 'anual' : 'mensual' });
      window.location.href = data.url;  // el pago se confirma por webhook al volver
    } catch (err) {
      setError((isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || 'No pudimos conectar con la pasarela de pago.');
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
          {cambioDeCiclo
            ? `Te llevamos a Reveniu para pagar el ${anual ? 'año' : 'mes'}. Cuando se confirme, cancelamos tu suscripción ${anual ? 'mensual' : 'anual'} anterior en Reveniu. El período en curso no se prorratea ni se reembolsa.`
            : 'Te llevamos a Reveniu para pagar. Cuando el pago se confirme, los nuevos límites y funciones quedan activos en tu cuenta.'}
        </p>
      </div>
    </Modal>
  );
}
