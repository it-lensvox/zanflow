import React from 'react';
import type { Task } from '@/types';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';
import { getPriorityColor } from '../calendarConstants';

interface TaskEventProps {
    task: Task;
    onClick: (task: Task) => void;
    compact?: boolean;
}

export const TaskEvent: React.FC<TaskEventProps> = ({ task, onClick, compact = false }) => {
    const statusConfig = getStatusConfig(task.status);
    const StatusIcon   = statusConfig.icon;

    return (
        <div
            className={`group relative flex items-center gap-2 rounded-md cursor-pointer transition-all duration-200 border border-transparent hover:shadow-sm hover:z-10 ${compact ? 'py-0.5 px-1.5' : 'py-1 px-2'} ${statusConfig.bg} ${statusConfig.text}`}
            onClick={e => { e.stopPropagation(); onClick(task); }}
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
