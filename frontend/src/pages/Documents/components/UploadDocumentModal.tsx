import React, { useState } from 'react';
import { Upload, X, FileText, ChevronDown, Check } from 'lucide-react';
import { documentsApi } from '@/services/api';
import { getTypeHex } from '@/pages/Project/projectConstants';
import type { Project } from '@/types';

// ─── Design tokens 
const TEXT  = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--muted-foreground))';
const LINE  = 'hsl(var(--border))';
const BLUE  = '#4169FF';

// ─── Helpers
function getFileTypeFromExt(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi'].includes(ext)) return 'video';
  if (ext === 'json') return 'json';
  if (['txt', 'md', 'csv'].includes(ext)) return 'text';
  return 'other';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadDocumentModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  projects:  Project[];
  folderId:  string | null;
  folderName: string | null;
  onSuccess: () => void;
}

export function UploadDocumentModal({ isOpen, onClose, projects, folderId, folderName, onSuccess }: UploadDocumentModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showProjectDrop, setShowProjectDrop]     = useState(false);
  const [file, setFile]         = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError]       = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Reset all state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedProjectId(null);
      setShowProjectDrop(false);
      setFile(null);
      setUploading(false);
      setProgress('');
      setError('');
    }
  }, [isOpen]);

  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null;
  const selectedTypeHex = selectedProject ? getTypeHex((selectedProject as any).task_type) : MUTED;

  const handleFileSelect = (f: File) => { setFile(f); setError(''); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  };

  const handleUpload = async () => {
    if (!file || !selectedProjectId) { setError('Please select a project before uploading.'); return; }
    setUploading(true); setError(''); setProgress('Getting upload URL...');
    try {
      const { url: s3Url, fields: s3Fields, file_key } = await documentsApi.getUploadUrl(
        selectedProjectId,
        { file_name: file.name, file_type: file.type || 'application/octet-stream' },
      );
      setProgress('Uploading file...');
      await documentsApi.uploadFileToS3(s3Url, s3Fields, file);
      setProgress('Confirming upload...');
      await documentsApi.confirmUpload(selectedProjectId, {
        file_key, file_name: file.name,
        file_type: getFileTypeFromExt(file.name),
        ...(folderId ? { folder: folderId } : {}),
      } as any);
      setProgress('Done!');
      onSuccess();
      setTimeout(() => onClose(), 500);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Upload failed.');
    } finally { setUploading(false); }
  };

  if (!isOpen) return null;

  const canUpload = !!file && !!selectedProjectId && !uploading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(16,24,40,0.45)', backdropFilter: 'blur(4px)' }} onClick={onClose} />

      <div className="relative w-full max-w-[520px] rounded-xl shadow-2xl" style={{ background: 'hsl(var(--card))', border: `1px solid ${LINE}` }}>

        {/* ── Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 16px', borderBottom: `1px solid ${LINE}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>Upload Document</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${LINE}`, background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: MUTED }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
            onMouseLeave={e => e.currentTarget.style.background = 'hsl(var(--muted))'}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* ── Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Project selector — same dropdown as Documents.tsx project filter */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 }}>
              Select Project <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowProjectDrop(v => !v)}
                style={{
                  width: '100%', height: 40, display: 'flex', alignItems: 'center', gap: 8,
                  padding: '0 12px', border: `1px solid ${showProjectDrop ? BLUE : LINE}`,
                  borderRadius: 8, background: 'hsl(var(--input))', cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: showProjectDrop ? `0 0 0 3px ${BLUE}18` : 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                {selectedProject ? (
                  <>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: selectedTypeHex, flexShrink: 0 }} />
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 500, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedProject.name}
                    </span>
                  </>
                ) : (
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 14, color: MUTED }}>Select a project…</span>
                )}
                <ChevronDown style={{ width: 14, height: 14, color: MUTED, flexShrink: 0, transition: 'transform 0.2s', transform: showProjectDrop ? 'rotate(180deg)' : 'none' }} />
              </button>

              {/* Dropdown list — exact same pattern as Documents.tsx project filter */}
              {showProjectDrop && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProjectDrop(false)} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, background: 'hsl(var(--popover))', border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.20)', overflow: 'hidden', padding: '4px 0', maxHeight: 220, overflowY: 'auto' }}>
                    {projects.length === 0 && (
                      <p style={{ padding: '10px 14px', fontSize: 13, color: MUTED }}>No projects found.</p>
                    )}
                    {projects.map(p => {
                      const typeHex = getTypeHex((p as any).task_type);
                      const isActive = selectedProjectId === p.id;
                      return (
                        <button key={p.id}
                          onClick={() => { setSelectedProjectId(p.id); setShowProjectDrop(false); setError(''); }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: isActive ? `${BLUE}18` : 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: isActive ? 700 : 500, color: isActive ? BLUE : TEXT, textAlign: 'left', fontFamily: 'inherit' }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: typeHex, flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{p.name}</span>
                          {isActive && <Check style={{ width: 14, height: 14, color: BLUE }} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Folder context indicator — shown when a folder is pre-selected from tree */}
            {folderId && folderName && selectedProject && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: MUTED }}>
                Uploading into folder: <span style={{ fontWeight: 600, color: TEXT }}>{selectedProject.name} / {folderName}</span>
              </p>
            )}
          </div>

          {/* File drop zone */}
          {!file ? (
            <div
              style={{ border: `2px dashed ${dragOver ? BLUE : LINE}`, background: dragOver ? `${BLUE}12` : 'hsl(var(--muted))', borderRadius: 10, padding: '36px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('upload-file-input')?.click()}
            >
             <div style={{ width: 44, height: 44, borderRadius: 10, background: dragOver ? `${BLUE}18` : 'hsl(var(--accent))', border: `1px solid ${dragOver ? BLUE + '40' : LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Upload style={{ width: 20, height: 20, color: dragOver ? BLUE : MUTED }} />
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: TEXT }}>
                Click to upload <span style={{ fontWeight: 400, color: MUTED }}>or drag and drop</span>
              </p>
              <p style={{ margin: 0, fontSize: 12, color: MUTED }}>PDF, PNG, JPG, DOCX, XLSX, PPTX, JSON, TXT (Max 500MB)</p>
              <input id="upload-file-input" type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>
          ) : (
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${LINE}`, borderRadius: 8, background: 'hsl(var(--muted))', padding: '12px 14px', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EEF4FF', border: `1px solid #c7d2fe`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText style={{ width: 16, height: 16, color: BLUE }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button onClick={() => setFile(null)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${LINE}`, background: 'hsl(var(--card))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: MUTED, flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--card))'; (e.currentTarget as HTMLButtonElement).style.color = MUTED; }}>
                <X style={{ width: 13, height: 13 }} />
              </button>
            </div>
          )}

          {/* Progress / error feedback */}
          {progress && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#EEF4FF', border: `1px solid #c7d2fe`, borderRadius: 8 }}>
              {uploading && <span style={{ width: 14, height: 14, border: `2px solid ${BLUE}30`, borderTopColor: BLUE, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: BLUE }}>{progress}</p>
            </div>
          )}
          {error && (
            <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#EF4444' }}>{error}</p>
            </div>
          )}
        </div>

        {/* ── Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 24px 18px', borderTop: `1px solid ${LINE}` }}>
          <button onClick={onClose}
            style={{ height: 38, padding: '0 18px', border: `1px solid ${LINE}`, borderRadius: 8, background: 'hsl(var(--muted))', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: TEXT, fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
            onMouseLeave={e => e.currentTarget.style.background = 'hsl(var(--muted))'}>
            Cancel
          </button>
          <button onClick={handleUpload} disabled={!canUpload}
            style={{ height: 38, padding: '0 20px', border: 'none', borderRadius: 8, background: canUpload ? BLUE : '#a5b4fc', color: '#fff', fontSize: 14, fontWeight: 600, cursor: canUpload ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s' }}
            onMouseEnter={e => { if (canUpload) e.currentTarget.style.background = '#3558e8'; }}
            onMouseLeave={e => { if (canUpload) e.currentTarget.style.background = BLUE; }}>
            {uploading
              ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Uploading…</>
              : <><Upload style={{ width: 14, height: 14 }} /> Upload</>
            }
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}