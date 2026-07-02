import { X, BarChart2, PieChart, TrendingUp, CheckSquare, Clock, Table2, FolderKanban, FileText, AlertTriangle } from 'lucide-react';
import { BLUE, LINE, TEXT, MUTED, BG } from '../../index';
import type { WidgetType, WidgetSize } from '@/types';

interface WidgetMeta {
  type: WidgetType;
  label: string;
  sub: string;
  icon: React.ReactNode;
  defaultSize: WidgetSize;
}

export const WIDGET_META: WidgetMeta[] = [
  { type: 'stat_projects',   label: 'Total projects',   sub: 'Count with sparkline',      icon: <FolderKanban size={16} />,  defaultSize: 'sm' },
  { type: 'stat_documents',  label: 'Total documents',  sub: 'Count with sparkline',      icon: <FileText size={16} />,      defaultSize: 'sm' },
  { type: 'stat_tasks',      label: 'Total tasks',      sub: 'Count with sparkline',      icon: <CheckSquare size={16} />,   defaultSize: 'sm' },
  { type: 'stat_completed',  label: 'Completed tasks',  sub: 'Count with sparkline',      icon: <CheckSquare size={16} />,   defaultSize: 'sm' },
  { type: 'stat_overdue',    label: 'Overdue tasks',    sub: 'Count with sparkline',      icon: <AlertTriangle size={16} />, defaultSize: 'sm' },
  { type: 'donut_chart',     label: 'Tasks by status',  sub: 'Donut chart breakdown',     icon: <PieChart size={16} />,      defaultSize: 'md' },
  { type: 'line_chart',      label: 'Task trends',      sub: 'Monthly line chart',        icon: <TrendingUp size={16} />,    defaultSize: 'md' },
  { type: 'my_tasks',        label: 'My tasks',         sub: 'Upcoming, overdue & done',  icon: <Clock size={16} />,         defaultSize: 'md' },
  { type: 'recent_activity', label: 'Recent activity',  sub: 'Latest document activity',  icon: <BarChart2 size={16} />,     defaultSize: 'md' },
  { type: 'projects_table',  label: 'Projects overview',sub: 'Progress & team table',     icon: <Table2 size={16} />,        defaultSize: 'lg' },
];

const STAT_WIDGETS: WidgetType[] = ['stat_projects','stat_documents','stat_tasks','stat_completed','stat_overdue'];

interface Props {
  onClose: () => void;
  onAdd: (type: WidgetType, size: WidgetSize) => void;
  existingTypes: WidgetType[];
}

export function WidgetPicker({ onClose, onAdd, existingTypes }: Props) {
  const stats = WIDGET_META.filter(w => STAT_WIDGETS.includes(w.type));
  const charts = WIDGET_META.filter(w => !STAT_WIDGETS.includes(w.type));

  const renderGroup = (label: string, items: WidgetMeta[]) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(w => {
          const added = existingTypes.includes(w.type);
          return (
            <button
              key={w.type}
              onClick={() => !added && onAdd(w.type, w.defaultSize)}
              disabled={added}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                border: `1px solid ${added ? '#EEF3FF' : LINE}`,
                background: added ? '#F7F9FF' : '#fff',
                cursor: added ? 'default' : 'pointer',
                fontFamily: 'inherit', textAlign: 'left',
                opacity: added ? 0.6 : 1,
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (!added) e.currentTarget.style.background = BG; }}
              onMouseLeave={e => { if (!added) e.currentTarget.style.background = '#fff'; }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: added ? '#EEF4FF' : BG,
                color: added ? BLUE : MUTED,
              }}>
                {w.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{w.label}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{w.sub}</div>
              </div>
              {added ? (
                <span style={{ fontSize: 11, color: BLUE, fontWeight: 600, flexShrink: 0 }}>Added</span>
              ) : (
                <span style={{ fontSize: 18, color: MUTED, lineHeight: 1, flexShrink: 0 }}>+</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    // Slide-in panel — right side on desktop, bottom sheet feel on mobile
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Dim overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,24,40,0.20)' }} onClick={onClose} />

      {/* Panel */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 320,
        height: '100%', background: '#fff',
        borderLeft: `1px solid ${LINE}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(16,24,40,0.10)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px', borderBottom: `1px solid ${LINE}`, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Add widgets</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Click to add to your dashboard</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: `1px solid ${LINE}`, background: '#fff',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} color={MUTED} />
          </button>
        </div>

        {/* Widget list — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {renderGroup('STAT CARDS', stats)}
          {renderGroup('CHARTS & PANELS', charts)}
        </div>
      </div>
    </div>
  );
}