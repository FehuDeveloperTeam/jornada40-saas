import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, FolderDown, Lock } from 'lucide-react';
import { Button, Chip, Modal } from '../../components/j40';
import { DrawerAnexo, DrawerDocumento, DrawerVacacion } from '../../components/app/carpeta/Formularios';
import { esCampoAnexo } from '../../components/app/carpeta/utiles';
import type { TipoDocumento } from '../../components/app/carpeta/Formularios';
import client from '../../api/client';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { usePanelContexto } from '../../components/app/AppShell';
import { estadoTrabajador, TIPO_CONTRATO } from '../../components/app/trabajador';
import { documentosDe } from '../../components/app/carpeta/documentos';
import { Resumen } from '../../components/app/carpeta/Resumen';
import { DatosPersonales } from '../../components/app/carpeta/DatosPersonales';
import { ContratoJornada } from '../../components/app/carpeta/ContratoJornada';
import { Remuneraciones } from '../../components/app/carpeta/Remuneraciones';
import { Vacaciones } from '../../components/app/carpeta/Vacaciones';
import { DocumentosTab } from '../../components/app/carpeta/DocumentosTab';
import { Lateral } from '../../components/app/carpeta/Lateral';
import { descargar } from '../../api/descargas';
import { useCarpeta } from '../../hooks/usePanel';
import { cn } from '../../utils/cn';
import { antiguedad, capitalizar, clp, fechaCL, iniciales } from '../../utils/formato';
import { jornadaMaximaVigente } from '../../utils/ley40';

type Pestana = 'resumen' | 'personal' | 'contrato' | 'remuneraciones' | 'vacaciones' | 'documentos';

const PESTANAS: { clave: Pestana; texto: string }[] = [
  { clave: 'resumen', texto: 'Resumen' },
  { clave: 'personal', texto: 'Datos personales' },
  { clave: 'contrato', texto: 'Contrato y jornada' },
  { clave: 'remuneraciones', texto: 'Remuneraciones' },
  { clave: 'vacaciones', texto: 'Vacaciones' },
  { clave: 'documentos', texto: 'Documentos' },
];

// Todo lo que el backend sabe empaquetar en el expediente ZIP.
const DOCUMENTOS_ZIP = ['contrato', 'anexo_40h', 'liquidaciones', 'amonestaciones', 'despidos', 'mutuo_acuerdo', 'constancias', 'anexos_contrato'];

