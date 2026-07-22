import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface Props {
  className?: string;
}

export default function ThemeToggle({ className = '' }: Props) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={`relative p-2 rounded-xl transition-all ${className}`}
      style={{
        background: 'var(--c-bg-input)',
        border: '1px solid var(--c-border-2)',
        color: 'var(--c-text-2)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--c-bg-input-focus)';
        e.currentTarget.style.color = 'var(--c-text-1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--c-bg-input)';
        e.currentTarget.style.color = 'var(--c-text-2)';
      }}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
