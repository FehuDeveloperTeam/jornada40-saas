import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { MailCheck } from 'lucide-react';
import client from '../../api/client';
import { AlertaError, Button, CampoRut } from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { validateRut } from '../../utils/rutUtils';

/** El backend permite 2 solicitudes por hora (por IP y por RUT: throttle password_reset). */
const LIMITE_POR_HORA = 2;

/** Minutos que faltan según el 429 de DRF: encabezado Retry-After o "Expected available in N seconds". */
function minutosDeEspera(err: unknown): number | null {
  if (!isAxiosError(err)) return null;
  const encabezado = Number(err.response?.headers?.['retry-after']);
  const detalle = (err.response?.data as { detail?: string } | undefined)?.detail ?? '';
  const segundos = Number.isFinite(encabezado) && encabezado > 0 ? encabezado : Number(/(\d+)\s*second/.exec(detalle)?.[1]);
  return Number.isFinite(segundos) && segundos > 0 ? Math.max(1, Math.ceil(segundos / 60)) : null;
}

/**
 * Recuperación solo por RUT, igual que el ingreso: el correo no identifica a
 * una cuenta porque puede repetirse. El enlace llega al correo registrado con
 * ese RUT.
 */
export default function Recuperar() {
  const [rut, setRut] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // null = formulario; string = pantalla de "revisa tu correo" con ese mensaje.
  const [enviado, setEnviado] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateRut(rut)) { setError('Ingresa un RUT válido.'); return; }

    setError('');
    setEnviando(true);
    try {
      // El backend responde lo mismo exista o no la cuenta, y no revela el
      // correo: así no se puede averiguar qué RUT tienen cuenta.
      await client.post('/auth/recuperar-por-rut/', { rut });
      setEnviado('Si el RUT está registrado, enviamos un enlace al correo asociado. Vence en 24 horas.');
    } catch (err) {
      const estado = isAxiosError(err) ? err.response?.status : undefined;
      if (estado === 400) {
        setError('Ingresa un RUT válido.');
      } else if (estado === 429) {
        const minutos = minutosDeEspera(err);
        setError(`Ya pediste ${LIMITE_POR_HORA} enlaces en la última hora, que es el máximo. `
          + (minutos
            ? `Podrás pedir otro en ${minutos === 1 ? '1 minuto' : `${minutos} minutos`}. `
            : 'Podrás pedir otro dentro de una hora. ')
          + 'Mientras, revisa el último correo que te enviamos (también en spam).');
      } else {
        setError('No pudimos enviar el enlace. Intenta de nuevo en un momento.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AuthLayout
      titulo="Recupera el acceso en minutos."
      descripcion="Te enviamos un enlace seguro de un solo uso, válido por 24 horas."
    >
      {enviado ? (
        <>
          <span className="grid place-items-center size-[52px] rounded-j40-modal bg-ok-soft text-ok">
            <MailCheck className="size-7" strokeWidth={2} aria-hidden />
          </span>
          <EncabezadoForm titulo="Revisa tu correo">{enviado}</EncabezadoForm>
          <p className="text-[12.5px] text-fg-3">
            Puede tardar unos minutos y a veces llega a spam. Puedes pedir hasta {LIMITE_POR_HORA} enlaces por hora; usa el del último correo.
          </p>
          <div className="flex justify-between gap-2.5 flex-wrap text-[13.5px]">
            <button type="button" onClick={() => setEnviado(null)}
              className="bg-transparent p-0 text-brand-text font-medium cursor-pointer hover:underline">
              No me llegó, reenviar
            </button>
            <Link to="/login" className="font-medium">Volver a iniciar sesión</Link>
          </div>
        </>
      ) : (
        <>
          <EncabezadoForm titulo="Recupera tu contraseña">Te enviaremos un enlace para crear una nueva.</EncabezadoForm>

          {error && <AlertaError>{error}</AlertaError>}

          <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
            <CampoRut etiqueta="RUT del titular de la cuenta" valor={rut} onChange={(v) => { setRut(v); setError(''); }}
              autoComplete="username" forzarError={Boolean(error) && !validateRut(rut)}
              ayuda="Enviaremos el enlace al correo registrado con ese RUT." />
            <Button type="submit" tamano="lg" cargando={enviando} className="rounded-[10px]">
              {enviando ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </form>
          <Link to="/login" className="self-center text-[13.5px] font-medium">Volver a iniciar sesión</Link>
        </>
      )}
    </AuthLayout>
  );
}
