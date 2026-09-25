import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Check, CircleX, Clock, Download, FileText, Lock, ShieldCheck } from 'lucide-react';
import client from '../../api/client';
import { guardarArchivo } from '../../api/descargas';
import { AlertaError, Button, CampoRut, Casilla, FirmaPad, J40Root, Logo, Modal, ToggleTema } from '../../components/j40';
import { VisorPdf } from '../../components/firma/VisorPdf';
import { cn } from '../../utils/cn';
import { capitalizar } from '../../utils/formato';
import { validateRut } from '../../utils/rutUtils';

interface Info {
  estado: 'PENDIENTE' | 'PROCESANDO' | 'FIRMADO' | 'RECHAZADO' | 'EXPIRADO' | 'CANCELADO';
  tipo_documento_label: string;
  empresa_nombre: string;
  trabajador_nombre: string;
  email_firmante_enmascarado: string;
  expira_en: string;
  ya_verificado: boolean;
  firmado_en?: string | null;
  folio?: string;
  hash_firmado?: string;
}
interface Comprobante { firmado_en: string; folio: string; hash_firmado: string; firma?: string }
type Paso = 'identidad' | 'codigo' | 'revisar' | 'firmar';

const PASOS: [Paso, string][] = [['identidad', 'Identidad'], ['codigo', 'Código'], ['revisar', 'Revisar'], ['firmar', 'Firmar']];
const MOTIVOS = [
  'Los datos personales no son correctos',
  'Los montos o condiciones no son los acordados',
  'No reconozco este documento',
  'Quiero revisarlo con mi empleador antes de firmar',
];
const ESPERA_REENVIO = 60;  // el backend permite un código por minuto

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

// La sesión verificada sobrevive a una recarga de la pestaña (no a cerrarla).
const claveSesion = (token: string) => `j40-firma-${token}`;
const leerSesion = (token: string) => { try { return sessionStorage.getItem(claveSesion(token)); } catch { return null; } };
const guardarSesion = (token: string, valor: string | null) => {
  try { if (valor) sessionStorage.setItem(claveSesion(token), valor); else sessionStorage.removeItem(claveSesion(token)); } catch { /* sin almacenamiento */ }
};

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'long', timeStyle: 'short' });
}

