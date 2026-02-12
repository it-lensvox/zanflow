import React, { useState, useMemo, useCallback } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Users,
    Grid3X3,
    List,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { taskApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { TaskDetailModal } from '../MyTask/TaskDetailModal';
import type { Task } from '@/types';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';

// --- Types & Constants ---
type ViewMode = 'month' | 'week';

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
}

// --- Components ---

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
    onDateClick: (date: Date) => void;
}

const DayCell: React.FC<DayCellProps> = ({ day, onTaskClick, onDateClick }) => {
    const maxVisibleTasks = 3;
    const visibleTasks = day.tasks.slice(0, maxVisibleTasks);
    const remainingCount = day.tasks.length - maxVisibleTasks;

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
                {visibleTasks.map((task) => (
                    <TaskEvent
                        key={task.id}
                        task={task}
                        onClick={onTaskClick}
                        compact={day.tasks.length > 2}
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

interface WeekViewProps {
    currentDate: Date;
    tasks: Task[];
    onTaskClick: (task: Task) => void;
}

const WeekView: React.FC<WeekViewProps> = ({ currentDate, tasks, onTaskClick }) => {
    const getWeekDays = () => {
        const days: Date[] = [];
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + i);
            days.push(day);
        }
        return days;
    };

    const weekDays = getWeekDays();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getTasksForDate = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return tasks.filter((task) => {
            const startDate = task.start_date?.split('T')[0];
            const endDate = task.end_date?.split('T')[0];
            return (startDate && startDate <= dateStr && endDate && endDate >= dateStr) ||
                startDate === dateStr ||
                endDate === dateStr;
        });
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                {weekDays.map((day, index) => {
                    const isToday = day.toDateString() === today.toDateString();
                    return (
                        <div key={index} className={`flex flex-col items-center justify-center py-3 px-2 border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-blue-50/50' : ''}`}>
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{DAYS_OF_WEEK[index]}</span>
                            <span className={`text-lg font-bold ${isToday ? 'text-blue-600 bg-blue-100 w-8 h-8 flex items-center justify-center rounded-full' : 'text-gray-900'}`}>
                                {day.getDate()}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="grid grid-cols-7 flex-1 min-h-[500px] divide-x divide-gray-200">
                {weekDays.map((day, index) => {
                    const dayTasks = getTasksForDate(day);
                    const isToday = day.toDateString() === today.toDateString();
                    return (
                        <div key={index} className={`p-2 flex flex-col gap-2 ${isToday ? 'bg-blue-50/10' : ''}`}>
                            {dayTasks.map((task) => (
                                <TaskEvent key={task.id} task={task} onClick={onTaskClick} />
                            ))}
                            {dayTasks.length === 0 && (
                                <div className="text-center py-8 text-xs text-gray-400 italic">No tasks</div>
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
    selectedDate: Date | null;
    onTaskClick: (task: Task) => void;
    onClose: () => void;
}

const TaskListSidebar: React.FC<TaskListSidebarProps> = ({
    tasks,
    selectedDate,
    onTaskClick,
    onClose,
}) => {
    if (!selectedDate) return null;

    const formatDateLong = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="w-80 flex-shrink-0 bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">{formatDateLong(selectedDate)}</h3>
                <button 
                    onClick={onClose}
                    className="p-1 rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                >
                    <span className="text-lg leading-none">&times;</span>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <CalendarIcon className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-sm text-gray-500">No tasks scheduled for this day</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tasks.map((task) => {
                            const statusConfig = getStatusConfig(task.status);
                            const StatusIcon = statusConfig.icon;
                            return (
                                <div
                                    key={task.id}
                                    className="group flex gap-3 p-3 rounded-lg border border-transparent bg-gray-50 hover:bg-white hover:border-gray-200 hover:shadow-sm cursor-pointer transition-all"
                                    onClick={() => onTaskClick(task)}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-sm`} style={{ backgroundColor: statusConfig.color }}>
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
        </div>
    );
};

//Main Component 

export const Calendar: React.FC = () => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const { data: tasksData, isLoading } = useQuery({
        queryKey: ['tasks'],
        queryFn: () => taskApi.list(),
        enabled: !!user,
    });

    const tasks = useMemo(() => {
        if (!tasksData || !user) return [];
        const allTasks = Array.isArray(tasksData) ? tasksData : tasksData.tasks || tasksData.results || [];
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
            const dateStr = currentDateIter.toISOString().split('T')[0];
            const dayTasks = tasks.filter((task: Task) => {
                const startDateStr = task.start_date?.split('T')[0];
                const endDateStr = task.end_date?.split('T')[0];
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
            });

            currentDateIter.setDate(currentDateIter.getDate() + 1);
        }
        return days;
    }, [currentDate, tasks]);

    const calendarDays = useMemo(() => getCalendarDays(), [getCalendarDays]);

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentDate((prev) => {
            const newDate = new Date(prev);
            if (viewMode === 'month') {
                newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
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

    const handleDateClick = useCallback((date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        const dayTasks = tasks.filter((task: Task) => {
            const startDateStr = task.start_date?.split('T')[0];
            const endDateStr = task.end_date?.split('T')[0];
            if (startDateStr && endDateStr) {
                return dateStr >= startDateStr && dateStr <= endDateStr;
            }
            return startDateStr === dateStr || endDateStr === dateStr;
        });

        if (dayTasks.length > 0) {
            setSelectedDate(date);
        }
    }, [tasks]);

    const selectedDateTasks = useMemo(() => {
        if (!selectedDate) return [];
        const dateStr = selectedDate.toISOString().split('T')[0];
        return tasks.filter((task: Task) => {
            const startDateStr = task.start_date?.split('T')[0];
            const endDateStr = task.end_date?.split('T')[0];
            if (startDateStr && endDateStr) {
                return dateStr >= startDateStr && dateStr <= endDateStr;
            }
            return startDateStr === dateStr || endDateStr === dateStr;
        });
    }, [selectedDate, tasks]);

    const getHeaderTitle = () => {
        if (viewMode === 'month') {
            return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        }
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

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
                        { label: 'Total', value: taskStats.total, color: 'text-gray-900' },
                        { label: 'Done', value: taskStats.completed, color: 'text-green-600' },
                        { label: 'Active', value: taskStats.inProgress, color: 'text-blue-600' },
                        { label: 'Pending', value: taskStats.pending, color: 'text-yellow-600' },
                    ].map((stat) => (
                        <div key={stat.label} className="flex flex-col items-center justify-center px-6 py-3 bg-white rounded-xl border border-gray-200 shadow-sm min-w-[100px]">
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
                            onClick={() => navigateMonth('prev')}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button 
                            onClick={() => navigateMonth('next')}
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

                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 w-full sm:w-auto">
                    {(['month', 'week'] as ViewMode[]).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`
                                flex items-center justify-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all flex-1 sm:flex-none
                                ${viewMode === mode 
                                    ? 'bg-white text-blue-600 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-900'}
                            `}
                        >
                            {mode === 'month' ? <Grid3X3 size={16} /> : <List size={16} />}
                            <span className="capitalize">{mode}</span>
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
                        <WeekView
                            currentDate={currentDate}
                            tasks={tasks}
                            onTaskClick={handleTaskClick}
                        />
                    )}
                </div>

                {selectedDate && (
                    <TaskListSidebar
                        tasks={selectedDateTasks}
                        selectedDate={selectedDate}
                        onTaskClick={handleTaskClick}
                        onClose={() => setSelectedDate(null)}
                    />
                )}
            </div>

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