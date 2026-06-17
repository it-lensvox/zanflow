import { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { FileText, X, Plus, Folder } from 'lucide-react';
import { documentsApi, projectsApi } from '@/services/api';

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Project {
  id: number;
  name: string;
}

export function CreateDocumentModal({ isOpen, onClose }: CreateDocumentModalProps) {
  const queryClient = useQueryClient();

  // ── Local state ──────────────────────────────────────────────────────────────
  const [projectFilter, setProjectFilter] = useState('');
  const [newDocName, setNewDocName]       = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [newDocFormat, setNewDocFormat]   = useState('txt');
  const [customFormat, setCustomFormat]   = useState('');
  const [isSubmitting, setIsSubmitting]   = useState(false);

  // ── Fetch projects ───────────────────────────────────────────────────────────
  const { data: projectsRes } = useQuery({
    queryKey: ['projects-for-doc-modal'],
    queryFn: () => projectsApi.list(),
    enabled: isOpen,
    staleTime: 60000,
  });
  const projects: Project[] = projectsRes?.results || (Array.isArray(projectsRes) ? projectsRes : []);
  const currentProjectName = projects.find(p => String(p.id) === String(projectFilter))?.name || '';

  // ── Reset & close ─────────────────────────────────────────────────────────────
  const handleClose = () => {
    setProjectFilter('');
    setNewDocName('');
    setNewDocContent('');
    setNewDocFormat('txt');
    setCustomFormat('');
    setIsSubmitting(false);
    onClose();
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newDocName.trim()) {
      alert('Please enter a document name');
      return;
    }

    try {
      setIsSubmitting(true);
      const format   = customFormat.trim() || newDocFormat;
      const fullName = newDocName.includes('.') ? newDocName : `${newDocName}.${format}`;

      const blob = new Blob([newDocContent], { type: 'text/plain' });
      const file = new File([blob], fullName, { type: 'text/plain' });

      let targetProjectId = projectFilter ? Number(projectFilter) : null;
      if (!targetProjectId && projects.length > 0) {
        targetProjectId = projects[0].id;
      }
      if (!targetProjectId) {
        alert('No projects available. Please create a project first.');
        return;
      }

      // Step 1: Get upload URL
      const uploadUrlResponse = await documentsApi.getUploadUrl(targetProjectId, {
        file_name: fullName,
        file_type: file.type || 'application/octet-stream',
      });
      const { url: s3Url, fields: s3Fields, file_key } = uploadUrlResponse;

      // Step 2: Upload to S3
      await documentsApi.uploadFileToS3(s3Url, s3Fields, file);

      // Step 3: Confirm upload
      const getFileTypeFromExt = (name: string): string => {
        const ext = name.split('.').pop()?.toLowerCase() || '';
        if (ext === 'pdf') return 'pdf';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
        if (['mp4', 'mov', 'avi'].includes(ext)) return 'video';
        if (ext === 'json') return 'json';
        if (['txt', 'md', 'csv'].includes(ext)) return 'text';
        return 'other';
      };

      await documentsApi.confirmUpload(targetProjectId, {
        file_key,
        file_name: fullName,
        file_type: getFileTypeFromExt(fullName),
      } as any);

      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      handleClose();
    } catch (error: any) {
      console.error('Create document failed:', error);
      alert(error.response?.data?.detail || error.message || 'Failed to create document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const formats = [
    { ext: 'txt',  emoji: '📄' },
    { ext: 'pdf',  emoji: '📕' },
    { ext: 'docx', emoji: '📘' },
    { ext: 'xlsx', emoji: '📊' },
    { ext: 'md',   emoji: '📝' },
    { ext: 'json', emoji: '🔧' },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="relative w-full rounded-xl shadow-2xl"
        style={{ maxWidth: 700, background: '#fff', border: '1px solid #e5e7eb', maxHeight: '90vh', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: '#4169FF' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Create New Document</span>
          </div>
          <button onClick={handleClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>

          {/* Project Selection */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
              Project (Optional)
            </label>
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              style={{
                width: '100%', padding: '10px 32px 10px 12px',
                border: '1px solid #e5e7eb', borderRadius: 6,
                fontSize: 14, background: '#fff', cursor: 'pointer',
                appearance: 'none' as const,
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5L6 8L9 5' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', outline: 'none',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#4169FF'}
              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
            >
              <option value="">All Documents (No specific project)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Leave as "All Documents" to create without a project, or select a project to organize your document.
            </p>
          </div>

          {/* Selected project indicator */}
          {projectFilter && (
            <div className="flex items-center gap-3 rounded-lg" style={{ padding: '12px 16px', background: '#EEF2FF', border: '1px solid #c7d2fe' }}>
              <Folder className="w-5 h-5 flex-shrink-0" style={{ color: '#4169FF' }} />
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saving to</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#4169FF' }}>{currentProjectName}</p>
              </div>
            </div>
          )}

          {/* Document Name */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
              Document Name *
            </label>
            <input
              type="text"
              value={newDocName}
              onChange={e => setNewDocName(e.target.value)}
              placeholder="Enter document name"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, outline: 'none' }}
              onFocus={e => e.currentTarget.style.borderColor = '#4169FF'}
              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Content */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
              Content
            </label>
            <textarea
              value={newDocContent}
              onChange={e => setNewDocContent(e.target.value)}
              placeholder="Type or paste your content here..."
              style={{
                width: '100%', minHeight: 200, padding: '12px',
                border: '1px solid #e5e7eb', borderRadius: 6,
                fontSize: 14, fontFamily: 'Monaco, Courier New, monospace',
                resize: 'vertical', outline: 'none',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#4169FF'}
              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Format Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
              Select Format
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
              {formats.map(({ ext, emoji }) => (
                <div
                  key={ext}
                  onClick={() => setNewDocFormat(ext)}
                  style={{
                    padding: 16, border: `2px solid ${newDocFormat === ext ? '#4169FF' : '#e5e7eb'}`,
                    borderRadius: 8, textAlign: 'center', cursor: 'pointer',
                    background: newDocFormat === ext ? '#EEF2FF' : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#666' }}>.{ext}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Format */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
              Or Type Custom Format
            </label>
            <input
              type="text"
              value={customFormat}
              onChange={e => setCustomFormat(e.target.value)}
              placeholder="e.g., csv, html, xml"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, outline: 'none' }}
              onFocus={e => e.currentTarget.style.borderColor = '#4169FF'}
              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #e5e7eb' }}>
          <button
            onClick={handleClose}
            className="rounded-lg"
            style={{ padding: '8px 20px', border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#1a1a1a' }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!newDocName.trim() || isSubmitting}
            className="rounded-lg flex items-center gap-2"
            style={{
              padding: '8px 20px',
              background: !newDocName.trim() || isSubmitting ? '#a5b4fc' : '#4169FF',
              color: '#fff', border: 'none', fontSize: 14, fontWeight: 600,
              cursor: !newDocName.trim() || isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            <Plus className="w-4 h-4" />
            {isSubmitting ? 'Creating…' : 'Create Document'}
          </button>
        </div>
      </div>
    </div>
  );
}