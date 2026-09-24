import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import client from '../../api/client';
import { AlertaError, Button, CampoRut, Drawer, Field, Input } from '../j40';
import { useAvisosJornada } from '../../hooks/useAvisosJornada';
import type { Empleado } from '../../types';
import { capitalizar } from '../../utils/formato';
import { jornadaMaximaVigente } from '../../utils/ley40';
import { validateRut } from '../../utils/rutUtils';
import { usePanelContexto } from './AppShell';
import { ListaAvisos } from './Avisos';

type TipoContrato = 'INDEFINIDO' | 'PLAZO_FIJO' | 'OBRA_FAENA';

interface Formulario {
  rut: string; nombres: string; apellidoPaterno: string; apellidoMaterno: string; fechaNacimiento: string;
  cargo: string; departamento: string; tipoContrato: TipoContrato; fechaIngreso: string; fechaFin: string;
  horas: string; sueldo: string;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);
const VACIO = (): Formulario => ({
  rut: '', nombres: '', apellidoPaterno: '', apellidoMaterno: '', fechaNacimiento: '',
  cargo: '', departamento: '', tipoContrato: 'INDEFINIDO', fechaIngreso: hoyISO(), fechaFin: '',
  horas: String(jornadaMaximaVigente()), sueldo: '',
});

const SELECT = 'w-full h-10 px-3 rounded-[8px] border border-line-strong bg-surface text-fg text-[14px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft';

function errorServidor(error: unknown, porDefecto: string): string {
  if (!isAxiosError(error)) return porDefecto;
  const d = error.response?.data as Record<string, unknown> | undefined;
  if (!d) return porDefecto;
  if (typeof d.error === 'string') return d.error;
  const primero = Object.values(d).flat().find((v) => typeof v === 'string');
  return (primero as string | undefined) ?? porDefecto;
}

/**
 * Alta de un trabajador: crea la ficha y su contrato en un solo paso.
 * La jornada parte en el máximo vigente y los avisos de jornada se muestran
 * en vivo; como en todo el sistema, avisan pero no impiden guardar.
 */
