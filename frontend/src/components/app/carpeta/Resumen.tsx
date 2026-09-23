import { Link } from 'react-router-dom';
import { Download, FileText, Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '../../j40';
import { descargar } from '../../../api/descargas';
import { rutaClasica } from '../../../hooks/usePanel';
import type { Empleado, Liquidacion, SolicitudFirma } from '../../../types';
import { capitalizar, clp, periodo } from '../../../utils/formato';
import { ListaAvisos } from '../Avisos';
import { TIPO_JORNADA } from '../trabajador';
import { BarraJornada, BotonEnlace, ChipFirma, EnlaceAccion, Seccion } from './comun';
import { firmaDe } from './utiles';
import type { DocumentoReciente } from './documentos';

export function Resumen({ empleado, liquidaciones, firmas, documentos, maximo, cargando, avisar }: {
  empleado: Empleado; liquidaciones: Liquidacion[]; firmas: SolicitudFirma[]; documentos: DocumentoReciente[];
  maximo: number; cargando: boolean; avisar: (t: string) => void;
}) {
  const contrato = empleado.contrato_activo;
  const ultima = [...liquidaciones].sort((a, b) => b.anio - a.anio || b.mes - a.mes)[0];
  const horas = Number(contrato?.horas_semanales ?? 0);
  const esArt22 = contrato?.tipo_jornada === 'ART_22';
  const base = `/app/trabajadores/${empleado.id}`;

  const pdfLiquidacion = async (l: Liquidacion) => {
    const error = await descargar(`/liquidaciones/${l.id}/generar_pdf/`, `Liquidacion_${empleado.rut}_${l.anio}-${String(l.mes).padStart(2, '0')}.pdf`);
    if (error) avisar(error);
  };

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5">
      <Seccion titulo={ultima ? `Última liquidación · ${periodo(ultima.mes, ultima.anio)}` : 'Última liquidación'}
        accion={ultima && <ChipFirma firma={firmaDe(firmas, 'liquidacion', ultima.id)} />}>
        {ultima ? (
          <>
            <div className="px-[18px] py-4 flex flex-col gap-2.5 j40-num">
              <Fila t="Total imponible" v={clp(ultima.total_imponible)} />
              <Fila t="Total haberes" v={clp(ultima.total_haberes)} />
              <Fila t="Total descuentos" v={`− ${clp(ultima.total_descuentos)}`} />
              <div className="flex justify-between items-baseline pt-2.5 border-t border-line">
                <span className="text-[13px] font-medium">Líquido a pagar</span>
                <span className="text-[22px] font-semibold tracking-[-0.01em]">{clp(ultima.sueldo_liquido)}</span>
              </div>
            </div>
            <div className="flex gap-2 px-[18px] pb-4 mt-auto">
              <BotonEnlace a={`${base}?tab=remuneraciones`} className="flex-1">Ver historial</BotonEnlace>
              <Button variante="secundario" className="flex-1 h-9" onClick={() => pdfLiquidacion(ultima)}
                iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>
            </div>
          </>
        ) : cargando ? (
          <p className="px-[18px] py-5 text-[13px] text-fg-3" role="status">Cargando…</p>
        ) : (
          <div className="px-[18px] py-5 flex flex-col gap-3 items-start">
            <p className="text-[13px] text-fg-3">Todavía no hay liquidaciones emitidas.</p>
            <BotonEnlace a={rutaClasica(empleado.id, 'liquidaciones')} primario>Emitir la primera</BotonEnlace>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Jornada y Ley 40 horas" accion={<EnlaceAccion a={`${base}?tab=contrato`}>Ver horario</EnlaceAccion>}>
        <div className="p-[18px] flex flex-col gap-4">
          {!contrato ? (
            <p className="text-[13px] text-fg-3">Sin contrato registrado.</p>
          ) : esArt22 ? (
            <p className="text-[13px] text-fg-2">Artículo 22 inciso 2°: excluido del límite de jornada.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className={horas > maximo ? 'text-[30px] font-semibold tracking-[-0.02em] text-danger' : 'text-[30px] font-semibold tracking-[-0.02em] text-brand-text'}>{horas} h</span>
                <span className="text-[13px] text-fg-3">semanales · {TIPO_JORNADA[contrato.tipo_jornada] ?? contrato.tipo_jornada}</span>
              </div>
              <BarraJornada horas={horas} maximo={maximo} />
            </>
          )}
          <ListaAvisos avisos={contrato?.avisos_jornada} compacto />
          {contrato?.avisos_jornada?.some((a) => a.codigo === 'EXCEDE_MAXIMO') && (
            <BotonEnlace a={rutaClasica(empleado.id, 'contratos')} primario>Generar anexo Ley 40 horas</BotonEnlace>
          )}
        </div>
      </Seccion>

      <Seccion titulo="Contacto" accion={<EnlaceAccion a={`${base}?tab=personal`}>Editar</EnlaceAccion>}>
        <div className="px-[18px] pt-1.5 pb-2.5">
          <Contacto Icono={Mail} texto={empleado.email?.toLowerCase() || 'Sin correo'} />
          <Contacto Icono={Phone} texto={empleado.numero_telefono || 'Sin teléfono'} />
          <Contacto Icono={MapPin} texto={[capitalizar(empleado.direccion), capitalizar(empleado.comuna)].filter(Boolean).join(', ') || 'Sin dirección'} ultimo />
        </div>
      </Seccion>

      <Seccion titulo="Documentos recientes" accion={<EnlaceAccion a={`${base}?tab=documentos`}>Ver todos</EnlaceAccion>}>
        {documentos.length === 0 && <p className="px-[18px] py-5 text-[13px] text-fg-3">Sin documentos emitidos.</p>}
        {documentos.slice(0, 4).map((d) => (
          <div key={d.clave} className="flex gap-3 items-center px-[18px] py-2.5 border-b border-line last:border-b-0">
            <FileText className="size-[19px] text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-[13px] truncate">{d.titulo}</span>
              <span className="text-[11.5px] text-fg-3">{d.fechaTexto}</span>
            </div>
            <ChipFirma firma={d.firma} corto />
          </div>
        ))}
        {documentos.length > 0 && (
          <Link to={`${base}?tab=documentos`} className="px-[18px] py-2.5 text-[12.5px] font-medium">Ir a documentos</Link>
        )}
      </Seccion>
    </div>
  );
}

function Fila({ t, v }: { t: string; v: string }) {
  return <div className="flex justify-between text-[13px] text-fg-2"><span>{t}</span><span>{v}</span></div>;
}

function Contacto({ Icono, texto, ultimo }: { Icono: typeof Mail; texto: string; ultimo?: boolean }) {
  return (
    <div className={ultimo ? 'flex gap-3 items-center py-2.5' : 'flex gap-3 items-center py-2.5 border-b border-line'}>
      <Icono className="size-[19px] text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
      <span className="text-[13px] min-w-0 truncate">{texto}</span>
    </div>
  );
}
