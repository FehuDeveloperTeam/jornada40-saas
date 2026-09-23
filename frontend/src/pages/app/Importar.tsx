import { useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeft, CloudUpload, Download, FileSpreadsheet, Lock } from 'lucide-react';
import { AlertaError, Button, Chip } from '../../components/j40';
import type { TonoChip } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import client from '../../api/client';
import { cn } from '../../utils/cn';
import { clp } from '../../utils/formato';

type Resultado = 'nuevo' | 'actualiza' | 'error' | 'limite';
interface Fila {
  fila: number; rut: string; nombre: string; cargo: string; horas: number | null; sueldo: number | null;
  resultado: Resultado; mensaje: string; cambios: string[]; alerta: string;
}
interface Respuesta { previsualizacion: boolean; agregados: number; actualizados: number; limite_alcanzado: boolean; errores: string[]; filas: Fila[] }

// Columnas que entiende el backend (carga_masiva). Con * las obligatorias para crear.
const COLUMNAS: [string, boolean][] = [
  ['rut', true], ['nombres', true], ['apellido_paterno', true], ['apellido_materno', false], ['cargo', true],
  ['fecha_ingreso', true], ['sueldo_base', true], ['horas_laborales', true], ['email', false], ['sexo', false],
  ['nacionalidad', false], ['fecha_nacimiento', false], ['departamento', false], ['sucursal', false],
  ['forma_pago', false], ['banco', false], ['tipo_cuenta', false], ['numero_cuenta', false],
];
const RESULTADO: Record<Resultado, { texto: string; tono: TonoChip }> = {
  nuevo: { texto: 'Nuevo', tono: 'ok' }, actualiza: { texto: 'Se actualiza', tono: 'marca' },
  error: { texto: 'Con error', tono: 'peligro' }, limite: { texto: 'Fuera del plan', tono: 'aviso' },
};

