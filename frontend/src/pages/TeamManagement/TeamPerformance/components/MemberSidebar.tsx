import React from 'react';
import { Users } from 'lucide-react';
import type { TeamMember } from '../index';
import { LINE, TEXT, MUTED, BLUE } from '@/config/tokens';

interface MemberSidebarProps {
  members:        TeamMember[];
  selectedId:     number | null;
  loadingPerf:    boolean;
  onSelect:       (m: TeamMember) => void;
}

const ROLE_COLORS: Record<string, string> = {
  admin:     '#7c3aed',
  manager:   '#0ea5e9',
  developer: '#10b981',
  annotator: '#f59e0b',
  viewer:    '#64748b',
};

export function MemberSidebar({ members, selectedId, loadingPerf, onSelect }: MemberSidebarProps) {
  return (
    <div style={{
      width: 280, flexShrink: 0,
      borderRight: `1px solid ${LINE}`,
      background: 'hsl(var(--card))',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Users size={16} color={BLUE} />
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: '-.01em' }}>
            Team Members
          </span>
          <span style={{ fontSize: 11, color: MUTED, background: 'hsl(var(--muted))', padding: '1px 7px', borderRadius: 99, fontWeight: 600 }}>
            {members.length}
          </span>
        </div>
        <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>Select a member to view their performance</p>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {members.map(m => {
          const isSelected = m.id === selectedId;
          const p = m.performance;
          const score = p && p.total_tasks_count > 0
            ? Math.round((p.completed_tasks_count / p.total_tasks_count) * 100)
            : null;
          const roleColor = ROLE_COLORS[m.role] || '#64748b';

          return (
            <button
              key={m.id}
              onClick={() => !loadingPerf && onSelect(m)}
              disabled={loadingPerf}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px',
                borderRadius: 10, marginBottom: 4, border: 'none',
                background: isSelected ? `${BLUE}12` : 'transparent',
                borderLeft: isSelected ? `3px solid ${BLUE}` : '3px solid transparent',
                cursor: loadingPerf ? 'not-allowed' : 'pointer',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: isSelected ? BLUE : `${roleColor}20`,
                  border: `2px solid ${isSelected ? BLUE : `${roleColor}40`}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  color: isSelected ? '#fff' : roleColor,
                  transition: 'all .15s',
                }}>
                  {m.initials || '?'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: isSelected ? BLUE : TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.first_name} {m.last_name}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                      padding: '1px 6px', borderRadius: 4,
                      background: `${roleColor}18`, color: roleColor,
                    }}>
                      {m.role}
                    </span>
                    {score !== null && (
                      <span style={{ fontSize: 10, color: MUTED }}>{p?.completed_tasks_count}/{p?.total_tasks_count}</span>
                    )}
                  </div>
                </div>

                {/* Score */}
                {score !== null && (
                  <span style={{
                    fontSize: 11, fontWeight: 800, flexShrink: 0,
                    color: score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626',
                  }}>
                    {score}%
                  </span>
                )}
              </div>

              {/* Mini progress bar */}
              {score !== null && (
                <div style={{ height: 2, background: 'hsl(var(--muted))', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99, transition: 'width .4s',
                    width: `${score}%`,
                    background: score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626',
                  }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}