import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Building2, Info, PenLine, TriangleAlert } from 'lucide-react';
import { AlertaError, Button, CampoRut, Chip, Input } from '../../components/j40';
import { usePanelContexto } from '../../components/app/AppShell';
import { FirmaEmpleador } from '../../components/app/FirmaEmpleador';
import client from '../../api/client';
import type { Empresa as TEmpresa } from '../../types';
import { capitalizar, clp, decimalCL, fechaCL } from '../../utils/formato';
import { validateRut } from '../../utils/rutUtils';

interface Parametros {
  periodo: string;
  vigente_desde: string | null;
  origen: string;
  ingreso_minimo_mensual: number;
  tope_imponible_afp_uf: number;
  tope_imponible_afc_uf: number;
  tope_gratificacion_mensual: number;
  tasa_salud: number;
  tasa_afc_trabajador_indefinido: number;
  tasa_afc_empleador_indefinido: number;
  tasa_afc_empleador_plazo: number;
  tasa_sis: number;
  tasas_afp: Record<string, number>;
  uf: number;
  utm: number;
  jornada_maxima_vigente: number;
  advertencias: string[];
}

const pct = (t: number) => `${decimalCL(t * 100, 2)} %`;

/** Mensaje del backend: `error` o el primer error de campo; si no hay, el genérico. */
function mensajeError(err: unknown, porDefecto: string): string {
  const d = isAxiosError(err) ? (err.response?.data as Record<string, unknown> | string | undefined) : undefined;
  if (!d || typeof d !== 'object') return porDefecto;
  if (typeof d.error === 'string') return d.error;
  const primero = Object.values(d).flat()[0];
  return typeof primero === 'string' ? primero : porDefecto;
}

/**
 * Número escrito por el usuario, con punto o coma decimal ("0.9", "0,9").
 * Los puntos se leen como separador de miles solo si hay coma y el formato
 * lo es ("1.234,5"); "0.9" es 0,9 y no 9.
 */
function leerDecimal(texto: string): number {
  const t = texto.trim().replace(/[\s%]/g, '');
  if (!t) return Number.NaN;
  if (t.includes(',')) {
    const sinMiles = /^\d{1,3}(\.\d{3})+(,\d*)?$/.test(t) ? t.replace(/\./g, '') : t;
    return /^\d*(,\d*)?$/.test(sinMiles) ? Number(sinMiles.replace(',', '.')) : Number.NaN;
  }
  return /^\d*(\.\d*)?$/.test(t) ? Number(t) : Number.NaN;
}

type Avisar = (texto: string, tipo?: 'ok' | 'error') => void;

/** Reemplaza la empresa guardada en la lista en caché, sin esperar a que se vuelva a pedir. */
function ponerEnCache(queryClient: ReturnType<typeof useQueryClient>, empresa: TEmpresa) {
  queryClient.setQueryData<TEmpresa[]>(['empresas'], (lista) => lista?.map((e) => (e.id === empresa.id ? { ...e, ...empresa } : e)));
}
type Editables = Pick<TEmpresa, 'nombre_legal' | 'alias' | 'giro' | 'direccion' | 'comuna' | 'ciudad' | 'sucursal' | 'representante_legal' | 'rut_representante'>;

