import React from 'react';
import {
    ChevronRight, RefreshCw, Copy, Download, Trash2, Settings,
    Sparkles, Send, Loader2, X,
} from 'lucide-react';
import { useCalendar } from './hooks/useCalendar';
import { CalendarHeader } from './components/CalendarHeader';
import { MiniCalendar } from './components/MiniCalendar';
import { DayCell } from './components/DayCell';
import { DaysView } from './components/DaysView';
import { EventModal } from './components/EventModal';
import { TaskListSidebar } from './components/TaskListSidebar';
import { ShareCalendarModal } from './components/ShareCalendarModal';
import DeclineModal from './components/DeclineModal';
import RescheduleModal from './components/RescheduleModal';
import { TaskDetailModal } from '../MyTask/TaskDetail/Components/TaskDetailModal';
import { eventApi } from '@/services/api';
import { DAYS_OF_WEEK } from './calendarConstants';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';
import type { Event as CalendarEventType } from '@/types';


declare global { interface Window { socket?: WebSocket; } }

export const Calendar: React.FC = () => {
    const c = useCalendar();
    const settingsDropdownRef = React.useRef<HTMLDivElement>(null);

    // ─── renderStatusDot lives here because it returns JSX (.tsx file only)
    const renderStatusDot = (event: CalendarEventType) => {
        if (c.seenEventIds.includes(event.id)) return null;
        if (event.my_invitation_status !== 'ORGANIZER') return null;
        const attendeeList = c.rsvpStatusMap[event.id] || [];
        if (attendeeList.length === 0) return null;
        const hasDeclined      = attendeeList.some((a: any) => a.status === 'DECLINED');
        const everyoneAccepted = attendeeList.every((a: any) => a.status === 'ACCEPTED');
        if (hasDeclined) return (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse z-50 shadow-sm" title="Someone declined" />
        );
        if (everyoneAccepted) return (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white z-50 shadow-sm" title="All accepted" />
        );
        return null;
    };

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node))
                c.setIsSettingsOpen(false);
        };
        if (c.isSettingsOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [c.isSettingsOpen]);

    if (c.isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-gray-500">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
                <p>Loading calendar...</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', overflow: 'hidden' }}>

            {/* Top Bar */}
            <CalendarHeader
                currentDate={c.currentDate}
                viewMode={c.viewMode}
                taskStats={c.taskStats}
                isSettingsOpen={c.isSettingsOpen}
                includeSharedEvents={c.includeSharedEvents}
                selectedUserIds={c.selectedUserIds}
                sharedWithMeUsers={c.sharedWithMeUsers}
                settingsDropdownRef={settingsDropdownRef}
                onToday={c.goToToday}
                onNavigate={c.navigateDate}
                onViewMode={v => c.setViewMode(v)}
                onNewEvent={() => { c.setSelectedDate(null); c.setIsEventModalOpen(true); }}
                onToggleSettings={() => c.setIsSettingsOpen(v => !v)}
                onToggleSharedEvents={val => { c.setIncludeSharedEvents(val); if (!val) c.setSelectedUserIds([]); }}
                onShareCalendar={() => c.setIsShareModalOpen(true)}
                onToggleUser={c.toggleSharedUser}
                onSelectAllUsers={() => {
                    if (c.selectedUserIds.length === c.sharedWithMeUsers.length) c.setSelectedUserIds([]);
                    else c.setSelectedUserIds(c.sharedWithMeUsers.map((u: any) => u.id));
                }}
            />

            {/* Dyuksa AI Bar */}
            <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 py-3 border-b border-gray-100 bg-white flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={c.dyuksaInput}
                            onChange={e => c.setDyuksaInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && c.handleDyuksaSubmit()}
                            placeholder='Try: "dyuksa find 30 mins with Shifali tomorrow"'
                            className="w-full px-4 py-2.5 pl-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                        <Sparkles size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500" />
                    </div>
                    <button
                        onClick={c.handleDyuksaSubmit}
                        disabled={c.isDyuksaLoading || !c.dyuksaInput.trim()}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                    >
                        {c.isDyuksaLoading ? <><Loader2 size={16} className="animate-spin" />Thinking...</> : <><Send size={16} />Ask Dyuksa</>}
                    </button>
                </div>
                {c.dyuksaResponse && (
                    <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                                <Sparkles size={14} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-purple-900 uppercase tracking-wider mb-1">Dyuksa AI</p>
                                <p className="text-sm text-purple-800 whitespace-pre-wrap">{c.dyuksaResponse}</p>
                            </div>
                            <button onClick={() => c.setDyuksaResponse(null)} className="p-1 text-purple-400 hover:text-purple-600 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 flex gap-6 flex-1 overflow-hidden py-4">
                {/* Mini Calendar sidebar */}
                <div className="hidden lg:flex flex-col w-56 flex-shrink-0">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <MiniCalendar
                            currentDate={c.currentDate}
                            onDateSelect={date => c.setCurrentDate(date)}
                            includeSharedEvents={c.includeSharedEvents}
                            onToggleSharedEvents={c.setIncludeSharedEvents}
                            sharedWithMeUsers={c.sharedWithMeUsers}
                            selectedUserIds={c.selectedUserIds}
                            onToggleUser={c.toggleSharedUser}
                        />
                    </div>
                </div>

                {/* Calendar grid */}
                <div className={`flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${c.selectedDate ? 'hidden md:flex' : 'flex'}`}>
                    {c.viewMode === 'month' ? (
                        <>
                            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                                {DAYS_OF_WEEK.map(day => (
                                    <div key={day} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">{day}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 auto-rows-fr flex-1">
                                {c.calendarDays.map((day, i) => (
                                    <DayCell
                                        key={i}
                                        day={day}
                                        onTaskClick={c.handleTaskClick}
                                        onEventClick={c.handleEventClick}
                                        onDateClick={c.handleDateClick}
                                        onEventDrop={(eventId, newDate) => {
                                            const ev = c.events.find(e => String(e.id) === eventId);
                                            if (!ev) return;
                                            const os  = new Date(ev.start_time);
                                            const dur = new Date(ev.end_time).getTime() - os.getTime();
                                            const ns  = new Date(newDate);
                                            ns.setHours(os.getHours(), os.getMinutes(), 0, 0);
                                            c.updateEventMutation({ id: ev.id, start_time: ns.toISOString(), end_time: new Date(ns.getTime() + dur).toISOString() });
                                        }}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <DaysView
                            currentDate={c.currentDate}
                            tasks={c.tasks}
                            events={c.filteredEvents}
                            selectedDate={c.selectedDate}
                            seenEventIds={c.seenEventIds}
                            renderStatusDot={renderStatusDot}
                            onTaskClick={c.handleTaskClick}
                            onEventClick={c.handleEventClick}
                            onDateClick={c.handleDateClick}
                            onCreateEventAtTime={(date, hour) => { c.setSelectedDate(date); c.setSelectedHour(hour); c.setIsEventModalOpen(true); }}
                            viewMode={c.viewMode as 'day' | 'work_week' | 'week'}
                            updateEvent={c.updateEventMutation}
                            currentUser={c.user ? { id: c.user.id, role: c.user.role } : null}
                            onAcceptInvitation={c.handleAcceptInvitation}
                            onDeclineInvitation={c.handleDeclineClick}
                            onRescheduleInvitation={c.handleRescheduleClick}
                            isAccepting={c.isAccepting}
                            onEventContextMenu={c.handleEventContextMenu}
                        />
                    )}
                </div>

                {/* Day detail sidebar */}
                {c.selectedDate && (
                    <TaskListSidebar
                        tasks={c.selectedDateTasks}
                        events={c.selectedDateEvents}
                        selectedDate={c.selectedDate}
                        onTaskClick={c.handleTaskClick}
                        onEventClick={c.handleEventClick}
                        onClose={() => c.setSelectedDate(null)}
                        currentUser={c.user ? { id: c.user.id, role: c.user.role } : null}
                        onOpenEventModal={() => c.setIsEventModalOpen(true)}
                        onAcceptInvitation={c.handleAcceptInvitation}
                        onDeclineInvitation={c.handleDeclineClick}
                        onRescheduleInvitation={c.handleRescheduleClick}
                        isAccepting={c.isAccepting}
                    />
                )}
            </div>

            {/* Status Legend */}
            <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 flex-shrink-0">
                <div className="flex flex-wrap items-center gap-4 px-6 py-3 mb-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-sm font-semibold text-gray-500">Status:</span>
                    <div className="flex flex-wrap gap-4">
                        {['pending','in_progress','completed','deployed','deferred','review'].map(status => {
                            const config = getStatusConfig(status);
                            return (
                                <div key={status} className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color }} />
                                    <span className="text-xs font-medium text-gray-600 capitalize">{status.replace('_', ' ')}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <EventModal
                isOpen={c.isEventModalOpen}
                onClose={() => { c.setIsEventModalOpen(false); c.setSelectedEvent(null); c.setSelectedDate(null); c.setSelectedHour(null); c.setDyuksaEventData(null); }}
                selectedDate={c.selectedDate}
                selectedHour={c.selectedHour}
                event={c.selectedEvent}
                currentUser={c.user ? { id: c.user.id, role: c.user.role } : null}
                allEvents={c.events}
                onAcceptInvitation={c.handleAcceptInvitation}
                onDeclineInvitation={c.handleDeclineClick}
                onRescheduleInvitation={c.handleRescheduleClick}
                isAccepting={c.isAccepting}
                dyuksaEventData={c.dyuksaEventData}
            />

            {c.selectedTask && (
                <TaskDetailModal
                    task={c.selectedTask}
                    onClose={() => c.setSelectedTask(null)}
                    onDelete={async () => c.setSelectedTask(null)}
                    onTaskUpdated={t => c.setSelectedTask(t)}
                />
            )}

            <DeclineModal
                isOpen={c.showDeclineModal}
                onClose={() => { c.setShowDeclineModal(false); c.setSelectedInvitationEvent(null); }}
                onDecline={c.handleDeclineSubmit}
                isLoading={c.isDeclining}
                eventTitle={c.selectedInvitationEvent?.title}
            />

            <RescheduleModal
                isOpen={c.showRescheduleModal}
                onClose={() => { c.setShowRescheduleModal(false); c.setSelectedInvitationEvent(null); }}
                onReschedule={c.handleRescheduleSubmit}
                isLoading={c.isRescheduling}
                eventTitle={c.selectedInvitationEvent?.title}
                originalTime={c.selectedInvitationEvent?.start_time}
            />

            <ShareCalendarModal
                isOpen={c.isShareModalOpen}
                onClose={() => c.setIsShareModalOpen(false)}
                currentUserId={c.user?.id || 0}
            />

            {/* Context Menu */}
            {c.contextMenu && (
                <div
                    className="fixed z-[100] bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[200px]"
                    style={{ top: Math.min(c.contextMenu.y, window.innerHeight - 250), left: Math.min(c.contextMenu.x, window.innerWidth - 220) }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="relative" onMouseEnter={() => c.setShowRepeatSubmenu(true)} onMouseLeave={() => c.setShowRepeatSubmenu(false)}>
                        <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between">
                            <span className="flex items-center gap-3"><RefreshCw size={16} className="text-gray-400" />Repeat event</span>
                            <ChevronRight size={14} className="text-gray-400" />
                        </button>
                        {c.showRepeatSubmenu && (
                            <div className="absolute top-0 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[180px]"
                                style={c.contextMenu.x + 400 > window.innerWidth ? { right: '100%', marginRight: '4px' } : { left: '100%', marginLeft: '4px' }}>
                                <button onClick={async () => {
                                    if (c.contextMenu?.event) {
                                        try {
                                            const os = new Date(c.contextMenu.event.start_time);
                                            const oe = new Date(c.contextMenu.event.end_time);
                                            const ts = new Date(os); ts.setDate(ts.getDate() + 1);
                                            const te = new Date(oe); te.setDate(te.getDate() + 1);
                                            await eventApi.create({ ...c.contextMenu.event, start_time: ts.toISOString(), end_time: te.toISOString() });
                                            c.queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
                                            c.closeContextMenu();
                                        } catch(e) { console.error(e); }
                                    }
                                }} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50">Tomorrow</button>
                                <button onClick={() => c.handleRepeatEvent('workday')} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50">Every workday</button>
                                <button onClick={() => c.handleRepeatEvent('weekly')}  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50">Every week</button>
                                <button onClick={() => c.handleRepeatEvent('monthly')} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50">Every month</button>
                                <button onClick={() => c.handleRepeatEvent('yearly')}  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50">Every year</button>
                                <div className="border-t border-gray-100 my-1" />
                                <button onClick={c.closeContextMenu} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                                    <Settings size={14} className="text-gray-400" />Custom repeat
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={async () => { if (c.contextMenu?.event) { try { await eventApi.create({ ...c.contextMenu.event }); c.queryClient.invalidateQueries({ queryKey: ['events-calendar'] }); } catch(e) { console.error(e); } } c.closeContextMenu(); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                        <Copy size={16} className="text-gray-400" />Duplicate event
                    </button>
                    <button onClick={async () => { if (c.contextMenu?.event?.id) { try { await eventApi.exportEvent(c.contextMenu.event.id); } catch(e) { alert('Failed to download event'); } } c.closeContextMenu(); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                        <Download size={16} className="text-gray-400" />Download ICS
                    </button>
                    <button onClick={async () => { if (c.contextMenu?.event?.id) { try { await eventApi.delete(c.contextMenu.event.id); await c.queryClient.invalidateQueries({ queryKey: ['events-calendar'] }); await c.queryClient.refetchQueries({ queryKey: ['events-calendar'] }); } catch(e) { console.error(e); } } c.closeContextMenu(); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3">
                        <Trash2 size={16} className="text-red-400" />Delete this event
                    </button>
                    <button onClick={async () => { if (c.contextMenu?.event) { const ev = c.contextMenu.event; const eh = new Date(ev.start_time).getHours(); const em = new Date(ev.start_time).getMinutes(); const sim = c.events.filter(e => e.title === ev.title && new Date(e.start_time).getHours() === eh && new Date(e.start_time).getMinutes() === em); if (window.confirm(`Delete ${sim.length} event(s) with title "${ev.title}"?\n\nThis action cannot be undone.`)) { try { for (const e of sim) await eventApi.delete(e.id); await c.queryClient.invalidateQueries({ queryKey: ['events-calendar'] }); await c.queryClient.refetchQueries({ queryKey: ['events-calendar'] }); } catch(e) { console.error(e); } } } c.closeContextMenu(); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3">
                        <Trash2 size={16} className="text-red-400" />Delete all similar events
                    </button>
                </div>
            )}
        </div>
    );
};

export default Calendar;