export function DrawerTrabajador({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { empresa, suscripcion, trabajadores, avisar } = usePanelContexto();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [f, setF] = useState<Formulario>(VACIO);
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const maximo = jornadaMaximaVigente();
  const horas = Number(f.horas) || 0;
  // Parcial: hasta 2/3 del máximo vigente (Art. 40 bis).
  const tipoJornada = horas > 0 && horas <= (maximo * 2) / 3 ? 'PARCIAL' : 'ORDINARIA';
  const { avisos } = useAvisosJornada({ tipo_jornada: tipoJornada, horas_semanales: f.horas, distribucion_horario: {}, sueldo_base: f.sueldo.replace(/\D/g, '') });

  const cambiar = (campo: keyof Formulario) => (e: { target: { value: string } }) =>
    setF((d) => ({ ...d, [campo]: e.target.value }));
  const requiereFin = f.tipoContrato !== 'INDEFINIDO';
  const faltan = {
    rut: !validateRut(f.rut),
    nombres: !f.nombres.trim(),
    apellidoPaterno: !f.apellidoPaterno.trim(),
    cargo: !f.cargo.trim(),
    fechaIngreso: !f.fechaIngreso,
    fechaFin: requiereFin && !f.fechaFin,
    sueldo: !(Number(f.sueldo.replace(/\D/g, '')) > 0),
    horas: !(horas > 0 && horas <= 168),
  };
  const valido = !Object.values(faltan).some(Boolean);
  const departamentos = [...new Set(trabajadores.map((t) => t.departamento).filter(Boolean))] as string[];

  const guardar = async (e?: FormEvent) => {
    e?.preventDefault();
    setIntento(true);
    if (!valido) return;
    setGuardando(true);
    setError('');
    const sueldo = Number(f.sueldo.replace(/\D/g, ''));
    let nuevo: Empleado;
    try {
      nuevo = (await client.post<Empleado>('/empleados/', {
        empresa: empresa.id, rut: f.rut, nombres: f.nombres.trim(), apellido_paterno: f.apellidoPaterno.trim(),
        apellido_materno: f.apellidoMaterno.trim() || null, fecha_nacimiento: f.fechaNacimiento || null,
        cargo: f.cargo.trim(), departamento: f.departamento.trim() || null, fecha_ingreso: f.fechaIngreso,
        sueldo_base: sueldo, horas_laborales: Math.round(horas),
      })).data;
    } catch (err) {
      setError(errorServidor(err, 'No pudimos crear al trabajador. Intenta de nuevo.'));
      setGuardando(false);
      return;
    }
    let mensaje = 'Trabajador creado';
    try {
      await client.post('/contratos/', {
        empleado: nuevo.id, tipo_contrato: f.tipoContrato, cargo: f.cargo.trim(), fecha_inicio: f.fechaIngreso,
        fecha_fin: requiereFin ? f.fechaFin : null, sueldo_base: sueldo, horas_semanales: horas,
        tipo_jornada: tipoJornada,
      });
    } catch (err) {
      // La ficha ya existe: se avisa y se deja completar el contrato en la carpeta.
      mensaje = `Trabajador creado. El contrato no se guardó: ${errorServidor(err, 'revisa sus datos')}`;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['empleados'] }),
      queryClient.invalidateQueries({ queryKey: ['mi_suscripcion'] }),
    ]);
    setGuardando(false);
    onCerrar();
    avisar(mensaje);
    navigate(`/app/trabajadores/${nuevo.id}`);
  };

  const cupos = suscripcion
    ? ` · usarás ${suscripcion.trabajadores_actuales + 1} de ${suscripcion.plan.limite_trabajadores} cupos`
    : '';
  const err = (condicion: boolean, texto: string) => (intento && condicion ? texto : undefined);

  return (
    <Drawer abierto={abierto} onCerrar={onCerrar} titulo="Agregar trabajador"
      subtitulo={`${capitalizar(empresa.nombre_legal)}${cupos}`}
      acciones={<>
        <Button variante="secundario" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button onClick={() => guardar()} cargando={guardando}>{guardando ? 'Creando…' : 'Crear trabajador'}</Button>
      </>}>
      <form onSubmit={guardar} noValidate className="flex flex-col gap-[22px]">
        {error && <AlertaError>{error}</AlertaError>}
        <fieldset className="flex flex-col gap-3.5">
          <legend className="text-[13px] font-semibold mb-3">Identificación</legend>
          <CampoRut etiqueta="RUT" valor={f.rut} onChange={(v) => setF((d) => ({ ...d, rut: v }))} compacto forzarError={intento && faltan.rut} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3.5">
            <Field etiqueta="Nombres" error={err(faltan.nombres, 'Ingresa los nombres.')}>
              {(p) => <Input {...p} value={f.nombres} onChange={cambiar('nombres')} />}
            </Field>
            <Field etiqueta="Apellido paterno" error={err(faltan.apellidoPaterno, 'Ingresa el apellido.')}>
              {(p) => <Input {...p} value={f.apellidoPaterno} onChange={cambiar('apellidoPaterno')} />}
            </Field>
            <Field etiqueta="Apellido materno">
              {(p) => <Input {...p} value={f.apellidoMaterno} onChange={cambiar('apellidoMaterno')} />}
            </Field>
            <Field etiqueta="Fecha de nacimiento">
              {(p) => <Input {...p} type="date" value={f.fechaNacimiento} onChange={cambiar('fechaNacimiento')} />}
            </Field>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3.5">
          <legend className="text-[13px] font-semibold mb-3">Contrato</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3.5">
            <Field etiqueta="Cargo" error={err(faltan.cargo, 'Ingresa el cargo.')}>
              {(p) => <Input {...p} value={f.cargo} onChange={cambiar('cargo')} />}
            </Field>
            <Field etiqueta="Departamento">
              {(p) => <>
                <Input {...p} list="departamentos" value={f.departamento} onChange={cambiar('departamento')} placeholder="Opcional" />
                <datalist id="departamentos">{departamentos.map((d) => <option key={d} value={capitalizar(d)} />)}</datalist>
              </>}
            </Field>
            <Field etiqueta="Tipo de contrato">
              {(p) => (
                <select id={p.id} aria-describedby={p['aria-describedby']} className={SELECT} value={f.tipoContrato} onChange={cambiar('tipoContrato')}>
                  <option value="INDEFINIDO">Indefinido</option>
                  <option value="PLAZO_FIJO">Plazo fijo</option>
                  <option value="OBRA_FAENA">Por obra o faena</option>
                </select>
              )}
            </Field>
            <Field etiqueta="Fecha de ingreso" error={err(faltan.fechaIngreso, 'Ingresa la fecha.')}>
              {(p) => <Input {...p} type="date" value={f.fechaIngreso} onChange={cambiar('fechaIngreso')} />}
            </Field>
            {requiereFin && (
              <Field etiqueta="Fecha de término" error={err(faltan.fechaFin, 'Obligatoria en plazo fijo y obra o faena.')}>
                {(p) => <Input {...p} type="date" value={f.fechaFin} onChange={cambiar('fechaFin')} />}
              </Field>
            )}
            <Field etiqueta="Jornada semanal (horas)" ayuda={`Máximo vigente: ${maximo} h · parcial hasta ${Math.floor((maximo * 2) / 3)} h`}
              error={err(faltan.horas, 'Ingresa las horas semanales.')}>
              {(p) => <Input {...p} type="number" inputMode="decimal" step="0.5" min={1} value={f.horas} onChange={cambiar('horas')} />}
            </Field>
            <Field etiqueta="Sueldo base" error={err(faltan.sueldo, 'Ingresa el sueldo base.')}>
              {(p) => (
                <div className="flex items-center h-10 rounded-[8px] border border-line-strong bg-surface focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft">
                  <span className="pl-3 text-fg-3">$</span>
                  <input id={p.id} aria-describedby={p['aria-describedby']} aria-invalid={p.invalido || undefined} inputMode="numeric" placeholder="553.553"
                    value={f.sueldo ? Number(f.sueldo.replace(/\D/g, '')).toLocaleString('es-CL') : ''}
                    onChange={(e) => setF((d) => ({ ...d, sueldo: e.target.value.replace(/\D/g, '') }))}
                    className="flex-1 min-w-0 h-full px-2 bg-transparent border-0 outline-none text-fg text-[14px] j40-num" />
                </div>
              )}
            </Field>
          </div>
          <ListaAvisos avisos={avisos} />
        </fieldset>
      </form>
    </Drawer>
  );
}
