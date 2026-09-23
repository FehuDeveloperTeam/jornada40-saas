import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, CircleAlert, Download, Plus, Search, Upload } from 'lucide-react';
import { Button, Chip, SegmentedControl } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import { estadoTrabajador, TIPO_CONTRATO } from '../../components/app/trabajador';
import { useVacacionesEmpresa } from '../../hooks/usePanel';
import type { Empleado, VacacionEmpleado } from '../../types';
import { cn } from '../../utils/cn';
import { capitalizar, clp, fechaCL, fechaLocal, iniciales } from '../../utils/formato';
import { jornadaMaximaVigente } from '../../utils/ley40';

/** "44 h", o "Art. 22" para quien está excluido del límite de jornada. */
function jornadaCorta(t: Empleado, horas: number): string {
  if (t.contrato_activo?.tipo_jornada === 'ART_22') return 'Art. 22';
  return horas ? `${horas} h` : '—';
}

type Filtro = 'todos' | 'alertas' | 'vacaciones';

const COLUMNAS = 'grid-cols-[minmax(230px,2.2fr)_130px_minmax(110px,1fr)_110px_76px_96px_110px_150px]';

/** Vacaciones aprobadas que incluyen el día de hoy. */
function deVacacionesHoy(vacaciones: VacacionEmpleado[] | undefined): Set<number> {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return new Set((vacaciones ?? []).filter((v) => {
    const a = fechaLocal(v.fecha_inicio); const b = fechaLocal(v.fecha_fin);
    return v.estado === 'APROBADO' && a && b && a <= hoy && hoy <= b;
  }).map((v) => v.empleado));
}

