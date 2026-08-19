import React, { useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, CheckSquare, Clock, PlayCircle, Pause, Eye, AlertCircle, CheckCircle, ListTodo, Pin
} from 'lucide-react';
import type { Task } from '@/types';
import type { TableColumn } from '@/components/layout/DualView/TableView';
import { taskApi } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { formatRelativeTime } from '@/lib/utils';
import { TablePopover } from '@/components/common';
import { getTypeHex, getTypeBg } from '@/pages/Project/projectConstants';
import { useTheme } from '@/hooks/useTheme';
import { Check } from 'lucide-react';
import { PRIORITY_OPTIONS as _PRIORITY_OPTIONS } from '@/config/priorityConfig';

// Utility function to format dates
const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

// Status configuration
export const getStatusConfig = (status: Task['status']) => {
  const normalizedStatus = status.toUpperCase();
  switch (normalizedStatus) {
    case 'PENDING':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-800',
        badge: 'bg-yellow-50 text-yellow-600 border border-yellow-200',
        cardClass: 'card-pending',
        label: 'PENDING',
        icon: Clock,
        color: '#f59e0b',
      };
    case 'BACKLOG':
      return {
        bg: 'bg-orange-50',
        text: 'text-orange-800',
        badge: 'bg-orange-50 text-orange-600 border border-orange-200',
        cardClass: 'card-backlog',
        label: 'BACKLOG',
        icon: ListTodo,
        color: '#f97316',
      };
    case 'IN_PROGRESS':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        badge: 'bg-blue-50 text-blue-600 border border-blue-200',
        cardClass: 'card-in-progress',
        label: 'IN PROGRESS',
        icon: PlayCircle,
        color: '#3b82f6',
      };
    case 'COMPLETED':
      return {
        bg: 'bg-green-50',
        text: 'text-green-800',
        badge: 'bg-green-50 text-green-600 border border-green-200',
        cardClass: 'card-completed',
        label: 'COMPLETED',
        icon: CheckCircle,
        color: '#22c55e',
      };
    case 'DEPLOYED':
      return {
        bg: 'bg-purple-50',
        text: 'text-purple-800',
        badge: 'bg-purple-50 text-purple-600 border border-purple-200',
        cardClass: 'card-deployed',
        label: 'DEPLOYED',
        icon: CheckSquare,
        color: '#8b5cf6',
      };
    case 'DEFERRED':
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-800',
        badge: 'bg-gray-100 text-gray-600 border border-gray-200',
        cardClass: 'card-deferred',
        label: 'DEFERRED',
        icon: Pause,
        color: '#6b7280',
      };
    case 'REVIEW':
      return {
        bg: 'bg-indigo-50',
        text: 'text-indigo-800',
        badge: 'bg-indigo-100 text-indigo-600 border border-indigo-200',
        cardClass: 'card-review',
        label: 'REVIEW',
        icon: Eye,
        color: '#6366f1',
      };
    default:
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-800',
        badge: 'bg-gray-100 text-gray-600 border border-gray-200',
        cardClass: 'card-gray',
        label: normalizedStatus,
        icon: AlertCircle,
        color: '#9ca3af',
      };
  }
};

// Priority options
export const priorityOptions = _PRIORITY_OPTIONS.map(p => ({
  value: p.value,
  label: p.label,
  color: p.twText,
  dotColor: p.twDot,
  icon: p.icon,
}));

// Status options
export const statusOptions = [
  { value: 'pending', label: 'PENDING', icon: Clock },
  { value: 'backlog', label: 'BACKLOG', icon: ListTodo },
  { value: 'in_progress', label: 'IN PROGRESS', icon: PlayCircle },
  { value: 'completed', label: 'COMPLETED', icon: CheckCircle },
  { value: 'deployed', label: 'DEPLOYED', icon: CheckSquare },
  { value: 'deferred', label: 'DEFERRED', icon: Pause },
  { value: 'review', label: 'REVIEW', icon: Eye },
];

