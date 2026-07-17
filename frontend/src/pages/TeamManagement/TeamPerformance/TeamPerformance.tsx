import { Loader2 } from 'lucide-react';
import { useTeamPerformance }  from './hooks/useTeamPerformance';
import { MemberSidebar }       from './components/MemberSidebar';
import { MemberDetailPanel }   from './components/MemberDetailPanel';
import { TeamOverviewBar }     from './components/TeamOverviewBar';
import { TEXT, MUTED, LINE, BLUE } from '@/config/tokens';

export function TeamPerformance() {
  const {
    members, selectedMember,
    loadingMembers, loadingPerf, perfError,
    selectMember, teamTotals,
  } = useTeamPerformance();

  // ── Full-page loader 
  if (loadingMembers) {
    return (
      <div
        className="flex items-center justify-center min-h-[500px]"
        style={{ background: 'hsl(var(--background))' }}
      >
        <Loader2 size={28} className="animate-spin" color={BLUE} />
        <span style={{ fontSize: 13, color: MUTED, marginLeft: 12 }}>Loading team…</span>
      </div>
    );
  }

  return (
    <div
      className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6 pb-8"
      style={{ background: 'hsl(var(--background))', minHeight: '100vh' }}
    >
      {/* ── Page header ── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: TEXT, letterSpacing: '-.02em' }}>
          Team Performance
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: MUTED }}>
          Monitor individual productivity and team-wide progress
        </p>
      </div>

      {/* ── Main panel ── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        borderRadius: 16,
        border: `1px solid ${LINE}`,
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,.07)',
        minHeight: 600,
      }}>
        {/* Overview strip */}
        <TeamOverviewBar
          memberCount={members.length}
          total={teamTotals.total}
          completed={teamTotals.completed}
          inProgress={teamTotals.inProgress}
          pending={teamTotals.pending}
        />

        {/* Content: sidebar + detail */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <MemberSidebar
            members={members}
            selectedId={selectedMember?.id ?? null}
            loadingPerf={loadingPerf}
            onSelect={selectMember}
          />
          <MemberDetailPanel
            member={selectedMember}
            loadingPerf={loadingPerf}
            perfError={perfError}
          />
        </div>
      </div>
    </div>
  );
}