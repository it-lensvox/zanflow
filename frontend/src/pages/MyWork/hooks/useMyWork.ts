import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi, eventApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { isOverdue, isToday } from '../myWorkConstants';

export function useMyWork() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rescheduleEvent, setRescheduleEvent] = useState<any>(null);

  const { data: tasksResponse, isLoading: tasksLoading } = useQuery({
    queryKey: ['my-work-tasks'],
    queryFn: () => taskApi.list({ disable_pagination: true }),
  });

  const allTasks: any[] = useMemo(() => {
    return tasksResponse?.tasks || tasksResponse?.results || (Array.isArray(tasksResponse) ? tasksResponse : []);
  }, [tasksResponse]);

  const myTasks: any[] = useMemo(() => {
    if (!user?.id) return allTasks;
    return allTasks.filter((t: any) =>
      (t.assigned_to || []).some((id: any) => String(id) === String(user.id))
    );
  }, [allTasks, user]);

  const activeTask = useMemo(() => myTasks.find((t: any) => t.status === 'in_progress'), [myTasks]);

  const focusProgress = useMemo(() => {
    if (!activeTask) return 0;
    const projectTasks = myTasks.filter((t: any) =>
      String((t as any).project) === String((activeTask as any).project)
    );
    if (projectTasks.length === 0) return 0;
    const done = projectTasks.filter((t: any) => t.status === 'completed' || t.status === 'deployed').length;
    return Math.round((done / projectTasks.length) * 100);
  }, [activeTask, myTasks]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // ── Queries
  const { data: eventsResponse, isLoading: eventsLoading } = useQuery({
    queryKey: ['my-work-events', todayStr],
    queryFn: () => eventApi.list({ start_date: todayStr, end_date: todayStr }),
    staleTime: 0,
  });

  // ── Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: ({ id, start_time, end_time }: { id: number; start_time: string; end_time: string }) =>
      eventApi.update(id, { start_time, end_time } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-work-events'] });
      setRescheduleEvent(null);
    },
  });

  // ── Derived data

  // Today's meetings/events
  const todayMeetings: any[] = useMemo(() => {
    const raw = eventsResponse?.results || eventsResponse?.events || (Array.isArray(eventsResponse) ? eventsResponse : []);
    return raw
      .filter((ev: any) => isToday(ev.start_time) || isToday(ev.start_date))
      .sort((a: any, b: any) => {
        const aTime = new Date(a.start_time || a.start_date).getTime();
        const bTime = new Date(b.start_time || b.start_date).getTime();
        return aTime - bTime;
      });
  }, [eventsResponse]);

  // Tasks due today
  const tasksDueToday: any[] = useMemo(() => {
    return myTasks.filter((t: any) => {
      if (!t.end_date) return false;
      return isToday(t.end_date);
    });
  }, [myTasks]);

  // Merge meetings + tasks, sorted by time
  const scheduleItems: any[] = useMemo(() => {
    const meetings = todayMeetings.map((ev: any) => ({ ...ev, _type: 'meeting', _sortTime: new Date(ev.start_time || ev.start_date).getTime() }));
    const tasks = tasksDueToday.map((t: any) => ({ ...t, _type: 'task', _sortTime: new Date(t.end_date).getTime() }));
    return [...meetings, ...tasks].sort((a, b) => a._sortTime - b._sortTime);
  }, [todayMeetings, tasksDueToday]);

  const assignedToMe = useMemo(() => {
    const priority = (t: any) => {
      if (t.status === 'in_progress') return 0;
      if (isOverdue(t)) return 1;
      if (t.status === 'pending' || t.status === 'backlog') return 2;
      if (t.status === 'completed' || t.status === 'deployed') return 3;
      return 4;
    };
    return [...myTasks].sort((a, b) => priority(a) - priority(b)).slice(0, 6);
  }, [myTasks]);

  const isLoading = tasksLoading || eventsLoading;

  return {
    today,
    myTasks,
    activeTask,
    focusProgress,
    scheduleItems,
    assignedToMe,
    isLoading,
    rescheduleEvent,
    setRescheduleEvent,
    rescheduleMutation,
  };
}