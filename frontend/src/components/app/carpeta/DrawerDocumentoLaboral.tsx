import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { TriangleAlert } from 'lucide-react';
import { AlertaError, Button, Casilla, Drawer, Input } from '../../j40';
import client from '../../../api/client';
import type { Empleado, OpcionesDocumentoLaboral, OpcionSimple } from '../../../types';
import { TITULOS_LABORALES } from './laborales';
import type { TipoLaboral } from './laborales';
import { capitalizar, hoyISO } from '../../../utils/formato';
import { cn } from '../../../utils/cn';

const TIPOS = Object.keys(TITULOS_LABORALES) as TipoLaboral[];

const CONTROL = 'h-10 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';
const CUOTAS = ['1', '2', '3', '4', '5', '6', '8', '10', '12', '18', '24', '36', '48', '60'];

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[12.5px] font-medium text-fg-2">{etiqueta}</span>{children}
      {ayuda && <span className="text-[11.5px] text-fg-3">{ayuda}</span>}
    </label>
  );
}

function Lista({ etiqueta, valor, onChange, opciones, vacia = 'Selecciona…', ayuda }: {
  etiqueta: string; valor: string; onChange: (v: string) => void; opciones: OpcionSimple[]; vacia?: string | null; ayuda?: string;
}) {
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <select className={CONTROL} value={valor} onChange={(e) => onChange(e.target.value)}>
        {vacia !== null && <option value="">{vacia}</option>}
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
    </Campo>
  );
}

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

type Valores = Record<string, string | string[]>;

/** Valores de partida de cada tipo: hoy como fecha y, en EPP y riesgos, lo sugerido para el rubro de la empresa. */
function inicial(tipo: TipoLaboral, o: OpcionesDocumentoLaboral | undefined): Valores {
  const hoy = hoyISO();
  if (tipo === 'ENTREGA_EPP') return { fecha: hoy, motivo: 'INGRESO', capacitacion: 'SI', fecha_capacitacion: hoy, epp: o?.epp_sugeridos ?? [] };
  if (tipo === 'INFORMACION_RIESGOS') {
    const rubro = o?.rubro_empresa ?? '';
    return { rubro, riesgos: rubro ? o?.riesgos_por_rubro[rubro] ?? [] : [], motivo: 'INGRESO', fecha_capacitacion: hoy };
  }
  return { desde: hoy };
}

/**
 * Pactos, autorizaciones y constancias: todo se elige de listas cerradas y
 * el backend valida la ley, calcula plazos y días y redacta las cláusulas.
 */
