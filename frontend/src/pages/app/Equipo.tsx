import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Download, FileSpreadsheet, Mail, Pencil, Send, ShieldCheck, ShieldX, Trash2, UserPlus } from 'lucide-react';
import client from '../../api/client';
import { descargar } from '../../api/descargas';
import {
  AlertaError, Button, CampoRut, Card, CardHeader, Casilla, Chip, Drawer, Field, Input, Modal, SegmentedControl,
} from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import { useEmpresaActiva } from '../../hooks/usePanel';
import type {
  BitacoraPagina, EquipoCuenta, ModuloPanel, NivelPermiso, UsuarioEquipo, VerificacionBitacora,
} from '../../types';
import { cn } from '../../utils/cn';
import { capitalizar, fechaCL } from '../../utils/formato';
import { validateRut } from '../../utils/rutUtils';

type Pestana = 'usuarios' | 'bitacora';

function mensaje(err: unknown, porDefecto: string): string {
  const d = isAxiosError(err) ? (err.response?.data as { error?: string } | undefined) : undefined;
  return d?.error || porDefecto;
}

/**
 * Solo el titular: las personas que trabajan en su cuenta (qué ven y en qué
 * empresas) y la bitácora de todo lo que se hizo en el panel.
 */
export default function Equipo() {
  const [params, setParams] = useSearchParams();
  const pestana: Pestana = params.get('tab') === 'bitacora' ? 'bitacora' : 'usuarios';
  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-5 pb-20">
      <div>
        <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Usuarios y bitácora</h1>
        <p className="text-[14px] text-fg-3 mt-0.5">Quién más trabaja en tu cuenta y el registro de todo lo que se hace en ella.</p>
      </div>
      <SegmentedControl<Pestana> etiqueta="Sección" tamano="lg" className="self-start"
        opciones={[{ valor: 'usuarios', etiqueta: 'Usuarios del equipo' }, { valor: 'bitacora', etiqueta: 'Bitácora' }]}
        valor={pestana} onChange={(v) => setParams(v === 'usuarios' ? {} : { tab: v }, { replace: true })} />
      {pestana === 'usuarios' ? <Usuarios /> : <Bitacora />}
    </div>
  );
}

// ── Usuarios ─────────────────────────────────────────────────────────────────

const ESTADO: Record<UsuarioEquipo['estado'], { texto: string; tono: 'ok' | 'aviso' | 'neutro' }> = {
  ACTIVO: { texto: 'Activo', tono: 'ok' },
  INVITADO: { texto: 'Invitado: aún no crea su clave', tono: 'aviso' },
  ELIMINADO: { texto: 'Eliminado', tono: 'neutro' },
};

