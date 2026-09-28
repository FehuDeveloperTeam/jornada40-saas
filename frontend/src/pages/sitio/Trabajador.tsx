import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { AlertaError, Button, CampoCodigo, CampoRut, InputContrasena } from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { esperaDeCodigo, mensajeError, portal } from '../../api/portal';
import { CLAVE_CUENTA, useCuentaTrabajador } from '../../hooks/usePortal';
import type { CuentaTrabajador } from '../../types';
import { validateRut } from '../../utils/rutUtils';

type Paso = 'rut' | 'clave' | 'codigo';
interface EnvioCodigo { mensaje: string; destinos: string[] }

const ESPERA_REENVIO = 60;  // el backend permite un código por minuto
const MENSAJE_GENERICO = 'Si tu RUT tiene documentos en Jornada40, te enviamos un código a tu correo personal.';

/**
 * Ingreso al portal del trabajador: primero el RUT; con clave creada se pide
 * la clave, si no se envía un código al correo que tiene registrado su
 * empleador. La respuesta es la misma haya o no documentos: no revela quién
 * trabaja dónde.
 */
export default function Trabajador() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sesion = useCuentaTrabajador();
  const [paso, setPaso] = useState<Paso>('rut');
  const [rut, setRut] = useState('');
  const [envio, setEnvio] = useState<EnvioCodigo>({ mensaje: MENSAJE_GENERICO, destinos: [] });

  const entrar = useCallback((cuenta: CuentaTrabajador) => {
    queryClient.setQueryData(CLAVE_CUENTA, cuenta);
    navigate('/trabajador/portal', { replace: true });
  }, [queryClient, navigate]);

  const aCodigo = (datos: EnvioCodigo) => { setEnvio(datos); setPaso('codigo'); };

  // Con la sesión del portal abierta, se va directo a los documentos.
  if (sesion.data && paso === 'rut') return <Navigate to="/trabajador/portal" replace />;

  return (
    <AuthLayout
      titulo="Tus liquidaciones y documentos, cuando los necesites."
      descripcion="Revisa y descarga tus liquidaciones, contratos y vacaciones de las empresas que usan Jornada40."
    >
      {paso === 'rut' && <PasoRut rut={rut} setRut={setRut} onClave={() => setPaso('clave')} onCodigo={aCodigo} />}
      {paso === 'clave' && <PasoClave rut={rut} onVolver={() => setPaso('rut')} onEntrar={entrar} onCodigo={aCodigo} />}
      {paso === 'codigo' && <PasoCodigo rut={rut} envio={envio} onVolver={() => setPaso('rut')} onEntrar={entrar} />}
    </AuthLayout>
  );
}

function PasoRut({ rut, setRut, onClave, onCodigo }: {
  rut: string; setRut: (v: string) => void; onClave: () => void; onCodigo: (e: EnvioCodigo) => void;
}) {
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const continuar = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateRut(rut)) { setError('Ingresa un RUT válido.'); return; }
    setError('');
    setEnviando(true);
    try {
      const r = await portal.ingreso(rut);
      if (r.metodo === 'clave') onClave();
      else onCodigo({ mensaje: r.mensaje || MENSAJE_GENERICO, destinos: r.destinos ?? [] });
    } catch (err) {
      // Pidió un código hace menos de un minuto: ese mismo sirve.
      if (esperaDeCodigo(err)) { onCodigo({ mensaje: MENSAJE_GENERICO, destinos: [] }); return; }
      setError(mensajeError(err, 'No pudimos continuar. Intenta de nuevo en un momento.'));
      setEnviando(false);
    }
  };

  return (
    <>
      <EncabezadoForm titulo="Portal del trabajador">
        Entra con tu RUT para ver tus liquidaciones, contratos y vacaciones.
      </EncabezadoForm>
      {error && <AlertaError>{error}</AlertaError>}
      <form onSubmit={continuar} noValidate className="flex flex-col gap-4">
        <CampoRut etiqueta="Tu RUT" valor={rut} onChange={(v) => { setRut(v); setError(''); }} autoComplete="username"
          forzarError={Boolean(error) && !validateRut(rut)}
          ayuda="Si es tu primera vez, te enviaremos un código al correo que registró tu empleador." />
        <Button type="submit" tamano="lg" cargando={enviando} className="rounded-[10px]">
          {enviando ? 'Continuando…' : 'Continuar'}
        </Button>
      </form>
      <p className="text-[12.5px] text-fg-3">
        ¿Eres empleador? <Link to="/login" className="font-medium">Inicia sesión en el panel</Link>.
      </p>
    </>
  );
}

function RutElegido({ rut, onVolver }: { rut: string; onVolver: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] bg-sunken px-3.5 py-2.5">
      <span className="flex flex-col min-w-0">
        <span className="text-[11.5px] text-fg-3">RUT</span>
        <span className="text-[14px] font-medium j40-mono">{rut}</span>
      </span>
      <Button variante="secundario" tamano="sm" onClick={onVolver}>Cambiar RUT</Button>
    </div>
  );
}

