import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { MailCheck } from 'lucide-react';
import client from '../../api/client';
import { AlertaError, Button, CampoRut, Field, Input, SegmentedControl } from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { validateRut } from '../../utils/rutUtils';

type Modo = 'correo' | 'rut';

export default function Recuperar() {
  const [params] = useSearchParams();
  const [modo, setModo] = useState<Modo>(params.get('modo') === 'rut' ? 'rut' : 'correo');
  const [email, setEmail] = useState('');
  const [rut, setRut] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // null = formulario; string = pantalla de "revisa tu correo" con ese mensaje.
  const [enviado, setEnviado] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (modo === 'correo' && !/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Ingresa un correo válido.'); return; }
    if (modo === 'rut' && !validateRut(rut)) { setError('Revisa el RUT.'); return; }

    setError('');
    setEnviando(true);
    try {
      if (modo === 'correo') {
        // dj-rest-auth responde lo mismo exista o no la cuenta.
        await client.post('/auth/password/reset/', { email: email.trim() });
        setEnviado('Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.');
      } else {
        const { data } = await client.post<{ correo_oculto?: string }>('/auth/recuperar-por-rut/', { rut });
        setEnviado(`Enviamos el enlace al correo asociado a tu RUT: ${data.correo_oculto}.`);
      }
    } catch (err) {
      const estado = isAxiosError(err) ? err.response?.status : undefined;
      if (modo === 'rut' && estado === 404) {
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
          <SegmentedControl etiqueta="Recuperar con" bloque tamano="lg" valor={modo}
            onChange={(m) => { setModo(m); setError(''); }}
            opciones={[{ valor: 'correo', etiqueta: 'Con mi correo' }, { valor: 'rut', etiqueta: 'Con mi RUT' }]} />

          {error && <AlertaError>{error}</AlertaError>}

          <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
            {modo === 'correo' ? (
              <Field etiqueta="Correo electrónico">
                {(p) => <Input {...p} tamano="lg" type="email" autoComplete="email" placeholder="nombre@empresa.cl"
                  value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
            ) : (
              <>
                <CampoRut etiqueta="RUT del titular de la cuenta" valor={rut} onChange={setRut} />
                <p className="text-[12.5px] text-fg-3">
                  Enviaremos el enlace al correo registrado con ese RUT. Por seguridad solo mostramos parte de la dirección.
                </p>
              </>
            )}
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
