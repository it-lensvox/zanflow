import React, { useState } from 'react';
import { Upload, X, Folder, FileText } from 'lucide-react';
import { documentsApi } from '@/services/api';

interface UploadDocumentModalProps {
  isOpen:      boolean;
  onClose:     () => void;
  projectId:   number | null;
  projectName: string;
  folderId:    string | null;
  folderName:  string | null;
  onSuccess:   () => void;
}

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

export function UploadDocumentModal({ isOpen, onClose, projectId, projectName, folderId, folderName, onSuccess }: UploadDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  React.useEffect(() => { if (isOpen) { setFile(null); setUploading(false); setProgress(''); setError(''); } }, [isOpen]);

  const handleFileSelect = (f: File) => { setFile(f); setError(''); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileSelect(f); };

  const handleUpload = async () => {
    if (!file || !projectId) { setError('Please select a project from the tree first.'); return; }
    setUploading(true); setError(''); setProgress('Getting upload URL...');
    try {
      const { url: s3Url, fields: s3Fields, file_key } = await documentsApi.getUploadUrl(projectId, { file_name: file.name, file_type: file.type || 'application/octet-stream' });
      setProgress('Uploading file...');
      await documentsApi.uploadFileToS3(s3Url, s3Fields, file);
      setProgress('Confirming upload...');
      await documentsApi.confirmUpload(projectId, { file_key, file_name: file.name, file_type: getFileTypeFromExt(file.name), ...(folderId ? { folder: folderId } : {}) } as any);
      setProgress('Done!');
      onSuccess();
      setTimeout(() => onClose(), 500);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Upload failed.');
    } finally { setUploading(false); }
  };

  if (!isOpen) return null;
  const uploadTarget = folderId && folderName ? `${projectName} / ${folderName}` : projectName || 'No project selected';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative w-full max-w-[520px] rounded-xl shadow-2xl" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div className="flex items-center gap-2"><Upload className="w-5 h-5" style={{ color: '#4169FF' }} /><span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Upload Document</span></div>
          <button onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-3 rounded-lg" style={{ padding: '12px 16px', background: '#EEF2FF', border: '1px solid #c7d2fe' }}>
            <Folder className="w-5 h-5 flex-shrink-0" style={{ color: '#4169FF' }} />
            <div><p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Uploading to</p><p style={{ fontSize: 14, fontWeight: 600, color: '#4169FF' }}>{uploadTarget}</p></div>
          </div>
          {!projectId && <p style={{ fontSize: 13, color: '#EF4444', fontWeight: 500 }}>Please select a project from the tree view first.</p>}
          {!file ? (
            <div className="flex flex-col items-center justify-center rounded-lg cursor-pointer" style={{ border: `2px dashed ${dragOver ? '#4169FF' : '#e5e7eb'}`, background: dragOver ? '#EEF2FF' : '#f9fafb', padding: '40px 20px' }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
              onClick={() => document.getElementById('upload-file-input')?.click()}>
              <Upload className="w-10 h-10 mb-3" style={{ color: dragOver ? '#4169FF' : '#6b7280' }} />
              <p style={{ fontSize: 14, color: '#1a1a1a', marginBottom: 4 }}><strong>Click to upload</strong> or drag and drop</p>
              <p style={{ fontSize: 12, color: '#6b7280' }}>PDF, PNG, JPG, DOCX, XLSX, PPTX, JSON, TXT (Max 500MB)</p>
              <input id="upload-file-input" type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg" style={{ border: '1px solid #e5e7eb', background: '#f9fafb', padding: '12px 16px' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded flex items-center justify-center text-white flex-shrink-0" style={{ width: 36, height: 44, background: '#4169FF' }}><FileText className="w-5 h-5" /></div>
                <div className="min-w-0"><p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{file.name}</p><p style={{ fontSize: 12, color: '#6b7280' }}>{formatFileSize(file.size)}</p></div>
              </div>
              <button onClick={() => setFile(null)} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X className="w-4 h-4" /></button>
            </div>
          )}
          {progress && <p style={{ fontSize: 13, color: '#4169FF', fontWeight: 500 }}>{progress}</p>}
          {error && <p style={{ fontSize: 13, color: '#EF4444', fontWeight: 500 }}>{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #e5e7eb' }}>
          <button onClick={onClose} className="rounded-lg" style={{ padding: '8px 20px', border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#1a1a1a' }}>Cancel</button>
          <button onClick={handleUpload} disabled={uploading || !file || !projectId} className="rounded-lg flex items-center gap-2"
            style={{ padding: '8px 20px', background: (!file || !projectId || uploading) ? '#a5b4fc' : '#4169FF', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: (!file || !projectId || uploading) ? 'not-allowed' : 'pointer' }}>
            {uploading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload</>}
          </button>
        </div>
      </div>
    </div>
  );
}