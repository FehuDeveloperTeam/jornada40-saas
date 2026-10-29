import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gift } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import client from '../../api/client';
import { irAPagar } from '../../api/pagos';
import type { Checkout as RespuestaCheckout } from '../../api/pagos';
import {
  AlertaError, Button, CampoRut, Casilla, Field, Input, InputContrasena, MedidorContrasena, TarjetaOpcion,
} from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { formatearPrecio, precioCiclo, textoTrabajadores, usePlanes } from '../../hooks/usePlanes';
import type { Ciclo } from '../../hooks/usePlanes';
import { SelectorCiclo } from '../../components/sitio/SelectorCiclo';
import type { Plan } from '../../types';
import { cn } from '../../utils/cn';
import { problemaContrasena } from '../../utils/contrasena';
import { fechaCL } from '../../utils/formato';
import { esRutDePersona, validateRut } from '../../utils/rutUtils';

// La cuenta es siempre de una persona: el titular. Sus empresas se crean
// después (onboarding o lobby) y cada una tiene su propio RUT. Así una
// empresa nunca es la "puerta de entrada" de otra.
interface Cuenta {
  nombres: string;
  apellidoPaterno: string;
  rut: string;
  email: string;
  telefono: string;
  password: string;
}

type Errores = Partial<Record<keyof Cuenta | 'general', string>>;

/** Lo que el onboarding recibe del registro. */
export interface DatosDesdeRegistro {
  plan: string;
}

/** Lo que da un código de prueba (POST /auth/codigo-prueba/) y el texto con que se usará al registrarse. */
interface CodigoPrueba {
  codigo: string;
  plan: { nombre: string; nivel: number };
  meses: number;
  /** Último día de la prueba si la cuenta se crea hoy. */
  hasta: string;
}
type RespuestaCodigo = Omit<CodigoPrueba, 'codigo'>;

function validarCuenta(c: Cuenta): Errores {
  const e: Errores = {};
  if (!c.nombres.trim()) e.nombres = 'Ingresa tus nombres.';
  if (!c.apellidoPaterno.trim()) e.apellidoPaterno = 'Ingresa tu apellido.';
  if (!validateRut(c.rut)) e.rut = 'Revisa el RUT: el dígito verificador no calza.';
  else if (!esRutDePersona(c.rut)) e.rut = 'Ese RUT es de una empresa. Usa tu RUT personal: las empresas se agregan después.';
  if (!/^\S+@\S+\.\S+$/.test(c.email.trim())) e.email = 'Ingresa un correo válido.';
  const problema = problemaContrasena(c.password);
  if (problema) e.password = problema;
  return e;
}

function errorDelServidor(error: unknown, porDefecto = 'No pudimos crear la cuenta. Intenta de nuevo en un momento.'): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 429) return 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
    const mensaje = (error.response?.data as { error?: string } | undefined)?.error;
    if (mensaje) return mensaje;
  }
  return porDefecto;
}

const esErrorDelCodigo = (error: unknown) =>
  isAxiosError(error) && (error.response?.data as { campo?: string } | undefined)?.campo === 'codigo_prueba';

