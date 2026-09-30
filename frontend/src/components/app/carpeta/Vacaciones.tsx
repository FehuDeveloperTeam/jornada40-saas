import { Clock, Download, Lock, TriangleAlert } from 'lucide-react';
import { Button, Chip } from '../../j40';
import type { TonoChip } from '../../j40';
import { descargar } from '../../../api/descargas';
import { rutaAccion } from '../../../hooks/usePanel';
import { usePermisos } from '../../../hooks/usePermisos';
import type { BolsaCompensatoria, Empleado, SaldoVacaciones, SolicitudFirma, VacacionEmpleado } from '../../../types';
import { decimalCL, fechaCL } from '../../../utils/formato';
import { BotonEnlace, ChipFirma, Seccion } from './comun';
import { useBolsaCompensatoria } from './compensatorias';
import { firmaDe } from './utiles';

const TIPO: Record<string, string> = {
  VACACION_LEGAL: 'Feriado legal', VACACION_PROGRESIVA: 'Feriado progresivo', PERMISO_SIN_GOCE: 'Permiso sin goce',
  DIA_COMPENSATORIO: 'Día libre por horas extra',
};

const horas = (n: number) => `${decimalCL(n, Number.isInteger(n) ? 0 : 1)} h`;

/** Días libres ganados con horas extra (Ley 40 horas, Art. 32): cuánto tiene y cuándo vence. */
function DiasLibresHorasExtra({ bolsa, gestionar }: { bolsa: BolsaCompensatoria; gestionar: boolean }) {
  const disponibles = bolsa.horas_disponibles ?? 0;
  const tope = bolsa.tope_horas ?? 0;
  return (
    <Seccion titulo="Días libres por horas extra">
      <div className="px-[18px] py-4 flex flex-col gap-2.5 text-[14px] leading-relaxed">
        <p className="flex gap-2.5 items-start">
          <Clock className="size-5 shrink-0 text-brand mt-px" strokeWidth={2} aria-hidden />
          <span>
            Tiene <b className="font-semibold j40-num">{horas(disponibles)}</b> de descanso
            {disponibles > 0 && bolsa.dias_aproximados ? ` (alcanza para ${bolsa.dias_aproximados} ${bolsa.dias_aproximados === 1 ? 'día' : 'días'} de jornada)` : ''}.
          </span>
        </p>
        {bolsa.proximo_vencimiento && (
          <p className="text-[13.5px] text-fg-2">
            {horas(bolsa.horas_por_vencer ?? 0)} vencen el {fechaCL(bolsa.proximo_vencimiento)}: si no las usa, se le pagan en la liquidación de ese mes.
          </p>
        )}
        <p className="text-[13px] text-fg-3">
          Este año de contrato lleva {horas(bolsa.generadas_anualidad ?? 0)} de un máximo de {horas(tope)} (5 días).
          {gestionar && ' Para darle un día libre, use «Registrar vacaciones» y elija «Día libre por horas extra».'}
        </p>
      </div>
    </Seccion>
  );
}
const ESTADO: Record<string, { texto: string; tono: TonoChip }> = {
  APROBADO: { texto: 'Aprobado', tono: 'ok' }, PENDIENTE: { texto: 'Pendiente', tono: 'aviso' },
  RECHAZADO: { texto: 'Rechazado', tono: 'peligro' },
};

