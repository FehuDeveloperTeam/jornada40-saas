import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import client from '../../api/client';
import {
  AlertaError, Button, CampoRut, Casilla, Field, Input, InputContrasena, MedidorContrasena, TarjetaOpcion,
} from '../../components/j40';
import { AuthLayout, EncabezadoForm } from '../../components/sitio/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { formatearPrecio, textoTrabajadores, usePlanes } from '../../hooks/usePlanes';
import type { Plan } from '../../types';
import { cn } from '../../utils/cn';
import { contrasenaAceptable } from '../../utils/contrasena';
import { validateRut } from '../../utils/rutUtils';

type TipoCliente = 'EMPRESA' | 'PERSONA';

interface Cuenta {
  tipo: TipoCliente;
  razonSocial: string;
  nombres: string;
  apellidoPaterno: string;
  rut: string;
  email: string;
  telefono: string;
  password: string;
}

type Errores = Partial<Record<keyof Cuenta | 'general', string>>;

/** Datos que el onboarding reutiliza para no pedirlos dos veces. */
export interface DatosDesdeRegistro {
  tipo: TipoCliente;
  rut: string;
  razonSocial: string;
  plan: string;
}

function validarCuenta(c: Cuenta): Errores {
  const e: Errores = {};
  if (c.tipo === 'EMPRESA' && !c.razonSocial.trim()) e.razonSocial = 'Ingresa la razón social.';
  if (!c.nombres.trim()) e.nombres = 'Ingresa tus nombres.';
  if (!c.apellidoPaterno.trim()) e.apellidoPaterno = 'Ingresa tu apellido.';
  if (!validateRut(c.rut)) e.rut = 'Revisa el RUT.';
  if (!/^\S+@\S+\.\S+$/.test(c.email.trim())) e.email = 'Ingresa un correo válido.';
  if (!contrasenaAceptable(c.password)) e.password = 'Usa al menos 8 caracteres con mayúsculas y números.';
  return e;
}

function errorDelServidor(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 429) return 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
    const mensaje = (error.response?.data as { error?: string } | undefined)?.error;
    if (mensaje) return mensaje;
  }
  return 'No pudimos crear la cuenta. Intenta de nuevo en un momento.';
}

export default function Registro() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const { planes, desdeApi } = usePlanes();

  const [paso, setPaso] = useState<1 | 2>(1);
  const [cuenta, setCuenta] = useState<Cuenta>({
    tipo: 'EMPRESA', razonSocial: '', nombres: '', apellidoPaterno: '', rut: '', email: '', telefono: '', password: '',
  });
  const [errores, setErrores] = useState<Errores>({});
  // Si llega desde una tarjeta de precios trae ?plan=<nivel>; si no, parte en
  // el plan gratis, que es lo que promete el botón "Comenzar gratis".
  const [nivelPlan, setNivelPlan] = useState(() => Number(params.get('plan')) || 1);
  const [terminos, setTerminos] = useState(false);
  const [errorTerminos, setErrorTerminos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Cuenta creada pero el pago no se pudo iniciar: se ofrece seguir en Semilla.
  const [sinPago, setSinPago] = useState('');

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
    const datos: DatosDesdeRegistro = {
      tipo: cuenta.tipo, rut: cuenta.rut, razonSocial: cuenta.razonSocial, plan: planElegido?.nombre ?? 'Semilla',
    };
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
        tipo_cliente: cuenta.tipo,
        razon_social: cuenta.tipo === 'EMPRESA' ? cuenta.razonSocial.trim() : '',
        telefono: cuenta.telefono.trim(),
      });
    } catch (err) {
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

    if (!planElegido || planElegido.precio === 0) { irAlOnboarding(); return; }

    try {
      if (!desdeApi) throw new Error('planes de respaldo sin id');
      // El webhook de Reveniu actualiza una Suscripcion existente y el registro
      // no crea ninguna: esta consulta la crea antes de ir a pagar. Sin ella,
      // el pago entraba pero el plan no se activaba.
      await client.get('/clientes/mi_suscripcion/');
      const { data } = await client.post<{ url: string }>('/pagos/crear-checkout/', {
        plan_id: planElegido.id, ciclo: 'mensual',
      });
      window.location.href = data.url;
    } catch (err) {
      const detalle = isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
      setSinPago(detalle ?? 'El servicio de pago no respondió.');
      setEnviando(false);
    }
  };

  const descripcionLateral = {
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
          Puedes seguir configurando tu empresa y subir de plan más tarde desde Suscripción.
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

          <form onSubmit={continuar} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span id="tipo-cliente" className="text-[12.5px] font-medium text-fg-2">Te registras como</span>
              <div role="radiogroup" aria-labelledby="tipo-cliente" className="grid grid-cols-2 gap-2">
                <TarjetaOpcion seleccionada={cuenta.tipo === 'EMPRESA'} onSeleccionar={() => cambiar('tipo', 'EMPRESA')}
                  titulo="Empresa" detalle="Persona jurídica" />
                <TarjetaOpcion seleccionada={cuenta.tipo === 'PERSONA'} onSeleccionar={() => cambiar('tipo', 'PERSONA')}
                  titulo="Persona natural" detalle="Con giro o empleador particular" />
              </div>
            </div>

            {cuenta.tipo === 'EMPRESA' && (
              <Field etiqueta="Razón social" error={errores.razonSocial}>
                {(p) => <Input {...p} tamano="lg" placeholder="Maestranza Los Andes SpA" autoComplete="organization"
                  value={cuenta.razonSocial} onChange={(e) => cambiar('razonSocial', e.target.value)} />}
              </Field>
            )}

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

            {/* Es el usuario con que se inicia sesión: para una empresa, su RUT. */}
            <CampoRut etiqueta={cuenta.tipo === 'EMPRESA' ? 'RUT de la empresa' : 'RUT'}
              valor={cuenta.rut} onChange={(v) => cambiar('rut', v)} forzarError={Boolean(errores.rut)} />

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

            {(errores.rut || errores.password) && (
              <p role="alert" className="text-[13px] text-danger">
                Revisa el RUT y usa una contraseña de al menos 8 caracteres con mayúsculas y números.
              </p>
            )}
            <Button type="submit" tamano="lg" className="rounded-[10px]">Continuar</Button>
          </form>
        </>
      ) : (
        <>
          <EncabezadoForm titulo="Elige tu plan">
            Puedes cambiarlo cuando quieras. Si eliges un plan pagado, completarás el pago en Reveniu.
          </EncabezadoForm>
          <div role="radiogroup" aria-label="Plan" className="flex flex-col gap-2">
            {planes.map((plan) => (
              <TarjetaOpcion key={plan.nivel}
                seleccionada={plan.nivel === nivelPlan}
                onSeleccionar={() => setNivelPlan(plan.nivel)}
                className="items-center gap-3 p-3.5 rounded-j40-card"
                titulo={<span className="text-[14px] font-semibold">{plan.nombre}</span>}
                detalle={<span className="text-[12px]">{textoTrabajadores(plan)}</span>}
                extremo={<span className="text-[15px] font-semibold j40-num">{formatearPrecio(plan.precio)}</span>}
              />
            ))}
          </div>

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
            <Button tamano="lg" onClick={crearCuenta} cargando={enviando} className="rounded-[10px]">
              {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </div>
        </>
      )}
    </AuthLayout>
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
