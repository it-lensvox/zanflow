import React from 'react';
import { CheckCircle, Clock, ListTodo, TrendingUp, Loader2, Users } from 'lucide-react';
import type { TeamMember } from '../index';
import { StatCard } from './StatCard';
import { ProjectDistribution } from './ProjectDistribution';
import { RecentActivity } from './RecentActivity';
import { LINE, TEXT, MUTED, BLUE } from '@/config/tokens';

interface Props {
  member:      TeamMember | null;
  loadingPerf: boolean;
  perfError:   string | null;
}

export function MemberDetailPanel({ member, loadingPerf, perfError }: Props) {
  // ── Loading state ──────────────────────────────────────────────────────
  if (loadingPerf) {
    return (
      <div style={CENTER_STYLE}>
        <Loader2 size={28} className="animate-spin" color={BLUE} />
        <p style={{ fontSize: 13, color: MUTED, marginTop: 12 }}>Loading performance data…</p>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────
  if (perfError) {
    return (
      <div style={CENTER_STYLE}>
        <p style={{ fontSize: 13, color: '#ef4444' }}>{perfError}</p>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────
  if (!member || !member.performance) {
    return (
      <div style={CENTER_STYLE}>
        <Users size={36} color={MUTED} style={{ opacity: .3, marginBottom: 12 }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: '0 0 6px' }}>No member selected</p>
        <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Choose a team member from the list</p>
      </div>
    );
  }

  const p = member.performance;
  const score = p.total_tasks_count > 0
    ? Math.round((p.completed_tasks_count / p.total_tasks_count) * 100)
    : 0;

  const scoreColor = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626';

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px', background: 'hsl(var(--background))' }}>

      {/* ── Member profile header ── */}
      <div style={{
        background: 'hsl(var(--card))',
        border: `1px solid ${LINE}`,
        borderRadius: 16,
        padding: '22px 24px',
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>

          {/* Left: Avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 14,
              background: `${BLUE}18`, border: `2px solid ${BLUE}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800, color: BLUE, flexShrink: 0,
            }}>
              {member.initials}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, letterSpacing: '-.02em' }}>
                {member.first_name} {member.last_name}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: MUTED }}>{member.email}</p>
              <span style={{
                display: 'inline-flex', marginTop: 5,
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
                padding: '2px 8px', borderRadius: 5,
                background: `${BLUE}12`, color: BLUE,
              }}>
                {member.role}
              </span>
            </div>
          </div>

          {/* Right: Score ring */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 20px', borderRadius: 12,
            background: `${scoreColor}10`, border: `1px solid ${scoreColor}30`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={14} color={scoreColor} />
              <span style={{ fontSize: 28, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}%</span>
            </div>
            <span style={{ fontSize: 10, color: MUTED, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Completion Rate
            </span>
          </div>
        </div>

        {/* Overall progress bar */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Task Progress</span>
            <span style={{ fontSize: 11, color: MUTED }}>{p.completed_tasks_count} of {p.total_tasks_count} completed</span>
          </div>
          <div style={{ height: 8, background: 'hsl(var(--muted))', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99, transition: 'width .6s',
              width: `${score}%`,
              background: `linear-gradient(90deg, ${scoreColor}88, ${scoreColor})`,
            }} />
          </div>
        </div>
      </div>

      {/* ── 4-stat row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon={CheckCircle} label="Completed"  value={p.completed_tasks_count}  accent="#16a34a" />
        <StatCard icon={Clock}       label="In Progress" value={p.in_progress_tasks_count} accent="#d97706" />
        <StatCard icon={ListTodo}    label="Pending"     value={p.pending_tasks_count}     accent="#6366f1" />
        <StatCard icon={TrendingUp}  label="Total Tasks" value={p.total_tasks_count}       accent={BLUE}    />
      </div>

      {/* ── Project distribution + Recent activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="grid-cols-1 lg:grid-cols-2">
        <ProjectDistribution
          data={p.project_distribution || []}
          totalTasks={p.total_tasks_count}
        />
        <RecentActivity activities={p.recent_activity || []} />
      </div>
    </div>
  );
}

const CENTER_STYLE: React.CSSProperties = {
  flex: 1,
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  background: 'hsl(var(--background))',
  minHeight: 400,
};