const dias = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} ${n === 1 ? 'día' : 'días'}`;

export function Vacaciones({ empleado, nivel, cargandoPlan, vacaciones, saldo, firmas, avisar }: {
  empleado: Empleado; nivel: number; cargandoPlan?: boolean; vacaciones: VacacionEmpleado[]; saldo: SaldoVacaciones | undefined;
  firmas: SolicitudFirma[]; avisar: (t: string) => void;
}) {
  if (cargandoPlan) {
    return <Seccion titulo="Vacaciones"><p className="px-[18px] py-5 text-[13px] text-fg-3" role="status">Cargando…</p></Seccion>;
  }
  if (nivel < 2) {
    return (
      <Seccion titulo="Vacaciones">
        <div className="px-[18px] py-6 flex flex-col gap-3 items-start">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium"><Lock className="size-4" strokeWidth={2} aria-hidden />Disponible desde el plan Starter</span>
          <p className="text-[13px] text-fg-3 max-w-[520px]">
            Lleva el saldo de feriado legal y progresivo de cada trabajador y emite los comprobantes para firma.
          </p>
          <BotonEnlace a="/app/plan" primario>Ver planes</BotonEnlace>
        </div>
      </Seccion>
    );
  }

  return <VacacionesContenido empleado={empleado} nivel={nivel} vacaciones={vacaciones} saldo={saldo} firmas={firmas} avisar={avisar} />;
}

function VacacionesContenido({ empleado, nivel, vacaciones, saldo, firmas, avisar }: {
  empleado: Empleado; nivel: number; vacaciones: VacacionEmpleado[]; saldo: SaldoVacaciones | undefined;
  firmas: SolicitudFirma[]; avisar: (t: string) => void;
}) {
  const gestionar = usePermisos().puede('VACACIONES', true);
  const bolsa = useBolsaCompensatoria(empleado.id, nivel >= 3).data;
  const verBolsa = bolsa?.permitido && ((bolsa.horas_disponibles ?? 0) > 0 || (bolsa.generadas_anualidad ?? 0) > 0
    || (bolsa.compensacion_vigente && bolsa.compensacion_vigente !== 'PAGO'));
  const ordenadas = [...vacaciones].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
  const pdf = async (v: VacacionEmpleado) => {
    const error = await descargar(`/vacaciones/${v.id}/generar_pdf/`, `Vacaciones_${empleado.rut}_${v.fecha_inicio}.pdf`);
    if (error) avisar(error);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Dato t="Disponibles" v={saldo ? dias(saldo.dias_disponibles) : '—'} destacado />
        <Dato t="Devengados" v={saldo ? dias(saldo.dias_devengados) : '—'} />
        <Dato t="Usados" v={saldo ? dias(saldo.dias_usados) : '—'} />
        <Dato t="Progresivos" v={saldo ? dias(saldo.dias_progresivos) : '—'}
          nota={saldo ? `${saldo.anos_servicio} ${saldo.anos_servicio === 1 ? 'año' : 'años'} de servicio`
            + (saldo.anios_previos_feriado ? ` + ${saldo.anios_previos_feriado} con otros empleadores` : '')
            + (saldo.dias_progresivos_anuales ? ` · hoy ${saldo.dias_progresivos_anuales} por año` : '') : undefined} />
      </div>

      {saldo?.aviso_acumulacion && (
        <p className="flex gap-2 rounded-j40-card bg-warn-soft text-warn px-4 py-3 text-[13px]">
          <TriangleAlert className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />{saldo.aviso_acumulacion}
        </p>
      )}

      {verBolsa && bolsa && <DiasLibresHorasExtra bolsa={bolsa} gestionar={gestionar} />}

      <Seccion titulo="Registro de vacaciones y permisos"
        accion={gestionar && <BotonEnlace a={rutaAccion(empleado.id, 'vacacion')}>Registrar vacaciones</BotonEnlace>}>
        {ordenadas.length === 0 && <p className="px-[18px] py-5 text-[13px] text-fg-3">Sin vacaciones registradas.</p>}
        {ordenadas.map((v) => {
          const estado = ESTADO[v.estado] ?? ESTADO.PENDIENTE;
          return (
            <div key={v.id} className="flex flex-wrap gap-x-4 gap-y-2 items-center px-[18px] py-3 border-b border-line last:border-b-0">
              <div className="flex-1 min-w-[200px] flex flex-col">
                <span className="text-[13px] font-medium">{TIPO[v.tipo] ?? v.tipo}</span>
                <span className="text-[11.5px] text-fg-3 j40-num">
                  {fechaCL(v.fecha_inicio)} al {fechaCL(v.fecha_fin)} · {v.tipo === 'DIA_COMPENSATORIO'
                    ? `${dias(v.dias_habiles)} · ${horas(Number(v.horas_compensatorias ?? 0))} de la bolsa`
                    : `${dias(v.dias_habiles_calculados ?? v.dias_habiles)} hábiles`}
                </span>
              </div>
              <Chip tono={estado.tono}>{estado.texto}</Chip>
              <ChipFirma firma={firmaDe(firmas, 'vacacion', v.id)} corto />
              <Button variante="fantasma" tamano="sm" onClick={() => pdf(v)} aria-label={`Descargar comprobante del ${fechaCL(v.fecha_inicio)}`}
                iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>
            </div>
          );
        })}
      </Seccion>
    </div>
  );
}

function Dato({ t, v, nota, destacado }: { t: string; v: string; nota?: string; destacado?: boolean }) {
  return (
    <div className="bg-surface border border-line rounded-j40-card shadow-card px-4 py-3.5 flex flex-col gap-1">
      <span className="text-[12px] text-fg-3">{t}</span>
      <span className={destacado ? 'text-[24px] font-semibold text-brand-text j40-num' : 'text-[24px] font-semibold j40-num'}>{v}</span>
      {nota && <span className="text-[11.5px] text-fg-3">{nota}</span>}
    </div>
  );
}