/** Flujo público de firma del trabajador (Ley 19.799, firma electrónica simple). */
export default function Firma() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [paso, setPaso] = useState<Paso>('identidad');
  const [sesion, setSesion] = useState<string | null>(() => leerSesion(token));
  const [rut, setRut] = useState('');
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);

  useEffect(() => {
    client.get<Info>(`/firma-publica/${token}/`)
      .then(({ data }) => {
        setInfo(data);
        if (data.estado === 'FIRMADO' && data.firmado_en) {
          setComprobante({ firmado_en: data.firmado_en, folio: data.folio ?? '', hash_firmado: data.hash_firmado ?? '' });
        } else if (data.ya_verificado && leerSesion(token)) {
          setPaso('revisar');
        }
      })
      .catch((err) => setErrorCarga(isAxiosError(err) && err.response?.status === 404
        ? 'Este enlace de firma no existe. Revisa que lo hayas copiado completo.'
        : isAxiosError(err) && err.response?.status === 429
          ? 'Se abrió este enlace demasiadas veces en poco rato. Espera una hora y vuelve a intentarlo.'
          : 'No pudimos cargar el documento. Intenta de nuevo en un momento.'));
  }, [token]);

  const verificado = (s: string) => { guardarSesion(token, s); setSesion(s); setPaso('revisar'); };
  // La sesión se conserva tras firmar: con ella se descarga el PDF firmado.
  const terminar = (c: Comprobante) => setComprobante(c);
  const sesionVencida = useCallback(() => { guardarSesion(token, null); setSesion(null); setPaso('identidad'); }, [token]);

  let cuerpo: ReactNode;
  if (errorCarga) cuerpo = <Aviso Icono={CircleX} tono="peligro" titulo="Enlace no disponible" texto={errorCarga} />;
  else if (!info) cuerpo = <p className="py-16 text-center text-[14px] text-fg-3" role="status">Cargando…</p>;
  else if (comprobante) cuerpo = <Listo token={token} info={info} comprobante={comprobante} sesion={sesion} />;
  else if (info.estado === 'RECHAZADO') cuerpo = <Aviso Icono={CircleX} tono="peligro" titulo="Documento rechazado" texto="Rechazaste este documento. Tu empleador ya fue notificado." />;
  else if (info.estado === 'EXPIRADO') cuerpo = <Aviso Icono={Clock} tono="aviso" titulo="El enlace venció" texto="Pide a tu empleador que te envíe el documento de nuevo." />;
  else if (info.estado === 'CANCELADO') cuerpo = <Aviso Icono={CircleX} tono="neutro" titulo="Solicitud cancelada" texto="Tu empleador canceló esta solicitud de firma. No necesitas hacer nada." />;
  else if (info.estado === 'PROCESANDO') cuerpo = <Aviso Icono={Clock} tono="aviso" titulo="Procesando la firma" texto="Estamos registrando tu firma. Vuelve a abrir el enlace en unos minutos." />;
  else {
    cuerpo = (
      <>
        <Progreso actual={paso} />
        {paso === 'identidad' && <Identidad token={token} info={info} rut={rut} setRut={setRut} onEnviado={() => setPaso('codigo')} />}
        {paso === 'codigo' && <Codigo token={token} info={info} rut={rut} onVerificado={verificado} onVolver={() => setPaso('identidad')} />}
        {paso === 'revisar' && sesion && <Revisar token={token} info={info} sesion={sesion} onAceptar={() => setPaso('firmar')}
          onRechazado={() => { guardarSesion(token, null); setInfo({ ...info, estado: 'RECHAZADO' }); }} onSesionVencida={sesionVencida} />}
        {paso === 'firmar' && sesion && <Firmar token={token} sesion={sesion} onVolver={() => setPaso('revisar')} onFirmado={terminar}
          onSesionVencida={sesionVencida} />}
      </>
    );
  }

  return (
    <J40Root className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="max-w-[600px] mx-auto px-4 h-14 flex items-center gap-2.5">
          <Logo soloIcono tamano={30} />
          <span className="flex-1 min-w-0 flex flex-col leading-tight">
            <span className="text-[13.5px] font-semibold truncate">{info ? capitalizar(info.empresa_nombre) : 'Jornada40'}</span>
            <span className="text-[11.5px] text-fg-3 inline-flex items-center gap-1"><Lock className="size-3" strokeWidth={2} aria-hidden />Firma segura vía Jornada40</span>
          </span>
          <ToggleTema />
        </div>
      </header>
      <main className="max-w-[600px] mx-auto px-4 py-6 flex flex-col gap-5">{cuerpo}</main>
      <footer className="max-w-[600px] mx-auto px-4 pb-8 text-center text-[11.5px] text-fg-3">
        Firma electrónica simple · Ley 19.799 · Conexión cifrada
      </footer>
    </J40Root>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Progreso({ actual }: { actual: Paso }) {
  const i = PASOS.findIndex(([p]) => p === actual);
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Progreso de la firma">
      {PASOS.map(([p, t], n) => (
        <li key={p} className="flex flex-col gap-1.5" aria-current={n === i ? 'step' : undefined}>
          <span className={cn('h-1 rounded-full', n <= i ? 'bg-brand' : 'bg-line')} />
          <span className={cn('text-[11.5px]', n === i ? 'font-semibold text-fg' : n < i ? 'text-fg-2' : 'text-fg-3')}>{t}</span>
        </li>
      ))}
    </ol>
  );
}

function Tarjeta({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('bg-surface border border-line rounded-j40-card shadow-card p-5 flex flex-col gap-4', className)}>{children}</section>;
}

function Documento({ info }: { info: Info }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-sunken px-3.5 py-3">
      <FileText className="size-6 text-brand-text shrink-0" strokeWidth={2} aria-hidden />
      <span className="flex flex-col min-w-0">
        <span className="text-[14px] font-semibold">{info.tipo_documento_label}</span>
        <span className="text-[12px] text-fg-3">Para {capitalizar(info.trabajador_nombre)} · vence el {fechaHora(info.expira_en)}</span>
      </span>
    </div>
  );
}

function Aviso({ Icono, tono, titulo, texto }: { Icono: typeof Check; tono: 'peligro' | 'aviso' | 'neutro'; titulo: string; texto: string }) {
  const color = { peligro: 'bg-danger-soft text-danger', aviso: 'bg-warn-soft text-warn', neutro: 'bg-sunken text-fg-2' }[tono];
  return (
    <Tarjeta className="items-center text-center py-10">
      <span className={cn('size-14 rounded-full grid place-items-center', color)}><Icono className="size-7" strokeWidth={2} aria-hidden /></span>
      <h1 className="text-[20px] font-semibold">{titulo}</h1>
      <p className="text-[14px] text-fg-2 max-w-[420px]">{texto}</p>
    </Tarjeta>
  );
}

