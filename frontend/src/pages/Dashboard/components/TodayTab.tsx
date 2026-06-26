import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, AlertTriangle, Loader2, Plus, CalendarDays, ChevronDown, ArrowUpDown, Layers, Check } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { CARD, TEXT, MUTED, LINE, BLUE, BG, SkeletonBlock } from '../index';
import type { DashboardTask } from '../hooks/useDashboard';
import type { Event as CalendarEvent } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import type { Document } from '@/types';
import { getFileBadge } from '@/config/statusColors';

// ── Priority config
const PRIORITY_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  high:   { color: '#EF4444', dot: '#EF4444', label: 'High' },
  medium: { color: '#F59E0B', dot: '#F59E0B', label: 'Medium' },
  low:    { color: '#9CA3AF', dot: '#9CA3AF', label: 'Low' },
};

// ── Group-by options
type GroupBy = 'priority' | 'status' | 'project' | 'none';
const GROUP_OPTIONS: { key: GroupBy; label: string; icon: React.ReactNode }[] = [
  { key: 'priority', label: 'Priority', icon: <Layers size={14} color={MUTED} /> },
  { key: 'status',   label: 'Status',   icon: <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${MUTED}`, display: 'inline-block' }} /> },
  { key: 'project',  label: 'Project',  icon: <span style={{ width: 14, height: 14, border: `1.5px solid ${MUTED}`, borderRadius: 2, display: 'inline-block' }} /> },
  { key: 'none',     label: 'None',     icon: <span style={{ fontSize: 14, color: MUTED, lineHeight: 1 }}>≡</span> },
];

// ── Sort-by options
type SortBy = 'due_time' | 'priority' | 'status';
const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'due_time', label: 'Due time' },
  { key: 'priority', label: 'Priority' },
  { key: 'status',   label: 'Status' },
];

// ── Focus filter tabs
type FocusFilter = 'today' | 'this_week' | 'assigned';

// ── Schedule day tabs
type ScheduleDay = 'today' | 'tomorrow' | 'day_after';

// ── Circular progress ring
function ProgressRing({ pct, done, total }: { pct: number; done: number; total: number }) {
  const r = 48;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={60} cy={60} r={r} fill="none" stroke="#E6EBF2" strokeWidth={10} />
        <circle
          cx={60} cy={60} r={r} fill="none"
          stroke={BLUE} strokeWidth={10}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, lineHeight: 1 }}>{done}</div>
        <div style={{ fontSize: 11, color: MUTED }}>of {total}</div>
      </div>
    </div>
  );
}

// ── Generic dropdown (non-overlapping, portal-less, absolute positioned)
function Dropdown({
  trigger,
  open,
  onClose,
  children,
}: {
  trigger: React.ReactNode;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {trigger}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 200,
          background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 180, overflow: 'hidden',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Task row in focus list
function FocusTaskRow({ task, navigate }: { task: DashboardTask; navigate: (p: string) => void }) {
  const priority = (task.priority || 'low').toLowerCase();
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.low;
  const timeStr = task.end_date
    ? new Date(task.end_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  return (
    <div
      onClick={() => navigate(`/taskboard`)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: `1px solid ${LINE}`, cursor: 'pointer', borderRadius: 6 }}
      onMouseEnter={e => (e.currentTarget.style.background = BG)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Priority bar */}
      <div style={{ width: 3, height: 36, borderRadius: 2, background: cfg.color, flexShrink: 0 }} />
      {/* Status circle */}
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${task.status === 'completed' ? '#22C55E' : '#D1D5DB'}`, flexShrink: 0 }} />
      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{task.heading}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{task.project_name || 'DYUKSA'}</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: MUTED, display: 'inline-block' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: cfg.dot }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
            {cfg.label}
          </span>
        </div>
      </div>
      {/* Time */}
      {timeStr && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: MUTED, flexShrink: 0 }}>
          <Clock size={11} color={MUTED} />
          {timeStr}
        </div>
      )}
      {/* Status badge */}
      <StatusBadge status={task.status} />
      {/* Avatars */}
      {task.assigned_to_user_details?.length > 0 && (
        <AvatarStack
          users={task.assigned_to_user_details.map(u => ({ name: u.first_name || u.username, avatar: u.avatar || null }))}
          max={2}
        />
      )}
    </div>
  );
}

