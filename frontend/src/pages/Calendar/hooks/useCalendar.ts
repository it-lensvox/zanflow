import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { taskApi, eventApi, calendarShareApi, notificationSocket, dyuksaAI } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { Task, Event as CalendarEventType } from '@/types';
import {
    toLocalDateStr,
    type CalendarDay,
    type TaskStats,
} from '../calendarConstants';

export interface DyuksaEventData {
    eventType: string;
    title: string;
    attendeeIds: number[];
    attendeeNames: string[];
    targetDate: string;
    suggestedSlots: string[];
    duration: number;
}

export interface ContextMenu {
    x: number;
    y: number;
    event: CalendarEventType;
}

export function useCalendar() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    // ─── UI State
    const [currentDate, setCurrentDate]       = useState(new Date());
    const [viewMode, setViewMode]              = useState<'day' | 'work_week' | 'week' | 'month'>('work_week');
    const [selectedDate, setSelectedDate]      = useState<Date | null>(null);
    const [selectedTask, setSelectedTask]      = useState<Task | null>(null);
    const [selectedEvent, setSelectedEvent]    = useState<CalendarEventType | null>(null);
    const [selectedHour, setSelectedHour]      = useState<number | null>(null);
    const [isEventModalOpen, setIsEventModalOpen]   = useState(false);
    const [isShareModalOpen, setIsShareModalOpen]   = useState(false);
    const [isSettingsOpen, setIsSettingsOpen]       = useState(false);
    const [includeSharedEvents, setIncludeSharedEvents] = useState(false);
    const [selectedUserIds, setSelectedUserIds]     = useState<number[]>([]);
    const [dyuksaInput, setDyuksaInput]         = useState('');
    const [dyuksaResponse, setDyuksaResponse]   = useState<string | null>(null);
    const [isDyuksaLoading, setIsDyuksaLoading] = useState(false);
    const [dyuksaEventData, setDyuksaEventData] = useState<DyuksaEventData | null>(null);
    const [contextMenu, setContextMenu]         = useState<ContextMenu | null>(null);
    const [showRepeatSubmenu, setShowRepeatSubmenu] = useState(false);
    const [showDeclineModal, setShowDeclineModal]   = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [selectedInvitationEvent, setSelectedInvitationEvent] = useState<CalendarEventType | null>(null);
    const [seenEventIds, setSeenEventIds] = useState<number[]>(() => {
        const saved = localStorage.getItem('seen_event_notifications');
        return saved ? JSON.parse(saved) : [];
    });

    // ─── Mutations
    const { mutate: updateEventMutation } = useMutation({
        mutationFn: (data: Partial<CalendarEventType>) => eventApi.update(data.id!, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events-calendar'] }),
        onError: (err: any) => alert(err.response?.data?.detail || 'Failed to reschedule event.'),
    });

    const { mutate: acceptInvitation, isPending: isAccepting } = useMutation({
        mutationFn: (invitationId: number) => eventApi.acceptInvitation(invitationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            setIsEventModalOpen(false);
            setSelectedEvent(null);
        },
        onError: (err: any) => alert(err.response?.data?.detail || 'Failed to accept invitation.'),
    });

    const { mutate: declineInvitation, isPending: isDeclining } = useMutation({
        mutationFn: ({ invitationId, reason }: { invitationId: number; reason: string }) =>
            eventApi.declineInvitation(invitationId, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            setShowDeclineModal(false);
            setSelectedInvitationEvent(null);
            setIsEventModalOpen(false);
            setSelectedEvent(null);
        },
        onError: (err: any) => alert(err.response?.data?.detail || 'Failed to decline invitation.'),
    });

    const { mutate: rescheduleInvitation, isPending: isRescheduling } = useMutation({
        mutationFn: ({ invitationId, proposedTime }: { invitationId: number; proposedTime: string }) =>
            eventApi.rescheduleInvitation(invitationId, proposedTime),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            setShowRescheduleModal(false);
            setSelectedInvitationEvent(null);
            setIsEventModalOpen(false);
            setSelectedEvent(null);
        },
        onError: (err: any) => alert(err.response?.data?.detail || 'Failed to propose new time.'),
    });

    // ─── Data Queries
    const {
        data: eventsData,
        fetchNextPage: fetchNextEventsPage,
        hasNextPage: hasNextEventsPage,
        isFetchingNextPage: isFetchingNextEventsPage,
    } = useInfiniteQuery({
        queryKey: ['events-calendar', currentDate.getFullYear(), currentDate.getMonth(), includeSharedEvents],
        queryFn: async ({ pageParam = 1 }) => {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const firstDay = new Date(year, month, -7).toISOString().split('T')[0];
            const lastDay  = new Date(year, month + 1, 7).toISOString().split('T')[0];
            return eventApi.list({ start_date: firstDay, end_date: lastDay, page: pageParam, include_shared: includeSharedEvents });
        },
        getNextPageParam: (lastPage: any) => {
            if (lastPage?.next) {
                const url = new URL(lastPage.next);
                const p   = url.searchParams.get('page');
                return p ? Number(p) : undefined;
            }
            return undefined;
        },
        initialPageParam: 1,
        enabled: !!user,
    });

    const {
        data: tasksData,
        isLoading,
        fetchNextPage: fetchNextTasksPage,
        hasNextPage: hasNextTasksPage,
        isFetchingNextPage: isFetchingNextTasksPage,
    } = useInfiniteQuery({
        queryKey: ['tasks-calendar', currentDate.getFullYear(), currentDate.getMonth()],
        queryFn: async ({ pageParam = 1 }) => {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const firstDay = new Date(year, month, -7).toISOString().split('T')[0];
            const lastDay  = new Date(year, month + 1, 7).toISOString().split('T')[0];
            return taskApi.list({ start_date__gte: firstDay, end_date__lte: lastDay, page: pageParam });
        },
        getNextPageParam: (lastPage: any) => {
            if (lastPage?.next) {
                const url = new URL(lastPage.next);
                const p   = url.searchParams.get('page');
                return p ? Number(p) : undefined;
            }
            return undefined;
        },
        initialPageParam: 1,
        enabled: !!user,
    });

    const { data: sharedWithMeUsers = [] } = useQuery({
        queryKey: ['calendar-shares-received'],
        queryFn: async () => {
            const response   = await calendarShareApi.list();
            const sharesWithMe = response.filter((share: any) => share.shared_with === user?.id);
            const users = sharesWithMe.map((share: any) => ({
                id: share.owner, name: share.owner_name, email: share.owner_email,
            }));
            return users.filter((u: any, i: number, self: any[]) =>
                i === self.findIndex((x) => x.id === u.id)
            );
        },
        enabled: !!user && includeSharedEvents,
    });

    // ─── Paginate all pages automatically
    useEffect(() => {
        if (hasNextEventsPage && !isFetchingNextEventsPage) fetchNextEventsPage();
    }, [hasNextEventsPage, isFetchingNextEventsPage, fetchNextEventsPage]);

    useEffect(() => {
        if (hasNextTasksPage && !isFetchingNextTasksPage) fetchNextTasksPage();
    }, [hasNextTasksPage, isFetchingNextTasksPage, fetchNextTasksPage]);

    // ─── Derived data
    const events = useMemo(() => {
        if (!eventsData) return [];
        return eventsData.pages.flatMap((page: any) => page.results || page);
    }, [eventsData]);

    const filteredEvents = useMemo(() => {
        if (!includeSharedEvents) return events;
        if (selectedUserIds.length === 0) return events.filter((e: CalendarEventType) => e.organizer === user?.id);
        return events.filter((event: CalendarEventType) => {
            const isMyEvent = event.organizer === user?.id;
            const isSelectedUserInvolved =
                selectedUserIds.includes(event.organizer) ||
                event.attendees?.some(id => selectedUserIds.includes(id));
            return isMyEvent || isSelectedUserInvolved;
        });
    }, [events, includeSharedEvents, selectedUserIds, user?.id]);

    const tasks = useMemo(() => {
        if (!tasksData || !user) return [];
        const allTasks = tasksData.pages.flatMap((page: any) => page.results || page.tasks || page);
        if (user.role === 'admin') return allTasks;
        if (user.role === 'manager') return allTasks.filter((t: Task) => t.assigned_by === user.id || t.assigned_to.includes(user.id));
        return allTasks.filter((t: Task) => t.assigned_to.includes(user.id));
    }, [tasksData, user]);

    const taskStats: TaskStats = useMemo(() => ({
        total:      tasks.length,
        completed:  tasks.filter((t: Task) => t.status.toLowerCase() === 'completed').length,
        inProgress: tasks.filter((t: Task) => t.status.toLowerCase() === 'in_progress').length,
        pending:    tasks.filter((t: Task) => t.status.toLowerCase() === 'pending').length,
    }), [tasks]);

    const calendarDays: CalendarDay[] = useMemo(() => {
        const year  = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth  = new Date(year, month + 1, 0);
        const startDate = new Date(firstDayOfMonth);
        startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
        const endDate = new Date(lastDayOfMonth);
        endDate.setDate(endDate.getDate() + (6 - lastDayOfMonth.getDay()));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days: CalendarDay[] = [];
        const iter = new Date(startDate);

        while (iter <= endDate) {
            const dateStr = toLocalDateStr(iter.toISOString());
            const dayTasks = tasks.filter((task: Task) => {
                const s = toLocalDateStr(task.start_date);
                const e = toLocalDateStr(task.end_date);
                if (s && e) return dateStr >= s && dateStr <= e;
                return s === dateStr || e === dateStr;
            });
            const dayEvents = filteredEvents.filter((event: CalendarEventType) => {
                const s = toLocalDateStr(event.start_time);
                const e = toLocalDateStr(event.end_time);
                if (s && e) return dateStr >= s && dateStr <= e;
                return s === dateStr || e === dateStr;
            });
            days.push({
                date: new Date(iter),
                isCurrentMonth: iter.getMonth() === month,
                isToday: iter.toDateString() === today.toDateString(),
                tasks: dayTasks,
                events: dayEvents,
            });
            iter.setDate(iter.getDate() + 1);
        }
        return days;
    }, [currentDate, tasks, filteredEvents]);

    // ─── Selected date items
    const selectedDateTasks = useMemo(() => {
        if (!selectedDate) return [];
        const dateStr = toLocalDateStr(selectedDate.toISOString());
        return tasks.filter((task: Task) => {
            const s = toLocalDateStr(task.start_date);
            const e = toLocalDateStr(task.end_date);
            if (s && e) return dateStr >= s && dateStr <= e;
            return s === dateStr || e === dateStr;
        });
    }, [selectedDate, tasks]);

    const selectedDateEvents = useMemo(() => {
        if (!selectedDate) return [];
        const dateStr = toLocalDateStr(selectedDate.toISOString());
        return events.filter((event: CalendarEventType) => {
            const s = toLocalDateStr(event.start_time);
            const e = toLocalDateStr(event.end_time);
            if (s && e) return dateStr >= s && dateStr <= e;
            return s === dateStr || e === dateStr;
        });
    }, [selectedDate, events]);

    // ─── RSVP Status for organizer events
    const myOrganizedEvents = useMemo(
        () => events.filter((e: CalendarEventType) => e.my_invitation_status === 'ORGANIZER'),
        [events]
    );

    const { data: rsvpStatusMap = {} } = useQuery<Record<number, any[]>>({
        queryKey: ['events-rsvp-bulk', myOrganizedEvents.map((e: CalendarEventType) => e.id).sort().join(',')],
        queryFn: async () => {
            if (myOrganizedEvents.length === 0) return {};
            const results = await Promise.all(
                myOrganizedEvents.map(async (event: CalendarEventType) => {
                    try {
                        const rsvp = await eventApi.getEventRsvpStatus(event.id);
                        return { eventId: event.id, attendee_status: rsvp.attendee_status || [] };
                    } catch { return { eventId: event.id, attendee_status: [] }; }
                })
            );
            const map: Record<number, any[]> = {};
            results.forEach(r => { map[r.eventId] = r.attendee_status; });
            return map;
        },
        enabled: myOrganizedEvents.length > 0,
        staleTime: 30000,
        refetchInterval: 30000,
        refetchIntervalInBackground: false,
    });

    // ─── WebSocket listeners
    useEffect(() => {
        const unsubscribe = notificationSocket.onNotification((notification) => {
            if (notification.related_object?.type === 'event') {
                queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
                queryClient.invalidateQueries({ queryKey: ['events-rsvp-bulk'] });
            }
        });
        return () => unsubscribe();
    }, [queryClient]);

    useEffect(() => {
        const handler = () => queryClient.invalidateQueries({ queryKey: ['dailyUpdate'] });
        window.addEventListener('aibot:standup-created', handler);
        return () => window.removeEventListener('aibot:standup-created', handler);
    }, [queryClient]);

    // ─── Auto-open event from URL param
    useEffect(() => {
        const eventId = searchParams.get('eventId');
        if (eventId && events.length > 0) {
            const eventToOpen = events.find((e: CalendarEventType) => String(e.id) === eventId);
            if (eventToOpen) {
                setSelectedEvent(eventToOpen);
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('eventId');
                setSearchParams(newParams, { replace: true });
            }
        }
    }, [searchParams, events, setSearchParams]);

    // ─── Auto-clear Dyuksa response after 5s
    useEffect(() => {
        if (dyuksaResponse) {
            const timer = setTimeout(() => setDyuksaResponse(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [dyuksaResponse]);

    // ─── Navigation
    const navigateDate = useCallback((direction: 'prev' | 'next') => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            if (viewMode === 'month') d.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
            else if (viewMode === 'day') d.setDate(prev.getDate() + (direction === 'next' ? 1 : -1));
            else d.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
            return d;
        });
    }, [viewMode]);

    const goToToday = useCallback(() => setCurrentDate(new Date()), []);

    // ─── Event Handlers
    const handleTaskClick = useCallback((task: Task) => setSelectedTask(task), []);

    const handleEventClick = useCallback((event: CalendarEventType) => {
        setSelectedEvent(event);
        setIsEventModalOpen(true);
        setSeenEventIds(prev => {
            if (!prev.includes(event.id)) {
                const newSeen = [...prev, event.id];
                localStorage.setItem('seen_event_notifications', JSON.stringify(newSeen));
                return newSeen;
            }
            return prev;
        });
    }, []);

    const handleDateClick = useCallback((date: Date) => setSelectedDate(date), []);

    const handleAcceptInvitation = useCallback((invitationId: number) => {
        acceptInvitation(invitationId);
    }, [acceptInvitation]);

    const handleDeclineClick = useCallback((event: CalendarEventType) => {
        setSelectedInvitationEvent(event);
        setShowDeclineModal(true);
    }, []);

    const handleRescheduleClick = useCallback((event: CalendarEventType) => {
        setSelectedInvitationEvent(event);
        setShowRescheduleModal(true);
    }, []);

    const handleDeclineSubmit = useCallback((reason: string) => {
        if (selectedInvitationEvent?.my_invitation_id) {
            declineInvitation({ invitationId: selectedInvitationEvent.my_invitation_id, reason });
        }
    }, [selectedInvitationEvent, declineInvitation]);

    const handleRescheduleSubmit = useCallback((proposedTime: string) => {
        if (selectedInvitationEvent?.my_invitation_id) {
            rescheduleInvitation({ invitationId: selectedInvitationEvent.my_invitation_id, proposedTime });
        }
    }, [selectedInvitationEvent, rescheduleInvitation]);

    // ─── Dyuksa AI
    const handleDyuksaSubmit = async () => {
        if (!dyuksaInput.trim()) return;
        if (!dyuksaInput.toLowerCase().startsWith('dyuksa')) {
            setDyuksaResponse('Please start your message with "dyuksa" to use the AI assistant.');
            return;
        }
        setIsDyuksaLoading(true);
        setDyuksaResponse(null);
        try {
            const response = await dyuksaAI.chat(dyuksaInput);
            if (response.action === 'create_event' && response.data) {
                setDyuksaEventData({
                    eventType:      response.data.event_type || 'Meeting',
                    title:          response.data.title || '',
                    attendeeIds:    response.data.attendee_ids || [],
                    attendeeNames:  response.data.attendee_names || [],
                    targetDate:     response.data.target_date || new Date().toISOString().split('T')[0],
                    suggestedSlots: response.data.available_slots || [],
                    duration:       response.data.duration_minutes || 30,
                });
                if (response.data.target_date) setSelectedDate(new Date(response.data.target_date));
                setSelectedEvent(null);
                setIsEventModalOpen(true);
                setDyuksaInput('');
                setDyuksaResponse(response.reply || 'Opening event creator with your preferences...');
            } else {
                setDyuksaResponse(response.reply);
            }
        } catch (error) {
            console.error('Dyuksa AI error:', error);
            setDyuksaResponse('Sorry, I encountered an error. Please try again.');
        } finally {
            setIsDyuksaLoading(false);
        }
    };

    // ─── Context Menu
    const handleEventContextMenu = useCallback((e: React.MouseEvent, event: CalendarEventType) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, event });
        setShowRepeatSubmenu(false);
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
        setShowRepeatSubmenu(false);
    }, []);

    useEffect(() => {
        if (contextMenu) {
            const handler = () => closeContextMenu();
            document.addEventListener('click', handler);
            return () => document.removeEventListener('click', handler);
        }
    }, [contextMenu, closeContextMenu]);

    const handleRepeatEvent = async (repeatType: 'daily' | 'workday' | 'weekly' | 'monthly' | 'yearly') => {
        if (!contextMenu?.event) return;
        const orig = contextMenu.event;
        const startDate = new Date(orig.start_time);
        const endDate   = new Date(startDate);
        let recurrencePattern: string;
        switch (repeatType) {
            case 'daily':   recurrencePattern = 'DAILY';     endDate.setDate(startDate.getDate() + 30);   break;
            case 'workday': recurrencePattern = 'WORK_WEEK'; endDate.setDate(startDate.getDate() + 30);   break;
            case 'weekly':  recurrencePattern = 'WEEKLY';    endDate.setDate(startDate.getDate() + 84);   break;
            case 'monthly': recurrencePattern = 'MONTHLY';   endDate.setMonth(startDate.getMonth() + 6);  break;
            case 'yearly':  recurrencePattern = 'YEARLY';    endDate.setFullYear(startDate.getFullYear() + 2); break;
            default:        recurrencePattern = 'WEEKLY';    endDate.setDate(startDate.getDate() + 28);
        }
        try {
            await eventApi.create({
                title: orig.title, event_type: orig.event_type,
                start_time: orig.start_time, end_time: orig.end_time,
                location: orig.location, is_online_meeting: orig.is_online_meeting,
                description: orig.description, attendees: orig.attendees,
                is_recurring: true, recurrence_pattern: recurrencePattern,
                recurrence_end_date: endDate.toISOString().split('T')[0],
            } as any);
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            closeContextMenu();
        } catch (error) {
            console.error('Failed to create recurring event:', error);
        }
    };

    // ─── Toggle user for shared calendar
    const toggleSharedUser = useCallback((userId: number) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    }, []);

    return {
        // auth
        user,
        queryClient,
        // state
        currentDate, setCurrentDate,
        viewMode, setViewMode,
        selectedDate, setSelectedDate,
        selectedTask, setSelectedTask,
        selectedEvent, setSelectedEvent,
        selectedHour, setSelectedHour,
        isEventModalOpen, setIsEventModalOpen,
        isShareModalOpen, setIsShareModalOpen,
        isSettingsOpen, setIsSettingsOpen,
        includeSharedEvents, setIncludeSharedEvents,
        selectedUserIds, setSelectedUserIds,
        dyuksaInput, setDyuksaInput,
        dyuksaResponse, setDyuksaResponse,
        isDyuksaLoading,
        dyuksaEventData, setDyuksaEventData,
        contextMenu,
        showRepeatSubmenu, setShowRepeatSubmenu,
        showDeclineModal, setShowDeclineModal,
        showRescheduleModal, setShowRescheduleModal,
        selectedInvitationEvent, setSelectedInvitationEvent,
        seenEventIds,
        // data
        events, filteredEvents, tasks, taskStats,
        calendarDays, selectedDateTasks, selectedDateEvents,
        sharedWithMeUsers, rsvpStatusMap,
        isLoading,
        // loading states
        isAccepting, isDeclining, isRescheduling,
        // helpers
        updateEventMutation,
        // handlers
        navigateDate, goToToday,
        handleTaskClick, handleEventClick, handleDateClick,
        handleAcceptInvitation,
        handleDeclineClick, handleDeclineSubmit,
        handleRescheduleClick, handleRescheduleSubmit,
        handleDyuksaSubmit,
        handleEventContextMenu, closeContextMenu,
        handleRepeatEvent,
        toggleSharedUser,
    };
}