function PasoClave({ rut, onVolver, onEntrar, onCodigo }: {
  rut: string; onVolver: () => void; onEntrar: (c: CuentaTrabajador) => void; onCodigo: (e: EnvioCodigo) => void;
}) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);

  const ingresar = async (e: FormEvent) => {
    e.preventDefault();
    if (!clave) { setError('Ingresa tu clave.'); return; }
    setError('');
    setEnviando(true);
    try {
      onEntrar(await portal.ingresarConClave(rut, clave));
    } catch (err) {
      setError(mensajeError(err, 'No pudimos iniciar sesión. Intenta de nuevo en un momento.'));
      setEnviando(false);
    }
  };

  const conCodigo = async () => {
    setError('');
    setPidiendo(true);
    try {
      const r = await portal.pedirCodigo(rut);
      onCodigo(r.metodo === 'codigo' ? { mensaje: r.mensaje || MENSAJE_GENERICO, destinos: r.destinos ?? [] } : { mensaje: MENSAJE_GENERICO, destinos: [] });
    } catch (err) {
      if (esperaDeCodigo(err)) { onCodigo({ mensaje: MENSAJE_GENERICO, destinos: [] }); return; }
      setError(mensajeError(err, 'No pudimos enviar el código. Intenta de nuevo en un momento.'));
      setPidiendo(false);
    }
  };

  return (
    <>
      <EncabezadoForm titulo="Ingresa tu clave">Es la clave que creaste en el portal del trabajador.</EncabezadoForm>
      <RutElegido rut={rut} onVolver={onVolver} />
      {error && <AlertaError>{error}</AlertaError>}
      <form onSubmit={ingresar} noValidate className="flex flex-col gap-4">
        {/* Campo oculto con el RUT: los gestores de contraseñas lo asocian a la clave. */}
        <input type="text" name="username" autoComplete="username" value={rut} readOnly hidden />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="portal-clave" className="text-[12.5px] font-medium text-fg-2">Clave</label>
          <InputContrasena id="portal-clave" autoComplete="current-password" autoFocus value={clave}
            onChange={(e) => { setClave(e.target.value); setError(''); }} invalido={Boolean(error)} />
        </div>
        <Button type="submit" tamano="lg" cargando={enviando} className="rounded-[10px]">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
      <button type="button" onClick={conCodigo} disabled={pidiendo}
        className="self-center inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-text cursor-pointer disabled:opacity-60">
        <Mail className="size-4" strokeWidth={2} aria-hidden />
        {pidiendo ? 'Enviando código…' : 'Olvidé mi clave · entrar con código al correo'}
      </button>
    </>
  );
}

function PasoCodigo({ rut, envio, onVolver, onEntrar }: {
  rut: string; envio: EnvioCodigo; onVolver: () => void; onEntrar: (c: CuentaTrabajador) => void;
}) {
  const [destinos, setDestinos] = useState(envio.destinos);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [espera, setEspera] = useState(ESPERA_REENVIO);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const t = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [espera]);

  const verificar = async (valor: string) => {
    setVerificando(true);
    setError('');
    setAviso('');
    try {
      onEntrar(await portal.verificarCodigo(rut, valor));
    } catch (err) {
      setError(mensajeError(err, 'No pudimos verificar el código.'));
      setCodigo('');
      setVerificando(false);
      // El campo estaba deshabilitado: se enfoca cuando vuelve a estar activo.
      window.setTimeout(() => campo.current?.focus(), 0);
    }
  };

  const reenviar = async () => {
    setError('');
    setAviso('');
    try {
      const r = await portal.pedirCodigo(rut);
      if (r.metodo === 'codigo') setDestinos(r.destinos ?? []);
      setEspera(ESPERA_REENVIO);
      setAviso('Te enviamos un código nuevo. El anterior ya no sirve.');
    } catch (err) {
      setError(mensajeError(err, 'No pudimos reenviar el código.'));
    }
  };

  return (
    <>
      <EncabezadoForm titulo="Ingresa el código">{envio.mensaje}</EncabezadoForm>
      <RutElegido rut={rut} onVolver={onVolver} />
      {destinos.length > 0 && (
        <div className="flex flex-col gap-1 text-[13px]">
          <span className="text-fg-3">{destinos.length === 1 ? 'Lo enviamos a:' : 'Enviamos un código distinto a cada correo:'}</span>
          <ul className="flex flex-col gap-0.5">
            {destinos.map((d) => <li key={d} className="font-medium j40-mono break-all">{d}</li>)}
          </ul>
        </div>
      )}
      {error && <AlertaError>{error}</AlertaError>}
      {aviso && <p role="status" className="px-3.5 py-3 rounded-[10px] bg-ok-soft text-ok text-[13px]">{aviso}</p>}
      <CampoCodigo ref={campo} autoFocus valor={codigo} onChange={setCodigo} onCompleto={(v) => void verificar(v)}
        deshabilitado={verificando} />
      {verificando && <p className="text-[13px] text-fg-3" role="status">Verificando…</p>}
      <div className="flex items-center justify-between gap-3 flex-wrap text-[13px]">
        <span className="text-fg-3">Vale por 10 minutos y tiene 3 intentos.</span>
        {espera > 0
          ? <span className="text-fg-3 j40-num">Reenviar en {espera} s</span>
          : <button type="button" onClick={reenviar} className="font-medium text-brand-text cursor-pointer">Reenviar código</button>}
      </div>
      <p className="text-[12.5px] text-fg-3 rounded-[10px] border border-line px-3.5 py-3">
        ¿No te llega? Revisa la carpeta de spam. Si en unos minutos sigue sin llegar, pide a tu empleador que revise el
        correo que tiene registrado para ti en Jornada40.
      </p>
    </>
  );
}
