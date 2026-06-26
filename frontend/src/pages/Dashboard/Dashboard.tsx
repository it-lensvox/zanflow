import { Bell, Calendar, ChevronDown } from 'lucide-react';
import { NotificationsPage }        from '@/pages/NotificationsPage';
import { CreateProjectModal }       from '@/pages/Project/CreateProjectModal';
import { DocumentPreview }          from '@/components/common/DocumentPreview';
import { QuickCreateButton }        from '@/components/QuickCreateButton';
import { GlobalSearchOverlay }      from '@/components/GlobalSearch';
import { useDashboard }             from './hooks/useDashboard';
import { StatCard }                 from './components/StatCard';
import { TasksDonutCard }           from './components/TasksDonutCard';
import { TasksLineChartCard }       from './components/TasksLineChartCard';
import { MyTasksPanel }             from './components/MyTasksPanel';
import { RecentActivityPanel }      from './components/RecentActivityPanel';
import { ProjectsOverviewTable }    from './components/ProjectsOverviewTable';
import {
  BG, TEXT, MUTED, LINE, BLUE, MONTH_BTN,
  STAT_COLORS, DATE_RANGE_LABELS,
} from './index';
import {
  FolderKanban, FileText, CheckCircle, AlertTriangle,
} from 'lucide-react';

