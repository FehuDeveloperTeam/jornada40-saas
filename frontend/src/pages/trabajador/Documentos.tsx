import { usePortal } from '../../components/trabajador/PortalShell';
import { BotonDescarga, ChipFirmado, EstadoLista, Seccion, Titulo } from '../../components/trabajador/comun';
import { useDocumentosPortal } from '../../hooks/usePortal';
import type { DocumentoPortal } from '../../types';
import { fechaCL } from '../../utils/formato';

const COLUMNAS = 'grid grid-cols-[minmax(200px,2fr)_110px_96px_72px] gap-3 items-center';
const etiqueta = (d: DocumentoPortal) => `Descargar ${d.titulo}${d.fecha ? ` del ${fechaCL(d.fecha)}` : ''}`;

export default function Documentos() {
  const { variasEmpresas } = usePortal();
  const { data = [], isLoading, isError } = useDocumentosPortal();
  return (
    <>
      <Titulo titulo="Documentos">Contratos, anexos, cartas y comprobantes que tu empleador te entregó.</Titulo>
      <Seccion titulo="Tus documentos">
        <EstadoLista cargando={isLoading} error={isError} vacia={!data.length} textoVacio="Aún no hay documentos disponibles." />
        {data.length > 0 && (
          <>
            <div className="hidden min-[720px]:block overflow-x-auto" role="table" aria-label="Documentos">
              <div className="min-w-[520px]">
                <div role="row" className={`${COLUMNAS} px-[18px] py-2.5 text-[11.5px] font-medium text-fg-3 uppercase tracking-[0.04em] border-b border-line`}>
                  <span role="columnheader">Documento</span><span role="columnheader">Fecha</span>
                  <span role="columnheader">Estado</span><span role="columnheader" className="sr-only">Descargar</span>
                </div>
                {data.map((d) => (
                  <div key={`${d.tipo}-${d.id}`} role="row" className={`${COLUMNAS} px-[18px] py-3 border-b border-line last:border-b-0 text-[13px]`}>
                    <span role="cell" className="flex flex-col min-w-0">
                      <span className="font-medium">{d.titulo}</span>
                      {variasEmpresas && <span className="text-[11.5px] text-fg-3 truncate">{d.empresa}</span>}
                    </span>
                    <span role="cell" className="j40-num text-fg-2">{fechaCL(d.fecha)}</span>
                    <span role="cell"><ChipFirmado firmado={d.firmado} /></span>
                    <span role="cell" className="flex justify-end">
                      <BotonDescarga tipo={d.tipo} id={d.id} nombre={`${d.titulo}.pdf`} etiqueta={etiqueta(d)} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <ul className="min-[720px]:hidden flex flex-col" aria-label="Documentos">
              {data.map((d) => (
                <li key={`${d.tipo}-${d.id}`} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0">
                  <span className="flex-1 min-w-0 flex flex-col gap-1 items-start">
                    <span className="text-[14px] font-medium break-words max-w-full">{d.titulo}</span>
                    <span className="text-[12px] text-fg-3 j40-num">{variasEmpresas ? `${d.empresa} · ` : ''}{fechaCL(d.fecha)}</span>
                    <ChipFirmado firmado={d.firmado} />
                  </span>
                  <BotonDescarga tipo={d.tipo} id={d.id} nombre={`${d.titulo}.pdf`} etiqueta={etiqueta(d)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Seccion>
    </>
  );
}
