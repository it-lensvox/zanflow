// ─── Shared Status Colors ────────────────────────────────────────────────────
// Single source of truth for task/project status colors across the entire app.
// Used by Dashboard, MyWork, TaskConfig, Calendar, and any future pages.

export interface StatusColorConfig {
  bg: string;
  text: string;
  dot: string;
}

export const STATUS_COLORS: Record<string, StatusColorConfig> = {
  pending:     { bg: '#FFF9EC', text: '#B45309', dot: '#F59E0B' },
  backlog:     { bg: '#FFF4ED', text: '#C2410C', dot: '#F97316' },
  in_progress: { bg: '#EEF2FF', text: '#4338CA', dot: '#6366F1' },
  completed:   { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  deployed:    { bg: '#F5F3FF', text: '#7C3AED', dot: '#A78BFA' },
  deferred:    { bg: '#F9FAFB', text: '#6B7280', dot: '#9CA3AF' },
  review:      { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
};

// Dot-only color lookup (used by charts and sparklines)
export const STATUS_DOT_COLORS: Record<string, string> = {
  in_progress: '#6366F1',
  pending:     '#F59E0B',
  backlog:     '#F97316',
  completed:   '#22C55E',
  deployed:    '#A78BFA',
  deferred:    '#9CA3AF',
  review:      '#3B82F6',
};

// Project avatar palette — consistent across dashboard and project pages
export const PROJECT_COLORS = [
  '#1663F6', '#22C55E', '#8B5CF6', '#F59E0B',
  '#EF4444', '#06B6D4', '#EC4899',
];

// File type badge config — used by dashboard recent activity and document lists
export interface FileBadgeConfig {
  label: string;
  bg: string;
  color: string;
}

export const FILE_BADGE: Record<string, FileBadgeConfig> = {
  pdf:  { label: 'PDF', bg: '#FEE2E2', color: '#DC2626' },
  docx: { label: 'DOC', bg: '#DBEAFE', color: '#1D4ED8' },
  doc:  { label: 'DOC', bg: '#DBEAFE', color: '#1D4ED8' },
  xlsx: { label: 'XLS', bg: '#DCFCE7', color: '#16A34A' },
  xls:  { label: 'XLS', bg: '#DCFCE7', color: '#16A34A' },
  pptx: { label: 'PPT', bg: '#FFEDD5', color: '#EA580C' },
  ppt:  { label: 'PPT', bg: '#FFEDD5', color: '#EA580C' },
  png:  { label: 'IMG', bg: '#F3E8FF', color: '#7C3AED' },
  jpg:  { label: 'IMG', bg: '#F3E8FF', color: '#7C3AED' },
  jpeg: { label: 'IMG', bg: '#F3E8FF', color: '#7C3AED' },
};

export function getFileBadge(name: string): FileBadgeConfig {
  const ext = (name || '').split('.').pop()?.toLowerCase() || '';
  return FILE_BADGE[ext] || { label: 'FILE', bg: '#F3F4F6', color: '#6B7280' };
}

export function getStatusColors(status: string): StatusColorConfig {
  const key = status.toLowerCase().replace(/[\s-]/g, '_');
  return STATUS_COLORS[key] || STATUS_COLORS.deferred;
}