import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Calendar, ChevronDown, LayoutDashboard, ListTodo, BarChart2, Star, Search, HelpCircle, Plus, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { CreateProjectModal } from '@/pages/Project/CreateProjectModal';
import { DocumentPreview } from '@/components/common/DocumentPreview';
import { QuickCreateButton } from '@/components/QuickCreateButton';
import { GlobalSearchOverlay } from '@/components/GlobalSearch';
import { useDashboard } from './hooks/useDashboard';
import { useTodayTab } from './hooks/useTodayTab';
import { useAnalyticsTab } from './hooks/useAnalyticsTab';
import { useCustomDashboards } from './hooks/useCustomDashboards';
import { StatCard } from './components/StatCard';
import { TasksDonutCard } from './components/TasksDonutCard';
import { TasksLineChartCard } from './components/TasksLineChartCard';
import { MyTasksPanel } from './components/MyTasksPanel';
import { RecentActivityPanel } from './components/RecentActivityPanel';
import { ProjectsOverviewTable } from './components/ProjectsOverviewTable';
import { TodayTab } from './components/TodayTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { CustomDashboardView, NewDashboardModal } from './components/CustomDashboard';
import { BG, TEXT, MUTED, LINE, BLUE, MONTH_BTN, STAT_COLORS, DATE_RANGE_LABELS } from './index';
import { FolderKanban, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

type DashTab = 'overview' | 'today' | 'analytics' | `custom_${number}`;

const DEFAULT_TAB_KEY = 'dyuksa_dashboard_default_tab';
const TABS: { key: DashTab; label: string; icon: React.ReactNode; sub: string }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={14} />, sub: 'Everything at a glance' },
  { key: 'today', label: 'Today', icon: <ListTodo size={14} />, sub: 'Your focus for the day' },
  { key: 'analytics', label: 'Analytics', icon: <BarChart2 size={14} />, sub: 'Trends & performance' },
];

// Icon map for the switcher dropdown
const TAB_ICONS_LG: Record<DashTab, React.ReactNode> = {
  overview: <LayoutDashboard size={16} />,
  today: <ListTodo size={16} />,
  analytics: <BarChart2 size={16} />,
};

