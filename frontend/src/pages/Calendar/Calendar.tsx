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
                        onClick={onEventClick || (() => {})}
                        compact={totalItems > 2}
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
}

const DaysView: React.FC<DaysViewProps> = ({ currentDate, tasks, events, selectedDate, onTaskClick, onEventClick, onDateClick, viewMode }) => {
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

    const getTasksForDate = (date: Date) => {
        // Use local timezone formatting instead of UTC to prevent day-shifting
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return tasks.filter((task) => {
            const startDate = task.start_date?.split('T')[0];
            const endDate = task.end_date?.split('T')[0];
            return (startDate && startDate <= dateStr && endDate && endDate >= dateStr) ||
                startDate === dateStr ||
                endDate === dateStr;
        });
    };

    const getEventsForDate = (date: Date) => {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return events.filter((event) => {
            const startDate = event.start_time?.split('T')[0];
            const endDate = event.end_time?.split('T')[0];
            return (startDate && startDate <= dateStr && endDate && endDate >= dateStr) ||
                startDate === dateStr ||
                endDate === dateStr;
        });
    };
    
    // Explicit tailwind strings for JIT compiler
    const gridColsClass = displayDays.length === 1 ? 'grid-cols-1' : displayDays.length === 5 ? 'grid-cols-5' : 'grid-cols-7';

    return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className={`grid ${gridColsClass} border-b border-gray-200 bg-gray-50`}>
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
            <div className={`grid ${gridColsClass} flex-1 min-h-[500px] divide-x divide-gray-200`}>
                {displayDays.map((day, index) => {
                    const dayTasks = getTasksForDate(day);
                    const dayEvents = getEventsForDate(day);
                    const isToday = day.toDateString() === today.toDateString();
                    const isSelected = selectedDate?.toDateString() === day.toDateString();
                    
                    return (
                        <div 
                            key={index} 
                            className={`
                                p-2 flex flex-col gap-2 cursor-pointer transition-colors hover:bg-gray-50
                                ${isToday ? 'bg-blue-50/10' : ''}
                                ${isSelected ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/20' : ''}
                            `}
                            onClick={() => onDateClick(day)}
                        >
                            {dayEvents.map((event) => (
                                <CalendarEventUI key={`event-${event.id}`} event={event} onClick={onEventClick || (() => {})} />
                            ))}
                            {dayTasks.map((task) => (
                                <TaskEvent key={`task-${task.id}`} task={task} onClick={onTaskClick} />
                            ))}
                            {(dayTasks.length === 0 && dayEvents.length === 0) && (
                                <div className="text-center py-8 text-xs text-gray-400 italic">No items</div>
                            )}
                        </div>
                    );
                })}
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
}

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, selectedDate, event, currentUser }) => {
    // If the event exists and the current user is NOT the organizer, it is Read-Only
    const isReadOnly = Boolean(event && currentUser && event.organizer !== currentUser.id);
    const queryClient = useQueryClient();
    const [title, setTitle] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [location, setLocation] = useState('');
    const [isOnline, setIsOnline] = useState(false);
    const [description, setDescription] = useState('');
    
    // New states for Attendees Search & Select
    const [attendees, setAttendees] = useState<number[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);

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
            setStartTime(formatDt(event.start_time));
            setEndTime(formatDt(event.end_time));
            setLocation(event.location || '');
            setIsOnline(event.is_online_meeting || false);
            setDescription(event.description || '');
            setAttendees(event.attendees || []);
            setUserSearch('');
            setShowUserDropdown(false);
        } else if (selectedDate && isOpen) {
            const dateStr = selectedDate.toISOString().split('T')[0];
            setStartTime(`${dateStr}T13:00`);
            setEndTime(`${dateStr}T13:30`);
            setTitle('');
            setLocation('');
            setIsOnline(false);
            setDescription('');
            setAttendees([]);
            setUserSearch('');
            setShowUserDropdown(false);
        }
    }, [selectedDate, isOpen, event]);

    const { mutate: createEvent, isPending: isCreating } = useMutation({
        mutationFn: (data: Partial<CalendarEventType>) => eventApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            onClose();
        }
    });

    const { mutate: updateEvent, isPending: isUpdating } = useMutation({
        mutationFn: (data: Partial<CalendarEventType>) => eventApi.update(event!.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            onClose();
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
        const payload = {
            title,
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            location,
            is_online_meeting: isOnline,
            description,
            attendees
        };
        if (event) {
            updateEvent(payload);
        } else {
            createEvent(payload);
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

                    <div className="flex items-center gap-4 text-gray-500">
                        <Clock size={20} className="text-gray-400" />
                        <div className={`flex items-center gap-2 border-b pb-2 flex-1 ${isReadOnly ? 'border-transparent' : 'border-gray-200'}`}>
                            <input type="datetime-local" disabled={isReadOnly} value={startTime} onChange={e => setStartTime(e.target.value)} className={`bg-transparent focus:outline-none text-sm text-gray-900 ${isReadOnly ? 'cursor-not-allowed opacity-90' : ''}`} />
                            <span className="text-gray-400">-</span>
                            <input type="datetime-local" disabled={isReadOnly} value={endTime} onChange={e => setEndTime(e.target.value)} className={`bg-transparent focus:outline-none text-sm text-gray-900 ${isReadOnly ? 'cursor-not-allowed opacity-90' : ''}`} />
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

    const formatDateLong = (date: Date) =>
        date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

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
                                                {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
    const [viewMode, setViewMode] = useState<ViewMode>('month');
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

        const currentDateIter = new Date(startDate);
        while (currentDateIter <= endDate) {
            // Use local timezone formatting instead of UTC to prevent day-shifting
            const dateStr = `${currentDateIter.getFullYear()}-${String(currentDateIter.getMonth() + 1).padStart(2, '0')}-${String(currentDateIter.getDate()).padStart(2, '0')}`;
            const dayTasks = tasks.filter((task: Task) => {
                const startDateStr = task.start_date?.split('T')[0];
                const endDateStr = task.end_date?.split('T')[0];
                if (startDateStr && endDateStr) {
                    return dateStr >= startDateStr && dateStr <= endDateStr;
                }
                return startDateStr === dateStr || endDateStr === dateStr;
            });

            const dayEvents = events.filter((event: CalendarEventType) => {
                const startDateStr = event.start_time?.split('T')[0];
                const endDateStr = event.end_time?.split('T')[0];
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
    }, []);

    const handleDateClick = useCallback((date: Date) => {
        setSelectedDate(date);
    }, []);

    const selectedDateTasks = useMemo(() => {
        if (!selectedDate) return [];
        // Use local timezone formatting instead of UTC to prevent day-shifting
        const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        return tasks.filter((task: Task) => {
            const startDateStr = task.start_date?.split('T')[0];
            const endDateStr = task.end_date?.split('T')[0];
            if (startDateStr && endDateStr) {
                return dateStr >= startDateStr && dateStr <= endDateStr;
            }
            return startDateStr === dateStr || endDateStr === dateStr;
        });
    }, [selectedDate, tasks]);

    const selectedDateEvents = useMemo(() => {
        if (!selectedDate) return [];
        const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        return events.filter((event: CalendarEventType) => {
            const startDateStr = event.start_time?.split('T')[0];
            const endDateStr = event.end_time?.split('T')[0];
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full xl:w-auto">
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
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
            </div>

            {/* Calendar Content Area */}
            <div className="flex gap-6 min-h-[600px]">
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
                        onDateClick={handleDateClick}
                        viewMode={viewMode as 'day' | 'work_week' | 'week'}
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