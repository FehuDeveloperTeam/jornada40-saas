import { Button, J40Root, Logo } from '../j40';

/** Se muestra si una página no se pudo descargar ni recargando (sin conexión, o una versión nueva a medio publicar). */
export default function PaginaNoCargo() {
  return (
    <J40Root className="min-h-dvh grid place-items-center bg-canvas px-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-[420px]">
        <Logo />
        <h1 className="text-[22px] font-semibold">No pudimos abrir esta página</h1>
        <p className="text-[15px] text-fg-2">
          Puede que Jornada40 se haya actualizado o que tu conexión se haya cortado. Recarga para continuar.
        </p>
        <Button tamano="lg" onClick={() => window.location.reload()}>Recargar</Button>
      </div>
    </J40Root>
  );
}
