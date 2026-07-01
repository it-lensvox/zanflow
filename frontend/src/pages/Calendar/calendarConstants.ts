// ─── Calendar Design Tokens 
export const BLUE  = '#1663f6';
export const LINE  = '#e6ebf2';
export const TEXT  = '#172033';
export const MUTED = '#667085';

// ─── View Modes
export type ViewMode = 'day' | 'work_week' | 'week' | 'month';

// ─── Date Constants
export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Stat Card Config 
export const STAT_CARDS = [
    { key: 'total',      label: 'TOTAL',   color: TEXT,      route: '/taskboard' },
    { key: 'completed',  label: 'DONE',    color: '#22c55e', route: '/taskboard/completed' },
    { key: 'inProgress', label: 'ACTIVE',  color: '#3b82f6', route: '/taskboard/in_progress' },
    { key: 'pending',    label: 'PENDING', color: '#f59e0b', route: '/taskboard/pending' },
] as const;

// ─── Types
import type { Task, Event as CalendarEventType, InvitationStatus } from '@/types';

export interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    tasks: Task[];
    events: CalendarEventType[];
}

export interface UpdateFormFields {
    todays_priorities: string;
    progress_yesterday: string;
    blockers: string;
    upcoming: string;
}

export interface TaskStats {
    [key: string]: number;
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
}

// ─── Daily Update Helpers
export const EMPTY_FORM: UpdateFormFields = {
    todays_priorities: '',
    progress_yesterday: '',
    blockers: '',
    upcoming: '',
};

export const serializeContent = (fields: UpdateFormFields, dateLabel: string): string =>
    `Daily Update – ${dateLabel}\n\nToday's Priorities:-\n${fields.todays_priorities}\n\nProgress (Yesterday):-\n${fields.progress_yesterday}\n\nBlockers / Needs:-\n${fields.blockers}\n\nUpcoming:-\n${fields.upcoming}`;

export const parseContent = (content: string): UpdateFormFields => {
    if (!content?.trim()) return EMPTY_FORM;

    const extract = (label: string, nextLabel?: string): string => {
        const searchLabel = content.includes(label + '\n') ? label + '\n' : label;
        const start = content.indexOf(searchLabel);
        if (start === -1) return '';
        const valueStart = start + searchLabel.length;
        let end = content.length;
        if (nextLabel) {
            const withNewline    = content.indexOf('\n' + nextLabel, valueStart);
            const withoutNewline = content.indexOf(nextLabel, valueStart);
            if (withNewline !== -1 && withoutNewline !== -1) end = Math.min(withNewline, withoutNewline);
            else if (withNewline !== -1) end = withNewline;
            else if (withoutNewline !== -1) end = withoutNewline;
        }
        return content.slice(valueStart, end).trim();
    };

    const structured = {
        todays_priorities:  extract("Today's Priorities:-",  "Progress (Yesterday):-"),
        progress_yesterday: extract("Progress (Yesterday):-", "Blockers / Needs:-"),
        blockers:           extract("Blockers / Needs:-",     "Upcoming:-"),
        upcoming:           extract("Upcoming:-"),
    };

    const hasAnyContent = Object.values(structured).some(v => v.trim() !== '');
    if (!hasAnyContent) return { ...EMPTY_FORM, todays_priorities: content.trim() };
    return structured;
};

// ─── Date Formatting Helpers
export const toISODate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const toLocalDateStr = (iso: string | undefined): string => {
    if (!iso) return '';
    if (!iso.includes('T')) return iso.split('T')[0];
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDateForUpdate = (date: Date): string =>
    date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// ─── Priority Color (uses STATUS_COLORS single source of truth values)
export const getPriorityColor = (priority: string): string => {
    switch (priority?.toLowerCase()) {
        case 'high':   return '#ef4444';
        case 'medium': return '#f59e0b';
        case 'low':    return '#22c55e';
        default:       return '#6b7280';
    }
};

// ─── Invitation Status Helpers
export const getEventStatusColors = (status?: InvitationStatus) => {
    switch (status) {
        case 'ORGANIZER': return { bg: 'bg-blue-50',   border: 'border-blue-500',   text: 'text-blue-700',   accent: 'bg-blue-500',   hover: 'hover:bg-blue-100' };
        case 'PENDING':   return { bg: 'bg-amber-50',  border: 'border-amber-500',  text: 'text-amber-700',  accent: 'bg-amber-500',  hover: 'hover:bg-amber-100' };
        case 'ACCEPTED':  return { bg: 'bg-emerald-50',border: 'border-emerald-500',text: 'text-emerald-700',accent: 'bg-emerald-500',hover: 'hover:bg-emerald-100' };
        case 'DECLINED':  return { bg: 'bg-red-50 opacity-60', border: 'border-red-400', text: 'text-red-600', accent: 'bg-red-500', hover: 'hover:bg-red-100' };
        default:          return { bg: 'bg-indigo-50', border: 'border-indigo-500', text: 'text-indigo-700', accent: 'bg-indigo-500', hover: 'hover:bg-indigo-100' };
    }
};

export const getStatusBadgeColors = (status?: InvitationStatus): string => {
    switch (status) {
        case 'ORGANIZER': return 'bg-blue-500 text-white';
        case 'PENDING':   return 'bg-amber-500 text-white';
        case 'ACCEPTED':  return 'bg-emerald-500 text-white';
        case 'DECLINED':  return 'bg-red-500 text-white';
        default:          return 'bg-gray-400 text-white';
    }
};

export const getStatusLabel = (status?: InvitationStatus): string => {
    switch (status) {
        case 'ORGANIZER': return 'Organizer';
        case 'PENDING':   return 'Pending';
        case 'ACCEPTED':  return 'Accepted';
        case 'DECLINED':  return 'Declined';
        default:          return '';
    }
};

export const requiresAction = (status?: InvitationStatus): boolean => status === 'PENDING';

// ─── Header Title Generator
export const getHeaderTitle = (viewMode: ViewMode, currentDate: Date): string => {
    if (viewMode === 'month') return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (viewMode === 'day')   return `${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + (viewMode === 'work_week' ? 1 : 0));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + (viewMode === 'work_week' ? 4 : 6));

    if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${MONTHS[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
    }
    return `${MONTHS[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${MONTHS[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
};
