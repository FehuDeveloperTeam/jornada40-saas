import { useState } from 'react';
import { House, CalendarClock } from 'lucide-react';
import { Button } from '../../components/j40';
import { EstadoLista, Seccion, Titulo } from '../../components/trabajador/comun';
import { Fila, PedirConciliacion } from '../../components/trabajador/Peticiones';
import { usePeticionesPortal } from '../../hooks/usePortal';
import type { ConciliacionPedida, PeticionesPortal } from '../../types';
import { fechaCL } from '../../utils/formato';

/** Conciliación familiar (Ley 21.645): teletrabajo y cambio de jornada para quien cuida. */
export default function Conciliacion() {
  const { data = [], isLoading, isError } = usePeticionesPortal();
  return (
    <>
      <Titulo titulo="Conciliación familiar">
        Si cuidas a un niño menor de 14 años, a una persona con discapacidad o en situación de dependencia, la ley
        (Ley 21.645) te da derecho a pedir teletrabajo y, si cuidas a un menor, un cambio de turnos o jornada en las
        vacaciones escolares. Tu empleador debe responderte por escrito y dentro de plazo.
      </Titulo>
      {(isLoading || isError || !data.length) && (
        <Seccion titulo="Tus empleos">
          <EstadoLista cargando={isLoading} error={isError} vacia={!data.length} textoVacio="No tienes empleos vigentes." />
        </Seccion>
      )}
      {data.map((e) => <Empleo key={e.id} empleo={e} />)}
    </>
  );
}

function Empleo({ empleo }: { empleo: PeticionesPortal }) {
  const [pedir, setPedir] = useState<ConciliacionPedida['tipo'] | null>(null);
  return (
    <Seccion titulo={empleo.empresa} subtitulo={empleo.cargo || undefined}>
      <div className="flex flex-wrap gap-2.5 px-[18px] py-4">
        <Button tamano="lg" onClick={() => setPedir('TELETRABAJO')} iconoInicio={<House className="size-5" strokeWidth={2} />}>Pedir teletrabajo</Button>
        <Button tamano="lg" variante="secundario" onClick={() => setPedir('CAMBIO_JORNADA')}
          iconoInicio={<CalendarClock className="size-5" strokeWidth={2} />}>Pedir cambio de jornada en vacaciones escolares</Button>
      </div>
      <div className="border-t border-line">
        {empleo.conciliacion.length === 0 && <p className="px-[18px] py-4 text-[13px] text-fg-3">No has hecho solicitudes.</p>}
        <ul className="flex flex-col">
          {empleo.conciliacion.map((s) => (
            <Fila key={s.id} titulo={s.tipo_texto} estado={s.estado} estadoTexto={s.estado_texto}
              motivo={s.motivo ? `${s.motivo}. ${s.fundamento}` : undefined}
              detalle={`Pedida el ${fechaCL(s.presentada_el)}${s.desde ? ` · del ${fechaCL(s.desde)} al ${fechaCL(s.hasta ?? s.desde)}` : ''}`
                + (s.estado === 'PENDIENTE' ? ` · respuesta a más tardar el ${fechaCL(s.vence_el)}` : '')} />
          ))}
        </ul>
      </div>
      {pedir && <PedirConciliacion empleo={empleo} tipo={pedir} onCerrar={() => setPedir(null)} />}
    </Seccion>
  );
}
