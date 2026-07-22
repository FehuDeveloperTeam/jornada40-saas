import { useContext } from 'react';
import { ThemeContext } from '../context/theme-context';
import type { ThemeContextValue } from '../context/theme-context';

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}