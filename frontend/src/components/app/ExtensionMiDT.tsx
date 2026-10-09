import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Laptop, PlugZap } from 'lucide-react';
import client from '../../api/client';
import { AlertaError, Button, Chip, Modal } from '../j40';
import type { TipoAviso } from './AppShell';
import type { CodigoExtension, DispositivoExtension } from '../../types';
import { fechaCL } from '../../utils/formato';

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string; detail?: string } | undefined)?.error) || porDefecto;

/**
 * Extensión "Jornada40 para Mi DT" (docs/PLAN_EXTENSION_MIDT.md): conectar un
 * navegador con un código de un solo uso y ver o desconectar los conectados.
 * La extensión llena los formularios de Mi DT; la persona entra con su Clave
 * Única (la extensión nunca la ve) y presiona el botón final.
 */
export function ExtensionMiDT({ avisar }: { avisar: (texto: string, tipo?: TipoAviso) => void }) {
  const queryClient = useQueryClient();
  const dispositivos = useQuery({
    queryKey: ['extension', 'dispositivos'],
    queryFn: async () => (await client.get<DispositivoExtension[]>('/extension/dispositivos/')).data,
  });
  const [codigo, setCodigo] = useState<CodigoExtension | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [quitar, setQuitar] = useState<DispositivoExtension | null>(null);

  const pedirCodigo = async () => {
    setPidiendo(true);
    try {
      setCodigo((await client.post<CodigoExtension>('/extension/codigo/')).data);
    } catch (err) {
      avisar(mensaje(err, 'No pudimos crear el código. Intenta de nuevo.'), 'error');
    } finally {
      setPidiendo(false);
    }
  };

  const cerrarCodigo = () => {
    setCodigo(null);
    // Si se conectó mientras el código estaba a la vista, aparece en la lista.
    void queryClient.invalidateQueries({ queryKey: ['extension', 'dispositivos'] });
  };

  const lista = dispositivos.data ?? [];
  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card flex flex-col" aria-label="Extensión para Mi DT">
      <div className="flex flex-col gap-2 px-[18px] py-3.5 border-b border-line">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[14px] font-semibold">Extensión para Mi DT</h2>
          <Chip tono="aviso">En prueba</Chip>
        </div>
        <p className="text-[13px] text-fg-2 max-w-[860px]">
          Llena por ti los formularios del Registro Electrónico Laboral de Mi DT con los datos de Jornada40. Tú entras a
          Mi DT con tu Clave Única, como siempre (la extensión nunca la ve), revisas y presionas el botón final.
        </p>
        <ol className="text-[13px] text-fg-2 list-decimal pl-5 flex flex-col gap-0.5">
          <li>Instala la extensión en Chrome o Edge. Mientras está en prueba, se instala con el archivo que te envía Jornada40.</li>
          <li>Conecta tu navegador con un código de un solo uso (botón de abajo).</li>
          <li>Abre Mi DT: la extensión muestra lo que tienes por registrar y los datos de cada formulario.</li>
        </ol>
        <div>
          <Button onClick={pedirCodigo} cargando={pidiendo} iconoInicio={<PlugZap className="size-4" strokeWidth={2} />}>
            Conectar un navegador
          </Button>
        </div>
      </div>
      {dispositivos.isError ? (
        <div className="px-[18px] py-4"><AlertaError>{mensaje(dispositivos.error, 'No pudimos cargar los navegadores conectados.')}</AlertaError></div>
      ) : lista.length === 0 ? (
        <p className="px-[18px] py-5 text-[13px] text-fg-3">{dispositivos.isLoading ? 'Cargando…' : 'Aún no hay navegadores conectados.'}</p>
      ) : (
        <ul className="flex flex-col" aria-label="Navegadores conectados">
          {lista.map((d) => (
            <li key={d.id} className="flex flex-wrap gap-x-3 gap-y-1 items-center px-[18px] py-2.5 border-b border-line last:border-b-0 text-[13px]">
              <Laptop className="size-4 text-fg-3" strokeWidth={2} aria-hidden />
              <span className="flex-1 min-w-[200px]">
                <span className="font-medium">{d.nombre}</span>
                <span className="text-fg-3"> · {d.persona} · {d.ultimo_uso ? `usado el ${fechaCL(d.ultimo_uso)}` : `conectado el ${fechaCL(d.creado_en)}`}</span>
              </span>
              <Button variante="secundario" tamano="sm" onClick={() => setQuitar(d)}>Desconectar</Button>
            </li>
          ))}
        </ul>
      )}
      {codigo && <ModalCodigo codigo={codigo} onCerrar={cerrarCodigo} onOtro={pedirCodigo} />}
      {quitar && <ModalDesconectar dispositivo={quitar} onCerrar={() => setQuitar(null)} avisar={avisar} />}
    </section>
  );
}

function ModalCodigo({ codigo, onCerrar, onOtro }: { codigo: CodigoExtension; onCerrar: () => void; onOtro: () => void }) {
  const [restante, setRestante] = useState(() => Math.max(0, Math.round((Date.parse(codigo.expira_en) - Date.now()) / 1000)));
  useEffect(() => {
    if (restante <= 0) return;
    const t = window.setTimeout(() => setRestante(Math.max(0, Math.round((Date.parse(codigo.expira_en) - Date.now()) / 1000))), 1000);
    return () => window.clearTimeout(t);
  }, [restante, codigo.expira_en]);
  const vencido = restante <= 0;
  const mmss = `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}`;
  return (
    <Modal abierto onCerrar={onCerrar} titulo="Conectar un navegador"
      subtitulo="Abre la extensión (ícono de Jornada40 junto a la barra de direcciones) y escribe este código."
      acciones={vencido
        ? <Button onClick={onOtro}>Pedir otro código</Button>
        : <Button variante="secundario" onClick={onCerrar}>Listo</Button>}>
      <div className="flex flex-col items-center gap-3 py-2">
        <p className="j40-mono text-[34px] font-semibold tracking-[0.12em]" aria-label={`Código ${codigo.codigo.split('').join(' ')}`}>
          {codigo.codigo}
        </p>
        <p className="text-[13px] text-fg-3" role="status">
          {vencido ? 'El código venció. Pide otro.' : `Vale por ${mmss} minutos y sirve una sola vez.`}
        </p>
      </div>
    </Modal>
  );
}

function ModalDesconectar({ dispositivo, onCerrar, avisar }: {
  dispositivo: DispositivoExtension; onCerrar: () => void; avisar: (texto: string, tipo?: TipoAviso) => void;
}) {
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const confirmar = async () => {
    setEnviando(true);
    try {
      await client.post(`/extension/dispositivos/${dispositivo.id}/desconectar/`);
      await queryClient.invalidateQueries({ queryKey: ['extension', 'dispositivos'] });
      avisar('Navegador desconectado.');
      onCerrar();
    } catch (err) {
      avisar(mensaje(err, 'No pudimos desconectarlo. Intenta de nuevo.'), 'error');
      setEnviando(false);
    }
  };
  return (
    <Modal abierto onCerrar={() => !enviando && onCerrar()} titulo={`Desconectar «${dispositivo.nombre}»`}
      subtitulo="La extensión deja de funcionar en ese navegador al tiro. Para volver a usarla, se conecta con un código nuevo."
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={enviando}>Volver</Button>
        <Button variante="peligro" onClick={confirmar} cargando={enviando}>Desconectar</Button>
      </>}>
      <p className="text-[13px] text-fg-2">Lo que ya se registró en Mi DT y se marcó en Jornada40 no cambia.</p>
    </Modal>
  );
}
