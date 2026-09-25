import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Briefcase, CircleCheck, FileSignature, IdCard, Landmark, Mail, Pencil, PenLine } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import client from '../../../api/client';
import { AlertaError, Button, Input, Modal } from '../../j40';
import type { TipoAviso } from '../AppShell';
import { ModalConsentimientoPapel } from '../ModalConsentimientoPapel';
import type { Empleado, ViaConsentimiento } from '../../../types';
import { capitalizar, fechaCL } from '../../../utils/formato';
import { AFPS, mensajeErrorCampos } from './utiles';

type Tipo = 'texto' | 'fecha' | 'select' | 'numero' | 'correo' | 'sino';
type Campo = keyof Empleado;
interface DefCampo {
  campo: Campo; etiqueta: string; tipo?: Tipo; opciones?: [string, string][]; mono?: boolean;
  soloLectura?: boolean; mostrar?: (b: Partial<Empleado>) => boolean; nombre?: boolean;
}
interface DefSeccion { clave: string; titulo: string; Icono: LucideIcon; campos: DefCampo[] }

/**
 * Normaliza para comparar: el backend guarda los textos en mayúsculas al
 * editar (perform_update), pero los valores por defecto o importados pueden
 * venir en otra forma ("Transferencia", "Depósito", "Cuenta Corriente").
 */
const normal = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
const igual = (a: unknown, b: string) => normal(a) === normal(b);
const conCuenta = (b: Partial<Empleado>) => ['TRANSFERENCIA', 'DEPOSITO'].includes(normal(b.forma_pago));

