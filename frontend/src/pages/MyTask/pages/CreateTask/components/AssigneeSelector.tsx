import React from 'react';
import { User } from 'lucide-react';
import { FormField } from './FormField';
import { LINE, MUTED, TEXT } from '../createTaskConstants';
import type { UserOption } from '../hooks/useCreateTask';

interface AssigneeSelectorProps {
  assignedToList: number[];
  setAssignedToList: (v: number[]) => void;
  dropdownOpen: boolean;
  setDropdownOpen: (v: boolean) => void;
  assigneeSearchInput: string;
  setAssigneeSearchInput: (v: string) => void;
  highlightedUserIndex: number;
  setHighlightedUserIndex: (v: number) => void;
  filteredUserOptions: UserOption[];
  allUserOptions: UserOption[];
  usersLoading: boolean;
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 8px', borderRadius: 6,
  background: '#f1f5f9', color: '#334155',
  fontSize: 12, fontWeight: 500,
  border: '1px solid #e2e8f0',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0,
  background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10,
  boxShadow: '0 8px 24px rgba(16,24,40,.1)', maxHeight: 220, overflowY: 'auto',
};

export function AssigneeSelector({
  assignedToList, setAssignedToList,
  dropdownOpen, setDropdownOpen,
  assigneeSearchInput, setAssigneeSearchInput,
  highlightedUserIndex, setHighlightedUserIndex,
  filteredUserOptions, allUserOptions,
  usersLoading,
}: AssigneeSelectorProps) {
  return (
    <div style={{ position: 'relative' }} data-dropdown="assignee">
      <FormField label="Assignees" icon={<User size={13} />}>
        <div style={{
          width: '100%', minHeight: 38, padding: '4px 10px',
          border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
        }}>
          {usersLoading ? (
            <span style={{ fontSize: 13, color: MUTED, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, border: '2px solid #1663f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Loading…
            </span>
          ) : (
            <>
              {assignedToList.map(userId => {
                const user = allUserOptions.find(u => u.id === userId);
                if (!user) return null;
                return (
                  <span key={userId} style={chipStyle}>
                    {user.label}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setAssignedToList(assignedToList.filter(id => id !== userId)); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 14 }}
                    >×</button>
                  </span>
                );
              })}
              <input
                type="text"
                value={assigneeSearchInput}
                onChange={e => { setAssigneeSearchInput(e.target.value); setHighlightedUserIndex(0); setDropdownOpen(true); }}
                onFocus={() => { setDropdownOpen(true); setHighlightedUserIndex(0); }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedUserIndex(Math.min(highlightedUserIndex + 1, filteredUserOptions.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedUserIndex(Math.max(highlightedUserIndex - 1, 0)); }
                  else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredUserOptions[highlightedUserIndex]) {
                      setAssignedToList([...assignedToList, filteredUserOptions[highlightedUserIndex].id]);
                      setAssigneeSearchInput(''); setHighlightedUserIndex(0);
                    }
                  }
                  else if (e.key === 'Escape') { setDropdownOpen(false); setAssigneeSearchInput(''); setHighlightedUserIndex(0); }
                  else if (e.key === 'Backspace' && assigneeSearchInput === '' && assignedToList.length > 0) {
                    setAssignedToList(assignedToList.slice(0, -1));
                  }
                }}
                placeholder={assignedToList.length === 0 ? 'Assign to team members…' : ''}
                style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', fontSize: 13, color: TEXT, background: 'transparent' }}
              />
            </>
          )}
        </div>
      </FormField>

      {dropdownOpen && !usersLoading && filteredUserOptions.length > 0 && (
        <div style={dropdownStyle}>
          {filteredUserOptions.map((user, i) => (
            <div
              key={user.id}
              style={{
                padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                background: i === highlightedUserIndex ? '#eef3ff' : 'transparent',
                color: i === highlightedUserIndex ? '#1663f6' : TEXT,
              }}
              onMouseEnter={() => setHighlightedUserIndex(i)}
              onClick={() => {
                setAssignedToList([...assignedToList, user.id]);
                setAssigneeSearchInput(''); setHighlightedUserIndex(0); setDropdownOpen(false);
              }}
            >
              {user.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}