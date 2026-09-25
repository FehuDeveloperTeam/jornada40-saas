import { Link } from 'react-router-dom';
import { Download, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '../../j40';
import { descargar } from '../../../api/descargas';
import { rutaLiquidacion } from '../../../hooks/usePanel';
import type { Empleado, Liquidacion, SolicitudFirma } from '../../../types';
import { clp, decimalCL, fechaCL, nombreMes, periodo } from '../../../utils/formato';
import { BotonEnlace, ChipFirma, Seccion } from './comun';
import { firmaDe } from './utiles';

const COLUMNAS = 'grid-cols-[minmax(140px,1.4fr)_repeat(3,minmax(100px,1fr))_170px_64px]';

export function Remuneraciones({ empleado, liquidaciones, firmas, cargando, avisar }: {
  empleado: Empleado; liquidaciones: Liquidacion[]; firmas: SolicitudFirma[]; cargando: boolean;
  avisar: (t: string) => void;
}) {
  const ordenadas = [...liquidaciones].sort((a, b) => b.anio - a.anio || b.mes - a.mes);
  const ultimas6 = ordenadas.slice(0, 6).reverse();
  const tope = Math.max(1, ...ultimas6.map((l) => l.total_haberes));
  const promedio = ultimas6.length ? ultimas6.reduce((s, l) => s + l.sueldo_liquido, 0) / ultimas6.length : 0;
  // Tendencia: variación del líquido contra el mes anterior y contra el primero
  // de la ventana, y los cambios de sueldo base (congelado en cada liquidación).
  const variacion = (actual: number, antes: number) => (antes > 0 ? ((actual - antes) / antes) * 100 : null);
  const [ultima, anterior] = ordenadas;
  const vsAnterior = ultima && anterior ? variacion(ultima.sueldo_liquido, anterior.sueldo_liquido) : null;
  const vsInicio = ultimas6.length > 2 ? variacion(ultimas6[ultimas6.length - 1].sueldo_liquido, ultimas6[0].sueldo_liquido) : null;
  const cambiosBase = [...ordenadas].reverse().flatMap((l, n, xs) => {
    const previa = xs[n - 1];
    return previa && previa.sueldo_base_contrato > 0 && l.sueldo_base_contrato > 0 && l.sueldo_base_contrato !== previa.sueldo_base_contrato
      ? [{ id: l.id, periodo: periodo(l.mes, l.anio), desde: previa.sueldo_base_contrato, hasta: l.sueldo_base_contrato }] : [];
  }).reverse().slice(0, 3);

  const pdf = async (l: Liquidacion) => {
    const error = await descargar(`/liquidaciones/${l.id}/generar_pdf/`,
      `Liquidacion_${empleado.rut}_${l.anio}-${String(l.mes).padStart(2, '0')}.pdf`);
    if (error) avisar(error);
  };

  if (!cargando && ordenadas.length === 0) {
    return (
      <Seccion titulo="Remuneraciones">
        <div className="px-[18px] py-5 flex flex-col gap-3 items-start">
          <p className="text-[13px] text-fg-3">Todavía no hay liquidaciones emitidas para este trabajador.</p>
          <BotonEnlace a={rutaLiquidacion(empleado.id)} primario>Emitir liquidación</BotonEnlace>
        </div>
      </Seccion>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Seccion titulo="Últimos 6 meses"
        accion={<span className="text-[12.5px] text-fg-3">Líquido promedio <b className="text-fg font-semibold j40-num">{clp(promedio)}</b></span>}>
        {/* Barras: haberes (claro) y líquido (marca) de cada mes. */}
        <div className="flex items-end gap-3 h-[190px] px-[18px] pt-5 pb-3" role="img"
          aria-label={`Líquido de los últimos ${ultimas6.length} meses`}>
          {ultimas6.map((l) => (
            <div key={l.id} className="flex-1 min-w-0 h-full flex flex-col items-center gap-1.5">
              <span className="text-[11px] text-fg-3 j40-num whitespace-nowrap">{clp(l.sueldo_liquido)}</span>
              <div className="relative w-full max-w-[56px] flex-1 flex items-end">
                <div className="absolute bottom-0 inset-x-0 rounded-t-[6px] bg-brand-soft" style={{ height: `${(l.total_haberes / tope) * 100}%` }} />
                <div className="absolute bottom-0 inset-x-0 rounded-t-[6px] bg-brand" style={{ height: `${(l.sueldo_liquido / tope) * 100}%` }} />
              </div>
              <span className="text-[11.5px] text-fg-2">{nombreMes(l.mes).slice(0, 3)} {String(l.anio).slice(2)}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 px-[18px] pb-3.5 text-[11.5px] text-fg-3">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-brand-soft" />Total haberes</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-brand" />Líquido</span>
        </div>
        {(vsAnterior !== null || vsInicio !== null || cambiosBase.length > 0) && (
          <div className="flex flex-col gap-1.5 px-[18px] pb-4 pt-3 border-t border-line text-[12.5px] text-fg-2">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {vsAnterior !== null && <Tendencia etiqueta="Líquido vs. mes anterior" valor={vsAnterior} />}
              {vsInicio !== null && <Tendencia etiqueta={`Líquido en ${ultimas6.length} meses`} valor={vsInicio} />}
            </div>
            {cambiosBase.map((c) => (
              <span key={c.id}>Sueldo base: {clp(c.desde)} → <b className="font-semibold text-fg j40-num">{clp(c.hasta)}</b> desde {c.periodo}
                {' '}({Math.round(((c.hasta - c.desde) / c.desde) * 1000) / 10 > 0 ? '+' : ''}{decimalCL(((c.hasta - c.desde) / c.desde) * 100, 1)} %)</span>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Liquidaciones emitidas"
        accion={<BotonEnlace a={rutaLiquidacion(empleado.id)}>Emitir liquidación</BotonEnlace>}>
        {/* Escritorio y tablet: tabla */}
        <div className="hidden min-[720px]:block overflow-x-auto">
          <div className="min-w-[680px]">
            <div className={`grid ${COLUMNAS} gap-3 px-[18px] py-2.5 text-[11.5px] font-medium text-fg-3 uppercase tracking-[0.04em] border-b border-line`}>
              <span>Período</span><span className="text-right">Imponible</span><span className="text-right">Descuentos</span>
              <span className="text-right">Líquido</span><span>Firma</span><span className="sr-only">PDF</span>
            </div>
            {ordenadas.map((l) => (
              <div key={l.id} className={`grid ${COLUMNAS} gap-3 items-center px-[18px] py-2.5 border-b border-line last:border-b-0 text-[13px] j40-num`}>
                <span className="flex flex-col">
                  <span className="font-medium">{periodo(l.mes, l.anio)}</span>
                  <span className="text-[11.5px] text-fg-3">Emitida el {fechaCL(l.fecha_emision)}</span>
                </span>
                <span className="text-right">{clp(l.total_imponible)}</span>
                <span className="text-right">{clp(l.total_descuentos)}</span>
                <span className="text-right font-semibold">{clp(l.sueldo_liquido)}</span>
                <span className="flex items-center gap-2"><ChipFirma firma={firmaDe(firmas, 'liquidacion', l.id)} corto />
                  <Link to={rutaLiquidacion(empleado.id, l.mes, l.anio)} className="text-[12px] font-medium">Abrir</Link></span>
                <Button variante="fantasma" tamano="sm" onClick={() => pdf(l)} aria-label={`Descargar liquidación de ${periodo(l.mes, l.anio)}`}
                  iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>
              </div>
            ))}
          </div>
        </div>
        {/* Móvil: tarjetas */}
        <div className="min-[720px]:hidden flex flex-col">
          {ordenadas.map((l) => (
            <div key={l.id} className="flex flex-col gap-2.5 px-4 py-3.5 border-b border-line last:border-b-0 text-[13px] j40-num">
              <div className="flex items-start justify-between gap-3">
                <span className="flex flex-col min-w-0">
                  <span className="font-medium">{periodo(l.mes, l.anio)}</span>
                  <span className="text-[11.5px] text-fg-3">Emitida el {fechaCL(l.fecha_emision)}</span>
                </span>
                <ChipFirma firma={firmaDe(firmas, 'liquidacion', l.id)} corto />
              </div>
              <dl className="grid grid-cols-3 gap-2">
                <div className="flex flex-col min-w-0"><dt className="text-[11px] text-fg-3">Imponible</dt><dd>{clp(l.total_imponible)}</dd></div>
                <div className="flex flex-col min-w-0"><dt className="text-[11px] text-fg-3">Descuentos</dt><dd>{clp(l.total_descuentos)}</dd></div>
                <div className="flex flex-col min-w-0"><dt className="text-[11px] text-fg-3">Líquido</dt><dd className="font-semibold">{clp(l.sueldo_liquido)}</dd></div>
              </dl>
              <div className="flex gap-2">
                <BotonEnlace a={rutaLiquidacion(empleado.id, l.mes, l.anio)} className="flex-1">Abrir</BotonEnlace>
                <Button variante="secundario" className="flex-1 h-9" onClick={() => pdf(l)} aria-label={`Descargar liquidación de ${periodo(l.mes, l.anio)}`}
                  iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>
              </div>
            </div>
          ))}
        </div>
      </Seccion>
    </div>
  );
}

function Tendencia({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  const Icono = valor < 0 ? TrendingDown : TrendingUp;
  return (
    <span className="inline-flex items-center gap-1.5">
      {etiqueta}:
      <b className={`inline-flex items-center gap-1 font-semibold j40-num ${valor < 0 ? 'text-danger' : 'text-ok'}`}>
        <Icono className="size-3.5" strokeWidth={2.2} aria-hidden />{valor > 0 ? '+' : ''}{decimalCL(valor, 1)} %
      </b>
    </span>
  );
}
