import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote, CircleAlert, Clock, FileSignature, FileWarning, Lock, Signature, TriangleAlert, Users,
} from 'lucide-react';
import client from '../../api/client';
import { lista } from '../../api/lista';
import type { RespuestaLista } from '../../api/lista';
import { Button, Card, CardHeader, Chip } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import { useAuth } from '../../context/AuthContext';
import { rutaClasica, useFirmas, useVacacionesEmpresa } from '../../hooks/usePanel';
import type { Liquidacion } from '../../types';
import { cn } from '../../utils/cn';
import { capitalizar, clp, fechaCL, fechaLarga, fechaLocal, iniciales, nombreMes } from '../../utils/formato';
import { ETAPAS_LEY_40, fechaCorta, indiceEtapaVigente, jornadaMaximaVigente } from '../../utils/ley40';

function saludo(hora: number) {
  if (hora < 12) return 'Buenos días';
  if (hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

interface Tarea { clave: string; Icono: LucideIcon; tono: 'peligro' | 'aviso' | 'marca'; titulo: string; detalle: string; accion: string; a: string }

const TONO_ICONO = { peligro: 'bg-danger-soft text-danger', aviso: 'bg-warn-soft text-warn', marca: 'bg-brand-soft text-brand-text' };

export default function Inicio() {
  const { empresa, trabajadores, nivel, suscripcion } = usePanelContexto();
  const { user } = useAuth();
  const navigate = useNavigate();
  const firmas = useFirmas();
  const vacaciones = useVacacionesEmpresa(empresa.id, nivel >= 2);
  const hoy = new Date();
  const mes = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();
  const maximo = jornadaMaximaVigente();

  const liquidacionesMes = useQuery({
    queryKey: ['liquidaciones', 'empresa', empresa.id, mes, anio],
    queryFn: async () => lista((await client.get<RespuestaLista<Liquidacion>>('/liquidaciones/')).data),
    select: (todas) => {
      const ids = new Set(trabajadores.map((t) => t.id));
      return todas.filter((l) => ids.has(l.empleado) && l.mes === mes && l.anio === anio);
    },
  });

  const activos = trabajadores.filter((t) => t.activo);
  const firmasEmpresa = (firmas.data ?? []).filter((f) => f.empresa === empresa.id);
  const pendientes = firmasEmpresa.filter((f) => f.estado === 'PENDIENTE');
  const rechazadas = firmasEmpresa.filter((f) => f.estado === 'RECHAZADO');
  const sobreMaximo = activos.filter((t) => t.contrato_activo?.avisos_jornada?.some((a) => a.codigo === 'EXCEDE_MAXIMO'));
  const masa = activos.reduce((s, t) => s + (t.contrato_activo?.sueldo_base ?? t.sueldo_base ?? 0), 0);

  const kpis = [
    { etiqueta: 'Trabajadores vigentes', Icono: Users, valor: String(activos.length),
      sub: suscripcion ? `de ${suscripcion.plan.limite_trabajadores} cupos del plan` : '' },
    { etiqueta: `Contratos sobre ${maximo} h`, Icono: TriangleAlert, valor: String(sobreMaximo.length),
      sub: sobreMaximo.length ? 'Requieren anexo de jornada' : 'Todos dentro del máximo', alerta: sobreMaximo.length > 0 },
    { etiqueta: 'Firmas pendientes', Icono: Signature, valor: String(pendientes.length),
      sub: rechazadas.length ? `${rechazadas.length} rechazada${rechazadas.length === 1 ? '' : 's'}` : 'Ninguna rechazada' },
    { etiqueta: 'Masa salarial base', Icono: Banknote, valor: clp(masa),
      sub: activos.length ? `Promedio ${clp(masa / activos.length)} por trabajador` : '' },
  ];

  // Hora fija al montar: el render debe ser puro (vencimientos de firma).
  const [ahora] = useState(() => Date.now());
  const tareas: Tarea[] = (() => {
    const t: Tarea[] = [];
    const nombre = (id: number) => {
      const e = trabajadores.find((x) => x.id === id);
      return e ? capitalizar(`${e.nombres.split(' ')[0]} ${e.apellido_paterno}`) : 'Trabajador';
    };
    for (const e of activos) {
      if (!e.contrato_activo) {
        t.push({ clave: `sc${e.id}`, Icono: FileWarning, tono: 'aviso', titulo: `${nombre(e.id)} no tiene contrato`,
          detalle: 'Sin contrato no se pueden emitir liquidaciones.', accion: 'Crear contrato', a: rutaClasica(e.id, 'contratos') });
        continue;
      }
      const alta = e.contrato_activo.avisos_jornada?.find((a) => a.gravedad === 'alta');
      if (alta) {
        t.push({ clave: `j${e.id}`, Icono: CircleAlert, tono: 'peligro', titulo: `${alta.titulo} · ${nombre(e.id)}`,
          detalle: alta.recomendacion, accion: 'Revisar', a: `/app/trabajadores/${e.id}?tab=contrato` });
      }
    }
    for (const f of rechazadas) {
      t.push({ clave: `r${f.id}`, Icono: FileSignature, tono: 'peligro', titulo: `Documento rechazado · ${nombre(f.empleado)}`,
        detalle: f.motivo_rechazo || 'El trabajador rechazó la firma.', accion: 'Ver', a: `/app/trabajadores/${f.empleado}?tab=documentos` });
    }
    const enTresDias = ahora + 3 * 86_400_000;
    for (const f of pendientes.filter((p) => new Date(p.expira_en).getTime() < enTresDias)) {
      t.push({ clave: `p${f.id}`, Icono: Clock, tono: 'aviso', titulo: `Firma por vencer · ${nombre(f.empleado)}`,
        detalle: `El enlace vence el ${fechaCL(f.expira_en)}.`, accion: 'Ver', a: `/app/trabajadores/${f.empleado}?tab=documentos` });
    }
    return t;
  })();

  // Distribución de contratos por jornada (Art. 22 no pacta horas: queda fuera).
  const conHoras = activos.filter((t) => t.contrato_activo && t.contrato_activo.tipo_jornada !== 'ART_22');
  const horasDe = (t: typeof conHoras[number]) => Number(t.contrato_activo!.horas_semanales) || 0;
  const tramos = [
    { etiqueta: `Más de ${maximo} h`, n: conHoras.filter((t) => horasDe(t) > maximo).length, clase: 'bg-danger' },
    { etiqueta: `${maximo - 1} a ${maximo} h`, n: conHoras.filter((t) => horasDe(t) > maximo - 2 && horasDe(t) <= maximo).length, clase: 'bg-brand' },
    { etiqueta: `${maximo - 2} h o menos`, n: conHoras.filter((t) => horasDe(t) <= maximo - 2).length, clase: 'bg-ok' },
  ];
  const vigente = indiceEtapaVigente(hoy);
  const hitos = ETAPAS_LEY_40.slice(Math.max(1, vigente - 1), Math.max(1, vigente - 1) + 3);

  const emitidas = liquidacionesMes.data?.length ?? 0;
  const idsFirmadas = new Set(firmasEmpresa.filter((f) => f.tipo_documento === 'LIQUIDACION' && f.estado === 'FIRMADO').map((f) => f.liquidacion));
  const firmadas = (liquidacionesMes.data ?? []).filter((l) => idsFirmadas.has(l.id)).length;

  const ausencias = (vacaciones.data ?? [])
    .filter((v) => { const fin = fechaLocal(v.fecha_fin); return fin && fin >= new Date(anio, mes - 1, hoy.getDate()) && v.estado !== 'RECHAZADO'; })
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-[22px] max-w-[1440px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">
            {saludo(hoy.getHours())}{user?.first_name ? `, ${capitalizar(user.first_name.split(' ')[0])}` : ''}
          </h1>
          <p className="text-[13px] text-fg-3 mt-0.5">{fechaLarga(hoy)} · {capitalizar(empresa.nombre_legal)}</p>
        </div>
        <Button onClick={() => navigate('/app/remuneraciones')} iconoInicio={<Banknote className="size-[19px]" strokeWidth={2} />}>
          Ir a remuneraciones
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-4">
        {kpis.map(({ etiqueta, Icono, valor, sub, alerta }) => (
          <Card key={etiqueta} className="px-[18px] py-4 flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-[12.5px] text-fg-3">
              {etiqueta}<Icono className={cn('size-[19px]', alerta ? 'text-danger' : 'text-fg-3')} strokeWidth={2} aria-hidden />
            </span>
            <span className={cn('text-[26px] font-semibold tracking-[-0.02em] j40-num', alerta && 'text-danger')}>{valor}</span>
            <span className="text-[12px] text-fg-3">{sub}</span>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-5 items-start">
        <Card>
          <CardHeader titulo="Requiere atención" acciones={<span className="text-[12px] text-fg-3">{tareas.length} {tareas.length === 1 ? 'tarea' : 'tareas'}</span>} />
          {tareas.length === 0 && <p className="px-[18px] py-6 text-[13px] text-fg-3">Todo en orden: no hay pendientes.</p>}
          {tareas.slice(0, 6).map(({ clave, Icono, tono, titulo, detalle, accion, a }) => (
            <div key={clave} className="flex gap-3 items-center px-[18px] py-3 border-b border-line last:border-b-0">
              <span className={cn('grid place-items-center size-8 shrink-0 rounded-[8px]', TONO_ICONO[tono])}><Icono className="size-[18px]" strokeWidth={2} aria-hidden /></span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-[13.5px] font-medium">{titulo}</span>
                <span className="text-[12px] text-fg-3 line-clamp-2">{detalle}</span>
              </span>
              <Link to={a} className="shrink-0 h-8 px-3 inline-flex items-center rounded-[8px] border border-line-strong bg-surface text-fg text-[12.5px] font-medium no-underline hover:no-underline hover:bg-surface-2">{accion}</Link>
            </div>
          ))}
        </Card>

        <Card>
          <CardHeader titulo="Transición Ley 40 horas" acciones={<span className="text-[12px] text-fg-3">Ley 21.561</span>} />
          <div className="p-[18px] flex flex-col gap-[18px]">
            <div className="grid grid-cols-3 gap-2">
              {hitos.map((h) => {
                const esVigente = ETAPAS_LEY_40.indexOf(h) === vigente;
                const pasada = ETAPAS_LEY_40.indexOf(h) < vigente;
                return (
                  <div key={h.horas} aria-current={esVigente ? 'step' : undefined}
                    className={cn('flex flex-col gap-px px-3 py-2.5 rounded-[9px] border', esVigente ? 'border-brand bg-brand-soft' : 'border-line bg-surface')}>
                    <span className={cn('text-[18px] font-semibold', esVigente ? 'text-brand-text' : pasada ? 'text-fg-3' : 'text-fg')}>{h.horas} h</span>
                    <span className="text-[11.5px] text-fg-2">{esVigente ? 'Vigente' : pasada ? 'Cumplido' : 'Próximo'}</span>
                    <span className="text-[11px] text-fg-3 j40-num">{h.desde ? fechaCorta(h.desde) : ''}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-[12px] text-fg-3">Contratos por jornada semanal</span>
              {tramos.map((t) => (
                <div key={t.etiqueta} className="grid grid-cols-[110px_1fr_28px] items-center gap-3 text-[13px]">
                  <span className="text-fg-2">{t.etiqueta}</span>
                  <div className="h-2 rounded-full bg-sunken overflow-hidden">
                    {/* Ancho calculado: no hay clase de Tailwind para un porcentaje variable. */}
                    <div className={cn('h-full rounded-full', t.clase)} style={{ width: `${conHoras.length ? (t.n / conHoras.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-right font-semibold j40-num">{t.n}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variante={sobreMaximo.length ? 'primario' : 'secundario'} className="flex-[1_1_200px]"
                onClick={() => navigate('/app/trabajadores?filtro=alertas')}>
                {sobreMaximo.length ? `Revisar ${sobreMaximo.length} contrato${sobreMaximo.length === 1 ? '' : 's'}` : 'Ver trabajadores'}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader titulo={`Remuneraciones · ${nombreMes(mes)} ${anio}`} />
          <div className="p-[18px] flex flex-col gap-4">
            {[{ t: 'Liquidaciones emitidas', v: emitidas }, { t: 'Firmadas por el trabajador', v: firmadas }].map(({ t, v }) => (
              <div key={t} className="flex flex-col gap-1.5">
                <span className="flex justify-between text-[13px]"><span className="text-fg-2">{t}</span><span className="font-semibold j40-num">{v} de {activos.length}</span></span>
                <div className="h-2 rounded-full bg-sunken overflow-hidden">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${activos.length ? (v / activos.length) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            <Button variante="secundario" onClick={() => navigate('/app/remuneraciones')}>Ir al proceso</Button>
          </div>
        </Card>

        <Card>
          <CardHeader titulo="Ausencias" />
          {nivel < 2 ? (
            <p className="flex items-center gap-2 px-[18px] py-6 text-[13px] text-fg-3"><Lock className="size-4" strokeWidth={2} aria-hidden />Vacaciones y permisos están disponibles desde el plan Starter.</p>
          ) : ausencias.length === 0 ? (
            <p className="px-[18px] py-6 text-[13px] text-fg-3">No hay vacaciones ni permisos en curso o por venir.</p>
          ) : ausencias.map((v) => {
            const e = trabajadores.find((x) => x.id === v.empleado);
            const inicio = fechaLocal(v.fecha_inicio)!;
            const enCurso = inicio <= hoy;
            return (
              <Link key={v.id} to={`/app/trabajadores/${v.empleado}?tab=vacaciones`}
                className="flex gap-3 items-center px-[18px] py-3 border-b border-line last:border-b-0 text-fg no-underline hover:no-underline hover:bg-surface-2">
                <span className="grid place-items-center size-[34px] shrink-0 rounded-[9px] bg-sunken text-fg-2 text-[12px] font-semibold">{iniciales(e?.nombres, e?.apellido_paterno)}</span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[13.5px] font-medium">{capitalizar(e ? `${e.nombres.split(' ')[0]} ${e.apellido_paterno}` : 'Trabajador')}</span>
                  <span className="text-[12px] text-fg-3">{fechaCL(v.fecha_inicio)} al {fechaCL(v.fecha_fin)} · {v.dias_habiles} días hábiles</span>
                </span>
                {v.estado === 'PENDIENTE' ? <Chip tono="aviso">Por aprobar</Chip> : enCurso ? <Chip tono="marca">En curso</Chip> : <Chip>Próxima</Chip>}
              </Link>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
