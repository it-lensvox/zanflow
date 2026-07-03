import React from 'react';
import {
    X, Loader2, ChevronDown, Send, Clock, CheckCircle, Plus, Link, Sparkles, ChevronRight, Calendar, Edit3, Trash2,
} from 'lucide-react';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';
import { TASK_STATUS_OPTIONS } from '@/config/statusColors';
import { Task, TaskAttachment } from '@/types';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { DocumentThumbnail, DocumentPreview } from '@/components/common/DocumentPreview';
import { AISuggestionPanel } from './AISuggestionPanel';
import { useTaskDetail } from '../hooks/useTaskDetail';

// ── Design tokens ────
export const T = {
    text:   '#172033',
    muted:  '#667085',
    line:   '#e6ebf2',
    bg:     '#F7F8FB',
    blue:   '#1663f6',
    card:   { background: '#fff', border: '1px solid #e6ebf2', borderRadius: 12, boxShadow: '0 1px 3px rgba(16,24,40,.05)' } as React.CSSProperties,
    label:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#172033', marginBottom: 6, letterSpacing: '0.01em' } as React.CSSProperties,
    input:  { width: '100%', height: 38, padding: '0 12px', fontSize: 13, color: '#172033', background: '#fff', border: '1px solid #e6ebf2', borderRadius: 8, outline: 'none', transition: 'border-color .15s, box-shadow .15s', fontFamily: 'inherit' } as React.CSSProperties,
} as const;

export const focusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = T.blue;
    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(22,99,246,.08)';
};
export const blurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = T.line;
    e.currentTarget.style.boxShadow   = 'none';
};

export const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={T.label}>{children}</p>
);

export const DescriptionContent = ({ html }: { html: string }) => (
    <div
        className={[
            'leading-relaxed break-words max-w-full overflow-x-auto',
            '[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2',
            '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1',
            '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1',
            '[&_p]:mb-2 [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mb-2',
            '[&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:mb-2 [&_li]:mb-0.5',
            '[&_strong]:font-semibold [&_a]:text-blue-600 [&_a]:underline',
            '[&_pre]:bg-gray-50 [&_pre]:border [&_pre]:border-gray-200 [&_pre]:rounded [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:text-xs [&_pre]:mb-2',
            '[&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs',
            '[&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-500 [&_blockquote]:mb-2',
            '[&_table]:w-full [&_table]:border-collapse [&_table]:mb-2',
            '[&_td]:border [&_td]:border-gray-200 [&_td]:p-1.5 [&_th]:border [&_th]:border-gray-200 [&_th]:p-1.5 [&_th]:bg-gray-50 [&_th]:font-semibold',
        ].join(' ')}
        style={{ fontSize: 13, color: T.muted }}
        dangerouslySetInnerHTML={{ __html: html }}
    />
);

// ── Props ───
export interface TaskDetailContentProps {
    detail: ReturnType<typeof useTaskDetail>;
    task: Task;
}

