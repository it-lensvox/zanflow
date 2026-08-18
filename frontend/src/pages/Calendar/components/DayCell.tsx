import React from 'react';
import type { Task, Event as CalendarEventType } from '@/types';
import type { CalendarDay } from '../calendarConstants';
import { CalendarEventUI } from './CalendarEventUI';
import { TaskEvent } from './TaskEvent';

interface DayCellProps {
    day: CalendarDay;
    onTaskClick: (task: Task) => void;
    onEventClick?: (event: CalendarEventType) => void;
    onDateClick: (date: Date) => void;
    onEventDrop?: (eventId: string, newDate: Date) => void;
}

export const DayCell: React.FC<DayCellProps> = ({
    day, onTaskClick, onEventClick, onDateClick, onEventDrop,
}) => {
    const maxVisibleItems = 3;
    const totalItems      = day.tasks.length + day.events.length;
    const visibleEvents   = day.events.slice(0, maxVisibleItems);
    const visibleTasks    = day.tasks.slice(0, maxVisibleItems - visibleEvents.length);
    const remainingCount  = totalItems - (visibleEvents.length + visibleTasks.length);

    return (
        <div
            className={`relative flex flex-col min-h-[120px] p-2 border-b border-r border-gray-200 transition-colors hover:bg-gray-50 cursor-pointer ${!day.isCurrentMonth ? 'bg-gray-50/50' : 'bg-white'}`}
            onClick={() => onDateClick(day.date)}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = '#EEF4FF'; }}
            onDragLeave={e => { e.currentTarget.style.background = ''; }}
            onDrop={e => {
                e.preventDefault();
                e.currentTarget.style.background = '';
                const eventId = e.dataTransfer.getData('eventId');
                if (eventId && onEventDrop) onEventDrop(eventId, day.date);
            }}
        >
            <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${day.isToday ? 'bg-blue-600 text-white shadow-sm' : !day.isCurrentMonth ? 'text-gray-400' : 'text-gray-700'}`}>
                    {day.date.getDate()}
                </span>
                {day.tasks.length > 0 && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {day.tasks.length}
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-1.5 overflow-hidden">
                {visibleEvents.map(event => (
                    <div
                        key={`event-${event.id}`}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData('eventId', String(event.id)); e.stopPropagation(); }}
                        onClick={e => e.stopPropagation()}
                    >
                        <CalendarEventUI
                            event={event}
                            onClick={ev => onEventClick && onEventClick(ev)}
                            compact
                        />
                    </div>
                ))}
                {visibleTasks.map(task => (
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
