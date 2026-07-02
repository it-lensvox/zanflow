import { useState, useRef, useEffect } from 'react';
import { X, LayoutDashboard, CheckCircle2, ListTodo } from 'lucide-react';
import { BLUE, LINE, TEXT, MUTED, BG } from '../../index';

interface Template {
  key: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
}

const TEMPLATES: Template[] = [
  { key: 'overview', label: 'Overview',     sub: 'Stats, charts, tasks & projects', icon: <LayoutDashboard size={18} /> },
  { key: 'tasks',    label: 'Task focused',  sub: 'My tasks, status & completion',   icon: <ListTodo size={18} /> },
  { key: 'blank',    label: 'Start blank',   sub: 'Add your own widgets',            icon: <CheckCircle2 size={18} /> },
];

interface Props {
  onClose: () => void;
  onCreate: (name: string, template: string) => void;
}

export function NewDashboardModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('overview');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleCreate = () => {
    if (!name.trim()) { inputRef.current?.focus(); return; }
    onCreate(name.trim(), template);
    onClose();
  };

  return (
    // Overlay
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(16,24,40,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(16,24,40,0.18)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 0',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>New dashboard</div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 7, border: `1px solid ${LINE}`,
              background: '#fff', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} color={MUTED} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {/* Name input */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: TEXT, display: 'block', marginBottom: 6 }}>
              Dashboard name
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="e.g. My weekly view"
              maxLength={60}
              style={{
                width: '100%', height: 38, borderRadius: 8,
                border: `1px solid ${LINE}`, padding: '0 12px',
                fontSize: 14, color: TEXT, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
              onBlur={e => (e.currentTarget.style.borderColor = LINE)}
            />
          </div>

          {/* Template picker */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 8 }}>
              Start with a template
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TEMPLATES.map(t => {
                const selected = template === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTemplate(t.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 10,
                      border: `1.5px solid ${selected ? BLUE : LINE}`,
                      background: selected ? '#EEF4FF' : '#fff',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.12s', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: selected ? BLUE : BG,
                      color: selected ? '#fff' : MUTED,
                    }}>
                      {t.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{t.sub}</div>
                    </div>
                    {selected && (
                      <div style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '0 20px 20px',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              height: 36, padding: '0 16px', borderRadius: 8,
              border: `1px solid ${LINE}`, background: '#fff',
              fontSize: 13, fontWeight: 600, color: TEXT,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            style={{
              height: 36, padding: '0 20px', borderRadius: 8,
              border: 'none', background: name.trim() ? BLUE : '#C7D7FD',
              fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            Create dashboard
          </button>
        </div>
      </div>
    </div>
  );
}