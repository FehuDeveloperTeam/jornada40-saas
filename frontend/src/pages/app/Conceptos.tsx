import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeft, Check, Lock, Minus, Pencil, Plus, Search } from 'lucide-react';
import { AlertaError, Button, Chip, Drawer, TarjetaOpcion } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import client from '../../api/client';
import { TIPO_CONCEPTO, useConceptos } from '../../hooks/useRemuneraciones';
import type { ConceptoRemuneracion, TipoConcepto } from '../../types';
import { cn } from '../../utils/cn';
import { capitalizar } from '../../utils/formato';

type Filtro = 'todos' | TipoConcepto | 'EMPRESA';
const FILTROS: [Filtro, string][] = [
  ['todos', 'Todos'], ['HABER_IMPONIBLE', 'Imponibles'], ['HABER_NO_IMPONIBLE', 'No imponibles'],
  ['HORA_EXTRA', 'Horas extra'], ['COMISION', 'Comisiones'], ['DESCUENTO', 'Descuentos'], ['EMPRESA', 'De la empresa'],
];
const TIPOS: TipoConcepto[] = ['HABER_IMPONIBLE', 'HABER_NO_IMPONIBLE', 'HORA_EXTRA', 'COMISION', 'DESCUENTO'];
const DETALLE_TIPO: Record<TipoConcepto, string> = {
  HABER_IMPONIBLE: 'Bonos y asignaciones que cotizan y pagan impuesto',
  HABER_NO_IMPONIBLE: 'Colación, movilización, viáticos y similares',
  HORA_EXTRA: 'Se valoriza con el sueldo y la jornada del contrato',
  COMISION: 'Porcentaje del contrato sobre lo vendido',
  DESCUENTO: 'Préstamos, anticipos y otros descuentos voluntarios',
};
// Lo mismo que fija el backend (ConceptoRemuneracion.NATURALEZA_POR_TIPO), solo para mostrarlo antes de crear.
const NATURALEZA: Record<TipoConcepto, [boolean, boolean, boolean, boolean]> = {
  HABER_IMPONIBLE: [true, true, true, false], HABER_NO_IMPONIBLE: [false, false, false, false],
  HORA_EXTRA: [true, true, true, false], COMISION: [true, true, true, true], DESCUENTO: [false, false, false, false],
};
const MARCAS = ['Imponible', 'Tributable', 'Gratificación', 'Semana corrida'];
const COLUMNAS = 'grid-cols-[minmax(220px,2fr)_150px_repeat(4,96px)_110px_96px]';

const marcas = (c: ConceptoRemuneracion) => [c.es_imponible, c.es_tributable, c.afecta_gratificacion, c.afecta_semana_corrida];

// Palabras que no aportan al código, como en el catálogo del sistema (BONO_TURNO).
const VACIAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'Y', 'POR', 'PARA', 'A', 'EN']);

/** "Bono de turno noche" → "BONO_TURNO_NOCHE", con la convención del catálogo (máx. 40). */
function slug(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .split(/[^A-Z0-9]+/).filter((p) => p && !VACIAS.has(p)).join('_').slice(0, 40).replace(/_+$/, '');
}

