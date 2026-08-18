import type React from 'react';
import { TEXT, LINE } from '@/config/tokens';
export { BLUE, LINE, TEXT, MUTED, BG } from '@/config/tokens';
export { TASK_STATUS_OPTIONS as STATUS_OPTIONS } from '@/config/statusColors';
export { PRIORITY_OPTIONS } from '@/config/priorityConfig';

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
