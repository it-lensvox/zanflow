import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { BLUE, MUTED, INK, LINE, RED, card, formatDate, isOverdue } from '../myWorkConstants';
import { Avatar } from './shared';
import { StatusBadge } from '@/components/ui/StatusBadge';

export function AssignedToMe({ assignedToMe, isLoading }: { assignedToMe: any[]; isLoading: boolean }) {
  const navigate = useNavigate();

  return (
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
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--accent))')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
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
                {overdue ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#FEF2F2', color: RED, whiteSpace: 'nowrap' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: RED, flexShrink: 0 }} />
                    Overdue
                  </span>
                ) : (
                  <StatusBadge status={task.status} />
                )}
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
  );
}