import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge solo conoce la escala por defecto de Tailwind. Sin esto no
// sabe que `rounded-j40-control` es un radio y deja pasar juntas
// `rounded-j40-control rounded-[8px]`: gana la que aparezca después en la hoja
// de estilos, no la que se escribió después, y el ajuste se pierde sin aviso.
// Los nombres salen de @theme en src/styles/j40.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['j40-card', 'j40-modal', 'j40-control', 'j40-avatar'],
      shadow: ['card', 'pop', 'pop-lg'],
      color: [
        'canvas', 'canvas-blur', 'surface', 'surface-2', 'sunken',
        'line', 'line-strong',
        'fg', 'fg-2', 'fg-3',
        'brand', 'brand-btn', 'brand-soft', 'brand-text',
        'navy', 'ink', 'paper', 'tinta',
        'ok', 'ok-soft', 'warn', 'warn-soft', 'danger', 'danger-soft',
        'overlay',
      ],
    },
  },
});

/** Compone clases condicionales y resuelve los conflictos de Tailwind:
 *  `cn('h-10', grande && 'h-12')` deja solo `h-12`. */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
