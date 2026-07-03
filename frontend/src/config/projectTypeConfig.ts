// ─── Project Type Config ──────────────────────────────────────────────────────
// Single source of truth for project/task type colors, labels, and options.
// Replaces: TYPE_MAP + PROJECT_TYPE_HEX + getTypeHex + getTypeBg (projectConstants),
//           PROJECT_TYPE_COLORS + getProjectTypeColor (utils),
//           PROJECT_TYPE_COLOR (Entitycard),
//           TASK_TYPES (CreateProjectModal + ProjectSettings — were inconsistent).

export interface ProjectTypeConfig {
  value: string;
  label: string;
  description: string;
  /** Hex accent color */
  hex: string;
  /** Light tint background (hex + alpha) */
  tintBg: string;
  /** Badge background */
  bg: string;
  /** Badge text color */
  color: string;
  /** Badge border color */
  border: string;
  /** Tailwind bg class for avatar dots */
  twBg: string;
}

export const PROJECT_TYPE_CONFIG: Record<string, ProjectTypeConfig> = {
  client: {
    value: 'client', label: 'Client', description: 'External client work',
    hex: '#3b82f6', tintBg: '#3b82f61f',
    bg: '#eef4ff', color: '#1663f6', border: '#cde0ff',
    twBg: 'bg-blue-500',
  },
  internal: {
    value: 'internal', label: 'Internal', description: 'Internal team projects',
    hex: '#8b5cf6', tintBg: '#8b5cf61f',
    bg: '#f4efff', color: '#7c3aed', border: '#dfd2ff',
    twBg: 'bg-violet-500',
  },
  content_creation: {
    value: 'content_creation', label: 'Content Creation', description: 'Content and media',
    hex: '#ec4899', tintBg: '#ec48991f',
    bg: '#fff0f7', color: '#db2777', border: '#ffd1e5',
    twBg: 'bg-pink-500',
  },
  ideas: {
    value: 'ideas', label: 'Ideas', description: 'Brainstorming and concepts',
    hex: '#f59e0b', tintBg: '#f59e0b1f',
    bg: '#fff8e8', color: '#b86600', border: '#ffd28b',
    twBg: 'bg-amber-400',
  },
  demo: {
    value: 'demo', label: 'Demo', description: 'Demo and showcase',
    hex: '#22c55e', tintBg: '#22c55e1f',
    bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0',
    twBg: 'bg-emerald-500',
  },
};

// Alias — content_creation and content point to the same config
PROJECT_TYPE_CONFIG['content'] = PROJECT_TYPE_CONFIG.content_creation;

const _DEFAULT_TYPE: ProjectTypeConfig = {
  value: 'default', label: 'Project', description: '',
  hex: '#667085', tintBg: '#6670851f',
  bg: '#f3f4f6', color: '#667085', border: '#e4e7ec',
  twBg: 'bg-gray-400',
};

/** Ordered list for dropdowns — includes all types */
export const PROJECT_TYPE_OPTIONS: ProjectTypeConfig[] = [
  PROJECT_TYPE_CONFIG.client,
  PROJECT_TYPE_CONFIG.internal,
  PROJECT_TYPE_CONFIG.content_creation,
  PROJECT_TYPE_CONFIG.ideas,
  PROJECT_TYPE_CONFIG.demo,
];

/** Returns full config for a project type value. */
export function getProjectTypeConfig(taskType?: string): ProjectTypeConfig {
  const key = (taskType || '').toLowerCase().replace(/-/g, '_');
  return PROJECT_TYPE_CONFIG[key] ?? _DEFAULT_TYPE;
}

/** Returns the canonical hex accent color for a project type. */
export function getTypeHex(taskType?: string): string {
  return getProjectTypeConfig(taskType).hex;
}

/** Returns a light tinted background for a project type. */
export function getTypeBg(taskType?: string): string {
  return getProjectTypeConfig(taskType).tintBg;
}

/** Returns the Tailwind bg class for avatar dots (Sidebar, Profile). */
export function getProjectTypeColor(taskType?: string): string {
  return getProjectTypeConfig(taskType).twBg;
}

/** Tree sidebar groups — for Sidebar grouping */
export const TREE_GROUPS = [
  { label: 'Client Projects',   types: ['client'],           color: '#3b82f6' },
  { label: 'Internal Projects', types: ['internal'],         color: '#8b5cf6' },
  { label: 'Content Creation',  types: ['content_creation'], color: '#ec4899' },
  { label: 'Ideas',             types: ['ideas'],            color: '#f59e0b' },
  { label: 'Demo Projects',     types: ['demo'],             color: '#22c55e' },
];

/** Type filter chips for Projects page filter bar */
export const PROJECT_TYPE_FILTERS = [
  { label: 'Client',           value: 'client',           dotColor: '#3b82f6' },
  { label: 'Internal',         value: 'internal',         dotColor: '#8b5cf6' },
  { label: 'Content Creation', value: 'content_creation', dotColor: '#ec4899' },
  { label: 'Ideas',            value: 'ideas',            dotColor: '#f59e0b' },
] as const;