// ─── Assignee popover via portal (escapes all stacking contexts) ──────────────
function AssigneePopover({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX });
    setOpen(true);
  };
  const handleMouseLeave = () => setOpen(false);

  return (
    <>
      <div
        ref={triggerRef}
        style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={e => e.stopPropagation()}
      >
        <Users style={{ width: 12, height: 12 }} />
        <span style={{ fontWeight: 600, fontSize: 12, color: '#667085' }}>{(task.assigned_to || []).length}</span>
      </div>

      {open && pos && ReactDOM.createPortal(
        <div
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            zIndex: 99999,
            minWidth: 180,
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            padding: 8,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
            {(task.assigned_to_user_details || []).length > 0 ? (
              (task.assigned_to_user_details || []).map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', background: u.avatar ? 'transparent' : '#3b82f6', flexShrink: 0 }}>
                    {u.avatar ? <img src={u.avatar} alt={u.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <>{u.first_name?.[0]}{u.last_name?.[0]}</>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{u.first_name} {u.last_name}</span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: 11, color: '#9ca3af', padding: '4px 6px', fontStyle: 'italic' }}>No users assigned</span>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Grid Card Component
interface TaskGridCardProps {
  task: Task;
  onTaskClick: (task: Task) => void;
  // Selection props — optional, only present when grid selection mode is active
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (task: Task) => void;
  onDoubleClick?: (task: Task) => void;
}

export function TaskGridCard({ task, onTaskClick, selectionMode = false, isSelected = false, onSelect, onDoubleClick }: TaskGridCardProps) {
  const statusConfig = getStatusConfig(task.status);
  const queryClient = useQueryClient();
  const { isPinned, isPending, handlePin } = usePinTask(task, queryClient);

  // Project type colour
  const taskType = (task as any).project_task_type || task.project_details?.task_type || '';
  const accentHex = getTypeHex(taskType);
  const tintBg = getTypeBg(taskType);
  const initial = (task.project_details?.name || task.project_name || 'T')[0].toUpperCase();

  // Distinguish single-click (open task) from double-click (enter selection mode).
  // Without this, onClick fires on every double-click and opens the task modal
  // before onDoubleClick can activate selection mode.
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    if (selectionMode && onSelect) {
      // In selection mode single-click always toggles — no delay needed
      onSelect(task);
      return;
    }
    // Outside selection mode: wait briefly to see if a double-click follows
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onTaskClick(task);
    }, 220);
  };

  const handleDoubleClick = () => {
    // Cancel the pending single-click so the modal doesn't open
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    onDoubleClick?.(task);
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className="group cursor-pointer"
      style={{
        background: 'hsl(var(--card))',
        border: isSelected ? `2px solid ${accentHex}` : '1px solid hsl(var(--border))',
        borderRadius: 14,
        position: 'relative',
        boxShadow: isSelected ? `0 0 0 3px ${accentHex}22` : '0 1px 4px rgba(16,24,40,.06)',
        transition: 'box-shadow .2s, transform .2s, border-color .15s',
        minWidth: 0,
        width: '100%',
      }}
      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'; e.currentTarget.style.transform = 'none'; } }}
    >
      {/* ── Top accent bar (project type colour) ── */}
      <div style={{ height: 4, background: accentHex, width: '100%', borderRadius: '14px 14px 0 0' }} />

      <div style={{ padding: '14px 16px 16px' }}>
        {/* ── Row 1: Avatar/checkbox + project name + pin + timestamp ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>

          {/* Avatar — doubles as selection indicator in selection mode */}
          {selectionMode && (
            <div
              onClick={e => { e.stopPropagation(); onSelect?.(task); }}
              title={isSelected ? 'Deselect' : 'Select'}
              style={{ position: 'relative', width: 30, height: 30, borderRadius: 7, cursor: 'pointer', flexShrink: 0 }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 7,
                background: isSelected ? accentHex : tintBg,
                border: isSelected ? `1.5px solid ${accentHex}` : `1.5px solid ${accentHex}33`,
                display: 'grid', placeItems: 'center',
                color: isSelected ? '#fff' : accentHex,
                fontWeight: 800, fontSize: 13,
                transition: 'background .15s, color .15s',
              }}>
                {isSelected
                  ? <Check size={13} strokeWidth={3} />
                  : initial
                }
              </div>
              {!isSelected && (
                <div
                  style={{ position: 'absolute', inset: 0, borderRadius: 7, background: `${accentHex}cc`, display: 'grid', placeItems: 'center', opacity: 0, transition: 'opacity .15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                >
                  <Check size={13} color="#fff" strokeWidth={3} />
                </div>
              )}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.project_details?.name || task.project_name || 'No Project'}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.heading || 'No Task'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <PinButton isPinned={isPinned} isPending={isPending} handlePin={handlePin} groupHoverClass="group-hover:opacity-100" />
            {task.updated_at && (
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
                {formatRelativeTime(task.updated_at)}
              </span>
            )}
          </div>
        </div>

        {/* ── Row 2: Due date + assignee count with hover dropdown ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar style={{ width: 12, height: 12 }} />
            <span>{formatDate(task.end_date)}</span>
          </div>

          <AssigneePopover task={task} />
        </div>

        {/* ── Footer: Priority left · Status badge right ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {task.priority ? (() => {
            const p = priorityOptions.find(o => o.value === task.priority);
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className={`w-2 h-2 rounded-full ${p?.dotColor || 'bg-muted-foreground/40'}`} />
                <span style={{ fontSize: 11, fontWeight: 500, color: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' as const }}>{task.priority}</span>
              </div>
            );
          })() :
            <span />}

          <span
            className={`inline-flex items-center rounded text-[10px] font-bold ${statusConfig.badge}`}
            style={{ padding: '3px 10px' }}
          >
            {statusConfig.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// Shared pin logic 
function usePinTask(task: Task, queryClient: ReturnType<typeof useQueryClient>) {
  const [isPinned, setIsPinned] = useState<boolean>(!!task.is_pinned);
  const [isPending, setIsPending] = useState(false);

  const applyReorder = useCallback((next: boolean) => {
    const reorder = (tasks: Task[]): Task[] => {
      const updated = tasks.map((t) =>
        t.id === task.id ? { ...t, is_pinned: next } : t
      );
      return [
        ...updated.filter((t) => t.is_pinned),
        ...updated.filter((t) => !t.is_pinned),
      ];
    };

    const applyPin = (old: any) => {
      if (!old) return old;
      if (old.pages) {
        const pageSizes = old.pages.map((p: any) => p.results.length);
        const allTasks = reorder(old.pages.flatMap((p: any) => p.results));
        let cursor = 0;
        const newPages = old.pages.map((p: any, i: number) => {
          const slice = allTasks.slice(cursor, cursor + pageSizes[i]);
          cursor += pageSizes[i];
          return { ...p, results: slice };
        });
        return { ...old, pages: newPages };
      }
      if (Array.isArray(old)) return reorder(old);
      if (old.results) return { ...old, results: reorder(old.results) };
      return old;
    };

    // Update ALL active task cache entries — board uses ['tasks', status, priority, projectId]
    queryClient.getQueryCache().findAll({ queryKey: ['tasks'] }).forEach(query => {
      queryClient.setQueryData(query.queryKey, applyPin);
    });
  }, [task.id, queryClient]);

  const handlePin = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isPending) return;

      const next = !isPinned;
      setIsPinned(next);
      setIsPending(true);
      applyReorder(next);

      try {
        const res = await taskApi.pinTask(task.id);
        setIsPinned(res.is_pinned);
      } catch {
        setIsPinned(!next);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } finally {
        setIsPending(false);
      }
    },
    [isPinned, isPending, task.id, queryClient, applyReorder]
  );

  return { isPinned, isPending, handlePin };
}

// Shared pin button 
function PinButton({
  isPinned,
  isPending,
  handlePin,
  groupHoverClass,
}: {
  isPinned: boolean;
  isPending: boolean;
  handlePin: (e: React.MouseEvent) => void;
  groupHoverClass: string;
}) {
  return (
    <button
      type="button"
      aria-label={isPinned ? 'Unpin task' : 'Pin task'}
      onClick={handlePin}
      className={`flex-shrink-0 p-0.5 rounded transition-all duration-150
        ${isPinned
          ? 'opacity-100 text-amber-500 hover:text-amber-600'
          : `opacity-0 ${groupHoverClass} text-muted-foreground/40 hover:text-muted-foreground`
        }
        ${isPending ? 'cursor-wait' : 'cursor-pointer'}
      `}
    >
      <Pin
        className="w-3.5 h-3.5"
        fill={isPinned ? 'currentColor' : 'none'}
        strokeWidth={isPinned ? 1.5 : 2}
      />
    </button>
  );
}

// Pin cell 
function TaskTitleCell({
  task,
  queryClient,
}: {
  task: Task;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { isPinned, isPending, handlePin } = usePinTask(task, queryClient);

  return (
    <div className="flex items-center justify-between gap-1 group/title w-full min-w-0">
      <span
        className="font-medium text-foreground truncate block"
        title={task.heading}
      >
        {task.heading}
      </span>
      <PinButton
        isPinned={isPinned}
        isPending={isPending}
        handlePin={handlePin}
        groupHoverClass="group-hover/title:opacity-100"
      />
    </div>
  );
}

export interface TaskSelectionProps {
  selectedIds: Set<number>;
  toggleSelect: (id: number) => void;
  toggleAll: (tasks: Task[]) => void;
  visibleTasks: Task[];
}

interface TaskTableColumnsProps {
  selectionProps?: TaskSelectionProps;
  onTaskClick: (task: Task) => void;
  queryClient: ReturnType<typeof useQueryClient>;
  user: ReturnType<typeof useAuth>['user'];
  navigate: ReturnType<typeof useNavigate>;
}

export const createTasksTableColumns = ({ onTaskClick: _onTaskClick, queryClient, user: _user, navigate: _navigate, dateField = 'end_date', personField = 'assigned_to', selectionProps }: TaskTableColumnsProps & { dateField?: 'end_date' | 'start_date' | 'created_at'; personField?: 'assigned_to' | 'created_by' | 'updated_by' }): TableColumn<Task>[] => {

  const updateAllTaskListCaches = (updatedTask: Task) => {
    const allTaskListQueries = queryClient.getQueryCache().findAll({ queryKey: ['tasks-list'], exact: false });
    allTaskListQueries.forEach((query) => {
      queryClient.setQueryData(query.queryKey, (old: any) => {
        if (!old) return old;
        const list: Task[] = old.tasks ?? old.results ?? (Array.isArray(old) ? old : []);
        const exists = list.some((t: Task) => t.id === updatedTask.id);
        if (!exists) return old;
        const withoutTask = list.filter((t: Task) => t.id !== updatedTask.id);
        const merged = [updatedTask, ...withoutTask];
        if (old.tasks) return { ...old, tasks: merged };
        if (old.results) return { ...old, results: merged };
        if (Array.isArray(old)) return merged;
        return merged;
      });
    });
  };
  // Status Dropdown Component
  const StatusDropdown = ({ task }: { task: Task }) => {
    const [activeDropdown, setActiveDropdown] = useState(false);
    const statusConfig = getStatusConfig(task.status);
    const handleStatusChange = (newStatus: string) => {
      const updatedTask = { ...task, status: newStatus, updated_at: new Date().toISOString() };

      const applyUpdate = (old: any) => {
        if (!old) return old;
        if (old.pages) {
          const pagesWithoutTask = old.pages.map((page: any) => ({
            ...page,
            results: page.results.filter((t: Task) => t.id !== task.id),
          }));
          return {
            ...old,
            pages: [
              { ...pagesWithoutTask[0], results: [updatedTask, ...(pagesWithoutTask[0]?.results ?? [])] },
              ...pagesWithoutTask.slice(1),
            ],
          };
        }
        if (Array.isArray(old)) return [updatedTask, ...old.filter((t: Task) => t.id !== task.id)];
        if (old.tasks) return { ...old, tasks: [updatedTask, ...old.tasks.filter((t: Task) => t.id !== task.id)] };
        if (old.results) return { ...old, results: [updatedTask, ...old.results.filter((t: Task) => t.id !== task.id)] };
        return old;
      };

      // Update ALL active task cache entries (board uses ['tasks', status, priority, projectId])
      queryClient.getQueryCache().findAll({ queryKey: ['tasks'] }).forEach(query => {
        queryClient.setQueryData(query.queryKey, applyUpdate);
      });

      updateAllTaskListCaches(updatedTask);

      setActiveDropdown(false);
      taskApi.update(task.id, { status: newStatus } as any)
        .then((response) => {
          const updatedTaskFromServer = response.task || response;
          const applyServerUpdate = (old: any) => {
            if (!old) return old;
            if (old.pages) {
              return {
                ...old,
                pages: old.pages.map((page: any) => ({
                  ...page,
                  results: page.results.map((t: Task) => t.id === task.id ? updatedTaskFromServer : t),
                })),
              };
            }
            if (Array.isArray(old)) return old.map((t: Task) => t.id === task.id ? updatedTaskFromServer : t);
            if (old.tasks) return { ...old, tasks: old.tasks.map((t: Task) => t.id === task.id ? updatedTaskFromServer : t) };
            if (old.results) return { ...old, results: old.results.map((t: Task) => t.id === task.id ? updatedTaskFromServer : t) };
            return old;
          };
          queryClient.getQueryCache().findAll({ queryKey: ['tasks'] }).forEach(query => {
            queryClient.setQueryData(query.queryKey, applyServerUpdate);
          });
          updateAllTaskListCaches(updatedTaskFromServer);
        })
        .catch((error) => {
          console.error('[StatusChange] ❌ API update failed:', error);
          queryClient?.invalidateQueries({ queryKey: ['tasks'] });
        });
    };
    const trigger = (
      <div
        className={`px-2.5 py-1 rounded text-[11px] font-medium ${statusConfig.bg} ${statusConfig.text} cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1`}
      >
        <span>{statusConfig.label}</span>
      </div>
    );

    return (
      <TablePopover
        trigger={trigger}
        width="min-w-[140px]"
        estimatedHeight={200}
        open={activeDropdown}
        onOpen={() => setActiveDropdown(true)}
        onClose={() => setActiveDropdown(false)}
      >
        <div className="max-h-[200px] overflow-y-auto py-1">
          {statusOptions.map((option) => {
            const optionConfig = getStatusConfig(option.value);
            const textColor = optionConfig.badge.split(' ').find(cls => cls.startsWith('text-')) || optionConfig.text;

            return (
              <div
                key={option.value}
                className="px-3 py-2 hover:bg-accent cursor-pointer text-[12px] flex items-center gap-2"
                onClick={() => handleStatusChange(option.value)}
              >
                {React.createElement(option.icon, { className: `w-3.5 h-3.5 ${textColor}` })}
                <span className={`${task.status === option.value ? "font-bold" : "font-medium"} ${textColor}`}>
                  {option.label}
                </span>
                {task.status === option.value && (
                  <svg className={`w-3.5 h-3.5 ml-auto ${textColor}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </TablePopover>
    );
  };

  // Priority Dropdown Component
  const PriorityDropdown = ({ task }: { task: Task }) => {
    const [activeDropdown, setActiveDropdown] = useState(false);
    const priorityOption = priorityOptions.find(opt => opt.value === task.priority);

    const handlePriorityChange = (newPriority: string) => {
      const updatedTask = { ...task, priority: newPriority, updated_at: new Date().toISOString() };

      const applyUpdate = (old: any) => {
        if (!old) return old;
        if (old.pages) {
          const pagesWithoutTask = old.pages.map((page: any) => ({
            ...page,
            results: page.results.filter((t: Task) => t.id !== task.id),
          }));
          return {
            ...old,
            pages: [
              { ...pagesWithoutTask[0], results: [updatedTask, ...(pagesWithoutTask[0]?.results ?? [])] },
              ...pagesWithoutTask.slice(1),
            ],
          };
        }
        if (Array.isArray(old)) return [updatedTask, ...old.filter((t: Task) => t.id !== task.id)];
        if (old.tasks) return { ...old, tasks: [updatedTask, ...old.tasks.filter((t: Task) => t.id !== task.id)] };
        if (old.results) return { ...old, results: [updatedTask, ...old.results.filter((t: Task) => t.id !== task.id)] };
        return old;
      };

      // Update ALL active task cache entries (board uses ['tasks', status, priority, projectId])
      queryClient.getQueryCache().findAll({ queryKey: ['tasks'] }).forEach(query => {
        queryClient.setQueryData(query.queryKey, applyUpdate);
      });

      updateAllTaskListCaches(updatedTask);

      setActiveDropdown(false);

      taskApi.update(task.id, { priority: newPriority } as any).catch((error) => {
        console.error('[PriorityChange] ❌ API update failed:', error);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      });
    };

    const trigger = (
      <div className="flex items-center gap-1.5 text-muted-foreground cursor-pointer hover:bg-accent px-2 py-1 rounded transition-colors">
        <div className={`h-1 w-3 rounded-full ${priorityOption?.dotColor || 'bg-muted-foreground/40'}`} />
        <span className="capitalize text-[12px] text-foreground">{task.priority || 'None'}</span>
      </div>
    );

    return (
      <TablePopover
        trigger={trigger}
        width="w-32"
        estimatedHeight={180}
        open={activeDropdown}
        onOpen={() => setActiveDropdown(true)}
        onClose={() => setActiveDropdown(false)}
      >
        <div className="py-1">
          {priorityOptions.map((option) => (
            <div
              key={option.value}
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-[12px] flex items-center gap-2"
              onClick={() => handlePriorityChange(option.value)}
            >
              <span>{option.icon}</span>
              <span className={task.priority === option.value ? "font-bold text-blue-500" : "text-foreground"}>
                {option.label}
              </span>
            </div>
          ))}
        </div>
      </TablePopover>
    );
  };

  // Date Input Component
  const DateInput = ({ task, field }: { task: Task; field: 'start_date' | 'end_date' }) => {
    const handleDateChange = (value: string, e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.type === 'blur') {
        e.stopPropagation();
      }
      if (!value) return;

      const isoValue = `${value}T12:00:00Z`;

      const updatedTask = { ...task, [field]: isoValue, updated_at: new Date().toISOString() };

      const applyDateUpdate = (old: any) => {
        if (!old) return old;
        if (old.pages) {
          const pagesWithoutTask = old.pages.map((page: any) => ({
            ...page,
            results: page.results.filter((t: Task) => t.id !== task.id),
          }));
          return {
            ...old,
            pages: [
              { ...pagesWithoutTask[0], results: [updatedTask, ...(pagesWithoutTask[0]?.results ?? [])] },
              ...pagesWithoutTask.slice(1),
            ],
          };
        }
        if (Array.isArray(old)) return [updatedTask, ...old.filter((t: Task) => t.id !== task.id)];
        if (old.tasks) return { ...old, tasks: [updatedTask, ...old.tasks.filter((t: Task) => t.id !== task.id)] };
        if (old.results) return { ...old, results: [updatedTask, ...old.results.filter((t: Task) => t.id !== task.id)] };
        return old;
      };

      queryClient.getQueryCache().findAll({ queryKey: ['tasks'] }).forEach(query => {
        queryClient.setQueryData(query.queryKey, applyDateUpdate);
      });

      updateAllTaskListCaches(updatedTask);

      taskApi.update(task.id, { [field]: isoValue }).catch((error) => {
        console.error('Failed to update date:', error);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      });
    };

   const { resolvedTheme } = useTheme();
    return (
      <div className="border border-border rounded px-1.5 py-1 bg-card hover:border-blue-400 transition-all" onClick={(e) => e.stopPropagation()}>
        {(() => { try { const t = localStorage.getItem('access_token'); const p = JSON.parse(atob(t!.split('.')[1])); const r = p?.platform_roles?.pm; return r === 'pm_admin' || r === 'workspace_admin'; } catch { return false; } })() ? (
          <input
            type="date"
            value={task[field]?.split('T')[0] || ''}
            onChange={(e) => handleDateChange(e.target.value, e)}
            className="border-none bg-transparent text-[11px] p-0 cursor-pointer w-full text-foreground font-medium focus:outline-none"
            style={{ colorScheme: resolvedTheme === 'dark' ? 'dark' : 'light' }}
          />
        ) : (
          <span className="text-[11px] text-foreground font-medium py-0.5">
            {formatDate(task[field])}
          </span>
        )}
      </div>
    );
  };

  // ── Avatar-checkbox column
  const avatarCol: TableColumn<Task> | null = selectionProps ? {
    key: '__select__',
    width: '5%',
    hideControls: true,
    label: (() => {
      const allSelected = selectionProps.visibleTasks.length > 0 &&
        selectionProps.visibleTasks.every(t => selectionProps.selectedIds.has(t.id));
      return (
        <div
          onClick={e => { e.stopPropagation(); selectionProps.toggleAll(selectionProps.visibleTasks); }}
          title={allSelected ? 'Deselect all' : 'Select all'}
          style={{ width: 26, height: 26, borderRadius: 7, background: 'hsl(var(--muted))', display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'background 0.15s', flexShrink: 0 }}
        >
          {allSelected && <Check size={13} color="#fff" strokeWidth={3} />}
        </div>
      );
    })(),
    render: (task: Task) => {
      const taskType = (task as any).project_task_type || task.project_details?.task_type || '';
      const color = getTypeHex(taskType);
      const tint = getTypeBg(taskType);
      const initial = (task.project_details?.name || task.project_name || 'T')[0].toUpperCase();
      const isSel = selectionProps.selectedIds.has(task.id);
      return (
        <div
          onClick={e => { e.stopPropagation(); selectionProps.toggleSelect(task.id); }}
          title={isSel ? 'Deselect' : 'Select'}
          style={{ position: 'relative', width: 26, height: 26, borderRadius: 7, cursor: 'pointer', flexShrink: 0 }}
        >
          <div style={{ width: 26, height: 26, borderRadius: 7, background: isSel ? color : tint, border: isSel ? `1.5px solid ${color}` : `1.5px solid ${color}33`, display: 'grid', placeItems: 'center', color: isSel ? '#fff' : color, fontWeight: 800, fontSize: 12, transition: 'background 0.15s, color 0.15s' }}>
            {isSel ? <Check size={12} strokeWidth={3} /> : initial}
          </div>
          {!isSel && (
            <div
              style={{ position: 'absolute', inset: 0, borderRadius: 7, background: `${color}cc`, display: 'grid', placeItems: 'center', opacity: 0, transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0'}
            >
              <Check size={12} color="#fff" strokeWidth={3} />
            </div>
          )}
        </div>
      );
    },
  } : null;

  const baseColumns: TableColumn<Task>[] = [
    {
      key: 'project',
      label: <span className="text-[14px] font-extrabold tracking-wide text-foreground">Project</span>,
      width: '10%',
      render: (task: Task) => (
        <span
          title={task.project_details?.name || task.project_name || ''}
          style={{
            fontSize: 13, fontWeight: 700, color: 'hsl(var(--foreground))',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'block', maxWidth: 130,
          }}
        >
          {task.project_details?.name || task.project_name || '—'}
        </span>
      ),
    },
    {
      key: 'heading',
      label: <span className="text-[14px] font-extrabold tracking-wide text-foreground">Task Title</span>,
      width: '10%',
      render: (task: Task) => <TaskTitleCell task={task} queryClient={queryClient} />,
    },
    {
      key: 'status',
      label: <span className="text-[14px] font-extrabold tracking-wide text-foreground">Status</span>,
      width: '8%',
      render: (task: Task) => <StatusDropdown task={task} />,
    },
    {
      key: personField,
      label: <span className="text-[14px] font-extrabold tracking-wide text-foreground">{personField === 'assigned_to' ? 'Assignee' : personField === 'created_by' ? 'Created By' : 'Updated By'}</span>, width: '8%',
      render: (task: Task) => {
        if (personField === 'created_by') {
          // Show Created By
          const creator = task.assigned_by_user_details;
          if (!creator) {
            return <span className="text-muted-foreground/40 text-[11px]">—</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-semibold ring-1 ring-white text-white"
                style={{ background: creator.avatar ? 'transparent' : '#6366f1' }}
                title={`${creator.first_name} ${creator.last_name}`}
              >
                {creator.avatar
                  ? <img src={creator.avatar} alt={creator.first_name} className="w-full h-full object-cover" />
                  : <>{creator.first_name?.[0] || ''}{creator.last_name?.[0] || ''}</>
                }
              </div>
              <span className="text-[12px] text-foreground font-medium truncate max-w-[80px]">
                {creator.first_name} {creator.last_name?.[0]}.
              </span>
            </div>
          );
        }
        if (personField === 'updated_by') {
          // Show Updated By (who last changed the status)
          const updater = task.status_updated_by_details;
          if (!updater) {
            return <span className="text-muted-foreground/40 text-[11px]">—</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-semibold ring-1 ring-white text-white"
                style={{ background: updater.avatar ? 'transparent' : '#10b981' }}
                title={`${updater.first_name} ${updater.last_name}`}
              >
                {updater.avatar
                  ? <img src={updater.avatar} alt={updater.first_name} className="w-full h-full object-cover" />
                  : <>{updater.first_name?.[0] || ''}{updater.last_name?.[0] || ''}</>
                }
              </div>
              <span className="text-[12px] text-foreground font-medium truncate max-w-[80px]">
                {updater.first_name} {updater.last_name?.[0]}.
              </span>
            </div>
          );
        }

        // Show Assignees (default)
        const trigger = (
          <div className="flex -space-x-1.5 cursor-pointer hover:opacity-80">
            {(task.assigned_to_user_details || []).length > 0 ? (
              <>
                {(task.assigned_to_user_details || []).slice(0, 3).map((u) => (
                  <div
                    key={u.id}
                    className="w-6 h-6 rounded-full ring-1 ring-white overflow-hidden flex items-center justify-center text-[10px] font-semibold text-white"
                    style={{ background: u.avatar ? 'transparent' : '#8d87b5' }}
                    title={`${u.first_name} ${u.last_name}`}
                  >
                    {u.avatar
                      ? <img src={u.avatar} alt={u.first_name} className="w-full h-full object-cover" />
                      : <>{u.first_name?.[0]}{u.last_name?.[0]}</>
                    }
                  </div>
                ))}
                {(task.assigned_to_user_details || []).length > 3 && (
                  <div
                    className="w-6 h-6 rounded-full bg-muted-foreground text-white flex items-center justify-center text-[10px] font-semibold ring-1 ring-card"
                    title={`+${(task.assigned_to_user_details || []).length - 3} more`}
                  >
                    +{(task.assigned_to_user_details || []).length - 3}
                  </div>
                )}
              </>
            ) : (
              <span className="text-muted-foreground/40 text-[11px] pl-1">—</span>
            )}
          </div>
        );
        return (
          <TablePopover trigger={trigger}>
            <div className="p-2 border-b border-border flex justify-between items-center bg-muted rounded-t-lg">
              <span className="text-xs font-semibold text-foreground">Assignees</span>
              <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground">
                {(task.assigned_to_user_details || []).length}
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {(task.assigned_to_user_details || []).length > 0 ? (
                (task.assigned_to_user_details || []).map((u) => (
                  <div key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-accent rounded">
                    <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-semibold shrink-0 text-white"
                      style={{ background: u.avatar ? 'transparent' : '#8d87b5' }}>
                      {u.avatar
                        ? <img src={u.avatar} alt={u.first_name} className="w-full h-full object-cover" />
                        : <>{u.first_name?.[0]}{u.last_name?.[0]}</>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-foreground truncate">{u.first_name} {u.last_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate capitalize">{u.role}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-2 text-center text-xs text-muted-foreground italic">No assignees</div>
              )}
            </div>
          </TablePopover>
        );
      },
    },
    {
      key: 'priority',
      label: <span className="text-[14px] font-extrabold tracking-wide text-foreground">Priority</span>,
      width: '8%',
      render: (task: Task) => <PriorityDropdown task={task} />,
    },
    {
      key: 'labels',
      label: <span className="text-[14px] font-extrabold tracking-wide text-foreground">Labels</span>,
      width: '8%',
      render: (task: Task) => (
        <div className="flex flex-wrap gap-1.5 items-center h-full min-h-[24px]" onClick={(e) => e.stopPropagation()}>
          {task.labels && task.labels.length > 0 ? (
            task.labels.map((label) => (
              <span
                key={label.id}
                className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm whitespace-nowrap"
                style={{ backgroundColor: label.color || '#3b82f6' }}
              >
                {label.name}
              </span>
            ))
          ) : (
            <span className="text-gray-300 text-[11px] pl-1">—</span>
          )}
        </div>
      ),
    },
    {
      key: dateField,
      label: <span className="text-[14px] font-extrabold tracking-wide text-foreground">{dateField === 'end_date' ? 'Due Date' : dateField === 'start_date' ? 'Start Date' : 'Created At'}</span>,
      width: '8%',
      render: (task: Task) =>
        dateField === 'created_at'
          ? <span className="text-[13px] text-muted-foreground pl-1">{formatDate(task.created_at || '')}</span>
          : <DateInput task={task} field={dateField as 'start_date' | 'end_date'} />,
    },
    {
      key: 'updated_at',
      label: <span className="text-[14px] font-extrabold tracking-wide text-foreground">Updated</span>,
      width: '8%',
      render: (task: Task) => {
        if (!task) return <span className="text-[13px] text-muted-foreground pl-1">—</span>;
        return (
          <span className="text-[13px] text-muted-foreground pl-1" title={formatDate(task.updated_at || '')}>
            {task.updated_at ? formatRelativeTime(task.updated_at) : '—'}
          </span>
        );
      },
    },
    {
      key: 'duration',
      label: <span className="text-[14px] font-extrabold tracking-wide text-foreground">Duration</span>,
      width: '8%',
      render: (task: Task) => (
        <input
          type="text"
          defaultValue={(task as any).duration_time || (task as any).duration || ''}
          placeholder="—"
          onBlur={async (e) => {
            const val = e.target.value;
            try {
              await taskApi.update(task.id, { duration_time: val } as any);
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
            } catch (err) {
              console.error('Failed to update duration:', err);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full bg-transparent border-none text-[12px] focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5 placeholder-gray-300"
        />
      ),
    },

  ];

  return avatarCol ? [avatarCol, ...baseColumns] : baseColumns;
};