const SECCIONES: DefSeccion[] = [
  { clave: 'id', titulo: 'Identificación', Icono: IdCard, campos: [
    { campo: 'rut', etiqueta: 'RUT', mono: true, soloLectura: true },
    { campo: 'nombres', etiqueta: 'Nombres', nombre: true },
    { campo: 'apellido_paterno', etiqueta: 'Apellido paterno', nombre: true },
    { campo: 'apellido_materno', etiqueta: 'Apellido materno', nombre: true },
    { campo: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'fecha' },
    { campo: 'sexo', etiqueta: 'Sexo', tipo: 'select', opciones: [['', 'Sin especificar'], ['M', 'Masculino'], ['F', 'Femenino'], ['O', 'Otro']] },
    { campo: 'nacionalidad', etiqueta: 'Nacionalidad', nombre: true },
    { campo: 'estado_civil', etiqueta: 'Estado civil', nombre: true },
  ] },
  { clave: 'contacto', titulo: 'Contacto', Icono: Mail, campos: [
    { campo: 'email', etiqueta: 'Correo', tipo: 'correo' },
    { campo: 'numero_telefono', etiqueta: 'Teléfono' },
    { campo: 'direccion', etiqueta: 'Dirección', nombre: true },
    { campo: 'comuna', etiqueta: 'Comuna', nombre: true },
  ] },
  { clave: 'laboral', titulo: 'Datos laborales', Icono: Briefcase, campos: [
    { campo: 'ficha_numero', etiqueta: 'N° de ficha', tipo: 'numero' },
    { campo: 'cargo', etiqueta: 'Cargo', nombre: true },
    { campo: 'departamento', etiqueta: 'Departamento', nombre: true },
    { campo: 'sucursal', etiqueta: 'Sucursal', nombre: true },
    { campo: 'centro_costo', etiqueta: 'Centro de costo', nombre: true },
    { campo: 'modalidad', etiqueta: 'Modalidad', tipo: 'select', opciones: [['PRESENCIAL', 'Presencial'], ['REMOTO', 'Remoto'], ['HIBRIDO', 'Híbrido']] },
    { campo: 'fecha_ingreso', etiqueta: 'Fecha de ingreso', tipo: 'fecha' },
    { campo: 'anios_previos_feriado', etiqueta: 'Años con otros empleadores (feriado progresivo, con certificado, máx. 10)', tipo: 'numero' },
  ] },
  { clave: 'prevision', titulo: 'Previsión y pago', Icono: Landmark, campos: [
    { campo: 'afp', etiqueta: 'AFP', tipo: 'select', opciones: [['', 'Sin AFP'], ...AFPS.map((a): [string, string] => [a, capitalizar(a)])] },
    { campo: 'sistema_salud', etiqueta: 'Salud', tipo: 'select', opciones: [['', 'Sin especificar'], ['FONASA', 'Fonasa'], ['ISAPRE', 'Isapre']] },
    { campo: 'isapre', etiqueta: 'Isapre', tipo: 'select', mostrar: (b) => igual(b.sistema_salud, 'ISAPRE'), opciones: [
      ['', 'Sin especificar'], ['01', 'Banmédica'], ['02', 'Consalud'], ['03', 'Vida Tres'], ['04', 'Colmena'], ['05', 'Cruz Blanca'],
      ['10', 'Nueva Masvida'], ['11', 'Isalud'], ['12', 'Fundación'], ['25', 'Cruz del Norte'], ['28', 'Esencial']] },
    { campo: 'plan_isapre_uf', etiqueta: 'Plan Isapre (UF)', tipo: 'numero', mostrar: (b) => igual(b.sistema_salud, 'ISAPRE') },
    { campo: 'numero_fun', etiqueta: 'N° FUN (contrato Isapre)', mono: true, mostrar: (b) => igual(b.sistema_salud, 'ISAPRE') },
    { campo: 'tramo_asignacion_familiar', etiqueta: 'Tramo asignación familiar', tipo: 'select',
      opciones: [['D', 'Sin derecho'], ['A', 'Primer tramo (A)'], ['B', 'Segundo tramo (B)'], ['C', 'Tercer tramo (C)']] },
    { campo: 'cargas_simples', etiqueta: 'Cargas simples', tipo: 'numero', mostrar: (b) => !igual(b.tramo_asignacion_familiar, 'D') },
    { campo: 'cargas_maternales', etiqueta: 'Cargas maternales', tipo: 'numero', mostrar: (b) => !igual(b.tramo_asignacion_familiar, 'D') },
    { campo: 'cargas_invalidas', etiqueta: 'Cargas por invalidez', tipo: 'numero', mostrar: (b) => !igual(b.tramo_asignacion_familiar, 'D') },
    // Sin opción vacía: el modelo no admite forma de pago nula (por defecto "Transferencia").
    // Se informan al registrar el contrato en Mi DT.
    { campo: 'discapacidad', etiqueta: 'Discapacidad certificada (COMPIN)', tipo: 'sino' },
    { campo: 'pension_invalidez', etiqueta: 'Pensión de invalidez', tipo: 'sino' },
    { campo: 'forma_pago', etiqueta: 'Forma de pago', tipo: 'select', opciones: [['TRANSFERENCIA', 'Transferencia'], ['DEPOSITO', 'Depósito'], ['CHEQUE', 'Cheque'], ['EFECTIVO', 'Efectivo']] },
    { campo: 'banco', etiqueta: 'Banco', mostrar: conCuenta },
    // El backend guarda los textos en mayúsculas: los valores van igual.
    { campo: 'tipo_cuenta', etiqueta: 'Tipo de cuenta', tipo: 'select', mostrar: conCuenta,
      opciones: [['', 'Sin especificar'], ['CUENTA CORRIENTE', 'Cuenta corriente'], ['CUENTA VISTA / RUT', 'Cuenta vista / RUT'], ['CUENTA DE AHORRO', 'Cuenta de ahorro']] },
    { campo: 'numero_cuenta', etiqueta: 'Número de cuenta', mono: true, mostrar: conCuenta },
  ] },
];

// Etiquetas de los campos para los errores del backend (400 por campo).
const ETIQUETAS: Record<string, string> = Object.fromEntries(
  SECCIONES.flatMap((s) => s.campos.map((c) => [String(c.campo), c.etiqueta.replace(/ \([^)]*,[^)]*\)$/, '')])),
);

// Campos que el backend guarda sin null: vacío es '' (texto) o 0 (cantidad).
const VACIO_NO_NULO: Partial<Record<Campo, string | number>> = {
  isapre: '', numero_fun: '', cargas_simples: 0, cargas_maternales: 0, cargas_invalidas: 0, anios_previos_feriado: 0,
};

const CONTROL = 'w-full h-10 px-3 rounded-[8px] border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';

function valorVisible(d: DefCampo, valor: unknown): string {
  if (d.tipo === 'sino') return valor ? 'Sí' : 'No';
  if (valor === null || valor === undefined || valor === '') return '—';
  if (d.tipo === 'fecha') return fechaCL(String(valor));
  if (d.tipo === 'select') return d.opciones?.find(([v]) => igual(valor, v))?.[1] ?? capitalizar(String(valor));
  if (d.tipo === 'correo') return String(valor).toLowerCase();
  if (d.nombre) return capitalizar(String(valor));
  return String(valor);
}

type Avisar = (t: string, tipo?: TipoAviso) => void;

