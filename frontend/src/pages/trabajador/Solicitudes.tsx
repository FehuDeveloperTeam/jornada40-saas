import { useState } from 'react';
import type { FormEvent } from 'react';
import { Send } from 'lucide-react';
import { AlertaError, Button, Chip, Field } from '../../components/j40';
import type { TonoChip } from '../../components/j40';
import { usePortal } from '../../components/trabajador/PortalShell';
import { EstadoLista, Seccion, Titulo } from '../../components/trabajador/comun';
import { mensajeError, portal } from '../../api/portal';
import { useSolicitudesPortal } from '../../hooks/usePortal';
import type { EstadoSolicitudDocumento, OpcionesSolicitudPortal, SolicitudDocumentoPortal, TipoSolicitudDocumento } from '../../types';
import { fechaCL } from '../../utils/formato';

const SELECT = 'h-10 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:opacity-60';

const ESTADO_SOLICITUD: Record<EstadoSolicitudDocumento, { texto: string; tono: TonoChip }> = {
  PENDIENTE: { texto: 'Pendiente', tono: 'aviso' },
  RESUELTA: { texto: 'Resuelta', tono: 'ok' },
  DESCARTADA: { texto: 'Descartada', tono: 'neutro' },
};

export default function Solicitudes() {
  const { data, isLoading, isError } = useSolicitudesPortal();
  const solicitudes = data?.solicitudes ?? [];
  return (
    <>
      <Titulo titulo="Solicitudes">
        Si tu empleador aún no emite un documento que necesitas, pídeselo aquí. Cuando lo envíe a firma te llegará un correo.
      </Titulo>
      <Seccion titulo="Nueva solicitud" className="max-w-[560px]">
        <div className="p-4 sm:p-[18px]">
          <EstadoLista cargando={isLoading} error={isError} vacia={!isLoading && !isError && !data?.opciones.length}
            textoVacio="No tienes empleos habilitados para solicitar documentos." />
          {data && data.opciones.length > 0 && <Formulario opciones={data.opciones} />}
        </div>
      </Seccion>
      <Seccion titulo="Tus solicitudes">
        <EstadoLista cargando={isLoading} error={isError} vacia={!solicitudes.length} textoVacio="Aún no has solicitado documentos." />
        {solicitudes.length > 0 && (
          <ul className="flex flex-col" aria-label="Tus solicitudes">
            {solicitudes.map((s) => <ItemSolicitud key={s.id} s={s} />)}
          </ul>
        )}
      </Seccion>
    </>
  );
}

function ItemSolicitud({ s }: { s: SolicitudDocumentoPortal }) {
  const { variasEmpresas } = usePortal();
  const estado = ESTADO_SOLICITUD[s.estado];
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-1.5 px-[18px] py-3 border-b border-line last:border-b-0">
      <span className="flex-1 min-w-[180px] flex flex-col gap-0.5">
        <span className="text-[13.5px] font-medium break-words">
          {s.tipo_texto}{s.referencia ? ` · ${s.referencia}` : ''}
        </span>
        <span className="text-[12px] text-fg-3 j40-num">
          {variasEmpresas ? `${s.empresa} · ` : ''}Pedida el {fechaCL(s.creada_en)}
          {s.estado === 'RESUELTA' ? ' · Enviada a tu firma: revisa tu correo o Inicio' : ''}
        </span>
        {s.estado === 'DESCARTADA' && s.motivo_texto && (
          <span className="text-[12.5px] text-fg-2 break-words">Respuesta de tu empleador: {s.motivo_texto}</span>
        )}
      </span>
      <Chip tono={estado.tono}>{estado.texto}</Chip>
    </li>
  );
}

function Formulario({ opciones }: { opciones: OpcionesSolicitudPortal[] }) {
  const { avisar, actualizarCuenta } = usePortal();
  const [empleo, setEmpleo] = useState(opciones[0].empleo);
  const [tipo, setTipo] = useState<TipoSolicitudDocumento | ''>('');
  const [opcion, setOpcion] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const empleoActual = opciones.find((o) => o.empleo === empleo) ?? opciones[0];
  const documento = empleoActual.documentos.find((d) => d.tipo === tipo);

  const cambiarEmpleo = (valor: number) => { setEmpleo(valor); setTipo(''); setOpcion(''); setError(''); };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!documento) return setError('Elige el documento que necesitas.');
    if (documento.opciones && !opcion) return setError(`Elige una opción de «${documento.etiqueta_opcion}».`);
    setError('');
    setEnviando(true);
    try {
      await portal.solicitar({ empleo: empleoActual.empleo, tipo: documento.tipo, ...(documento.opciones ? { opcion } : {}) });
      avisar('Solicitud enviada. Tu empleador la verá en su panel.');
      setTipo(''); setOpcion('');
      actualizarCuenta();
    } catch (err) {
      setError(mensajeError(err, 'No pudimos enviar la solicitud. Intenta de nuevo en unos minutos.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      {error && <AlertaError>{error}</AlertaError>}
      {opciones.length > 1 && (
        <Field etiqueta="Empresa">
          {(p) => (
            <select {...p} className={SELECT} value={empleo} onChange={(e) => cambiarEmpleo(Number(e.target.value))}>
              {opciones.map((o) => <option key={o.empleo} value={o.empleo}>{o.empresa}</option>)}
            </select>
          )}
        </Field>
      )}
      {empleoActual.documentos.length === 0 ? (
        <p className="text-[13px] text-fg-3">
          Por ahora no hay documentos por pedir: tus liquidaciones, contrato y comprobantes ya están emitidos o en firma.
        </p>
      ) : (
        <>
          <Field etiqueta="Documento" ayuda="Solo aparecen los documentos que aún no se han emitido o enviado a tu firma.">
            {(p) => (
              <select {...p} className={SELECT} value={tipo}
                onChange={(e) => { setTipo(e.target.value as TipoSolicitudDocumento | ''); setOpcion(''); setError(''); }}>
                <option value="">Elige un documento</option>
                {empleoActual.documentos.map((d) => <option key={d.tipo} value={d.tipo}>{d.texto}</option>)}
              </select>
            )}
          </Field>
          {documento?.opciones && (
            <Field etiqueta={documento.etiqueta_opcion}>
              {(p) => (
                <select {...p} className={SELECT} value={opcion} onChange={(e) => setOpcion(e.target.value)}>
                  <option value="">Elige una opción</option>
                  {documento.opciones!.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                </select>
              )}
            </Field>
          )}
          <Button type="submit" cargando={enviando} className="self-start" iconoInicio={<Send className="size-4" strokeWidth={2} />}>
            Enviar solicitud
          </Button>
        </>
      )}
    </form>
  );
}
