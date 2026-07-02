import type { AgentFiltersUsed } from '@/types';

const DESTINATION_BY_TYPE: Record<string, { path: string; paramKeys: (keyof AgentFiltersUsed)[] }> = {
  task:    { path: '/taskboard', paramKeys: ['status', 'project_id', 'priority', 'overdue', 'assigned_to_me', 'today', 'label_name'] },
  project: { path: '/projects',  paramKeys: ['project_id', 'is_favourite'] },
  event:   { path: '/calendar',  paramKeys: ['today', 'date'] },
  note:    { path: '/documents', paramKeys: ['search_text'] },
};

export function buildViewAllUrl(type: string, filtersUsed: AgentFiltersUsed | null): string | null {
  const dest = DESTINATION_BY_TYPE[type];
  if (!dest || !filtersUsed) return null;

  const params = new URLSearchParams();
  dest.paramKeys.forEach(key => {
    const value = filtersUsed[key];
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const qs = params.toString();
  return qs ? `${dest.path}?${qs}` : dest.path;
}