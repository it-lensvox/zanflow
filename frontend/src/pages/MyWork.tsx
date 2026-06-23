import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { taskApi, eventApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Calendar, CheckCircle, Clock, AlertCircle, ChevronRight, Video, MapPin } from 'lucide-react';

// Design tokens 
const BLUE = '#1663F6';
const GREEN = '#22C55E';
const YELLOW = '#F59E0B';
const RED = '#EF4444';
const PURPLE = '#8B5CF6';
const INK = '#172033';
const MUTED = '#667085';
const LINE = '#E6EBF2';
const SURFACE = '#FFFFFF';

const EVENT_COLORS = [BLUE, PURPLE, YELLOW, GREEN, RED];
function eventColor(idx: number) { return EVENT_COLORS[idx % EVENT_COLORS.length]; }

// Status helpers
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: 'In Progress', color: BLUE, bg: '#EEF4FF' },
  pending: { label: 'Pending', color: YELLOW, bg: '#FFFBEB' },
  backlog: { label: 'Backlog', color: MUTED, bg: '#F3F4F6' },
  completed: { label: 'Completed', color: GREEN, bg: '#F0FDF4' },
  deployed: { label: 'Deployed', color: GREEN, bg: '#F0FDF4' },
  overdue: { label: 'Overdue', color: RED, bg: '#FEF2F2' },
  deferred: { label: 'Deferred', color: MUTED, bg: '#F3F4F6' },
};
function statusInfo(s: string) {
  return STATUS_MAP[s?.toLowerCase()] || { label: s, color: MUTED, bg: '#F3F4F6' };
}
function isOverdue(task: any) {
  if (!task.end_date) return false;
  return new Date(task.end_date) < new Date() && task.status !== 'completed' && task.status !== 'deployed';
}

