import React from 'react';
import {
    ChevronLeft, ChevronRight, Calendar as CalendarIcon, Grid3X3, List,
    CalendarPlus, Settings, ChevronDown, Share2, Users, Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ViewMode } from '../calendarConstants';
import { getHeaderTitle, STAT_CARDS, TEXT, LINE, MUTED, BLUE } from '../calendarConstants';

interface CalendarHeaderProps {
    currentDate: Date;
    viewMode: ViewMode;
    taskStats: { total: number; completed: number; inProgress: number; pending: number; [key: string]: number };
    isSettingsOpen: boolean;
    includeSharedEvents: boolean;
    selectedUserIds: number[];
    sharedWithMeUsers: any[];
    settingsDropdownRef: React.RefObject<HTMLDivElement>;
    onToday: () => void;
    onNavigate: (dir: 'prev' | 'next') => void;
    onViewMode: (mode: ViewMode) => void;
    onNewEvent: () => void;
    onToggleSettings: () => void;
    onToggleSharedEvents: (val: boolean) => void;
    onShareCalendar: () => void;
    onToggleUser: (userId: number) => void;
    onSelectAllUsers: () => void;
}

// Stat card — clickable, navigates to filtered taskboard view
function StatCard({
    label, value, color, route,
}: { label: string; value: number; color: string; route: string }) {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate(route)}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '10px 20px', background: '#fff',
                border: `1px solid ${LINE}`, borderRadius: 10, minWidth: 72,
                cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
                fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.borderColor = color;
                e.currentTarget.style.boxShadow = `0 2px 8px ${color}22`;
            }}
            onMouseLeave={e => {
                e.currentTarget.style.borderColor = LINE;
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            <span style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginTop: 2, letterSpacing: '0.04em' }}>
                {label}
            </span>
        </button>
    );
}