export function Dashboard() {
  const db = useDashboard();

  // Read saved default tab from localStorage
  const [activeTab, setActiveTab] = useState<DashTab>(() =>
    (typeof localStorage !== 'undefined'
      ? (localStorage.getItem(DEFAULT_TAB_KEY) as DashTab | null)
      : null) ?? 'overview'
  );
  const [defaultTab, setDefaultTab] = useState<DashTab>(() =>
    (typeof localStorage !== 'undefined'
      ? (localStorage.getItem(DEFAULT_TAB_KEY) as DashTab | null)
      : null) ?? 'overview'
  );
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const [showNewDashboardModal, setShowNewDashboardModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [renameState, setRenameState] = useState<{ id: number; value: string } | null>(null);

  const openMenu = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (menuOpenId === id) { setMenuOpenId(null); setMenuPos(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuOpenId(id);
  }, [menuOpenId]);

  const {
    dashboards,
    createDashboard,
    renameDashboard,
    deleteDashboard,
    setDefaultDashboard,
    addWidget,
    removeWidget,
    reorderWidgets,
    resizeWidget,
  } = useCustomDashboards();

  const activeCustomDashboard = activeTab.startsWith('custom_')
    ? dashboards.find(d => `custom_${d.id}` === activeTab) ?? null
    : null;

  // Close switcher when clicking outside
  useEffect(() => {
    if (!switcherOpen) return;
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [switcherOpen]);

  // Handler: save current tab as default
  const handleSetDefault = () => {
    if (defaultTab === activeTab) {
      setActiveTab('overview');
      return;
    }
    if (activeTab.startsWith('custom_')) {
      const id = Number(activeTab.replace('custom_', ''));
      setDefaultDashboard(id);
    }
    localStorage.setItem(DEFAULT_TAB_KEY, activeTab);
    setDefaultTab(activeTab);
  };

  // Handler: switch tab from switcher
  const handleSwitcherSelect = (tab: DashTab) => {
    setActiveTab(tab);
    setSwitcherOpen(false);
  };

  // Today tab hook 
  const todayData = useTodayTab(
    (db as any)._allTasks ||
    [...db.upcoming, ...db.inProgressMy, ...db.overdueMy, ...db.completedMy]
  );

  // Analytics tab hook
  const analyticsData = useAnalyticsTab(
    (db as any)._allTasks ||
    [...db.upcoming, ...db.inProgressMy, ...db.overdueMy, ...db.completedMy],
    (db as any)._projects || [],
    db.selectedMonth,
    db.chartSeries,
    db.chartLabels,
  );

  const currentTab = TABS.find(t => t.key === activeTab) ?? {
    key: activeTab,
    label: activeCustomDashboard?.name ?? 'Custom',
    icon: null,
    sub: 'Your custom dashboard',
  };

  return (
    <div style={{ width: '100%', background: BG, fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}>

      {/* ─── Global Search ─── */}
      {db.searchOpen && <GlobalSearchOverlay onClose={() => db.setSearchOpen(false)} />}

      {/* ══ ROW 1 — Sticky top bar (breadcrumb + actions) ══ */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 27,
         background: 'hsl(var(--card))', borderBottom: `1px solid ${LINE}`,
          display: 'flex', alignItems: 'center',
          height: 52, padding: '0 20px', gap: 12,
        }}
      >
        {/* Left: breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: MUTED }}>
          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors flex-shrink-0 mr-1"
            onClick={() => {
              // dispatch to Layout's mobile sidebar opener via custom event
              window.dispatchEvent(new CustomEvent('dashboard:open-sidebar'));
            }}
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4h14M2 9h14M2 14h14" stroke="hsl(var(--muted-foreground))" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
          <span style={{ color: MUTED, fontWeight: 500 }}>DYUKSA</span>
          <span style={{ color: 'hsl(var(--border))' }}> </span>
          <span style={{ color: TEXT, fontWeight: 700 }}>Dashboard</span>
        </div>

        {/* Right: search + theme + new task + bell + help */}
        {/* Center: search — grows to fill ~40% of the row */}
        <button
          onClick={() => db.setSearchOpen(true)}
          className="hidden sm:flex"
          style={{ ...MONTH_BTN, flex: '0 1 40%', minWidth: 160, gap: 8, height: 34, padding: '0 12px', marginLeft: 'auto' }}
        >
          <Search size={13} color={MUTED} />
          <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Search anything…</span>
         <kbd style={{ marginLeft: 'auto', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>⌘K</kbd>
        </button>

        {/* Right: theme + new task + bell + help */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Theme toggle — active */}
          <div
            style={{
              width: 34, height: 34,
              border: `1px solid ${LINE}`,
              borderRadius: 8,
              background: 'hsl(var(--accent))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              transition: 'background .2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--secondary))'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--accent))'; }}
          >
            <ThemeToggle />
          </div>

          {/* + New task (moved from row 3) */}
          <QuickCreateButton />

          {/* Notifications bell (moved from row 3) */}
          <button
            onClick={() => db.setIsActivityOpen(!db.isActivityOpen)}
           style={{ position: 'relative', width: 34, height: 34, border: `1px solid ${LINE}`, borderRadius: 8, background: 'hsl(var(--card))', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Bell size={15} color={TEXT} />
            {db.unreadCount > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: '#EF4444', borderRadius: '50%', fontSize: 9, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {db.unreadCount > 9 ? '9+' : db.unreadCount}
              </span>
            )}
          </button>
          {/* Help */}
          <button
            style={{ width: 34, height: 34, border: `1px solid ${LINE}`, borderRadius: 8, background: 'hsl(var(--card))', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            className="hidden sm:flex"
          >
            <HelpCircle size={15} color={MUTED} />
          </button>
        </div>
      </div>
      {/* ══ ROW 2 — Sticky tab bar ══ */}
      <div
        style={{
          position: 'sticky', top: 52, zIndex: 26,
          background: BG, borderBottom: `1px solid ${LINE}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, minHeight: 48, padding: '0 20px',
        }}
      >
        {/* Tabs + subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: active ? BLUE : 'transparent',
                  color: active ? '#fff' : MUTED,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
          <span className="hidden sm:inline" style={{ fontSize: 13, color: MUTED, marginLeft: 10 }}>
            {currentTab.sub}
          </span>
        </div>

        {/* Right: Set as default + Dashboard switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

          {/* Set as default button */}
          <button
            onClick={handleSetDefault}
            title={defaultTab === activeTab
              ? 'Click to go back to Overview'
              : `Set ${TABS.find(t => t.key === activeTab)?.label ?? activeCustomDashboard?.name ?? 'this dashboard'} as default`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
              color: defaultTab === activeTab ? '#1663f6' : MUTED,
              background: defaultTab === activeTab ? `${BLUE}15` : 'none',
              border: `1px solid ${defaultTab === activeTab ? '#C7D7FD' : 'transparent'}`,
              cursor: 'pointer', padding: '5px 10px', borderRadius: 7,
              fontFamily: 'inherit', fontWeight: defaultTab === activeTab ? 600 : 500,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              if (defaultTab !== activeTab) e.currentTarget.style.background = 'hsl(var(--accent))';
            }}
            onMouseLeave={e => {
              if (defaultTab !== activeTab) e.currentTarget.style.background = 'none';
            }}
          >
            <Star
              size={13}
              fill={defaultTab === activeTab ? '#1663f6' : 'none'}
              color={defaultTab === activeTab ? '#1663f6' : MUTED}
            />
            <span className="hidden sm:inline">
              {defaultTab === activeTab ? 'Default view' : 'Set as default'}
            </span>
          </button>

          {/* Dashboard switcher button + dropdown */}
          <div ref={switcherRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setSwitcherOpen(v => !v)}
              title="Switch dashboard"
              style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${switcherOpen ? BLUE : LINE}`,
                borderRadius: 7, background: switcherOpen ? `${BLUE}18` : 'hsl(var(--card))',
                cursor: 'pointer', color: switcherOpen ? BLUE : MUTED,
                transition: 'all 0.15s',
              }}
            >
              {/* 2×2 grid icon */}
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity="0.85" />
                <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity="0.85" />
                <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity="0.85" />
                <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity="0.85" />
              </svg>
            </button>

            {/* Switcher dropdown */}
            {switcherOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
                background: 'hsl(var(--popover))', border: `1px solid hsl(var(--border))`, borderRadius: 14,
                boxShadow: '0 12px 32px rgba(16,24,40,.12)', minWidth: 240, overflow: 'hidden',
                padding: '8px 0',
              }}>
                {/* Section label */}
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, padding: '6px 16px 8px', letterSpacing: '0.06em' }}>
                  YOUR DASHBOARDS
                </div>

                {/* Built-in tab rows */}
                {TABS.map(tab => {
                  const isActive = activeTab === tab.key;
                  const isDefault = defaultTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => handleSwitcherSelect(tab.key)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px', border: 'none', cursor: 'pointer',
                        background: isActive ? 'hsl(var(--muted))' : 'transparent',
                        fontFamily: 'inherit', transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isActive ? BLUE : '#F1F5F9',
                        color: isActive ? '#fff' : MUTED,
                      }}>
                        {TAB_ICONS_LG[tab.key]}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{tab.label}</div>
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{tab.sub}</div>
                      </div>
                      <Star
                        size={14}
                        fill={isDefault ? '#F59E0B' : 'none'}
                        color={isDefault ? '#F59E0B' : '#D1D5DB'}
                        style={{ flexShrink: 0 }}
                      />
                    </button>
                  );
                })}

                {/* Custom dashboards */}
                {dashboards.length > 0 && (
                  <>
                    <div style={{ height: 1, background: LINE, margin: '4px 0' }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, padding: '6px 16px 4px', letterSpacing: '0.06em' }}>
                      CUSTOM
                    </div>
                    {dashboards.map(cd => {
                      const tabKey: DashTab = `custom_${cd.id}`;
                      const isActive = activeTab === tabKey;
                      const isDefault = defaultTab === tabKey;
                      return (
                        <div key={cd.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <button
                            onClick={() => handleSwitcherSelect(tabKey)}
                            style={{
                              flex: 1, display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 16px', border: 'none', cursor: 'pointer',
                              background: isActive ? 'hsl(var(--accent))' : 'transparent',
                              fontFamily: 'inherit', transition: 'background 0.12s',
                            }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{
                              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: isActive ? BLUE : '#F1F5F9',
                              color: isActive ? '#fff' : MUTED,
                            }}>
                              <LayoutDashboard size={16} />
                            </div>
                            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cd.name}</div>
                              <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{cd.widgets.length} widgets</div>
                            </div>
                            <Star
                              size={14}
                              fill={isDefault ? '#F59E0B' : 'none'}
                              color={isDefault ? '#F59E0B' : '#D1D5DB'}
                              style={{ flexShrink: 0 }}
                            />
                          </button>
                          {/* ··· menu trigger */}
                          <div style={{ paddingRight: 8, flexShrink: 0 }}>
                            <button
                              onClick={(e) => openMenu(e, cd.id)}
                              style={{
                                width: 24, height: 24, borderRadius: 5, border: 'none',
                                background: 'transparent', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: MUTED,
                              }}
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Divider */}
                <div style={{ height: 1, background: LINE, margin: '6px 0' }} />

                {/* New dashboard row */}
                <button
                  onClick={() => { setSwitcherOpen(false); setShowNewDashboardModal(true); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', border: 'none', cursor: 'pointer',
                    background: 'hsl(var(--card))', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--accent))')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'hsl(var(--card))')}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'hsl(var(--muted))', color: MUTED, border: `1.5px dashed hsl(var(--border))`,
                  }}>
                    <Plus size={16} color={MUTED} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Custom dashboard</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ ROW 3 — Scrollable greeting (Overview only) ══ */}
      {activeTab === 'overview' && (
        <div
          className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
          style={{ paddingTop: 20, paddingBottom: 20, borderBottom: `1px solid ${LINE}`, background: BG }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>
                {db.getGreeting()}, {db.firstName}
              </div>
              <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>
                Here's what's happening with your workspace today.
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-2" style={{ paddingTop: 4 }}>
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
                       style={{ width: '100%', padding: '9px 14px', border: 'none', background: db.dateRange === val ? `${BLUE}18` : 'transparent', color: db.dateRange === val ? BLUE : TEXT, fontSize: 14, fontWeight: db.dateRange === val ? 700 : 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Scrollable Body ─── */}
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6" style={{ paddingBottom: 24 }}>

        {/* ══ OVERVIEW TAB ══ */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
              <StatCard label="Total Projects" value={db.totalProjects} change={`${db.totalProjects} total`} sub="active" up={true} color={STAT_COLORS.projects} icon={<FolderKanban size={16} color={STAT_COLORS.projects} />} sparkData={[2, 3, 4, 5, 6, 7, 8, db.totalProjects || 9]} isLoading={db.projectsLoading} />
              <StatCard label="Total Documents" value={db.totalDocsCount} change={db.dateRange === 'all' ? `${db.totalDocsCount} total` : `${db.filteredDocs.length} in period`} sub={db.dateRange === 'all' ? 'all time' : DATE_RANGE_LABELS[db.dateRange]} up={true} color={STAT_COLORS.documents} icon={<FileText size={16} color={STAT_COLORS.documents} />} sparkData={[10, 15, 20, 30, 35, 40, 50, db.totalDocsCount || 1]} isLoading={db.documentsLoading} />
              <StatCard label="Total Tasks" value={db.totalTasks} change={`${db.pendingTasks} pending`} sub={`Across ${db.totalProjects} projects`} up={true} color={STAT_COLORS.tasks} icon={<CheckCircle size={16} color={STAT_COLORS.tasks} />} sparkData={[1, 2, 3, 4, 5, 6, 7, db.totalTasks || 9]} isLoading={db.tasksLoading} />
              <StatCard label="Completed" value={db.completedTasks} change={`${db.completedPct}% done`} sub={`On time: ${Math.max(db.completedTasks - 1, 0)}`} up={true} color={STAT_COLORS.completed} icon={<CheckCircle size={16} color={STAT_COLORS.completed} />} sparkData={[0, 1, 1, 2, 2, 2, 3, db.completedTasks || 3]} isLoading={db.tasksLoading} />
              <StatCard label="Overdue Tasks" value={db.overdueTasks} change={`${db.overduePct}% of total`} sub="vs. total tasks" up={db.overdueTasks === 0} color={STAT_COLORS.overdue} icon={<AlertTriangle size={16} color={STAT_COLORS.overdue} />} sparkData={[5, 5, 4, 4, 3, 3, 3, db.overdueTasks || 2]} isLoading={db.tasksLoading} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <TasksDonutCard donut={db.donut} donutTotal={db.donutTotal} isLoading={db.tasksLoading} />
              <TasksLineChartCard chartSeries={db.chartSeries} chartLabels={db.chartLabels} selectedMonth={db.selectedMonth} setSelectedMonth={db.setSelectedMonth} showChartMonthPicker={db.showChartMonthPicker} setShowChartMonthPicker={db.setShowChartMonthPicker} isLoading={db.tasksLoading} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
              <MyTasksPanel myTasksTab={db.myTasksTab} setMyTasksTab={db.setMyTasksTab} tabTasks={db.tabTasks} upcoming={db.upcoming} inProgressMy={db.inProgressMy} overdueMy={db.overdueMy} completedMy={db.completedMy} navigate={db.navigate} isLoading={db.tasksLoading} />
              <RecentActivityPanel recentActivity={db.recentActivity} getFileBadge={db.getFileBadge} handleDocumentClick={db.handleDocumentClick} isLoading={db.documentsLoading} />
            </div>
            <ProjectsOverviewTable projectsOverview={db.projectsOverview} navigate={db.navigate} isLoading={db.projectsLoading} />
          </>
        )}

        {/* ══ TODAY TAB ══ */}
        {activeTab === 'today' && (
          <TodayTab
            eventsLoading={todayData.eventsLoading}
            tasksLoading={db.tasksLoading}
            documentsLoading={db.documentsLoading}
            todayEvents={todayData.todayEvents}
            tomorrowEvents={todayData.tomorrowEvents}
            dayAfterEvents={todayData.dayAfterEvents}
            focusTasks={todayData.focusTasks}
            focusByPriority={todayData.focusByPriority}
            dueTodayTasks={todayData.dueTodayTasks}
            inProgressTasks={todayData.inProgressTasks}
            overdueTasks={todayData.overdueTasks}
            upcomingDeadlines={todayData.upcomingDeadlines}
            totalFocus={todayData.totalFocus}
            doneFocus={todayData.doneFocus}
            progressPct={todayData.progressPct}
            recentActivity={db.recentActivity}
            handleDocumentClick={db.handleDocumentClick}
            firstName={db.firstName}
            today={todayData.today}
            navigate={db.navigate}
            greeting={db.getGreeting()}
          />
        )}

        {/* ══ CUSTOM DASHBOARD TAB ══ */}
        {activeTab.startsWith('custom_') && !activeCustomDashboard && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: BLUE }} />
          </div>
        )}
        {activeTab.startsWith('custom_') && activeCustomDashboard && (
          <CustomDashboardView
            dashboard={activeCustomDashboard}
            db={db}
            onAddWidget={(type, size) => addWidget(activeCustomDashboard.id, type, size)}
            onRemoveWidget={(widgetId) => removeWidget(activeCustomDashboard.id, widgetId)}
            onReorderWidgets={(widgets) => reorderWidgets(activeCustomDashboard.id, widgets)}
            onResizeWidget={(widgetId, size) => resizeWidget(activeCustomDashboard.id, widgetId, size)}
            onRename={(name) => renameDashboard(activeCustomDashboard.id, name)}
          />
        )}

        {/* ══ ANALYTICS TAB ══ */}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            tasksLoading={db.tasksLoading}
            projectsLoading={db.projectsLoading}
            totalTasks={analyticsData.totalTasks}
            completedTasks={analyticsData.completedTasks}
            overdueTasks={analyticsData.overdueTasks}
            completionRate={analyticsData.completionRate}
            avgCycleTime={analyticsData.avgCycleTime}
            donut={analyticsData.donut}
            donutTotal={analyticsData.donutTotal}
            leaderboard={analyticsData.leaderboard}
            throughputData={analyticsData.throughputData}
            totalThroughput={analyticsData.totalThroughput}
            chartSeries={db.chartSeries}
            chartLabels={db.chartLabels}
            selectedMonth={db.selectedMonth}
            setSelectedMonth={db.setSelectedMonth}
            showChartMonthPicker={db.showChartMonthPicker}
            setShowChartMonthPicker={db.setShowChartMonthPicker}
            projectCount={db.totalProjects}
            navigate={db.navigate}
          />
        )}
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

     {showNewDashboardModal && (
        <NewDashboardModal
          onClose={() => setShowNewDashboardModal(false)}
          onCreate={async (name, template) => {
            const created = await createDashboard(name, template);
            setActiveTab(`custom_${created.id}`);
            setSwitcherOpen(false);
          }}
        />
      )}

      {/* ── Fixed-position context menu — renders outside any overflow/clip context */}
      {menuOpenId !== null && menuPos && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 498 }}
            onClick={() => { setMenuOpenId(null); setMenuPos(null); }}
          />
          {/* Menu */}
          <div style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 499,
            background: 'hsl(var(--popover))',
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(16,24,40,.12)',
            overflow: 'hidden',
            minWidth: 172,
          }}>
            {/* Set as default */}
            {(() => {
              const cd = dashboards.find(d => d.id === menuOpenId);
              if (!cd) return null;
              const tabKey: DashTab = `custom_${cd.id}`;
              const isAlreadyDefault = defaultTab === tabKey;
              return (
                <button
                  onClick={() => {
                    if (!cd || isAlreadyDefault) { setMenuOpenId(null); setMenuPos(null); return; }
                    setDefaultDashboard(cd.id);
                    localStorage.setItem(DEFAULT_TAB_KEY, tabKey);
                    setDefaultTab(tabKey);
                    setMenuOpenId(null); setMenuPos(null);
                  }}
                  style={{
                    width: '100%', padding: '9px 14px', border: 'none',
                    background: isAlreadyDefault ? `${BLUE}18` : 'transparent',
                    fontSize: 13, fontWeight: isAlreadyDefault ? 600 : 500,
                    color: isAlreadyDefault ? '#1663f6' : TEXT,
                    cursor: isAlreadyDefault ? 'default' : 'pointer',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { if (!isAlreadyDefault) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
                  onMouseLeave={e => { if (!isAlreadyDefault) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Star
                    size={13}
                    fill={isAlreadyDefault ? '#1663f6' : 'none'}
                    color={isAlreadyDefault ? '#1663f6' : MUTED}
                  />
                  {isAlreadyDefault ? 'Default view' : 'Set as default'}
                </button>
              );
            })()}

            {/* Rename — opens inline input */}
            <button
              onClick={() => {
                const cd = dashboards.find(d => d.id === menuOpenId);
                if (!cd) return;
                setRenameState({ id: cd.id, value: cd.name });
                setMenuOpenId(null); setMenuPos(null);
              }}
              style={{
                width: '100%', padding: '9px 14px', border: 'none',
                background: 'hsl(var(--card))', fontSize: 13, fontWeight: 500,
                color: TEXT, cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--accent))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'hsl(var(--card))')}
            >
              <Pencil size={13} color={MUTED} /> Rename
            </button>

            <div style={{ height: 1, background: LINE }} />

            {/* Delete */}
            <button
              onClick={() => {
                const cd = dashboards.find(d => d.id === menuOpenId);
                if (!cd) return;
                const tabKey: DashTab = `custom_${cd.id}`;
                deleteDashboard(cd.id);
                if (activeTab === tabKey) setActiveTab('overview');
                if (defaultTab === tabKey) { localStorage.setItem(DEFAULT_TAB_KEY, 'overview'); setDefaultTab('overview'); }
                setMenuOpenId(null); setMenuPos(null);
              }}
              style={{
                width: '100%', padding: '9px 14px', border: 'none',
                background: 'hsl(var(--card))', fontSize: 13, fontWeight: 500,
                color: '#EF4444', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'hsl(var(--card))')}
            >
              <Trash2 size={13} color="#EF4444" /> Delete
            </button>
          </div>
        </>
      )}

      {/* ── Inline rename modal — replaces browser prompt() */}
      {renameState !== null && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(16,24,40,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setRenameState(null); }}
        >
          <div style={{
            background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14, width: '100%', maxWidth: 380,
            boxShadow: '0 20px 60px rgba(16,24,40,0.18)',
            padding: '20px',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 12 }}>
              Rename dashboard
            </div>
            <input
              autoFocus
              value={renameState.value}
              onChange={e => setRenameState(s => s ? { ...s, value: e.target.value } : null)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (renameState.value.trim()) renameDashboard(renameState.id, renameState.value.trim());
                  setRenameState(null);
                }
                if (e.key === 'Escape') setRenameState(null);
              }}
              maxLength={60}
              style={{
                width: '100%', height: 38, borderRadius: 8,
                border: `1px solid ${LINE}`, padding: '0 12px',
                fontSize: 14, color: TEXT, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
                marginBottom: 16,
              }}
              onFocus={e => (e.currentTarget.style.borderColor = BLUE)}
              onBlur={e => (e.currentTarget.style.borderColor = LINE)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRenameState(null)}
                style={{
                  height: 34, padding: '0 14px', borderRadius: 8,
                  border: `1px solid ${LINE}`, background: 'hsl(var(--muted))',
                  fontSize: 13, fontWeight: 600, color: TEXT,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (renameState.value.trim()) renameDashboard(renameState.id, renameState.value.trim());
                  setRenameState(null);
                }}
                disabled={!renameState.value.trim()}
                style={{
                  height: 34, padding: '0 16px', borderRadius: 8,
                  border: 'none',
                  background: renameState.value.trim() ? BLUE : '#C7D7FD',
                  fontSize: 13, fontWeight: 600, color: '#fff',
                  cursor: renameState.value.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}