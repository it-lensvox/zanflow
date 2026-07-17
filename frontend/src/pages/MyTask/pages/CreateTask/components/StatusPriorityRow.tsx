import React from 'react';
import { ChevronDown } from 'lucide-react';
import { FormField } from './FormField';
import { LINE, MUTED, TEXT, STATUS_OPTIONS, PRIORITY_OPTIONS } from '../createTaskConstants';

interface StatusPriorityRowProps {
  status: string;
  setStatus: (v: string) => void;
  priority: string;
  setPriority: (v: string) => void;
  statusDropdownOpen: boolean;
  setStatusDropdownOpen: (v: boolean) => void;
  priorityDropdownOpen: boolean;
  setPriorityDropdownOpen: (v: boolean) => void;
}

const selectTrigger: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 10px',
  border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  cursor: 'pointer', fontSize: 13, color: TEXT,
  transition: 'border-color .15s',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0,
  background: 'hsl(var(--popover))', border: `1px solid ${LINE}`, borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0,0,0,.18)', overflow: 'hidden',
};

const checkIcon = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="#1663f6">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

export function StatusPriorityRow({
  status, setStatus, priority, setPriority,
  statusDropdownOpen, setStatusDropdownOpen,
  priorityDropdownOpen, setPriorityDropdownOpen,
}: StatusPriorityRowProps) {
  const currentStatus = STATUS_OPTIONS.find(o => o.value === status);
  const currentPriority = PRIORITY_OPTIONS.find(o => o.value === priority);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {/* Status */}
      <div style={{ position: 'relative' }} data-dropdown="status">
        <FormField label="Status">
          <div style={selectTrigger} onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {currentStatus && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: currentStatus.dot, flexShrink: 0 }} />
              )}
              {currentStatus?.label ?? 'Select status'}
            </span>
            <ChevronDown size={14} color={MUTED} />
          </div>
        </FormField>
        {statusDropdownOpen && (
          <div style={dropdownStyle}>
            {STATUS_OPTIONS.map(opt => (
              <div
                key={opt.value}
                style={{ padding: '9px 14px', fontSize: 13, color: TEXT, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--accent))')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { setStatus(opt.value); setStatusDropdownOpen(false); }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.dot }} />
                  {opt.label}
                </span>
                {status === opt.value && checkIcon}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Priority */}
      <div style={{ position: 'relative' }} data-dropdown="priority">
        <FormField label="Priority">
          <div style={selectTrigger} onClick={() => setPriorityDropdownOpen(!priorityDropdownOpen)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {currentPriority && (
                <span style={{
                  padding: '1px 7px', borderRadius: 5,
                  background: currentPriority.bg, color: currentPriority.color,
                  border: `1px solid ${currentPriority.border}`,
                  fontSize: 11, fontWeight: 600,
                }}>
                  {currentPriority.label}
                </span>
              )}
            </span>
            <ChevronDown size={14} color={MUTED} />
          </div>
        </FormField>
        {priorityDropdownOpen && (
          <div style={dropdownStyle}>
            {PRIORITY_OPTIONS.map(opt => (
              <div
                key={opt.value}
                style={{ padding: '9px 14px', fontSize: 13, color: TEXT, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--accent))')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { setPriority(opt.value); setPriorityDropdownOpen(false); }}
              >
                <span style={{
                  padding: '1px 7px', borderRadius: 5,
                  background: opt.bg, color: opt.color,
                  border: `1px solid ${opt.border}`,
                  fontSize: 11, fontWeight: 600,
                }}>
                  {opt.label}
                </span>
                {priority === opt.value && checkIcon}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}