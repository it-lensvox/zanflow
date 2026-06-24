import React from 'react';
import { Search, Plus, List, Grid3X3, Network, X, FolderKanban, Folder, ChevronDown, Check } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { CreateProjectModal } from './CreateProjectModal';
import { useProjects } from './hooks/useProjects';
import { BLUE, LINE, TEXT, MUTED, STATUS_MAP, TREE_GROUPS, getTypeHex, getTypeBg } from './projectConstants';
import { TreePanel }        from './components/TreePanel';
import { BulkToolbar }      from './components/BulkToolbar';
import { DetailPanel }      from './components/DetailPanel';
import { ProjectGridCard }  from './components/ProjectGridCard';
import { MoveProjectModal } from './components/MoveProjectModal';
import { StatusPill, TypePill, MemberAvatars } from './components/ProjectPills';

const th: React.CSSProperties = { textAlign: 'left', color: '#344054', fontSize: 14, fontWeight: 700, padding: '14px 16px', borderBottom: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, background: '#f9fafb', whiteSpace: 'nowrap' as const };
const td: React.CSSProperties = { padding: '14px 16px', borderBottom: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, verticalAlign: 'middle', fontSize: 14, color: TEXT };

const STATUS_OPTIONS = [
  { value: '',          label: 'Status',    dot: '' },
  { value: 'active',    label: 'Active',    dot: '#09925e' },
  { value: 'in_review', label: 'In Review', dot: '#b86600' },
  { value: 'draft',     label: 'Draft',     dot: '#475467' },
  { value: 'archived',  label: 'Archived',  dot: '#475467' },
];

const TYPE_OPTIONS = [
  { value: '',                 label: 'All Types' },
  { value: 'client',           label: 'Client' },
  { value: 'internal',         label: 'Internal' },
  { value: 'content_creation', label: 'Content Creation' },
  { value: 'ideas',            label: 'Ideas' },
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
                    <span style={{ flex: 1 }}>{opt.label}</span>
                    {p.typeFilter === opt.value && <Check size={14} color={BLUE} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ height: 40, border: `1px solid ${LINE}`, borderRadius: 8, display: 'flex', alignItems: 'center', padding: 3, gap: 2, flexShrink: 0 }}>
            {([['list', List, 'List'], ['grid', Grid3X3, 'Grid'], ['tree', Network, 'Tree']] as [string, any, string][]).map(([m, Icon, label]) => (
              <button key={m} onClick={() => p.setViewMode(m as any)} title={label} style={{ height: 32, padding: '0 10px', borderRadius: 6, border: p.viewMode === m ? '1px solid #a7c1ff' : 'none', background: p.viewMode === m ? '#f5f8ff' : 'transparent', color: p.viewMode === m ? BLUE : MUTED, fontWeight: p.viewMode === m ? 800 : 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
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

          <BulkToolbar count={p.selectedIds.size} onClear={() => p.setSelectedIds(new Set())} onDelete={() => {}} onMove={() => p.setShowMoveModal(true)} />

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
                            <input type="checkbox" checked={isSel} onChange={() => p.toggleSelect(proj.id)} onClick={e => e.stopPropagation()} style={{ accentColor: color, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                            <div style={{ width: 32, height: 32, borderRadius: 7, background: tint, border: `1.5px solid ${color}33`, display: 'grid', placeItems: 'center', color: color, fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{proj.name[0].toUpperCase()}</div>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ ...th, width: 40 }}><input type="checkbox" checked={p.selectedIds.size === p.paginated.length && p.paginated.length > 0} onChange={p.toggleAll} style={{ accentColor: BLUE, width: 15, height: 15, cursor: 'pointer' }} /></th>
                    <th style={th}>Project</th><th style={th}>Type</th><th style={th}>Documents</th><th style={th}>Members</th><th style={th}>Status</th><th style={th}>Updated ↓</th><th style={{ ...th, textAlign: 'center' }}>Favorite</th>
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
                        <td style={{ ...td, width: 40 }}><input type="checkbox" checked={isSel} onChange={() => p.toggleSelect(proj.id)} onClick={e => e.stopPropagation()} style={{ accentColor: color, width: 15, height: 15, cursor: 'pointer' }} /></td>
                        <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 30, height: 30, borderRadius: 7, background: tint, border: `1.5px solid ${color}33`, display: 'grid', placeItems: 'center', color: color, fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{proj.name[0].toUpperCase()}</div><span style={{ color: TEXT, fontWeight: 500 }}>{proj.name}</span></div></td>
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
            <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderTop: `1px solid ${LINE}`, background: '#fff', flexShrink: 0, fontSize: 12, color: TEXT }}>
              <span>Showing {Math.min((p.currentPage - 1) * p.rowsPerPage + 1, p.filtered.length)}–{Math.min(p.currentPage * p.rowsPerPage, p.filtered.length)} of {p.filtered.length} projects</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => p.setCurrentPage(prev => Math.max(1, prev - 1))} disabled={p.currentPage === 1} style={{ height: 31, minWidth: 31, border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', cursor: p.currentPage === 1 ? 'not-allowed' : 'pointer', color: p.currentPage === 1 ? '#d1d5db' : MUTED, fontWeight: 600, display: 'grid', placeItems: 'center' }}>‹</button>
                {Array.from({ length: Math.min(5, p.totalPages) }, (_, i) => i + 1).map(pg => (
                  <button key={pg} onClick={() => p.setCurrentPage(pg)} style={{ height: 31, minWidth: 31, border: `1px solid ${p.currentPage === pg ? '#88acff' : LINE}`, borderRadius: 6, background: p.currentPage === pg ? '#f6f9ff' : '#fff', color: p.currentPage === pg ? BLUE : MUTED, fontWeight: 600, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{pg}</button>
                ))}
                <button onClick={() => p.setCurrentPage(prev => Math.min(p.totalPages, prev + 1))} disabled={p.currentPage === p.totalPages} style={{ height: 31, minWidth: 31, border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', cursor: p.currentPage === p.totalPages ? 'not-allowed' : 'pointer', color: p.currentPage === p.totalPages ? '#d1d5db' : MUTED, fontWeight: 600, display: 'grid', placeItems: 'center' }}>›</button>
              </div>
            </div>
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