import { useState, useRef } from 'react';
import { GripVertical, X, ChevronDown } from 'lucide-react';
import { FolderKanban, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { StatCard } from '../StatCard';
import { TasksDonutCard } from '../TasksDonutCard';
import { TasksLineChartCard } from '../TasksLineChartCard';
import { MyTasksPanel } from '../MyTasksPanel';
import { RecentActivityPanel } from '../RecentActivityPanel';
import { ProjectsOverviewTable } from '../ProjectsOverviewTable';
import { LINE, MUTED, TEXT, BLUE, STAT_COLORS } from '../../index';
import { WIDGET_META } from './WidgetPicker';
import type { WidgetConfig, WidgetSize } from '@/types';
import type { DashboardTask } from '../../hooks/useDashboard';
import type { Document } from '@/types';

interface WidgetRendererProps {
  widget: WidgetConfig;
  isEditMode: boolean;
  isDragging?: boolean;
  // Dashboard data — passed down from parent, no new fetching
  db: {
    totalProjects: number; totalDocsCount: number; totalTasks: number;
    completedTasks: number; overdueTasks: number; completedPct: number; overduePct: number;
    pendingTasks: number;
    donut: { label: string; value: number; color: string }[];
    donutTotal: number;
    chartSeries: { label: string; color: string; data: number[] }[];
    chartLabels: string[];
    selectedMonth: { year: number; month: number };
    setSelectedMonth: (m: { year: number; month: number }) => void;
    showChartMonthPicker: boolean;
    setShowChartMonthPicker: (fn: (v: boolean) => boolean) => void;
    myTasksTab: any; setMyTasksTab: any;
    tabTasks: DashboardTask[]; upcoming: DashboardTask[];
    inProgressMy: DashboardTask[]; overdueMy: DashboardTask[]; completedMy: DashboardTask[];
    recentActivity: Document[];
    getFileBadge: (name: string) => { label: string; color: string; bg: string };
    handleDocumentClick: (doc: Document) => void;
    projectsOverview: any[];
    navigate: (path: string) => void;
    projectsLoading: boolean; documentsLoading: boolean; tasksLoading: boolean;
  };
  onRemove: (id: string) => void;
  onResize: (id: string, size: WidgetSize) => void;
}

const SIZE_LABELS: Record<WidgetSize, string> = { sm: 'Small', md: 'Medium', lg: 'Large' };
const SIZE_OPTIONS: WidgetSize[] = ['sm', 'md', 'lg'];

export function WidgetRenderer({ widget, isEditMode, isDragging, db, onRemove, onResize }: WidgetRendererProps) {
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const sizeRef = useRef<HTMLDivElement>(null);

  WIDGET_META.find(m => m.type === widget.type);

  const renderContent = () => {
    switch (widget.type) {
      case 'stat_projects':
        return <StatCard label="Total Projects" value={db.totalProjects} change={`${db.totalProjects} total`} sub="active" up={true} color={STAT_COLORS.projects} icon={<FolderKanban size={16} color={STAT_COLORS.projects} />} sparkData={[2,3,4,5,6,7,8,db.totalProjects||9]} isLoading={db.projectsLoading} />;
      case 'stat_documents':
        return <StatCard label="Total Documents" value={db.totalDocsCount} change={`${db.totalDocsCount} total`} sub="all time" up={true} color={STAT_COLORS.documents} icon={<FileText size={16} color={STAT_COLORS.documents} />} sparkData={[10,15,20,30,35,40,50,db.totalDocsCount||1]} isLoading={db.documentsLoading} />;
      case 'stat_tasks':
        return <StatCard label="Total Tasks" value={db.totalTasks} change={`${db.pendingTasks} pending`} sub={`tasks`} up={true} color={STAT_COLORS.tasks} icon={<CheckCircle size={16} color={STAT_COLORS.tasks} />} sparkData={[1,2,3,4,5,6,7,db.totalTasks||9]} isLoading={db.tasksLoading} />;
      case 'stat_completed':
        return <StatCard label="Completed" value={db.completedTasks} change={`${db.completedPct}% done`} sub="of total" up={true} color={STAT_COLORS.completed} icon={<CheckCircle size={16} color={STAT_COLORS.completed} />} sparkData={[0,1,1,2,2,2,3,db.completedTasks||3]} isLoading={db.tasksLoading} />;
      case 'stat_overdue':
        return <StatCard label="Overdue Tasks" value={db.overdueTasks} change={`${db.overduePct}% of total`} sub="vs. total tasks" up={db.overdueTasks===0} color={STAT_COLORS.overdue} icon={<AlertTriangle size={16} color={STAT_COLORS.overdue} />} sparkData={[5,5,4,4,3,3,3,db.overdueTasks||2]} isLoading={db.tasksLoading} />;
      case 'donut_chart':
        return <TasksDonutCard donut={db.donut} donutTotal={db.donutTotal} isLoading={db.tasksLoading} />;
      case 'line_chart':
        return <TasksLineChartCard chartSeries={db.chartSeries} chartLabels={db.chartLabels} selectedMonth={db.selectedMonth} setSelectedMonth={db.setSelectedMonth} showChartMonthPicker={db.showChartMonthPicker} setShowChartMonthPicker={db.setShowChartMonthPicker} isLoading={db.tasksLoading} />;
      case 'my_tasks':
        return <MyTasksPanel myTasksTab={db.myTasksTab} setMyTasksTab={db.setMyTasksTab} tabTasks={db.tabTasks} upcoming={db.upcoming} inProgressMy={db.inProgressMy} overdueMy={db.overdueMy} completedMy={db.completedMy} navigate={db.navigate} isLoading={db.tasksLoading} />;
      case 'recent_activity':
        return <RecentActivityPanel recentActivity={db.recentActivity} getFileBadge={db.getFileBadge} handleDocumentClick={db.handleDocumentClick} isLoading={db.documentsLoading} />;
      case 'projects_table':
        return <ProjectsOverviewTable projectsOverview={db.projectsOverview} navigate={db.navigate} isLoading={db.projectsLoading} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ position: 'relative', opacity: isDragging ? 0.5 : 1 }}>
      {/* Edit mode overlay controls */}
      {isEditMode && (
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {/* Size toggle */}
          <div ref={sizeRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSizeMenu(v => !v)}
              style={{
                height: 26, padding: '0 8px', borderRadius: 6,
                border: `1px solid ${LINE}`, background: 'hsl(var(--card))',
                fontSize: 11, fontWeight: 600, color: TEXT,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: 'inherit',
              }}
            >
              {SIZE_LABELS[widget.size]}
              <ChevronDown size={10} color={MUTED} />
            </button>
            {showSizeMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={() => setShowSizeMenu(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 2,
                  background: 'hsl(var(--popover))', border: `1px solid ${LINE}`, borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(16,24,40,.10)', overflow: 'hidden', minWidth: 100,
                }}>
                  {SIZE_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => { onResize(widget.id, s); setShowSizeMenu(false); }}
                      style={{
                        width: '100%', padding: '8px 12px', border: 'none',
                        background: widget.size === s ? `${BLUE}18` : 'transparent',
                        color: widget.size === s ? BLUE : TEXT,
                        fontSize: 13, fontWeight: widget.size === s ? 600 : 400,
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      }}
                    >
                      {SIZE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Remove */}
          <button
            onClick={() => onRemove(widget.id)}
            title="Remove widget"
            style={{
              width: 26, height: 26, borderRadius: 6,
              border: `1px solid #FECACA`, background: '#FEF2F2',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={12} color="#EF4444" />
          </button>
        </div>
      )}

      {/* Drag handle — edit mode only */}
      {isEditMode && (
        <div
          className="widget-drag-handle"
          style={{
            position: 'absolute', top: 8, left: 8, zIndex: 10,
            cursor: 'grab', padding: 4,
            color: MUTED, opacity: 0.6,
          }}
        >
          <GripVertical size={14} />
        </div>
      )}

      {/* Widget content */}
      <div style={{
        outline: isEditMode ? `2px dashed ${LINE}` : 'none',
        borderRadius: 12,
        pointerEvents: isEditMode ? 'none' : 'auto',
        userSelect: isEditMode ? 'none' : 'auto',
      }}>
        {renderContent()}
      </div>
    </div>
  );
}