function Identidad({ token, info, rut, setRut, onEnviado }: {
  token: string; info: Info; rut: string; setRut: (v: string) => void; onEnviado: () => void;
}) {
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!validateRut(rut)) { setError('Ingresa un RUT válido.'); return; }
    setEnviando(true);
    setError('');
    try {
      await client.post(`/firma-publica/${token}/solicitar-otp/`, { rut });
      onEnviado();
    } catch (err) {
      // 429 por el minuto de espera: ya hay un código enviado, se puede usar.
      if (isAxiosError(err) && err.response?.status === 429 && /esperar/.test(mensaje(err, ''))) { onEnviado(); return; }
      setError(mensaje(err, 'No pudimos enviar el código. Intenta de nuevo en un momento.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tarjeta>
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Confirma tu identidad</h1>
        <p className="text-[14px] text-fg-2 mt-1">{capitalizar(info.empresa_nombre)} te envió un documento para firmar.</p>
      </div>
      <Documento info={info} />
      {error && <AlertaError>{error}</AlertaError>}
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        <CampoRut etiqueta="Tu RUT" valor={rut} onChange={setRut} autoComplete="off" />
        <p className="text-[13px] text-fg-3">
          Te enviaremos un código de 6 dígitos a <strong className="text-fg font-medium">{info.email_firmante_enmascarado}</strong>.
        </p>
        <Button type="submit" tamano="lg" bloque cargando={enviando}>{enviando ? 'Enviando…' : 'Enviar código'}</Button>
      </form>
    </Tarjeta>
  );
}

function Codigo({ token, info, rut, onVerificado, onVolver }: {
  token: string; info: Info; rut: string; onVerificado: (sesion: string) => void; onVolver: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [espera, setEspera] = useState(ESPERA_REENVIO);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const t = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [espera]);

  const verificar = useCallback(async (valor: string) => {
    setVerificando(true);
    setError('');
    try {
      const { data } = await client.post<{ sesion_token: string }>(`/firma-publica/${token}/verificar-otp/`, { codigo: valor });
      onVerificado(data.sesion_token);
    } catch (err) {
      setError(mensaje(err, 'No pudimos verificar el código.'));
      setCodigo('');
      campo.current?.focus();
    } finally {
      setVerificando(false);
    }
  }, [token, onVerificado]);

  const reenviar = async () => {
    setError('');
    try {
      await client.post(`/firma-publica/${token}/solicitar-otp/`, { rut });
      setEspera(ESPERA_REENVIO);
    } catch (err) {
      setError(mensaje(err, 'No pudimos reenviar el código.'));
    }
  };

  return (
    <Tarjeta>
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Ingresa el código</h1>
        <p className="text-[14px] text-fg-2 mt-1">Lo enviamos a {info.email_firmante_enmascarado}. Vale por 10 minutos y tiene 3 intentos.</p>
      </div>
      {error && <AlertaError>{error}</AlertaError>}
      {/* Un solo campo real (autocompletado del SMS/correo en móvil) bajo 6 casillas visuales. */}
      <label className="relative block cursor-text">
        <span className="sr-only">Código de 6 dígitos</span>
        <input ref={campo} autoFocus value={codigo} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          disabled={verificando}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCodigo(v);
            if (v.length === 6) void verificar(v);
          }}
          className="peer absolute inset-0 w-full h-full opacity-0 text-[16px]" />
        <span className="grid grid-cols-6 gap-2" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={cn('h-14 rounded-[10px] border bg-surface grid place-items-center text-[22px] font-semibold j40-mono',
              i === Math.min(codigo.length, 5) ? 'border-brand ring-[3px] ring-brand-soft peer-focus:border-brand' : 'border-line-strong')}>
              {codigo[i] ?? ''}
            </span>
          ))}
        </span>
      </label>
      {verificando && <p className="text-[13px] text-fg-3" role="status">Verificando…</p>}
      <div className="flex items-center justify-between gap-3 flex-wrap text-[13px]">
        <button type="button" onClick={onVolver} className="text-fg-2">Cambiar RUT</button>
        {espera > 0
          ? <span className="text-fg-3 j40-num">Reenviar en {espera} s</span>
          : <button type="button" onClick={reenviar} className="font-medium text-brand-text">Reenviar código</button>}
      </div>
    </Tarjeta>
  );
}

