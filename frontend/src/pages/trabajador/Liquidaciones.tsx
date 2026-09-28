import { usePortal } from '../../components/trabajador/PortalShell';
import { EstadoLista, Seccion, Titulo } from '../../components/trabajador/comun';
import { ListaLiquidaciones } from '../../components/trabajador/ListaLiquidaciones';
import { useLiquidacionesPortal } from '../../hooks/usePortal';

export default function Liquidaciones() {
  const { variasEmpresas } = usePortal();
  const { data = [], isLoading, isError } = useLiquidacionesPortal();
  return (
    <>
      <Titulo titulo="Liquidaciones">
        Tus liquidaciones de sueldo de los meses cerrados. Si firmaste una, descargas la versión firmada.
      </Titulo>
      <Seccion titulo="Por período" subtitulo={data.length ? `${data.length} ${data.length === 1 ? 'liquidación' : 'liquidaciones'}` : undefined}>
        <EstadoLista cargando={isLoading} error={isError} vacia={!data.length} textoVacio="Aún no hay liquidaciones disponibles." />
        {data.length > 0 && <ListaLiquidaciones liquidaciones={data} variasEmpresas={variasEmpresas} />}
      </Seccion>
    </>
  );
}