const mensaje = (err: unknown, porDefecto: string) =>
  (isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || porDefecto;

export default function Importar() {
  const { empresa, nivel, suscripcion } = usePanelContexto();
  const queryClient = useQueryClient();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [revision, setRevision] = useState<Respuesta | null>(null);
  const [final, setFinal] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<Resultado | 'todas'>('todas');

  const enviar = async (f: File, previsualizar: boolean) => {
    const datos = new FormData();
    datos.append('empresa', String(empresa.id));
    datos.append('file', f);
    const { data } = await client.post<Respuesta>(`/empleados/carga_masiva/${previsualizar ? '?previsualizar=1' : ''}`, datos,
      { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  };

  const revisar = async (f: File) => {
    if (!/\.xlsx?$/i.test(f.name)) { setError('Sube un archivo Excel (.xlsx o .xls).'); return; }
    setArchivo(f); setCargando(true); setError('');
    try { setRevision(await enviar(f, true)); } catch (err) { setError(mensaje(err, 'No pudimos leer el archivo.')); } finally { setCargando(false); }
  };

  const importar = async () => {
    if (!archivo) return;
    setCargando(true); setError('');
    try {
      setFinal(await enviar(archivo, false));
      await queryClient.invalidateQueries({ queryKey: ['empleados'] });
      await queryClient.invalidateQueries({ queryKey: ['mi_suscripcion'] });
    } catch (err) {
      setError(mensaje(err, 'No pudimos importar el archivo.'));
    } finally { setCargando(false); }
  };

  const plantilla = async () => {
    const XLSX = await import('xlsx');
    const hoja = XLSX.utils.aoa_to_sheet([COLUMNAS.map(([c]) => c),
      ['12.345.678-5', 'María José', 'Pérez', 'Soto', 'Vendedora', '01-03-2025', 600000, 42, 'maria@ejemplo.cl', 'F', 'Chilena', '15-08-1990', 'Ventas', 'Centro', 'Transferencia', 'Banco Estado', 'Cuenta Vista / RUT', '12345678']]);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Trabajadores');
    XLSX.writeFile(libro, 'Planilla_trabajadores_Jornada40.xlsx');
  };

  const bajarErrores = async (filas: Fila[]) => {
    const XLSX = await import('xlsx');
    const hoja = XLSX.utils.json_to_sheet(filas.map((f) => ({ Fila: f.fila, RUT: f.rut, Nombre: f.nombre, Motivo: f.mensaje })));
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Filas con error');
    XLSX.writeFile(libro, 'Filas_con_error.xlsx');
  };

  const reiniciar = () => { setArchivo(null); setRevision(null); setFinal(null); setError(''); setFiltro('todas'); };
  const paso = final ? 3 : revision ? 2 : 1;

  if (nivel < 3) {
    return (
      <Marco paso={0}>
        <section className="bg-surface border border-line rounded-j40-card shadow-card p-6 flex flex-col gap-3 items-start">
          <span className="inline-flex items-center gap-2 text-[14px] font-medium"><Lock className="size-4" strokeWidth={2} aria-hidden />Importación desde Excel desde el plan Pyme</span>
          <p className="text-[13px] text-fg-3 max-w-[520px]">Carga o actualiza hasta 500 trabajadores de una vez desde una planilla.</p>
          <Link to="/app/plan" className="text-[13px] font-medium">Ver planes</Link>
        </section>
      </Marco>
    );
  }

  return (
    <Marco paso={paso}>
      {error && <AlertaError>{error}</AlertaError>}
      {paso === 1 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-5 items-start">
          <Tarjeta titulo="1 · Descarga la planilla" nota="Una fila por trabajador. Si el RUT ya existe, actualizamos solo las columnas que traigan dato.">
            <div className="flex flex-wrap gap-1.5">
              {COLUMNAS.map(([c, obligatoria]) => (
                <span key={c} className={cn('px-2 py-0.5 rounded-[6px] text-[11.5px] j40-mono', obligatoria ? 'bg-brand-soft text-brand-text' : 'bg-sunken text-fg-2')}>{c}{obligatoria ? ' *' : ''}</span>
              ))}
            </div>
            <p className="text-[12px] text-fg-3">* Obligatorias para crear. Los encabezados no distinguen mayúsculas ni espacios. Fechas en formato DD-MM-AAAA.</p>
            <Button variante="secundario" className="self-start" onClick={plantilla} iconoInicio={<Download className="size-4" strokeWidth={2} />}>Descargar planilla .xlsx</Button>
          </Tarjeta>
          <Tarjeta titulo="2 · Sube el archivo" nota="Revisarás cada fila antes de guardar.">
            <ZonaArchivo onArchivo={revisar} cargando={cargando} />
            {suscripcion && (
              <p className="text-[12.5px] text-fg-3">Tu plan: {suscripcion.trabajadores_actuales} de {suscripcion.plan.limite_trabajadores} trabajadores vigentes.</p>
            )}
          </Tarjeta>
        </div>
      )}

      {paso === 2 && revision && (() => {
        const cuenta = (r: Resultado) => revision.filas.filter((f) => f.resultado === r).length;
        const aplicables = revision.filas.filter((f) => f.resultado === 'nuevo' || (f.resultado === 'actualiza' && f.cambios.length)).length;
        const visibles = revision.filas.filter((f) => filtro === 'todas' || f.resultado === filtro);
        return (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <FileSpreadsheet className="size-6 text-ok" strokeWidth={2} aria-hidden />
              <span className="flex-1 min-w-0 text-[14px] font-medium truncate">{archivo?.name}</span>
              <Button variante="fantasma" tamano="sm" onClick={reiniciar}>Cambiar archivo</Button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              <Kpi t="Filas leídas" v={revision.filas.length} />
              <Kpi t="Nuevos" v={cuenta('nuevo')} />
              <Kpi t="Se actualizan" v={cuenta('actualiza')} />
              <Kpi t="Con error o fuera del plan" v={cuenta('error') + cuenta('limite')} alerta={cuenta('error') + cuenta('limite') > 0} />
            </div>
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por resultado">
              {(['todas', 'nuevo', 'actualiza', 'error', 'limite'] as const).map((r) => (
                <button key={r} type="button" onClick={() => setFiltro(r)} aria-pressed={filtro === r}
                  className={cn('h-8 px-3 rounded-full border text-[12.5px] font-medium', filtro === r ? 'bg-brand-soft border-brand text-brand-text' : 'bg-surface border-line text-fg-2')}>
                  {r === 'todas' ? 'Todas' : RESULTADO[r].texto}
                </button>
              ))}
            </div>
            <section className="bg-surface border border-line rounded-j40-card shadow-card mb-20">
              {visibles.map((f) => (
                <div key={f.fila} className="px-[18px] py-3 border-b border-line last:border-b-0 flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                    <span className="text-fg-3 j40-num w-12">Fila {f.fila}</span>
                    <span className="j40-mono w-[110px]">{f.rut || '—'}</span>
                    <span className="flex-1 min-w-[160px] font-medium">{f.nombre || '—'}<span className="text-fg-3 font-normal"> · {f.cargo || 'sin cargo'}</span></span>
                    <span className="j40-num text-fg-2 w-[60px]">{f.horas ? `${f.horas} h` : ''}</span>
                    <span className="j40-num text-fg-2 w-[100px] text-right">{f.sueldo != null ? clp(f.sueldo) : ''}</span>
                    <Chip tono={RESULTADO[f.resultado].tono}>{RESULTADO[f.resultado].texto}</Chip>
                  </div>
                  <p className={cn('text-[12px] pl-16', f.resultado === 'error' ? 'text-danger' : f.resultado === 'limite' ? 'text-warn' : 'text-fg-3')}>{f.mensaje}</p>
                  {f.alerta && <p className="text-[12px] text-warn pl-16">{f.alerta}</p>}
                </div>
              ))}
              {visibles.length === 0 && <p className="px-[18px] py-6 text-[13px] text-fg-3">Ninguna fila con ese resultado.</p>}
            </section>
            <div className="fixed left-1/2 -translate-x-1/2 bottom-[84px] min-[720px]:bottom-6 z-[60] flex items-center gap-3 px-4 py-2.5 rounded-[12px] bg-surface border border-line-strong shadow-pop w-[min(620px,calc(100vw-24px))]">
              <span className="flex-1 text-[13px]">{aplicables ? `${aplicables} trabajadores con cambios` : 'No hay cambios para importar'}</span>
              <Button onClick={importar} cargando={cargando} disabled={!aplicables}>Importar {aplicables} trabajadores</Button>
            </div>
          </>
        );
      })()}

      {paso === 3 && final && (() => {
        const omitidas = final.filas.filter((f) => f.resultado === 'error' || f.resultado === 'limite');
        const alertas = final.filas.filter((f) => f.alerta && f.resultado !== 'error').length;
        return (
          <Tarjeta titulo="Importación terminada">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              <Kpi t="Creados" v={final.agregados} />
              <Kpi t="Actualizados" v={final.filas.filter((f) => f.resultado === 'actualiza' && f.cambios.length).length} />
              <Kpi t="Omitidos" v={omitidas.length} alerta={omitidas.length > 0} />
              <Kpi t={`Jornada sobre el máximo`} v={alertas} alerta={alertas > 0} />
            </div>
            <div className="flex flex-wrap gap-2">
              {omitidas.length > 0 && <Button variante="secundario" onClick={() => bajarErrores(omitidas)} iconoInicio={<Download className="size-4" strokeWidth={2} />}>Descargar filas omitidas</Button>}
              {alertas > 0 && <Link to="/app/trabajadores?filtro=alertas" className="inline-flex items-center h-10 px-4 rounded-j40-control border border-line-strong text-[13px] font-medium no-underline">Ver alertas</Link>}
              <Link to="/app/trabajadores" className="inline-flex items-center h-10 px-4 rounded-j40-control bg-brand-btn text-white text-[13px] font-medium no-underline hover:no-underline">Ir a Trabajadores</Link>
              <Button variante="fantasma" onClick={reiniciar}>Importar otro archivo</Button>
            </div>
            <p className="text-[12.5px] text-fg-3">Los trabajadores nuevos quedan sin contrato: créalo desde su carpeta para emitir liquidaciones.</p>
          </Tarjeta>
        );
      })()}
    </Marco>
  );
}

function Marco({ paso, children }: { paso: number; children: ReactNode }) {
  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-5">
      <Link to="/app/trabajadores" className="inline-flex items-center gap-1.5 text-[13px] text-fg-2 self-start">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />Trabajadores
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">Importar trabajadores</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">Desde una planilla Excel (.xlsx o .xls) · hasta 500 filas por archivo</p>
        </div>
        {paso > 0 && (
          <ol className="flex gap-3 text-[12.5px]">
            {['Archivo', 'Revisión', 'Listo'].map((t, i) => (
              <li key={t} className={cn('flex items-center gap-1.5', i + 1 === paso ? 'font-semibold text-fg' : 'text-fg-3')}>
                <span className={cn('size-5 rounded-full grid place-items-center text-[11px]', i + 1 <= paso ? 'bg-brand-btn text-white' : 'border border-line-strong')}>{i + 1}</span>{t}
              </li>
            ))}
          </ol>
        )}
      </div>
      {children}
    </div>
  );
}

function Tarjeta({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card p-[18px] flex flex-col gap-3.5">
      <div><h2 className="text-[15px] font-semibold">{titulo}</h2>{nota && <p className="text-[12.5px] text-fg-3">{nota}</p>}</div>
      {children}
    </section>
  );
}

function Kpi({ t, v, alerta }: { t: string; v: number; alerta?: boolean }) {
  return (
    <div className="rounded-j40-card border border-line bg-surface px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[12px] text-fg-3">{t}</span>
      <span className={cn('text-[22px] font-semibold j40-num', alerta && 'text-danger')}>{v}</span>
    </div>
  );
}

function ZonaArchivo({ onArchivo, cargando }: { onArchivo: (f: File) => void; cargando: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const soltar = (e: DragEvent) => {
    e.preventDefault(); setEncima(false);
    const f = e.dataTransfer.files[0];
    if (f) onArchivo(f);
  };
  return (
    <label onDragOver={(e) => { e.preventDefault(); setEncima(true); }} onDragLeave={() => setEncima(false)} onDrop={soltar}
      className={cn('flex flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed px-4 py-10 text-center cursor-pointer',
        encima ? 'border-brand bg-brand-soft' : 'border-line-strong hover:border-brand hover:bg-brand-soft')}>
      <CloudUpload className="size-8 text-brand-text" strokeWidth={1.75} aria-hidden />
      <span className="text-[14px] font-medium">{cargando ? 'Revisando el archivo…' : 'Arrastra la planilla aquí'}</span>
      <span className="text-[12.5px] text-fg-3">o haz clic para elegirla</span>
      <input ref={input} type="file" accept=".xlsx,.xls" className="sr-only" disabled={cargando}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = ''; }} />
    </label>
  );
}