export function DatosPersonales({ empleado, avisar }: { empleado: Empleado; avisar: Avisar }) {
  return (
    <div className="flex flex-col gap-5">
      {SECCIONES.map((s) => <SeccionEditable key={s.clave} seccion={s} empleado={empleado} avisar={avisar} />)}
      <DocumentosElectronicos empleado={empleado} avisar={avisar} />
    </div>
  );
}

const VIA_CONSENTIMIENTO: Record<Exclude<ViaConsentimiento, ''>, string> = {
  CONTRATO: 'cláusula del contrato', ANEXO: 'anexo firmado', PAPEL: 'firmado en papel',
};

/** Autorización para la documentación laboral electrónica (Dictamen 0789/15). */
function DocumentosElectronicos({ empleado, avisar }: { empleado: Empleado; avisar: Avisar }) {
  const queryClient = useQueryClient();
  const [papel, setPapel] = useState(false);
  const [revocar, setRevocar] = useState(false);
  const [revocando, setRevocando] = useState(false);
  const autorizado = Boolean(empleado.consentimiento_electronico_en);
  const via = empleado.consentimiento_electronico_via;
  // La fecha llega como datetime ISO: se muestra el día en Chile.
  const fecha = empleado.consentimiento_electronico_en
    ? new Date(empleado.consentimiento_electronico_en).toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
    : null;

  const refrescar = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['empleados'] }),
    queryClient.invalidateQueries({ queryKey: ['registro-dt'] }),
  ]);

  const confirmarRevocar = async () => {
    setRevocando(true);
    try {
      await client.post(`/empleados/${empleado.id}/consentimiento/`, { revocar: true });
      await refrescar();
      avisar('Autorización revocada');
      setRevocar(false);
    } catch (err) {
      avisar((isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || 'No pudimos revocar la autorización.', 'error');
    } finally {
      setRevocando(false);
    }
  };

  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card">
      <div className="flex items-center gap-2.5 px-[18px] py-3 min-h-14 border-b border-line">
        <FileSignature className="size-5 text-fg-3" strokeWidth={2} aria-hidden />
        <h3 className="text-[14px] font-semibold flex-1">Documentos electrónicos</h3>
      </div>
      <div className="flex flex-wrap items-center gap-3 p-[18px]">
        {autorizado ? (
          <p className="flex-1 min-w-[220px] flex items-start gap-2 text-[13.5px]">
            <CircleCheck className="size-[18px] shrink-0 mt-0.5 text-ok" strokeWidth={2} aria-hidden />
            <span>
              Autorizó documentos electrónicos el {fechaCL(fecha)}
              {via ? ` (${VIA_CONSENTIMIENTO[via]})` : ''}.
            </span>
          </p>
        ) : (
          <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
            <span className="text-[13.5px] font-medium text-warn">Sin autorización para documentos electrónicos</span>
            <span className="text-[12.5px] text-fg-3">
              La DT exige su autorización expresa para firmar y enviarle documentos en forma electrónica.{' '}
              <Link to="/app/dt">Enviarle el anexo</Link>
            </span>
          </div>
        )}
        {autorizado ? (
          <Button variante="peligro-contorno" tamano="sm" onClick={() => setRevocar(true)}>Revocar</Button>
        ) : (
          <Button variante="secundario" tamano="sm" onClick={() => setPapel(true)}
            iconoInicio={<PenLine className="size-4" strokeWidth={2} />}>Registrar firmado en papel</Button>
        )}
      </div>

      <ModalConsentimientoPapel empleado={papel ? { id: empleado.id, nombre: `${empleado.nombres} ${empleado.apellido_paterno}` } : null}
        onCerrar={() => setPapel(false)} avisar={avisar} refrescar={refrescar} />

      <Modal abierto={revocar} onCerrar={() => !revocando && setRevocar(false)} titulo="Revocar la autorización"
        acciones={<>
          <Button variante="secundario" onClick={() => setRevocar(false)} disabled={revocando}>Cancelar</Button>
          <Button variante="peligro" cargando={revocando} onClick={confirmarRevocar}>Revocar</Button>
        </>}>
        <p className="text-[13.5px] text-fg-2">
          Úsalo si el trabajador revocó por escrito su autorización. Desde ahora sus documentos deberán firmarse y entregarse en papel,
          hasta que vuelva a autorizar.
        </p>
      </Modal>
    </section>
  );
}

