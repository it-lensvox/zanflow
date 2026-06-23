import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FolderKanban, FileText, CheckCircle, ArrowRight,
  Search, Plus, Bell, TrendingUp, TrendingDown,
  AlertTriangle, ChevronDown, Calendar
} from 'lucide-react';
import { projectsApi, documentsApi, taskApi } from '@/services/api';
import { formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import type { Project, Document } from '@/types';
import { NotificationsPage } from './NotificationsPage';
import { CreateProjectModal } from '@/pages/Project/CreateProjectModal';
import { useNotifications } from '@/hooks/useNotifications';
import { DocumentPreview } from '@/components/common/DocumentPreview';
import { useOutletContext } from 'react-router-dom';
import { QuickCreateButton } from '@/components/QuickCreateButton';

type TaskStatus = 'pending' | 'backlog' | 'in_progress' | 'completed' | 'deployed' | 'deferred' | 'review';
type MyTasksTab = 'upcoming' | 'in_progress' | 'overdue' | 'completed';
interface Task {
  id: number; heading: string; description: string; start_date: string; end_date: string;
  priority: string; project_name: string | null; project?: number; project_details?: { id: number; name: string }; assigned_to: number[];
  assigned_to_user_details: Array<{ id: number; username: string; first_name: string; last_name: string; email: string; role: string; avatar?: string | null }>;
  status: TaskStatus; updated_at?: string; created_at?: string;
}

const getHour = () => new Date().getHours();
const getGreeting = () => getHour() < 12 ? 'Good morning' : getHour() < 18 ? 'Good afternoon' : 'Good evening';

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: '#FFF9EC', text: '#B45309', dot: '#F59E0B' },
  backlog: { bg: '#FFF4ED', text: '#C2410C', dot: '#F97316' },
  in_progress: { bg: '#EEF2FF', text: '#4338CA', dot: '#6366F1' },
  completed: { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  deployed: { bg: '#F5F3FF', text: '#7C3AED', dot: '#A78BFA' },
  deferred: { bg: '#F9FAFB', text: '#6B7280', dot: '#9CA3AF' },
  review: { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
};

const PROJECT_COLORS = ['#1663F6', '#22C55E', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

const FILE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  pdf: { label: 'PDF', bg: '#FEE2E2', color: '#DC2626' },
  docx: { label: 'DOC', bg: '#DBEAFE', color: '#1D4ED8' },
  doc: { label: 'DOC', bg: '#DBEAFE', color: '#1D4ED8' },
  xlsx: { label: 'XLS', bg: '#DCFCE7', color: '#16A34A' },
  xls: { label: 'XLS', bg: '#DCFCE7', color: '#16A34A' },
  pptx: { label: 'PPT', bg: '#FFEDD5', color: '#EA580C' },
  ppt: { label: 'PPT', bg: '#FFEDD5', color: '#EA580C' },
  png: { label: 'IMG', bg: '#F3E8FF', color: '#7C3AED' },
  jpg: { label: 'IMG', bg: '#F3E8FF', color: '#7C3AED' },
  jpeg: { label: 'IMG', bg: '#F3E8FF', color: '#7C3AED' },
};
function getFileBadge(name: string) {
  const ext = (name || '').split('.').pop()?.toLowerCase() || '';
  return FILE_BADGE[ext] || { label: 'FILE', bg: '#F3F4F6', color: '#6B7280' };
}

function Sparkline({ color = '#1663F6', data }: { color?: string; data: number[] }) {
  const W = 260; const H = 48;
  const max = Math.max(...data); const min = Math.min(...data);
  const range = (max - min) || 1;
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => [i * step, H - ((v - min) / range) * (H - 4) - 2]);
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${d} L${W},${H} L0,${H} Z`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <path d={area} fill={color} opacity="0.13" />
      <path d={d} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Donut
function DonutChart({ data, total }: { data: Array<{ label: string; value: number; color: string }>; total: number }) {
  const R = 72; const r = 50; const cx = 82; const cy = 82;

  if (total === 0) return (
    <svg width={164} height={164} viewBox="0 0 164 164" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={R} fill="#E5E7EB" />
      <circle cx={cx} cy={cy} r={r} fill="white" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={28} fontWeight="800" fill="#9CA3AF">0</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="#9CA3AF">Total Tasks</text>
    </svg>
  );

  let cum = 0;
  function arc(s: number, pct: number) {
    if (pct >= 0.999) {
      // Draw as two semicircle arcs to avoid degenerate full-circle path
      return [
        `M${cx} ${cy - R}`,
        `A${R} ${R} 0 0 1 ${cx} ${cy + R}`,
        `A${R} ${R} 0 0 1 ${cx} ${cy - R}`,
        `L${cx} ${cy - r}`,
        `A${r} ${r} 0 0 0 ${cx} ${cy + r}`,
        `A${r} ${r} 0 0 0 ${cx} ${cy - r}`,
        'Z'
      ].join(' ');
    }
    const a1 = s * Math.PI * 2 - Math.PI / 2;
    const a2 = (s + pct) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + R * Math.cos(a1); const y1 = cy + R * Math.sin(a1);
    const x2 = cx + R * Math.cos(a2); const y2 = cy + R * Math.sin(a2);
    const ix1 = cx + r * Math.cos(a2); const iy1 = cy + r * Math.sin(a2);
    const ix2 = cx + r * Math.cos(a1); const iy2 = cy + r * Math.sin(a1);
    return `M${x1} ${y1} A${R} ${R} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2} ${y2} L${ix1} ${iy1} A${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 0 ${ix2} ${iy2}Z`;
  }

  const inflated = data.map(d => Math.max(d.value / total, 0.03));
  const inflatedSum = inflated.reduce((a, b) => a + b, 0);
  const normalized = inflated.map(v => v / inflatedSum);
  const slices = data.map((d, i) => { const start = cum; cum += normalized[i]; return { ...d, start, pct: normalized[i] }; });

  return (
    <svg width={164} height={164} viewBox="0 0 164 164" style={{ flexShrink: 0 }}>
      {slices.map((s, i) => s.pct > 0 ? <path key={i} d={arc(s.start, s.pct)} fill={s.color} fillRule="evenodd" /> : null)}
      <circle cx={cx} cy={cy} r={r - 2} fill="white" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={28} fontWeight="800" fill="#172033">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="#667085">Total Tasks</text>
    </svg>
  );
}

function LineChart({ series, labels }: { series: Array<{ label: string; color: string; data: number[] }>; labels?: string[] }) {
  const W = 620; const H = 210;
  const allMax = Math.max(...series.flatMap(s => s.data), 1);
  const n = series[0]?.data.length || 8;
  const step = W / (n - 1);
  const px = (i: number) => i * step;
  const py = (v: number) => H - (v / allMax) * (H - 20) - 16;
  const xLabels = labels || Array.from({ length: n }, (_, i) => `Day ${i + 1}`);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((g, i) => (
          <line key={i} x1="0" x2={W} y1={py(allMax * g)} y2={py(allMax * g)} stroke="#E6EBF2" strokeWidth="1" />
        ))}
        {/* Lines */}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => `${px(i)},${py(v)}`).join(' ');
          return <polyline key={si} fill="none" stroke={s.color} strokeWidth="2" points={pts} strokeLinecap="round" strokeLinejoin="round" />;
        })}
        {/* Dots */}
        {series.map((s, si) => s.data.map((v, i) => (
          <circle key={`${si}-${i}`} cx={px(i)} cy={py(v)} r="3.5" fill={s.color} />
        )))}
      </svg>
      {/* X labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', padding: '4px 2px 0' }}>
        {xLabels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 6, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4 }} />
    </div>
  );
}

function AvatarStack({ users, max = 3 }: { users: Array<{ name: string; avatar?: string | null }>; max?: number }) {
  const colors = ['#1663F6', '#22C55E', '#8B5CF6', '#F59E0B', '#EF4444'];
  return (
    <div style={{ display: 'flex' }}>
      {users.slice(0, max).map((u, i) => (
        <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff', marginLeft: i === 0 ? 0 : -7, background: u.avatar ? 'transparent' : colors[i % colors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', position: 'relative', zIndex: max - i, overflow: 'hidden' }}>
          {u.avatar
            ? <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            : u.name?.[0]?.toUpperCase() || '?'
          }
        </div>
      ))}
      {users.length > max && (
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff', marginLeft: -7, background: '#E5E7EB', fontSize: 9, fontWeight: 700, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+{users.length - max}</div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/[\s-]/g, '_');
  const cfg = STATUS_COLORS[key] || STATUS_COLORS.deferred;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.text, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E6EBF2', borderRadius: 12, boxShadow: '0 1px 3px rgba(16,24,40,.05)' };
const monthBtn: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: '#344054', background: '#fff', border: '1px solid #E6EBF2', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 };

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { unreadCount } = useNotifications();
  const { isActivityOpen, setIsActivityOpen } = useOutletContext<{ isActivityOpen: boolean; setIsActivityOpen: (v: boolean) => void }>();

  const [myTasksTab, setMyTasksTab] = useState<MyTasksTab>('upcoming');
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [showChartMonthPicker, setShowChartMonthPicker] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('all');
  const [showRangePicker, setShowRangePicker] = useState(false);

  const DATE_RANGE_LABELS = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', 'all': 'All time' };

  const rangeStart = useMemo(() => {
    if (dateRange === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90));
    return d;
  }, [dateRange]);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; fileType: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const { data: projectsData } = useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() });
  const { data: documentsData } = useQuery({ queryKey: ['documents'], queryFn: () => documentsApi.list({ page_size: 200, page: 1 }) });
  const { data: tasksResponse } = useQuery({
    queryKey: ['tasks-dashboard'],
    queryFn: () => taskApi.list({ disable_pagination: true })
  });
  const projects = (Array.isArray(projectsData) ? projectsData : projectsData?.results || []) as Project[];
  const documents = (documentsData?.results || []) as Document[];
  const totalDocsCount = documentsData?.count || documents.length;
  const allTasks: Task[] = tasksResponse?.tasks || tasksResponse?.results || (Array.isArray(tasksResponse) ? tasksResponse : []);
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

  const typeColor: Record<string, string> = {
    Project: '#1663F6', Task: '#8B5CF6', Document: '#22C55E'
  };

  const totalProjects = projects.length;
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'completed' || t.status === 'deployed').length;
  const now = new Date();
  const overdueTasks = allTasks.filter(t => t.end_date && new Date(t.end_date) < now && t.status !== 'completed' && t.status !== 'deployed').length;


  const tasksByStatus = [
    { label: 'In Progress', value: allTasks.filter(t => t.status === 'in_progress').length, color: '#6366F1' },
    { label: 'Pending', value: allTasks.filter(t => t.status === 'pending' || t.status === 'backlog').length, color: '#F59E0B' },
    { label: 'Completed', value: allTasks.filter(t => t.status === 'completed' || t.status === 'deployed').length, color: '#22C55E' },
    { label: 'Overdue', value: allTasks.filter(t => t.end_date && new Date(t.end_date) < now && t.status !== 'completed' && t.status !== 'deployed').length, color: '#EF4444' },
  ].filter(d => d.value > 0);

  const donut = tasksByStatus.length > 0 ? tasksByStatus : [
    { label: 'In Progress', value: allTasks.filter(t => t.status === 'in_progress').length, color: '#6366F1' },
    { label: 'Pending', value: allTasks.filter(t => t.status === 'pending' || t.status === 'backlog').length, color: '#F59E0B' },
    { label: 'Completed', value: allTasks.filter(t => t.status === 'completed' || t.status === 'deployed').length, color: '#22C55E' },
    { label: 'Overdue', value: allTasks.filter(t => t.end_date && new Date(t.end_date) < now && t.status !== 'completed' && t.status !== 'deployed').length, color: '#EF4444' },
  ].filter(d => d.value > 0);
  const donutTotal = donut.reduce((s, d) => s + d.value, 0);

  const myTasks = allTasks.filter(t => user?.id && (t.assigned_to || []).some(id => String(id) === String(user.id)));
  const upcoming = myTasks.filter(t => t.status !== 'completed' && t.status !== 'deployed' && t.status !== 'deferred' && (!t.end_date || new Date(t.end_date) >= now)).slice(0, 8);
  const inProgressMy = myTasks.filter(t => t.status === 'in_progress').slice(0, 8);
  const overdueMy = myTasks.filter(t => t.end_date && new Date(t.end_date) < now && t.status !== 'completed' && t.status !== 'deployed').slice(0, 8);
  const completedMy = myTasks.filter(t => t.status === 'completed' || t.status === 'deployed').slice(0, 8);
  const tabTasks = myTasksTab === 'upcoming' ? upcoming : myTasksTab === 'in_progress' ? inProgressMy : myTasksTab === 'overdue' ? overdueMy : completedMy;

  const recentActivity = [...documents].sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime()).slice(0, 6);

  const projectsOverview = projects.slice(0, 5).map((p, i) => {
    const pt = allTasks.filter(t =>
      String((t as any).project) === String(p.id) ||
      (t as any).project_details?.name === p.name ||
      t.project_name === p.name
    );
    const done = pt.filter(t => t.status === 'completed' || t.status === 'deployed').length;
    const pct = pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;
    const status = pct === 100 ? 'completed' : pt.some(t => t.status === 'in_progress') ? 'in_progress' : 'pending';
    const members = (p as any).members || [];
    return { ...p, taskCount: pt.length, pct, status, color: PROJECT_COLORS[i % PROJECT_COLORS.length], members };
  });

  const pendingTasks = allTasks.filter(t => t.status === 'pending' || t.status === 'backlog').length;
  const completedPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const overduePct = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;


  const filteredDocs = rangeStart
    ? documents.filter((d: any) => {
      const dt = new Date(d.created_at || d.updated_at || '');
      return !isNaN(dt.getTime()) && dt >= rangeStart;
    })
    : documents;

  const daysInMonth = new Date(selectedMonth.year, selectedMonth.month + 1, 0).getDate();
  const points = Array.from({ length: 8 }, (_, i) => Math.round(1 + (i / 7) * (daysInMonth - 1)));
  const chartLabels = points.map(d => {
    const monthName = new Date(selectedMonth.year, selectedMonth.month, d).toLocaleString('en-US', { month: 'short' });
    return `${monthName} ${d}`;
  });


  const countByDay = (day: number, filter: (t: Task) => boolean, useDueDate = false) =>
    allTasks.filter(t => {
      const dateStr = useDueDate ? t.end_date : (t.created_at || t.updated_at || t.start_date);
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month && d.getDate() <= day && filter(t);
    }).length;
  const chartSeries = [
    { label: 'In Progress', color: '#6366F1', data: points.map(d => countByDay(d, t => t.status === 'in_progress')) },
    { label: 'Completed', color: '#22C55E', data: points.map(d => countByDay(d, t => t.status === 'completed' || t.status === 'deployed', true)) },
    {
      label: 'Overdue', color: '#EF4444', data: points.map(d => {
        const cutoff = new Date(selectedMonth.year, selectedMonth.month, d);
        return allTasks.filter(t => t.end_date && new Date(t.end_date) < cutoff && t.status !== 'completed' && t.status !== 'deployed').length;
      })
    },
    { label: 'Pending', color: '#F59E0B', data: points.map(d => countByDay(d, t => t.status === 'pending' || t.status === 'backlog')) },
  ];

  const handleDocumentClick = async (doc: Document) => {
    try {
      const r = await documentsApi.getDownloadUrl(doc.project, { document_id: doc.id });
      setPreviewDoc({ url: r.url, fileName: doc.original_file_name || doc.name, fileType: doc.file_type });
    } catch (e) { console.error(e); }
  };

  const firstName = user?.first_name || user?.username || 'there';



  return (
    <div style={{ width: '100%', background: '#F7F8FB', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}>

      {searchOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
          onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
          <div style={{ width: 560, background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.18)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

            {/* Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #E6EBF2' }}>
              <Search size={17} color="#9CA3AF" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search projects, tasks, documents…"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#172033', background: 'transparent' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 20, lineHeight: 1 }}>×</button>
              )}
              <kbd style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>ESC</kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {searchQuery.trim().length < 2 ? (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ padding: '6px 18px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>QUICK LINKS</div>
                  {[
                    { label: 'Projects', path: '/projects' },
                    { label: 'My Tasks', path: '/taskboard' },
                    { label: 'Documents', path: '/documents' },
                    { label: 'Calendar', path: '/calendar' },
                  ].map(item => (
                    <div key={item.label}
                      style={{ padding: '10px 18px', fontSize: 13, color: '#344054', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                      onClick={() => { setSearchOpen(false); setSearchQuery(''); navigate(item.path); }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <ArrowRight size={13} color="#9CA3AF" /> {item.label}
                    </div>
                  ))}
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: '32px 18px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  No results for "<strong>{searchQuery}</strong>"
                </div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ padding: '6px 18px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>RESULTS</div>
                  {searchResults.map((r, i) => (
                    <div key={i} onClick={r.onClick}
                      style={{ padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: `${typeColor[r.type]}15`, color: typeColor[r.type], flexShrink: 0 }}>{r.type}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.label}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{r.sub}</div>
                      </div>
                      <ArrowRight size={13} color="#D1D5DB" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Fixed Greeting Bar ─── */}
      <div
        className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 25,
          background: '#F7F8FB',
          paddingTop: 16,
          paddingBottom: 16,
          borderBottom: '1px solid #E6EBF2',
        }}
      >
        {/* ── Row 1: Greeting + actions ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          {/* On mobile */}
          <div className="pl-12 sm:pl-0">
            <div style={{ fontSize: 26, fontWeight: 800, color: '#172033', letterSpacing: '-0.02em' }}>{getGreeting()}, {firstName}</div>
            <div style={{ fontSize: 13, color: '#667085', marginTop: 4 }}>Here's what's happening with your workspace today.</div>
          </div>
          <div className="flex items-center flex-wrap gap-2" style={{ padding: '4px 0' }}>
            <button onClick={() => setSearchOpen(true)} className="hidden sm:flex" style={{ ...monthBtn, minWidth: 180, gap: 8 }}>
              <Search size={13} color="#667085" /> Search anything… <kbd style={{ marginLeft: 'auto', background: '#F3F4F6', border: '1px solid #E3E8EF', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 700, color: '#6B7280' }}>⌘K</kbd>
            </button>
            <div style={{ position: 'relative' }}>
              {/* close on outside click */}
              {showRangePicker && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowRangePicker(false)} />
              )}
              <button
                onClick={() => setShowRangePicker(v => !v)}
                style={{
                  ...monthBtn,         // Spread first!
                  padding: '4px 8px',   // This will now successfully override monthBtn's padding
                  gap: 6
                }}
              >
                <Calendar size={13} color="#667085" />
                {DATE_RANGE_LABELS[dateRange]}
                <ChevronDown size={11} color="#667085" />
              </button>
              {showRangePicker && (
                <div style={{ position: 'absolute', top: 42, right: 0, background: '#fff', border: '1px solid #E6EBF2', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.10)', zIndex: 50, overflow: 'hidden', minWidth: 160 }}>
                  {(Object.entries(DATE_RANGE_LABELS) as [typeof dateRange, string][]).map(([val, label]) => (
                    <button key={val} onClick={() => { setDateRange(val); setShowRangePicker(false); }} style={{
                      width: '100%', padding: '9px 14px', border: 'none',
                      background: dateRange === val ? '#EEF4FF' : '#fff',
                      color: dateRange === val ? '#1663F6' : '#172033',
                      fontSize: 13, fontWeight: dateRange === val ? 700 : 500,
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    }}>{label}</button>
                  ))}
                </div>
              )}
            </div>
            {/* <button onClick={() => setIsCreateProjectModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 18px', background: '#1663F6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff' }}>
              <Plus size={14} /> New project
            </button> */}
            <button onClick={() => setIsActivityOpen(!isActivityOpen)} style={{ position: 'relative', width: 36, height: 36, border: '1px solid #E6EBF2', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={15} color="#344054" />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: '#EF4444', borderRadius: '50%', fontSize: 9, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            <QuickCreateButton />
          </div>
        </div>
      </div>{ }

      {/* ─── Scrollable content below greeting ─── */}
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6" style={{ paddingBottom: 24 }}>

        {/* ── Row 2: Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          {[
            { label: 'Total Projects', value: totalProjects, change: `${totalProjects} total`, up: true, color: '#1663F6', icon: <FolderKanban size={16} color="#1663F6" />, sub: `${projects.filter((p: any) => p.is_active).length || totalProjects} active`, sparkData: [2, 3, 4, 5, 6, 7, 8, totalProjects || 9] },
            { label: 'Total Documents', value: totalDocsCount, change: dateRange === 'all' ? `${totalDocsCount} total` : `${filteredDocs.length} in period`, up: true, color: '#22C55E', icon: <FileText size={16} color="#22C55E" />, sub: dateRange === 'all' ? 'all time' : DATE_RANGE_LABELS[dateRange], sparkData: [10, 15, 20, 30, 35, 40, 50, totalDocsCount || 1] },
            { label: 'Total Tasks', value: totalTasks, change: `${pendingTasks} pending`, up: true, color: '#F59E0B', icon: <CheckCircle size={16} color="#F59E0B" />, sub: `Across ${totalProjects} projects`, sparkData: [1, 2, 3, 4, 5, 6, 7, totalTasks || 9] },
            { label: 'Completed', value: completedTasks, change: `${completedPct}% done`, up: true, color: '#8B5CF6', icon: <CheckCircle size={16} color="#8B5CF6" />, sub: `On time: ${Math.max(completedTasks - 1, 0)}`, sparkData: [0, 1, 1, 2, 2, 2, 3, completedTasks || 3] },
            { label: 'Overdue Tasks', value: overdueTasks, change: `${overduePct}% of total`, up: overdueTasks === 0, color: '#EF4444', icon: <AlertTriangle size={16} color="#EF4444" />, sub: `vs. total tasks`, sparkData: [5, 5, 4, 4, 3, 3, 3, overdueTasks || 2] },
          ].map((c, i) => (
            <div key={i} style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* icon + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${c.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#667085' }}>{c.label}</span>
              </div>
              {/* big number */}
              <div style={{ fontSize: 32, fontWeight: 800, color: '#172033', lineHeight: 1, marginBottom: 4 }}>{c.value}</div>
              {/* trend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                {c.up ? <TrendingUp size={11} color="#22C55E" /> : <TrendingDown size={11} color="#EF4444" />}
                <span style={{ fontSize: 11, fontWeight: 700, color: c.up ? '#22C55E' : '#EF4444' }}>{c.change}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.sub}</span>
              </div>
              {/* sparkline — flush to bottom */}
              <div style={{ margin: '0 -18px -16px', overflow: 'hidden', borderRadius: '0 0 12px 12px' }}>
                <Sparkline color={c.color} data={c.sparkData} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Row 3: Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

          {/* Tasks by Status */}
          <div style={{ ...card, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#172033' }}>Tasks by Status</span>
              <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>All tasks</span>

            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <DonutChart data={donut} total={donutTotal} />
              <div style={{ flex: 1 }}>
                {donut.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < donut.length - 1 ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#344054' }}>{d.label}</span>
                    </div>
                    <span style={{ fontSize: 13, color: '#172033' }}>
                      {d.value} <span style={{ color: '#9CA3AF' }}>({donutTotal > 0 ? Math.round(d.value / donutTotal * 100) : 0}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks Over Time */}
          <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#172033' }}>Tasks Over Time</span>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowChartMonthPicker(v => !v)} style={{ ...monthBtn, gap: 6 }}>
                  {new Date(selectedMonth.year, selectedMonth.month).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  <ChevronDown size={11} />
                </button>
                {showChartMonthPicker && (
                  <div style={{ position: 'absolute', top: 42, right: 0, background: '#fff', border: '1px solid #E6EBF2', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.10)', zIndex: 200, overflow: 'hidden', minWidth: 170 }}>
                    {Array.from({ length: 6 }, (_, i) => {
                      const d = new Date(); d.setMonth(d.getMonth() - i);
                      return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) };
                    }).map(opt => (
                      <button key={`${opt.year}-${opt.month}`}
                        onClick={() => { setSelectedMonth({ year: opt.year, month: opt.month }); setShowChartMonthPicker(false); }}
                        style={{
                          width: '100%', padding: '9px 14px', border: 'none',
                          background: selectedMonth.year === opt.year && selectedMonth.month === opt.month ? '#EEF4FF' : '#fff',
                          color: selectedMonth.year === opt.year && selectedMonth.month === opt.month ? '#1663F6' : '#172033',
                          fontSize: 13, fontWeight: selectedMonth.year === opt.year && selectedMonth.month === opt.month ? 700 : 500,
                          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        }}>{opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>            
              </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 12 }}>
              {chartSeries.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ width: 16, height: 2.5, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#667085', whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
              ))}
            </div>
            <LineChart series={chartSeries} labels={chartLabels} />
          </div>
        </div>

        {/* ── Row 4: My Tasks + Recent Activity ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">

          {/* My Tasks */}
          <div style={{ ...card, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#172033' }}>My Tasks</span>
              <Link to="/taskboard" style={{ fontSize: 12, fontWeight: 600, color: '#1663F6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>View all <ArrowRight size={12} /></Link>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E6EBF2', marginBottom: 4 }}>
              {([
                { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
                { key: 'in_progress', label: 'In Progress', count: inProgressMy.length },
                { key: 'overdue', label: 'Overdue', count: overdueMy.length },
                { key: 'completed', label: 'Completed', count: completedMy.length },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setMyTasksTab(tab.key)} style={{
                  flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'none',
                  color: myTasksTab === tab.key ? '#1663F6' : '#667085',
                  borderBottom: myTasksTab === tab.key ? '2px solid #1663F6' : '2px solid transparent',
                  marginBottom: -1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, whiteSpace: 'nowrap'
                }}>
                  {tab.label}
                  <span style={{ fontSize: 10, fontWeight: 700, background: myTasksTab === tab.key ? '#EEF2FF' : '#F3F4F6', color: myTasksTab === tab.key ? '#1663F6' : '#9CA3AF', borderRadius: 12, padding: '1px 6px' }}>{tab.count}</span>
                </button>
              ))}
            </div>
            {tabTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>No {myTasksTab} tasks</div>
            ) : tabTasks.map(task => (
              <div key={task.id} onClick={() => navigate('/taskboard')}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 6px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Status circle */}
                <div style={{ width: 17, height: 17, borderRadius: '50%', border: `2px solid ${task.status === 'completed' ? '#22C55E' : '#D1D5DB'}`, background: task.status === 'completed' ? '#22C55E' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {task.status === 'completed' && <CheckCircle size={10} color="#fff" strokeWidth={3} />}
                </div>

                {/* Task name + project — takes all remaining space, truncates */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{task.heading}</div>
                  <div style={{ fontSize: 11, color: '#667085', marginTop: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {task.project_name || 'DYUKSA'}
                  </div>
                </div>

                {/* Status badge — always visible, flexShrink:0 so it never collapses */}
                <div style={{ flexShrink: 0 }}>
                  <StatusBadge status={task.status} />
                </div>

                {/* Avatar — hidden on very small screens via Tailwind */}
                {task.assigned_to_user_details?.length > 0 && (
                  <div className="hidden sm:block" style={{ flexShrink: 0 }}>
                    <AvatarStack users={(task.assigned_to_user_details || []).map(u => ({ name: u.first_name || u.username, avatar: u.avatar || null }))} max={1} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div style={{ ...card, padding: '20px 28px 20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#172033' }}>Recent Activity</span>
              <Link to="/documents" style={{ fontSize: 12, fontWeight: 600, color: '#1663F6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>View all <ArrowRight size={12} /></Link>
            </div>
            {recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>No recent activity</div>
            ) : recentActivity.map((doc, i) => {
              const badge = getFileBadge(doc.name);
              return (
                <div key={doc.id} onClick={() => handleDocumentClick(doc)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: badge.color }}>{badge.label}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{doc.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Uploaded in {(doc as any).project_name || 'Workspace'}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{formatRelativeTime(doc.updated_at)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Row 5: Projects Overview ── */}
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#172033' }}>Projects Overview</span>
            <Link to="/projects" style={{ fontSize: 12, fontWeight: 600, color: '#1663F6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>All projects <ArrowRight size={12} /></Link>
          </div>

          {/* Horizontally scrollable wrapper on mobile */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: 560 }}>

              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1.2fr 90px 120px', gap: 10, padding: '0 6px 10px', borderBottom: '1px solid #E6EBF2' }}>
                {['PROJECT', 'TASKS', 'PROGRESS', 'TEAM', 'STATUS'].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</span>
                ))}
              </div>

              {projectsOverview.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: '#9CA3AF', fontSize: 13 }}>No projects yet</div>
              ) : projectsOverview.map((p, i) => (
                <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1.2fr 90px 120px', gap: 10, padding: '12px 6px', borderBottom: i < projectsOverview.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer', borderRadius: 8, alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {(p.name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{(p as any).description?.slice(0, 28) || 'No description'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#344054' }}>{p.taskCount}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ProgressBar pct={p.pct} color={p.color} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#344054', flexShrink: 0, width: 32, textAlign: 'right' }}>{p.pct}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <AvatarStack
                      users={(p.members || []).map((m: any) => ({ name: m.user?.first_name || m.user?.username || '?', avatar: m.user?.avatar || m.avatar || null }))}
                      max={3}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}

            </div>
          </div>
        </div>

      </div>{ }

      {/* Modals */}
      {isActivityOpen && <NotificationsPage onClose={() => setIsActivityOpen(false)} defaultFilter="unread" />}
      <CreateProjectModal isOpen={isCreateProjectModalOpen} onClose={() => setIsCreateProjectModalOpen(false)} navigateOnSuccess={true} />
      {previewDoc && <DocumentPreview url={previewDoc.url} fileName={previewDoc.fileName} fileType={previewDoc.fileType} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}