// ── Time / date helpers
function formatTime(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function eventDuration(start: string, end: string) {
  if (!start || !end) return '';
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60), m = diff % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function isToday(iso: string) {
  if (!iso) return false;
  const dateStr = iso.includes('T') ? iso : iso + 'T00:00:00';
  const d = new Date(dateStr);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function Avatar({ name, size = 28, color = BLUE, avatarUrl }: { name: string; size?: number; color?: string; avatarUrl?: string | null }) {
  const init = (name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: `1.5px solid ${color}44`,
        }}
        onError={e => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color + '22', color, fontWeight: 700,
      fontSize: size * 0.38, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, border: `1.5px solid ${color}44`,
    }}>{init}</div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = statusInfo(status);
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

// ── Reschedule modal
function RescheduleModal({ event, onClose, onSave }: { event: any; onClose: () => void; onSave: (id: number, start: string, end: string) => void }) {
  const durationMs = event.end_time && event.start_time
    ? new Date(event.end_time).getTime() - new Date(event.start_time).getTime()
    : 30 * 60000;

  const toLocal = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [newStart, setNewStart] = useState(toLocal(event.start_time));

  const handleSave = () => {
    if (!newStart) return;
    const startISO = new Date(newStart).toISOString();
    const endISO = new Date(new Date(newStart).getTime() + durationMs).toISOString();
    onSave(event.id, startISO, endISO);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, color: INK, marginBottom: 6 }}>Reschedule Meeting</div>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>{event.title}</div>

        <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: 'block', marginBottom: 6 }}>New Date & Time</label>
        <input
          type="datetime-local"
          value={newStart}
          onChange={e => setNewStart(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }}
        />
        <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
          Duration: {eventDuration(event.start_time, event.end_time)} (will be preserved)
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, height: 40, border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: INK }}>
            Cancel
          </button>
          <button onClick={handleSave} style={{ flex: 1, height: 40, background: BLUE, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component
export function MyWork() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rescheduleEvent, setRescheduleEvent] = useState<any>(null);
  const { data: tasksResponse, isLoading: tasksLoading } = useQuery({
    queryKey: ['my-work-tasks'],
    queryFn: () => taskApi.list({ disable_pagination: true }),
  });
  const allTasks: any[] = useMemo(() => {
    return tasksResponse?.tasks || tasksResponse?.results || (Array.isArray(tasksResponse) ? tasksResponse : []);
  }, [tasksResponse]);
  const myTasks: any[] = useMemo(() => {
    if (!user?.id) return allTasks;
    return allTasks.filter((t: any) =>
      (t.assigned_to || []).some((id: any) => String(id) === String(user.id))
    );
  }, [allTasks, user]);
  const activeTask = useMemo(() => myTasks.find((t: any) => t.status === 'in_progress'), [myTasks]);

  const focusProgress = useMemo(() => {
    if (!activeTask) return 0;
    const projectTasks = myTasks.filter((t: any) =>
      String((t as any).project) === String((activeTask as any).project)
    );
    if (projectTasks.length === 0) return 0;
    const done = projectTasks.filter((t: any) => t.status === 'completed' || t.status === 'deployed').length;
    return Math.round((done / projectTasks.length) * 100);
  }, [activeTask, myTasks]);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // ── Queries 
  const { data: eventsResponse, isLoading: eventsLoading } = useQuery({
    queryKey: ['my-work-events', todayStr],
    queryFn: () => eventApi.list({ start_date: todayStr, end_date: todayStr }),
    staleTime: 0,
  });

  // ── Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: ({ id, start_time, end_time }: { id: number; start_time: string; end_time: string }) =>
      eventApi.update(id, { start_time, end_time } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-work-events'] });
      setRescheduleEvent(null);
    },
  });

  // ── Derived data

  // Today's meetings/events
  const todayMeetings: any[] = useMemo(() => {
    const raw = eventsResponse?.results || eventsResponse?.events || (Array.isArray(eventsResponse) ? eventsResponse : []);
    return raw
      .filter((ev: any) => isToday(ev.start_time) || isToday(ev.start_date))
      .sort((a: any, b: any) => {
        const aTime = new Date(a.start_time || a.start_date).getTime();
        const bTime = new Date(b.start_time || b.start_date).getTime();
        return aTime - bTime;
      });
  }, [eventsResponse]);

  // Tasks due today
  const tasksDueToday: any[] = useMemo(() => {
    return myTasks.filter((t: any) => {
      if (!t.end_date) return false;
      return isToday(t.end_date);
    });
  }, [myTasks]);

  // Merge meetings + tasks, sorted by time
  const scheduleItems: any[] = useMemo(() => {
    const meetings = todayMeetings.map((ev: any) => ({ ...ev, _type: 'meeting', _sortTime: new Date(ev.start_time || ev.start_date).getTime() }));
    const tasks = tasksDueToday.map((t: any) => ({ ...t, _type: 'task', _sortTime: new Date(t.end_date).getTime() }));
    return [...meetings, ...tasks].sort((a, b) => a._sortTime - b._sortTime);
  }, [todayMeetings, tasksDueToday]);

  const assignedToMe = useMemo(() => {
    const priority = (t: any) => {
      if (t.status === 'in_progress') return 0;
      if (isOverdue(t)) return 1;
      if (t.status === 'pending' || t.status === 'backlog') return 2;
      if (t.status === 'completed' || t.status === 'deployed') return 3;
      return 4;
    };
    return [...myTasks].sort((a, b) => priority(a) - priority(b)).slice(0, 6);
  }, [myTasks]);
  const isLoading = tasksLoading || eventsLoading;

  const card: React.CSSProperties = {
    background: SURFACE, borderRadius: 12,
    border: `1px solid ${LINE}`,
    boxShadow: '0 1px 4px rgba(16,24,40,.04)',
  };

  return (
    <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6 pb-8" style={{ background: '#F8FAFC', minHeight: '100vh'}}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: INK, letterSpacing: '-.03em' }}>My Work</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        {!activeTask && (
          <button
            onClick={() => navigate('/taskboard')}
            style={{ height: 40, background: BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '0 18px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <Plus size={15} /> Add focus block
          </button>
        )}
      </div>

      {/* ── Focus Block ── */}
      {activeTask && (
        <div style={{ background: 'linear-gradient(135deg, #1a2340 0%, #1e2d4f 100%)', borderRadius: 14, padding: '22px 28px', marginBottom: 24, color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8DA8D8', letterSpacing: '.08em', marginBottom: 6 }}>FOCUS BLOCK · IN PROGRESS</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{activeTask.heading}</div>
          <div style={{ fontSize: 13, color: '#8DA8D8', marginBottom: 18 }}>
            {activeTask.end_date ? `Due ${formatDate(activeTask.end_date)}` : 'No due date'}
            {activeTask.project_details?.name ? ` · ${activeTask.project_details.name}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.15)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${focusProgress}%`, height: '100%', background: BLUE, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#8DA8D8', whiteSpace: 'nowrap' }}>{focusProgress}% complete</span>
            <button onClick={() => navigate('/taskboard')} style={{ height: 36, padding: '0 18px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Resume</button>
            <button style={{ height: 36, padding: '0 18px', background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Pause</button>
          </div>
        </div>
      )}

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* ── Today's Schedule (meetings + tasks) ── */}
        <div style={{ ...card, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>Today's schedule</span>
            <button onClick={() => navigate('/calendar')} style={{ fontSize: 12, fontWeight: 600, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              View calendar <ChevronRight size={12} />
            </button>
          </div>

          {isLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: MUTED, fontSize: 13 }}>Loading…</div>
          ) : scheduleItems.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: MUTED }}>
              <Calendar size={32} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
              <p style={{ margin: 0, fontSize: 13 }}>No meetings or tasks due today</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {scheduleItems.map((item: any, idx: number) => {
                const isLast = idx === scheduleItems.length - 1;

                // ── Meeting row
                if (item._type === 'meeting') {
                  const color = eventColor(idx);
                  const attendees: any[] = item.attendees_details || item.attendees || [];
                  const isOnline = item.is_online_meeting;
                  return (
                    <div key={`ev-${item.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 0', borderBottom: isLast ? 'none' : `1px solid ${LINE}` }}>
                      {/* Time */}
                      <div style={{ fontSize: 11, color: MUTED, width: 68, flexShrink: 0, paddingTop: 2, fontWeight: 600 }}>
                        {formatTime(item.start_time || item.start_date)}
                      </div>
                      {/* Color stripe */}
                      <div style={{ width: 3, borderRadius: 3, background: color, alignSelf: 'stretch', flexShrink: 0 }} />
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 650, color: INK }}>{item.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: MUTED }}>
                            Meeting · {eventDuration(item.start_time, item.end_time)}
                          </span>
                          {isOnline && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: BLUE }}>
                              <Video size={10} /> Online
                            </span>
                          )}
                          {item.location && !isOnline && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: MUTED }}>
                              <MapPin size={10} /> {item.location}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Attendee avatars */}
                      {attendees.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {attendees.slice(0, 3).map((att: any, i: number) => (
                            <div key={i} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 3 - i }}>
                              <Avatar
                                name={att.full_name || att.first_name || att.username || `U${i + 1}`}
                                size={24}
                                color={EVENT_COLORS[i % EVENT_COLORS.length]}
                                avatarUrl={att.avatar || null}
                              />
                            </div>
                          ))}
                          {attendees.length > 3 && (
                            <div style={{ marginLeft: -6, width: 24, height: 24, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: MUTED }}>
                              +{attendees.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Reschedule button */}
                      <button
                        onClick={() => setRescheduleEvent(item)}
                        style={{ fontSize: 11, fontWeight: 600, color: BLUE, background: '#EEF4FF', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        Reschedule
                      </button>
                    </div>
                  );
                }

                // ── Task row 
                const overdue = isOverdue(item);
                return (
                  <div
                    key={`task-${item.id}`}
                    onClick={() => navigate('/taskboard')}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 0', borderBottom: isLast ? 'none' : `1px solid ${LINE}`, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ fontSize: 11, color: MUTED, width: 68, flexShrink: 0, paddingTop: 2, fontWeight: 600 }}>
                      {item.end_date ? formatTime(item.end_date) : 'All day'}
                    </div>
                    <div style={{ width: 3, borderRadius: 3, background: overdue ? RED : YELLOW, alignSelf: 'stretch', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 650, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.heading}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                        Task · {item.project_details?.name || 'No project'}
                        {overdue && <span style={{ color: RED, marginLeft: 6 }}>· Overdue</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Assigned to Me ── */}
        <div style={{ ...card, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>Assigned to me</span>
            <button onClick={() => navigate('/taskboard')} style={{ fontSize: 12, fontWeight: 600, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ChevronRight size={12} />
            </button>
          </div>

          {isLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: MUTED, fontSize: 13 }}>Loading…</div>
          ) : assignedToMe.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: MUTED }}>
              <CheckCircle size={32} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
              <p style={{ margin: 0, fontSize: 13 }}>No tasks assigned to you</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {assignedToMe.map((task: any, idx: number) => {
                const overdue = isOverdue(task);
                const assigneeDetails = task.assigned_to_user_details?.[0];
                return (
                  <div
                    key={task.id}
                    onClick={() => navigate('/taskboard')}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: idx < assignedToMe.length - 1 ? `1px solid ${LINE}` : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Checkbox */}
                    <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${task.status === 'completed' ? GREEN : LINE}`, background: task.status === 'completed' ? GREEN : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {task.status === 'completed' && (
                        <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: task.status === 'completed' ? MUTED : INK, textDecoration: task.status === 'completed' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.heading}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: MUTED }}>{task.project_details?.name || 'DYUKSA'}</span>
                        {task.end_date && (
                          <>
                            <span style={{ fontSize: 11, color: LINE }}>·</span>
                            <span style={{ fontSize: 11, color: overdue ? RED : MUTED, display: 'flex', alignItems: 'center', gap: 3 }}>
                              {overdue && <AlertCircle size={10} color={RED} />}
                              {formatDate(task.end_date)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <StatusPill status={overdue ? 'overdue' : task.status} />
                    {assigneeDetails && (
                      <Avatar
                        name={`${assigneeDetails.first_name || ''} ${assigneeDetails.last_name || ''}`.trim() || assigneeDetails.username || '?'}
                        size={26}
                        color={BLUE}
                        avatarUrl={assigneeDetails.avatar || null}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20 }}>
        {[
          { label: 'In Progress', value: myTasks.filter((t: any) => t.status === 'in_progress').length, color: BLUE, icon: <Clock size={16} color={BLUE} /> },
          { label: 'Pending', value: myTasks.filter((t: any) => t.status === 'pending' || t.status === 'backlog').length, color: YELLOW, icon: <Clock size={16} color={YELLOW} /> },
          { label: 'Completed', value: myTasks.filter((t: any) => t.status === 'completed' || t.status === 'deployed').length, color: GREEN, icon: <CheckCircle size={16} color={GREEN} /> },
          { label: 'Overdue', value: myTasks.filter((t: any) => isOverdue(t)).length, color: RED, icon: <AlertCircle size={16} color={RED} /> },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Reschedule Modal ── */}
      {rescheduleEvent && (
        <RescheduleModal
          event={rescheduleEvent}
          onClose={() => setRescheduleEvent(null)}
          onSave={(id, start_time, end_time) => rescheduleMutation.mutate({ id, start_time, end_time })}
        />
      )}
    </div>
  );
}

export default MyWork;