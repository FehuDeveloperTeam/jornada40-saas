import { ClipboardList } from 'lucide-react';
import { rutaAccion } from '../../../hooks/usePanel';
import { usePermisos } from '../../../hooks/usePermisos';
import type { Empleado } from '../../../types';
import { BotonEnlace } from './comun';

/**
 * Qué falta para que el contrato salga completo (core/ficha.py → faltantes_contrato).
 * El alta rápida pide lo mínimo: este aviso dice qué completar y dónde. No impide nada.
 */
export function FaltantesContrato({ empleado, enEditor = false }: { empleado: Empleado; enEditor?: boolean }) {
  const { puede } = usePermisos();
  // En el editor el horario se completa ahí mismo: solo se avisan los datos personales.
  const faltan = (empleado.faltantes_contrato ?? []).filter((f) => !enEditor || f.pestana === 'personal');
  if (!faltan.length) return null;
  const personales = faltan.filter((f) => f.pestana === 'personal');
  const delContrato = faltan.filter((f) => f.pestana === 'contrato');
  return (
    <section role="status" className="flex flex-col gap-3 rounded-j40-card border border-line bg-warn-soft px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <ClipboardList className="size-5 shrink-0 text-warn mt-0.5" strokeWidth={2} aria-hidden />
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[14.5px] font-semibold text-fg">Completa la ficha para que el contrato salga completo</span>
          <span className="text-[13.5px] text-fg-2">Falta: {faltan.map((f) => f.texto.split(' (')[0].toLowerCase()).join(', ')}.</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {personales.length > 0 && puede('TRABAJADORES', true) && (
          <BotonEnlace a={`/app/trabajadores/${empleado.id}?tab=personal`} primario>Completar datos personales</BotonEnlace>
        )}
        {!enEditor && delContrato.length > 0 && puede('CONTRATOS', true) && (
          <BotonEnlace a={rutaAccion(empleado.id, 'contrato')}>{empleado.contrato_activo ? 'Completar el contrato' : 'Crear contrato'}</BotonEnlace>
        )}
      </div>
    </section>
  );
}
