import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { Button } from '../../../src/components/j40/Button';
import { formatRut } from '../../../src/utils/rutUtils';
import type { Mapeos } from '../mapeo';
import { rutLimpio } from '../textos';
import { borrarConexion, guardarEmpresa, leerEmpresa } from './almacen';
import type { Conexion } from './almacen';
import { mensajeDe, pedir } from './api';
import { Aviso, BotonTexto, Cargando, Marca, Pie } from './comun';
import { Ficha } from './Ficha';
import { Levantamiento } from './Levantamiento';
import { Lista } from './Lista';
import { abrirEnMiDT } from './pestana';
import type { EmpresaExtension, VerificacionEmpresa, Yo } from './tipos';
import { useMiDT } from './useMiDT';
import type { MiDT } from './useMiDT';

type Vista = { tipo: 'lista' } | { tipo: 'ficha'; clave: string } | { tipo: 'levantar' };

/** Panel con la extensión conectada: empresa, lo que falta registrar y la ficha de cada uno. */
export function Conectado({ conexion, onSalir }: { conexion: Conexion; onSalir: () => void }) {
  const yo = useQuery({ queryKey: ['yo'], queryFn: () => pedir<Yo>('/extension/v1/yo/') });
  const mapeos = useQuery({ queryKey: ['mapeos'], queryFn: () => pedir<Mapeos>('/extension/v1/mapeos/'), staleTime: 10 * 60_000 });
  const midt = useMiDT(mapeos.data?.empleador ?? null);
  const [elegida, setElegida] = useState<number | null>(null);
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [nota, setNota] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState<'preguntar' | 'enviando' | null>(null);

  useEffect(() => {
    let vigente = true;
    void leerEmpresa().then((id) => { if (vigente) setElegida(id); });
    return () => { vigente = false; };
  }, []);

  useEffect(() => {
    if (!nota) return;
    const t = window.setTimeout(() => setNota(null), 6000);
    return () => window.clearTimeout(t);
  }, [nota]);

  const empresas = yo.data?.empresas ?? [];
  // El RUT con que se entró a Mi DT manda: si está en la cuenta, esa es la empresa.
  const rutMiDT = midt.pagina?.empleador ?? null;
  const porRut = rutMiDT ? empresas.find((e) => rutLimpio(e.rut) === rutMiDT) ?? null : null;
  const empresa = porRut ?? empresas.find((e) => e.id === elegida) ?? (empresas.length === 1 ? empresas[0] : null);
  const verificacion: VerificacionEmpresa = !rutMiDT ? 'sin_leer' : porRut ? 'coincide' : 'distinta';

  const elegir = (id: number) => {
    setElegida(id);
    void guardarEmpresa(id);
    setVista({ tipo: 'lista' });
  };

  const salir = async () => {
    setSaliendo('enviando');
    await pedir('/extension/v1/salir/', { metodo: 'POST' }).catch(() => undefined);
    await borrarConexion();
    onSalir();
  };

  return (
    <div className="flex flex-col min-h-dvh">
      <header className="sticky top-0 z-10 bg-surface border-b border-line px-4 py-3 flex items-center gap-2.5">
        <Marca />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[15px] leading-tight">Jornada40 para Mi DT</p>
          <p className="text-[12.5px] text-fg-3 truncate" title={`${conexion.persona} · ${conexion.cuenta}`}>
            {conexion.persona}{conexion.persona !== conexion.cuenta ? ` · ${conexion.cuenta}` : ''}
          </p>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-3.5 p-4">
        {nota && <Aviso tono="ok">{nota}</Aviso>}
        {vista.tipo === 'levantar' ? (
          <Levantamiento midt={midt} onVolver={() => setVista({ tipo: 'lista' })} />
        ) : yo.isError ? (
          <Aviso tono="peligro" accion={<Button variante="secundario" onClick={() => void yo.refetch()}>Reintentar</Button>}>
            {mensajeDe(yo.error, 'No pudimos conectar con Jornada40.')}
          </Aviso>
        ) : !yo.data ? (
          <Cargando />
        ) : (
          <>
            <EstadoMiDT midt={midt} empresa={empresa} verificacion={verificacion} rutMiDT={rutMiDT} />
            {empresas.length === 0 ? (
              <Aviso tono="aviso">
                Tu usuario no tiene empresas asignadas en Jornada40. Pídele al titular de la cuenta que te dé acceso.
              </Aviso>
            ) : empresas.length > 1 && vista.tipo === 'lista' && (
              <SelectorEmpresa empresas={empresas} empresa={empresa} fija={Boolean(porRut)} onElegir={elegir} />
            )}
            {empresa && vista.tipo === 'lista' && (
              <Lista empresa={empresa} onAbrir={(clave) => setVista({ tipo: 'ficha', clave })} />
            )}
            {empresa && vista.tipo === 'ficha' && (
              <Ficha empresa={empresa} clave={vista.clave} mapeos={mapeos.data ?? null} midt={midt} verificacion={verificacion}
                onVolver={() => setVista({ tipo: 'lista' })}
                onMarcado={(texto) => { setNota(texto); setVista({ tipo: 'lista' }); }} />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-line px-4 py-3 flex flex-col gap-2.5">
        {saliendo ? (
          <Aviso tono="aviso" titulo="¿Desconectar este navegador?"
            accion={<>
              <Button variante="secundario" onClick={() => setSaliendo(null)} disabled={saliendo === 'enviando'}>Volver</Button>
              <Button variante="peligro" onClick={() => void salir()} cargando={saliendo === 'enviando'}>Desconectar</Button>
            </>}>
            Para volver a usar la extensión aquí, necesitarás un código nuevo de Jornada40.
          </Aviso>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {vista.tipo !== 'levantar' && <BotonTexto onClick={() => setVista({ tipo: 'levantar' })}>Modo levantamiento</BotonTexto>}
            <BotonTexto peligro onClick={() => setSaliendo('preguntar')}>Desconectar este navegador</BotonTexto>
          </div>
        )}
        <Pie />
      </footer>
    </div>
  );
}

function EstadoMiDT({ midt, empresa, verificacion, rutMiDT }: {
  midt: MiDT; empresa: EmpresaExtension | null; verificacion: VerificacionEmpresa; rutMiDT: string | null;
}) {
  if (!midt.pestana?.enMiDT) {
    return (
      <Aviso tono="info" titulo="Abre Mi DT en esta ventana"
        accion={<Button variante="secundario" onClick={() => void abrirEnMiDT('/', midt.pestana)}
          iconoFin={<ExternalLink className="size-4" strokeWidth={2} />}>Abrir Mi DT</Button>}>
        Entra con tu Clave Única, como siempre. La extensión nunca la ve.
      </Aviso>
    );
  }
  if (midt.sinScript) {
    return (
      <Aviso tono="aviso" titulo="Recarga la página de Mi DT">
        Presiona F5 en la pestaña de Mi DT para que la extensión pueda verla.
      </Aviso>
    );
  }
  if (verificacion === 'distinta') {
    return (
      <Aviso tono="peligro" titulo="Entraste a Mi DT con otra empresa">
        En Mi DT estás con el RUT {formatRut(rutMiDT ?? '')}, que no está entre tus empresas de Jornada40. Cambia de
        empresa en Mi DT: no llenaremos nada hasta que coincidan.
      </Aviso>
    );
  }
  if (verificacion === 'coincide' && empresa) return <Aviso tono="ok">Mi DT abierto con {empresa.nombre}.</Aviso>;
  return <Aviso tono="ok">Mi DT abierto.</Aviso>;
}

function SelectorEmpresa({ empresas, empresa, fija, onElegir }: {
  empresas: EmpresaExtension[]; empresa: EmpresaExtension | null; fija: boolean; onElegir: (id: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-fg-2">Empresa</span>
      <select value={empresa?.id ?? ''} disabled={fija} onChange={(e) => onElegir(Number(e.target.value))}
        className="h-12 px-3 rounded-[10px] border border-line-strong bg-surface text-fg text-[15px] disabled:bg-sunken">
        {!empresa && <option value="">Elige la empresa con que entraste a Mi DT</option>}
        {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre} ({formatRut(e.rut)})</option>)}
      </select>
      {fija && <span className="text-[12.5px] text-fg-3">Elegida según la empresa con que entraste a Mi DT.</span>}
    </label>
  );
}
