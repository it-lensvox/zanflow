import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { projectsApi, documentsApi, taskApi } from '@/services/api';
import { PROJECT_COLORS, getFileBadge } from '@/config/statusColors';
import type { Project, Document } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type TaskStatus = 'pending' | 'backlog' | 'in_progress' | 'completed' | 'deployed' | 'deferred' | 'review';
type MyTasksTab = 'upcoming' | 'in_progress' | 'overdue' | 'completed';

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

export const DATE_RANGE_LABELS: Record<string, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'all': 'All time',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getHour = () => new Date().getHours();
export const getGreeting = () =>
  getHour() < 12 ? 'Good morning' : getHour() < 18 ? 'Good afternoon' : 'Good evening';

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const { isActivityOpen, setIsActivityOpen } = useOutletContext<{
    isActivityOpen: boolean;
    setIsActivityOpen: (v: boolean) => void;
  }>();

  // ── UI State ──────────────────────────────────────────────────────────────
  const [myTasksTab, setMyTasksTab]               = useState<MyTasksTab>('upcoming');
  const [selectedMonth, setSelectedMonth]         = useState<{ year: number; month: number }>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [showChartMonthPicker, setShowChartMonthPicker] = useState(false);
  const [dateRange, setDateRange]                 = useState<'7d' | '30d' | '90d' | 'all'>('all');
  const [showRangePicker, setShowRangePicker]     = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc]               = useState<{ url: string; fileName: string; fileType: string } | null>(null);
  const [searchOpen, setSearchOpen]               = useState(false);
  const [searchQuery, setSearchQuery]             = useState('');

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Keyboard shortcut ─────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const { data: projectsData }  = useQuery({ queryKey: ['projects'],  queryFn: () => projectsApi.list() });
  const { data: documentsData } = useQuery({ queryKey: ['documents'], queryFn: () => documentsApi.list({ page_size: 200, page: 1 }) });
  const { data: tasksResponse } = useQuery({
    queryKey: ['tasks-dashboard'],
    queryFn: () => taskApi.list({ disable_pagination: true }),
  });

  // ── Raw Data ──────────────────────────────────────────────────────────────
  const projects     = (Array.isArray(projectsData) ? projectsData : projectsData?.results || []) as Project[];
  const documents    = (documentsData?.results || []) as Document[];
  const totalDocsCount = documentsData?.count || documents.length;
  const allTasks: DashboardTask[] = tasksResponse?.tasks || tasksResponse?.results || (Array.isArray(tasksResponse) ? tasksResponse : []);

  // ── Date Range Filter ─────────────────────────────────────────────────────
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

  // ── Summary Stats ─────────────────────────────────────────────────────────
  const now            = new Date();
  const totalProjects  = projects.length;
  const totalTasks     = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'completed' || t.status === 'deployed').length;
  const overdueTasks   = allTasks.filter(t => t.end_date && new Date(t.end_date) < now && t.status !== 'completed' && t.status !== 'deployed').length;
  const pendingTasks   = allTasks.filter(t => t.status === 'pending' || t.status === 'backlog').length;
  const completedPct   = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const overduePct     = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  // ── Donut Chart Data ──────────────────────────────────────────────────────
  const donut = [
    { label: 'In Progress', value: allTasks.filter(t => t.status === 'in_progress').length,                                                                                color: '#6366F1' },
    { label: 'Pending',     value: allTasks.filter(t => t.status === 'pending' || t.status === 'backlog').length,                                                          color: '#F59E0B' },
    { label: 'Completed',   value: allTasks.filter(t => t.status === 'completed' || t.status === 'deployed').length,                                                       color: '#22C55E' },
    { label: 'Overdue',     value: allTasks.filter(t => t.end_date && new Date(t.end_date) < now && t.status !== 'completed' && t.status !== 'deployed').length, color: '#EF4444' },
  ].filter(d => d.value > 0);
  const donutTotal = donut.reduce((s, d) => s + d.value, 0);

  // ── My Tasks ──────────────────────────────────────────────────────────────
  const myTasks     = allTasks.filter(t => user?.id && (t.assigned_to || []).some(id => String(id) === String(user.id)));
  const upcoming    = myTasks.filter(t => t.status !== 'completed' && t.status !== 'deployed' && t.status !== 'deferred' && (!t.end_date || new Date(t.end_date) >= now)).slice(0, 8);
  const inProgressMy = myTasks.filter(t => t.status === 'in_progress').slice(0, 8);
  const overdueMy   = myTasks.filter(t => t.end_date && new Date(t.end_date) < now && t.status !== 'completed' && t.status !== 'deployed').slice(0, 8);
  const completedMy = myTasks.filter(t => t.status === 'completed' || t.status === 'deployed').slice(0, 8);
  const tabTasks    = myTasksTab === 'upcoming' ? upcoming : myTasksTab === 'in_progress' ? inProgressMy : myTasksTab === 'overdue' ? overdueMy : completedMy;

  // ── Recent Activity ───────────────────────────────────────────────────────
  const recentActivity = [...documents]
    .sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime())
    .slice(0, 6);

  // ── Projects Overview ─────────────────────────────────────────────────────
  const projectsOverview = projects.slice(0, 5).map((p, i) => {
    const pt   = allTasks.filter(t => String((t as any).project) === String(p.id) || (t as any).project_details?.name === p.name || t.project_name === p.name);
    const done = pt.filter(t => t.status === 'completed' || t.status === 'deployed').length;
    const pct  = pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;
    const status = pct === 100 ? 'completed' : pt.some(t => t.status === 'in_progress') ? 'in_progress' : 'pending';
    const members = (p as any).members || [];
    return { ...p, taskCount: pt.length, pct, status, color: PROJECT_COLORS[i % PROJECT_COLORS.length], members };
  });

  // ── Line Chart ────────────────────────────────────────────────────────────
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
    { label: 'Completed',   color: '#22C55E', data: chartPoints.map(d => countByDay(d, t => t.status === 'completed' || t.status === 'deployed', true)) },
    {
      label: 'Overdue', color: '#EF4444', data: chartPoints.map(d => {
        const cutoff = new Date(selectedMonth.year, selectedMonth.month, d);
        return allTasks.filter(t => t.end_date && new Date(t.end_date) < cutoff && t.status !== 'completed' && t.status !== 'deployed').length;
      }),
    },
    { label: 'Pending', color: '#F59E0B', data: chartPoints.map(d => countByDay(d, t => t.status === 'pending' || t.status === 'backlog')) },
  ];

  // ── Search ────────────────────────────────────────────────────────────────
  const searchResults = searchQuery.trim().length < 2 ? [] : [
    ...projects
      .filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 3)
      .map(p => ({ type: 'Project', label: p.name, sub: (p as any).description || 'Project', onClick: () => { navigate('/projects'); setSearchOpen(false); setSearchQuery(''); } })),
    ...allTasks
      .filter(t => t.heading?.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 3)
      .map(t => ({ type: 'Task', label: t.heading, sub: (t as any).project_details?.name || 'Task', onClick: () => { navigate('/taskboard'); setSearchOpen(false); setSearchQuery(''); } })),
    ...documents
      .filter(d => d.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 3)
      .map(d => ({ type: 'Document', label: d.name, sub: 'Document', onClick: () => { handleDocumentClick(d); setSearchOpen(false); setSearchQuery(''); } })),
  ];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDocumentClick = async (doc: Document) => {
    try {
      const r = await documentsApi.getDownloadUrl(doc.project, { document_id: doc.id });
      setPreviewDoc({ url: r.url, fileName: doc.original_file_name || doc.name, fileType: doc.file_type });
    } catch (e) { console.error(e); }
  };

  const firstName = user?.first_name || user?.username || 'there';

  return {
    // auth / layout
    user, firstName, unreadCount, navigate,
    isActivityOpen, setIsActivityOpen,
    // search
    searchOpen, setSearchOpen, searchQuery, setSearchQuery, searchRef, searchResults,
    // modals
    isCreateProjectModalOpen, setIsCreateProjectModalOpen,
    previewDoc, setPreviewDoc,
    // filters
    dateRange, setDateRange, showRangePicker, setShowRangePicker,
    selectedMonth, setSelectedMonth, showChartMonthPicker, setShowChartMonthPicker,
    DATE_RANGE_LABELS, rangeStart, filteredDocs,
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
    handleDocumentClick, getFileBadge,
  };
}