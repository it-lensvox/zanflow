import React, { useState } from 'react';
import {
  FileText, Info, Share2,Trash2, File, Clock, CheckCircle
} from 'lucide-react';
import { TablePopover } from '@/components/common';
import { formatRelativeTime } from '@/lib/utils';
import { getTypeHex, getTypeBg } from '@/pages/Project/projectConstants';
import type { Document, DocumentStatus, DocumentShareUser } from '@/types';
import type { TableColumn } from '../DualView';
import { documentsApi } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';

interface DocumentTableColumnsProps {
  onDeleteClick: (e: React.MouseEvent, doc: Document) => void;
  onInfoClick?: (doc: Document) => void;
  onShareClick?: (doc: Document) => void;
}

// --- Doc icon color by extension (HTML exact) ---
const getDocIconColor = (name: string): string => {
  const ext = name?.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = { pdf: '#EF4444', doc: '#2563EB', docx: '#2563EB', xls: '#16A34A', xlsx: '#16A34A', csv: '#16A34A', ppt: '#EA580C', pptx: '#EA580C', png: '#6366F1', jpg: '#6366F1', jpeg: '#6366F1', gif: '#6366F1', svg: '#6366F1', ts: '#2563EB', tsx: '#2563EB', js: '#D97706', jsx: '#D97706', json: '#D97706' };
  return map[ext] || '#6B7280';
};

export const getExtBadgeColor = (name: string): string => {
  const ext = name?.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = { pdf: '#EF4444', doc: '#2563EB', docx: '#2563EB', xls: '#16A34A', xlsx: '#16A34A', csv: '#16A34A', ppt: '#EA580C', pptx: '#EA580C', png: '#7C3AED', jpg: '#7C3AED', jpeg: '#7C3AED', gif: '#7C3AED', svg: '#7C3AED', mp4: '#EC4899', mov: '#EC4899', avi: '#EC4899', js: '#F59E0B', ts: '#2563EB', jsx: '#0891B2', tsx: '#0891B2', py: '#3B82F6', json: '#F59E0B', zip: '#F59E0B', rar: '#F59E0B' };
  return map[ext] || '#6B7280';
};

