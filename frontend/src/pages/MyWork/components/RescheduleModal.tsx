import { useState } from 'react';
import { INK, MUTED, LINE, BLUE, eventDuration } from '../myWorkConstants';

export function RescheduleModal({
  event,
  onClose,
  onSave,
}: {
  event: any;
  onClose: () => void;
  onSave: (id: number, start: string, end: string) => void;
}) {
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