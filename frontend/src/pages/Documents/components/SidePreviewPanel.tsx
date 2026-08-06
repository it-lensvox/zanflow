import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, X, Folder, ExternalLink, Clock, MessageSquare, Plus, SortDesc, Move, Share, Pencil } from 'lucide-react';
import { documentsApi, usersApi } from '@/services/api';
import { getDocStatusConfig, getFileExtColor } from '@/config/documentConfig';
import type { Document } from '@/types';

type PreviewTab = 'preview' | 'details' | 'activity' | 'comments';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
   <div className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid hsl(var(--border))' }}>
      <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'hsl(var(--foreground))', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

interface SidePreviewPanelProps {
  doc: Document;
  previewUrl: string | null;
  onClose: () => void;
  onOpenFull: () => void;
}

export function SidePreviewPanel({ doc, previewUrl, onClose, onOpenFull }: SidePreviewPanelProps) {
  const [tab, setTab] = useState<PreviewTab>('preview');
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([]);
  const isOpen = !!doc;

  const { data: activityData } = useQuery({ queryKey: ['document-activity', doc.id], queryFn: () => documentsApi.getActivity(doc.id), enabled: tab === 'activity' });
  const { data: commentsData } = useQuery({ queryKey: ['document-comments', doc.id], queryFn: () => documentsApi.getComments(doc.id), enabled: tab === 'comments' });
  const { data: teamMembersData } = useQuery({ queryKey: ['users-list-comments'], queryFn: usersApi.listAll, enabled: isOpen && showMentions });

  const activities = activityData?.data?.results || [];
  const comments = commentsData?.data?.results || [];
  const teamMembers = teamMembersData || [];
  const filteredMembers = Array.isArray(teamMembers) ? teamMembers.filter((member: any) => {
    const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.username || '';
    return fullName.toLowerCase().includes(mentionSearch.toLowerCase()) || member.email?.toLowerCase().includes(mentionSearch.toLowerCase());
  }) : [];

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value; setCommentText(text);
    const words = text.slice(0, e.target.selectionStart).split(/\s/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@') && lastWord.length > 0) { setShowMentions(true); setMentionSearch(lastWord.slice(1)); }
    else { setShowMentions(false); setMentionSearch(''); }
  };

  const insertMention = (member: any) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = commentText.slice(0, cursorPos);
    const textAfterCursor = commentText.slice(cursorPos);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];
    const atSymbolPos = textBeforeCursor.lastIndexOf(lastWord);
    const formattedName = `${member.first_name || ''}${member.last_name || ''}`.trim().replace(/\s+/g, '') || member.username || '';
    const newText = commentText.slice(0, atSymbolPos) + '@' + formattedName + ' ' + textAfterCursor;
    setCommentText(newText); setShowMentions(false); setMentionSearch('');
    setMentionedUserIds(prev => prev.includes(member.id) ? prev : [...prev, member.id]);
    setTimeout(() => { textareaRef.current?.focus(); const p = (commentText.slice(0, atSymbolPos) + '@' + formattedName + ' ').length; textareaRef.current?.setSelectionRange(p, p); }, 0);
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try { await documentsApi.addComment(doc.id, commentText.trim(), mentionedUserIds); setCommentText(''); setShowMentions(false); setMentionedUserIds([]); queryClient.invalidateQueries({ queryKey: ['document-comments', doc.id] }); }
    catch { alert('Failed to add comment. Please try again.'); }
  };

  const _handleDeleteComment = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try { await documentsApi.deleteComment(doc.id, commentId); queryClient.invalidateQueries({ queryKey: ['document-comments', doc.id] }); }
    catch { alert('Failed to delete comment. Please try again.'); }
  };

  const renderCommentWithMentions = (text: string) => text.split(/(@\w+)/g).map((part, i) =>
    part.startsWith('@')
      ? <span key={i} style={{ color: '#4169FF', fontWeight: 600, cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>{part}</span>
      : <span key={i}>{part}</span>
  );

  const fmtD = (d?: string) => d ? new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const fmtS = (d?: string) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
  const fn = doc.original_file_name || doc.name || 'Document';
  const ext = fn.split('.').pop()?.toLowerCase() || '';
  const ss = getDocStatusConfig(doc.status);
  const ib = getFileExtColor(fn);
  const tabs: { k: PreviewTab; l: string; badge?: number }[] = [
    { k: 'preview', l: 'Preview' }, { k: 'details', l: 'Details' }, { k: 'activity', l: 'Activity' },
    { k: 'comments', l: 'Comments', badge: comments.length > 0 ? comments.length : undefined }
  ];

  return (
    <div className="flex-shrink-0 flex flex-col" style={{ width: 380, borderLeft: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded flex items-center justify-center text-white flex-shrink-0" style={{ width: 32, height: 40, background: ib }}><FileText className="w-4 h-4" /></div>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'hsl(var(--foreground))' }} className="truncate">{fn}</span>
        </div>
        <button onClick={onClose} style={{ color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X className="w-4 h-4" /></button>
      </div>
      <div style={{ borderBottom: '1px solid hsl(var(--border))', padding: '0 20px' }}>
        <div className="flex gap-5">
          {tabs.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} className="flex items-center gap-1.5" style={{ padding: '8px 4px', fontSize: 14, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: tab === t.k ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))', borderBottom: `2px solid ${tab === t.k ? '#4169FF' : 'transparent'}` }}>
              {t.l}{t.badge && <span className="rounded-full" style={{ background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 6px', marginLeft: 6 }}>{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'preview' && (<>
         <div className="rounded-lg overflow-hidden mb-5" style={{ border: '1px solid hsl(var(--border))' }}>
            {previewUrl && (ext === 'pdf' || doc.file_type?.includes('pdf')) ? (
              <div><iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`} className="w-full border-0" style={{ height: 400 }} title={fn} />
                <div className="flex items-center justify-center gap-3 py-3" style={{ background: 'hsl(var(--muted))', borderTop: '1px solid hsl(var(--border))', fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
                  <button style={{ padding: 4, color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none', cursor: 'pointer' }}></button>
                </div></div>
            ) : previewUrl && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext) ? (
              <div className="p-4 flex items-center justify-center" style={{ background: 'hsl(var(--muted))', minHeight: 300 }}><img src={previewUrl} alt={fn} className="max-w-full max-h-[300px] object-contain rounded" /></div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-center" style={{ background: 'hsl(var(--card))', minHeight: 300 }}>
                <div className="rounded-lg flex items-center justify-center text-white mb-3" style={{ width: 64, height: 80, background: ib }}><FileText className="w-6 h-6" /></div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: 4 }}>{fn}</p><p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Click "Open Document" to view full preview</p>
              </div>)}
          </div>
          <div>
            <DetailRow label="Type" value={ext.toUpperCase() || doc.file_type || 'Unknown'} />
            <DetailRow label="Status" value={<span className="inline-flex rounded-full" style={{ padding: '4px 12px', fontSize: 12, fontWeight: 500, background: ss.bg, color: ss.text }}>{ss.label}</span>} />
            <DetailRow label="Project" value={<span className="inline-flex items-center gap-1.5 rounded-md" style={{ padding: '4px 10px', background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontSize: 13 }}><Folder className="w-3 h-3" />{doc.project_name || 'General'}</span>} />
            <DetailRow label="Owner" value={doc.created_by?.full_name || 'System'} />
            <DetailRow label="Created" value={fmtS(doc.created_at)} />
            <DetailRow label="Updated" value={fmtD(doc.updated_at)} />
            {doc.labels && doc.labels.length > 0 && <DetailRow label="Tags" value={<div className="flex flex-wrap gap-1.5 justify-end">{doc.labels.slice(0, 2).map(l => <span key={l.id} className="rounded-md" style={{ padding: '4px 10px', fontSize: 12, fontWeight: 500, background: l.color ? `${l.color}20` : '#F3E8FF', color: l.color || '#7C3AED' }}>{l.name}</span>)}
            {doc.labels.length > 2 && <span className="rounded-md" style={{ padding: '4px 8px', fontSize: 12, fontWeight: 500, background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>+{doc.labels.length - 2}</span>}</div>} />}
          </div>
          <button onClick={onOpenFull} className="w-full mt-5 rounded-lg flex items-center justify-center gap-2" style={{ padding: 12, background: '#4169FF', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = '#3554CC'; }} onMouseLeave={e => { e.currentTarget.style.background = '#4169FF'; }}><ExternalLink className="w-4 h-4" />Open Document</button>
        </>)}
        {tab === 'details' && <div>
          <DetailRow label="File Name" value={<span style={{ fontWeight: 500, color: 'hsl(var(--foreground))', wordBreak: 'break-all' as const }}>{fn}</span>} />
          <DetailRow label="Type" value={ext.toUpperCase() || 'Unknown'} />
          <DetailRow label="Status" value={<span className="inline-flex rounded-full" style={{ padding: '4px 12px', fontSize: 12, fontWeight: 500, background: ss.bg, color: ss.text }}>{ss.label}</span>} />
          <DetailRow label="Project" value={doc.project_name || 'General'} />
          <DetailRow label="Owner" value={doc.created_by?.full_name || 'System'} />
          <DetailRow label="Created" value={fmtD(doc.created_at)} />
          <DetailRow label="Updated" value={fmtD(doc.updated_at)} />
          {doc.description && <DetailRow label="Description" value={doc.description} />}
        </div>}
        {tab === 'activity' && (
          <div className="space-y-3">
            {activities.length > 0 ? activities.map((activity: any, index: number) => (
              <div key={index} className="flex gap-3 pb-3" style={{ borderBottom: index < activities.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div className="flex-shrink-0 mt-1">
                  {activity.type === 'created' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#D1FAE5' }}><Plus className="w-4 h-4" style={{ color: '#059669' }} /></div>}
                  {activity.type === 'status_changed' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#FFF4E6' }}><SortDesc className="w-4 h-4" style={{ color: '#D97706' }} /></div>}
                  {activity.type === 'updated' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#DBEAFE' }}><Pencil className="w-4 h-4" style={{ color: '#2563EB' }} /></div>}
                  {activity.type === 'moved' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#F3E8FF' }}><Move className="w-4 h-4" style={{ color: '#7C3AED' }} /></div>}
                  {activity.type === 'shared' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#E0E7FF' }}><Share className="w-4 h-4" style={{ color: '#4F46E5' }} /></div>}
                  {activity.type === 'commented' && <div className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, background: '#FCE7F3' }}><MessageSquare className="w-4 h-4" style={{ color: '#EC4899' }} /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, color: 'hsl(var(--foreground))', fontWeight: 500, marginBottom: 2 }}>{activity.description}</p>
                  <div className="flex items-center gap-2"><span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{activity.user?.full_name || 'System'}</span><span style={{ color: 'hsl(var(--border))' }}>•</span><span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{new Date(activity.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-12 text-center"><Clock className="w-10 h-10 mb-3" style={{ color: 'hsl(var(--muted-foreground))' }} /><p style={{ fontSize: 14, fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>No activity yet</p></div>
            )}
          </div>
        )}
        {tab === 'comments' && (
          <div className="space-y-4">
            <div className="space-y-4">
              {comments.length > 0 ? comments.map((comment: any) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ width: 32, height: 32, backgroundColor: comment.user?.avatar_color || '#4169FF', fontSize: 12 }}>
                    {comment.user?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="rounded-lg" style={{ background: 'hsl(var(--muted))', padding: '10px 12px' }}>
                      <div className="flex items-center gap-2 mb-1"><span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{comment.user?.full_name || 'Anonymous'}</span><span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{new Date(comment.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                      <p style={{ fontSize: 13, color: '#374151', lineHeight: '1.5' }}>{renderCommentWithMentions(comment.content)}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-12 text-center"><MessageSquare className="w-10 h-10 mb-3" style={{ color: 'hsl(var(--muted-foreground))' }} /><p style={{ fontSize: 14, fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>No comments yet</p></div>
              )}
            </div>
            <div className="pt-4 relative" style={{ borderTop: '1px solid #e5e7eb' }}>
              <label htmlFor="comment-input" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>Add a comment</label>
              <div className="relative">
                <textarea ref={textareaRef} id="comment-input" value={commentText} onChange={handleCommentChange} placeholder="Write a comment... (Type @ to mention someone)"
                  style={{ width: '100%', minHeight: 80, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#4169FF'}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; setTimeout(() => setShowMentions(false), 200); }}
                />
                {showMentions && filteredMembers.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white border rounded-lg shadow-lg overflow-hidden" style={{ width: '100%', maxHeight: 200, overflowY: 'auto', zIndex: 1000, border: '1px solid #e5e7eb' }}>
                    <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>Mention Someone</div>
                    {filteredMembers.map((member: any) => {
                      const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.username;
                      const initials = `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase() || '?';
                      return (
                        <div key={member.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer" style={{ fontSize: 13 }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} onMouseDown={() => insertMention(member)}>
                          <div className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ width: 28, height: 28, backgroundColor: member.avatar_color || '#4169FF', fontSize: 11 }}>{initials}</div>
                          <div className="flex-1 min-w-0"><div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{fullName}</div><div style={{ fontSize: 11, color: '#6b7280' }}>{member.email}</div></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-2">
                <button onClick={handleAddComment} disabled={!commentText.trim()} className="rounded-lg flex items-center gap-2" style={{ padding: '6px 16px', background: !commentText.trim() ? '#a5b4fc' : '#4169FF', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: !commentText.trim() ? 'not-allowed' : 'pointer' }}>
                  <MessageSquare className="w-3.5 h-3.5" />Post Comment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}