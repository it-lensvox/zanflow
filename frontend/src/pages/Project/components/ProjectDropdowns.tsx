import ReactDOM from 'react-dom';
import React from 'react';
import { BLUE, LINE, MUTED, TEXT } from '@/pages/MyTask/pages/CreateTask/createTaskConstants';

export const PROJECT_ROLES = [
  { label: 'Manager',            value: 'manager' },
  { label: 'Frontend Developer', value: 'frontend' },
  { label: 'Backend Developer',  value: 'backend' },
  { label: 'Testing Engineer',   value: 'tester' },
  { label: 'DevOps Engineer',    value: 'devops' },
  { label: 'Social Media',       value: 'social_media' },
];

export const ChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ opacity: 0.5, flexShrink: 0 }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

interface DropdownTriggerProps {
  label?: string;
  placeholder: string;
  onClick: () => void;
  open: boolean;
  dotColor?: string;
  triggerRef?: React.RefObject<HTMLDivElement>;
}

export function DropdownTrigger({ label, placeholder, onClick, open, dotColor, triggerRef }: DropdownTriggerProps) {
  const INPUT_STYLE_BASE: React.CSSProperties = {
    width: '100%', height: 38,
    padding: '0 10px 0 12px',
    fontSize: 13, color: TEXT,
    background: '#fff',
    border: `1px solid ${open ? BLUE : LINE}`,
    borderRadius: 8, outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
    fontFamily: 'inherit',
    boxShadow: open ? '0 0 0 3px rgba(22,99,246,.08)' : 'none',
  };

  return (
    <div
      ref={triggerRef}
      onClick={onClick}
      style={{ ...INPUT_STYLE_BASE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', gap: 6 }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, overflow: 'hidden' }}>
        {dotColor && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, display: 'inline-block' }} />
        )}
        <span style={{ color: label ? TEXT : MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label || placeholder}
        </span>
      </span>
      <ChevronDown />
    </div>
  );
}


export function DropdownList({ children, triggerRef }: { children: React.ReactNode; triggerRef: React.RefObject<HTMLElement> }) {
  const [rect, setRect] = React.useState<DOMRect | null>(() =>
    triggerRef.current ? triggerRef.current.getBoundingClientRect() : null
  );

  React.useEffect(() => {
    if (triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
    // Re-measure if window resizes while the dropdown is open
    const onResize = () => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []); // empty array — measure once on mount, then only on resize

  if (!rect) return null;

  return ReactDOM.createPortal(
    <div
      data-project-dropdown-portal="true"
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
        background: '#fff',
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(16,24,40,.15)',
        maxHeight: 220,
        overflowY: 'auto',
        padding: '4px 0',
      }}>
      {children}
    </div>,
    document.body,
  );
}

export function DropdownItem({
  label, selected, onClick, icon,
}: {
  label: string; selected?: boolean; onClick: () => void; icon?: React.ReactNode;
}) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', cursor: 'pointer', fontSize: 13, fontWeight: selected ? 600 : 400, color: selected ? BLUE : TEXT, background: selected ? '#EEF4FF' : 'transparent', transition: 'background 0.1s' }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#F7F8FB'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {selected && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}