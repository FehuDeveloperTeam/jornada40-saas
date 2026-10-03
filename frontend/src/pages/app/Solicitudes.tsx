import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { FilePlus2, Send, X } from 'lucide-react';
import { AlertaError, Button, Chip, Field, Modal } from '../../components/j40';
import type { TonoChip } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import client from '../../api/client';
import { rutaLiquidacion, useSolicitudesDocumento } from '../../hooks/usePanel';
import { usePermisos } from '../../hooks/usePermisos';
import type { EstadoSolicitudDocumento, SolicitudDocumentoPanel } from '../../types';
import { cn } from '../../utils/cn';
import { moduloDeTipo } from '../../utils/moduloDocumento';
import { capitalizar, fechaCL } from '../../utils/formato';
import { CORREO_NO_ENVIADO, correoFallo } from '../../utils/correo';

const ESTADO: Record<EstadoSolicitudDocumento, { texto: string; tono: TonoChip }> = {
  PENDIENTE: { texto: 'Por atender', tono: 'aviso' },
  RESUELTA: { texto: 'Resuelta', tono: 'ok' },
  DESCARTADA: { texto: 'Descartada', tono: 'neutro' },
};
const FILTROS: [EstadoSolicitudDocumento | 'todas', string][] = [
  ['PENDIENTE', 'Por atender'], ['RESUELTA', 'Resueltas'], ['DESCARTADA', 'Descartadas'], ['todas', 'Todas'],
];

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

const titulo = (s: SolicitudDocumentoPanel) => `${s.tipo_texto}${s.referencia ? ` · ${s.referencia}` : ''}`;

const BOTON_ENLACE = 'inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] border bg-brand-btn border-brand-btn text-white text-[13px] font-medium no-underline hover:no-underline hover:brightness-110';

/** Lo que se envía a firma para atender la solicitud, o null si antes hay que crear el documento. */
function envioAFirma(s: SolicitudDocumentoPanel): Record<string, unknown> | null {
  const base = { empleado_id: s.empleado.id, tipo_documento: s.tipo };
  if (s.tipo === 'LIQUIDACION') return s.liquidacion ? { ...base, liquidacion_id: s.liquidacion } : null;
  if (s.tipo === 'CONTRATO' || s.tipo === 'ANEXO_40H') return s.contrato ? { ...base, contrato_id: s.contrato } : null;
  if (s.tipo === 'VACACION') return s.vacacion ? { ...base, vacacion_id: s.vacacion } : null;
  return null;
}

/** Dónde se crea el documento cuando todavía no existe. */
function rutaCrear(s: SolicitudDocumentoPanel): { a: string; texto: string } | null {
  if (s.tipo === 'LIQUIDACION' && !s.liquidacion) {
    return s.mes && s.anio ? { a: rutaLiquidacion(s.empleado.id, s.mes, s.anio), texto: 'Emitir liquidación' } : null;
  }
  if (s.tipo === 'CONTRATO' && !s.contrato) return { a: `/app/trabajadores/${s.empleado.id}/contrato`, texto: 'Crear contrato' };
  if (s.tipo === 'FINIQUITO') return { a: `/app/trabajadores/${s.empleado.id}/finiquito`, texto: 'Preparar finiquito' };
  return null;
}

