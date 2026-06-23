import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ShareCalendarModal } from '@/components/Calendar/ShareCalendarModal';
import {
    ChevronLeft, ChevronRight, ChevronDown, Calendar as CalendarIcon, Users, Grid3X3, List, ClipboardList, Send, Loader2, CheckSquare, Clock, Download, MapPin, Video, X,
    CalendarPlus, Trash2, Check, XCircle, RefreshCw, Crown, AlertCircle, Sparkles, Copy, Settings, Share2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { taskApi, dailyUpdateApi, eventApi, usersApi, notificationSocket, dyuksaAI, calendarShareApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { TaskDetailModal } from '../MyTask/TaskDetailModal';
import type { Task, DailyUpdate, Event as CalendarEventType, InvitationStatus } from '@/types';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';
import DeclineModal from '@/components/Calendar/DeclineModal';
import RescheduleModal from '@/components/Calendar/RescheduleModal';


// Declare global WebSocket type
declare global {
    interface Window {
        socket?: WebSocket;
    }
}

// --- Types & Constants ---
type ViewMode = 'day' | 'work_week' | 'week' | 'month';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
        case 'high': return '#ef4444';
        case 'medium': return '#f59e0b';
        case 'low': return '#22c55e';
        default: return '#6b7280';
    }
};

// INVITATION STATUS HELPERS 
const getEventStatusColors = (status?: InvitationStatus) => {
    switch (status) {
        case 'ORGANIZER':
            return {
                bg: 'bg-blue-50',
                border: 'border-blue-500',
                text: 'text-blue-700',
                accent: 'bg-blue-500',
                hover: 'hover:bg-blue-100'
            };
        case 'PENDING':
            return {
                bg: 'bg-amber-50',
                border: 'border-amber-500',
                text: 'text-amber-700',
                accent: 'bg-amber-500',
                hover: 'hover:bg-amber-100'
            };
        case 'ACCEPTED':
            return {
                bg: 'bg-emerald-50',
                border: 'border-emerald-500',
                text: 'text-emerald-700',
                accent: 'bg-emerald-500',
                hover: 'hover:bg-emerald-100'
            };
        case 'DECLINED':
            return {
                bg: 'bg-red-50 opacity-60',
                border: 'border-red-400',
                text: 'text-red-600',
                accent: 'bg-red-500',
                hover: 'hover:bg-red-100'
            };
        default:
            return {
                bg: 'bg-indigo-50',
                border: 'border-indigo-500',
                text: 'text-indigo-700',
                accent: 'bg-indigo-500',
                hover: 'hover:bg-indigo-100'
            };
    }
};

const getStatusBadgeColors = (status?: InvitationStatus) => {
    switch (status) {
        case 'ORGANIZER': return 'bg-blue-500 text-white';
        case 'PENDING': return 'bg-amber-500 text-white';
        case 'ACCEPTED': return 'bg-emerald-500 text-white';
        case 'DECLINED': return 'bg-red-500 text-white';
        default: return 'bg-gray-400 text-white';
    }
};

const getStatusIcon = (status?: InvitationStatus) => {
    switch (status) {
        case 'ORGANIZER': return Crown;
        case 'PENDING': return AlertCircle;
        case 'ACCEPTED': return Check;
        case 'DECLINED': return XCircle;
        default: return CalendarIcon;
    }
};

const getStatusLabel = (status?: InvitationStatus) => {
    switch (status) {
        case 'ORGANIZER': return 'Organizer';
        case 'PENDING': return 'Pending';
        case 'ACCEPTED': return 'Accepted';
        case 'DECLINED': return 'Declined';
        default: return '';
    }
};

const requiresAction = (status?: InvitationStatus) => status === 'PENDING';

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    tasks: Task[];
    events: CalendarEventType[];
}

// --- Components 
interface CalendarEventUIProps {
    event: CalendarEventType;
    onClick: (event: CalendarEventType) => void;
    compact?: boolean;
    currentUserId?: number;
    onAccept?: (invitationId: number) => void;
    onDecline?: (event: CalendarEventType) => void;
    onReschedule?: (event: CalendarEventType) => void;
    isAccepting?: boolean;
}

const CalendarEventUI: React.FC<CalendarEventUIProps> = ({
    event,
    onClick,
    compact = false,
    onAccept,
    onDecline,
    isAccepting
}) => {
    const statusColors = getEventStatusColors(event.my_invitation_status);
    const isPending = requiresAction(event.my_invitation_status);

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData("eventId", String(event.id));
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add('opacity-50');
    };

    return (
        <div
            draggable={true}
            onDragStart={handleDragStart}
            onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
            className={`group relative flex items-center gap-2 rounded-md cursor-grab active:cursor-grabbing transition-all duration-200 border border-transparent hover:shadow-sm hover:z-10 ${compact ? 'py-0.5 px-1.5' : 'py-1 px-2'} ${statusColors.bg} ${statusColors.text}`}
            onClick={(e) => {
                e.stopPropagation();
                onClick(event);
            }}
        >
            <div className={`w-1 h-full absolute left-0 top-0 bottom-0 rounded-l-md ${statusColors.accent} pointer-events-none`} />
            <CalendarIcon size={compact ? 12 : 14} className={`flex-shrink-0 pointer-events-none ${statusColors.text}`} />
            <span className={`font-medium truncate pointer-events-none ${compact ? 'text-[10px]' : 'text-xs'}`}>
                {event.title}
            </span>

            {/* Quick action buttons on hover for PENDING events */}
            {isPending && event.my_invitation_id && !compact && (
                <div className="hidden group-hover:flex items-center gap-1 ml-auto">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAccept?.(event.my_invitation_id!);
                        }}
                        disabled={isAccepting}
                        className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors"
                        title="Accept"
                    >
                        {isAccepting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDecline?.(event);
                        }}
                        className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                        title="Decline"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
        </div>
    );
};

interface TaskEventProps {
    task: Task;
    onClick: (task: Task) => void;
    compact?: boolean;
}

