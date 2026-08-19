import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { ReactNode } from 'react';

const options: {
  value: 'light' | 'dark' | 'system';
  label: string;
  icon: ReactNode;
  desc: string;
}[] = [
  {
    value: 'light',
    label: 'Light',
    icon: <Sun className="h-5 w-5" />,
    desc: 'Classic bright interface',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <Moon className="h-5 w-5" />,
    desc: 'Easy on the eyes',
  },
  {
    value: 'system',
    label: 'System',
    icon: <Monitor className="h-5 w-5" />,
    desc: 'Follows your OS setting',
  },
];

/**
 * Three-card picker used inside the Appearance section of Settings.
 * Reads & writes theme via useTheme() — no local state needed.
 */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-3 gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          className={`flex flex-col items-center gap-2 rounded-lg border p-4
            transition-colors cursor-pointer
            ${
              theme === opt.value
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent'
            }`}
        >
          {opt.icon}
          <span className="text-sm font-medium">{opt.label}</span>
          <span className="text-xs text-muted-foreground text-center">
            {opt.desc}
          </span>
        </button>
      ))}
    </div>
  );
}