function Revisar({ token, info, sesion, onAceptar, onRechazado, onSesionVencida }: {
  token: string; info: Info; sesion: string; onAceptar: () => void; onRechazado: () => void; onSesionVencida: () => void;
}) {
  const [pdf, setPdf] = useState<ArrayBuffer | null>(null);
  const [errorPdf, setErrorPdf] = useState('');
  const [leido, setLeido] = useState(false);
  const [acepto, setAcepto] = useState(false);
  const [rechazando, setRechazando] = useState(false);

  useEffect(() => {
    client.get<ArrayBuffer>(`/firma-publica/${token}/documento/`, { params: { sesion }, responseType: 'arraybuffer' })
      .then(({ data }) => setPdf(data))
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 403) onSesionVencida();
        else setErrorPdf('No pudimos obtener el documento. Intenta de nuevo en un momento.');
      });
  }, [token, sesion, onSesionVencida]);

  const descargar = () => {
    if (!pdf) return;
    guardarArchivo(new Blob([pdf], { type: 'application/pdf' }), `${info.tipo_documento_label}.pdf`);
    setLeido(true);  // quien lo descargó pudo leerlo completo
  };

  return (
    <>
      <Tarjeta>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Revisa el documento</h1>
            <p className="text-[14px] text-fg-2 mt-1">Léelo completo antes de firmar. Puedes descargarlo.</p>
          </div>
          <Button variante="secundario" tamano="sm" onClick={descargar} disabled={!pdf} iconoInicio={<Download className="size-4" strokeWidth={2} />}>PDF</Button>
        </div>
        {errorPdf ? <AlertaError>{errorPdf}</AlertaError> : pdf
          ? <VisorPdf datos={pdf} onLeidoHastaElFinal={() => setLeido(true)} />
          : <p className="py-10 text-center text-[13px] text-fg-3" role="status">Cargando documento…</p>}
        <div className={cn(!leido && 'opacity-60')}>
          <Casilla marcada={acepto} onChange={setAcepto} deshabilitada={!leido}>
            Leí el documento completo y estoy de acuerdo con su contenido.
          </Casilla>
          {!leido && <p className="text-[12px] text-fg-3 mt-1.5 pl-7">Desplázate hasta el final del documento para continuar.</p>}
        </div>
        <Button tamano="lg" bloque disabled={!acepto} onClick={onAceptar}>Continuar a la firma</Button>
        <button type="button" onClick={() => setRechazando(true)} className="text-[13px] text-danger self-center">No estoy de acuerdo: rechazar</button>
      </Tarjeta>
      {rechazando && <Rechazo token={token} sesion={sesion} onCerrar={() => setRechazando(false)} onRechazado={onRechazado}
        onSesionVencida={onSesionVencida} />}
    </>
  );
}

function Rechazo({ token, sesion, onCerrar, onRechazado, onSesionVencida }: {
  token: string; sesion: string; onCerrar: () => void; onRechazado: () => void; onSesionVencida: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [otro, setOtro] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const texto = motivo === 'otro' ? otro.trim() : motivo;

  const enviar = async () => {
    setEnviando(true);
    setError('');
    try {
      await client.post(`/firma-publica/${token}/rechazar/`, { sesion_token: sesion, motivo: texto });
      onRechazado();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 403) { onSesionVencida(); return; }
      setError(mensaje(err, 'No pudimos registrar el rechazo.'));
      setEnviando(false);
    }
  };

  return (
    <Modal abierto onCerrar={() => !enviando && onCerrar()} titulo="Rechazar el documento"
      subtitulo="Tu empleador recibirá el motivo. No podrás firmar este enlace después."
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={enviando}>Volver</Button>
        <Button variante="peligro" onClick={enviar} cargando={enviando} disabled={!texto}>Rechazar</Button>
      </>}>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Motivo del rechazo">
        {error && <AlertaError>{error}</AlertaError>}
        {[...MOTIVOS, 'otro'].map((m) => (
          <label key={m} className={cn('flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-[14px] cursor-pointer',
            motivo === m ? 'border-brand bg-brand-soft' : 'border-line')}>
            <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} className="mt-1 accent-[var(--color-brand)]" />
            {m === 'otro' ? 'Otro motivo' : m}
          </label>
        ))}
        {motivo === 'otro' && (
          <textarea autoFocus value={otro} onChange={(e) => setOtro(e.target.value)} rows={3} maxLength={500} placeholder="Cuéntale a tu empleador qué debe corregir"
            className="w-full rounded-[10px] border border-line-strong bg-surface p-3 text-[16px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft" />
        )}
      </div>
    </Modal>
  );
}

