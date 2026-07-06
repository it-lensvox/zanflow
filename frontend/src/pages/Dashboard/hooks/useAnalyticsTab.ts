import { useMemo } from 'react';
import { PROJECT_COLORS } from '@/config/statusColors';
import type { DashboardTask } from './useDashboard';
import type { Project } from '@/types';

export function useAnalyticsTab(
  allTasks: DashboardTask[],
  projects: Project[],
  selectedMonth: { year: number; month: number },
  chartSeries: any[],
  chartLabels: string[],
) {
  const now = new Date();

  // Summary metrics
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'completed' || t.status === 'deployed').length;
  const overdueTasks = allTasks.filter(t =>
    t.end_date && new Date(t.end_date) < now &&
    t.status !== 'completed' && t.status !== 'deployed'
  ).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Avg cycle time: average days from start_date to end_date for completed tasks
  const avgCycleTime = useMemo(() => {
    const completed = allTasks.filter(t =>
      (t.status === 'completed' || t.status === 'deployed') && t.start_date && t.end_date
    );
    if (completed.length === 0) return 0;
    const total = completed.reduce((sum, t) => {
      const diff = new Date(t.end_date).getTime() - new Date(t.start_date).getTime();
      return sum + diff / 86400000;
    }, 0);
    return Math.round((total / completed.length) * 10) / 10;
  }, [allTasks]);

  // Donut slices
  const donut = [
    { label: 'In Progress', value: allTasks.filter(t => t.status === 'in_progress').length, color: '#6366F1' },
    { label: 'Pending', value: allTasks.filter(t => t.status === 'pending' || t.status === 'backlog').length, color: '#F59E0B' },
    { label: 'Completed', value: completedTasks, color: '#22C55E' },
    { label: 'Overdue', value: overdueTasks, color: '#EF4444' },
  ].filter(d => d.value > 0);
  const donutTotal = donut.reduce((s, d) => s + d.value, 0);

  // Project leaderboard: % completion
  const leaderboard = useMemo(() => {
    return projects.map((p, i) => {
      const pt = allTasks.filter(t =>
        String((t as any).project) === String(p.id) ||
        (t as any).project_details?.name === p.name ||
        t.project_name === p.name
      );
      const done = pt.filter(t => t.status === 'completed' || t.status === 'deployed').length;
      const pct = pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        taskCount: pt.length,
        pct,
        color: PROJECT_COLORS[i % PROJECT_COLORS.length],
        members: (p as any).members || [],
      };
    })
      .filter(p => p.taskCount > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [projects, allTasks]);

  // Team throughput: tasks updated per day this week (Mon–Sun)
  const throughputData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    weekStart.setHours(0, 0, 0, 0);

    return days.map((label, i) => {
      const dayStart = new Date(weekStart.getTime() + i * 86400000);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const count = allTasks.filter(t => {
        const d = new Date(t.updated_at || t.created_at || '');
        return d >= dayStart && d < dayEnd;
      }).length;
      return { label, count };
    });
  }, [allTasks]);

  const totalThroughput = throughputData.reduce((s, d) => s + d.count, 0);

  return {
    totalTasks,
    completedTasks,
    overdueTasks,
    completionRate,
    avgCycleTime,
    donut,
    donutTotal,
    leaderboard,
    throughputData,
    totalThroughput,
    chartSeries,
    chartLabels,
    selectedMonth,
  };
}