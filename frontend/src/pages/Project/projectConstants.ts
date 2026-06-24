// ─── Design Tokens ────────────────────────────────────────────────────────────
export const BLUE = '#1663f6';
export const LINE = '#e6ebf2';
export const TEXT = '#172033';
export const MUTED = '#667085';

// ─── Project colour from name (deterministic hash) ────────────────────────────
const COLOR_PALETTE = [
  '#22c36a', '#3b82f6', '#8b5cf6', '#fb923c', '#35c7bd',
  '#ef4444', '#ec5da8', '#f59e0b', '#1663f6', '#dc2626',
];
export function projectColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLOR_PALETTE[Math.abs(h) % COLOR_PALETTE.length];
}

// ─── Status pill config ───────────────────────────────────────────────────────
export const STATUS_MAP: Record<string, { bg: string; color: string; border: string; label: string }> = {
  active:    { bg: '#eafaf3', color: '#09925e', border: '#bee8d3', label: 'Active' },
  in_review: { bg: '#fff6e5', color: '#b86600', border: '#ffd28b', label: 'In Review' },
  draft:     { bg: '#f2f4f7', color: '#475467', border: '#e4e7ec', label: 'Draft' },
  archived:  { bg: '#f2f4f7', color: '#475467', border: '#e4e7ec', label: 'Archived' },
  completed: { bg: '#eafaf3', color: '#09925e', border: '#bee8d3', label: 'Completed' },
};

// ─── Type pill config ─────────────────────────────────────────────────────────
export const TYPE_MAP: Record<string, { bg: string; color: string; border: string }> = {
  client:           { bg: '#eef4ff', color: BLUE,      border: '#cde0ff' },
  internal:         { bg: '#f4efff', color: '#7c3aed', border: '#dfd2ff' },
  content:          { bg: '#fff0f7', color: '#db2777', border: '#ffd1e5' },
  content_creation: { bg: '#fff0f7', color: '#db2777', border: '#ffd1e5' },
  ideas:            { bg: '#fff8e8', color: '#b86600', border: '#ffd28b' },
};

// ─── Tree sidebar groups ──────────────────────────────────────────────────────
export const TREE_GROUPS = [
  { label: 'Client Projects',  types: ['client'],           color: '#3b82f6' },
  { label: 'Internal Projects',types: ['internal'],         color: '#8b5cf6' },
  { label: 'Content Creation', types: ['content_creation'], color: '#ec4899' },
  { label: 'Ideas',            types: ['ideas'],            color: '#f59e0b' },
  { label: 'Demo Projects',    types: ['demo'],             color: '#22c36a' },
];

// ─── Type filter chips (toolbar) ─────────────────────────────────────────────
export const PROJECT_TYPE_FILTERS = [
  { label: 'Client',           value: 'client',           dotColor: '#3b82f6' },
  { label: 'Internal',         value: 'internal',         dotColor: '#22c55e' },
  { label: 'Content Creation', value: 'content_creation', dotColor: '#ec4899' },
  { label: 'Ideas',            value: 'ideas',            dotColor: '#eab308' },
] as const;

// ─── Move modal destination types ─────────────────────────────────────────────
export const PROJECT_TYPES = [
  { value: 'client',           label: 'Client Projects',  color: '#3b82f6', desc: 'External client work' },
  { value: 'internal',         label: 'Internal Projects',color: '#8b5cf6', desc: 'Internal team projects' },
  { value: 'content_creation', label: 'Content Creation', color: '#ec4899', desc: 'Content and media' },
  { value: 'ideas',            label: 'Ideas',            color: '#f59e0b', desc: 'Brainstorming and concepts' },
  { value: 'demo',             label: 'Demo Projects',    color: '#22c36a', desc: 'Demo and showcase' },
];