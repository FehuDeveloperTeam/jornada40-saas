import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Button } from '../../../src/components/j40/Button';
import { Chip } from '../../../src/components/j40/Chip';
import { mensajeDe, pedir } from './api';
import { Aviso, Cargando } from './comun';
import type { EmpresaExtension, ListaRegistro } from './tipos';
import { plazo, porRegistrar } from './util';

/** Lo que falta registrar en Mi DT para la empresa, con los vencidos primero. */
export function Lista({ empresa, onAbrir }: { empresa: EmpresaExtension; onAbrir: (clave: string) => void }) {
  const consulta = useQuery({
    queryKey: ['registro', empresa.id],
    queryFn: () => pedir<ListaRegistro>(`/extension/v1/registro/?empresa=${empresa.id}`),
    refetchInterval: 60_000,
  });

  if (consulta.isError) {
    return (
      <Aviso tono="peligro" accion={<Button variante="secundario" onClick={() => void consulta.refetch()}>Reintentar</Button>}>
        {mensajeDe(consulta.error, 'No pudimos traer lo que falta registrar.')}
      </Aviso>
    );
  }
  if (!consulta.data) return <Cargando />;

  const { resumen } = consulta.data;
  const items = porRegistrar(consulta.data.items);
  const sinFirmar = consulta.data.anexos_sin_firmar ?? 0;
  return (
    <section aria-label="Por registrar en Mi DT" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-semibold">Por registrar</h2>
        <span className="text-[13px] text-fg-3">{resumen.REGISTRADO} ya registrados</span>
      </div>
      {(resumen.VENCIDO > 0 || resumen.por_vencer > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {resumen.VENCIDO > 0 && <Chip tono="peligro">{resumen.VENCIDO} {resumen.VENCIDO === 1 ? 'vencido' : 'vencidos'}</Chip>}
          {resumen.por_vencer > 0 && <Chip tono="aviso">{resumen.por_vencer} por vencer</Chip>}
        </div>
      )}
      {items.length === 0 ? (
        <Aviso tono="ok" titulo="Todo al día">
          No hay contratos, anexos ni términos pendientes de registrar en Mi DT para esta empresa.
        </Aviso>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((i) => {
            const p = plazo(i);
            return (
              <li key={i.clave}>
                <button type="button" onClick={() => onAbrir(i.clave)}
                  className="w-full text-left flex items-center gap-3 px-3.5 py-3 rounded-j40-card border border-line bg-surface hover:bg-surface-2 cursor-pointer focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft">
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="font-medium text-[15px] break-words">{i.empleado.nombre}</span>
                    <span className="text-[13.5px] text-fg-2">{i.detalle}</span>
                    <Chip tono={p.tono} className="self-start whitespace-normal">{p.texto}</Chip>
                  </span>
                  <ChevronRight className="size-5 text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {sinFirmar > 0 && (
        <Aviso tono="info">
          {sinFirmar === 1
            ? 'Tienes 1 anexo sin firmar. Aparecerá aquí cuando el trabajador lo firme: el plazo para registrarlo en Mi DT corre desde la firma.'
            : `Tienes ${sinFirmar} anexos sin firmar. Aparecerán aquí cuando los trabajadores los firmen: el plazo para registrarlos en Mi DT corre desde la firma.`}
        </Aviso>
      )}
    </section>
  );
}
