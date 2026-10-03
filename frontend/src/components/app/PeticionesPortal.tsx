import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Check, X } from 'lucide-react';
import client from '../../api/client';
import { usePeticionesPanel } from '../../hooks/usePanel';
import { usePermisos } from '../../hooks/usePermisos';
import type { OpcionCatalogo } from '../../types';
import { CORREO_NO_ENVIADO, correoFallo } from '../../utils/correo';
import { capitalizar, fechaCL } from '../../utils/formato';
import { AlertaError, Button, Modal } from '../j40';

/**
 * Lo que los trabajadores pidieron desde su portal (core/views/peticiones_portal.py):
 * vacaciones y permisos se aprueban o rechazan aquí; la conciliación (Ley 21.645)
 * se responde en la ficha, con su motivo y fundamento.
 */
const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;
const CONTROL = 'h-10 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';
type Rechazo = { tipo: 'vacacion' | 'permiso'; id: number; nombre: string; motivos: OpcionCatalogo[] };

export function PeticionesPortal({ empresaId, avisar }: { empresaId: number; avisar: (t: string, tipo?: 'ok' | 'error') => void }) {
  const queryClient = useQueryClient();
  const { puede } = usePermisos();
  const vacaciones = puede('VACACIONES', true);
  const peticiones = usePeticionesPanel(empresaId, puede(['VACACIONES', 'TRABAJADORES']));
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [rechazo, setRechazo] = useState<Rechazo | null>(null);
  const [firmar, setFirmar] = useState<{ empleado: number; documento: number; nombre: string } | null>(null);
  const d = peticiones.data;
  const total = d ? d.vacaciones.length + d.permisos.length + d.conciliacion.length : 0;

  const refrescar = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['peticiones-portal'] }),
    queryClient.invalidateQueries({ queryKey: ['vacaciones'] }),
    queryClient.invalidateQueries({ queryKey: ['carpeta'] }),
  ]);

  const aprobarVacacion = async (id: number) => {
    setOcupada(`v${id}`);
    try {
      await client.post(`/vacaciones/${id}/responder/`, { aprobar: true });
      await refrescar();
      avisar('Aprobada. El trabajador recibió la respuesta por correo; el comprobante está en su carpeta.');
    } catch (err) {
      avisar(mensaje(err, 'No pudimos aprobarla.'), 'error');
    } finally {
      setOcupada(null);
    }
  };

  const aprobarPermiso = async (id: number, nombre: string, empleado: number) => {
    setOcupada(`p${id}`);
    try {
      const { data } = await client.post<{ documento: number }>(`/solicitudes-permiso/${id}/responder/`, { aprobar: true });
      await refrescar();
      setFirmar({ empleado, documento: data.documento, nombre });
    } catch (err) {
      avisar(mensaje(err, 'No pudimos aprobarlo.'), 'error');
    } finally {
      setOcupada(null);
    }
  };

  const enviarAFirma = async () => {
    if (!firmar) return;
    setOcupada('firma');
    try {
      const { data } = await client.post('/firmas/solicitar/', {
        empleado_id: firmar.empleado, tipo_documento: 'PERMISO_LEGAL', documento_laboral_id: firmar.documento });
      await queryClient.invalidateQueries({ queryKey: ['firmas'] });
      avisar(correoFallo(data) ? CORREO_NO_ENVIADO : 'Constancia enviada a firma.', correoFallo(data) ? 'error' : 'ok');
      setFirmar(null);
    } catch (err) {
      avisar(mensaje(err, 'No pudimos enviarla a firma.'), 'error');
    } finally {
      setOcupada(null);
    }
  };

  if (!d || total === 0) return null;
  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card" aria-label="Vacaciones, permisos y conciliación">
      <div className="px-[18px] py-3.5 border-b border-line">
        <h2 className="text-[15px] font-semibold">Vacaciones, permisos y conciliación por responder</h2>
        <p className="text-[12.5px] text-fg-3">Los pidieron desde su portal. Al responder, el trabajador recibe un correo.</p>
      </div>
      {d.vacaciones.map((v) => (
        <Fila key={`v${v.id}`} nombre={v.empleado.nombre} empleado={v.empleado.id} titulo={v.tipo_texto}
          detalle={`${fechaCL(v.desde)} al ${fechaCL(v.hasta)} · ${v.dias} ${v.dias === 1 ? 'día' : 'días'} · pedida el ${fechaCL(v.pedida_en)}`}>
          {vacaciones && (
            <>
              <Button tamano="sm" cargando={ocupada === `v${v.id}`} onClick={() => void aprobarVacacion(v.id)}
                iconoInicio={<Check className="size-4" strokeWidth={2} />}>Aprobar</Button>
              <Button tamano="sm" variante="secundario" disabled={ocupada !== null}
                onClick={() => setRechazo({ tipo: 'vacacion', id: v.id, nombre: v.empleado.nombre, motivos: d.motivos_vacacion })}
                iconoInicio={<X className="size-4" strokeWidth={2} />}>Rechazar</Button>
            </>
          )}
        </Fila>
      ))}
      {d.permisos.map((p) => (
        <Fila key={`p${p.id}`} nombre={p.empleado.nombre} empleado={p.empleado.id} titulo={`Permiso: ${p.permiso_texto}`}
          detalle={`Hecho el ${fechaCL(p.fecha_hecho)}${p.inicio ? ` · desde el ${fechaCL(p.inicio)}` : ''} · pedido el ${fechaCL(p.pedida_en)}`}>
          {vacaciones && (
            <>
              <Button tamano="sm" cargando={ocupada === `p${p.id}`} onClick={() => void aprobarPermiso(p.id, p.empleado.nombre, p.empleado.id)}
                iconoInicio={<Check className="size-4" strokeWidth={2} />}>Aprobar</Button>
              <Button tamano="sm" variante="secundario" disabled={ocupada !== null}
                onClick={() => setRechazo({ tipo: 'permiso', id: p.id, nombre: p.empleado.nombre, motivos: d.motivos_permiso })}
                iconoInicio={<X className="size-4" strokeWidth={2} />}>Rechazar</Button>
            </>
          )}
        </Fila>
      ))}
      {d.conciliacion.map((c) => (
        <Fila key={`c${c.id}`} nombre={c.empleado.nombre} empleado={c.empleado.id} titulo={`${c.tipo_texto} (Ley 21.645)`}
          detalle={`Pedida el ${fechaCL(c.presentada_el)} · responder a más tardar el ${fechaCL(c.vence_el)}`
            + (c.cuidado_declarado ? ` · declara cuidar a: ${c.cuidado_declarado.toLowerCase()}` : '')}>
          <Link to={`/app/trabajadores/${c.empleado.id}?tab=personal`}
            className="inline-flex items-center h-9 px-3.5 rounded-[8px] border border-line-strong bg-surface text-fg text-[13px] font-medium no-underline hover:no-underline hover:border-brand">
            Responder en su ficha
          </Link>
        </Fila>
      ))}
      {rechazo && <ModalRechazo rechazo={rechazo} onCerrar={() => setRechazo(null)}
        onListo={async () => { await refrescar(); setRechazo(null); avisar('Respuesta enviada al trabajador.'); }} />}
      <Modal abierto={Boolean(firmar)} onCerrar={() => setFirmar(null)} titulo="Permiso aprobado"
        acciones={<><Button variante="secundario" onClick={() => setFirmar(null)}>Después</Button>
          <Button onClick={() => void enviarAFirma()} cargando={ocupada === 'firma'}>Enviar constancia a firma</Button></>}>
        <p className="text-[14.5px] text-fg-2">
          Se creó la constancia del permiso de {capitalizar(firmar?.nombre ?? '')}. Envíala a firma ahora o después desde su carpeta, en Documentos.
        </p>
      </Modal>
    </section>
  );
}

