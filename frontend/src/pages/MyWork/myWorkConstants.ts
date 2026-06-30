import type { CSSProperties } from 'react';

// ─── My Work Design Tokens ───────────────────────────────────────────────
// Mirrors the same token pattern used in Dashboard/index.ts and
// Project/projectConstants.ts. Local to this module — not a duplicate of
// the global types/api index files.
export const BLUE = '#1663F6';
export const GREEN = '#22C55E';
export const YELLOW = '#F59E0B';
export const RED = '#EF4444';
export const PURPLE = '#8B5CF6';
export const INK = '#172033';
export const MUTED = '#667085';
export const LINE = '#E6EBF2';
export const SURFACE = '#FFFFFF';

export const EVENT_COLORS = [BLUE, PURPLE, YELLOW, GREEN, RED];
export function eventColor(idx: number) {
  return EVENT_COLORS[idx % EVENT_COLORS.length];
}

// NOTE: Task/event status colors are NOT defined here.
// Use `getStatusColors` from '@/config/statusColors' or the shared
// `StatusBadge` from '@/components/ui/StatusBadge' instead — that is the
// single source of truth for status colors across Dashboard, Calendar,
// and My Work. Do not reintroduce a local STATUS_MAP here.

export function isOverdue(task: any) {
  if (!task.end_date) return false;
  return new Date(task.end_date) < new Date() && task.status !== 'completed' && task.status !== 'deployed';
}

// ─── Time / date helpers ─────────────────────────────────────────────────
export function formatTime(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function eventDuration(start: string, end: string) {
  if (!start || !end) return '';
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60), m = diff % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function isToday(iso: string) {
  if (!iso) return false;
  const dateStr = iso.includes('T') ? iso : iso + 'T00:00:00';
  const d = new Date(dateStr);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

// ─── Shared card style ───────────────────────────────────────────────────
export const card: CSSProperties = {
  background: SURFACE,
  borderRadius: 12,
  border: `1px solid ${LINE}`,
  boxShadow: '0 1px 4px rgba(16,24,40,.04)',
};