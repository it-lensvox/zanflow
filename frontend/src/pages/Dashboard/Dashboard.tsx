import React from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban, FileText, CheckCircle, ArrowRight,
  Search, Bell, TrendingUp, TrendingDown, AlertTriangle, ChevronDown, Calendar,
} from 'lucide-react';
import { NotificationsPage }      from '@/pages/NotificationsPage';
import { CreateProjectModal }      from '@/pages/Project/CreateProjectModal';
import { DocumentPreview }         from '@/components/common/DocumentPreview';
import { QuickCreateButton }       from '@/components/QuickCreateButton';
import { DashboardSearchModal }    from './DashboardSearchModal';
import { Sparkline }               from '@/components/charts/Sparkline';
import { DonutChart }              from '@/components/charts/DonutChart';
import { LineChart }               from '@/components/charts/LineChart';
import { ProgressBar }             from '@/components/ui/ProgressBar';
import { AvatarStack }             from '@/components/ui/AvatarStack';
import { StatusBadge }             from '@/components/ui/StatusBadge';
import { useDashboard, getGreeting } from '@/hooks/useDashboard';
import { formatRelativeTime } from '@/lib/utils';

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E6EBF2', borderRadius: 12, boxShadow: '0 1px 3px rgba(16,24,40,.05)' };
const monthBtn: React.CSSProperties = { fontSize: 16, fontWeight: 500, color: '#344054', background: '#fff', border: '1px solid #E6EBF2', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 };

