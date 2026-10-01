import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Send, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import client from '../../api/client';
import { AlertaError, Button, CampoRut, Casilla, Chip, Drawer, Field, Input, Modal } from '../j40';
import { usePanelContexto } from './AppShell';
import { useEmpresaActiva } from '../../hooks/usePanel';
import type { EncargadoKarin, EncargadosKarinCuenta } from '../../types';
import { capitalizar, fechaCL } from '../../utils/formato';
import { validateRut } from '../../utils/rutUtils';

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

/**
 * Solo el titular: designa a quien recibe las denuncias Ley Karin. Esa persona
 * entra por su propia puerta ("Encargado Ley Karin") y el titular no ve el
 * contenido de las denuncias.
 */
export function SeccionEncargadoKarin() {
  const { avisar } = usePanelContexto();
  const { empresas } = useEmpresaActiva();
  const queryClient = useQueryClient();
  const datos = useQuery({
    queryKey: ['encargados-karin'],
    queryFn: async () => (await client.get<EncargadosKarinCuenta>('/encargados-karin/')).data,
  });
  const [designando, setDesignando] = useState(false);
  const [apertura, setApertura] = useState(0);
  const [quitar, setQuitar] = useState<EncargadoKarin | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['encargados-karin'] });
  const nombreEmpresa = (id: number) => {
    const e = empresas.find((x) => x.id === id);
    return e ? capitalizar(e.alias || e.nombre_legal) : 'Empresa';
  };

  const reenviar = async (enc: EncargadoKarin) => {
    try {
      await client.post(`/encargados-karin/${enc.id}/reenviar/`);
      await refrescar();
      avisar(`Invitación reenviada a ${enc.correo}`);
    } catch (err) {
      avisar(mensaje(err, 'No pudimos reenviar la invitación.'), 'error');
    }
  };

  const confirmarQuitar = async () => {
    if (!quitar) return;
    setTrabajando(true);
    try {
      await client.post(`/encargados-karin/${quitar.id}/eliminar/`);
      await refrescar();
      avisar(`${capitalizar(quitar.nombres)} ya no tiene acceso`);
      setQuitar(null);
    } catch (err) {
      avisar(mensaje(err, 'No pudimos quitar el acceso.'), 'error');
    } finally {
      setTrabajando(false);
    }
  };

  if (!datos.data) return null;
  const { cupo, usados, encargados } = datos.data;

  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card p-5 flex flex-col gap-4">
      <h2 className="flex items-center gap-3 text-[18px] font-semibold">
        <ShieldCheck className="size-6 text-brand" strokeWidth={2} aria-hidden />Ley Karin: encargado de denuncias
      </h2>
      <p className="text-[15px] leading-relaxed">
        Designe a quien recibirá y gestionará las denuncias: usted mismo, alguien de su equipo o un asesor externo. Entrará
        por un acceso aparte y reservado; usted no verá el contenido de las denuncias, solo que hubo actividad.
      </p>
      {encargados.length === 0 && (
        <Button tamano="lg" className="self-start" onClick={() => { setApertura((n) => n + 1); setDesignando(true); }}
          disabled={usados >= cupo} iconoInicio={<UserPlus className="size-5" strokeWidth={2} />}>
          Designar encargado
        </Button>
      )}
      {encargados.map((enc) => (
        <div key={enc.id} className="flex flex-col gap-2.5 p-4 rounded-[10px] border border-line">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-[1_1_220px] min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[16px] font-semibold">{capitalizar(`${enc.nombres} ${enc.apellidos}`)}</span>
                <Chip tono={enc.estado === 'ACTIVO' ? 'ok' : 'aviso'}>{enc.estado === 'ACTIVO' ? 'Activo' : 'Invitado: aún no crea su clave'}</Chip>
              </div>
              <p className="text-[13.5px] text-fg-3 mt-0.5"><span className="j40-mono">{enc.rut}</span> · {enc.correo}</p>
              <p className="text-[13.5px] text-fg-2 mt-1">Empresas: {enc.empresas.map(nombreEmpresa).join(', ')}</p>
              {enc.estado === 'INVITADO' && enc.invitado_en && (
                <p className="text-[12.5px] text-fg-3 mt-1">Invitado el {fechaCL(enc.invitado_en)}.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {enc.estado === 'INVITADO' && (
                <Button variante="secundario" onClick={() => void reenviar(enc)} iconoInicio={<Send className="size-4" strokeWidth={2} />}>
                  Reenviar invitación
                </Button>
              )}
              <Button variante="peligro-contorno" onClick={() => setQuitar(enc)} iconoInicio={<Trash2 className="size-4" strokeWidth={2} />}>
                Quitar acceso
              </Button>
            </div>
          </div>
        </div>
      ))}
      <p className="text-[13px] text-fg-3">
        Su plan incluye {cupo === 1 ? 'un encargado' : `${cupo} encargados`}, aparte de los usuarios del equipo. El encargado entra en
        jornada40.cl/karin con su RUT y su propia clave.
      </p>

      {designando && (
        <FormularioEncargado key={apertura} onCerrar={() => setDesignando(false)}
          onGuardado={async (texto) => { await refrescar(); setDesignando(false); avisar(texto); }} />
      )}
      <Modal abierto={Boolean(quitar)} onCerrar={() => !trabajando && setQuitar(null)} titulo="Quitar acceso al encargado"
        acciones={<>
          <Button variante="secundario" onClick={() => setQuitar(null)} disabled={trabajando}>Cancelar</Button>
          <Button variante="peligro" cargando={trabajando} onClick={() => void confirmarQuitar()}>Quitar acceso</Button>
        </>}>
        <p className="text-[14.5px] text-fg-2">
          {quitar && capitalizar(`${quitar.nombres} ${quitar.apellidos}`)} no podrá volver a entrar y se cierran sus sesiones.
          Su registro reservado se conserva. Después puede designar a otra persona.
        </p>
      </Modal>
    </section>
  );
}

