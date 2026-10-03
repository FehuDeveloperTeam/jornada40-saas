import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Building2, MailCheck } from 'lucide-react';
import client from '../../api/client';
import { AlertaError, Button, CampoRut, InputContrasena } from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import type { CuentaParaElegir } from '../../context/AuthContext';
import { validateRut } from '../../utils/rutUtils';

function mensajeDeError(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 400) return 'Revisa tu RUT y tu clave.';
    if (error.response?.status === 429) return 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
    if (error.config?.url?.includes('/auth/user/')) {
      return 'Entraste, pero tu navegador no guardó la sesión. Revisa que permita cookies para jornada40.cl e intenta de nuevo.';
    }
  }
  return 'No pudimos iniciar sesión. Intenta de nuevo en un momento.';
}

/**
 * Ingreso de los usuarios del equipo: personas que el titular invitó a su
 * cuenta. Entran con su propio RUT y la clave que crearon desde la invitación.
 * Si la misma persona está en el equipo de varias cuentas con la misma clave,
 * elige a cuál entrar.
 */
export default function IngresoEquipo() {
  const navigate = useNavigate();
  const { loginEquipo, isAuthenticated } = useAuth();
  // Página a la que volver si la sesión venció (solo rutas del panel).
  const parametros = new URLSearchParams(useLocation().search);
  const volverParam = parametros.get('volver') ?? '';
  const porInactividad = parametros.get('inactividad') === '1';
  const volver = /^\/app(\/|\?|$)/.test(volverParam) ? volverParam : '/app';
  const [modo, setModo] = useState<'ingreso' | 'recuperar' | 'enviado'>('ingreso');
  const [rut, setRut] = useState('');
  const [clave, setClave] = useState('');
  const [cuentas, setCuentas] = useState<CuentaParaElegir[] | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (cuenta?: number) => {
    setError('');
    setEnviando(true);
    try {
      const elegir = await loginEquipo(rut, clave, cuenta);
      if (elegir) { setCuentas(elegir); setEnviando(false); return; }
      navigate(volver, { replace: true });
    } catch (err) {
      setError(mensajeDeError(err));
      setCuentas(null);
      setEnviando(false);
    }
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!validateRut(rut)) { setError('Ingresa un RUT válido.'); return; }
    if (!clave) { setError('Ingresa tu clave.'); return; }
    void entrar();
  };

  const recuperar = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateRut(rut)) { setError('Ingresa un RUT válido.'); return; }
    setError('');
    setEnviando(true);
    try {
      await client.post('/auth/equipo/recuperar/', { rut });
      setModo('enviado');
    } catch (err) {
      setError(isAxiosError(err) && err.response?.status === 429
        ? 'Ya pediste varios enlaces en la última hora. Revisa el último correo (también en spam) o espera un rato.'
        : 'No pudimos enviar el enlace. Intenta de nuevo en un momento.');
    } finally {
      setEnviando(false);
    }
  };

  if (isAuthenticated && !enviando) return <Navigate to={volver} replace />;

  const lateral = {
    titulo: 'Ingreso del equipo.',
    descripcion: 'Para las personas que el titular de la cuenta invitó a trabajar en Jornada40.',
  };

  if (modo === 'enviado') {
    return (
      <AuthLayout {...lateral}>
        <span className="grid place-items-center size-[52px] rounded-j40-modal bg-ok-soft text-ok">
          <MailCheck className="size-7" strokeWidth={2} aria-hidden />
        </span>
        <EncabezadoForm titulo="Revisa tu correo">
          Si tu RUT está en el equipo de una cuenta, te enviamos un enlace para crear una clave nueva.
        </EncabezadoForm>
        <p className="text-[13px] text-fg-3">Puede tardar unos minutos y a veces llega a spam. Usa el enlace del último correo.</p>
        <Button tamano="lg" variante="secundario" onClick={() => { setModo('ingreso'); setClave(''); }} className="rounded-[10px]">
          Volver al ingreso
        </Button>
      </AuthLayout>
    );
  }

  if (modo === 'recuperar') {
    return (
      <AuthLayout {...lateral}>
        <EncabezadoForm titulo="Crear una clave nueva">Te enviaremos un enlace al correo con que te invitaron.</EncabezadoForm>
        {error && <AlertaError>{error}</AlertaError>}
        <form onSubmit={recuperar} noValidate className="flex flex-col gap-4">
          <CampoRut etiqueta="Tu RUT" valor={rut} onChange={(v) => { setRut(v); setError(''); }}
            autoComplete="username" forzarError={Boolean(error) && !validateRut(rut)} />
          <Button type="submit" tamano="lg" cargando={enviando} className="rounded-[10px]">
            {enviando ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
        <button type="button" onClick={() => { setModo('ingreso'); setError(''); }}
          className="self-center bg-transparent p-0 text-[14px] font-medium text-brand-text cursor-pointer hover:underline">
          Volver al ingreso
        </button>
      </AuthLayout>
    );
  }

  if (cuentas) {
    return (
      <AuthLayout {...lateral}>
        <EncabezadoForm titulo="¿A qué cuenta quieres entrar?">Tu RUT está en el equipo de más de una cuenta.</EncabezadoForm>
        {error && <AlertaError>{error}</AlertaError>}
        <div className="flex flex-col gap-2.5">
          {cuentas.map((c) => (
            <button key={c.cuenta} type="button" disabled={enviando} onClick={() => void entrar(c.cuenta)}
              className="flex items-center gap-3 w-full min-h-14 px-4 py-3 rounded-[10px] border border-line bg-surface text-fg text-left text-[15px] font-medium cursor-pointer hover:border-brand disabled:opacity-60">
              <Building2 className="size-[22px] text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
              {c.nombre}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { setCuentas(null); setClave(''); }}
          className="self-center bg-transparent p-0 text-[14px] font-medium text-brand-text cursor-pointer hover:underline">
          Volver
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...lateral}>
      <EncabezadoForm titulo="Ingreso del equipo">
        ¿Eres el titular de la cuenta? <Link to="/login" className="font-medium">Entra aquí</Link>
      </EncabezadoForm>
      {porInactividad && !error && (
        <p role="status" className="rounded-[10px] bg-sunken px-4 py-3 text-[14.5px] text-fg-2">
          Tu sesión se cerró por inactividad. Ingresa de nuevo para continuar.
        </p>
      )}
      {error && <AlertaError>{error}</AlertaError>}
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoRut etiqueta="Tu RUT" valor={rut} onChange={(v) => { setRut(v); setError(''); }}
          autoComplete="username" forzarError={Boolean(error) && !validateRut(rut)}
          ayuda="Tu propio RUT, no el de la empresa ni el del titular." />
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline">
            <label htmlFor="equipo-clave" className="text-[12.5px] font-medium text-fg-2">Clave</label>
            <button type="button" onClick={() => { setModo('recuperar'); setError(''); }}
              className="bg-transparent p-0 text-[12.5px] font-medium text-brand-text cursor-pointer hover:underline">
              ¿La olvidaste?
            </button>
          </div>
          <InputContrasena id="equipo-clave" autoComplete="current-password"
            value={clave} onChange={(e) => { setClave(e.target.value); setError(''); }} invalido={Boolean(error)} />
        </div>
        <Button type="submit" tamano="lg" cargando={enviando} className="rounded-[10px]">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
      <p className="text-[13px] text-fg-3">
        ¿Aún no tienes clave? Ábrela desde el correo de invitación que te envió el titular de la cuenta.
      </p>
    </AuthLayout>
  );
}