export function Dashboard() {
  const db = useDashboard();

  return (
    <div style={{ width: '100%', background: '#F7F8FB', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}>

      {/* ─── Search Modal ─── */}
      {db.searchOpen && (
        <DashboardSearchModal
          searchQuery={db.searchQuery}
          setSearchQuery={db.setSearchQuery}
          searchResults={db.searchResults}
          onClose={() => { db.setSearchOpen(false); db.setSearchQuery(''); }}
        />
      )}

      {/* ─── Fixed Greeting Bar ─── */}
      <div
        className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
        style={{ position: 'sticky', top: 0, zIndex: 25, background: '#F7F8FB', paddingTop: 16, paddingBottom: 16, borderBottom: '1px solid #E6EBF2' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="pl-12 sm:pl-0">
            <div style={{ fontSize: 26, fontWeight: 800, color: '#172033', letterSpacing: '-0.02em' }}>{getGreeting()}, {db.firstName}</div>
            <div style={{ fontSize: 16, color: '#667085', marginTop: 4 }}>Here's what's happening with your workspace today.</div>
          </div>
          <div className="flex items-center flex-wrap gap-2" style={{ padding: '4px 0' }}>
            <button onClick={() => db.setSearchOpen(true)} className="hidden sm:flex" style={{ ...monthBtn, minWidth: 180, gap: 8 }}>
              <Search size={13} color="#667085" /> Search anything… <kbd style={{ marginLeft: 'auto', background: '#F3F4F6', border: '1px solid #E3E8EF', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 700, color: '#6B7280' }}>⌘K</kbd>
            </button>

            {/* Date Range Picker */}
            <div style={{ position: 'relative' }}>
              {db.showRangePicker && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => db.setShowRangePicker(false)} />}
              <button onClick={() => db.setShowRangePicker(v => !v)} style={{ ...monthBtn, padding: '4px 8px', gap: 6 }}>
                <Calendar size={13} color="#667085" />
                {db.DATE_RANGE_LABELS[db.dateRange]}
                <ChevronDown size={11} color="#667085" />
              </button>
              {db.showRangePicker && (
                <div style={{ position: 'absolute', top: 42, right: 0, background: '#fff', border: '1px solid #E6EBF2', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.10)', zIndex: 50, overflow: 'hidden', minWidth: 160 }}>
                  {(Object.entries(db.DATE_RANGE_LABELS) as [typeof db.dateRange, string][]).map(([val, label]) => (
                    <button key={val} onClick={() => { db.setDateRange(val); db.setShowRangePicker(false); }} style={{ width: '100%', padding: '9px 14px', border: 'none', background: db.dateRange === val ? '#EEF4FF' : '#fff', color: db.dateRange === val ? '#1663F6' : '#172033', fontSize: 16, fontWeight: db.dateRange === val ? 700 : 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>{label}</button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => db.setIsActivityOpen(!db.isActivityOpen)} style={{ position: 'relative', width: 36, height: 36, border: '1px solid #E6EBF2', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={15} color="#344054" />
              {db.unreadCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: '#EF4444', borderRadius: '50%', fontSize: 9, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{db.unreadCount > 9 ? '9+' : db.unreadCount}</span>}
            </button>
            <QuickCreateButton />
          </div>
        </div>
      </div>

      {/* ─── Scrollable Content ─── */}
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6" style={{ paddingBottom: 24 }}>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          {[
            { label: 'Total Projects',  value: db.totalProjects,  change: `${db.totalProjects} total`,                                                                   up: true,                    color: '#1663F6', icon: <FolderKanban size={16} color="#1663F6" />, sub: 'active', sparkData: [2, 3, 4, 5, 6, 7, 8, db.totalProjects || 9] },
            { label: 'Total Documents', value: db.totalDocsCount, change: db.dateRange === 'all' ? `${db.totalDocsCount} total` : `${db.filteredDocs.length} in period`, up: true,                    color: '#22C55E', icon: <FileText size={16} color="#22C55E" />,     sub: db.dateRange === 'all' ? 'all time' : db.DATE_RANGE_LABELS[db.dateRange], sparkData: [10, 15, 20, 30, 35, 40, 50, db.totalDocsCount || 1] },
            { label: 'Total Tasks',     value: db.totalTasks,     change: `${db.pendingTasks} pending`,                                                                   up: true,                    color: '#F59E0B', icon: <CheckCircle size={16} color="#F59E0B" />,   sub: `Across ${db.totalProjects} projects`, sparkData: [1, 2, 3, 4, 5, 6, 7, db.totalTasks || 9] },
            { label: 'Completed',       value: db.completedTasks, change: `${db.completedPct}% done`,                                                                    up: true,                    color: '#8B5CF6', icon: <CheckCircle size={16} color="#8B5CF6" />,   sub: `On time: ${Math.max(db.completedTasks - 1, 0)}`, sparkData: [0, 1, 1, 2, 2, 2, 3, db.completedTasks || 3] },
            { label: 'Overdue Tasks',   value: db.overdueTasks,   change: `${db.overduePct}% of total`,                                                                  up: db.overdueTasks === 0,   color: '#EF4444', icon: <AlertTriangle size={16} color="#EF4444" />, sub: 'vs. total tasks', sparkData: [5, 5, 4, 4, 3, 3, 3, db.overdueTasks || 2] },
          ].map((c, i) => (
            <div key={i} style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${c.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</div>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#667085' }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#172033', lineHeight: 1, marginBottom: 4 }}>{c.value}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                {c.up ? <TrendingUp size={11} color="#22C55E" /> : <TrendingDown size={11} color="#EF4444" />}
                <span style={{ fontSize: 11, fontWeight: 700, color: c.up ? '#22C55E' : '#EF4444' }}>{c.change}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.sub}</span>
              </div>
              <div style={{ margin: '0 -18px -16px', overflow: 'hidden', borderRadius: '0 0 12px 12px' }}>
                <Sparkline color={c.color} data={c.sparkData} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

          {/* Tasks by Status — Donut */}
          <div style={{ ...card, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#172033' }}>Tasks by Status</span>
              <span style={{ fontSize: 16, color: '#9CA3AF', fontWeight: 500 }}>All tasks</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <DonutChart data={db.donut} total={db.donutTotal} />
              <div style={{ flex: 1 }}>
                {db.donut.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < db.donut.length - 1 ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 16, color: '#344054' }}>{d.label}</span>
                    </div>
                    <span style={{ fontSize: 16, color: '#172033' }}>
                      {d.value} <span style={{ color: '#9CA3AF' }}>({db.donutTotal > 0 ? Math.round(d.value / db.donutTotal * 100) : 0}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks Over Time — Line Chart */}
          <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#172033' }}>Tasks Over Time</span>
              <div style={{ position: 'relative' }}>
                <button onClick={() => db.setShowChartMonthPicker(v => !v)} style={{ ...monthBtn, gap: 6 }}>
                  {new Date(db.selectedMonth.year, db.selectedMonth.month).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  <ChevronDown size={11} />
                </button>
                {db.showChartMonthPicker && (
                  <div style={{ position: 'absolute', top: 42, right: 0, background: '#fff', border: '1px solid #E6EBF2', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.10)', zIndex: 200, overflow: 'hidden', minWidth: 170 }}>
                    {Array.from({ length: 6 }, (_, i) => {
                      const d = new Date(); d.setMonth(d.getMonth() - i);
                      return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) };
                    }).map(opt => (
                      <button key={`${opt.year}-${opt.month}`} onClick={() => { db.setSelectedMonth({ year: opt.year, month: opt.month }); db.setShowChartMonthPicker(false); }}
                        style={{ width: '100%', padding: '9px 14px', border: 'none', background: db.selectedMonth.year === opt.year && db.selectedMonth.month === opt.month ? '#EEF4FF' : '#fff', color: db.selectedMonth.year === opt.year && db.selectedMonth.month === opt.month ? '#1663F6' : '#172033', fontSize: 16, fontWeight: db.selectedMonth.year === opt.year && db.selectedMonth.month === opt.month ? 700 : 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 12 }}>
              {db.chartSeries.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ width: 16, height: 2.5, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#667085', whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
              ))}
            </div>
            <LineChart series={db.chartSeries} labels={db.chartLabels} />
          </div>
        </div>

        {/* ── My Tasks + Recent Activity ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">

          {/* My Tasks */}
          <div style={{ ...card, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#172033' }}>My Tasks</span>
              <Link to="/taskboard" style={{ fontSize: 16, fontWeight: 600, color: '#1663F6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>View all <ArrowRight size={12} /></Link>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E6EBF2', marginBottom: 4 }}>
              {([
                { key: 'upcoming',    label: 'Upcoming',    count: db.upcoming.length },
                { key: 'in_progress', label: 'In Progress', count: db.inProgressMy.length },
                { key: 'overdue',     label: 'Overdue',     count: db.overdueMy.length },
                { key: 'completed',   label: 'Completed',   count: db.completedMy.length },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => db.setMyTasksTab(tab.key)} style={{ flex: 1, padding: '8px 4px', fontSize: 16, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'none', color: db.myTasksTab === tab.key ? '#1663F6' : '#667085', borderBottom: db.myTasksTab === tab.key ? '2px solid #1663F6' : '2px solid transparent', marginBottom: -1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  {tab.label}
                  <span style={{ fontSize: 10, fontWeight: 700, background: db.myTasksTab === tab.key ? '#EEF2FF' : '#F3F4F6', color: db.myTasksTab === tab.key ? '#1663F6' : '#9CA3AF', borderRadius: 12, padding: '1px 6px' }}>{tab.count}</span>
                </button>
              ))}
            </div>
            {db.tabTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 16 }}>No {db.myTasksTab} tasks</div>
            ) : db.tabTasks.map(task => (
              <div key={task.id} onClick={() => db.navigate('/taskboard')}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 6px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 17, height: 17, borderRadius: '50%', border: `2px solid ${task.status === 'completed' ? '#22C55E' : '#D1D5DB'}`, background: task.status === 'completed' ? '#22C55E' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {task.status === 'completed' && <CheckCircle size={10} color="#fff" strokeWidth={3} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#172033', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{task.heading}</div>
                  <div style={{ fontSize: 11, color: '#667085', marginTop: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{task.project_name || 'DYUKSA'}</div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <StatusBadge status={task.status} />
                </div>
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
              <span style={{ fontSize: 16, fontWeight: 700, color: '#172033' }}>Recent Activity</span>
              <Link to="/documents" style={{ fontSize: 16, fontWeight: 600, color: '#1663F6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>View all <ArrowRight size={12} /></Link>
            </div>
            {db.recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 16 }}>No recent activity</div>
            ) : db.recentActivity.map((doc, i) => {
              const badge = db.getFileBadge(doc.name);
              return (
                <div key={doc.id} onClick={() => db.handleDocumentClick(doc)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < db.recentActivity.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: badge.color }}>{badge.label}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#172033', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{doc.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Uploaded in {(doc as any).project_name || 'Workspace'}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{doc.updated_at ? formatRelativeTime(doc.updated_at) : ''}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Projects Overview ── */}
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#172033' }}>Projects Overview</span>
            <Link to="/projects" style={{ fontSize: 16, fontWeight: 600, color: '#1663F6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>All projects <ArrowRight size={12} /></Link>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: 560 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1.2fr 90px 120px', gap: 10, padding: '0 6px 10px', borderBottom: '1px solid #E6EBF2' }}>
                {['PROJECT', 'TASKS', 'PROGRESS', 'TEAM', 'STATUS'].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</span>
                ))}
              </div>
              {db.projectsOverview.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: '#9CA3AF', fontSize: 16 }}>No projects yet</div>
              ) : db.projectsOverview.map((p, i) => (
                <div key={p.id} onClick={() => db.navigate(`/projects/${p.id}`)}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1.2fr 90px 120px', gap: 10, padding: '12px 6px', borderBottom: i < db.projectsOverview.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer', borderRadius: 8, alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {(p.name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#172033', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{(p as any).description?.slice(0, 28) || 'No description'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 16, fontWeight: 600, color: '#344054' }}>{p.taskCount}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ProgressBar pct={p.pct} color={p.color} />
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#344054', flexShrink: 0, width: 32, textAlign: 'right' }}>{p.pct}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <AvatarStack users={(p.members || []).map((m: any) => ({ name: m.user?.first_name || m.user?.username || '?', avatar: m.user?.avatar || m.avatar || null }))} max={3} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ─── Modals ─── */}
      {db.isActivityOpen && <NotificationsPage onClose={() => db.setIsActivityOpen(false)} defaultFilter="unread" />}
      <CreateProjectModal isOpen={db.isCreateProjectModalOpen} onClose={() => db.setIsCreateProjectModalOpen(false)} navigateOnSuccess={true} />
      {db.previewDoc && <DocumentPreview url={db.previewDoc.url} fileName={db.previewDoc.fileName} fileType={db.previewDoc.fileType} onClose={() => db.setPreviewDoc(null)} />}
    </div>
  );
}