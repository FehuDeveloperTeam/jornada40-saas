import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { CircleCheck, IdCard } from 'lucide-react';
import { AlertaError, Button, Field, Input, InputContrasena } from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import type { LoginData } from '../../context/AuthContext';
import { formatRut, validateRut } from '../../utils/rutUtils';

/**
 * El handoff pide iniciar sesión con correo, pero las cuentas existentes
 * entran con RUT (es el `username` en Django). El campo acepta ambos: si trae
 * "@" se envía como correo; si no, como RUT con el formato de rutUtils, que es
 * el mismo con que se guardó al registrarse.
 */
function credenciales(identificador: string, password: string): LoginData | null {
  const valor = identificador.trim();
  if (valor.includes('@')) return { email: valor, password };
  if (!validateRut(valor)) return null;
  return { username: formatRut(valor), password };
}

function mensajeDeError(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 400) return 'Revisa tu correo o RUT y tu contraseña.';
    if (error.response?.status === 429) return 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
  }
  return 'No pudimos iniciar sesión. Intenta de nuevo en un momento.';
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  // Avisos que llegan desde otras pantallas: /reset-password tras guardar la
  // contraseña, o el registro si el inicio de sesión automático falló.
  const aviso = useLocation().state as { contrasenaActualizada?: boolean; cuentaCreada?: boolean } | null;
  const mensajeOk = aviso?.contrasenaActualizada
    ? 'Tu contraseña quedó actualizada. Ya puedes iniciar sesión.'
    : aviso?.cuentaCreada
      ? 'Tu cuenta quedó creada. Inicia sesión para continuar.'
      : '';
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const datos = credenciales(identificador, password);
    if (!datos || !password) {
      setError(!datos ? 'Ingresa un correo o un RUT válido.' : 'Ingresa tu contraseña.');
      return;
    }
    setError('');
    setEnviando(true);
    try {
      await login(datos);
      navigate('/empresas');
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  };

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
        <Field etiqueta="Correo o RUT">
          {(p) => (
            <Input {...p} tamano="lg" autoComplete="username" placeholder="nombre@empresa.cl"
              value={identificador} onChange={(e) => setIdentificador(e.target.value)} invalido={Boolean(error)} />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline">
            <label htmlFor="login-clave" className="text-[12.5px] font-medium text-fg-2">Contraseña</label>
            <Link to="/forgot-password" className="text-[12.5px] font-medium">¿La olvidaste?</Link>
          </div>
          <InputContrasena id="login-clave" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} invalido={Boolean(error)} />
        </div>
        <Button type="submit" tamano="lg" cargando={enviando} className="rounded-[10px]">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-fg-3 text-[12px]" aria-hidden>
        <span className="flex-1 h-px bg-line" />¿No recuerdas tu correo?<span className="flex-1 h-px bg-line" />
      </div>
      <Button variante="secundario" onClick={() => navigate('/forgot-password?modo=rut')}
        className="h-[46px] rounded-[10px] text-[14px]"
        iconoInicio={<IdCard className="size-[19px] text-fg-3" strokeWidth={2} />}>
        Recuperar acceso con mi RUT
      </Button>
    </AuthLayout>
  );
}
