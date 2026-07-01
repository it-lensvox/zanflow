import { Search, Plus, Sparkles } from 'lucide-react';
import { LINE, TEXT, MUTED, BLUE } from '../taskBoardConstants';
import { ViewToggle } from '@/components/layout/DualView';
import type { ViewMode } from '@/components/layout/DualView';

interface TaskBoardHeaderProps {
  searchQuery:    string;
  setSearchQuery: (v: string) => void;
  viewMode:       'grid' | 'table';
  setViewMode:    (v: 'grid' | 'table') => void;
  canCreate:      boolean;
  onCreateTask:   () => void;
  onAITask:       () => void;
}

export function TaskBoardHeader({
  searchQuery, setSearchQuery,
  viewMode, setViewMode,
  canCreate, onCreateTask, onAITask,
}: TaskBoardHeaderProps) {
  return (
    <div
      className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
      style={{
        flexShrink: 0,
        background: '#fff',
        borderBottom: `1px solid ${LINE}`,
        paddingTop: 16, paddingBottom: 16,
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT, letterSpacing: '-.02em' }}>
            Task Board
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 16, color: MUTED }}>
            Manage and track your tasks efficiently
          </p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2 flex-wrap" style={{ paddingTop: 4 }}>
            <button onClick={onAITask} style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap' }}>
              <Sparkles size={15} color="#8B5CF6" />Generate by AI
            </button>
            <button onClick={onCreateTask} style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', border: 'none', borderRadius: 8, background: BLUE, cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
              <Plus size={15} />New Task
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div style={{ flex: 1, minWidth: 0, height: 40, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
          <Search size={16} color={MUTED} style={{ flexShrink: 0 }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tasks by name, status, priority…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, color: TEXT, background: 'transparent', fontFamily: 'inherit', minWidth: 0 }} />
        </div>
        <ViewToggle
          viewMode={viewMode as ViewMode}
          onViewModeChange={v => setViewMode(v as 'grid' | 'table')}
          modes={['table', 'grid']}
        />
      </div>
    </div>
  );
}