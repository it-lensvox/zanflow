// ─── Design tokens ────────────────────────────────────────────────────────────
export const BLUE  = '#4169FF';   // Documents accent (different from Projects #1663f6)
export const LINE  = '#e5e7eb';
export const TEXT  = '#1a1a1a';
export const MUTED = '#6b7280';
export const BG    = '#f9fafb';

// ─── File type filter options ─────────────────────────────────────────────────
export const FILE_TYPE_OPTIONS = [
  { value: '',      label: 'All Types' },
  { value: 'pdf',   label: 'PDF'   },
  { value: 'image', label: 'Image' },
  { value: 'json',  label: 'JSON'  },
  { value: 'text',  label: 'Text'  },
] as const;

// ─── Document status colours ──────────────────────────────────────────────────
export const DOC_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#F3F4F6', color: '#6B7280' },
  in_review: { bg: '#FFF4E6', color: '#D97706' },
  approved:  { bg: '#E8F5E9', color: '#16A34A' },
  archived:  { bg: '#F3F4F6', color: '#6B7280' },
};

// ─── File extension → icon colour map ────────────────────────────────────────
export const FILE_ICON_COLORS: Record<string, string> = {
  pdf:  '#EF4444',
  doc:  '#2563EB', docx: '#2563EB',
  xls:  '#16A34A', xlsx: '#16A34A',
  ppt:  '#EA580C', pptx: '#EA580C',
  png:  '#7C3AED', jpg:  '#7C3AED', jpeg: '#7C3AED',
};
export const DEFAULT_FILE_COLOR = '#6B7280';

export function getFileIconColor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICON_COLORS[ext] || DEFAULT_FILE_COLOR;
}