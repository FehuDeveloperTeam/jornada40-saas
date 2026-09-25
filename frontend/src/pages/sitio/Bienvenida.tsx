import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Check, FileUp, Lightbulb, Lock, UserPlus } from 'lucide-react';
import client from '../../api/client';
import { lista } from '../../api/lista';
import type { RespuestaLista } from '../../api/lista';
import {
  AlertaError, Button, CampoRut, Field, FirmaPad, Input, J40Root, Logo, ToggleTema,
} from '../../components/j40';
import { useAuth } from '../../context/AuthContext';
import { usePlanes } from '../../hooks/usePlanes';
import type { Empresa } from '../../types';
import { cn } from '../../utils/cn';
import { jornadaMaximaVigente } from '../../utils/ley40';
import { validateRut } from '../../utils/rutUtils';
import type { DatosDesdeRegistro } from './Registro';

// La carga masiva desde Excel es del plan Pyme en adelante (backend: nivel 3).
const NIVEL_CARGA_MASIVA = 3;

const PASOS = [
  { titulo: 'Datos de la empresa', detalle: 'RUT, razón social y domicilio' },
  { titulo: 'Representante legal', detalle: 'Para firmar contratos y documentos' },
  { titulo: 'Tu equipo', detalle: 'Importa o agrega trabajadores' },
];

type DatosEmpresa = { rut: string; nombreLegal: string; alias: string; giro: string; direccion: string; comuna: string; ciudad: string };
type DatosRepresentante = { nombre: string; rut: string; cargo: string; firma: string | null };

function mensajeServidor(error: unknown, porDefecto: string): string {
  if (isAxiosError(error)) {
    const datos = error.response?.data as { error?: string; rut?: string[]; nombre_legal?: string[] } | undefined;
    return datos?.error || datos?.rut?.[0] || datos?.nombre_legal?.[0] || porDefecto;
  }
  return porDefecto;
}

/**
 * Onboarding tras el registro: empresa → representante legal → equipo.
 *
 * La empresa se crea al terminar el paso 1, así que "Completar después" desde
 * el paso 2 o 3 no pierde nada. Si la cuenta ya tiene empresas, el onboarding
 * no aplica y se va al panel.
 */
