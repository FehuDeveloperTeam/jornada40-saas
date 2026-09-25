import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { CircleCheck, Download, ExternalLink, TriangleAlert } from 'lucide-react';
import { AlertaError, Button, Modal } from '../../j40';
import client from '../../../api/client';
import { descargar } from '../../../api/descargas';
import type { Empleado } from '../../../types';
import { capitalizar, periodo } from '../../../utils/formato';

interface RevisionLre { trabajadores: number; faltan: string[]; avisos: string[] }

/** "Ana Pérez: faltan cosas" → persona enlazada a su carpeta, si se reconoce el nombre. */
function Linea({ texto, trabajadores, onIr }: { texto: string; trabajadores: Empleado[]; onIr: () => void }) {
  const corte = texto.indexOf(': ');
  const nombre = corte >= 0 ? texto.slice(0, corte) : '';
  const detalle = corte >= 0 ? texto.slice(corte + 2) : texto;
  const persona = nombre
    ? trabajadores.find((t) => `${t.nombres} ${t.apellido_paterno}`.trim().toUpperCase() === nombre.toUpperCase())
    : undefined;
  return (
    <li className="flex flex-col gap-0.5 px-3.5 py-2.5 border-b border-line last:border-b-0 text-[13px]">
      {persona
        ? <Link to={`/app/trabajadores/${persona.id}?tab=personal`} className="font-medium" onClick={onIr}>{capitalizar(nombre)}</Link>
        : nombre && <span className="font-medium">{capitalizar(nombre)}</span>}
      <span className="text-fg-2">{detalle}</span>
    </li>
  );
}

/**
 * Libro de Remuneraciones Electrónico del mes: primero se revisa (qué falta y
 * qué conviene revisar, calculado por el servidor) y después se descarga el
 * CSV con la plantilla oficial para subirlo a Mi DT.
 */
export function ModalLre({ abierto, onCerrar, empresaId, empresaRut, mes, anio, trabajadores, avisar }: {
  abierto: boolean; onCerrar: () => void; empresaId: number; empresaRut: string; mes: number; anio: number;
  trabajadores: Empleado[]; avisar: (texto: string, tipo?: 'error') => void;
}) {
  const [descargando, setDescargando] = useState(false);
  const consulta = `empresa=${empresaId}&mes=${mes}&anio=${anio}`;
  const revision = useQuery({
    queryKey: ['revisar-lre', empresaId, mes, anio],
    queryFn: async () => (await client.get<RevisionLre>(`/liquidaciones/revisar_lre/?${consulta}`)).data,
    enabled: abierto,
    staleTime: 0,
  });
  const datos = revision.data;
  const bloqueado = !datos || datos.faltan.length > 0 || datos.trabajadores === 0;
  // Plazo legal: dentro de los primeros 15 días del mes siguiente (Art. 62 bis).
  const siguiente = new Date(anio, mes, 15);
  const plazo = `15-${String(siguiente.getMonth() + 1).padStart(2, '0')}-${siguiente.getFullYear()}`;

  const bajar = async () => {
    setDescargando(true);
    const error = await descargar(`/liquidaciones/exportar_lre/?${consulta}`,
      `${empresaRut.replace(/\./g, '')}_${anio}${String(mes).padStart(2, '0')}.csv`);
    setDescargando(false);
    if (error) avisar(error, 'error');
    else { avisar('Libro de Remuneraciones Electrónico descargado'); onCerrar(); }
  };

  return (
    <Modal abierto={abierto} onCerrar={() => !descargando && onCerrar()} ancho="amplio"
      titulo="Libro de Remuneraciones Electrónico" subtitulo={`${periodo(mes, anio)} · se declara en Mi DT hasta el ${plazo}`}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={descargando}>Cerrar</Button>
        <Button onClick={bajar} cargando={descargando} disabled={bloqueado}
          iconoInicio={<Download className="size-4" strokeWidth={2} />}>Descargar archivo</Button>
      </>}>
      <div className="flex flex-col gap-3 text-[13px]">
        {revision.isLoading && <p className="text-fg-3" role="status">Revisando las liquidaciones del período…</p>}
        {revision.isError && (
          <AlertaError>
            {(isAxiosError(revision.error) && (revision.error.response?.data as { error?: string } | undefined)?.error)
              || 'No pudimos revisar el período.'}
          </AlertaError>
        )}
        {datos && datos.trabajadores === 0 && datos.faltan.length === 0 && (
          <AlertaError>No hay liquidaciones emitidas en este período.</AlertaError>
        )}
        {datos && datos.faltan.length > 0 && (
          <>
            <AlertaError>Completa estos datos para generar el libro: sin ellos la DT rechaza el archivo.</AlertaError>
            <ul className="flex flex-col rounded-[10px] border border-line max-h-[36vh] overflow-y-auto">
              {datos.faltan.map((l) => <Linea key={l} texto={l} trabajadores={trabajadores} onIr={onCerrar} />)}
            </ul>
          </>
        )}
        {datos && datos.faltan.length === 0 && datos.trabajadores > 0 && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] bg-ok-soft text-ok">
            <CircleCheck className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            <span>{datos.trabajadores} {datos.trabajadores === 1 ? 'trabajador listo' : 'trabajadores listos'} para declarar.</span>
          </div>
        )}
        {datos && datos.avisos.length > 0 && (
          <>
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-[10px] bg-warn-soft text-warn">
              <TriangleAlert className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
              <span>Revisa esto antes de declarar (no impide descargar). Los códigos de tus conceptos propios se asignan en{' '}
                <Link to="/app/remuneraciones/conceptos" onClick={onCerrar} className="font-medium">Conceptos</Link>.</span>
            </div>
            <ul className="flex flex-col rounded-[10px] border border-line max-h-[30vh] overflow-y-auto">
              {datos.avisos.map((l) => <Linea key={l} texto={l} trabajadores={trabajadores} onIr={onCerrar} />)}
            </ul>
          </>
        )}
        <p className="text-fg-3">
          Súbelo en{' '}
          <a href="https://midt.dirtrab.cl" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium">
            Mi DT<ExternalLink className="size-3" strokeWidth={2} aria-hidden />
          </a>{' '}
          → Libro de Remuneraciones Electrónico, sin abrirlo en Excel (cambia las fechas y la codificación). La DT lo valida en
          hasta 48 horas y te avisa por correo.
        </p>
      </div>
    </Modal>
  );
}
