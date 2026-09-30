import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { CircleCheck } from 'lucide-react';
import client from '../../api/client';
import { AlertaError, Button, InputContrasena, MedidorContrasena } from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { cn } from '../../utils/cn';
import { contrasenaAceptable } from '../../utils/contrasena';

/**
 * Destino del enlace de invitación (o de recuperación) de un usuario del equipo:
 * /equipo/clave/:uid/:token. El enlace sirve una sola vez.
 */
export default function ClaveEquipo() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [enlaceInvalido, setEnlaceInvalido] = useState(!uid || !token);
  const [lista, setLista] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const coinciden = repetida.length > 0 && repetida === clave;
  const valida = contrasenaAceptable(clave) && coinciden;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valida) return;
    setError('');
    setEnviando(true);
    try {
      await client.post('/auth/equipo/clave/', { uid, token, clave });
      setLista(true);
    } catch (err) {
      const mensaje = isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
      if (mensaje && /enlace/i.test(mensaje)) setEnlaceInvalido(true);
      else setError(mensaje || 'No pudimos guardar la clave. Intenta de nuevo en un momento.');
    } finally {
      setEnviando(false);
    }
  };

  const lateral = {
    titulo: 'Crea tu clave de ingreso.',
    descripcion: 'Con tu RUT y esta clave entrarás a la cuenta que te invitó. Úsala solo en Jornada40.',
  };

  if (lista) {
    return (
      <AuthLayout {...lateral}>
        <span className="grid place-items-center size-[52px] rounded-j40-modal bg-ok-soft text-ok">
          <CircleCheck className="size-7" strokeWidth={2} aria-hidden />
        </span>
        <EncabezadoForm titulo="Tu clave quedó guardada">Ya puedes entrar con tu RUT y tu clave.</EncabezadoForm>
        <Button tamano="lg" onClick={() => navigate('/equipo')} className="rounded-[10px]">Ir al ingreso del equipo</Button>
      </AuthLayout>
    );
  }

  if (enlaceInvalido) {
    return (
      <AuthLayout {...lateral}>
        <EncabezadoForm titulo="El enlace ya no sirve">
          Puede que haya vencido o que ya se haya usado. Pide uno nuevo desde el ingreso del equipo, en “¿La olvidaste?”,
          o pídele al titular que te reenvíe la invitación.
        </EncabezadoForm>
        <Button tamano="lg" onClick={() => navigate('/equipo')} className="rounded-[10px]">Ir al ingreso del equipo</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...lateral}>
      <EncabezadoForm titulo="Crea tu clave" />
      {error && <AlertaError>{error}</AlertaError>}
      <form onSubmit={guardar} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="equipo-nueva-clave" className="text-[12.5px] font-medium text-fg-2">Clave nueva</label>
          <InputContrasena id="equipo-nueva-clave" autoComplete="new-password" aria-describedby="equipo-clave-medidor"
            value={clave} onChange={(e) => setClave(e.target.value)} />
          <MedidorContrasena clave={clave} id="equipo-clave-medidor" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="equipo-nueva-clave-2" className="text-[12.5px] font-medium text-fg-2">Repite la clave</label>
          <InputContrasena id="equipo-nueva-clave-2" autoComplete="new-password" aria-describedby="equipo-clave-2-estado"
            value={repetida} onChange={(e) => setRepetida(e.target.value)} invalido={repetida.length > 0 && !coinciden} />
          {repetida && (
            <span id="equipo-clave-2-estado" aria-live="polite" className={cn('text-[12px]', coinciden ? 'text-ok' : 'text-danger')}>
              {coinciden ? 'Las claves coinciden' : 'Las claves no coinciden'}
            </span>
          )}
        </div>
        <Button type="submit" tamano="lg" disabled={!valida} cargando={enviando} className="rounded-[10px]">
          {enviando ? 'Guardando…' : 'Guardar clave'}
        </Button>
      </form>
      <Link to="/equipo" className="self-center text-[13.5px] font-medium">Ir al ingreso del equipo</Link>
    </AuthLayout>
  );
}
