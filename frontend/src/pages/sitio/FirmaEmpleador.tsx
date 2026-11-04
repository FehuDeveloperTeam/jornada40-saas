import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { CircleX, Clock, Download, Lock, ShieldCheck } from 'lucide-react';
import client from '../../api/client';
import { guardarArchivo } from '../../api/descargas';
import { AlertaError, Button, CampoCodigo, CampoRut, Casilla, FirmaPad, J40Root, Logo, ToggleTema } from '../../components/j40';
import { cn } from '../../utils/cn';
import { capitalizar } from '../../utils/formato';
import { validateRut } from '../../utils/rutUtils';

interface Info {
  estado: 'PENDIENTE' | 'FIRMADA' | 'EXPIRADA' | 'CANCELADA';
  empresa_nombre: string;
  empresa_rut: string;
  nombre: string;
  cargo: string;
  email_enmascarado: string;
  expira_en: string;
  pedida_por: string;
  minutos_codigo: number;
  /** Con la sesión de esta pestaña: la identidad ya está verificada. */
  verificado?: boolean;
  declaracion?: string;
  firmada_en?: string | null;
  folio?: string;
}
interface Registro { firmada_en: string; folio: string; firma?: string }
type Paso = 'identidad' | 'codigo' | 'firmar';

const PASOS: [Paso, string][] = [['identidad', 'Identidad'], ['codigo', 'Verificación'], ['firmar', 'Firma']];
const ESPERA_REENVIO = 60;  // el backend permite un código por minuto

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

// La sesión verificada sobrevive a una recarga de la pestaña (no a cerrarla).
const claveSesion = (token: string) => `j40-firma-empleador-${token}`;
const leerSesion = (token: string) => { try { return sessionStorage.getItem(claveSesion(token)); } catch { return null; } };
const guardarSesion = (token: string, valor: string | null) => {
  try { if (valor) sessionStorage.setItem(claveSesion(token), valor); else sessionStorage.removeItem(claveSesion(token)); } catch { /* sin almacenamiento */ }
};

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'long', timeStyle: 'short' });
}

/**
 * Página pública del representante legal: confirma su RUT y un código enviado a
 * su correo, acepta la declaración y dibuja su firma, que queda como firma del
 * empleador de la empresa (plan Corporativo). El código solo verifica identidad.
 */
