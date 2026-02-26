import { useContext } from 'react';
import { ThemeContext } from '@/context/ThemeContext';

/**
 * Convenience hook — consumes ThemeContext.
 * Use this anywhere you need to read or change the app theme.
 *
 * Returns { theme, setTheme, toggleTheme }
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
