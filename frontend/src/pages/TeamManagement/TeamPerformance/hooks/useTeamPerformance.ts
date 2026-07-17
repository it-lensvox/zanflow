import { useState, useCallback, useEffect } from 'react';
import { usersApi, taskApi } from '@/services/api';
import type { TeamMember, UserPerformance } from '../index';

function getInitials(first: string, last: string): string {
  return `${(first?.[0] || '').toUpperCase()}${(last?.[0] || '').toUpperCase()}`;
}

export function useTeamPerformance() {
  const [members,          setMembers]          = useState<TeamMember[]>([]);
  const [selectedMember,   setSelectedMember]   = useState<TeamMember | null>(null);
  const [loadingMembers,   setLoadingMembers]   = useState(true);
  const [loadingPerf,      setLoadingPerf]      = useState(false);
  const [perfError,        setPerfError]        = useState<string | null>(null);

  // ── Load all users ──────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const apiUsers = await usersApi.listAll();
      const mapped: TeamMember[] = apiUsers.map((u: any) => ({
        id:          u.id,
        username:    u.username,
        first_name:  u.first_name || '',
        last_name:   u.last_name  || '',
        email:       u.email      || '',
        role:        u.role       || 'member',
        initials:    getInitials(u.first_name || '', u.last_name || ''),
        performance: null,
      }));
      setMembers(mapped);
      if (mapped.length > 0) {
        setSelectedMember(mapped[0]);
        fetchPerformance(mapped[0].id, mapped);
      }
    } catch (err) {
      console.error('[useTeamPerformance] fetchMembers error:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  // ── Load single user performance ────────────────────────────────────────
  const fetchPerformance = useCallback(async (userId: number, currentMembers?: TeamMember[]) => {
    setLoadingPerf(true);
    setPerfError(null);
    try {
      const perf: UserPerformance = await taskApi.getPerformance(userId);

      const update = (list: TeamMember[]) =>
        list.map(m => m.id === userId ? { ...m, performance: perf } : m);

      setMembers(prev => update(currentMembers || prev));
      setSelectedMember(prev =>
        prev?.id === userId ? { ...prev, performance: perf } : prev
      );
    } catch (err) {
      console.error('[useTeamPerformance] fetchPerformance error:', err);
      setPerfError('Failed to load performance data.');
    } finally {
      setLoadingPerf(false);
    }
  }, []);

  // ── Select member ───────────────────────────────────────────────────────
  const selectMember = useCallback((member: TeamMember) => {
    setSelectedMember(member);
    if (!member.performance) {
      fetchPerformance(member.id);
    }
  }, [fetchPerformance]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ── Derived totals across all loaded members ────────────────────────────
  const teamTotals = members.reduce(
    (acc, m) => {
      const p = m.performance;
      if (!p) return acc;
      acc.total     += p.total_tasks_count;
      acc.completed += p.completed_tasks_count;
      acc.inProgress+= p.in_progress_tasks_count;
      acc.pending   += p.pending_tasks_count;
      return acc;
    },
    { total: 0, completed: 0, inProgress: 0, pending: 0 }
  );

  return {
    members,
    selectedMember,
    loadingMembers,
    loadingPerf,
    perfError,
    selectMember,
    teamTotals,
  };
}