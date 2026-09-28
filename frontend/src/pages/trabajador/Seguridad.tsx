import { KeyRound } from 'lucide-react';
import { Button } from '../../components/j40';
import { FormularioClave } from '../../components/trabajador/FormularioClave';
import { usePortal } from '../../components/trabajador/PortalShell';
import { Seccion, Titulo } from '../../components/trabajador/comun';

export default function Seguridad() {
  const { cuenta, avisar, actualizarCuenta } = usePortal();
  const tiene = cuenta.tiene_clave;
  return (
    <>
      <Titulo titulo="Seguridad">
        {tiene
          ? 'Entras con tu RUT y tu clave. Si la olvidas, puedes entrar con un código al correo y crear una nueva aquí.'
          : 'Hoy entras con un código que te enviamos al correo. Crea una clave para entrar con tu RUT sin esperarlo.'}
      </Titulo>
      <Seccion titulo={tiene ? 'Cambiar clave' : 'Crear clave'} className="max-w-[560px]"
        subtitulo={tiene && cuenta.ingreso_con === 'codigo' ? 'Entraste con un código al correo: no necesitas tu clave actual.' : undefined}>
        <div className="p-4 sm:p-[18px]">
          <FormularioClave key={String(tiene)} cuenta={cuenta}
            onGuardada={() => {
              avisar(tiene ? 'Tu clave quedó actualizada.' : 'Tu clave quedó creada. La próxima vez entra con tu RUT y tu clave.');
              actualizarCuenta();
            }}
            pie={(enviando) => (
              <Button type="submit" cargando={enviando} className="self-start" iconoInicio={<KeyRound className="size-4" strokeWidth={2} />}>
                {enviando ? 'Guardando…' : tiene ? 'Cambiar clave' : 'Crear clave'}
              </Button>
            )} />
        </div>
      </Seccion>
      <p className="text-[12.5px] text-fg-3 max-w-[560px]">
        Al crear o cambiar tu clave se cierran las demás sesiones abiertas del portal. Tu RUT es tu usuario.
      </p>
    </>
  );
}
