import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../utils/cn';

/**
 * Raíz de toda pantalla con el diseño nuevo.
 *
 * Aplica el tema como `data-j40` en su propio nodo y no en <html>: así las
 * rutas que todavía usan el diseño anterior no reciben los tokens nuevos.
 * La preferencia de tema es una sola para toda la app (ThemeContext).
 */
export function J40Root({ children, className }: { children: ReactNode; className?: string }) {
  const { theme } = useTheme();
  const tema = theme === 'dark' ? 'oscuro' : 'claro';

  // El fondo del body se ve al hacer overscroll en móvil y en los bordes
  // del scroll elástico: tiene que coincidir con el del tema nuevo.
  useEffect(() => {
    const anterior = document.body.style.backgroundColor;
    document.body.style.backgroundColor = tema === 'oscuro' ? '#0D1218' : '#F4F5F7';
    return () => {
      document.body.style.backgroundColor = anterior;
    };
  }, [tema]);

  return (
    <div
      data-j40={tema}
      className={cn(
        'min-h-screen bg-canvas text-fg font-sans text-[14px] leading-[1.5] antialiased',
        className,
      )}
    >
      {children}
    </div>
  );
}