function Fila({ nombre, empleado, titulo, detalle, children }: {
  nombre: string; empleado: number; titulo: string; detalle: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-[18px] py-3.5 border-b border-line last:border-b-0">
      <div className="flex-1 min-w-[240px] flex flex-col gap-0.5">
        <span className="text-[14px] font-medium">{titulo}</span>
        <span className="text-[12.5px] text-fg-2"><Link to={`/app/trabajadores/${empleado}`} className="text-fg-2">{capitalizar(nombre)}</Link></span>
        <span className="text-[11.5px] text-fg-3">{detalle}</span>
      </div>
      <div className="flex gap-2 flex-wrap">{children}</div>
    </div>
  );
}

function ModalRechazo({ rechazo, onCerrar, onListo }: { rechazo: Rechazo; onCerrar: () => void; onListo: () => Promise<void> }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviar = async () => {
    setEnviando(true);
    setError('');
    try {
      const ruta = rechazo.tipo === 'vacacion' ? `/vacaciones/${rechazo.id}/responder/` : `/solicitudes-permiso/${rechazo.id}/responder/`;
      await client.post(ruta, { aprobar: false, motivo });
      await onListo();
    } catch (err) {
      setError(mensaje(err, 'No pudimos enviar la respuesta.'));
      setEnviando(false);
    }
  };
  return (
    <Modal abierto onCerrar={onCerrar} titulo="Rechazar solicitud" subtitulo={capitalizar(rechazo.nombre)}
      acciones={<><Button variante="secundario" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
        <Button onClick={() => void enviar()} cargando={enviando} disabled={!motivo}>Rechazar</Button></>}>
      <div className="flex flex-col gap-3.5">
        {error && <AlertaError>{error}</AlertaError>}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-2">Motivo (lo verá el trabajador)</span>
          <select className={CONTROL} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="">Elige el motivo…</option>
            {rechazo.motivos.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
          </select>
        </label>
      </div>
    </Modal>
  );
}