function Usuarios() {
  const { avisar } = usePanelContexto();
  const { empresas } = useEmpresaActiva();
  const queryClient = useQueryClient();
  const equipo = useQuery({ queryKey: ['equipo'], queryFn: async () => (await client.get<EquipoCuenta>('/equipo/')).data });
  // null = cerrado; 'nuevo' = invitar; un usuario = editarlo.
  const [editando, setEditando] = useState<UsuarioEquipo | 'nuevo' | null>(null);
  const [apertura, setApertura] = useState(0);
  const [eliminar, setEliminar] = useState<UsuarioEquipo | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  if (equipo.isLoading) return <p className="text-[14px] text-fg-3" role="status">Cargando…</p>;
  if (!equipo.data) return <AlertaError>No pudimos cargar tu equipo. Recarga la página.</AlertaError>;
  const { cupo, usados, usuarios, modulos } = equipo.data;
  const nombreEmpresa = (id: number) => {
    const e = empresas.find((x) => x.id === id);
    return e ? capitalizar(e.alias || e.nombre_legal) : 'Empresa';
  };
  const abrir = (u: UsuarioEquipo | 'nuevo') => { setApertura((n) => n + 1); setEditando(u); };

  const reenviar = async (u: UsuarioEquipo) => {
    try {
      await client.post(`/equipo/${u.id}/reenviar/`);
      await queryClient.invalidateQueries({ queryKey: ['equipo'] });
      avisar(`Invitación reenviada a ${u.correo}`);
    } catch (err) {
      avisar(mensaje(err, 'No pudimos reenviar la invitación.'), 'error');
    }
  };

  const confirmarEliminar = async () => {
    if (!eliminar) return;
    setTrabajando(true);
    try {
      await client.post(`/equipo/${eliminar.id}/eliminar/`);
      await queryClient.invalidateQueries({ queryKey: ['equipo'] });
      avisar(`${capitalizar(eliminar.nombres)} ya no tiene acceso`);
      setEliminar(null);
    } catch (err) {
      avisar(mensaje(err, 'No pudimos eliminar al usuario.'), 'error');
    } finally {
      setTrabajando(false);
    }
  };

  if (cupo === 0) {
    return (
      <Card className="p-6 flex flex-col gap-3 items-start">
        <h2 className="text-[18px] font-semibold">Tu plan solo tiene al titular</h2>
        <p className="text-[15px] text-fg-2">
          Desde el plan Starter puedes invitar a otras personas (por ejemplo, tu contador o quien lleva el personal):
          2 usuarios por cada empresa del plan. Tú eliges qué secciones ven y en qué empresas.
        </p>
        <Link to="/app/plan" className="h-11 px-5 inline-flex items-center rounded-[10px] bg-brand text-white text-[15px] font-medium no-underline hover:no-underline">
          Ver planes
        </Link>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-5 flex flex-wrap items-center gap-4">
        <div className="flex-[1_1_280px] flex flex-col gap-1">
          <span className="text-[16px] font-semibold">Usas {usados} de {cupo} usuarios del equipo</span>
          <span className="text-[13.5px] text-fg-3">
            Tu plan permite 2 usuarios por empresa, repartidos como quieras. Al eliminar a alguien se libera su cupo.
          </span>
        </div>
        <Button tamano="lg" onClick={() => abrir('nuevo')} disabled={usados >= cupo}
          iconoInicio={<UserPlus className="size-5" strokeWidth={2} />}>Invitar usuario</Button>
      </Card>
      {usados >= cupo && (
        <p className="text-[14px] text-fg-2">
          ¿Necesitas más usuarios? Elimina uno que ya no use la cuenta, sube de plan o pide usuarios adicionales
          escribiendo a <a href="mailto:contacto.jornada40@gmail.com?subject=Usuarios%20adicionales">contacto.jornada40@gmail.com</a>.
        </p>
      )}

      {usuarios.length === 0 ? (
        <Card className="p-6 text-[15px] text-fg-2">
          Aún no invitas a nadie. Cada persona entra con su propio RUT y clave, por “Ingreso del equipo”, y solo ve lo que tú marques.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {usuarios.map((u) => {
            const permisos = Object.entries(u.permisos) as [ModuloPanel, NivelPermiso][];
            return (
              <Card key={u.id} className="p-5 flex flex-col gap-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-[1_1_240px] min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[16px] font-semibold">{capitalizar(`${u.nombres} ${u.apellidos}`)}</span>
                      <Chip tono={ESTADO[u.estado].tono}>{ESTADO[u.estado].texto}</Chip>
                    </div>
                    <p className="text-[13.5px] text-fg-3 mt-0.5"><span className="j40-mono">{u.rut}</span> · {u.correo}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variante="secundario" onClick={() => abrir(u)} iconoInicio={<Pencil className="size-4" strokeWidth={2} />}>Editar</Button>
                    {u.estado === 'INVITADO' && (
                      <Button variante="secundario" onClick={() => void reenviar(u)} iconoInicio={<Send className="size-4" strokeWidth={2} />}>
                        Reenviar invitación
                      </Button>
                    )}
                    <Button variante="peligro-contorno" onClick={() => setEliminar(u)} iconoInicio={<Trash2 className="size-4" strokeWidth={2} />}>
                      Eliminar
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[13.5px]">
                  <span className="text-fg-3">Ve:</span>
                  {permisos.map(([m, n]) => {
                    const info = modulos.find((x) => x.valor === m);
                    return <span key={m}>{info?.texto ?? m} <span className="text-fg-3">({n === 'GESTIONAR' ? 'ver y gestionar' : 'solo ver'})</span></span>;
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
                  <span className="text-fg-3">Empresas:</span>
                  {u.empresas.map((id) => <span key={id}>{nombreEmpresa(id)}</span>)}
                </div>
                {u.estado === 'INVITADO' && u.invitado_en && (
                  <p className="text-[12.5px] text-fg-3">Invitado el {fechaCL(u.invitado_en)}. El enlace del correo sirve una sola vez.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {editando && (
        <FormularioUsuario key={apertura} usuario={editando === 'nuevo' ? null : editando} equipo={equipo.data}
          onCerrar={() => setEditando(null)}
          onGuardado={async (texto) => {
            await queryClient.invalidateQueries({ queryKey: ['equipo'] });
            setEditando(null);
            avisar(texto);
          }} />
      )}

      <Modal abierto={Boolean(eliminar)} onCerrar={() => !trabajando && setEliminar(null)} titulo="Eliminar usuario"
        acciones={<>
          <Button variante="secundario" onClick={() => setEliminar(null)} disabled={trabajando}>Cancelar</Button>
          <Button variante="peligro" cargando={trabajando} onClick={() => void confirmarEliminar()}>Eliminar</Button>
        </>}>
        <p className="text-[14.5px] text-fg-2">
          {eliminar && capitalizar(`${eliminar.nombres} ${eliminar.apellidos}`)} no podrá volver a entrar y se libera su cupo.
          Lo que hizo queda en la bitácora y los documentos que firmó siguen válidos. Si más adelante vuelve, invítalo de nuevo.
        </p>
      </Modal>
    </>
  );
}

type NivelElegido = NivelPermiso | 'NADA';

function FormularioUsuario({ usuario, equipo, onCerrar, onGuardado }: {
  usuario: UsuarioEquipo | null; equipo: EquipoCuenta; onCerrar: () => void; onGuardado: (texto: string) => Promise<void>;
}) {
  const { empresas } = useEmpresaActiva();
  const [rut, setRut] = useState(usuario?.rut ?? '');
  const [nombres, setNombres] = useState(usuario?.nombres ?? '');
  const [apellidos, setApellidos] = useState(usuario?.apellidos ?? '');
  const [correo, setCorreo] = useState(usuario?.correo ?? '');
  const [permisos, setPermisos] = useState<Partial<Record<ModuloPanel, NivelPermiso>>>(usuario?.permisos ?? {});
  const [elegidas, setElegidas] = useState<number[]>(usuario?.empresas ?? (empresas.length === 1 ? [empresas[0].id] : []));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const nivel = (m: ModuloPanel): NivelElegido => permisos[m] ?? 'NADA';
  const cambiarNivel = (m: ModuloPanel, n: NivelElegido) => setPermisos((p) => {
    const nuevo = { ...p };
    if (n === 'NADA') delete nuevo[m]; else nuevo[m] = n;
    return nuevo;
  });

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario && !validateRut(rut)) { setError('Ingresa un RUT válido.'); return; }
    if (!nombres.trim()) { setError('Indica el nombre.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) { setError('Indica un correo válido: ahí le llega la invitación.'); return; }
    if (Object.keys(permisos).length === 0) { setError('Marca al menos una sección.'); return; }
    if (elegidas.length === 0) { setError('Elige al menos una empresa.'); return; }
    setError('');
    setGuardando(true);
    const datos = { nombres, apellidos, correo, permisos, empresas: elegidas };
    try {
      if (usuario) {
        await client.patch(`/equipo/${usuario.id}/`, datos);
        await onGuardado('Cambios guardados');
      } else {
        const { data } = await client.post<UsuarioEquipo & { aviso?: string }>('/equipo/', { ...datos, rut });
        await onGuardado(data.aviso ?? `Invitación enviada a ${data.correo}`);
      }
    } catch (err) {
      setError(mensaje(err, 'No pudimos guardar. Intenta de nuevo.'));
      setGuardando(false);
    }
  };

  return (
    <Drawer abierto onCerrar={() => !guardando && onCerrar()}
      titulo={usuario ? `Editar a ${capitalizar(usuario.nombres)}` : 'Invitar usuario'}
      subtitulo={usuario ? undefined : 'Le llegará un correo para crear su clave. Entrará con su RUT por “Ingreso del equipo”.'}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button type="submit" form="form-usuario-equipo" cargando={guardando}>{usuario ? 'Guardar cambios' : 'Enviar invitación'}</Button>
      </>}>
      <form id="form-usuario-equipo" onSubmit={guardar} noValidate className="flex flex-col gap-5">
        {error && <AlertaError>{error}</AlertaError>}
        {usuario ? (
          <p className="text-[14px] text-fg-2">RUT <span className="j40-mono">{usuario.rut}</span> (no se puede cambiar: identifica a la persona).</p>
        ) : (
          <CampoRut etiqueta="RUT de la persona" valor={rut} onChange={(v) => { setRut(v); setError(''); }}
            forzarError={Boolean(error) && !validateRut(rut)} ayuda="Su propio RUT: con él entrará." />
        )}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <Field etiqueta="Nombres">{(p) => <Input {...p} value={nombres} onChange={(e) => setNombres(e.target.value)} autoComplete="off" />}</Field>
          <Field etiqueta="Apellidos">{(p) => <Input {...p} value={apellidos} onChange={(e) => setApellidos(e.target.value)} autoComplete="off" />}</Field>
        </div>
        <Field etiqueta="Correo" ayuda="Ahí le llega la invitación y, si la olvida, el enlace para una clave nueva.">
          {(p) => <Input {...p} type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="off" />}
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-[15px] font-semibold mb-1">¿Qué puede ver?</legend>
          <p className="text-[13px] text-fg-3 -mt-1">
            “Solo ver” permite mirar y descargar. “Ver y gestionar” permite además crear, modificar y enviar a firma.
            Nunca verá los datos de la empresa, el plan, los pagos, este equipo ni la bitácora.
          </p>
          {equipo.modulos.map((m) => (
            <div key={m.valor} className={cn('flex flex-wrap items-center gap-3 p-3 rounded-[10px] border',
              nivel(m.valor) === 'NADA' ? 'border-line' : 'border-brand bg-brand-soft/40')}>
              <div className="flex-[1_1_200px] min-w-0">
                <span className="text-[14.5px] font-medium">{m.texto}</span>
                <p className="text-[12.5px] text-fg-3">{m.detalle}</p>
              </div>
              <SegmentedControl<NivelElegido> etiqueta={`Acceso a ${m.texto}`} valor={nivel(m.valor)}
                onChange={(v) => cambiarNivel(m.valor, v)}
                opciones={[{ valor: 'NADA', etiqueta: 'Sin acceso' }, { valor: 'VER', etiqueta: 'Solo ver' },
                  { valor: 'GESTIONAR', etiqueta: 'Ver y gestionar' }]} />
            </div>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="text-[15px] font-semibold mb-1">¿En qué empresas?</legend>
          {empresas.map((e) => (
            <Casilla key={e.id} marcada={elegidas.includes(e.id)}
              onChange={(v) => setElegidas((l) => v ? [...l, e.id] : l.filter((x) => x !== e.id))}>
              <span className="text-[14.5px]">{capitalizar(e.alias || e.nombre_legal)} <span className="text-fg-3 j40-mono">{e.rut}</span></span>
            </Casilla>
          ))}
        </fieldset>
      </form>
    </Drawer>
  );
}

// ── Bitácora ─────────────────────────────────────────────────────────────────

const TIPO_ACTOR = { TITULAR: 'Titular', EQUIPO: 'Equipo', SISTEMA: 'Sistema' } as const;

function Bitacora() {
  const { avisar } = usePanelContexto();
  const { empresas } = useEmpresaActiva();
  const [empresa, setEmpresa] = useState('');
  const [persona, setPersona] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [verificacion, setVerificacion] = useState<VerificacionBitacora | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [descargando, setDescargando] = useState<'pdf' | 'xlsx' | null>(null);

  const filtros = new URLSearchParams();
  if (empresa) filtros.set('empresa', empresa);
  if (persona) filtros.set('persona', persona);
  if (desde) filtros.set('desde', desde);
  if (hasta) filtros.set('hasta', hasta);
  const consulta = useQuery({
    queryKey: ['bitacora', filtros.toString(), pagina],
    queryFn: async () => (await client.get<BitacoraPagina>(`/bitacora/?${filtros.toString()}&pagina=${pagina}`)).data,
    placeholderData: (previa) => previa,
  });
  const datos = consulta.data;
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;
  const filtrar = (fn: () => void) => { fn(); setPagina(1); };

  const verificar = async () => {
    setVerificando(true);
    try {
      setVerificacion((await client.get<VerificacionBitacora>('/bitacora/verificar/')).data);
    } catch (err) {
      avisar(mensaje(err, 'No pudimos verificar la bitácora.'), 'error');
    } finally {
      setVerificando(false);
    }
  };

  const bajar = async (formato: 'pdf' | 'xlsx') => {
    setDescargando(formato);
    const f = new URLSearchParams(filtros);
    f.set('formato', formato);
    const error = await descargar(`/bitacora/exportar/?${f.toString()}`, `bitacora.${formato}`);
    setDescargando(null);
    avisar(error ?? 'Bitácora descargada', error ? 'error' : 'ok');
  };

  const selector = 'h-11 px-3 rounded-j40-control border border-line-strong bg-surface text-[14.5px]';

  return (
    <>
      <Card className="p-5 flex flex-col gap-3">
        <p className="text-[14.5px] text-fg-2">
          Todo lo que se hace en el panel queda anotado: quién, cuándo, desde qué IP y el resultado (nunca los datos enviados).
          No se puede editar ni borrar y se guarda {datos?.anios_conservacion ?? 5} años. Descárgala para presentarla en una
          fiscalización: la copia trae un código que cualquiera puede verificar en jornada40.cl/verificar.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Button tamano="lg" onClick={() => void bajar('pdf')} cargando={descargando === 'pdf'}
            iconoInicio={<Download className="size-5" strokeWidth={2} />}>Descargar PDF</Button>
          <Button tamano="lg" variante="secundario" onClick={() => void bajar('xlsx')} cargando={descargando === 'xlsx'}
            iconoInicio={<FileSpreadsheet className="size-5" strokeWidth={2} />}>Descargar Excel</Button>
          <Button tamano="lg" variante="secundario" onClick={() => void verificar()} cargando={verificando}
            iconoInicio={<ShieldCheck className="size-5" strokeWidth={2} />}>Comprobar que nadie la alteró</Button>
        </div>
        {verificacion && (verificacion.ok ? (
          <div role="status" className="flex items-center gap-2.5 px-4 py-3 rounded-j40-card bg-ok-soft text-ok text-[14.5px]">
            <ShieldCheck className="size-5 shrink-0" strokeWidth={2} aria-hidden />
            Íntegra: los {verificacion.registros} registros están tal como se anotaron.
          </div>
        ) : (
          <div role="alert" className="flex items-center gap-2.5 px-4 py-3 rounded-j40-card bg-danger-soft text-danger text-[14.5px]">
            <ShieldX className="size-5 shrink-0" strokeWidth={2} aria-hidden />
            Alguien alteró o quitó registros desde el N° {verificacion.roto_en}. Escríbenos a contacto.jornada40@gmail.com.
          </div>
        ))}
        <p className="text-[12.5px] text-fg-3">La descarga usa los filtros de abajo. PDF hasta 3.000 registros; para más, usa Excel o acota las fechas.</p>
      </Card>

      <Card>
        <CardHeader titulo="Registros" acciones={<span className="text-[13px] text-fg-3">{datos?.total ?? 0} en total</span>} />
        <div className="flex flex-wrap gap-3 px-[18px] py-3 border-b border-line">
          <select aria-label="Empresa" value={empresa} onChange={(e) => filtrar(() => setEmpresa(e.target.value))} className={selector}>
            <option value="">Todas las empresas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{capitalizar(e.alias || e.nombre_legal)}</option>)}
          </select>
          <select aria-label="Persona" value={persona} onChange={(e) => filtrar(() => setPersona(e.target.value))} className={selector}>
            <option value="">Todas las personas</option>
            {(datos?.personas ?? []).map((p) => <option key={p.rut} value={p.rut}>{p.nombre}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[14px] text-fg-2">Desde
            <Input type="date" value={desde} onChange={(e) => filtrar(() => setDesde(e.target.value))} className="h-11" />
          </label>
          <label className="flex items-center gap-2 text-[14px] text-fg-2">Hasta
            <Input type="date" value={hasta} onChange={(e) => filtrar(() => setHasta(e.target.value))} className="h-11" />
          </label>
        </div>
        {consulta.isLoading && <p className="px-[18px] py-6 text-[14px] text-fg-3" role="status">Cargando…</p>}
        {datos && datos.registros.length === 0 && <p className="px-[18px] py-6 text-[14px] text-fg-3">No hay registros con estos filtros.</p>}
        {datos && datos.registros.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13.5px] border-collapse">
              <thead>
                <tr className="text-left text-fg-3">
                  {['Fecha y hora', 'Persona', 'Acción', 'Empresa', 'IP', ''].map((c) => (
                    <th key={c} className="font-medium px-[18px] py-2.5 border-b border-line">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.registros.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-b-0 align-top">
                    <td className="px-[18px] py-2.5 whitespace-nowrap j40-num">
                      {new Date(r.fecha).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="px-[18px] py-2.5">{r.actor}<span className="block text-[12px] text-fg-3">{TIPO_ACTOR[r.actor_tipo]}</span></td>
                    <td className="px-[18px] py-2.5">{r.descripcion}</td>
                    <td className="px-[18px] py-2.5">{r.empresa ? capitalizar(r.empresa) : '—'}</td>
                    <td className="px-[18px] py-2.5 j40-mono text-[12.5px]">{r.ip}</td>
                    <td className="px-[18px] py-2.5">
                      {r.resultado !== null && r.resultado >= 400 && <Chip tono="peligro">No se completó</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {paginas > 1 && (
          <div className="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-line">
            <Button variante="secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Más recientes</Button>
            <span className="text-[13px] text-fg-3">Página {pagina} de {paginas}</span>
            <Button variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Más antiguos</Button>
          </div>
        )}
      </Card>
      <p className="text-[12.5px] text-fg-3 flex items-center gap-1.5">
        <Mail className="size-4" strokeWidth={2} aria-hidden />
        Los inicios de sesión y los intentos fallidos también quedan registrados.
      </p>
    </>
  );
}
