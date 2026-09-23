import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Download, Mail, PenLine, RotateCcw, Search, Send, TriangleAlert, X } from 'lucide-react';
import { Button, Chip, Modal } from '../../components/j40';
import { FirmaEmpleador } from '../../components/app/FirmaEmpleador';
import type { TonoChip } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import client from '../../api/client';
import { useFirmas } from '../../hooks/usePanel';
import type { SolicitudFirma } from '../../types';
import { cn } from '../../utils/cn';
import { capitalizar, fechaCL } from '../../utils/formato';

type Estado = SolicitudFirma['estado'];
type Filtro = 'todas' | Estado;

const ESTADO: Record<Estado, { texto: string; tono: TonoChip }> = {
  PENDIENTE: { texto: 'Pendiente', tono: 'aviso' },
  FIRMADO: { texto: 'Firmado', tono: 'ok' },
  RECHAZADO: { texto: 'Rechazado', tono: 'peligro' },
  EXPIRADO: { texto: 'Expirado', tono: 'neutro' },
  CANCELADO: { texto: 'Cancelado', tono: 'neutro' },
};
const FILTROS: [Filtro, string][] = [
  ['todas', 'Todas'], ['PENDIENTE', 'Pendientes'], ['FIRMADO', 'Firmadas'], ['RECHAZADO', 'Rechazadas'], ['EXPIRADO', 'Expiradas'], ['CANCELADO', 'Canceladas'],
];
const DOCUMENTO: Record<SolicitudFirma['tipo_documento'], string> = {
  CONTRATO: 'Contrato de trabajo', ANEXO_40H: 'Anexo Ley 40 horas', AMONESTACION: 'Carta de amonestación',
  DESPIDO: 'Carta de término', CONSTANCIA: 'Constancia laboral', ANEXO_CONTRATO: 'Anexo de contrato',
  LIQUIDACION: 'Liquidación de sueldo', VACACION: 'Comprobante de vacaciones', FINIQUITO: 'Finiquito',
};

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

/** Solicitud nueva para el mismo documento (tras un rechazo, vencimiento o cancelación). */
const datosReenvio = (f: SolicitudFirma) => ({
  empleado_id: f.empleado, tipo_documento: f.tipo_documento, contrato_id: f.contrato, documento_legal_id: f.documento_legal,
  anexo_contrato_id: f.anexo_contrato, liquidacion_id: f.liquidacion, vacacion_id: f.vacacion, finiquito_id: f.finiquito,
});

