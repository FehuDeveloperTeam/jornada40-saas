import type { LiquidacionPortal } from '../../types';
import { clp, periodo } from '../../utils/formato';
import { BotonDescarga, ChipFirmado } from './comun';

const COLUMNAS = 'grid grid-cols-[minmax(170px,1.6fr)_repeat(3,minmax(100px,1fr))_96px_72px] gap-3 items-center';
const nombreArchivo = (l: LiquidacionPortal) => `Liquidacion_${l.anio}_${String(l.mes).padStart(2, '0')}.pdf`;

/** Liquidaciones: tabla en escritorio, tarjetas bajo 720 px. */
export function ListaLiquidaciones({ liquidaciones, variasEmpresas }: { liquidaciones: LiquidacionPortal[]; variasEmpresas: boolean }) {
  return (
    <>
      <div className="hidden min-[720px]:block overflow-x-auto" role="table" aria-label="Liquidaciones">
        <div className="min-w-[680px]">
          <div role="row" className={`${COLUMNAS} px-[18px] py-2.5 text-[11.5px] font-medium text-fg-3 uppercase tracking-[0.04em] border-b border-line`}>
            <span role="columnheader">Período</span>
            <span role="columnheader" className="text-right">Haberes</span>
            <span role="columnheader" className="text-right">Descuentos</span>
            <span role="columnheader" className="text-right">Líquido</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader" className="sr-only">Descargar</span>
          </div>
          {liquidaciones.map((l) => (
            <div key={l.id} role="row" className={`${COLUMNAS} px-[18px] py-3 border-b border-line last:border-b-0 text-[13px]`}>
              <span role="cell" className="flex flex-col min-w-0">
                <span className="font-medium">{periodo(l.mes, l.anio)}</span>
                {variasEmpresas && <span className="text-[11.5px] text-fg-3 truncate">{l.empresa}</span>}
              </span>
              <span role="cell" className="text-right j40-num">{clp(l.total_haberes)}</span>
              <span role="cell" className="text-right j40-num text-fg-2">{clp(l.total_descuentos)}</span>
              <span role="cell" className="text-right j40-num font-semibold">{clp(l.liquido)}</span>
              <span role="cell"><ChipFirmado firmado={l.firmada} texto="Firmada" /></span>
              <span role="cell" className="flex justify-end">
                <BotonDescarga tipo="liquidacion" id={l.id} nombre={nombreArchivo(l)} etiqueta={`Descargar liquidación de ${periodo(l.mes, l.anio)}`} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <ul className="min-[720px]:hidden flex flex-col" aria-label="Liquidaciones">
        {liquidaciones.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0">
            <span className="flex-1 min-w-0 flex flex-col gap-1 items-start">
              <span className="text-[14px] font-medium">{periodo(l.mes, l.anio)}</span>
              {variasEmpresas && <span className="text-[12px] text-fg-3 truncate max-w-full">{l.empresa}</span>}
              <span className="text-[12px] text-fg-3">Líquido <strong className="text-fg font-semibold j40-num">{clp(l.liquido)}</strong></span>
              <ChipFirmado firmado={l.firmada} texto="Firmada" />
            </span>
            <BotonDescarga tipo="liquidacion" id={l.id} nombre={nombreArchivo(l)} etiqueta={`Descargar liquidación de ${periodo(l.mes, l.anio)}`} />
          </li>
        ))}
      </ul>
    </>
  );
}