export default function Trabajadores() {
  const { empresa, trabajadores, cargandoTrabajadores, agregarTrabajador, nivel, avisar } = usePanelContexto();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState('');
  const filtro = (params.get('filtro') as Filtro) || 'todos';
  const vacaciones = useVacacionesEmpresa(empresa.id, nivel >= 2);
  const enVacaciones = useMemo(() => deVacacionesHoy(vacaciones.data), [vacaciones.data]);
  const maximo = jornadaMaximaVigente();

  const conAlertas = trabajadores.filter((t) => (t.contrato_activo?.avisos_jornada?.length ?? 0) > 0 || !t.contrato_activo);
  const conteo = { todos: trabajadores.length, alertas: conAlertas.length, vacaciones: enVacaciones.size };

  const texto = busqueda.trim().toLowerCase();
  const rutBuscado = texto.replace(/[^0-9k]/g, '');
  const lista = trabajadores
    .filter((t) => filtro === 'todos' || (filtro === 'alertas' ? conAlertas.includes(t) : enVacaciones.has(t.id)))
    .filter((t) => !texto
      || `${t.nombres} ${t.apellido_paterno} ${t.apellido_materno ?? ''} ${t.cargo}`.toLowerCase().includes(texto)
      || (rutBuscado.length >= 3 && t.rut.replace(/[^0-9kK]/g, '').toLowerCase().includes(rutBuscado)))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.apellido_paterno.localeCompare(b.apellido_paterno));

  const exportar = async () => {
    const XLSX = await import('xlsx');
    const filas = lista.map((t) => ({
      RUT: t.rut, Nombres: t.nombres, 'Apellido paterno': t.apellido_paterno, 'Apellido materno': t.apellido_materno ?? '',
      Cargo: t.cargo, Departamento: t.departamento ?? '', Contrato: TIPO_CONTRATO[t.contrato_activo?.tipo_contrato ?? ''] ?? 'Sin contrato',
      'Horas semanales': Number(t.contrato_activo?.horas_semanales ?? t.horas_laborales),
      'Fecha de ingreso': t.fecha_ingreso, 'Sueldo base': t.contrato_activo?.sueldo_base ?? t.sueldo_base,
      Estado: estadoTrabajador(t, enVacaciones.has(t.id)).texto,
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Trabajadores');
    XLSX.writeFile(libro, `Trabajadores_${empresa.rut}.xlsx`);
    avisar(`Exportados ${filas.length} trabajadores`);
  };

  const alertaDe = (t: Empleado) => {
    const avisos = t.contrato_activo?.avisos_jornada ?? [];
    if (!t.contrato_activo) return { texto: 'Sin contrato', alta: false };
    if (!avisos.length) return null;
    return { texto: avisos.map((a) => a.titulo).join(' · '), alta: avisos.some((a) => a.gravedad === 'alta') };
  };

  return (
    <div className="flex flex-col gap-[18px] max-w-[1440px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Trabajadores</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">
            {conteo.todos} {conteo.todos === 1 ? 'trabajador' : 'trabajadores'} · {capitalizar(empresa.nombre_legal)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variante="secundario" onClick={() => navigate('/app/trabajadores/importar')} className="h-[38px]"
            title={nivel >= 3 ? 'Cargar o actualizar trabajadores desde una planilla' : 'Disponible desde el plan Pyme'}
            iconoInicio={<Upload className="size-[18px]" strokeWidth={2} />}>Importar Excel</Button>
          <Button variante="secundario" onClick={exportar} disabled={!lista.length} className="h-[38px]"
            iconoInicio={<Download className="size-[18px]" strokeWidth={2} />}>Exportar</Button>
          <Button onClick={agregarTrabajador} className="min-[720px]:hidden h-[38px]"
            iconoInicio={<Plus className="size-[19px]" strokeWidth={2} />}>Agregar</Button>
        </div>
      </div>

      <div className="flex gap-2.5 flex-wrap items-center">
        <label className="flex-[1_1_260px] flex items-center gap-2 h-10 px-3 rounded-j40-control border border-line-strong bg-surface focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft">
          <Search className="size-[19px] text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, RUT o cargo"
            aria-label="Buscar trabajador" className="flex-1 min-w-0 border-0 outline-none bg-transparent text-fg text-[14px] placeholder:text-fg-3" />
        </label>
        <SegmentedControl etiqueta="Filtrar trabajadores" valor={filtro} className="overflow-x-auto"
          onChange={(v) => setParams(v === 'todos' ? {} : { filtro: v }, { replace: true })}
          opciones={[
            { valor: 'todos', etiqueta: <>Todos <span className="ml-1.5 text-[11.5px] text-fg-3">{conteo.todos}</span></> },
            { valor: 'alertas', etiqueta: <>Con alertas <span className="ml-1.5 text-[11.5px] text-fg-3">{conteo.alertas}</span></> },
            { valor: 'vacaciones', etiqueta: <>De vacaciones <span className="ml-1.5 text-[11.5px] text-fg-3">{conteo.vacaciones}</span></> },
          ]} />
      </div>

      {/* Escritorio y tablet: tabla */}
      <div className="hidden min-[720px]:block rounded-j40-card border border-line bg-surface shadow-card overflow-x-auto">
        <div className="min-w-[980px]" role="table" aria-label="Trabajadores">
          <div role="row" className={cn('grid gap-3 px-[18px] py-[11px] text-[11.5px] font-medium text-fg-3 bg-surface-2 border-b border-line', COLUMNAS)}>
            {['Trabajador', 'RUT', 'Departamento', 'Contrato', 'Jornada', 'Ingreso'].map((c) => <span key={c} role="columnheader">{c}</span>)}
            <span role="columnheader" className="text-right">Sueldo base</span>
            <span role="columnheader">Estado</span>
          </div>
          {lista.map((t) => {
            const horas = Number(t.contrato_activo?.horas_semanales ?? t.horas_laborales) || 0;
            const excede = t.contrato_activo?.tipo_jornada !== 'ART_22' && horas > maximo;
            const estado = estadoTrabajador(t, enVacaciones.has(t.id));
            const alerta = alertaDe(t);
            return (
              <Link key={t.id} to={`/app/trabajadores/${t.id}`} role="row"
                className={cn('grid gap-3 items-center px-[18px] py-[13px] border-b border-line text-[13px] text-fg no-underline hover:no-underline hover:bg-surface-2', COLUMNAS)}>
                <span role="cell" className="flex gap-3 items-center min-w-0">
                  <span className="grid place-items-center size-[34px] shrink-0 rounded-[9px] bg-sunken text-fg-2 text-[12px] font-semibold">{iniciales(t.nombres, t.apellido_paterno)}</span>
                  <span className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{capitalizar(`${t.nombres.split(' ')[0]} ${t.apellido_paterno} ${t.apellido_materno ?? ''}`)}</span>
                    <span className="text-[12px] text-fg-3 truncate">{capitalizar(t.cargo)}</span>
                  </span>
                </span>
                <span role="cell" className="j40-mono text-[12.5px] text-fg-2">{t.rut}</span>
                <span role="cell" className="text-fg-2 truncate">{capitalizar(t.departamento) || '—'}</span>
                <span role="cell" className="text-fg-2">{TIPO_CONTRATO[t.contrato_activo?.tipo_contrato ?? ''] ?? '—'}</span>
                <span role="cell">
                  <span className={cn('text-[12px] font-semibold px-2 py-0.5 rounded-[6px] j40-num',
                    excede ? 'bg-danger-soft text-danger' : 'bg-sunken text-fg-2')}>{jornadaCorta(t, horas)}</span>
                </span>
                <span role="cell" className="text-fg-2 j40-num">{fechaCL(t.fecha_ingreso)}</span>
                <span role="cell" className="text-right font-medium j40-num">{clp(t.contrato_activo?.sueldo_base ?? t.sueldo_base)}</span>
                <span role="cell" className="flex gap-1.5 items-center min-w-0">
                  <Chip tono={estado.tono}>{estado.texto}</Chip>
                  {alerta && (
                    <span title={alerta.texto} className="inline-flex">
                      <CircleAlert className={cn('size-[18px] shrink-0', alerta.alta ? 'text-danger' : 'text-warn')} strokeWidth={2} aria-hidden />
                      <span className="sr-only">{alerta.texto}</span>
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
          {!cargandoTrabajadores && lista.length === 0 && (
            <div className="p-10 text-center text-fg-3 text-[13px]">
              {trabajadores.length ? 'Ningún trabajador coincide con la búsqueda.' : 'Todavía no agregas trabajadores.'}
            </div>
          )}
        </div>
      </div>

      {/* Móvil: tarjetas */}
      <div className="min-[720px]:hidden flex flex-col gap-2.5">
        {lista.map((t) => {
          const horas = Number(t.contrato_activo?.horas_semanales ?? t.horas_laborales) || 0;
          const excede = t.contrato_activo?.tipo_jornada !== 'ART_22' && horas > maximo;
          const estado = estadoTrabajador(t, enVacaciones.has(t.id));
          const alerta = alertaDe(t);
          return (
            <Link key={t.id} to={`/app/trabajadores/${t.id}`}
              className="flex flex-col gap-3 p-3.5 rounded-j40-card border border-line bg-surface text-fg no-underline hover:no-underline">
              <span className="flex gap-3 items-center">
                <span className="grid place-items-center size-10 shrink-0 rounded-[10px] bg-sunken text-fg-2 text-[13px] font-semibold">{iniciales(t.nombres, t.apellido_paterno)}</span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[14px] font-medium truncate">{capitalizar(`${t.nombres.split(' ')[0]} ${t.apellido_paterno}`)}</span>
                  <span className="text-[12px] text-fg-3 truncate">{capitalizar(t.cargo)}</span>
                </span>
                <ChevronRight className="size-5 text-fg-3" strokeWidth={2} aria-hidden />
              </span>
              <span className="flex gap-1.5 flex-wrap items-center">
                <span className="j40-mono text-[12px] text-fg-2 mr-1">{t.rut}</span>
                <span className={cn('text-[11.5px] font-semibold px-2 py-0.5 rounded-[6px]', excede ? 'bg-danger-soft text-danger' : 'bg-sunken text-fg-2')}>{jornadaCorta(t, horas)}</span>
                <Chip tono={estado.tono}>{estado.texto}</Chip>
                {alerta && <Chip tono={alerta.alta ? 'peligro' : 'aviso'}>{alerta.alta ? 'Jornada' : alerta.texto}</Chip>}
              </span>
            </Link>
          );
        })}
        {!cargandoTrabajadores && lista.length === 0 && (
          <p className="p-8 text-center text-fg-3 text-[13px]">
            {trabajadores.length ? 'Ningún trabajador coincide con la búsqueda.' : 'Todavía no agregas trabajadores.'}
          </p>
        )}
      </div>
    </div>
  );
}
