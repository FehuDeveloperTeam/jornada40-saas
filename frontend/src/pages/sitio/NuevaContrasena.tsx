import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import client from '../../api/client';
import { AlertaError, Button, InputContrasena, MedidorContrasena } from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { cn } from '../../utils/cn';
import { contrasenaAceptable } from '../../utils/contrasena';

type RespuestaError = { new_password1?: string[]; new_password2?: string[]; token?: string[]; uid?: string[] };

/**
 * Destino del enlace del correo de recuperación. La ruta
 * /reset-password/:uid/:token la fija el backend (PASSWORD_RESET_CONFIRM_URL),
 * así que no puede cambiar.
 */
export default function NuevaContrasena() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [enlaceInvalido, setEnlaceInvalido] = useState(!uid || !token);
  const [enviando, setEnviando] = useState(false);

  const coinciden = repetida.length > 0 && repetida === clave;
  const lista = contrasenaAceptable(clave) && coinciden;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!lista) return;
    setError('');
    setEnviando(true);
    try {
      await client.post('/auth/password/reset/confirm/', {
        uid, token, new_password1: clave, new_password2: repetida,
      });
      navigate('/login', { state: { contrasenaActualizada: true } });
    } catch (err) {
      const datos = isAxiosError(err) ? (err.response?.data as RespuestaError | undefined) : undefined;
      if (datos?.token || datos?.uid) {
        setEnlaceInvalido(true);
      } else {
        // Los validadores de Django (contraseña muy común, muy parecida al
        // usuario…) responden en new_password2.
        setError(datos?.new_password2?.join(' ') || datos?.new_password1?.join(' ')
          || 'No pudimos guardar la contraseña. Intenta de nuevo en un momento.');
      }
      setEnviando(false);
    }
  };

  const lateral = {
    titulo: 'Crea una contraseña nueva.',
    descripcion: 'Úsala solo en Jornada40 y guárdala en tu gestor de contraseñas.',
  };

  if (enlaceInvalido) {
    return (
      <AuthLayout {...lateral}>
        <EncabezadoForm titulo="El enlace ya no sirve">
          Puede que haya vencido o que ya se haya usado. Pide uno nuevo y ábrelo desde el último correo que te llegue.
        </EncabezadoForm>
        <Button tamano="lg" onClick={() => navigate('/forgot-password')} className="rounded-[10px]">
          Pedir un enlace nuevo
        </Button>
        <Link to="/login" className="self-center text-[13.5px] font-medium">Volver a iniciar sesión</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...lateral}>
      <EncabezadoForm titulo="Nueva contraseña" />
      {error && <AlertaError>{error}</AlertaError>}
      <form onSubmit={guardar} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nueva-clave" className="text-[12.5px] font-medium text-fg-2">Nueva contraseña</label>
          <InputContrasena id="nueva-clave" autoComplete="new-password" aria-describedby="nueva-clave-medidor"
            value={clave} onChange={(e) => setClave(e.target.value)} />
          <MedidorContrasena clave={clave} id="nueva-clave-medidor" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nueva-clave-2" className="text-[12.5px] font-medium text-fg-2">Repite la contraseña</label>
          <InputContrasena id="nueva-clave-2" autoComplete="new-password" aria-describedby="nueva-clave-2-estado"
            value={repetida} onChange={(e) => setRepetida(e.target.value)} invalido={repetida.length > 0 && !coinciden} />
          {repetida && (
            <span id="nueva-clave-2-estado" aria-live="polite" className={cn('text-[12px]', coinciden ? 'text-ok' : 'text-danger')}>
              {coinciden ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
            </span>
          )}
        </div>
        <Button type="submit" tamano="lg" disabled={!lista} cargando={enviando} className="rounded-[10px]">
          {enviando ? 'Guardando…' : 'Guardar y volver a iniciar sesión'}
        </Button>
      </form>
    </AuthLayout>
  );
}