export function Dashboard() {
  const db = useDashboard();

  return (
    <div style={{ width: '100%', background: BG, fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}>

      {/* ─── Global Search ─── */}
      {db.searchOpen && <GlobalSearchOverlay onClose={() => db.setSearchOpen(false)} />}

      {/* ─── Sticky Header ─── */}
      <div
        className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
        style={{ position: 'sticky', top: 0, zIndex: 25, background: BG, paddingTop: 16, paddingBottom: 16, borderBottom: `1px solid ${LINE}` }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

          {/* Greeting */}
          <div className="pl-12 sm:pl-0">
            <div style={{ fontSize: 28, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>
              {db.getGreeting()}, {db.firstName}
            </div>
            <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>
              Here's what's happening with your workspace today.
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center flex-wrap gap-2" style={{ padding: '4px 0' }}>

            {/* Search */}
            <button
              onClick={() => db.setSearchOpen(true)}
              className="hidden sm:flex"
              style={{ ...MONTH_BTN, minWidth: 180, gap: 8, fontSize: 14 }}
            >
              <span style={{ fontSize: 13, color: MUTED }}>Search anything…</span>
              <kbd style={{ marginLeft: 'auto', background: '#F3F4F6', border: '1px solid #E3E8EF', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 700, color: '#6B7280' }}>⌘K</kbd>
            </button>

            {/* Date range picker */}
            <div style={{ position: 'relative' }}>
              {db.showRangePicker && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => db.setShowRangePicker(false)} />
              )}
              <button onClick={() => db.setShowRangePicker(v => !v)} style={{ ...MONTH_BTN, padding: '4px 8px', gap: 6 }}>
                <Calendar size={13} color={MUTED} />
                {DATE_RANGE_LABELS[db.dateRange]}
                <ChevronDown size={11} color={MUTED} />
              </button>
              {db.showRangePicker && (
                <div style={{ position: 'absolute', top: 42, right: 0, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.10)', zIndex: 50, overflow: 'hidden', minWidth: 160 }}>
                  {(Object.entries(DATE_RANGE_LABELS) as [typeof db.dateRange, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => { db.setDateRange(val); db.setShowRangePicker(false); }}
                      style={{ width: '100%', padding: '9px 14px', border: 'none', background: db.dateRange === val ? '#EEF4FF' : '#fff', color: db.dateRange === val ? BLUE : TEXT, fontSize: 14, fontWeight: db.dateRange === val ? 700 : 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications bell */}
            <button
              onClick={() => db.setIsActivityOpen(!db.isActivityOpen)}
              style={{ position: 'relative', width: 36, height: 36, border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Bell size={15} color={TEXT} />
              {db.unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: '#EF4444', borderRadius: '50%', fontSize: 9, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {db.unreadCount > 9 ? '9+' : db.unreadCount}
                </span>
              )}
            </button>

            <QuickCreateButton />
          </div>
        </div>
      </div>

      {/* ─── Scrollable Body ─── */}
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6" style={{ paddingBottom: 24 }}>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          <StatCard
            label="Total Projects"
            value={db.totalProjects}
            change={`${db.totalProjects} total`}
            sub="active"
            up={true}
            color={STAT_COLORS.projects}
            icon={<FolderKanban size={16} color={STAT_COLORS.projects} />}
            sparkData={[2, 3, 4, 5, 6, 7, 8, db.totalProjects || 9]}
            isLoading={db.projectsLoading}
          />
          <StatCard
            label="Total Documents"
            value={db.totalDocsCount}
            change={db.dateRange === 'all' ? `${db.totalDocsCount} total` : `${db.filteredDocs.length} in period`}
            sub={db.dateRange === 'all' ? 'all time' : DATE_RANGE_LABELS[db.dateRange]}
            up={true}
            color={STAT_COLORS.documents}
            icon={<FileText size={16} color={STAT_COLORS.documents} />}
            sparkData={[10, 15, 20, 30, 35, 40, 50, db.totalDocsCount || 1]}
            isLoading={db.documentsLoading}
          />
          <StatCard
            label="Total Tasks"
            value={db.totalTasks}
            change={`${db.pendingTasks} pending`}
            sub={`Across ${db.totalProjects} projects`}
            up={true}
            color={STAT_COLORS.tasks}
            icon={<CheckCircle size={16} color={STAT_COLORS.tasks} />}
            sparkData={[1, 2, 3, 4, 5, 6, 7, db.totalTasks || 9]}
            isLoading={db.tasksLoading}
          />
          <StatCard
            label="Completed"
            value={db.completedTasks}
            change={`${db.completedPct}% done`}
            sub={`On time: ${Math.max(db.completedTasks - 1, 0)}`}
            up={true}
            color={STAT_COLORS.completed}
            icon={<CheckCircle size={16} color={STAT_COLORS.completed} />}
            sparkData={[0, 1, 1, 2, 2, 2, 3, db.completedTasks || 3]}
            isLoading={db.tasksLoading}
          />
          <StatCard
            label="Overdue Tasks"
            value={db.overdueTasks}
            change={`${db.overduePct}% of total`}
            sub="vs. total tasks"
            up={db.overdueTasks === 0}
            color={STAT_COLORS.overdue}
            icon={<AlertTriangle size={16} color={STAT_COLORS.overdue} />}
            sparkData={[5, 5, 4, 4, 3, 3, 3, db.overdueTasks || 2]}
            isLoading={db.tasksLoading}
          />
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <TasksDonutCard
            donut={db.donut}
            donutTotal={db.donutTotal}
            isLoading={db.tasksLoading}
          />
          <TasksLineChartCard
            chartSeries={db.chartSeries}
            chartLabels={db.chartLabels}
            selectedMonth={db.selectedMonth}
            setSelectedMonth={db.setSelectedMonth}
            showChartMonthPicker={db.showChartMonthPicker}
            setShowChartMonthPicker={db.setShowChartMonthPicker}
            isLoading={db.tasksLoading}
          />
        </div>

        {/* ── My Tasks + Recent Activity row ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <MyTasksPanel
            myTasksTab={db.myTasksTab}
            setMyTasksTab={db.setMyTasksTab}
            tabTasks={db.tabTasks}
            upcoming={db.upcoming}
            inProgressMy={db.inProgressMy}
            overdueMy={db.overdueMy}
            completedMy={db.completedMy}
            navigate={db.navigate}
            isLoading={db.tasksLoading}
          />
          <RecentActivityPanel
            recentActivity={db.recentActivity}
            getFileBadge={db.getFileBadge}
            handleDocumentClick={db.handleDocumentClick}
            isLoading={db.documentsLoading}
          />
        </div>

        {/* ── Projects Overview ── */}
        <ProjectsOverviewTable
          projectsOverview={db.projectsOverview}
          navigate={db.navigate}
          isLoading={db.projectsLoading}
        />

      </div>

      {/* ─── Modals ─── */}
      {db.isActivityOpen && (
        <NotificationsPage onClose={() => db.setIsActivityOpen(false)} defaultFilter="unread" />
      )}
      <CreateProjectModal
        isOpen={db.isCreateProjectModalOpen}
        onClose={() => db.setIsCreateProjectModalOpen(false)}
        navigateOnSuccess={true}
      />
      {db.previewDoc && (
        <DocumentPreview
          url={db.previewDoc.url}
          fileName={db.previewDoc.fileName}
          fileType={db.previewDoc.fileType}
          onClose={() => db.setPreviewDoc(null)}
        />
      )}
    </div>
  );
}