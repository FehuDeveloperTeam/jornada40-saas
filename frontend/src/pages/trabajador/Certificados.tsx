import { useState } from 'react';
import type { FormEvent } from 'react';
import { BadgeCheck } from 'lucide-react';
import { AlertaError, Button, Chip, Field } from '../../components/j40';
import { usePortal } from '../../components/trabajador/PortalShell';
import { BotonDescarga, EstadoLista, Seccion, Titulo } from '../../components/trabajador/comun';
import { mensajeError, portal } from '../../api/portal';
import { useCertificadosPortal } from '../../hooks/usePortal';
import type { OpcionesCertificado, TipoCertificado } from '../../types';

const SELECT = 'h-10 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:opacity-60';

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Certificados() {
  const { variasEmpresas } = usePortal();
  const { data, isLoading, isError } = useCertificadosPortal();
  const emitidos = data?.emitidos ?? [];
  return (
    <>
      <Titulo titulo="Certificados">
        Genera al instante certificados con los datos de tu empleador. Cada uno trae un código para que quien lo reciba verifique que es auténtico.
      </Titulo>
      <Seccion titulo="Nuevo certificado" className="max-w-[620px]">
        <div className="p-4 sm:p-[18px]">
          <EstadoLista cargando={isLoading} error={isError} vacia={!isLoading && !isError && !data?.opciones.length}
            textoVacio="No tienes empleos habilitados para emitir certificados." />
          {data && data.opciones.length > 0 && <Formulario opciones={data.opciones} />}
        </div>
      </Seccion>
      {(data?.sueldos_sii.length ?? 0) > 0 && (
        <Seccion titulo="Certificado N°6 del SII" subtitulo="Tus sueldos e impuesto retenido del año, para tu declaración de renta. Lo emite tu empleador.">
          <ul className="flex flex-col" aria-label="Certificados N°6">
            {data!.sueldos_sii.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-[18px] py-3 border-b border-line last:border-b-0">
                <span className="flex-1 min-w-[200px] flex flex-col gap-0.5">
                  <span className="text-[13.5px] font-medium">Año {c.anio} · certificado N° {c.numero}</span>
                  {variasEmpresas && <span className="text-[12px] text-fg-3">{c.empresa}</span>}
                </span>
                <BotonDescarga tipo="certificado_sii" id={c.id} nombre={`Certificado6_${c.anio}_${c.numero}.pdf`}
                  etiqueta={`Descargar certificado N°6 del año ${c.anio}`} />
              </li>
            ))}
          </ul>
        </Seccion>
      )}
      <Seccion titulo="Certificados emitidos">
        <EstadoLista cargando={isLoading} error={isError} vacia={!emitidos.length} textoVacio="Aún no has emitido certificados." />
        {emitidos.length > 0 && (
          <ul className="flex flex-col" aria-label="Certificados emitidos">
            {emitidos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-[18px] py-3 border-b border-line last:border-b-0">
                <span className="flex-1 min-w-[200px] flex flex-col gap-0.5">
                  <span className="text-[13.5px] font-medium">{c.titulo}{c.opcion_texto ? ` · ${c.opcion_texto.toLowerCase()}` : ''}</span>
                  <span className="text-[12px] text-fg-3 j40-num">
                    {variasEmpresas && c.empresa ? `${c.empresa} · ` : ''}{c.folio} · emitido el {fechaHora(c.emitido_en)}
                  </span>
                  <span className="text-[12px] text-fg-2">Código de verificación <span className="j40-mono font-medium">{c.codigo}</span></span>
                  {c.anulado_en && (
                    <span className="text-[12px] text-danger">Anulado por tu empleador: {c.motivo_anulacion.toLowerCase()}. Puedes emitir uno nuevo.</span>
                  )}
                </span>
                {c.anulado_en
                  ? <Chip tono="peligro">Anulado</Chip>
                  : <BotonDescarga tipo="certificado" id={c.id} nombre={`${c.folio}.pdf`} etiqueta={`Descargar ${c.titulo} ${c.folio}`} />}
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </>
  );
}

function Formulario({ opciones }: { opciones: OpcionesCertificado[] }) {
  const { avisar, actualizarCuenta } = usePortal();
  const [empleo, setEmpleo] = useState(opciones[0].empleo);
  const [tipo, setTipo] = useState<TipoCertificado | ''>('');
  const [opcion, setOpcion] = useState('');
  const [error, setError] = useState('');
  const [generando, setGenerando] = useState(false);
  const actual = opciones.find((o) => o.empleo === empleo) ?? opciones[0];
  const certificado = actual.certificados.find((c) => c.tipo === tipo);
  const noDisponibles = actual.certificados.filter((c) => !c.disponible);

  const generar = async (e: FormEvent) => {
    e.preventDefault();
    if (!certificado) return setError('Elige el certificado que necesitas.');
    if (certificado.opciones && !opcion) return setError('Elige el período del certificado.');
    setError('');
    setGenerando(true);
    try {
      const emitido = await portal.emitirCertificado({ empleo: actual.empleo, tipo: certificado.tipo, ...(certificado.opciones ? { opcion } : {}) });
      const fallo = await portal.descargar('certificado', emitido.id, `${emitido.folio}.pdf`);
      if (fallo) avisar(fallo, 'error');
      else avisar(`Certificado ${emitido.folio} generado.`);
      setTipo(''); setOpcion('');
      actualizarCuenta();
    } catch (err) {
      setError(mensajeError(err, 'No pudimos generar el certificado. Intenta de nuevo en unos minutos.'));
    } finally {
      setGenerando(false);
    }
  };

  return (
    <form onSubmit={generar} className="flex flex-col gap-4" noValidate>
      {error && <AlertaError>{error}</AlertaError>}
      {opciones.length > 1 && (
        <Field etiqueta="Empresa">
          {(p) => (
            <select {...p} className={SELECT} value={empleo}
              onChange={(e) => { setEmpleo(Number(e.target.value)); setTipo(''); setOpcion(''); setError(''); }}>
              {opciones.map((o) => <option key={o.empleo} value={o.empleo}>{o.empresa}</option>)}
            </select>
          )}
        </Field>
      )}
      {actual.aviso ? <p role="status" className="rounded-[8px] bg-warn-soft text-warn px-3.5 py-3 text-[13px]">{actual.aviso}</p> : (
      <>
      <Field etiqueta="Certificado">
        {(p) => (
          <select {...p} className={SELECT} value={tipo}
            onChange={(e) => { setTipo(e.target.value as TipoCertificado | ''); setOpcion(''); setError(''); }}>
            <option value="">Elige un certificado</option>
            {actual.certificados.map((c) => (
              <option key={c.tipo} value={c.tipo} disabled={!c.disponible}>{c.texto}{c.disponible ? '' : ' (no disponible)'}</option>
            ))}
          </select>
        )}
      </Field>
      {certificado?.opciones && (
        <Field etiqueta="Período">
          {(p) => (
            <select {...p} className={SELECT} value={opcion} onChange={(e) => setOpcion(e.target.value)}>
              <option value="">Elige el período</option>
              {certificado.opciones!.map((o) => (
                <option key={o.valor} value={o.valor} disabled={!o.disponible}>{o.texto}{o.disponible ? '' : ' (no disponible)'}</option>
              ))}
            </select>
          )}
        </Field>
      )}
      {certificado?.opciones?.some((o) => !o.disponible) && (
        <ul className="flex flex-col gap-1 text-[12.5px] text-fg-3">
          {certificado.opciones.filter((o) => !o.disponible).map((o) => <li key={o.valor}>{o.texto}: {o.motivo}</li>)}
        </ul>
      )}
      <Button type="submit" cargando={generando} className="self-start" iconoInicio={<BadgeCheck className="size-4" strokeWidth={2} />}>
        Generar certificado
      </Button>
      {noDisponibles.length > 0 && (
        <div className="rounded-[8px] bg-sunken px-3.5 py-3 text-[12.5px] text-fg-2">
          <p className="font-medium text-fg mb-1">Por ahora no disponibles</p>
          <ul className="flex flex-col gap-1" aria-label="Certificados no disponibles">
            {noDisponibles.map((c) => <li key={c.tipo}><span className="font-medium">{c.texto}:</span> {c.motivo}</li>)}
          </ul>
        </div>
      )}
      </>
      )}
    </form>
  );
}
