import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import client from '../../api/client';
import { AlertaError, Button, CampoRut, Casilla } from '../../components/j40';
import { useKarin } from '../../components/karin/KarinShell';
import { AREA, Seccion, Selector, Texto, mensajeError } from '../../components/karin/comun';
import type { CatalogosKarin, DenunciaKarinDetalle, PersonaKarin } from '../../types';

const vacia = (): PersonaKarin => ({ nombre: '', rut: '', cargo: '', correo: '' });

function ahoraLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function NuevaDenuncia() {
  const { catalogos } = useKarin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  if (!catalogos) return <p className="text-[15px] text-fg-3" role="status">Cargando…</p>;
  return (
    <>
      <Link to="/karin/panel" className="inline-flex items-center gap-1.5 text-[14px] text-fg-2"><ArrowLeft className="size-4" strokeWidth={2} aria-hidden />Volver</Link>
      <h1 className="text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.015em]">Registrar denuncia</h1>
      <p className="text-[15px] text-fg-2">
        No hay control de admisibilidad: registre la denuncia aunque venga incompleta y complétela después (Arts. 12 y 15 DS 21).
        No se aceptan denuncias anónimas: la persona afectada debe identificarse.
      </p>
      <FormularioDenuncia catalogos={catalogos} onGuardada={async (d) => {
        await queryClient.invalidateQueries({ queryKey: ['karin', 'denuncias'] });
        navigate(`/karin/denuncias/${d.id}`, { replace: true });
      }} />
    </>
  );
}

