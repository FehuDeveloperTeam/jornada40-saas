import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { MailCheck } from 'lucide-react';
import client from '../../api/client';
import { AlertaError, Button, CampoRut } from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { validateRut } from '../../utils/rutUtils';

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
      const { data } = await client.post<{ correo_oculto?: string }>('/auth/recuperar-por-rut/', { rut });
      setEnviado(`Enviamos el enlace al correo asociado a tu RUT: ${data.correo_oculto}.`);
    } catch (err) {
      const estado = isAxiosError(err) ? err.response?.status : undefined;
      if (estado === 404) {
        // El backend responde 404 si el RUT no existe; aquí se muestra lo mismo
        // que ante un envío para no confirmar qué RUT tienen cuenta.
        setEnviado('Si el RUT está registrado, enviamos un enlace al correo asociado.');
      } else if (estado === 429) {
        setError('Hiciste demasiadas solicitudes. Espera unos minutos y vuelve a intentarlo.');
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
      descripcion="Te enviamos un enlace seguro de un solo uso para crear una contraseña nueva."
    >
      {enviado ? (
        <>
          <span className="grid place-items-center size-[52px] rounded-j40-modal bg-ok-soft text-ok">
            <MailCheck className="size-7" strokeWidth={2} aria-hidden />
          </span>
          <EncabezadoForm titulo="Revisa tu correo">{enviado}</EncabezadoForm>
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
              ayuda="Enviaremos el enlace al correo registrado con ese RUT. Por seguridad solo mostramos parte de la dirección." />
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
