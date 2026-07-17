import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Document, Project } from '@/types';
import { getTypeHex, getTypeBg } from '@/config/projectTypeConfig';
import { getDocStatusConfig, getFileExtLabel } from '@/config/documentConfig';

interface TreeDocumentViewProps {
  documents: Document[];
  projects: Project[];
  onDocumentClick: (doc: Document) => void;
}

function ExtBadge({ fileName, typeHex }: { fileName: string; typeHex: string }) {
  const label = getFileExtLabel(fileName);
  return (
    <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: `${typeHex}18`, border: `1px solid ${typeHex}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: typeHex, letterSpacing: '.04em', lineHeight: 1 }}>{label}</span>
    </div>
  );
}

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
            <div key={project.id} style={{ borderRadius: 10, border: '1px solid hsl(var(--border))', overflow: 'hidden' }}>

              {/* ── Project header ── */}
              <div
                onClick={() => toggleProject(project.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: typeTint, borderLeft: `4px solid ${typeHex}` }}
              >
                <ChevronRight style={{ width: 14, height: 14, flexShrink: 0, color: typeHex, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {project.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `${typeHex}18`, color: typeHex, flexShrink: 0 }}>
                  {docs.length} {docs.length === 1 ? 'doc' : 'docs'}
                </span>
              </div>

              {/* ── Documents list ── */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid hsl(var(--border))' }}>
                  {docs.map((doc, i) => {
                    const fileName = doc.original_file_name || doc.name || '';
                    const status = getDocStatusConfig(doc.status);
                    const isLast = i === docs.length - 1;

                    return (
                      <div
                        key={doc.id}
                        onClick={() => onDocumentClick(doc)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'hsl(var(--card))', borderBottom: isLast ? 'none' : '1px solid hsl(var(--border))', borderLeft: `4px solid ${typeHex}30` }}
                        onMouseEnter={e => e.currentTarget.style.background = `${typeHex}0d`}
                        onMouseLeave={e => e.currentTarget.style.background = 'hsl(var(--card))'}
                      >
                        {/* Ext badge */}
                        <ExtBadge fileName={fileName} typeHex={typeHex} />

                        {/* File info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fileName || 'Untitled'}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                            {new Date(doc.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>

                        {/* Status badge */}
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: status.bg, color: status.text, flexShrink: 0 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'hsl(var(--muted-foreground))' }}>
            <p style={{ fontSize: 15, fontWeight: 500 }}>No documents found</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Try selecting a different folder or clearing filters</p>
          </div>
        )}
      </div>
    </div>
  );
}