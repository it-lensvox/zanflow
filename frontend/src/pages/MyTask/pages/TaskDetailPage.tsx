import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, Trash2, Save, Edit3, Loader2, ChevronDown, Send,
    Clock, ListTodo, PlayCircle, CheckCircle, CheckSquare, Pause, Plus,
    Link as LinkIcon, Calendar, Sparkles, ChevronRight,
} from 'lucide-react';
import { useMutation, useQueryClient, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { taskApi, usersApi, documentsApi, projectsApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';
import { Task, TaskAttachment, TaskLink, Label } from '@/types';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { DocumentPreview, useDocumentPreviewKeyboard, DocumentThumbnail } from '@/components/common/DocumentPreview';
import { AISuggestionPanel } from '../components/AISuggestionPanel';
import { useAISuggestions } from '../hooks/useAISuggestions';

// ── Design tokens — identical to CreateTask + TaskDetailModal ────────────────
const T = {
    text:  '#172033',
    muted: '#667085',
    line:  '#e6ebf2',
    bg:    '#F7F8FB',
    blue:  '#1663f6',
    card:  { background: '#fff', border: '1px solid #e6ebf2', borderRadius: 12, boxShadow: '0 1px 3px rgba(16,24,40,.05)' } as React.CSSProperties,
    label: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#172033', marginBottom: 6, letterSpacing: '0.01em' } as React.CSSProperties,
    input: { width: '100%', height: 38, padding: '0 12px', fontSize: 13, color: '#172033', background: '#fff', border: '1px solid #e6ebf2', borderRadius: 8, outline: 'none', transition: 'border-color .15s, box-shadow .15s', fontFamily: 'inherit' } as React.CSSProperties,
} as const;

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={T.label}>{children}</p>
);

const focusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = T.blue;
    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(22,99,246,.08)';
};
const blurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = T.line;
    e.currentTarget.style.boxShadow   = 'none';
};