function FormularioEncargado({ onCerrar, onGuardado }: { onCerrar: () => void; onGuardado: (texto: string) => Promise<void> }) {
  const { empresas } = useEmpresaActiva();
  const [rut, setRut] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [elegidas, setElegidas] = useState<number[]>(empresas.map((e) => e.id));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateRut(rut)) { setError('Ingresa un RUT válido.'); return; }
    if (!nombres.trim()) { setError('Indica el nombre.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) { setError('Indica un correo válido: ahí le llega la invitación.'); return; }
    if (elegidas.length === 0) { setError('Elige al menos una empresa.'); return; }
    setError('');
    setGuardando(true);
    try {
      const { data } = await client.post<EncargadoKarin & { aviso?: string }>('/encargados-karin/',
        { rut, nombres, apellidos, correo, empresas: elegidas });
      await onGuardado(data.aviso ?? `Invitación enviada a ${data.correo}`);
    } catch (err) {
      setError(mensaje(err, 'No pudimos designar al encargado. Intenta de nuevo.'));
      setGuardando(false);
    }
  };

  return (
    <Drawer abierto onCerrar={() => !guardando && onCerrar()} titulo="Designar encargado de denuncias"
      subtitulo="Le llegará un correo para crear su clave del acceso Ley Karin."
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button type="submit" form="form-encargado-karin" cargando={guardando}>Enviar invitación</Button>
      </>}>
      <form id="form-encargado-karin" onSubmit={guardar} noValidate className="flex flex-col gap-5">
        {error && <AlertaError>{error}</AlertaError>}
        <CampoRut etiqueta="RUT del encargado" valor={rut} onChange={(v) => { setRut(v); setError(''); }}
          forzarError={Boolean(error) && !validateRut(rut)} ayuda="Puede ser el suyo: el acceso Ley Karin es aparte y con otra clave." />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <Field etiqueta="Nombres">{(p) => <Input {...p} value={nombres} onChange={(e) => setNombres(e.target.value)} autoComplete="off" />}</Field>
          <Field etiqueta="Apellidos">{(p) => <Input {...p} value={apellidos} onChange={(e) => setApellidos(e.target.value)} autoComplete="off" />}</Field>
        </div>
        <Field etiqueta="Correo" ayuda="Ahí le llega la invitación y, si la olvida, el enlace para una clave nueva.">
          {(p) => <Input {...p} type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="off" />}
        </Field>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="text-[15px] font-semibold mb-1">¿De qué empresas recibe denuncias?</legend>
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
