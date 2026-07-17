import React, { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Trash2, X, Save, Edit3, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTaskDetail } from '../hooks/useTaskDetail';
import { TaskDetailContent, TaskDetailConfirms, T, type TaskDetailContentProps } from './TaskDetailContent';
import type { Task } from '@/types';
import { taskApi } from '@/services/api';

interface TaskDetailModalProps {
    task: Task;
    onClose: () => void;
    onDelete: (id: number) => Promise<void>;
    onTaskUpdated: (updatedTask: Task) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose, onDelete, onTaskUpdated }) => {
    const navigate = useNavigate();
    const [childTask, setChildTask] = useState<Task | null>(null);
    const [childTaskLoading, setChildTaskLoading] = useState(false);

    const handleChildTaskClick = useCallback(async (ct: Task) => {
        setChildTaskLoading(true);
        try {
            const res = await taskApi.get(ct.id);
            setChildTask(res.task || res);
        } catch {
            // fallback to partial data if fetch fails
            setChildTask(ct);
        } finally {
            setChildTaskLoading(false);
        }
    }, []);
    const detail = useTaskDetail({ task, onClose, onDelete, onTaskUpdated });
    const { user, isSaving, hasUnsavedChanges, isEditingTitle, setIsEditingTitle, editableTitle, setEditableTitle, handleSave, showDeleteConfirm, setShowDeleteConfirm, setShowNotAdminPopup } = detail;

    useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = 'unset'; }; }, []);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
    };

    const handleOpenFullPage = () => { onClose(); navigate(`/tasks/${task.id}`); };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 md:p-6"
            onClick={handleBackdropClick}>
            <div className="flex flex-col w-full h-[95vh] sm:h-[90vh] sm:max-w-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
                style={{ background: 'hsl(var(--card))' }} role="dialog" aria-modal="true">

                {/* Header */}
                <div className="flex items-center justify-between gap-3 sticky top-0 z-20"
                    style={{ padding: '14px 20px', borderBottom: `1px solid ${T.line}`, background: 'hsl(var(--card))' }}>
                    <div className="flex-1 min-w-0" style={{ borderLeft: `3px solid ${T.blue}`, paddingLeft: 10 }}>
                        <div className="flex items-center gap-1.5 min-w-0">
                            {isEditingTitle ? (
                                <input autoFocus value={editableTitle}
                                    onChange={e => setEditableTitle(e.target.value)}
                                    onBlur={() => setIsEditingTitle(false)}
                                    onKeyDown={e => e.key === 'Enter' && setIsEditingTitle(false)}
                                    style={{ ...T.input, height: 30, fontSize: 16, fontWeight: 700, padding: '0 8px', flex: 1 }} />
                            ) : (
                                <h2 className="truncate" style={{ fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                                    {editableTitle || 'Untitled task'}
                                </h2>
                            )}
                            <button onClick={() => setIsEditingTitle(true)}
                                className="flex-shrink-0 p-0.5 rounded transition-colors"
                                style={{ color: T.muted, background: 'none', border: 'none', cursor: 'pointer' }} title="Edit title">
                                <Edit3 size={13} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: T.blue, background: 'rgba(22,99,246,0.12)', border: '1px solid rgba(22,99,246,0.25)', borderRadius: 5, padding: '1px 7px', letterSpacing: '0.01em', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>
                                {task.project_details?.name || task.project_name || 'No project'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges}
                           style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: isSaving || !hasUnsavedChanges ? 'hsl(var(--muted))' : '#1663f6', color: isSaving || !hasUnsavedChanges ? T.muted : '#fff', fontSize: 13, fontWeight: 600, cursor: isSaving || !hasUnsavedChanges ? 'not-allowed' : 'pointer', transition: 'background .15s', whiteSpace: 'nowrap' }}>
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            <span className="hidden sm:inline">{isSaving ? 'Saving…' : 'Save changes'}</span>
                        </button>
                        {[
                            { icon: <ExternalLink size={15} />, onClick: handleOpenFullPage, title: 'Open full page' },
                            { icon: <Trash2 size={15} />, onClick: () => user?.id === task.assigned_by ? setShowDeleteConfirm(true) : setShowNotAdminPopup(true), title: 'Delete', danger: true },
                            { icon: <X size={15} />, onClick: onClose, title: 'Close' },
                        ].map((btn, i) => (
                            <button key={i} onClick={btn.onClick} title={btn.title}
                                style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.line}`, background: 'hsl(var(--muted))', color: T.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = (btn as any).danger ? '#fef2f2' : 'hsl(var(--accent))'; e.currentTarget.style.color = (btn as any).danger ? '#dc2626' : T.text; e.currentTarget.style.borderColor = (btn as any).danger ? '#fecaca' : T.line; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--muted))'; e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.line; }}>
                                {btn.icon}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto" style={{ background: T.bg }}>
                    <div style={{ padding: '20px 20px 32px' }}>
                        <TaskDetailContent detail={detail} task={task} onChildTaskClick={handleChildTaskClick} />
                        {childTaskLoading && (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                                <div style={{ background: 'hsl(var(--card))', borderRadius: 12, padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'hsl(var(--foreground))' }}>
                                    <Loader2 size={18} className="animate-spin" style={{ color: '#1663f6' }} /> Loading task…
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <TaskDetailConfirms detail={detail} task={task} />

            {/* ── Child task modal  ── */}
            {childTask && (
                <TaskDetailModal
                    task={childTask}
                    onClose={() => setChildTask(null)}
                    onDelete={async (_id: number) => { setChildTask(null); }}
                    onTaskUpdated={(updated) => setChildTask(updated)}
                />
            )}
        </div>
    );
};