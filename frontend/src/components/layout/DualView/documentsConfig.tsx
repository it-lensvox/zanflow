import React, { useState } from 'react';
// ✅ Add this helper function at the top of the file
import { 
  FaFilePdf, 
  FaFileWord, 
  FaFileExcel, 
  FaFilePowerpoint,
  FaFileImage,
  FaFileVideo,
  FaFileCode,
  FaFileArchive,
  FaFile
} from 'react-icons/fa';
import { 
  FileText, 
  Folder, 
  Info, 
  Share2, 
  Trash2,
  File,
  Clock,
  CheckCircle
} from 'lucide-react';

const getFileIcon = (fileName: string) => {
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  
  const iconMap: Record<string, { Icon: any; color: string }> = {
    // PDF
    'pdf': { Icon: FaFilePdf, color: '#EF4444' },
    
    // Word
    'doc': { Icon: FaFileWord, color: '#2563EB' },
    'docx': { Icon: FaFileWord, color: '#2563EB' },
    
    // Excel
    'xls': { Icon: FaFileExcel, color: '#16A34A' },
    'xlsx': { Icon: FaFileExcel, color: '#16A34A' },
    'csv': { Icon: FaFileExcel, color: '#16A34A' },
    
    // PowerPoint
    'ppt': { Icon: FaFilePowerpoint, color: '#EA580C' },
    'pptx': { Icon: FaFilePowerpoint, color: '#EA580C' },
    
    // Images
    'png': { Icon: FaFileImage, color: '#7C3AED' },
    'jpg': { Icon: FaFileImage, color: '#7C3AED' },
    'jpeg': { Icon: FaFileImage, color: '#7C3AED' },
    'gif': { Icon: FaFileImage, color: '#7C3AED' },
    'svg': { Icon: FaFileImage, color: '#7C3AED' },
    
    // Videos
    'mp4': { Icon: FaFileVideo, color: '#EC4899' },
    'mov': { Icon: FaFileVideo, color: '#EC4899' },
    'avi': { Icon: FaFileVideo, color: '#EC4899' },
    
    // Code
    'js': { Icon: FaFileCode, color: '#F59E0B' },
    'ts': { Icon: FaFileCode, color: '#2563EB' },
    'jsx': { Icon: FaFileCode, color: '#0891B2' },
    'tsx': { Icon: FaFileCode, color: '#0891B2' },
    'py': { Icon: FaFileCode, color: '#3B82F6' },
    'json': { Icon: FaFileCode, color: '#F59E0B' },
    
    // Archives
    'zip': { Icon: FaFileArchive, color: '#F59E0B' },
    'rar': { Icon: FaFileArchive, color: '#F59E0B' },
  };
  
  return iconMap[ext] || { Icon: FaFile, color: '#6B7280' };
};
import { TablePopover } from '@/components/common';
import { formatRelativeTime } from '@/lib/utils';
import type { Document, DocumentStatus } from '@/types';
import type { TableColumn } from '../DualView';
import { documentsApi } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';

/*  tree_view.html exact colors:
    doc-pdf:#EF4444 doc-docx:#2563EB doc-xlsx:#16A34A doc-pptx:#EA580C
    status-draft:#F3F4F6/#6B7280 status-review:#FFF4E6/#D97706 status-approved:#E8F5E9/#16A34A
    project-badge:#EEF2FF/#4F46E5
    tag-contract:#F3E8FF/#7C3AED tag-legal:#D1FAE5/#059669 tag-finance:#DBEAFE/#2563EB
    tag-vendor:#FEE2E2/#DC2626 tag-presentation:#FFEDD5/#EA580C tag-compliance:#CCF8FE/#0891B2
    tag-meeting:#E0E7FF/#4F46E5 tag-nda/report/internal/notes:#F3F4F6/#6B7280
    owner-avatar: gradient purple #6366F1->#8B5CF6  */

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

