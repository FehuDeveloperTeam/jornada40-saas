import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Briefcase, IdCard, Landmark, Mail, Pencil } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import client from '../../../api/client';
import { AlertaError, Button, Input } from '../../j40';
import type { Empleado } from '../../../types';
import { capitalizar, fechaCL } from '../../../utils/formato';
import { AFPS } from './utiles';

type Tipo = 'texto' | 'fecha' | 'select' | 'numero' | 'correo';
type Campo = keyof Empleado;
interface DefCampo {
  campo: Campo; etiqueta: string; tipo?: Tipo; opciones?: [string, string][]; mono?: boolean;
  soloLectura?: boolean; mostrar?: (b: Partial<Empleado>) => boolean; nombre?: boolean;
}
interface DefSeccion { clave: string; titulo: string; Icono: LucideIcon; campos: DefCampo[] }

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
    { campo: 'sistema_salud', etiqueta: 'Salud', tipo: 'select', opciones: [['FONASA', 'Fonasa'], ['ISAPRE', 'Isapre']] },
    { campo: 'isapre', etiqueta: 'Isapre', tipo: 'select', mostrar: (b) => b.sistema_salud === 'ISAPRE', opciones: [
      ['', 'Sin especificar'], ['01', 'Banmédica'], ['02', 'Consalud'], ['03', 'Vida Tres'], ['04', 'Colmena'], ['05', 'Cruz Blanca'],
      ['10', 'Nueva Masvida'], ['11', 'Isalud'], ['12', 'Fundación'], ['25', 'Cruz del Norte'], ['28', 'Esencial']] },
    { campo: 'plan_isapre_uf', etiqueta: 'Plan Isapre (UF)', tipo: 'numero', mostrar: (b) => b.sistema_salud === 'ISAPRE' },
    { campo: 'numero_fun', etiqueta: 'N° FUN (contrato Isapre)', mono: true, mostrar: (b) => b.sistema_salud === 'ISAPRE' },
    { campo: 'tramo_asignacion_familiar', etiqueta: 'Tramo asignación familiar', tipo: 'select',
      opciones: [['D', 'Sin derecho'], ['A', 'Primer tramo (A)'], ['B', 'Segundo tramo (B)'], ['C', 'Tercer tramo (C)']] },
    { campo: 'cargas_simples', etiqueta: 'Cargas simples', tipo: 'numero', mostrar: (b) => b.tramo_asignacion_familiar !== 'D' },
    { campo: 'cargas_maternales', etiqueta: 'Cargas maternales', tipo: 'numero', mostrar: (b) => b.tramo_asignacion_familiar !== 'D' },
    { campo: 'cargas_invalidas', etiqueta: 'Cargas por invalidez', tipo: 'numero', mostrar: (b) => b.tramo_asignacion_familiar !== 'D' },
    { campo: 'forma_pago', etiqueta: 'Forma de pago', tipo: 'select', opciones: [['TRANSFERENCIA', 'Transferencia'], ['DEPOSITO', 'Depósito'], ['CHEQUE', 'Cheque'], ['EFECTIVO', 'Efectivo']] },
    { campo: 'banco', etiqueta: 'Banco', mostrar: (b) => ['TRANSFERENCIA', 'DEPOSITO'].includes(String(b.forma_pago)) },
    { campo: 'tipo_cuenta', etiqueta: 'Tipo de cuenta', tipo: 'select', mostrar: (b) => ['TRANSFERENCIA', 'DEPOSITO'].includes(String(b.forma_pago)),
      opciones: [['', 'Sin especificar'], ['Cuenta Corriente', 'Cuenta corriente'], ['Cuenta Vista / RUT', 'Cuenta vista / RUT'], ['Cuenta de Ahorro', 'Cuenta de ahorro']] },
    { campo: 'numero_cuenta', etiqueta: 'Número de cuenta', mono: true, mostrar: (b) => ['TRANSFERENCIA', 'DEPOSITO'].includes(String(b.forma_pago)) },
  ] },
];

// Campos que el backend guarda sin null: vacío es '' (texto) o 0 (cantidad).
const VACIO_NO_NULO: Partial<Record<Campo, string | number>> = {
  isapre: '', numero_fun: '', cargas_simples: 0, cargas_maternales: 0, cargas_invalidas: 0, anios_previos_feriado: 0,
};

const CONTROL = 'w-full h-10 px-3 rounded-[8px] border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';

function valorVisible(d: DefCampo, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (d.tipo === 'fecha') return fechaCL(String(valor));
  if (d.tipo === 'select') return d.opciones?.find(([v]) => v === valor)?.[1] ?? String(valor);
  if (d.tipo === 'correo') return String(valor).toLowerCase();
  if (d.nombre) return capitalizar(String(valor));
  return String(valor);
}

export function DatosPersonales({ empleado, avisar }: { empleado: Empleado; avisar: (t: string) => void }) {
  return (
    <div className="flex flex-col gap-5">
      {SECCIONES.map((s) => <SeccionEditable key={s.clave} seccion={s} empleado={empleado} avisar={avisar} />)}
    </div>
  );
}

function SeccionEditable({ seccion, empleado, avisar }: { seccion: DefSeccion; empleado: Empleado; avisar: (t: string) => void }) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Partial<Empleado>>({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const { Icono } = seccion;

  const empezar = () => {
    setBorrador(Object.fromEntries(seccion.campos.map((c) => [c.campo, empleado[c.campo] ?? ''])) as Partial<Empleado>);
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
      setEditando(false);
      avisar(`${seccion.titulo}: cambios guardados`);
    } catch (err) {
      const d = isAxiosError(err) ? (err.response?.data as Record<string, unknown> | undefined) : undefined;
      const msj = d && (typeof d.error === 'string' ? d.error : Object.entries(d).map(([k, v]) => `${k}: ${[v].flat().join(' ')}`).join(' · '));
      setError(msj || 'No pudimos guardar los cambios.');
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
              ) : c.tipo === 'select' ? (
                <select id={id} className={CONTROL} value={String(valor ?? '')}
                  onChange={(e) => setBorrador((b) => ({ ...b, [c.campo]: e.target.value }))}>
                  {c.opciones!.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
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