export default function Carpeta() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [confirmarEstado, setConfirmarEstado] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const queryClient = useQueryClient();
  const { empresa, trabajadores, cargandoTrabajadores, nivel, avisar } = usePanelContexto();
  const [descargandoZip, setDescargandoZip] = useState(false);

  const orden = useMemo(() => [...trabajadores].sort((a, b) =>
    Number(b.activo) - Number(a.activo) || a.apellido_paterno.localeCompare(b.apellido_paterno)), [trabajadores]);
  const indice = orden.findIndex((t) => t.id === Number(id));
  const empleado = orden[indice];
  const anterior = indice > 0 ? orden[indice - 1] : undefined;
  const siguiente = indice >= 0 && indice < orden.length - 1 ? orden[indice + 1] : undefined;

  const carpeta = useCarpeta(empleado?.id, nivel);
  const maximo = jornadaMaximaVigente();
  const pestanaParam = params.get('tab') as Pestana | null;
  const tipoParam = params.get('tipo');
  const tipoAnexo = esCampoAnexo(tipoParam) ? tipoParam : undefined;
  const accion = params.get('accion');
  const pestana: Pestana = PESTANAS.some((p) => p.clave === pestanaParam) ? pestanaParam! : 'resumen';

  const liquidaciones = carpeta.liquidaciones.data ?? [];
  const firmas = carpeta.firmas.data ?? [];
  const documentos = useMemo(() => empleado ? documentosDe(empleado, {
    liquidaciones: carpeta.liquidaciones.data, documentos: carpeta.documentos.data, anexos: carpeta.anexos.data,
    vacaciones: carpeta.vacaciones.data, firmas: carpeta.firmas.data,
  }) : [], [empleado, carpeta.liquidaciones.data, carpeta.documentos.data, carpeta.anexos.data, carpeta.vacaciones.data, carpeta.firmas.data]);

  if (!empleado) {
    return (
      <div className="max-w-[1440px] mx-auto flex flex-col gap-4 items-start">
        <Link to="/app/trabajadores" className="inline-flex items-center gap-1.5 text-[13px] text-fg-2">
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />Trabajadores
        </Link>
        <p className="text-[14px] text-fg-2">
          {cargandoTrabajadores ? 'Cargando carpeta…' : `No encontramos este trabajador en ${capitalizar(empresa.nombre_legal)}.`}
        </p>
      </div>
    );
  }

  const contrato = empleado.contrato_activo;
  const estado = estadoTrabajador(empleado, false);
  const nombre = capitalizar(`${empleado.nombres} ${empleado.apellido_paterno} ${empleado.apellido_materno ?? ''}`.trim());
  const base = `/app/trabajadores/${empleado.id}`;

  const cerrarAccion = () => {
    const p = new URLSearchParams(params);
    p.delete('accion'); p.delete('tipo');
    setParams(p, { replace: true });
  };

  const cambiarEstado = async () => {
    setCambiandoEstado(true);
    try {
      await client.patch(`/empleados/${empleado.id}/`, { activo: !empleado.activo });
      await queryClient.invalidateQueries({ queryKey: ['empleados'] });
      await queryClient.invalidateQueries({ queryKey: ['mi_suscripcion'] });
      avisar(empleado.activo ? 'Trabajador desvinculado' : 'Trabajador reactivado');
      setConfirmarEstado(false);
    } catch (err) {
      avisar((isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || 'No pudimos cambiar el estado.');
    } finally {
      setCambiandoEstado(false);
    }
  };

  const descargarCarpeta = async () => {
    setDescargandoZip(true);
    const error = await descargar('/empleados/descarga_masiva/', `Carpeta_${empleado.rut}.zip`, {
      metodo: 'post',
      datos: { empleados: [empleado.id], empresa_id: empresa.id, documentos: DOCUMENTOS_ZIP, cantidad_liquidaciones: 12 },
    });
    setDescargandoZip(false);
    avisar(error ?? 'Carpeta descargada');
  };

  const datos: [string, string][] = [
    ['RUT', empleado.rut],
    ['Cargo', capitalizar(contrato?.cargo || empleado.cargo) || '—'],
    ['Contrato', contrato ? TIPO_CONTRATO[contrato.tipo_contrato] ?? contrato.tipo_contrato : 'Sin contrato'],
    ['Ingreso', fechaCL(empleado.fecha_ingreso)],
    ['Antigüedad', antiguedad(empleado.fecha_ingreso)],
    ['Sueldo base', clp(contrato?.sueldo_base ?? empleado.sueldo_base)],
  ];

  return (
    <div className="max-w-[1440px] mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/app/trabajadores" className="inline-flex items-center gap-1.5 text-[13px] text-fg-2">
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />Trabajadores
        </Link>
        <div className="flex items-center gap-1">
          <NavTrabajador a={anterior && `/app/trabajadores/${anterior.id}${pestana !== 'resumen' ? `?tab=${pestana}` : ''}`} etiqueta="Trabajador anterior"><ChevronLeft className="size-4" strokeWidth={2} /></NavTrabajador>
          <span className="text-[12.5px] text-fg-3 j40-num px-1">{indice + 1} de {orden.length}</span>
          <NavTrabajador a={siguiente && `/app/trabajadores/${siguiente.id}${pestana !== 'resumen' ? `?tab=${pestana}` : ''}`} etiqueta="Trabajador siguiente"><ChevronRight className="size-4" strokeWidth={2} /></NavTrabajador>
        </div>
      </div>

      <header className="bg-surface border border-line rounded-j40-card shadow-card p-[18px] flex flex-col gap-4">
        <div className="flex items-start gap-4 flex-wrap">
          <span className="size-14 rounded-full bg-brand-soft text-brand-text grid place-items-center text-[18px] font-semibold shrink-0" aria-hidden>
            {iniciales(empleado.nombres, empleado.apellido_paterno)}
          </span>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.015em]">{nombre}</h1>
              <Chip tono={estado.tono}>{estado.texto}</Chip>
            </div>
            <p className="text-[13px] text-fg-3 mt-0.5">
              {empleado.ficha_numero ? `Ficha N° ${empleado.ficha_numero} · ` : ''}{capitalizar(empresa.nombre_legal)}
            </p>
          </div>
          <Button variante={empleado.activo ? 'peligro-contorno' : 'secundario'} onClick={() => setConfirmarEstado(true)}>
            {empleado.activo ? 'Desvincular' : 'Reactivar'}
          </Button>
          {nivel >= 3 ? (
            <Button variante="secundario" onClick={descargarCarpeta} cargando={descargandoZip}
              iconoInicio={<FolderDown className="size-4" strokeWidth={2} />}>Descargar carpeta</Button>
          ) : (
            <Link to="/app/plan" className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-3" title="La descarga de la carpeta en ZIP está disponible desde el plan Pyme">
              <Lock className="size-3.5" strokeWidth={2} aria-hidden />Carpeta ZIP desde plan Pyme
            </Link>
          )}
        </div>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-5 gap-y-3 pt-4 border-t border-line">
          {datos.map(([t, v]) => (
            <div key={t} className="flex flex-col gap-0.5 min-w-0">
              <dt className="text-[12px] text-fg-3">{t}</dt>
              <dd className={cn('text-[14px] font-medium truncate', t === 'RUT' && 'j40-mono')}>{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <nav aria-label="Secciones de la carpeta" className="border-b border-line overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {PESTANAS.map((p) => (
            <Link key={p.clave} to={p.clave === 'resumen' ? base : `${base}?tab=${p.clave}`} replace
              aria-current={pestana === p.clave ? 'page' : undefined}
              className={cn('px-3.5 py-2.5 -mb-px border-b-2 text-[13px] font-medium no-underline hover:no-underline whitespace-nowrap',
                pestana === p.clave ? 'border-brand text-fg' : 'border-transparent text-fg-3 hover:text-fg')}>
              {p.texto}
            </Link>
          ))}
        </div>
      </nav>

      <div className="grid grid-cols-1 min-[1180px]:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div className="min-w-0">
          {pestana === 'resumen' && (
            <Resumen empleado={empleado} liquidaciones={liquidaciones} firmas={firmas} documentos={documentos} maximo={maximo}
              cargando={carpeta.liquidaciones.isLoading} avisar={avisar} />
          )}
          {pestana === 'personal' && <DatosPersonales empleado={empleado} avisar={avisar} />}
          {pestana === 'contrato' && <ContratoJornada empleado={empleado} firmas={firmas} maximo={maximo} avisar={avisar} />}
          {pestana === 'remuneraciones' && (
            <Remuneraciones empleado={empleado} liquidaciones={liquidaciones} firmas={firmas}
              cargando={carpeta.liquidaciones.isLoading} avisar={avisar} />
          )}
          {pestana === 'vacaciones' && (
            <Vacaciones empleado={empleado} nivel={nivel} vacaciones={carpeta.vacaciones.data ?? []}
              saldo={carpeta.saldo.data} firmas={firmas} avisar={avisar} />
          )}
          {pestana === 'documentos' && <DocumentosTab empleado={empleado} documentos={documentos} nivel={nivel} avisar={avisar} />}
        </div>
        <Lateral empleado={empleado} documentos={documentos} nivel={nivel} />
      </div>

      {accion === 'anexo' && empleado.contrato_activo && (
        <DrawerAnexo empleado={empleado} onCerrar={cerrarAccion} avisar={avisar}
          preseleccion={tipoAnexo} />
      )}
      {accion === 'documento' && (
        <DrawerDocumento empleado={empleado} nivel={nivel} onCerrar={cerrarAccion} avisar={avisar}
          tipoInicial={(['AMONESTACION', 'CONSTANCIA', 'DESPIDO'].includes(params.get('tipo') ?? '') ? params.get('tipo') : 'AMONESTACION') as TipoDocumento} />
      )}
      {accion === 'vacacion' && nivel >= 2 && <DrawerVacacion empleado={empleado} saldo={carpeta.saldo.data} onCerrar={cerrarAccion} avisar={avisar} />}

      <Modal abierto={confirmarEstado} onCerrar={() => !cambiandoEstado && setConfirmarEstado(false)}
        titulo={empleado.activo ? 'Desvincular al trabajador' : 'Reactivar al trabajador'}
        acciones={<>
          <Button variante="secundario" onClick={() => setConfirmarEstado(false)} disabled={cambiandoEstado}>Cancelar</Button>
          <Button variante={empleado.activo ? 'peligro' : 'primario'} cargando={cambiandoEstado} onClick={cambiarEstado}>
            {empleado.activo ? 'Desvincular' : 'Reactivar'}
          </Button>
        </>}>
        <p className="text-[13.5px] text-fg-2">
          {empleado.activo
            ? 'Deja de ocupar cupo en tu plan y no aparecerá en los procesos del mes. Su carpeta y documentos se conservan. Si aún no lo haces, emite el finiquito.'
            : 'Vuelve a ocupar un cupo de tu plan y aparece de nuevo en los procesos del mes.'}
        </p>
      </Modal>
    </div>
  );
}

function NavTrabajador({ a, etiqueta, children }: { a: string | undefined; etiqueta: string; children: ReactNode }) {
  const clase = 'size-8 grid place-items-center rounded-[8px] border border-line-strong bg-surface';
  if (!a) return <span className={cn(clase, 'opacity-40')} aria-hidden>{children}</span>;
  return <Link to={a} aria-label={etiqueta} title={etiqueta} className={cn(clase, 'text-fg hover:bg-surface-2')}>{children}</Link>;
}
