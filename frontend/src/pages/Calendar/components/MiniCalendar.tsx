import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Users, Check } from 'lucide-react';
import { MONTHS } from '../calendarConstants';

interface MiniCalendarProps {
    currentDate: Date;
    onDateSelect: (date: Date) => void;
    includeSharedEvents: boolean;
    onToggleSharedEvents: (enabled: boolean) => void;
    sharedWithMeUsers: any[];
    selectedUserIds: number[];
    onToggleUser: (userId: number) => void;
}

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
    currentDate, onDateSelect,
    includeSharedEvents, onToggleSharedEvents,
    sharedWithMeUsers, selectedUserIds, onToggleUser,
}) => {
    const [navDate, setNavDate] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));

    useEffect(() => {
        setNavDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    }, [currentDate]);

    const month = navDate.getMonth();
    const year  = navDate.getFullYear();

    const changeMonth = (offset: number) => setNavDate(new Date(year, month + offset, 1));

    const days = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        const start    = new Date(firstDay);
        start.setDate(firstDay.getDate() - firstDay.getDay());
        const result = [];
        const iter   = new Date(start);
        while (result.length < 42) { result.push(new Date(iter)); iter.setDate(iter.getDate() + 1); }
        return result;
    }, [month, year]);

    return (
        <div className="w-full select-none">
            {/* Month/Year Nav */}
            <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-sm font-bold text-gray-900">{MONTHS[month]} {year}</span>
                <div className="flex gap-1">
                    <button type="button" onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors">
                        <ChevronLeft size={14} />
                    </button>
                    <button type="button" onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors">
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 mb-2">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={`${d}-${i}`} className="text-[10px] font-bold text-gray-400 text-center py-1">{d}</div>
                ))}
            </div>

            {/* Day Grid */}
            <div className="grid grid-cols-7 gap-y-1">
                {days.map((date, i) => {
                    const isCurrentMonth = date.getMonth() === month;
                    const isSelected     = date.toDateString() === currentDate.toDateString();
                    const isToday        = date.toDateString() === new Date().toDateString();
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onDateSelect(date)}
                            className={`text-[11px] h-7 w-7 flex items-center justify-center rounded-full mx-auto transition-all ${
                                isSelected ? 'bg-blue-600 text-white font-bold shadow-sm' :
                                isToday    ? 'text-blue-600 font-bold border border-blue-200' :
                                isCurrentMonth ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300'
                            }`}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>

            {/* Shared Calendars Toggle */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                    onClick={() => onToggleSharedEvents(!includeSharedEvents)}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Users size={14} className="text-purple-600" />
                        <span className="text-xs font-semibold text-gray-700">View Shared Calendars</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full transition-colors duration-200 ${includeSharedEvents ? 'bg-purple-600' : 'bg-gray-300'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 mt-0.5 ${includeSharedEvents ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
                    </div>
                </button>

                {includeSharedEvents && (
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={selectedUserIds.length === sharedWithMeUsers.length && sharedWithMeUsers.length > 0}
                                onChange={() => {
                                    if (selectedUserIds.length === sharedWithMeUsers.length) {
                                        sharedWithMeUsers.forEach(u => onToggleUser(u.id));
                                    } else {
                                        sharedWithMeUsers.forEach(u => { if (!selectedUserIds.includes(u.id)) onToggleUser(u.id); });
                                    }
                                }}
                                className="w-3.5 h-3.5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-offset-0 focus:ring-1"
                            />
                            <span className="text-xs font-medium text-gray-700">Select All Members</span>
                        </label>

                        {sharedWithMeUsers.length > 0 ? sharedWithMeUsers.map((u: any) => {
                            const isSelected = selectedUserIds.includes(u.id);
                            const initials   = u.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?';
                            return (
                                <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => onToggleUser(u.id)}
                                        className="w-3.5 h-3.5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-offset-0 focus:ring-1"
                                    />
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                            {initials}
                                        </div>
                                        <span className="text-xs text-gray-700 truncate">{u.name}</span>
                                    </div>
                                    {isSelected && <Check size={12} className="text-purple-600 flex-shrink-0" />}
                                </label>
                            );
                        }) : (
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
