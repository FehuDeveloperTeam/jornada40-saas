import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ChevronDown, Download, Lock, Mail, PenLine, Send, TriangleAlert, X } from 'lucide-react';
import client from '../../api/client';
import { descargar } from '../../api/descargas';
import { AlertaError, Button, CampoRut, Chip, Field, Input, Modal } from '../j40';
import { useFirmasEmpleador } from '../../hooks/usePanel';
import { MODULOS_DOCUMENTOS, usePermisos } from '../../hooks/usePermisos';
import type { FirmaEmpleadorEmpresa, PedidoFirmaEmpleador } from '../../types';
import { cn } from '../../utils/cn';
import { capitalizar, fechaCL } from '../../utils/formato';
import { esRutDePersona, formatRut, validateRut } from '../../utils/rutUtils';

type Avisar = (texto: string, tipo?: 'ok' | 'error') => void;

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;
const limpio = (rut: string) => rut.replace(/[^0-9kK]/g, '').toUpperCase();
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fecha dd-mm-aaaa que no se corta en dos líneas por sus guiones. */
const Fecha = ({ iso }: { iso: string | null }) => <span className="whitespace-nowrap">{fechaCL(iso)}</span>;

/**
 * Firma del empleador de una empresa: si está registrada y cómo, el pedido a
 * distancia pendiente y sus acciones. Pedir la firma por correo al representante
 * legal es del plan Corporativo y lo puede hacer el titular o un usuario del
 * equipo que gestione algún módulo de documentos (el backend decide).
 * Con `conOtras`, ofrece ver las demás empresas en la misma tarjeta.
 */
export function EstadoFirmaEmpleador({ empresaId, avisar, onDibujar, conOtras = false }: {
  empresaId: number; avisar: Avisar; onDibujar?: () => void; conOtras?: boolean;
}) {
  const { puede } = usePermisos();
  const habilitado = puede(MODULOS_DOCUMENTOS);
  const consulta = useFirmasEmpleador(habilitado);
  const queryClient = useQueryClient();
  const [verTodas, setVerTodas] = useState(false);
  const [pedir, setPedir] = useState<FirmaEmpleadorEmpresa | null>(null);
  const [cancelar, setCancelar] = useState<PedidoFirmaEmpleador | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const datos = consulta.data;
  const fila = datos?.empresas.find((e) => e.id === empresaId);
  if (!habilitado) return null;
  if (!datos || !fila) {
    return consulta.isError
      ? <p className="text-[13px] text-fg-3">No pudimos cargar el estado de la firma del empleador.</p>
      : <p className="text-[13px] text-fg-3" role="status">Cargando la firma del empleador…</p>;
  }
  const otras = datos.empresas.filter((e) => e.id !== empresaId);
  const sinFirma = datos.empresas.filter((e) => !e.firma.configurada).length;

  const accion = async (clave: string, fn: () => Promise<unknown>, ok: string) => {
    setOcupada(clave);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ['firmas-empleador'] });
      avisar(ok);
    } catch (err) {
      avisar(mensaje(err, 'No pudimos completar la acción.'), 'error');
    } finally {
      setOcupada(null);
    }
  };

  const filaProps = {
    permitido: datos.permitido, ocupada, onPedir: setPedir, onCancelar: setCancelar,
    onReenviar: (f: FirmaEmpleadorEmpresa, s: PedidoFirmaEmpleador) => accion(`r${s.id}`,
      () => client.post(`/firmas-empleador/${s.id}/reenviar/`, {}, { params: { empresa: f.id } }),
      `Correo reenviado a ${s.email}`),
    onConstancia: async (f: FirmaEmpleadorEmpresa) => {
      setOcupada(`d${f.id}`);
      const error = await descargar(`/firmas-empleador/${f.firma.solicitud_id}/pdf/?empresa=${f.id}`,
        `Constancia_firma_empleador_${f.firma.folio}.pdf`);
      setOcupada(null);
      if (error) avisar(error, 'error');
    },
  };

  return (
    <div className="flex flex-col gap-3">
      <FilaFirma fila={fila} onDibujar={onDibujar} {...filaProps} />
      {conOtras && otras.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <button type="button" onClick={() => setVerTodas(!verTodas)} aria-expanded={verTodas}
            className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-brand-text">
            <ChevronDown className={cn('size-4 transition-transform', verTodas && 'rotate-180')} strokeWidth={2} aria-hidden />
            {verTodas ? 'Ocultar las demás empresas' : `Ver tus ${datos.empresas.length} empresas`}
            {sinFirma > 0 && <span className="font-normal text-fg-3">· {sinFirma} sin firma</span>}
          </button>
          {verTodas && otras.map((e) => (
            <div key={e.id} className="rounded-[10px] border border-line px-3.5 py-3">
              <FilaFirma fila={e} conNombre {...filaProps} />
            </div>
          ))}
        </div>
      )}

      {pedir && <PedirFirmaDistancia fila={pedir} dias={datos.dias_vigencia} onCerrar={() => setPedir(null)} />}

      <Modal abierto={Boolean(cancelar)} onCerrar={() => setCancelar(null)} titulo="Cancelar el pedido de firma"
        subtitulo={cancelar ? `${capitalizar(cancelar.nombre)} · ${cancelar.email}` : undefined}
        acciones={<>
          <Button variante="secundario" onClick={() => setCancelar(null)}>Volver</Button>
          <Button variante="peligro" cargando={Boolean(cancelar) && ocupada === `c${cancelar?.id}`} onClick={async () => {
            const s = cancelar!;
            await accion(`c${s.id}`, () => client.post(`/firmas-empleador/${s.id}/cancelar/`, {}, { params: { empresa: s.empresa } }),
              'Pedido cancelado');
            setCancelar(null);
          }}>Cancelar pedido</Button>
        </>}>
        <p className="text-[13.5px] text-fg-2">El enlace que recibió el representante dejará de funcionar. Puedes pedir la firma de nuevo cuando quieras.</p>
      </Modal>
    </div>
  );
}