export default function Registro() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const { planes, desdeApi } = usePlanes();

  const [paso, setPaso] = useState<1 | 2>(1);
  const [cuenta, setCuenta] = useState<Cuenta>({
    nombres: '', apellidoPaterno: '', rut: '', email: '', telefono: '', password: '',
  });
  const [errores, setErrores] = useState<Errores>({});
  // Si llega desde una tarjeta de precios trae ?plan=<nivel>; si no, parte en
  // el plan gratis, que es lo que promete el botón "Comenzar gratis".
  const [nivelPlan, setNivelPlan] = useState(() => Number(params.get('plan')) || 1);
  const [ciclo, setCiclo] = useState<Ciclo>(() => (params.get('ciclo') === 'anual' ? 'anual' : 'mensual'));
  const [terminos, setTerminos] = useState(false);
  const [errorTerminos, setErrorTerminos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Cuenta creada pero el pago no se pudo iniciar: se ofrece seguir en Semilla.
  const [sinPago, setSinPago] = useState('');
  // Código de prueba: llega en el enlace (?codigo=) o se escribe en el paso 2. Lo revisa el backend
  // (sin usarlo: se usa al crear la cuenta).
  const codigoEnlace = params.get('codigo')?.trim() ?? '';
  const revisionEnlace = useQuery({
    queryKey: ['codigo-prueba', codigoEnlace],
    queryFn: async () => (await client.post<RespuestaCodigo>('/auth/codigo-prueba/', { codigo: codigoEnlace })).data,
    enabled: Boolean(codigoEnlace),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  // undefined: rige el código del enlace; null o un código: lo que se quitó o aplicó en el paso 2.
  const [elegida, setElegida] = useState<CodigoPrueba | null>();
  const prueba: CodigoPrueba | null = elegida !== undefined ? elegida
    : revisionEnlace.data ? { ...revisionEnlace.data, codigo: codigoEnlace } : null;
  const [textoCodigo, setTextoCodigo] = useState(codigoEnlace);
  const [conCodigo, setConCodigo] = useState(Boolean(codigoEnlace));
  const [errorManual, setErrorManual] = useState('');
  const errorCodigo = errorManual || (elegida === undefined && revisionEnlace.isError
    ? errorDelServidor(revisionEnlace.error, 'No pudimos revisar el código. Intenta de nuevo en un momento.') : '');
  const [revisando, setRevisando] = useState(false);

  const revisarCodigo = async () => {
    const texto = textoCodigo.trim();
    if (!texto) { setErrorManual('Escribe el código de prueba.'); return; }
    setRevisando(true);
    setErrorManual('');
    try {
      const { data } = await client.post<RespuestaCodigo>('/auth/codigo-prueba/', { codigo: texto });
      setElegida({ ...data, codigo: texto });
    } catch (err) {
      setElegida(null);
      setErrorManual(errorDelServidor(err, 'No pudimos revisar el código. Intenta de nuevo en un momento.'));
    } finally {
      setRevisando(false);
    }
  };
  const quitarCodigo = () => {
    setElegida(null);
    setConCodigo(false);
    setTextoCodigo('');
    setErrorManual('');
  };

  const cambiar = <K extends keyof Cuenta>(campo: K, valor: Cuenta[K]) => {
    setCuenta((c) => ({ ...c, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined, general: undefined }));
  };

  const continuar = (e: FormEvent) => {
    e.preventDefault();
    const encontrados = validarCuenta(cuenta);
    setErrores(encontrados);
    if (Object.keys(encontrados).length === 0) setPaso(2);
  };

  const planElegido: Plan | undefined = planes.find((p) => p.nivel === nivelPlan) ?? planes[0];

  const irAlOnboarding = () => {
    const datos: DatosDesdeRegistro = { plan: prueba?.plan.nombre ?? planElegido?.nombre ?? 'Semilla' };
    navigate('/bienvenida', { state: datos });
  };

  const crearCuenta = async () => {
    if (!terminos) { setErrorTerminos(true); return; }
    setEnviando(true);
    setErrores({});

    try {
      await client.post('/auth/register/', {
        rut: cuenta.rut,
        password: cuenta.password,
        email: cuenta.email.trim(),
        nombres: cuenta.nombres.trim(),
        apellido_paterno: cuenta.apellidoPaterno.trim(),
        tipo_cliente: 'PERSONA',
        telefono: cuenta.telefono.trim(),
        ...(prueba ? { codigo_prueba: prueba.codigo } : {}),
      });
    } catch (err) {
      if (esErrorDelCodigo(err)) {
        // El código se usó o venció mientras completaba el formulario: se queda en el paso 2.
        setElegida(null);
        setConCodigo(true);
        setErrorManual(errorDelServidor(err));
        setEnviando(false);
        return;
      }
      // Casi siempre es el RUT repetido, que está en el paso 1.
      setErrores({ general: errorDelServidor(err) });
      setPaso(1);
      setEnviando(false);
      return;
    }

    try {
      await login({ username: cuenta.rut, password: cuenta.password });
    } catch {
      // La cuenta ya existe (p. ej. el límite de intentos de login cortó el
      // inicio automático). Hay que decirlo: si no, el usuario intenta
      // registrarse de nuevo y choca con "RUT ya registrado".
      navigate('/login', { state: { cuentaCreada: true } });
      return;
    }

    // Con código de prueba no hay pago: el plan ya quedó activo hasta el fin de la prueba.
    if (prueba || !planElegido || planElegido.precio === 0) { irAlOnboarding(); return; }

    try {
      if (!desdeApi) throw new Error('planes de respaldo sin id');
      // El webhook de Reveniu actualiza una Suscripcion existente y el registro
      // no crea ninguna: esta consulta la crea antes de ir a pagar. Sin ella,
      // el pago entraba pero el plan no se activaba.
      await client.get('/clientes/mi_suscripcion/');
      const { data } = await client.post<RespuestaCheckout>('/pagos/crear-checkout/', {
        plan_id: planElegido.id, ciclo: planElegido.precio_anual ? ciclo : 'mensual',
      });
      irAPagar(data);  // el pago se confirma por webhook
    } catch (err) {
      const detalle = isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
      setSinPago(detalle ?? 'El servicio de pago no respondió.');
      setEnviando(false);
    }
  };

  const descripcionLateral = prueba ? {
    titulo: `Prueba el plan ${prueba.plan.nombre} gratis.`,
    descripcion: `Tu código te da ${prueba.meses} ${prueba.meses === 1 ? 'mes' : 'meses'} del plan ${prueba.plan.nombre}, sin tarjeta. Al terminar decides si lo contratas; si no, sigues gratis en el plan Semilla con tus datos guardados.`,
  } : {
    titulo: 'Empieza hoy, ajusta tu jornada a tiempo.',
    descripcion: 'El plan Semilla es gratis hasta 3 trabajadores y no pide tarjeta.',
  };

  if (sinPago) {
    return (
      <AuthLayout {...descripcionLateral}>
        <EncabezadoForm titulo="Tu cuenta está lista">
          Quedó creada en el plan Semilla, pero no pudimos iniciar el pago del plan {planElegido?.nombre}.
        </EncabezadoForm>
        <AlertaError>{sinPago}</AlertaError>
        <p className="text-[14px] text-fg-2">
          Puedes seguir configurando tu empresa y subir de plan más tarde desde Plan y facturación.
        </p>
        <Button tamano="lg" onClick={irAlOnboarding} className="rounded-[10px]">Continuar</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...descripcionLateral}>
      <Pasos actual={paso} />

      {paso === 1 ? (
        <>
          <EncabezadoForm titulo="Crea tu cuenta">
            ¿Ya tienes una? <Link to="/login" className="font-medium">Inicia sesión</Link>
          </EncabezadoForm>
          {errores.general && <AlertaError>{errores.general}</AlertaError>}
          {prueba && <AvisoPrueba prueba={prueba} />}
          {!prueba && errorCodigo && <AlertaError>{errorCodigo} Puedes crear la cuenta igual y elegir un plan.</AlertaError>}

          <form onSubmit={continuar} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
              <Field etiqueta="Nombres" error={errores.nombres}>
                {(p) => <Input {...p} tamano="lg" autoComplete="given-name"
                  value={cuenta.nombres} onChange={(e) => cambiar('nombres', e.target.value)} />}
              </Field>
              <Field etiqueta="Apellido paterno" error={errores.apellidoPaterno}>
                {(p) => <Input {...p} tamano="lg" autoComplete="family-name"
                  value={cuenta.apellidoPaterno} onChange={(e) => cambiar('apellidoPaterno', e.target.value)} />}
              </Field>
            </div>

            {/* Es el usuario con que se inicia sesión: siempre el RUT personal. */}
            <CampoRut etiqueta="Tu RUT (titular de la cuenta)"
              valor={cuenta.rut} onChange={(v) => cambiar('rut', v)} forzarError={Boolean(errores.rut)}
              ayuda="Tu RUT personal, no el de tu empresa: con él entrarás a todas las empresas que administres." />
            {errores.rut && <p role="alert" className="-mt-2 text-[12.5px] text-danger">{errores.rut}</p>}

            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
              <Field etiqueta="Correo electrónico" error={errores.email}>
                {(p) => <Input {...p} tamano="lg" type="email" autoComplete="email"
                  value={cuenta.email} onChange={(e) => cambiar('email', e.target.value)} />}
              </Field>
              <Field etiqueta="Teléfono">
                {(p) => <Input {...p} tamano="lg" type="tel" autoComplete="tel" placeholder="+56 9"
                  value={cuenta.telefono} onChange={(e) => cambiar('telefono', e.target.value)} />}
              </Field>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-clave" className="text-[12.5px] font-medium text-fg-2">Contraseña</label>
              <InputContrasena id="reg-clave" autoComplete="new-password" aria-describedby="reg-clave-medidor"
                value={cuenta.password} onChange={(e) => cambiar('password', e.target.value)}
                invalido={Boolean(errores.password)} />
              <MedidorContrasena clave={cuenta.password} id="reg-clave-medidor" />
            </div>

            {errores.password && (
              <p role="alert" className="text-[13px] text-danger">{errores.password}</p>
            )}
            <Button type="submit" tamano="lg" className="rounded-[10px]">Continuar</Button>
          </form>
        </>
      ) : prueba ? (
        <>
          <EncabezadoForm titulo="Tu plan de prueba">
            Tu código te da el plan {prueba.plan.nombre} sin costo. No te pediremos tarjeta.
          </EncabezadoForm>
          <AvisoPrueba prueba={prueba} />
          <p className="text-[13px] text-fg-2">
            Te avisaremos por correo antes de que termine. Si no contratas, tu cuenta pasa al plan gratuito Semilla sin
            perder tus datos.
          </p>
          <button type="button" onClick={quitarCodigo}
            className="self-start text-[13px] font-medium text-brand-text underline cursor-pointer">
            No usar el código y elegir otro plan
          </button>
        </>
      ) : (
        <>
          <EncabezadoForm titulo="Elige tu plan">
            Puedes cambiarlo cuando quieras. Si eliges un plan pagado, completarás el pago en Reveniu.
          </EncabezadoForm>
          <SelectorCiclo valor={ciclo} onChange={setCiclo} className="self-start" />
          <div role="radiogroup" aria-label="Plan" className="flex flex-col gap-2">
            {planes.map((plan) => (
              <TarjetaOpcion key={plan.nivel}
                seleccionada={plan.nivel === planElegido?.nivel}
                onSeleccionar={() => setNivelPlan(plan.nivel)}
                className="items-center gap-3 p-3.5 rounded-j40-card"
                titulo={<span className="text-[14px] font-semibold">{plan.nombre}</span>}
                detalle={<span className="text-[12px]">{textoTrabajadores(plan)}</span>}
                extremo={<span className="text-[15px] font-semibold j40-num">{formatearPrecio(precioCiclo(plan, ciclo))}
                  {plan.precio > 0 && <span className="text-[11.5px] font-normal text-fg-3">{ciclo === 'anual' && plan.precio_anual ? ' /año' : ' /mes'}</span>}</span>}
              />
            ))}
          </div>

          {conCodigo ? (
            <form noValidate className="flex flex-col gap-1.5"
              onSubmit={(e) => { e.preventDefault(); void revisarCodigo(); }}>
              <label htmlFor="reg-codigo" className="text-[12.5px] font-medium text-fg-2">Código de prueba</label>
              <div className="flex gap-2.5">
                <Input id="reg-codigo" tamano="lg" mono autoComplete="off" autoCapitalize="characters" spellCheck={false}
                  placeholder="PYME-XXXX-XXXX-XXXX" value={textoCodigo} className="flex-1 min-w-0"
                  invalido={Boolean(errorCodigo)} aria-describedby={errorCodigo ? 'reg-codigo-error' : undefined}
                  onChange={(e) => { setTextoCodigo(e.target.value); setErrorManual(''); }} />
                <Button type="submit" tamano="lg" variante="secundario" cargando={revisando} className="rounded-[10px]">
                  Aplicar
                </Button>
              </div>
              {errorCodigo && <p id="reg-codigo-error" role="alert" className="text-[12.5px] text-danger">{errorCodigo}</p>}
            </form>
          ) : (
            <button type="button" onClick={() => setConCodigo(true)}
              className="self-start text-[13px] font-medium text-brand-text underline cursor-pointer">
              Tengo un código de prueba
            </button>
          )}
        </>
      )}

      {paso === 2 && (
        <>
          <div className="flex flex-col gap-2">
            <Casilla marcada={terminos} invalida={errorTerminos && !terminos}
              onChange={(v) => { setTerminos(v); setErrorTerminos(false); }}>
              Acepto los <Link to="/terminos" target="_blank">términos y condiciones</Link> y
              la <Link to="/terminos" target="_blank">política de privacidad</Link>.
            </Casilla>
            {errorTerminos && !terminos && (
              <p role="alert" className="text-[13px] text-danger">Debes aceptar los términos para crear la cuenta.</p>
            )}
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-2.5">
            <Button tamano="lg" variante="secundario" onClick={() => setPaso(1)} disabled={enviando}
              className="rounded-[10px] px-[18px]">
              Atrás
            </Button>
            <Button tamano="lg" onClick={crearCuenta} cargando={enviando} disabled={revisando || revisionEnlace.isFetching}
              className="rounded-[10px]">
              {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </div>
        </>
      )}
    </AuthLayout>
  );
}

function AvisoPrueba({ prueba }: { prueba: CodigoPrueba }) {
  return (
    <div role="status" className="flex items-start gap-2.5 px-3.5 py-3 rounded-[10px] bg-brand-soft text-brand-text text-[13.5px]">
      <Gift className="size-[19px] shrink-0 mt-px" strokeWidth={2} aria-hidden />
      <span>
        <strong className="font-semibold">Plan {prueba.plan.nombre} gratis por {prueba.meses} {prueba.meses === 1 ? 'mes' : 'meses'}</strong>
        {' '}con tu código de prueba: si creas la cuenta hoy, dura hasta el {fechaCL(prueba.hasta)}.
      </span>
    </div>
  );
}

function Pasos({ actual }: { actual: 1 | 2 }) {
  return (
    <ol className="flex items-center gap-2.5" aria-label={`Paso ${actual} de 2`}>
      {['Tu cuenta', 'Plan'].map((texto, i) => {
        const hecho = actual >= i + 1;
        return (
          <li key={texto} className="flex items-center gap-2" aria-current={actual === i + 1 ? 'step' : undefined}>
            <span className={cn('grid place-items-center size-6 rounded-full text-[12px] font-semibold',
              hecho ? 'bg-brand-btn text-white' : 'bg-sunken text-fg-3')}>
              {i + 1}
            </span>
            <span className={cn('text-[13px] font-medium', hecho ? 'text-fg' : 'text-fg-3')}>{texto}</span>
          </li>
        );
      })}
    </ol>
  );
}