export default function Empresa() {
  const { empresa, suscripcion, avisar } = usePanelContexto();
  const parametros = useQuery({ queryKey: ['parametros-vigentes'], queryFn: async () => (await client.get<Parametros>('/parametros/vigentes/')).data, staleTime: 60 * 60 * 1000 });
  const [firma, setFirma] = useState(false);

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">{capitalizar(empresa.nombre_legal)}</h1>
          <p className="text-[13px] text-fg-3 mt-0.5 j40-mono">{empresa.rut}</p>
        </div>
        <Link to="/app/empresas" className="inline-flex items-center gap-2 h-10 px-4 rounded-j40-control border border-line-strong bg-surface text-fg text-[13px] font-medium no-underline hover:no-underline hover:bg-surface-2">
          <Building2 className="size-4" strokeWidth={2} aria-hidden />Agregar o administrar empresas
        </Link>
      </div>

      <DatosLegales key={empresa.id} empresa={empresa} avisar={avisar} />

      <SeguridadSocial key={`ss-${empresa.id}`} empresa={empresa} avisar={avisar} />

      <Seccion titulo="Firma del empleador" accion={<Button variante="secundario" tamano="sm" onClick={() => setFirma(true)} iconoInicio={<PenLine className="size-4" strokeWidth={2} />}>{empresa.firma_configurada ? 'Cambiar firma' : 'Configurar firma'}</Button>}>
        {empresa.firma_configurada ? (
          <p className="text-[13px] text-fg-2">
            Firma {capitalizar(empresa.firma_firmante_nombre)} ({capitalizar(empresa.firma_firmante_cargo)}), configurada el {fechaCL(empresa.firma_configurada_en)}.
            Se estampa en todos los documentos que se firman electrónicamente.
          </p>
        ) : (
          <p className="flex gap-2 text-[13px] text-warn"><TriangleAlert className="size-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
            Sin firma configurada: los documentos firmados muestran "Sin firma registrada" en la parte del empleador.</p>
        )}
      </Seccion>

      {suscripcion && (
        <Seccion titulo="Plan y suscripción" accion={<Link to="/app/plan" className="text-[13px] font-medium">Gestionar plan</Link>}>
          <p className="text-[13px] text-fg-2">
            Plan <strong className="font-semibold text-fg">{suscripcion.plan.nombre}</strong> · {suscripcion.trabajadores_actuales} de {suscripcion.plan.limite_trabajadores} trabajadores vigentes en todas tus empresas.
          </p>
        </Seccion>
      )}

      <Seccion titulo="Parámetros previsionales vigentes"
        nota="Son los mismos para todos los clientes. Jornada40 los actualiza con los indicadores oficiales (Previred, SII y Banco Central).">
        {!parametros.data ? <p className="text-[13px] text-fg-3" role="status">Cargando…</p> : (
          <>
            {parametros.data.advertencias.map((a) => (
              <p key={a} className="flex gap-2 text-[12.5px] text-warn"><Info className="size-4 shrink-0" strokeWidth={2} aria-hidden />{a}</p>
            ))}
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-x-6 gap-y-3.5">
              <Dato t="Ingreso mínimo mensual" v={clp(parametros.data.ingreso_minimo_mensual)} />
              <Dato t="Tope gratificación mensual" v={clp(parametros.data.tope_gratificacion_mensual)} />
              <Dato t="Tope imponible AFP y salud" v={`${decimalCL(parametros.data.tope_imponible_afp_uf, 1)} UF`} />
              <Dato t="Tope imponible cesantía" v={`${decimalCL(parametros.data.tope_imponible_afc_uf, 1)} UF`} />
              <Dato t="UF / UTM de hoy" v={`${clp(parametros.data.uf)} / ${clp(parametros.data.utm)}`} />
              <Dato t="Jornada máxima legal" v={`${parametros.data.jornada_maxima_vigente} h semanales`} />
              <Dato t="Salud (Fonasa)" v={pct(parametros.data.tasa_salud)} />
              <Dato t="Cesantía indefinido (trab. / empl.)" v={`${pct(parametros.data.tasa_afc_trabajador_indefinido)} / ${pct(parametros.data.tasa_afc_empleador_indefinido)}`} />
              <Dato t="SIS (empleador)" v={pct(parametros.data.tasa_sis)} />
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.entries(parametros.data.tasas_afp).sort().map(([afp, t]) => (
                <Chip key={afp}>{capitalizar(afp)} {pct(t)}</Chip>
              ))}
            </div>
            <p className="text-[11.5px] text-fg-3">
              Período {parametros.data.periodo}{parametros.data.vigente_desde ? ` · vigentes desde el ${fechaCL(parametros.data.vigente_desde)}` : ''} · {parametros.data.origen}
            </p>
          </>
        )}
      </Seccion>

      {firma && <FirmaEmpleador onCerrar={() => setFirma(false)} avisar={avisar} />}
    </div>
  );
}

