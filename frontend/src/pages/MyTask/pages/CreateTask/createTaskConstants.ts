// ─── Design tokens 
export const BLUE  = '#1663f6';
export const LINE  = '#e6ebf2';
export const TEXT  = '#172033';
export const MUTED = '#667085';
export const BG    = '#F7F8FB';

// ─── Status options ─
export const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending',     dot: '#94a3b8' },
  { value: 'in_progress', label: 'In Progress', dot: '#3b82f6' },
  { value: 'review',      label: 'Review',      dot: '#f59e0b' },
  { value: 'completed',   label: 'Completed',   dot: '#22c55e' },
  { value: 'deployed',    label: 'Deployed',    dot: '#8b5cf6' },
  { value: 'deferred',    label: 'Deferred',    dot: '#94a3b8' },
  { value: 'backlog',     label: 'Backlog',     dot: '#cbd5e1' },
] as const;

// ─── Priority options ──
export const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { value: 'high',     label: 'High',     color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { value: 'medium',   label: 'Medium',   color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { value: 'low',      label: 'Low',      color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
] as const;

// ─── Shared input style ─
export const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 12px',
  fontSize: 13,
  color: TEXT,
  background: '#fff',
  border: `1px solid ${LINE}`,
  borderRadius: 8,
  outline: 'none',
  transition: 'border-color .15s, box-shadow .15s',
  fontFamily: 'inherit',
};

// ─── Shared label style ──
export const LABEL_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  color: TEXT,
  marginBottom: 6,
  letterSpacing: '0.01em',
};

// ─── Section card style ─
export const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${LINE}`,
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(16,24,40,.05)',
};

import type React from 'react';