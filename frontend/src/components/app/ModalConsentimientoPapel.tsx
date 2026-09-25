import { useState } from 'react';
import { isAxiosError } from 'axios';
import client from '../../api/client';
import { Button, Field, Input, Modal } from '../j40';
import type { TipoAviso } from './AppShell';
import { capitalizar, hoyISO } from '../../utils/formato';

/** Registra la autorización de documentación electrónica firmada en papel (fecha de la firma). */
export function ModalConsentimientoPapel({ empleado, onCerrar, avisar, refrescar }: {
  empleado: { id: number; nombre: string } | null;
  onCerrar: () => void;
  avisar: (texto: string, tipo?: TipoAviso) => void;
  refrescar: () => Promise<unknown>;
}) {
  const [fecha, setFecha] = useState(hoyISO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Cada apertura parte con la fecha de hoy y sin error.
  const [abiertoPara, setAbiertoPara] = useState<number | null>(null);
  const id = empleado?.id ?? null;
  if (id !== abiertoPara) {
    setAbiertoPara(id);
    if (id !== null) { setFecha(hoyISO()); setError(''); }
  }

  const guardar = async () => {
    if (!empleado) return;
    if (!fecha) { setError('Indica la fecha en que firmó la autorización.'); return; }
    if (fecha > hoyISO()) { setError('La fecha no puede ser futura.'); return; }
    setGuardando(true);
    setError('');
    try {
      await client.post(`/empleados/${empleado.id}/consentimiento/`, { fecha });
      await refrescar();
      avisar('Autorización registrada');
      onCerrar();
    } catch (err) {
      setError((isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || 'No pudimos registrar la autorización.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal abierto={Boolean(empleado)} onCerrar={() => !guardando && onCerrar()} titulo="Autorización firmada en papel"
      subtitulo={empleado ? capitalizar(empleado.nombre) : undefined}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button onClick={guardar} cargando={guardando}>Registrar</Button>
      </>}>
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-fg-2">
          Guarda el documento firmado en la carpeta física del trabajador: es el respaldo ante una fiscalización.
        </p>
        <Field etiqueta="Fecha en que la firmó" error={error || undefined}>
          {(p) => <Input {...p} type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}