const DescriptionContent = ({ html }: { html: string }) => (
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

const getInitialLinks = (taskLinks: TaskLink[] | undefined): string[] => {
    if (!taskLinks) return [];
    return taskLinks.map(link => typeof link === 'object' && link.url ? link.url : String(link));
};

export function TaskDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: taskData, isLoading: taskLoading } = useQuery({
        queryKey: ['task', id],
        queryFn: () => taskApi.get(Number(id)),
        enabled: !!id,
        placeholderData: () => {
            const cache = queryClient.getQueryData(['tasks']) as any;
            const allTasks = cache?.tasks || [];
            return allTasks.find((t: any) => t.id === Number(id));
        },
    });
    const task: Task | undefined = taskData?.task || taskData;

    const resolvedTaskId = useMemo(() => {
        const num = Number(id);
        const safe = Number.isFinite(num) && num > 0 && num < 1_000_000_000_000;
        if (!safe) { console.error('[TaskDetailPage] invalid id:', id); return 0; }
        return num;
    }, [id, task?.heading]);

    // ── State ────────────────────────────────────────────────────────────────
    const [selectedStatus,        setSelectedStatus]        = useState<Task['status']>('pending');
    const [showStatusDropdown,    setShowStatusDropdown]    = useState(false);
    const [showDeleteConfirm,     setShowDeleteConfirm]     = useState(false);
    const [assignedMembersOpen,   setAssignedMembersOpen]   = useState(true);
    const [showAddUsersDropdown,  setShowAddUsersDropdown]  = useState(false);
    const [uploadingDocs,         setUploadingDocs]         = useState(false);
    const [newUsers,              setNewUsers]              = useState<number[]>([]);
    const [newComment,            setNewComment]            = useState('');
    const [availableUsers,        setAvailableUsers]        = useState<Array<{ id: number; username: string; first_name: string; last_name: string; role?: string }>>([]);
    const [projectMembers,        setProjectMembers]        = useState<{ user: { id: number; username: string; full_name: string } }[]>([]);
    const [hasUnsavedChanges,     setHasUnsavedChanges]     = useState(false);
    const [isEditingDescription,  setIsEditingDescription]  = useState(false);
    const [editableDescription,   setEditableDescription]   = useState('');
    const [isEditingTitle,        setIsEditingTitle]        = useState(false);
    const [editableTitle,         setEditableTitle]         = useState('');
    const [links,                 setLinks]                 = useState<string[]>([]);
    const [linkInput,             setLinkInput]             = useState('');
    const [startDate,             setStartDate]             = useState('');
    const [endDate,               setEndDate]               = useState('');
    const [childTasksOpen,        setChildTasksOpen]        = useState(true);
    const [previewDocument,       setPreviewDocument]       = useState<{ url: string; fileName: string; fileType?: string } | null>(null);
    const [deleteAttachmentConfirm, setDeleteAttachmentConfirm] = useState<{ id: string; name: string } | null>(null);
    const attachmentContainerRef = React.useRef<HTMLDivElement>(null);
    const statusDropdownRef      = useRef<HTMLDivElement>(null);
    const addUserDropdownRef     = useRef<HTMLDivElement>(null);
    const canEditDates = ['admin', 'manager'].includes(user?.role || '');

    // ── Queries ──────────────────────────────────────────────────────────────
    const { data: childTasksData, isLoading: childTasksLoading } = useQuery<any>({
        queryKey: ['child-tasks', resolvedTaskId],
        queryFn: () => taskApi.getChildTasks(resolvedTaskId),
        enabled: resolvedTaskId > 0,
    });
    const childTasks: any[] = useMemo(() => childTasksData?.children || childTasksData?.results || [], [childTasksData]);

    const { data: taskDocumentsData, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['task-documents', id],
        queryFn: async ({ pageParam = 1 }) => {
            try {
                const projectId = task?.project || (task as any)?.project_details?.id;
                if (!projectId) return { results: [], count: 0, next: null, previous: null };
                const response = await documentsApi.list({ project: projectId, page: pageParam });
                const allDocs = response.results || response.documents || [];
                const taskDocs = allDocs.filter((doc: any) => doc.metadata?.task_id === Number(id) || doc.task_id === Number(id));
                return { results: taskDocs, count: taskDocs.length, next: response.next, previous: response.previous };
            } catch { return { results: [], count: 0, next: null, previous: null }; }
        },
        getNextPageParam: (lastPage) => {
            if (!lastPage?.next) return undefined;
            try { const p = new URL(lastPage.next).searchParams.get('page'); return p ? parseInt(p) : undefined; }
            catch { return undefined; }
        },
        enabled: !!task?.id,
        initialPageParam: 1,
    });
    const taskDocuments = useMemo(() => taskDocumentsData?.pages?.flatMap(p => p?.results ?? []) ?? [], [taskDocumentsData]);

    const { data: commentsData } = useQuery({
        queryKey: ['task-comments', id],
        queryFn: () => taskApi.getComments(Number(id)),
        enabled: !!id,
        staleTime: Infinity,
    });
    const comments = useMemo(() => {
        if (!commentsData) return [];
        if (Array.isArray(commentsData)) return commentsData;
        return commentsData.results && Array.isArray(commentsData.results) ? commentsData.results : [];
    }, [commentsData]);

    const resolvedApiAttachments = useMemo(() => task?.attachments || [], [task?.attachments]);
    const displayAttachments = useMemo(() => {
        const docAttachments = taskDocuments.map((doc: any) => ({ id: doc.id, file_name: doc.name || doc.original_file_name || doc.file_name, file_url: doc.source_file_url || doc.file_url, uploaded_at: doc.created_at }));
        const uniqueMap = new Map();
        [...resolvedApiAttachments, ...docAttachments].forEach(item => { if (item.id && !uniqueMap.has(item.id)) uniqueMap.set(item.id, item); });
        return Array.from(uniqueMap.values());
    }, [resolvedApiAttachments, taskDocuments]);

    // ── AI suggestions ───────────────────────────────────────────────────────
    const aiSuggestions = useAISuggestions({
        taskId:             resolvedTaskId,
        taskTitle:          editableTitle,
        taskDescription:    editableDescription,
        projectName:        task?.project_details?.name || task?.project_name || '',
        taskType:           (task as any)?.task_type || '',
        existingChildTasks: childTasks.map((c: any) => c.heading || c.title || ''),
        parentAssigneeIds:  (task?.assigned_to || []).map(Number),
    });

    // ── Effects ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (task) {
            setSelectedStatus(task.status);
            setEditableDescription(task.description || '');
            setEditableTitle(task.heading || '');
            setStartDate(task.start_date?.split('T')[0] || '');
            setEndDate(task.end_date?.split('T')[0] || '');
            setLinks(getInitialLinks(task.links));
        }
    }, [task]);

    // Click-outside: close status dropdown
    useEffect(() => {
        if (!showStatusDropdown) return;
        const handler = (e: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
                setShowStatusDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showStatusDropdown]);

    // Click-outside: close add-user dropdown
    useEffect(() => {
        if (!showAddUsersDropdown) return;
        const handler = (e: MouseEvent) => {
            if (addUserDropdownRef.current && !addUserDropdownRef.current.contains(e.target as Node)) {
                setShowAddUsersDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showAddUsersDropdown]);

    useEffect(() => {
        if (!task) return;
        const originalLinks = getInitialLinks(task.links);
        setHasUnsavedChanges(
            selectedStatus !== task.status ||
            newUsers.length > 0 ||
            editableDescription !== task.description ||
            startDate !== (task.start_date?.split('T')[0] || '') ||
            endDate   !== (task.end_date?.split('T')[0]   || '') ||
            JSON.stringify(links) !== JSON.stringify(originalLinks) ||
            editableTitle !== (task.heading || '')
        );
    }, [selectedStatus, task, newUsers.length, editableDescription, startDate, endDate, links, editableTitle]);

    useEffect(() => {
        if (!task) return;
        (async () => {
            try {
                const userRes = await usersApi.list();
                setAvailableUsers(userRes.results || userRes);
                const projectId = task.project || (task as any)?.project_details?.id;
                if (projectId) {
                    const proj = await projectsApi.get(projectId);
                    setProjectMembers(proj.members || []);
                }
            } catch { /* ignore */ }
        })();
    }, [task?.project, (task as any)?.project_details?.id]);

    const handleAttachmentScroll = React.useCallback(() => {
        if (!attachmentContainerRef.current || isFetchingNextPage || !hasNextPage) return;
        const c = attachmentContainerRef.current;
        if (c.scrollTop + c.clientHeight >= c.scrollHeight * 0.8) fetchNextPage();
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);
    React.useEffect(() => {
        const c = attachmentContainerRef.current;
        if (!c) return;
        c.addEventListener('scroll', handleAttachmentScroll);
        return () => c.removeEventListener('scroll', handleAttachmentScroll);
    }, [handleAttachmentScroll]);
    useDocumentPreviewKeyboard(() => setPreviewDocument(null));

    // ── Mutations ────────────────────────────────────────────────────────────
    const updateTaskMutation = useMutation({
        mutationFn: (updates: any) => {
            if (!resolvedTaskId || resolvedTaskId <= 0) return Promise.reject(new Error(`Invalid id: ${resolvedTaskId}`));
            return taskApi.update(resolvedTaskId, updates);
        },
        onSuccess: (data) => {
            const updatedTask: Task = (data as any)?.task ?? data;
            queryClient.setQueryData(['tasks'], (old: any) => {
                if (!old) return old;
                if (old.pages) {
                    const stripped = old.pages.map((p: any) => ({ ...p, results: p.results.filter((t: Task) => t.id !== updatedTask.id) }));
                    return { ...old, pages: [{ ...stripped[0], results: [updatedTask, ...(stripped[0]?.results ?? [])] }, ...stripped.slice(1)] };
                }
                if (Array.isArray(old)) return [updatedTask, ...old.filter((t: Task) => t.id !== updatedTask.id)];
                if (old.tasks)   return { ...old, tasks:   [updatedTask, ...old.tasks.filter((t: Task)   => t.id !== updatedTask.id)] };
                if (old.results) return { ...old, results: [updatedTask, ...old.results.filter((t: Task) => t.id !== updatedTask.id)] };
                return old;
            });
            queryClient.getQueryCache().findAll({ queryKey: ['tasks-list'], exact: false }).forEach(q =>
                queryClient.setQueryData(q.queryKey, (old: any) => {
                    if (!old) return old;
                    if (Array.isArray(old)) return [updatedTask, ...old.filter((t: Task) => t.id !== updatedTask.id)];
                    if (old.tasks)   return { ...old, tasks:   [updatedTask, ...old.tasks.filter((t: Task)   => t.id !== updatedTask.id)] };
                    if (old.results) return { ...old, results: [updatedTask, ...old.results.filter((t: Task) => t.id !== updatedTask.id)] };
                    return old;
                })
            );
            queryClient.invalidateQueries({ queryKey: ['task', id] });
            queryClient.invalidateQueries({ queryKey: ['task-detail', resolvedTaskId] });
            setHasUnsavedChanges(false);
            setNewUsers([]);
            setIsEditingDescription(false);
            setIsEditingTitle(false);
        },
        onError: (err: any) => {
            const status = err?.response?.status;
            if (status === 404) alert(`Task not found (404). ID: ${resolvedTaskId}`);
            else alert('Failed to save changes. Please try again.');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (taskId: number) => taskApi.delete(taskId),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); navigate('/taskboard'); },
    });

    const addCommentMutation = useMutation({
        mutationFn: (content: string) => taskApi.addComment(Number(id), { content }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['task-comments', id] }); setNewComment(''); },
    });

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleAddLink = () => { if (linkInput.trim()) { setLinks([...links, linkInput.trim()]); setLinkInput(''); } };
    const removeLink    = (i: number) => setLinks(links.filter((_, idx) => idx !== i));

    const handleSaveStatus = async () => {
        if (!task) return;
        if (!resolvedTaskId || resolvedTaskId <= 0) { alert(`Cannot save: invalid task ID.`); return; }
        const originalLinks = getInitialLinks(task.links);
        const updates: any = {};
        if (editableTitle !== (task.heading || ''))   updates.heading     = editableTitle;
        if (selectedStatus !== task.status)            updates.status      = selectedStatus;
        if (newUsers.length > 0)                       updates.assigned_to = [...new Set([...(task.assigned_to || []).map(Number), ...newUsers])];
        if (editableDescription !== task.description)  updates.description = editableDescription;
        const origStart = task.start_date?.split('T')[0] || '';
        const origEnd   = task.end_date?.split('T')[0]   || '';
        if (startDate !== origStart) updates.start_date = startDate ? `${startDate}T09:00:00Z` : null;
        if (endDate   !== origEnd)   updates.end_date   = endDate   ? `${endDate}T18:00:00Z`   : null;
        if (JSON.stringify(links) !== JSON.stringify(originalLinks)) updates.links = links;
        if (Object.keys(updates).length === 0) return;
        updateTaskMutation.mutate(updates);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!task) return;
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadingDocs(true);
        try {
            await taskApi.uploadFiles(task.id, Array.from(files));
            const projectId = task.project || (task as any).project_details?.id;
            await queryClient.invalidateQueries({ queryKey: ['task-documents', id] });
            await queryClient.invalidateQueries({ queryKey: ['tasks'] });
            await queryClient.invalidateQueries({ queryKey: ['task', id] });
            await queryClient.invalidateQueries({ queryKey: ['task-detail', resolvedTaskId] });
            if (projectId) await queryClient.invalidateQueries({ queryKey: ['all-documents', projectId.toString()] });
        } catch { alert('Failed to upload. Please try again.'); }
        finally { setUploadingDocs(false); e.target.value = ''; }
    };

    const handleAttachmentClick = async (attachment: TaskAttachment) => {
        if (!task) return;
        try {
            const projectIdNum = task.project || (task as any).project_details?.id;
            let fileUrl = attachment.file_url;
            if (projectIdNum) {
                try {
                    const r = await documentsApi.getDownloadUrl(projectIdNum, { document_id: attachment.id.toString() });
                    if (r?.url) fileUrl = r.url;
                } catch { /* fallback */ }
            }
            if (!fileUrl) { alert('Unable to open attachment.'); return; }
            const urlPath = fileUrl.split('?')[0].toLowerCase();
            const detectedFileType = urlPath.endsWith('.pdf') ? 'pdf' : (attachment.file_name?.split('.').pop()?.toLowerCase() || '');
            setPreviewDocument({ url: fileUrl, fileName: attachment.file_name, fileType: detectedFileType });
        } catch { alert('Failed to open attachment.'); }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        try {
            await taskApi.deleteAttachment(attachmentId);
            queryClient.setQueryData(['task-documents', id], (old: any) => {
                if (!old?.pages) return old;
                return { ...old, pages: old.pages.map((p: any) => ({ ...p, results: p.results.filter((d: any) => d.id.toString() !== attachmentId), count: p.count - 1 })) };
            });
            queryClient.invalidateQueries({ queryKey: ['task-documents', id] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['task', id] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            setDeleteAttachmentConfirm(null);
        } catch { alert('Failed to delete attachment.'); setDeleteAttachmentConfirm(null); }
    };

    const statusOptions: Array<{ status: Task['status']; icon: React.ElementType; label: string }> = [
        { status: 'pending',     icon: Clock,       label: 'Pending'     },
        { status: 'backlog',     icon: ListTodo,    label: 'Backlog'     },
        { status: 'in_progress', icon: PlayCircle,  label: 'In Progress' },
        { status: 'completed',   icon: CheckCircle, label: 'Completed'   },
        { status: 'deployed',    icon: CheckSquare, label: 'Deployed'    },
        { status: 'deferred',    icon: Pause,       label: 'Deferred'    },
        { status: 'review',      icon: Pause,       label: 'Review'      },
    ];

    const isSaving = updateTaskMutation.isPending;
    const sc       = task ? getStatusConfig(selectedStatus) : null;

    // ── Loading / not-found ──────────────────────────────────────────────────
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

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{ background: T.bg, minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}>
            {/* ── Page header ──────────────────────────────────────────────── */}
            <div style={{ background: '#fff', borderBottom: `1px solid ${T.line}` }}>
                <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 py-3.5 flex items-center justify-between gap-4">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <Link to="/taskboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.line}`, color: T.muted, flexShrink: 0, textDecoration: 'none' }}>
                            <ArrowLeft size={16} />
                        </Link>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {isEditingTitle ? (
                                    <input autoFocus value={editableTitle} onChange={e => setEditableTitle(e.target.value)} onBlur={() => setIsEditingTitle(false)} onKeyDown={e => e.key === 'Enter' && setIsEditingTitle(false)}
                                        style={{ ...T.input, height: 30, fontSize: 16, fontWeight: 700, padding: '0 6px', flex: 1 }} onFocus={focusInput} />
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
                        <button onClick={handleSaveStatus} disabled={isSaving || !hasUnsavedChanges}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: isSaving || !hasUnsavedChanges ? '#e6ebf2' : '#172033', color: isSaving || !hasUnsavedChanges ? T.muted : '#fff', fontSize: 13, fontWeight: 600, cursor: isSaving || !hasUnsavedChanges ? 'not-allowed' : 'pointer', transition: 'background .15s' }}
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {isSaving ? 'Saving…' : 'Save changes'}
                        </button>
                        {(user?.role === 'admin' || task.assigned_by === user?.id) && (
                            <button onClick={() => setShowDeleteConfirm(true)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, border: `1px solid ${T.line}`, background: '#fff', color: T.muted, cursor: 'pointer' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.line; }}
                            >
                                <Trash2 size={15} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Content — padding matches Projects page ──────────────────── */}
            <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 py-8" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* ① Timeline & Status — all 4 fields in one row */}
                <div style={T.card}>
                    <div style={{ padding: 20 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }} className="grid-cols-2 sm:grid-cols-4">
                            {/* Start date */}
                            <div style={{ opacity: canEditDates ? 1 : 0.55 }}>
                                <FieldLabel><Calendar size={13} /> Start date</FieldLabel>
                                <input type="date" value={startDate} disabled={!canEditDates}
                                    onChange={e => { const v = e.target.value; setStartDate(v); if (endDate && v > endDate) setEndDate(''); }}
                                    style={{ ...T.input, cursor: canEditDates ? 'pointer' : 'not-allowed' }}
                                    onFocus={canEditDates ? focusInput : undefined} onBlur={canEditDates ? blurInput : undefined} />
                            </div>
                            {/* Due date */}
                            <div style={{ opacity: canEditDates ? 1 : 0.55 }}>
                                <FieldLabel><Calendar size={13} /> Due date</FieldLabel>
                                <input type="date" value={endDate} disabled={!canEditDates} min={startDate} onChange={e => setEndDate(e.target.value)}
                                    style={{ ...T.input, cursor: canEditDates ? 'pointer' : 'not-allowed' }}
                                    onFocus={canEditDates ? focusInput : undefined} onBlur={canEditDates ? blurInput : undefined} />
                            </div>
                            {/* Duration */}
                            <div>
                                <FieldLabel><Clock size={13} /> Duration</FieldLabel>
                                <div style={{ ...T.input, display: 'flex', alignItems: 'center', color: T.muted, cursor: 'default', background: '#fafafa' }}>
                                    {(task as any).duration_time || 'N/A'}
                                </div>
                            </div>
                            {/* Status */}
                            <div ref={statusDropdownRef} style={{ position: 'relative' }}>
                                <FieldLabel>Status</FieldLabel>
                                <button onClick={() => setShowStatusDropdown(v => !v)}
                                    style={{ ...T.input, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', justifyContent: 'space-between', fontWeight: 500 }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {sc && React.createElement(sc.icon, { size: 13, className: sc.text })}
                                        {sc && <span className={sc.text} style={{ fontSize: 13 }}>{sc.label}</span>}
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
                                                    {opt.label}
                                                    {selectedStatus === opt.status && (
                                                        <svg style={{ marginLeft: 'auto' }} width="14" height="14" viewBox="0 0 20 20" fill={T.blue}><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
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
                                <button onClick={() => setIsEditingDescription(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: T.blue, background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <Edit3 size={12} /> Edit
                                </button>
                            )}
                        </div>
                        {isEditingDescription ? (
                            <RichTextEditor value={editableDescription} onChange={html => { setEditableDescription(html); setHasUnsavedChanges(true); }} placeholder="Enter task description…" minHeight="120px" maxHeight="360px"
                                features={{ bold: true, italic: true, underline: true, strikethrough: true, link: true, bulletList: true, orderedList: true, blockquote: true, code: true, codeBlock: true, heading: true, table: true }} />
                        ) : task.description ? (
                            <DescriptionContent html={task.description} />
                        ) : (
                            <p style={{ fontSize: 13, color: T.muted, fontStyle: 'italic', margin: 0 }}>No description yet.</p>
                        )}
                    </div>
                </div>

                {/* ③ Assignees */}
                <div style={T.card}>
                    <button onClick={() => setAssignedMembersOpen(v => !v)}
                        style={{ width: '100%', padding: '14px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <FieldLabel>Assignees</FieldLabel>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {task.assigned_by_user_details && (
                                <span style={{ fontSize: 12, color: T.muted }}>by {task.assigned_by_user_details.first_name} {task.assigned_by_user_details.last_name}</span>
                            )}
                            <ChevronDown size={14} style={{ color: T.muted, transform: assignedMembersOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                        </div>
                    </button>
                    {assignedMembersOpen && (
                        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {task.assigned_to_user_details?.map(u => (
                                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, background: '#f7f8fb' }}>
                                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#ede9fe', border: '1px solid #c4b5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#6d28d9', flexShrink: 0 }}>
                                        {u.first_name[0]}{u.last_name[0]}
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>{u.first_name} {u.last_name}</p>
                                        <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>{u.role || 'Member'}</p>
                                    </div>
                                </div>
                            ))}
                            {newUsers.map(userId => {
                                const u = availableUsers.find(au => au.id === userId);
                                return u ? (
                                    <div key={userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>{u.first_name[0]}</div>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', margin: 0 }}>{u.first_name} <span style={{ fontWeight: 400, color: '#16a34a' }}>(pending save)</span></p>
                                        </div>
                                        <button onClick={() => setNewUsers(prev => prev.filter(id => id !== userId))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 4 }}><span style={{ fontSize: 16 }}>×</span></button>
                                    </div>
                                ) : null;
                            })}
                            {(() => {
                                let pool = availableUsers;
                                if (projectMembers.length > 0) { const pmIds = projectMembers.map(m => m.user.id); pool = pool.filter(u => pmIds.includes(u.id)); }
                                pool = pool.filter(u => !task.assigned_to_user_details?.some(a => a.id === u.id) && !newUsers.includes(u.id));
                                return pool.length > 0 ? (
                                    <div ref={addUserDropdownRef} style={{ position: 'relative' }}>
                                        <button onClick={e => { e.stopPropagation(); setShowAddUsersDropdown(v => !v); }}
                                            style={{ width: '100%', height: 38, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, border: `1px dashed ${T.line}`, borderRadius: 8, background: '#fff', fontSize: 13, color: T.muted, cursor: 'pointer' }}>
                                            <Plus size={13} /> Add assignee
                                        </button>
                                        {showAddUsersDropdown && (
                                            <div style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(16,24,40,.1)', maxHeight: 200, overflowY: 'auto' }}>
                                                {pool.map(u => (
                                                    <button key={u.id} onClick={() => { setNewUsers(prev => [...prev, u.id]); setHasUnsavedChanges(true); setShowAddUsersDropdown(false); }}
                                                        style={{ width: '100%', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.text, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = '#f7f8fb')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                    >
                                                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: T.muted, flexShrink: 0 }}>{u.first_name[0]}{u.last_name?.[0] || ''}</div>
                                                        {u.first_name} {u.last_name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    )}
                </div>

                {/* ④ Child tasks + AI */}
                <div style={T.card}>
                    <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button onClick={() => setChildTasksOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            <span style={T.label as React.CSSProperties}>Child tasks</span>
                            {childTasks.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: T.muted, borderRadius: 99, padding: '1px 7px', border: `1px solid ${T.line}` }}>{childTasks.length}</span>}
                            <ChevronDown size={13} style={{ color: T.muted, transform: childTasksOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                        </button>
                        <button
                            onClick={() => { if (aiSuggestions.isOpen) aiSuggestions.close(); else { setChildTasksOpen(true); aiSuggestions.open(); } }}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${aiSuggestions.isOpen ? T.blue : '#e9d5ff'}`, background: aiSuggestions.isOpen ? T.blue : '#faf5ff', color: aiSuggestions.isOpen ? '#fff' : '#7c3aed', cursor: 'pointer', transition: 'all .15s' }}
                        >
                            <Sparkles size={12} /> Suggest with AI
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 13, color: T.muted }}><Loader2 size={14} className="animate-spin" /> Loading…</div>
                            ) : childTasks.length === 0 ? (
                                <p style={{ fontSize: 13, color: T.muted, fontStyle: 'italic', margin: 0 }}>No child tasks yet. Use "Suggest with AI" to generate some.</p>
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

                {/* ⑤ Links */}
                <div style={T.card}>
                    <div style={{ padding: 20 }}>
                        <FieldLabel>Links</FieldLabel>
                        {links.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                                {links.map((link, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', borderRadius: 8, background: '#f7f8fb', border: `1px solid ${T.line}` }} className="group">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
                                            <div style={{ padding: 5, background: '#eff6ff', borderRadius: 6, color: T.blue, flexShrink: 0 }}><LinkIcon size={12} /></div>
                                            <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noopener noreferrer"
                                                style={{ fontSize: 13, color: T.blue, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                                                {link}
                                            </a>
                                        </div>
                                        <button onClick={() => removeLink(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 4, flexShrink: 0 }}><Trash2 size={13} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input type="text" value={linkInput} onChange={e => setLinkInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddLink()} placeholder="Paste URL to add…"
                                style={T.input} onFocus={focusInput} onBlur={blurInput} />
                            <button onClick={handleAddLink} disabled={!linkInput.trim()}
                                style={{ width: 38, height: 38, borderRadius: 8, border: `1px solid ${T.line}`, background: '#fff', color: T.blue, cursor: linkInput.trim() ? 'pointer' : 'not-allowed', opacity: linkInput.trim() ? 1 : 0.4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ⑥ Attachments */}
                <div style={T.card}>
                    <div style={{ padding: 20 }}>
                        <FieldLabel>Attachments</FieldLabel>
                        <div style={{ position: 'relative', border: `2px dashed ${T.line}`, borderRadius: 10, padding: '24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: uploadingDocs ? '#eff6ff' : '#fafafa', transition: 'background .15s' }}
                            onMouseEnter={e => { if (!uploadingDocs) e.currentTarget.style.background = '#f7f8fb'; }}
                            onMouseLeave={e => { if (!uploadingDocs) e.currentTarget.style.background = '#fafafa'; }}>
                            <input type="file" multiple onChange={handleFileSelect} disabled={uploadingDocs} style={{ position: 'absolute', inset: 0, opacity: 0, zIndex: 10, cursor: uploadingDocs ? 'not-allowed' : 'pointer' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ padding: 8, borderRadius: '50%', background: '#fff', border: `1px solid ${T.line}` }}>
                                    {uploadingDocs ? <Loader2 size={16} className="animate-spin" style={{ color: T.blue }} /> : <Plus size={16} style={{ color: T.muted }} />}
                                </div>
                                <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>
                                    {uploadingDocs ? 'Uploading…' : <><span>Drop files to attach or </span><span style={{ color: T.blue, fontWeight: 600 }}>Browse</span></>}
                                </p>
                            </div>
                        </div>
                        {displayAttachments.length > 0 && (
                            <div ref={attachmentContainerRef} style={{ marginTop: 16, maxHeight: 500, overflowY: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                                    {displayAttachments.map((doc: TaskAttachment) => (
                                        <div key={doc.id} className="group" style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.line}` }}>
                                            <DocumentThumbnail url={doc.file_url} fileName={doc.file_name} fileType={doc.file_url?.split('.').pop() || ''} onClick={() => handleAttachmentClick(doc)} showFileName={false} className="h-full" />
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <button onClick={e => { e.stopPropagation(); setDeleteAttachmentConfirm({ id: doc.id.toString(), name: doc.file_name }); }}
                                                    style={{ padding: 5, background: 'rgba(255,255,255,.9)', borderRadius: 6, border: 'none', cursor: 'pointer', color: T.muted }}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                            <div style={{ padding: '8px 10px' }}>
                                                <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.file_name}</p>
                                                <p style={{ fontSize: 11, color: T.muted, margin: '2px 0 0' }}>{new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {isFetchingNextPage && <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}><Loader2 size={18} className="animate-spin" style={{ color: T.blue }} /></div>}
                            </div>
                        )}
                    </div>
                </div>

                {/* ⑦ Discussion */}
                <div style={T.card}>
                    <div style={{ padding: 20 }}>
                        <FieldLabel>Discussion ({comments.length})</FieldLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
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
                                placeholder="Add a comment…" style={{ ...T.input, borderRadius: 99 }} onFocus={focusInput} onBlur={blurInput} />
                            <button onClick={() => { if (newComment.trim()) addCommentMutation.mutate(newComment.trim()); }} disabled={!newComment.trim()}
                                style={{ width: 38, height: 38, borderRadius: '50%', background: newComment.trim() ? T.text : '#e6ebf2', color: '#fff', border: 'none', cursor: newComment.trim() ? 'pointer' : 'not-allowed', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}>
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* ── Delete confirm ─────────────────────────────────────────────── */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
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

            {/* ── Attachment delete confirm ──────────────────────────────────── */}
            {deleteAttachmentConfirm && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
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

            {/* ── Document preview ───────────────────────────────────────────── */}
            {previewDocument && (
                <DocumentPreview url={previewDocument.url} fileName={previewDocument.fileName} fileType={previewDocument.fileType} onClose={() => setPreviewDocument(null)} />
            )}
        </div>
    );
}