export function DrawerDocumentoLaboral({ empleado, tipoInicial, onCerrar, avisar }: {
  empleado: Empleado; tipoInicial: TipoLaboral; onCerrar: () => void; avisar: (t: string) => void;
}) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<TipoLaboral>(tipoInicial);
  const [v, setV] = useState<Valores>(() => inicial(tipoInicial, undefined));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const opciones = useQuery({
    queryKey: ['documentos-laborales', 'opciones', empleado.id],
    queryFn: async () => (await client.get<OpcionesDocumentoLaboral>(`/documentos-laborales/opciones/?empleado=${empleado.id}`)).data,
  });
  const o = opciones.data;
  // Las sugerencias del rubro (EPP y riesgos) llegan con las opciones: se aplican una vez.
  const [sugerido, setSugerido] = useState(false);
  if (o && !sugerido) {
    setSugerido(true);
    setV((x) => ({ ...inicial(tipo, o), ...x }));
  }
  const estado = o?.tipos[tipo];
  const texto = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : '');
  const lista = (k: string) => (Array.isArray(v[k]) ? (v[k] as string[]) : []);
  const poner = (k: string, valor: string | string[]) => { setV((x) => ({ ...x, [k]: valor })); setError(''); };
  const alternar = (k: string, valor: string, marcado: boolean) =>
    poner(k, marcado ? [...lista(k), valor] : lista(k).filter((x) => x !== valor));
  const permiso = o?.permisos.find((p) => p.valor === texto('permiso'));

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const datos = tipo === 'ENTREGA_EPP'
        ? { ...v, items: lista('epp').map((codigo) => ({ codigo, cantidad: Number(texto(`cantidad_${codigo}`) || '1') })) }
        : v;
      const { data } = await client.post<{ avisos?: string[] }>('/documentos-laborales/', { empleado: empleado.id, tipo, datos });
      await queryClient.invalidateQueries({ queryKey: [tipo === 'TELETRABAJO' ? 'anexos' : 'documentos-laborales', empleado.id] });
      const avisos = data.avisos ?? [];
      avisar(`${TITULOS_LABORALES[tipo]} creado. Envíalo a firma desde el historial.${avisos.length ? ` Atención: ${avisos.join(' ')}` : ''}`);
      onCerrar();
    } catch (err) {
      setError(mensaje(err, 'No pudimos crear el documento.'));
      setGuardando(false);
    }
  };

  return (
    <Drawer abierto onCerrar={onCerrar} titulo="Pactos y constancias" subtitulo={capitalizar(`${empleado.nombres} ${empleado.apellido_paterno}`)}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button onClick={guardar} cargando={guardando} disabled={!o || (!o.permitido && tipo !== 'ENTREGA_EPP') || !estado?.disponible}>Crear documento</Button>
      </>}>
      <div className="flex flex-col gap-4">
        {error && <AlertaError>{error}</AlertaError>}
        {opciones.isLoading && <p className="text-[13px] text-fg-3" role="status">Cargando…</p>}
        {opciones.isError && <AlertaError>No pudimos cargar las opciones del documento.</AlertaError>}
        {o && !o.permitido && tipo !== 'ENTREGA_EPP' && <p className="text-[13px] text-fg-2">Disponible desde el plan Starter.</p>}
        {o?.avisos.map((a) => (
          <p key={a} className="flex gap-2 items-start rounded-[8px] bg-warn-soft text-warn px-3 py-2.5 text-[12.5px]">
            <TriangleAlert className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />{a}
          </p>
        ))}
        <Campo etiqueta="Documento">
          <select className={CONTROL} value={tipo} onChange={(e) => { const t = e.target.value as TipoLaboral; setTipo(t); setV(inicial(t, o)); setError(''); }}>
            {TIPOS.map((t) => <option key={t} value={t}>{TITULOS_LABORALES[t]}</option>)}
          </select>
        </Campo>
        {estado && !estado.disponible && <p className="text-[13px] text-fg-2">{estado.motivo}</p>}

        {o && estado?.disponible && tipo === 'HORAS_EXTRA' && (
          <>
            <Campo etiqueta="Desde"><Input type="date" value={texto('desde')} onChange={(e) => poner('desde', e.target.value)} /></Campo>
            <Lista etiqueta="Duración" valor={texto('meses')} onChange={(x) => poner('meses', x)}
              opciones={[1, 2, 3].map((n) => ({ valor: String(n), texto: `${n} ${n === 1 ? 'mes' : 'meses'}` }))}
              ayuda="Máximo 3 meses; se renueva con un nuevo pacto (Art. 32)." />
            <Lista etiqueta="Máximo de horas extra por día" valor={texto('horas_diarias')} onChange={(x) => poner('horas_diarias', x)}
              opciones={[{ valor: '1', texto: '1 hora' }, { valor: '2', texto: '2 horas (máximo legal)' }]} />
            <Lista etiqueta="Necesidad temporal que lo justifica" valor={texto('motivo')} onChange={(x) => poner('motivo', x)}
              opciones={o.motivos_horas_extra} />
            <Lista etiqueta="¿Cómo se compensan las horas extra?" valor={texto('compensacion') || 'PAGO'} vacia={null}
              onChange={(x) => poner('compensacion', x)} opciones={o.compensaciones_horas_extra}
              ayuda={o.compensaciones_horas_extra.length > 1
                ? 'Con días libres, cada hora extra da 1,5 horas de descanso, hasta 5 días al año. El trabajador los usa dentro de 6 meses; si no, se le pagan (Ley 40 horas, Art. 32).'
                : 'Cambiar horas extra por días libres está disponible desde el plan Pyme.'} />
          </>
        )}

        {o && estado?.disponible && tipo === 'DESCUENTO' && (
          <>
            <Lista etiqueta="Concepto de descuento" valor={texto('concepto')} onChange={(x) => poner('concepto', x)}
              opciones={o.conceptos_descuento} ayuda="Los descuentos legales o judiciales no requieren esta autorización." />
            <Lista etiqueta="Finalidad" valor={texto('finalidad')} onChange={(x) => poner('finalidad', x)} opciones={o.finalidades_descuento} />
            <Campo etiqueta="Monto de cada cuota (pesos)">
              <Input type="number" inputMode="numeric" min={1000} step={1} value={texto('monto_cuota')} onChange={(e) => poner('monto_cuota', e.target.value)} />
            </Campo>
            <Lista etiqueta="Número de cuotas" valor={texto('cuotas')} onChange={(x) => poner('cuotas', x)}
              opciones={[{ valor: '0', texto: 'Mensual, hasta que el trabajador lo revoque' }, ...CUOTAS.map((c) => ({ valor: c, texto: `${c} ${c === '1' ? 'cuota' : 'cuotas'}` }))]} />
            <Campo etiqueta="Primer mes del descuento">
              <Input type="month" value={texto('desde').slice(0, 7)} onChange={(e) => poner('desde', e.target.value ? `${e.target.value}-01` : '')} />
            </Campo>
          </>
        )}

        {o && estado?.disponible && tipo === 'PERMISO_LEGAL' && (
          <>
            <Lista etiqueta="Permiso" valor={texto('permiso')} onChange={(x) => poner('permiso', x)} opciones={o.permisos}
              ayuda="Los días los calcula el sistema según la ley." />
            <Campo etiqueta={permiso?.valor === 'MATRIMONIO' ? 'Fecha del matrimonio o AUC' : permiso?.valor === 'NACIMIENTO' ? 'Fecha del nacimiento' : 'Fecha del fallecimiento'}>
              <Input type="date" value={texto('fecha_hecho')} onChange={(e) => poner('fecha_hecho', e.target.value)} />
            </Campo>
            {permiso && !permiso.desde_el_hecho && (
              <Campo etiqueta="Primer día del permiso"><Input type="date" value={texto('inicio')} onChange={(e) => poner('inicio', e.target.value)} /></Campo>
            )}
            {permiso?.desde_el_hecho && <p className="text-[12px] text-fg-3">El permiso corre desde el día del fallecimiento (Art. 66).</p>}
          </>
        )}

        {o && estado?.disponible && tipo === 'INDEMNIZACION' && (
          <>
            <Lista etiqueta="Aporte mensual del empleador" valor={texto('porcentaje')} onChange={(x) => poner('porcentaje', x)}
              opciones={o.porcentajes_indemnizacion} ayuda="Mínimo legal 4,11 % de la remuneración imponible (Art. 164)." />
            <Campo etiqueta="Primer mes del aporte">
              <Input type="month" value={texto('desde').slice(0, 7)} onChange={(e) => poner('desde', e.target.value ? `${e.target.value}-01` : '')} />
            </Campo>
            <p className="text-[12px] text-fg-3">Por ahora solo se genera el pacto; el aporte en la liquidación y Previred se agrega más adelante.</p>
          </>
        )}

        {o && estado?.disponible && tipo === 'ENTREGA_EPP' && (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[13px] font-medium text-fg-2 mb-1">Elementos entregados (sin costo para el trabajador)</legend>
              {o.epp.map((e) => {
                const marcada = lista('epp').includes(e.valor);
                return (
                  <div key={e.valor} className="flex items-center gap-3">
                    <Casilla marcada={marcada} onChange={(m) => alternar('epp', e.valor, m)}>{e.texto}</Casilla>
                    {marcada && (
                      <select aria-label={`Cantidad de ${e.texto}`} className={cn(CONTROL, 'w-20 ml-auto')} value={texto(`cantidad_${e.valor}`) || '1'}
                        onChange={(ev) => poner(`cantidad_${e.valor}`, ev.target.value)}>
                        {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </fieldset>
            <Lista etiqueta="Motivo de la entrega" valor={texto('motivo')} vacia={null} onChange={(x) => poner('motivo', x)} opciones={o.motivos_epp} />
            <Campo etiqueta="Fecha de entrega"><Input type="date" max={hoyISO()} value={texto('fecha')} onChange={(e) => poner('fecha', e.target.value)} /></Campo>
            <Lista etiqueta="¿Recibió la capacitación de al menos 1 hora sobre su uso?" valor={texto('capacitacion')} vacia={null}
              onChange={(x) => poner('capacitacion', x)} opciones={[{ valor: 'SI', texto: 'Sí' }, { valor: 'NO', texto: 'Todavía no' }]}
              ayuda="Se refuerza cada año y al cambiar de elementos (Art. 13 del DS 44)." />
            {texto('capacitacion') === 'SI' && (
              <Campo etiqueta="Fecha de la capacitación"><Input type="date" max={hoyISO()} value={texto('fecha_capacitacion')} onChange={(e) => poner('fecha_capacitacion', e.target.value)} /></Campo>
            )}
          </>
        )}

        {o && estado?.disponible && tipo === 'INFORMACION_RIESGOS' && (
          <>
            <Lista etiqueta="Rubro de la empresa" valor={texto('rubro')} vacia="Elija el rubro…" opciones={o.rubros}
              onChange={(x) => setV((y) => ({ ...y, rubro: x, riesgos: o.riesgos_por_rubro[x] ?? [] }))} />
            <Lista etiqueta="Cuándo se informa" valor={texto('motivo')} vacia={null} onChange={(x) => poner('motivo', x)} opciones={o.motivos_riesgos} />
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[13px] font-medium text-fg-2 mb-1">Riesgos de su puesto (marcados los del rubro)</legend>
              {o.riesgos.filter((r) => lista('riesgos').includes(r.valor) || (texto('rubro') && (r.valor.startsWith(`${texto('rubro')}_`) || r.valor.startsWith('COMUN_'))))
                .map((r) => (
                  <Casilla key={r.valor} marcada={lista('riesgos').includes(r.valor)} onChange={(m) => alternar('riesgos', r.valor, m)}>{r.texto}</Casilla>
                ))}
            </fieldset>
            <Campo etiqueta="Fecha de la capacitación presencial en procedimientos de trabajo seguro">
              <Input type="date" value={texto('fecha_capacitacion')} onChange={(e) => poner('fecha_capacitacion', e.target.value)} />
            </Campo>
            <p className="text-[12.5px] text-fg-3">Los procedimientos de trabajo seguro se enseñan en persona (DT, ORD 374/2024); esta constancia deja registro de lo informado (Art. 15 del DS 44).</p>
          </>
        )}

        {o && estado?.disponible && tipo === 'TELETRABAJO' && (
          <>
            <Lista etiqueta="Modalidad" valor={texto('modalidad')} onChange={(x) => poner('modalidad', x)} opciones={o.modalidades_teletrabajo} />
            {texto('modalidad') === 'PARCIAL' && (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-[12.5px] font-medium text-fg-2 mb-1">Días presenciales</legend>
                <div className="grid grid-cols-3 gap-2">
                  {o.dias_semana.map((d) => (
                    <Casilla key={d.valor} marcada={lista('dias_presenciales').includes(d.valor)}
                      onChange={(m) => alternar('dias_presenciales', d.valor, m)}>{d.texto}</Casilla>
                  ))}
                </div>
              </fieldset>
            )}
            <Lista etiqueta="Lugar de trabajo a distancia" valor={texto('lugar')} onChange={(x) => poner('lugar', x)} opciones={o.lugares_teletrabajo} />
            <Campo etiqueta="Desde"><Input type="date" value={texto('desde')} onChange={(e) => poner('desde', e.target.value)} /></Campo>
            <Lista etiqueta="Duración" valor={texto('duracion')} onChange={(x) => poner('duracion', x)} opciones={o.duraciones_teletrabajo} />
            <Lista etiqueta="Desconexión (12 horas continuas)" valor={texto('desconexion')} onChange={(x) => poner('desconexion', x)}
              opciones={o.horas_desconexion} />
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[12.5px] font-medium text-fg-2 mb-1">Equipos que entrega el empleador</legend>
              {o.equipos_teletrabajo.map((e) => (
                <Casilla key={e.valor} marcada={lista('equipos').includes(e.valor)} onChange={(m) => alternar('equipos', e.valor, m)}>{e.texto}</Casilla>
              ))}
            </fieldset>
            <Campo etiqueta="Compensación mensual de gastos (pesos, opcional)">
              <Input type="number" inputMode="numeric" min={0} step={1} value={texto('compensacion')} onChange={(e) => poner('compensacion', e.target.value)} />
            </Campo>
            <p className="text-[12px] text-fg-3">Se crea como anexo de contrato: al firmarse, la ficha pasa a remota o híbrida y aparece en Dirección del Trabajo para registrarlo.</p>
          </>
        )}
      </div>
    </Drawer>
  );
}
