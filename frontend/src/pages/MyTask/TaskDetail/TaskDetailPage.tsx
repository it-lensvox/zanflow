import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Save, Edit3, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { taskApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useTaskDetail } from './hooks/useTaskDetail';
import { TaskDetailContent, TaskDetailConfirms, T } from './Components/TaskDetailContent';
import { TaskDetailModal } from './Components/TaskDetailModal';
import type { Task } from '@/types';

export function TaskDetailPage() {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: taskData, isLoading: taskLoading } = useQuery({
        queryKey: ['task', id],
        queryFn: () => taskApi.get(Number(id)),
        enabled: !!id,
        placeholderData: () => {
            const cache = queryClient.getQueryData(['tasks']) as any;
            return (cache?.tasks || []).find((t: any) => t.id === Number(id));
        },
    });
    const task: Task | undefined = taskData?.task || taskData;

   const handleDelete = async (taskId: number) => {
        await taskApi.delete(taskId);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        navigate('/taskboard');
    };
    if (taskLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, background: T.bg }}>
                <Loader2 size={28} className="animate-spin" style={{ color: T.blue }} />
            </div>
        );
    }
    if (!task) {
        return (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: T.bg, minHeight: '100vh' }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 8 }}>Task not found</p>
                <Link to="/taskboard" style={{ fontSize: 13, color: T.blue }}>← Back to tasks</Link>
            </div>
        );
    }

    return <TaskDetailPageInner task={task} onDelete={handleDelete} />;
}

function TaskDetailPageInner({ task, onDelete }: { task: Task; onDelete: (id: number) => Promise<void> }) {
    const { user } = useAuth();
    const [childTask, setChildTask] = useState<Task | null>(null);
    const detail = useTaskDetail({ task, onDelete, onClose: undefined, onTaskUpdated: undefined });
    const { isSaving, hasUnsavedChanges, isEditingTitle, setIsEditingTitle, editableTitle, setEditableTitle, handleSave, setShowDeleteConfirm, setShowNotAdminPopup } = detail;

    return (
        <div style={{ background: T.bg, minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}>
            {/* Page header */}
            <div style={{ background: 'hsl(var(--card))', borderBottom: `1px solid ${T.line}` }}>
                <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 py-3.5 flex items-center justify-between gap-4">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <Link to="/taskboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.line}`, color: T.muted, flexShrink: 0, textDecoration: 'none' }}>
                            <ArrowLeft size={16} />
                        </Link>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {isEditingTitle ? (
                                    <input autoFocus value={editableTitle} onChange={e => setEditableTitle(e.target.value)}
                                        onBlur={() => setIsEditingTitle(false)} onKeyDown={e => e.key === 'Enter' && setIsEditingTitle(false)}
                                        style={{ ...T.input, height: 30, fontSize: 16, fontWeight: 700, padding: '0 6px', flex: 1 }} />
                                ) : (
                                    <h1 className="truncate" style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>{editableTitle || 'Untitled task'}</h1>
                                )}
                                <button onClick={() => setIsEditingTitle(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, flexShrink: 0, padding: 2 }} title="Edit title">
                                    <Edit3 size={13} />
                                </button>
                            </div>
                            <p style={{ fontSize: 12, color: T.muted, margin: '2px 0 0' }}>{task.project_details?.name || task.project_name || 'No project'}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: isSaving || !hasUnsavedChanges ? 'hsl(var(--muted))' : '#1663f6', color: isSaving || !hasUnsavedChanges ? T.muted : '#fff', fontSize: 13, fontWeight: 600, cursor: isSaving || !hasUnsavedChanges ? 'not-allowed' : 'pointer', transition: 'background .15s' }}>
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {isSaving ? 'Saving…' : 'Save changes'}
                        </button>
                        {(user?.role === 'admin' || task.assigned_by === user?.id) && (
                            <button onClick={() => setShowDeleteConfirm(true)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, border: `1px solid ${T.line}`, background: 'hsl(var(--muted))', color: T.muted, cursor: 'pointer' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--muted))'; e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.line; }}>
                                <Trash2 size={15} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 py-8">
                <TaskDetailContent detail={detail} task={task} onChildTaskClick={(ct) => setChildTask(ct)} />
            </div>

            <TaskDetailConfirms detail={detail} task={task} />

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
}