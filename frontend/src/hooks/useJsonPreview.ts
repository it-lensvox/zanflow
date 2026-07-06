import { useMemo } from 'react';

export interface PreviewTask {
  heading: string;
  priority: string;
  status: string;
  description?: string;
  assignee_emails?: string[];
}

interface UseJsonPreviewResult {
  tasks: PreviewTask[];
  isValid: boolean;
  error: string | null;
}

export function useJsonPreview(json: string): UseJsonPreviewResult {
  return useMemo(() => {
    const trimmed = json.trim();
    if (!trimmed) return { tasks: [], isValid: false, error: null };

    try {
      const parsed = JSON.parse(trimmed);
      const tasks: PreviewTask[] = Array.isArray(parsed?.tasks) ? parsed.tasks : [];

      const valid = tasks.length > 0 && tasks.every(
        (t) => typeof t.heading === 'string' && t.heading.trim()
      );

      return {
        tasks: valid ? tasks : [],
        isValid: valid,
        error: valid ? null : (tasks.length === 0 ? 'No tasks found in JSON.' : 'Each task must have a "heading" field.'),
      };
    } catch {
      return { tasks: [], isValid: false, error: 'Invalid JSON syntax.' };
    }
  }, [json]);
}