const TaskEvent: React.FC<TaskEventProps> = ({ task, onClick, compact = false }) => {
    const statusConfig = getStatusConfig(task.status);
    const StatusIcon = statusConfig.icon;

    return (
        <div
            className={`
                group relative flex items-center gap-2 rounded-md cursor-pointer transition-all duration-200 border border-transparent hover:shadow-sm hover:z-10
                ${compact ? 'py-0.5 px-1.5' : 'py-1 px-2'}
                ${statusConfig.bg} ${statusConfig.text}
            `}
            onClick={(e) => {
                e.stopPropagation();
                onClick(task);
            }}
            title={task.heading}
        >
            <div className="w-1 h-full absolute left-0 top-0 bottom-0 rounded-l-md" style={{ backgroundColor: statusConfig.color }} />

            <StatusIcon size={compact ? 12 : 14} className={`flex-shrink-0 ${statusConfig.text}`} />

            <span className={`font-medium truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
                {task.heading}
            </span>

            {!compact && task.priority && (
                <div
                    className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getPriorityColor(task.priority) }}
                />
            )}
        </div>
    );
};

interface MiniCalendarProps {
    currentDate: Date;
    onDateSelect: (date: Date) => void;
    includeSharedEvents: boolean;
    onToggleSharedEvents: (enabled: boolean) => void;
    sharedWithMeUsers: any[];
    selectedUserIds: number[];
    onToggleUser: (userId: number) => void;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({
    currentDate,
    onDateSelect,
    includeSharedEvents,
    onToggleSharedEvents,
    sharedWithMeUsers,
    selectedUserIds,
    onToggleUser
}) => {
    const [navDate, setNavDate] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));

    useEffect(() => {
        setNavDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    }, [currentDate]); const month = navDate.getMonth();
    const year = navDate.getFullYear();

    const changeMonth = (offset: number) => {
        setNavDate(new Date(year, month + offset, 1));
    };

    const days = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        const start = new Date(firstDay);
        start.setDate(firstDay.getDate() - firstDay.getDay());

        const result = [];
        const iter = new Date(start);
        while (result.length < 42) {
            result.push(new Date(iter));
            iter.setDate(iter.getDate() + 1);
        }
        return result;
    }, [month, year]);

    return (
        <div className="w-full select-none">
            {/* Mini Calendar Header with Month/Year Navigation */}
            <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-sm font-bold text-gray-900">
                    {MONTHS[month]} {year}
                </span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
                    <div key={`${d}-${index}`} className="text-[10px] font-bold text-gray-400 text-center py-1">
                        {d}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
                {days.map((date, i) => {
                    const isCurrentMonth = date.getMonth() === month;
                    const isSelected = date.toDateString() === currentDate.toDateString();
                    const isToday = date.toDateString() === new Date().toDateString();

                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onDateSelect(date)}
                            className={`
                                text-[11px] h-7 w-7 flex items-center justify-center rounded-full mx-auto transition-all
                                ${isSelected ? 'bg-blue-600 text-white font-bold shadow-sm' :
                                    isToday ? 'text-blue-600 font-bold border border-blue-200' :
                                        isCurrentMonth ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300'}
                            `}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>

            {/* View Shared Calendars Section */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                {/* Header with toggle */}
                <button
                    onClick={() => onToggleSharedEvents(!includeSharedEvents)}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                    <div className="flex items-center gap-2">
                        <Users size={14} className="text-purple-600" />
                        <span className="text-xs font-semibold text-gray-700">View Shared Calendars</span>
                    </div>
                    {/* Toggle switch */}
                    <div className={`w-8 h-4 rounded-full transition-colors duration-200 ${includeSharedEvents ? 'bg-purple-600' : 'bg-gray-300'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 mt-0.5 ${includeSharedEvents ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
                    </div>
                </button>

                {/* User checkboxes  */}
                {includeSharedEvents && (
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {/* Select All checkbox */}
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={selectedUserIds.length === sharedWithMeUsers.length && sharedWithMeUsers.length > 0}
                                onChange={() => {
                                    if (selectedUserIds.length === sharedWithMeUsers.length) {
                                        sharedWithMeUsers.forEach(u => onToggleUser(u.id));
                                    } else {
                                        sharedWithMeUsers.forEach(u => {
                                            if (!selectedUserIds.includes(u.id)) {
                                                onToggleUser(u.id);
                                            }
                                        });
                                    }
                                }}
                                className="w-3.5 h-3.5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-offset-0 focus:ring-1"
                            />
                            <span className="text-xs font-medium text-gray-700">Select All Members</span>
                        </label>

                        {/* Individual user checkboxes */}
                        {sharedWithMeUsers.length > 0 ? (
                            sharedWithMeUsers.map((u: any) => {
                                const isSelected = selectedUserIds.includes(u.id);
                                const initials = u.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?';

                                return (
                                    <label
                                        key={u.id}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer transition-colors group"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => onToggleUser(u.id)}
                                            className="w-3.5 h-3.5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-offset-0 focus:ring-1"
                                        />
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {/* User avatar */}
                                            <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                                {initials}
                                            </div>
                                            {/* User name */}
                                            <span className="text-xs text-gray-700 truncate">{u.name}</span>
                                        </div>
                                        {/* Checkmark icon when selected */}
                                        {isSelected && <Check size={12} className="text-purple-600 flex-shrink-0" />}
                                    </label>
                                );
                            })
                        ) : (
                            <div className="px-2 py-3 text-center">
                                <p className="text-[10px] text-gray-400 italic">No calendars shared with you yet</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

interface DayCellProps {
    day: CalendarDay;
    onTaskClick: (task: Task) => void;
    onEventClick?: (event: CalendarEventType) => void;
    onDateClick: (date: Date) => void;
    onEventDrop?: (eventId: string, newDate: Date) => void;
}

const DayCell: React.FC<DayCellProps> = ({ day, onTaskClick, onEventClick, onDateClick, onEventDrop }) => {
    const maxVisibleItems = 3;
    const totalItems = day.tasks.length + day.events.length;

    const visibleEvents = day.events.slice(0, maxVisibleItems);
    const visibleTasks = day.tasks.slice(0, maxVisibleItems - visibleEvents.length);
    const remainingCount = totalItems - (visibleEvents.length + visibleTasks.length);

    return (
        <div
            className={`
        relative flex flex-col min-h-[120px] p-2 border-b border-r border-gray-200 transition-colors hover:bg-gray-50 cursor-pointer
        ${!day.isCurrentMonth ? 'bg-gray-50/50' : 'bg-white'}
    `}
            onClick={() => onDateClick(day.date)}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.background = '#EEF4FF'; }}
            onDragLeave={(e) => { e.currentTarget.style.background = ''; }}
            onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.background = '';
                const eventId = e.dataTransfer.getData('eventId');
                if (eventId && onEventDrop) {
                    onEventDrop(eventId, day.date);
                }
            }}
        >
            <div className="flex items-center justify-between mb-2">
                <span className={`
                    text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                    ${day.isToday
                        ? 'bg-blue-600 text-white shadow-sm'
                        : !day.isCurrentMonth ? 'text-gray-400' : 'text-gray-700'}
                `}>
                    {day.date.getDate()}
                </span>
                {day.tasks.length > 0 && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {day.tasks.length}
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-1.5 overflow-hidden">
                {visibleEvents.map((event) => (
                    <div
                        key={`event-${event.id}`}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('eventId', String(event.id));
                            e.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <CalendarEventUI
                            event={event}
                            onClick={(ev) => onEventClick && onEventClick(ev)}
                            compact
                        />
                    </div>
                ))}
                {visibleTasks.map((task) => (
                    <TaskEvent
                        key={`task-${task.id}`}
                        task={task}
                        onClick={onTaskClick}
                        compact={totalItems > 2}
                    />
                ))}
                {remainingCount > 0 && (
                    <div className="text-[10px] font-medium text-gray-500 text-center hover:text-blue-600 p-1">
                        +{remainingCount} more
                    </div>
                )}
            </div>
        </div>
    );
};

interface DaysViewProps {
    currentDate: Date;
    tasks: Task[];
    events: CalendarEventType[];
    selectedDate: Date | null;
    seenEventIds: number[];
    renderStatusDot: (event: any) => React.ReactNode;
    onTaskClick: (task: Task) => void;
    onEventClick?: (event: CalendarEventType) => void;
    onDateClick: (date: Date) => void;
    onCreateEventAtTime?: (date: Date, hour: number) => void;
    viewMode: 'day' | 'work_week' | 'week';
    updateEvent: (data: Partial<CalendarEventType>) => void;
    currentUser: { id: number; role: string } | null;
    onAcceptInvitation?: (invitationId: number) => void;
    onDeclineInvitation?: (event: CalendarEventType) => void;
    onRescheduleInvitation?: (event: CalendarEventType) => void;
    isAccepting?: boolean;
    onEventContextMenu?: (e: React.MouseEvent, event: CalendarEventType) => void;
}

const DaysView: React.FC<DaysViewProps> = ({
    currentDate, tasks, events, selectedDate, onTaskClick, onEventClick, onDateClick, onCreateEventAtTime, viewMode,
    updateEvent,
    currentUser,
    onAcceptInvitation,
    onDeclineInvitation,
    onRescheduleInvitation,
    isAccepting,
    onEventContextMenu,
    seenEventIds,
    renderStatusDot,
}) => {
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    // Drag preview state
    const [dragPreview, setDragPreview] = React.useState<{
        dayIndex: number;
        hour: number;
        minute: number;
    } | null>(null);

    // Selected time slot state
    const [selectedSlot, setSelectedSlot] = React.useState<{
        dayIndex: number;
        hour: number;
        date: Date;
    } | null>(null);

    React.useEffect(() => {
        if (!selectedSlot) return;
        const handleClickOutside = () => setSelectedSlot(null);
        const timer = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [selectedSlot]);

    React.useEffect(() => {
        const handleDragEnd = () => setDragPreview(null);
        document.addEventListener('dragend', handleDragEnd);
        return () => document.removeEventListener('dragend', handleDragEnd);
    }, []);

    React.useEffect(() => {
        const handleDragStart = () => setSelectedSlot(null);
        document.addEventListener('dragstart', handleDragStart);
        return () => document.removeEventListener('dragstart', handleDragStart);
    }, []);

    // 1. Scroll to 9:00 AM on Load/View Change
    React.useEffect(() => {
        const scrollToDefault = () => {
            if (scrollContainerRef.current) {
                const scrollPos = (9 * 64) - 10;
                scrollContainerRef.current.scrollTop = scrollPos;
            }
        };
        const timeoutId = setTimeout(scrollToDefault, 100);
        return () => clearTimeout(timeoutId);
    }, [viewMode, currentDate]);

    // 2. Date Logic Helpers
    const getDays = () => {
        const days: Date[] = [];
        if (viewMode === 'day') {
            days.push(new Date(currentDate));
            return days;
        }
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        if (viewMode === 'work_week') {
            for (let i = 1; i <= 5; i++) {
                const day = new Date(startOfWeek);
                day.setDate(startOfWeek.getDate() + i);
                days.push(day);
            }
        } else {
            for (let i = 0; i < 7; i++) {
                const day = new Date(startOfWeek);
                day.setDate(startOfWeek.getDate() + i);
                days.push(day);
            }
        }
        return days;
    };

    const displayDays = getDays();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toLocalDateStr = (iso: string | undefined) => {
        if (!iso) return '';
        if (!iso.includes('T')) return iso.split('T')[0];
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const getTasksForDate = (date: Date) => {
        const dateStr = toLocalDateStr(date.toISOString());
        return tasks.filter((task) => {
            const startDate = toLocalDateStr(task.start_date);
            const endDate = toLocalDateStr(task.end_date);
            return (startDate && startDate <= dateStr && endDate && endDate >= dateStr) || startDate === dateStr || endDate === dateStr;
        });
    };

    const getEventsForDate = (date: Date) => {
        const dateStr = toLocalDateStr(date.toISOString());
        return events.filter((event) => {
            const startDate = toLocalDateStr(event.start_time);
            const endDate = toLocalDateStr(event.end_time);
            return (startDate && startDate <= dateStr && endDate && endDate >= dateStr) || startDate === dateStr || endDate === dateStr;
        });
    };

    const gridColsClass = displayDays.length === 1 ? 'grid-cols-1' : displayDays.length === 5 ? 'grid-cols-5' : 'grid-cols-7';
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden relative">
            {/* Header Row */}
            <div className="flex border-b border-gray-200 bg-gray-50">
                <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50"></div>
                <div className={`grid ${gridColsClass} flex-1`}>
                    {displayDays.map((day, index) => {
                        const isToday = day.toDateString() === today.toDateString();
                        return (
                            <div
                                key={index}
                                className={`flex flex-col items-center justify-center py-3 px-2 border-r border-gray-200 last:border-r-0 cursor-pointer hover:bg-gray-100 transition-colors ${isToday ? 'bg-blue-50/50 hover:bg-blue-100/50' : ''}`}
                                onClick={() => onDateClick(day)}
                            >
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{DAYS_OF_WEEK[day.getDay()]}</span>
                                <span className={`text-lg font-bold ${isToday ? 'text-blue-600 bg-blue-100 w-8 h-8 flex items-center justify-center rounded-full' : 'text-gray-900'}`}>
                                    {day.getDate()}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* All Day / Tasks Row */}
            <div className="flex border-b border-gray-300 bg-gray-50/30 max-h-32 overflow-y-auto">
                <div className="w-16 flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] font-medium text-gray-500 p-2 text-center bg-gray-50">
                    All Day / Tasks
                </div>
                <div className={`grid ${gridColsClass} flex-1 divide-x divide-gray-200`}>
                    {displayDays.map((day, index) => {
                        const dayTasks = getTasksForDate(day);
                        const dayEvents = getEventsForDate(day);
                        const allDayEvents = dayEvents.filter(e => {
                            const s = new Date(e.start_time);
                            const end = new Date(e.end_time);
                            return s.getHours() === 0 && s.getMinutes() === 0 && end.getHours() === 23 && end.getMinutes() === 59;
                        });

                        return (
                            <div key={index} className="p-1 flex flex-col gap-1 min-h-[40px] relative">
                                {allDayEvents.map((event) => (
                                    <CalendarEventUI key={`event-${event.id}`} event={event} onClick={(ev) => onEventClick && onEventClick(ev)} compact />
                                ))}
                                {dayTasks.map((task) => (
                                    <TaskEvent key={`task-${task.id}`} task={task} onClick={onTaskClick} compact />
                                ))}
                                {(dayTasks.length === 0 && allDayEvents.length === 0) && <div className="hidden sm:flex absolute inset-0 text-[10px] text-gray-300 items-center justify-center pointer-events-none">No tasks</div>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Hourly Timeline Grid */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-white relative border-t border-gray-200" style={{ minHeight: 0 }}>
                <div className="flex min-w-full relative bg-white">
                    {/* Time Axis */}
                    <div className="w-16 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        {hours.map(hour => (
                            <div key={hour} className="h-16 relative border-b border-transparent">
                                {hour !== 0 && (
                                    <span className="absolute -top-2.5 right-2 text-xs font-medium text-gray-400">
                                        {hour.toString().padStart(2, '0')}:00
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Day Columns with Drag & Drop */}
                    <div className={`grid ${gridColsClass} flex-1 divide-x divide-gray-200 relative bg-white`}>
                        {/* Horizontal Background Lines */}
                        <div className="absolute inset-0 pointer-events-none flex flex-col">
                            {hours.map(hour => (
                                <div key={hour} className="h-16 border-b border-gray-100 w-full flex-shrink-0" />
                            ))}
                        </div>

                        {displayDays.map((day, index) => {
                            const dayEvents = getEventsForDate(day);
                            const hourlyEvents = dayEvents.filter(e => {
                                const s = new Date(e.start_time);
                                const end = new Date(e.end_time);
                                return !(s.getHours() === 0 && s.getMinutes() === 0 && end.getHours() === 23 && end.getMinutes() === 59);
                            });

                            const isToday = day.toDateString() === today.toDateString();
                            const isSelected = selectedDate?.toDateString() === day.toDateString();

                            // Visual positioning logic 
                            const dailyPositionedEvents = hourlyEvents.map(event => {
                                const start = new Date(event.start_time);
                                const end = new Date(event.end_time);
                                let effectiveStart = new Date(start);
                                let effectiveEnd = new Date(end);

                                if (new Date(end.getTime() - start.getTime()).getHours() > 24) {
                                    effectiveStart = new Date(day);
                                    effectiveStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
                                    effectiveEnd = new Date(day);
                                    if (end.getHours() < start.getHours()) effectiveEnd.setHours(23, 59, 59, 999);
                                    else effectiveEnd.setHours(end.getHours(), end.getMinutes(), 0, 0);
                                } else {
                                    if (start.toDateString() !== day.toDateString()) { effectiveStart = new Date(day); effectiveStart.setHours(0, 0, 0, 0); }
                                    if (end.toDateString() !== day.toDateString()) { effectiveEnd = new Date(day); effectiveEnd.setHours(23, 59, 59, 999); }
                                }
                                return { event, effectiveStart, effectiveEnd };
                            });

                            const positionedEvents = dailyPositionedEvents.map((item, _, array) => {
                                const start = item.effectiveStart.getTime();
                                const end = item.effectiveEnd.getTime();
                                const overlaps = array.filter(e => start < e.effectiveEnd.getTime() && end > e.effectiveStart.getTime());
                                overlaps.sort((a, b) => a.effectiveStart.getTime() - b.effectiveStart.getTime());
                                const orderIndex = overlaps.findIndex(e => e.event.id === item.event.id);
                                return { ...item, orderIndex, totalOverlaps: overlaps.length };
                            });

                            return (
                                <div
                                    key={index}
                                    className={`relative z-10 h-[1536px] cursor-pointer transition-colors hover:bg-gray-50/50 
                                        ${isToday ? 'bg-blue-50/10' : ''} 
                                        ${isSelected ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/20' : ''}`}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = "move";

                                        // Calculate preview position
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const y = e.clientY - rect.top;
                                        const totalMinutes = (y / 64) * 60;
                                        const snappedMinutes = Math.floor(totalMinutes / 15) * 15;
                                        const previewHour = Math.floor(snappedMinutes / 60);
                                        const previewMinute = snappedMinutes % 60;

                                        setDragPreview({
                                            dayIndex: index,
                                            hour: previewHour,
                                            minute: previewMinute
                                        });
                                    }}
                                    onDragLeave={(e) => {
                                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                            setDragPreview(null);
                                        }
                                    }}

                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragPreview(null);

                                        const eventId = e.dataTransfer.getData("eventId");
                                        const draggedEvent = events.find(ev => String(ev.id) === eventId);
                                        if (!draggedEvent) return;

                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const y = e.clientY - rect.top;
                                        const totalMinutes = (y / 64) * 60;
                                        const snappedMinutes = Math.floor(totalMinutes / 15) * 15;
                                        const droppedHour = Math.floor(snappedMinutes / 60);
                                        const droppedMinute = snappedMinutes % 60;

                                        const newStart = new Date(day);
                                        newStart.setHours(droppedHour, droppedMinute, 0, 0);

                                        if (newStart < new Date()) {
                                            return;
                                        }

                                        const duration = new Date(draggedEvent.end_time).getTime() - new Date(draggedEvent.start_time).getTime();
                                        const newEnd = new Date(newStart.getTime() + duration);

                                        updateEvent({
                                            id: draggedEvent.id,
                                            start_time: newStart.toISOString(),
                                            end_time: newEnd.toISOString()
                                        });
                                    }}
                                    onClick={(e) => {
                                        if (e.target === e.currentTarget) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const y = e.clientY - rect.top;
                                            const totalMinutes = (y / 64) * 60;
                                            const clickedHour = Math.floor(totalMinutes / 60);

                                            // Toggle selection
                                            if (selectedSlot && selectedSlot.dayIndex === index && selectedSlot.hour === clickedHour) {
                                                setSelectedSlot(null);
                                            } else {
                                                setSelectedSlot({
                                                    dayIndex: index,
                                                    hour: clickedHour,
                                                    date: day
                                                });
                                            }
                                        }
                                    }}
                                >
                                    {/* Selected Time Slot Indicator */}
                                    {selectedSlot && selectedSlot.dayIndex === index && (
                                        <div
                                            className="absolute left-1 right-1 bg-blue-100 border-2 border-blue-500 rounded-lg z-40 flex items-center justify-center cursor-pointer hover:bg-blue-200 transition-colors"
                                            style={{
                                                top: `${selectedSlot.hour * 64}px`,
                                                height: '64px',
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onCreateEventAtTime) {
                                                    onCreateEventAtTime(selectedSlot.date, selectedSlot.hour);
                                                }
                                                setSelectedSlot(null);
                                            }}
                                        >
                                            <div className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-lg hover:bg-blue-700 transition-colors">
                                                <CalendarPlus size={16} />
                                                <span className="text-sm font-medium">
                                                    Create Event at {String(selectedSlot.hour).padStart(2, '0')}:00
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Drag Preview Indicator */}
                                    {dragPreview && dragPreview.dayIndex === index && (
                                        <div
                                            className="absolute left-1 right-1 bg-indigo-500/20 border-2 border-dashed border-indigo-500 rounded-md z-50 pointer-events-none flex items-center justify-center"
                                            style={{
                                                top: `${((dragPreview.hour * 60) + dragPreview.minute) * (64 / 60)}px`,
                                                height: '32px',
                                            }}
                                        >
                                            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
                                                {String(dragPreview.hour).padStart(2, '0')}:{String(dragPreview.minute).padStart(2, '0')}
                                            </span>
                                        </div>
                                    )}
                                    {positionedEvents.map(({ event, effectiveStart, effectiveEnd, orderIndex, totalOverlaps }) => {
                                        const startMinutes = (effectiveStart.getHours() * 60) + effectiveStart.getMinutes();
                                        const endMinutes = (effectiveEnd.getHours() * 60) + effectiveEnd.getMinutes();
                                        const topOffset = startMinutes * (64 / 60);
                                        const eventHeight = 32;
                                        const widthPercent = 100 / totalOverlaps;
                                        const isSharedEvent = event.organizer !== currentUser?.id && !event.my_invitation_status;
                                        const statusColors = isSharedEvent
                                            ? {
                                                bg: 'bg-red-100 border-red-300',
                                                text: 'text-red-900',
                                                hover: 'hover:bg-red-200',
                                                accent: 'bg-red-600'
                                            }
                                            : getEventStatusColors(event.my_invitation_status);
                                        const isPending = event.my_invitation_status === 'PENDING';

                                        return (
                                            <div
                                                key={`event-${event.id}`}
                                                draggable={true}
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData("eventId", String(event.id));
                                                    e.dataTransfer.effectAllowed = "move";
                                                    e.currentTarget.classList.add('opacity-50');
                                                }}
                                                onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
                                                className="absolute transition-all duration-200 p-0.5 group hover:!z-50 hover:!w-[calc(100%-8px)] hover:!left-1 cursor-grab active:cursor-grabbing"
                                                style={{
                                                    top: `${topOffset}px`,
                                                    height: `${eventHeight}px`,
                                                    left: `${orderIndex * widthPercent}%`,
                                                    width: `${widthPercent}%`,
                                                    zIndex: 10 + orderIndex
                                                }}
                                                onClick={(e) => { e.stopPropagation(); if (onEventClick) onEventClick(event); }}
                                                onContextMenu={(e) => { if (onEventContextMenu) onEventContextMenu(e, event); }}
                                            >
                                                <div
                                                    className={`h-full w-full rounded-md overflow-visible p-1.5 text-xs shadow-sm flex flex-col relative border ${statusColors.bg} ${statusColors.text} ${statusColors.hover}`}
                                                    title={event.title}
                                                >
                                                    {renderStatusDot(event)}
                                                    <div className={`w-1 h-full absolute left-0 top-0 bottom-0 rounded-l-md ${statusColors.accent}`} />
                                                    <div className="flex items-center justify-between w-full ml-1 min-w-0">
                                                        <span className="font-semibold truncate">{event.title}</span>
                                                        {event.organizer !== currentUser?.id && (
                                                            <span className="text-[8px] text-black bg-amber-200/80 px-1 rounded flex-shrink-0 whitespace-nowrap">
                                                                {event.organizer_name?.split(' ')[0]}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {eventHeight >= 40 && (
                                                        <div className="text-[10px] truncate ml-1 opacity-80 mt-0.5">
                                                            {effectiveStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {effectiveEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        </div>
                                                    )}

                                                    {/* Quick action buttons for PENDING events */}
                                                    {isPending && event.my_invitation_id && eventHeight >= 50 && (
                                                        <div className="hidden group-hover:flex items-center gap-1 mt-auto ml-1">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onAcceptInvitation?.(event.my_invitation_id!);
                                                                }}
                                                                disabled={isAccepting}
                                                                className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors"
                                                                title="Accept"
                                                            >
                                                                {isAccepting ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onDeclineInvitation?.(event);
                                                                }}
                                                                className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                                                                title="Decline"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onRescheduleInvitation?.(event);
                                                                }}
                                                                className="p-1 bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors"
                                                                title="Reschedule"
                                                            >
                                                                <RefreshCw size={10} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

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

const formatDateForUpdate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Helper: format date as YYYY-MM-DD using local timezone (not UTC)
const toISODate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Structured fields that get serialized into / deserialized from backend `content`
interface UpdateFormFields {
    todays_priorities: string;
    progress_yesterday: string;
    blockers: string;
    upcoming: string;
}

const EMPTY_FORM: UpdateFormFields = {
    todays_priorities: '',
    progress_yesterday: '',
    blockers: '',
    upcoming: '',
};

// Serialize form fields into a single content string
const serializeContent = (fields: UpdateFormFields, dateLabel: string): string =>
    `Daily Update – ${dateLabel}\n\nToday's Priorities:-\n${fields.todays_priorities}\n\nProgress (Yesterday):-\n${fields.progress_yesterday}\n\nBlockers / Needs:-\n${fields.blockers}\n\nUpcoming:-\n${fields.upcoming}`;

// Parse a content string back into form fields (best-effort)
const parseContent = (content: string): UpdateFormFields => {
    const extract = (label: string, nextLabel?: string): string => {
        const start = content.indexOf(label);
        if (start === -1) return ''
        const valueStart = start + label.length;
        const end = nextLabel ? content.indexOf(nextLabel) : content.length;
        return (end === -1 ? content.slice(valueStart) : content.slice(valueStart, end)).trim();
    };
    return {
        todays_priorities: extract("Today's Priorities:-\n", "Progress (Yesterday):-\n"),
        progress_yesterday: extract("Progress (Yesterday):-\n", "Blockers / Needs:-\n"),
        blockers: extract("Blockers / Needs:-\n", "Upcoming:-\n"),
        upcoming: extract("Upcoming:-\n"),
    };
};

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date | null;
    selectedHour?: number | null;
    event?: CalendarEventType | null;
    currentUser: { id: number; role: string } | null;
    allEvents: CalendarEventType[];
    onAcceptInvitation?: (invitationId: number) => void;
    onDeclineInvitation?: (event: CalendarEventType) => void;
    onRescheduleInvitation?: (event: CalendarEventType) => void;
    isAccepting?: boolean;
    // ═══════════════ DYUKSA AI PROP ═══════════════
    dyuksaEventData?: {
        eventType: string;
        title: string;
        attendeeIds: number[];
        attendeeNames: string[];
        targetDate: string;
        suggestedSlots: string[];
        duration: number;
    } | null;
}

const EventModal: React.FC<EventModalProps> = ({
    isOpen,
    onClose,
    selectedDate,
    selectedHour,
    event,
    currentUser,
    allEvents,
    onAcceptInvitation,
    onDeclineInvitation,
    onRescheduleInvitation,
    isAccepting,
    dyuksaEventData
}) => {
    const isReadOnly = Boolean(event && currentUser && event.organizer !== currentUser.id);
    const queryClient = useQueryClient();
    const [title, setTitle] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [location, setLocation] = useState('');
    const [isOnline, setIsOnline] = useState(false);
    const [description, setDescription] = useState('');


    // NEW: Event Type state
    const [eventType, setEventType] = useState('Meeting');
    const [showEventTypeDropdown, setShowEventTypeDropdown] = useState(false);
    const [customEventType, setCustomEventType] = useState('');
    const [suggestedSlots, setSuggestedSlots] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState(30);


    // Predefined event types
    const EVENT_TYPES = [
        { value: 'Meeting', icon: '👥', color: 'bg-blue-100 text-blue-700 border-blue-200' },
        { value: 'Review', icon: '📋', color: 'bg-purple-100 text-purple-700 border-purple-200' },
        { value: 'Interview', icon: '🎯', color: 'bg-green-100 text-green-700 border-green-200' },
        { value: 'Training', icon: '📚', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    ];

    // Attendees states
    const [attendees, setAttendees] = useState<number[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);

    // Dropdown states
    const [showStartTimeDropdown, setShowStartTimeDropdown] = useState(false);
    const [showEndTimeDropdown, setShowEndTimeDropdown] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Date picker state
    const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
    const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

    // Refs for scrolling time dropdowns
    const startTimeRef = React.useRef<HTMLDivElement>(null);
    const endTimeRef = React.useRef<HTMLDivElement>(null);

    // Availability tracking
    const [availabilityMap, setAvailabilityMap] = useState<Record<number, boolean>>({});
    const [checkingAvailability, setCheckingAvailability] = useState(false);


    // Fetch available team members
    const { data: availableUsers = [] } = useQuery({
        queryKey: ['users-list-events'],
        queryFn: usersApi.listAll,
        enabled: isOpen,
    });

    // Fetch RSVP status for existing events
    const { data: rsvpData, isLoading: loadingRsvp } = useQuery({
        queryKey: ['event-rsvp', event?.id],
        queryFn: () => eventApi.getEventRsvpStatus(event!.id),
        enabled: !!event?.id && isOpen,
    });

    const getTimeIndex = (timeStr: string) => {
        // timeStr is usually "HH:MM"
        const [h, m] = timeStr.split(':').map(Number);
        // Since you have 30-minute intervals, index = (hours * 2) + (1 if 30 mins)
        return h * 2 + (m >= 30 ? 1 : 0);
    };

    // Check availability for all users when time changes
    const checkAllUsersAvailability = React.useCallback(async () => {
        if (!startTime || !endTime || availableUsers.length === 0) return;

        setCheckingAvailability(true);
        const newAvailabilityMap: Record<number, boolean> = {};

        try {
            const checks = availableUsers.map(async (user: any) => {
                try {
                    const result = await eventApi.checkAvailability(
                        user.id,
                        new Date(startTime).toISOString(),
                        new Date(endTime).toISOString()
                    );
                    return { userId: user.id, available: result.is_available };
                } catch (error) {
                    console.error(`Error checking availability for user ${user.id}:`, error);
                    return { userId: user.id, available: true };
                }
            });

            const results = await Promise.all(checks);
            results.forEach(({ userId, available }) => {
                newAvailabilityMap[userId] = available;
            });

            setAvailabilityMap(newAvailabilityMap);
        } catch (error) {
            console.error('Error checking availability:', error);
        } finally {
            setCheckingAvailability(false);
        }
    }, [startTime, endTime, availableUsers]);

    // Helper to get availability status
    const getUserAvailability = (userId: number): { available: boolean; loading: boolean } => {
        if (!startTime || !endTime) return { available: true, loading: false };
        if (checkingAvailability && availabilityMap[userId] === undefined) {
            return { available: true, loading: true };
        }
        return { available: availabilityMap[userId] ?? true, loading: false };
    };

    // ═══════════════ FETCH SUGGESTED SLOTS ═══════════════
    const fetchSuggestedSlots = async () => {
        if (attendees.length === 0) {
            setSuggestedSlots([]);
            return;
        }

        const targetDate = startTime.split('T')[0];
        if (!targetDate) return;

        setLoadingSuggestions(true);
        try {
            const response = await eventApi.suggestSlots(
                attendees,
                targetDate,
                selectedDuration
            );
            setSuggestedSlots(response.available_slots || []);
        } catch (error) {
            console.error('Error fetching suggested slots:', error);
            setSuggestedSlots([]);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // Handle slot selection - populate start and end time
    const handleSlotSelect = (slotIso: string) => {
        const startDate = new Date(slotIso);
        const endDate = new Date(startDate.getTime() + selectedDuration * 60 * 1000);

        // Format for datetime-local input
        const formatForInput = (date: Date) => {
            const d = new Date(date);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().slice(0, 16);
        };

        setStartTime(formatForInput(startDate));
        setEndTime(formatForInput(endDate));
        setSuggestedSlots([]); // Clear suggestions after selection
    };

    // Format slot time for display (e.g., "10:00 AM")
    const formatSlotTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    // Trigger availability check when time changes
    React.useEffect(() => {
        if (isOpen && startTime && endTime && availableUsers.length > 0) {
            checkAllUsersAvailability();
        }
    }, [isOpen, startTime, endTime, availableUsers.length, checkAllUsersAvailability]);

    // Scroll time dropdown to show 9:00 AM area when opened
    React.useEffect(() => {
        if (showStartTimeDropdown && startTimeRef.current) {
            // Extract "HH:MM" from the ISO string or state
            const currentTime = startTime.split('T')[1]?.slice(0, 5) || '13:00';
            const index = getTimeIndex(currentTime);

            // 36 is the approximate height of your 'px-4 py-2' items
            // Subtracting 72 (two rows) centers the selection slightly
            startTimeRef.current.scrollTop = (index * 36) - 72;
        }
    }, [showStartTimeDropdown, startTime]);

    React.useEffect(() => {
        if (showEndTimeDropdown && endTimeRef.current) {
            const currentTime = endTime.split('T')[1]?.slice(0, 5) || '13:30';
            const index = getTimeIndex(currentTime);
            endTimeRef.current.scrollTop = (index * 36) - 72;
        }
    }, [showEndTimeDropdown, endTime]);

    React.useEffect(() => {
        if (event && isOpen) {
            // ═══════════════ EDITING EXISTING EVENT ═══════════════
            setTitle(event.title || '');
            const formatDt = (iso: string) => {
                const d = new Date(iso);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            };

            setStartTime(formatDt(event.start_time));
            setEndTime(formatDt(event.end_time));
            setLocation(event.location || '');
            setIsOnline(event.is_online_meeting || false);
            setDescription(event.description || '');
            setAttendees(event.attendees || []);
            setUserSearch('');
            setShowUserDropdown(false);
            setAvailabilityMap({});
            setSuggestedSlots([]);
            setSelectedDuration(30);

            if (event.event_type) {
                setEventType(event.event_type);
            } else {
                const detectedType = EVENT_TYPES.find(t => event.title?.toLowerCase().includes(t.value.toLowerCase()));
                if (detectedType) {
                    setEventType(detectedType.value);
                } else {
                    setEventType('Meeting');
                }
            }
            setCustomEventType('');

            const eventDate = new Date(event.start_time);
            setPickerMonth(eventDate.getMonth());
            setPickerYear(eventDate.getFullYear());

        } else if (dyuksaEventData && isOpen) {
            // ═══════════════ DYUKSA AI PRE-FILL ═══════════════
            setError(null);
            setTitle(dyuksaEventData.title || '');
            setEventType(dyuksaEventData.eventType || 'Meeting');
            setAttendees(dyuksaEventData.attendeeIds || []);
            setSuggestedSlots(dyuksaEventData.suggestedSlots || []);
            setSelectedDuration(dyuksaEventData.duration || 30);

            // Set date and time
            const targetDate = new Date(dyuksaEventData.targetDate);
            const y = targetDate.getFullYear();
            const m = String(targetDate.getMonth() + 1).padStart(2, '0');
            const d = String(targetDate.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            // If there are suggested slots, pre-select the first one
            if (dyuksaEventData.suggestedSlots && dyuksaEventData.suggestedSlots.length > 0) {
                const firstSlot = new Date(dyuksaEventData.suggestedSlots[0]);
                const startHour = String(firstSlot.getHours()).padStart(2, '0');
                const startMin = String(firstSlot.getMinutes()).padStart(2, '0');
                setStartTime(`${dateStr}T${startHour}:${startMin}`);

                const endSlot = new Date(firstSlot.getTime() + dyuksaEventData.duration * 60000);
                const endHour = String(endSlot.getHours()).padStart(2, '0');
                const endMin = String(endSlot.getMinutes()).padStart(2, '0');
                setEndTime(`${dateStr}T${endHour}:${endMin}`);
            } else {
                setStartTime(`${dateStr}T09:00`);
                setEndTime(`${dateStr}T09:30`);
            }

            setLocation('');
            setIsOnline(false);
            setDescription('');
            setUserSearch('');
            setShowUserDropdown(false);
            setAvailabilityMap({});
            setCustomEventType('');

            setPickerMonth(targetDate.getMonth());
            setPickerYear(targetDate.getFullYear());

        } else if (isOpen) {
            // ═══════════════ NEW EVENT (NO DYUKSA DATA) ═══════════════
            setError(null);
            const now = new Date();
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);

            let targetDate = selectedDate || new Date();
            if (targetDate < todayMidnight) targetDate = new Date();

            const y = targetDate.getFullYear();
            const m = String(targetDate.getMonth() + 1).padStart(2, '0');
            const d = String(targetDate.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            // Determine start time
            let startHour: number;
            let startMin: number;

            if (selectedHour !== null && selectedHour !== undefined) {
                // User clicked a specific hour slot in the calendar grid
                startHour = selectedHour;
                startMin = 0;
            } else if (targetDate.toDateString() === now.toDateString()) {
                // Creating event for today → snap to next 30-minute slot from current time
                const currentMinutes = now.getMinutes();
                if (currentMinutes < 30) {
                    startHour = now.getHours();
                    startMin = 30;
                } else {
                    startHour = now.getHours() + 1;
                    startMin = 0;
                }
                // Edge case: if rounding pushes us past midnight, cap at 23:30
                if (startHour >= 24) {
                    startHour = 23;
                    startMin = 30;
                }
            } else {
                // Creating event for a future day → default to 9:00 AM
                startHour = 9;
                startMin = 0;
            }

            // Calculate end time = start + 30 minutes
            let endHour = startHour;
            let endMin = startMin + 30;
            if (endMin >= 60) {
                endHour += 1;
                endMin -= 60;
            }
            if (endHour >= 24) {
                endHour = 23;
                endMin = 59;
            }

            const pad = (n: number) => String(n).padStart(2, '0');
            setStartTime(`${dateStr}T${pad(startHour)}:${pad(startMin)}`);
            setEndTime(`${dateStr}T${pad(endHour)}:${pad(endMin)}`);

            setTitle('');
            setLocation('');
            setIsOnline(false);
            setDescription('');
            setAttendees([]);
            setUserSearch('');
            setShowUserDropdown(false);
            setAvailabilityMap({});
            setSuggestedSlots([]);
            setSelectedDuration(30);
            setEventType('Meeting');
            setCustomEventType('');

            setPickerMonth(targetDate.getMonth());
            setPickerYear(targetDate.getFullYear());
        }
    }, [selectedDate, selectedHour, isOpen, event, dyuksaEventData]);

    const { mutate: createEvent, isPending: isCreating } = useMutation({
        mutationFn: (data: Partial<CalendarEventType>) => eventApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            onClose();
        },
        onError: (err: any) => {
            const conflictMsg = err.response?.data?.attendees?.[0] || err.response?.data?.detail || "Could not create event.";
            setError(conflictMsg);
        }
    });

    const { mutate: updateEvent, isPending: isUpdating } = useMutation({
        mutationFn: (data: Partial<CalendarEventType>) => eventApi.update(event!.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            onClose();
        },
        onError: (err: any) => {
            const conflictMsg = err.response?.data?.attendees?.[0] || err.response?.data?.detail || "Could not update event.";
            setError(conflictMsg);
        }
    });

    const { mutate: deleteEvent, isPending: isDeleting } = useMutation({
        mutationFn: () => eventApi.delete(event!.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            onClose();
        }
    });

    const isPending = isCreating || isUpdating || isDeleting;

    const handleSave = () => {
        const startDt = new Date(startTime);
        const endDt = new Date(endTime);
        const now = new Date();

        if (startDt < now) {
            setError("Cannot create or move an event to a past time.");
            return;
        }

        // // Conflict check logic for participants
        // const conflictAttendee = attendees.find(attendeeId => {
        //     return allEvents.some(existingEv => {
        //         if (event && existingEv.id === event.id) return false;
        //         const evStart = new Date(existingEv.start_time);
        //         const evEnd = new Date(existingEv.end_time);
        //         const isUserInvolved = existingEv.organizer === attendeeId || existingEv.attendees?.includes(attendeeId);
        //         return isUserInvolved && (startDt < evEnd && endDt > evStart);
        //     });
        // });

        // if (conflictAttendee) {
        //     const userObj = availableUsers.find((u: any) => u.id === conflictAttendee);
        //     setError(`${userObj?.first_name || "A participant"} is already busy during this time.`);
        //     return;
        // }

        // Build the payload with all fields to ensure they can be updated
        const payload = {
            id: event?.id, // ID is required for the update mutation
            title,
            event_type: eventType,
            location,
            is_online_meeting: isOnline,
            description,
            attendees, // This includes any newly added participant IDs
            start_time: startDt.toISOString(),
            end_time: endDt.toISOString()
        };

        if (event) {
            updateEvent(payload);
        } else {
            createEvent(payload);
        }
    };

    // Close all dropdowns helper
    const closeAllDropdowns = () => {
        setShowDatePicker(false);
        setShowStartTimeDropdown(false);
        setShowEndTimeDropdown(false);
        setShowEventTypeDropdown(false);
        setShowUserDropdown(false);
    };

    if (!isOpen) return null;

    const filteredUsers = availableUsers.filter((u: any) => {
        const name = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        const searchLower = userSearch.toLowerCase();
        return (name.includes(searchLower) || u.email?.toLowerCase().includes(searchLower)) && !attendees.includes(u.id);
    });

    // Avatar helpers
    const getInitials = (user: any) => {
        const first = user?.first_name?.[0] || user?.username?.[0] || '';
        const last = user?.last_name?.[0] || '';
        return (first + last).toUpperCase() || '?';
    };

    const avatarColors = ['bg-amber-500', 'bg-cyan-500', 'bg-violet-500', 'bg-rose-500', 'bg-emerald-500', 'bg-blue-500', 'bg-orange-500', 'bg-pink-500'];
    const getAvatarColor = (id: number) => avatarColors[id % avatarColors.length];

    // Format date for display: "15 Apr 2026"
    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Generate time slots
    const timeSlots = Array.from({ length: 48 }).map((_, i) => {
        const h = String(Math.floor(i / 2)).padStart(2, '0');
        const m = i % 2 === 0 ? '00' : '30';
        return `${h}:${m}`;
    });

    // Mini Calendar helpers
    const MINI_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const MINI_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const getCalendarDays = () => {
        const firstDay = new Date(pickerYear, pickerMonth, 1);
        const startDay = new Date(firstDay);
        startDay.setDate(firstDay.getDate() - firstDay.getDay());

        const days = [];
        const iter = new Date(startDay);
        while (days.length < 42) {
            days.push(new Date(iter));
            iter.setDate(iter.getDate() + 1);
        }
        return days;
    };

    const handleDateSelect = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const newDateStr = `${y}-${m}-${d}`;

        setStartTime(`${newDateStr}T${startTime.split('T')[1] || '13:00'}`);
        setEndTime(`${newDateStr}T${endTime.split('T')[1] || '13:30'}`);
        setShowDatePicker(false);
    };

    const currentSelectedDate = startTime ? new Date(startTime.split('T')[0]) : new Date();

    // Get current event type config
    const currentEventTypeConfig = EVENT_TYPES.find(t => t.value === eventType) || { value: eventType, icon: '📅', color: 'bg-gray-100 text-gray-700 border-gray-200' };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white w-full max-w-[850px] rounded-2xl shadow-2xl flex overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ═══════════════ LEFT PANEL - Event Details ═══════════════ */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {event ? (isReadOnly ? 'View event' : 'Edit event') : 'Create event'}
                            </h2>
                            {event?.my_invitation_status && (
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColors(event.my_invitation_status)}`}>
                                    {getStatusLabel(event.my_invitation_status)}
                                </span>
                            )}
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto">
                        {/* ── Date & Time Row ── */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Date Picker Button */}
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => {
                                        closeAllDropdowns();
                                        setShowDatePicker(!showDatePicker);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                                >
                                    <CalendarIcon size={16} className="text-gray-500" />
                                    <span className="text-sm font-medium text-gray-900">
                                        {formatDisplayDate(startTime)}
                                    </span>
                                </button>

                                {/* Mini Calendar Dropdown */}
                                {showDatePicker && !isReadOnly && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowDatePicker(false)} />
                                        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 p-4 w-72">
                                            {/* Month/Year Header */}
                                            <div className="flex items-center justify-between mb-4">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (pickerMonth === 0) {
                                                            setPickerMonth(11);
                                                            setPickerYear(pickerYear - 1);
                                                        } else {
                                                            setPickerMonth(pickerMonth - 1);
                                                        }
                                                    }}
                                                    className="p-1 hover:bg-gray-100 rounded-lg text-gray-600"
                                                >
                                                    <ChevronLeft size={18} />
                                                </button>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {MINI_MONTHS[pickerMonth]} {pickerYear}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (pickerMonth === 11) {
                                                            setPickerMonth(0);
                                                            setPickerYear(pickerYear + 1);
                                                        } else {
                                                            setPickerMonth(pickerMonth + 1);
                                                        }
                                                    }}
                                                    className="p-1 hover:bg-gray-100 rounded-lg text-gray-600"
                                                >
                                                    <ChevronRight size={18} />
                                                </button>
                                            </div>

                                            {/* Day Headers */}
                                            <div className="grid grid-cols-7 mb-2">
                                                {MINI_DAYS.map(d => (
                                                    <div key={d} className="text-[11px] font-semibold text-gray-400 text-center py-1">
                                                        {d}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Calendar Days */}
                                            <div className="grid grid-cols-7 gap-1">
                                                {getCalendarDays().map((date, i) => {
                                                    const isCurrentMonth = date.getMonth() === pickerMonth;
                                                    const isSelected = date.toDateString() === currentSelectedDate.toDateString();
                                                    const isToday = date.toDateString() === new Date().toDateString();
                                                    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                                                    return (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            disabled={isPast}
                                                            onClick={() => handleDateSelect(date)}
                                                            className={`
                                                                text-sm h-8 w-8 flex items-center justify-center rounded-full mx-auto transition-all
                                                                ${isSelected
                                                                    ? 'bg-blue-600 text-white font-semibold'
                                                                    : isToday
                                                                        ? 'text-blue-600 font-semibold border border-blue-300'
                                                                        : isCurrentMonth
                                                                            ? isPast
                                                                                ? 'text-gray-300 cursor-not-allowed'
                                                                                : 'text-gray-700 hover:bg-gray-100'
                                                                            : 'text-gray-300'
                                                                }
                                                            `}
                                                        >
                                                            {date.getDate()}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Start Time Dropdown */}
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => {
                                        closeAllDropdowns();
                                        setShowStartTimeDropdown(!showStartTimeDropdown);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                                >
                                    <span className="text-sm font-medium text-gray-900">
                                        {startTime.split('T')[1]?.slice(0, 5) || '13:00'}
                                    </span>
                                    <ChevronRight size={14} className="text-gray-400 rotate-90" />
                                </button>

                                {showStartTimeDropdown && !isReadOnly && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowStartTimeDropdown(false)} />
                                        <div
                                            ref={startTimeRef}
                                            className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 w-24 max-h-64 overflow-y-auto"
                                        >
                                            {timeSlots.map(time => {
                                                // --- NEW LOGIC START ---
                                                const [h, m] = time.split(':').map(Number);
                                                const slotDate = new Date(startTime.split('T')[0]);
                                                slotDate.setHours(h, m, 0, 0);

                                                // Check if this specific time slot on the selected date is in the past
                                                const isPastTime = slotDate < new Date();
                                                const isSelected = (startTime.split('T')[1]?.slice(0, 5) || '13:00') === time;
                                                // --- NEW LOGIC END ---

                                                return (
                                                    <div
                                                        key={`start-${time}`}
                                                        className={`px-4 py-2 cursor-pointer text-sm transition-colors ${isPastTime
                                                            ? 'text-gray-500 cursor-not-allowed opacity-70'
                                                            : isSelected
                                                                ? 'bg-blue-50 text-blue-700 font-medium'
                                                                : 'text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                        onClick={() => {
                                                            if (isPastTime) return; // Prevent selection of past times

                                                            const date = startTime.split('T')[0];
                                                            setStartTime(`${date}T${time}`);

                                                            // Logic to auto-set end time 30 mins after start
                                                            const [h, m] = time.split(':').map(Number);
                                                            const endH = String(m >= 30 ? (h + 1) % 24 : h).padStart(2, '0');
                                                            const endM = m >= 30 ? '00' : '30';
                                                            setEndTime(`${date}T${endH}:${endM}`);
                                                            setShowStartTimeDropdown(false);
                                                        }}
                                                    >
                                                        {isSelected && <span className="mr-1">✓</span>}
                                                        {time}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>

                            <span className="text-gray-400 font-medium">—</span>

                            {/* End Time Dropdown */}
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => {
                                        closeAllDropdowns();
                                        setShowEndTimeDropdown(!showEndTimeDropdown);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                                >
                                    <span className="text-sm font-medium text-gray-900">
                                        {endTime.split('T')[1]?.slice(0, 5) || '13:30'}
                                    </span>
                                    <ChevronRight size={14} className="text-gray-400 rotate-90" />
                                </button>

                                {showEndTimeDropdown && !isReadOnly && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowEndTimeDropdown(false)} />
                                        <div
                                            ref={endTimeRef}
                                            className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 w-24 max-h-64 overflow-y-auto"
                                        >
                                            {timeSlots.map(time => {
                                                const [h, m] = time.split(':').map(Number);
                                                const slotDate = new Date(endTime.split('T')[0]);
                                                slotDate.setHours(h, m, 0, 0);

                                                const isPastTime = slotDate < new Date();
                                                const isSelected = (endTime.split('T')[1]?.slice(0, 5) || '13:30') === time;

                                                return (
                                                    <div
                                                        key={`end-${time}`}
                                                        className={`px-4 py-2 cursor-pointer text-sm transition-colors ${isPastTime
                                                            ? 'text-gray-500 cursor-not-allowed opacity-70'
                                                            : isSelected
                                                                ? 'bg-blue-50 text-blue-700 font-medium'
                                                                : 'text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                        onClick={() => {
                                                            if (isPastTime) return; // Prevent selection

                                                            setEndTime(`${endTime.split('T')[0]}T${time}`);
                                                            setShowEndTimeDropdown(false);
                                                        }}
                                                    >
                                                        {isSelected && <span className="mr-1">✓</span>}
                                                        {time}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        {/* ═══════════════ SUGGEST TIMES SECTION ═══════════════ */}
                        {!isReadOnly && !event && attendees.length > 0 && (
                            <div className="space-y-3">
                                {/* Duration selector + Suggest button */}
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-gray-400" />
                                        <span className="text-xs font-medium text-gray-500">Duration:</span>
                                        <select
                                            value={selectedDuration}
                                            onChange={(e) => setSelectedDuration(Number(e.target.value))}
                                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value={15}>15 min</option>
                                            <option value={30}>30 min</option>
                                            <option value={45}>45 min</option>
                                            <option value={60}>1 hour</option>
                                            <option value={90}>1.5 hours</option>
                                            <option value={120}>2 hours</option>
                                        </select>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={fetchSuggestedSlots}
                                        disabled={loadingSuggestions || attendees.length === 0}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-700 text-sm font-medium rounded-lg border border-emerald-200 transition-colors"
                                    >
                                        {loadingSuggestions ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                Finding times...
                                            </>
                                        ) : (
                                            <>
                                                <CalendarIcon size={14} />
                                                Suggest Times
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Suggested slots pills */}
                                {suggestedSlots.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Available Slots ({suggestedSlots.length})
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {suggestedSlots.map((slot) => (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    onClick={() => handleSlotSelect(slot)}
                                                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium rounded-lg border border-emerald-200 transition-all hover:shadow-sm hover:scale-105"
                                                >
                                                    {formatSlotTime(slot)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* No slots available message */}
                                {!loadingSuggestions && suggestedSlots.length === 0 && attendees.length > 0 && (
                                    <p className="text-xs text-gray-400 italic">
                                        Click "Suggest Times" to find available slots for all participants
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ── Event Name Input ── */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Event Name
                            </label>
                            <input
                                type="text"
                                placeholder="Enter event name"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={isReadOnly}
                                className={`w-full text-base font-medium text-gray-900 placeholder:text-gray-400 bg-transparent border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isReadOnly ? 'cursor-not-allowed opacity-80' : ''}`}
                            />
                        </div>

                        {/* ── Event Type Selector ── */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Event Type
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => {
                                        closeAllDropdowns();
                                        setShowEventTypeDropdown(!showEventTypeDropdown);
                                    }}
                                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all ${currentEventTypeConfig.color} ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:shadow-sm'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{currentEventTypeConfig.icon}</span>
                                        <span className="text-sm font-medium">{eventType}</span>
                                    </div>
                                    <ChevronRight size={16} className={`transition-transform ${showEventTypeDropdown ? 'rotate-90' : ''}`} />
                                </button>

                                {showEventTypeDropdown && !isReadOnly && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowEventTypeDropdown(false)} />
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                                            {/* Predefined Types */}
                                            {EVENT_TYPES.map(type => (
                                                <div
                                                    key={type.value}
                                                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${eventType === type.value ? 'bg-gray-50' : ''}`}
                                                    onClick={() => {
                                                        setEventType(type.value);
                                                        setCustomEventType('');
                                                        setShowEventTypeDropdown(false);
                                                    }}
                                                >
                                                    <span className="text-lg">{type.icon}</span>
                                                    <span className="text-sm font-medium text-gray-900">{type.value}</span>
                                                    {eventType === type.value && (
                                                        <CheckSquare size={16} className="ml-auto text-blue-600" />
                                                    )}
                                                </div>
                                            ))}

                                            {/* Divider */}
                                            <div className="border-t border-gray-100" />

                                            {/* Custom Type Input */}
                                            <div className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">✏️</span>
                                                    <input
                                                        type="text"
                                                        placeholder="Other (type custom name)"
                                                        value={customEventType}
                                                        onChange={(e) => setCustomEventType(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && customEventType.trim()) {
                                                                setEventType(customEventType.trim());
                                                                setShowEventTypeDropdown(false);
                                                            }
                                                        }}
                                                        className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    {customEventType.trim() && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEventType(customEventType.trim());
                                                                setShowEventTypeDropdown(false);
                                                            }}
                                                            className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                                        >
                                                            Add
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ── Teams Meeting Toggle ── */}
                        <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => setIsOnline(!isOnline)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all w-fit ${isOnline
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                } ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                        >
                            <Video size={18} className={isOnline ? 'text-indigo-600' : 'text-gray-500'} />
                            <span className="text-sm font-medium">Teams meeting</span>
                            {isOnline && <X size={14} className="ml-1 text-indigo-400" />}
                        </button>
                        {isOnline && (
                            <p className="text-xs text-gray-500 -mt-3 ml-1">Link will be generated automatically</p>
                        )}

                        {/* ── Description ── */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Description
                            </label>
                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                <textarea
                                    placeholder="Let's discuss"
                                    value={description}
                                    disabled={isReadOnly}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={4}
                                    className={`w-full bg-transparent resize-none focus:outline-none text-sm text-gray-700 placeholder:text-gray-400 p-4 ${isReadOnly ? 'cursor-not-allowed opacity-80' : ''}`}
                                />
                            </div>
                        </div>

                        {/* ── Location (Optional) ── */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                            <MapPin size={18} className="text-gray-400 flex-shrink-0" />
                            <input
                                type="text"
                                disabled={isReadOnly}
                                placeholder="Add location (optional)"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                className={`flex-1 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent focus:outline-none ${isReadOnly ? 'cursor-not-allowed opacity-80' : ''}`}
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mx-6 mb-3">
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                {error}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <div>
                            {event && !isReadOnly && (
                                <button
                                    onClick={() => deleteEvent()}
                                    disabled={isPending}
                                    className="text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                            )}
                        </div>

                        {/* Show invitation buttons for PENDING events */}
                        {event && event.my_invitation_status === 'PENDING' && event.my_invitation_id ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onAcceptInvitation?.(event.my_invitation_id!)}
                                    disabled={isAccepting}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    {isAccepting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                    Accept
                                </button>
                                <button
                                    onClick={() => onDeclineInvitation?.(event)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    <XCircle size={16} />
                                    Decline
                                </button>
                                <button
                                    onClick={() => onRescheduleInvitation?.(event)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    <RefreshCw size={16} />
                                    Reschedule
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                {!isReadOnly && (
                                    <button
                                        onClick={handleSave}
                                        disabled={!title || isPending}
                                        className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                                    >
                                        {isPending ? 'Saving...' : event ? 'Save changes' : 'Create event'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════════════ RIGHT PANEL - Participants ═══════════════ */}
                <div className="w-64 bg-slate-50 border-l border-gray-200 flex flex-col">
                    {/* Participants Header */}
                    <div className="px-4 py-4 border-b border-gray-200">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Participants</h3>
                        {checkingAvailability && (
                            <div className="flex items-center gap-1.5 text-[11px] text-blue-600 mt-1.5">
                                <Loader2 size={10} className="animate-spin" />
                                Checking availability...
                            </div>
                        )}
                    </div>

                    {/* Participants List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {/* Show Organizer First */}
                        {event && (
                            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-50 border border-blue-100 mb-2">
                                <div className="relative flex-shrink-0">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm ${getAvatarColor(event.organizer)}`}>
                                        {(() => {
                                            const organizer = availableUsers.find((u: any) => u.id === event.organizer);
                                            return organizer?.avatar ? (
                                                <img src={organizer.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                getInitials(organizer || { first_name: rsvpData?.organizer })
                                            );
                                        })()}
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-blue-50 bg-blue-500 flex items-center justify-center">
                                        <Crown size={8} className="text-white" />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {rsvpData?.organizer || event.organizer_name || 'Organizer'}
                                    </p>
                                    <p className="text-[10px] font-medium text-blue-600">Organizer</p>
                                </div>
                            </div>
                        )}

                        {/* Loading state */}
                        {loadingRsvp && (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 size={16} className="animate-spin text-gray-400" />
                            </div>
                        )}

                        {/* Attendees with RSVP status - Now mapping over local 'attendees' state */}
                        {attendees.map((userId) => {
                            // 1. Skip if this user is the organizer (already shown above)
                            if (event && userId === event.organizer) return null;

                            // 2. Find detailed user info from your 'availableUsers' list
                            const userDetail = availableUsers.find((u: any) => u.id === userId);

                            // 3. Find RSVP status from the server data (if it exists yet)
                            const rsvpStatus = rsvpData?.attendee_status?.find((a: any) => a.user_id === userId);

                            // Logic for display labels
                            const status = rsvpStatus?.status || 'PENDING';
                            const statusColor =
                                status === 'ACCEPTED' ? 'bg-emerald-500' :
                                    status === 'DECLINED' ? 'bg-red-500' :
                                        'bg-amber-500';

                            const statusTextColor =
                                status === 'ACCEPTED' ? 'text-emerald-600' :
                                    status === 'DECLINED' ? 'text-red-600' :
                                        'text-amber-600';

                            const fullName = userDetail
                                ? `${userDetail.first_name || ''} ${userDetail.last_name || ''}`.trim() || userDetail.username
                                : (rsvpStatus?.name || 'User');

                            return (
                                <div
                                    key={userId}
                                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white transition-colors group"
                                >
                                    <div className="relative flex-shrink-0">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm ${getAvatarColor(userId)}`}>
                                            {userDetail?.avatar ? (
                                                <img src={userDetail.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                getInitials(userDetail || { first_name: fullName })
                                            )}
                                        </div>
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-50 ${statusColor}`} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{fullName}</p>
                                        <p className={`text-[10px] font-medium ${statusTextColor}`}>
                                            {/* If we have no rsvpStatus, it means the user was just added locally */}
                                            {!rsvpStatus ? 'Newly Added' : status.charAt(0) + status.slice(1).toLowerCase()}
                                        </p>

                                        {/* RSVP Details (Only if they exist from server) */}
                                        {rsvpStatus?.status === 'DECLINED' && rsvpStatus.decline_reason && (
                                            <p className="text-[9px] text-gray-400 truncate" title={rsvpStatus.decline_reason}>
                                                Reason: {rsvpStatus.decline_reason}
                                            </p>
                                        )}
                                        {rsvpStatus?.proposed_reschedule_time && (
                                            <p className="text-[9px] text-amber-600 truncate">
                                                Proposed: {new Date(rsvpStatus.proposed_reschedule_time).toLocaleString()}
                                            </p>
                                        )}
                                    </div>

                                    {!isReadOnly && (
                                        <button
                                            onClick={() => setAttendees(prev => prev.filter(a => a !== userId))}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {/* Empty state for new events */}
                        {!event && attendees.length === 0 && (
                            <div className="text-center py-8 text-gray-400">
                                <Users size={28} className="mx-auto mb-2 opacity-40" />
                                <p className="text-xs">No participants yet</p>
                            </div>
                        )}
                    </div>

                    {/* Add Participant */}
                    {!isReadOnly && (
                        <div className="p-3 border-t border-gray-200 relative">
                            <div
                                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-dashed border-gray-300 hover:border-blue-400 hover:bg-white cursor-text transition-all"
                                onClick={() => setShowUserDropdown(true)}
                            >
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    <Users size={14} className="text-gray-500" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="+ Add participants"
                                    value={userSearch}
                                    onChange={e => {
                                        setUserSearch(e.target.value);
                                        setShowUserDropdown(true);
                                    }}
                                    onFocus={() => setShowUserDropdown(true)}
                                    className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none min-w-0"
                                />
                            </div>

                            {showUserDropdown && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowUserDropdown(false)} />
                                    <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-60 overflow-hidden flex flex-col">
                                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-[10px] font-semibold text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                                Available
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                                Busy
                                            </span>
                                        </div>

                                        <div className="overflow-y-auto flex-1">
                                            {filteredUsers.length === 0 ? (
                                                <div className="p-4 text-center text-sm text-gray-500">
                                                    {userSearch ? 'No users found' : 'All users added'}
                                                </div>
                                            ) : (
                                                filteredUsers.map((u: any) => {
                                                    const { available, loading } = getUserAvailability(u.id);
                                                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;

                                                    return (
                                                        <div
                                                            key={u.id}
                                                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${loading ? 'hover:bg-gray-50' : available ? 'hover:bg-green-50' : 'hover:bg-red-50'
                                                                }`}
                                                            onClick={() => {
                                                                setAttendees(prev => [...prev, u.id]);
                                                                setUserSearch('');
                                                                setShowUserDropdown(false);
                                                            }}
                                                        >
                                                            <div className="relative flex-shrink-0">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${getAvatarColor(u.id)}`}>
                                                                    {u.avatar ? (
                                                                        <img src={u.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                                                    ) : (
                                                                        getInitials(u)
                                                                    )}
                                                                </div>
                                                                {!loading && (
                                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${available ? 'bg-green-500' : 'bg-red-500'
                                                                        }`} />
                                                                )}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-gray-900 truncate">{fullName}</p>
                                                                <p className="text-[11px] text-gray-500 truncate">{u.email}</p>
                                                            </div>

                                                            <div className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${loading
                                                                ? 'bg-gray-100 text-gray-500'
                                                                : available
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                {loading ? '...' : available ? 'Free' : 'Busy'}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {(!startTime || !endTime) && (
                                <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1 px-1">
                                    <Clock size={10} />
                                    Select time to check availability
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TaskListSidebar: React.FC<TaskListSidebarProps> = ({
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

//Main Component 

export const Calendar: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { mutate: updateEventMutation } = useMutation({
        mutationFn: (data: Partial<CalendarEventType>) => eventApi.update(data.id!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
        },
        onError: (err: any) => {
            alert(err.response?.data?.detail || "Failed to reschedule event.");
        }
    });
    const [searchParams, setSearchParams] = useSearchParams();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [seenEventIds, setSeenEventIds] = useState<number[]>(() => {
        const saved = localStorage.getItem('seen_event_notifications');
        return saved ? JSON.parse(saved) : [];
    });
    const [viewMode, setViewMode] = useState<ViewMode>('work_week');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [includeSharedEvents, setIncludeSharedEvents] = useState(false);
    // ═══════════════ SETTINGS DROPDOWN STATE ═══════════════
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const settingsDropdownRef = React.useRef<HTMLDivElement>(null);
    // ═══════════════ INVITATION MODAL STATES ═══════════════
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [selectedInvitationEvent, setSelectedInvitationEvent] = useState<CalendarEventType | null>(null);
    // ═══════════════ DYUKSA AI STATE ═══════════════
    const [dyuksaInput, setDyuksaInput] = useState('');
    const [dyuksaResponse, setDyuksaResponse] = useState<string | null>(null);
    const [isDyuksaLoading, setIsDyuksaLoading] = useState(false);
    const [selectedHour, setSelectedHour] = useState<number | null>(null);
    const [dyuksaEventData, setDyuksaEventData] = useState<{
        eventType: string;
        title: string;
        attendeeIds: number[];
        attendeeNames: string[];
        targetDate: string;
        suggestedSlots: string[];
        duration: number;
    } | null>(null);

    // ═══════════════ EVENT CONTEXT MENU STATE ═══════════════
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        event: CalendarEventType;
    } | null>(null);
    const [showRepeatSubmenu, setShowRepeatSubmenu] = useState(false);



    // ═══════════════ INVITATION MUTATIONS ═══════════════
    const { mutate: acceptInvitation, isPending: isAccepting } = useMutation({
        mutationFn: (invitationId: number) => eventApi.acceptInvitation(invitationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            setIsEventModalOpen(false);
            setSelectedEvent(null);
        },
        onError: (err: any) => {
            alert(err.response?.data?.detail || "Failed to accept invitation.");
        }
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
        onError: (err: any) => {
            alert(err.response?.data?.detail || "Failed to decline invitation.");
        }
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
        onError: (err: any) => {
            alert(err.response?.data?.detail || "Failed to propose new time.");
        }
    });

    // ═══════════════ INVITATION HANDLERS ═══════════════
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
    // ═══════════════ DYUKSA AI HANDLER ═══════════════
    const handleDyuksaSubmit = async () => {
        if (!dyuksaInput.trim()) return;

        // Check if message starts with "dyuksa"
        if (!dyuksaInput.toLowerCase().startsWith('dyuksa')) {
            setDyuksaResponse('Please start your message with "dyuksa" to use the AI assistant. Example: "dyuksa find 30 mins with Shifali tomorrow"');
            return;
        }

        setIsDyuksaLoading(true);
        setDyuksaResponse(null);

        try {
            // Call the real Dyuksa AI API
            const response = await dyuksaAI.chat(dyuksaInput);

            // Check if AI wants to create an event
            if (response.action === 'create_event' && response.data) {
                // Set pre-filled data for EventModal
                setDyuksaEventData({
                    eventType: response.data.event_type || 'Meeting',
                    title: response.data.title || '',
                    attendeeIds: response.data.attendee_ids || [],
                    attendeeNames: response.data.attendee_names || [],
                    targetDate: response.data.target_date || new Date().toISOString().split('T')[0],
                    suggestedSlots: response.data.available_slots || [],
                    duration: response.data.duration_minutes || 30
                });

                // Set the date and open EventModal
                if (response.data.target_date) {
                    setSelectedDate(new Date(response.data.target_date));
                }
                setSelectedEvent(null);
                setIsEventModalOpen(true);
                setDyuksaInput('');
                setDyuksaResponse(response.reply || 'Opening event creator with your preferences...');
            } else {
                // Fallback to text response
                setDyuksaResponse(response.reply);
            }
        } catch (error) {
            console.error('Dyuksa AI error:', error);
            setDyuksaResponse('Sorry, I encountered an error. Please try again.');
        } finally {
            setIsDyuksaLoading(false);
        }
    };
    // ═══════════════ EVENT CONTEXT MENU HANDLERS ═══════════════
    const handleEventContextMenu = (e: React.MouseEvent, event: CalendarEventType) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            event
        });
        setShowRepeatSubmenu(false);
    };

    const closeContextMenu = () => {
        setContextMenu(null);
        setShowRepeatSubmenu(false);
    };

    const handleRepeatEvent = async (repeatType: 'daily' | 'workday' | 'weekly' | 'monthly' | 'yearly') => {
        if (!contextMenu?.event) return;

        const originalEvent = contextMenu.event;
        const startDate = new Date(originalEvent.start_time);

        // Calculate end date based on repeat type
        const recurrenceEndDate = new Date(startDate);
        let recurrencePattern: string;

        switch (repeatType) {
            case 'daily':
                recurrencePattern = 'DAILY';
                recurrenceEndDate.setDate(startDate.getDate() + 30); // 30 days
                break;
            case 'workday':
                recurrencePattern = 'WORK_WEEK';
                recurrenceEndDate.setDate(startDate.getDate() + 30); // ~20 workdays
                break;
            case 'weekly':
                recurrencePattern = 'WEEKLY';
                recurrenceEndDate.setDate(startDate.getDate() + 84); // 12 weeks
                break;
            case 'monthly':
                recurrencePattern = 'MONTHLY';
                recurrenceEndDate.setMonth(startDate.getMonth() + 6); // 6 months
                break;
            case 'yearly':
                recurrencePattern = 'YEARLY';
                recurrenceEndDate.setFullYear(startDate.getFullYear() + 2); // 2 years
                break;
            default:
                recurrencePattern = 'WEEKLY';
                recurrenceEndDate.setDate(startDate.getDate() + 28);
        }

        // Format end date as YYYY-MM-DD
        const endDateStr = recurrenceEndDate.toISOString().split('T')[0];

        try {
            await eventApi.create({
                title: originalEvent.title,
                event_type: originalEvent.event_type,
                start_time: originalEvent.start_time,
                end_time: originalEvent.end_time,
                location: originalEvent.location,
                is_online_meeting: originalEvent.is_online_meeting,
                description: originalEvent.description,
                attendees: originalEvent.attendees,
                is_recurring: true,
                recurrence_pattern: recurrencePattern,
                recurrence_end_date: endDateStr
            } as any);

            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            closeContextMenu();
        } catch (error) {
            console.error('Failed to create recurring event:', error);
        }
    };


    // Close context menu on click outside
    React.useEffect(() => {
        const handleClickOutside = () => closeContextMenu();
        if (contextMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu]);



    const {
        data: eventsData,
        fetchNextPage: fetchNextEventsPage,
        hasNextPage: hasNextEventsPage,
        isFetchingNextPage: isFetchingNextEventsPage
    } = useInfiniteQuery({
        queryKey: ['events-calendar', currentDate.getFullYear(), currentDate.getMonth(), includeSharedEvents],
        queryFn: async ({ pageParam = 1 }) => {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const firstDay = new Date(year, month, -7).toISOString().split('T')[0];
            const lastDay = new Date(year, month + 1, 7).toISOString().split('T')[0];
            return eventApi.list({ start_date: firstDay, end_date: lastDay, page: pageParam, include_shared: includeSharedEvents });
        },
        getNextPageParam: (lastPage: any) => {
            if (lastPage?.next) {
                const url = new URL(lastPage.next);
                const pageString = url.searchParams.get('page');
                return pageString ? Number(pageString) : undefined;
            }
            return undefined;
        },
        initialPageParam: 1,
        enabled: !!user,
    });



    const { data: sharedWithMeUsers = [] } = useQuery({
        queryKey: ['calendar-shares-received'],
        queryFn: async () => {
            const response = await calendarShareApi.list();
            const sharesWithMe = response.filter((share: any) => share.shared_with === user?.id);
            const users = sharesWithMe.map((share: any) => ({
                id: share.owner,
                name: share.owner_name,
                email: share.owner_email,
            }));

            const uniqueUsers = users.filter((u: any, index: number, self: any[]) =>
                index === self.findIndex((x) => x.id === u.id)
            );
            return uniqueUsers;
        },
        enabled: !!user && includeSharedEvents,
    });

    // Close settings dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };
        if (isSettingsOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSettingsOpen]);

    // REAL-TIME CALENDAR UPDATES VIA WEBSOCKET
    React.useEffect(() => {
        const unsubscribe = notificationSocket.onNotification((notification) => {
            if (notification.related_object?.type === 'event') {
                queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
                queryClient.invalidateQueries({ queryKey: ['events-rsvp-bulk'] });
            }
        });

        return () => {
            unsubscribe();
        };
    }, [queryClient]);

    React.useEffect(() => {
        if (hasNextEventsPage && !isFetchingNextEventsPage) {
            fetchNextEventsPage();
        }
    }, [hasNextEventsPage, isFetchingNextEventsPage, fetchNextEventsPage]);

    const events = useMemo(() => {
        if (!eventsData) return [];
        return eventsData.pages.flatMap((page: any) => page.results || page);
    }, [eventsData]);

    const filteredEvents = useMemo(() => {
        if (!includeSharedEvents) return events;
        if (selectedUserIds.length === 0) {
            return events.filter(event => event.organizer === user?.id);
        }

        return events.filter((event: CalendarEventType) => {
            const isMyEvent = event.organizer === user?.id;
            const isSelectedUserInvolved = selectedUserIds.includes(event.organizer) ||
                event.attendees?.some(attendeeId => selectedUserIds.includes(attendeeId));

            return isMyEvent || isSelectedUserInvolved;
        });
    }, [events, includeSharedEvents, selectedUserIds, user?.id]);

    const myOrganizedEvents = useMemo(
        () => events.filter((e: CalendarEventType) => e.my_invitation_status === 'ORGANIZER'),
        [events]
    );

    const { data: rsvpStatusMap = {} } = useQuery<Record<number, any[]>>({
        queryKey: ['events-rsvp-bulk', myOrganizedEvents.map(e => e.id).sort().join(',')],
        queryFn: async () => {
            if (myOrganizedEvents.length === 0) return {};
            const results = await Promise.all(
                myOrganizedEvents.map(async (event: CalendarEventType) => {
                    try {
                        const rsvp = await eventApi.getEventRsvpStatus(event.id);
                        return { eventId: event.id, attendee_status: rsvp.attendee_status || [] };
                    } catch {
                        return { eventId: event.id, attendee_status: [] };
                    }
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

    const renderStatusDot = (event: any) => {
        if (seenEventIds.includes(event.id)) return null;
        if (event.my_invitation_status !== 'ORGANIZER') return null;

        const attendeeList = rsvpStatusMap[event.id] || [];
        if (attendeeList.length === 0) return null;

        const hasDeclined = attendeeList.some((a: any) => a.status === 'DECLINED');
        const everyoneAccepted = attendeeList.every((a: any) => a.status === 'ACCEPTED');

        if (hasDeclined) {
            return (
                <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse z-50 shadow-sm"
                    title="Someone declined"
                />
            );
        }
        if (everyoneAccepted) {
            return (
                <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white z-50 shadow-sm"
                    title="All accepted"
                />
            );
        }
        return null;
    };

    // Automatically open event from URL parameters 
    React.useEffect(() => {
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

    const {
        data: tasksData,
        isLoading,
        fetchNextPage: fetchNextTasksPage,
        hasNextPage: hasNextTasksPage,
        isFetchingNextPage: isFetchingNextTasksPage
    } = useInfiniteQuery({
        queryKey: ['tasks-calendar', currentDate.getFullYear(), currentDate.getMonth()],
        queryFn: async ({ pageParam = 1 }) => {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const firstDay = new Date(year, month, -7).toISOString().split('T')[0];
            const lastDay = new Date(year, month + 1, 7).toISOString().split('T')[0];

            return taskApi.list({
                start_date__gte: firstDay,
                end_date__lte: lastDay,
                page: pageParam
            });
        },
        getNextPageParam: (lastPage: any) => {
            if (lastPage?.next) {
                const url = new URL(lastPage.next);
                const pageString = url.searchParams.get('page');
                return pageString ? Number(pageString) : undefined;
            }
            return undefined;
        },
        initialPageParam: 1,
        enabled: !!user,
    });

    React.useEffect(() => {
        if (hasNextTasksPage && !isFetchingNextTasksPage) {
            fetchNextTasksPage();
        }
    }, [hasNextTasksPage, isFetchingNextTasksPage, fetchNextTasksPage]);

    useEffect(() => {
        if (dyuksaResponse) {
            const timer = setTimeout(() => {
                setDyuksaResponse(null);
            }, 5000)
            return () => clearTimeout(timer);
        }
    }, [dyuksaResponse]);

    const tasks = useMemo(() => {
        if (!tasksData || !user) return [];
        const allTasks = tasksData.pages.flatMap((page: any) => page.results || page.tasks || page);
        if (user.role === 'admin') return allTasks;
        if (user.role === 'manager') {
            return allTasks.filter((task: Task) =>
                task.assigned_by === user.id || task.assigned_to.includes(user.id)
            );
        }
        return allTasks.filter((task: Task) => task.assigned_to.includes(user.id));
    }, [tasksData, user]);

    const getCalendarDays = useCallback((): CalendarDay[] => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const startDate = new Date(firstDayOfMonth);
        startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
        const endDate = new Date(lastDayOfMonth);
        const daysToAdd = 6 - lastDayOfMonth.getDay();
        endDate.setDate(endDate.getDate() + daysToAdd);

        const days: CalendarDay[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const toLocalDateStr = (iso: string | undefined) => {
            if (!iso) return '';
            if (!iso.includes('T')) return iso.split('T')[0];
            const d = new Date(iso);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };

        const currentDateIter = new Date(startDate);
        while (currentDateIter <= endDate) {
            const dateStr = `${currentDateIter.getFullYear()}-${String(currentDateIter.getMonth() + 1).padStart(2, '0')}-${String(currentDateIter.getDate()).padStart(2, '0')}`;
            const dayTasks = tasks.filter((task: Task) => {
                const startDateStr = toLocalDateStr(task.start_date);
                const endDateStr = toLocalDateStr(task.end_date);
                if (startDateStr && endDateStr) {
                    return dateStr >= startDateStr && dateStr <= endDateStr;
                }
                return startDateStr === dateStr || endDateStr === dateStr;
            });

            const dayEvents = filteredEvents.filter((event: CalendarEventType) => {
                const startDateStr = toLocalDateStr(event.start_time);
                const endDateStr = toLocalDateStr(event.end_time);
                if (startDateStr && endDateStr) {
                    return dateStr >= startDateStr && dateStr <= endDateStr;
                }
                return startDateStr === dateStr || endDateStr === dateStr;
            });

            days.push({
                date: new Date(currentDateIter),
                isCurrentMonth: currentDateIter.getMonth() === month,
                isToday: currentDateIter.toDateString() === today.toDateString(),
                tasks: dayTasks,
                events: dayEvents,
            });

            currentDateIter.setDate(currentDateIter.getDate() + 1);
        }
        return days;
    }, [currentDate, tasks, events]);

    const calendarDays = useMemo(() => getCalendarDays(), [getCalendarDays]);

    const navigateDate = (direction: 'prev' | 'next') => {
        setCurrentDate((prev) => {
            const newDate = new Date(prev);
            if (viewMode === 'month') {
                newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
            } else if (viewMode === 'day') {
                newDate.setDate(prev.getDate() + (direction === 'next' ? 1 : -1));
            } else {
                newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
            }
            return newDate;
        });
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const handleTaskClick = useCallback((task: Task) => {
        setSelectedTask(task);
    }, []);

    const handleEventClick = useCallback((event: CalendarEventType) => {
        setSelectedEvent(event);
        setIsEventModalOpen(true);
        setSeenEventIds((prev) => {
            if (!prev.includes(event.id)) {
                const newSeen = [...prev, event.id];
                localStorage.setItem('seen_event_notifications', JSON.stringify(newSeen));
                return newSeen;
            }
            return prev;
        });
    }, []);

    const handleDateClick = useCallback((date: Date) => {
        setSelectedDate(date);
    }, []);

    const selectedDateTasks = useMemo(() => {
        if (!selectedDate) return [];
        // Use local timezone formatting instead of UTC to prevent day-shifting
        const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const toLocalDateStr = (iso: string | undefined) => {
            if (!iso) return '';
            if (!iso.includes('T')) return iso.split('T')[0];
            const d = new Date(iso);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        return tasks.filter((task: Task) => {
            const startDateStr = toLocalDateStr(task.start_date);
            const endDateStr = toLocalDateStr(task.end_date);
            if (startDateStr && endDateStr) {
                return dateStr >= startDateStr && dateStr <= endDateStr;
            }
            return startDateStr === dateStr || endDateStr === dateStr;
        });
    }, [selectedDate, tasks]);

    const selectedDateEvents = useMemo(() => {
        if (!selectedDate) return [];
        const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const toLocalDateStr = (iso: string | undefined) => {
            if (!iso) return '';
            if (!iso.includes('T')) return iso.split('T')[0];
            const d = new Date(iso);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        return events.filter((event: CalendarEventType) => {
            const startDateStr = toLocalDateStr(event.start_time);
            const endDateStr = toLocalDateStr(event.end_time);
            if (startDateStr && endDateStr) {
                return dateStr >= startDateStr && dateStr <= endDateStr;
            }
            return startDateStr === dateStr || endDateStr === dateStr;
        });
    }, [selectedDate, events]);

    const getHeaderTitle = () => {
        if (viewMode === 'month') {
            return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        }
        if (viewMode === 'day') {
            return `${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        }

        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + (viewMode === 'work_week' ? 1 : 0));

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + (viewMode === 'work_week' ? 4 : 6));

        if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
            return `${MONTHS[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
        }
        return `${MONTHS[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${MONTHS[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
    };

    const taskStats = useMemo(() => {
        return {
            total: tasks.length,
            completed: tasks.filter((t: Task) => t.status.toLowerCase() === 'completed').length,
            inProgress: tasks.filter((t: Task) => t.status.toLowerCase() === 'in_progress').length,
            pending: tasks.filter((t: Task) => t.status.toLowerCase() === 'pending').length,
        };
    }, [tasks]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-gray-500">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
                <p>Loading calendar...</p>
            </div>
        );
    }

    return (
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6 pb-8 space-y-6">

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-white p-3 rounded-xl border border-gray-200 shadow-sm sticky top-0 z-30">
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                    <h5 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <CalendarIcon className="w-6 h-6 text-blue-600" />
                        Calendar
                    </h5>
                    <button
                        onClick={goToToday}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        Today
                    </button>

                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-200 p-1">
                        <button
                            onClick={() => navigateDate('prev')}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => navigateDate('next')}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 ml-2 hidden sm:block">
                        {getHeaderTitle()}
                    </h2>
                </div>

                <h2 className="text-lg font-bold text-gray-900 sm:hidden w-full text-center">
                    {getHeaderTitle()}
                </h2>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <div className="flex flex-wrap bg-gray-100 p-1 rounded-lg border border-gray-200 w-full sm:w-auto">
                        {(['day', 'work_week', 'week', 'month'] as ViewMode[]).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`
                                    flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex-1 sm:flex-none whitespace-nowrap
                                    ${viewMode === mode
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900'}
                                `}
                            >
                                {mode === 'month' ? <Grid3X3 size={16} /> : mode === 'day' ? <CalendarIcon size={16} /> : <List size={16} />}
                                <span className="capitalize">{mode.replace('_', ' ')}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => {
                                setSelectedDate(null);
                                setIsEventModalOpen(true);
                            }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg border border-indigo-200 transition-colors shadow-sm"
                            title="New event"
                        >
                            <CalendarPlus size={18} />
                            <span className="text-sm font-medium">New event</span>
                        </button>
                        {/* Settings Dropdown */}
                        <div className="relative flex-1 sm:flex-none" ref={settingsDropdownRef}>
                            <button
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border transition-colors shadow-sm ${isSettingsOpen || includeSharedEvents
                                    ? 'bg-gray-100 text-gray-700 border-gray-300'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                    }`}
                                title="Calendar Settings"
                            >
                                <Settings size={18} />
                                <span className="text-sm font-medium">Settings</span>
                                <ChevronDown size={14} className={`transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Settings Dropdown Menu */}
                            {isSettingsOpen && (
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                                    {/* Header */}
                                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                                        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                            <Settings size={16} />
                                            Calendar Settings
                                        </h3>
                                    </div>

                                    {/* Show Shared Events Toggle */}
                                    <div className="px-4 py-3 border-b border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-700">Show Shared Events</span>
                                            <button
                                                onClick={() => {
                                                    setIncludeSharedEvents(!includeSharedEvents);
                                                    if (includeSharedEvents) {
                                                        setSelectedUserIds([]);
                                                    }
                                                }}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${includeSharedEvents ? 'bg-purple-600' : 'bg-gray-300'
                                                    }`}
                                            >
                                                <span
                                                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${includeSharedEvents ? 'translate-x-5' : 'translate-x-0'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Share My Calendar */}
                                    <button
                                        onClick={() => {
                                            setIsShareModalOpen(true);
                                            setIsSettingsOpen(false);
                                        }}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
                                    >
                                        <Share2 size={18} className="text-green-600" />
                                        <span className="text-sm font-medium text-gray-700">Share My Calendar</span>
                                    </button>

                                    {/* View Shared Calendars */}
                                    {includeSharedEvents && (
                                        <div className="px-4 py-3">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Users size={16} className="text-purple-600" />
                                                <span className="text-sm font-semibold text-gray-700">View Shared Calendars</span>
                                            </div>

                                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                                {/* All Option */}
                                                <label className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer border-b border-gray-100 mb-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUserIds.length === sharedWithMeUsers.length && sharedWithMeUsers.length > 0}
                                                        onChange={() => {
                                                            if (selectedUserIds.length === sharedWithMeUsers.length) {
                                                                setSelectedUserIds([]); // Clear All
                                                            } else {
                                                                setSelectedUserIds(sharedWithMeUsers.map((u: any) => u.id)); // Select All
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                                    />
                                                    <span className="text-sm font-semibold text-gray-700">All Shared Calendars</span>
                                                </label>

                                                {/* View Shared Calendars */}
                                                {includeSharedEvents && (
                                                    <div className="px-4 py-3">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <Users size={16} className="text-purple-600" />
                                                            <span className="text-sm font-semibold text-gray-700">View Shared Calendars</span>
                                                        </div>

                                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                                            {sharedWithMeUsers.length > 0 ? (
                                                                <>
                                                                    {/* Select All Member Toggle */}
                                                                    <label className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer border-b border-gray-100 mb-1">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedUserIds.length === sharedWithMeUsers.length}
                                                                            onChange={() => {
                                                                                if (selectedUserIds.length === sharedWithMeUsers.length) {
                                                                                    setSelectedUserIds([]);
                                                                                } else {
                                                                                    setSelectedUserIds(sharedWithMeUsers.map((u: any) => u.id));
                                                                                }
                                                                            }}
                                                                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                                                        />
                                                                        <span className="text-sm font-medium text-gray-700">Select All Members</span>
                                                                    </label>

                                                                    {/* Individual Users List */}
                                                                    {sharedWithMeUsers.map((u: any) => {
                                                                        const isSelected = selectedUserIds.includes(u.id);
                                                                        return (
                                                                            <label
                                                                                key={u.id}
                                                                                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isSelected}
                                                                                    onChange={() => {
                                                                                        setSelectedUserIds(prev =>
                                                                                            isSelected
                                                                                                ? prev.filter(id => id !== u.id)
                                                                                                : [...prev, u.id]
                                                                                        );
                                                                                    }}
                                                                                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                                                                />
                                                                                <div className="flex items-center gap-2 flex-1">
                                                                                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">
                                                                                        {u.name?.charAt(0)?.toUpperCase()}
                                                                                    </div>
                                                                                    <span className="text-sm text-gray-700">{u.name}</span>
                                                                                </div>
                                                                                {isSelected && <Check size={14} className="text-purple-600" />}
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </>
                                                            ) : (
                                                                <div className="px-2 py-3 text-center text-sm text-gray-500 italic">
                                                                    No calendars shared with you
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={dyuksaInput}
                            onChange={(e) => setDyuksaInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDyuksaSubmit()}
                            placeholder='Try: "dyuksa find 30 mins with Shifali tomorrow"'
                            className="w-full px-4 py-2.5 pl-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                        <Sparkles size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500" />
                    </div>
                    <button
                        onClick={handleDyuksaSubmit}
                        disabled={isDyuksaLoading || !dyuksaInput.trim()}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                    >
                        {isDyuksaLoading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Thinking...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                Ask Dyuksa
                            </>
                        )}
                    </button>
                </div>

                {/* Dyuksa Response */}
                {dyuksaResponse && (
                    <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                                <Sparkles size={14} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-purple-900 uppercase tracking-wider mb-1">Dyuksa AI</p>
                                <p className="text-sm text-purple-800 whitespace-pre-wrap">{dyuksaResponse}</p>
                            </div>
                            <button
                                onClick={() => setDyuksaResponse(null)}
                                className="p-1 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Calendar Content Area */}
            <div className="flex gap-6 min-h-[600px]">
                {/* Left Sidebar: Mini Calendar */}
                <div className="hidden lg:flex flex-col w-56 flex-shrink-0 space-y-6">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <MiniCalendar
                            currentDate={currentDate}
                            onDateSelect={(date) => setCurrentDate(date)}
                            includeSharedEvents={includeSharedEvents}
                            onToggleSharedEvents={setIncludeSharedEvents}
                            sharedWithMeUsers={sharedWithMeUsers}
                            selectedUserIds={selectedUserIds}
                            onToggleUser={(userId) => {
                                setSelectedUserIds(prev =>
                                    prev.includes(userId)
                                        ? prev.filter(id => id !== userId)
                                        : [...prev, userId]
                                );
                            }}
                        />
                    </div>

                </div>

                <div className={`flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${selectedDate ? 'hidden md:flex' : 'flex'}`}>
                    {viewMode === 'month' ? (
                        <>
                            {/* Month Header */}
                            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                                {DAYS_OF_WEEK.map((day) => (
                                    <div key={day} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Month Grid */}
                            <div className="grid grid-cols-7 auto-rows-fr flex-1">
                                {calendarDays.map((day, index) => (
                                    <DayCell
                                        key={index}
                                        day={day}
                                        onTaskClick={handleTaskClick}
                                        onEventClick={handleEventClick}
                                        onDateClick={handleDateClick}
                                        onEventDrop={(eventId, newDate) => {
                                            const draggedEvent = events.find(ev => String(ev.id) === eventId);
                                            if (!draggedEvent) return;

                                            const originalStart = new Date(draggedEvent.start_time);
                                            const originalEnd = new Date(draggedEvent.end_time);
                                            const duration = originalEnd.getTime() - originalStart.getTime();

                                            const newStart = new Date(newDate);
                                            newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
                                            const newEnd = new Date(newStart.getTime() + duration);

                                            updateEventMutation({
                                                id: draggedEvent.id,
                                                start_time: newStart.toISOString(),
                                                end_time: newEnd.toISOString(),
                                            });
                                        }}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <DaysView
                            currentDate={currentDate}
                            tasks={tasks}
                            events={filteredEvents}
                            selectedDate={selectedDate}
                            seenEventIds={seenEventIds}
                            renderStatusDot={renderStatusDot}
                            onTaskClick={handleTaskClick}
                            onEventClick={handleEventClick}
                            onDateClick={handleDateClick}
                            onCreateEventAtTime={(date, hour) => {
                                setSelectedDate(date);
                                setSelectedHour(hour);
                                setIsEventModalOpen(true);
                            }}
                            viewMode={viewMode as 'day' | 'work_week' | 'week'}
                            updateEvent={updateEventMutation}
                            currentUser={user ? { id: user.id, role: user.role } : null}
                            onAcceptInvitation={handleAcceptInvitation}
                            onDeclineInvitation={handleDeclineClick}
                            onRescheduleInvitation={handleRescheduleClick}
                            isAccepting={isAccepting}
                            onEventContextMenu={handleEventContextMenu}
                        />
                    )}
                </div>

                {selectedDate && (
                    <TaskListSidebar
                        tasks={selectedDateTasks}
                        events={selectedDateEvents}
                        selectedDate={selectedDate}
                        onTaskClick={handleTaskClick}
                        onEventClick={handleEventClick}
                        onClose={() => setSelectedDate(null)}
                        currentUser={user ? { id: user.id, role: user.role } : null}
                        onOpenEventModal={() => setIsEventModalOpen(true)}
                        onAcceptInvitation={handleAcceptInvitation}
                        onDeclineInvitation={handleDeclineClick}
                        onRescheduleInvitation={handleRescheduleClick}
                        isAccepting={isAccepting}

                    />
                )}
            </div> { }

            {/* Status Legend Footer */}
            <div className="flex flex-wrap items-center gap-4 px-6 py-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <span className="text-sm font-semibold text-gray-500">Status:</span>
                <div className="flex flex-wrap gap-4">
                    {[
                        { status: 'pending', label: 'Pending' },
                        { status: 'in_progress', label: 'In Progress' },
                        { status: 'completed', label: 'Completed' },
                        { status: 'deployed', label: 'Deployed' },
                        { status: 'deferred', label: 'Deferred' },
                        { status: 'review', label: 'Review' },
                    ].map(({ status, label }) => {
                        const config = getStatusConfig(status);
                        return (
                            <div key={status} className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color }} />
                                <span className="text-xs font-medium text-gray-600">{label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <EventModal
                isOpen={isEventModalOpen}
                onClose={() => {
                    setIsEventModalOpen(false);
                    setSelectedEvent(null);
                    setSelectedDate(null);
                    setSelectedHour(null);
                    setDyuksaEventData(null);
                }}
                selectedDate={selectedDate}
                selectedHour={selectedHour}
                event={selectedEvent}
                currentUser={user ? { id: user.id, role: user.role } : null}
                allEvents={events}
                onAcceptInvitation={handleAcceptInvitation}
                onDeclineInvitation={handleDeclineClick}
                onRescheduleInvitation={handleRescheduleClick}
                isAccepting={isAccepting}
                dyuksaEventData={dyuksaEventData}
            />

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onDelete={async () => setSelectedTask(null)}
                    onTaskUpdated={(updatedTask) => setSelectedTask(updatedTask)}
                />

            )}
            <DeclineModal
                isOpen={showDeclineModal}
                onClose={() => {
                    setShowDeclineModal(false);
                    setSelectedInvitationEvent(null);
                }}
                onDecline={handleDeclineSubmit}
                isLoading={isDeclining}
                eventTitle={selectedInvitationEvent?.title}
            />

            <RescheduleModal
                isOpen={showRescheduleModal}
                onClose={() => {
                    setShowRescheduleModal(false);
                    setSelectedInvitationEvent(null);
                }}
                onReschedule={handleRescheduleSubmit}
                isLoading={isRescheduling}
                eventTitle={selectedInvitationEvent?.title}
                originalTime={selectedInvitationEvent?.start_time}
            />
            {/* Share Calendar Modal */}
            <ShareCalendarModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                currentUserId={user?.id || 0}
            />

            {/* EVENT CONTEXT MENU */}
            {contextMenu && (
                <div
                    className="fixed z-[100] bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[200px]"
                    style={{
                        top: Math.min(contextMenu.y, window.innerHeight - 250),
                        left: Math.min(contextMenu.x, window.innerWidth - 220)
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Repeat Event */}
                    <div
                        className="relative"
                        onMouseEnter={() => setShowRepeatSubmenu(true)}
                        onMouseLeave={() => setShowRepeatSubmenu(false)}
                    >
                        <button
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                        >
                            <span className="flex items-center gap-3">
                                <RefreshCw size={16} className="text-gray-400" />
                                Repeat event
                            </span>
                            <ChevronRight size={14} className="text-gray-400" />
                        </button>

                        {/* Repeat Submenu */}
                        {showRepeatSubmenu && (
                            <div
                                className="absolute top-0 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[180px]"
                                style={
                                    contextMenu.x + 400 > window.innerWidth
                                        ? { right: '100%', marginRight: '4px' }
                                        : { left: '100%', marginLeft: '4px' }
                                }
                            >
                                {/* Tomorrow */}
                                <button
                                    onClick={async () => {
                                        if (contextMenu?.event) {
                                            try {
                                                const originalStart = new Date(contextMenu.event.start_time);
                                                const originalEnd = new Date(contextMenu.event.end_time);

                                                const tomorrowStart = new Date(originalStart);
                                                tomorrowStart.setDate(tomorrowStart.getDate() + 1);

                                                const tomorrowEnd = new Date(originalEnd);
                                                tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

                                                await eventApi.create({
                                                    title: contextMenu.event.title,
                                                    event_type: contextMenu.event.event_type,
                                                    start_time: tomorrowStart.toISOString(),
                                                    end_time: tomorrowEnd.toISOString(),
                                                    location: contextMenu.event.location,
                                                    is_online_meeting: contextMenu.event.is_online_meeting,
                                                    description: contextMenu.event.description,
                                                    attendees: contextMenu.event.attendees
                                                });
                                                queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
                                                closeContextMenu();
                                            } catch (error) {
                                                console.error('Failed to copy event to tomorrow:', error);
                                            }
                                        }
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    Tomorrow
                                </button>
                                <button
                                    onClick={() => handleRepeatEvent('workday')}
                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    Every workday
                                </button>
                                <button
                                    onClick={() => handleRepeatEvent('weekly')}
                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    Every week
                                </button>
                                <button
                                    onClick={() => handleRepeatEvent('monthly')}
                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    Every month
                                </button>
                                <button
                                    onClick={() => handleRepeatEvent('yearly')}
                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    Every year
                                </button>
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                                    onClick={() => {
                                        closeContextMenu();
                                    }}
                                >
                                    <Settings size={14} className="text-gray-400" />
                                    Custom repeat
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-100 my-1" />

                    {/* Duplicate Event */}
                    <button
                        onClick={async () => {
                            if (contextMenu.event) {
                                try {
                                    await eventApi.create({
                                        title: contextMenu.event.title,
                                        event_type: contextMenu.event.event_type,
                                        start_time: contextMenu.event.start_time,
                                        end_time: contextMenu.event.end_time,
                                        location: contextMenu.event.location,
                                        is_online_meeting: contextMenu.event.is_online_meeting,
                                        description: contextMenu.event.description,
                                        attendees: contextMenu.event.attendees
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
                                } catch (error) {
                                    console.error('Failed to duplicate event:', error);
                                }
                            }
                            closeContextMenu();
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                    >
                        <Copy size={16} className="text-gray-400" />
                        Duplicate event
                    </button>

                    {/* Download ICS */}
                    <button
                        onClick={async () => {
                            if (contextMenu.event?.id) {
                                try {
                                    await eventApi.exportEvent(contextMenu.event.id);
                                } catch (error) {
                                    console.error('Failed to export event:', error);
                                    alert('Failed to download event');
                                }
                            }
                            closeContextMenu();
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                    >
                        <Download size={16} className="text-gray-400" />
                        Download ICS
                    </button>

                    {/* Delete This Event */}
                    <button
                        onClick={async () => {
                            if (contextMenu.event?.id) {
                                try {
                                    await eventApi.delete(contextMenu.event.id);
                                    await queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
                                    await queryClient.refetchQueries({ queryKey: ['events-calendar'] });
                                } catch (error) {
                                    console.error('Failed to delete event:', error);
                                }
                            }
                            closeContextMenu();
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                    >
                        <Trash2 size={16} className="text-red-400" />
                        Delete this event
                    </button>

                    {/* Delete All Similar Events */}
                    <button
                        onClick={async () => {
                            if (contextMenu.event) {
                                const eventTitle = contextMenu.event.title;
                                const eventHour = new Date(contextMenu.event.start_time).getHours();
                                const eventMinute = new Date(contextMenu.event.start_time).getMinutes();

                                // Find all events with same title and time
                                const similarEvents = events.filter(e => {
                                    const eHour = new Date(e.start_time).getHours();
                                    const eMinute = new Date(e.start_time).getMinutes();
                                    return e.title === eventTitle && eHour === eventHour && eMinute === eventMinute;
                                });

                                const confirmDelete = window.confirm(
                                    `Delete ${similarEvents.length} event(s) with title "${eventTitle}"?\n\nThis action cannot be undone.`
                                );

                                if (confirmDelete) {
                                    try {
                                        for (const evt of similarEvents) {
                                            await eventApi.delete(evt.id);
                                        }
                                        await queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
                                        await queryClient.refetchQueries({ queryKey: ['events-calendar'] });
                                    } catch (error) {
                                        console.error('Failed to delete events:', error);
                                    }
                                }
                            }
                            closeContextMenu();
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                    >
                        <Trash2 size={16} className="text-red-400" />
                        Delete all similar events
                    </button>
                </div>
            )}
        </div>
    );
};

export default Calendar;