function Firmar({ token, sesion, onVolver, onFirmado, onSesionVencida }: {
  token: string; sesion: string; onVolver: () => void; onFirmado: (c: Comprobante) => void; onSesionVencida: () => void;
}) {
  const [firma, setFirma] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [firmando, setFirmando] = useState(false);

  const firmar = async () => {
    if (!firma) return;
    setFirmando(true);
    setError('');
    try {
      const { data } = await client.post<Comprobante>(`/firma-publica/${token}/firmar/`, { sesion_token: sesion, firma_trabajador: firma });
      onFirmado({ ...data, firma });
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 403) { onSesionVencida(); return; }
      setError(mensaje(err, 'No pudimos registrar tu firma. Intenta de nuevo.'));
      setFirmando(false);
    }
  };

  return (
    <Tarjeta>
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Firma el documento</h1>
        <p className="text-[14px] text-fg-2 mt-1">Dibuja tu firma con el dedo o el mouse.</p>
      </div>
      {error && <AlertaError>{error}</AlertaError>}
      <FirmaPad onChange={setFirma} etiqueta="Tu firma" />
      <Button tamano="lg" bloque disabled={!firma} cargando={firmando} onClick={firmar}>{firmando ? 'Firmando…' : 'Firmar documento'}</Button>
      <button type="button" onClick={onVolver} disabled={firmando} className="text-[13px] text-fg-2 self-center">Volver al documento</button>
    </Tarjeta>
  );
}

function Listo({ token, info, comprobante, sesion }: { token: string; info: Info; comprobante: Comprobante; sesion: string | null }) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');

  const descargar = async () => {
    setDescargando(true);
    setError('');
    try {
      const { data } = await client.get<Blob>(`/firma-publica/${token}/documento/`, { params: { sesion }, responseType: 'blob' });
      guardarArchivo(data, `${info.tipo_documento_label}_firmado.pdf`);
    } catch {
      setError('No pudimos descargar el PDF firmado. Intenta de nuevo en un momento.');
    } finally {
      setDescargando(false);
    }
  };

  const filas: [string, ReactNode][] = [
    ['Documento', info.tipo_documento_label],
    ['Firmante', capitalizar(info.trabajador_nombre)],
    ['Fecha y hora', fechaHora(comprobante.firmado_en)],
    ['Verificación', `Código enviado a ${info.email_firmante_enmascarado}`],
    ['Folio', <span className="j40-mono">{comprobante.folio || '—'}</span>],
  ];

  return (
    <Tarjeta>
      <div className="flex flex-col items-center text-center gap-3 pt-2">
        <span className="size-14 rounded-full grid place-items-center bg-ok-soft text-ok"><ShieldCheck className="size-7" strokeWidth={2} aria-hidden /></span>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Documento firmado</h1>
        <p className="text-[14px] text-fg-2">Te enviamos una copia por correo. {capitalizar(info.empresa_nombre)} también la recibió.</p>
      </div>
      {comprobante.firma && (
        <div className="rounded-[10px] border border-line bg-white p-3 grid place-items-center">
          <img src={comprobante.firma} alt="Tu firma" className="max-h-28" />
        </div>
      )}
      <dl className="rounded-[10px] bg-sunken px-4 py-2 divide-y divide-line">
        {filas.map(([t, v]) => (
          <div key={t} className="flex justify-between gap-4 py-2.5 text-[13px]">
            <dt className="text-fg-3 shrink-0">{t}</dt><dd className="text-right font-medium min-w-0 break-words">{v}</dd>
          </div>
        ))}
        {comprobante.hash_firmado && (
          <div className="py-2.5 text-[13px] flex flex-col gap-1">
            <dt className="text-fg-3">Huella del PDF firmado (SHA-256)</dt>
            <dd className="j40-mono text-[11.5px] break-all">{comprobante.hash_firmado}</dd>
          </div>
        )}
      </dl>
      {error && <AlertaError>{error}</AlertaError>}
      {sesion ? (
        <Button tamano="lg" bloque onClick={descargar} cargando={descargando} iconoInicio={<Download className="size-5" strokeWidth={2} />}>
          Descargar PDF firmado
        </Button>
      ) : (
        <p className="text-[13px] text-fg-2 text-center">El PDF firmado está en el correo que te enviamos al firmar.</p>
      )}
    </Tarjeta>
  );
}
