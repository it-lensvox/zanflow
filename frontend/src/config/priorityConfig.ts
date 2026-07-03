// ─── Priority Config ──────────────────────────────────────────────────────────
// Single source of truth for priority colors, labels, and dropdown options.
// Replaces: priorityOptions (taskConfig), PRIORITY_OPTIONS (createTaskConstants),
//           PRIORITY_STYLES (TaskPreviewOverlay), PRIORITY_CONFIG (TodayTab),
//           PRIORITY_COLOR (Entitycard), PRIORITY_HEX (AISuggestionPanel),
//           getPriorityColor (utils + calendarConstants).

export interface PriorityConfig {
  value: string;
  label: string;
  /** Hex dot / accent color */
  dot: string;
  /** Badge background */
  bg: string;
  /** Badge text color */
  color: string;
  /** Badge border color */
  border: string;
  /** Tailwind text class — for Tailwind-based renders */
  twText: string;
  /** Tailwind dot/bg class — for Tailwind-based renders */
  twDot: string;
  /** Emoji icon for compact renders */
  icon: string;
}

export const PRIORITY_CONFIG: Record<string, PriorityConfig> = {
  critical: {
    value: 'critical', label: 'Critical',
    dot: '#ef4444', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca',
    twText: 'text-red-700', twDot: 'bg-red-600', icon: '🚨',
  },
  high: {
    value: 'high', label: 'High',
    dot: '#ef4444', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa',
    twText: 'text-red-600', twDot: 'bg-red-500', icon: '🔴',
  },
  medium: {
    value: 'medium', label: 'Medium',
    dot: '#f59e0b', bg: '#fffbeb', color: '#92400e', border: '#fde68a',
    twText: 'text-orange-600', twDot: 'bg-orange-400', icon: '🟡',
  },
  low: {
    value: 'low', label: 'Low',
    dot: '#22c55e', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0',
    twText: 'text-green-600', twDot: 'bg-green-500', icon: '🟢',
  },
};

/** Ordered list for dropdowns and filters */
export const PRIORITY_OPTIONS: PriorityConfig[] = [
  PRIORITY_CONFIG.critical,
  PRIORITY_CONFIG.high,
  PRIORITY_CONFIG.medium,
  PRIORITY_CONFIG.low,
];

/** Returns full config for a priority value. Falls back to medium. */
export function getPriorityConfig(priority?: string): PriorityConfig {
  const key = (priority || '').toLowerCase();
  return PRIORITY_CONFIG[key] ?? PRIORITY_CONFIG.medium;
}

/** Returns the hex accent/dot color for a priority (replaces both getPriorityColor fns). */
export function getPriorityColor(priority?: string): string {
  return getPriorityConfig(priority).dot;
}