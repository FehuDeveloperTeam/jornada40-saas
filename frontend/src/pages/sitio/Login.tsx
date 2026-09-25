import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { CircleCheck } from 'lucide-react';
import { AlertaError, Button, CampoRut, InputContrasena } from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { validateRut } from '../../utils/rutUtils';

function mensajeDeError(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 400) return 'Revisa tu RUT y tu contraseña.';
    if (error.response?.status === 429) return 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
    if (error.config?.url?.includes('/auth/user/')) {
      return 'Entraste, pero tu navegador no guardó la sesión. Revisa que permita cookies para jornada40.cl e intenta de nuevo.';
    }
  }
  return 'No pudimos iniciar sesión. Intenta de nuevo en un momento.';
}

/**
 * Se entra solo con el RUT del titular de la cuenta (el `username` en Django).
 * El correo no sirve para entrar porque no es único: una persona puede tener
 * varias cuentas con el mismo correo, y el sistema no sabría a cuál llevarla.
 * Las empresas del titular se eligen después, en el lobby.
 */
export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  // Página a la que volver: la que pidió iniciar sesión (solo rutas internas).
  const volverParam = new URLSearchParams(useLocation().search).get('volver') ?? '';
  const volver = /^\/(app|bienvenida)(\/|\?|$)/.test(volverParam) ? volverParam : '/app';
  // Avisos que llegan desde otras pantallas: /reset-password tras guardar la
  // contraseña, o el registro si el inicio de sesión automático falló.
  const aviso = useLocation().state as { contrasenaActualizada?: boolean; cuentaCreada?: boolean } | null;
  const mensajeOk = aviso?.contrasenaActualizada
    ? 'Tu contraseña quedó actualizada. Ya puedes iniciar sesión.'
    : aviso?.cuentaCreada
      ? 'Tu cuenta quedó creada. Inicia sesión para continuar.'
      : '';
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateRut(rut)) { setError('Ingresa un RUT válido.'); return; }
    if (!password) { setError('Ingresa tu contraseña.'); return; }
    setError('');
    setEnviando(true);
    try {
      // CampoRut ya entrega el formato de rutUtils, el mismo con que se guardó.
      await login({ username: rut, password });
      navigate(volver, { replace: true });
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  };

  if (isAuthenticated && !enviando) return <Navigate to={volver} replace />;

  return (
    <AuthLayout
      titulo="Vuelve a tu carpeta de trabajo."
      descripcion="Contratos, liquidaciones y firmas de todo tu equipo en un solo lugar."
    >
      <EncabezadoForm titulo="Iniciar sesión">
        ¿Aún no tienes cuenta? <Link to="/register" className="font-medium">Crea una gratis</Link>
      </EncabezadoForm>

      {error && <AlertaError>{error}</AlertaError>}
      {!error && mensajeOk && (
        <div role="status" className="flex items-center gap-2.5 px-3.5 py-3 rounded-[10px] bg-ok-soft text-ok text-[13px]">
          <CircleCheck className="size-[19px] shrink-0" strokeWidth={2} aria-hidden />
          {mensajeOk}
        </div>
      )}

      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoRut etiqueta="RUT del titular de la cuenta" valor={rut} onChange={(v) => { setRut(v); setError(''); }}
          autoComplete="username" forzarError={Boolean(error) && !validateRut(rut)}
          ayuda="El RUT con que creaste tu cuenta. Al entrar verás todas tus empresas." />
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline">
            <label htmlFor="login-clave" className="text-[12.5px] font-medium text-fg-2">Contraseña</label>
            <Link to="/forgot-password" className="text-[12.5px] font-medium">¿La olvidaste?</Link>
          </div>
          <InputContrasena id="login-clave" autoComplete="current-password"
            value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} invalido={Boolean(error)} />
        </div>
        <Button type="submit" tamano="lg" cargando={enviando} className="rounded-[10px]">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
