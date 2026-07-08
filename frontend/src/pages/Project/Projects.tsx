import React from 'react';
import { Search, Plus, X, FolderKanban, Folder, ChevronDown, Check, Move, Settings, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal } from 'lucide-react';
import { ViewToggle } from '@/components/layout/DualView';
import { Pagination } from '@/components/ui/Pagination';
import { formatRelativeTime } from '@/lib/utils';
import { CreateProjectModal } from './CreateProjectModal';
import { useProjects } from './hooks/useProjects';
import { BLUE, LINE, TEXT, MUTED, STATUS_MAP, TREE_GROUPS, getTypeHex, getTypeBg, PROJECT_TYPE_HEX } from './projectConstants';
import { TreePanel }        from './components/TreePanel';
import { BulkToolbar } from '@/components/ui/BulkToolbar';
import { DetailPanel }      from './components/DetailPanel';
import { ProjectGridCard }  from './components/ProjectGridCard';
import { MoveProjectModal } from './components/MoveProjectModal';
import { StatusPill, TypePill, MemberAvatars } from './components/ProjectPills';
import { SearchFilter, ListFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { PROJECT_TYPE_OPTIONS } from '@/config/projectTypeConfig';

/** Compact ellipsis menu — reused in both table rows and grid cards */
function ProjectEllipsisMenu({ onOpen, onFav, isFav }: { onOpen: () => void; onFav: (e: React.MouseEvent) => void; isFav: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, color: MUTED, display: 'flex', alignItems: 'center', opacity: 0 }}
        className="group-hover/row:opacity-100 transition-opacity"
        onMouseEnter={e => { e.currentTarget.style.background = '#F7F8FB'; e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'none'; e.currentTarget.style.opacity = ''; } }}
        title="More options"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 200, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(16,24,40,.12)', minWidth: 148, overflow: 'hidden' }}>
            {[
              { label: 'Open Project', action: (e: React.MouseEvent) => { e.stopPropagation(); setOpen(false); onOpen(); } },
              { label: isFav ? 'Remove Favourite' : 'Add to Favourites', action: (e: React.MouseEvent) => { setOpen(false); onFav(e); } },
            ].map(item => (
              <button key={item.label} onClick={item.action}
                style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: TEXT, textAlign: 'left', fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', color: '#172033', fontSize: 14, fontWeight: 800, padding: '14px 16px', borderBottom: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, background: '#f9fafb', whiteSpace: 'nowrap' as const, position: 'sticky', top: 0, zIndex: 1 };
const td: React.CSSProperties = { padding: '14px 16px', borderBottom: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, verticalAlign: 'middle', fontSize: 14, color: TEXT };

// ── Reusable sortable + filterable column header 
function ProjectThHeader({
  label,
  columnKey,
  sortConfig,
  onSort,
  onFilter,
  activeFilterKey,
  filterContent,
  filterContainerRef,
  style: extraStyle,
}: {
  label: string;
  columnKey: string;
  sortConfig: { key: string; direction: 'asc' | 'desc' | null };
  onSort?: (key: string) => void;
  onFilter?: (key: string) => void;
  activeFilterKey: string | null;
  filterContent?: React.ReactNode;
  filterContainerRef?: React.RefObject<HTMLDivElement>;
  style?: React.CSSProperties;
}) {
  const isActive = activeFilterKey === columnKey;
  const isSorted = sortConfig.key === columnKey;
  const filterType = onFilter ? (filterContent ? 'search' : 'none') : 'none';

  const SortIcon = isSorted
    ? sortConfig.direction === 'asc' ? ArrowUp : ArrowDown
    : ArrowUpDown;

  // Sort + filter icon controls — shown on hover or when active
  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      {onSort && (
        <button
          onClick={e => { e.stopPropagation(); onSort(columnKey); }}
          title={`Sort by ${label}`}
          style={{ background: isSorted ? '#EEF4FF' : 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 4, display: 'flex', alignItems: 'center', color: isSorted ? BLUE : MUTED }}
        >
          <SortIcon size={12} />
        </button>
      )}
      {onFilter && (
        <button
          onClick={e => { e.stopPropagation(); onFilter(columnKey); }}
          title={`Filter by ${label}`}
          style={{ background: isActive ? '#EEF4FF' : 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 4, display: 'flex', alignItems: 'center', color: isActive ? BLUE : MUTED }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <th
      className={`relative ${isActive ? 'z-[100]' : ''}`}
      style={{ ...th, position: 'relative', zIndex: isActive ? 100 : 1, ...extraStyle }}
      ref={isActive ? (filterContainerRef as any) : undefined}
    >
      <FilterHeaderWrapper
        columnLabel={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1 }}>{label}</span>
            {(isSorted || isActive || onSort || onFilter) && controls}
          </div>
        }
        filterType={filterType}
        isActive={isActive}
        filterContent={filterContent}
      >
        {/* children = search input, rendered above the label by FilterHeaderWrapper */}
        {filterContent}
      </FilterHeaderWrapper>
    </th>
  );
}

const STATUS_OPTIONS = [
  { value: '', label: 'Status', dot: '' },
  ...Object.entries(STATUS_MAP).map(([value, cfg]) => ({
    value,
    label: cfg.label,
    dot:   cfg.color,
  })),
];

const TYPE_OPTIONS = [
  { value: '', label: 'All Types', dot: '' },
  ...PROJECT_TYPE_OPTIONS.map(t => ({ value: t.value, label: t.label, dot: t.hex })),
];

export function Projects() {
  const p = useProjects();
  const [showStatusDrop,  setShowStatusDrop]  = React.useState(false);
  const [showTypeDrop,    setShowTypeDrop]    = React.useState(false);

  const statusLabel = STATUS_OPTIONS.find(o => o.value === p.statusFilter)?.label ?? 'Status';
  const typeLabel   = TYPE_OPTIONS.find(o => o.value === p.typeFilter)?.label ?? 'All Types';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', overflow: 'hidden' }}>

     {/* TOP BAR */}
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40" style={{ flexShrink: 0, background: '#fff', borderBottom: `1px solid ${LINE}`, paddingTop: 16, paddingBottom: 16 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT, letterSpacing: '-.04em' }}>Projects</h1>
            <p style={{ margin: '4px 0 0', color: MUTED, fontSize: 14 }}>Manage your projects across teams and clients</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => p.setIsCreateModalOpen(true)} style={{ height: 42, background: BLUE, color: '#fff', border: `1px solid ${BLUE}`, borderRadius: 8, padding: '0 24px', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Plus className="w-4 h-4" />New Project
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ flex: 1, height: 40, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10, minWidth: 0 }}>
            <Search className="w-4 h-4" style={{ color: MUTED, flexShrink: 0 }} />
            <input value={p.searchTerm} onChange={e => p.setSearchTerm(e.target.value)} placeholder="Search projects by name or client..." style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: TEXT, fontFamily: 'inherit', background: 'transparent', minWidth: 0 }} />
            <span style={{ background: '#f5f7fb', border: '1px solid #e3e8ef', borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 700, color: MUTED, flexShrink: 0 }}>⌘ K</span>
          </div>
          {/* ── Status dropdown ── */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {showStatusDrop && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowStatusDrop(false)} />}
            <button
              onClick={() => { setShowStatusDrop(v => !v); setShowTypeDrop(false); }}
              style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', border: `1px solid ${showStatusDrop ? BLUE : LINE}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: p.statusFilter ? TEXT : MUTED, whiteSpace: 'nowrap', minWidth: 100 }}
            >
              {p.statusFilter && STATUS_OPTIONS.find(o => o.value === p.statusFilter)?.dot && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_OPTIONS.find(o => o.value === p.statusFilter)?.dot, flexShrink: 0 }} />
              )}
              {statusLabel}
              <ChevronDown size={14} color={MUTED} style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: showStatusDrop ? 'rotate(180deg)' : 'none' }} />
            </button>
            {showStatusDrop && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(16,24,40,.12)', minWidth: 160, overflow: 'hidden', padding: '4px 0' }}>
                {STATUS_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { p.setStatusFilter(opt.value); setShowStatusDrop(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: p.statusFilter === opt.value ? '#EEF4FF' : 'transparent', cursor: 'pointer', fontSize: 16, fontWeight: p.statusFilter === opt.value ? 700 : 500, color: p.statusFilter === opt.value ? BLUE : TEXT, textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.12s' }}
                    onMouseEnter={e => { if (p.statusFilter !== opt.value) e.currentTarget.style.background = '#F7F8FB'; }}
                    onMouseLeave={e => { if (p.statusFilter !== opt.value) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {opt.dot ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.dot, flexShrink: 0 }} /> : <span style={{ width: 8 }} />}
                    <span style={{ flex: 1 }}>{opt.label}</span>
                    {p.statusFilter === opt.value && <Check size={14} color={BLUE} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Type dropdown ── */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {showTypeDrop && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowTypeDrop(false)} />}
            <button
              onClick={() => { setShowTypeDrop(v => !v); setShowStatusDrop(false); }}
              style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', border: `1px solid ${showTypeDrop ? BLUE : LINE}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: p.typeFilter ? TEXT : MUTED, whiteSpace: 'nowrap', minWidth: 120 }}
            >
              {p.typeFilter && TYPE_OPTIONS.find(o => o.value === p.typeFilter)?.dot && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_OPTIONS.find(o => o.value === p.typeFilter)?.dot, flexShrink: 0 }} />
              )}
              {typeLabel}
              <ChevronDown size={14} color={MUTED} style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: showTypeDrop ? 'rotate(180deg)' : 'none' }} />
            </button>
            {showTypeDrop && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(16,24,40,.12)', minWidth: 180, overflow: 'hidden', padding: '4px 0' }}>
                {TYPE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { p.setTypeFilter(opt.value); setShowTypeDrop(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: p.typeFilter === opt.value ? '#EEF4FF' : 'transparent', cursor: 'pointer', fontSize: 16, fontWeight: p.typeFilter === opt.value ? 700 : 500, color: p.typeFilter === opt.value ? BLUE : TEXT, textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.12s' }}
                    onMouseEnter={e => { if (p.typeFilter !== opt.value) e.currentTarget.style.background = '#F7F8FB'; }}
                    onMouseLeave={e => { if (p.typeFilter !== opt.value) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {opt.dot ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.dot, flexShrink: 0 }} /> : <span style={{ width: 8 }} />}
                    <span style={{ flex: 1 }}>{opt.label}</span>
                    {p.typeFilter === opt.value && <Check size={14} color={BLUE} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ViewToggle
            viewMode={p.viewMode as any}
            onViewModeChange={v => p.setViewMode(v as any)}
            modes={['table', 'grid', 'tree']}
          />
        </div>

        {(p.statusFilter || p.typeFilter || p.searchTerm) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <b>Active Filters:</b>
            {p.statusFilter && <span style={{ height: 28, borderRadius: 6, padding: '0 11px', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, border: '1px solid #cfe0ff', background: '#eef4ff', color: BLUE }}>Status: {STATUS_MAP[p.statusFilter]?.label ?? p.statusFilter}<X className="w-3 h-3 cursor-pointer" onClick={() => p.setStatusFilter('')} /></span>}
            {p.typeFilter && <span style={{ height: 28, borderRadius: 6, padding: '0 11px', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, border: '1px solid #e0d2ff', background: '#f5efff', color: '#7848dc' }}>Type: {p.typeFilter}<X className="w-3 h-3 cursor-pointer" onClick={() => p.setTypeFilter('')} /></span>}
            {p.searchTerm && <span style={{ height: 28, borderRadius: 6, padding: '0 11px', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, border: '1px solid #c6efd8', background: '#eafaf3', color: '#087a4a' }}>Search: "{p.searchTerm}"<X className="w-3 h-3 cursor-pointer" onClick={() => p.setSearchTerm('')} /></span>}
            <span onClick={p.clearAllFilters} style={{ color: BLUE, fontWeight: 700, cursor: 'pointer' }}>Clear all</span>
          </div>
        )}
      </div>

      {/* WORKSPACE */}
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        <TreePanel projects={p.allProjects} selected={p.treeFilter} selectedGroup={p.treeGroupFilter} onSelect={p.handleTreeSelect} onSelectGroup={p.handleTreeGroupSelect} isOpen={p.treeOpen} onToggle={p.setTreeOpen} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          <BulkToolbar
            count={p.selectedIds.size}
            onClear={() => p.setSelectedIds(new Set())}
            emptyHint="Select projects to perform bulk actions"
          >
            <button onClick={() => p.setShowMoveModal(true)} style={{ height: 34, border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', padding: '0 14px', fontSize: 16, fontWeight: 600, display: 'inline-flex', gap: 7, alignItems: 'center', cursor: 'pointer', color: TEXT }}>
              <Move size={14} />Move
            </button>
            <button
              onClick={() => {
                const firstSelectedId = [...p.selectedIds][0];
                if (firstSelectedId) p.navigate(`/projects/${firstSelectedId}/settings`);
              }}
              style={{ height: 34, border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', padding: '0 14px', fontSize: 16, fontWeight: 600, display: 'inline-flex', gap: 7, alignItems: 'center', cursor: 'pointer', color: TEXT }}
            >
              <Settings size={14} />Edit
            </button>
          </BulkToolbar>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {p.isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #e5e7eb', borderTop: `4px solid ${BLUE}`, animation: 'spin 1s linear infinite' }} />
                <span style={{ color: MUTED, fontSize: 14, fontWeight: 500 }}>Loading projects...</span>
              </div>

            ) : p.viewMode === 'tree' ? (
              <div style={{ padding: 20 }}>
                {TREE_GROUPS.map(group => {
                  const groupProjects = p.filtered.filter(proj => group.types.includes(((proj as any).task_type || '').toLowerCase()));
                  if (groupProjects.length === 0) return null;
                  return (
                    <div key={group.label} style={{ marginBottom: 16, border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#f9fafb', borderBottom: `1px solid ${LINE}` }}>
                        <Folder className="w-4 h-4" style={{ color: group.color }} />
                        <span style={{ fontWeight: 700, fontSize: 14, color: TEXT, flex: 1 }}>{group.label}</span>
                        <span style={{ fontSize: 12, color: MUTED, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>{groupProjects.length} {groupProjects.length === 1 ? 'project' : 'projects'}</span>
                      </div>
                      {groupProjects.map((proj, idx) => {
                        const color = getTypeHex((proj as any).task_type); const tint = getTypeBg((proj as any).task_type); const members = (proj as any).members || []; const isSel = p.selectedIds.has(proj.id);
                        return (
                          <div key={proj.id} onClick={() => p.handleDetailProject(proj)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: idx < groupProjects.length - 1 ? `1px solid ${LINE}` : 'none', background: isSel ? '#f7faff' : '#fff', cursor: 'pointer', paddingLeft: 36, minHeight: 56 }} onMouseOver={e => { if (!isSel) e.currentTarget.style.background = '#f3f4f6'; }} onMouseOut={e => { e.currentTarget.style.background = isSel ? '#f7faff' : '#fff'; }}>
                            <div
                              onClick={e => { e.stopPropagation(); p.toggleSelect(proj.id); }}
                              title={isSel ? 'Deselect' : 'Select'}
                              style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, cursor: 'pointer' }}
                            >
                              <div style={{
                                width: 32, height: 32, borderRadius: 7,
                                background: isSel ? color : tint,
                                border: isSel ? `1.5px solid ${color}` : `1.5px solid ${color}33`,
                                display: 'grid', placeItems: 'center',
                                color: isSel ? '#fff' : color,
                                fontWeight: 800, fontSize: 14,
                                transition: 'background 0.15s, color 0.15s',
                              }}>
                                {isSel ? <Check size={14} strokeWidth={3} /> : proj.name[0].toUpperCase()}
                              </div>
                              {!isSel && (
                                <div style={{
                                  position: 'absolute', inset: 0, borderRadius: 7,
                                  background: `${color}cc`, display: 'grid', placeItems: 'center',
                                  opacity: 0, transition: 'opacity 0.15s',
                                }}
                                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                  onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                                >
                                  <Check size={14} color="#fff" strokeWidth={3} />
                                </div>
                              )}
                            </div>
                            <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
                            <span style={{ fontSize: 13, color: MUTED, minWidth: 70 }}>{(proj as any).document_count ?? 0} docs</span>
                            <div style={{ minWidth: 90 }}><MemberAvatars members={members} /></div>
                            <div style={{ minWidth: 100 }}><StatusPill status={(proj as any).status} /></div>
                            <span style={{ fontSize: 13, color: MUTED, minWidth: 90 }}>{formatRelativeTime(proj.updated_at || '')}</span>
                            <button onClick={e => p.toggleFavorite(e, proj)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>{(proj as any).is_favourite ? <span style={{ color: '#f59e0b' }}>★</span> : <span style={{ color: '#d1d5db' }}>☆</span>}</button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {(() => {
                  const knownTypes = TREE_GROUPS.flatMap(g => g.types);
                  const ungrouped = p.filtered.filter(proj => !knownTypes.includes(((proj as any).task_type || '').toLowerCase()));
                  if (ungrouped.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 16, border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#f9fafb', borderBottom: `1px solid ${LINE}` }}>
                        <Folder className="w-4 h-4" style={{ color: MUTED }} />
                        <span style={{ fontWeight: 700, fontSize: 14, color: TEXT, flex: 1 }}>Other Projects</span>
                        <span style={{ fontSize: 12, color: MUTED, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>{ungrouped.length}</span>
                      </div>
                      {ungrouped.map((proj, idx) => {
                        const color = getTypeHex((proj as any).task_type); const tint = getTypeBg((proj as any).task_type); const members = (proj as any).members || []; const isSel = p.selectedIds.has(proj.id);
                        return (
                          <div key={proj.id} onClick={() => p.handleDetailProject(proj)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: idx < ungrouped.length - 1 ? `1px solid ${LINE}` : 'none', background: isSel ? '#f7faff' : '#fff', cursor: 'pointer', paddingLeft: 36, minHeight: 56 }} onMouseOver={e => { if (!isSel) e.currentTarget.style.background = '#f3f4f6'; }} onMouseOut={e => { e.currentTarget.style.background = isSel ? '#f7faff' : '#fff'; }}>
                            <input type="checkbox" checked={isSel} onChange={() => p.toggleSelect(proj.id)} onClick={e => e.stopPropagation()} style={{ accentColor: color, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                            <div style={{ width: 32, height: 32, borderRadius: 7, background: tint, border: `1.5px solid ${color}33`, display: 'grid', placeItems: 'center', color: color, fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{proj.name[0].toUpperCase()}</div>
                            <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: TEXT }}>{proj.name}</span>
                            <span style={{ fontSize: 13, color: MUTED, minWidth: 70 }}>{(proj as any).document_count ?? 0} docs</span>
                            <div style={{ minWidth: 90 }}><MemberAvatars members={members} /></div>
                            <div style={{ minWidth: 100 }}><StatusPill status={(proj as any).status} /></div>
                            <span style={{ fontSize: 13, color: MUTED, minWidth: 90 }}>{formatRelativeTime(proj.updated_at || '')}</span>
                            <button onClick={e => p.toggleFavorite(e, proj)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>{(proj as any).is_favourite ? <span style={{ color: '#f59e0b' }}>★</span> : <span style={{ color: '#d1d5db' }}>☆</span>}</button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

           ) : p.viewMode === 'grid' ? (
              <div style={{ display: 'grid', gap: 16, padding: 20 }} className="project-grid">
                {p.paginated.length === 0
                  ? <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: MUTED }}><FolderKanban style={{ margin: '0 auto 12px', opacity: 0.3, width: 48, height: 48 }} /><p>No projects found</p></div>
                  : p.paginated.map(proj => (
                    <ProjectGridCard key={proj.id} project={proj} selected={p.selectedIds.has(proj.id)} onSelect={e => { e.stopPropagation(); p.toggleSelect(proj.id); }} onFav={e => p.toggleFavorite(e, proj)} onClick={() => { p.handleDetailProject(proj); p.navigate(`/projects/${proj.id}`); }} />
                  ))
                }
              </div>

            ) : (
              <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ ...th, width: 44, minWidth: 44, maxWidth: 44, textAlign: 'center', padding: '14px 4px' }}>
                      <input type="checkbox" checked={p.selectedIds.size === p.paginated.length && p.paginated.length > 0} onChange={p.toggleAll} style={{ accentColor: BLUE, width: 15, height: 15, cursor: 'pointer' }} />
                    </th>
                    <ProjectThHeader
                      label="Project"
                      columnKey="name"
                      sortConfig={p.sortConfig}
                      onSort={p.handleTableSort}
                      onFilter={p.handleFilter}
                      activeFilterKey={p.activeFilterKey}
                      filterContainerRef={p.filterContainerRef}
                      style={{ width: 'auto', minWidth: 200 }}
                      filterContent={
                        <SearchFilter
                          columnKey="name"
                          placeholder="Search by name..."
                          value={p.columnFilters['name'] || ''}
                          onChange={v => p.setColumnFilters(prev => ({ ...prev, name: v }))}
                          isActive={p.activeFilterKey === 'name'}
                        />
                      }
                    />
                    <ProjectThHeader
                      label="Type"
                      columnKey="task_type"
                      sortConfig={p.sortConfig}
                      onSort={p.handleTableSort}
                      onFilter={p.handleFilter}
                      activeFilterKey={p.activeFilterKey}
                      filterContainerRef={p.filterContainerRef}
                      style={{ width: '12%', minWidth: 110 }}
                      filterContent={
                        <ListFilter
                          columnKey="task_type"
                          options={[
                            { value: 'client', label: 'Client' },
                            { value: 'internal', label: 'Internal' },
                            { value: 'content_creation', label: 'Content Creation' },
                            { value: 'ideas', label: 'Ideas' },
                          ].map(opt => ({
                            ...opt,
                            icon: (
                              <span style={{
                                display: 'inline-block',
                                width: 8, height: 8, borderRadius: '50%',
                                background: PROJECT_TYPE_HEX[opt.value]?.hex ?? '#667085',
                                flexShrink: 0,
                              }} />
                            ),
                          }))}
                          selectedValue={p.columnFilters['task_type'] || ''}
                          onSelect={v => { p.setColumnFilters(prev => ({ ...prev, task_type: v })); p.setActiveFilterKey(null); }}
                          onClear={() => { p.clearFilter('task_type'); p.setActiveFilterKey(null); }}
                          isActive={p.activeFilterKey === 'task_type'}
                          containerRef={p.filterContainerRef}
                        />
                      }
                    />
                   <ProjectThHeader
                      label="Documents"
                      columnKey="document_count"
                      sortConfig={p.sortConfig}
                      onSort={p.handleTableSort}
                      activeFilterKey={p.activeFilterKey}
                      style={{ width: '9%', minWidth: 80 }}
                    />
                    <th style={{ ...th, width: '11%', minWidth: 100 }}>Members</th>
                    <ProjectThHeader
                      label="Status"
                      columnKey="status"
                      sortConfig={p.sortConfig}
                      onSort={p.handleTableSort}
                      onFilter={p.handleFilter}
                      activeFilterKey={p.activeFilterKey}
                      filterContainerRef={p.filterContainerRef}
                      style={{ width: '10%', minWidth: 90 }}
                      filterContent={
                        <ListFilter
                          columnKey="status"
                          options={Object.entries(STATUS_MAP).map(([value, cfg]) => ({
                            value,
                            label: cfg.label,
                            icon: (
                              <span style={{
                                display: 'inline-block',
                                width: 8, height: 8, borderRadius: '50%',
                                background: cfg.color, flexShrink: 0,
                              }} />
                            ),
                          }))}
                          selectedValue={p.columnFilters['status'] || ''}
                          onSelect={v => { p.setColumnFilters(prev => ({ ...prev, status: v })); p.setActiveFilterKey(null); }}
                          onClear={() => { p.clearFilter('status'); p.setActiveFilterKey(null); }}
                          isActive={p.activeFilterKey === 'status'}
                          containerRef={p.filterContainerRef}
                        />
                      }
                    />
                    <ProjectThHeader
                      label="Updated"
                      columnKey="updated_at"
                      sortConfig={p.sortConfig}
                      onSort={p.handleTableSort}
                      activeFilterKey={p.activeFilterKey}
                      style={{ width: '11%', minWidth: 100 }}
                    />
                    <th style={{ ...th, width: '7%', minWidth: 70, textAlign: 'center' }}>Favorite</th>
                  </tr>
                </thead>
                <tbody>
                  {p.paginated.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: MUTED }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <FolderKanban style={{ opacity: 0.3, width: 48, height: 48 }} />
                        <span style={{ margin: 0, fontSize: 16, fontWeight: 500, color: TEXT }}>No projects found</span>
                        <span>Create your first project to get started</span>
                        <button onClick={() => p.setIsCreateModalOpen(true)} style={{ marginTop: 8, height: 40, background: BLUE, color: '#fff', borderRadius: 8, border: 'none', padding: '0 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>New Project</button>
                      </div>
                    </td></tr>
                  ) : p.paginated.map((proj, idx) => {
                    const color = getTypeHex((proj as any).task_type); const tint = getTypeBg((proj as any).task_type); const members = (proj as any).members || []; const isSel = p.selectedIds.has(proj.id); const isDetail = p.detailProject?.id === proj.id;
                    return (
                      <tr key={proj.id} onClick={() => p.handleDetailProject(proj)} onMouseEnter={() => p.handleRowHover(proj)} style={{ background: isSel ? '#f7faff' : idx % 2 === 0 ? '#fff' : '#fafbfc', cursor: 'pointer', borderLeft: isDetail ? `3px solid ${color}` : '3px solid transparent' }} onMouseOver={e => { if (!isSel && !isDetail) e.currentTarget.style.background = '#f3f4f6'; }} onMouseOut={e => { e.currentTarget.style.background = isSel ? '#f7faff' : idx % 2 === 0 ? '#fff' : '#fafbfc'; }}>
                        <td style={{ ...td, width: 44, minWidth: 44, maxWidth: 44, padding: '14px 4px', textAlign: 'center' }}>
                          {/* Avatar doubles as checkbox  */}
                          <div
                            className="group/avatar"
                            onClick={e => { e.stopPropagation(); p.toggleSelect(proj.id); }}
                            title={isSel ? 'Deselect' : 'Select'}
                            style={{ position: 'relative', width: 30, height: 30, borderRadius: 7, cursor: 'pointer', margin: '0 auto', flexShrink: 0 }}
                          >
                            {/* Base avatar */}
                            <div style={{
                              width: 30, height: 30, borderRadius: 7,
                              background: isSel ? color : tint,
                              border: isSel ? `1.5px solid ${color}` : `1.5px solid ${color}33`,
                              display: 'grid', placeItems: 'center',
                              color: isSel ? '#fff' : color,
                              fontWeight: 800, fontSize: 14,
                              transition: 'background 0.15s, color 0.15s',
                            }}>
                              {isSel
                                ? <Check size={14} strokeWidth={3} />
                                : proj.name[0].toUpperCase()
                              }
                            </div>
                            {/* Hover overlay when not selected */}
                            {!isSel && (
                              <div style={{
                                position: 'absolute', inset: 0, borderRadius: 7,
                                background: `${color}cc`,
                                display: 'grid', placeItems: 'center',
                                opacity: 0, transition: 'opacity 0.15s',
                              }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                              >
                                <Check size={14} color="#fff" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ ...td, position: 'relative' }} className="group/row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: TEXT, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
                            <ProjectEllipsisMenu
                              onOpen={() => { p.handleDetailProject(proj); p.navigate(`/projects/${proj.id}`); }}
                              onFav={e => p.toggleFavorite(e, proj)}
                              isFav={!!(proj as any).is_favourite}
                            />
                          </div>
                        </td>
                        <td style={td}><TypePill type={(proj as any).task_type} /></td>
                        <td style={{ ...td, color: MUTED }}>{(proj as any).document_count ?? 0} docs</td>
                        <td style={td}><MemberAvatars members={members} /></td>
                        <td style={td}><StatusPill status={(proj as any).status} /></td>
                        <td style={{ ...td, color: MUTED }}>{formatRelativeTime(proj.updated_at || '')}</td>
                        <td style={{ ...td, textAlign: 'center' }}><button onClick={e => p.toggleFavorite(e, proj)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>{(proj as any).is_favourite ? <span style={{ color: '#f59e0b' }}>★</span> : <span style={{ color: '#d1d5db' }}>☆</span>}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {p.filtered.length > 0 && (
            <Pagination
              currentPage={p.currentPage}
              totalPages={p.totalPages}
              totalItems={p.filtered.length}
              pageSize={p.rowsPerPage}
              onPageChange={p.setCurrentPage}
              itemLabel="projects"
            />
          )}
        </div>

        {p.detailProject && (
          <div style={{ padding: 12, borderLeft: `1px solid ${LINE}`, overflowY: 'auto', flexShrink: 0 }}>
            <DetailPanel project={p.detailProject} onClose={() => p.handleDetailProject(null)} onOpen={() => p.navigate(`/projects/${p.detailProject!.id}`)} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

        /* Base: 1 column on tiny screens */
        .project-grid { grid-template-columns: repeat(1, 1fr); }

        /* 2 columns: small phones landscape */
        @media (min-width: 480px)  { .project-grid { grid-template-columns: repeat(2, 1fr); } }

        /* 3 columns: tablets */
        @media (min-width: 860px)  { .project-grid { grid-template-columns: repeat(3, 1fr); } }

        /* 4 columns: small desktops */
        @media (min-width: 1200px) { .project-grid { grid-template-columns: repeat(4, 1fr); } }

        /* 5 columns max: large desktops — capped here, never 6 */
        @media (min-width: 1600px) { .project-grid { grid-template-columns: repeat(5, 1fr); } }
      `}</style>

      <CreateProjectModal isOpen={p.isCreateModalOpen} onClose={() => p.setIsCreateModalOpen(false)} navigateOnSuccess={false} />

      {p.showMoveModal && (
        <MoveProjectModal selectedIds={p.selectedIds} projects={p.allProjects} onClose={() => p.setShowMoveModal(false)} onSuccess={() => { p.setShowMoveModal(false); p.setSelectedIds(new Set()); p.queryClient.invalidateQueries({ queryKey: ['projects'] }); }} />
      )}
    </div>
  );
}