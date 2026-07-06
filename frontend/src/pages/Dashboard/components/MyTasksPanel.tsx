import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { CARD, TEXT, MUTED, LINE, BLUE, BG, MY_TASKS_TABS, type MyTasksTabKey, SkeletonBlock } from '../index';
import type { DashboardTask } from '../hooks/useDashboard';


interface MyTasksPanelProps {
  myTasksTab: MyTasksTabKey;
  setMyTasksTab: (tab: MyTasksTabKey) => void;
  tabTasks: DashboardTask[];
  upcoming: DashboardTask[];
  inProgressMy: DashboardTask[];
  overdueMy: DashboardTask[];
  completedMy: DashboardTask[];
  navigate: (path: string) => void;
  isLoading?: boolean;
}

export function MyTasksPanel({
  myTasksTab,
  setMyTasksTab,
  tabTasks,
  upcoming,
  inProgressMy,
  overdueMy,
  completedMy,
  navigate,
  isLoading,
}: MyTasksPanelProps) {
  const countMap: Record<MyTasksTabKey, number> = {
    upcoming:    upcoming.length,
    in_progress: inProgressMy.length,
    overdue:     overdueMy.length,
    completed:   completedMy.length,
  };

  return (
    <div style={{ ...CARD, padding: '20px 22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>My Tasks</span>
        <Link to="/taskboard" style={{ fontSize: 13, fontWeight: 600, color: BLUE, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          View all <ArrowRight size={12} />
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${LINE}`, marginBottom: 4 }}>
        {MY_TASKS_TABS.map(tab => {
          const active = myTasksTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setMyTasksTab(tab.key)}
              style={{ flex: 1, padding: '8px 4px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'none', color: active ? BLUE : MUTED, borderBottom: active ? `2px solid ${BLUE}` : '2px solid transparent', marginBottom: -1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, whiteSpace: 'nowrap' }}
            >
              {tab.label}
              <span style={{ fontSize: 10, fontWeight: 700, background: active ? '#EEF2FF' : '#F3F4F6', color: active ? BLUE : '#9CA3AF', borderRadius: 12, padding: '1px 6px' }}>
                {countMap[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
         {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 28px', alignItems: 'center', gap: 12, padding: '14px 6px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={SkeletonBlock({ width: '70%', height: 14 })} />
                <div style={SkeletonBlock({ width: '30%', height: 11 })} />
              </div>
              <div style={SkeletonBlock({ width: 80, height: 24, borderRadius: 20 })} />
              <div style={SkeletonBlock({ width: 24, height: 24, borderRadius: '50%' })} />
            </div>
          ))}
        </div>
      ) : tabTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED, fontSize: 14 }}>
          No {myTasksTab.replace('_', ' ')} tasks
        </div>
      ) : (
        tabTasks.map(task => (
          <div
            key={task.id}
            onClick={() => navigate('/taskboard')}
            style={{ display: 'grid', gridTemplateColumns: '1fr 110px 28px', alignItems: 'center', gap: 12, padding: '11px 6px', borderBottom: `1px solid #F3F4F6`, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = BG)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Status circle */}
            {/* <div style={{ width: 17, height: 17, borderRadius: '50%', border: `2px solid ${task.status === 'completed' ? '#22C55E' : '#D1D5DB'}`, background: task.status === 'completed' ? '#22C55E' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {task.status === 'completed' && <CheckCircle size={10} color="#fff" strokeWidth={3} />}
            </div> */}

            {/* Title + project */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{task.heading}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{task.project_name || 'DYUKSA'}</div>
            </div>

            {/* Status badge */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <StatusBadge status={task.status} />
            </div>

            {/* Avatars */}
           <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {task.assigned_to_user_details?.length > 0 && (
                <AvatarStack
                  users={task.assigned_to_user_details.map(u => ({ name: u.first_name || u.username, avatar: u.avatar || null }))}
                  max={1}
                />
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}