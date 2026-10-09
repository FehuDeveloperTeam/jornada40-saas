import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { borrarConexion, leerConexion } from './almacen';
import type { Conexion } from './almacen';
import { alDesconectar } from './api';
import { Cargando } from './comun';
import { Conectado } from './Conectado';
import { Conectar } from './Conectar';
import type { Yo } from './tipos';

const temaOscuro = window.matchMedia('(prefers-color-scheme: dark)');
const suscribirTema = (avisar: () => void) => {
  temaOscuro.addEventListener('change', avisar);
  return () => temaOscuro.removeEventListener('change', avisar);
};

/** Panel lateral de la extensión: conectar (una vez) y luego trabajar junto a Mi DT. */
export function Panel() {
  const oscuro = useSyncExternalStore(suscribirTema, () => temaOscuro.matches);
  const queryClient = useQueryClient();
  // undefined mientras se lee el almacenamiento; null = sin conectar.
  const [conexion, setConexion] = useState<Conexion | null | undefined>(undefined);
  const [motivo, setMotivo] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.j40 = oscuro ? 'oscuro' : 'claro';
  }, [oscuro]);

  useEffect(() => {
    let vigente = true;
    void leerConexion().then((c) => { if (vigente) setConexion(c); });
    // Token que ya no sirve (desconectado desde Jornada40, persona retirada, 90 días sin uso).
    alDesconectar((mensaje) => {
      void borrarConexion();
      queryClient.clear();
      setMotivo(mensaje);
      setConexion(null);
    });
    return () => {
      vigente = false;
      alDesconectar(null);
    };
  }, [queryClient]);

  const conectado = (c: Conexion, yo: Yo) => {
    queryClient.setQueryData(['yo'], yo);
    setMotivo(null);
    setConexion(c);
  };
  const salir = () => {
    queryClient.clear();
    setConexion(null);
  };

  return (
    <div className="min-h-dvh bg-canvas text-fg font-sans text-[15px] leading-normal antialiased">
      {conexion === undefined ? (
        <div className="p-4"><Cargando /></div>
      ) : conexion === null ? (
        <Conectar motivo={motivo} onConectado={conectado} />
      ) : (
        <Conectado conexion={conexion} onSalir={salir} />
      )}
    </div>
  );
}
