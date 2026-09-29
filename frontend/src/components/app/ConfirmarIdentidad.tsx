import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { ShieldCheck } from 'lucide-react';
import { AlertaError, Button, Field, InputContrasena, Modal } from '../j40';
import client, { registrarConfirmacionIdentidad } from '../../api/client';

/**
 * Enviar documentos a firma estampa la firma del empleador: antes se confirma
 * la clave, y queda registrado en cada documento quién lo firmó y cuándo
 * (certificado de firma). La confirmación vale 10 minutos para los envíos en lote.
 */
export function ConfirmarIdentidad() {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    registrarConfirmacionIdentidad(() => new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setClave(''); setError(''); setEnviando(false);
      setAbierto(true);
    }));
    return () => registrarConfirmacionIdentidad(null);
  }, []);

  const terminar = (ok: boolean) => {
    setAbierto(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  const confirmar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!clave) { setError('Ingresa tu clave.'); return; }
    setEnviando(true);
    setError('');
    try {
      await client.post('/firmas/confirmar_identidad/', { clave });
      terminar(true);
    } catch (err) {
      setError((isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || 'No pudimos confirmar tu identidad.');
      setEnviando(false);
    }
  };

  return (
    <Modal abierto={abierto} onCerrar={() => !enviando && terminar(false)} titulo="Confirma tu identidad"
      subtitulo="Vas a firmar como empleador. Tu confirmación queda registrada en cada documento y vale por 10 minutos."
      acciones={<>
        <Button variante="secundario" onClick={() => terminar(false)} disabled={enviando}>Cancelar</Button>
        <Button onClick={() => void confirmar()} cargando={enviando} iconoInicio={<ShieldCheck className="size-4" strokeWidth={2} />}>Confirmar y firmar</Button>
      </>}>
      <form onSubmit={confirmar} className="flex flex-col gap-3" noValidate>
        {error && <AlertaError>{error}</AlertaError>}
        <Field etiqueta="Tu clave de Jornada40">
          {(p) => <InputContrasena {...p} autoFocus autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