// ── Schedule event block
function ScheduleEvent({ event }: { event: CalendarEvent }) {
  const start = new Date(event.start_time);
  const timeStr = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const colors = ['#EEF4FF', '#F0FDF4', '#FFF9EC', '#F5F3FF'];
  const borders = [BLUE, '#22C55E', '#F59E0B', '#8B5CF6'];
  const idx = event.id % 4;
  return (
    <div style={{ background: colors[idx], borderLeft: `3px solid ${borders[idx]}`, borderRadius: 6, padding: '8px 12px', marginBottom: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{event.title}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
        {timeStr} · {(event as any).project_name || (event as any).organizer_name || 'Team'}
      </div>
    </div>
  );
}

// ── Deadline item
function DeadlineItem({ task, today }: { task: DashboardTask; today: Date }) {
  const end = new Date(task.end_date);
  const isToday = end >= today && end < new Date(today.getTime() + 86400000);
  const isTomorrow = end >= new Date(today.getTime() + 86400000) && end < new Date(today.getTime() + 2 * 86400000);
  const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dotColor = isToday ? '#EF4444' : BLUE;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${LINE}` }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{task.heading}</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{task.project_name || 'DYUKSA'}</div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: isToday ? '#EF4444' : MUTED, flexShrink: 0 }}>{label}</span>
    </div>
  );
}

// ── Helper: sort tasks
function sortTasks(tasks: DashboardTask[], sortBy: SortBy): DashboardTask[] {
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const statusOrder: Record<string, number> = { in_progress: 0, review: 1, pending: 2, backlog: 3, completed: 4, deployed: 5, deferred: 6 };
  return [...tasks].sort((a, b) => {
    if (sortBy === 'due_time') {
      const da = a.end_date ? new Date(a.end_date).getTime() : Infinity;
      const db_ = b.end_date ? new Date(b.end_date).getTime() : Infinity;
      return da - db_;
    }
    if (sortBy === 'priority') {
      return (priorityOrder[(a.priority || 'low').toLowerCase()] ?? 2) - (priorityOrder[(b.priority || 'low').toLowerCase()] ?? 2);
    }
    if (sortBy === 'status') {
      return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    }
    return 0;
  });
}

// ── Helper: filter tasks by focus tab
function filterByFocusTab(tasks: DashboardTask[], filter: FocusFilter, today: Date): DashboardTask[] {
  const now = new Date();
  if (filter === 'today') {
    const tomorrow = new Date(today.getTime() + 86400000);
    return tasks.filter(t => !t.end_date || new Date(t.end_date) < tomorrow);
  }
  if (filter === 'this_week') {
    const weekEnd = new Date(today.getTime() + 7 * 86400000);
    return tasks.filter(t => !t.end_date || new Date(t.end_date) <= weekEnd);
  }
  // 'assigned' — all tasks (already filtered by user in useTodayTab)
  return tasks;
}

// ── Helper: group tasks
function groupTasks(tasks: DashboardTask[], groupBy: GroupBy): { key: string; label: string; color?: string; tasks: DashboardTask[] }[] {
  if (groupBy === 'priority') {
    const groups = [
      { key: 'high',   label: 'High',   color: '#EF4444', tasks: tasks.filter(t => (t.priority || 'low').toLowerCase() === 'high') },
      { key: 'medium', label: 'Medium', color: '#F59E0B', tasks: tasks.filter(t => (t.priority || 'low').toLowerCase() === 'medium') },
      { key: 'low',    label: 'Low',    color: '#9CA3AF', tasks: tasks.filter(t => !['high','medium'].includes((t.priority || 'low').toLowerCase())) },
    ];
    return groups.filter(g => g.tasks.length > 0);
  }
  if (groupBy === 'status') {
    const statusMap: Record<string, string> = {
      in_progress: 'In Progress', review: 'Review', pending: 'Pending',
      backlog: 'Backlog', completed: 'Completed', deployed: 'Deployed', deferred: 'Deferred',
    };
    const statusColors: Record<string, string> = {
      in_progress: '#6366F1', review: '#8B5CF6', pending: '#F59E0B',
      backlog: '#9CA3AF', completed: '#22C55E', deployed: '#22C55E', deferred: '#9CA3AF',
    };
    const seen = new Set<string>();
    const groups: { key: string; label: string; color?: string; tasks: DashboardTask[] }[] = [];
    tasks.forEach(t => {
      if (!seen.has(t.status)) {
        seen.add(t.status);
        groups.push({
          key: t.status,
          label: statusMap[t.status] || t.status,
          color: statusColors[t.status] || MUTED,
          tasks: tasks.filter(x => x.status === t.status),
        });
      }
    });
    return groups;
  }
  if (groupBy === 'project') {
    const seen = new Set<string>();
    const groups: { key: string; label: string; tasks: DashboardTask[] }[] = [];
    tasks.forEach(t => {
      const key = t.project_name || 'No Project';
      if (!seen.has(key)) {
        seen.add(key);
        groups.push({ key, label: key, tasks: tasks.filter(x => (x.project_name || 'No Project') === key) });
      }
    });
    return groups;
  }
  // none
  return [{ key: 'all', label: '', tasks }];
}

interface TodayTabProps {
  eventsLoading: boolean;
  tasksLoading: boolean;
  documentsLoading: boolean;
  todayEvents: CalendarEvent[];
  focusTasks: DashboardTask[];
  focusByPriority: Record<string, DashboardTask[]>;
  dueTodayTasks: DashboardTask[];
  inProgressTasks: DashboardTask[];
  overdueTasks: DashboardTask[];
  upcomingDeadlines: DashboardTask[];
  totalFocus: number;
  doneFocus: number;
  progressPct: number;
  recentActivity: Document[];
  handleDocumentClick: (doc: Document) => void;
  firstName: string;
  today: Date;
  navigate: (p: string) => void;
  greeting: string;
  // for schedule: tomorrow and day-after events from hook (optional, derived here if not passed)
  tomorrowEvents?: CalendarEvent[];
  dayAfterEvents?: CalendarEvent[];
}

export function TodayTab({
  eventsLoading, tasksLoading, documentsLoading,
  todayEvents, focusTasks,
  dueTodayTasks, inProgressTasks, overdueTasks,
  upcomingDeadlines, totalFocus, doneFocus, progressPct,
  recentActivity, handleDocumentClick,
  firstName, today, navigate, greeting,
  tomorrowEvents = [],
  dayAfterEvents = [],
}: TodayTabProps) {

  // ── Local state
  const [groupBy, setGroupBy]           = useState<GroupBy>('priority');
  const [sortBy, setSortBy]             = useState<SortBy>('due_time');
  const [focusFilter, setFocusFilter]   = useState<FocusFilter>('today');
  const [scheduleDay, setScheduleDay]   = useState<ScheduleDay>('today');
  const [groupOpen, setGroupOpen]       = useState(false);
  const [sortOpen, setSortOpen]         = useState(false);

  const totalHighPriority = focusTasks.filter(t => (t.priority || '').toLowerCase() === 'high').length;
  const todayLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ── Compute displayed tasks
  const filteredTasks = filterByFocusTab(focusTasks, focusFilter, today);
  const sortedTasks   = sortTasks(filteredTasks, sortBy);
  const groupedTasks  = groupTasks(sortedTasks, groupBy);

  // ── Schedule day labels
  const tomorrow  = new Date(today.getTime() + 86400000);
  const dayAfter  = new Date(today.getTime() + 2 * 86400000);
  const scheduleDayLabel = {
    today:     today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    tomorrow:  tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    day_after: dayAfter.toLocaleDateString('en-US', { weekday: 'short' }),
  };

  const activeScheduleEvents =
    scheduleDay === 'today'     ? todayEvents :
    scheduleDay === 'tomorrow'  ? tomorrowEvents :
    dayAfterEvents;

  // ── Shared filter-pill style
  const pill = (active: boolean) => ({
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? TEXT : MUTED,
    background: active ? '#fff' : 'transparent',
    border: `1px solid ${active ? LINE : 'transparent'}`,
    borderRadius: 7,
    padding: '4px 10px',
    cursor: 'pointer',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,.07)' : 'none',
    fontFamily: 'inherit',
    transition: 'all 0.12s',
  });

  const schedPill = (active: boolean) => ({
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    color: active ? TEXT : MUTED,
    background: active ? '#fff' : 'transparent',
    border: `1px solid ${active ? LINE : 'transparent'}`,
    borderRadius: 6,
    padding: '3px 9px',
    cursor: 'pointer',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
    fontFamily: 'inherit',
  });

  return (
    <div>
      {/* ── Greeting + New Task */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>
            {greeting}, {firstName}
          </div>
          <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>
            {todayLabel} · You have{' '}
            <strong style={{ color: TEXT }}>{dueTodayTasks.length} tasks</strong> due today.
          </div>
        </div>
        <button
          onClick={() => navigate('/taskboard/create')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 14, fontWeight: 600, color: '#fff',
            background: BLUE, border: 'none', borderRadius: 8,
            padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + New task
        </button>
      </div>

      {/* ── Progress bar card */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <ProgressRing pct={progressPct} done={doneFocus} total={totalFocus || 1} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 2 }}>Today's progress</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>
              {doneFocus} done, {totalFocus - doneFocus} to go — you're {progressPct}% through the day.
            </div>
            {/* 3 mini stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div style={{ background: BG, border: `1px solid ${LINE}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={15} color={BLUE} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{dueTodayTasks.length}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>Due today</div>
                </div>
              </div>
              <div style={{ background: BG, border: `1px solid ${LINE}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={15} color="#6366F1" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{inProgressTasks.length}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>In progress</div>
                </div>
              </div>
              <div style={{ background: BG, border: `1px solid ${LINE}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={15} color="#EF4444" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{overdueTasks.length}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>Overdue</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main 60/40 layout */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── LEFT: Today's Focus (60%) */}
        <div style={{ ...CARD, padding: '20px 22px', flex: '0 0 60%', minWidth: 0 }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Today's Focus</span>
              <span style={{ fontSize: 13, color: MUTED }}>{filteredTasks.length} left</span>
              {totalHighPriority > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', background: '#FEF2F2', borderRadius: 20, padding: '2px 8px' }}>
                  {totalHighPriority} high
                </span>
              )}
            </div>
            {/* Filter pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: BG, borderRadius: 8, padding: 3 }}>
              {(['today', 'this_week', 'assigned'] as FocusFilter[]).map((f, i) => (
                <button
                  key={f}
                  onClick={() => setFocusFilter(f)}
                  style={pill(focusFilter === f)}
                >
                  {f === 'today' ? 'Today' : f === 'this_week' ? 'This week' : 'Assigned to me'}
                </button>
              ))}
            </div>
          </div>

          {/* Toolbar: Group + Sort */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>

            {/* Group by dropdown */}
            <Dropdown
              open={groupOpen}
              onClose={() => setGroupOpen(false)}
              trigger={
                <button
                  onClick={() => { setGroupOpen(v => !v); setSortOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
                    color: MUTED, background: '#fff', border: `1px solid ${LINE}`,
                    borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Layers size={13} color={MUTED} />
                  Group: {GROUP_OPTIONS.find(g => g.key === groupBy)?.label}
                  <ChevronDown size={11} color={MUTED} />
                </button>
              }
            >
              <div style={{ padding: '6px 0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, padding: '6px 14px 4px', letterSpacing: '0.06em' }}>
                  GROUP TASKS BY
                </div>
                {GROUP_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setGroupBy(opt.key); setGroupOpen(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px', border: 'none', background: groupBy === opt.key ? '#F7F8FB' : '#fff',
                      cursor: 'pointer', fontSize: 14, color: TEXT, fontFamily: 'inherit',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {opt.icon}
                      {opt.label}
                    </span>
                    {groupBy === opt.key && <Check size={14} color={BLUE} />}
                  </button>
                ))}
              </div>
            </Dropdown>

            {/* Sort by dropdown */}
            <Dropdown
              open={sortOpen}
              onClose={() => setSortOpen(false)}
              trigger={
                <button
                  onClick={() => { setSortOpen(v => !v); setGroupOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
                    color: MUTED, background: '#fff', border: `1px solid ${LINE}`,
                    borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <ArrowUpDown size={13} color={MUTED} />
                  Sort: {SORT_OPTIONS.find(s => s.key === sortBy)?.label}
                  <ChevronDown size={11} color={MUTED} />
                </button>
              }
            >
              <div style={{ padding: '6px 0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, padding: '6px 14px 4px', letterSpacing: '0.06em' }}>
                  SORT BY
                </div>
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortBy(opt.key); setSortOpen(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 14px', border: 'none', background: sortBy === opt.key ? '#F7F8FB' : '#fff',
                      cursor: 'pointer', fontSize: 14, color: TEXT, fontFamily: 'inherit', gap: 10,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {opt.key === 'due_time' && <Clock size={14} color={MUTED} />}
                      {opt.key === 'priority' && <span style={{ width: 14, height: 14, borderRadius: 2, border: `1.5px solid ${MUTED}`, display: 'inline-block' }} />}
                      {opt.key === 'status'   && <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${MUTED}`, display: 'inline-block' }} />}
                      {opt.label}
                    </span>
                    {sortBy === opt.key && <Check size={14} color={BLUE} />}
                  </button>
                ))}
              </div>
            </Dropdown>
          </div>

          {/* Task list */}
          {tasksLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0' }}>
                  <div style={SkeletonBlock({ width: 3, height: 36, borderRadius: 2 })} />
                  <div style={SkeletonBlock({ width: 18, height: 18, borderRadius: '50%' })} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={SkeletonBlock({ width: '60%', height: 14 })} />
                    <div style={SkeletonBlock({ width: '30%', height: 11 })} />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontSize: 14 }}>
              🎉 No tasks for today — great job!
            </div>
          ) : (
            <>
              {groupBy === 'none' ? (
                sortedTasks.map(task => (
                  <FocusTaskRow key={task.id} task={task} navigate={navigate} />
                ))
              ) : (
                groupedTasks.map(group => (
                  <div key={group.key} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '4px 8px' }}>
                      {group.color && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{group.label}</span>
                      <span style={{ fontSize: 12, color: MUTED }}>{group.tasks.length}</span>
                    </div>
                    {group.tasks.map(task => (
                      <FocusTaskRow key={task.id} task={task} navigate={navigate} />
                    ))}
                  </div>
                ))
              )}
            </>
          )}

          {/* Add a task */}
          <button
            onClick={() => navigate('/taskboard/create')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
              color: MUTED, background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 8px', marginTop: 4, fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = BLUE)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
          >
            <Plus size={14} />
            Add a task
          </button>
        </div>

        {/* ── RIGHT: Schedule + Deadlines + Recent Activity (40%) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '1 1 0', minWidth: 0 }}>

          {/* Schedule card */}
          <div style={{ ...CARD, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Schedule</span>
              {/* Day pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: BG, borderRadius: 7, padding: 3 }}>
                {([
                  { key: 'today'     as ScheduleDay, label: 'Today' },
                  { key: 'tomorrow'  as ScheduleDay, label: 'Tomorrow' },
                  { key: 'day_after' as ScheduleDay, label: dayAfter.toLocaleDateString('en-US', { weekday: 'short' }) },
                ]).map(d => (
                  <button
                    key={d.key}
                    onClick={() => setScheduleDay(d.key)}
                    style={schedPill(scheduleDay === d.key)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
              {scheduleDayLabel[scheduleDay]} · {activeScheduleEvents.length} event{activeScheduleEvents.length !== 1 ? 's' : ''}
            </div>

            {eventsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <div key={i} style={SkeletonBlock({ width: '100%', height: 52, borderRadius: 6 })} />)}
              </div>
            ) : activeScheduleEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: MUTED, fontSize: 13 }}>
                No events {scheduleDay === 'today' ? 'today' : scheduleDay === 'tomorrow' ? 'tomorrow' : 'that day'}
              </div>
            ) : (
              activeScheduleEvents.map(event => <ScheduleEvent key={event.id} event={event} />)
            )}

            <Link
              to="/calendar"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 13, color: MUTED, textDecoration: 'none', marginTop: 12,
                padding: '8px 0', borderTop: `1px solid ${LINE}`,
              }}
            >
              <CalendarDays size={13} />
              Open full calendar
            </Link>
          </div>

          {/* Upcoming deadlines card */}
          <div style={{ ...CARD, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Upcoming deadlines</span>
              <Link to="/taskboard" style={{ fontSize: 13, fontWeight: 600, color: BLUE, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                All <ArrowRight size={12} />
              </Link>
            </div>

            {tasksLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <div key={i} style={SkeletonBlock({ width: '100%', height: 36, borderRadius: 4 })} />)}
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: MUTED, fontSize: 13 }}>No upcoming deadlines</div>
            ) : (
              upcomingDeadlines.map(task => (
                <DeadlineItem key={task.id} task={task} today={today} />
              ))
            )}
          </div>

          {/* Recent activity card */}
          <div style={{ ...CARD, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Recent activity</span>
            </div>

            {documentsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={SkeletonBlock({ width: 36, height: 36, borderRadius: 8, style: { flexShrink: 0 } })} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={SkeletonBlock({ width: '70%', height: 13 })} />
                      <div style={SkeletonBlock({ width: '40%', height: 11 })} />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.slice(0, 3).map((doc, i) => {
              const badge = getFileBadge(doc.name);
              return (
                <div
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 0', borderBottom: i < 2 ? `1px solid ${LINE}` : 'none', cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = BG)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: badge.color }}>{badge.label}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{doc.name}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{doc.updated_at ? formatRelativeTime(doc.updated_at) : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}