import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Lock, Plus, Trash2 } from 'lucide-react';
import client from '../../../api/client';
import { AlertaError, Button, Drawer } from '../../j40';
import { useConceptos, TIPO_CONCEPTO } from '../../../hooks/useRemuneraciones';
import type { DatosLiquidacion, ItemEnviado, Simulacion } from '../../../hooks/useRemuneraciones';
import type { ConceptoRemuneracion, Empleado, Liquidacion, SolicitudFirma, TipoConcepto } from '../../../types';
import { capitalizar, clp, periodo } from '../../../utils/formato';
import { cn } from '../../../utils/cn';

interface ItemForm {
  clave: number;
  concepto: number | null;
  glosa: string;
  naturaleza: TipoConcepto;
  valor: string;       // pesos, solo dígitos
  horas: string;
  recargo: string;
  montoVendido: string;
}

const ORDEN_TIPOS: TipoConcepto[] = ['HABER_IMPONIBLE', 'HORA_EXTRA', 'COMISION', 'HABER_NO_IMPONIBLE', 'DESCUENTO'];
const CONTROL = 'h-9 w-full px-2.5 rounded-[8px] border border-line-strong bg-surface text-fg text-[13.5px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:opacity-60';
const soloDigitos = (v: string) => v.replace(/\D/g, '');
/** Recargo del concepto de hora extra según su código (HORA_EXTRA_100 → 100); si no lo dice, el mínimo legal: 50 %. */
const recargoDe = (c: ConceptoRemuneracion) => c.codigo.match(/(\d{2,3})$/)?.[1] ?? '50';
const miles = (v: string) => (v ? Number(v).toLocaleString('es-CL') : '');

function itemsDesde(liq: Liquidacion | undefined): ItemForm[] {
  return (liq?.detalle_items ?? []).map((i, n) => ({
    clave: n + 1, concepto: i.concepto ?? null, glosa: i.glosa, naturaleza: i.naturaleza,
    valor: String(i.valor ?? ''), horas: i.horas != null ? String(i.horas) : '',
    recargo: i.recargo != null ? String(i.recargo) : '50', montoVendido: i.monto_vendido != null ? String(i.monto_vendido) : '',
  }));
}

function aEnviar(i: ItemForm): ItemEnviado {
  const base = { concepto: i.concepto, glosa: i.glosa, naturaleza: i.naturaleza };
  if (i.naturaleza === 'HORA_EXTRA') return { ...base, horas: Number(i.horas.replace(',', '.')) || 0, recargo: Number(i.recargo) || 50 };
  if (i.naturaleza === 'COMISION') return { ...base, monto_vendido: Number(i.montoVendido) || 0 };
  return { ...base, valor: Number(i.valor) || 0 };
}

/**
 * Emite o edita la liquidación de un trabajador en un período. La vista previa
 * es la respuesta de /liquidaciones/simular/: el cálculo vive solo en el
 * backend y aquí se muestra tal cual.
 */