export const createDocumentsTableColumns = ({ onDeleteClick, onInfoClick, onShareClick }: DocumentTableColumnsProps): TableColumn<Document>[] => {
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
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onClick={() => handleStatusChange(opt.value)}>
                {React.createElement(opt.icon, { className: 'w-3.5 h-3.5', style: { color: oc.text } })}
                <span style={{ fontWeight: doc.status === opt.value ? 700 : 400, color: doc.status === opt.value ? '#4169FF' : '#1a1a1a' }}>{opt.label}</span>
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
      label: <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Document</span>,
      width: '350px',
      render: (doc: Document) => {
        const iconColor = getDocIconColor(doc.name);
        const ext = doc.name?.split('.').pop()?.toUpperCase() || '';
        return (
          <div className="flex items-center justify-between w-full group/cell">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              {/* Colored doc icon matching HTML exactly */}
              {(() => {
                const { Icon, color } = getFileIcon(doc.name || doc.original_file_name || '');
                return (
                  <div className="flex items-center justify-center text-white flex-shrink-0"
                    style={{ width: 32, height: 40, background: color, fontSize: 14, fontWeight: 600, borderRadius: 4 }}>
                    <Icon className="w-[18px] h-[18px]" style={{ strokeWidth: 2 }} />
                  </div>
                );
              })()}
              <div className="flex flex-col min-w-0">
                <span className="truncate" style={{ fontWeight: 500, fontSize: 14, color: '#1a1a1a' }} title={doc.name}>{doc.name}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{doc.file_size ? `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB` : ''}</span>
              </div>
            </div>
            <div className="opacity-0 group-hover/cell:opacity-100 transition-all duration-200 flex items-center gap-0.5 flex-shrink-0">
              {onInfoClick && <button onClick={(e) => { e.stopPropagation(); onInfoClick(doc); }} className="p-1.5 rounded" style={{ color: '#6b7280' }} title="Document Info"><Info className="w-4 h-4" /></button>}
              {onShareClick && <button onClick={(e) => { e.stopPropagation(); onShareClick(doc); }} className="p-1.5 rounded" style={{ color: '#6b7280' }} title="Share"><Share2 className="w-4 h-4" /></button>}
              <button onClick={(e) => { e.stopPropagation(); onDeleteClick(e, doc); }} className="p-1.5 rounded" style={{ color: '#6b7280' }} title="Delete"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        );
      },
    },
    {
      key: 'project',
      label: <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Project</span>,
      width: '140px',
      render: (doc: Document) => (
        <span className="inline-flex items-center gap-1.5 rounded-md" style={{ padding: '4px 10px', background: '#EEF2FF', color: '#4F46E5', fontSize: 13, border: '1px solid #C7D2FE' }}>
          <Folder className="w-3 h-3" style={{ fill: '#4F46E5', stroke: 'none' }} />
          {doc.project_name || 'General'}
        </span>
      ),
    },
    {
      key: 'labels',
      label: <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Tags</span>,
      width: '180px',
      render: (doc: Document) => {
        const labels = doc.labels || [];
        if (labels.length === 0) return <span style={{ fontSize: 12, color: '#6b7280' }}>—</span>;
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
                  color: '#6B7280',
                  border: '1px solid #D1D5DB'
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
      label: <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Status</span>,
      width: '120px',
      render: (doc: Document) => <StatusDropdown doc={doc} />,
    },
    {
      key: 'updated_at',
      label: <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Updated</span>,
      width: '120px',
      render: (doc: Document) => <span style={{ fontSize: 14, color: '#1a1a1a' }}>{formatRelativeTime(doc.updated_at)}</span>,
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
          '#7C3AED', // Purple (RS)
          '#EF4444', // Red (JD)
          '#F59E0B', // Orange/Amber (AM)
          '#10B981', // Green (BK)
          '#3B82F6', // Blue (LM)
          '#EC4899', // Pink
          '#8B5CF6', // Violet
          '#F97316', // Orange
          '#14B8A6', // Teal
          '#6366F1', // Indigo
        ];

        // Generate consistent color based on owner name
        const colorIndex = ownerName
          .split('')
          .reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length;

        const backgroundColor = avatarColors[colorIndex];

        return (
          <div className="flex items-center justify-center">
            <div
              className="rounded-full flex items-center justify-center text-white font-semibold"
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
              {initials}
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
  onDeleteClick: (e: React.MouseEvent, doc: Document) => void;
  onCardClick?: (doc: Document) => void;
  onShareClick?: (doc: Document) => void;
}

export function DocumentGridCard({ document: doc, onDeleteClick, onCardClick, onShareClick }: DocumentGridCardProps) {
  const sc = getDocumentStatusConfig(doc.status);
  const iconColor = getDocIconColor(doc.name);

  return (
    <div onClick={() => onCardClick ? onCardClick(doc) : undefined}
      className="rounded-xl p-4 transition-all duration-300 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 relative h-full group"
      style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
      <div className="flex justify-between items-start gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="rounded flex items-center justify-center text-white flex-shrink-0" style={{ width: 32, height: 40, background: iconColor }}>
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="line-clamp-1" style={{ fontWeight: 600, fontSize: 13, color: '#1a1a1a' }} title={doc.project_name}>{doc.project_name || 'General'}</span>
            <span className="line-clamp-2" style={{ fontSize: 12, color: '#6b7280' }} title={doc.name}>{doc.name}</span>
          </div>
        </div>
        <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{formatRelativeTime(doc.updated_at)}</span>
      </div>
      <div className="space-y-1 mb-6" style={{ fontSize: 12, color: '#6b7280' }}>
        <div className="flex items-center"><FileText className="w-3 h-3 mr-1" /><span className="font-medium">Type:</span><span className="ml-1 uppercase">{doc.file_type}</span></div>
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
        {onShareClick && <button onClick={(e) => { e.stopPropagation(); onShareClick(doc); }} className="p-1.5 rounded" style={{ color: '#6b7280' }}><Share2 className="w-4 h-4" /></button>}
        <button onClick={(e) => onDeleteClick(e, doc)} className="p-1.5 rounded" style={{ color: '#6b7280' }}><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="absolute bottom-3 right-3">
        <span className="inline-flex items-center rounded-full" style={{ padding: '4px 12px', fontSize: 10, fontWeight: 600, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{sc.label}</span>
      </div>
    </div>
  );
}