export default function Conceptos() {
  const { empresa, avisar } = usePanelContexto();
  const queryClient = useQueryClient();
  const conceptos = useConceptos(empresa.id, true);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<ConceptoRemuneracion | 'nuevo' | null>(null);

  const todos = conceptos.data ?? [];
  const conteo = (f: Filtro) => todos.filter((c) => coincide(c, f)).length;
  const texto = busqueda.trim().toLowerCase();
  const visibles = todos
    .filter((c) => coincide(c, filtro))
    .filter((c) => !texto || c.nombre.toLowerCase().includes(texto) || c.codigo.includes(texto))
    .sort((a, b) => TIPOS.indexOf(a.tipo) - TIPOS.indexOf(b.tipo) || Number(a.es_del_sistema) - Number(b.es_del_sistema) || a.nombre.localeCompare(b.nombre));

  const alternar = async (c: ConceptoRemuneracion) => {
    try {
      await client.patch(`/conceptos/${c.id}/`, { activo: !c.activo });
      await queryClient.invalidateQueries({ queryKey: ['conceptos'] });
      avisar(`${c.nombre}: ${c.activo ? 'desactivado' : 'activado'}`);
    } catch {
      avisar('No pudimos cambiar el estado del concepto.');
    }
  };

  return (
    <div className="flex flex-col gap-[18px] max-w-[1440px] mx-auto">
      <Link to="/app/remuneraciones" className="inline-flex items-center gap-1.5 text-[13px] text-fg-2 self-start">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />Remuneraciones
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="max-w-[720px]">
          <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Catálogo de conceptos</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">
            Haberes y descuentos disponibles en las liquidaciones. El tipo fija su tratamiento previsional y tributario.
          </p>
        </div>
        <Button onClick={() => setEditando('nuevo')} iconoInicio={<Plus className="size-4" strokeWidth={2} />}>Nuevo concepto</Button>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por tipo">
          {FILTROS.map(([f, t]) => (
            <button key={f} type="button" onClick={() => setFiltro(f)} aria-pressed={filtro === f}
              className={cn('inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium whitespace-nowrap',
                filtro === f ? 'bg-brand-soft border-brand text-brand-text' : 'bg-surface border-line text-fg-2 hover:text-fg')}>
              {t}<span className="text-[11px] opacity-70 j40-num">{conteo(f)}</span>
            </button>
          ))}
        </div>
        <label className="relative flex-1 min-w-[220px]">
          <span className="sr-only">Buscar concepto</span>
          <Search className="size-4 absolute left-3 top-3 text-fg-3 pointer-events-none" strokeWidth={2} aria-hidden />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o código"
            className="w-full h-10 pl-9 pr-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[13.5px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft" />
        </label>
      </div>

      <section className="bg-surface border border-line rounded-j40-card shadow-card">
        <div className="hidden min-[720px]:block overflow-x-auto" role="table" aria-label="Conceptos">
          <div className="min-w-[980px]">
            <div role="row" className={cn('grid gap-3 px-[18px] py-2.5 text-[11.5px] font-medium text-fg-3 uppercase tracking-[0.04em] border-b border-line', COLUMNAS)}>
              <span role="columnheader">Concepto</span><span role="columnheader">Tipo</span>
              {MARCAS.map((m) => <span key={m} role="columnheader" className="text-center">{m === 'Semana corrida' ? 'Sem. corrida' : m}</span>)}
              <span role="columnheader">Ámbito</span><span role="columnheader" className="sr-only">Acciones</span>
            </div>
            {visibles.map((c) => (
              <div key={c.id} role="row" className={cn('grid gap-3 items-center px-[18px] py-2.5 border-b border-line last:border-b-0 text-[13px]', COLUMNAS, !c.activo && 'opacity-55')}>
                <span role="cell" className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{c.nombre}</span>
                  <span className="text-[11.5px] text-fg-3 j40-mono truncate">{c.codigo}</span>
                </span>
                <span role="cell"><Chip>{TIPO_CONCEPTO[c.tipo]}</Chip></span>
                {marcas(c).map((m, i) => (
                  <span key={i} role="cell" className="grid place-items-center" aria-label={`${MARCAS[i]}: ${m ? 'sí' : 'no'}`}>
                    {m ? <Check className="size-4 text-ok" strokeWidth={2.5} /> : <Minus className="size-4 text-fg-3" strokeWidth={2} />}
                  </span>
                ))}
                <span role="cell" className="inline-flex items-center gap-1.5 text-fg-2">
                  {c.es_del_sistema ? <><Lock className="size-3.5 text-fg-3" strokeWidth={2} aria-hidden />Sistema</> : 'Empresa'}
                </span>
                <span role="cell" className="flex items-center justify-end gap-1.5">
                  {!c.es_del_sistema && (
                    <>
                      <Interruptor activo={c.activo} onCambio={() => alternar(c)} etiqueta={`${c.nombre} activo`} />
                      <Button variante="fantasma" tamano="sm" soloIcono aria-label={`Editar ${c.nombre}`} onClick={() => setEditando(c)}>
                        <Pencil className="size-4" strokeWidth={2} />
                      </Button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-[720px]:hidden flex flex-col">
          {visibles.map((c) => (
            <div key={c.id} className={cn('flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0', !c.activo && 'opacity-55')}>
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[14px] font-medium truncate">{c.nombre}</span>
                <span className="flex gap-1.5 items-center flex-wrap">
                  <Chip>{TIPO_CONCEPTO[c.tipo]}</Chip>
                  <span className="text-[11.5px] text-fg-3">{MARCAS.filter((_, i) => marcas(c)[i]).join(' · ') || 'Sin efecto previsional'}</span>
                </span>
              </span>
              {c.es_del_sistema
                ? <Lock className="size-4 text-fg-3" strokeWidth={2} aria-label="Catálogo del sistema" />
                : <Button variante="fantasma" tamano="sm" soloIcono aria-label={`Editar ${c.nombre}`} onClick={() => setEditando(c)}><Pencil className="size-4" strokeWidth={2} /></Button>}
            </div>
          ))}
        </div>
        {!conceptos.isLoading && visibles.length === 0 && (
          <p className="px-[18px] py-6 text-[13px] text-fg-3">Ningún concepto coincide con la búsqueda.</p>
        )}
      </section>

      {editando && (
        <DrawerConcepto key={editando === 'nuevo' ? 'nuevo' : editando.id} concepto={editando === 'nuevo' ? undefined : editando}
          empresaId={empresa.id} empresaNombre={capitalizar(empresa.nombre_legal)} existentes={todos}
          onCerrar={() => setEditando(null)} avisar={avisar} />
      )}
    </div>
  );
}

function coincide(c: ConceptoRemuneracion, f: Filtro) {
  if (f === 'todos') return true;
  if (f === 'EMPRESA') return !c.es_del_sistema;
  return c.tipo === f;
}

function Interruptor({ activo, onCambio, etiqueta }: { activo: boolean; onCambio: () => void; etiqueta: string }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} onClick={onCambio}
      title={activo ? 'Activo: aparece al emitir liquidaciones' : 'Inactivo: no aparece al emitir'}
      className={cn('relative w-9 h-5 rounded-full transition-colors', activo ? 'bg-brand-btn' : 'bg-line-strong')}>
      <span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] duration-150', activo ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}

function DrawerConcepto({ concepto, empresaId, empresaNombre, existentes, onCerrar, avisar }: {
  concepto?: ConceptoRemuneracion; empresaId: number; empresaNombre: string; existentes: ConceptoRemuneracion[];
  onCerrar: () => void; avisar: (t: string) => void;
}) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(concepto?.nombre ?? '');
  const [tipo, setTipo] = useState<TipoConcepto>(concepto?.tipo ?? 'HABER_IMPONIBLE');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const codigo = concepto?.codigo ?? slug(nombre);
  const repetido = !concepto && Boolean(codigo) && existentes.some((c) => c.empresa === empresaId && c.codigo === codigo);
  const naturaleza = concepto ? marcas(concepto) : NATURALEZA[tipo];

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      if (concepto) await client.patch(`/conceptos/${concepto.id}/`, { nombre: nombre.trim() });
      else await client.post('/conceptos/', { empresa: empresaId, nombre: nombre.trim(), codigo, tipo });
      await queryClient.invalidateQueries({ queryKey: ['conceptos'] });
      avisar(concepto ? 'Concepto actualizado' : `Concepto «${nombre.trim()}» creado`);
      onCerrar();
    } catch (err) {
      const d = isAxiosError(err) ? (err.response?.data as Record<string, unknown> | undefined) : undefined;
      const msj = d && Object.values(d).flat().filter((x) => typeof x === 'string').join(' ');
      setError(msj || 'No pudimos guardar el concepto.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Drawer abierto onCerrar={onCerrar} titulo={concepto ? 'Editar concepto' : 'Nuevo concepto'} subtitulo={empresaNombre}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button onClick={guardar} cargando={guardando} disabled={!nombre.trim() || !codigo || repetido}>{concepto ? 'Guardar' : 'Crear concepto'}</Button>
      </>}>
      <div className="flex flex-col gap-5">
        {error && <AlertaError>{error}</AlertaError>}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-2">Nombre</span>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} placeholder="Bono de turno noche"
            className="h-10 px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft" />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-2">Código</span>
          <span className={cn('h-10 px-3 flex items-center rounded-j40-control bg-sunken text-[13.5px] j40-mono', repetido && 'text-danger')}>{codigo || '—'}</span>
          <span className={cn('text-[11.5px]', repetido ? 'text-danger' : 'text-fg-3')}>
            {repetido ? 'Ya existe un concepto con este código en la empresa. Cambia el nombre.'
              : concepto ? 'El código no se cambia: las liquidaciones emitidas lo referencian.' : 'Se genera a partir del nombre y no se puede cambiar después.'}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium text-fg-2">Tipo{concepto && <span className="text-fg-3 font-normal"> · fijo una vez creado</span>}</span>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-2">
            {TIPOS.map((t) => (
              <TarjetaOpcion key={t} seleccionada={tipo === t} onSeleccionar={() => !concepto && setTipo(t)}
                titulo={TIPO_CONCEPTO[t]} detalle={DETALLE_TIPO[t]}
                className={concepto && tipo !== t ? 'opacity-45 pointer-events-none' : undefined} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium text-fg-2">Tratamiento previsional y tributario</span>
          <div className="grid grid-cols-2 gap-2">
            {MARCAS.map((m, i) => (
              <span key={m} className="flex items-center gap-2 rounded-[8px] border border-line px-3 py-2 text-[13px]">
                {naturaleza[i] ? <Check className="size-4 text-ok" strokeWidth={2.5} aria-hidden /> : <Minus className="size-4 text-fg-3" strokeWidth={2} aria-hidden />}
                {m}<span className="sr-only">: {naturaleza[i] ? 'sí' : 'no'}</span>
              </span>
            ))}
          </div>
          <span className="text-[11.5px] text-fg-3">Lo fija el tipo según la ley; no depende de quien crea el concepto.</span>
        </div>
        <div className="flex flex-col gap-1.5 opacity-60">
          <span className="text-[12.5px] font-medium text-fg-2">Código LRE</span>
          <input disabled placeholder="Se habilita con el Libro de Remuneraciones Electrónico"
            className="h-10 px-3 rounded-j40-control border border-line bg-sunken text-[13.5px]" />
        </div>
      </div>
    </Drawer>
  );
}
