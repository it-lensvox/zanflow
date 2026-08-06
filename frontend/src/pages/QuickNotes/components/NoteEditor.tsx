import { useState, useEffect, useRef } from 'react';
import { FileText, Loader2, Paperclip, Pencil, Bold, Italic, List, ListOrdered, NotebookPen, Trash2 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { quickNotesApi } from '@/services/api';
import DeleteModal from '@/components/common/Deletemodal';
import { DocumentPreview } from '@/components/common/DocumentPreview';
import type { QuickNote } from '@/types';

interface NoteEditorProps {
  selectedNote:       QuickNote | null;
  isPending?:         boolean;
  isReadOnly?:        boolean;
  getNoteTitle:       (note: QuickNote) => string;
  onUpdateNote:       (id: number | 'pending', content: string) => void;
  onRenameNote:       (noteId: number, newTitle: string) => void;
  onAddAttachment:    (noteId: number, attachment: import('@/types').QuickNoteAttachment) => void;
  onRemoveAttachment: (noteId: number, attachmentId: number) => void;
  editorRef?:         React.RefObject<HTMLTextAreaElement>;
  users:              import('@/types').User[];
}

export function NoteEditor({ selectedNote, isPending = false, isReadOnly = false, getNoteTitle, onUpdateNote, onRenameNote, onAddAttachment, onRemoveAttachment, editorRef, users }: NoteEditorProps) {
  const [localContent,      setLocalContent]      = useState(selectedNote?.content ?? '');
  const debounceRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef         = useRef<HTMLInputElement>(null);
  const [isUploading,       setIsUploading]       = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<import('@/types').QuickNoteAttachment | null>(null);
  const [attachmentToDelete,setAttachmentToDelete]= useState<{ id: number; name: string } | null>(null);
  const [isDeleting,        setIsDeleting]        = useState(false);
  const [isEditingTitle,    setIsEditingTitle]    = useState(false);
  const [titleVal,          setTitleVal]          = useState('');
  const titleInputRef        = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isEditingTitle) titleInputRef.current?.focus(); }, [isEditingTitle]);
  useEffect(() => { setLocalContent(selectedNote?.content ?? ''); }, [selectedNote?.id]);
  useEffect(() => { if (isPending) setLocalContent(''); }, [isPending]);
  useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current); }; }, []);

  const startEditingTitle = () => {
    if (isReadOnly || isPending || !selectedNote) return;
    setTitleVal(getNoteTitle(selectedNote));
    setIsEditingTitle(true);
  };

  const commitTitle = () => {
    if (!selectedNote) return;
    const trimmed = titleVal.trim();
    if (trimmed && trimmed !== getNoteTitle(selectedNote)) onRenameNote(selectedNote.id, trimmed);
    setIsEditingTitle(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const value = e.target.value;
    setLocalContent(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onUpdateNote(isPending ? 'pending' : selectedNote!.id, value), 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const target = e.target as HTMLTextAreaElement;
    const { selectionStart, selectionEnd, value } = target;

    if (value.length === 0 && e.key.length === 1 && !e.ctrlKey && !e.metaKey && e.key !== 'Backspace') {
      e.preventDefault();
      const newValue = `1. ${e.key}`;
      setLocalContent(newValue);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onUpdateNote(isPending ? 'pending' : selectedNote!.id, newValue), 800);
      setTimeout(() => { target.selectionStart = target.selectionEnd = newValue.length; }, 0);
      return;
    }

    if (e.key === 'Enter') {
      const lines = value.substring(0, selectionStart).split('\n');
      const currentLine = lines[lines.length - 1];
      const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        e.preventDefault();
        const [, indent, numStr, text] = numberedMatch;
        if (text.trim() === '') {
          const newValue = value.substring(0, selectionStart - currentLine.length) + '\n' + value.substring(selectionEnd);
          setLocalContent(newValue);
          setTimeout(() => { target.selectionStart = target.selectionEnd = selectionStart - currentLine.length + 1; }, 0);
          return;
        }
        const insertion = `\n${indent}${parseInt(numStr, 10) + 1}. `;
        const newValue = value.substring(0, selectionStart) + insertion + value.substring(selectionEnd);
        setLocalContent(newValue);
        setTimeout(() => { target.selectionStart = target.selectionEnd = selectionStart + insertion.length; }, 0);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onUpdateNote(isPending ? 'pending' : selectedNote!.id, newValue), 800);
        return;
      }
      const bulletMatch = currentLine.match(/^(\s*)([-*])\s+(.*)$/);
      if (bulletMatch) {
        e.preventDefault();
        const [, indent, bullet, text] = bulletMatch;
        if (text.trim() === '') {
          const newValue = value.substring(0, selectionStart - currentLine.length) + '\n' + value.substring(selectionEnd);
          setLocalContent(newValue);
          setTimeout(() => { target.selectionStart = target.selectionEnd = selectionStart - currentLine.length + 1; }, 0);
          return;
        }
        const insertion = `\n${indent}${bullet} `;
        const newValue = value.substring(0, selectionStart) + insertion + value.substring(selectionEnd);
        setLocalContent(newValue);
        setTimeout(() => { target.selectionStart = target.selectionEnd = selectionStart + insertion.length; }, 0);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onUpdateNote(isPending ? 'pending' : selectedNote!.id, newValue), 800);
        return;
      }
    }
  };

  const applyFormatting = (prefix: string, suffix = '') => {
    if (!editorRef?.current || isReadOnly) return;
    const target = editorRef.current;
    const { selectionStart, selectionEnd, value } = target;
    const newValue = value.substring(0, selectionStart) + prefix + value.substring(selectionStart, selectionEnd) + suffix + value.substring(selectionEnd);
    setLocalContent(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onUpdateNote(isPending ? 'pending' : selectedNote!.id, newValue), 800);
    setTimeout(() => { target.focus(); target.selectionStart = selectionStart + prefix.length; target.selectionEnd = selectionEnd + prefix.length; }, 0);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !selectedNote || isPending) return;
    try {
      setIsUploading(true);
      const newAttachments = await Promise.all(files.map(f => quickNotesApi.uploadAttachment(selectedNote.id, f)));
      newAttachments.forEach(a => onAddAttachment(selectedNote.id, a));
    } catch (err) { console.error('Upload failed:', err); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const confirmDeleteAttachment = async () => {
    if (!selectedNote || !attachmentToDelete) return;
    try {
      setIsDeleting(true);
      await quickNotesApi.deleteAttachment(attachmentToDelete.id);
      onRemoveAttachment(selectedNote.id, attachmentToDelete.id);
      setAttachmentToDelete(null);
    } catch (err) { console.error('Failed to delete attachment:', err); }
    finally { setIsDeleting(false); }
  };

  if (!selectedNote && !isPending) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--card))', gap: 12 }}>
        <FileText style={{ width: 36, height: 36 }} />
        <p style={{ fontSize: 14 }}>Select or create a note</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'hsl(var(--card))', overflow: 'hidden' }}>
      {/* Note header */}
      <div style={{ padding: '20px 32px 12px', flexShrink: 0, borderBottom: '1px solid hsl(var(--border))' }} className="group">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
            {isEditingTitle && selectedNote ? (
              <input ref={titleInputRef} value={titleVal} onChange={e => setTitleVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setIsEditingTitle(false); }}
                onBlur={commitTitle}
                style={{ width: '100%', fontSize: 18, fontWeight: 600, color: 'hsl(var(--foreground))', background: 'transparent', border: 'none', borderBottom: '1px solid #4169FF', outline: 'none', padding: '0 0 2px' }} placeholder="Note title…" />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 18, fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedNote ? getNoteTitle(selectedNote) : 'New Note'}
                </p>
                {selectedNote && !isPending && !isReadOnly && (
                  <button onClick={startEditingTitle} title="Rename"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ padding: 4, color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, display: 'flex' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'hsl(var(--accent))'; e.currentTarget.style.color = 'hsl(var(--foreground))'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; }}>
                    <Pencil style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{selectedNote ? formatRelativeTime(selectedNote.updated_at) : 'Start typing to save…'}</p>
              {selectedNote?.updated_by && (() => {
                const u = users.find(user => user.id === selectedNote.updated_by);
                const name = u?.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u?.username || 'User');
                return (
                  <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, background: 'hsl(var(--muted))', padding: '2px 7px', borderRadius: 4, color: 'hsl(var(--muted-foreground))' }}>
                    <NotebookPen style={{ width: 10, height: 10 }} />Last edited by {name}
                  </span>
                );
              })()}
            </div>
          </div>
          {selectedNote && !isPending && !isReadOnly && (
            <div style={{ flexShrink: 0, marginLeft: 16 }}>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="*/*" multiple />
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} title="Upload attachment"
               style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 5, borderRadius: 5, border: 'none', background: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'hsl(var(--accent))'; e.currentTarget.style.color = 'hsl(var(--foreground))'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; }}>
                {isUploading ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <Paperclip style={{ width: 16, height: 16 }} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Formatting toolbar */}
      {!isReadOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 32px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--muted))', flexShrink: 0 }}>
          {[
            { icon: <Bold style={{ width: 15, height: 15 }} />, label: 'Bold',           action: () => applyFormatting('**', '**') },
            { icon: <Italic style={{ width: 15, height: 15 }} />, label: 'Italic',         action: () => applyFormatting('*', '*') },
            null,
            { icon: <List style={{ width: 15, height: 15 }} />, label: 'Bullet List',    action: () => applyFormatting('- ') },
            { icon: <ListOrdered style={{ width: 15, height: 15 }} />, label: 'Numbered List', action: () => applyFormatting('1. ') },
          ].map((btn, i) => btn === null ? (
            <div key={i} style={{ width: 1, height: 14, background: 'hsl(var(--border))', margin: '0 4px' }} />
          ) : (
            <button key={btn.label} onClick={btn.action} title={btn.label}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 5, borderRadius: 5, border: 'none', background: 'none', cursor: 'pointer', color: '#667085' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#172033'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#667085'; }}>
              {btn.icon}
            </button>
          ))}
        </div>
      )}

      {/* Editor + attachments */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <textarea ref={editorRef} value={localContent} onChange={handleChange} onKeyDown={handleKeyDown}
          autoFocus={isPending} readOnly={isReadOnly} disabled={isReadOnly}
          placeholder={isReadOnly ? 'This note is read-only.' : 'Start writing…'}
          spellCheck
          style={{ flex: 1, resize: 'none', background: 'transparent', fontSize: 14, color: 'hsl(var(--foreground))', padding: '20px 32px 32px', border: 'none', outline: 'none', lineHeight: 1.7, fontFamily: 'inherit', cursor: isReadOnly ? 'not-allowed' : 'text', opacity: isReadOnly ? 0.75 : 1 }} />

        {selectedNote?.attachments && selectedNote.attachments.length > 0 && (
          <div style={{ width: 260, flexShrink: 0, borderLeft: '1px solid hsl(var(--border))', background: 'hsl(var(--muted))', padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h4 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>
              Attachments ({selectedNote.attachments.length})
            </h4>
            {selectedNote.attachments.map(attachment => (
              <div key={attachment.id} style={{ position: 'relative' }} className="group">
                <button type="button" onClick={() => setPreviewAttachment(attachment)}
                  style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', cursor: 'pointer', textAlign: 'left', paddingRight: 36 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#1663f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e6ebf2'; }}>
                  <FileText style={{ width: 16, height: 16, color: '#1663f6', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.filename}</p>
                    <p style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{new Date(attachment.created_at).toLocaleDateString()}</p>
                  </div>
                </button>
                {!isReadOnly && (
                  <button onClick={e => { e.stopPropagation(); setAttachmentToDelete({ id: attachment.id, name: attachment.filename }); }}
                    title="Delete" className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ position: 'absolute', top: 8, right: 8, padding: 4, color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, display: 'flex' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#ef444418'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; }}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {previewAttachment && <DocumentPreview url={previewAttachment.file} fileName={previewAttachment.filename} onClose={() => setPreviewAttachment(null)} />}
      <DeleteModal isOpen={!!attachmentToDelete} type="confirm" itemType="document" itemName={attachmentToDelete?.name}
        onConfirm={confirmDeleteAttachment} onCancel={() => setAttachmentToDelete(null)} isDeleting={isDeleting} />
    </div>
  );
}