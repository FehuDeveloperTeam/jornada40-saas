import { Download, Lock } from 'lucide-react';
import { Button, Chip } from '../../j40';
import type { TonoChip } from '../../j40';
import { descargar } from '../../../api/descargas';
import { rutaClasica } from '../../../hooks/usePanel';
import type { Empleado, SaldoVacaciones, SolicitudFirma, VacacionEmpleado } from '../../../types';
import { fechaCL } from '../../../utils/formato';
import { BotonEnlace, ChipFirma, Seccion } from './comun';
import { firmaDe } from './utiles';

const TIPO: Record<string, string> = {
  VACACION_LEGAL: 'Feriado legal', VACACION_PROGRESIVA: 'Feriado progresivo', PERMISO_SIN_GOCE: 'Permiso sin goce',
};
const ESTADO: Record<string, { texto: string; tono: TonoChip }> = {
  APROBADO: { texto: 'Aprobado', tono: 'ok' }, PENDIENTE: { texto: 'Pendiente', tono: 'aviso' },
  RECHAZADO: { texto: 'Rechazado', tono: 'peligro' },
};

const dias = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} ${n === 1 ? 'día' : 'días'}`;

export function Vacaciones({ empleado, nivel, vacaciones, saldo, firmas, avisar }: {
  empleado: Empleado; nivel: number; vacaciones: VacacionEmpleado[]; saldo: SaldoVacaciones | undefined;
  firmas: SolicitudFirma[]; avisar: (t: string) => void;
}) {
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
          nota={saldo ? `${saldo.anos_servicio} ${saldo.anos_servicio === 1 ? 'año' : 'años'} de servicio` : undefined} />
      </div>

      <Seccion titulo="Registro de vacaciones y permisos"
        accion={<BotonEnlace a={rutaClasica(empleado.id, 'vacaciones')}>Registrar vacaciones</BotonEnlace>}>
        {ordenadas.length === 0 && <p className="px-[18px] py-5 text-[13px] text-fg-3">Sin vacaciones registradas.</p>}
        {ordenadas.map((v) => {
          const estado = ESTADO[v.estado] ?? ESTADO.PENDIENTE;
          return (
            <div key={v.id} className="flex flex-wrap gap-x-4 gap-y-2 items-center px-[18px] py-3 border-b border-line last:border-b-0">
              <div className="flex-1 min-w-[200px] flex flex-col">
                <span className="text-[13px] font-medium">{TIPO[v.tipo] ?? v.tipo}</span>
                <span className="text-[11.5px] text-fg-3 j40-num">
                  {fechaCL(v.fecha_inicio)} al {fechaCL(v.fecha_fin)} · {dias(v.dias_habiles_calculados ?? v.dias_habiles)} hábiles
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
