// ─── Document Config ──────────────────────────────────────────────────────────
// Single source of truth for document status colors and file extension badges.
// Replaces: getDocumentStatusConfig (documentsConfig), STATUS_CONFIG (TreeDocumentView),
//           inline sc map (SidePreviewPanel), DOC_STATUS_STYLES (documentConstants — orphaned),
//           getExtBadgeColor (documentsConfig), EXT_COLOR (TreeDocumentView),
//           FILE_BADGE / getFileBadge (statusColors — partially),
//           FILE_ICON_COLORS / getFileIconColor (documentConstants — orphaned).

import type { DocumentStatus } from '@/types';

// ─── Document Status ──────────────────────────────────────────────────────────

export interface DocStatusConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
}

export const DOC_STATUS_CONFIG: Record<DocumentStatus, DocStatusConfig> = {
  draft:     { label: 'Draft',     bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
  in_review: { label: 'In Review', bg: '#FFF4E6', text: '#D97706', border: '#FCD34D' },
  approved:  { label: 'Approved',  bg: '#E8F5E9', text: '#16A34A', border: '#86EFAC' },
  archived:  { label: 'Archived',  bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
};

export function getDocStatusConfig(status?: string): DocStatusConfig {
  const key = (status || 'draft').toLowerCase() as DocumentStatus;
  return DOC_STATUS_CONFIG[key] ?? DOC_STATUS_CONFIG.draft;
}

export const DOC_STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: 'draft',     label: 'Draft'     },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved',  label: 'Approved'  },
  { value: 'archived',  label: 'Archived'  },
];

// ─── File Extension Colors ────────────────────────────────────────────────────
// Comprehensive map merged from all 3 previous duplicate maps.

export const FILE_EXT_COLORS: Record<string, string> = {
  // Documents
  pdf:  '#EF4444',
  doc:  '#2563EB', docx: '#2563EB',
  xls:  '#16A34A', xlsx: '#16A34A', csv: '#16A34A',
  ppt:  '#EA580C', pptx: '#EA580C',
  // Images
  png:  '#7C3AED', jpg: '#7C3AED', jpeg: '#7C3AED', gif: '#7C3AED', svg: '#7C3AED',
  // Video
  mp4:  '#EC4899', mov: '#EC4899', avi: '#EC4899',
  // Code
  js:   '#F59E0B', ts: '#2563EB', jsx: '#0891B2', tsx: '#0891B2',
  py:   '#3B82F6',
  // Data / Archive
  json: '#F59E0B', zip: '#F59E0B', rar: '#F59E0B',
};

export const DEFAULT_FILE_COLOR = '#6B7280';

/** Returns the accent color for a file by its name/extension. */
export function getFileExtColor(filename: string): string {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  return FILE_EXT_COLORS[ext] ?? DEFAULT_FILE_COLOR;
}

/** Returns the short uppercase label for a file extension (max 4 chars). */
export function getFileExtLabel(filename: string): string {
  const ext = (filename || '').split('.').pop()?.toUpperCase() || '';
  return ext.slice(0, 4) || 'FILE';
}