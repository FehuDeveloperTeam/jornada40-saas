import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Download, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/j40';
import { usePortal } from '../../components/trabajador/PortalShell';
import { EstadoLista, Seccion, Titulo } from '../../components/trabajador/comun';
import { portal } from '../../api/portal';
import { CLAVE_PORTAL } from '../../hooks/usePortal';
import type { CasoKarinPortal } from '../../types';
import { fechaCL } from '../../utils/formato';

const DOCUMENTOS: Record<string, string> = {
  RECEPCION: 'Comprobante de recepción', DECISION: 'Comunicación de la decisión', CITACION: 'Citación a declarar',
  NOTIFICACION: 'Notificación de las conclusiones', MEDIDAS: 'Comunicación de medidas',
};
const ROL: Record<CasoKarinPortal['rol'], string> = {
  PARTE: 'Tu denuncia', DENUNCIADA: 'Investigación en la que te citan', TESTIGO: 'Citación como testigo',
};

/**
 * Casos Ley Karin en que participa la persona. Cada rol ve solo su parte:
 * quien denunció, el estado; la persona denunciada, sus citaciones y el
 * resultado; un testigo, solo su citación.
 */
export default function LeyKarin() {
  const { avisar } = usePortal();
  const consulta = useQuery({ queryKey: [CLAVE_PORTAL, 'karin'], queryFn: portal.karin });
  const casos = consulta.data?.casos ?? [];

  const bajar = async (c: CasoKarinPortal, tipo: string, participante: string) => {
    const error = await portal.descargarKarin(c.id, tipo, participante, `${c.folio}_${tipo.toLowerCase()}.pdf`);
    if (error) avisar(error, 'error');
  };

  return (
    <>
      <Titulo titulo="Ley Karin">
        Información reservada sobre denuncias de acoso o violencia en el trabajo en las que participas.
      </Titulo>
      <p className="flex gap-2.5 items-start rounded-[10px] bg-brand-soft text-brand-text px-4 py-3 text-[14.5px] leading-relaxed max-w-[760px]">
        <ShieldCheck className="size-5 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
        La investigación es reservada y la ley prohíbe cualquier represalia contra quien denuncia o declara. Si tienes dudas,
        consulta al encargado de denuncias de tu empresa o a la Dirección del Trabajo.
      </p>
      <EstadoLista cargando={consulta.isLoading} error={consulta.isError} vacia={casos.length === 0} textoVacio="No tienes casos por ahora." />
      {casos.map((c) => (
        <Seccion key={`${c.id}-${c.rol}`} titulo={`${ROL[c.rol]} · ${c.folio}`} subtitulo={c.empresa} className="max-w-[760px]">
          <div className="p-4 sm:p-[18px] flex flex-col gap-3 text-[15px]">
            {c.materia && <p><span className="text-fg-3">Materia:</span> {c.materia}{c.recibida_en ? `, recibida el ${fechaCL(c.recibida_en)}` : ''}.</p>}
            {c.estado && <p><span className="text-fg-3">Estado:</span> {c.estado}</p>}
            {c.decision && <p><span className="text-fg-3">Decisión:</span> {c.decision}{c.decision_en ? ` (desde el ${fechaCL(c.decision_en)})` : ''}.</p>}
            {c.resguardo && c.resguardo.length > 0 && (
              <div>
                <p className="text-fg-3">Medidas de resguardo:</p>
                <ul className="list-disc pl-5">{c.resguardo.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
            )}
            {c.citaciones.map((ci) => (
              <p key={ci.participante} className="flex gap-2.5 items-start rounded-[10px] bg-warn-soft text-warn px-3.5 py-3">
                <CalendarClock className="size-5 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
                <span>Citación a declarar el <b>{fechaCL(ci.fecha)}</b> a las <b>{ci.hora}</b> en {ci.lugar}.</span>
              </p>
            ))}
            {c.conclusion && <p><span className="text-fg-3">Resultado:</span> {c.conclusion}.</p>}
            {c.medidas_en && <p><span className="text-fg-3">Medidas aplicadas el</span> {fechaCL(c.medidas_en)}.</p>}
            {c.documentos.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {c.documentos.map((d) => (
                  <Button key={`${d.tipo}-${d.participante}`} variante="secundario" tamano="sm"
                    iconoInicio={<Download className="size-4" strokeWidth={2} />} onClick={() => void bajar(c, d.tipo, d.participante)}>
                    {DOCUMENTOS[d.tipo] ?? d.tipo}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </Seccion>
      ))}
    </>
  );
}
