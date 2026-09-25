import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Check, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FolderArchive, Landmark, Lock, Send, Shapes, Upload,
} from 'lucide-react';
import { AlertaError, Button, Chip, Modal } from '../../components/j40';
import type { TonoChip } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import { DrawerLiquidacion } from '../../components/app/remuneraciones/DrawerLiquidacion';
import { ModalLre } from '../../components/app/remuneraciones/ModalLre';
import { firmaDe } from '../../components/app/carpeta/utiles';
import client from '../../api/client';
import { descargar } from '../../api/descargas';
import { rutaAccion, useFirmas } from '../../hooks/usePanel';
import { useLiquidacionesPeriodo } from '../../hooks/useRemuneraciones';
import type { Empleado, Liquidacion, SolicitudFirma } from '../../types';
import { cn } from '../../utils/cn';
import { capitalizar, clp, fechaCL, iniciales, nombreMes, periodo } from '../../utils/formato';

const COLUMNAS = 'grid-cols-[minmax(220px,2fr)_60px_repeat(4,minmax(100px,1fr))_130px_104px]';

function estadoFila(liq: Liquidacion | undefined, firma: SolicitudFirma | undefined): { texto: string; tono: TonoChip } {
  if (!liq) return { texto: 'Sin emitir', tono: 'neutro' };
  if (firma?.estado === 'FIRMADO') return { texto: 'Firmada', tono: 'ok' };
  if (firma?.estado === 'PENDIENTE') return { texto: 'Pendiente de firma', tono: 'aviso' };
  if (firma?.estado === 'RECHAZADO') return { texto: 'Rechazada', tono: 'peligro' };
  return { texto: 'Emitida', tono: 'marca' };
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Aviso de Previred con los datos que faltan: "…rechaza): Ana Pérez: sexo; AFP | Luis Soto: Isapre". */
function leerFaltantesPrevired(mensaje: string): { intro: string; lineas: string[] } | null {
  if (!mensaje.includes(' | ') && !/Previred/i.test(mensaje)) return null;
  const corte = mensaje.indexOf('): ');
  const intro = corte >= 0 ? mensaje.slice(0, corte + 1) : '';
  const resto = corte >= 0 ? mensaje.slice(corte + 3) : mensaje;
  const lineas = resto.split(' | ').map((l) => l.trim()).filter(Boolean);
  return lineas.length > 1 || corte >= 0 ? { intro: intro || 'Faltan datos para generar el archivo Previred.', lineas } : null;
}

export default function Remuneraciones() {
  const { empresa, trabajadores, nivel, avisar, cargandoPlan } = usePanelContexto();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const hoy = new Date();
  const mes = Number(params.get('mes')) || hoy.getMonth() + 1;
  const anio = Number(params.get('anio')) || hoy.getFullYear();
  const abiertoId = Number(params.get('trabajador')) || null;

  const liquidaciones = useLiquidacionesPeriodo(empresa.id, mes, anio);
  const firmas = useFirmas();
  const [confirmarMasivo, setConfirmarMasivo] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [lreAbierto, setLreAbierto] = useState(false);

  const porEmpleado = useMemo(() => new Map((liquidaciones.data ?? []).map((l) => [l.empleado, l])), [liquidaciones.data]);
  const inicioPeriodo = iso(new Date(anio, mes - 1, 1));
  const finPeriodo = iso(new Date(anio, mes, 0));
  // Desvinculado dentro del período: trabajó parte del mes (su liquidación se emite una a una).
  const desvinculadoEnPeriodo = (t: Empleado) => !t.activo && Boolean(t.fecha_desvinculacion)
    && t.fecha_desvinculacion! >= inicioPeriodo && t.fecha_desvinculacion! <= finPeriodo;
  // Vigente en el período: activo hoy, o desvinculado después de que terminó.
  const vigenteEnPeriodo = (t: Empleado) => t.activo || Boolean(t.fecha_desvinculacion && t.fecha_desvinculacion > finPeriodo);
  // Contrato que empieza después del período: aún no corresponde liquidación. Como en el
  // backend (_dias_fuera_de_contrato), manda la fecha más antigua entre contrato e ingreso.
  const inicioContrato = (t: Empleado) => [t.contrato_activo?.fecha_inicio, t.fecha_ingreso]
    .filter((f): f is string => Boolean(f)).sort()[0];
  const contratoPosterior = (t: Empleado) => Boolean(inicioContrato(t) && inicioContrato(t)! > finPeriodo);
  // Vigentes, los desvinculados en el período y los que alcanzaron a tener liquidación.
  const filas = trabajadores
    .filter((t) => vigenteEnPeriodo(t) || desvinculadoEnPeriodo(t) || porEmpleado.has(t.id))
    .sort((a, b) => a.apellido_paterno.localeCompare(b.apellido_paterno));
  const pendientes = filas.filter((t) => !porEmpleado.has(t.id) && t.contrato_activo && vigenteEnPeriodo(t) && !contratoPosterior(t));
  // Desvinculados en el período sin liquidación: no van en la emisión masiva (asumiría 30 días).
  const desvinculadosSinLiq = filas.filter((t) => !porEmpleado.has(t.id) && t.contrato_activo && desvinculadoEnPeriodo(t));
  const [faltantesPrevired, setFaltantesPrevired] = useState<{ intro: string; lineas: string[] } | null>(null);
  const emitidas = liquidaciones.data ?? [];
  const firmaDeLiq = (l: Liquidacion | undefined) => (l ? firmaDe(firmas.data, 'liquidacion', l.id) : undefined);
  const firmadas = emitidas.filter((l) => firmaDeLiq(l)?.estado === 'FIRMADO').length;
  // Emitidas que nunca se enviaron a firma, o cuya firma no llegó a completarse.
  const sinEnviar = emitidas.filter((l) => {
    const f = firmaDeLiq(l);
    return !f || ['RECHAZADO', 'EXPIRADO', 'CANCELADO'].includes(f.estado);
  });
  const [confirmarFirma, setConfirmarFirma] = useState(false);
  const [enviandoFirma, setEnviandoFirma] = useState(false);
  const enviarAFirma = async () => {
    setEnviandoFirma(true);
    try {
      const { data } = await client.post<{ enviadas: number; omitidas: { nombre: string; motivo: string }[] }>(
        '/firmas/solicitar_liquidaciones/', { empresa: empresa.id, mes, anio });
      await queryClient.invalidateQueries({ queryKey: ['firmas'] });
      const omitidas = data.omitidas.length
        ? ` · ${data.omitidas.length} sin enviar (${capitalizar(data.omitidas[0].nombre)}: ${data.omitidas[0].motivo})` : '';
      avisar(`${data.enviadas} ${data.enviadas === 1 ? 'liquidación enviada' : 'liquidaciones enviadas'} a firma${omitidas}`,
        data.omitidas.length ? 'error' : 'ok');
      setConfirmarFirma(false);
    } catch (err) {
      avisar((isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || 'No pudimos enviar a firma.', 'error');
    } finally {
      setEnviandoFirma(false);
    }
  };
  const suma = (f: (l: Liquidacion) => number) => emitidas.reduce((s, l) => s + (f(l) || 0), 0);

  const irA = (delta: number) => {
    const f = new Date(anio, mes - 1 + delta, 1);
    setParams({ mes: String(f.getMonth() + 1), anio: String(f.getFullYear()) }, { replace: true });
  };
  const abrir = (id: number | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('trabajador', String(id)); else p.delete('trabajador');
    setParams(p, { replace: true });
  };

  const bajar = async (clave: string, url: string, nombre: string) => {
    setDescargando(clave);
    const error = await descargar(url, nombre);
    setDescargando(null);
    if (!error) { avisar('Archivo descargado'); return; }
    // Previred: la lista de datos faltantes por trabajador se muestra completa, una línea por persona.
    const faltantes = clave === 'previred' ? leerFaltantesPrevired(error) : null;
    if (faltantes) setFaltantesPrevired(faltantes);
    else avisar(error, 'error');
  };
  const consulta = `mes=${mes}&anio=${anio}&empresa=${empresa.id}`;
  // Con varias empresas, el RUT distingue los archivos de cada una.
  const sufijo = `${empresa.rut.replace(/\./g, '')}_${nombreMes(mes)}_${anio}`;

  const emitirPendientes = async () => {
    setEmitiendo(true);
    let ok = 0;
    const errores: string[] = [];
    for (const t of pendientes) {
      try {
        await client.post('/liquidaciones/', {
          empleado: t.id, mes, anio, dias_trabajados: 30, dias_licencia: 0, dias_ausencia: 0, dias_no_contratados: 0, detalle_items: [],
        });
        ok++;
      } catch (err) {
        const d = isAxiosError(err) ? (err.response?.data as { error?: string } | undefined) : undefined;
        errores.push(`${capitalizar(t.nombres.split(' ')[0])} ${capitalizar(t.apellido_paterno)}: ${d?.error ?? 'error'}`);
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['liquidaciones'] });
    setEmitiendo(false);
    setConfirmarMasivo(false);
    if (errores.length) {
      const resto = errores.length > 3 ? ` · y ${errores.length - 3} más` : '';
      avisar(`${ok} emitidas · ${errores.length} con error: ${errores.slice(0, 3).join(' · ')}${resto}`, 'error');
    }
    else avisar(`${ok} liquidaciones emitidas`);
  };

  const notaFila = (t: Empleado): string | undefined => {
    if (desvinculadoEnPeriodo(t)) return `Desvinculado el ${fechaCL(t.fecha_desvinculacion)}`;
    if (!porEmpleado.has(t.id) && contratoPosterior(t)) return `Contrato desde el ${fechaCL(inicioContrato(t))}`;
    return undefined;
  };

  const abierto = abiertoId ? trabajadores.find((t) => t.id === abiertoId) : undefined;
  const liqAbierta = abierto ? porEmpleado.get(abierto.id) : undefined;

  const pasos = [
    { titulo: 'Emisión', detalle: `${emitidas.length} de ${emitidas.length + pendientes.length + desvinculadosSinLiq.length} liquidaciones`, hecho: pendientes.length + desvinculadosSinLiq.length === 0 && emitidas.length > 0 },
    { titulo: 'Firma del trabajador', detalle: `${firmadas} de ${emitidas.length} firmadas${sinEnviar.length ? ` · ${sinEnviar.length} sin enviar` : ''}`, hecho: emitidas.length > 0 && firmadas === emitidas.length },
    { titulo: 'Previred y pago', detalle: `Pago hasta el 13-${String(mes === 12 ? 1 : mes + 1).padStart(2, '0')}`, hecho: false },
  ];
  const actual = pasos.findIndex((p) => !p.hecho);

  return (
    <div className="flex flex-col gap-[18px] max-w-[1440px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex flex-col gap-2">
          <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Remuneraciones</h1>
          <div className="inline-flex items-center gap-1 self-start rounded-[10px] bg-sunken p-[3px]">
            <Button variante="fantasma" tamano="sm" soloIcono aria-label="Período anterior" onClick={() => irA(-1)}><ChevronLeft className="size-4" strokeWidth={2} /></Button>
            <span className="px-2 text-[13.5px] font-semibold min-w-[130px] text-center" aria-live="polite">{periodo(mes, anio)}</span>
            <Button variante="fantasma" tamano="sm" soloIcono aria-label="Período siguiente" onClick={() => irA(1)}><ChevronRight className="size-4" strokeWidth={2} /></Button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/app/remuneraciones/conceptos" className="inline-flex items-center gap-2 h-10 px-4 rounded-j40-control border border-line-strong bg-surface text-fg text-[13px] font-medium no-underline hover:no-underline hover:bg-surface-2">
            <Shapes className="size-4" strokeWidth={2} aria-hidden />Conceptos
          </Link>
          {cargandoPlan ? null : nivel >= 3 ? (
            <>
              <Button variante="secundario" cargando={descargando === 'previred'} iconoInicio={<Upload className="size-4" strokeWidth={2} />}
                onClick={() => bajar('previred', `/liquidaciones/exportar_previred/?${consulta}`, `Previred_${sufijo}.txt`)}>Archivo Previred</Button>
              <Button variante="secundario" iconoInicio={<Landmark className="size-4" strokeWidth={2} />}
                onClick={() => setLreAbierto(true)}>Libro electrónico DT</Button>
              <Button variante="secundario" cargando={descargando === 'libro'} iconoInicio={<FileSpreadsheet className="size-4" strokeWidth={2} />}
                onClick={() => bajar('libro', `/liquidaciones/libro_remuneraciones/?${consulta}&formato=excel`, `LibroRemuneraciones_${sufijo}.xlsx`)}>Libro (Excel)</Button>
              <Button variante="secundario" cargando={descargando === 'libro-pdf'} iconoInicio={<Download className="size-4" strokeWidth={2} />}
                onClick={() => bajar('libro-pdf', `/liquidaciones/libro_remuneraciones/?${consulta}&formato=pdf`, `LibroRemuneraciones_${sufijo}.pdf`)}>Libro (PDF)</Button>
              <Button variante="secundario" cargando={descargando === 'zip'} iconoInicio={<FolderArchive className="size-4" strokeWidth={2} />}
                onClick={() => bajar('zip', `/liquidaciones/zip_periodo/?${consulta}`, `Liquidaciones_${sufijo}.zip`)}>PDF en ZIP</Button>
            </>
          ) : (
            <Link to="/app/plan" className="inline-flex items-center gap-1.5 h-10 px-3 text-[12.5px] text-fg-3" title="Previred, libro de remuneraciones y ZIP están disponibles desde el plan Pyme">
              <Lock className="size-3.5" strokeWidth={2} aria-hidden />Previred, libros y ZIP desde plan Pyme
            </Link>
          )}
        </div>
      </div>

      {/* Avance real del período: sale de lo emitido y firmado, no de un estado guardado. */}
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-2.5">
        {pasos.map((p, i) => (
          <li key={p.titulo} className={cn('flex items-center gap-3 rounded-j40-card border px-3.5 py-3 bg-surface',
            i === actual ? 'border-brand' : 'border-line')}>
            <span className={cn('size-7 shrink-0 rounded-full grid place-items-center text-[12.5px] font-semibold',
              p.hecho ? 'bg-ok text-white' : i === actual ? 'bg-brand-btn text-white' : 'border border-line-strong text-fg-3')}>
              {p.hecho ? <Check className="size-4" strokeWidth={2.5} aria-hidden /> : i + 1}
            </span>
            <span className="flex flex-col min-w-0">
              <span className={cn('text-[13px] font-medium', !p.hecho && i !== actual && 'text-fg-3')}>{p.titulo}</span>
              <span className="text-[11.5px] text-fg-3">{p.detalle}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
        <Kpi t="Liquidaciones emitidas" v={`${emitidas.length}`}
          sub={pendientes.length + desvinculadosSinLiq.length ? `${pendientes.length + desvinculadosSinLiq.length} pendientes` : 'Todas emitidas'} />
        <Kpi t="Total imponible" v={clp(suma((l) => l.total_imponible))} />
        <Kpi t="Total haberes" v={clp(suma((l) => l.total_haberes))} />
        <Kpi t="Descuentos legales" v={clp(suma((l) => l.afp_monto + l.salud_monto + l.seguro_cesantia + l.impuesto_unico))} sub="AFP, salud, cesantía e impuesto" />
        <Kpi t="Total líquido" v={clp(suma((l) => l.sueldo_liquido))} destacado />
      </div>

      <section className="bg-surface border border-line rounded-j40-card shadow-card">
        <div className="flex items-center justify-between gap-3 flex-wrap px-[18px] py-3 border-b border-line">
          <div className="flex flex-col">
            <h2 className="text-[14px] font-semibold">Liquidaciones del período</h2>
            <span className="text-[12px] text-fg-3">{filas.length} trabajadores · los montos los calcula el servidor al emitir</span>
          </div>
          <div className="flex gap-2 flex-wrap">
          {sinEnviar.length > 0 && (
            <Button variante={pendientes.length ? 'secundario' : 'primario'} tamano="sm" iconoInicio={<Send className="size-4" strokeWidth={2} />}
              onClick={() => setConfirmarFirma(true)}>Enviar {sinEnviar.length} a firma</Button>
          )}
          {pendientes.length > 0 && (
            <Button tamano="sm" onClick={() => setConfirmarMasivo(true)}>Emitir {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}</Button>
          )}
          </div>
        </div>

        {/* Escritorio: tabla */}
        {/* La tabla desplaza dentro de su marco para que los títulos queden fijos. */}
        <div className="hidden min-[720px]:block overflow-auto max-h-[calc(100dvh-240px)]" role="table" aria-label="Liquidaciones del período">
          <div className="min-w-[960px]">
            <div role="row" className={cn('sticky top-0 z-10 bg-surface grid gap-3 px-[18px] py-2.5 text-[11.5px] font-medium text-fg-3 uppercase tracking-[0.04em] border-b border-line', COLUMNAS)}>
              <span role="columnheader">Trabajador</span><span role="columnheader">Días</span>
              <span role="columnheader" className="text-right">Imponible</span><span role="columnheader" className="text-right">Haberes</span>
              <span role="columnheader" className="text-right">Descuentos</span><span role="columnheader" className="text-right">Líquido</span>
              <span role="columnheader">Estado</span><span role="columnheader" className="sr-only">Acción</span>
            </div>
            {filas.map((t) => <Fila key={t.id} t={t} liq={porEmpleado.get(t.id)} firma={firmaDeLiq(porEmpleado.get(t.id))} onAbrir={() => abrir(t.id)}
              nota={notaFila(t)} />)}
            {filas.length === 0 && <p className="px-[18px] py-6 text-[13px] text-fg-3">No hay trabajadores vigentes en esta empresa.</p>}
          </div>
        </div>

        {/* Móvil: tarjetas */}
        <div className="min-[720px]:hidden flex flex-col">
          {filas.map((t) => {
            const liq = porEmpleado.get(t.id);
            const e = estadoFila(liq, firmaDeLiq(liq));
            const nota = notaFila(t);
            // Sin contrato no hay liquidación que abrir: la tarjeta lleva a crearlo.
            if (!t.contrato_activo && !liq) {
              return (
                <Link key={t.id} to={rutaAccion(t.id, 'contrato')}
                  className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 text-left text-fg no-underline hover:no-underline">
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="text-[14px] font-medium truncate">{capitalizar(`${t.nombres.split(' ')[0]} ${t.apellido_paterno}`)}</span>
                    <span className="text-[12px] text-fg-3">Sin contrato</span>
                  </span>
                  <span className="text-[13px] font-medium text-brand-text shrink-0">Crear contrato</span>
                </Link>
              );
            }
            return (
              <button key={t.id} type="button" onClick={() => abrir(t.id)}
                className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 text-left">
                <span className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="text-[14px] font-medium truncate">{capitalizar(`${t.nombres.split(' ')[0]} ${t.apellido_paterno}`)}</span>
                  {nota && <span className="text-[12px] text-fg-3">{nota}</span>}
                  <Chip tono={e.tono}>{e.texto}</Chip>
                </span>
                <span className="flex flex-col items-end">
                  <span className="text-[15px] font-semibold j40-num">{liq ? clp(liq.sueldo_liquido) : '—'}</span>
                  <span className="text-[11.5px] text-fg-3">líquido</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {abierto && (
        <DrawerLiquidacion key={`${abierto.id}-${mes}-${anio}-${liqAbierta?.id ?? 'nueva'}`} abierto onCerrar={() => abrir(null)}
          empleado={abierto} empresaId={empresa.id} mes={mes} anio={anio} existente={liqAbierta}
          firma={firmaDeLiq(liqAbierta)} avisar={avisar} />
      )}

      <Modal abierto={confirmarMasivo} onCerrar={() => !emitiendo && setConfirmarMasivo(false)}
        titulo={`Emitir ${pendientes.length} liquidaciones`} subtitulo={periodo(mes, anio)}
        acciones={<>
          <Button variante="secundario" onClick={() => setConfirmarMasivo(false)} disabled={emitiendo}>Cancelar</Button>
          <Button onClick={emitirPendientes} cargando={emitiendo}>{emitiendo ? 'Emitiendo…' : 'Emitir'}</Button>
        </>}>
        <p className="text-[13.5px] text-fg-2">
          Se emiten con asistencia completa (30 días) y sin haberes variables. Después puedes abrir cada una para
          registrar licencias, ausencias, horas extra o bonos: al guardar se recalcula.
        </p>
        {desvinculadosSinLiq.length > 0 && (
          <p className="text-[13px] text-fg-2 mt-2">
            {desvinculadosSinLiq.length === 1 ? 'Quien se desvinculó' : `Los ${desvinculadosSinLiq.length} que se desvincularon`} en el período
            no se incluye{desvinculadosSinLiq.length === 1 ? '' : 'n'}: emite su liquidación desde su fila, con los días que trabajó.
          </p>
        )}
      </Modal>

      <ModalLre abierto={lreAbierto} onCerrar={() => setLreAbierto(false)} empresaId={empresa.id} empresaRut={empresa.rut}
        mes={mes} anio={anio} trabajadores={trabajadores} avisar={avisar} />

      <Modal abierto={Boolean(faltantesPrevired)} onCerrar={() => setFaltantesPrevired(null)} ancho="amplio"
        titulo="Faltan datos para el archivo Previred" subtitulo={periodo(mes, anio)}
        acciones={<Button onClick={() => setFaltantesPrevired(null)}>Entendido</Button>}>
        {faltantesPrevired && (
          <div className="flex flex-col gap-3">
            <AlertaError>{faltantesPrevired.intro}</AlertaError>
            <ul className="flex flex-col rounded-[10px] border border-line max-h-[50vh] overflow-y-auto">
              {faltantesPrevired.lineas.map((l) => {
                const corte = l.indexOf(': ');
                const nombre = corte >= 0 ? l.slice(0, corte) : '';
                const falta = corte >= 0 ? l.slice(corte + 2) : l;
                const persona = nombre ? trabajadores.find((t) => `${t.nombres} ${t.apellido_paterno}`.trim().toUpperCase() === nombre.toUpperCase()) : undefined;
                return (
                  <li key={l} className="flex flex-col gap-0.5 px-3.5 py-2.5 border-b border-line last:border-b-0 text-[13px]">
                    {nombre && (persona
                      ? <Link to={`/app/trabajadores/${persona.id}?tab=personal`} className="font-medium" onClick={() => setFaltantesPrevired(null)}>{capitalizar(nombre)}</Link>
                      : <span className="font-medium">{capitalizar(nombre)}</span>)}
                    <span className="text-fg-2">{falta}</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[12.5px] text-fg-3">
              Los datos del trabajador se completan en su carpeta (Previsión y pago); los de la empresa, en Empresa → Seguridad social.
            </p>
          </div>
        )}
      </Modal>

      <Modal abierto={confirmarFirma} onCerrar={() => !enviandoFirma && setConfirmarFirma(false)}
        titulo={`Enviar ${sinEnviar.length} ${sinEnviar.length === 1 ? 'liquidación' : 'liquidaciones'} a firma`} subtitulo={periodo(mes, anio)}
        acciones={<>
          <Button variante="secundario" onClick={() => setConfirmarFirma(false)} disabled={enviandoFirma}>Cancelar</Button>
          <Button onClick={enviarAFirma} cargando={enviandoFirma}>{enviandoFirma ? 'Enviando…' : 'Enviar a firma'}</Button>
        </>}>
        <p className="text-[13.5px] text-fg-2">
          Cada trabajador recibe un correo para revisar y firmar su liquidación. Las ya firmadas o con firma pendiente no
          se reenvían, y si a alguien le falta el correo te lo indicamos al terminar.
        </p>
      </Modal>
    </div>
  );
}

function Fila({ t, liq, firma, onAbrir, nota }: { t: Empleado; liq?: Liquidacion; firma?: SolicitudFirma; onAbrir: () => void; nota?: string }) {
  const e = estadoFila(liq, firma);
  const sinContrato = !t.contrato_activo;
  return (
    <div role="row" className={cn('grid gap-3 items-center px-[18px] py-[11px] border-b border-line last:border-b-0 text-[13px] j40-num', COLUMNAS)}>
      <span role="cell" className="flex gap-3 items-center min-w-0">
        <span className="grid place-items-center size-[34px] shrink-0 rounded-[9px] bg-sunken text-fg-2 text-[12px] font-semibold">{iniciales(t.nombres, t.apellido_paterno)}</span>
        <span className="flex flex-col min-w-0">
          <Link to={`/app/trabajadores/${t.id}?tab=remuneraciones`} className="font-medium truncate text-fg">
            {capitalizar(`${t.nombres.split(' ')[0]} ${t.apellido_paterno} ${t.apellido_materno ?? ''}`)}
          </Link>
          <span className="text-[12px] text-fg-3 truncate">{sinContrato ? 'Sin contrato' : nota ?? capitalizar(t.cargo)}</span>
        </span>
      </span>
      <span role="cell" className="text-fg-2">{liq ? liq.dias_trabajados : '—'}</span>
      <span role="cell" className="text-right">{liq ? clp(liq.total_imponible) : '—'}</span>
      <span role="cell" className="text-right">{liq ? clp(liq.total_haberes) : '—'}</span>
      <span role="cell" className="text-right">{liq ? clp(liq.total_descuentos) : '—'}</span>
      <span role="cell" className="text-right font-semibold">{liq ? clp(liq.sueldo_liquido) : '—'}</span>
      <span role="cell"><Chip tono={e.tono}>{e.texto}</Chip></span>
      <span role="cell" className="text-right">
        {sinContrato && !liq ? (
          <Link to={rutaAccion(t.id, 'contrato')} className="text-[12.5px] font-medium">Crear contrato</Link>
        ) : (
          <Button variante={liq ? 'secundario' : 'primario'} tamano="sm" onClick={onAbrir}>{liq ? 'Abrir' : 'Emitir'}</Button>
        )}
      </span>
    </div>
  );
}

function Kpi({ t, v, sub, destacado }: { t: string; v: string; sub?: string; destacado?: boolean }) {
  return (
    <div className="bg-surface border border-line rounded-j40-card shadow-card px-4 py-3.5 flex flex-col gap-1 min-w-0">
      <span className="text-[12px] text-fg-3">{t}</span>
      <span className={cn('text-[22px] font-semibold j40-num truncate', destacado && 'text-brand-text')}>{v}</span>
      {sub && <span className="text-[11.5px] text-fg-3">{sub}</span>}
    </div>
  );
}
