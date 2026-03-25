import { createContext, useState, useEffect, useCallback, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'theme';

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch { /* ignore */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = getInitialTheme();
    // Apply synchronously during initialisation to avoid flash
    applyTheme(initial);
    return initial;
  });

  // Keep DOM + localStorage in sync whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
