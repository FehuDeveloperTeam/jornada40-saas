import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Building2, Check, Plus } from 'lucide-react';
import { AlertaError, Button, CampoRut, Chip, Drawer, Input, Modal } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import client from '../../api/client';
import { lista } from '../../api/lista';
import type { RespuestaLista } from '../../api/lista';
import { useSuscripcion } from '../../hooks/usePanel';
import type { Empresa } from '../../types';
import { capitalizar, iniciales } from '../../utils/formato';
import { validateRut } from '../../utils/rutUtils';

function mensaje(err: unknown, porDefecto: string): string {
  if (!isAxiosError(err)) return porDefecto;
  const d = err.response?.data as Record<string, unknown> | undefined;
  if (!d) return porDefecto;
  if (typeof d.error === 'string') return d.error;
  const primero = Object.values(d).flat()[0];
  return typeof primero === 'string' ? primero : porDefecto;
}

/** Empresas de la cuenta: crear, elegir la activa, desactivar y reactivar (borrado lógico). */
export default function Empresas() {
  const { empresa: activa, avisar, cambiarEmpresa: cambiar } = usePanelContexto();
  const { maxEmpresas } = useSuscripcion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const todas = useQuery({
    queryKey: ['empresas', 'todas'],
    queryFn: async () => lista((await client.get<RespuestaLista<Empresa>>('/empresas/?incluir_inactivas=true')).data),
  });
  const [nueva, setNueva] = useState(false);
  const [confirmar, setConfirmar] = useState<Empresa | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const activas = (todas.data ?? []).filter((e) => e.activo !== false);
  const inactivas = (todas.data ?? []).filter((e) => e.activo === false);

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['empresas'] });
  };

  const cambiarEstado = async (e: Empresa) => {
    setOcupado(true);
    try {
      if (e.activo === false) await client.post(`/empresas/${e.id}/reactivar/`);
      else await client.delete(`/empresas/${e.id}/`);
      await refrescar();
      avisar(e.activo === false ? 'Empresa reactivada' : 'Empresa desactivada');
      setConfirmar(null);
    } catch (err) {
      avisar(mensaje(err, 'No pudimos cambiar el estado de la empresa.'), 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Empresas</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">{activas.length} de {maxEmpresas} empresas de tu plan</p>
        </div>
        <Button onClick={() => setNueva(true)} disabled={activas.length >= maxEmpresas}
          title={activas.length >= maxEmpresas ? 'Llegaste al máximo de empresas de tu plan' : undefined}
          iconoInicio={<Plus className="size-4" strokeWidth={2} />}>Nueva empresa</Button>
      </div>
      {activas.length >= maxEmpresas && (
        <p className="text-[12.5px] text-fg-3">Para agregar otra empresa, <button type="button" className="font-medium text-brand-text" onClick={() => navigate('/app/plan')}>cambia a un plan con más empresas</button> o desactiva una.</p>
      )}

      <Lista titulo="Activas">
        {activas.map((e) => (
          <Fila key={e.id} empresa={e} activa={e.id === activa.id}
            acciones={<>
              {e.id !== activa.id && <Button tamano="sm" variante="secundario" onClick={() => { cambiar(e.id); navigate('/app'); }}>Trabajar en esta</Button>}
              {activas.length > 1 && <Button tamano="sm" variante="peligro-contorno" onClick={() => setConfirmar(e)}>Desactivar</Button>}
            </>} />
        ))}
      </Lista>
      {inactivas.length > 0 && (
        <Lista titulo="Desactivadas">
          {inactivas.map((e) => (
            <Fila key={e.id} empresa={e} activa={false}
              acciones={<Button tamano="sm" variante="secundario" disabled={activas.length >= maxEmpresas} onClick={() => setConfirmar(e)}>Reactivar</Button>} />
          ))}
        </Lista>
      )}

      {nueva && <NuevaEmpresa onCerrar={() => setNueva(false)} onCreada={async (id) => { await refrescar(); cambiar(id); avisar('Empresa creada'); setNueva(false); navigate('/app'); }} />}
      <Modal abierto={Boolean(confirmar)} onCerrar={() => !ocupado && setConfirmar(null)}
        titulo={confirmar?.activo === false ? 'Reactivar empresa' : 'Desactivar empresa'} subtitulo={confirmar ? capitalizar(confirmar.nombre_legal) : undefined}
        acciones={<>
          <Button variante="secundario" onClick={() => setConfirmar(null)} disabled={ocupado}>Cancelar</Button>
          <Button variante={confirmar?.activo === false ? 'primario' : 'peligro'} cargando={ocupado} onClick={() => confirmar && cambiarEstado(confirmar)}>
            {confirmar?.activo === false ? 'Reactivar' : 'Desactivar'}
          </Button>
        </>}>
        <p className="text-[13.5px] text-fg-2">
          {confirmar?.activo === false
            ? 'Vuelve a aparecer en el selector y ocupa un cupo de empresas de tu plan.'
            : 'Deja de aparecer en el selector y libera un cupo. Sus trabajadores y documentos se conservan: puedes reactivarla cuando quieras.'}
        </p>
      </Modal>
    </div>
  );
}

function Lista({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card">
      <h2 className="px-[18px] pt-3.5 pb-2 text-[13px] font-semibold text-fg-2">{titulo}</h2>
      {children}
    </section>
  );
}

function Fila({ empresa, activa, acciones }: { empresa: Empresa; activa: boolean; acciones: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-[18px] py-3 border-t border-line">
      <span className="size-10 rounded-[10px] bg-navy text-white grid place-items-center text-[13px] font-semibold shrink-0">{iniciales(...empresa.nombre_legal.split(' ').slice(0, 2))}</span>
      <span className="flex-1 min-w-[200px] flex flex-col">
        <span className="flex items-center gap-2 text-[14px] font-medium">{capitalizar(empresa.nombre_legal)}
          {activa && <Chip tono="ok" icono={<Check className="size-3" strokeWidth={2.5} />}>Activa ahora</Chip>}</span>
        <span className="text-[12.5px] text-fg-3"><span className="j40-mono">{empresa.rut}</span>{empresa.comuna ? ` · ${capitalizar(empresa.comuna)}` : ''}</span>
      </span>
      <span className="flex gap-2">{acciones}</span>
    </div>
  );
}

function NuevaEmpresa({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: (id: number) => void }) {
  const [d, setD] = useState({ nombre_legal: '', rut: '', giro: '', direccion: '', comuna: '', ciudad: '', sucursal: '', representante_legal: '', rut_representante: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const poner = (k: keyof typeof d) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));

  const crear = async () => {
    if (!d.nombre_legal.trim()) { setError('Ingresa la razón social.'); return; }
    if (!validateRut(d.rut)) { setError('El RUT de la empresa no es válido.'); return; }
    if (d.rut_representante && !validateRut(d.rut_representante)) { setError('El RUT del representante legal no es válido.'); return; }
    setGuardando(true);
    setError('');
    try {
      const { data } = await client.post<Empresa>('/empresas/', d);
      onCreada(data.id);
    } catch (err) {
      setError(mensaje(err, 'No pudimos crear la empresa.'));
      setGuardando(false);
    }
  };

  return (
    <Drawer abierto onCerrar={onCerrar} titulo="Nueva empresa" subtitulo="Aparecerá en contratos, liquidaciones y documentos"
      acciones={<><Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button onClick={crear} cargando={guardando} iconoInicio={<Building2 className="size-4" strokeWidth={2} />}>Crear empresa</Button></>}>
      <div className="flex flex-col gap-3.5">
        {error && <AlertaError>{error}</AlertaError>}
        <Campo etiqueta="Razón social"><Input value={d.nombre_legal} onChange={poner('nombre_legal')} /></Campo>
        <CampoRut etiqueta="RUT de la empresa" valor={d.rut} compacto onChange={(v) => setD((x) => ({ ...x, rut: v }))} />
        <Campo etiqueta="Giro"><Input value={d.giro} onChange={poner('giro')} /></Campo>
        <Campo etiqueta="Dirección"><Input value={d.direccion} onChange={poner('direccion')} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Comuna"><Input value={d.comuna} onChange={poner('comuna')} /></Campo>
          <Campo etiqueta="Ciudad"><Input value={d.ciudad} onChange={poner('ciudad')} /></Campo>
        </div>
        <Campo etiqueta="Sucursal (opcional)"><Input value={d.sucursal} onChange={poner('sucursal')} /></Campo>
        <Campo etiqueta="Representante legal"><Input value={d.representante_legal} onChange={poner('representante_legal')} /></Campo>
        <CampoRut etiqueta="RUT del representante" valor={d.rut_representante} compacto onChange={(v) => setD((x) => ({ ...x, rut_representante: v }))} />
      </div>
    </Drawer>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 min-w-0"><span className="text-[12.5px] font-medium text-fg-2">{etiqueta}</span>{children}</label>;
}
