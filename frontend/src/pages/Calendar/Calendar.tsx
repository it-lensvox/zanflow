import React, { useState, useMemo, useCallback } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Users,
    Grid3X3,
    List,
    ClipboardList,
    Send,
    Loader2,
    CheckSquare,
    Clock,
    MapPin,
    Video,
    X,
    CalendarPlus,
    Trash2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { taskApi, dailyUpdateApi, eventApi, usersApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { TaskDetailModal } from '../MyTask/TaskDetailModal';
import type { Task, DailyUpdate, DailyUpdatePayload, Event as CalendarEventType } from '@/types';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';

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

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    tasks: Task[];
    events: CalendarEventType[];
}

// --- Components ---

interface CalendarEventUIProps {
    event: CalendarEventType;
    onClick: (event: CalendarEventType) => void;
    compact?: boolean;
}

const CalendarEventUI: React.FC<CalendarEventUIProps> = ({ event, onClick, compact = false }) => {
    return (
        <div
        onDragStart={(e) => {
            e.dataTransfer.setData("eventId", String(event.id));
        }}
            className={`
                group relative flex items-center gap-2 rounded-md cursor-pointer transition-all duration-200 border border-transparent hover:shadow-sm hover:z-10 bg-indigo-50 text-indigo-700
                ${compact ? 'py-0.5 px-1.5' : 'py-1 px-2'}
            `}
            onClick={(e) => {
                e.stopPropagation();
                onClick(event);
            }}
            title={event.title}
        >
            <div className="w-1 h-full absolute left-0 top-0 bottom-0 rounded-l-md bg-indigo-500" />
            <CalendarIcon size={compact ? 12 : 14} className="flex-shrink-0 text-indigo-500" />
            <span className={`font-medium truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
                {event.title}
            </span>
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
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ currentDate, onDateSelect }) => {
    // Internal state to track which month the mini calendar is currently viewing
    const [navDate, setNavDate] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    const month = navDate.getMonth();
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
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                    <div key={d} className="text-[10px] font-bold text-gray-400 text-center py-1">{d}</div>
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
        </div>
    );
};

interface DayCellProps {
    day: CalendarDay;
    onTaskClick: (task: Task) => void;
    onEventClick?: (event: CalendarEventType) => void;
    onDateClick: (date: Date) => void;
}

const DayCell: React.FC<DayCellProps> = ({ day, onTaskClick, onEventClick, onDateClick }) => {
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
                    <CalendarEventUI 
                    key={`event-${event.id}`} 
                    event={event} 
                    onClick={(ev) => onEventClick && onEventClick(ev)} 
                    compact 
                />
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
    onTaskClick: (task: Task) => void;
    onEventClick?: (event: CalendarEventType) => void;
    onDateClick: (date: Date) => void;
    viewMode: 'day' | 'work_week' | 'week';
    updateEvent: (data: Partial<CalendarEventType>) => void; 
    currentUser: { id: number; role: string } | null; 
}

const DaysView: React.FC<DaysViewProps> = ({ currentDate, tasks, events, selectedDate, onTaskClick, onEventClick, onDateClick, viewMode }) => {
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const scrollToDefault = () => {
            if (scrollContainerRef.current) {
                // Calculate position for 9:00 AM (9 hours * 64px)
                // We subtract 10px to give a little padding above the 09:00 label
                const scrollPos = (9 * 64) - 10;
                scrollContainerRef.current.scrollTop = scrollPos;
            }
        };

        // Execute after a short delay to ensure DOM is painted
        const timeoutId = setTimeout(scrollToDefault, 100);
        return () => clearTimeout(timeoutId);
    }, [viewMode, currentDate]);

    const getDays = () => {
        const days: Date[] = [];
        if (viewMode === 'day') {
            days.push(new Date(currentDate));
            return days;
        }
        
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        if (viewMode === 'work_week') {
            for (let i = 1; i <= 5; i++) { // Monday to Friday
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
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return tasks.filter((task) => {
            const startDate = toLocalDateStr(task.start_date);
            const endDate = toLocalDateStr(task.end_date);
            return (startDate && startDate <= dateStr && endDate && endDate >= dateStr) ||
                startDate === dateStr ||
                endDate === dateStr;
        });
    };

    const getEventsForDate = (date: Date) => {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return events.filter((event) => {
            const startDate = toLocalDateStr(event.start_time);
            const endDate = toLocalDateStr(event.end_time);
            return (startDate && startDate <= dateStr && endDate && endDate >= dateStr) ||
                startDate === dateStr ||
                endDate === dateStr;
        });
    };
    
    const gridColsClass = displayDays.length === 1 ? 'grid-cols-1' : displayDays.length === 5 ? 'grid-cols-5' : 'grid-cols-7';
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden relative">
            <div className="sticky top-[160px] sm:top-[76px] z-20 flex flex-col bg-white"></div>
                {/* Header Row */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                    <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50"></div>
                    <div className={`grid ${gridColsClass} flex-1`}>
                        {displayDays.map((day, index) => {
                            const isToday = day.toDateString() === today.toDateString();
                            return (
                                <div key={index} className={`flex flex-col items-center justify-center py-3 px-2 border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-blue-50/50' : ''}`}>
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
    const dayEvents = getEventsForDate(day);
    
    // Remove true All-Day events from the hourly grid (they are shown in top row)
    const hourlyEvents = dayEvents.filter(e => {
        const s = new Date(e.start_time);
        const end = new Date(e.end_time);
        return !(s.getHours() === 0 && s.getMinutes() === 0 && end.getHours() === 23 && end.getMinutes() === 59);
    });

    const isToday = day.toDateString() === today.toDateString();
    const isSelected = selectedDate?.toDateString() === day.toDateString();

    const dailyPositionedEvents = hourlyEvents.map(event => {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        
        let effectiveStart = new Date(start);
        let effectiveEnd = new Date(end);
        const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();

        if (durationHours > 24) {
            effectiveStart = new Date(day);
            effectiveStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
            effectiveEnd = new Date(day);
            let eHours = end.getHours();
            let eMins = end.getMinutes();
            if (eHours < start.getHours() || (eHours === start.getHours() && eMins < start.getMinutes())) {
                effectiveEnd.setHours(23, 59, 59, 999);
            } else {
                effectiveEnd.setHours(eHours, eMins, 0, 0);
            }
        } else {
            if (!isSameDay(start, day)) {
                effectiveStart = new Date(day);
                effectiveStart.setHours(0, 0, 0, 0);
            }
            if (!isSameDay(end, day)) {
                effectiveEnd = new Date(day);
                effectiveEnd.setHours(23, 59, 59, 999);
            }
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
            className={`relative h-[1536px] cursor-pointer transition-colors hover:bg-gray-50/50
                ${isToday ? 'bg-blue-50/10' : ''}
                ${isSelected ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/20' : ''}
            `}
            onDragOver={(e) => e.preventDefault()} // CRITICAL: Allows the drop to happen
            onDrop={(e) => {
                e.preventDefault();
                const eventId = e.dataTransfer.getData("eventId");
                const draggedEvent = events.find(ev => String(ev.id) === eventId);
                
                if (!draggedEvent) return;

                // Calculate drop position
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const droppedHour = Math.floor(y / 64);
                
                const newStart = new Date(day);
                newStart.setHours(droppedHour, 0, 0, 0);
                
                const duration = new Date(draggedEvent.end_time).getTime() - new Date(draggedEvent.start_time).getTime();
                const newEnd = new Date(newStart.getTime() + duration);

                // 1. Conflict Check: Is the employee already busy?
                const hasConflict = events.some(ev => {
                    if (ev.id === draggedEvent.id) return false;
                    const evStart = new Date(ev.start_time);
                    const evEnd = new Date(ev.end_time);
                    return ev.organizer === draggedEvent.organizer && newStart < evEnd && newEnd > evStart;
                });

                if (hasConflict) {
                    alert("This time slot is already taken! The event will stay in its original position.");
                    return;
                }

                // 2. 5-Event Limit Check: Only check if moving to a different date
                if (new Date(draggedEvent.start_time).toDateString() !== newStart.toDateString()) {
                    const dayCount = events.filter(ev => 
                        new Date(ev.start_time).toDateString() === newStart.toDateString() && 
                        ev.organizer === currentUser?.id
                    ).length;

                    if (dayCount >= 5) {
                        alert("Daily limit reached! You cannot move more than 5 events to this day.");
                        return;
                    }
                }

                // Trigger update via mutation passed from parent
                updateEvent({
                    id: draggedEvent.id,
                    start_time: newStart.toISOString(),
                    end_time: newEnd.toISOString()
                });
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onDateClick(day);
                }
            }}
        >
            {positionedEvents.map(({ event, effectiveStart, effectiveEnd, orderIndex, totalOverlaps }) => {
                const startMinutes = (effectiveStart.getHours() * 60) + effectiveStart.getMinutes();
                const endMinutes = (effectiveEnd.getHours() * 60) + effectiveEnd.getMinutes();
                const durationMinutes = endMinutes - startMinutes;
                const topOffset = startMinutes * (64 / 60); 
                const eventHeight = Math.max(durationMinutes * (64 / 60), 24); 
                const widthPercent = 100 / totalOverlaps;
                const leftPercent = orderIndex * widthPercent;

                return (
                    <div
                        key={`event-${event.id}`}
                        className="absolute transition-all duration-200 p-0.5 group hover:!z-50 hover:!w-[calc(100%-8px)] hover:!left-1"
                        style={{ 
                            top: `${topOffset}px`, 
                            height: `${eventHeight}px`,
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            zIndex: 10 + orderIndex
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onEventClick) onEventClick(event);
                        }}
                    >
                        <div className="h-full w-full bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md overflow-hidden p-1.5 text-xs leading-tight cursor-pointer shadow-sm group-hover:bg-indigo-100 group-hover:shadow-md transition-all flex flex-col relative">
                            <div className="w-1 h-full absolute left-0 top-0 bottom-0 bg-indigo-500 rounded-l-md" />
                            <div className="font-semibold truncate ml-1">{event.title}</div>
                            {eventHeight >= 40 && (
                                <div className="text-[10px] truncate ml-1 opacity-80 mt-0.5">
                                    {effectiveStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})} - {effectiveEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
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

            {/* Hourly Timeline Grid */}
            <div 
                ref={scrollContainerRef} 
                className="flex-1 overflow-y-auto overflow-x-hidden bg-white relative border-t border-gray-200" 
                style={{ height: '550px', maxHeight: 'calc(100vh - 450px)' }}
            >
                <div className="flex min-w-full relative bg-white">
                    {/* Time Axis - Sticky left ensures it stays visible */}
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

                    {/* Day Columns */}
                    <div className={`grid ${gridColsClass} flex-1 divide-x divide-gray-200 relative bg-white`}>
                        {/* Horizontal Grid Lines */}
                        <div className="absolute inset-0 pointer-events-none flex flex-col">
                            {hours.map(hour => (
                                <div key={hour} className="h-16 border-b border-gray-100 w-full flex-shrink-0" />
                            ))}
                        </div>

                        {/* Column Content */}
                        {/* Column Content */}
                        {displayDays.map((day, index) => {
                            const dayEvents = getEventsForDate(day);
                            
                            // Remove true All-Day events from the hourly grid (they are shown in top row)
                            const hourlyEvents = dayEvents.filter(e => {
                                const s = new Date(e.start_time);
                                const end = new Date(e.end_time);
                                return !(s.getHours() === 0 && s.getMinutes() === 0 && end.getHours() === 23 && end.getMinutes() === 59);
                            });

                            const isToday = day.toDateString() === today.toDateString();
                            const isSelected = selectedDate?.toDateString() === day.toDateString();

                            // Pre-calculate effective start/end for THIS DAY to properly handle daily recurrence visually
                            const dailyPositionedEvents = hourlyEvents.map(event => {
                                const start = new Date(event.start_time);
                                const end = new Date(event.end_time);
                                const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                
                                let effectiveStart = new Date(start);
                                let effectiveEnd = new Date(end);
                                const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();

                                if (durationHours > 24) {
                                    // FAKE DAILY RECURRENCE (e.g. Work Week from 13:00 to 13:30)
                                    effectiveStart = new Date(day);
                                    effectiveStart.setHours(start.getHours(), start.getMinutes(), 0, 0);

                                    effectiveEnd = new Date(day);
                                    let eHours = end.getHours();
                                    let eMins = end.getMinutes();
                                    
                                    // If it crosses midnight, cap at 23:59 for visual grid simplicity
                                    if (eHours < start.getHours() || (eHours === start.getHours() && eMins < start.getMinutes())) {
                                        effectiveEnd.setHours(23, 59, 59, 999);
                                    } else {
                                        effectiveEnd.setHours(eHours, eMins, 0, 0);
                                    }
                                } else {
                                    // NORMAL SINGLE DAY OR OVERNIGHT EVENT
                                    if (!isSameDay(start, day)) {
                                        effectiveStart = new Date(day);
                                        effectiveStart.setHours(0, 0, 0, 0);
                                    }
                                    if (!isSameDay(end, day)) {
                                        effectiveEnd = new Date(day);
                                        effectiveEnd.setHours(23, 59, 59, 999);
                                    }
                                }
                                
                                return { event, effectiveStart, effectiveEnd };
                            });

                            // Calculate overlapping events based strictly on their DAILY effective times
                            const positionedEvents = dailyPositionedEvents.map((item, _, array) => {
                                const start = item.effectiveStart.getTime();
                                const end = item.effectiveEnd.getTime();
                                
                                const overlaps = array.filter(e => {
                                    return start < e.effectiveEnd.getTime() && end > e.effectiveStart.getTime();
                                });
                                
                                overlaps.sort((a, b) => a.effectiveStart.getTime() - b.effectiveStart.getTime());
                                const orderIndex = overlaps.findIndex(e => e.event.id === item.event.id);
                                return { ...item, orderIndex, totalOverlaps: overlaps.length };
                            });

                            return (
                                <div
                                    key={index}
                                    className={`relative h-[1536px] cursor-pointer transition-colors hover:bg-gray-50/50
                                        ${isToday ? 'bg-blue-50/10' : ''}
                                        ${isSelected ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/20' : ''}
                                    `}
                                    onClick={(e) => {
                                        // Open sidebar only if clicking empty space
                                        if (e.target === e.currentTarget) {
                                            onDateClick(day);
                                        }
                                    }}
                                >
                                    {positionedEvents.map(({ event, effectiveStart, effectiveEnd, orderIndex, totalOverlaps }) => {
                                        const startMinutes = (effectiveStart.getHours() * 60) + effectiveStart.getMinutes();
                                        const endMinutes = (effectiveEnd.getHours() * 60) + effectiveEnd.getMinutes();
                                        const durationMinutes = endMinutes - startMinutes;

                                        // 64px per hour -> 64/60 px per minute
                                        const topOffset = startMinutes * (64 / 60); 
                                        const eventHeight = Math.max(durationMinutes * (64 / 60), 24); 

                                        // Side-by-side splitting (prevents overlap hiding the text)
                                        const widthPercent = 100 / totalOverlaps;
                                        const leftPercent = orderIndex * widthPercent;

                                        return (
                                            <div
                                                key={`event-${event.id}`}
                                                className="absolute transition-all duration-200 p-0.5 group hover:!z-50 hover:!w-[calc(100%-8px)] hover:!left-1"
                                                style={{ 
                                                    top: `${topOffset}px`, 
                                                    height: `${eventHeight}px`,
                                                    left: `${leftPercent}%`,
                                                    width: `${widthPercent}%`,
                                                    zIndex: 10 + orderIndex
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onEventClick) onEventClick(event);
                                                }}
                                            >
                                                <div
                                                    className="h-full w-full bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md overflow-hidden p-1.5 text-xs leading-tight cursor-pointer shadow-sm group-hover:bg-indigo-100 group-hover:shadow-md transition-all flex flex-col relative"
                                                    title={`${event.title}\n${effectiveStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})} - ${effectiveEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}`}
                                                >
                                                    <div className="w-1 h-full absolute left-0 top-0 bottom-0 bg-indigo-500 rounded-l-md" />
                                                    <div className="font-semibold truncate ml-1">{event.title}</div>
                                                    {eventHeight >= 40 && (
                                                        <div className="text-[10px] truncate ml-1 opacity-80 mt-0.5">
                                                            {effectiveStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})} - {effectiveEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
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
}

// Helper: format date as "2 March 2026"

// Helper: format date as "2 March 2026"
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
        todays_priorities:  extract("Today's Priorities:-\n",   "Progress (Yesterday):-\n"),
        progress_yesterday: extract("Progress (Yesterday):-\n", "Blockers / Needs:-\n"),
        blockers:           extract("Blockers / Needs:-\n",      "Upcoming:-\n"),
        upcoming:           extract("Upcoming:-\n"),
    };
};

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date | null;
    event?: CalendarEventType | null;
    currentUser: { id: number; role: string } | null;
    allEvents: CalendarEventType[];
}

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, selectedDate, event, currentUser, allEvents }) => {
    // If the event exists and the current user is NOT the organizer, it is Read-Only
    const isReadOnly = Boolean(event && currentUser && event.organizer !== currentUser.id);
    const queryClient = useQueryClient();
    const [title, setTitle] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [location, setLocation] = useState('');
    const [isOnline, setIsOnline] = useState(false);
    const [description, setDescription] = useState('');
    
    // New states for Attendees Search & Select
    const [attendees, setAttendees] = useState<number[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [showStartTimeDropdown, setShowStartTimeDropdown] = useState(false);
    const [showEndTimeDropdown, setShowEndTimeDropdown] = useState(false);
    
    // Multi-day states
    const [isAllDay, setIsAllDay] = useState(false);
    const [allDayPreset, setAllDayPreset] = useState('1_day');

    // Fetch available team members
    const { data: availableUsers = [] } = useQuery({
        queryKey: ['users-list-events'],
        queryFn: usersApi.listAll,
        enabled: isOpen,
    });

    React.useEffect(() => {
        if (event && isOpen) {
            setTitle(event.title || '');
            const formatDt = (iso: string) => {
                if (!iso) return '';
                const d = new Date(iso);
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                return d.toISOString().slice(0, 16);
            };
            
            const sTime = formatDt(event.start_time);
            const eTime = formatDt(event.end_time);
            setStartTime(sTime);
            setEndTime(eTime);
            
            // Detect multi-day / all day events (>23 hours duration)
            const s = new Date(event.start_time);
                const e = new Date(event.end_time);
                
                // Strict check for true "All Day" events (00:00 to 23:59)
                if (s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 23 && e.getMinutes() === 59) {
                    setIsAllDay(true);
                    const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 1) setAllDayPreset('1_day');
                    else if (diffDays === 5) setAllDayPreset('work_week');
                    else if (diffDays === 7) setAllDayPreset('full_week');
                    else setAllDayPreset('custom');
                } else {
                    setIsAllDay(false);
                    // Detect if a specific-time event was saved with a multi-day duration preset
                    const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays === 0) setAllDayPreset('1_day');
                    else if (diffDays === 4) setAllDayPreset('work_week');
                    else if (diffDays === 6) setAllDayPreset('full_week');
                    else setAllDayPreset('custom');
                }

            setLocation(event.location || '');
            setIsOnline(event.is_online_meeting || false);
            setDescription(event.description || '');
            setAttendees(event.attendees || []);
            setUserSearch('');
            setShowUserDropdown(false);
        } else if (isOpen) {
            setError(null);
            // Safely fallback to today's date if no specific selectedDate is provided or if the selectedDate is in the past
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            
            let targetDate = selectedDate || new Date();
            if (targetDate < now) {
                targetDate = new Date(); // Reset to today if selected date is in the past
            }
            const y = targetDate.getFullYear();
            const m = String(targetDate.getMonth() + 1).padStart(2, '0');
            const d = String(targetDate.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            
            setStartTime(`${dateStr}T13:00`);
                setEndTime(`${dateStr}T13:30`);
                setTitle('');
                setLocation('');
                setIsOnline(false);
                setDescription('');
                setAttendees([]);
                setUserSearch('');
                setShowUserDropdown(false);
                setIsAllDay(false);
                setAllDayPreset('1_day');
            }
        }, [selectedDate, isOpen, event]);

        const { mutate: createEvent, isPending: isCreating } = useMutation({
            mutationFn: (data: Partial<CalendarEventType>) => eventApi.create(data),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
                onClose();
            },
            onError: (err: any) => {
                const conflictMsg = err.response?.data?.attendees?.[0] || err.response?.data?.detail || "Could not create event. Please check for schedule conflicts.";
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
                const conflictMsg = err.response?.data?.attendees?.[0] || err.response?.data?.detail || "Could not update event. Please check for schedule conflicts.";
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

    const handleDelete = () => {
        deleteEvent();
    };

    const handleSave = () => {
        // Logic to check 5 events per day limit
        if (!event && selectedDate) {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const eventsOnThisDay = allEvents.filter(e => {
                const eventDate = new Date(e.start_time).toISOString().split('T')[0];
                return eventDate === dateStr && e.organizer === currentUser?.id;
            });

            if (eventsOnThisDay.length >= 5) {
                setError("You have reached the limit of 5 events for this day. Please choose another date.");
                return;
            }
        }

        const basePayload = {
            title,
            location,
            is_online_meeting: isOnline,
            description,
            attendees
        };

        const startDt = new Date(startTime);
        const endDt = new Date(endTime);

        if (!event && allDayPreset === 'work_week' && startDt.toDateString() !== endDt.toDateString()) {
            let current = new Date(startDt);
            current.setHours(0, 0, 0, 0);
            
            const endLimit = new Date(endDt);
            endLimit.setHours(23, 59, 59, 999);

            while (current <= endLimit) {
                if (current.getDay() !== 0 && current.getDay() !== 6) {
                    const dayStart = new Date(current);
                    dayStart.setHours(startDt.getHours(), startDt.getMinutes(), 0, 0);
                    
                    const dayEnd = new Date(current);
                    dayEnd.setHours(endDt.getHours(), endDt.getMinutes(), 0, 0);
                    
                    if (dayEnd < dayStart) {
                        dayEnd.setDate(dayEnd.getDate() + 1);
                    }

                    createEvent({
                        ...basePayload,
                        start_time: dayStart.toISOString(),
                        end_time: dayEnd.toISOString()
                    });
                }
                current.setDate(current.getDate() + 1);
            }
        } else {
            const finalPayload = {
                ...basePayload,
                start_time: startDt.toISOString(),
                end_time: endDt.toISOString()
            };
            if (event) {
                updateEvent(finalPayload);
            } else {
                createEvent(finalPayload);
            }
        }
    };

    if (!isOpen) return null;

    const filteredUsers = availableUsers.filter((u: any) => {
        const name = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        const userSearchLower = userSearch.toLowerCase();
        return name.includes(userSearchLower) || 
               u.username?.toLowerCase().includes(userSearchLower) ||
               u.email?.toLowerCase().includes(userSearchLower);
    }).filter((u: any) => !attendees.includes(u.id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white text-gray-900 w-full max-w-[800px] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200" onClick={() => setShowUserDropdown(false)}>
                <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-base font-semibold text-gray-900">
                        {event ? (isReadOnly ? 'View event' : 'Edit event') : 'New event'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[75vh]">
                    <div>
                        <input 
                            type="text" 
                            placeholder="Add title" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={isReadOnly}
                            className={`w-full bg-transparent border-b border-gray-200 text-2xl text-gray-900 py-2 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-400 ${isReadOnly ? 'opacity-90 cursor-not-allowed border-transparent' : ''}`}
                        />
                    </div>
                    
                    <div className="flex items-start gap-4 text-gray-500 relative">
                        <Users size={20} className="mt-2 text-gray-400" />
                        <div className={`flex-1 border-b pb-2 relative ${isReadOnly ? 'border-transparent' : 'border-gray-200'}`} onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {attendees.map(id => {
                                    const user = availableUsers.find((u: any) => u.id === id);
                                    return (
                                        <span key={id} className={`bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs px-2 py-1 rounded-md flex items-center gap-1 font-medium ${isReadOnly ? 'opacity-90' : ''}`}>
                                            {user ? (user.first_name || user.username) : 'User'}
                                            {!isReadOnly && (
                                                <button type="button" onClick={() => setAttendees(prev => prev.filter(a => a !== id))} className="hover:text-indigo-900 ml-1">
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </span>
                                    );
                                })}
                            </div>
                            {!isReadOnly && (
                                <input 
                                    type="text" 
                                    placeholder="Invite required attendees (Search by name or email)" 
                                    value={userSearch}
                                    onChange={e => {
                                        setUserSearch(e.target.value);
                                        setShowUserDropdown(true);
                                    }}
                                    onFocus={() => setShowUserDropdown(true)}
                                    className="bg-transparent w-full focus:outline-none text-sm text-gray-900 placeholder:text-gray-400" 
                                />
                            )}
                            {showUserDropdown && filteredUsers.length > 0 && !isReadOnly && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                                    {filteredUsers.map((u: any) => (
                                        <div 
                                            key={u.id}
                                            className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between transition-colors"
                                            onClick={() => {
                                                setAttendees(prev => [...prev, u.id]);
                                                setUserSearch('');
                                                setShowUserDropdown(false);
                                            }}
                                        >
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name}</div>
                                                <div className="text-xs text-gray-500">{u.email}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-start gap-4 text-gray-500">
                        <Clock size={20} className="mt-2 text-gray-400" />
                        <div className={`flex flex-col gap-3 border-b pb-3 pt-1 flex-1 ${isReadOnly ? 'border-transparent' : 'border-gray-200'}`}>
                            
                            {/* All Day Toggle */}
                            <label className={`flex items-center gap-2 w-fit ${isReadOnly ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}>
                                <input 
                                    type="checkbox" 
                                    disabled={isReadOnly}
                                    checked={isAllDay} 
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setIsAllDay(checked);
                                        if (checked) {
                                            setAllDayPreset('1_day');
                                            setStartTime(`${startTime.split('T')[0]}T00:00`);
                                            setEndTime(`${startTime.split('T')[0]}T23:59`);
                                        } else {
                                            setStartTime(`${startTime.split('T')[0]}T13:00`);
                                            setEndTime(`${startTime.split('T')[0]}T13:30`);
                                        }
                                    }}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300"
                                />
                                <span className="text-sm font-medium text-gray-700">All day</span>
                            </label>

                            <div className="flex flex-wrap items-center gap-4">
                                {/* Start Date */}
                                <div className="flex flex-col">
                                    <label className="text-[11px] font-medium text-gray-500 mb-1">Start date</label>
                                    <div className="relative flex items-center h-5">
                                        <input 
                                            type="date" 
                                            disabled={isReadOnly} 
                                            min={new Date().toISOString().split('T')[0]}
                                            value={startTime.split('T')[0] || ''} 
                                            className={`absolute inset-0 opacity-0 z-10 cursor-pointer disabled:cursor-not-allowed w-full`}
                                            onChange={e => {
                                                const newDate = e.target.value;
                                                const startDt = new Date(newDate);
                                                let endDt = new Date(startDt);
                                                
                                                if (allDayPreset === 'work_week') {
                                                    let added = 0;
                                                    while (added < 4) {
                                                        endDt.setDate(endDt.getDate() + 1);
                                                        if (endDt.getDay() !== 0 && endDt.getDay() !== 6) {
                                                            added++;
                                                        }
                                                    }
                                                }
                                                else if (allDayPreset === 'full_week') endDt.setDate(startDt.getDate() + 6);
                                                else if (allDayPreset === 'custom') {
                                                    endDt = new Date(endTime.split('T')[0]);
                                                    if (endDt < startDt) endDt = new Date(startDt);
                                                }

                                                const endY = endDt.getFullYear();
                                                const endM = String(endDt.getMonth() + 1).padStart(2, '0');
                                                const endD = String(endDt.getDate()).padStart(2, '0');
                                                
                                                setStartTime(`${newDate}T${startTime.split('T')[1] || '00:00'}`);
                                                setEndTime(`${endY}-${endM}-${endD}T${endTime.split('T')[1] || '00:00'}`);
                                            }} 
                                        />
                                        <div className={`text-sm text-gray-900 pointer-events-none ${isReadOnly ? 'opacity-90' : ''}`}>
                                            {startTime ? (() => {
                                                const [y, m, d] = startTime.split('T')[0].split('-');
                                                return `${d}/${m}/${y}`;
                                            })() : 'DD/MM/YYYY'}
                                        </div>
                                    </div>
                                </div>

                                {/* Start Time */}
                                <div className="flex flex-col border-l border-gray-200 pl-4 relative">
                                    <label className="text-[11px] font-medium text-gray-500 mb-1">Start time</label>
                                    <button 
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={() => {
                                            setShowStartTimeDropdown(!showStartTimeDropdown);
                                            setShowEndTimeDropdown(false);
                                        }}
                                        className={`bg-transparent focus:outline-none text-sm text-gray-900 w-20 flex justify-between items-center ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                                    >
                                        {startTime.split('T')[1]?.slice(0,5) || '00:00'}
                                        {!isReadOnly && <ChevronRight size={14} className="text-gray-400 rotate-90" />}
                                    </button>
                                    {showStartTimeDropdown && !isReadOnly && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setShowStartTimeDropdown(false)} />
                                            <div className="absolute top-full left-4 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto py-1">
                                                {Array.from({ length: 48 }).map((_, i) => {
                                                    const hour = Math.floor(i / 2).toString().padStart(2, '0');
                                                    const min = (i % 2 === 0) ? '00' : '30';
                                                    const time = `${hour}:${min}`;
                                                    const isSelected = (startTime.split('T')[1]?.slice(0,5) || '00:00') === time;
                                                    
                                                    return (
                                                        <div 
                                                            key={`start-${time}`} 
                                                            className={`px-3 py-1.5 cursor-pointer text-sm transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-900 hover:bg-gray-50'}`}
                                                            onClick={() => {
                                                                const date = startTime.split('T')[0];
                                                                setStartTime(`${date}T${time}`);
                                                                
                                                                // Always adjust end time to be exactly +30 minutes
                                                                const startDt = new Date(`${date}T${time}`);
                                                                const newEndDt = new Date(startDt.getTime() + 30 * 60000); 
                                                                
                                                                const endY = newEndDt.getFullYear();
                                                                const endM = String(newEndDt.getMonth() + 1).padStart(2, '0');
                                                                const endD = String(newEndDt.getDate()).padStart(2, '0');
                                                                const endH = String(newEndDt.getHours()).padStart(2, '0');
                                                                const endMin = String(newEndDt.getMinutes()).padStart(2, '0');
                                                                
                                                                // If "1 Day" is selected, force it to be same day or next day if overflow
                                                                if (allDayPreset === '1_day') {
                                                                    setEndTime(`${endY}-${endM}-${endD}T${endH}:${endMin}`);
                                                                } else {
                                                                    // For multi-day, keep the existing end date, just update the time
                                                                    setEndTime(`${endTime.split('T')[0]}T${endH}:${endMin}`);
                                                                }
                                                                
                                                                setShowStartTimeDropdown(false);
                                                            }}
                                                        >
                                                            {time}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Duration Shortcut */}
                                <div className="flex flex-col border-l border-gray-200 pl-4 relative">
                                    <label className="text-[11px] font-medium text-gray-500 mb-1">Duration</label>
                                    <select 
                                        disabled={isReadOnly}
                                        value={allDayPreset}
                                        onChange={(e) => {
                                            const preset = e.target.value;
                                            setAllDayPreset(preset);
                                            const startDt = new Date(startTime.split('T')[0]);
                                            let endDt = new Date(startDt);
                                            
                                            if (preset === 'work_week') {
                                                let added = 0;
                                                while (added < 4) {
                                                    endDt.setDate(endDt.getDate() + 1);
                                                    if (endDt.getDay() !== 0 && endDt.getDay() !== 6) {
                                                        added++;
                                                    }
                                                }
                                            }
                                            else if (preset === 'full_week') endDt.setDate(startDt.getDate() + 6);
                                            
                                            if (preset !== 'custom') {
                                                const endY = endDt.getFullYear();
                                                const endM = String(endDt.getMonth() + 1).padStart(2, '0');
                                                const endD = String(endDt.getDate()).padStart(2, '0');
                                                const timePart = endTime.split('T')[1] || '00:00';
                                                setEndTime(`${endY}-${endM}-${endD}T${timePart}`);
                                            }
                                        }}
                                        className={`bg-transparent focus:outline-none text-sm text-gray-900 cursor-pointer ${isReadOnly ? 'cursor-not-allowed opacity-90 appearance-none' : ''}`}
                                    >
                                        <option value="1_day">1 Day</option>
                                        <option value="work_week">Work Week (5 Days)</option>
                                        <option value="full_week">Full Week (7 Days)</option>
                                        <option value="custom">Custom</option>
                                    </select>
                                </div>

                                {/* End Date */}
                                <div className="relative flex items-center h-5">
                                        <input 
                                            type="date" 
                                            disabled={isReadOnly} 
                                            min={startTime.split('T')[0] || new Date().toISOString().split('T')[0]}
                                            value={endTime.split('T')[0] || ''} 
                                            className="absolute inset-0 opacity-0 z-10 cursor-pointer disabled:cursor-not-allowed w-full"
                                            onChange={e => {
                                                const newDate = e.target.value;
                                                const timePart = endTime.split('T')[1] || '00:00';
                                                setEndTime(`${newDate}T${timePart}`);
                                            }} 
                                        />
                                        <div className={`text-sm text-gray-900 pointer-events-none ${isReadOnly ? 'opacity-90' : ''}`}>
                                            {endTime ? (() => {
                                                const [y, m, d] = endTime.split('T')[0].split('-');
                                                return `${d}/${m}/${y}`;
                                            })() : 'DD/MM/YYYY'}
                                        </div>
                                    </div>

                                {/* End Time */}
                                <div className="flex flex-col border-l border-gray-200 pl-4 relative">
                                    <label className="text-[11px] font-medium text-gray-500 mb-1">End time</label>
                                    <button 
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={() => {
                                            setShowEndTimeDropdown(!showEndTimeDropdown);
                                            setShowStartTimeDropdown(false);
                                        }}
                                        className={`bg-transparent focus:outline-none text-sm text-gray-900 w-24 flex justify-between items-center whitespace-nowrap ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                                    >
                                        {endTime.split('T')[1]?.slice(0,5) || '00:00'}
                                        {!isReadOnly && <ChevronRight size={14} className="text-gray-400 rotate-90 ml-1" />}
                                    </button>
                                    {showEndTimeDropdown && !isReadOnly && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setShowEndTimeDropdown(false)} />
                                            <div className="absolute top-full left-4 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto py-1">
                                                {Array.from({ length: 48 }).map((_, i) => {
                                                    const hour = Math.floor(i / 2).toString().padStart(2, '0');
                                                    const min = (i % 2 === 0) ? '00' : '30';
                                                    const time = `${hour}:${min}`;
                                                    const isSelected = (endTime.split('T')[1]?.slice(0,5) || '00:00') === time;
                                                    
                                                    // Duration logic
                                                    let durationStr = '';
                                                    const startT = startTime.split('T')[1]?.slice(0,5) || '00:00';
                                                    const startMins = parseInt(startT.split(':')[0]) * 60 + parseInt(startT.split(':')[1]);
                                                    let endMins = parseInt(hour) * 60 + parseInt(min);
                                                    
                                                    if (endMins < startMins) endMins += 24 * 60; // Next day
                                                    const diffHrs = (endMins - startMins) / 60;
                                                    
                                                    if (diffHrs > 0 && allDayPreset === '1_day') {
                                                        durationStr = ` (${diffHrs} hour${diffHrs !== 1 ? 's' : ''})`;
                                                    }

                                                    return (
                                                        <div 
                                                            key={`end-${time}`} 
                                                            className={`px-3 py-1.5 cursor-pointer text-sm transition-colors flex justify-between ${isSelected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-900 hover:bg-gray-50'}`}
                                                            onClick={() => {
                                                                const sDate = startTime.split('T')[0];
                                                                let eDate = endTime.split('T')[0]; 
                                                                
                                                                // If "1 Day" preset, roll over the End Date automatically if time is earlier
                                                                if (allDayPreset === '1_day') {
                                                                    if (time < (startTime.split('T')[1]?.slice(0,5) || '00:00')) {
                                                                        const nextDay = new Date(sDate);
                                                                        nextDay.setDate(nextDay.getDate() + 1);
                                                                        eDate = nextDay.toISOString().split('T')[0];
                                                                    } else {
                                                                        eDate = sDate;
                                                                    }
                                                                }
                                                                
                                                                setEndTime(`${eDate}T${time}`);
                                                                setShowEndTimeDropdown(false);
                                                            }}
                                                        >
                                                            <span>{time}</span>
                                                            <span className="text-gray-500 text-xs">{durationStr}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-gray-500">
                        <MapPin size={20} className="text-gray-400" />
                        <input type="text" disabled={isReadOnly} placeholder={isReadOnly && !location ? "No location specified" : "Add a room or location"} value={location} onChange={e => setLocation(e.target.value)} className={`bg-transparent flex-1 focus:outline-none text-sm text-gray-900 border-b pb-2 placeholder:text-gray-400 ${isReadOnly ? 'cursor-not-allowed opacity-90 border-transparent' : 'border-gray-200'}`} />
                    </div>
                    <div className="flex items-center gap-4 text-gray-500">
                        <Video size={20} className="text-gray-400" />
                        <label className={`flex items-center gap-3 ${isReadOnly ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}>
                            <div className={`w-10 h-5 rounded-full relative transition-colors shadow-inner ${isOnline ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${isOnline ? 'translate-x-5' : ''}`} />
                            </div>
                            <span className="text-sm font-medium text-gray-700">Teams meeting</span>
                            <input type="checkbox" disabled={isReadOnly} className="hidden" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
                        </label>
                    </div>
                    <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 min-h-[250px] flex flex-col shadow-inner">
                        <textarea 
                            placeholder={isReadOnly && !description ? "No description provided." : "Add an agenda or description"} 
                            value={description}
                            disabled={isReadOnly}
                            onChange={e => setDescription(e.target.value)}
                            className={`w-full flex-1 bg-transparent resize-none p-4 focus:outline-none text-sm text-gray-900 placeholder:text-gray-400 ${isReadOnly ? 'cursor-not-allowed opacity-90' : ''}`}
                        />
                    </div>
                </div>
                {/* Conflict Error Message Alert */}
                {error && (
                    <div className="px-6 py-2">
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-2">
                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                            {error}
                        </div>
                    </div>
                )}
                <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                    {event && !isReadOnly && (
                        <button 
                            onClick={handleDelete}
                            disabled={isPending}
                            className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    )}
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors border ${isReadOnly ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
                        {isReadOnly ? 'Close' : 'Cancel'}
                    </button>
                    {!isReadOnly && (
                        <button 
                            onClick={handleSave}
                            disabled={!title || isPending}
                            className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                        >
                            {isPending ? 'Saving...' : 'Save'}
                        </button>
                    )}
                </div>
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

    // Fetch current user's existing update for this date — scoped to their userId
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
        <div className="w-80 flex-shrink-0 bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-200">
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
                            {events.map((event) => (
                                <div
                                    key={`sidebar-event-${event.id}`}
                                    onClick={() => onEventClick(event)}
                                    className="group flex gap-3 p-3 rounded-lg border border-transparent bg-indigo-50 hover:bg-white hover:border-indigo-200 hover:shadow-sm cursor-pointer transition-all"
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-sm bg-indigo-500">
                                        <CalendarIcon size={14} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-sm font-medium text-gray-900 truncate mb-1">{event.title}</h4>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span className="font-medium text-indigo-600 flex items-center gap-1">
                                                <Clock size={12} />
                                                {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
    const [searchParams, setSearchParams] = useSearchParams();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('work_week');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    
    const { 
        data: eventsData, 
        fetchNextPage: fetchNextEventsPage, 
        hasNextPage: hasNextEventsPage,
        isFetchingNextPage: isFetchingNextEventsPage
    } = useInfiniteQuery({
        queryKey: ['events-calendar', currentDate.getFullYear(), currentDate.getMonth()],
        queryFn: async ({ pageParam = 1 }) => {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const firstDay = new Date(year, month, -7).toISOString().split('T')[0]; 
            const lastDay = new Date(year, month + 1, 7).toISOString().split('T')[0];
            return eventApi.list({ start_date: firstDay, end_date: lastDay, page: pageParam });
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
        if (hasNextEventsPage && !isFetchingNextEventsPage) {
            fetchNextEventsPage();
        }
    }, [hasNextEventsPage, isFetchingNextEventsPage, fetchNextEventsPage]);

    const events = useMemo(() => {
        if (!eventsData) return [];
        return eventsData.pages.flatMap((page: any) => page.results || page);
    }, [eventsData]);

    // Automatically open event from URL parameters (e.g., from notifications)
    React.useEffect(() => {
        const eventId = searchParams.get('eventId');
        if (eventId && events.length > 0) {
            const eventToOpen = events.find((e: CalendarEventType) => String(e.id) === eventId);
            if (eventToOpen) {
                setSelectedEvent(eventToOpen);
                
                // Clean up URL to prevent reopening on refresh
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
            // Use local timezone formatting instead of UTC to prevent day-shifting
            const dateStr = `${currentDateIter.getFullYear()}-${String(currentDateIter.getMonth() + 1).padStart(2, '0')}-${String(currentDateIter.getDate()).padStart(2, '0')}`;
            const dayTasks = tasks.filter((task: Task) => {
                const startDateStr = toLocalDateStr(task.start_date);
                const endDateStr = toLocalDateStr(task.end_date);
                if (startDateStr && endDateStr) {
                    return dateStr >= startDateStr && dateStr <= endDateStr;
                }
                return startDateStr === dateStr || endDateStr === dateStr;
            });

            const dayEvents = events.filter((event: CalendarEventType) => {
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
        <div className="w-full p-8 space-y-6">
            {/* Header Area */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-blue-600" />
                        Calendar
                    </h1>
                    <p className="text-lg text-gray-600 mt-1">View and manage your task schedules</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full xl:w-auto">
                    {[
                        // CHANGE "/task-board" BELOW TO WHATEVER YOUR ACTUAL URL PATH IS
                        { label: 'Total', value: taskStats.total, color: 'text-gray-900', filterUrl: '/taskboard' },
                        { label: 'Done', value: taskStats.completed, color: 'text-green-600', filterUrl: '/taskboard' },
                        { label: 'Active', value: taskStats.inProgress, color: 'text-blue-600', filterUrl: '/taskboard' },
                        { label: 'Pending', value: taskStats.pending, color: 'text-yellow-600', filterUrl: '/taskboard?status=pending' },
                    ].map((stat) => (
                        <div 
                            key={stat.label} 
                            onClick={() => navigate(stat.filterUrl)}
                            className="flex flex-col items-center justify-center px-6 py-3 bg-white rounded-xl border border-gray-200 shadow-sm min-w-[100px] cursor-pointer hover:shadow-md hover:border-blue-200 transition-all duration-200 hover:-translate-y-0.5"
                        >
                            <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm sticky top-0 z-30">
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
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

                <div className="flex items-center gap-3 w-full sm:w-auto">
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
                    <button
                        onClick={() => {
                            setSelectedDate(null);
                            setIsEventModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg border border-indigo-200 transition-colors shadow-sm"
                        title="New event"
                    >
                        <CalendarPlus size={18} />
                        <span className="text-sm font-medium">New event</span>
                    </button>
                </div>
            </div>

            {/* Calendar Content Area */}
            <div className="flex gap-6 min-h-[600px]">
                {/* Left Sidebar: Mini Calendar (Teams Style) */}
                <div className="hidden lg:flex flex-col w-56 flex-shrink-0 space-y-6">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <MiniCalendar 
                            currentDate={currentDate} 
                            onDateSelect={(date) => setCurrentDate(date)} 
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
                                        onDateClick={handleDateClick}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <DaysView
    currentDate={currentDate}
    tasks={tasks}
    events={events}
    selectedDate={selectedDate}
    onTaskClick={handleTaskClick}
    onEventClick={handleEventClick} 
    onDateClick={handleDateClick}
    viewMode={viewMode as 'day' | 'work_week' | 'week'}
    updateEvent={updateEventMutation} // New
    currentUser={user ? { id: user.id, role: user.role } : null} // New
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
                    />
                )}
            </div> {/* <-- THIS IS THE MISSING DIV THAT CLOSES THE FLEX CONTAINER */}

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
                isOpen={isEventModalOpen || !!selectedEvent} 
                onClose={() => {
                    setIsEventModalOpen(false);
                    setSelectedEvent(null);
                }} 
                selectedDate={selectedDate} 
                event={selectedEvent}
                currentUser={user ? { id: user.id, role: user.role } : null}
                allEvents={events} // Passing the events array here
            />

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onDelete={async () => setSelectedTask(null)}
                    onTaskUpdated={(updatedTask) => setSelectedTask(updatedTask)}
                />
            )}
        </div>
    );
};

export default Calendar;