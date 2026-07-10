import type { CSSProperties } from 'react';
import { BLUE, LINE, TEXT, MUTED, BG } from '@/config/tokens';
export { BLUE, LINE, TEXT, MUTED, BG };

// ─── Reusable inline style objects
export const CARD: CSSProperties = {
  background: 'hsl(var(--card))',
  border: `1px solid hsl(var(--border))`,
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(16,24,40,.05)',
};

export const MONTH_BTN: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'hsl(var(--foreground))',
  background: 'hsl(var(--card))',
  border: `1px solid hsl(var(--border))`,
  borderRadius: 6,
  padding: '5px 12px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

// ─── Stat card accent colours
export const STAT_COLORS = {
  projects:  '#1663F6',
  documents: '#22C55E',
  tasks:     '#F59E0B',
  completed: '#8B5CF6',
  overdue:   '#EF4444',
} as const;

// ─── Date range options (single source of truth)
export const DATE_RANGE_LABELS: Record<string, string> = {
  '7d':  'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'all': 'All time',
};

// ─── My Tasks tab definitions
export const MY_TASKS_TABS = [
  { key: 'upcoming',    label: 'Upcoming'    },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'overdue',     label: 'Overdue'     },
  { key: 'completed',   label: 'Completed'   },
] as const;

export type MyTasksTabKey = typeof MY_TASKS_TABS[number]['key'];

// ─── Greeting helper (time-of-day)
const getHour = () => new Date().getHours();
export const getGreeting = () =>
  getHour() < 12 ? 'Good morning' : getHour() < 18 ? 'Good afternoon' : 'Good evening';

// ─── Type re-export so consumers import from one place
export type { MyTasksTabKey as DashboardTab };

// ─── Skeleton block 

interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
}

export function SkeletonBlock({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonBlockProps): CSSProperties {
  return {
    width,
    height,
    borderRadius,
    background: 'hsl(var(--muted))',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    flexShrink: 0,
    ...style,
  };
}

// Inject shimmer keyframes once into the document
if (typeof document !== 'undefined' && !document.getElementById('skeleton-style')) {
  const s = document.createElement('style');
  s.id = 'skeleton-style';
  s.textContent = `@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`;
  document.head.appendChild(s);
}