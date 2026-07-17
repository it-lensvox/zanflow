import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CARD, TEXT, MUTED, LINE, BLUE, BG, SkeletonBlock } from '../index';

interface ProjectOverview {
  id: number;
  name: string;
  color: string;
  taskCount: number;
  pct: number;
  status: string;
  members: any[];
  description?: string;
}

interface ProjectsOverviewTableProps {
  projectsOverview: ProjectOverview[];
  navigate: (path: string) => void;
  isLoading?: boolean;
}

const COLUMNS = ['PROJECT', 'TASKS', 'PROGRESS', 'TEAM', 'STATUS'];
const GRID = '2fr 80px 1.2fr 90px 120px';

export function ProjectsOverviewTable({ projectsOverview, navigate, isLoading }: ProjectsOverviewTableProps) {
  return (
    <div style={{ ...CARD, padding: '20px 22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Projects Overview</span>
        <Link to="/projects" style={{ fontSize: 13, fontWeight: 600, color: BLUE, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          All projects <ArrowRight size={12} />
        </Link>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: 560 }}>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, padding: '0 6px 10px', borderBottom: `1px solid ${LINE}` }}>
            {COLUMNS.map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>

          {/* Skeleton / Empty / Data */}
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, padding: '14px 6px', borderBottom: '1px solid hsl(var(--border))', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={SkeletonBlock({ width: 28, height: 28, borderRadius: 7, style: { flexShrink: 0 } })} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={SkeletonBlock({ width: '60%', height: 14 })} />
                      <div style={SkeletonBlock({ width: '40%', height: 11 })} />
                    </div>
                  </div>
                  <div style={SkeletonBlock({ width: 32, height: 14 })} />
                  <div style={SkeletonBlock({ width: '80%', height: 6, borderRadius: 4 })} />
                  <div style={{ display: 'flex', gap: 0 }}>
                    {[1, 2, 3].map(j => <div key={j} style={SkeletonBlock({ width: 24, height: 24, borderRadius: '50%', style: { marginLeft: j > 1 ? -7 : 0 } })} />)}
                  </div>
                  <div style={SkeletonBlock({ width: 70, height: 22, borderRadius: 20 })} />
                </div>
              ))}
            </>
          ) : projectsOverview.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: MUTED, fontSize: 14 }}>
              No projects yet
            </div>
          ) : (
            projectsOverview.map((p, i) => (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, padding: '12px 6px', borderBottom: i < projectsOverview.length - 1 ? '1px solid hsl(var(--border))' : 'none', cursor: 'pointer', borderRadius: 8, alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.background = BG)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Project name + avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {(p.name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{p.description?.slice(0, 28) || 'No description'}</div>
                  </div>
                </div>

                {/* Task count */}
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{p.taskCount}</div>

                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ProgressBar pct={p.pct} color={p.color} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, flexShrink: 0, width: 32, textAlign: 'right' }}>{p.pct}%</span>
                </div>

                {/* Team avatars */}
                <AvatarStack
                  users={p.members.map((m: any) => ({ name: m.user?.first_name || m.user?.username || '?', avatar: m.user?.avatar || m.avatar || null }))}
                  max={3}
                />

                {/* Status */}
                <StatusBadge status={p.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}