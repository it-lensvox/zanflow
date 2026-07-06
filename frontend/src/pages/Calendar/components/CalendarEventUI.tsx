import React from 'react';
import { Calendar as CalendarIcon, Check, X, Loader2 } from 'lucide-react';
import type { Event as CalendarEventType } from '@/types';
import { getEventStatusColors, requiresAction } from '../calendarConstants';

interface CalendarEventUIProps {
    event: CalendarEventType;
    onClick: (event: CalendarEventType) => void;
    compact?: boolean;
    onAccept?: (invitationId: number) => void;
    onDecline?: (event: CalendarEventType) => void;
    isAccepting?: boolean;
}

export const CalendarEventUI: React.FC<CalendarEventUIProps> = ({
    event, onClick, compact = false, onAccept, onDecline, isAccepting,
}) => {
    const statusColors = getEventStatusColors(event.my_invitation_status);
    const isPending    = requiresAction(event.my_invitation_status);

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('eventId', String(event.id));
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('opacity-50');
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={e => e.currentTarget.classList.remove('opacity-50')}
            className={`group relative flex items-center gap-2 rounded-md cursor-grab active:cursor-grabbing transition-all duration-200 border border-transparent hover:shadow-sm hover:z-10 ${compact ? 'py-0.5 px-1.5' : 'py-1 px-2'} ${statusColors.bg} ${statusColors.text}`}
            onClick={e => { e.stopPropagation(); onClick(event); }}
        >
            <div className={`w-1 h-full absolute left-0 top-0 bottom-0 rounded-l-md ${statusColors.accent} pointer-events-none`} />
            <CalendarIcon size={compact ? 12 : 14} className={`flex-shrink-0 pointer-events-none ${statusColors.text}`} />
            <span className={`font-medium truncate pointer-events-none ${compact ? 'text-[10px]' : 'text-xs'}`}>
                {event.title}
            </span>

            {isPending && event.my_invitation_id && !compact && (
                <div className="hidden group-hover:flex items-center gap-1 ml-auto">
                    <button
                        onClick={e => { e.stopPropagation(); onAccept?.(event.my_invitation_id!); }}
                        disabled={isAccepting}
                        className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors"
                        title="Accept"
                    >
                        {isAccepting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); onDecline?.(event); }}
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
