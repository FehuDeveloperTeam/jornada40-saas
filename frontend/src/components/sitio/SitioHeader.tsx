import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button, Logo, ToggleTema } from '../j40';

const ENLACES = [
  { ancla: '#producto', texto: 'Producto' },
  { ancla: '#ley', texto: 'Ley 40 horas' },
  { ancla: '#seguridad', texto: 'Seguridad' },
  { ancla: '#precios', texto: 'Precios' },
];

/**
 * Barra superior del sitio. Fija, con fondo translúcido y desenfoque.
 * Desde 1000 px muestra los enlaces; bajo eso, un menú desplegable.
 * Los botones de sesión se ocultan en móvil y pasan al menú.
 */
export function SitioHeader() {
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Esc cierra el menú, como el resto de los desplegables del handoff.
  useEffect(() => {
    if (!menuAbierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAbierto(false);
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [menuAbierto]);

  return (
    <header className="sticky top-0 z-30 bg-canvas-blur backdrop-blur-md border-b border-line">
      <div className="max-w-[1200px] mx-auto h-16 px-[clamp(16px,3vw,32px)] flex items-center gap-4">
        <Link to="/" aria-label="Jornada40, inicio" className="no-underline hover:no-underline">
          <Logo />
        </Link>

        <nav aria-label="Secciones" className="hidden min-[1000px]:flex gap-1 ml-5">
          {ENLACES.map((e) => (
            <a key={e.ancla} href={e.ancla}
              className="px-3 py-2 rounded-[8px] text-fg-2 text-[13.5px] font-medium whitespace-nowrap no-underline hover:no-underline hover:text-fg hover:bg-sunken">
              {e.texto}
            </a>
          ))}
        </nav>

        <div className="flex-1" />
        <ToggleTema />

        <div className="hidden min-[760px]:flex items-center gap-1">
          <Button variante="fantasma" onClick={() => navigate('/login')} className="h-[38px] text-[13.5px] text-fg">
            Iniciar sesión
          </Button>
          <Button onClick={() => navigate('/register')} className="h-[38px] text-[13.5px]">
            Crear cuenta
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
          aria-controls="menu-sitio"
          className="min-[1000px]:hidden grid place-items-center size-[38px] rounded-j40-control border border-line bg-surface text-fg cursor-pointer"
        >
          {menuAbierto ? <X className="size-[22px]" strokeWidth={2} /> : <Menu className="size-[22px]" strokeWidth={2} />}
        </button>
      </div>

      {menuAbierto && (
        <div id="menu-sitio" className="min-[1000px]:hidden flex flex-col gap-0.5 px-4 pt-2 pb-4 border-t border-line bg-surface">
          {ENLACES.map((e) => (
            <a key={e.ancla} href={e.ancla} onClick={() => setMenuAbierto(false)}
              className="px-1 py-3 text-fg text-[15px] font-medium no-underline hover:no-underline">
              {e.texto}
            </a>
          ))}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button variante="secundario" onClick={() => navigate('/login')} className="h-11 rounded-[10px] text-[14px]">
              Iniciar sesión
            </Button>
            <Button onClick={() => navigate('/register')} className="h-11 rounded-[10px] text-[14px]">
              Crear cuenta
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
