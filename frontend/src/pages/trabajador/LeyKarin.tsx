import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Download, Megaphone, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { AlertaError, Button, CampoRut, Casilla } from '../../components/j40';
import { usePortal } from '../../components/trabajador/PortalShell';
import { EstadoLista, Seccion, Titulo } from '../../components/trabajador/comun';
import { mensajeError, portal } from '../../api/portal';
import { CLAVE_PORTAL } from '../../hooks/usePortal';
import type { CasoKarinPortal, KarinPortal, OpcionKarin } from '../../types';
import { fechaCL } from '../../utils/formato';

const DOCUMENTOS: Record<string, string> = {
  RECEPCION: 'Comprobante de recepción', DECISION: 'Comunicación de la decisión', CITACION: 'Citación a declarar',
  NOTIFICACION: 'Notificación de las conclusiones', MEDIDAS: 'Comunicación de medidas',
};
const ROL: Record<CasoKarinPortal['rol'], string> = {
  PARTE: 'Tu denuncia', DENUNCIADA: 'Investigación en la que te citan', TESTIGO: 'Citación como testigo',
};

/**
 * Casos Ley Karin en que participa la persona. Cada rol ve solo su parte:
 * quien denunció, el estado; la persona denunciada, sus citaciones y el
 * resultado; un testigo, solo su citación.
 */
