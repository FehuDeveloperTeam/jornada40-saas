import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { LucideIcon } from 'lucide-react';
import { BadgeCheck, Clock, Download, FileSignature, HandCoins, House, Landmark, Send, FileText, FileWarning, HardHat, Lock, ScrollText, ShieldAlert, TriangleAlert, UserX } from 'lucide-react';
import { AlertaError, Button, Chip, Field, Input, Modal } from '../../j40';
import client from '../../../api/client';
import { descargar } from '../../../api/descargas';
import { rutaAccion } from '../../../hooks/usePanel';
import { usePermisos } from '../../../hooks/usePermisos';
import type { CertificadoEmitido, Empleado, ModuloPanel, OpcionesDocumentoLaboral, OpcionSimple } from '../../../types';
import { moduloDeTipo } from '../../../utils/moduloDocumento';
import { ChipFirma, Seccion } from './comun';
import { fechaCL, hoyISO } from '../../../utils/formato';
import type { DocumentoReciente } from './documentos';

interface Plantilla {
  titulo: string; detalle: string; Icono: LucideIcon; nivel: number; ruta: (id: number) => string; requiereContrato?: boolean;
  /** Módulo que hay que gestionar para crearlo. */
  modulo: ModuloPanel;
}

const PLANTILLAS: Plantilla[] = [
  { titulo: 'Anexo de contrato', detalle: 'Cambios de jornada, sueldo o funciones', Icono: FileSignature, nivel: 1, ruta: (id) => rutaAccion(id, 'anexo'), requiereContrato: true, modulo: 'CONTRATOS' },
  { titulo: 'Amonestación', detalle: 'Carta por incumplimiento', Icono: FileWarning, nivel: 1, ruta: (id) => rutaAccion(id, 'documento', 'AMONESTACION'), modulo: 'DOCUMENTOS' },
  { titulo: 'Constancia laboral', detalle: 'Registro de hechos', Icono: ScrollText, nivel: 1, ruta: (id) => rutaAccion(id, 'documento', 'CONSTANCIA'), modulo: 'DOCUMENTOS' },
  { titulo: 'Carta de término', detalle: 'Despido con causal legal', Icono: UserX, nivel: 2, ruta: (id) => rutaAccion(id, 'documento', 'DESPIDO'), modulo: 'TERMINO' },
  { titulo: 'Finiquito', detalle: 'Cálculo y documento', Icono: FileText, nivel: 2, ruta: (id) => `/app/trabajadores/${id}/finiquito`, modulo: 'TERMINO' },
  { titulo: 'Pacto de horas extra', detalle: 'Art. 32, hasta 3 meses', Icono: Clock, nivel: 2, ruta: (id) => rutaLaboral(id, 'HORAS_EXTRA'), requiereContrato: true, modulo: 'DOCUMENTOS' },
  { titulo: 'Pacto de teletrabajo', detalle: 'Anexo Ley 21.220', Icono: House, nivel: 2, ruta: (id) => rutaLaboral(id, 'TELETRABAJO'), requiereContrato: true, modulo: 'CONTRATOS' },
  { titulo: 'Autorización de descuento', detalle: 'Art. 58, tope 15 %', Icono: HandCoins, nivel: 2, ruta: (id) => rutaLaboral(id, 'DESCUENTO'), modulo: 'DOCUMENTOS' },
  { titulo: 'Permiso legal con goce', detalle: 'Fallecimiento, nacimiento, matrimonio', Icono: ScrollText, nivel: 2, ruta: (id) => rutaLaboral(id, 'PERMISO_LEGAL'), modulo: 'VACACIONES' },
  { titulo: 'Entrega de EPP', detalle: 'Elementos de protección, sin costo', Icono: HardHat, nivel: 1, ruta: (id) => rutaLaboral(id, 'ENTREGA_EPP'), modulo: 'SEGURIDAD' },
  { titulo: 'Información de riesgos', detalle: 'DS 44, al ingresar o cambiar de puesto', Icono: ShieldAlert, nivel: 3, ruta: (id) => rutaLaboral(id, 'INFORMACION_RIESGOS'), modulo: 'SEGURIDAD' },
  { titulo: 'Indemnización a todo evento', detalle: 'Art. 164, desde el año 7', Icono: Landmark, nivel: 2, ruta: (id) => rutaLaboral(id, 'INDEMNIZACION'), modulo: 'DOCUMENTOS' },
];

function rutaLaboral(id: number, tipo: string) {
  return `/app/trabajadores/${id}?tab=documentos&accion=laboral&tipo=${tipo}`;
}

