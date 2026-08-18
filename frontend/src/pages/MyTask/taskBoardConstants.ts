import { BLUE, LINE, TEXT, MUTED, BG } from '@/config/tokens';
export { BLUE, LINE, TEXT, MUTED, BG };

// ─── Date field switcher options
export const DATE_FIELD_OPTIONS = [
  { value: 'end_date'   as const, label: 'Due Date'   },
  { value: 'start_date' as const, label: 'Start Date' },
  { value: 'created_at' as const, label: 'Created At' },
] satisfies { value: 'end_date' | 'start_date' | 'created_at'; label: string }[];

// ─── Person field switcher options 
export const PERSON_FIELD_OPTIONS = [
  { value: 'assigned_to' as const, label: 'Assignee'   },
  { value: 'created_by'  as const, label: 'Created By' },
  { value: 'updated_by'  as const, label: 'Updated By' },
] satisfies { value: 'assigned_to' | 'created_by' | 'updated_by'; label: string }[];

// ─── Reusable card style
import type { CSSProperties } from 'react';
export const cardStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${LINE}`,
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(16,24,40,.05)',
};
