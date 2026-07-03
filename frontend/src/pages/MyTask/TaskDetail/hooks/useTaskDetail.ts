import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { taskApi, usersApi, documentsApi, projectsApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentPreviewKeyboard } from '@/components/common/DocumentPreview';
import { useAISuggestions } from './useAISuggestions';
import type { Task, TaskAttachment, TaskLink, Label } from '@/types';

// ── Helpers (exported so Modal/Page can use them without re-defining) ─────────
export const getInitialLinks = (taskLinks: TaskLink[] | undefined): string[] => {
    if (!taskLinks) return [];
    return taskLinks.map(link => typeof link === 'object' && link.url ? link.url : String(link));
};

// ── Hook options ─────────────────────────────────────────────────────────────
export interface UseTaskDetailOptions {
    task: Task;
    onClose?: () => void;          // provided by Modal, undefined in Page
    onDelete: (id: number) => Promise<void>;
    onTaskUpdated?: (t: Task) => void; // provided by Modal
}

// ── The hook ─────────────────────────────────────────────────────────────────
export function useTaskDetail({ task, onClose, onDelete, onTaskUpdated }: UseTaskDetailOptions) {
    const { user } = useAuth();
    const navigate  = useNavigate();
    const queryClient = useQueryClient();

    const taskWithLabels = useMemo(() => ({
        ...task,
        labels: (task as any).label_details || task.labels || [],
    }), [task]);

    const resolvedTaskId = useMemo(() => {
        const num = Number(task.id);
        const safe = Number.isFinite(num) && num > 0 && num < 1_000_000_000_000;
        if (!safe) { console.error('[useTaskDetail] invalid task.id:', task.id); return 0; }
        return num;
    }, [task.id, task.heading]);

    // ── State ────────────────────────────────────────────────────────────────
    const [selectedStatus,        setSelectedStatus]        = useState<Task['status']>(task.status);
    const [showStatusDropdown,    setShowStatusDropdown]    = useState(false);
    const [showDeleteConfirm,     setShowDeleteConfirm]     = useState(false);
    const [showNotAdminPopup,     setShowNotAdminPopup]     = useState(false);
    const [hasUnsavedChanges,     setHasUnsavedChanges]     = useState(false);
    const [isEditingTitle,        setIsEditingTitle]        = useState(false);
    const [editableTitle,         setEditableTitle]         = useState(task.heading || '');
    const [isEditingDescription,  setIsEditingDescription]  = useState(false);
    const [editableDescription,   setEditableDescription]   = useState(task.description);
    const [assignedMembersOpen,   setAssignedMembersOpen]   = useState(true);
    const [showAddUsersDropdown,  setShowAddUsersDropdown]  = useState(false);
    const [newUsers,              setNewUsers]              = useState<number[]>([]);
    const [availableUsers,        setAvailableUsers]        = useState<Array<{ id: number; username: string; first_name: string; last_name: string; role?: string }>>([]);
    const [projectMembers,        setProjectMembers]        = useState<{ user: { id: number; username: string; full_name: string } }[]>([]);
    const [links,                 setLinks]                 = useState<string[]>(getInitialLinks(task.links));
    const [linkInput,             setLinkInput]             = useState('');
    const [selectedLabelIds,      setSelectedLabelIds]      = useState<number[]>((taskWithLabels.labels || []).map((l: Label) => l.id));
    const [availableLabels,       setAvailableLabels]       = useState<Label[]>([]);
    const [startDate,             setStartDate]             = useState(task.start_date?.split('T')[0] || '');
    const [endDate,               setEndDate]               = useState(task.end_date?.split('T')[0] || '');
    const [uploadingDocs,         setUploadingDocs]         = useState(false);
    const [previewDocument,       setPreviewDocument]       = useState<{ url: string; fileName: string; fileType?: string } | null>(null);
    const [deleteAttachmentConfirm, setDeleteAttachmentConfirm] = useState<{ id: string; name: string } | null>(null);
    const [newComment,            setNewComment]            = useState('');
    const [childTasksOpen,        setChildTasksOpen]        = useState(true);

    // Refs for click-outside
    const statusDropdownRef  = useRef<HTMLDivElement>(null);
    const addUserDropdownRef = useRef<HTMLDivElement>(null);
    const attachmentContainerRef = useRef<HTMLDivElement>(null);
    const canEditDates = ['admin', 'manager'].includes(user?.role || '');

    // ── Queries ──────────────────────────────────────────────────────────────
    const { data: fullTaskDetails } = useQuery<any>({
        queryKey: ['task-detail', resolvedTaskId],
        queryFn: () => taskApi.get(resolvedTaskId),
        enabled: resolvedTaskId > 0,
    });

    const { data: childTasksData, isLoading: childTasksLoading } = useQuery<any>({
        queryKey: ['child-tasks', resolvedTaskId],
        queryFn: () => taskApi.getChildTasks(resolvedTaskId),
        enabled: resolvedTaskId > 0,
    });
    const childTasks: any[] = useMemo(() => childTasksData?.children || childTasksData?.results || [], [childTasksData]);

    const { data: taskDocumentsData, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['task-documents', task.id],
        queryFn: async ({ pageParam = 1 }) => {
            try {
                const projectId = task.project || (task as any).project_details?.id;
                if (!projectId) return { results: [], count: 0, next: null, previous: null };
                const response = await documentsApi.list({ project: projectId, page: pageParam });
                const allDocs = response.results || response.documents || [];
                const taskDocs = allDocs.filter((doc: any) => doc.metadata?.task_id === task.id || doc.task_id === task.id);
                return { results: taskDocs, count: taskDocs.length, next: response.next, previous: response.previous };
            } catch { return { results: [], count: 0, next: null, previous: null }; }
        },
        getNextPageParam: (lastPage) => {
            if (!lastPage?.next) return undefined;
            try { const p = new URL(lastPage.next).searchParams.get('page'); return p ? parseInt(p) : undefined; }
            catch { return undefined; }
        },
        enabled: !!task.id,
        initialPageParam: 1,
    });
    const taskDocuments = useMemo(() => taskDocumentsData?.pages?.flatMap(p => p?.results ?? []) ?? [], [taskDocumentsData]);

    const { data: commentsData } = useQuery({
        queryKey: ['task-comments', task.id],
        queryFn: () => taskApi.getComments(task.id),
        enabled: !!task.id,
        staleTime: Infinity,
    });
    const comments = useMemo(() => {
        if (!commentsData) return [];
        if (Array.isArray(commentsData)) return commentsData;
        return commentsData.results && Array.isArray(commentsData.results) ? commentsData.results : [];
    }, [commentsData]);

    const resolvedApiAttachments = useMemo(() => {
        const remote = fullTaskDetails?.task || fullTaskDetails;
        return remote?.attachments || task.attachments || [];
    }, [fullTaskDetails, task.attachments]);

    const displayAttachments = useMemo(() => {
        const docAttachments = taskDocuments.map((doc: any) => ({
            id: doc.id,
            file_name: doc.name || doc.original_file_name || doc.file_name,
            file_url: doc.source_file_url || doc.file_url,
            uploaded_at: doc.created_at,
        }));
        const uniqueMap = new Map();
        [...resolvedApiAttachments, ...docAttachments].forEach(item => {
            if (item.id && !uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
        });
        return Array.from(uniqueMap.values());
    }, [resolvedApiAttachments, taskDocuments]);

    // ── AI suggestions ───────────────────────────────────────────────────────
    const aiSuggestions = useAISuggestions({
        taskId:             resolvedTaskId,
        taskTitle:          editableTitle,
        taskDescription:    editableDescription,
        projectName:        task.project_details?.name || task.project_name || '',
        taskType:           (task as any).task_type || '',
        existingChildTasks: childTasks.map((c: any) => c.heading || c.title || ''),
        parentAssigneeIds:  (task.assigned_to || []).map(Number),
    });

    // ── Effects ──────────────────────────────────────────────────────────────
    useEffect(() => { setSelectedStatus(task.status); }, [task.status]);

    useEffect(() => {
        const remote = fullTaskDetails?.task || fullTaskDetails;
        if (remote?.links) setLinks(getInitialLinks(remote.links));
    }, [fullTaskDetails]);

    useEffect(() => {
        (async () => {
            try {
                const userRes = await usersApi.list();
                setAvailableUsers(userRes.results || userRes);
                const projectId = task.project || (task as any)?.project_details?.id;
                if (projectId) {
                    const proj = await projectsApi.get(projectId);
                    setProjectMembers(proj.members || []);
                    try {
                        const lblRes = await projectsApi.getLabels(projectId);
                        setAvailableLabels(lblRes.results || lblRes || []);
                    } catch { /* ignore */ }
                }
            } catch { /* ignore */ }
        })();
    }, [task?.project, (task as any)?.project_details?.id]);

    useEffect(() => {
        const remote = fullTaskDetails?.task || fullTaskDetails;
        const baseline = getInitialLinks(remote?.links || task.links);
        const origLabelIds = (taskWithLabels.labels || []).map((l: Label) => l.id).sort();
        setHasUnsavedChanges(
            selectedStatus !== task.status ||
            newUsers.length > 0 ||
            editableDescription !== task.description ||
            startDate !== (task.start_date?.split('T')[0] || '') ||
            endDate   !== (task.end_date?.split('T')[0]   || '') ||
            JSON.stringify(links) !== JSON.stringify(baseline) ||
            editableTitle !== (task.heading || '') ||
            JSON.stringify([...selectedLabelIds].sort()) !== JSON.stringify(origLabelIds)
        );
    }, [selectedStatus, task.status, newUsers.length, editableDescription, task.description,
        startDate, endDate, task.start_date, task.end_date, links, task.links,
        editableTitle, task.heading, selectedLabelIds, taskWithLabels.labels, fullTaskDetails]);

    // Click-outside: status dropdown
    useEffect(() => {
        if (!showStatusDropdown) return;
        const h = (e: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node))
                setShowStatusDropdown(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [showStatusDropdown]);

    // Click-outside: add-user dropdown
    useEffect(() => {
        if (!showAddUsersDropdown) return;
        const h = (e: MouseEvent) => {
            if (addUserDropdownRef.current && !addUserDropdownRef.current.contains(e.target as Node))
                setShowAddUsersDropdown(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [showAddUsersDropdown]);

    // Attachment infinite scroll
    const handleAttachmentScroll = useCallback(() => {
        if (!attachmentContainerRef.current || isFetchingNextPage || !hasNextPage) return;
        const c = attachmentContainerRef.current;
        if (c.scrollTop + c.clientHeight >= c.scrollHeight * 0.8) fetchNextPage();
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

    useEffect(() => {
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
            // Update all task caches
            const patchCache = (old: any): any => {
                if (!old) return old;
                if (old.pages) {
                    const stripped = old.pages.map((p: any) => ({ ...p, results: p.results.filter((t: Task) => t.id !== updatedTask.id) }));
                    return { ...old, pages: [{ ...stripped[0], results: [updatedTask, ...(stripped[0]?.results ?? [])] }, ...stripped.slice(1)] };
                }
                if (Array.isArray(old)) return [updatedTask, ...old.filter((t: Task) => t.id !== updatedTask.id)];
                if (old.tasks)   return { ...old, tasks:   [updatedTask, ...old.tasks.filter((t: Task)   => t.id !== updatedTask.id)] };
                if (old.results) return { ...old, results: [updatedTask, ...old.results.filter((t: Task) => t.id !== updatedTask.id)] };
                return old;
            };
            queryClient.setQueryData(['tasks'], patchCache);
            queryClient.getQueryCache().findAll({ queryKey: ['tasks-list'], exact: false }).forEach(q =>
                queryClient.setQueryData(q.queryKey, patchCache)
            );
            queryClient.invalidateQueries({ queryKey: ['task-detail', resolvedTaskId] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['tasks-list'] });
            queryClient.invalidateQueries({ queryKey: ['tasksite'] });
            onTaskUpdated?.(updatedTask);
            setNewUsers([]);
            setHasUnsavedChanges(false);
            onClose?.();
        },
        onError: (err: any) => {
            const status = err?.response?.status;
            if (status === 404) alert(`Task not found (404). ID: ${resolvedTaskId}`);
            else alert('Failed to save changes. Please try again.');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => onDelete(id),
        onSuccess: () => { setShowDeleteConfirm(false); onClose?.(); },
    });

    const addCommentMutation = useMutation({
        mutationFn: (content: string) => taskApi.addComment(task.id, { content }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['task-comments', task.id] }); setNewComment(''); },
    });

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleOpenFullPage = () => { onClose?.(); navigate(`/tasks/${task.id}`); };
    const handleAddLink      = () => { if (linkInput.trim()) { setLinks([...links, linkInput.trim()]); setLinkInput(''); } };
    const removeLink         = (i: number) => setLinks(links.filter((_, idx) => idx !== i));

    const handleSave = async () => {
        if (!resolvedTaskId || resolvedTaskId <= 0) { alert('Cannot save: invalid task ID.'); return; }
        const remote      = fullTaskDetails?.task || fullTaskDetails;
        const baseline    = getInitialLinks(remote?.links || task.links);
        const origLabelIds = (taskWithLabels.labels || []).map((l: Label) => l.id).sort();
        const updates: any = {};
        if (editableTitle !== (task.heading || ''))          updates.heading     = editableTitle;
        if (selectedStatus !== task.status)                   updates.status      = selectedStatus;
        if (newUsers.length > 0)                              updates.assigned_to = [...new Set([...(task.assigned_to || []).map(Number), ...newUsers])];
        if (editableDescription !== task.description)         updates.description = editableDescription;
        const origStart = task.start_date?.split('T')[0] || '';
        const origEnd   = task.end_date?.split('T')[0]   || '';
        if (startDate !== origStart) updates.start_date = startDate ? `${startDate}T09:00:00Z` : null;
        if (endDate   !== origEnd)   updates.end_date   = endDate   ? `${endDate}T18:00:00Z`   : null;
        if (JSON.stringify(links) !== JSON.stringify(baseline))   updates.links  = links;
        if (JSON.stringify([...selectedLabelIds].sort()) !== JSON.stringify(origLabelIds)) updates.labels = selectedLabelIds;
        if (Object.keys(updates).length === 0) return;
        updateTaskMutation.mutate(updates);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadingDocs(true);
        try {
            await taskApi.uploadFiles(task.id, Array.from(files));
            const projectId = task.project;
            await queryClient.invalidateQueries({ queryKey: ['task-documents', task.id] });
            await queryClient.invalidateQueries({ queryKey: ['tasks'] });
            await queryClient.invalidateQueries({ queryKey: ['task-detail', task.id] });
            if (projectId) await queryClient.invalidateQueries({ queryKey: ['all-documents', projectId.toString()] });
        } catch { alert('Failed to upload. Please try again.'); }
        finally { setUploadingDocs(false); e.target.value = ''; }
    };

    const handleAttachmentClick = async (attachment: TaskAttachment) => {
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
            queryClient.setQueryData(['task-documents', task.id], (old: any) => {
                if (!old?.pages) return old;
                return { ...old, pages: old.pages.map((p: any) => ({ ...p, results: p.results.filter((d: any) => d.id.toString() !== attachmentId), count: p.count - 1 })) };
            });
            queryClient.invalidateQueries({ queryKey: ['task-documents', task.id] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['task-detail', task.id] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            setDeleteAttachmentConfirm(null);
        } catch { alert('Failed to delete attachment.'); setDeleteAttachmentConfirm(null); }
    };

    return {
        // auth
        user, canEditDates,
        // derived
        taskWithLabels, resolvedTaskId,
        // state
        selectedStatus, setSelectedStatus,
        showStatusDropdown, setShowStatusDropdown,
        showDeleteConfirm, setShowDeleteConfirm,
        showNotAdminPopup, setShowNotAdminPopup,
        hasUnsavedChanges, setHasUnsavedChanges,
        isEditingTitle, setIsEditingTitle,
        editableTitle, setEditableTitle,
        isEditingDescription, setIsEditingDescription,
        editableDescription, setEditableDescription,
        assignedMembersOpen, setAssignedMembersOpen,
        showAddUsersDropdown, setShowAddUsersDropdown,
        newUsers, setNewUsers,
        availableUsers,
        projectMembers,
        links, setLinks,
        linkInput, setLinkInput,
        selectedLabelIds, setSelectedLabelIds,
        availableLabels,
        startDate, setStartDate,
        endDate, setEndDate,
        uploadingDocs,
        previewDocument, setPreviewDocument,
        deleteAttachmentConfirm, setDeleteAttachmentConfirm,
        newComment, setNewComment,
        childTasksOpen, setChildTasksOpen,
        // refs
        statusDropdownRef, addUserDropdownRef, attachmentContainerRef,
        // data
        comments, displayAttachments, childTasks, childTasksLoading,
        isFetchingNextPage,
        // ai
        aiSuggestions,
        // mutations
        isSaving: updateTaskMutation.isPending,
        deleteMutation, addCommentMutation,
        // handlers
        handleOpenFullPage, handleSave,
        handleAddLink, removeLink,
        handleFileSelect, handleAttachmentClick, handleDeleteAttachment,
    };
}