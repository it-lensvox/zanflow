import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { taskApi } from '@/services/api';

export type SuggestionPriority = 'high' | 'medium' | 'low';
export type SuggestionStatus   = 'pending' | 'backlog' | 'in_progress' | 'completed' | 'deployed' | 'deferred' | 'review';

export interface TaskSuggestion {
  clientId:    string;
  title:       string;
  priority:    SuggestionPriority;
  status:      SuggestionStatus;
  assigned_to: number[];   // user IDs
  selected:    boolean;
  isEditing:   boolean;
}

interface UseAISuggestionsOptions {
  taskId:              number;
  taskTitle:           string;
  taskDescription?:    string;
  projectName?:        string;
  taskType?:           string;
  existingChildTasks?: string[];
  /** IDs of users already assigned to the parent task — used to pre-fill suggestions */
  parentAssigneeIds?:  number[];
}

export function useAISuggestions({
  taskId,
  taskTitle,
  taskDescription,
  projectName,
  taskType,
  existingChildTasks  = [],
  parentAssigneeIds   = [],
}: UseAISuggestionsOptions) {
  const queryClient = useQueryClient();

  const [isOpen,       setIsOpen]       = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [isCreating,   setIsCreating]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [suggestions,  setSuggestions]  = useState<TaskSuggestion[]>([]);
  const [createdCount, setCreatedCount] = useState(0);
  const [createError,  setCreateError]  = useState<string | null>(null);

  // ── Normalise helpers ────────────────────────────────────────────────────
  const mapPriority = (p?: string): SuggestionPriority => {
    if (p === 'high') return 'high';
    if (p === 'low')  return 'low';
    return 'medium';
  };

  const mapStatus = (s?: string): SuggestionStatus => {
    const valid: SuggestionStatus[] = ['pending','backlog','in_progress','completed','deployed','deferred','review'];
    return valid.includes(s as SuggestionStatus) ? (s as SuggestionStatus) : 'pending';
  };

  // ── Fetch 
  const fetchSuggestions = useCallback(async (count = 6, append = false) => {
    if (!taskId || taskId <= 0) {
      setError('Task not ready. Please try again.');
      return;
    }
    setIsLoading(true);
    setError(null);
    if (!append) setSuggestions([]);
    try {
      const payload = {
        task_id:              taskId,
        title:                taskTitle,
        description:          taskDescription ? taskDescription.replace(/<[^>]*>/g, '').trim() : '',
        project_name:         projectName  || '',
        task_type:            taskType     || 'internal',
        existing_child_tasks: existingChildTasks,
        suggestion_count:     count,
      };
      const response = await taskApi.suggestChildTasks(payload);
      const raw: { title: string; priority?: string; status?: string; assigned_to?: number[] }[] =
        response.suggestions || [];

      const mapped: TaskSuggestion[] = raw.map((s, i) => ({
        clientId:    `suggestion-${Date.now()}-${i}`,
        title:       s.title,
        priority:    mapPriority(s.priority),
        status:      mapStatus(s.status),
        // Use API-provided assignees if present; otherwise inherit from parent
        assigned_to: Array.isArray(s.assigned_to) && s.assigned_to.length > 0
          ? s.assigned_to
          : [...parentAssigneeIds],
        selected:    true,
        isEditing:   false,
      }));

      setSuggestions(prev => append ? [...prev, ...mapped] : mapped);
    } catch (err: any) {
      console.error('[useAISuggestions] fetch error:', err);
      setError('Failed to generate suggestions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [taskId, taskTitle, taskDescription, projectName, taskType, existingChildTasks, parentAssigneeIds]);

  // ── Panel open / close ──
  const open = useCallback(() => {
    if (!taskId || taskId <= 0) {
      console.warn('[useAISuggestions] skipping open — invalid taskId:', taskId);
      return;
    }
    setIsOpen(true);
    setCreatedCount(0);
    setCreateError(null);
    fetchSuggestions(3, false);
  }, [taskId, fetchSuggestions]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSuggestions([]);
    setError(null);
    setCreateError(null);
  }, []);

  const regenerate   = useCallback(() => fetchSuggestions(3, false), [fetchSuggestions]);
  const generateMore = useCallback(() => fetchSuggestions(6, true),  [fetchSuggestions]);

  // ── Selection ────────────────────────────────────────────────────────────
  const toggleSelect = useCallback((clientId: string) => {
    setSuggestions(prev =>
      prev.map(s => s.clientId === clientId ? { ...s, selected: !s.selected } : s)
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    const allSelected = suggestions.every(s => s.selected);
    setSuggestions(prev => prev.map(s => ({ ...s, selected: !allSelected })));
  }, [suggestions]);

  // ── Field updates ────────────────────────────────────────────────────────
  const deleteSuggestion = useCallback((clientId: string) => {
    setSuggestions(prev => prev.filter(s => s.clientId !== clientId));
  }, []);

  const startEdit = useCallback((clientId: string) => {
    setSuggestions(prev =>
      prev.map(s => s.clientId === clientId ? { ...s, isEditing: true } : s)
    );
  }, []);

  const commitEdit = useCallback((clientId: string, newTitle: string) => {
    setSuggestions(prev =>
      prev.map(s =>
        s.clientId === clientId
          ? { ...s, title: newTitle.trim() || s.title, isEditing: false }
          : s
      )
    );
  }, []);

  const updatePriority = useCallback((clientId: string, priority: SuggestionPriority) => {
    setSuggestions(prev =>
      prev.map(s => s.clientId === clientId ? { ...s, priority } : s)
    );
  }, []);

  const updateStatus = useCallback((clientId: string, status: SuggestionStatus) => {
    setSuggestions(prev =>
      prev.map(s => s.clientId === clientId ? { ...s, status } : s)
    );
  }, []);

  const addAssignee = useCallback((clientId: string, userId: number) => {
    setSuggestions(prev =>
      prev.map(s =>
        s.clientId === clientId && !s.assigned_to.includes(userId)
          ? { ...s, assigned_to: [...s.assigned_to, userId] }
          : s
      )
    );
  }, []);

  const removeAssignee = useCallback((clientId: string, userId: number) => {
    setSuggestions(prev =>
      prev.map(s =>
        s.clientId === clientId
          ? { ...s, assigned_to: s.assigned_to.filter(id => id !== userId) }
          : s
      )
    );
  }, []);

  // ── Create ───────────────────────────────────────────────────────────────
  const createSelectedTasks = useCallback(async () => {
    const selected = suggestions.filter(s => s.selected && s.title.trim());
    if (selected.length === 0) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await taskApi.createChildTasksBatch(taskId, {
        parent_task_id: taskId,
        tasks: selected.map(s => ({
          title:       s.title,
          priority:    s.priority,
          status:      s.status,
          assigned_to: s.assigned_to,
        })),
      });

      const created = response.created || [];
      const failed  = response.failed  || [];

      setCreatedCount(created.length);

      queryClient.invalidateQueries({ queryKey: ['child-tasks',  taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-detail',  taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      if (failed.length > 0) {
        setCreateError(
          `${created.length} task${created.length !== 1 ? 's' : ''} created. ${failed.length} failed.`
        );
      } else {
        setTimeout(() => close(), 1200);
      }
    } catch (err: any) {
      console.error('[useAISuggestions] batch create error:', err);
      setCreateError('Failed to create tasks. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [suggestions, taskId, queryClient, close]);

  const selectedCount = suggestions.filter(s => s.selected).length;
  const allSelected   = suggestions.length > 0 && suggestions.every(s => s.selected);

  return {
    isOpen, open, close,
    isLoading, isCreating, error, createError, createdCount,
    suggestions, selectedCount, allSelected,
    regenerate, generateMore,
    toggleSelect, toggleSelectAll,
    deleteSuggestion,
    startEdit, commitEdit,
    updatePriority, updateStatus,
    addAssignee, removeAssignee,
    createSelectedTasks,
  };
}