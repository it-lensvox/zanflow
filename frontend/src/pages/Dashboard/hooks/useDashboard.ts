import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { dashboardApi, documentsApi } from '@/services/api';
import { getFileBadge, PROJECT_COLORS } from '@/config/statusColors';
import { DATE_RANGE_LABELS, getGreeting, type MyTasksTabKey } from '../index';
import type { Project, Document } from '@/types';

// ─── Types 
type TaskStatus =
  | 'pending' | 'backlog' | 'in_progress' | 'completed'
  | 'deployed' | 'deferred' | 'review';

export interface DashboardTask {
  id: number;
  heading: string;
  description: string;
  start_date: string;
  end_date: string;
  priority: string;
  project_name: string | null;
  project?: number;
  project_details?: { id: number; name: string };
  assigned_to: number[];
  assigned_to_user_details: Array<{
    id: number; username: string; first_name: string;
    last_name: string; email: string; role: string; avatar?: string | null;
  }>;
  status: TaskStatus;
  updated_at?: string;
  created_at?: string;
}

// ─── Hook 
export function useDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const { isActivityOpen, setIsActivityOpen } = useOutletContext<{
    isActivityOpen: boolean;
    setIsActivityOpen: (v: boolean) => void;
  }>();

  // ── UI State 
  const [myTasksTab, setMyTasksTab] = useState<MyTasksTabKey>('upcoming');
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [showChartMonthPicker, setShowChartMonthPicker] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('all');
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; fileType: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Keyboard shortcut 
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ── Data Fetching 
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: dashboardApi.getProjects,
  });
  const { data: documentsData, isLoading: documentsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => dashboardApi.getDocuments({ page_size: 200, page: 1 }),
  });
  const { data: tasksResponse, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-dashboard'],
    queryFn: dashboardApi.getTasks,
  });
  // ── Raw Data 
  const projects = (Array.isArray(projectsData) ? projectsData : projectsData?.results || []) as Project[];
  const documents = (documentsData?.results || []) as Document[];
  const totalDocsCount = documentsData?.count || documents.length;
  const allTasks: DashboardTask[] =
    tasksResponse?.tasks || tasksResponse?.results || (Array.isArray(tasksResponse) ? tasksResponse : []);

  // ── Date Range Filter 
  const rangeStart = useMemo(() => {
    if (dateRange === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90));
    return d;
  }, [dateRange]);

  const filteredDocs = rangeStart
    ? documents.filter((d: any) => {
      const dt = new Date(d.created_at || d.updated_at || '');
      return !isNaN(dt.getTime()) && dt >= rangeStart;
    })
    : documents;

  // ── Summary Stats 
  const now = new Date();
  const totalProjects = projects.length;
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'completed' || t.status === 'deployed').length;
  const overdueTasks = allTasks.filter(t =>
    t.end_date && new Date(t.end_date) < now &&
    t.status !== 'completed' && t.status !== 'deployed'
  ).length;
  const pendingTasks = allTasks.filter(t => t.status === 'pending' || t.status === 'backlog').length;
  const completedPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const overduePct = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  // ── Donut Chart 
  const donut = [
    { label: 'In Progress', value: allTasks.filter(t => t.status === 'in_progress').length, color: '#6366F1' },
    { label: 'Pending', value: allTasks.filter(t => t.status === 'pending' || t.status === 'backlog').length, color: '#F59E0B' },
    { label: 'Completed', value: allTasks.filter(t => t.status === 'completed' || t.status === 'deployed').length, color: '#22C55E' },
    { label: 'Overdue', value: allTasks.filter(t => t.end_date && new Date(t.end_date) < now && t.status !== 'completed' && t.status !== 'deployed').length, color: '#EF4444' },
  ].filter(d => d.value > 0);
  const donutTotal = donut.reduce((s, d) => s + d.value, 0);

  // ── My Tasks 
  const myTasks = allTasks.filter(t => user?.id && (t.assigned_to || []).some(id => String(id) === String(user.id)));
  const upcoming = myTasks.filter(t => t.status !== 'completed' && t.status !== 'deployed' && t.status !== 'deferred' && (!t.end_date || new Date(t.end_date) >= now)).slice(0, 8);
  const inProgressMy = myTasks.filter(t => t.status === 'in_progress').slice(0, 8);
  const overdueMy = myTasks.filter(t => t.end_date && new Date(t.end_date) < now && t.status !== 'completed' && t.status !== 'deployed').slice(0, 8);
  const completedMy = myTasks.filter(t => t.status === 'completed' || t.status === 'deployed').slice(0, 8);
  const tabTasks = myTasksTab === 'upcoming' ? upcoming : myTasksTab === 'in_progress' ? inProgressMy : myTasksTab === 'overdue' ? overdueMy : completedMy;

  // ── Recent Activity 
  const recentActivity = [...documents]
    .sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime())
    .slice(0, 6);

  // ── Projects Overview 
  const projectsOverview = projects.slice(0, 5).map((p, i) => {
    const pt = allTasks.filter(t =>
      String((t as any).project) === String(p.id) ||
      (t as any).project_details?.name === p.name ||
      t.project_name === p.name
    );
    const done = pt.filter(t => t.status === 'completed' || t.status === 'deployed').length;
    const pct = pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;
    const status = pct === 100 ? 'completed' : pt.some(t => t.status === 'in_progress') ? 'in_progress' : 'pending';
    return { ...p, taskCount: pt.length, pct, status, color: PROJECT_COLORS[i % PROJECT_COLORS.length], members: (p as any).members || [] };
  });

  // ── Line Chart 
  const daysInMonth = new Date(selectedMonth.year, selectedMonth.month + 1, 0).getDate();
  const chartPoints = Array.from({ length: 8 }, (_, i) => Math.round(1 + (i / 7) * (daysInMonth - 1)));
  const chartLabels = chartPoints.map(d => {
    const monthName = new Date(selectedMonth.year, selectedMonth.month, d).toLocaleString('en-US', { month: 'short' });
    return `${monthName} ${d}`;
  });

  const countByDay = (day: number, filter: (t: DashboardTask) => boolean, useDueDate = false) =>
    allTasks.filter(t => {
      const dateStr = useDueDate ? t.end_date : (t.created_at || t.updated_at || t.start_date);
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month && d.getDate() <= day && filter(t);
    }).length;

  const chartSeries = [
    { label: 'In Progress', color: '#6366F1', data: chartPoints.map(d => countByDay(d, t => t.status === 'in_progress')) },
    { label: 'Completed', color: '#22C55E', data: chartPoints.map(d => countByDay(d, t => t.status === 'completed' || t.status === 'deployed', true)) },
    {
      label: 'Overdue', color: '#EF4444', data: chartPoints.map(d => {
        const cutoff = new Date(selectedMonth.year, selectedMonth.month, d);
        return allTasks.filter(t => t.end_date && new Date(t.end_date) < cutoff && t.status !== 'completed' && t.status !== 'deployed').length;
      }),
    },
    { label: 'Pending', color: '#F59E0B', data: chartPoints.map(d => countByDay(d, t => t.status === 'pending' || t.status === 'backlog')) },
  ];

  // ── Document preview handler
  const handleDocumentClick = async (doc: Document) => {
    try {
      const r = await documentsApi.getDownloadUrl(doc.project, { document_id: doc.id });
      setPreviewDoc({ url: r.url, fileName: doc.original_file_name || doc.name, fileType: doc.file_type });
    } catch (e) { console.error(e); }
  };

  const firstName = user?.first_name || user?.username || 'there';

  return {
    // loading states 
    projectsLoading,
    documentsLoading,
    tasksLoading,
    // auth / layout
    user, firstName, unreadCount, navigate,
    isActivityOpen, setIsActivityOpen,
    // search
    searchOpen, setSearchOpen, searchRef,
    // modals
    isCreateProjectModalOpen, setIsCreateProjectModalOpen,
    previewDoc, setPreviewDoc,
    // filters
    dateRange, setDateRange, showRangePicker, setShowRangePicker,
    selectedMonth, setSelectedMonth, showChartMonthPicker, setShowChartMonthPicker,
    DATE_RANGE_LABELS, filteredDocs,
    // stats
    totalProjects, totalDocsCount, totalTasks, completedTasks, overdueTasks,
    pendingTasks, completedPct, overduePct,
    // chart data
    donut, donutTotal, chartSeries, chartLabels,
    // task lists
    myTasksTab, setMyTasksTab, upcoming, inProgressMy, overdueMy, completedMy, tabTasks,
    // lists
    recentActivity, projectsOverview,
    // helpers
    handleDocumentClick, getFileBadge, getGreeting,
  };
}