export default function LeyKarin() {
  const { avisar, actualizarCuenta } = usePortal();
  const consulta = useQuery({ queryKey: [CLAVE_PORTAL, 'karin'], queryFn: portal.karin });
  const [denunciando, setDenunciando] = useState(false);
  const casos = consulta.data?.casos ?? [];

  const bajar = async (c: CasoKarinPortal, tipo: string, participante: string) => {
    const error = await portal.descargarKarin(c.id, tipo, participante, `${c.folio}_${tipo.toLowerCase()}.pdf`);
    if (error) avisar(error, 'error');
  };

  return (
    <>
      <Titulo titulo="Ley Karin">
        Información reservada sobre denuncias de acoso o violencia en el trabajo en las que participas.
      </Titulo>
      <p className="flex gap-2.5 items-start rounded-[10px] bg-brand-soft text-brand-text px-4 py-3 text-[14.5px] leading-relaxed max-w-[760px]">
        <ShieldCheck className="size-5 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
        La investigación es reservada y la ley prohíbe cualquier represalia contra quien denuncia o declara. Si tienes dudas,
        consulta al encargado de denuncias de tu empresa o a la Dirección del Trabajo.
      </p>
      {consulta.data && (
        <Seccion titulo="Hacer una denuncia" className="max-w-[760px]"
          subtitulo="Acoso sexual, acoso laboral o violencia en el trabajo. Llega directo al encargado de denuncias de la empresa.">
          <div className="p-4 sm:p-[18px] flex flex-col gap-4">
            {denunciando ? (
              <FormularioDenuncia datos={consulta.data} onCancelar={() => setDenunciando(false)} onEnviada={(caso) => {
                setDenunciando(false);
                avisar(`Tu denuncia quedó recibida con el folio ${caso.folio}. Te enviamos el comprobante a tu correo.`);
                void consulta.refetch();
                actualizarCuenta();
              }} />
            ) : consulta.data.canales.some((c) => c.disponible) ? (
              <>
                <p className="text-[15px] text-fg-2">
                  Tu denuncia queda registrada con fecha y hora, y recibes un comprobante. No es anónima: la recibe el encargado
                  de denuncias de la empresa, que debe actuar dentro de 3 días hábiles. Si prefieres, también puedes denunciar
                  directamente ante la Dirección del Trabajo.
                </p>
                <Button tamano="lg" className="self-start" onClick={() => setDenunciando(true)}
                  iconoInicio={<Megaphone className="size-5" strokeWidth={2} />}>Hacer una denuncia</Button>
              </>
            ) : (
              <p className="text-[15px] text-fg-2">
                Tu empresa aún no designó un encargado de denuncias en Jornada40. Puedes denunciar ante la empresa por los canales
                que te informó, o directamente ante la Dirección del Trabajo en <a href="https://www.dt.gob.cl" target="_blank" rel="noreferrer">www.dt.gob.cl</a>.
              </p>
            )}
          </div>
        </Seccion>
      )}
      <EstadoLista cargando={consulta.isLoading} error={consulta.isError} vacia={casos.length === 0} textoVacio="No participas en ningún caso por ahora." />
      {casos.map((c) => (
        <Seccion key={`${c.id}-${c.rol}`} titulo={`${ROL[c.rol]} · ${c.folio}`} subtitulo={c.empresa} className="max-w-[760px]">
          <div className="p-4 sm:p-[18px] flex flex-col gap-3 text-[15px]">
            {c.materia && <p><span className="text-fg-3">Materia:</span> {c.materia}{c.recibida_en ? `, recibida el ${fechaCL(c.recibida_en)}` : ''}.</p>}
            {c.estado && <p><span className="text-fg-3">Estado:</span> {c.estado}</p>}
            {c.decision && <p><span className="text-fg-3">Decisión:</span> {c.decision}{c.decision_en ? ` (desde el ${fechaCL(c.decision_en)})` : ''}.</p>}
            {c.resguardo && c.resguardo.length > 0 && (
              <div>
                <p className="text-fg-3">Medidas de resguardo:</p>
                <ul className="list-disc pl-5">{c.resguardo.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
            )}
            {c.citaciones.map((ci) => (
              <p key={ci.participante} className="flex gap-2.5 items-start rounded-[10px] bg-warn-soft text-warn px-3.5 py-3">
                <CalendarClock className="size-5 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
                <span>Citación a declarar el <b>{fechaCL(ci.fecha)}</b> a las <b>{ci.hora}</b> en {ci.lugar}.</span>
              </p>
            ))}
            {c.conclusion && <p><span className="text-fg-3">Resultado:</span> {c.conclusion}.</p>}
            {c.medidas_en && <p><span className="text-fg-3">Medidas aplicadas el</span> {fechaCL(c.medidas_en)}.</p>}
            {c.documentos.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {c.documentos.map((d) => (
                  <Button key={`${d.tipo}-${d.participante}`} variante="secundario" tamano="sm"
                    iconoInicio={<Download className="size-4" strokeWidth={2} />} onClick={() => void bajar(c, d.tipo, d.participante)}>
                    {DOCUMENTOS[d.tipo] ?? d.tipo}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </Seccion>
      ))}
    </>
  );
}

const CONTROL = 'h-11 w-full px-3 rounded-j40-control border border-line-strong bg-surface text-fg text-[15px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';

function Lista({ id, etiqueta, valor, onChange, opciones }: { id: string; etiqueta: string; valor: string; onChange: (v: string) => void; opciones: OpcionKarin[] }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[14px] font-medium text-fg-2">
      {etiqueta}
      <select id={id} value={valor} onChange={(e) => onChange(e.target.value)} className={CONTROL}>
        <option value="">Elige una opción</option>
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
    </label>
  );
}

function Campo({ id, etiqueta, valor, onChange, tipo = 'text' }: { id: string; etiqueta: string; valor: string; onChange: (v: string) => void; tipo?: string }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[14px] font-medium text-fg-2">
      {etiqueta}
      <input id={id} type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} className={CONTROL} autoComplete="off" />
    </label>
  );
}

interface Denunciado { nombre: string; cargo: string; vinculo: string }

/** Denuncia del propio trabajador (Art. 11 DS 21). Sus datos salen de su ficha: no se piden. */
function FormularioDenuncia({ datos, onCancelar, onEnviada }: {
  datos: KarinPortal; onCancelar: () => void; onEnviada: (caso: CasoKarinPortal) => void;
}) {
  const disponibles = datos.canales.filter((c) => c.disponible);
  const [empleo, setEmpleo] = useState(disponibles.length === 1 ? String(disponibles[0].empleo) : '');
  const [tipo, setTipo] = useState('');
  const [soyAfectada, setSoyAfectada] = useState(true);
  const [afectada, setAfectada] = useState({ nombre: '', rut: '', correo: '' });
  const [representacion, setRepresentacion] = useState('');
  const [denunciados, setDenunciados] = useState<Denunciado[]>([{ nombre: '', cargo: '', vinculo: '' }]);
  const [relato, setRelato] = useState('');
  const [pideDt, setPideDt] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const cambiar = (i: number, c: Partial<Denunciado>) => setDenunciados((l) => l.map((p, j) => (j === i ? { ...p, ...c } : p)));
  const contraEmpleador = denunciados.some((d) => d.vinculo === 'EMPLEADOR' || d.vinculo === 'DIRECCION');

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      onEnviada(await portal.denunciar({
        empleo: Number(empleo), tipo, soy_afectada: soyAfectada, denunciados, relato, pide_derivar_dt: pideDt,
        ...(soyAfectada ? {} : { afectada, representacion }),
      }));
    } catch (err) {
      setError(mensajeError(err, 'No pudimos enviar tu denuncia. Revisa los datos e intenta de nuevo.'));
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {error && <AlertaError>{error}</AlertaError>}
      {disponibles.length > 1 && (
        <Lista id="pk-empresa" etiqueta="Empresa donde ocurrieron los hechos" valor={empleo} onChange={setEmpleo}
          opciones={disponibles.map((c) => ({ valor: String(c.empleo), texto: c.empresa }))} />
      )}
      <Lista id="pk-tipo" etiqueta="¿Qué quieres denunciar?" valor={tipo} onChange={setTipo} opciones={datos.catalogos.tipos} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[14px] font-medium text-fg-2 mb-1">¿Quién sufrió los hechos?</legend>
        <label className="flex items-center gap-2.5 text-[15px] cursor-pointer">
          <input type="radio" name="pk-quien" checked={soyAfectada} onChange={() => setSoyAfectada(true)} className="size-[18px] accent-brand" />Yo
        </label>
        <label className="flex items-center gap-2.5 text-[15px] cursor-pointer">
          <input type="radio" name="pk-quien" checked={!soyAfectada} onChange={() => setSoyAfectada(false)} className="size-[18px] accent-brand" />Otra persona (denuncio en su nombre)
        </label>
      </fieldset>
      {!soyAfectada && (
        <div className="flex flex-col gap-3 pl-4 border-l-2 border-line">
          <Campo id="pk-afectada-nombre" etiqueta="Nombre de la persona afectada" valor={afectada.nombre} onChange={(v) => setAfectada((a) => ({ ...a, nombre: v }))} />
          <CampoRut etiqueta="RUT de la persona afectada" valor={afectada.rut} onChange={(v) => setAfectada((a) => ({ ...a, rut: v }))} />
          <Campo id="pk-afectada-correo" tipo="email" etiqueta="Correo de la persona afectada (si lo sabes)" valor={afectada.correo} onChange={(v) => setAfectada((a) => ({ ...a, correo: v }))} />
          <Lista id="pk-representacion" etiqueta="Denuncio en su nombre como" valor={representacion} onChange={setRepresentacion} opciones={datos.catalogos.representaciones} />
        </div>
      )}
      {denunciados.map((d, i) => (
        <div key={i} className="flex flex-col gap-3 p-3.5 rounded-[10px] border border-line">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">Persona denunciada {i + 1}</span>
            {denunciados.length > 1 && (
              <Button variante="fantasma" tamano="sm" onClick={() => setDenunciados((l) => l.filter((_, j) => j !== i))}
                iconoInicio={<Trash2 className="size-4" strokeWidth={2} />}>Quitar</Button>
            )}
          </div>
          <Campo id={`pk-denunciado-${i}`} etiqueta="Nombre (si no lo sabes, una descripción)" valor={d.nombre} onChange={(v) => cambiar(i, { nombre: v })} />
          <Campo id={`pk-cargo-${i}`} etiqueta="Cargo (si lo sabes)" valor={d.cargo} onChange={(v) => cambiar(i, { cargo: v })} />
          <Lista id={`pk-vinculo-${i}`} etiqueta="¿Qué relación tiene con la persona afectada?" valor={d.vinculo} onChange={(v) => cambiar(i, { vinculo: v })} opciones={datos.catalogos.vinculos} />
        </div>
      ))}
      <Button variante="secundario" className="self-start" onClick={() => setDenunciados((l) => [...l, { nombre: '', cargo: '', vinculo: '' }])}
        iconoInicio={<Plus className="size-4" strokeWidth={2} />}>Agregar otra persona</Button>
      {contraEmpleador && (
        <p className="rounded-[10px] bg-brand-soft text-brand-text px-4 py-3 text-[14.5px]">
          Como la denuncia es contra el empleador o alguien con cargo de dirección, la investigará la Dirección del Trabajo.
        </p>
      )}
      <label htmlFor="pk-relato" className="flex flex-col gap-1.5 text-[14px] font-medium text-fg-2">
        Cuéntanos qué pasó: qué ocurrió, cuándo y dónde
        <textarea id="pk-relato" value={relato} onChange={(e) => setRelato(e.target.value)} rows={7}
          className="w-full px-3 py-2.5 rounded-j40-control border border-line-strong bg-surface text-fg text-[15px] leading-relaxed outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft" />
      </label>
      <Casilla marcada={pideDt} onChange={setPideDt}>
        <span className="text-[15px]">Prefiero que la investigue la Dirección del Trabajo</span>
      </Casilla>
      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" tamano="lg" cargando={enviando} disabled={!empleo || !tipo || !relato.trim()}>Enviar denuncia</Button>
        <Button variante="secundario" tamano="lg" onClick={onCancelar} disabled={enviando}>Cancelar</Button>
      </div>
    </form>
  );
}
