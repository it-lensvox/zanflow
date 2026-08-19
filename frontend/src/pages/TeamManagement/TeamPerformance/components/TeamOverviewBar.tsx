import React from 'react';
import { CheckCircle, Clock, ListTodo, Users } from 'lucide-react';
import { LINE, MUTED, TEXT } from '@/config/tokens';

interface Props {
  total:      number;
  completed:  number;
  inProgress: number;
  pending:    number;
  memberCount: number;
}

export function TeamOverviewBar({ total, completed, inProgress, pending, memberCount }: Props) {
  const teamScore = total > 0 ? Math.round((completed / total) * 100) : 0;

  const stats = [
    { icon: Users,       label: 'Members',      value: memberCount, color: '#1663f6' },
    { icon: CheckCircle, label: 'Completed',     value: completed,   color: '#16a34a' },
    { icon: Clock,       label: 'In Progress',   value: inProgress,  color: '#d97706' },
    { icon: ListTodo,    label: 'Pending',        value: pending,     color: '#6366f1' },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      background: 'hsl(var(--card))',
      borderBottom: `1px solid ${LINE}`,
      padding: '12px 24px',
      flexWrap: 'wrap',
    }}>
      {stats.map((s, i) => (
        <React.Fragment key={s.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px' }}>
            <s.icon size={13} color={s.color} />
            <span style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{s.value}</span>
            <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>{s.label}</span>
          </div>
          {i < stats.length - 1 && (
            <div style={{ width: 1, height: 20, background: LINE, flexShrink: 0 }} />
          )}
        </React.Fragment>
      ))}

      {/* Team score pill — pushed to right */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>Team completion</span>
        <span style={{
          fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 99,
          background: teamScore >= 70 ? '#16a34a18' : teamScore >= 40 ? '#d9770618' : '#dc262618',
          color:      teamScore >= 70 ? '#16a34a'   : teamScore >= 40 ? '#d97706'   : '#dc2626',
        }}>
          {teamScore}%
        </span>
      </div>
    </div>
  );
}