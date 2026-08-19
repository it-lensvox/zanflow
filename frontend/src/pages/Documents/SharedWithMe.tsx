import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText, Search, X, Bell, ExternalLink, Folder,
} from 'lucide-react';
import { documentsApi } from '@/services/api';
import type { Document } from '@/types';
import { useNotifications } from '@/hooks/useNotifications';
import { DocumentPreview } from '@/components/common/DocumentPreview';
import { Pagination } from '@/components/ui/Pagination';

// Design tokens
const BLUE = '#4169FF';
const LINE = '#e5e7eb';
const TEXT = '#1a1a1a';
const MUTED = '#6b7280';

// ─── File icon color ──────────────────────────────────────────────────────────
function fileIconColor(fileType: string): string {
  const map: Record<string, string> = {
    pdf: '#EF4444', doc: '#2563EB', docx: '#2563EB',
    xls: '#16A34A', xlsx: '#16A34A', ppt: '#EA580C', pptx: '#EA580C',
    png: '#7C3AED', jpg: '#7C3AED', jpeg: '#7C3AED', image: '#7C3AED',
  };
  return map[fileType?.toLowerCase()] || '#6B7280';
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    draft:     { bg: '#F3F4F6', color: '#6B7280' },
    in_review: { bg: '#FFF4E6', color: '#D97706' },
    approved:  { bg: '#E8F5E9', color: '#16A34A' },
    archived:  { bg: '#F3F4F6', color: '#6B7280' },
  };
  const s = map[status] ?? map.draft;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user, size = 32 }: { user?: { full_name?: string; username?: string; avatar?: string | null } | null; size?: number }) {
  if (!user) return <span style={{ color: MUTED, fontSize: 12 }}>—</span>;
  const name = user.full_name || user.username || '?';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#7C3AED', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899'];
  const color = colors[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
  return (
    <div title={name} style={{ width: size, height: size, borderRadius: '50%', background: user.avatar ? 'transparent' : color, display: 'grid', placeItems: 'center', fontSize: size * 0.34, fontWeight: 600, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
      {user.avatar
        ? <img src={user.avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        : initials
      }
    </div>
  );
}

// ─── Side preview panel ───────────────────────────────────────────────────────
function SidePanel({ doc, onClose, onOpenFull }: { doc: Document; onClose: () => void; onOpenFull: () => void }) {
  const fn = doc.original_file_name || doc.name;
  const ext = fn.split('.').pop()?.toLowerCase() || '';
  const iconColor = fileIconColor(doc.file_type || ext);
  const fmtD = (d?: string) => d ? new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

  return (
    <div style={{ width: 340, flexShrink: 0, borderLeft: `1px solid ${LINE}`, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${LINE}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ width: 32, height: 40, borderRadius: 4, background: iconColor, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <FileText className="w-4 h-4" style={{ color: '#fff' }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fn}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4 }}><X className="w-4 h-4" /></button>
      </div>

      {/* Details */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {[
          { label: 'File Name', value: fn },
          { label: 'Type', value: ext.toUpperCase() || doc.file_type },
          { label: 'Status', value: <StatusPill status={doc.status} /> },
          { label: 'Project', value: <span style={{ background: '#EEF2FF', color: '#4F46E5', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>{doc.project_name || 'General'}</span> },
          { label: 'Shared By', value: <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar user={doc.shared_by} size={24} /><span style={{ fontSize: 13 }}>{doc.shared_by?.full_name || '—'}</span></div> },
          { label: 'Shared With', value: <div style={{ display: 'flex', gap: 4 }}>{(doc.shared_with || []).map((u, i) => <Avatar key={i} user={u} size={24} />)}</div> },
          { label: 'Updated', value: fmtD(doc.updated_at) },
          { label: 'Created', value: fmtD(doc.created_at) },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${LINE}`, fontSize: 13 }}>
            <span style={{ color: MUTED }}>{label}</span>
            <span style={{ fontWeight: 500, color: TEXT, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Open button */}
      <div style={{ padding: 16, borderTop: `1px solid ${LINE}` }}>
        <button onClick={onOpenFull} style={{ width: '100%', height: 42, background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ExternalLink className="w-4 h-4" /> Open Document
        </button>
      </div>
    </div>
  );
}

// ─── Main page 
export function SharedWithMe() {
  const [searchParams] = useSearchParams();
  const { unreadCount } = useNotifications();

  const highlightDocId = searchParams.get('highlight') || '';
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; fileType?: string } | null>(null);
  const rowsPerPage = 25;

  // ── Fetch shared documents
  const { data, isLoading } = useQuery({
    queryKey: ['documents-shared-with-me', currentPage],
    queryFn: () => documentsApi.sharedWithMe({ page: currentPage }),
    staleTime: 0,
  });

  const allDocs: Document[] = data?.results || data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const hasNext = !!data?.next;
  const hasPrev = !!data?.previous;

  // ── Filter by search 
  const filtered = allDocs.filter(d =>
    !searchTerm || (d.original_file_name || d.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Open full preview 
  const handleOpenFull = async (doc: Document) => {
    try {
      const res = await documentsApi.getDownloadUrl(doc.project, { document_id: doc.id });
      if (res?.url) {
        setPreviewDoc({ url: res.url, fileName: doc.original_file_name || doc.name, fileType: doc.file_type });
      }
    } catch (e) {
      console.error('Failed to get download URL:', e);
    }
  };

  const th: React.CSSProperties = { textAlign: 'left', color: '#344054', fontSize: 11, fontWeight: 800, padding: '12px 10px', borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px', borderBottom: `1px solid ${LINE}`, verticalAlign: 'middle', fontSize: 13 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', overflow: 'hidden' }}>

      {/* ── TOP BAR  */}
      <div style={{ flexShrink: 0, background: '#fff', borderBottom: `1px solid ${LINE}`, padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Shared With Me</h1>
            <p style={{ margin: '4px 0 0', color: MUTED, fontSize: 14 }}>Documents others have shared with you</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Bell */}
            <div style={{ width: 43, height: 43, border: `1px solid ${LINE}`, borderRadius: 9, display: 'grid', placeItems: 'center', background: '#fff', cursor: 'pointer', position: 'relative' }}>
              <Bell className="w-5 h-5" style={{ color: MUTED }} />
              {unreadCount > 0 && <span style={{ position: 'absolute', right: -5, top: -7, background: '#EF4444', color: '#fff', borderRadius: '50%', fontSize: 11, minWidth: 18, height: 18, display: 'grid', placeItems: 'center', fontWeight: 700 }}>{unreadCount}</span>}
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ height: 40, background: '#f9fafb', border: `1px solid ${LINE}`, borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
          <Search className="w-4 h-4" style={{ color: MUTED, flexShrink: 0 }} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search shared documents..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: TEXT, fontFamily: 'inherit', background: 'transparent' }}
          />
          {searchTerm && <X className="w-4 h-4 cursor-pointer" style={{ color: MUTED }} onClick={() => setSearchTerm('')} />}
        </div>
      </div>

      {/* ── CONTENT  */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', border: `4px solid #e5e7eb`, borderTop: `4px solid ${BLUE}`, animation: 'spin 1s linear infinite' }} />
                <p style={{ color: MUTED, fontSize: 14 }}>Loading shared documents...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, color: MUTED }}>
                <Folder style={{ opacity: 0.2, width: 64, height: 64, marginBottom: 16 }} />
                <p style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: '0 0 8px' }}>No shared documents</p>
                <p style={{ fontSize: 14, margin: 0 }}>Documents shared with you will appear here</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={th}>Document</th>
                    <th style={th}>Project</th>
                    <th style={th}>Shared By</th>
                    <th style={th}>Status</th>
                    <th style={th}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc, idx) => {
                    const fn = doc.original_file_name || doc.name;
                    const ext = fn.split('.').pop()?.toLowerCase() || '';
                    const iconColor = fileIconColor(doc.file_type || ext);
                    const isSelected = selectedDoc?.id === doc.id;
                    const isHighlighted = highlightDocId === doc.id;
                    return (
                      <tr
                        key={doc.id}
                        onClick={() => setSelectedDoc(isSelected ? null : doc)}
                        ref={isHighlighted ? (el) => {
                          if (el) {
                            setTimeout(() => {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              setTimeout(() => { el.style.background = ''; el.style.outline = ''; }, 3000);
                            }, 500);
                          }
                        } : undefined}
                        style={{
                          background: isHighlighted ? '#FEF9C3' : isSelected ? '#f7faff' : idx % 2 === 0 ? '#fff' : '#fafbfc',
                          outline: isHighlighted ? '2px solid #F59E0B' : isSelected ? `2px solid ${BLUE}` : 'none',
                          cursor: 'pointer',
                          transition: 'background 0.3s',
                        }}
                        onMouseOver={e => { if (!isSelected && !isHighlighted) e.currentTarget.style.background = '#f3f4f6'; }}
                        onMouseOut={e => { e.currentTarget.style.background = isHighlighted ? '#FEF9C3' : isSelected ? '#f7faff' : idx % 2 === 0 ? '#fff' : '#fafbfc'; }}
                      >
                        {/* Document name */}
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 40, borderRadius: 4, background: iconColor, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <FileText className="w-4 h-4" style={{ color: '#fff' }} />
                            </div>
                            <div>
                              <p style={{ margin: 0, fontWeight: 600, color: TEXT, fontSize: 13 }}>{fn}</p>
                              {doc.description && <p style={{ margin: 0, fontSize: 11, color: MUTED }}>{doc.description}</p>}
                            </div>
                          </div>
                        </td>
                        {/* Project */}
                        <td style={td}>
                          <span style={{ background: '#EEF2FF', color: '#4F46E5', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Folder className="w-3 h-3" style={{ flexShrink: 0 }} />
                            {(doc.project_name || 'General').length > 13
                              ? (doc.project_name || 'General').slice(0, 13) + '...'
                              : doc.project_name || 'General'
                            }
                          </span>
                        </td>
                        {/* Shared By */}
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar user={doc.shared_by} size={32} />
                          </div>
                        </td>
                        {/* Status */}
                        <td style={td}><StatusPill status={doc.status} /></td>
                        {/* Updated */}
                        <td style={{ ...td, color: MUTED }}>
                          {new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── PAGINATION  */}
          {totalCount > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={rowsPerPage}
              onPageChange={setCurrentPage}
              itemLabel="documents"
            />
          )}
        </div>

        {/* ── SIDE PANEL  */}
        {selectedDoc && (
          <SidePanel
            doc={selectedDoc}
            onClose={() => setSelectedDoc(null)}
            onOpenFull={() => handleOpenFull(selectedDoc)}
          />
        )}
      </div>

      {/* Full document preview */}
      {previewDoc && (
        <div className="fixed inset-0 z-50">
          <DocumentPreview
            url={previewDoc.url}
            fileName={previewDoc.fileName}
            fileType={previewDoc.fileType}
            onClose={() => setPreviewDoc(null)}
          />
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

export default SharedWithMe;