export default function Bienvenida() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const registro = (useLocation().state as DatosDesdeRegistro | null) ?? null;
  const { planes } = usePlanes();

  const [paso, setPaso] = useState(1);
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Nada se prellena desde el registro: la cuenta es del titular y su RUT no
  // es el de ninguna empresa.
  const [empresa, setEmpresa] = useState<DatosEmpresa>({
    rut: '', nombreLegal: '', alias: '', giro: '', direccion: '', comuna: '', ciudad: '',
  });
  const [rep, setRep] = useState<DatosRepresentante>({ nombre: '', rut: '', cargo: '', firma: null });
  const [intentoPaso, setIntentoPaso] = useState(false);

  const empresas = useQuery({
    queryKey: ['empresas', 'onboarding'],
    queryFn: async () => lista((await client.get<RespuestaLista<Empresa>>('/empresas/')).data),
  });
  const suscripcion = useQuery({
    queryKey: ['mi_suscripcion'],
    queryFn: async () => (await client.get<{ plan: { id: number; nombre: string; nivel?: number } }>('/clientes/mi_suscripcion/')).data,
  });

  // El onboarding es para cuentas nuevas: con empresas ya creadas no aplica.
  useEffect(() => {
    if (empresaId === null && empresas.data && empresas.data.length > 0) navigate('/app', { replace: true });
  }, [empresas.data, empresaId, navigate]);

  const planActual = planes.find((p) => p.id === suscripcion.data?.plan.id);
  const nombrePlan = suscripcion.data?.plan.nombre ?? registro?.plan;
  const permiteCargaMasiva = (suscripcion.data?.plan.nivel ?? planActual?.nivel ?? 1) >= NIVEL_CARGA_MASIVA;

  /** Entra al panel con la empresa recién creada como activa. */
  const irA = (ruta: string) => {
    if (empresaId !== null) {
      // El panel lee la empresa activa desde aquí (ver usePanel.useEmpresaActiva).
      try { localStorage.setItem('empresaActivaId', String(empresaId)); } catch { /* sin almacenamiento: el panel toma la primera */ }
    }
    navigate(ruta);
  };
  const irAlPanel = () => irA('/app');

  const guardarEmpresa = async () => {
    setIntentoPaso(true);
    if (!validateRut(empresa.rut) || !empresa.nombreLegal.trim()) return;
    setGuardando(true);
    setError('');
    try {
      const { data } = await client.post<Empresa>('/empresas/', {
        rut: empresa.rut,
        nombre_legal: empresa.nombreLegal.trim(),
        alias: empresa.alias.trim(),
        giro: empresa.giro.trim(),
        direccion: empresa.direccion.trim(),
        comuna: empresa.comuna.trim(),
        ciudad: empresa.ciudad.trim(),
      });
      setEmpresaId(data.id);
      setIntentoPaso(false);
      setPaso(2);
    } catch (err) {
      setError(mensajeServidor(err, 'No pudimos guardar la empresa. Intenta de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  const guardarRepresentante = async () => {
    setIntentoPaso(true);
    // Todo el paso es opcional, pero lo que se ingrese tiene que ser válido.
    if (rep.rut && !validateRut(rep.rut)) return;
    if (rep.firma && !rep.nombre.trim()) return;
    if (empresaId === null) return;

    setGuardando(true);
    setError('');
    try {
      if (rep.nombre.trim() || rep.rut) {
        await client.patch(`/empresas/${empresaId}/`, {
          representante_legal: rep.nombre.trim(),
          rut_representante: rep.rut,
        });
      }
      if (rep.firma) {
        await client.patch(`/empresas/${empresaId}/configurar-firma/`, {
          firma_imagen: rep.firma,
          firma_firmante_nombre: rep.nombre.trim(),
          firma_firmante_cargo: rep.cargo.trim(),
        });
      }
      setIntentoPaso(false);
      setPaso(3);
    } catch (err) {
      setError(mensajeServidor(err, 'No pudimos guardar el representante. Intenta de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  const siguiente = (e: FormEvent) => {
    e.preventDefault();
    if (paso === 1) guardarEmpresa();
    else if (paso === 2) guardarRepresentante();
  };

  const campoEmpresa = (campo: keyof DatosEmpresa) => ({
    value: empresa[campo],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEmpresa((d) => ({ ...d, [campo]: e.target.value })),
  });
  const campoRep = (campo: 'nombre' | 'cargo') => ({
    value: rep[campo],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRep((d) => ({ ...d, [campo]: e.target.value })),
  });

  const nombre = user?.first_name?.trim();

  return (
    <J40Root className="flex flex-wrap">
      <aside className="flex-[1_1_320px] max-w-full bg-ink text-white p-[clamp(24px,4vw,48px)] flex flex-col gap-8">
        <span className="inline-flex items-center gap-2.5">
          <Logo soloIcono />
          <span className="text-[17px] font-semibold">Jornada<span className="text-[#86BDF5]">40</span></span>
        </span>
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] text-[#86BDF5] font-medium">
            Cuenta creada{nombrePlan ? ` · plan ${nombrePlan}` : ''}
          </span>
          <h1 className="text-[clamp(26px,3vw,34px)] leading-[1.15] font-semibold tracking-[-0.025em] text-balance">
            {nombre ? `Te damos la bienvenida, ${nombre}.` : 'Te damos la bienvenida.'}
          </h1>
          <p className="text-[14.5px] text-white/72 text-pretty">
            Tres pasos para dejar lista tu empresa. Puedes completarlos ahora o volver cuando quieras.
          </p>
        </div>
        <ol className="flex flex-col">
          {PASOS.map((p, i) => {
            const n = i + 1;
            const hecho = paso > n;
            const actual = paso === n;
            return (
              <li key={p.titulo} className="relative flex gap-3.5 pb-[22px]" aria-current={actual ? 'step' : undefined}>
                <span className={cn(
                  'z-[1] grid place-items-center size-[30px] shrink-0 rounded-full border-[1.5px] text-[13px] font-semibold',
                  hecho ? 'bg-ok border-ok text-white' : actual ? 'bg-brand-btn border-brand-btn text-white' : 'bg-transparent border-white/30 text-white/60',
                )}>
                  {hecho ? <Check className="size-[17px]" strokeWidth={2.5} aria-label="Completado" /> : n}
                </span>
                {n < PASOS.length && <span className="absolute left-[14.5px] top-[30px] bottom-0 w-[1.5px] bg-white/18" aria-hidden />}
                <div className="flex flex-col pt-1">
                  <span className={cn('text-[14px] font-medium', hecho || actual ? 'text-white' : 'text-white/62')}>{p.titulo}</span>
                  <span className="text-[12.5px] text-white/55">{p.detalle}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </aside>

      <main className="flex-[2_1_480px] min-w-0 flex flex-col">
        <div className="flex items-center gap-3.5 h-16 px-[clamp(16px,3vw,40px)] border-b border-line">
          <span className="text-[13px] text-fg-3">Paso {paso} de 3</span>
          <div className="flex-1 max-w-[220px] h-[5px] rounded-full bg-sunken overflow-hidden" role="progressbar"
            aria-valuemin={0} aria-valuemax={3} aria-valuenow={paso - 1} aria-label="Avance del onboarding">
            <div className={cn('h-full bg-brand transition-[width] duration-300', ['w-0', 'w-1/3', 'w-2/3'][paso - 1])} />
          </div>
          <div className="flex-1" />
          {/* El panel necesita al menos una empresa: sin ella no hay "después". */}
          {empresaId !== null && (
            <button type="button" onClick={irAlPanel}
              className="bg-transparent text-fg-2 text-[13px] font-medium cursor-pointer hover:text-fg">
              Completar después
            </button>
          )}
          <ToggleTema />
        </div>

        <div className="flex-1 flex justify-center px-[clamp(16px,3vw,40px)] py-[clamp(24px,4vw,48px)]">
          <form onSubmit={siguiente} noValidate className="w-full max-w-[620px] flex flex-col gap-6 j40-anim-pop" key={paso}>
            {error && <AlertaError>{error}</AlertaError>}

            {paso === 1 && (
              <>
                <Encabezado titulo="Datos de la empresa">Aparecen en contratos, liquidaciones y en el archivo Previred.</Encabezado>
                <Grilla>
                  <CampoRut etiqueta="RUT de la empresa" placeholder="76.123.456-7" compacto
                    valor={empresa.rut} onChange={(v) => setEmpresa((d) => ({ ...d, rut: v }))}
                    forzarError={intentoPaso && !validateRut(empresa.rut)} />
                  <Field etiqueta="Razón social" error={intentoPaso && !empresa.nombreLegal.trim() ? 'Ingresa la razón social.' : undefined}>
                    {(p) => <Input {...p} tamano="lg" className="h-11" autoComplete="organization" {...campoEmpresa('nombreLegal')} />}
                  </Field>
                  <Field etiqueta="Nombre de fantasía">
                    {(p) => <Input {...p} tamano="lg" className="h-11" placeholder="Opcional" {...campoEmpresa('alias')} />}
                  </Field>
                  <Field etiqueta="Giro">
                    {(p) => <Input {...p} tamano="lg" className="h-11" {...campoEmpresa('giro')} />}
                  </Field>
                  <Field etiqueta="Dirección" anchoCompleto>
                    {(p) => <Input {...p} tamano="lg" className="h-11" autoComplete="street-address" {...campoEmpresa('direccion')} />}
                  </Field>
                  <Field etiqueta="Comuna">
                    {(p) => <Input {...p} tamano="lg" className="h-11" {...campoEmpresa('comuna')} />}
                  </Field>
                  <Field etiqueta="Ciudad">
                    {(p) => <Input {...p} tamano="lg" className="h-11" autoComplete="address-level2" {...campoEmpresa('ciudad')} />}
                  </Field>
                </Grilla>
              </>
            )}

            {paso === 2 && (
              <>
                <Encabezado titulo="Representante legal">Su firma se estampa en los documentos que emitas desde Jornada40.</Encabezado>
                <Grilla>
                  <Field etiqueta="Nombre completo"
                    error={intentoPaso && rep.firma && !rep.nombre.trim() ? 'Indica de quién es la firma.' : undefined}>
                    {(p) => <Input {...p} tamano="lg" className="h-11" autoComplete="name" {...campoRep('nombre')} />}
                  </Field>
                  <CampoRut etiqueta="RUT" compacto valor={rep.rut}
                    onChange={(v) => setRep((d) => ({ ...d, rut: v }))}
                    forzarError={intentoPaso && Boolean(rep.rut) && !validateRut(rep.rut)} />
                  <Field etiqueta="Cargo" anchoCompleto>
                    {(p) => <Input {...p} tamano="lg" className="h-11" placeholder="Gerente General" {...campoRep('cargo')} />}
                  </Field>
                </Grilla>
                <div className="flex flex-col gap-2">
                  <FirmaPad onChange={(firma) => setRep((d) => ({ ...d, firma }))} />
                  <span className="text-[12px] text-fg-3">Puedes configurarla más tarde desde Empresa.</span>
                </div>
              </>
            )}

            {paso === 3 && (
              <>
                <Encabezado titulo="Tu equipo">Elige cómo quieres cargar a tus trabajadores.</Encabezado>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
                  <OpcionEquipo
                    icono={<FileUp className="size-[26px]" strokeWidth={2} />}
                    titulo="Importar desde Excel"
                    texto="Descarga la planilla, complétala y súbela. Validamos cada RUT antes de guardar."
                    destacada={permiteCargaMasiva}
                    bloqueo={permiteCargaMasiva ? undefined : 'Disponible desde el plan Pyme'}
                    onClick={() => irA('/app/trabajadores/importar')}
                  />
                  <OpcionEquipo
                    icono={<UserPlus className="size-[26px]" strokeWidth={2} />}
                    titulo="Agregar uno por uno"
                    texto="Ideal si tienes pocos trabajadores o quieres partir con uno de prueba."
                    destacada={!permiteCargaMasiva}
                    onClick={() => irA('/app/trabajadores')}
                  />
                </div>
                <div className="flex gap-2.5 items-center p-3.5 rounded-j40-card bg-surface border border-line text-[13px] text-fg-2">
                  <Lightbulb className="size-5 shrink-0 text-fg-3" strokeWidth={2} aria-hidden />
                  Al cargar los contratos, Jornada40 revisa cuáles superan las {jornadaMaximaVigente()} horas y te propone el anexo.
                </div>
              </>
            )}

            <div className="flex gap-2.5 justify-between pt-2 border-t border-line">
              {/* Solo desde el paso 3: volver al 1 crearía la empresa otra vez.
                  Al volver al 2 el lienzo se monta vacío, así que la firma en
                  memoria también se limpia (la anterior ya quedó guardada). */}
              <Button type="button" variante="secundario"
                onClick={() => { setRep((d) => ({ ...d, firma: null })); setPaso(2); }}
                disabled={guardando}
                className={cn('h-[46px] px-[18px] rounded-[10px] text-[14px]', paso < 3 && 'invisible')}>
                Atrás
              </Button>
              {paso === 3 ? (
                <Button type="button" onClick={irAlPanel} className="h-[46px] px-5 rounded-[10px] text-[14px]">Ir a mi panel</Button>
              ) : (
                <Button type="submit" cargando={guardando} className="h-[46px] px-5 rounded-[10px] text-[14px]">
                  {guardando ? 'Guardando…' : 'Guardar y continuar'}
                </Button>
              )}
            </div>
          </form>
        </div>
      </main>
    </J40Root>
  );
}

function Encabezado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-[24px] font-semibold tracking-[-0.02em]">{titulo}</h2>
      <p className="text-fg-2 text-[14px]">{children}</p>
    </div>
  );
}

function Grilla({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3.5">{children}</div>;
}

function OpcionEquipo({ icono, titulo, texto, destacada, bloqueo, onClick }: {
  icono: ReactNode; titulo: string; texto: string; destacada: boolean; bloqueo?: string; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={Boolean(bloqueo)}
      className={cn(
        'flex flex-col gap-2.5 p-5 rounded-j40-modal border-[1.5px] text-left text-fg',
        'disabled:cursor-not-allowed disabled:opacity-60',
        !bloqueo && 'cursor-pointer',
        destacada ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface hover:bg-surface-2',
      )}>
      <span className={destacada ? 'text-brand-text' : 'text-fg-2'}>{icono}</span>
      <span className="text-[15px] font-semibold">{titulo}</span>
      <span className="text-[13px] text-fg-2">{texto}</span>
      {bloqueo && (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-fg-3">
          <Lock className="size-3.5" strokeWidth={2} aria-hidden />{bloqueo}
        </span>
      )}
    </button>
  );
}
