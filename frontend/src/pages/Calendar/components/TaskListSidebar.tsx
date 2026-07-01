import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Calendar as CalendarIcon, Clock, Users, ClipboardList, CheckSquare,
    Send, Loader2, Check, X, RefreshCw, CalendarPlus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dailyUpdateApi } from '@/services/api';
import type { Task, Event as CalendarEventType, DailyUpdate } from '@/types';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';
import {
    toISODate, formatDateForUpdate, serializeContent, parseContent,
    EMPTY_FORM, getEventStatusColors, getStatusBadgeColors, getStatusLabel,
    getPriorityColor, requiresAction, type UpdateFormFields,
} from '../calendarConstants';

interface TaskListSidebarProps {
    tasks: Task[];
    events: CalendarEventType[];
    selectedDate: Date | null;
    onTaskClick: (task: Task) => void;
    onEventClick: (event: CalendarEventType) => void;
    onClose: () => void;
    currentUser: { id: number; role: string } | null;
    onOpenEventModal: () => void;
    onAcceptInvitation?: (invitationId: number) => void;
    onDeclineInvitation?: (event: CalendarEventType) => void;
    onRescheduleInvitation?: (event: CalendarEventType) => void;
    isAccepting?: boolean;
}

export const TaskListSidebar: React.FC<TaskListSidebarProps> = ({
    tasks,
    events,
    selectedDate,
    onTaskClick,
    onEventClick,
    onClose,
    currentUser,
    onOpenEventModal,
    onAcceptInvitation,
    onDeclineInvitation,
    onRescheduleInvitation,
    isAccepting
}) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [showUpdateForm, setShowUpdateForm] = useState(false);

    React.useEffect(() => {
      const handler = () => {
        queryClient.invalidateQueries({ queryKey: ['dailyUpdate'] });
      };
      window.addEventListener('aibot:standup-created', handler);
      return () => window.removeEventListener('aibot:standup-created', handler);
    }, [queryClient, selectedDate]);

    const handleCreateTask = () => {
        const dateStr = selectedDate ? toISODate(selectedDate) : '';
        navigate('/taskboard/create', {
            state: { startDate: dateStr, endDate: dateStr }
        });
    };
    const [form, setForm] = useState<UpdateFormFields>(EMPTY_FORM);

    const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';
    const dateStr = selectedDate ? toISODate(selectedDate) : '';

    const { data: myUpdate, isLoading: loadingMyUpdate } = useQuery<DailyUpdate | null>({
        queryKey: ['dailyUpdate', 'mine', dateStr, currentUser?.id],
        queryFn: () => dailyUpdateApi.getMyUpdate(dateStr, currentUser!.id),
        enabled: !!selectedDate && !!currentUser,
        staleTime: 0,
        gcTime: 0,
    });

    // Fetch all updates for admin/manager view
    const { data: allUpdates = [], isLoading: loadingAllUpdates } = useQuery<DailyUpdate[]>({
        queryKey: ['dailyUpdate', 'all', dateStr],
        queryFn: () => dailyUpdateApi.listAll({ date: dateStr }),
        enabled: !!selectedDate && isAdminOrManager,
        staleTime: 0,
        gcTime: 0,
    });

    // Upsert mutation — serializes form fields into `content` string
    const { mutate: submitUpdate, isPending: submitting } = useMutation({
        mutationFn: (fields: UpdateFormFields) => {
            const dateLabel = selectedDate ? formatDateForUpdate(selectedDate) : dateStr;
            return dailyUpdateApi.upsert({
                date: dateStr,
                content: serializeContent(fields, dateLabel),
            }, currentUser!.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dailyUpdate', 'mine', dateStr, currentUser?.id] });
            queryClient.invalidateQueries({ queryKey: ['dailyUpdate', 'all', dateStr] });
            setShowUpdateForm(false);
        },
    });

    // Reset form and panel state whenever the selected date changes
    React.useEffect(() => {
        setShowUpdateForm(false);
        setForm(EMPTY_FORM);
    }, [dateStr]);

    // Pre-fill form when an existing update loads for the current date
    React.useEffect(() => {
        if (myUpdate?.content && myUpdate.date === dateStr) {
            setForm(parseContent(myUpdate.content));
        }
    }, [myUpdate, dateStr]);

    if (!selectedDate) return null;

    // Restrict daily update submission to today only
    const todayStr = toISODate(new Date());
    const isToday = dateStr === todayStr;

    const handleFieldChange = (field: keyof UpdateFormFields, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const formatDateLong = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
        return `${weekday}, ${day}/${month}/${year}`;
    };

    // Parse a stored content string for display in admin/manager view
    const renderUpdateCard = (upd: DailyUpdate) => {
        const fields = parseContent(upd.content);
        const sections: { label: string; value: string }[] = [
            { label: "Today's Priorities", value: fields.todays_priorities },
            { label: 'Progress (Yesterday)', value: fields.progress_yesterday },
            { label: 'Blockers / Needs', value: fields.blockers },
            { label: 'Upcoming', value: fields.upcoming },
        ];
        return (
            <div key={upd.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
                <p className="text-[11px] font-bold text-blue-700">{upd.user_name}</p>
                {sections.map(({ label, value }) =>
                    value ? (
                        <div key={label}>
                            <p className="text-[10px] font-semibold text-gray-500">{label}</p>
                            <p className="text-[11px] text-gray-700 whitespace-pre-wrap">{value}</p>
                        </div>
                    ) : null
                )}
            </div>
        );
    };

    return (
        <div className="w-full sm:w-72 lg:w-80 flex-shrink-0 bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-200">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">{formatDateLong(selectedDate)}</h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onOpenEventModal}
                        className="p-1.5 rounded-md text-[#6366f1] hover:bg-indigo-100 transition-colors flex items-center justify-center"
                        title="Create Event"
                    >
                        <CalendarPlus size={18} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors flex items-center justify-center"
                        title="Close"
                    >
                        <span className="text-lg leading-none">&times;</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* ── Task List Section ── */}
                <div className="p-4">
                    {(tasks.length === 0 && events.length === 0) ? (
                        <div className="flex flex-col items-center justify-center text-center py-6">
                            <CalendarIcon className="w-10 h-10 text-gray-300 mb-2" />
                            <p className="text-sm text-gray-500">No tasks or events scheduled for this day</p>
                            <button
                                onClick={handleCreateTask}
                                className="mt-3 flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                            >
                                <CheckSquare size={14} /> Create Task
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {events.map((event) => {
                                const statusColors = getEventStatusColors(event.my_invitation_status);
                                const isPending = event.my_invitation_status === 'PENDING';

                                return (
                                    <div
                                        key={`sidebar-event-${event.id}`}
                                        onClick={() => onEventClick(event)}
                                        className={`group flex flex-col gap-2 p-3 rounded-lg border border-transparent hover:bg-white hover:shadow-sm cursor-pointer transition-all ${statusColors.bg}`}
                                    >
                                        <div className="flex gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-sm ${statusColors.accent}`}>
                                                <CalendarIcon size={14} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-sm font-medium text-gray-900 truncate mb-1">{event.title}</h4>
                                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                                    <span className={`font-medium flex items-center gap-1 ${statusColors.text}`}>
                                                        <Clock size={12} />
                                                        {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                    </span>
                                                    {event.my_invitation_status && (
                                                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${getStatusBadgeColors(event.my_invitation_status)}`}>
                                                            {getStatusLabel(event.my_invitation_status)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Inline action buttons for PENDING events */}
                                        {isPending && event.my_invitation_id && (
                                            <div className="flex items-center gap-2 ml-11">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAcceptInvitation?.(event.my_invitation_id!);
                                                    }}
                                                    disabled={isAccepting}
                                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
                                                >
                                                    {isAccepting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeclineInvitation?.(event);
                                                    }}
                                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-md transition-colors"
                                                >
                                                    <X size={12} />
                                                    Decline
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRescheduleInvitation?.(event);
                                                    }}
                                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-md transition-colors"
                                                >
                                                    <RefreshCw size={12} />
                                                    Propose
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {tasks.map((task) => {
                                const statusConfig = getStatusConfig(task.status);
                                const StatusIcon = statusConfig.icon;
                                return (
                                    <div
                                        key={task.id}
                                        className="group flex gap-3 p-3 rounded-lg border border-transparent bg-gray-50 hover:bg-white hover:border-gray-200 hover:shadow-sm cursor-pointer transition-all"
                                        onClick={() => onTaskClick(task)}
                                    >
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                                            style={{ backgroundColor: statusConfig.color }}
                                        >
                                            <StatusIcon size={14} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-sm font-medium text-gray-900 truncate mb-1">{task.heading}</h4>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span
                                                    className="font-medium capitalize"
                                                    style={{ color: getPriorityColor(task.priority) }}
                                                >
                                                    {task.priority || 'Normal'}
                                                </span>
                                                {task.assigned_to_user_details?.length > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Users size={12} />
                                                        {task.assigned_to_user_details.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Divider ── */}
                <div className="mx-4 border-t border-gray-100" />

                {/* ── Daily Update Section ── */}
                <div className="p-4 space-y-3">

                    {/* Toggle button — only shown for today */}
                    {!showUpdateForm && (
                        isToday ? (
                            <button
                                onClick={() => setShowUpdateForm(true)}
                                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg border border-blue-200 transition-colors"
                            >
                                <ClipboardList size={16} />
                                {loadingMyUpdate ? 'Loading…' : myUpdate ? 'Edit Daily Update' : 'Add Daily Update'}
                            </button>
                        ) : (
                            <div className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-50 text-gray-400 text-sm rounded-lg border border-gray-200 cursor-not-allowed select-none">
                                <ClipboardList size={16} />
                                Daily updates for today only
                            </div>
                        )
                    )}

                    {/* Form — only rendered when isToday */}
                    {showUpdateForm && isToday && (
                        <div className="space-y-3">
                            {/* Form Header */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-800 leading-tight">Daily Update</p>
                                    <p className="text-[11px] text-blue-600 font-medium mt-0.5">
                                        {formatDateForUpdate(selectedDate)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowUpdateForm(false)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none mt-0.5"
                                >
                                    &times;
                                </button>
                            </div>

                            {/* Today's Priorities */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                    Today's Priorities:-
                                </label>
                                <textarea
                                    rows={2}
                                    value={form.todays_priorities}
                                    onChange={(e) => handleFieldChange('todays_priorities', e.target.value)}
                                    placeholder="What are you focusing on today?"
                                    className="w-full text-xs rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 resize-none transition"
                                />
                            </div>

                            {/* Progress Yesterday */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                    Progress (Yesterday):-
                                </label>
                                <textarea
                                    rows={2}
                                    value={form.progress_yesterday}
                                    onChange={(e) => handleFieldChange('progress_yesterday', e.target.value)}
                                    placeholder="What did you accomplish yesterday?"
                                    className="w-full text-xs rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 resize-none transition"
                                />
                            </div>

                            {/* Blockers */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                    Blockers / Needs:-
                                </label>
                                <textarea
                                    rows={2}
                                    value={form.blockers}
                                    onChange={(e) => handleFieldChange('blockers', e.target.value)}
                                    placeholder="Any blockers or help needed?"
                                    className="w-full text-xs rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 resize-none transition"
                                />
                            </div>

                            {/* Upcoming */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                    Upcoming:-
                                </label>
                                <textarea
                                    rows={2}
                                    value={form.upcoming}
                                    onChange={(e) => handleFieldChange('upcoming', e.target.value)}
                                    placeholder="What's coming up next?"
                                    className="w-full text-xs rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 resize-none transition"
                                />
                            </div>

                            {/* Submit */}
                            <button
                                onClick={() => submitUpdate(form)}
                                disabled={submitting}
                                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                            >
                                {submitting ? (
                                    <Loader2 size={15} className="animate-spin" />
                                ) : (
                                    <Send size={15} />
                                )}
                                {submitting ? 'Submitting…' : myUpdate ? 'Update' : 'Submit Update'}
                            </button>
                        </div>
                    )}

                    {/* ── Admin / Manager: All Team Updates ── */}
                    {isAdminOrManager ? (
                        <div className="mt-2 space-y-2">
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Team Updates
                            </p>
                            {loadingAllUpdates ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 size={18} className="animate-spin text-blue-400" />
                                </div>
                            ) : allUpdates.length === 0 ? (
                                <p className="text-xs text-gray-400 italic text-center py-2">
                                    No team updates for this date yet.
                                </p>
                            ) : (
                                allUpdates.map((upd) => renderUpdateCard(upd))
                            )}
                        </div>
                    ) : (
                        myUpdate && !showUpdateForm && (
                            <div className="mt-2 space-y-2">
                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                    My Update
                                </p>
                                {renderUpdateCard(myUpdate)}
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Sidebar Footer: Action Buttons */}
            <div className="p-4 border-t border-gray-200 bg-white">
                <button
                    onClick={handleCreateTask}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                    <CheckSquare size={16} />
                    Create Task
                </button>
            </div>
        </div>
    );
};