const VIEW_ICONS: Record<ViewMode, React.ReactNode> = {
    month:     <Grid3X3 size={15} />,
    day:       <CalendarIcon size={15} />,
    week:      <List size={15} />,
    work_week: <List size={15} />,
};
const VIEW_LABELS: Record<ViewMode, string> = {
    day: 'Day', work_week: 'Work Week', week: 'Week', month: 'Month',
};

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
    currentDate, viewMode, taskStats,
    isSettingsOpen, includeSharedEvents, selectedUserIds, sharedWithMeUsers,
    settingsDropdownRef,
    onToday, onNavigate, onViewMode, onNewEvent,
    onToggleSettings, onToggleSharedEvents, onShareCalendar,
    onToggleUser, onSelectAllUsers,
}) => {
    const headerTitle = getHeaderTitle(viewMode, currentDate);

    return (
        <div
            className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
            style={{ flexShrink: 0, background: '#fff', borderBottom: `1px solid ${LINE}`, paddingTop: 16, paddingBottom: 16 }}
        >
            {/* Row 1 — Title + Stat Cards */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT, letterSpacing: '-.04em' }}>
                        Calendar
                    </h1>
                    <p style={{ margin: '4px 0 0', color: MUTED, fontSize: 14 }}>
                        View and manage your task schedules
                    </p>
                </div>

                {/* Stat Cards — each navigates to filtered taskboard */}
                <div style={{ display: 'flex', gap: 10 }}>
                    {STAT_CARDS.map(({ key, label, color, route }) => (
                        <StatCard
                            key={key}
                            label={label}
                            value={taskStats[key]}
                            color={color}
                            route={route}
                        />
                    ))}
                </div>
            </div>

            {/* Row 2 — Controls bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>

                {/* Left: Today + Nav + Period */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={onToday}
                        style={{
                            height: 36, background: BLUE, color: '#fff',
                            border: 'none', borderRadius: 8, padding: '0 16px',
                            fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        }}
                    >
                        Today
                    </button>

                    <div style={{ display: 'flex', background: '#f5f7fb', border: `1px solid ${LINE}`, borderRadius: 8, padding: 2 }}>
                        <button
                            onClick={() => onNavigate('prev')}
                            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', color: MUTED }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fff')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            onClick={() => onNavigate('next')}
                            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', color: MUTED }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fff')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <span style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginLeft: 4 }}>
                        {headerTitle}
                    </span>
                </div>

                {/* Right: View toggle + New Event + Settings */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

                    {/* View toggle */}
                    <div style={{ display: 'flex', background: '#f5f7fb', border: `1px solid ${LINE}`, borderRadius: 8, padding: 3 }}>
                        {(['day', 'work_week', 'week', 'month'] as ViewMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => onViewMode(mode)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '5px 12px', border: 'none', borderRadius: 6, cursor: 'pointer',
                                    fontSize: 13, fontWeight: viewMode === mode ? 700 : 500,
                                    background: viewMode === mode ? '#fff' : 'transparent',
                                    color: viewMode === mode ? BLUE : MUTED,
                                    boxShadow: viewMode === mode ? '0 1px 3px rgba(16,24,40,.06)' : 'none',
                                    transition: 'all 0.12s',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {VIEW_ICONS[mode]}
                                {VIEW_LABELS[mode]}
                            </button>
                        ))}
                    </div>

                    {/* New Event */}
                    <button
                        onClick={onNewEvent}
                        style={{
                            height: 36, display: 'flex', alignItems: 'center', gap: 7,
                            padding: '0 14px', background: '#EEF4FF',
                            color: '#4338CA', border: `1px solid #C7D7FE`,
                            borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                        }}
                    >
                        <CalendarPlus size={16} />
                        New event
                    </button>

                    {/* Settings */}
                    <div style={{ position: 'relative' }} ref={settingsDropdownRef}>
                        <button
                            onClick={onToggleSettings}
                            style={{
                                height: 36, display: 'flex', alignItems: 'center', gap: 7,
                                padding: '0 14px',
                                background: isSettingsOpen || includeSharedEvents ? '#f5f7fb' : '#fff',
                                border: `1px solid ${isSettingsOpen ? BLUE : LINE}`,
                                borderRadius: 8, fontSize: 13, fontWeight: 600,
                                color: TEXT, cursor: 'pointer',
                            }}
                        >
                            <Settings size={16} color={MUTED} />
                            Settings
                            <ChevronDown size={13} color={MUTED} style={{ transform: isSettingsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>

                        {isSettingsOpen && (
                            <div style={{
                                position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50,
                                background: '#fff', border: `1px solid ${LINE}`,
                                borderRadius: 12, boxShadow: '0 8px 24px rgba(16,24,40,.12)',
                                minWidth: 272, overflow: 'hidden',
                            }}>
                                {/* Header */}
                                <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: `1px solid ${LINE}` }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Settings size={14} color={MUTED} /> Calendar Settings
                                    </span>
                                </div>

                                {/* Show Shared Events toggle */}
                                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>Show Shared Events</span>
                                    <button
                                        onClick={() => { onToggleSharedEvents(!includeSharedEvents); }}
                                        style={{
                                            width: 44, height: 24, borderRadius: 12,
                                            background: includeSharedEvents ? '#7c3aed' : '#d1d5db',
                                            border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                                        }}
                                    >
                                        <span style={{
                                            position: 'absolute', top: 2, left: includeSharedEvents ? 22 : 2,
                                            width: 20, height: 20, borderRadius: '50%', background: '#fff',
                                            boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left 0.2s',
                                        }} />
                                    </button>
                                </div>

                                {/* Share My Calendar */}
                                <button
                                    onClick={() => { onShareCalendar(); onToggleSettings(); }}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '12px 16px', border: 'none', background: 'transparent',
                                        borderBottom: `1px solid ${LINE}`, cursor: 'pointer', fontSize: 13,
                                        fontWeight: 500, color: TEXT, textAlign: 'left',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <Share2 size={16} color="#16a34a" /> Share My Calendar
                                </button>

                                {/* Shared user list */}
                                {includeSharedEvents && sharedWithMeUsers.length > 0 && (
                                    <div style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                            <Users size={14} color="#7c3aed" />
                                            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>View Shared Calendars</span>
                                        </div>
                                        <div style={{ maxHeight: 192, overflowY: 'auto' }}>
                                            {/* Select All */}
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', borderBottom: `1px solid ${LINE}`, marginBottom: 4 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUserIds.length === sharedWithMeUsers.length}
                                                    onChange={onSelectAllUsers}
                                                    style={{ accentColor: '#7c3aed', width: 14, height: 14 }}
                                                />
                                                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Select All Members</span>
                                            </label>
                                            {sharedWithMeUsers.map((u: any) => {
                                                const isSelected = selectedUserIds.includes(u.id);
                                                return (
                                                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', borderRadius: 6 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => onToggleUser(u.id)}
                                                            style={{ accentColor: '#7c3aed', width: 14, height: 14 }}
                                                        />
                                                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                                                            {u.name?.charAt(0)?.toUpperCase()}
                                                        </div>
                                                        <span style={{ fontSize: 13, color: TEXT, flex: 1 }}>{u.name}</span>
                                                        {isSelected && <Check size={12} color="#7c3aed" />}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