function FilaFirma({ fila, conNombre = false, permitido, ocupada, onDibujar, onPedir, onReenviar, onCancelar, onConstancia }: {
  fila: FirmaEmpleadorEmpresa; conNombre?: boolean; permitido: boolean; ocupada: string | null; onDibujar?: () => void;
  onPedir: (f: FirmaEmpleadorEmpresa) => void; onReenviar: (f: FirmaEmpleadorEmpresa, s: PedidoFirmaEmpleador) => void;
  onCancelar: (s: PedidoFirmaEmpleador) => void; onConstancia: (f: FirmaEmpleadorEmpresa) => void;
}) {
  const { esTitular, puede } = usePermisos();
  const gestionar = puede(MODULOS_DOCUMENTOS, true);
  const { firma, solicitud: s } = fila;
  const pendiente = s?.estado === 'PENDIENTE' ? s : null;
  const vencida = s?.estado === 'EXPIRADA' ? s : null;

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2.5">
      <div className="flex-1 min-w-[240px] flex flex-col gap-1">
        <span className="flex items-center gap-2 flex-wrap">
          {conNombre && <span className="text-[13.5px] font-medium">{capitalizar(fila.nombre)}</span>}
          <Chip tono={firma.configurada ? 'ok' : 'peligro'}>{firma.configurada ? 'Firma registrada' : 'Falta la firma'}</Chip>
          {pendiente && <Chip tono="aviso">Pedido pendiente</Chip>}
        </span>
        <span className="text-[12.5px] text-fg-2">
          {firma.configurada
            ? `${capitalizar(firma.nombre)}${firma.cargo ? ` (${capitalizar(firma.cargo)})` : ''} · ${firma.a_distancia
              ? 'registrada a distancia' : 'dibujada en el panel'} el ${fechaCL(firma.configurada_en)}`
            : 'Sin la firma del empleador no se pueden enviar documentos a firma.'}
        </span>
        {pendiente && (
          <span className="text-[12px] text-fg-3">
            Pedida a {capitalizar(pendiente.nombre)} ({pendiente.email}) el <Fecha iso={pendiente.creada_en} />
            {pendiente.pedida_por ? ` por ${pendiente.pedida_por}` : ''} · vence el <Fecha iso={pendiente.expira_en} />
            {!pendiente.correo_enviado && <span className="text-danger"> · el correo no salió: reenvíalo</span>}
          </span>
        )}
        {vencida && !firma.configurada && (
          <span className="text-[12px] text-fg-3">El pedido a {capitalizar(vencida.nombre)} venció el <Fecha iso={vencida.expira_en} /> sin firmar.</span>
        )}
        {!permitido && !firma.configurada && gestionar && (
          <span className="flex items-start gap-1.5 text-[12px] text-fg-3">
            <Lock className="size-3.5 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
            <span>
              Pedirle la firma al representante legal por correo, para que firme desde su teléfono, está disponible desde el plan Corporativo.
              {esTitular && <> <Link to="/app/plan" className="font-medium">Ver planes</Link></>}
            </span>
          </span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {onDibujar && (
          <Button variante="secundario" tamano="sm" onClick={onDibujar} iconoInicio={<PenLine className="size-4" strokeWidth={2} />}>
            {firma.configurada ? 'Cambiar firma' : 'Dibujar firma'}
          </Button>
        )}
        {permitido && gestionar && !pendiente && (
          <Button variante={firma.configurada ? 'secundario' : 'primario'} tamano="sm" onClick={() => onPedir(fila)}
            iconoInicio={<Send className="size-4" strokeWidth={2} />}>
            {vencida ? 'Pedir de nuevo' : 'Pedir firma a distancia'}
          </Button>
        )}
        {pendiente && gestionar && (
          <>
            {permitido && (
              <Button variante="secundario" tamano="sm" cargando={ocupada === `r${pendiente.id}`} onClick={() => onReenviar(fila, pendiente)}
                iconoInicio={<Mail className="size-4" strokeWidth={2} />}>Reenviar correo</Button>
            )}
            <Button variante="peligro-contorno" tamano="sm" onClick={() => onCancelar(pendiente)}
              iconoInicio={<X className="size-4" strokeWidth={2} />}>Cancelar pedido</Button>
          </>
        )}
        {firma.a_distancia && firma.solicitud_id && (
          <Button variante="secundario" tamano="sm" cargando={ocupada === `d${fila.id}`} onClick={() => onConstancia(fila)}
            iconoInicio={<Download className="size-4" strokeWidth={2} />}>Constancia</Button>
        )}
      </div>
    </div>
  );
}

/** Formulario del pedido: datos del representante, prellenados con los de la empresa o del pedido anterior. */
function PedirFirmaDistancia({ fila, dias, onCerrar }: { fila: FirmaEmpleadorEmpresa; dias: number; onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const previo = fila.solicitud && fila.solicitud.estado !== 'FIRMADA' ? fila.solicitud : null;
  const [nombre, setNombre] = useState(previo?.nombre ?? capitalizar(fila.representante_legal));
  const [rut, setRut] = useState(formatRut(previo?.rut ?? fila.rut_representante));
  const [cargo, setCargo] = useState(previo?.cargo ?? 'Representante legal');
  const [email, setEmail] = useState(previo?.email ?? '');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<PedidoFirmaEmpleador | null>(null);

  const otroRut = Boolean(fila.rut_representante) && validateRut(rut) && limpio(rut) !== limpio(fila.rut_representante);

  const enviar = async () => {
    if (nombre.trim().length < 3) { setError('Indica el nombre completo del representante legal.'); return; }
    if (!validateRut(rut)) { setError('Ingresa un RUT válido.'); return; }
    if (!esRutDePersona(rut)) { setError('Indica el RUT de la persona que firma, no el de la empresa.'); return; }
    if (!CORREO.test(email.trim())) { setError('Ingresa un correo válido.'); return; }
    setEnviando(true);
    setError('');
    try {
      const { data } = await client.post<PedidoFirmaEmpleador>('/firmas-empleador/',
        { empresa: fila.id, nombre: nombre.trim(), rut, cargo: cargo.trim(), email: email.trim() }, { params: { empresa: fila.id } });
      await queryClient.invalidateQueries({ queryKey: ['firmas-empleador'] });
      setEnviado(data);
    } catch (err) {
      setError(mensaje(err, 'No pudimos crear el pedido.'));
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <Modal abierto onCerrar={onCerrar} titulo={enviado.correo_enviado ? 'Pedido enviado' : 'Pedido creado'}
        subtitulo={capitalizar(fila.nombre)} acciones={<Button onClick={onCerrar}>Listo</Button>}>
        <div className="flex flex-col gap-3 text-[13.5px] text-fg-2">
          {enviado.correo_enviado
            ? <p>Enviamos el enlace a <strong className="text-fg font-medium">{enviado.email}</strong>. Vence el <Fecha iso={enviado.expira_en} />.</p>
            : <AlertaError>El pedido quedó creado, pero no pudimos enviar el correo. Usa "Reenviar correo" en unos minutos.</AlertaError>}
          {(enviado.avisos ?? []).map((a) => (
            <p key={a} className="flex gap-2 text-warn"><TriangleAlert className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />{a}</p>
          ))}
          <p>Cuando firme, tú y el representante recibirán la constancia por correo, y la firma quedará lista para enviar documentos a firma.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal abierto onCerrar={() => !enviando && onCerrar()} ancho="amplio" titulo="Pedir la firma a distancia"
      subtitulo={`${capitalizar(fila.nombre)} · ${fila.rut}`}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
        <Button onClick={enviar} cargando={enviando} iconoInicio={<Send className="size-4" strokeWidth={2} />}>Enviar pedido</Button>
      </>}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        <p className="text-[13px] text-fg-2 rounded-[10px] bg-sunken px-3.5 py-2.5">
          Le enviaremos al representante legal un enlace que vence en {dias} días. Para registrar su firma, confirma su RUT
          con un código que le llega a ese correo, acepta una declaración de que es el representante legal y dibuja su firma
          desde su teléfono o computador.
          {fila.firma.configurada && ' Cuando firme, su firma reemplazará a la actual.'}
        </p>
        {error && <AlertaError>{error}</AlertaError>}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
          <Field etiqueta="Nombre completo">
            {(p) => <Input {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />}
          </Field>
          <CampoRut etiqueta="RUT" valor={rut} onChange={setRut} compacto
            ayuda={otroRut ? `No es el RUT del representante registrado en la empresa (${fila.rut_representante}). Puedes enviarlo igual: verifica que tenga poder para representarla.` : undefined} />
          <Field etiqueta="Cargo">
            {(p) => <Input {...p} value={cargo} onChange={(e) => setCargo(e.target.value)} />}
          </Field>
          <Field etiqueta="Correo del representante" ayuda="Le llegan el enlace y el código de verificación.">
            {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />}
          </Field>
        </div>
      </form>
    </Modal>
  );
}