// ── Shared body sections ─────
export function TaskDetailContent({ detail, task }: TaskDetailContentProps) {
    const {
        user, canEditDates, resolvedTaskId,
        selectedStatus, setSelectedStatus,
        showStatusDropdown, setShowStatusDropdown,
        hasUnsavedChanges, setHasUnsavedChanges,
        isEditingDescription, setIsEditingDescription,
        editableDescription, setEditableDescription,
        assignedMembersOpen, setAssignedMembersOpen,
        showAddUsersDropdown, setShowAddUsersDropdown,
        newUsers, setNewUsers,
        availableUsers, projectMembers,
        links, linkInput, setLinkInput,
        selectedLabelIds, setSelectedLabelIds, availableLabels,
        startDate, setStartDate, endDate, setEndDate,
        uploadingDocs,
        deleteAttachmentConfirm, setDeleteAttachmentConfirm,
        newComment, setNewComment,
        childTasksOpen, setChildTasksOpen,
        statusDropdownRef, addUserDropdownRef, attachmentContainerRef,
        comments, displayAttachments, childTasks, childTasksLoading,
        isFetchingNextPage, aiSuggestions,
        addCommentMutation, deleteMutation,
        handleAddLink, removeLink,
        handleFileSelect, handleAttachmentClick, handleDeleteAttachment,
    } = detail;

    const sc = getStatusConfig(selectedStatus);

    // status options
    const statusOptions = TASK_STATUS_OPTIONS.map(o => ({
        status: o.value as Task['status'],
        icon:   getStatusConfig(o.value).icon,
        label:  o.label,
    }));

    // ── pool calculation for add-assignee ───
    let pool = availableUsers;
    if (projectMembers.length > 0) {
        const pmIds = projectMembers.map(m => m.user.id);
        pool = pool.filter(u => pmIds.includes(u.id));
    }
    pool = pool.filter(u => !task.assigned_to_user_details.some(a => a.id === u.id) && !newUsers.includes(u.id));

    return (
        <div className="space-y-3">

            {/* ① Timeline & Status — 4 columns in one row */}
            <div style={T.card}>
                <div style={{ padding: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }} className="grid-cols-2 sm:grid-cols-4">
                        <div style={{ opacity: canEditDates ? 1 : 0.55 }}>
                            <FieldLabel><Calendar size={13} /> Start date</FieldLabel>
                            <input type="date" value={startDate} disabled={!canEditDates}
                                onChange={e => { const v = e.target.value; setStartDate(v); if (endDate && v > endDate) setEndDate(''); }}
                                style={{ ...T.input, cursor: canEditDates ? 'pointer' : 'not-allowed' }}
                                onFocus={canEditDates ? focusInput : undefined} onBlur={canEditDates ? blurInput : undefined} />
                        </div>
                        <div style={{ opacity: canEditDates ? 1 : 0.55 }}>
                            <FieldLabel><Calendar size={13} /> Due date</FieldLabel>
                            <input type="date" value={endDate} disabled={!canEditDates} min={startDate}
                                onChange={e => setEndDate(e.target.value)}
                                style={{ ...T.input, cursor: canEditDates ? 'pointer' : 'not-allowed' }}
                                onFocus={canEditDates ? focusInput : undefined} onBlur={canEditDates ? blurInput : undefined} />
                        </div>
                        <div>
                            <FieldLabel><Clock size={13} /> Duration</FieldLabel>
                            <div style={{ ...T.input, display: 'flex', alignItems: 'center', color: T.muted, cursor: 'default', background: '#fafafa' }}>
                                {(task as any).duration_time || 'N/A'}
                            </div>
                        </div>
                        <div ref={statusDropdownRef} style={{ position: 'relative' }}>
                            <FieldLabel>Status</FieldLabel>
                            <button onClick={() => setShowStatusDropdown(v => !v)}
                                style={{ ...T.input, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', justifyContent: 'space-between', fontWeight: 500 }}>
                               <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {React.createElement(sc.icon, { size: 13, className: sc.text })}
                                    <span className={`${sc.text} font-bold`} style={{ fontSize: 13, letterSpacing: '0.03em' }}>{sc.label.toUpperCase()}</span>
                                </span>
                                <ChevronDown size={13} style={{ color: T.muted, flexShrink: 0 }} />
                            </button>
                            {showStatusDropdown && (
                                <div style={{ position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(16,24,40,.1)', overflow: 'hidden', minWidth: 150 }}>
                                    {statusOptions.map(opt => {
                                        const c = getStatusConfig(opt.status);
                                        return (
                                           <button key={opt.status}
                                                onClick={() => { setSelectedStatus(opt.status); setHasUnsavedChanges(true); setShowStatusDropdown(false); }}
                                                style={{ width: '100%', padding: '9px 14px', fontSize: 13, color: T.text, background: selectedStatus === opt.status ? '#f7f8fb' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = '#f7f8fb')}
                                                onMouseLeave={e => (e.currentTarget.style.background = selectedStatus === opt.status ? '#f7f8fb' : 'transparent')}
                                            >
                                                {React.createElement(opt.icon, { size: 13, className: c.text })}
                                                <span className={`${c.text} font-bold`} style={{ fontSize: 13, letterSpacing: '0.03em' }}>{c.label.toUpperCase()}</span>
                                                {selectedStatus === opt.status && (
                                                    <svg style={{ marginLeft: 'auto' }} width="14" height="14" viewBox="0 0 20 20" fill={T.blue}>
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ② Description */}
            <div style={T.card}>
                <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <FieldLabel>Description</FieldLabel>
                        {!isEditingDescription && (
                            <button onClick={() => setIsEditingDescription(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: T.blue, background: 'none', border: 'none', cursor: 'pointer' }}>
                                <Edit3 size={12} /> Edit
                            </button>
                        )}
                    </div>
                    {isEditingDescription ? (
                        <RichTextEditor value={editableDescription} onChange={html => { setEditableDescription(html); setHasUnsavedChanges(true); }}
                            placeholder="Enter task description…" minHeight="120px" maxHeight="360px"
                            features={{ bold: true, italic: true, underline: true, strikethrough: true, link: true, bulletList: true, orderedList: true, blockquote: true, code: true, codeBlock: true, heading: true, table: true }} />
                    ) : task.description ? (
                        <DescriptionContent html={task.description} />
                    ) : (
                        <p style={{ fontSize: 13, color: T.muted, fontStyle: 'italic', margin: 0 }}>No description yet.</p>
                    )}
                </div>
            </div>

            {/* ③ Assignees | Labels — side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grid-cols-1 sm:grid-cols-2">
                {/* Assignees */}
                <div style={T.card}>
                    <button onClick={() => setAssignedMembersOpen(v => !v)}
                        style={{ width: '100%', padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <FieldLabel>Assignees</FieldLabel>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {task.assigned_by_user_details && (
                                <span style={{ fontSize: 11, color: T.muted }}>by {task.assigned_by_user_details.first_name}</span>
                            )}
                            <ChevronDown size={13} style={{ color: T.muted, transform: assignedMembersOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                        </div>
                    </button>
                    {assignedMembersOpen && (
                        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {task.assigned_to_user_details.map(u => (
                                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 7, background: '#f7f8fb' }}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#ede9fe', border: '1px solid #c4b5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#6d28d9', flexShrink: 0 }}>
                                        {u.first_name[0]}{u.last_name[0]}
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: 0 }}>{u.first_name} {u.last_name}</p>
                                        <p style={{ fontSize: 10, color: T.muted, margin: 0 }}>{u.role || 'Member'}</p>
                                    </div>
                                </div>
                            ))}
                            {newUsers.map(userId => {
                                const u = availableUsers.find(au => au.id === userId);
                                return u ? (
                                    <div key={userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>{u.first_name[0]}</div>
                                            <p style={{ fontSize: 12, fontWeight: 600, color: '#166534', margin: 0 }}>{u.first_name} <span style={{ fontWeight: 400, color: '#16a34a' }}>(pending)</span></p>
                                        </div>
                                        <button onClick={() => setNewUsers(prev => prev.filter(id => id !== userId))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 3 }}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : null;
                            })}
                            {pool.length > 0 && (
                                <div ref={addUserDropdownRef} style={{ position: 'relative' }}>
                                    <button onClick={e => { e.stopPropagation(); setShowAddUsersDropdown(v => !v); }}
                                        style={{ width: '100%', height: 34, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5, border: `1px dashed ${T.line}`, borderRadius: 7, background: '#fff', fontSize: 12, color: T.muted, cursor: 'pointer' }}>
                                        <Plus size={12} /> Add assignee
                                    </button>
                                    {showAddUsersDropdown && (
                                        <div style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(16,24,40,.1)', maxHeight: 180, overflowY: 'auto' }}>
                                            {pool.map(u => (
                                                <button key={u.id} onClick={() => { setNewUsers(prev => [...prev, u.id]); setHasUnsavedChanges(true); setShowAddUsersDropdown(false); }}
                                                    style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.text, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = '#f7f8fb')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                >
                                                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: T.muted, flexShrink: 0 }}>
                                                        {u.first_name[0]}{u.last_name?.[0] || ''}
                                                    </div>
                                                    {u.first_name} {u.last_name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Labels */}
                <div style={T.card}>
                    <div style={{ padding: '14px 16px' }}>
                        <FieldLabel>Labels</FieldLabel>
                        {availableLabels.length === 0 ? (
                            <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>No labels for this project.</p>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {availableLabels.map(label => {
                                    const sel = selectedLabelIds.includes(label.id);
                                    return (
                                        <button key={label.id}
                                            onClick={() => { setSelectedLabelIds(prev => sel ? prev.filter(id => id !== label.id) : [...prev, label.id]); setHasUnsavedChanges(true); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, border: `2px solid ${label.color}`, background: sel ? label.color : `${label.color}20`, color: sel ? '#fff' : label.color, cursor: 'pointer', transition: 'all .15s' }}>
                                            {sel && <CheckCircle size={10} />}
                                            {label.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {selectedLabelIds.length > 0 && (
                            <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
                                {selectedLabelIds.length} label{selectedLabelIds.length > 1 ? 's' : ''} selected — save to apply
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ④ Child tasks + AI */}
            <div style={T.card}>
                <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button onClick={() => setChildTasksOpen(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <span style={T.label as React.CSSProperties}>Child tasks</span>
                        {childTasks.length > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: T.muted, borderRadius: 99, padding: '1px 7px', border: `1px solid ${T.line}` }}>
                                {childTasks.length}
                            </span>
                        )}
                        <ChevronDown size={13} style={{ color: T.muted, transform: childTasksOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                    </button>
                    <button
                        onClick={() => { if (aiSuggestions.isOpen) aiSuggestions.close(); else { setChildTasksOpen(true); aiSuggestions.open(); } }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${aiSuggestions.isOpen ? T.blue : '#e9d5ff'}`, background: aiSuggestions.isOpen ? T.blue : '#faf5ff', color: aiSuggestions.isOpen ? '#fff' : '#7c3aed', cursor: 'pointer', transition: 'all .15s' }}>
                        <Sparkles size={12} />
                        <span className="hidden sm:inline">Suggest with AI</span>
                        <span className="sm:hidden">AI</span>
                    </button>
                </div>

                <div style={{ padding: '0 20px' }}>
                    <AISuggestionPanel
                        isOpen={aiSuggestions.isOpen} isLoading={aiSuggestions.isLoading} isCreating={aiSuggestions.isCreating}
                        error={aiSuggestions.error} createError={aiSuggestions.createError} createdCount={aiSuggestions.createdCount}
                        suggestions={aiSuggestions.suggestions} selectedCount={aiSuggestions.selectedCount} allSelected={aiSuggestions.allSelected}
                        availableUsers={availableUsers}
                        onClose={aiSuggestions.close} onRegenerate={aiSuggestions.regenerate} onGenerateMore={aiSuggestions.generateMore}
                        onToggleSelect={aiSuggestions.toggleSelect} onToggleSelectAll={aiSuggestions.toggleSelectAll}
                        onDelete={aiSuggestions.deleteSuggestion} onStartEdit={aiSuggestions.startEdit} onCommitEdit={aiSuggestions.commitEdit}
                        onPriorityChange={aiSuggestions.updatePriority} onStatusChange={aiSuggestions.updateStatus}
                        onAddAssignee={aiSuggestions.addAssignee} onRemoveAssignee={aiSuggestions.removeAssignee}
                        onCreateSelected={aiSuggestions.createSelectedTasks}
                    />
                </div>

                {childTasksOpen && (
                    <div style={{ padding: '8px 20px 16px' }}>
                        {childTasksLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 13, color: T.muted }}>
                                <Loader2 size={14} className="animate-spin" /> Loading child tasks…
                            </div>
                        ) : childTasks.length === 0 ? (
                            <p style={{ fontSize: 13, color: T.muted, fontStyle: 'italic', margin: 0 }}>No child tasks yet. Use "Suggest with AI" to auto-generate some.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {childTasks.map((ct: any) => {
                                    const csc = getStatusConfig(ct.status || 'pending');
                                    return (
                                        <div key={ct.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.line}`, background: '#fafafa', cursor: 'pointer' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#f7f8fb')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '#fafafa')}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: csc.color, flexShrink: 0 }} />
                                            <span style={{ fontSize: 13, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ct.heading || ct.title}</span>
                                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5 }} className={csc.badge}>{csc.label}</span>
                                            <ChevronRight size={13} style={{ color: T.line, flexShrink: 0 }} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ⑤ Links | Attachments — side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grid-cols-1 sm:grid-cols-2">
                {/* Links */}
                <div style={T.card}>
                    <div style={{ padding: 16 }}>
                        <FieldLabel>Links</FieldLabel>
                        {links.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                                {links.map((link, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '6px 8px', borderRadius: 7, background: '#f7f8fb', border: `1px solid ${T.line}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                            <div style={{ padding: 4, background: '#eff6ff', borderRadius: 5, color: T.blue, flexShrink: 0 }}>
                                                <Link size={11} />
                                            </div>
                                            <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noopener noreferrer"
                                                style={{ fontSize: 12, color: T.blue, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                                                {link}
                                            </a>
                                        </div>
                                        <button onClick={() => removeLink(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 3, flexShrink: 0 }}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input type="text" value={linkInput} onChange={e => setLinkInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddLink()}
                                placeholder="Paste URL to add…" style={{ ...T.input, height: 34 }}
                                onFocus={focusInput} onBlur={blurInput} />
                            <button onClick={handleAddLink} disabled={!linkInput.trim()}
                                style={{ width: 34, height: 34, borderRadius: 7, border: `1px solid ${T.line}`, background: '#fff', color: T.blue, cursor: linkInput.trim() ? 'pointer' : 'not-allowed', opacity: linkInput.trim() ? 1 : 0.4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plus size={15} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Attachments */}
                <div style={T.card}>
                    <div style={{ padding: 16 }}>
                        <FieldLabel>Attachments</FieldLabel>
                        <div style={{ position: 'relative', border: `2px dashed ${T.line}`, borderRadius: 8, padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: uploadingDocs ? '#eff6ff' : '#fafafa', transition: 'background .15s' }}
                            onMouseEnter={e => { if (!uploadingDocs) e.currentTarget.style.background = '#f7f8fb'; }}
                            onMouseLeave={e => { if (!uploadingDocs) e.currentTarget.style.background = '#fafafa'; }}>
                            <input type="file" multiple onChange={handleFileSelect} disabled={uploadingDocs}
                                style={{ position: 'absolute', inset: 0, opacity: 0, zIndex: 10, cursor: uploadingDocs ? 'not-allowed' : 'pointer' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <div style={{ padding: 6, borderRadius: '50%', background: '#fff', border: `1px solid ${T.line}` }}>
                                    {uploadingDocs ? <Loader2 size={13} className="animate-spin" style={{ color: T.blue }} /> : <Plus size={13} style={{ color: T.muted }} />}
                                </div>
                                <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>
                                    {uploadingDocs ? 'Uploading…' : <><span>Drop or </span><span style={{ color: T.blue, fontWeight: 600 }}>Browse</span></>}
                                </p>
                            </div>
                        </div>
                        {displayAttachments.length > 0 && (
                            <div ref={attachmentContainerRef} style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                                    {displayAttachments.map((doc: TaskAttachment) => (
                                        <div key={doc.id} className="group" style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.line}` }}>
                                            <DocumentThumbnail url={doc.file_url} fileName={doc.file_name} fileType={doc.file_url?.split('.').pop() || ''} onClick={() => handleAttachmentClick(doc)} showFileName={false} className="h-full" />
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <button onClick={e => { e.stopPropagation(); setDeleteAttachmentConfirm({ id: doc.id.toString(), name: doc.file_name }); }}
                                                    style={{ padding: 4, background: 'rgba(255,255,255,.9)', borderRadius: 5, border: 'none', cursor: 'pointer', color: T.muted }}>
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                            <div style={{ padding: '5px 7px' }}>
                                                <p style={{ fontSize: 10, fontWeight: 600, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.file_name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {isFetchingNextPage && <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}><Loader2 size={16} className="animate-spin" style={{ color: T.blue }} /></div>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ⑥ Discussion */}
            <div style={T.card}>
                <div style={{ padding: 20 }}>
                    <FieldLabel>Discussion ({comments.length})</FieldLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
                        {comments.length === 0 && <p style={{ fontSize: 13, color: T.muted, fontStyle: 'italic', margin: 0 }}>No comments yet.</p>}
                        {comments.map((comment: any) => (
                            <div key={comment.id} style={{ display: 'flex', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.muted }}>
                                    {comment.user_details?.first_name?.[0] || comment.user_details?.username?.[0] || '?'}
                                </div>
                                <div style={{ background: '#f7f8fb', borderRadius: '0 10px 10px 10px', padding: '8px 12px', flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{comment.user_details?.first_name || comment.user_details?.username}</span>
                                        <span style={{ fontSize: 11, color: T.muted }}>{new Date(comment.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p style={{ fontSize: 13, color: T.muted, margin: 0, wordBreak: 'break-word' }}>{comment.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && newComment.trim()) addCommentMutation.mutate(newComment.trim()); }}
                            placeholder="Add a comment…" style={{ ...T.input, borderRadius: 99 }}
                            onFocus={focusInput} onBlur={blurInput} />
                        <button onClick={() => { if (newComment.trim()) addCommentMutation.mutate(newComment.trim()); }} disabled={!newComment.trim()}
                            style={{ width: 38, height: 38, borderRadius: '50%', background: newComment.trim() ? T.text : '#e6ebf2', color: '#fff', border: 'none', cursor: newComment.trim() ? 'pointer' : 'not-allowed', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}>
                            <Send size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Shared confirm dialogs ────────────────────────────────────────────────────
export function TaskDetailConfirms({ detail, task }: TaskDetailContentProps) {
    const { showDeleteConfirm, setShowDeleteConfirm, showNotAdminPopup, setShowNotAdminPopup, deleteAttachmentConfirm, setDeleteAttachmentConfirm, previewDocument, setPreviewDocument, deleteMutation, handleDeleteAttachment } = detail;

    return (
        <>
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
                    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.2)', width: '100%', maxWidth: 420, padding: 24 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 8px' }}>Delete task</h3>
                        <p style={{ fontSize: 13, color: T.muted, margin: '0 0 24px' }}>Delete <strong>{task.heading}</strong>? This cannot be undone.</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${T.line}`, background: '#fff', fontSize: 13, fontWeight: 500, color: T.text, cursor: 'pointer' }}>Cancel</button>
                            <button onClick={() => deleteMutation.mutate(task.id)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
            {showNotAdminPopup && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
                    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.2)', width: '100%', maxWidth: 360, padding: 24, textAlign: 'center' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 8px' }}>Permission denied</h3>
                        <p style={{ fontSize: 13, color: T.muted, margin: '0 0 20px' }}>Only the person who created this task can delete it.</p>
                        <button onClick={() => setShowNotAdminPopup(false)} style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: 'none', background: T.text, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Got it</button>
                    </div>
                </div>
            )}
            {deleteAttachmentConfirm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
                    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.2)', width: '100%', maxWidth: 420, padding: 24 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 8px' }}>Delete attachment</h3>
                        <p style={{ fontSize: 13, color: T.muted, margin: '0 0 24px' }}>Delete <strong>{deleteAttachmentConfirm.name}</strong>?</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => setDeleteAttachmentConfirm(null)} style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${T.line}`, background: '#fff', fontSize: 13, fontWeight: 500, color: T.text, cursor: 'pointer' }}>Cancel</button>
                            <button onClick={() => handleDeleteAttachment(deleteAttachmentConfirm.id)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
            {previewDocument && (
                <DocumentPreview url={previewDocument.url} fileName={previewDocument.fileName} fileType={previewDocument.fileType} onClose={() => setPreviewDocument(null)} />
            )}
        </>
    );
}