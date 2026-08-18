import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

/**
 * Cycles:  light → dark → system → light …
 * Drop anywhere — sidebar footer, top bar, settings panel.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycle = () => {
    const next: Record<string, 'light' | 'dark' | 'system'> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    setTheme(next[theme]);
  };

  const icon =
    theme === 'system' ? (
      <Monitor className="h-4 w-4" />
    ) : resolvedTheme === 'dark' ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Sun className="h-4 w-4" />
    );

  const label =
    theme === 'system'
      ? 'System theme'
      : resolvedTheme === 'dark'
        ? 'Dark mode'
        : 'Light mode';

  return (
    <button
      type="button"
      onClick={cycle}
      className={`inline-flex items-center justify-center rounded-md p-1.5
        transition-colors focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-ring ${className}`}
      style={{
        color: resolvedTheme === 'dark' ? '#818cf8' : '#f59e0b',
      }}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}