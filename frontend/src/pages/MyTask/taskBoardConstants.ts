// ─── Design tokens — identical to Dashboard & Projects ───────────────────────
export const BLUE  = '#1663f6';
export const LINE  = '#e6ebf2';
export const TEXT  = '#172033';
export const MUTED = '#667085';
export const BG    = '#F7F8FB';

// ─── Date field switcher options ──────────────────────────────────────────────
export const DATE_FIELD_OPTIONS = [
  { value: 'end_date'   as const, label: 'Due Date'   },
  { value: 'start_date' as const, label: 'Start Date' },
  { value: 'created_at' as const, label: 'Created At' },
] satisfies { value: 'end_date' | 'start_date' | 'created_at'; label: string }[];

// ─── Person field switcher options ────────────────────────────────────────────
export const PERSON_FIELD_OPTIONS = [
  { value: 'assigned_to' as const, label: 'Assignee'   },
  { value: 'created_by'  as const, label: 'Created By' },
  { value: 'updated_by'  as const, label: 'Updated By' },
] satisfies { value: 'assigned_to' | 'created_by' | 'updated_by'; label: string }[];

// ─── Reusable card style (same as Dashboard) ──────────────────────────────────
export const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${LINE}`,
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(16,24,40,.05)',
};

import type React from 'react';