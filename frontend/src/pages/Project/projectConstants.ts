export { BLUE, LINE, TEXT, MUTED } from '@/config/tokens';
export {
  TREE_GROUPS, PROJECT_TYPE_FILTERS, PROJECT_TYPE_OPTIONS as PROJECT_TYPES, getTypeHex, getTypeBg, getProjectTypeColor, PROJECT_TYPE_CONFIG as PROJECT_TYPE_HEX,
} from '@/config/projectTypeConfig';

// ─── Status pill config 
export const STATUS_MAP: Record<string, { bg: string; color: string; border: string; label: string }> = {
  active:    { bg: '#eafaf3', color: '#09925e', border: '#bee8d3', label: 'Active' },
  in_review: { bg: '#fff6e5', color: '#b86600', border: '#ffd28b', label: 'In Review' },
  draft:     { bg: '#f2f4f7', color: '#475467', border: '#e4e7ec', label: 'Draft' },
  archived:  { bg: '#f2f4f7', color: '#475467', border: '#e4e7ec', label: 'Archived' },
  completed: { bg: '#eafaf3', color: '#09925e', border: '#bee8d3', label: 'Completed' },
};