function SeccionEditable({ seccion, empleado, avisar }: { seccion: DefSeccion; empleado: Empleado; avisar: Avisar }) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Partial<Empleado>>({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const { Icono } = seccion;

  const empezar = () => {
    // Los select parten en la opción equivalente aunque venga en otra forma
    // ("Transferencia" → TRANSFERENCIA): si no, el control mostraba otra opción.
    setBorrador(Object.fromEntries(seccion.campos.map((c) => {
      const valor = empleado[c.campo] ?? '';
      const opcion = c.tipo === 'select' ? c.opciones?.find(([v]) => igual(valor, v)) : undefined;
      return [c.campo, opcion ? opcion[0] : valor];
    })) as Partial<Empleado>);
    setError('');
    setEditando(true);
  };

  const guardar = async () => {
    setGuardando(true);
    setError('');
    const datos = Object.fromEntries(seccion.campos.filter((c) => !c.soloLectura)
      .map((c) => [c.campo, borrador[c.campo] === '' ? (VACIO_NO_NULO[c.campo] ?? null) : borrador[c.campo]]));
    try {
      await client.patch(`/empleados/${empleado.id}/`, datos);
      await queryClient.invalidateQueries({ queryKey: ['empleados'] });
      // El saldo de feriado depende del ingreso y de los años con otros empleadores.
      if (seccion.campos.some((c) => c.campo === 'fecha_ingreso' || c.campo === 'anios_previos_feriado')) {
        await queryClient.invalidateQueries({ queryKey: ['saldo-vacaciones', empleado.id] });
      }
      setEditando(false);
      avisar(`${seccion.titulo}: cambios guardados`);
    } catch (err) {
      setError(mensajeErrorCampos(isAxiosError(err) ? err.response?.data : undefined, ETIQUETAS, 'No pudimos guardar los cambios.'));
    } finally {
      setGuardando(false);
    }
  };

  const fuente = editando ? { ...empleado, ...borrador } : empleado;
  const campos = seccion.campos.filter((c) => !c.mostrar || c.mostrar(fuente));

  return (
    <section className="bg-surface border border-line rounded-j40-card shadow-card">
      <div className="flex items-center gap-2.5 px-[18px] py-3 min-h-14 border-b border-line">
        <Icono className="size-5 text-fg-3" strokeWidth={2} aria-hidden />
        <h3 className="text-[14px] font-semibold flex-1">{seccion.titulo}</h3>
        {editando ? (
          <>
            <Button variante="secundario" tamano="sm" onClick={() => setEditando(false)} disabled={guardando}>Cancelar</Button>
            <Button tamano="sm" onClick={guardar} cargando={guardando}>Guardar</Button>
          </>
        ) : (
          <Button variante="secundario" tamano="sm" onClick={empezar} iconoInicio={<Pencil className="size-4" strokeWidth={2} />}>Editar</Button>
        )}
      </div>
      {error && <div className="px-[18px] pt-4"><AlertaError>{error}</AlertaError></div>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] gap-x-6 gap-y-[18px] p-[18px]">
        {campos.map((c) => {
          const id = `${seccion.clave}-${String(c.campo)}`;
          const valor = fuente[c.campo];
          return (
            <div key={String(c.campo)} className="flex flex-col gap-[5px] min-w-0">
              <label htmlFor={id} className="text-[12px] text-fg-3">{c.etiqueta}</label>
              {!editando || c.soloLectura ? (
                <span id={id} className={c.mono ? 'text-[14px] font-medium min-h-[22px] break-words j40-mono' : 'text-[14px] font-medium min-h-[22px] break-words'}>
                  {valorVisible(c, valor)}
                </span>
              ) : c.tipo === 'sino' ? (
                <select id={id} className={CONTROL} value={valor ? 'si' : 'no'}
                  onChange={(e) => setBorrador((b) => ({ ...b, [c.campo]: e.target.value === 'si' }))}>
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              ) : c.tipo === 'select' ? (
                <select id={id} className={CONTROL} value={String(valor ?? '')}
                  onChange={(e) => setBorrador((b) => ({ ...b, [c.campo]: e.target.value }))}>
                  {c.opciones!.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  {/* Un valor guardado que no está entre las opciones se conserva tal cual. */}
                  {!c.opciones!.some(([v]) => v === String(valor ?? '')) && <option value={String(valor ?? '')}>{capitalizar(String(valor ?? '')) || 'Sin especificar'}</option>}
                </select>
              ) : (
                <Input id={id} mono={c.mono} value={String(valor ?? '')}
                  type={c.tipo === 'fecha' ? 'date' : c.tipo === 'numero' ? 'number' : c.tipo === 'correo' ? 'email' : 'text'}
                  step={c.tipo === 'numero' ? '0.01' : undefined}
                  onChange={(e) => setBorrador((b) => ({ ...b, [c.campo]: e.target.value }))} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