// --- Status config (HTML exact — with colored borders) ---
const getDocumentStatusConfig = (status: DocumentStatus) => {
  const n = status.toLowerCase() as Lowercase<DocumentStatus>;
  switch (n) {
    case 'draft': return { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB', label: 'Draft', icon: File };
    case 'in_review': return { bg: '#FFF4E6', text: '#D97706', border: '#FCD34D', label: 'In Review', icon: Clock };
    case 'approved': return { bg: '#E8F5E9', text: '#16A34A', border: '#86EFAC', label: 'Approved', icon: CheckCircle };
    case 'archived': return { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB', label: 'Archived', icon: FileText };
    default: return { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB', label: String(status).replace('_', ' '), icon: FileText };
  }
};

const statusOptions: { value: DocumentStatus; label: string; icon: any }[] = [
  { value: 'draft', label: 'Draft', icon: File },
  { value: 'in_review', label: 'In Review', icon: Clock },
  { value: 'approved', label: 'Approved', icon: CheckCircle },
  { value: 'archived', label: 'Archived', icon: FileText },
];

// --- Tag colors (HTML exact — with colored borders) ---
const getTagStyle = (name: string): { bg: string; color: string; border: string } => {
  const n = name.toLowerCase();
  if (n.includes('contract')) return { bg: '#F3E8FF', color: '#7C3AED', border: '#D8B4FE' };
  if (n.includes('legal')) return { bg: '#D1FAE5', color: '#059669', border: '#6EE7B7' };
  if (n.includes('finance') || n.includes('financial')) return { bg: '#DBEAFE', color: '#2563EB', border: '#93C5FD' };
  if (n.includes('vendor')) return { bg: '#FEE2E2', color: '#DC2626', border: '#FCA5A5' };
  if (n.includes('presentation')) return { bg: '#FFEDD5', color: '#EA580C', border: '#FDBA74' };
  if (n.includes('compliance')) return { bg: '#CFFAFE', color: '#0891B2', border: '#67E8F9' };
  if (n.includes('nda')) return { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' };
  if (n.includes('report')) return { bg: '#DBEAFE', color: '#2563EB', border: '#93C5FD' };
  if (n.includes('internal')) return { bg: '#FEF3C7', color: '#D97706', border: '#FCD34D' };
  if (n.includes('meeting')) return { bg: '#E0E7FF', color: '#4F46E5', border: '#A5B4FC' };
  if (n.includes('notes')) return { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' };
  return { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' };
};

// --- Owner avatar colors (cycle through gradients like HTML) ---
const avatarGradients = [
  'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
  'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
  'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
];
const getAvatarGradient = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarGradients[Math.abs(hash) % avatarGradients.length];
};
const getInitials = (name: string): string => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

// ─── Shared column header with toggle ────────────────────────────────────────
// Uses module-level state via a simple event emitter pattern
let sharedColumnMode: 'shared_with' | 'shared_by' = 'shared_with';
const sharedColumnListeners = new Set<() => void>();

function SharedColumnHeader() {
  const [mode, setMode] = React.useState<'shared_with' | 'shared_by'>(sharedColumnMode);
  const [open, setOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const update = () => setMode(sharedColumnMode);
    sharedColumnListeners.add(update);
    return () => { sharedColumnListeners.delete(update); };
  }, []);

  // ✅ Close dropdown when clicking outside
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectMode = (e: React.MouseEvent, newMode: 'shared_with' | 'shared_by') => {
    e.stopPropagation();
    sharedColumnMode = newMode;
    sharedColumnListeners.forEach(fn => fn());
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* ✅ Dropdown trigger */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, fontSize: 12, fontWeight: 800, color: 'hsl(var(--foreground))',
        }}
      >
        {mode === 'shared_with' ? 'Shared With' : 'Shared By'}
        {/* Chevron icon */}
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ✅ Dropdown menu */}
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 999,
            marginTop: 4, background: 'hsl(var(--popover))',
            border: '1px solid #e5e7eb', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            minWidth: 140, overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Shared With option */}
          <button
            onClick={(e) => selectMode(e, 'shared_with')}
            style={{
              width: '100%', textAlign: 'left', padding: '9px 14px',
              fontSize: 13, fontWeight: mode === 'shared_with' ? 700 : 400,
              color: mode === 'shared_with' ? '#4169FF' : 'hsl(var(--foreground))',
              background: mode === 'shared_with' ? '#4169FF18' : 'transparent',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 8,
            }}
            onMouseEnter={e => { if (mode !== 'shared_with') e.currentTarget.style.background = 'hsl(var(--accent))'; }}
            onMouseLeave={e => { if (mode !== 'shared_with') e.currentTarget.style.background = 'transparent'; }}
          >
            {/* Checkmark for active */}
            {mode === 'shared_with'
              ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#4169FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              : <span style={{ width: 12 }} />
            }
            Shared With
          </button>

          {/* Shared By option */}
          <button
            onClick={(e) => selectMode(e, 'shared_by')}
            style={{
              width: '100%', textAlign: 'left', padding: '9px 14px',
              fontSize: 13, fontWeight: mode === 'shared_by' ? 700 : 400,
              color: mode === 'shared_by' ? '#4169FF' : 'hsl(var(--foreground))',
              background: mode === 'shared_by' ? '#4169FF18' : 'transparent',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 8,
            }}
            onMouseEnter={e => { if (mode !== 'shared_by') e.currentTarget.style.background = 'hsl(var(--accent))'; }}
            onMouseLeave={e => { if (mode !== 'shared_by') e.currentTarget.style.background = 'transparent'; }}
          >
            {mode === 'shared_by'
              ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#4169FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              : <span style={{ width: 12 }} />
            }
            Shared By
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Avatar stack helper
function SharedUserAvatars({ users }: { users: DocumentShareUser[] }) {
  if (!users || users.length === 0) {
    return <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>—</span>;
  }
  const shown = users.slice(0, 3);
  const extra = users.length - 3;
  const grads = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#3b82f6,#60a5fa)',
    'linear-gradient(135deg,#10b981,#34d399)',
    'linear-gradient(135deg,#f59e0b,#fbbf24)',
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((u, i) => {
        const name = u.full_name || u.username || '?';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return (
          <div key={u.id} title={name} style={{
            width: 32, height: 32, borderRadius: '50%', border: '2px solid hsl(var(--card))',
            marginLeft: i === 0 ? 0 : -8,
            background: u.avatar ? 'transparent' : grads[i % grads.length],
            display: 'grid', placeItems: 'center',
            fontSize: 11, fontWeight: 600, color: '#fff',
            zIndex: 3 - i, position: 'relative', overflow: 'hidden',
          }}>
            {u.avatar
              ? <img src={u.avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : initials
            }
          </div>
        );
      })}
      {extra > 0 && (
        <div style={{ marginLeft: -8, background: '#98a2b3', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'grid', placeItems: 'center', fontSize: 11, border: '2px solid hsl(var(--card))', fontWeight: 600 }}>
          +{extra}
        </div>
      )}
    </div>
  );
}

function SharedByAvatar({ user }: { user: DocumentShareUser | null | undefined }) {
  if (!user) return <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>—</span>;
  const name = user.full_name || user.username || '?';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    // ✅ Only avatar circle — no name text
    <div title={name} style={{
      width: 32, height: 32, borderRadius: '50%',
      background: user.avatar ? 'transparent' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      display: 'grid', placeItems: 'center',
      fontSize: 11, fontWeight: 600, color: '#fff', overflow: 'hidden',
      flexShrink: 0,
    }}>
      {user.avatar
        ? <img src={user.avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        : initials
      }
    </div>
  );
}

// ─── Shared column cell — reacts to toggle ────────────────────────────────────
function SharedColumnCell({ doc }: { doc: Document }) {
  const [mode, setMode] = React.useState<'shared_with' | 'shared_by'>(sharedColumnMode);

  React.useEffect(() => {
    const update = () => setMode(sharedColumnMode);
    sharedColumnListeners.add(update);
    return () => { sharedColumnListeners.delete(update); };
  }, []);

  if (mode === 'shared_with') {
    return <SharedUserAvatars users={doc.shared_with || []} />;
  }
  return <SharedByAvatar user={doc.shared_by} />;
}

export const createDocumentsTableColumns = (
  { onDeleteClick, onInfoClick, onShareClick }: DocumentTableColumnsProps): TableColumn<Document>[] => {
  const StatusDropdown = ({ doc }: { doc: Document }) => {
    const [activeDropdown, setActiveDropdown] = useState(false);
    const queryClient = useQueryClient();
    const sc = getDocumentStatusConfig(doc.status);

    const handleStatusChange = async (newStatus: DocumentStatus) => {
      try { await documentsApi.updateStatus(doc.id, newStatus); queryClient.invalidateQueries({ queryKey: ['documents'] }); setActiveDropdown(false); }
      catch (e) { console.error('Failed to update status:', e); }
    };

    const trigger = (
      <div className="cursor-pointer inline-flex items-center rounded-full transition-opacity hover:opacity-80"
        style={{ padding: '4px 12px', fontSize: 12, fontWeight: 500, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
        {sc.label}
      </div>
    );

    return (
      <TablePopover trigger={trigger} width="min-w-[140px]" estimatedHeight={200} open={activeDropdown} onOpen={() => setActiveDropdown(true)} onClose={() => setActiveDropdown(false)}>
        <div className="max-h-[200px] overflow-y-auto py-1">
          {statusOptions.map((opt) => {
            const oc = getDocumentStatusConfig(opt.value);
            return (
              <div key={opt.value} className="px-3 py-2 cursor-pointer text-[12px] flex items-center gap-2" style={{ background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'hsl(var(--accent))'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onClick={() => handleStatusChange(opt.value)}>
                {React.createElement(opt.icon, { className: 'w-3.5 h-3.5', style: { color: oc.text } })}
                <span style={{ fontWeight: doc.status === opt.value ? 700 : 400, color: doc.status === opt.value ? '#4169FF' : 'hsl(var(--foreground))' }}>{opt.label}</span>
                {doc.status === opt.value && <svg className="w-3.5 h-3.5 ml-auto" style={{ color: '#4169FF' }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
              </div>
            );
          })}
        </div>
      </TablePopover>
    );
  };

  return [
    {
      key: 'name',
      label: <span style={{ fontSize: 12, fontWeight: 800, color: 'hsl(var(--foreground))' }}>Document</span>,
      width: '350px',
      render: (doc: Document) => {
        const iconColor = getDocIconColor(doc.name);
        const ext = doc.name?.split('.').pop()?.toUpperCase() || '';
        return (
          <div className="flex items-center justify-between w-full group/cell">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="flex flex-col min-w-0">
                <span className="truncate" style={{ fontWeight: 500, fontSize: 14, color: 'hsl(var(--foreground))' }} title={doc.name}>{doc.name}</span>
                <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{doc.file_size ? `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB` : ''}</span>
              </div>
            </div>
            <div className="opacity-0 group-hover/cell:opacity-100 transition-all duration-200 flex items-center gap-0.5 flex-shrink-0">
              {onInfoClick && <button onClick={(e) => { e.stopPropagation(); onInfoClick(doc); }} className="p-1.5 rounded" style={{ color: 'hsl(var(--muted-foreground))' }} title="Document Info"><Info className="w-4 h-4" /></button>}
              {onShareClick && <button onClick={(e) => { e.stopPropagation(); onShareClick(doc); }} className="p-1.5 rounded" style={{ color: 'hsl(var(--muted-foreground))' }} title="Share"><Share2 className="w-4 h-4" /></button>}
              <button onClick={(e) => { e.stopPropagation(); onDeleteClick(e, doc); }} className="p-1.5 rounded" style={{ color: 'hsl(var(--muted-foreground))' }} title="Delete"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        );
      },
    },
    {
      key: 'project',
      label: <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--foreground))' }}>Project</span>,
      render: (doc: Document) => {
        const name = doc.project_name || 'General';
        const display = name.length > 13 ? name.slice(0, 13) + '...' : name;
        const pType = (doc as any).project_task_type || '';
        const pHex = getTypeHex(pType);
        const pTint = getTypeBg(pType);
        return (
          <span
            title={name}
            className="inline-flex items-center gap-1.5 rounded-md"
            style={{
              padding: '4px 10px',
              background: pTint,
              color: pHex,
              fontSize: 13,
              border: `1px solid ${pHex}33`,
              width: 130, minWidth: 130, maxWidth: 130,
              overflow: 'hidden', whiteSpace: 'nowrap', display: 'inline-flex',
            }}
          >
            {display}
          </span>
        );
      },
    },
    {
      key: 'labels',
      label: <span style={{ fontSize: 12, fontWeight: 800, color: 'hsl(var(--foreground))' }}>Tags</span>,
      width: '180px',
      render: (doc: Document) => {
        const labels = doc.labels || [];
        if (labels.length === 0) return <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>—</span>;
        const visible = labels.slice(0, 2);
        const extra = labels.length - 2;
        return (
          <div className="flex flex-wrap gap-1.5">
            {visible.map((l) => {
              const tagColor = l.color || '#6B7280';

              // Convert hex to rgba with 10% opacity
              const hexToRgba = (hex: string) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, 0.1)`;
              };

              return (
                <span
                  key={l.id}
                  className="inline-flex rounded-full"
                  style={{
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 500,
                    background: hexToRgba(tagColor),
                    color: tagColor,
                    border: `1px solid ${tagColor}`
                  }}
                >
                  {l.name}
                </span>
              );
            })}
            {extra > 0 && (
              <span
                className="rounded-full"
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 500,
                  background: 'transparent',
                  color: 'hsl(var(--muted-foreground))',
                  border: '1px solid hsl(var(--border))'
                }}
              >
                +{extra}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: <span style={{ fontSize: 12, fontWeight: 800, color: 'hsl(var(--foreground))' }}>Status</span>,
      width: '120px',
      render: (doc: Document) => <StatusDropdown doc={doc} />,
    },
    {
      key: 'updated_at',
      label: <span style={{ fontSize: 12, fontWeight: 800, color: 'hsl(var(--foreground))' }}>Updated</span>,
      width: '120px',
      render: (doc: Document) => <span style={{ fontSize: 14, color: 'hsl(var(--foreground))' }}>{formatRelativeTime(doc.updated_at)}</span>,
    },
    {
      key: 'shared_with' as any,
      label: <SharedColumnHeader />,
      width: '140px',
      render: (doc: Document) => <SharedColumnCell doc={doc} />,
    },
    {
      key: 'created_by' as any,
      label: 'Owner',
      render: (doc: Document) => {
        const ownerName = doc.created_by?.full_name || doc.created_by?.username || 'System';

        // Get initials (first letter of first name + first letter of last name)
        const initials = ownerName
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'SY';

        // Color palette matching your reference image
        const avatarColors = [
          '#7C3AED', 
          '#EF4444',
          '#F59E0B',
          '#10B981',
          '#3B82F6',
          '#EC4899', 
          '#8B5CF6',
          '#F97316',
          '#14B8A6',
          '#6366F1', 
        ];

        // Generate consistent color based on owner name
        const colorIndex = ownerName
          .split('')
          .reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length;

        const backgroundColor = avatarColors[colorIndex];

        const avatarUrl = (doc.created_by as any)?.avatar;

        return (
          <div className="flex items-center justify-center">
            <div
              className="rounded-full flex items-center justify-center text-white font-semibold overflow-hidden"
              style={{
                width: 32,
                height: 32,
                backgroundColor,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
              title={ownerName}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={ownerName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    // If image fails to load, hide it and show initials
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                initials
              )}
            </div>
          </div>
        );
      },
      width: '80px',
    }
  ];
};

// ---- Grid Card ----
interface DocumentGridCardProps {
  document: Document;
  projectTaskType?: string;
  onDeleteClick: (e: React.MouseEvent, doc: Document) => void;
  onCardClick?: (doc: Document) => void;
  onShareClick?: (doc: Document) => void;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

export function DocumentGridCard({ document: doc, projectTaskType, onDeleteClick, onCardClick, onShareClick, isSelected = false, onSelect }: DocumentGridCardProps) {
  const sc        = getDocumentStatusConfig(doc.status);
  const accentHex = getTypeHex(projectTaskType);
  const fileName  = doc.name || doc.original_file_name || '';
  const extLabel  = fileName.split('.').pop()?.toUpperCase()?.slice(0, 4) || 'FILE';
  const fileSize  = doc.file_size ? `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB` : null;

  return (
    <div
      onClick={() => onCardClick?.(doc)}
      className="group cursor-pointer"
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 14,
        overflow: 'hidden',
        minWidth: 0,
        width: '100%',
        boxShadow: '0 1px 4px rgba(16,24,40,.06)',
        transition: 'box-shadow .2s, border-color .2s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(16,24,40,.12)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(16,24,40,.06)'}
    >
      {/* ── Top accent bar — matches ProjectGridCard */}
      <div style={{ height: 4, background: accentHex, width: '100%', flexShrink: 0 }} />

      <div style={{ padding: '14px 16px 16px' }}>

        {/* ── Row 1: ext badge (selection toggle) + file name + status pill ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div
            onClick={onSelect ? e => { e.stopPropagation(); onSelect(e); } : undefined}
            style={{
              width: 32, height: 32, borderRadius: 7, flexShrink: 0,
              background: isSelected ? accentHex : `${accentHex}18`,
              border: isSelected ? `1.5px solid ${accentHex}` : `1px solid ${accentHex}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: onSelect ? 'pointer' : 'default',
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {isSelected
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              : <span style={{ fontSize: 9, fontWeight: 700, color: accentHex, letterSpacing: '.04em', lineHeight: 1 }}>{extLabel}</span>
            }
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 5px', fontWeight: 700, fontSize: 16, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName || 'Untitled'}
            </p>
            {/* Status pill  */}
            <span className="inline-flex items-center rounded-full"
              style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
              {sc.label}
            </span>
          </div>
        </div>

        {/* ── Description area  */}
        {doc.labels && doc.labels.length > 0 ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginBottom: 14 }}>
            {doc.labels.slice(0, 2).map(l => (
              <span key={l.id} style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: l.color ? `${l.color}18` : '#F3E8FF', color: l.color || '#7C3AED', border: `1px solid ${l.color ? `${l.color}30` : '#D8B4FE'}` }}>
                {l.name}
              </span>
            ))}
            {doc.labels.length > 2 && <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', padding: '2px 4px' }}>+{doc.labels.length - 2}</span>}
          </div>
        ) : fileSize ? (
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'hsl(var(--muted-foreground))', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
            {fileSize}
          </p>
        ) : (
          <div style={{ height: 8 }} />
        )}

        {/* ── Progress bar area — mirrors ProjectGridCard's progress section */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
           <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>Project</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: accentHex, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
              {(doc as any).project_name || 'General'}
            </span>
          </div>
         <div style={{ height: 6, background: 'hsl(var(--muted))', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '100%', background: `${accentHex}40`, borderRadius: 99 }} />
          </div>
        </div>

        {/* ── Footer row — mirrors ProjectGridCard footer: left actions + right time */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
            {onShareClick && (
              <button onClick={e => { e.stopPropagation(); onShareClick(doc); }}
                style={{ padding: 5, color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <Share2 style={{ width: 13, height: 13 }} />
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onDeleteClick(e, doc); }}
              style={{ padding: 5, color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, display: 'flex' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'hsl(var(--muted-foreground))'; }}>
              <Trash2 style={{ width: 13, height: 13 }} />
            </button>
          </div>

          <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
            {formatRelativeTime(doc.updated_at)}
          </span>
        </div>
      </div>
    </div>
  );
}