import { useState } from 'react';
import { AlertaError, Button, Casilla, Input, Modal } from '../j40';
import { descargar } from '../../api/descargas';
import type { Empleado } from '../../types';
import { capitalizar } from '../../utils/formato';

// Tipos que empaqueta el backend (EmpleadoViewSet.descarga_masiva).
const TIPOS: [string, string][] = [
  ['contrato', 'Contrato'], ['anexo_40h', 'Anexo Ley 40 horas'], ['anexos_contrato', 'Anexos de contrato'],
  ['liquidaciones', 'Liquidaciones'], ['amonestaciones', 'Amonestaciones'], ['constancias', 'Constancias'],
  ['despidos', 'Cartas de término'], ['mutuo_acuerdo', 'Términos por mutuo acuerdo'],
];
const MAX_TRABAJADORES = 50;  // límite del backend por descarga

/** Expedientes de varios trabajadores en un ZIP, una carpeta por trabajador (plan Pyme+). */
export function DescargaExpedientes({ empresaId, empresaRut, trabajadores, onCerrar, avisar }: {
  empresaId: number; empresaRut: string; trabajadores: Empleado[]; onCerrar: () => void; avisar: (t: string) => void;
}) {
  const [elegidos, setElegidos] = useState<number[]>(() => trabajadores.filter((t) => t.activo).map((t) => t.id).slice(0, MAX_TRABAJADORES));
  const [tipos, setTipos] = useState<string[]>(['contrato', 'anexos_contrato', 'liquidaciones']);
  const [cantidad, setCantidad] = useState('3');
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState(false);
  const texto = busqueda.trim().toLowerCase();
  const visibles = trabajadores.filter((t) => !texto || `${t.nombres} ${t.apellido_paterno} ${t.rut}`.toLowerCase().includes(texto));
  const alternar = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

  const bajar = async () => {
    if (!elegidos.length) { setError('Elige al menos un trabajador.'); return; }
    if (elegidos.length > MAX_TRABAJADORES) { setError(`Máximo ${MAX_TRABAJADORES} trabajadores por descarga: divide la selección.`); return; }
    if (!tipos.length) { setError('Elige al menos un tipo de documento.'); return; }
    setBajando(true);
    setError('');
    const e = await descargar('/empleados/descarga_masiva/', `Expedientes_${empresaRut}.zip`, {
      metodo: 'post',
      datos: { empresa_id: empresaId, empleados: elegidos, documentos: tipos, cantidad_liquidaciones: Number(cantidad) || 1 },
    });
    setBajando(false);
    if (e) { setError(e); return; }
    avisar(`Expedientes de ${elegidos.length} trabajadores descargados`);
    onCerrar();
  };

  return (
    <Modal abierto onCerrar={() => !bajando && onCerrar()} ancho="amplio" titulo="Descargar expedientes"
      subtitulo="Un ZIP con una carpeta por trabajador"
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={bajando}>Cancelar</Button>
        <Button onClick={bajar} cargando={bajando}>{bajando ? 'Preparando ZIP…' : `Descargar ${elegidos.length}`}</Button>
      </>}>
      <div className="flex flex-col gap-4">
        {error && <AlertaError>{error}</AlertaError>}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-fg-2">Trabajadores ({elegidos.length})</span>
            <span className="flex gap-3 text-[12.5px]">
              <button type="button" className="font-medium text-brand-text" onClick={() => setElegidos(visibles.map((t) => t.id).slice(0, MAX_TRABAJADORES))}>Todos</button>
              <button type="button" className="font-medium text-fg-2" onClick={() => setElegidos([])}>Ninguno</button>
            </span>
          </div>
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o RUT" />
          <div className="max-h-[220px] overflow-y-auto rounded-[10px] border border-line divide-y divide-line">
            {visibles.map((t) => (
              <div key={t.id} className="px-3 py-2">
                <Casilla marcada={elegidos.includes(t.id)} onChange={() => setElegidos((xs) => alternar(xs, t.id))}>
                  {capitalizar(`${t.nombres.split(' ')[0]} ${t.apellido_paterno}`)} <span className="text-fg-3 j40-mono text-[12px]">{t.rut}</span>
                  {!t.activo && <span className="text-fg-3"> · desvinculado</span>}
                </Casilla>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium text-fg-2">Documentos</span>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS.map(([v, t]) => <Casilla key={v} marcada={tipos.includes(v)} onChange={() => setTipos((xs) => alternar(xs, v))}>{t}</Casilla>)}
          </div>
          {tipos.includes('liquidaciones') && (
            <label className="flex items-center gap-2 text-[13px]">Últimas
              <Input className="w-16" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(String(Math.min(12, Number(e.target.value.replace(/\D/g, '')) || 0)))} />
              liquidaciones de cada trabajador (máximo 12)</label>
          )}
        </div>
      </div>
    </Modal>
  );
}
