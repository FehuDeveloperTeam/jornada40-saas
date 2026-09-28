import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AlertaError, InputContrasena, MedidorContrasena } from '../j40';
import { mensajeError, portal } from '../../api/portal';
import type { CuentaTrabajador } from '../../types';
import { REGLA_CONTRASENA, problemaContrasena } from '../../utils/contrasena';

const normalizar = (t: string) => t.replace(/[.\-\s]/g, '').toUpperCase();

/** Qué le falta a la clave nueva, o null. El backend exige lo mismo (y algo menos). */
function problemaClave(clave: string, rut: string): string | null {
  if (clave && normalizar(clave) === normalizar(rut)) return 'La clave no puede ser tu RUT.';
  return problemaContrasena(clave);
}

/**
 * Crear o cambiar la clave del portal. Pide la clave actual solo si ya hay
 * una y se entró con ella: quien entró con un código recién verificado no la
 * necesita (así se recupera una clave olvidada). `pie` recibe el estado de
 * envío y pone los botones; el de enviar debe ser `type="submit"`.
 */
export function FormularioClave({ cuenta, onGuardada, pie }: {
  cuenta: CuentaTrabajador;
  onGuardada: () => void;
  pie: (enviando: boolean) => ReactNode;
}) {
  const id = useId();
  const pedirActual = cuenta.tiene_clave && cuenta.ingreso_con === 'clave';
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (pedirActual && !actual) { setError('Ingresa tu clave actual.'); return; }
    const problema = problemaClave(nueva, cuenta.rut);
    if (problema) { setError(problema); return; }
    if (nueva !== repetida) { setError('Las claves no coinciden.'); return; }
    setError('');
    setEnviando(true);
    try {
      await portal.fijarClave(nueva, pedirActual ? actual : undefined);
      setActual(''); setNueva(''); setRepetida('');
      setEnviando(false);
      onGuardada();
    } catch (err) {
      setError(mensajeError(err, 'No pudimos guardar tu clave. Intenta de nuevo en un momento.'));
      setEnviando(false);
    }
  };

  const limpiarError = () => error && setError('');

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-4">
      {/* El RUT como usuario: los gestores de contraseñas guardan la clave con él. */}
      <input type="text" name="username" autoComplete="username" value={cuenta.rut} readOnly hidden />
      {error && <AlertaError>{error}</AlertaError>}
      {pedirActual && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-actual`} className="text-[12.5px] font-medium text-fg-2">Clave actual</label>
          <InputContrasena id={`${id}-actual`} autoComplete="current-password" value={actual}
            onChange={(e) => { setActual(e.target.value); limpiarError(); }} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-nueva`} className="text-[12.5px] font-medium text-fg-2">{cuenta.tiene_clave ? 'Clave nueva' : 'Clave'}</label>
        <InputContrasena id={`${id}-nueva`} autoComplete="new-password" value={nueva} aria-describedby={`${id}-medidor`}
          onChange={(e) => { setNueva(e.target.value); limpiarError(); }} />
        <MedidorContrasena clave={nueva} id={`${id}-medidor`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-repetida`} className="text-[12.5px] font-medium text-fg-2">Repite la clave</label>
        <InputContrasena id={`${id}-repetida`} autoComplete="new-password" value={repetida}
          onChange={(e) => { setRepetida(e.target.value); limpiarError(); }} />
      </div>
      <p className="text-[12px] text-fg-3">{REGLA_CONTRASENA} No puede ser tu RUT.</p>
      {pie(enviando)}
    </form>
  );
}
