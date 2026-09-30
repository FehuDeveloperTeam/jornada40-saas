import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, ChevronRight, FileSignature, FileText, Receipt, UserX } from 'lucide-react';
import { rutaAccion, rutaLiquidacion } from '../../../hooks/usePanel';
import { usePermisos } from '../../../hooks/usePermisos';
import type { Empleado, ModuloPanel } from '../../../types';
import { ChipFirma, Seccion } from './comun';
import { PortalTrabajador } from './PortalTrabajador';
import type { DocumentoReciente } from './documentos';

// `modulos`: lo que la abre a un usuario del equipo con "ver y gestionar".
const ACCIONES: { texto: string; Icono: LucideIcon; nivel: number; ruta: (id: number) => string; modulos: ModuloPanel[] }[] = [
  { texto: 'Emitir liquidación', Icono: Receipt, nivel: 1, ruta: (id) => rutaLiquidacion(id), modulos: ['REMUNERACIONES'] },
  { texto: 'Editar contrato', Icono: FileSignature, nivel: 1, ruta: (id) => rutaAccion(id, 'contrato'), modulos: ['CONTRATOS'] },
  { texto: 'Crear anexo de contrato', Icono: FileSignature, nivel: 1, ruta: (id) => rutaAccion(id, 'anexo'), modulos: ['CONTRATOS'] },
  { texto: 'Registrar vacaciones', Icono: CalendarDays, nivel: 2, ruta: (id) => rutaAccion(id, 'vacacion'), modulos: ['VACACIONES'] },
  { texto: 'Emitir documento legal', Icono: FileText, nivel: 1, ruta: (id) => rutaAccion(id, 'documento'), modulos: ['DOCUMENTOS', 'TERMINO'] },
  { texto: 'Calcular finiquito', Icono: UserX, nivel: 2, ruta: (id) => `/app/trabajadores/${id}/finiquito`, modulos: ['TERMINO'] },
];

export function Lateral({ empleado, documentos, nivel, avisar }: {
  empleado: Empleado; documentos: DocumentoReciente[]; nivel: number; avisar: (texto: string, tipo?: 'ok' | 'error') => void;
}) {
  const { puede } = usePermisos();
  const avisos = puede('CONTRATOS') ? empleado.contrato_activo?.avisos_jornada ?? [] : [];
  const pendientes: { texto: string; detalle: string; a: string; alta?: boolean }[] = [];
  const base = `/app/trabajadores/${empleado.id}`;

  if (!empleado.contrato_activo && puede('CONTRATOS')) {
    pendientes.push({ texto: 'Sin contrato registrado', detalle: 'Crea el contrato para emitir liquidaciones', a: rutaAccion(empleado.id, 'contrato'), alta: true });
  }
  for (const a of avisos) {
    pendientes.push({ texto: a.titulo, detalle: a.recomendacion, a: `${base}?tab=contrato`, alta: a.gravedad === 'alta' });
  }
  for (const d of documentos) {
    if (d.firma?.estado === 'RECHAZADO') pendientes.push({ texto: `${d.titulo}: firma rechazada`, detalle: d.firma.motivo_rechazo || 'Revisa y vuelve a enviar', a: `${base}?tab=documentos`, alta: true });
    else if (d.firma?.estado === 'PENDIENTE') pendientes.push({ texto: `${d.titulo}: firma pendiente`, detalle: 'Esperando al trabajador', a: `${base}?tab=documentos` });
  }

  const acciones = ACCIONES.filter((x) => nivel >= x.nivel && puede(x.modulos, true)
    && (empleado.contrato_activo || !/anexo|liquidaci/i.test(x.texto)));

  return (
    <div className="flex flex-col gap-5">
      {acciones.length > 0 && <Seccion titulo="Acciones">
        <div className="py-1.5">
          {acciones.map(({ texto, Icono, ruta }) => (
            <Link key={texto} to={ruta(empleado.id)}
              className="flex items-center gap-3 px-[18px] py-2.5 text-[13px] text-fg no-underline hover:no-underline hover:bg-surface-2">
              <Icono className="size-[18px] text-fg-3" strokeWidth={2} aria-hidden />
              <span className="flex-1">{texto}</span>
              <ChevronRight className="size-4 text-fg-3" strokeWidth={2} aria-hidden />
            </Link>
          ))}
        </div>
      </Seccion>}

      <PortalTrabajador empleado={empleado} avisar={avisar} />

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
