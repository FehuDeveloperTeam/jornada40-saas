import { cn } from '../../utils/cn';
import logo from '../../assets/logo-j40.png';

interface LogoProps {
  /** Lado del isotipo en px. El sitio usa 36; el sidebar del panel, 32. */
  tamano?: number;
  /** Oculta el nombre y deja solo el isotipo (sidebar colapsado). */
  soloIcono?: boolean;
  className?: string;
}

/** Isotipo + "Jornada40", con el 40 en color de marca. */
export function Logo({ tamano = 36, soloIcono = false, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-fg', className)}>
      <img
        src={logo}
        alt={soloIcono ? 'Jornada40' : ''}
        width={tamano}
        height={tamano}
        className="rounded-[9px] bg-white border border-line object-contain p-[3px]"
      />
      {!soloIcono && (
        <span className="text-[17px] font-semibold tracking-[-0.01em]">
          Jornada<span className="text-brand">40</span>
        </span>
      )}
    </span>
  );
}
