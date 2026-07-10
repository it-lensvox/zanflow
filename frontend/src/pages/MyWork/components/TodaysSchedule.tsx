import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronRight, Video, MapPin } from 'lucide-react';
import {
  BLUE, MUTED, INK, LINE, RED, YELLOW,
  card, eventColor, EVENT_COLORS, formatTime, eventDuration, isOverdue,
} from '../myWorkConstants';
import { Avatar } from './shared';

export function TodaysSchedule({
  scheduleItems,
  isLoading,
  onReschedule,
}: {
  scheduleItems: any[];
  isLoading: boolean;
  onReschedule: (event: any) => void;
}) {
  const navigate = useNavigate();

  return (
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
                    onClick={() => onReschedule(item)}
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
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--accent))')}
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
  );
}