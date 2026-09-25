import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote, CircleAlert, Clock, FileSignature, FileWarning, Landmark, Lock, Signature, TriangleAlert, Users,
} from 'lucide-react';
import client from '../../api/client';
import { lista } from '../../api/lista';
import type { RespuestaLista } from '../../api/lista';
import { Button, Card, CardHeader, Chip } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import { useAuth } from '../../context/AuthContext';
import { rutaAccion, useFirmas, useIndicadores, useRegistroDT, useSuscripcion, useVacacionesEmpresa } from '../../hooks/usePanel';
import type { Empleado, Liquidacion, SolicitudFirma } from '../../types';
import { cn } from '../../utils/cn';
import { capitalizar, clp, fechaCL, fechaLarga, fechaLocal, hoyISO, iniciales, nombreMes } from '../../utils/formato';
// Solo el calendario de la ley, para mostrarlo; el máximo vigente lo informa el backend.
import { ETAPAS_LEY_40, fechaCorta, indiceEtapaVigente } from '../../utils/ley40';

function saludo(hora: number) {
  if (hora < 12) return 'Buenos días';
  if (hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

interface Tarea { clave: string; Icono: LucideIcon; tono: 'peligro' | 'aviso' | 'marca' | 'neutro'; titulo: string; detalle: string; accion: string; a: string }

/** Documento al que apunta una solicitud de firma (un documento puede tener varias solicitudes). */
function claveDocumento(f: SolicitudFirma): string {
  const id = f.contrato ?? f.documento_legal ?? f.anexo_contrato ?? f.liquidacion ?? f.vacacion ?? f.finiquito ?? f.id;
  return `${f.tipo_documento}-${id}`;
}

/** Última solicitud de cada documento: un rechazo ya reenviado no es un pendiente. */
function ultimasPorDocumento(firmas: SolicitudFirma[]): SolicitudFirma[] {
  const ultimas = new Map<string, SolicitudFirma>();
  for (const f of firmas) {
    const clave = claveDocumento(f);
    const previa = ultimas.get(clave);
    if (!previa || f.enviado_en.localeCompare(previa.enviado_en) > 0) ultimas.set(clave, f);
  }
  return [...ultimas.values()];
}

const TONO_ICONO = { peligro: 'bg-danger-soft text-danger', aviso: 'bg-warn-soft text-warn', marca: 'bg-brand-soft text-brand-text', neutro: 'bg-sunken text-fg-2' };

export default function Inicio() {
  const { empresa, trabajadores, nivel, suscripcion } = usePanelContexto();
  const { cargando: cargandoPlan } = useSuscripcion();
  const indicadores = useIndicadores();
  const { user } = useAuth();
  const navigate = useNavigate();
  const firmas = useFirmas();
  const vacaciones = useVacacionesEmpresa(empresa.id, nivel >= 2);
  // Plazos de registro en Mi DT y consentimientos: si falla, Inicio se ve igual sin esos avisos.
  const registroDT = useRegistroDT(empresa.id);
  const hoy = new Date();
  const mes = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();
  // Máximo legal vigente: lo informa el backend (core/jornada.py).
  const maximo = indicadores.data?.jornada_maxima_vigente
    ?? trabajadores.find((t) => t.contrato_activo?.jornada_maxima_vigente)?.contrato_activo?.jornada_maxima_vigente;

  const liquidacionesMes = useQuery({
    queryKey: ['liquidaciones', 'empresa', empresa.id, mes, anio],
    queryFn: async () => lista((await client.get<RespuestaLista<Liquidacion>>(`/liquidaciones/?empresa=${empresa.id}&mes=${mes}&anio=${anio}`)).data),
    select: (todas) => {
      const ids = new Set(trabajadores.map((t) => t.id));
      return todas.filter((l) => ids.has(l.empleado) && l.mes === mes && l.anio === anio);
    },
  });

  const activos = trabajadores.filter((t) => t.activo);
  const firmasEmpresa = (firmas.data ?? []).filter((f) => f.empresa === empresa.id);
  const ultimasFirmas = ultimasPorDocumento(firmasEmpresa);
  const pendientes = ultimasFirmas.filter((f) => f.estado === 'PENDIENTE');
  const rechazadas = ultimasFirmas.filter((f) => f.estado === 'RECHAZADO');
  const sobreMaximo = activos.filter((t) => t.contrato_activo?.avisos_jornada?.some((a) => a.codigo === 'EXCEDE_MAXIMO'));
  const masa = activos.reduce((s, t) => s + (t.contrato_activo?.sueldo_base ?? t.sueldo_base ?? 0), 0);

  const kpis = [
    { etiqueta: 'Trabajadores vigentes', Icono: Users, valor: String(activos.length),
      sub: suscripcion ? `de ${suscripcion.plan.limite_trabajadores} cupos del plan` : '' },
    { etiqueta: maximo ? `Contratos sobre ${maximo} h` : 'Contratos sobre el máximo', Icono: TriangleAlert, valor: String(sobreMaximo.length),
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
          detalle: 'Sin contrato no se pueden emitir liquidaciones.', accion: 'Crear contrato', a: rutaAccion(e.id, 'contrato') });
        continue;
      }
      const alta = e.contrato_activo.avisos_jornada?.find((a) => a.gravedad === 'alta');
      if (alta) {
        t.push({ clave: `j${e.id}`, Icono: CircleAlert, tono: 'peligro', titulo: `${alta.titulo} · ${nombre(e.id)}`,
          detalle: alta.recomendacion, accion: 'Revisar', a: `/app/trabajadores/${e.id}?tab=contrato` });
      }
    }
    const dt = registroDT.data;
    if (dt?.resumen.VENCIDO) {
      const n = dt.resumen.VENCIDO;
      t.push({ clave: 'dt-vencidos', Icono: Landmark, tono: 'peligro',
        titulo: `${n} ${n === 1 ? 'registro en la DT vencido' : 'registros en la DT vencidos'}`,
        detalle: 'Contratos, anexos o términos que debían registrarse en Mi DT y siguen pendientes.',
        accion: 'Revisar', a: '/app/dt' });
    }
    for (const f of rechazadas) {
      t.push({ clave: `r${f.id}`, Icono: FileSignature, tono: 'peligro', titulo: `Documento rechazado · ${nombre(f.empleado)}`,
        detalle: f.motivo_rechazo || 'El trabajador rechazó la firma.', accion: 'Ver', a: `/app/trabajadores/${f.empleado}?tab=documentos` });
    }
    // Plazo fijo por vencer: si sigue trabajando después del plazo, el contrato
    // pasa a ser indefinido (Art. 159 N°4). Se avisa con 30 días.
    const en30 = ahora + 30 * 86_400_000;
    for (const e of activos) {
      const c = e.contrato_activo;
      const fin = c?.tipo_contrato === 'PLAZO_FIJO' && c.fecha_fin ? fechaLocal(c.fecha_fin) : null;
      if (fin && fin.getTime() >= ahora - 86_400_000 && fin.getTime() <= en30) {
        t.push({ clave: `pf${e.id}`, Icono: Clock, tono: 'aviso', titulo: `Contrato a plazo vence el ${fechaCL(c!.fecha_fin)} · ${nombre(e.id)}`,
          detalle: 'Renueva, crea un anexo o prepara el término: si sigue trabajando después, pasa a ser indefinido (Art. 159 N°4).',
          accion: 'Revisar', a: `/app/trabajadores/${e.id}?tab=contrato` });
      }
    }
    const enTresDias = ahora + 3 * 86_400_000;
    for (const f of pendientes.filter((p) => new Date(p.expira_en).getTime() < enTresDias)) {
      t.push({ clave: `p${f.id}`, Icono: Clock, tono: 'aviso', titulo: `Firma por vencer · ${nombre(f.empleado)}`,
        detalle: `El enlace vence el ${fechaCL(f.expira_en)}.`, accion: 'Ver', a: `/app/trabajadores/${f.empleado}?tab=documentos` });
    }
    // Liquidaciones del mes emitidas que nadie ha enviado a firma (o cuya firma no se completó).
    const conFirmaActiva = new Set(firmasEmpresa
      .filter((f) => f.tipo_documento === 'LIQUIDACION' && ['PENDIENTE', 'PROCESANDO', 'FIRMADO'].includes(f.estado))
      .map((f) => f.liquidacion));
    const sinEnviar = (liquidacionesMes.data ?? []).filter((l) => !conFirmaActiva.has(l.id)).length;
    if (sinEnviar) {
      t.push({ clave: 'liq-sin-firma', Icono: FileSignature, tono: 'aviso',
        titulo: `${sinEnviar} ${sinEnviar === 1 ? 'liquidación' : 'liquidaciones'} del mes sin enviar a firma`,
        detalle: 'Envíalas de una vez desde Remuneraciones: el trabajador recibe un correo para firmar.',
        accion: 'Enviar a firma', a: '/app/remuneraciones' });
    }
    if (dt?.resumen.por_vencer) {
      const n = dt.resumen.por_vencer;
      t.push({ clave: 'dt-por-vencer', Icono: Landmark, tono: 'aviso',
        titulo: `${n} ${n === 1 ? 'registro en la DT vence' : 'registros en la DT vencen'} en 3 días hábiles o menos`,
        detalle: 'Regístralos en Mi DT y márcalos como registrados en Jornada40.',
        accion: 'Revisar', a: '/app/dt' });
    }
    const sinAutorizar = dt ? dt.consentimiento.total - dt.consentimiento.con : 0;
    if (sinAutorizar > 0) {
      t.push({ clave: 'dt-consentimiento', Icono: FileSignature, tono: 'neutro',
        titulo: `${sinAutorizar} ${sinAutorizar === 1 ? 'trabajador sin autorización' : 'trabajadores sin autorización'} de documentos electrónicos`,
        detalle: 'La DT exige su autorización expresa para firmar y enviar documentos en forma electrónica. Envíales el anexo.',
        accion: 'Ver', a: '/app/dt' });
    }
    return t;
  })();

  // Distribución de contratos por jornada (Art. 22 no pacta horas: queda fuera).
  const conHoras = activos.filter((t) => t.contrato_activo && t.contrato_activo.tipo_jornada !== 'ART_22');
  const horasDe = (t: typeof conHoras[number]) => Number(t.contrato_activo!.horas_semanales) || 0;
  const tramos = maximo === undefined ? [] : [
    { etiqueta: `Más de ${maximo} h`, n: conHoras.filter((t) => horasDe(t) > maximo).length, clase: 'bg-danger' },
    { etiqueta: `${maximo - 1} a ${maximo} h`, n: conHoras.filter((t) => horasDe(t) > maximo - 2 && horasDe(t) <= maximo).length, clase: 'bg-brand' },
    { etiqueta: `${maximo - 2} h o menos`, n: conHoras.filter((t) => horasDe(t) <= maximo - 2).length, clase: 'bg-ok' },
  ];
  // Etapa marcada como vigente: la que coincide con el máximo del backend.
  const porMaximo = ETAPAS_LEY_40.findIndex((e) => e.horas === maximo);
  const vigente = porMaximo >= 0 ? porMaximo : indiceEtapaVigente(hoy);
  const hitos = ETAPAS_LEY_40.slice(Math.max(1, vigente - 1), Math.max(1, vigente - 1) + 3);

  // Un mismo universo para "X de N": quienes deben tener liquidación este mes,
  // los vigentes y los desvinculados durante el mes (ocupan cupo hasta fin de mes).
  const mesISO = hoyISO().slice(0, 7);
  const delMes = trabajadores.filter((t) => t.activo || (t.fecha_desvinculacion ?? '').slice(0, 7) === mesISO);
  const idsDelMes = new Set(delMes.map((t) => t.id));
  const liquidacionesUniverso = (liquidacionesMes.data ?? []).filter((l) => idsDelMes.has(l.empleado));
  const emitidas = new Set(liquidacionesUniverso.map((l) => l.empleado)).size;
  const idsFirmadas = new Set(firmasEmpresa.filter((f) => f.tipo_documento === 'LIQUIDACION' && f.estado === 'FIRMADO').map((f) => f.liquidacion));
  const firmadas = new Set(liquidacionesUniverso.filter((l) => idsFirmadas.has(l.id)).map((l) => l.empleado)).size;
  const totalMes = delMes.length;

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
                <span className="flex justify-between text-[13px]"><span className="text-fg-2">{t}</span><span className="font-semibold j40-num">{v} de {totalMes}</span></span>
                <div className="h-2 rounded-full bg-sunken overflow-hidden">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${totalMes ? Math.min(100, (v / totalMes) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
            <Button variante="secundario" onClick={() => navigate('/app/remuneraciones')}>Ir al proceso</Button>
          </div>
        </Card>

        <Card>
          <CardHeader titulo="Ausencias" />
          {cargandoPlan ? (
            <p className="px-[18px] py-6 text-[13px] text-fg-3" role="status">Cargando…</p>
          ) : nivel < 2 ? (
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

        <ComposicionEquipo activos={activos} />
      </div>
    </div>
  );
}

/** Indicadores del equipo vigente (los que mostraba el panel anterior). */
function ComposicionEquipo({ activos }: { activos: Empleado[] }) {
  if (!activos.length) return null;
  const total = activos.length;
  const cuenta = (f: (e: Empleado) => boolean) => activos.filter(f).length;
  const pct = (n: number) => `${Math.round((n / total) * 100)} %`;
  const extranjeros = cuenta((e) => Boolean(e.nacionalidad) && !/CHILEN/i.test(e.nacionalidad));
  const grupos: [string, [string, number][]][] = [
    ['Contrato', [['Indefinido', cuenta((e) => e.contrato_activo?.tipo_contrato === 'INDEFINIDO')], ['Plazo fijo', cuenta((e) => e.contrato_activo?.tipo_contrato === 'PLAZO_FIJO')],
      ['Obra o faena', cuenta((e) => e.contrato_activo?.tipo_contrato === 'OBRA_FAENA')], ['Sin contrato', cuenta((e) => !e.contrato_activo)]]],
    ['Modalidad', [['Presencial', cuenta((e) => e.modalidad === 'PRESENCIAL')], ['Remoto', cuenta((e) => e.modalidad === 'REMOTO')], ['Híbrido', cuenta((e) => e.modalidad === 'HIBRIDO')]]],
    ['Salud', [['Fonasa', cuenta((e) => e.sistema_salud?.toUpperCase() === 'FONASA')], ['Isapre', cuenta((e) => e.sistema_salud?.toUpperCase() === 'ISAPRE')],
      ['Sin dato', cuenta((e) => !['FONASA', 'ISAPRE'].includes(e.sistema_salud?.toUpperCase() ?? ''))]]],
    ['Sexo', [['Femenino', cuenta((e) => e.sexo === 'F')], ['Masculino', cuenta((e) => e.sexo === 'M')], ['Otro o sin dato', cuenta((e) => e.sexo !== 'F' && e.sexo !== 'M')]]],
  ];
  return (
    <Card className="[grid-column:1/-1]">
      <CardHeader titulo="Composición del equipo" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-5 p-[18px]">
        {grupos.map(([titulo, filas]) => (
          <div key={titulo} className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-fg-3 uppercase tracking-[0.04em]">{titulo}</span>
            {filas.filter(([, n]) => n > 0).map(([t, n]) => (
              <span key={t} className="flex justify-between text-[13px] j40-num"><span className="text-fg-2">{t}</span><span>{n} · {pct(n)}</span></span>
            ))}
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-fg-3 uppercase tracking-[0.04em]">Nacionalidad</span>
          <span className="flex justify-between text-[13px] j40-num"><span className="text-fg-2">Extranjeros</span><span>{extranjeros} · {pct(extranjeros)}</span></span>
          {/* Art. 19: al menos el 85 % de los trabajadores debe ser chileno (empresas con más de 25). */}
          {total > 25 && extranjeros / total > 0.15 && (
            <span className="text-[12px] text-warn">Supera el 15 % de extranjeros que permite el Art. 19 (con más de 25 trabajadores). Revisa las excepciones que aplican.</span>
          )}
        </div>
      </div>
    </Card>
  );
}
