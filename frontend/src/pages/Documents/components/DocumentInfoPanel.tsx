import React from 'react';
import { FileText, User, Calendar, Info, X } from 'lucide-react';
import type { Document } from '@/types';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid #e5e7eb' }}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500, textAlign: 'right' as const, maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

export function DocumentInfoPanel({ doc, onClose }: { doc: Document | null; onClose: () => void }) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!doc) return;
    const handleClickOutside = (event: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose(); };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClickOutside); };
  }, [doc, onClose]);

  if (!doc) return null;
  const fmtD = (d?: string) => d ? new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    { icon: <FileText className="w-4 h-4" style={{ color: '#4169FF' }} />, label: 'File Name', value: <span style={{ color: '#1a1a1a', fontWeight: 600 }}>{doc.original_file_name || doc.name}</span> },
    { icon: <User className="w-4 h-4" style={{ color: '#4169FF' }} />, label: 'Uploaded By', value: doc.created_by?.full_name || 'System' },
    { icon: <Calendar className="w-4 h-4" style={{ color: '#EF4444' }} />, label: 'Created At', value: fmtD(doc.created_at) },
    { icon: <Calendar className="w-4 h-4" style={{ color: '#D97706' }} />, label: 'Updated At', value: fmtD(doc.updated_at) },
  ];
  if (doc.description) rows.splice(1, 0, { icon: <FileText className="w-4 h-4" style={{ color: '#6b7280' }} />, label: 'Description', value: doc.description });

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      <div ref={panelRef} className="pointer-events-auto h-full flex flex-col animate-in slide-in-from-right duration-300" style={{ width: 340, background: '#fff', borderLeft: '1px solid #e5e7eb', boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <div className="flex items-center gap-2"><Info className="w-4 h-4" style={{ color: '#4169FF' }} /><span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Document Info</span></div>
          <button onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="flex items-start gap-3 py-1.5" style={{ borderBottom: '1px solid #f9fafb' }}>
              <div className="mt-0.5 flex-shrink-0">{r.icon}</div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: '#1a1a1a' }}>{r.value}</div>
              </div>
            </div>
          ))}
          <DetailRow label="Tags" value={
            doc.labels && doc.labels.length > 0
              ? <div className="flex flex-wrap gap-1.5 justify-end">
                {doc.labels.slice(0, 2).map(l => <span key={l.id} className="rounded-md" style={{ padding: '4px 10px', fontSize: 12, fontWeight: 500, background: l.color ? `${l.color}20` : '#F3E8FF', color: l.color || '#7C3AED' }}>{l.name}</span>)}
                {doc.labels.length > 2 && <span className="rounded-md" style={{ padding: '4px 8px', fontSize: 12, fontWeight: 500, background: '#F3F4F6', color: '#6B7280' }}>+{doc.labels.length - 2}</span>}
              </div>
              : <span style={{ color: '#6b7280', fontSize: 13 }}>—</span>
          } />
        </div>
      </div>
    </div>
  );
}