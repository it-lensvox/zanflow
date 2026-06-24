import React, { useState } from 'react';
import { Move, Tag, SortDesc, Share, Trash2, Folder } from 'lucide-react';
import { BulkToolbar } from '@/components/ui/BulkToolbar';
import type { Project, DocumentStatus } from '@/types';

// ─── Reusable toolbar button ──────────────────────────────────────────────────
export function ToolbarBtn({ icon, label, onClick, disabled, title }: {
  icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; title?: string;
}) {
  return (
    <button onClick={disabled ? undefined : onClick} title={title}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium"
      style={{ color: disabled ? '#d1d5db' : '#6b7280', border: '1px solid #e5e7eb', background: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#f3f4f6'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
    >
      {icon}{label}
    </button>
  );
}

// ─── Status picker dropdown ───────────────────────────────────────────────────
function BulkStatusDropdown({ onSelect, onClose }: { onSelect: (s: DocumentStatus) => void; onClose: () => void }) {
  const statuses: { value: DocumentStatus; label: string; bg: string; color: string }[] = [
    { value: 'draft',     label: 'Draft',     bg: '#F3F4F6', color: '#6B7280' },
    { value: 'in_review', label: 'In Review', bg: '#FFF4E6', color: '#D97706' },
    { value: 'approved',  label: 'Approved',  bg: '#E8F5E9', color: '#16A34A' },
    { value: 'archived',  label: 'Archived',  bg: '#F3F4F6', color: '#6B7280' },
  ];
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full mt-1 left-0 z-50 rounded-lg shadow-lg py-1" style={{ background: '#fff', border: '1px solid #e5e7eb', minWidth: 160 }}>
        <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Change Status</div>
        {statuses.map(s => (
          <div key={s.value} className="flex items-center gap-2 cursor-pointer" style={{ padding: '8px 12px', fontSize: 13 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => { onSelect(s.value); onClose(); }}>
            <span className="inline-flex rounded-full" style={{ padding: '2px 10px', fontSize: 11, fontWeight: 500, background: s.bg, color: s.color }}>{s.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Project picker dropdown ──────────────────────────────────────────────────
function BulkMoveDropdown({ projects, onSelect, onClose }: { projects: Project[]; onSelect: (id: number) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full mt-1 left-0 z-50 rounded-lg shadow-lg py-1 max-h-[250px] overflow-y-auto" style={{ background: '#fff', border: '1px solid #e5e7eb', minWidth: 200 }}>
        <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Move to Project</div>
        {projects.map(p => (
          <div key={p.id} className="flex items-center gap-2 cursor-pointer" style={{ padding: '8px 12px', fontSize: 13, color: '#1a1a1a' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => { onSelect(p.id); onClose(); }}>
            <Folder className="w-3.5 h-3.5" style={{ color: '#4F46E5' }} />{p.name}
          </div>
        ))}
        {projects.length === 0 && <div style={{ padding: '8px 12px', fontSize: 13, color: '#6b7280' }}>No projects found</div>}
      </div>
    </>
  );
}

// ─── Main bulk toolbar ────────────────────────────────────────────────────────
interface DocumentsBulkToolbarProps {
  selectedCount:  number;
  onClear:        () => void;
  onDeleteSelected: () => void;
  onChangeStatus: (status: DocumentStatus) => void;
  onShare:        () => void;
  onMove:         (projectId: number) => void;
  onAddTags:      () => void;
  projects:       Project[];
}

export function DocumentsBulkToolbar({ selectedCount, onClear, onDeleteSelected, onChangeStatus, onShare, onMove, onAddTags, projects }: DocumentsBulkToolbarProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showMoveDropdown,   setShowMoveDropdown]   = useState(false);

  return (
    <BulkToolbar count={selectedCount} onClear={onClear} emptyHint="Select documents to perform bulk actions">
      <div className="relative">
        <ToolbarBtn icon={<Move className="w-3.5 h-3.5" />} label="Move" onClick={() => setShowMoveDropdown(v => !v)} />
        {showMoveDropdown && <BulkMoveDropdown projects={projects} onSelect={onMove} onClose={() => setShowMoveDropdown(false)} />}
      </div>
      <ToolbarBtn icon={<Tag className="w-3.5 h-3.5" />} label="Add Tags" onClick={onAddTags} />
      <div className="relative">
        <ToolbarBtn icon={<SortDesc className="w-3.5 h-3.5" />} label="Change Status" onClick={() => setShowStatusDropdown(v => !v)} />
        {showStatusDropdown && <BulkStatusDropdown onSelect={onChangeStatus} onClose={() => setShowStatusDropdown(false)} />}
      </div>
      <ToolbarBtn icon={<Share className="w-3.5 h-3.5" />} label="Share" onClick={onShare} />
      <ToolbarBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" onClick={onDeleteSelected} />
      <div style={{ width: 1, height: 24, background: '#e6ebf2', margin: '0 4px' }} />
    </BulkToolbar>
  );
}