import React from 'react';
import { CalendarPlus, Check, X, RefreshCw, Loader2 } from 'lucide-react';
import type { Task, Event as CalendarEventType } from '@/types';
import { DAYS_OF_WEEK, getEventStatusColors } from '../calendarConstants';
import { CalendarEventUI } from './CalendarEventUI';
import { TaskEvent } from './TaskEvent';

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

export const DaysView: React.FC<DaysViewProps> = ({
    currentDate, tasks, events, selectedDate, onTaskClick, onEventClick, onDateClick, onCreateEventAtTime, viewMode,
    updateEvent,
    currentUser,
    onAcceptInvitation,
    onDeclineInvitation,
    onRescheduleInvitation,
    isAccepting,
    onEventContextMenu,
    seenEventIds: _seenEventIds,
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

