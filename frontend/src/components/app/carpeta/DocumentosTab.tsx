import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { LucideIcon } from 'lucide-react';
import { Download, FileSignature, Send, FileText, FileWarning, Lock, ScrollText, UserX } from 'lucide-react';
import { Button } from '../../j40';
import client from '../../../api/client';
import { descargar } from '../../../api/descargas';
import { rutaClasica } from '../../../hooks/usePanel';
import type { PestanaClasica } from '../../../hooks/usePanel';
import type { Empleado } from '../../../types';
import { ChipFirma, Seccion } from './comun';
import type { DocumentoReciente } from './documentos';

interface Plantilla { titulo: string; detalle: string; Icono: LucideIcon; tab: PestanaClasica; nivel: number; ruta?: (id: number) => string }

const PLANTILLAS: Plantilla[] = [
  { titulo: 'Anexo de contrato', detalle: 'Cambios de jornada, sueldo o funciones', Icono: FileSignature, tab: 'contratos', nivel: 1 },
  { titulo: 'Amonestación', detalle: 'Carta por incumplimiento', Icono: FileWarning, tab: 'legal', nivel: 1 },
  { titulo: 'Constancia laboral', detalle: 'Registro de hechos', Icono: ScrollText, tab: 'legal', nivel: 1 },
  { titulo: 'Carta de término', detalle: 'Despido con causal legal', Icono: UserX, tab: 'legal', nivel: 2 },
  { titulo: 'Finiquito', detalle: 'Cálculo y documento', Icono: FileText, tab: 'finiquito', nivel: 2, ruta: (id) => `/app/trabajadores/${id}/finiquito` },
];

export function DocumentosTab({ empleado, documentos, nivel, avisar }: {
  empleado: Empleado; documentos: DocumentoReciente[]; nivel: number; avisar: (t: string) => void;
}) {
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState<string | null>(null);

  const enviarAFirma = async (d: DocumentoReciente) => {
    if (!d.envio) return;
    setEnviando(d.clave);
    try {
      await client.post('/firmas/solicitar/', { empleado_id: empleado.id, ...d.envio });
      await queryClient.invalidateQueries({ queryKey: ['firmas'] });
      avisar('Documento enviado a firma. El trabajador recibirá un correo.');
    } catch (err) {
      const datos = isAxiosError(err) ? (err.response?.data as { error?: string } | undefined) : undefined;
      avisar(datos?.error ?? 'No pudimos enviar el documento a firma.');
    } finally {
      setEnviando(null);
    }
  };

  const pdf = async (d: DocumentoReciente) => {
    if (!d.pdf) return;
    const error = await descargar(d.pdf.url, d.pdf.nombre);
    if (error) avisar(error);
  };

  return (
    <div className="flex flex-col gap-5">
      <Seccion titulo="Generar documento">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2.5 p-[18px]">
          {PLANTILLAS.map(({ titulo, detalle, Icono, tab, nivel: requerido, ruta }) => {
            const bloqueado = nivel < requerido;
            return (
              <Link key={titulo} to={bloqueado ? '/app/plan' : ruta ? ruta(empleado.id) : rutaClasica(empleado.id, tab)}
                className="group rounded-[10px] border border-line p-3.5 flex gap-3 items-start no-underline hover:no-underline text-fg hover:border-brand hover:bg-surface-2">
                <Icono className="size-5 text-brand-text shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[13px] font-medium">{titulo}</span>
                  <span className="text-[11.5px] text-fg-3">
                    {bloqueado
                      ? <span className="inline-flex items-center gap-1"><Lock className="size-3" strokeWidth={2} aria-hidden />Desde el plan Starter</span>
                      : detalle}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </Seccion>

      <Seccion titulo="Historial de documentos"
        accion={<span className="text-[12.5px] text-fg-3">{documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'}</span>}>
        {documentos.length === 0 && <p className="px-[18px] py-5 text-[13px] text-fg-3">Sin documentos emitidos.</p>}
        {documentos.map((d) => (
          <div key={d.clave} className="flex flex-wrap gap-x-3 gap-y-2 items-center px-[18px] py-3 border-b border-line last:border-b-0">
            <FileText className="size-[19px] text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
            <div className="flex-1 min-w-[180px] flex flex-col">
              <span className="text-[13px]">{d.titulo}</span>
              <span className="text-[11.5px] text-fg-3">{d.fechaTexto}</span>
            </div>
            <ChipFirma firma={d.firma} corto />
            {d.envio && (!d.firma || ['RECHAZADO', 'EXPIRADO', 'CANCELADO'].includes(d.firma.estado)) && (
              <Button variante="secundario" tamano="sm" onClick={() => enviarAFirma(d)} cargando={enviando === d.clave}
                disabled={enviando !== null} iconoInicio={<Send className="size-4" strokeWidth={2} />}>
                {d.firma ? 'Reenviar a firma' : 'Enviar a firma'}
              </Button>
            )}
            {d.pdf && (
              <Button variante="fantasma" tamano="sm" onClick={() => pdf(d)} aria-label={`Descargar ${d.titulo}`}
                iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>
            )}
          </div>
        ))}
      </Seccion>
    </div>
  );
}
