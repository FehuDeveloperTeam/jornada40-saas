import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Download, FileSpreadsheet, FolderArchive, Stamp, TriangleAlert } from 'lucide-react';
import { AlertaError, Button, Modal } from '../../j40';
import client from '../../../api/client';
import { descargar } from '../../../api/descargas';
import type { EstadoCertificado6 } from '../../../types';
import { clp } from '../../../utils/formato';

/**
 * Certificado N°6 del SII (sueldos y otras rentas similares): se emite cuando
 * termina el año, con los factores de actualización que publica el SII, y los
 * totales coinciden con la DJ 1887. El cálculo lo hace el backend.
 */
export function ModalCertificado6({ abierto, onCerrar, empresaId, avisar }: {
  abierto: boolean; onCerrar: () => void; empresaId: number; avisar: (t: string, tipo?: 'ok' | 'error') => void;
}) {
  const queryClient = useQueryClient();
  const [anio, setAnio] = useState<number | null>(null);
  const [emitiendo, setEmitiendo] = useState(false);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState<string | null>(null);
  const estado = useQuery({
    queryKey: ['certificados-sueldos', empresaId, anio],
    queryFn: async () => (await client.get<EstadoCertificado6>(
      `/certificados-sueldos/?empresa=${empresaId}${anio ? `&anio=${anio}` : ''}`)).data,
    enabled: abierto,
  });
  const e = estado.data;

  const emitir = async () => {
    if (!e) return;
    setEmitiendo(true);
    setError('');
    try {
      const { data } = await client.post<{ creados: number; sin_cambios: number }>('/certificados-sueldos/emitir/', { empresa: empresaId, anio: e.anio });
      await queryClient.invalidateQueries({ queryKey: ['certificados-sueldos', empresaId] });
      avisar(data.creados ? `${data.creados} ${data.creados === 1 ? 'certificado emitido' : 'certificados emitidos'}` : 'Los certificados ya estaban al día');
    } catch (err) {
      setError((isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || 'No pudimos emitir los certificados.');
    } finally {
      setEmitiendo(false);
    }
  };

  const bajar = async (clave: string, url: string, nombre: string) => {
    setBajando(clave);
    const fallo = await descargar(url, nombre);
    setBajando(null);
    if (fallo) avisar(fallo, 'error');
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Certificado N°6 (SII)" ancho="amplio"
      subtitulo="Sueldos y otras rentas similares: se entrega a cada trabajador y sus totales van en la DJ 1887.">
      <div className="flex flex-col gap-4">
        {estado.isLoading && <p className="text-[13px] text-fg-3" role="status">Cargando…</p>}
        {error && <AlertaError>{error}</AlertaError>}
        {e && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium text-fg-2">Año comercial</span>
                <select value={e.anio} onChange={(ev) => setAnio(Number(ev.target.value))}
                  className="h-10 px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft">
                  {(e.anios.length ? e.anios : [e.anio]).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <p className="flex-1 min-w-[220px] text-[12.5px] text-fg-2">
                Entrega a los trabajadores a más tardar el <b>{e.plazo_certificados}</b>; DJ 1887 hasta el <b>{e.plazo_dj1887}</b>.
              </p>
            </div>
            {!e.factores_completos && (
              <p className="flex gap-2 items-start rounded-[8px] bg-warn-soft text-warn px-3 py-2.5 text-[12.5px]">
                <TriangleAlert className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
                Aún no están cargados los factores de actualización del SII para {e.anio}. Se publican en enero; los cargamos nosotros.
              </p>
            )}
            <p className="text-[13px] text-fg-2">
              {e.trabajadores} {e.trabajadores === 1 ? 'trabajador' : 'trabajadores'} con liquidaciones en {e.anio}
              {e.sin_certificado > 0 ? ` · ${e.sin_certificado} sin certificado` : ' · todos con certificado'}.
              Si corriges una liquidación, emite de nuevo: se genera un certificado con otro número que reemplaza al anterior.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void emitir()} cargando={emitiendo} disabled={!e.factores_completos || !e.anio_cerrado || e.trabajadores === 0}
                iconoInicio={<Stamp className="size-4" strokeWidth={2} />}>Emitir certificados {e.anio}</Button>
              {e.certificados.length > 0 && (
                <>
                  <Button variante="secundario" cargando={bajando === 'zip'} iconoInicio={<FolderArchive className="size-4" strokeWidth={2} />}
                    onClick={() => void bajar('zip', `/certificados-sueldos/zip/?empresa=${empresaId}&anio=${e.anio}`, `Certificados6_${e.anio}.zip`)}>Todos en ZIP</Button>
                  <Button variante="secundario" cargando={bajando === 'dj'} iconoInicio={<FileSpreadsheet className="size-4" strokeWidth={2} />}
                    onClick={() => void bajar('dj', `/certificados-sueldos/resumen-dj1887/?empresa=${empresaId}&anio=${e.anio}`, `Resumen_DJ1887_${e.anio}.xlsx`)}>Resumen DJ 1887</Button>
                </>
              )}
            </div>
            {e.certificados.length > 0 && (
              <ul className="flex flex-col border border-line rounded-[10px]" aria-label="Certificados emitidos">
                {e.certificados.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 border-b border-line last:border-b-0 text-[13px]">
                    <span className="w-[58px] font-medium j40-num">N° {c.numero}</span>
                    <span className="flex-1 min-w-[180px]">{c.trabajador} <span className="text-fg-3 j40-num">· {c.rut}</span></span>
                    <span className="text-[12px] text-fg-3 j40-num">Renta {clp(c.renta_afecta_act)} · Impuesto {clp(c.impuesto_act)}</span>
                    <Button variante="fantasma" tamano="sm" cargando={bajando === `c${c.id}`} aria-label={`Descargar certificado ${c.numero}`}
                      onClick={() => void bajar(`c${c.id}`, `/certificados-sueldos/${c.id}/pdf/`, `Certificado6_${e.anio}_${c.numero}.pdf`)}
                      iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11.5px] text-fg-3">
              El Resumen DJ 1887 es una planilla de apoyo con los totales actualizados, los montos mensuales, la sigla del período y las
              horas pactadas a diciembre; no es el archivo de carga oficial del SII.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
