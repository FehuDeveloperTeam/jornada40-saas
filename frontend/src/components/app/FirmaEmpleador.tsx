import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AlertaError, Button, FirmaPad, Input, Modal } from '../j40';
import client from '../../api/client';
import { fechaCL } from '../../utils/formato';
import { usePanelContexto } from './AppShell';

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

/** Dibujo y datos de quien firma por la empresa; se estampa en los documentos firmados. */
export function FirmaEmpleador({ onCerrar, avisar }: { onCerrar: () => void; avisar: (t: string) => void }) {
  const { empresa } = usePanelContexto();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(empresa.firma_firmante_nombre || empresa.representante_legal || '');
  const [cargo, setCargo] = useState(empresa.firma_firmante_cargo || 'Representante legal');
  const [firma, setFirma] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!firma) return;
    setGuardando(true);
    setError('');
    try {
      await client.patch(`/empresas/${empresa.id}/configurar-firma/`, {
        firma_imagen: firma, firma_firmante_nombre: nombre.trim().toUpperCase(), firma_firmante_cargo: cargo.trim().toUpperCase(),
      });
      await queryClient.invalidateQueries({ queryKey: ['empresas'] });
      avisar('Firma del empleador guardada');
      onCerrar();
    } catch (err) {
      setError(mensaje(err, 'No pudimos guardar la firma.'));
      setGuardando(false);
    }
  };

  return (
    <Modal abierto onCerrar={onCerrar} ancho="amplio" titulo="Firma del empleador"
      subtitulo={empresa.firma_configurada ? `Configurada el ${fechaCL(empresa.firma_configurada_en)}. Dibujar una nueva la reemplaza.` : 'Se estampa en todos los documentos firmados de la empresa.'}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button onClick={guardar} cargando={guardando} disabled={!firma || !nombre.trim()}>Guardar firma</Button>
      </>}>
      <div className="flex flex-col gap-4">
        {error && <AlertaError>{error}</AlertaError>}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
          <label className="flex flex-col gap-1.5"><span className="text-[12.5px] font-medium text-fg-2">Nombre de quien firma</span>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12.5px] font-medium text-fg-2">Cargo</span>
            <Input value={cargo} onChange={(e) => setCargo(e.target.value)} /></label>
        </div>
        <FirmaPad onChange={setFirma} etiqueta="Firma" />
      </div>
    </Modal>
  );
}
