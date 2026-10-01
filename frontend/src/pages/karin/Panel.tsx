import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Building2, Inbox, KeyRound, LogOut, ScrollText, ShieldCheck, ShieldX } from 'lucide-react';
import client from '../../api/client';
import { AlertaError, Button, InputContrasena, J40Root, Logo, MedidorContrasena, ToggleTema } from '../../components/j40';
import type { BitacoraKarinPagina, SesionKarin } from '../../types';
import { contrasenaAceptable } from '../../utils/contrasena';

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

function Seccion({ titulo, icono, children }: { titulo: string; icono: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card p-5 flex flex-col gap-4">
      <h2 className="flex items-center gap-3 text-[18px] font-semibold">{icono}{titulo}</h2>
      {children}
    </section>
  );
}

/**
 * Panel del encargado de denuncias Ley Karin. Usa solo la sesión del acceso
 * Ley Karin (`/api/karin/…`): no ve nada más del sistema, y desde el panel de
 * la empresa no se ve esto.
 */
export default function PanelKarin() {
  const navigate = useNavigate();
  const sesion = useQuery({
    queryKey: ['karin', 'yo'],
    queryFn: async () => (await client.get<SesionKarin>('/karin/yo/')).data,
    retry: false,
  });

  if (sesion.isLoading) {
    return <J40Root className="min-h-dvh grid place-items-center bg-canvas"><p className="text-[15px] text-fg-3" role="status">Cargando…</p></J40Root>;
  }
  if (sesion.isError || !sesion.data) {
    const sinSesion = isAxiosError(sesion.error) && [401, 403].includes(sesion.error.response?.status ?? 0);
    if (sinSesion) return <Navigate to="/karin" replace />;
    return (
      <J40Root className="min-h-dvh grid place-items-center bg-canvas px-4">
        <AlertaError>No pudimos conectar con Jornada40. Recarga la página en un momento.</AlertaError>
      </J40Root>
    );
  }
  const yo = sesion.data;

  const salir = async () => {
    try { await client.post('/karin/salir/', {}); } catch { /* la cookie vence sola */ }
    navigate('/karin', { replace: true });
  };

  return (
    <J40Root className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="max-w-[900px] mx-auto px-4 h-16 flex items-center gap-3">
          <Logo tamano={28} />
          <span className="text-[15px] font-semibold text-fg-2 hidden min-[520px]:inline">Acceso Ley Karin</span>
          <span className="flex-1" />
          <ToggleTema />
          <Button variante="secundario" onClick={() => void salir()} iconoInicio={<LogOut className="size-4" strokeWidth={2} />}>Salir</Button>
        </div>
      </header>
      <main className="max-w-[900px] mx-auto px-4 py-8 flex flex-col gap-5 pb-20">
        <div>
          <h1 className="text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.015em]">Hola, {yo.nombre.split(' ')[0]}</h1>
          <p className="text-[15px] text-fg-3 mt-1">Encargado de denuncias Ley Karin de {yo.cuenta}.</p>
        </div>
        <p className="flex gap-2.5 items-start rounded-[10px] bg-brand-soft text-brand-text px-4 py-3 text-[14.5px] leading-relaxed">
          <ShieldCheck className="size-5 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
          Este acceso es reservado (Art. 211-C del Código del Trabajo): lo que registres aquí no lo ven el titular ni su
          equipo. El titular solo sabe que hubo actividad, sin detalle.
        </p>

        <Seccion titulo="Denuncias" icono={<Inbox className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
          <p className="text-[15px] text-fg-2">No hay denuncias registradas.</p>
        </Seccion>

        <Seccion titulo="Empresas a tu cargo" icono={<Building2 className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
          <ul className="flex flex-col">
            {yo.empresas.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-2.5 border-b border-line last:border-b-0 text-[15px]">
                <span>{e.nombre}</span><span className="text-fg-3 j40-mono text-[13.5px]">{e.rut}</span>
              </li>
            ))}
          </ul>
        </Seccion>

        <BitacoraReservada />
        <CambiarClave />
      </main>
    </J40Root>
  );
}