export default function Solicitudes() {
  const { empresa, avisar } = usePanelContexto();
  const queryClient = useQueryClient();
  // Atender una solicitud es gestionarla; crear o enviar el documento pide además su módulo.
  const { puede } = usePermisos();
  const gestionar = puede('SOLICITUDES', true);
  const solicitudes = useSolicitudesDocumento(empresa.id);
  const [filtro, setFiltro] = useState<EstadoSolicitudDocumento | 'todas'>('PENDIENTE');
  const [ocupada, setOcupada] = useState<number | null>(null);
  const [descartar, setDescartar] = useState<SolicitudDocumentoPanel | null>(null);

  const todas = solicitudes.data ?? [];
  const visibles = todas.filter((s) => filtro === 'todas' || s.estado === filtro);
  const conteo = (f: typeof filtro) => todas.filter((s) => f === 'todas' || s.estado === f).length;

  const accion = async (s: SolicitudDocumentoPanel, fn: () => Promise<unknown>, ok: string) => {
    setOcupada(s.id);
    try {
      const r = await fn();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['solicitudes-documento'] }),
        queryClient.invalidateQueries({ queryKey: ['firmas'] }),
      ]);
      if (correoFallo((r as { data?: unknown } | undefined)?.data)) avisar(CORREO_NO_ENVIADO, 'error');
      else avisar(ok);
    } catch (err) {
      avisar(mensaje(err, 'No pudimos completar la acción.'), 'error');
    } finally {
      setOcupada(null);
    }
  };

  return (
    <div className="flex flex-col gap-[18px] max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Solicitudes</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">
          Documentos que tus trabajadores pidieron desde su portal. Al enviarlos a firma se resuelven solos y el trabajador recibe el correo.
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por estado">
        {FILTROS.map(([f, t]) => (
          <button key={f} type="button" onClick={() => setFiltro(f)} aria-pressed={filtro === f}
            className={cn('inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium whitespace-nowrap',
              filtro === f ? 'bg-brand-soft border-brand text-brand-text' : 'bg-surface border-line text-fg-2 hover:text-fg')}>
            {t}<span className="text-[11px] opacity-70 j40-num">{conteo(f)}</span>
          </button>
        ))}
      </div>

      <section className="bg-surface border border-line rounded-j40-card shadow-card" aria-label="Solicitudes">
        {solicitudes.isLoading && <p className="px-[18px] py-6 text-[13px] text-fg-3" role="status">Cargando…</p>}
        {solicitudes.isError && <p className="px-[18px] py-6 text-[13px] text-danger" role="alert">No pudimos cargar las solicitudes.</p>}
        {solicitudes.isSuccess && !visibles.length && (
          <p className="px-[18px] py-6 text-[13px] text-fg-3">
            {filtro === 'PENDIENTE' ? 'No hay solicitudes por atender.' : 'No hay solicitudes en este estado.'}
          </p>
        )}
        {visibles.map((s) => {
          const e = ESTADO[s.estado];
          const pendiente = s.estado === 'PENDIENTE';
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-[18px] py-3.5 border-b border-line last:border-b-0">
              <div className="flex-1 min-w-[240px] flex flex-col gap-0.5">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium">{titulo(s)}</span>
                  <Chip tono={e.tono}>{e.texto}</Chip>
                </span>
                <span className="text-[12.5px] text-fg-2">
                  <Link to={`/app/trabajadores/${s.empleado.id}`} className="text-fg-2">{capitalizar(s.empleado.nombre)}</Link>
                  {' · '}{s.empleado.email || 'sin correo'}
                </span>
                <span className="text-[11.5px] text-fg-3">
                  Pedida el {fechaCL(s.creada_en)}
                  {s.resuelta_en ? ` · ${s.estado === 'RESUELTA' ? 'resuelta' : 'descartada'} el ${fechaCL(s.resuelta_en)}` : ''}
                </span>
                {s.estado === 'DESCARTADA' && s.motivo_texto && <span className="text-[12.5px] text-fg-2">Motivo: {s.motivo_texto}</span>}
              </div>
              {pendiente && gestionar && (() => {
                const deModulo = puede(moduloDeTipo(s.tipo), true);
                const envio = deModulo ? envioAFirma(s) : null;
                const crear = deModulo ? rutaCrear(s) : null;
                return (
                  <div className="flex gap-2 flex-wrap">
                    {crear && (
                      <Link to={crear.a} className={BOTON_ENLACE}>
                        <FilePlus2 className="size-4" strokeWidth={2} aria-hidden />{crear.texto}
                      </Link>
                    )}
                    {envio && (
                      <Button tamano="sm" cargando={ocupada === s.id} iconoInicio={<Send className="size-4" strokeWidth={2} />}
                        onClick={() => accion(s, () => client.post('/firmas/solicitar/', envio),
                          'Documento enviado a firma: el trabajador recibe el correo')}>
                        Enviar a firma
                      </Button>
                    )}
                    <Button variante="secundario" tamano="sm" disabled={ocupada === s.id} onClick={() => setDescartar(s)}
                      iconoInicio={<X className="size-4" strokeWidth={2} />}>Descartar</Button>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </section>

      {descartar && (
        <ModalDescartar solicitud={descartar} onCerrar={() => setDescartar(null)}
          onDescartada={async () => {
            setDescartar(null);
            await queryClient.invalidateQueries({ queryKey: ['solicitudes-documento'] });
            avisar('Solicitud descartada: el trabajador ve el motivo en su portal');
          }} />
      )}
    </div>
  );
}

function ModalDescartar({ solicitud, onCerrar, onDescartada }: {
  solicitud: SolicitudDocumentoPanel; onCerrar: () => void; onDescartada: () => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (!motivo) return setError('Elige el motivo: el trabajador lo verá en su portal.');
    setEnviando(true);
    setError('');
    try {
      await client.post(`/solicitudes-documento/${solicitud.id}/descartar/`, { motivo });
      await onDescartada();
    } catch (err) {
      setError(mensaje(err, 'No pudimos descartar la solicitud.'));
      setEnviando(false);
    }
  };

  return (
    <Modal abierto onCerrar={() => !enviando && onCerrar()} titulo="Descartar solicitud"
      subtitulo={`${titulo(solicitud)} · ${capitalizar(solicitud.empleado.nombre)}`}
      acciones={(
        <>
          <Button variante="secundario" onClick={onCerrar} disabled={enviando}>Volver</Button>
          <Button variante="peligro" cargando={enviando} onClick={() => void confirmar()}>Descartar</Button>
        </>
      )}>
      <div className="flex flex-col gap-3">
        {error && <AlertaError>{error}</AlertaError>}
        <Field etiqueta="Motivo (lo verá el trabajador)">
          {(p) => (
            <select {...p} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
              className="h-10 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft">
              <option value="">Elige un motivo</option>
              {solicitud.motivos.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
            </select>
          )}
        </Field>
      </div>
    </Modal>
  );
}
