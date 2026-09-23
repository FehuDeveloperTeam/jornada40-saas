import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Check, LogOut, Minus } from 'lucide-react';
import { AlertaError, Button, Input, InputContrasena, MedidorContrasena, SegmentedControl, ToggleTema } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { contrasenaAceptable } from '../../utils/contrasena';
import { cn } from '../../utils/cn';

interface Perfil {
  rut: string;
  tipo_cliente: 'PERSONA' | 'EMPRESA';
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  razon_social: string;
  email: string;
  telefono: string;
  direccion: string;
}

/** Primer mensaje de error de una respuesta de DRF / dj-rest-auth. */
function mensaje(err: unknown, porDefecto: string): string {
  if (!isAxiosError(err)) return porDefecto;
  const d = err.response?.data as Record<string, unknown> | undefined;
  if (!d) return porDefecto;
  if (typeof d.error === 'string') return d.error;
  const primero = Object.values(d).flat()[0];
  return typeof primero === 'string' ? primero : porDefecto;
}

export default function Cuenta() {
  const perfil = useQuery({ queryKey: ['perfil'], queryFn: async () => (await client.get<Perfil>('/clientes/perfil/')).data });
  return (
    <div className="max-w-[860px] mx-auto flex flex-col gap-5 pb-20">
      <div>
        <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Mi cuenta</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">Datos del titular, contraseña y preferencias</p>
      </div>
      {perfil.data ? <DatosTitular key={JSON.stringify(perfil.data)} guardado={perfil.data} /> : <p className="text-[14px] text-fg-3" role="status">Cargando…</p>}
      <CambioClave />
      <Preferencias />
    </div>
  );
}

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card p-[18px] flex flex-col gap-4">
      <div><h2 className="text-[15px] font-semibold">{titulo}</h2>{nota && <p className="text-[12.5px] text-fg-3">{nota}</p>}</div>
      {children}
    </section>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 min-w-0"><span className="text-[12.5px] font-medium text-fg-2">{etiqueta}</span>{children}</label>;
}

function DatosTitular({ guardado }: { guardado: Perfil }) {
  const { avisar } = usePanelContexto();
  const queryClient = useQueryClient();
  const [borrador, setBorrador] = useState(guardado);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambios = (Object.keys(guardado) as (keyof Perfil)[]).some((k) => borrador[k] !== guardado[k]);
  const poner = (k: keyof Perfil) => (e: { target: { value: string } }) => setBorrador((b) => ({ ...b, [k]: e.target.value }));

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const { data } = await client.patch<Perfil>('/clientes/perfil/', borrador);
      queryClient.setQueryData(['perfil'], data);
      avisar('Datos guardados');
    } catch (err) {
      setError(mensaje(err, 'No pudimos guardar tus datos.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Seccion titulo="Datos del titular" nota="El RUT es tu usuario para ingresar y no se puede cambiar.">
      {error && <AlertaError>{error}</AlertaError>}
      <SegmentedControl etiqueta="Tipo de cliente" valor={borrador.tipo_cliente} bloque
        onChange={(v) => setBorrador((b) => ({ ...b, tipo_cliente: v }))}
        opciones={[{ valor: 'PERSONA', etiqueta: 'Persona natural' }, { valor: 'EMPRESA', etiqueta: 'Empresa' }]} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3.5">
        <Campo etiqueta="RUT del titular"><Input mono value={guardado.rut} disabled readOnly /></Campo>
        {borrador.tipo_cliente === 'EMPRESA' && (
          <Campo etiqueta="Razón social"><Input value={borrador.razon_social} onChange={poner('razon_social')} /></Campo>
        )}
        <Campo etiqueta="Nombres"><Input value={borrador.nombres} onChange={poner('nombres')} /></Campo>
        <Campo etiqueta="Apellido paterno"><Input value={borrador.apellido_paterno} onChange={poner('apellido_paterno')} /></Campo>
        <Campo etiqueta="Apellido materno"><Input value={borrador.apellido_materno} onChange={poner('apellido_materno')} /></Campo>
        <Campo etiqueta="Correo"><Input type="email" value={borrador.email} onChange={poner('email')} /></Campo>
        <Campo etiqueta="Teléfono"><Input type="tel" value={borrador.telefono} onChange={poner('telefono')} placeholder="+56 9 1234 5678" /></Campo>
        <Campo etiqueta="Dirección"><Input value={borrador.direccion} onChange={poner('direccion')} /></Campo>
      </div>
      {cambios && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[84px] min-[720px]:bottom-6 z-[60] flex items-center gap-3 px-4 py-2.5 rounded-[12px] bg-surface border border-line-strong shadow-pop w-[min(560px,calc(100vw-24px))]">
          <span className="flex-1 text-[13px] font-medium">Cambios sin guardar</span>
          <Button variante="secundario" tamano="sm" onClick={() => { setBorrador(guardado); setError(''); }} disabled={guardando}>Descartar</Button>
          <Button tamano="sm" onClick={guardar} cargando={guardando}>Guardar</Button>
        </div>
      )}
    </Seccion>
  );
}

function CambioClave() {
  const { avisar } = usePanelContexto();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const requisitos: [string, boolean][] = [
    ['8 caracteres o más', nueva.length >= 8],
    ['Al menos un número', /\d/.test(nueva)],
    ['Distinta de la actual', Boolean(nueva) && nueva !== actual],
    ['Las dos coinciden', Boolean(nueva) && nueva === repetida],
  ];
  const valida = Boolean(actual) && requisitos.every(([, ok]) => ok) && contrasenaAceptable(nueva);

  const cambiar = async () => {
    setGuardando(true);
    setError('');
    try {
      await client.post('/auth/password/change/', { old_password: actual, new_password1: nueva, new_password2: repetida });
      setActual(''); setNueva(''); setRepetida('');
      avisar('Contraseña actualizada');
    } catch (err) {
      setError(mensaje(err, 'No pudimos cambiar la contraseña.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Seccion titulo="Contraseña">
      {error && <AlertaError>{error}</AlertaError>}
      <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); if (valida) void cambiar(); }}>
        <Campo etiqueta="Contraseña actual"><InputContrasena value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" /></Campo>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3.5">
          <div className="flex flex-col gap-2">
            <Campo etiqueta="Nueva contraseña"><InputContrasena value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" /></Campo>
            <MedidorContrasena clave={nueva} />
          </div>
          <Campo etiqueta="Repite la nueva"><InputContrasena value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" /></Campo>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-1.5">
          {requisitos.map(([t, ok]) => (
            <li key={t} className={cn('flex items-center gap-1.5 text-[12.5px]', ok ? 'text-ok' : 'text-fg-3')}>
              {ok ? <Check className="size-3.5" strokeWidth={2.5} aria-hidden /> : <Minus className="size-3.5" strokeWidth={2} aria-hidden />}{t}
            </li>
          ))}
        </ul>
        <Button type="submit" className="self-start" disabled={!valida} cargando={guardando}>Cambiar contraseña</Button>
      </form>
    </Seccion>
  );
}

function Preferencias() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <Seccion titulo="Preferencias y sesión">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13.5px]">Tema claro u oscuro</span><ToggleTema />
      </div>
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
        <span className="text-[13.5px]">Cerrar la sesión en este equipo</span>
        <Button variante="peligro-contorno" tamano="sm" iconoInicio={<LogOut className="size-4" strokeWidth={2} />}
          onClick={async () => { await logout(); navigate('/login'); }}>Cerrar sesión</Button>
      </div>
    </Seccion>
  );
}
