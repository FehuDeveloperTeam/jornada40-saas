import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Building2, MailCheck, ShieldCheck } from 'lucide-react';
import client from '../../api/client';
import { AlertaError, Button, CampoRut, InputContrasena } from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { validateRut } from '../../utils/rutUtils';

interface CuentaParaElegir { cuenta: number; nombre: string }

/**
 * Ingreso del encargado de denuncias Ley Karin. Es una puerta aparte, con su
 * propia clave y sesión (cookie `jornada40-karin`): no abre el panel de la
 * empresa, y la sesión del panel no abre las denuncias.
 */
export default function IngresoKarin() {
  const navigate = useNavigate();
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
      const { data } = await client.post<{ elegir_cuenta?: CuentaParaElegir[] }>('/karin/ingresar/', { rut, clave, cuenta });
      if (data.elegir_cuenta) { setCuentas(data.elegir_cuenta); setEnviando(false); return; }
      navigate('/karin/panel', { replace: true });
    } catch (err) {
      const estado = isAxiosError(err) ? err.response?.status : undefined;
      setError(estado === 400 ? 'Revisa tu RUT y tu clave.'
        : estado === 429 ? 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
          : 'No pudimos iniciar sesión. Intenta de nuevo en un momento.');
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
      await client.post('/karin/recuperar/', { rut });
      setModo('enviado');
    } catch (err) {
      setError(isAxiosError(err) && err.response?.status === 429
        ? 'Ya pediste varios enlaces en la última hora. Revisa el último correo (también en spam) o espera un rato.'
        : 'No pudimos enviar el enlace. Intenta de nuevo en un momento.');
    } finally {
      setEnviando(false);
    }
  };

  const lateral = {
    titulo: 'Acceso Ley Karin.',
    descripcion: 'Para quien recibe y gestiona las denuncias de acoso y violencia en el trabajo. Es un acceso reservado.',
  };

  if (modo === 'enviado') {
    return (
      <AuthLayout {...lateral}>
        <span className="grid place-items-center size-[52px] rounded-j40-modal bg-ok-soft text-ok">
          <MailCheck className="size-7" strokeWidth={2} aria-hidden />
        </span>
        <EncabezadoForm titulo="Revisa tu correo">
          Si tu RUT corresponde a un encargado, te enviamos un enlace para crear una clave nueva.
        </EncabezadoForm>
        <Button tamano="lg" variante="secundario" onClick={() => { setModo('ingreso'); setClave(''); }} className="rounded-[10px]">
          Volver al ingreso
        </Button>
      </AuthLayout>
    );
  }

  if (modo === 'recuperar') {
    return (
      <AuthLayout {...lateral}>
        <EncabezadoForm titulo="Crear una clave nueva">Te enviaremos un enlace al correo con que te designaron.</EncabezadoForm>
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
        <EncabezadoForm titulo="¿De qué cuenta?">Eres encargado de denuncias en más de una cuenta.</EncabezadoForm>
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
      <EncabezadoForm titulo="Encargado Ley Karin">
        ¿Eres el titular de la cuenta? <Link to="/login" className="font-medium">Entra aquí</Link>
      </EncabezadoForm>
      <p className="flex gap-2.5 items-start rounded-[10px] bg-brand-soft text-brand-text px-4 py-3 text-[14px]">
        <ShieldCheck className="size-5 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
        Usa la clave de este acceso, no la del panel: son independientes aunque tu RUT sea el mismo.
      </p>
      {error && <AlertaError>{error}</AlertaError>}
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoRut etiqueta="Tu RUT" valor={rut} onChange={(v) => { setRut(v); setError(''); }}
          autoComplete="username" forzarError={Boolean(error) && !validateRut(rut)} />
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline">
            <label htmlFor="karin-clave" className="text-[12.5px] font-medium text-fg-2">Clave</label>
            <button type="button" onClick={() => { setModo('recuperar'); setError(''); }}
              className="bg-transparent p-0 text-[12.5px] font-medium text-brand-text cursor-pointer hover:underline">
              ¿La olvidaste?
            </button>
          </div>
          <InputContrasena id="karin-clave" autoComplete="current-password"
            value={clave} onChange={(e) => { setClave(e.target.value); setError(''); }} invalido={Boolean(error)} />
        </div>
        <Button type="submit" tamano="lg" cargando={enviando} className="rounded-[10px]">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
      <p className="text-[13px] text-fg-3">¿Aún no tienes clave? Ábrela desde el correo en que el titular te designó.</p>
    </AuthLayout>
  );
}
