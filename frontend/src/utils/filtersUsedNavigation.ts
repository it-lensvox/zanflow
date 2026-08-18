import type { AgentFiltersUsed } from '@/types';

const DESTINATION_BY_TYPE: Record<string, { path: string; paramKeys: (keyof AgentFiltersUsed)[] }> = {
  task:     { path: '/taskboard', paramKeys: ['status', 'project_id', 'priority', 'overdue', 'assigned_to_me', 'today', 'label_name'] },
  project:  { path: '/projects',  paramKeys: ['project_id', 'is_favourite'] },
  event:    { path: '/calendar',  paramKeys: ['today', 'date'] },
  note:     { path: '/documents', paramKeys: ['search_text'] },
  document: { path: '/documents', paramKeys: ['file_type', 'project_id'] },
};

// Maps AgentFiltersUsed key → actual URL param name the destination page reads
const PARAM_RENAME: Partial<Record<keyof AgentFiltersUsed, string>> = {
  project_id: 'project',   // Documents page reads ?project={id}
  search_text: 'q',
};

export function buildViewAllUrl(type: string, filtersUsed: AgentFiltersUsed | null): string | null {
  const dest = DESTINATION_BY_TYPE[type];
  if (!dest || !filtersUsed) return null;

  const params = new URLSearchParams();
  dest.paramKeys.forEach(key => {
    const value = filtersUsed[key];
    if (value !== undefined && value !== null && value !== '') {
      const urlKey = PARAM_RENAME[key] ?? key;
      params.set(urlKey, String(value));
    }
  });

  const qs = params.toString();
  return qs ? `${dest.path}?${qs}` : dest.path;
}