export function DocumentosTab({ empleado, documentos, nivel, cargandoPlan, avisar }: {
  empleado: Empleado; documentos: DocumentoReciente[]; nivel: number; cargandoPlan?: boolean; avisar: (t: string) => void;
}) {
  const queryClient = useQueryClient();
  const { puede } = usePermisos();
  // Cada documento se gestiona en el módulo de su tipo; quien solo ve no crea ni envía.
  const plantillas = PLANTILLAS.filter((x) => (!x.requiereContrato || empleado.contrato_activo) && puede(x.modulo, true));
  const [enviando, setEnviando] = useState<string | null>(null);
  const [revocar, setRevocar] = useState<DocumentoReciente | null>(null);
  const [fechaRevocacion, setFechaRevocacion] = useState(hoyISO());
  const [errorRevocacion, setErrorRevocacion] = useState('');
  const [revocando, setRevocando] = useState(false);
  // Avisos de respaldo (p. ej. teletrabajo sin pacto firmado o por vencer): misma consulta que el formulario.
  const opciones = useQuery({
    queryKey: ['documentos-laborales', 'opciones', empleado.id],
    queryFn: async () => (await client.get<OpcionesDocumentoLaboral>(`/documentos-laborales/opciones/?empleado=${empleado.id}`)).data,
    enabled: nivel >= 1,
  });

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

  const confirmarRevocacion = async () => {
    if (!revocar?.revocable) return;
    setRevocando(true);
    setErrorRevocacion('');
    try {
      await client.post(`/documentos-laborales/${revocar.revocable}/revocar/`, { fecha: fechaRevocacion });
      await queryClient.invalidateQueries({ queryKey: ['documentos-laborales', empleado.id] });
      avisar('Revocación registrada: el descuento deja de aplicarse. Envía a firma la constancia de revocación.');
      setRevocar(null);
    } catch (err) {
      setErrorRevocacion((isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || 'No pudimos registrar la revocación.');
    } finally {
      setRevocando(false);
    }
  };

  const pdf = async (d: DocumentoReciente) => {
    if (!d.pdf) return;
    const error = await descargar(d.pdf.url, d.pdf.nombre);
    if (error) avisar(error);
  };

  return (
    <div className="flex flex-col gap-5">
      {(opciones.data?.avisos ?? []).map((a) => (
        <p key={a} role="status" className="flex gap-2 items-start rounded-j40-card bg-warn-soft text-warn px-4 py-3 text-[13px]">
          <TriangleAlert className="size-[18px] shrink-0 mt-0.5" strokeWidth={2} aria-hidden />{a}
        </p>
      ))}
      {plantillas.length > 0 && (
        <Seccion titulo="Generar documento">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2.5 p-[18px]">
            {plantillas.map(({ titulo, detalle, Icono, nivel: requerido, ruta }) => {
              // Mientras se lee el plan no se muestran candados que luego desaparecen.
              const bloqueado = !cargandoPlan && nivel < requerido;
              return (
                <Link key={titulo} to={bloqueado ? '/app/plan' : ruta(empleado.id)}
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
      )}

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
            {d.revocadoEn && <Chip tono="neutro">Revocada el {fechaCL(d.revocadoEn)}</Chip>}
            {d.revocable && d.firma?.estado === 'FIRMADO' && puede('DOCUMENTOS', true) && (
              <Button variante="secundario" tamano="sm" onClick={() => { setRevocar(d); setFechaRevocacion(hoyISO()); setErrorRevocacion(''); }}>
                Registrar revocación
              </Button>
            )}
            {d.envio && (!d.firma || ['RECHAZADO', 'EXPIRADO', 'CANCELADO'].includes(d.firma.estado)) && puede(moduloDeTipo(d.envio.tipo_documento), true) && (
              <Button variante="secundario" tamano="sm" onClick={() => enviarAFirma(d)} cargando={enviando === d.clave}
                disabled={enviando !== null} iconoInicio={<Send className="size-4" strokeWidth={2} />}>
                {d.firma ? 'Reenviar a firma' : 'Enviar a firma'}
              </Button>
            )}
            {d.pdf && (
              <Button variante="fantasma" tamano="sm" onClick={() => pdf(d)}
                aria-label={`Descargar ${d.titulo}${d.firma?.estado === 'FIRMADO' ? ' firmado' : ''}`}
                title={d.firma?.estado === 'FIRMADO' ? 'Descarga la versión firmada por el trabajador' : undefined}
                iconoInicio={<Download className="size-4" strokeWidth={2} />}>{d.firma?.estado === 'FIRMADO' ? 'PDF firmado' : 'PDF'}</Button>
            )}
          </div>
        ))}
      </Seccion>

      <CertificadosEmitidos empleadoId={empleado.id} avisar={avisar} />

      <Modal abierto={Boolean(revocar)} onCerrar={() => !revocando && setRevocar(null)} titulo="Revocación de la autorización de descuento"
        subtitulo={revocar?.titulo}
        acciones={<>
          <Button variante="secundario" onClick={() => setRevocar(null)} disabled={revocando}>Volver</Button>
          <Button cargando={revocando} onClick={() => void confirmarRevocacion()}>Registrar revocación</Button>
        </>}>
        <div className="flex flex-col gap-3">
          {errorRevocacion && <AlertaError>{errorRevocacion}</AlertaError>}
          <p className="text-[13.5px] text-fg-2 leading-relaxed">
            El trabajador puede dejar sin efecto por escrito su autorización (Art. 58). Desde esa fecha el descuento no se aplica;
            si debe dinero, se paga por otra vía. Se genera una constancia de revocación para que la firme.
          </p>
          <Field etiqueta="Fecha en que el trabajador la revocó">
            {(p) => <Input {...p} type="date" max={hoyISO()} value={fechaRevocacion} onChange={(e) => setFechaRevocacion(e.target.value)} />}
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/** Certificados que el trabajador generó desde su portal (solo lectura). */
function CertificadosEmitidos({ empleadoId, avisar }: { empleadoId: number; avisar: (t: string) => void }) {
  const queryClient = useQueryClient();
  const [anular, setAnular] = useState<CertificadoEmitido | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [anulando, setAnulando] = useState(false);
  const gestionar = usePermisos().puede('TRABAJADORES', true);
  const { data = [] } = useQuery({
    queryKey: ['certificados', empleadoId],
    queryFn: async () => (await client.get<CertificadoEmitido[]>(`/empleados/${empleadoId}/certificados/`)).data,
  });
  const motivos = useQuery({
    queryKey: ['certificados', 'motivos-anulacion'],
    queryFn: async () => (await client.get<OpcionSimple[]>('/certificados/motivos-anulacion/')).data,
    enabled: Boolean(anular),
    staleTime: Infinity,
  });
  if (!data.length) return null;
  const fecha = (iso: string) => new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const cerrar = () => { if (!anulando) { setAnular(null); setMotivo(''); setError(''); } };
  const confirmar = async () => {
    if (!anular) return;
    if (!motivo) { setError('Elige el motivo.'); return; }
    setAnulando(true);
    try {
      await client.post(`/certificados/${anular.id}/anular/`, { motivo });
      await queryClient.invalidateQueries({ queryKey: ['certificados', empleadoId] });
      avisar(`Certificado ${anular.folio} anulado. Su verificación pública ahora lo informa como no válido.`);
      setAnulando(false);
      setAnular(null); setMotivo(''); setError('');
    } catch (err) {
      setError((isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || 'No pudimos anular el certificado.');
      setAnulando(false);
    }
  };
  return (
    <Seccion titulo="Certificados emitidos por el trabajador"
      accion={<span className="text-[12.5px] text-fg-3">Desde su portal</span>}>
      {data.map((c) => (
        <div key={c.id} className="flex flex-wrap gap-x-3 gap-y-2 items-center px-[18px] py-3 border-b border-line last:border-b-0">
          <BadgeCheck className="size-[19px] text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
          <div className="flex-1 min-w-[180px] flex flex-col">
            <span className="text-[13px]">{c.titulo}{c.opcion_texto ? ` · ${c.opcion_texto.toLowerCase()}` : ''}</span>
            <span className="text-[11.5px] text-fg-3 j40-num">{c.folio} · {fecha(c.emitido_en)} · código <span className="j40-mono">{c.codigo}</span></span>
            {c.anulado_en && <span className="text-[11.5px] text-danger">Anulado el {fecha(c.anulado_en)}: {c.motivo_anulacion.toLowerCase()}</span>}
          </div>
          {c.anulado_en ? <Chip tono="peligro">Anulado</Chip> : gestionar && (
            <Button variante="secundario" tamano="sm" onClick={() => setAnular(c)} aria-label={`Anular ${c.titulo} ${c.folio}`}>Anular</Button>
          )}
          <Button variante="fantasma" tamano="sm" aria-label={`Descargar ${c.titulo} ${c.folio}`}
            onClick={async () => { const error = await descargar(`/certificados/${c.id}/pdf/`, `${c.folio}.pdf`); if (error) avisar(error); }}
            iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>
        </div>
      ))}
      <Modal abierto={Boolean(anular)} onCerrar={cerrar} titulo="Anular certificado"
        subtitulo={anular ? `${anular.titulo} · ${anular.folio}` : undefined}
        acciones={<>
          <Button variante="secundario" onClick={cerrar} disabled={anulando}>Volver</Button>
          <Button variante="peligro" cargando={anulando} onClick={() => void confirmar()}>Anular</Button>
        </>}>
        <div className="flex flex-col gap-3">
          {error && <AlertaError>{error}</AlertaError>}
          <p className="text-[13px] text-fg-2">
            Quien verifique el código verá que el certificado no es válido. El trabajador puede emitir uno nuevo con los datos corregidos.
          </p>
          <Field etiqueta="Motivo">
            {(p) => (
              <select {...p} value={motivo} onChange={(e) => { setMotivo(e.target.value); setError(''); }}
                className="h-10 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft">
                <option value="">Elige un motivo</option>
                {(motivos.data ?? []).map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
              </select>
            )}
          </Field>
        </div>
      </Modal>
    </Seccion>
  );
}
