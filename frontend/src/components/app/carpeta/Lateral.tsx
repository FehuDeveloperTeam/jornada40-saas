import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, ChevronRight, FileSignature, FileText, Receipt, UserX } from 'lucide-react';
import { rutaClasica } from '../../../hooks/usePanel';
import type { PestanaClasica } from '../../../hooks/usePanel';
import type { Empleado } from '../../../types';
import { ChipFirma, Seccion } from './comun';
import type { DocumentoReciente } from './documentos';

const ACCIONES: { texto: string; Icono: LucideIcon; tab: PestanaClasica; nivel: number }[] = [
  { texto: 'Emitir liquidación', Icono: Receipt, tab: 'liquidaciones', nivel: 1 },
  { texto: 'Crear anexo de contrato', Icono: FileSignature, tab: 'contratos', nivel: 1 },
  { texto: 'Registrar vacaciones', Icono: CalendarDays, tab: 'vacaciones', nivel: 2 },
  { texto: 'Emitir documento legal', Icono: FileText, tab: 'legal', nivel: 1 },
  { texto: 'Calcular finiquito', Icono: UserX, tab: 'finiquito', nivel: 1 },
];

export function Lateral({ empleado, documentos, nivel }: { empleado: Empleado; documentos: DocumentoReciente[]; nivel: number }) {
  const avisos = empleado.contrato_activo?.avisos_jornada ?? [];
  const pendientes: { texto: string; detalle: string; a: string; alta?: boolean }[] = [];
  const base = `/app/trabajadores/${empleado.id}`;

  if (!empleado.contrato_activo) {
    pendientes.push({ texto: 'Sin contrato registrado', detalle: 'Crea el contrato para emitir liquidaciones', a: rutaClasica(empleado.id, 'contratos'), alta: true });
  }
  for (const a of avisos) {
    pendientes.push({ texto: a.titulo, detalle: a.recomendacion, a: `${base}?tab=contrato`, alta: a.gravedad === 'alta' });
  }
  for (const d of documentos) {
    if (d.firma?.estado === 'RECHAZADO') pendientes.push({ texto: `${d.titulo}: firma rechazada`, detalle: d.firma.motivo_rechazo || 'Revisa y vuelve a enviar', a: `${base}?tab=documentos`, alta: true });
    else if (d.firma?.estado === 'PENDIENTE') pendientes.push({ texto: `${d.titulo}: firma pendiente`, detalle: 'Esperando al trabajador', a: `${base}?tab=documentos` });
  }

  return (
    <div className="flex flex-col gap-5">
      <Seccion titulo="Acciones">
        <div className="py-1.5">
          {ACCIONES.filter((x) => nivel >= x.nivel).map(({ texto, Icono, tab }) => (
            <Link key={texto} to={rutaClasica(empleado.id, tab)}
              className="flex items-center gap-3 px-[18px] py-2.5 text-[13px] text-fg no-underline hover:no-underline hover:bg-surface-2">
              <Icono className="size-[18px] text-fg-3" strokeWidth={2} aria-hidden />
              <span className="flex-1">{texto}</span>
              <ChevronRight className="size-4 text-fg-3" strokeWidth={2} aria-hidden />
            </Link>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Pendientes" accion={pendientes.length > 0 && <span className="text-[12.5px] text-fg-3">{pendientes.length}</span>}>
        {pendientes.length === 0 && <p className="px-[18px] py-4 text-[13px] text-fg-3">Nada pendiente con este trabajador.</p>}
        {pendientes.slice(0, 6).map((p, i) => (
          <Link key={i} to={p.a} className="flex gap-3 px-[18px] py-2.5 border-b border-line last:border-b-0 no-underline hover:no-underline text-fg hover:bg-surface-2">
            <span className={p.alta ? 'mt-1.5 size-2 rounded-full bg-danger shrink-0' : 'mt-1.5 size-2 rounded-full bg-warn shrink-0'} aria-hidden />
            <span className="flex flex-col min-w-0">
              <span className="text-[13px]">{p.texto}</span>
              <span className="text-[11.5px] text-fg-3 line-clamp-2">{p.detalle}</span>
            </span>
          </Link>
        ))}
      </Seccion>

      <Seccion titulo="Actividad reciente">
        {documentos.length === 0 && <p className="px-[18px] py-4 text-[13px] text-fg-3">Sin actividad todavía.</p>}
        {documentos.slice(0, 5).map((d) => (
          <div key={d.clave} className="flex gap-3 items-center px-[18px] py-2.5 border-b border-line last:border-b-0">
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-[13px] truncate">{d.titulo}</span>
              <span className="text-[11.5px] text-fg-3">{d.fechaTexto}</span>
            </div>
            <ChipFirma firma={d.firma} corto />
          </div>
        ))}
      </Seccion>
    </div>
  );
}