export default function FirmaEmpleadorPublica() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [paso, setPaso] = useState<Paso>('identidad');
  const [sesion, setSesion] = useState<string | null>(() => leerSesion(token));
  const [declaracion, setDeclaracion] = useState('');
  const [rut, setRut] = useState('');
  const [registro, setRegistro] = useState<Registro | null>(null);

  useEffect(() => {
    const guardada = leerSesion(token);
    client.get<Info>(`/firma-empleador/${token}/`, { params: guardada ? { sesion: guardada } : undefined })
      .then(({ data }) => {
        setInfo(data);
        if (data.estado === 'FIRMADA' && data.firmada_en) {
          setRegistro({ firmada_en: data.firmada_en, folio: data.folio ?? '' });
        } else if (data.verificado && data.declaracion) {
          setDeclaracion(data.declaracion);
          setPaso('firmar');
        }
      })
      .catch((err) => setErrorCarga(isAxiosError(err) && err.response?.status === 404
        ? 'Este enlace no existe. Revisa que lo hayas copiado completo.'
        : isAxiosError(err) && err.response?.status === 429
          ? 'Se abrió este enlace demasiadas veces en poco rato. Espera una hora y vuelve a intentarlo.'
          : 'No pudimos cargar el pedido. Intenta de nuevo en un momento.'));
  }, [token]);

  const verificado = (s: string, texto: string) => { guardarSesion(token, s); setSesion(s); setDeclaracion(texto); setPaso('firmar'); };
  const sesionVencida = useCallback(() => { guardarSesion(token, null); setSesion(null); setPaso('identidad'); }, [token]);

  let cuerpo: ReactNode;
  if (errorCarga) cuerpo = <Aviso Icono={CircleX} tono="peligro" titulo="Enlace no disponible" texto={errorCarga} />;
  else if (!info) cuerpo = <p className="py-16 text-center text-[14px] text-fg-3" role="status">Cargando…</p>;
  else if (registro) cuerpo = <Listo token={token} info={info} registro={registro} sesion={sesion} />;
  else if (info.estado === 'EXPIRADA') cuerpo = <Aviso Icono={Clock} tono="aviso" titulo="El enlace venció" texto={`Pide a quien administra ${capitalizar(info.empresa_nombre)} en Jornada40 que te lo envíe de nuevo.`} />;
  else if (info.estado === 'CANCELADA') cuerpo = <Aviso Icono={CircleX} tono="neutro" titulo="Pedido cancelado" texto="La empresa canceló este pedido de firma. No necesitas hacer nada." />;
  else {
    cuerpo = (
      <>
        <Progreso actual={paso} />
        {paso === 'identidad' && <Identidad token={token} info={info} rut={rut} setRut={setRut} onEnviado={() => setPaso('codigo')} />}
        {paso === 'codigo' && <Codigo token={token} info={info} rut={rut} onVerificado={verificado} onVolver={() => setPaso('identidad')} />}
        {paso === 'firmar' && sesion && <Firmar token={token} info={info} sesion={sesion} declaracion={declaracion}
          onFirmado={setRegistro} onSesionVencida={sesionVencida} />}
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
    <ol className="grid grid-cols-3 gap-1.5" aria-label="Progreso del registro de la firma">
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

function Aviso({ Icono, tono, titulo, texto }: { Icono: typeof Clock; tono: 'peligro' | 'aviso' | 'neutro'; titulo: string; texto: string }) {
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
      await client.post(`/firma-empleador/${token}/codigo/`, { rut });
      onEnviado();
    } catch (err) {
      // 429 por el minuto de espera: ya hay un código enviado, se puede usar.
      if (isAxiosError(err) && err.response?.status === 429 && /Espera/.test(mensaje(err, ''))) { onEnviado(); return; }
      setError(mensaje(err, 'No pudimos enviar el código. Intenta de nuevo en un momento.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tarjeta>
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Registra tu firma</h1>
        <p className="text-[14px] text-fg-2 mt-1">
          {info.pedida_por ? `${info.pedida_por} te pide` : 'Te piden'} registrar tu firma como {info.cargo.toLowerCase() || 'representante legal'} de{' '}
          <strong className="text-fg font-medium">{capitalizar(info.empresa_nombre)}</strong> ({info.empresa_rut}). Se estampará como firma
          del empleador en los documentos laborales que la empresa envíe a firma desde Jornada40.
        </p>
      </div>
      <p className="text-[12.5px] text-fg-3">Para {capitalizar(info.nombre)} · el enlace vence el {fechaHora(info.expira_en)}</p>
      {error && <AlertaError>{error}</AlertaError>}
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        <CampoRut etiqueta="Tu RUT" valor={rut} onChange={setRut} />
        <p className="text-[13px] text-fg-3">
          Te enviaremos un código de 6 dígitos a <strong className="text-fg font-medium">{info.email_enmascarado}</strong>.
        </p>
        <p className="text-[13px] text-fg-2 rounded-[10px] bg-sunken px-3.5 py-2.5">
          El código solo confirma que eres tú. La firma la haces tú al final: lees la declaración, la aceptas y dibujas tu firma.
        </p>
        <Button type="submit" tamano="lg" bloque cargando={enviando}>{enviando ? 'Enviando…' : 'Enviar código'}</Button>
      </form>
    </Tarjeta>
  );
}

function Codigo({ token, info, rut, onVerificado, onVolver }: {
  token: string; info: Info; rut: string; onVerificado: (sesion: string, declaracion: string) => void; onVolver: () => void;
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
      const { data } = await client.post<{ sesion: string; declaracion: string }>(`/firma-empleador/${token}/verificar/`, { codigo: valor });
      onVerificado(data.sesion, data.declaracion);
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
      await client.post(`/firma-empleador/${token}/codigo/`, { rut });
      setEspera(ESPERA_REENVIO);
    } catch (err) {
      setError(mensaje(err, 'No pudimos reenviar el código.'));
    }
  };

  return (
    <Tarjeta>
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Ingresa el código</h1>
        <p className="text-[14px] text-fg-2 mt-1">Lo enviamos a {info.email_enmascarado}. Vale por {info.minutos_codigo} minutos y tiene 3 intentos.</p>
      </div>
      {error && <AlertaError>{error}</AlertaError>}
      <CampoCodigo ref={campo} autoFocus valor={codigo} onChange={setCodigo} onCompleto={(v) => void verificar(v)}
        deshabilitado={verificando} />
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

function Firmar({ token, info, sesion, declaracion, onFirmado, onSesionVencida }: {
  token: string; info: Info; sesion: string; declaracion: string; onFirmado: (r: Registro) => void; onSesionVencida: () => void;
}) {
  const [acepto, setAcepto] = useState(false);
  const [firma, setFirma] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [firmando, setFirmando] = useState(false);

  const firmar = async () => {
    if (!firma || !acepto) return;
    setFirmando(true);
    setError('');
    try {
      // acepto: la firma es la aceptación expresa de la declaración más el trazo.
      const { data } = await client.post<Registro>(`/firma-empleador/${token}/firmar/`, { sesion, firma, acepto: true });
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
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Lee y firma</h1>
        <p className="text-[14px] text-fg-2 mt-1">Firma como representante legal de {capitalizar(info.empresa_nombre)}.</p>
      </div>
      <blockquote className="rounded-[10px] border border-line bg-sunken px-4 py-3 text-[14px] leading-relaxed text-fg">{declaracion}</blockquote>
      <Casilla marcada={acepto} onChange={setAcepto}>Leí la declaración y la acepto.</Casilla>
      {error && <AlertaError>{error}</AlertaError>}
      <FirmaPad onChange={setFirma} etiqueta="Tu firma" />
      <p className="text-[13px] text-fg-2 rounded-[10px] bg-sunken px-3.5 py-2.5">
        Esta firma la haces tú: el código solo confirmó tu identidad. Quedará como firma del empleador hasta que la empresa la reemplace.
      </p>
      <Button tamano="lg" bloque disabled={!firma || !acepto} cargando={firmando} onClick={firmar}>
        {firmando ? 'Registrando…' : 'Registrar mi firma'}
      </Button>
    </Tarjeta>
  );
}

function Listo({ token, info, registro, sesion }: { token: string; info: Info; registro: Registro; sesion: string | null }) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');

  const descargar = async () => {
    setDescargando(true);
    setError('');
    try {
      const { data } = await client.get<Blob>(`/firma-empleador/${token}/constancia/`, { params: { sesion }, responseType: 'blob' });
      guardarArchivo(data, `Constancia_firma_empleador_${registro.folio}.pdf`);
    } catch {
      setError('No pudimos descargar la constancia. Intenta de nuevo en un momento.');
    } finally {
      setDescargando(false);
    }
  };

  const filas: [string, ReactNode][] = [
    ['Empresa', `${capitalizar(info.empresa_nombre)} · ${info.empresa_rut}`],
    ['Firmante', `${capitalizar(info.nombre)} · ${capitalizar(info.cargo)}`],
    ['Fecha y hora', fechaHora(registro.firmada_en)],
    ['Identidad verificada con', `Código enviado a ${info.email_enmascarado}`],
    ['Firma', 'Tu aceptación de la declaración y tu trazo'],
    ['Constancia', <span className="j40-mono">{registro.folio || '—'}</span>],
  ];

  return (
    <Tarjeta>
      <div className="flex flex-col items-center text-center gap-3 pt-2">
        <span className="size-14 rounded-full grid place-items-center bg-ok-soft text-ok"><ShieldCheck className="size-7" strokeWidth={2} aria-hidden /></span>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Firma registrada</h1>
        <p className="text-[14px] text-fg-2">Te enviamos la constancia por correo. La empresa también la recibió.</p>
      </div>
      {registro.firma && (
        <div className="rounded-[10px] border border-line bg-white p-3 grid place-items-center">
          <img src={registro.firma} alt="Tu firma" className="max-h-28" />
        </div>
      )}
      <dl className="rounded-[10px] bg-sunken px-4 py-2 divide-y divide-line">
        {filas.map(([t, v]) => (
          <div key={t} className="flex justify-between gap-4 py-2.5 text-[13px]">
            <dt className="text-fg-3 shrink-0">{t}</dt><dd className="text-right font-medium min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {error && <AlertaError>{error}</AlertaError>}
      {sesion ? (
        <Button tamano="lg" bloque onClick={descargar} cargando={descargando} iconoInicio={<Download className="size-5" strokeWidth={2} />}>
          Descargar constancia
        </Button>
      ) : (
        <p className="text-[13px] text-fg-2 text-center">La constancia está en el correo que te enviamos al registrar tu firma.</p>
      )}
    </Tarjeta>
  );
}