function Seccion({ titulo, nota, accion, children }: { titulo: string; nota?: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card p-[18px] flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h2 className="text-[15px] font-semibold">{titulo}</h2>{nota && <p className="text-[12.5px] text-fg-3 max-w-[680px]">{nota}</p>}</div>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return <div className="flex flex-col gap-0.5"><dt className="text-[12px] text-fg-3">{t}</dt><dd className="text-[14px] font-medium j40-num">{v}</dd></div>;
}

const editablesDe = (empresa: TEmpresa): Editables => ({
  nombre_legal: empresa.nombre_legal, alias: empresa.alias ?? '', giro: empresa.giro ?? '', direccion: empresa.direccion ?? '',
  comuna: empresa.comuna ?? '', ciudad: empresa.ciudad ?? '', sucursal: empresa.sucursal ?? '', representante_legal: empresa.representante_legal ?? '',
  rut_representante: empresa.rut_representante ?? '',
});

function DatosLegales({ empresa: empresaProp, avisar }: { empresa: TEmpresa; avisar: Avisar }) {
  const queryClient = useQueryClient();
  // Lo último que respondió el backend (que guarda en mayúsculas): así, tras
  // guardar, lo editado coincide con lo guardado y desaparece Guardar/Descartar.
  const [guardada, setGuardada] = useState<TEmpresa | null>(null);
  const empresa = guardada ?? empresaProp;
  const inicial = editablesDe(empresa);
  const [b, setB] = useState<Editables>(inicial);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambios = (Object.keys(inicial) as (keyof Editables)[]).some((k) => (b[k] ?? '') !== (inicial[k] ?? ''));
  const poner = (k: keyof Editables) => (e: { target: { value: string } }) => setB((x) => ({ ...x, [k]: e.target.value }));

  const guardar = async () => {
    if (b.rut_representante && !validateRut(b.rut_representante)) { setError('El RUT del representante legal no es válido.'); return; }
    if (!b.nombre_legal?.trim()) { setError('Ingresa la razón social.'); return; }
    setGuardando(true);
    setError('');
    try {
      const { data } = await client.patch<TEmpresa>(`/empresas/${empresa.id}/`, b);
      setGuardada(data);
      setB(editablesDe(data));
      ponerEnCache(queryClient, data);
      await queryClient.invalidateQueries({ queryKey: ['empresas'] });
      avisar('Datos de la empresa guardados');
    } catch (err) {
      setError(mensajeError(err, 'No pudimos guardar los datos.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Seccion titulo="Datos legales" nota="Aparecen en contratos, liquidaciones y demás documentos."
      accion={cambios && (
        <div className="flex gap-2">
          <Button variante="secundario" tamano="sm" onClick={() => { setB(inicial); setError(''); }} disabled={guardando}>Descartar</Button>
          <Button tamano="sm" onClick={guardar} cargando={guardando}>Guardar</Button>
        </div>
      )}>
      {error && <AlertaError>{error}</AlertaError>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3.5">
        <Campo etiqueta="Razón social"><Input value={b.nombre_legal ?? ''} onChange={poner('nombre_legal')} /></Campo>
        <Campo etiqueta="RUT de la empresa (no se puede cambiar)"><Input mono value={empresa.rut} disabled readOnly
          title="Los documentos ya emitidos llevan este RUT. Si es otra persona jurídica, crea una empresa nueva." /></Campo>
        <Campo etiqueta="Nombre de fantasía"><Input value={b.alias ?? ''} onChange={poner('alias')} /></Campo>
        <Campo etiqueta="Giro"><Input value={b.giro ?? ''} onChange={poner('giro')} /></Campo>
        <Campo etiqueta="Dirección"><Input value={b.direccion ?? ''} onChange={poner('direccion')} /></Campo>
        <Campo etiqueta="Comuna"><Input value={b.comuna ?? ''} onChange={poner('comuna')} /></Campo>
        <Campo etiqueta="Ciudad"><Input value={b.ciudad ?? ''} onChange={poner('ciudad')} /></Campo>
        <Campo etiqueta="Sucursal"><Input value={b.sucursal ?? ''} onChange={poner('sucursal')} /></Campo>
        <Campo etiqueta="Representante legal"><Input value={b.representante_legal ?? ''} onChange={poner('representante_legal')} /></Campo>
        <CampoRut etiqueta="RUT del representante" valor={b.rut_representante ?? ''} compacto onChange={(v) => setB((x) => ({ ...x, rut_representante: v }))} />
      </div>
    </Seccion>
  );
}

const MUTUALES: [TEmpresa['mutual'], string][] = [
  ['00', 'ISL (sin mutual)'], ['01', 'ACHS'], ['02', 'Mutual de Seguridad CChC'], ['03', 'IST'],
];
const CAJAS: [TEmpresa['ccaf'], string][] = [
  ['00', 'Sin caja de compensación'], ['01', 'Los Andes'], ['02', 'La Araucana'], ['03', 'Los Héroes'], ['04', '18 de Septiembre'],
];
const SELECT = 'h-10 px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';

/** Mutual (o ISL), tasa de accidentes y caja de compensación: los pide el archivo Previred. */
const seguridadDe = (empresa: TEmpresa) => ({
  mutual: empresa.mutual ?? '00', ccaf: empresa.ccaf ?? '00', sucursal_mutual: empresa.sucursal_mutual ?? '',
  // La tasa se edita en porcentaje ("0,93") y se guarda como fracción ("0.0093").
  tasa: empresa.tasa_accidentes != null ? decimalCL(Number(empresa.tasa_accidentes) * 100, 2) : '',
});

function SeguridadSocial({ empresa: empresaProp, avisar }: { empresa: TEmpresa; avisar: Avisar }) {
  const queryClient = useQueryClient();
  const [guardada, setGuardada] = useState<TEmpresa | null>(null);
  const empresa = guardada ?? empresaProp;
  const inicial = seguridadDe(empresa);
  const [b, setB] = useState(inicial);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambios = JSON.stringify(b) !== JSON.stringify(inicial);

  const guardar = async () => {
    const tasa = b.tasa.trim() ? leerDecimal(b.tasa) : null;
    if (tasa !== null && (Number.isNaN(tasa) || tasa < 0 || tasa > 10)) { setError('La tasa de accidentes va entre 0 % y 10 % (por ejemplo, 0,93).'); return; }
    setGuardando(true);
    setError('');
    try {
      const { data } = await client.patch<TEmpresa>(`/empresas/${empresa.id}/`, {
        mutual: b.mutual, ccaf: b.ccaf, sucursal_mutual: b.mutual === '00' ? '' : b.sucursal_mutual.trim(),
        tasa_accidentes: tasa === null ? null : (tasa / 100).toFixed(5),
      });
      setGuardada(data);
      setB(seguridadDe(data));
      ponerEnCache(queryClient, data);
      await queryClient.invalidateQueries({ queryKey: ['empresas'] });
      avisar('Datos de seguridad social guardados');
    } catch (err) {
      setError(mensajeError(err, 'No pudimos guardar los datos de seguridad social.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Seccion titulo="Seguridad social" nota="Los pide el archivo Previred. La tasa de accidentes es la total que te informa tu mutual o el ISL (base 0,93 % + adicional); si la dejas vacía se usa la base."
      accion={cambios && (
        <div className="flex gap-2">
          <Button variante="secundario" tamano="sm" onClick={() => { setB(inicial); setError(''); }} disabled={guardando}>Descartar</Button>
          <Button tamano="sm" onClick={guardar} cargando={guardando}>Guardar</Button>
        </div>
      )}>
      {error && <AlertaError>{error}</AlertaError>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3.5">
        <Campo etiqueta="Mutual de seguridad">
          <select className={SELECT} value={b.mutual} onChange={(e) => setB((x) => ({ ...x, mutual: e.target.value as TEmpresa['mutual'] }))}>
            {MUTUALES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Tasa de accidentes (%)"><Input inputMode="decimal" placeholder="0,93" value={b.tasa} onChange={(e) => setB((x) => ({ ...x, tasa: e.target.value }))} /></Campo>
        {b.mutual !== '00' && (
          <Campo etiqueta="Sucursal para pago mutual"><Input value={b.sucursal_mutual} maxLength={3} onChange={(e) => setB((x) => ({ ...x, sucursal_mutual: e.target.value }))} /></Campo>
        )}
        <Campo etiqueta="Caja de compensación">
          <select className={SELECT} value={b.ccaf} onChange={(e) => setB((x) => ({ ...x, ccaf: e.target.value as TEmpresa['ccaf'] }))}>
            {CAJAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </Campo>
      </div>
    </Seccion>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 min-w-0"><span className="text-[12.5px] font-medium text-fg-2">{etiqueta}</span>{children}</label>;
}
