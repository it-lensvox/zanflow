import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Document, Project } from '@/types';
import { getTypeHex, getTypeBg } from '@/pages/Project/projectConstants';

interface TreeDocumentViewProps {
  documents: Document[];
  projects: Project[];
  onDocumentClick: (doc: Document) => void;
}
// ─── Ext badge
const EXT_COLOR: Record<string, string> = {
  pdf: '#EF4444', doc: '#2563EB', docx: '#2563EB',
  xls: '#16A34A', xlsx: '#16A34A', csv: '#16A34A',
  ppt: '#EA580C', pptx: '#EA580C',
  png: '#7C3AED', jpg: '#7C3AED', jpeg: '#7C3AED', gif: '#7C3AED', svg: '#7C3AED',
  mp4: '#EC4899', mov: '#EC4899', avi: '#EC4899',
  js: '#F59E0B', ts: '#2563EB', jsx: '#0891B2', tsx: '#0891B2',
  py: '#3B82F6', json: '#F59E0B', zip: '#F59E0B',
};

function ExtBadge({ fileName }: { fileName: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const color = EXT_COLOR[ext] || '#6B7280';
  const label = ext.toUpperCase().slice(0, 4) || 'FILE';
  return (
    <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '.04em', lineHeight: 1 }}>{label}</span>
    </div>
  );
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  approved: { bg: '#E8F5E9', color: '#16A34A', label: 'Approved' },
  in_review: { bg: '#FFF4E6', color: '#D97706', label: 'In Review' },
  draft: { bg: '#F3F4F6', color: '#6B7280', label: 'Draft' },
  archived: { bg: '#F3F4F6', color: '#6B7280', label: 'Archived' },
};

export function TreeDocumentView({ documents, projects, onDocumentClick }: TreeDocumentViewProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  const toggleProject = (id: number) =>
    setExpandedProjects(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const docsByProject = documents.reduce((acc, doc) => {
    if (!acc[doc.project]) acc[doc.project] = [];
    acc[doc.project].push(doc);
    return acc;
  }, {} as Record<number, Document[]>);

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {projects.map(project => {
          const docs = docsByProject[project.id] || [];
          const isExpanded = expandedProjects.has(project.id);
          const typeHex = getTypeHex((project as any).task_type);
          const typeTint = getTypeBg((project as any).task_type);

          if (docs.length === 0) return null;

          return (
            <div key={project.id} style={{ borderRadius: 10, border: '1px solid #E6EBF2', overflow: 'hidden' }}>

              {/* ── Project header ── */}
              <div
                onClick={() => toggleProject(project.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: typeTint, borderLeft: `4px solid ${typeHex}` }}
              >
                <ChevronRight style={{ width: 14, height: 14, flexShrink: 0, color: typeHex, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: '#172033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {project.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `${typeHex}18`, color: typeHex, flexShrink: 0 }}>
                  {docs.length} {docs.length === 1 ? 'doc' : 'docs'}
                </span>
              </div>

              {/* ── Documents list ── */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid #E6EBF2' }}>
                  {docs.map((doc, i) => {
                    const fileName = doc.original_file_name || doc.name || '';
                    const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.draft;
                    const isLast = i === docs.length - 1;

                    return (
                      <div
                        key={doc.id}
                        onClick={() => onDocumentClick(doc)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: '#fff', borderBottom: isLast ? 'none' : '1px solid #f3f4f6', borderLeft: `4px solid ${typeHex}30` }}
                        onMouseEnter={e => e.currentTarget.style.background = `${typeHex}06`}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        {/* Ext badge */}
                        <ExtBadge fileName={fileName} />

                        {/* File info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#172033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fileName || 'Untitled'}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#667085' }}>
                            {new Date(doc.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>

                        {/* Status badge */}
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: status.bg, color: status.color, flexShrink: 0 }}>
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {documents.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#667085' }}>
            <p style={{ fontSize: 15, fontWeight: 500 }}>No documents found</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Try selecting a different folder or clearing filters</p>
          </div>
        )}
      </div>
    </div>
  );
}