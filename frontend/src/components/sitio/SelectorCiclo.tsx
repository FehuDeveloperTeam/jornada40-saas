import { SegmentedControl } from '../j40';
import type { Ciclo } from '../../hooks/usePlanes';

/** Mensual o anual. El anual cuesta 10 meses: se destaca como "2 meses gratis". */
export function SelectorCiclo({ valor, onChange, className }: { valor: Ciclo; onChange: (c: Ciclo) => void; className?: string }) {
  return (
    <SegmentedControl<Ciclo> etiqueta="Ciclo de pago" valor={valor} onChange={onChange} className={className}
      opciones={[
        { valor: 'mensual', etiqueta: 'Mensual' },
        { valor: 'anual', etiqueta: <>Anual <span className="ml-1 text-[11px] font-semibold text-ok">2 meses gratis</span></> },
      ]} />
  );
}
