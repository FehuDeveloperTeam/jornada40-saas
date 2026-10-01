import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, PenLine, Scale } from 'lucide-react';
import { AlertaError, Button, CampoCodigo, Modal } from '../../components/j40';
import { usePortal } from '../../components/trabajador/PortalShell';
import { EstadoLista, Seccion } from '../../components/trabajador/comun';
import { ListaLiquidaciones } from '../../components/trabajador/ListaLiquidaciones';
import { esperaDeCodigo, mensajeError, portal } from '../../api/portal';
import { useFirmasPortal, useLiquidacionesPortal } from '../../hooks/usePortal';
import type { EmpleoPorVincular } from '../../types';

const ESPERA_REENVIO = 60;

const fechaHoraCL = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Inicio() {
  const { cuenta, variasEmpresas } = usePortal();
  const firmas = useFirmasPortal();
  const liquidaciones = useLiquidacionesPortal();
  const primerNombre = cuenta.nombre.split(' ')[0];
  const ultimas = (liquidaciones.data ?? []).slice(0, 3);
  const navigate = useNavigate();
  const [iniciando, setIniciando] = useState<number | null>(null);
  const [errorFirma, setErrorFirma] = useState('');
  // Liquidación de un mes cerrado: se crea la solicitud y se entra al flujo de firma.
  const firmarLiquidacion = async (id: number) => {
    setIniciando(id);
    setErrorFirma('');
    try {
      navigate(`${(await portal.firmar(id)).enlace}?desde=portal`);
    } catch (err) {
      setErrorFirma(mensajeError(err, 'No pudimos iniciar la firma. Intenta de nuevo en unos minutos.'));
      setIniciando(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[clamp(22px,2.8vw,28px)] font-semibold tracking-[-0.02em]">{primerNombre ? `Hola, ${primerNombre}` : 'Hola'}</h1>
        <p className="text-[13.5px] text-fg-2">
          {cuenta.empleos.length === 0
            ? 'Aún no hay documentos disponibles para tu RUT.'
            : cuenta.empleos.length === 1
              ? `${cuenta.empleos[0].cargo ? `${cuenta.empleos[0].cargo} en ` : ''}${cuenta.empleos[0].empresa}`
              : `Tus documentos de ${cuenta.empleos.length} empresas`}
        </p>
      </div>
      <Link to="/trabajador/portal/ley-karin"
        className="flex items-center gap-3 px-4 py-3.5 rounded-j40-card border border-line bg-surface text-fg no-underline hover:no-underline hover:border-brand">
        <Scale className="size-6 text-brand shrink-0" strokeWidth={2} aria-hidden />
        <span className="flex-1 text-[15px]">
          {cuenta.tiene_karin
            ? <><b>Ley Karin:</b> tienes información sobre una denuncia en la que participas.</>
            : <><b>Ley Karin:</b> si sufres acoso o violencia en el trabajo, puedes denunciarlo aquí de forma reservada.</>}
        </span>
        <span className="text-[14px] font-medium text-brand-text">{cuenta.tiene_karin ? 'Ver' : 'Ir'}</span>
      </Link>

      {(firmas.data?.length ?? 0) > 0 && (
        <Seccion titulo="Documentos por firmar" subtitulo="Fírmalos para tenerlos disponibles en Liquidaciones y Documentos.">
          {errorFirma && <div className="px-[18px] pt-3"><AlertaError>{errorFirma}</AlertaError></div>}
          <ul className="flex flex-col">
            {firmas.data!.map((f) => (
              <li key={`${f.tipo}-${f.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-[18px] py-3 border-b border-line last:border-b-0">
                <span className="flex-1 min-w-[180px] flex flex-col">
                  <span className="text-[13.5px] font-medium">{f.documento}</span>
                  <span className="text-[12px] text-fg-3">
                    {variasEmpresas ? `${f.empresa} · ` : ''}{f.vence ? `Vence el ${fechaHoraCL(f.vence)}` : 'Pendiente de tu firma'}
                  </span>
                </span>
                {f.enlace ? (
                  <Link to={`${f.enlace}?desde=portal`}
                    className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-[8px] border bg-brand-btn border-brand-btn text-white text-[13px] font-medium no-underline hover:no-underline hover:brightness-110">
                    <PenLine className="size-4" strokeWidth={2} aria-hidden />Firmar
                  </Link>
                ) : (
                  <Button tamano="sm" cargando={iniciando === f.id} disabled={iniciando !== null && iniciando !== f.id}
                    onClick={() => void firmarLiquidacion(f.id)} iconoInicio={<PenLine className="size-4" strokeWidth={2} />}>
                    Firmar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      <Seccion titulo="Últimas liquidaciones"
        accion={(liquidaciones.data?.length ?? 0) > 3 ? (
          <Link to="/trabajador/portal/liquidaciones" className="inline-flex items-center gap-1 text-brand-text text-[12.5px] font-medium">
            Ver todas<ChevronRight className="size-4" strokeWidth={2} aria-hidden />
          </Link>
        ) : undefined}>
        <EstadoLista cargando={liquidaciones.isLoading} error={liquidaciones.isError} vacia={!ultimas.length}
          textoVacio="Aún no tienes liquidaciones firmadas." />
        {ultimas.length > 0 && <ListaLiquidaciones liquidaciones={ultimas} variasEmpresas={variasEmpresas} />}
      </Seccion>

      {cuenta.por_vincular.length > 0 && <OtrosEmpleos pendientes={cuenta.por_vincular} />}
    </>
  );
}

function OtrosEmpleos({ pendientes }: { pendientes: EmpleoPorVincular[] }) {
  const { avisar } = usePortal();
  const [pidiendo, setPidiendo] = useState<number | null>(null);
  const [vinculando, setVinculando] = useState<{ empleo: EmpleoPorVincular; destino: string } | null>(null);

  const verificar = async (empleo: EmpleoPorVincular) => {
    setPidiendo(empleo.id);
    try {
      const { destino } = await portal.vincularEmpleo(empleo.id);
      setVinculando({ empleo, destino });
    } catch (err) {
      // Pidió otro código hace menos de un minuto: el que llegó sirve.
      if (esperaDeCodigo(err)) setVinculando({ empleo, destino: empleo.correo });
      else avisar(mensajeError(err, 'No pudimos enviar el código. Intenta de nuevo en un momento.'), 'error');
    } finally {
      setPidiendo(null);
    }
  };

  return (
    <Seccion titulo="Otros empleos" subtitulo="Tu RUT aparece en otras empresas que usan Jornada40. Verifica tu correo para ver también esos documentos.">
      <ul className="flex flex-col">
        {pendientes.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-[18px] py-3 border-b border-line last:border-b-0">
            <Building2 className="size-5 text-fg-3 shrink-0" strokeWidth={2} aria-hidden />
            <span className="flex-1 min-w-[160px] flex flex-col">
              <span className="text-[13.5px] font-medium">{e.empresa}</span>
              <span className="text-[12px] text-fg-3 break-all">Código al correo {e.correo}</span>
            </span>
            <Button variante="secundario" tamano="sm" cargando={pidiendo === e.id} onClick={() => verificar(e)}
              aria-label={`Verificar empleo en ${e.empresa}`}>Verificar</Button>
          </li>
        ))}
      </ul>
      {vinculando && <ModalVincular empleo={vinculando.empleo} destino={vinculando.destino} onCerrar={() => setVinculando(null)} />}
    </Seccion>
  );
}

function ModalVincular({ empleo, destino, onCerrar }: { empleo: EmpleoPorVincular; destino: string; onCerrar: () => void }) {
  const { avisar, actualizarCuenta } = usePortal();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [espera, setEspera] = useState(ESPERA_REENVIO);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const t = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [espera]);

  const confirmar = async (valor: string) => {
    setVerificando(true);
    setError('');
    try {
      const cuenta = await portal.confirmarEmpleo(valor);
      actualizarCuenta(cuenta);
      avisar(`Listo: ya ves tus documentos de ${empleo.empresa}.`);
      onCerrar();
    } catch (err) {
      setError(mensajeError(err, 'No pudimos verificar el código.'));
      setCodigo('');
      setVerificando(false);
      window.setTimeout(() => campo.current?.focus(), 0);
    }
  };

  const reenviar = async () => {
    setError('');
    try {
      await portal.vincularEmpleo(empleo.id);
      setEspera(ESPERA_REENVIO);
    } catch (err) {
      setError(mensajeError(err, 'No pudimos reenviar el código.'));
    }
  };

  return (
    <Modal abierto onCerrar={() => !verificando && onCerrar()} titulo={`Verificar empleo en ${empleo.empresa}`}
      subtitulo={`Enviamos un código de 6 dígitos a ${destino}. Vale por 10 minutos.`}>
      <div className="flex flex-col gap-4">
        {error && <AlertaError>{error}</AlertaError>}
        <CampoCodigo ref={campo} autoFocus valor={codigo} onChange={setCodigo} onCompleto={(v) => void confirmar(v)} deshabilitado={verificando} />
        {verificando && <p className="text-[13px] text-fg-3" role="status">Verificando…</p>}
        <div className="flex justify-end text-[13px]">
          {espera > 0
            ? <span className="text-fg-3 j40-num">Reenviar en {espera} s</span>
            : <button type="button" onClick={reenviar} className="font-medium text-brand-text cursor-pointer">Reenviar código</button>}
        </div>
      </div>
    </Modal>
  );
}
