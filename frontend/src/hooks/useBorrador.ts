import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { borrarBorrador, claveBorrador, guardarBorrador, leerBorrador } from '../utils/borradores';
import type { Borrador } from '../utils/borradores';

/**
 * Guarda `valor` como borrador mientras difiere de `inicial` (cada segundo sin
 * escribir) y ofrece el borrador anterior si existe. `limpiar()` tras guardar.
 */
export function useBorrador<T>(formulario: string, valor: T, inicial: T, habilitado = true) {
  const { user } = useAuth();
  const clave = user ? claveBorrador(user.pk, formulario) : null;
  const base = useMemo(() => JSON.stringify(inicial), [inicial]);
  const [pendiente, setPendiente] = useState<Borrador<T> | null>(() => {
    if (!clave || !habilitado) return null;
    const b = leerBorrador<T>(clave);
    return b && JSON.stringify(b.valor) !== base ? b : null;
  });
  // Mientras se decide qué hacer con el borrador anterior, no se pisa.
  const decidido = useRef(pendiente === null);

  useEffect(() => {
    if (!clave || !habilitado || !decidido.current) return;
    const t = window.setTimeout(() => {
      if (JSON.stringify(valor) === base) borrarBorrador(clave);
      else guardarBorrador(clave, valor);
    }, 1000);
    return () => window.clearTimeout(t);
  }, [clave, habilitado, valor, base]);

  return {
    pendiente,
    /** Devuelve el borrador para cargarlo en el formulario. */
    recuperar: (): T | null => {
      decidido.current = true;
      const v = pendiente?.valor ?? null;
      setPendiente(null);
      return v;
    },
    descartar: () => {
      decidido.current = true;
      if (clave) borrarBorrador(clave);
      setPendiente(null);
    },
    limpiar: () => { if (clave) borrarBorrador(clave); },
  };
}
