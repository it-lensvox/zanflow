// ─── Design Tokens
export const BLUE = '#1663f6';
export const LINE = '#e6ebf2';
export const TEXT = '#172033';
export const MUTED = '#667085';

// ─── Status pill config 
export const STATUS_MAP: Record<string, { bg: string; color: string; border: string; label: string }> = {
  active:    { bg: '#eafaf3', color: '#09925e', border: '#bee8d3', label: 'Active' },
  in_review: { bg: '#fff6e5', color: '#b86600', border: '#ffd28b', label: 'In Review' },
  draft:     { bg: '#f2f4f7', color: '#475467', border: '#e4e7ec', label: 'Draft' },
  archived:  { bg: '#f2f4f7', color: '#475467', border: '#e4e7ec', label: 'Archived' },
  completed: { bg: '#eafaf3', color: '#09925e', border: '#bee8d3', label: 'Completed' },
};

// ─── Type pill config
export const TYPE_MAP: Record<string, { bg: string; color: string; border: string }> = {
  client:           { bg: '#eef4ff', color: BLUE,      border: '#cde0ff' },
  internal:         { bg: '#f4efff', color: '#7c3aed', border: '#dfd2ff' },
  content:          { bg: '#fff0f7', color: '#db2777', border: '#ffd1e5' },
  content_creation: { bg: '#fff0f7', color: '#db2777', border: '#ffd1e5' },
  ideas:            { bg: '#fff8e8', color: '#b86600', border: '#ffd28b' },
};

// ─── Tree sidebar groups 
export const TREE_GROUPS = [
  { label: 'Client Projects',  types: ['client'],           color: '#3b82f6' },
  { label: 'Internal Projects',types: ['internal'],         color: '#8b5cf6' },
  { label: 'Content Creation', types: ['content_creation'], color: '#ec4899' },
  { label: 'Ideas',            types: ['ideas'],            color: '#f59e0b' },
  { label: 'Demo Projects',    types: ['demo'],             color: '#22c36a' },
];

// ─── Type filter chips 
export const PROJECT_TYPE_FILTERS = [
  { label: 'Client',           value: 'client',           dotColor: '#3b82f6' },
  { label: 'Internal',         value: 'internal',         dotColor: '#22c55e' },
  { label: 'Content Creation', value: 'content_creation', dotColor: '#ec4899' },
  { label: 'Ideas',            value: 'ideas',            dotColor: '#eab308' },
] as const;

// ─── Move modal destination types
export const PROJECT_TYPES = [
  { value: 'client',           label: 'Client Projects',  color: '#3b82f6', desc: 'External client work' },
  { value: 'internal',         label: 'Internal Projects',color: '#8b5cf6', desc: 'Internal team projects' },
  { value: 'content_creation', label: 'Content Creation', color: '#ec4899', desc: 'Content and media' },
  { value: 'ideas',            label: 'Ideas',            color: '#f59e0b', desc: 'Brainstorming and concepts' },
  { value: 'demo',             label: 'Demo Projects',    color: '#22c36a', desc: 'Demo and showcase' },
];
// ─── Single-source project type 
export const PROJECT_TYPE_HEX: Record<string, string> = {
  client:           '#3b82f6', 
  internal:         '#8b5cf6',
  content_creation: '#ec4899', 
  content:          '#ec4899', 
  ideas:            '#f59e0b', 
  demo:             '#22c36a',
  default:          '#667085', 
};

/** Returns the canonical hex accent color for a project type. */
export function getTypeHex(taskType?: string): string {
  const key = (taskType || '').toLowerCase().replace(/-/g, '_');
  return PROJECT_TYPE_HEX[key] || PROJECT_TYPE_HEX.default;
}

/** Returns a light tinted background for a project type  */
export function getTypeBg(taskType?: string): string {
  const hex = getTypeHex(taskType);
  return `${hex}1f`;
}