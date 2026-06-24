import { useState } from 'react';
import { FileText, Folder, ChevronRight } from 'lucide-react';
import type { Document, Project } from '@/types';

interface TreeDocumentViewProps {
  documents:        Document[];
  projects:         Project[];
  onDocumentClick:  (doc: Document) => void;
  selectedDocs:     Set<string>;
  toggleSelect:     (id: string) => void;
}

const FILE_ICON_COLORS: Record<string, string> = {
  pdf: '#EF4444', doc: '#2563EB', docx: '#2563EB',
  xls: '#16A34A', xlsx: '#16A34A', ppt: '#EA580C', pptx: '#EA580C',
  png: '#7C3AED', jpg: '#7C3AED', jpeg: '#7C3AED',
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  approved:  { bg: '#E8F5E9', color: '#16A34A', label: 'Approved'  },
  in_review: { bg: '#FFF4E6', color: '#D97706', label: 'In Review' },
  draft:     { bg: '#F3F4F6', color: '#6B7280', label: 'Draft'     },
  archived:  { bg: '#F3F4F6', color: '#6B7280', label: 'Archived'  },
};

export function TreeDocumentView({ documents, projects, onDocumentClick, selectedDocs, toggleSelect }: TreeDocumentViewProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  const toggleProject = (projectId: number) =>
    setExpandedProjects(prev => { const next = new Set(prev); next.has(projectId) ? next.delete(projectId) : next.add(projectId); return next; });

  const docsByProject = documents.reduce((acc, doc) => {
    if (!acc[doc.project]) acc[doc.project] = [];
    acc[doc.project].push(doc);
    return acc;
  }, {} as Record<number, Document[]>);

  const getFileIconColor = (doc: Document) => {
    const ext = doc.original_file_name?.split('.').pop()?.toLowerCase() || '';
    return FILE_ICON_COLORS[ext] || '#6B7280';
  };

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="space-y-2">
        {projects.map(project => {
          const projectDocs = docsByProject[project.id] || [];
          const isExpanded  = expandedProjects.has(project.id);
          if (projectDocs.length === 0) return null;

          return (
            <div key={project.id} className="border rounded-lg" style={{ borderColor: '#e5e7eb' }}>
              {/* Project header */}
              <div className="flex items-center gap-3 p-4 cursor-pointer" style={{ background: '#f9fafb', borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none' }} onClick={() => toggleProject(project.id)}>
                <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} style={{ color: '#6b7280' }} />
                <Folder className="w-5 h-5" style={{ color: '#4169FF' }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', flex: 1 }}>{project.name}</span>
                <span className="px-2.5 py-1 rounded-full" style={{ fontSize: 12, fontWeight: 500, background: '#EEF2FF', color: '#4169FF' }}>
                  {projectDocs.length} {projectDocs.length === 1 ? 'document' : 'documents'}
                </span>
              </div>

              {/* Documents list */}
              {isExpanded && (
                <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
                  {projectDocs.map(doc => {
                    const status = STATUS_STYLE[doc.status] || STATUS_STYLE.draft;
                    return (
                      <div key={doc.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => onDocumentClick(doc)}>
                        <input type="checkbox" checked={selectedDocs.has(doc.id)} onChange={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); toggleSelect(doc.id); }}
                          style={{ accentColor: '#4169FF', width: 18, height: 18, cursor: 'pointer' }} />
                        <div className="rounded flex items-center justify-center flex-shrink-0 text-white" style={{ width: 36, height: 44, background: getFileIconColor(doc) }}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{doc.original_file_name || doc.name}</p>
                          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Updated {new Date(doc.updated_at).toLocaleDateString()}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full flex-shrink-0" style={{ fontSize: 12, fontWeight: 500, background: status.bg, color: status.color }}>{status.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}