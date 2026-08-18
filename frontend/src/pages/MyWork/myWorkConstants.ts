import type { CSSProperties } from 'react';
import { BLUE, GREEN, YELLOW, RED, PURPLE, TEXT as INK, MUTED, LINE } from '@/config/tokens';
export { BLUE, GREEN, YELLOW, RED, PURPLE, INK, MUTED, LINE };
export const SURFACE = 'hsl(var(--card))';

export const EVENT_COLORS = [BLUE, PURPLE, YELLOW, GREEN, RED];
export function eventColor(idx: number) {
  return EVENT_COLORS[idx % EVENT_COLORS.length];
}
export function isOverdue(task: any) {
  if (!task.end_date) return false;
  return new Date(task.end_date) < new Date() && task.status !== 'completed' && task.status !== 'deployed';
}

// ─── Time / date helpers 
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

// ─── Shared card style 
export const card: CSSProperties = {
  background: 'hsl(var(--card))',
  borderRadius: 12,
  border: `1px solid ${LINE}`,
  boxShadow: '0 1px 3px rgba(0,0,0,.07)',
};