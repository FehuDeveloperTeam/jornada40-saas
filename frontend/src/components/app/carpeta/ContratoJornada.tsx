import { Download } from 'lucide-react';
import { Button } from '../../j40';
import { descargar } from '../../../api/descargas';
import { rutaClasica } from '../../../hooks/usePanel';
import type { Empleado, SolicitudFirma } from '../../../types';
import { capitalizar, clp, fechaCL } from '../../../utils/formato';
import { ListaAvisos } from '../Avisos';
import { TIPO_CONTRATO, TIPO_JORNADA } from '../trabajador';
import { BarraJornada, BotonEnlace, ChipFirma, Seccion } from './comun';
import { firmaDe } from './utiles';

const DIAS: [string, string][] = [
  ['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'], ['jueves', 'Jueves'],
  ['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo'],
];

/** Horas efectivas de un día: salida − entrada − colación (minutos). */
function horasDelDia(entrada: string, salida: string, colacion: number): number {
  const min = (h: string) => { const [a, b] = h.split(':').map(Number); return (a || 0) * 60 + (b || 0); };
  let total = min(salida) - min(entrada);
  if (total < 0) total += 24 * 60;  // turno que cruza medianoche
  return Math.max(0, (total - (colacion || 0)) / 60);
}

const horasTexto = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1).replace('.', ',')} h`;

export function ContratoJornada({ empleado, firmas, maximo, avisar }: {
  empleado: Empleado; firmas: SolicitudFirma[]; maximo: number; avisar: (t: string) => void;
}) {
  const contrato = empleado.contrato_activo;
  if (!contrato) {
    return (
      <Seccion titulo="Contrato">
        <div className="px-[18px] py-5 flex flex-col gap-3 items-start">
          <p className="text-[13px] text-fg-3">Este trabajador todavía no tiene un contrato registrado.</p>
          <BotonEnlace a={rutaClasica(empleado.id, 'contratos')} primario>Crear contrato</BotonEnlace>
        </div>
      </Seccion>
    );
  }

  const horas = Number(contrato.horas_semanales);
  const esOrdinaria = contrato.tipo_jornada === 'ORDINARIA';
  const horario = contrato.distribucion_horario ?? {};
  const dias = DIAS.map(([clave, nombre]) => ({ clave, nombre, d: horario[clave] }));
  const conHorario = esOrdinaria && dias.some((x) => x.d?.activo);
  const totalHorario = dias.reduce((s, x) => s + (x.d?.activo ? horasDelDia(x.d.entrada, x.d.salida, x.d.colacion) : 0), 0);

  const pdf = async () => {
    const error = await descargar(`/contratos/${contrato.id}/descargar_contrato/`, `Contrato_${empleado.rut}.pdf`);
    if (error) avisar(error);
  };

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5 items-start">
      <Seccion titulo="Condiciones del contrato" accion={<ChipFirma firma={firmaDe(firmas, 'contrato', contrato.id, 'CONTRATO')} />}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-[18px]">
          <Dato t="Tipo" v={TIPO_CONTRATO[contrato.tipo_contrato] ?? contrato.tipo_contrato} />
          <Dato t="Cargo" v={capitalizar(contrato.cargo) || '—'} />
          <Dato t="Inicio" v={fechaCL(contrato.fecha_inicio)} />
          <Dato t="Término" v={contrato.fecha_fin ? fechaCL(contrato.fecha_fin) : 'Sin fecha de término'} />
          <Dato t="Sueldo base" v={clp(contrato.sueldo_base)} />
          <Dato t="Gratificación" v={contrato.gratificacion_legal === 'ANUAL' ? 'Anual (art. 47)' : 'Mensual (art. 50)'} />
          <Dato t="Día de pago" v={`Día ${contrato.dia_pago} de cada mes`} />
          <Dato t="Anticipo" v={contrato.tiene_quincena ? `${clp(contrato.monto_quincena)} el día ${contrato.dia_quincena}` : 'Sin anticipo'} />
        </dl>
        <div className="flex flex-wrap gap-2 px-[18px] pb-4 mt-auto">
          <Button variante="secundario" className="h-9" onClick={pdf} iconoInicio={<Download className="size-4" strokeWidth={2} />}>
            Descargar contrato
          </Button>
          <BotonEnlace a={rutaClasica(empleado.id, 'contratos')}>Editar o crear anexo</BotonEnlace>
        </div>
      </Seccion>

      <Seccion titulo="Jornada">
        <div className="p-[18px] flex flex-col gap-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={horas > maximo && contrato.tipo_jornada !== 'ART_22'
              ? 'text-[30px] font-semibold tracking-[-0.02em] text-danger'
              : 'text-[30px] font-semibold tracking-[-0.02em] text-brand-text'}>
              {contrato.tipo_jornada === 'ART_22' ? 'Art. 22' : horasTexto(horas)}
            </span>
            <span className="text-[13px] text-fg-3">
              {TIPO_JORNADA[contrato.tipo_jornada] ?? contrato.tipo_jornada} · máximo legal vigente {maximo} h
            </span>
          </div>
          {contrato.tipo_jornada !== 'ART_22' && <BarraJornada horas={horas} maximo={maximo} />}
          <ListaAvisos avisos={contrato.avisos_jornada} />
          {contrato.jornada_personalizada && (
            <p className="text-[13px] text-fg-2 whitespace-pre-line">{contrato.jornada_personalizada}</p>
          )}
        </div>
      </Seccion>

      {conHorario && (
        <Seccion titulo="Distribución semanal" className="[grid-column:1/-1]"
          accion={<span className="text-[12.5px] text-fg-3 j40-num">Total {horasTexto(totalHorario)}</span>}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-2.5 p-[18px]">
            {dias.map(({ clave, nombre, d }) => (
              <div key={clave} className={d?.activo
                ? 'rounded-[10px] border border-line p-3 flex flex-col gap-1'
                : 'rounded-[10px] border border-dashed border-line p-3 flex flex-col gap-1 text-fg-3'}>
                <span className="text-[12px] font-medium">{nombre}</span>
                {d?.activo ? (
                  <>
                    <span className="text-[14px] font-semibold j40-num">{d.entrada} – {d.salida}</span>
                    <span className="text-[11.5px] text-fg-3 j40-num">
                      {horasTexto(horasDelDia(d.entrada, d.salida, d.colacion))} · colación {d.colacion} min
                    </span>
                  </>
                ) : <span className="text-[13px]">Descanso</span>}
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex flex-col gap-[5px] min-w-0">
      <dt className="text-[12px] text-fg-3">{t}</dt>
      <dd className="text-[14px] font-medium break-words">{v}</dd>
    </div>
  );
}
