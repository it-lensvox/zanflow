import { useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { eventApi } from '@/services/api';
import type { DashboardTask } from './useDashboard';
import type { Event as CalendarEvent } from '@/types';

export function useTodayTab(allTasks: DashboardTask[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-dashboard'] });
    };
    window.addEventListener('aibot:standup-created', handler);
    return () => window.removeEventListener('aibot:standup-created', handler);
  }, [queryClient]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const tomorrowStr = useMemo(() => {
    const d = new Date(today.getTime() + 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [today]);

  const dayAfterStr = useMemo(() => {
    const d = new Date(today.getTime() + 2 * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [today]);

  // Fetch today's events
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['events-today', todayStr],
    queryFn: () => eventApi.list({ start_date: todayStr, end_date: todayStr }),
    staleTime: 1000 * 60,
  });

  // Fetch tomorrow's events
  const { data: tomorrowEventsData } = useQuery({
    queryKey: ['events-tomorrow', tomorrowStr],
    queryFn: () => eventApi.list({ start_date: tomorrowStr, end_date: tomorrowStr }),
    staleTime: 1000 * 60,
  });

  // Fetch day-after-tomorrow's events
  const { data: dayAfterEventsData } = useQuery({
    queryKey: ['events-day-after', dayAfterStr],
    queryFn: () => eventApi.list({ start_date: dayAfterStr, end_date: dayAfterStr }),
    staleTime: 1000 * 60,
  });

  const todayEvents: CalendarEvent[] = useMemo(() => {
    const raw = eventsData?.results || eventsData || [];
    return Array.isArray(raw)
      ? raw
          .filter((e: CalendarEvent) => {
            const start = new Date(e.start_time);
            return start >= today && start < new Date(today.getTime() + 86400000);
          })
          .sort((a: CalendarEvent, b: CalendarEvent) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          )
      : [];
  }, [eventsData, today]);

  const tomorrowEvents: CalendarEvent[] = useMemo(() => {
    const raw = tomorrowEventsData?.results || tomorrowEventsData || [];
    const tStart = new Date(today.getTime() + 86400000);
    const tEnd   = new Date(today.getTime() + 2 * 86400000);
    return Array.isArray(raw)
      ? raw
          .filter((e: CalendarEvent) => {
            const s = new Date(e.start_time);
            return s >= tStart && s < tEnd;
          })
          .sort((a: CalendarEvent, b: CalendarEvent) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          )
      : [];
  }, [tomorrowEventsData, today]);

  const dayAfterEvents: CalendarEvent[] = useMemo(() => {
    const raw = dayAfterEventsData?.results || dayAfterEventsData || [];
    const dStart = new Date(today.getTime() + 2 * 86400000);
    const dEnd   = new Date(today.getTime() + 3 * 86400000);
    return Array.isArray(raw)
      ? raw
          .filter((e: CalendarEvent) => {
            const s = new Date(e.start_time);
            return s >= dStart && s < dEnd;
          })
          .sort((a: CalendarEvent, b: CalendarEvent) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          )
      : [];
  }, [dayAfterEventsData, today]);

  // My tasks
  const myTasks = useMemo(
    () =>
      allTasks.filter(
        t => user?.id && (t.assigned_to || []).some(id => String(id) === String(user.id))
      ),
    [allTasks, user]
  );

  const now = new Date();

  // Due today
  const dueTodayTasks = useMemo(
    () =>
      myTasks.filter(t => {
        if (!t.end_date) return false;
        const d = new Date(t.end_date);
        return (
          d >= today &&
          d < new Date(today.getTime() + 86400000) &&
          t.status !== 'completed' &&
          t.status !== 'deployed'
        );
      }),
    [myTasks, today]
  );

  // In progress
  const inProgressTasks = useMemo(
    () => myTasks.filter(t => t.status === 'in_progress'),
    [myTasks]
  );

  // Overdue
  const overdueTasks = useMemo(
    () =>
      myTasks.filter(
        t =>
          t.end_date &&
          new Date(t.end_date) < now &&
          t.status !== 'completed' &&
          t.status !== 'deployed'
      ),
    [myTasks]
  );

  // Today's focus: due today + in progress, deduped
  const focusTasks = useMemo(() => {
    const seen = new Set<number>();
    const tasks: DashboardTask[] = [];
    [...dueTodayTasks, ...inProgressTasks].forEach(t => {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        tasks.push(t);
      }
    });
    return tasks;
  }, [dueTodayTasks, inProgressTasks]);

  // Group focus tasks by priority (kept for backward compat)
  const focusByPriority = useMemo(() => {
    const groups: Record<string, DashboardTask[]> = { high: [], medium: [], low: [] };
    focusTasks.forEach(t => {
      const p = (t.priority || 'low').toLowerCase();
      if (groups[p]) groups[p].push(t);
      else groups['low'].push(t);
    });
    return groups;
  }, [focusTasks]);

  // Progress
  const completedToday = useMemo(
    () =>
      myTasks.filter(t => {
        if (t.status !== 'completed' && t.status !== 'deployed') return false;
        const updated = t.updated_at || t.created_at;
        if (!updated) return false;
        const d = new Date(updated);
        return d >= today && d < new Date(today.getTime() + 86400000);
      }),
    [myTasks, today]
  );

  const totalFocus = focusTasks.length + completedToday.length;
  const doneFocus  = completedToday.length;
  const progressPct = totalFocus > 0 ? Math.round((doneFocus / totalFocus) * 100) : 0;

  // Upcoming deadlines: next 7 days
  const upcomingDeadlines = useMemo(() => {
    const _weekOut = new Date(today.getTime() + 7 * 86400000);
    return myTasks
      .filter(t => t.end_date && t.status !== 'completed' && t.status !== 'deployed')
      .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
      .slice(0, 6);
  }, [myTasks, today]);

  const scheduleHours = Array.from({ length: 10 }, (_, i) => i + 9);

  return {
    eventsLoading,
    todayEvents,
    tomorrowEvents,
    dayAfterEvents,
    focusTasks,
    focusByPriority,
    dueTodayTasks,
    inProgressTasks,
    overdueTasks,
    completedToday,
    upcomingDeadlines,
    totalFocus,
    doneFocus,
    progressPct,
    scheduleHours,
    today,
    todayStr,
  };
}