/** Datos de la denuncia (Art. 11 DS 21). Sin `inicial` registra; con `inicial` completa o corrige. */
export function FormularioDenuncia({ catalogos, inicial, onGuardada }: {
  catalogos: CatalogosKarin; inicial?: DenunciaKarinDetalle; onGuardada: (d: DenunciaKarinDetalle) => Promise<void> | void;
}) {
  const [empresa, setEmpresa] = useState(String(inicial?.empresa.id ?? (catalogos.empresas.length === 1 ? catalogos.empresas[0].id : '')));
  const [tipo, setTipo] = useState(inicial?.tipo ?? '');
  const [canal, setCanal] = useState(inicial?.canal ?? '');
  const [recibida, setRecibida] = useState(inicial ? inicial.recibida_en.slice(0, 16) : ahoraLocal());
  const [afectada, setAfectada] = useState<PersonaKarin>(inicial?.datos.afectada ?? vacia());
  const [porOtra, setPorOtra] = useState(Boolean(inicial?.datos.denunciante));
  const [denunciante, setDenunciante] = useState<PersonaKarin>(inicial?.datos.denunciante ?? vacia());
  const [representacion, setRepresentacion] = useState(inicial?.datos.representacion ?? '');
  const [denunciados, setDenunciados] = useState<PersonaKarin[]>(inicial?.datos.denunciados ?? [{ ...vacia(), vinculo: '' }]);
  const [relato, setRelato] = useState(inicial?.datos.relato ?? '');
  const [pideDt, setPideDt] = useState(inicial?.pide_derivar_dt ?? false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiarDenunciado = (i: number, cambio: Partial<PersonaKarin>) =>
    setDenunciados((l) => l.map((p, j) => (j === i ? { ...p, ...cambio } : p)));

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    const datos = {
      empresa: Number(empresa), tipo, canal, recibida_en: recibida, afectada, relato, pide_derivar_dt: pideDt,
      denunciados, denunciante: porOtra ? denunciante : null, representacion: porOtra ? representacion : '',
    };
    try {
      const { data } = inicial
        ? await client.patch<DenunciaKarinDetalle>(`/karin/denuncias/${inicial.id}/`, datos)
        : await client.post<DenunciaKarinDetalle>('/karin/denuncias/', datos);
      await onGuardada(data);
    } catch (err) {
      setError(mensajeError(err, 'No pudimos guardar la denuncia. Revisa los datos.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setGuardando(false);
    }
  };

  const persona = (p: PersonaKarin, cambiar: (c: Partial<PersonaKarin>) => void, prefijo: string, rutObligatorio: boolean) => (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
      <Texto id={`${prefijo}-nombre`} etiqueta="Nombre completo" valor={p.nombre} onChange={(v) => cambiar({ nombre: v })} />
      <CampoRut etiqueta={rutObligatorio ? 'RUT' : 'RUT (si se conoce)'} valor={p.rut} onChange={(v) => cambiar({ rut: v })} />
      <Texto id={`${prefijo}-cargo`} etiqueta="Cargo" valor={p.cargo} onChange={(v) => cambiar({ cargo: v })} />
      {p.correo !== undefined && rutObligatorio && (
        <Texto id={`${prefijo}-correo`} tipo="email" etiqueta="Correo personal" valor={p.correo ?? ''}
          onChange={(v) => cambiar({ correo: v })} ayuda="Para enviarle las comunicaciones del procedimiento." />
      )}
    </div>
  );

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-5">
      {error && <AlertaError>{error}</AlertaError>}
      <Seccion titulo="La denuncia">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
          {!inicial && catalogos.empresas.length > 1 && (
            <Selector id="dk-empresa" etiqueta="Empresa" valor={empresa} onChange={setEmpresa}
              opciones={catalogos.empresas.map((e) => ({ valor: String(e.id), texto: e.nombre }))} />
          )}
          <Selector id="dk-tipo" etiqueta="Materia" valor={tipo} onChange={setTipo} opciones={catalogos.tipos} />
          <Selector id="dk-canal" etiqueta="Cómo se recibió" valor={canal} onChange={setCanal} opciones={catalogos.canales} />
          <Texto id="dk-recibida" tipo="datetime-local" etiqueta="Fecha y hora de recepción" valor={recibida} onChange={setRecibida} />
        </div>
      </Seccion>
      <Seccion titulo="Persona afectada">
        {persona(afectada, (c) => setAfectada((p) => ({ ...p, ...c })), 'dk-afectada', true)}
        <Casilla marcada={porOtra} onChange={setPorOtra}><span className="text-[15px]">Denuncia otra persona en su nombre</span></Casilla>
        {porOtra && (
          <div className="flex flex-col gap-4 pl-4 border-l-2 border-line">
            <h3 className="text-[15.5px] font-semibold">Quien denuncia</h3>
            {persona(denunciante, (c) => setDenunciante((p) => ({ ...p, ...c })), 'dk-denunciante', true)}
            <Selector id="dk-representacion" etiqueta="En calidad de" valor={representacion} onChange={setRepresentacion}
              opciones={catalogos.representaciones} />
          </div>
        )}
      </Seccion>
      <Seccion titulo="Personas denunciadas">
        {denunciados.map((p, i) => (
          <div key={i} className="flex flex-col gap-3 p-4 rounded-[10px] border border-line">
            <div className="flex items-center justify-between">
              <h3 className="text-[15.5px] font-semibold">Persona denunciada {i + 1}</h3>
              {denunciados.length > 1 && (
                <Button variante="fantasma" tamano="sm" onClick={() => setDenunciados((l) => l.filter((_, j) => j !== i))}
                  iconoInicio={<Trash2 className="size-4" strokeWidth={2} />}>Quitar</Button>
              )}
            </div>
            {persona(p, (c) => cambiarDenunciado(i, c), `dk-denunciado-${i}`, false)}
            <Selector id={`dk-vinculo-${i}`} etiqueta="Vínculo con la persona afectada" valor={p.vinculo ?? ''}
              onChange={(v) => cambiarDenunciado(i, { vinculo: v })} opciones={catalogos.vinculos} />
          </div>
        ))}
        <Button variante="secundario" className="self-start" onClick={() => setDenunciados((l) => [...l, { ...vacia(), vinculo: '' }])}
          iconoInicio={<Plus className="size-4" strokeWidth={2} />}>Agregar otra persona denunciada</Button>
      </Seccion>
      <Seccion titulo="Relación de los hechos">
        <label htmlFor="dk-relato" className="text-[14px] text-fg-2">Qué ocurrió, cuándo y dónde, con las palabras de quien denuncia.</label>
        <textarea id="dk-relato" value={relato} onChange={(e) => setRelato(e.target.value)} className={AREA} rows={8} />
        <Casilla marcada={pideDt} onChange={setPideDt}>
          <span className="text-[15px]">Quien denuncia pide que la investigue la Dirección del Trabajo</span>
        </Casilla>
      </Seccion>
      <Button type="submit" tamano="lg" className="self-start" cargando={guardando}>
        {inicial ? 'Guardar cambios' : 'Registrar denuncia'}
      </Button>
    </form>
  );
}
