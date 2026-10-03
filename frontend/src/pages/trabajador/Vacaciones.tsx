import { TriangleAlert } from 'lucide-react';
import { Chip } from '../../components/j40';
import { EstadoLista, Seccion, Titulo } from '../../components/trabajador/comun';
import { PeticionesVacaciones } from '../../components/trabajador/Peticiones';
import { usePeticionesPortal, useVacacionesPortal } from '../../hooks/usePortal';
import type { PeticionesPortal, VacacionesPortal } from '../../types';
import { decimalCL, fechaCL } from '../../utils/formato';

// Mismo formato que la carpeta del empleador (components/app/carpeta/Vacaciones.tsx).
const dias = (valor: number | string) => {
  const n = Number(valor) || 0;
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} ${n === 1 ? 'día' : 'días'}`;
};

export default function Vacaciones() {
  const { data = [], isLoading, isError } = useVacacionesPortal();
  const peticiones = usePeticionesPortal();
  return (
    <>
      <Titulo titulo="Vacaciones">Tu saldo de feriado, tus vacaciones y lo que has pedido. Aquí puedes pedir vacaciones o un permiso.</Titulo>
      {(isLoading || isError || !data.length) && (
        <Seccion titulo="Saldo">
          <EstadoLista cargando={isLoading} error={isError} vacia={!data.length} textoVacio="Aún no hay información de vacaciones." />
        </Seccion>
      )}
      {data.map((e) => <Empleo key={e.id} empleo={e} peticiones={peticiones.data?.find((p) => p.id === e.id)} />)}
    </>
  );
}

function Empleo({ empleo, peticiones }: { empleo: VacacionesPortal; peticiones?: PeticionesPortal }) {
  const { saldo } = empleo;
  return (
    <Seccion titulo={empleo.empresa} subtitulo={empleo.cargo || undefined}
      accion={!empleo.activo ? <Chip tono="neutro">Desvinculado</Chip> : undefined}>
      <div className="p-4 sm:p-[18px] flex flex-col gap-4">
        {saldo ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] gap-3">
            <Dato t="Disponibles" v={dias(saldo.dias_disponibles)} destacado />
            <Dato t="Devengados" v={dias(saldo.dias_devengados)} />
            <Dato t="Usados" v={dias(saldo.dias_usados)} />
            <Dato t="Progresivos" v={dias(saldo.dias_progresivos)}
              nota={`${saldo.anos_servicio} ${saldo.anos_servicio === 1 ? 'año' : 'años'} de servicio`
                + (saldo.anios_previos_feriado ? ` + ${saldo.anios_previos_feriado} con otros empleadores` : '')} />
          </div>
        ) : (
          <p className="text-[13px] text-fg-3">El saldo no está disponible por ahora. Consulta a tu empleador.</p>
        )}
        {empleo.horas_descanso && (
          <div className="rounded-j40-card border border-line bg-surface-2 px-4 py-3.5 flex flex-col gap-1.5 text-[14px] leading-relaxed">
            <span className="font-semibold">Días libres por horas extra</span>
            <span>
              Tienes <b className="font-semibold j40-num">{decimalCL(empleo.horas_descanso.horas_disponibles, 1)} horas</b> de descanso
              {empleo.horas_descanso.dias_aproximados > 0 ? ` (alcanzan para ${empleo.horas_descanso.dias_aproximados} ${empleo.horas_descanso.dias_aproximados === 1 ? 'día' : 'días'} libres)` : ''}.
            </span>
            {empleo.horas_descanso.proximo_vencimiento && (
              <span className="text-[13px] text-fg-2">
                {decimalCL(empleo.horas_descanso.horas_por_vencer, 1)} horas vencen el {fechaCL(empleo.horas_descanso.proximo_vencimiento)}: si no las usas, se te pagan en la liquidación de ese mes.
              </span>
            )}
            <span className="text-[12.5px] text-fg-3">Para usar un día libre, pídelo con "Pedir vacaciones" con al menos 48 horas de anticipación.</span>
          </div>
        )}
        {saldo?.aviso_acumulacion && (
          <p className="flex gap-2 rounded-j40-card bg-warn-soft text-warn px-4 py-3 text-[13px]">
            <TriangleAlert className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />{saldo.aviso_acumulacion}
          </p>
        )}
      </div>
      {peticiones && <PeticionesVacaciones empleo={peticiones} />}
      <div className="border-t border-line">
        <h3 className="px-[18px] pt-3 pb-1 text-[12.5px] font-semibold text-fg-2">Vacaciones aprobadas</h3>
        {empleo.registros.length === 0 && <p className="px-[18px] pb-4 text-[13px] text-fg-3">Sin vacaciones registradas.</p>}
        <ul className="flex flex-col">
          {empleo.registros.map((r) => (
            <li key={r.id} className="flex flex-wrap gap-x-4 gap-y-1 items-center px-[18px] py-3 border-b border-line last:border-b-0">
              <span className="flex-1 min-w-[180px] flex flex-col">
                <span className="text-[13px] font-medium">{r.tipo}</span>
                <span className="text-[11.5px] text-fg-3 j40-num">{fechaCL(r.desde)} al {fechaCL(r.hasta)}</span>
              </span>
              <span className="text-[13px] j40-num">{dias(r.dias_habiles)} hábiles</span>
            </li>
          ))}
        </ul>
      </div>
    </Seccion>
  );
}

function Dato({ t, v, nota, destacado }: { t: string; v: string; nota?: string; destacado?: boolean }) {
  return (
    <div className="bg-surface-2 border border-line rounded-j40-card px-4 py-3.5 flex flex-col gap-1 min-w-0">
      <span className="text-[12px] text-fg-3">{t}</span>
      <span className={destacado ? 'text-[22px] font-semibold text-brand-text j40-num' : 'text-[22px] font-semibold j40-num'}>{v}</span>
      {nota && <span className="text-[11.5px] text-fg-3">{nota}</span>}
    </div>
  );
}
