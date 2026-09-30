import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { CircleCheck, CircleX, Search } from 'lucide-react';
import { Button, Field, Input, J40Root, Logo, ToggleTema } from '../../components/j40';
import client from '../../api/client';
import type { VerificacionCertificado } from '../../types';
import { codigoCompleto, normalizarCodigo as normalizar } from '../../utils/codigos';

/**
 * Verificación pública de certificados emitidos desde el portal del
 * trabajador: quien recibe un certificado ingresa (o escanea) el código y ve
 * lo que el certificado afirma según Jornada40. El mismo código sirve para las
 * copias de la bitácora que un empleador presenta (folio B-…).
 */
export default function Verificar() {
  const { codigo = '' } = useParams();
  const navigate = useNavigate();
  const [valor, setValor] = useState(normalizar(codigo));
  const buscado = normalizar(codigo);
  const consulta = useQuery({
    queryKey: ['verificar-certificado', buscado],
    queryFn: async () => (await client.get<VerificacionCertificado>(`/certificados/verificar/${buscado}/`)).data,
    enabled: codigoCompleto(buscado),
    retry: false,
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (codigoCompleto(valor)) navigate(`/verificar/${normalizar(valor)}`);
  };
  const noExiste = consulta.isError && isAxiosError(consulta.error) && consulta.error.response?.status === 404;

  return (
    <J40Root className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="max-w-[760px] mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" aria-label="Jornada40, inicio" className="no-underline hover:no-underline"><Logo tamano={28} /></Link>
          <span className="flex-1" />
          <ToggleTema />
        </div>
      </header>
      <main className="max-w-[760px] mx-auto px-4 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-[clamp(22px,3vw,30px)] font-semibold tracking-[-0.02em]">Verificar un documento</h1>
          <p className="text-[14px] text-fg-2 mt-1">
            Ingresa el código de verificación impreso en el certificado o en la copia de la bitácora para confirmar que fue emitido por Jornada40.
          </p>
        </div>

        <form onSubmit={enviar} className="flex flex-wrap items-end gap-3" noValidate>
          <Field etiqueta="Código de verificación" className="flex-1 min-w-[220px]">
            {(p) => (
              <Input {...p} value={valor} onChange={(e) => setValor(normalizar(e.target.value))} placeholder="XXXX-XXXX-XXXX"
                autoComplete="off" spellCheck={false} className="j40-mono tracking-[0.08em]" />
            )}
          </Field>
          <Button type="submit" disabled={!codigoCompleto(valor)}
            iconoInicio={<Search className="size-4" strokeWidth={2} />}>Verificar</Button>
        </form>

        {consulta.isLoading && <p className="text-[13px] text-fg-3" role="status">Verificando…</p>}
        {noExiste && (
          <div role="alert" className="flex gap-3 items-start rounded-j40-card border border-line bg-surface p-4">
            <CircleX className="size-6 text-danger shrink-0" strokeWidth={2} aria-hidden />
            <div>
              <p className="text-[15px] font-semibold">No encontramos un documento con ese código</p>
              <p className="text-[13px] text-fg-2">Revisa que esté bien escrito. Si lo está, el documento no fue emitido por Jornada40.</p>
            </div>
          </div>
        )}
        {consulta.isError && !noExiste && (
          <p role="alert" className="text-[13px] text-danger">No pudimos verificar el código ahora. Intenta de nuevo en unos minutos.</p>
        )}
        {consulta.data && (consulta.data.anulado ? <Anulado v={consulta.data} /> : <Resultado v={consulta.data} />)}
      </main>
    </J40Root>
  );
}

function Anulado({ v }: { v: VerificacionCertificado }) {
  return (
    <section aria-label="Resultado de la verificación" role="alert" className="flex gap-3 items-start rounded-j40-card border border-line bg-surface p-4">
      <CircleX className="size-6 text-danger shrink-0" strokeWidth={2} aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold">Certificado anulado: no es válido</p>
        <p className="text-[13px] text-fg-2">
          {v.titulo} · folio <span className="j40-mono">{v.folio}</span>, emitido el {v.emitido} por {v.empresa.nombre} (RUT {v.empresa.rut}).
        </p>
        <p className="text-[13px] text-fg-2">El empleador lo anuló el {v.anulado_en}: {v.motivo_anulacion?.toLowerCase()}. Pide al trabajador uno vigente.</p>
      </div>
    </section>
  );
}

function Resultado({ v }: { v: VerificacionCertificado }) {
  return (
    <section aria-label="Resultado de la verificación" className="rounded-j40-card border border-line bg-surface shadow-card flex flex-col">
      {v.alterado ? (
        <div role="alert" className="flex gap-3 items-start p-4 border-b border-line bg-danger-soft rounded-t-j40-card">
          <CircleX className="size-6 text-danger shrink-0" strokeWidth={2} aria-hidden />
          <div>
            <p className="text-[15px] font-semibold">Los registros ya no coinciden con esta copia</p>
            <p className="text-[13px] text-fg-2">
              {v.titulo} · folio <span className="j40-mono">{v.folio}</span> · emitida el {v.emitido}
            </p>
          </div>
        </div>
      ) : (
      <div className="flex gap-3 items-start p-4 border-b border-line bg-ok-soft rounded-t-j40-card">
        <CircleCheck className="size-6 text-ok shrink-0" strokeWidth={2} aria-hidden />
        <div>
          <p className="text-[15px] font-semibold">{v.trabajador ? 'Certificado auténtico' : 'Documento auténtico'}</p>
          <p className="text-[13px] text-fg-2">
            {v.titulo} · folio <span className="j40-mono">{v.folio}</span> · emitido el {v.emitido}
          </p>
        </div>
      </div>
      )}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 p-4 text-[13.5px]">
        <dt className="text-fg-3">{v.trabajador ? 'Empleador' : 'Titular'}</dt><dd className="font-medium">{v.empresa.nombre} · RUT {v.empresa.rut}</dd>
        {v.trabajador && <><dt className="text-fg-3">Trabajador</dt><dd className="font-medium">{v.trabajador.nombre} · RUT {v.trabajador.rut}</dd></>}
        {(v.filas ?? []).map(([etiqueta, valor]) => (
          <div key={etiqueta} className="contents"><dt className="text-fg-3">{etiqueta}</dt><dd className="break-all">{valor}</dd></div>
        ))}
      </dl>
      {v.tabla && (
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[480px] text-[13px] border-collapse">
            <thead>
              <tr>{v.tabla.columnas.map((c) => <th key={c} className="text-left font-medium text-fg-3 py-2 pr-3 border-b border-line">{c}</th>)}</tr>
            </thead>
            <tbody>
              {v.tabla.filas.map((fila, i) => (
                <tr key={i}>{fila.map((celda, j) => <td key={j} className="py-2 pr-3 border-b border-line j40-num">{celda}</td>)}</tr>
              ))}
              {v.tabla.pie && <tr>{v.tabla.pie.map((celda, j) => <td key={j} className="py-2 pr-3 font-semibold j40-num">{celda}</td>)}</tr>}
            </tbody>
          </table>
        </div>
      )}
      {v.nota && <p className="px-4 pb-4 text-[12.5px] text-fg-3">{v.nota}</p>}
      <p className="px-4 pb-4 text-[12px] text-fg-3">
        Compara estos datos con el documento que recibiste: deben coincidir.
        {v.trabajador ? ' El RUT del trabajador se muestra en parte para proteger sus datos.' : ' La huella debe ser la misma impresa en la copia.'}
      </p>
    </section>
  );
}