export function DrawerLiquidacion({ abierto, onCerrar, empleado, empresaId, mes, anio, existente, firma, avisar }: {
  abierto: boolean; onCerrar: () => void; empleado: Empleado; empresaId: number; mes: number; anio: number;
  existente?: Liquidacion; firma?: SolicitudFirma; avisar: (t: string) => void;
}) {
  const queryClient = useQueryClient();
  const conceptos = useConceptos(empresaId);
  const [licencia, setLicencia] = useState(String(existente?.dias_licencia ?? 0));
  const [ausencias, setAusencias] = useState(String(existente?.dias_ausencia ?? 0));
  const [noContratados, setNoContratados] = useState(String(existente?.dias_no_contratados ?? 0));
  const [items, setItems] = useState<ItemForm[]>(() => itemsDesde(existente));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Firmada: inmutable. Con firma pendiente: hay que cancelarla antes (lo exige el backend).
  const bloqueo = firma?.estado === 'FIRMADO'
    ? 'El trabajador ya firmó esta liquidación: no se puede modificar.'
    : firma?.estado === 'PENDIENTE'
      ? 'Tiene una firma pendiente. Cancela la solicitud en Firma electrónica para poder modificarla.'
      : '';

  const dias = [licencia, ausencias, noContratados].map((d) => Number(d) || 0);
  const diasTrabajados = Math.max(0, 30 - dias[0] - dias[1] - dias[2]);
  const datos: DatosLiquidacion = useMemo(() => ({
    empleado: empleado.id, mes, anio, dias_trabajados: diasTrabajados,
    dias_licencia: dias[0], dias_ausencia: dias[1], dias_no_contratados: dias[2],
    detalle_items: items.map(aEnviar),
    ...(existente ? { liquidacion: existente.id } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [empleado.id, mes, anio, diasTrabajados, dias[0], dias[1], dias[2], items, existente]);

  // La vista previa espera a que se deje de escribir.
  const [enEspera, setEnEspera] = useState(datos);
  useEffect(() => {
    const t = window.setTimeout(() => setEnEspera(datos), 400);
    return () => window.clearTimeout(t);
  }, [datos]);

  const simulacion = useQuery({
    queryKey: ['simular-liquidacion', enEspera],
    queryFn: async () => (await client.post<Simulacion>('/liquidaciones/simular/', enEspera)).data,
    enabled: abierto && Boolean(empleado.contrato_activo),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const errorSimulacion = simulacion.error && isAxiosError(simulacion.error)
    ? (simulacion.error.response?.data as { error?: string } | undefined)?.error ?? 'No pudimos calcular la vista previa.'
    : '';

  const agregar = (c: ConceptoRemuneracion) => setItems((xs) => [...xs, {
    clave: Math.max(0, ...xs.map((x) => x.clave)) + 1, concepto: c.id, glosa: c.nombre, naturaleza: c.tipo,
    valor: '', horas: '', recargo: recargoDe(c), montoVendido: '',
  }]);
  const cambiar = (clave: number, cambio: Partial<ItemForm>) => setItems((xs) => xs.map((x) => (x.clave === clave ? { ...x, ...cambio } : x)));
  const quitar = (clave: number) => setItems((xs) => xs.filter((x) => x.clave !== clave));

  const guardar = async () => {
    setGuardando(true);
    setError('');
    const { liquidacion: _omitir, ...payload } = datos;
    void _omitir;
    try {
      if (existente) await client.patch(`/liquidaciones/${existente.id}/`, payload);
      else await client.post('/liquidaciones/', payload);
      await queryClient.invalidateQueries({ queryKey: ['liquidaciones'] });
      avisar(existente ? 'Liquidación actualizada' : `Liquidación de ${periodo(mes, anio)} emitida`);
      onCerrar();
    } catch (err) {
      const d = isAxiosError(err) ? (err.response?.data as Record<string, unknown> | undefined) : undefined;
      setError((typeof d?.error === 'string' && d.error) || 'No pudimos guardar la liquidación.');
    } finally {
      setGuardando(false);
    }
  };

  const sim = simulacion.data;
  const valorCalculado = (i: number) => sim?.detalle_items?.[i]?.valor;
  const nombre = capitalizar(`${empleado.nombres} ${empleado.apellido_paterno}`);
  const disponibles = (conceptos.data ?? []).filter((c) => c.activo);

  return (
    <Drawer abierto={abierto} onCerrar={onCerrar}
      titulo={existente ? `Liquidación de ${nombre}` : `Emitir liquidación · ${nombre}`}
      subtitulo={`${periodo(mes, anio)} · ${empleado.rut}`}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        {!bloqueo && (
          <Button onClick={guardar} cargando={guardando} disabled={!empleado.contrato_activo || Boolean(errorSimulacion)}>
            {existente ? 'Guardar cambios' : 'Emitir liquidación'}
          </Button>
        )}
      </>}>
      <div className="flex flex-col gap-5">
        {!empleado.contrato_activo && <AlertaError>El trabajador no tiene contrato: crea uno antes de emitir la liquidación.</AlertaError>}
        {bloqueo && (
          <div className="flex gap-2.5 items-start rounded-[10px] bg-warn-soft text-warn px-3.5 py-3 text-[13px]">
            <Lock className="size-4 mt-0.5 shrink-0" strokeWidth={2} aria-hidden />{bloqueo}
          </div>
        )}
        {error && <AlertaError>{error}</AlertaError>}

        <fieldset disabled={Boolean(bloqueo)} className="flex flex-col gap-5 min-w-0">
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-[14px] font-semibold">Asistencia</h3>
              <p className="text-[12px] text-fg-3">Días del período; se pagan 30 menos los que registres aquí.</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
              <Dias etiqueta="Licencia médica" valor={licencia} onCambio={setLicencia} />
              <Dias etiqueta="Ausencias" valor={ausencias} onCambio={setAusencias} />
              <Dias etiqueta="No contratados" valor={noContratados} onCambio={setNoContratados} ayuda="Ingreso o salida a mitad de mes" />
              <div className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium text-fg-2">Días a pagar</span>
                <span className="h-9 flex items-center text-[15px] font-semibold j40-num">{diasTrabajados}</span>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-[14px] font-semibold">Haberes y descuentos del mes</h3>
                <p className="text-[12px] text-fg-3">Del catálogo de conceptos: cada uno trae su tratamiento previsional.</p>
              </div>
              <label className="relative">
                <span className="sr-only">Agregar concepto</span>
                <select className={cn(CONTROL, 'w-auto pl-8 pr-8 font-medium cursor-pointer')} value=""
                  onChange={(e) => { const c = disponibles.find((x) => x.id === Number(e.target.value)); if (c) agregar(c); }}>
                  <option value="">Agregar concepto…</option>
                  {ORDEN_TIPOS.map((t) => {
                    const deTipo = disponibles.filter((c) => c.tipo === t);
                    return deTipo.length > 0 && (
                      <optgroup key={t} label={TIPO_CONCEPTO[t]}>
                        {deTipo.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.es_del_sistema ? '' : ' (empresa)'}</option>)}
                      </optgroup>
                    );
                  })}
                </select>
                <Plus className="size-4 absolute left-2.5 top-2.5 pointer-events-none text-fg-3" strokeWidth={2} aria-hidden />
              </label>
            </div>

            {items.length === 0 && (
              <p className="text-[13px] text-fg-3 rounded-[10px] border border-dashed border-line px-3.5 py-3">
                Sin haberes ni descuentos variables este mes.
              </p>
            )}
            {items.map((i, n) => {
              const calculado = valorCalculado(n);
              return (
                <div key={i.clave} className="rounded-[10px] border border-line p-3 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="text-[13.5px] font-medium truncate">{i.glosa}</span>
                      <span className="text-[11.5px] text-fg-3">{TIPO_CONCEPTO[i.naturaleza]}</span>
                    </span>
                    {(i.naturaleza === 'HORA_EXTRA' || i.naturaleza === 'COMISION') && calculado != null && (
                      <span className="text-[13px] font-semibold j40-num">{clp(calculado)}</span>
                    )}
                    <Button variante="fantasma" tamano="sm" soloIcono aria-label={`Quitar ${i.glosa}`} onClick={() => quitar(i.clave)}>
                      <Trash2 className="size-4" strokeWidth={2} />
                    </Button>
                  </div>
                  {i.naturaleza === 'HORA_EXTRA' ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      <Campo etiqueta="Horas" sufijo="h">
                        <input className={CONTROL} inputMode="decimal" value={i.horas}
                          onChange={(e) => cambiar(i.clave, { horas: e.target.value.replace(/[^\d,.]/g, '') })} />
                      </Campo>
                      <Campo etiqueta="Recargo" sufijo="%">
                        <input className={CONTROL} inputMode="numeric" value={i.recargo}
                          onChange={(e) => cambiar(i.clave, { recargo: soloDigitos(e.target.value) })} />
                      </Campo>
                    </div>
                  ) : i.naturaleza === 'COMISION' ? (
                    <Campo etiqueta="Monto vendido" prefijo="$"
                      ayuda={sim?.detalle_items?.[n]?.porcentaje != null ? `Comisión del contrato: ${String(sim.detalle_items[n].porcentaje).replace('.', ',')} %` : undefined}>
                      <input className={cn(CONTROL, 'pl-6')} inputMode="numeric" value={miles(i.montoVendido)}
                        onChange={(e) => cambiar(i.clave, { montoVendido: soloDigitos(e.target.value) })} />
                    </Campo>
                  ) : (
                    <Campo etiqueta="Monto" prefijo="$">
                      <input className={cn(CONTROL, 'pl-6')} inputMode="numeric" value={miles(i.valor)}
                        onChange={(e) => cambiar(i.clave, { valor: soloDigitos(e.target.value) })} />
                    </Campo>
                  )}
                </div>
              );
            })}
          </section>
        </fieldset>

        <section className="rounded-j40-card border border-line bg-surface-2 p-4 flex flex-col gap-2 j40-num" aria-live="polite">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold">Cálculo</h3>
            <span className="text-[11.5px] text-fg-3">{simulacion.isFetching ? 'Calculando…' : 'Calculado por el servidor'}</span>
          </div>
          {errorSimulacion ? <AlertaError>{errorSimulacion}</AlertaError> : !sim ? (
            <p className="text-[13px] text-fg-3">Calculando…</p>
          ) : (
            <>
              <Linea t={`Sueldo base (${diasTrabajados} días)`} v={sim.sueldo_base} />
              {sim.gratificacion > 0 && <Linea t="Gratificación legal" v={sim.gratificacion} />}
              {sim.semana_corrida > 0 && <Linea t="Semana corrida" v={sim.semana_corrida} />}
              {sim.detalle_items.filter((i) => i.naturaleza !== 'DESCUENTO').map((i, n) => <Linea key={`h${n}`} t={i.glosa} v={i.valor} />)}
              <Linea t="Total haberes" v={sim.total_haberes} fuerte />
              <Linea t="Total imponible" v={sim.total_imponible} tenue />
              <div className="h-px bg-line my-1" />
              <Linea t={`AFP ${capitalizar(sim.afp_nombre) || ''}`.trim()} v={-sim.afp_monto} />
              <Linea t={`Salud ${capitalizar(sim.salud_nombre) || ''}`.trim()} v={-sim.salud_monto} />
              <Linea t="Seguro de cesantía" v={-sim.seguro_cesantia} />
              {sim.impuesto_unico > 0 && <Linea t="Impuesto único" v={-sim.impuesto_unico} />}
              {sim.anticipo_quincena > 0 && <Linea t="Anticipo de quincena" v={-sim.anticipo_quincena} />}
              {sim.detalle_items.filter((i) => i.naturaleza === 'DESCUENTO').map((i, n) => <Linea key={`d${n}`} t={i.glosa} v={-i.valor} />)}
              <Linea t="Total descuentos" v={-sim.total_descuentos} fuerte />
              <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-line">
                <span className="text-[13px] font-medium">Líquido a pagar</span>
                <span className="text-[24px] font-semibold tracking-[-0.01em]">{clp(sim.sueldo_liquido)}</span>
              </div>
            </>
          )}
        </section>
      </div>
    </Drawer>
  );
}

function Linea({ t, v, fuerte, tenue }: { t: string; v: number; fuerte?: boolean; tenue?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3 text-[13px]', fuerte && 'font-semibold', tenue ? 'text-fg-3' : 'text-fg-2', fuerte && 'text-fg')}>
      <span className="min-w-0 truncate">{t}</span><span>{v < 0 ? `− ${clp(-v)}` : clp(v)}</span>
    </div>
  );
}

function Dias({ etiqueta, valor, onCambio, ayuda }: { etiqueta: string; valor: string; onCambio: (v: string) => void; ayuda?: string }) {
  return (
    <Campo etiqueta={etiqueta} sufijo="días" ayuda={ayuda}>
      <input className={CONTROL} inputMode="numeric" value={valor}
        onChange={(e) => onCambio(String(Math.min(30, Number(soloDigitos(e.target.value)) || 0)))} />
    </Campo>
  );
}

function Campo({ etiqueta, prefijo, sufijo, ayuda, children }: {
  etiqueta: string; prefijo?: string; sufijo?: string; ayuda?: string; children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[12.5px] font-medium text-fg-2">{etiqueta}</span>
      <span className="relative">
        {prefijo && <span className="absolute left-2.5 top-2 text-[13.5px] text-fg-3 pointer-events-none">{prefijo}</span>}
        {children}
        {sufijo && <span className="absolute right-2.5 top-2 text-[12.5px] text-fg-3 pointer-events-none">{sufijo}</span>}
      </span>
      {ayuda && <span className="text-[11.5px] text-fg-3">{ayuda}</span>}
    </label>
  );
}