export default function Firmas() {
  const { empresa, avisar } = usePanelContexto();
  const queryClient = useQueryClient();
  const firmas = useFirmas();
  const [filtro, setFiltro] = useState<Filtro>('PENDIENTE');
  const [busqueda, setBusqueda] = useState('');
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [cancelar, setCancelar] = useState<SolicitudFirma | null>(null);
  const [configurar, setConfigurar] = useState(false);

  const deEmpresa = (firmas.data ?? []).filter((f) => f.empresa === empresa.id);
  const conteo = (f: Filtro) => deEmpresa.filter((x) => f === 'todas' || x.estado === f).length;
  const texto = busqueda.trim().toLowerCase();
  const visibles = deEmpresa
    .filter((f) => filtro === 'todas' || f.estado === filtro)
    .filter((f) => !texto || f.empleado_nombre.toLowerCase().includes(texto) || DOCUMENTO[f.tipo_documento].toLowerCase().includes(texto));

  const accion = async (clave: string, fn: () => Promise<unknown>, ok: string) => {
    setOcupada(clave);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ['firmas'] });
      avisar(ok);
    } catch (err) {
      avisar(mensaje(err, 'No pudimos completar la acción.'));
    } finally {
      setOcupada(null);
    }
  };

  const descargar = (f: SolicitudFirma) => accion(`d${f.id}`, async () => {
    // El backend entrega un enlace temporal al PDF firmado guardado.
    const { data } = await client.post<{ url: string }>(`/firmas/${f.id}/descargar/`);
    window.open(data.url, '_blank', 'noopener');
  }, 'Abriendo el PDF firmado');

  return (
    <div className="flex flex-col gap-[18px] max-w-[1440px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Firma electrónica</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">Documentos enviados a firmar por correo · firma electrónica simple (Ley 19.799)</p>
        </div>
        <Button variante="secundario" onClick={() => setConfigurar(true)} iconoInicio={<PenLine className="size-4" strokeWidth={2} />}>
          Firma del empleador
        </Button>
      </div>

      {!empresa.firma_configurada && (
        <div className="flex flex-wrap items-center gap-3 rounded-j40-card bg-warn-soft text-warn px-4 py-3">
          <TriangleAlert className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          <p className="flex-1 min-w-[220px] text-[13px]">
            <strong className="font-semibold">Falta la firma del empleador.</strong> Sin ella, los documentos firmados muestran
            "Sin firma registrada" en la parte del empleador.
          </p>
          <Button tamano="sm" onClick={() => setConfigurar(true)}>Configurar ahora</Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por estado">
          {FILTROS.map(([f, t]) => (
            <button key={f} type="button" onClick={() => setFiltro(f)} aria-pressed={filtro === f}
              className={cn('inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium whitespace-nowrap',
                filtro === f ? 'bg-brand-soft border-brand text-brand-text' : 'bg-surface border-line text-fg-2 hover:text-fg')}>
              {t}<span className="text-[11px] opacity-70 j40-num">{conteo(f)}</span>
            </button>
          ))}
        </div>
        <label className="relative flex-1 min-w-[220px]">
          <span className="sr-only">Buscar</span>
          <Search className="size-4 absolute left-3 top-3 text-fg-3 pointer-events-none" strokeWidth={2} aria-hidden />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por trabajador o documento"
            className="w-full h-10 pl-9 pr-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[13.5px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft" />
        </label>
      </div>

      <section className="bg-surface border border-line rounded-j40-card shadow-card">
        {visibles.map((f) => {
          const e = ESTADO[f.estado] ?? ESTADO.CANCELADO;
          const cargando = (k: string) => ocupada === `${k}${f.id}`;
          return (
            <div key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-[18px] py-3.5 border-b border-line last:border-b-0">
              <div className="flex-1 min-w-[240px] flex flex-col gap-0.5">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium">{DOCUMENTO[f.tipo_documento]}</span>
                  <Chip tono={e.tono}>{e.texto}</Chip>
                  {f.folio && <span className="text-[11.5px] text-fg-3 j40-mono">{f.folio}</span>}
                </span>
                <span className="text-[12.5px] text-fg-2">
                  <Link to={`/app/trabajadores/${f.empleado}?tab=documentos`} className="text-fg-2">{capitalizar(f.empleado_nombre)}</Link>
                  {' · '}{f.email_firmante || 'sin correo'}
                </span>
                <span className="text-[11.5px] text-fg-3">
                  Enviado el {fechaCL(f.enviado_en)}
                  {f.estado === 'FIRMADO' && f.firmado_en ? ` · firmado el ${fechaCL(f.firmado_en)}` : ''}
                  {f.estado === 'PENDIENTE' ? ` · vence el ${fechaCL(f.expira_en)}` : ''}
                </span>
                {f.estado === 'RECHAZADO' && f.motivo_rechazo && (
                  <span className="text-[12.5px] text-danger">Motivo: {f.motivo_rechazo}</span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {f.estado === 'PENDIENTE' && (
                  <>
                    <Button variante="secundario" tamano="sm" cargando={cargando('r')} iconoInicio={<Mail className="size-4" strokeWidth={2} />}
                      onClick={() => accion(`r${f.id}`, () => client.post(`/firmas/${f.id}/reenviar/`), 'Correo de firma reenviado')}>Reenviar correo</Button>
                    <Button variante="peligro-contorno" tamano="sm" iconoInicio={<X className="size-4" strokeWidth={2} />}
                      onClick={() => setCancelar(f)}>Cancelar</Button>
                  </>
                )}
                {f.estado === 'FIRMADO' && (
                  <Button variante="secundario" tamano="sm" cargando={cargando('d')} iconoInicio={<Download className="size-4" strokeWidth={2} />}
                    onClick={() => descargar(f)}>PDF firmado</Button>
                )}
                {(f.estado === 'RECHAZADO' || f.estado === 'EXPIRADO' || f.estado === 'CANCELADO') && (
                  <Button variante="secundario" tamano="sm" cargando={cargando('n')} iconoInicio={f.estado === 'RECHAZADO' ? <RotateCcw className="size-4" strokeWidth={2} /> : <Send className="size-4" strokeWidth={2} />}
                    onClick={() => accion(`n${f.id}`, () => client.post('/firmas/solicitar/', datosReenvio(f)), 'Documento enviado a firma de nuevo')}>
                    Enviar de nuevo
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {!firmas.isLoading && visibles.length === 0 && (
          <p className="px-[18px] py-8 text-center text-[13px] text-fg-3">
            {deEmpresa.length === 0
              ? 'Todavía no envías documentos a firma. Hazlo desde la carpeta del trabajador, en Documentos.'
              : 'Ninguna solicitud coincide con el filtro.'}
          </p>
        )}
      </section>

      <Modal abierto={Boolean(cancelar)} onCerrar={() => setCancelar(null)} titulo="Cancelar la solicitud de firma"
        subtitulo={cancelar ? `${DOCUMENTO[cancelar.tipo_documento]} · ${capitalizar(cancelar.empleado_nombre)}` : undefined}
        acciones={<>
          <Button variante="secundario" onClick={() => setCancelar(null)}>Volver</Button>
          <Button variante="peligro" cargando={Boolean(cancelar) && ocupada === `c${cancelar?.id}`} onClick={async () => {
            const f = cancelar!;
            await accion(`c${f.id}`, () => client.patch(`/firmas/${f.id}/cancelar/`), 'Solicitud cancelada');
            setCancelar(null);
          }}>Cancelar solicitud</Button>
        </>}>
        <p className="text-[13.5px] text-fg-2">El enlace que recibió el trabajador dejará de funcionar. Podrás enviarlo de nuevo cuando quieras.</p>
      </Modal>

      {configurar && <FirmaEmpleador onCerrar={() => setConfigurar(false)} avisar={avisar} />}
    </div>
  );
}