function BitacoraReservada() {
  const [pagina, setPagina] = useState(1);
  const [verificacion, setVerificacion] = useState<{ ok: boolean; registros: number; roto_en: number | null } | null>(null);
  const datos = useQuery({
    queryKey: ['karin', 'bitacora', pagina],
    queryFn: async () => (await client.get<BitacoraKarinPagina>(`/karin/bitacora/?pagina=${pagina}`)).data,
    placeholderData: (previa) => previa,
  });
  const paginas = datos.data ? Math.max(1, Math.ceil(datos.data.total / datos.data.por_pagina)) : 1;
  const verificar = async () => setVerificacion((await client.get('/karin/bitacora/verificar/')).data);

  return (
    <Seccion titulo="Registro reservado de accesos" icono={<ScrollText className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
      <p className="text-[14.5px] text-fg-2">
        Todo lo que se hace en este acceso queda anotado y no se puede editar ni borrar. Si la Dirección del Trabajo lo pide, se le entrega.
      </p>
      <Button variante="secundario" className="self-start" onClick={() => void verificar()}
        iconoInicio={<ShieldCheck className="size-5" strokeWidth={2} />}>Comprobar que nadie lo alteró</Button>
      {verificacion && (verificacion.ok ? (
        <p role="status" className="flex items-center gap-2.5 px-4 py-3 rounded-j40-card bg-ok-soft text-ok text-[14.5px]">
          <ShieldCheck className="size-5 shrink-0" strokeWidth={2} aria-hidden />Íntegro: los {verificacion.registros} registros están tal como se anotaron.
        </p>
      ) : (
        <p role="alert" className="flex items-center gap-2.5 px-4 py-3 rounded-j40-card bg-danger-soft text-danger text-[14.5px]">
          <ShieldX className="size-5 shrink-0" strokeWidth={2} aria-hidden />Alguien alteró o quitó registros desde el N° {verificacion.roto_en}.
        </p>
      ))}
      {datos.data && datos.data.registros.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[14px] border-collapse">
            <thead>
              <tr className="text-left text-fg-3">
                {['Fecha y hora', 'Quién', 'Qué', 'IP'].map((c) => <th key={c} className="font-medium py-2 pr-3 border-b border-line">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {datos.data.registros.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-b-0 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap j40-num">
                    {new Date(r.fecha).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-2 pr-3">{r.actor}</td>
                  <td className="py-2 pr-3">{r.descripcion}</td>
                  <td className="py-2 pr-3 j40-mono text-[12.5px]">{r.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paginas > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button variante="secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Más recientes</Button>
          <span className="text-[13px] text-fg-3">Página {pagina} de {paginas}</span>
          <Button variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Más antiguos</Button>
        </div>
      )}
    </Seccion>
  );
}

function CambiarClave() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!contrasenaAceptable(nueva)) return;
    setError('');
    setGuardando(true);
    try {
      await client.post('/karin/cambiar-clave/', { actual, nueva });
      setListo(true);
      setActual('');
      setNueva('');
    } catch (err) {
      setError(mensaje(err, 'No pudimos cambiar la clave. Intenta de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Seccion titulo="Cambiar mi clave" icono={<KeyRound className="size-6 text-brand" strokeWidth={2} aria-hidden />}>
      {error && <AlertaError>{error}</AlertaError>}
      {listo && <p role="status" className="text-[14.5px] text-ok">Tu clave quedó cambiada. Las demás sesiones abiertas se cerraron.</p>}
      <form onSubmit={guardar} noValidate className="flex flex-col gap-4 max-w-[420px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="karin-actual" className="text-[13px] font-medium text-fg-2">Clave actual</label>
          <InputContrasena id="karin-actual" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="karin-nueva" className="text-[13px] font-medium text-fg-2">Clave nueva</label>
          <InputContrasena id="karin-nueva" autoComplete="new-password" aria-describedby="karin-nueva-medidor"
            value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <MedidorContrasena clave={nueva} id="karin-nueva-medidor" />
        </div>
        <Button type="submit" className="self-start" disabled={!actual || !contrasenaAceptable(nueva)} cargando={guardando}>
          Cambiar clave
        </Button>
      </form>
    </Seccion>
  );
}
