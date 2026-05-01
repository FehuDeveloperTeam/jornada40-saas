import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface Props {
  className?: string;
}

export default function ThemeToggle({ className = '' }: Props) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={`relative p-2 rounded-xl transition-all ${className}`}
      style={{
        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        e.currentTarget.style.color = isDark ? '#fff' : '#0f172a';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.6)' : '#64748b';
      }}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
