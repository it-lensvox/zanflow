import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  FolderKanban, Bell, Search, Plus, Upload, List, Grid3X3, Network,
  ChevronRight, ChevronDown, FolderOpen, ArrowLeft, Folder, Settings, Move, Tag, Share, Trash2,
  MoreHorizontal, X, Star, ExternalLink, Clock, FileText, Filter,
} from 'lucide-react';
import { projectsApi, notificationSocket, gatewaySocket } from '@/services/api';
import type { Project } from '@/types';
import { cn } from '@/lib/utils';
import { CreateProjectModal } from './CreateProjectModal';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelativeTime } from '@/lib/utils';

// ─── Design tokens (match HTML reference) ────────────────────────────────────
const BLUE = '#1663f6';
const LINE = '#e6ebf2';
const TEXT = '#172033';
const MUTED = '#667085';

// ─── Project colour from name (consistent hash) ───────────────────────────────
function projectColor(name: string): string {
  const colors = ['#22c36a', '#3b82f6', '#8b5cf6', '#fb923c', '#35c7bd', '#ef4444', '#ec5da8', '#f59e0b', '#1663f6', '#dc2626'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

// ─── Status pill ──────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { bg: string; color: string; border: string; label: string }> = {
  active: { bg: '#eafaf3', color: '#09925e', border: '#bee8d3', label: 'Active' },
  in_review: { bg: '#fff6e5', color: '#b86600', border: '#ffd28b', label: 'In Review' },
  draft: { bg: '#f2f4f7', color: '#475467', border: '#e4e7ec', label: 'Draft' },
  archived: { bg: '#f2f4f7', color: '#475467', border: '#e4e7ec', label: 'Archived' },
  completed: { bg: '#eafaf3', color: '#09925e', border: '#bee8d3', label: 'Completed' },
};
function StatusPill({ status }: { status?: string }) {
  const s = STATUS_MAP[status || 'active'] ?? STATUS_MAP.draft;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

// ─── Type pill ────────────────────────────────────────────────────────────────
const TYPE_MAP: Record<string, { bg: string; color: string; border: string }> = {
  client: { bg: '#eef4ff', color: BLUE, border: '#cde0ff' },
  internal: { bg: '#f4efff', color: '#7c3aed', border: '#dfd2ff' },
  content: { bg: '#fff0f7', color: '#db2777', border: '#ffd1e5' },
  content_creation: { bg: '#fff0f7', color: '#db2777', border: '#ffd1e5' },
  ideas: { bg: '#fff8e8', color: '#b86600', border: '#ffd28b' },
};
function TypePill({ type }: { type?: string }) {
  const key = (type || 'internal').toLowerCase().replace(' ', '_');
  const t = TYPE_MAP[key] ?? TYPE_MAP.internal;
  return (
    <span style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {type ?? 'Internal'}
    </span>
  );
}

// ─── Member avatars stack ──────────────────────────────────────────────────────
function MemberAvatars({ members, max = 3 }: { members: any[]; max?: number }) {
  const shown = members.slice(0, max);
  const extra = members.length - max;
  const grads = [
    'linear-gradient(135deg,#204b72,#ffb17a)',
    'linear-gradient(135deg,#7c3aed,#60a5fa)',
    'linear-gradient(135deg,#059669,#34d399)',
    'linear-gradient(135deg,#dc2626,#fca5a5)',
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((m, i) => {
        const name = m.user?.full_name || m.username || m.first_name || '?';
        const init = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        // ✅ Check avatar on member object or nested user object
        const avatarUrl = m.user?.avatar || m.avatar || null;
        return (
          <div key={i} title={name} style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #fff', marginLeft: i === 0 ? 0 : -6, background: grads[i % grads.length], display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, color: '#fff', zIndex: max - i, position: 'relative', overflow: 'hidden' }}>
            {avatarUrl ? (
              // ✅ Show profile image if available
              <img
                src={avatarUrl}
                alt={name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                onError={e => {
                  // ✅ If image fails to load, hide it — initials show through background
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              // ✅ Fallback to first letter only (not two letters — matches your request)
              name[0]?.toUpperCase()
            )}
          </div>
        );
      })}
      {extra > 0 && (
        <div style={{ marginLeft: -6, background: '#98a2b3', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'grid', placeItems: 'center', fontSize: 10, border: '2px solid #fff', fontWeight: 700, position: 'relative' }}>
          +{extra}
        </div>
      )}
      {members.length === 0 && <span style={{ fontSize: 11, color: MUTED }}>—</span>}
    </div>
  );
}

// ─── Tree panel ───────────────────────────────────────────────────────────────
const TREE_GROUPS = [
  { label: 'Client Projects', types: ['client'], color: '#3b82f6' },
  { label: 'Internal Projects', types: ['internal'], color: '#8b5cf6' },
  { label: 'Content Creation', types: ['content_creation'], color: '#ec4899' },
  { label: 'Ideas', types: ['ideas'], color: '#f59e0b' },
  { label: 'Demo Projects', types: ['demo'], color: '#22c36a' },
];

function TreePanel({ projects, selected, selectedGroup, onSelect, onSelectGroup, isOpen, onToggle }: {
  projects: Project[];
  selected: number | null;           // single project selected
  selectedGroup: string | null;      // group label selected e.g. "Client Projects"
  onSelect: (id: number | null) => void;
  onSelectGroup: (label: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  // Track which category folders are expanded
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const rowSt = (active: boolean): React.CSSProperties => ({
    height: 29, display: 'flex', alignItems: 'center', gap: 8,
    color: active ? BLUE : '#27354d', fontSize: 12, cursor: 'pointer',
    borderRadius: 6, padding: '0 8px',
    background: active ? '#edf4ff' : 'transparent',
    fontWeight: active ? 700 : 500,
  });

  if (!isOpen) return (
    <div style={{ width: 44, minWidth: 44, borderRight: `1px solid ${LINE}`, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, flexShrink: 0 }}>
      <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4 }} title="Show Tree">
        <ChevronRight className="w-4 h-4" />
      </button>
      <div style={{ marginTop: 12, writingMode: 'vertical-rl', fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '.05em' }}>Tree View</div>
    </div>
  );

  return (
    <div style={{ width: 250, minWidth: 250, borderRight: `1px solid ${LINE}`, background: '#fff', padding: 16, overflowY: 'auto', flexShrink: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: TEXT }}>Project Tree</span>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {/* All Projects row */}
      <div style={rowSt(selected === null && selectedGroup === null)}
        onClick={() => { onSelect(null); onSelectGroup(null); }}>
        <Folder className="w-3.5 h-3.5" style={{ color: '#f59e0b', flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: 700 }}>All Projects</span>
        <span style={{ color: MUTED, fontSize: 11 }}>{projects.length}</span>
      </div>

      {/* Category group folders */}
      <div style={{ marginTop: 6 }}>
        {TREE_GROUPS.map(group => {
          // Find projects belonging to this group
          const groupProjects = projects.filter(p =>
            group.types.includes(((p as any).task_type || '').toLowerCase())
          );
          if (groupProjects.length === 0) return null; // hide empty groups

          const isOpen = openGroups.has(group.label);
          const isGroupSelected = selectedGroup === group.label && selected === null;

          return (
            <div key={group.label}>
              {/* Group folder row */}
              <div
                style={{ ...rowSt(isGroupSelected), justifyContent: 'space-between' }}
                onClick={() => {
                  // Clicking group label → filter table to this group
                  onSelect(null);
                  onSelectGroup(isGroupSelected ? null : group.label);
                  // Also expand/collapse the folder
                  toggleGroup(group.label);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  {/* Chevron shows open/closed state */}
                  {isOpen
                    ? <ChevronDown className="w-3 h-3" style={{ color: MUTED, flexShrink: 0 }} />
                    : <ChevronRight className="w-3 h-3" style={{ color: MUTED, flexShrink: 0 }} />
                  }
                  {isOpen
                    ? <FolderOpen className="w-3.5 h-3.5" style={{ color: group.color, flexShrink: 0 }} />
                    : <Folder className="w-3.5 h-3.5" style={{ color: group.color, flexShrink: 0 }} />
                  }
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.label}
                  </span>
                </div>
                <span style={{ color: MUTED, fontSize: 11, flexShrink: 0 }}>{groupProjects.length}</span>
              </div>

              {/* Individual projects inside this group — shown when folder is open */}
              {isOpen && (
                <div style={{ paddingLeft: 20, marginTop: 2 }}>
                  {groupProjects.map(p => (
                    <div key={p.id}
                      style={rowSt(selected === p.id)}
                      onClick={e => {
                        e.stopPropagation();
                        onSelect(selected === p.id ? null : p.id);
                        onSelectGroup(null);
                      }}
                    >
                      <Folder className="w-3 h-3" style={{ color: projectColor(p.name), flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </span>
                      <span style={{ color: MUTED, fontSize: 11, flexShrink: 0 }}>
                        {(p as any).document_count ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Folder */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: BLUE, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus className="w-3.5 h-3.5" />New Folder
        </span>
        <div style={{ width: 32, height: 32, border: `1px solid ${LINE}`, borderRadius: 8, display: 'grid', placeItems: 'center', color: MUTED }}>
          <Settings className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}

// ─── Bulk action toolbar ───────────────────────────────────────────────────────
function BulkToolbar({ count, onClear, onDelete, onMove }: { count: number; onClear: () => void; onDelete: () => void; onMove: () => void }) {
  const btn: React.CSSProperties = { height: 30, border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', padding: '0 11px', fontSize: 12, fontWeight: 700, display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer', color: TEXT };
  return (
    <div style={{ height: 50, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', background: '#fff', flexShrink: 0 }}>
      {count > 0 ? (
        <>
          <div onClick={onClear} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: '#EEF2FF', color: BLUE, border: `1px solid ${BLUE}`, borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked readOnly style={{ accentColor: BLUE, width: 15, height: 15 }} />
            {count} selected
          </div>
          <button onClick={onMove} style={btn}><Move className="w-3.5 h-3.5" />Move</button>
          <button style={btn}><Settings className="w-3.5 h-3.5" />Edit</button>
        </>
      ) : (
        <span style={{ fontSize: 13, color: MUTED }}>Select projects to perform bulk actions</span>
      )}
    </div>
  );
}

// ─── Detail side panel ─────────────────────────────────────────────────────────
function DetailPanel({ project, onClose, onOpen }: { project: Project; onClose: () => void; onOpen: () => void }) {
  const [tab, setTab] = useState<'overview' | 'activity' | 'files'>('overview');
  const members = (project as any).members || [];
  const color = projectColor(project.name);

  return (
    <div style={{ width: 305, minWidth: 305, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '18px 14px', overflow: 'auto', flexShrink: 0, boxShadow: '0 2px 8px rgba(16,24,40,.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: TEXT, lineHeight: 1.3, flex: 1, paddingRight: 8 }}>{project.name}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 22, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
      </div>

      {/* Folder art */}
      <div style={{ height: 128, margin: '20px 0 12px', borderRadius: 8, background: 'linear-gradient(180deg,#f4f8ff,#fff)', display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 120, height: 74, borderRadius: 12, background: `linear-gradient(#5ca0ff,#2477f2)`, boxShadow: '0 12px 24px rgba(22,99,246,.22)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', width: 55, height: 20, borderRadius: '9px 9px 0 0', left: 12, top: -15, background: '#63a5ff' }} />
          <span style={{ fontSize: 34, color: 'white', position: 'relative', zIndex: 1 }}>▥</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 25, borderBottom: `1px solid ${LINE}`, marginBottom: 12 }}>
        {(['overview', 'activity', 'files'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: tab === t ? BLUE : MUTED, borderBottom: tab === t ? `3px solid ${BLUE}` : '3px solid transparent', paddingBottom: 10, textTransform: 'capitalize' }}>
            {t}{t === 'files' && <span style={{ background: '#f0f2f5', color: MUTED, borderRadius: 10, padding: '1px 6px', fontSize: 11, marginLeft: 4 }}>0</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          {[
            { label: 'Project Type', value: <TypePill type={(project as any).task_type} /> },
            { label: 'Status', value: <StatusPill status={(project as any).status} /> },
            { label: 'Documents', value: <b style={{ fontSize: 12 }}>{(project as any).document_count ?? 0} docs</b> },
            { label: 'Owner', value: <b style={{ fontSize: 12 }}>{(project as any).created_by?.full_name || 'N/A'}</b> },
            { label: 'Created', value: <b style={{ fontSize: 12 }}>{project.created_at ? new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</b> },
            { label: 'Updated', value: <b style={{ fontSize: 12 }}>{formatRelativeTime(project.updated_at || '')}</b> },
            { label: 'Team', value: <MemberAvatars members={members} max={4} /> },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', minHeight: 31, fontSize: 12 }}>
              <span style={{ color: MUTED }}>{label}</span>
              <span>{value}</span>
            </div>
          ))}
          {project.description && (
            <p style={{ marginTop: 10, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{project.description}</p>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', color: MUTED, fontSize: 13, gap: 8 }}>
          <Clock style={{ opacity: 0.3 }} />No activity yet
        </div>
      )}

      {tab === 'files' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', color: MUTED, fontSize: 13, gap: 8 }}>
          <FileText style={{ opacity: 0.3 }} />No files attached
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={onOpen} style={{ flex: 1, height: 41, background: BLUE, color: '#fff', borderRadius: 7, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ExternalLink className="w-4 h-4" />Open Project
        </button>
        <button style={{ width: 45, border: `1px solid ${LINE}`, borderRadius: 7, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <MoreHorizontal className="w-4 h-4" style={{ color: MUTED }} />
        </button>
      </div>
    </div>
  );
}

// ─── Grid card ────────────────────────────────────────────────────────────────
function ProjectGridCard({ project, selected, onSelect, onFav, onClick }: {
  project: Project; selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onFav: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const color = projectColor(project.name);
  const members = (project as any).members || [];
  return (
    <div onClick={onClick} style={{ border: `1px solid ${selected ? BLUE : LINE}`, borderRadius: 10, padding: 16, background: selected ? '#f7faff' : '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,24,40,.03)', transition: 'box-shadow .2s, border-color .2s', position: 'relative' }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,24,40,.08)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,24,40,.03)'; }}>
      <input type="checkbox" checked={selected} onClick={onSelect} onChange={() => { }} style={{ position: 'absolute', top: 14, left: 14, accentColor: BLUE, width: 15, height: 15, cursor: 'pointer' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingLeft: 24 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: color, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
          {project.name[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</p>
          <StatusPill status={(project as any).status} />
        </div>
        <Star onClick={onFav} className="w-4 h-4" style={{ color: (project as any).is_favourite ? '#f59e0b' : '#d1d5db', cursor: 'pointer', flexShrink: 0 }} />
      </div>
      {project.description && <p style={{ margin: '0 0 10px', fontSize: 12, color: MUTED, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>{project.description}</p>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>
          <FileText className="w-3.5 h-3.5" />{(project as any).document_count ?? 0} docs
        </span>
        <MemberAvatars members={members} />
        <span style={{ fontSize: 11, color: MUTED }}>{formatRelativeTime(project.updated_at || '')}</span>
      </div>
    </div>
  );
}

// ─── Main Projects page ────────────────────────────────────────────────────────
const PROJECT_TYPE_FILTERS = [
  { label: 'Client', value: 'client', dotColor: '#3b82f6' },
  { label: 'Internal', value: 'internal', dotColor: '#22c55e' },
  { label: 'Content Creation', value: 'content_creation', dotColor: '#ec4899' },
  { label: 'Ideas', value: 'ideas', dotColor: '#eab308' },
] as const;

// ─── Move Project Type Modal ──────────────────────────────────────────────────
const PROJECT_TYPES = [
  { value: 'client', label: 'Client Projects', color: '#3b82f6', desc: 'External client work' },
  { value: 'internal', label: 'Internal Projects', color: '#8b5cf6', desc: 'Internal team projects' },
  { value: 'content_creation', label: 'Content Creation', color: '#ec4899', desc: 'Content and media' },
  { value: 'ideas', label: 'Ideas', color: '#f59e0b', desc: 'Brainstorming and concepts' },
  { value: 'demo', label: 'Demo Projects', color: '#22c36a', desc: 'Demo and showcase' },
];

function MoveProjectModal({ selectedIds, projects, onClose, onSuccess }: {
  selectedIds: Set<number>;
  projects: Project[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState('');

  const selectedProjects = projects.filter(p => selectedIds.has(p.id));

  const handleMove = async () => {
    if (!selectedType) return;
    setIsMoving(true);
    setError('');
    try {
      await Promise.all(
        selectedProjects.map(p => projectsApi.update(p.id, { task_type: selectedType }))
      );
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to move projects. Please try again.');
      setIsMoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TEXT }}>Move to Project Type</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
              Moving {selectedProjects.length} project{selectedProjects.length > 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 20 }}>✕</button>
        </div>

        {/* Selected projects preview */}
        <div style={{ padding: '12px 24px', background: '#f9fafb', borderBottom: `1px solid ${LINE}` }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Projects</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {selectedProjects.map(p => (
              <span key={p.id} style={{ background: '#EEF2FF', color: BLUE, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                {p.name}
              </span>
            ))}
          </div>
        </div>

        {/* Type options */}
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Destination</p>
          {PROJECT_TYPES.map(type => {
            const isSelected = selectedType === type.value;
            const isCurrent = selectedProjects.every(p => (p as any).task_type === type.value);
            return (
              <div
                key={type.value}
                onClick={() => !isCurrent && setSelectedType(type.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10, cursor: isCurrent ? 'not-allowed' : 'pointer',
                  border: `2px solid ${isSelected ? type.color : LINE}`,
                  background: isSelected ? `${type.color}10` : isCurrent ? '#f9fafb' : '#fff',
                  opacity: isCurrent ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {/* Color dot */}
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: type.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT }}>{type.label}</p>
                  <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{type.desc}</p>
                </div>
                {isCurrent && <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Current</span>}
                {isSelected && <span style={{ fontSize: 16, color: type.color }}>✓</span>}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && <p style={{ margin: '0 24px', fontSize: 13, color: '#ef4444' }}>{error}</p>}

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${LINE}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 40, padding: '0 20px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: TEXT }}>
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={!selectedType || isMoving}
            style={{ height: 40, padding: '0 20px', borderRadius: 8, border: 'none', background: selectedType ? BLUE : '#e5e7eb', color: selectedType ? '#fff' : MUTED, fontSize: 14, fontWeight: 700, cursor: selectedType ? 'pointer' : 'not-allowed' }}
          >
            {isMoving ? 'Moving...' : `Move ${selectedProjects.length} Project${selectedProjects.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Projects() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const { isActivityOpen, setIsActivityOpen } = useOutletContext<{ isActivityOpen: boolean; setIsActivityOpen: (o: boolean) => void }>();

  // ── State ──────────────────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'tree'>('list');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const [treeFilter, setTreeFilter] = useState<number | null>(null);
  const [treeGroupFilter, setTreeGroupFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const rowsPerPage = 25;

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['projects', typeFilter],
    queryFn: () => projectsApi.list(typeFilter ? { task_type: typeFilter } : undefined),
    staleTime: 1000 * 60 * 10,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const allProjects: Project[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && 'results' in data && Array.isArray((data as any).results)) return (data as any).results;
    return [];
  })();

  // ── Real-time sync (kept exactly as before) ─────────────────────────────────
  useEffect(() => {
    const seen = new Set<string>();
    const handle = (rel: { type: string; id: string | number }) => {
      if (rel.type !== 'project') return;
      const key = `${rel.id}-${Math.floor(Date.now() / 2000)}`;
      if (seen.has(key)) return;
      seen.add(key);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    };
    const u1 = notificationSocket.onNotification(d => { if (d.related_object?.type === 'project') handle(d.related_object); });
    const u2 = gatewaySocket.onMessage((msg: any) => { if (msg.type === 'SIGNAL' && msg.event === 'NEW_NOTIFICATION' && msg.data?.related_object?.type === 'project') handle(msg.data.related_object); });
    return () => { u1(); u2(); seen.clear(); };
  }, [queryClient]);

  // ── Favourite toggle (optimistic, kept exactly as before) ──────────────────
  const toggleFavorite = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    const upd = (old: any): any => {
      if (!old) return old;
      const list: Project[] = Array.isArray(old) ? old : (old.results ?? []);
      const updated = list.map(p => p.id === project.id ? { ...p, is_favourite: !project.is_favourite } : p);
      return Array.isArray(old) ? updated : { ...old, results: updated };
    };
    queryClient.setQueriesData<any>({ queryKey: ['projects'] }, upd);
    projectsApi.update(project.id, { is_favourite: !project.is_favourite }).catch(() => {
      const rev = (old: any): any => {
        if (!old) return old;
        const list: Project[] = Array.isArray(old) ? old : (old.results ?? []);
        const reverted = list.map(p => p.id === project.id ? { ...p, is_favourite: project.is_favourite } : p);
        return Array.isArray(old) ? reverted : { ...old, results: reverted };
      };
      queryClient.setQueriesData<any>({ queryKey: ['projects'] }, rev);
    });
  };

  // ── Prefetch on hover (kept exactly as before) ─────────────────────────────
  const handleRowHover = useCallback((project: any) => {
    queryClient.prefetchQuery({ queryKey: ['project', String(project.id)], queryFn: () => projectsApi.get(project.id), staleTime: 1000 * 60 * 5 });
  }, [queryClient]);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = allProjects.filter(p => {
    // Single project selected in tree
    if (treeFilter && p.id !== treeFilter) return false;
    // Group folder selected in tree — filter by task_type
    if (treeGroupFilter) {
      const group = TREE_GROUPS.find(g => g.label === treeGroupFilter);
      if (group && !group.types.includes(((p as any).task_type || '').toLowerCase())) return false;
    }
    if (statusFilter && (p as any).status !== statusFilter) return false;
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // ── Selection ──────────────────────────────────────────────────────────────
  const toggleSelect = (id: number) => setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelectedIds(selectedIds.size === paginated.length ? new Set() : new Set(paginated.map(p => p.id)));

  // ── Shared styles ──────────────────────────────────────────────────────────
  const th: React.CSSProperties = { textAlign: 'left', color: '#344054', fontSize: 11, fontWeight: 800, padding: '12px 10px', borderBottom: `1px solid ${LINE}` };
  const td: React.CSSProperties = { padding: '10px', borderBottom: `1px solid ${LINE}`, verticalAlign: 'middle', fontSize: 12 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', overflow: 'hidden' }}>

      {/* ── TOP BAR ────────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: '#fff', borderBottom: `1px solid ${LINE}`, padding: '16px 24px' }}>

        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT, letterSpacing: '-.04em' }}>Projects</h1>
            <p style={{ margin: '4px 0 0', color: MUTED, fontSize: 14 }}>Manage your projects across teams and clients</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* <button style={{ height: 40, border: `1px solid ${LINE}`, background: '#fff', borderRadius: 8, padding: '0 15px', fontWeight: 600, color: TEXT, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, boxShadow: '0 1px 2px rgba(0,0,0,.02)' }}>
              <Upload className="w-4 h-4" />Upload / Import
            </button> */}
            <button onClick={() => setIsCreateModalOpen(true)} style={{ height: 42, background: BLUE, color: '#fff', border: `1px solid ${BLUE}`, borderRadius: 8, padding: '0 24px', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Plus className="w-4 h-4" />New Project
            </button>
            <div onClick={() => setIsActivityOpen(!isActivityOpen)} style={{ width: 43, height: 43, border: `1px solid ${LINE}`, borderRadius: 9, display: 'grid', placeItems: 'center', background: '#fff', cursor: 'pointer', position: 'relative' }}>
              <Bell className="w-5 h-5" style={{ color: MUTED }} />
              {unreadCount > 0 && <span style={{ position: 'absolute', right: -5, top: -7, background: '#ff3b47', color: '#fff', borderRadius: '50%', fontSize: 11, minWidth: 18, height: 18, display: 'grid', placeItems: 'center', fontWeight: 700 }}>{unreadCount}</span>}
            </div>
          </div>
        </div>

        {/* Controls row — search + dropdowns + view toggles */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          {/* Search */}
          <div style={{ flex: 1, height: 40, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10, minWidth: 0 }}>
            <Search className="w-4 h-4" style={{ color: MUTED, flexShrink: 0 }} />
            <input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="Search projects by name or client..." style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: TEXT, fontFamily: 'inherit', background: 'transparent', minWidth: 0 }} />
            <span style={{ background: '#f5f7fb', border: '1px solid #e3e8ef', borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 700, color: MUTED, flexShrink: 0 }}>⌘ K</span>
          </div>
          {/* Status */}
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }} style={{ height: 40, border: `1px solid ${LINE}`, borderRadius: 8, padding: '0 32px 0 12px', fontSize: 13, fontWeight: 600, background: '#fff', cursor: 'pointer', color: TEXT, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5L6 8L9 5' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', outline: 'none', flexShrink: 0 }}>
            <option value="">Status</option>
            <option value="active">Active</option>
            <option value="in_review">In Review</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          {/* Type filter */}
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }} style={{ height: 40, border: `1px solid ${LINE}`, borderRadius: 8, padding: '0 32px 0 12px', fontSize: 13, fontWeight: 600, background: '#fff', cursor: 'pointer', color: TEXT, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5L6 8L9 5' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', outline: 'none', flexShrink: 0 }}>
            <option value="">All Types</option>
            {PROJECT_TYPE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          {/* Filters btn */}
          <button style={{ height: 40, border: `1px solid ${LINE}`, borderRadius: 8, padding: '0 14px', fontSize: 13, fontWeight: 600, background: '#fff', cursor: 'pointer', color: TEXT, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Filter className="w-3.5 h-3.5" />Filters
          </button>
          {/* View toggles */}
          <div style={{ height: 40, border: `1px solid ${LINE}`, borderRadius: 8, display: 'flex', alignItems: 'center', padding: 3, gap: 2, flexShrink: 0 }}>
            {([['list', List, 'List'], ['grid', Grid3X3, 'Grid'], ['tree', Network, 'Tree']] as [string, any, string][]).map(([m, Icon, label]) => (
              <button key={m} onClick={() => setViewMode(m as any)} title={label} style={{ height: 32, padding: '0 10px', borderRadius: 6, border: viewMode === m ? '1px solid #a7c1ff' : 'none', background: viewMode === m ? '#f5f8ff' : 'transparent', color: viewMode === m ? BLUE : MUTED, fontWeight: viewMode === m ? 800 : 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Active filter chips */}
        {(statusFilter || typeFilter || searchTerm) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <b>Active Filters:</b>
            {statusFilter && <span style={{ height: 28, borderRadius: 6, padding: '0 11px', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, border: '1px solid #cfe0ff', background: '#eef4ff', color: BLUE }}>
              Status: {STATUS_MAP[statusFilter]?.label ?? statusFilter}<X className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter('')} />
            </span>}
            {typeFilter && <span style={{ height: 28, borderRadius: 6, padding: '0 11px', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, border: '1px solid #e0d2ff', background: '#f5efff', color: '#7848dc' }}>
              Type: {typeFilter}<X className="w-3 h-3 cursor-pointer" onClick={() => setTypeFilter('')} />
            </span>}
            {searchTerm && <span style={{ height: 28, borderRadius: 6, padding: '0 11px', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, border: '1px solid #c6efd8', background: '#eafaf3', color: '#087a4a' }}>
              Search: "{searchTerm}"<X className="w-3 h-3 cursor-pointer" onClick={() => setSearchTerm('')} />
            </span>}
            <span onClick={() => { setStatusFilter(''); setTypeFilter(''); setSearchTerm(''); setCurrentPage(1); }} style={{ color: BLUE, fontWeight: 700, cursor: 'pointer' }}>Clear all</span>
          </div>
        )}
      </div>

      {/* ── WORKSPACE ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Tree panel */}
        <TreePanel
          projects={allProjects}
          selected={treeFilter}
          selectedGroup={treeGroupFilter}
          onSelect={id => { setTreeFilter(id); setCurrentPage(1); setDetailProject(null); }}
          onSelectGroup={label => { setTreeGroupFilter(label); setCurrentPage(1); setDetailProject(null); }}
          isOpen={treeOpen}
          onToggle={() => setTreeOpen(p => !p)}
        />
        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          <BulkToolbar count={selectedIds.size} onClear={() => setSelectedIds(new Set())} onDelete={() => { }} onMove={() => setShowMoveModal(true)} />
          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #e5e7eb', borderTop: `4px solid ${BLUE}`, animation: 'spin 1s linear infinite' }} />
                <p style={{ color: MUTED, fontSize: 14, fontWeight: 500 }}>Loading projects...</p>
              </div>
            ) : viewMode === 'tree' ? (
              /* ── TREE VIEW ─────────────────────────────────────────── */
              <div style={{ padding: 20 }}>
                {TREE_GROUPS.map(group => {
                  const groupProjects = filtered.filter(p =>
                    group.types.includes(((p as any).task_type || '').toLowerCase())
                  );
                  if (groupProjects.length === 0) return null;
                  return (
                    <div key={group.label} style={{ marginBottom: 16, border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
                      {/* Group header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#f9fafb', borderBottom: `1px solid ${LINE}` }}>
                        <Folder className="w-4 h-4" style={{ color: group.color }} />
                        <span style={{ fontWeight: 700, fontSize: 14, color: TEXT, flex: 1 }}>{group.label}</span>
                        <span style={{ fontSize: 12, color: MUTED, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>
                          {groupProjects.length} {groupProjects.length === 1 ? 'project' : 'projects'}
                        </span>
                      </div>
                      {/* Projects inside group */}
                      {groupProjects.map((p, idx) => {
                        const color = projectColor(p.name);
                        const members = (p as any).members || [];
                        const isSel = selectedIds.has(p.id);
                        return (
                          <div key={p.id}
                            onClick={() => setDetailProject(detailProject?.id === p.id ? null : p)}
                            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: idx < groupProjects.length - 1 ? `1px solid ${LINE}` : 'none', background: isSel ? '#f7faff' : '#fff', cursor: 'pointer', paddingLeft: 36, minHeight: 56 }} onMouseOver={e => { if (!isSel) e.currentTarget.style.background = '#f3f4f6'; }}
                            onMouseOut={e => { e.currentTarget.style.background = isSel ? '#f7faff' : '#fff'; }}>
                            {/* Checkbox */}
                            <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} onClick={e => e.stopPropagation()} style={{ accentColor: BLUE, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                            {/* Color square + name */}
                            <div style={{ width: 32, height: 32, borderRadius: 7, background: color, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                              {p.name[0].toUpperCase()}
                            </div>
                            <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                            {/* Docs */}
                            <span style={{ fontSize: 13, color: MUTED, minWidth: 70 }}>{(p as any).document_count ?? 0} docs</span>
                            {/* Members */}
                            <div style={{ minWidth: 90 }}><MemberAvatars members={members} /></div>
                            {/* Status */}
                            <div style={{ minWidth: 100 }}><StatusPill status={(p as any).status} /></div>
                            {/* Updated */}
                            <span style={{ fontSize: 13, color: MUTED, minWidth: 90 }}>{formatRelativeTime(p.updated_at || '')}</span>
                            <button onClick={e => toggleFavorite(e, p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>
                              {(p as any).is_favourite ? <span style={{ color: '#f59e0b' }}>★</span> : <span style={{ color: '#d1d5db' }}>☆</span>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {/* Ungrouped projects (no task_type or unknown type) */}
                {(() => {
                  const knownTypes = TREE_GROUPS.flatMap(g => g.types);
                  const ungrouped = filtered.filter(p => !knownTypes.includes(((p as any).task_type || '').toLowerCase()));
                  if (ungrouped.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 16, border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#f9fafb', borderBottom: `1px solid ${LINE}` }}>
                        <Folder className="w-4 h-4" style={{ color: MUTED }} />
                        <span style={{ fontWeight: 700, fontSize: 14, color: TEXT, flex: 1 }}>Other Projects</span>
                        <span style={{ fontSize: 12, color: MUTED, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>{ungrouped.length}</span>
                      </div>
                      {ungrouped.map((p, idx) => {
                        const color = projectColor(p.name);
                        const members = (p as any).members || [];
                        const isSel = selectedIds.has(p.id);
                        return (
                          <div key={p.id}
                            onClick={() => setDetailProject(detailProject?.id === p.id ? null : p)}
                            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: idx < ungrouped.length - 1 ? `1px solid ${LINE}` : 'none', background: isSel ? '#f7faff' : '#fff', cursor: 'pointer', paddingLeft: 36, minHeight: 56 }} onMouseOver={e => { if (!isSel) e.currentTarget.style.background = '#f3f4f6'; }}
                            onMouseOut={e => { e.currentTarget.style.background = isSel ? '#f7faff' : '#fff'; }}>
                            <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} onClick={e => e.stopPropagation()} style={{ accentColor: BLUE, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                            <div style={{ width: 32, height: 32, borderRadius: 7, background: color, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                              {p.name[0].toUpperCase()}
                            </div>
                            <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: TEXT }}>{p.name}</span>
                            <span style={{ fontSize: 13, color: MUTED, minWidth: 70 }}>{(p as any).document_count ?? 0} docs</span>
                            <div style={{ minWidth: 90 }}><MemberAvatars members={members} /></div>
                            <div style={{ minWidth: 100 }}><StatusPill status={(p as any).status} /></div>
                            <span style={{ fontSize: 13, color: MUTED, minWidth: 90 }}>{formatRelativeTime(p.updated_at || '')}</span>
                            <button onClick={e => toggleFavorite(e, p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>
                              {(p as any).is_favourite ? <span style={{ color: '#f59e0b' }}>★</span> : <span style={{ color: '#d1d5db' }}>☆</span>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : viewMode === 'grid' ? (              /* ── GRID ───────────────────────────────────────────────────── */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16, padding: 20 }}>
                {paginated.length === 0
                  ? <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: MUTED }}><FolderKanban style={{ margin: '0 auto 12px', opacity: 0.3, width: 48, height: 48 }} /><p>No projects found</p></div>
                  : paginated.map(p => (
                    <ProjectGridCard key={p.id} project={p} selected={selectedIds.has(p.id)}
                      onSelect={e => { e.stopPropagation(); toggleSelect(p.id); }}
                      onFav={e => toggleFavorite(e, p)}
                      onClick={() => { setDetailProject(detailProject?.id === p.id ? null : p); navigate(`/projects/${p.id}`); }}
                    />
                  ))
                }
              </div>
            ) : (
              /* ── TABLE ──────────────────────────────────────────────────── */
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ ...th, width: 40 }}>
                      <input type="checkbox" checked={selectedIds.size === paginated.length && paginated.length > 0} onChange={toggleAll} style={{ accentColor: BLUE, width: 15, height: 15, cursor: 'pointer' }} />
                    </th>
                    <th style={th}>Project</th>
                    <th style={th}>Type</th>
                    <th style={th}>Documents</th>
                    <th style={th}>Members</th>
                    <th style={th}>Status</th>
                    <th style={th}>Updated ↓</th>
                    <th style={{ ...th, textAlign: 'center' }}>Favorite</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 48, color: MUTED }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                          <FolderKanban style={{ opacity: 0.3, width: 48, height: 48 }} />
                          <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: TEXT }}>No projects found</p>
                          <p style={{ margin: 0 }}>Create your first project to get started</p>
                          <button onClick={() => setIsCreateModalOpen(true)} style={{ marginTop: 8, height: 40, background: BLUE, color: '#fff', borderRadius: 8, border: 'none', padding: '0 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>New Project</button>
                        </div>
                      </td>
                    </tr>
                  ) : paginated.map((p, idx) => {
                    const color = projectColor(p.name);
                    const members = (p as any).members || [];
                    const isSel = selectedIds.has(p.id);
                    const isDetail = detailProject?.id === p.id;
                    return (
                      <tr key={p.id}
                        onClick={() => setDetailProject(isDetail ? null : p)}
                        onMouseEnter={e => handleRowHover(p)}
                        style={{ background: isSel ? '#f7faff' : idx % 2 === 0 ? '#fff' : '#fafbfc', cursor: 'pointer', borderLeft: isDetail ? `3px solid ${BLUE}` : '3px solid transparent' }}
                        onMouseOver={e => { if (!isSel && !isDetail) e.currentTarget.style.background = '#f3f4f6'; }}
                        onMouseOut={e => { e.currentTarget.style.background = isSel ? '#f7faff' : idx % 2 === 0 ? '#fff' : '#fafbfc'; }}>
                        <td style={{ ...td, width: 40 }}>
                          <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} onClick={e => e.stopPropagation()} style={{ accentColor: BLUE, width: 15, height: 15, cursor: 'pointer' }} />
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                            <div style={{ width: 22, height: 22, borderRadius: 5, background: color, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                              {p.name[0].toUpperCase()}
                            </div>
                            <span style={{ color: TEXT }}>{p.name}</span>
                          </div>
                        </td>
                        <td style={td}><TypePill type={(p as any).task_type} /></td>
                        <td style={{ ...td, color: MUTED }}>{(p as any).document_count ?? 0} docs</td>
                        <td style={td}><MemberAvatars members={members} /></td>
                        <td style={td}><StatusPill status={(p as any).status} /></td>
                        <td style={{ ...td, color: MUTED }}>{formatRelativeTime(p.updated_at || '')}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <button onClick={e => toggleFavorite(e, p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
                            {(p as any).is_favourite ? <span style={{ color: '#f59e0b' }}>★</span> : <span style={{ color: '#d1d5db' }}>☆</span>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── PAGINATION ─────────────────────────────────────────────────── */}
          {filtered.length > 0 && (
            <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderTop: `1px solid ${LINE}`, background: '#fff', flexShrink: 0, fontSize: 12, color: TEXT }}>
              <span>Showing {Math.min((currentPage - 1) * rowsPerPage + 1, filtered.length)}–{Math.min(currentPage * rowsPerPage, filtered.length)} of {filtered.length} projects</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ height: 31, minWidth: 31, border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#d1d5db' : MUTED, fontWeight: 600, display: 'grid', placeItems: 'center' }}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(pg => (
                  <button key={pg} onClick={() => setCurrentPage(pg)} style={{ height: 31, minWidth: 31, border: `1px solid ${currentPage === pg ? '#88acff' : LINE}`, borderRadius: 6, background: currentPage === pg ? '#f6f9ff' : '#fff', color: currentPage === pg ? BLUE : MUTED, fontWeight: 600, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{pg}</button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ height: 31, minWidth: 31, border: `1px solid ${LINE}`, borderRadius: 6, background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#d1d5db' : MUTED, fontWeight: 600, display: 'grid', placeItems: 'center' }}>›</button>
              </div>
            </div>
          )}
        </div>

        {/* ── DETAIL PANEL ───────────────────────────────────────────────── */}
        {detailProject && (
          <div style={{ padding: 12, borderLeft: `1px solid ${LINE}`, overflowY: 'auto', flexShrink: 0 }}>
            <DetailPanel
              project={detailProject}
              onClose={() => setDetailProject(null)}
              onOpen={() => navigate(`/projects/${detailProject.id}`)}
            />
          </div>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <CreateProjectModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} navigateOnSuccess={false} />

      {/* ✅ Move Project Type Modal */}
      {showMoveModal && (
        <MoveProjectModal
          selectedIds={selectedIds}
          projects={allProjects}
          onClose={() => setShowMoveModal(false)}
          onSuccess={() => {
            setShowMoveModal(false);
            setSelectedIds(new Set());
            queryClient.invalidateQueries({ queryKey: ['projects'] });
          }}
        />
      )}
    </div>
  );
}