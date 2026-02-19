import React, { useState, useEffect } from 'react';
import {
    X, Trash2, Save, Edit3, Loader2, ChevronDown, FileText, Download, Send, Maximize2, Minimize2,
    Clock, ListTodo, PlayCircle, CheckCircle, CheckSquare, Pause, Calendar, Plus, Link, ExternalLink,
} from 'lucide-react';
import { useMutation, useQueryClient, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { taskApi, usersApi, documentsApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { getStatusConfig } from '@/components/layout/DualView/taskConfig';
import { Task, TaskAttachment, TaskLink } from '@/types';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { DocumentPreview, useDocumentPreviewKeyboard, DocumentThumbnail } from '@/components/common/DocumentPreview';

const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return dateString;
    }
};

interface TaskDetailModalProps {
    task: Task;
    onClose: () => void;
    onDelete: (id: number) => Promise<void>;
    onTaskUpdated: (updatedTask: Task) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose, onDelete, onTaskUpdated }) => {
    const taskWithLabels = React.useMemo(() => ({
        ...task,
        labels: (task as any).label_details || task.labels || []
    }), [task]);
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleOpenFullPage = () => {
        onClose();
        navigate(`/tasks/${task.id}`);
    };
    const [selectedStatus, setSelectedStatus] = useState<Task['status']>(task.status);
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [assignedMembersOpen, setAssignedMembersOpen] = useState(true);
    const [showAddDocuments, setShowAddDocuments] = useState(false);
    const [uploadingDocs, setUploadingDocs] = useState(false);
    const [showDocumentsDropdown, setShowDocumentsDropdown] = useState(false);
    const [newUsers, setNewUsers] = useState<number[]>([]);
    const [newDocuments, setNewDocuments] = useState<File[]>([]);
    const [newComment, setNewComment] = useState('');
    const [availableUsers, setAvailableUsers] = useState<Array<{ id: number, username: string, first_name: string, last_name: string, role?: string }>>([]);
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [showAddUsersDropdown, setShowAddUsersDropdown] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editableDescription, setEditableDescription] = useState(task.description);
    const [attachmentPage, setAttachmentPage] = useState(1);
    const [loadingMoreAttachments, setLoadingMoreAttachments] = useState(false);
    const [hasMoreAttachments, setHasMoreAttachments] = useState(true);
    const attachmentContainerRef = React.useRef<HTMLDivElement>(null);
    const [previewDocument, setPreviewDocument] = useState<{
        url: string;
        fileName: string;
        fileType?: string;
    } | null>(null);
    const [deleteAttachmentConfirm, setDeleteAttachmentConfirm] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const getInitialLinks = (taskLinks: TaskLink[] | undefined): string[] => {
        if (!taskLinks) return [];
        return taskLinks.map(link => {
            return typeof link === 'object' && link.url ? link.url : String(link);
        });
    };
    const { data: fullTaskDetails, refetch: refetchTaskDetails } = useQuery({
        queryKey: ['task-detail', task.id],
        queryFn: () => taskApi.get(task.id),
        enabled: !!task.id,
    });

    // Query to fetch documents associated with this task with pagination
    const { data: taskDocumentsData, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['task-documents', task.id],
        queryFn: async ({ pageParam = 1 }) => {
            try {
                const projectId = task.project || (task as any).project_details?.id;
                if (!projectId) return { results: [], count: 0, next: null, previous: null };

                const response = await documentsApi.list({ project: projectId, page: pageParam });
                const allDocs = response.results || response.documents || [];
                const taskDocs = allDocs.filter((doc: any) =>
                    doc.metadata?.task_id === task.id ||
                    doc.task_id === task.id
                );

                return {
                    results: taskDocs,
                    count: taskDocs.length,
                    next: response.next,
                    previous: response.previous,
                };
            } catch (error) {
                console.error('Failed to fetch task documents:', error);
                return { results: [], count: 0, next: null, previous: null };
            }
        },
        getNextPageParam: (lastPage) => {
            if (lastPage.next) {
                const url = new URL(lastPage.next);
                const pageParam = url.searchParams.get('page');
                return pageParam ? parseInt(pageParam) : undefined;
            }
            return undefined;
        },
        enabled: !!task.id,
        initialPageParam: 1,
    });

    // Flatten paginated documents
    const taskDocuments = React.useMemo(() => {
        if (!taskDocumentsData?.pages) return [];
        return taskDocumentsData.pages.flatMap(page => page.results);
    }, [taskDocumentsData]);

    // Sync links when full details arrive
    useEffect(() => {
        const remoteTask = fullTaskDetails?.task || fullTaskDetails;
        if (remoteTask?.links) {
            setLinks(getInitialLinks(remoteTask.links));
        }
    }, [fullTaskDetails]);
    const [links, setLinks] = useState<string[]>(getInitialLinks(task.links));
    const [linkInput, setLinkInput] = useState('')
    const [startDate, setStartDate] = useState(task.start_date?.split('T')[0] || '');
    const [endDate, setEndDate] = useState(task.end_date?.split('T')[0] || '');
    const canEditDates = ['admin', 'manager'].includes(user?.role || '');
    const toggleMaximize = () => setIsMaximized(!isMaximized);
    const queryClient = useQueryClient();

    const updateTaskMutation = useMutation({
        mutationFn: (updates: any) => taskApi.update(task.id, updates),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            onTaskUpdated(data);
            setIsEditingStatus(false);
            onClose();
        },
        onError: (error) => {
            console.error('Failed to update task status:', error);
            alert('Failed to update task status. Check console for details.');
        },
    });

    const { data: commentsData } = useQuery({
        queryKey: ['task-comments', task.id],
        queryFn: () => taskApi.getComments(task.id),
        enabled: !!task.id,
        refetchInterval: 10000,
    });

    const comments = React.useMemo(() => {
        if (!commentsData) return [];
        if (Array.isArray(commentsData)) return commentsData;
        if (commentsData.results && Array.isArray(commentsData.results)) return commentsData.results;
        return [];
    }, [commentsData]);

    const displayAttachments = React.useMemo(() => {
        const remoteTask = fullTaskDetails?.task || fullTaskDetails;
        const apiAttachments = remoteTask?.attachments || task.attachments || [];
        const documentAttachments = (taskDocuments || []).map((doc: any) => ({
            id: doc.id,
            file_name: doc.name || doc.original_file_name || doc.file_name,
            file_url: doc.source_file_url || doc.file_url,
            uploaded_at: doc.created_at
        }));
        const combined = [...apiAttachments, ...documentAttachments];
        const uniqueMap = new Map();

        combined.forEach(item => {
            if (item.id && !uniqueMap.has(item.id)) {
                uniqueMap.set(item.id, item);
            }
        });

        return Array.from(uniqueMap.values());
    }, [fullTaskDetails, task.attachments, taskDocuments]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    useEffect(() => {
        setSelectedStatus(task.status);
        setIsEditingStatus(false);
    }, [task.status]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const userResponse = await usersApi.list();
                const users = userResponse.results || userResponse;
                setAvailableUsers(users);
            } catch (error) {
                console.error('Failed to fetch users:', error);
            }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        const statusChanged = selectedStatus !== task.status;
        const usersChanged = newUsers.length > 0;
        const docsChanged = newDocuments.length > 0;
        const descriptionChanged = editableDescription !== task.description;
        const datesChanged = startDate !== (task.start_date?.split('T')[0] || '') ||
            endDate !== (task.end_date?.split('T')[0] || '');
        const remoteTask = fullTaskDetails?.task || fullTaskDetails;
        const baselineLinks = remoteTask?.links || task.links;

        const originalLinks = getInitialLinks(baselineLinks);
        const linksChanged = JSON.stringify(links) !== JSON.stringify(originalLinks);

        setHasUnsavedChanges(statusChanged || usersChanged || docsChanged || descriptionChanged || datesChanged || linksChanged);
    }, [selectedStatus, task.status, newUsers.length, newDocuments.length, editableDescription, task.description, startDate, endDate, task.start_date, task.end_date, links, task.links]);

    const handleAddLink = () => {
        if (linkInput.trim()) {
            setLinks([...links, linkInput.trim()]);
            setLinkInput('');
        }
    };

    const removeLink = (index: number) => {
        setLinks(links.filter((_, i) => i !== index));
    };
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !updateTaskMutation.isPending) onClose();
    };

    const handleSaveStatus = async () => {
        try {
            const updates: any = {};
            if (selectedStatus !== task.status) updates.status = selectedStatus;
            if (newUsers.length > 0) updates.assigned_to = [...task.assigned_to, ...newUsers];
            if (editableDescription !== task.description) updates.description = editableDescription;
            const originalStart = task.start_date?.split('T')[0] || '';
            const originalEnd = task.end_date?.split('T')[0] || '';

            if (startDate !== originalStart) updates.start_date = startDate ? `${startDate}T09:00:00Z` : null;
            if (endDate !== originalEnd) updates.end_date = endDate ? `${endDate}T18:00:00Z` : null;
            const remoteTask = fullTaskDetails?.task || fullTaskDetails;
            const baselineLinks = remoteTask?.links || task.links;
            const originalLinks = getInitialLinks(baselineLinks);
            if (JSON.stringify(links) !== JSON.stringify(originalLinks)) {
                updates.links = links;
            }
            if (Object.keys(updates).length === 0) return;
            updateTaskMutation.mutate(updates);
            setNewUsers([]);
            setIsEditingDescription(false);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Error saving task:', error);
        }
    };

    const deleteMutation = useMutation({
        mutationFn: (taskId: number) => onDelete(taskId),
        onSuccess: () => {
            setShowDeleteConfirm(false);
            onClose();
        },
    });

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        setUploadingDocs(true);

        try {
            // Upload files directly to task using PATCH multipart request
            await taskApi.uploadFiles(task.id, fileArray);

            // Invalidate queries to refresh task data
            await queryClient.invalidateQueries({ queryKey: ['task-documents', task.id] });
            await queryClient.invalidateQueries({ queryKey: ['tasks'] });
            await queryClient.invalidateQueries({ queryKey: ['task-detail', task.id] });
            await queryClient.refetchQueries({
                queryKey: ['documents'],
                type: 'active'
            });

        } catch (err: any) {
            console.error('Upload failed:', err);
            alert('Failed to upload document. Please try again.');
        } finally {
            setUploadingDocs(false);
            setNewDocuments([]);
            e.target.value = '';
        }
    };

    const handleAttachmentClick = async (attachment: TaskAttachment) => {
        try {
            let fileUrl = attachment.file_url;

            // If file_url is not available, fetch it from the API
            if (!fileUrl) {
                const projectIdNum = task.project || (task as any).project_details?.id;
                if (!projectIdNum) {
                    alert('Unable to open attachment: Project information missing.');
                    return;
                }

                const downloadResponse = await documentsApi.getDownloadUrl(projectIdNum, {
                    document_id: attachment.id.toString()
                });

                if (downloadResponse?.url) {
                    fileUrl = downloadResponse.url;
                } else {
                    alert('Unable to open attachment: Download URL not available.');
                    return;
                }
            }

            // Open in-app preview
            setPreviewDocument({
                url: fileUrl,
                fileName: attachment.file_name,
                fileType: attachment.file_url?.split('.').pop() || ''
            });
        } catch (error) {
            console.error('Failed to open attachment:', error);
            alert('Failed to open attachment. Please try again.');
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        try {
            await taskApi.deleteAttachment(attachmentId);
            queryClient.setQueryData(['task-documents', task.id], (oldData: any) => {
                if (!oldData?.pages) return oldData;

                return {
                    ...oldData,
                    pages: oldData.pages.map((page: any) => ({
                        ...page,
                        results: page.results.filter((doc: any) => doc.id.toString() !== attachmentId),
                        count: page.count - 1,
                    })),
                };
            });

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['task-documents', task.id] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['task-detail', task.id] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });

            setDeleteAttachmentConfirm(null);
        } catch (error) {
            console.error('Failed to delete attachment:', error);
            alert('Failed to delete attachment. Please try again.');
            setDeleteAttachmentConfirm(null);
        }
    };

    // Handle scroll for lazy loading attachments
    const handleAttachmentScroll = React.useCallback(() => {
        if (!attachmentContainerRef.current || isFetchingNextPage || !hasNextPage) return;

        const container = attachmentContainerRef.current;
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;

        // Trigger load when user scrolls to 80% of container
        if (scrollTop + clientHeight >= scrollHeight * 0.8) {
            fetchNextPage();
        }
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

    // Attach scroll listener
    React.useEffect(() => {
        const container = attachmentContainerRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleAttachmentScroll);
        return () => container.removeEventListener('scroll', handleAttachmentScroll);
    }, [handleAttachmentScroll]);

    // Enable keyboard shortcuts for document preview
    useDocumentPreviewKeyboard(() => setPreviewDocument(null));

    const addCommentMutation = useMutation({
        mutationFn: (content: string) => taskApi.addComment(task.id, { content }),
        onSuccess: (newCommentData) => {
            queryClient.invalidateQueries({ queryKey: ['task-comments', task.id] });
            setNewComment('');
        },
    });

    const statusOptions: Array<{ status: Task['status'], icon: React.ElementType, label: string }> = [
        { status: 'pending', icon: Clock, label: 'Pending' },
        { status: 'backlog', icon: ListTodo, label: 'Backlog' },
        { status: 'in_progress', icon: PlayCircle, label: 'In Progress' },
        { status: 'completed', icon: CheckCircle, label: 'Completed' },
        { status: 'deployed', icon: CheckSquare, label: 'Deployed' },
        { status: 'deferred', icon: Pause, label: 'Deferred' },
        { status: 'review', icon: Pause, label: 'Review' },
    ];

    const isSaving = updateTaskMutation.isPending;

    return (
        <div
            className={`fixed inset-0 z-[100] ${isMaximized ? 'bg-gray-50' : 'flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'}`}
            onClick={handleBackdropClick}
        >
            <div
                className={`bg-white shadow-2xl transform transition-all flex flex-col ${isMaximized
                    ? 'w-full h-full rounded-none fixed inset-0'
                    : 'rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden'
                    }`}
                role="dialog"
            >
                {/* Header */}
                <div className={`${isMaximized ? 'px-4 max-w-4xl mx-auto w-full' : 'px-'} py-5 border-b bg-white flex items-center justify-between sticky top-0 z-20`}>
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-purple-50 rounded-lg"><Edit3 className="w-5 h-5 text-purple-600" /></div>
                        <div className="pr-2 flex flex-col">
                            <span className="text-sm font-bold text-gray-900 line-clamp-1 mb-0.5">
                                {task.heading || 'No Task'}
                            </span>
                            <span className="text-xs font-medium text-gray-600 line-clamp-2">
                                {task.project_details?.name || task.project_name || 'No Project'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSaveStatus}
                            disabled={isSaving || !hasUnsavedChanges}
                            className={`flex items-center px-2 py-2 text-sm font-bold rounded-lg transition-all shadow-sm ${isSaving || !hasUnsavedChanges
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-500 active:scale-95 shadow-green-100'
                                }`}
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            Save Changes
                        </button>
                        <button
                            onClick={handleOpenFullPage}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Open in full page"
                        >
                            <Maximize2 className="w-5 h-5" />
                        </button>
                        {(user?.role === 'admin' || task.assigned_by === user?.id) && (
                            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-black rounded-lg"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Content Body */}
                <div className={`flex-1 overflow-y-auto ${isMaximized ? 'bg-gray-50' : 'bg-gray-50/50'}`}>
                    <div className={`${isMaximized ? 'max-w-4xl mx-auto w-full py-6 px-6' : 'p-4'} space-y-3`}>

                        {/* 1. Timeline Div */}
                        <div className="timeline bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-6 text-sm font-semibold text-gray-700">
                                        {/* Start Date */}
                                        <span className={`flex items-center group relative ${canEditDates ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-gray-700 block mb-4">Start Date</span>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    disabled={!canEditDates}
                                                    onChange={(e) => {
                                                        const newStart = e.target.value;
                                                        setStartDate(newStart);
                                                        if (endDate && newStart > endDate) {
                                                            setEndDate('');
                                                        }
                                                    }}
                                                    className={`text-xs text-gray-400 ${canEditDates ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                                />
                                            </div>
                                        </span>

                                        {/* End Date */}
                                        <span className={`flex items-center group relative ${canEditDates ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-gray-700 block mb-4">Due Date</span>
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    disabled={!canEditDates}
                                                    min={startDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className={`text-xs text-gray-400 ${canEditDates ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                                />
                                            </div>
                                        </span>

                                        {/* Duration Time */}
                                        <span className="flex items-center group">
                                            <div className="flex items-center justify-center w-5 h-5 bg-blue-50 text-blue-700 rounded-full mr-2 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                                                <Clock className="w-3 h-3" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-gray-700 block mb-4">Duration</span>
                                                <span className="text-xs text-gray-400">
                                                    {(task as any).duration_time || 'N/A'}
                                                </span>
                                            </div>
                                        </span>
                                    </div>
                                </div>

                                {/* Status logic*/}
                                <div className="flex-shrink-0 border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-4">
                                    <label className="text-sm font-semibold text-gray-700 block mb-4">Task Status</label>
                                    <button
                                        onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                                        className={`inline-flex items-center px-4 py-2 rounded-xl border text-xs font-bold transition-all hover:shadow-sm ${getStatusConfig(selectedStatus).bg} ${getStatusConfig(selectedStatus).text}`}
                                    >
                                        {React.createElement(getStatusConfig(selectedStatus).icon, { className: "w-3.5 h-3.5 mr-2" })}
                                        {getStatusConfig(selectedStatus).label}
                                        <ChevronDown className="ml-2 w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            {showStatusDropdown && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 mt-3 border-t border-gray-50">
                                    {statusOptions.map(opt => (
                                        <div key={opt.status} onClick={() => { setSelectedStatus(opt.status); setHasUnsavedChanges(true); }} className={`flex items-center p-2.5 rounded-xl border-2 cursor-pointer ${selectedStatus === opt.status ? 'border-black bg-gray-50' : 'border-gray-100 bg-white'}`}>
                                            {React.createElement(opt.icon, { className: `w-4 h-4 mr-2.5 ${getStatusConfig(opt.status).text}` })}
                                            <span className="text-xs font-bold text-gray-800">{opt.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 2. Description Div */}
                        <div className="description bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-semibold text-gray-700 block mb-4">Description</label>
                                {!isEditingDescription && (
                                    <button
                                        onClick={() => setIsEditingDescription(true)}
                                        className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <Edit3 className="w-3 h-3" />
                                        Edit description
                                    </button>
                                )}
                            </div>

                            {isEditingDescription ? (
                                <RichTextEditor
                                    value={editableDescription}
                                    onChange={(html) => {
                                        setEditableDescription(html);
                                        setHasUnsavedChanges(true);
                                    }}
                                    placeholder="Enter task description..."
                                    minHeight="150px"
                                    maxHeight="400px"
                                    features={{
                                        bold: true,
                                        italic: true,
                                        underline: true,
                                        strikethrough: true,
                                        link: true,
                                        bulletList: true,
                                        orderedList: true,
                                        blockquote: true,
                                        code: true,
                                        codeBlock: true,
                                        heading: true,
                                        table: true,
                                    }}
                                />
                            ) : (
                                <div
                                    className="text-sm text-gray-600 leading-relaxed task-description-content"
                                    dangerouslySetInnerHTML={{ __html: task.description }}
                                />
                            )}
                        </div>

                        {/* 3. Project Assignees*/}
                        <div className="project-assignees bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setAssignedMembersOpen(!assignedMembersOpen)}>
                                <label className="text-sm font-semibold text-gray-700 block mb-4">Assignees</label>
                                {task.assigned_by_user_details && (
                                    <span className="text-xs text-gray-500">
                                        Created by {task.assigned_by_user_details.first_name && task.assigned_by_user_details.last_name
                                            ? `${task.assigned_by_user_details.first_name} ${task.assigned_by_user_details.last_name}`.trim()
                                            : task.assigned_by_user_details.username}
                                    </span>
                                )}
                            </div>

                            {assignedMembersOpen && (
                                <div className="flex flex-col gap-2">
                                    {/* Current Assignees Display */}
                                    <div className="space-y-1.5">
                                        {task.assigned_to_user_details.map(u => (
                                            <div key={u.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-xs font-bold text-purple-700">
                                                        {u.first_name[0]}{u.last_name[0]}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-gray-900">{u.first_name} {u.last_name}</span>
                                                        <span className="text-[10px] text-gray-500">{u.role || 'Member'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/*Added Users*/}
                                        {newUsers.map(userId => {
                                            const u = availableUsers.find(au => au.id === userId);
                                            return u && (
                                                <div key={userId} className="flex items-center justify-between p-2 bg-green-50/50 rounded-lg border border-green-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">{u.first_name[0]}</div>
                                                        <span className="text-xs font-bold text-green-800">{u.first_name} (Adding...)</span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setNewUsers(newUsers.filter(id => id !== userId));
                                                            setHasUnsavedChanges(newUsers.filter(id => id !== userId).length > 0 || selectedStatus !== task.status);
                                                        }}
                                                        className="text-green-600 p-1 hover:bg-green-100 rounded-full"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {/* Add Assignee Dropdown */}
                                        <div className="relative">
                                            <div
                                                className="w-full p-2 rounded border border-gray-300 hover:border-gray-400 cursor-pointer bg-white flex items-center justify-between min-h-[38px] transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowAddUsersDropdown(!showAddUsersDropdown);
                                                }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Plus className="w-3.5 h-3.5 text-gray-500" />
                                                    <span className="text-sm text-gray-700 font-medium">Add Assignee</span>
                                                </div>
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>

                                            {/* Dropdown List */}
                                            {showAddUsersDropdown && (
                                                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                    {availableUsers
                                                        .filter(u => !task.assigned_to_user_details.some(a => a.id === u.id) && !newUsers.includes(u.id))
                                                        .map((user) => (
                                                            <div
                                                                key={user.id}
                                                                className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm flex items-center justify-between"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setNewUsers([...newUsers, user.id]);
                                                                    setHasUnsavedChanges(true);
                                                                    setShowAddUsersDropdown(false);
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                                                        {user.first_name[0]}{user.last_name?.[0] || ''}
                                                                    </div>
                                                                    <span className="text-sm">{user.first_name} {user.last_name}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    {availableUsers.filter(u => !task.assigned_to_user_details.some(a => a.id === u.id) && !newUsers.includes(u.id)).length === 0 && (
                                                        <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                                            No more users to add
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Links Section */}
                        <div className="links bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <label className="text-sm font-semibold text-gray-700 block mb-3">Links</label>

                            {/* List Existing Links */}
                            {links.length > 0 && (
                                <div className="space-y-2 mb-3">
                                    {links.map((link, index) => (
                                        <div key={index} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200 group transition-all hover:border-gray-300">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div className="p-1.5 bg-blue-50 rounded-md text-blue-600">
                                                    <Link className="w-3.5 h-3.5" />
                                                </div>
                                                <a
                                                    href={link.startsWith('http') ? link : `https://${link}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-600 hover:underline truncate font-medium"
                                                    title={link}
                                                >
                                                    {link}
                                                </a>
                                            </div>
                                            <button
                                                onClick={() => removeLink(index)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                                title="Remove link"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add New Link */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={linkInput}
                                    onChange={(e) => setLinkInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                                    placeholder="Paste URL to add..."
                                    className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                                <button
                                    onClick={handleAddLink}
                                    disabled={!linkInput.trim()}
                                    className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* 4. Documents */}
                        <div className="documents bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                            <label className="text-sm font-semibold text-gray-700 block mb-4">Attachment</label>

                            {/* Dropzone with auto-trigger */}
                            <div className={`relative border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-all ${uploadingDocs ? 'bg-blue-50/30 border-blue-200' : 'bg-gray-50/30 border-gray-200 hover:bg-gray-50 hover:border-gray-300'} group`}>
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileSelect}
                                    disabled={uploadingDocs}
                                    className={`absolute inset-0 opacity-0 ${uploadingDocs ? 'cursor-not-allowed' : 'cursor-pointer'} z-10`}
                                />
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-white shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                                        {uploadingDocs ? (
                                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                        ) : (
                                            <Plus className="w-5 h-5 text-gray-500" />
                                        )}
                                    </div>
                                    <p className="text-lg text-gray-500 font-small">
                                        {uploadingDocs ? 'Uploading documents...' : (
                                            <>Drop files to attach or <span className="text-blue-500 hover:underline font-semibold">Browse</span></>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Attachment Grid with Scroll Container */}
                            {displayAttachments && displayAttachments.length > 0 && (
                                <div
                                    ref={attachmentContainerRef}
                                    className="mt-6 max-h-[500px] overflow-y-auto pr-2"
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {displayAttachments.map((doc: TaskAttachment) => (
                                            <div key={doc.id} className="relative group">
                                                <DocumentThumbnail
                                                    url={doc.file_url}
                                                    fileName={doc.file_name}
                                                    fileType={doc.file_url?.split('.').pop() || ''}
                                                    onClick={() => handleAttachmentClick(doc)}
                                                    showFileName={false}
                                                    className="h-full"
                                                />
                                                {/* Delete Button Overlay */}
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <button
                                                        className="p-1.5 bg-white/90 rounded-md shadow-sm text-gray-600 hover:text-red-600"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteAttachmentConfirm({
                                                                id: doc.id.toString(),
                                                                name: doc.file_name
                                                            });
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                {/* File Info Below Thumbnail */}
                                                <div className="p-3">
                                                    <p className="text-xs font-bold text-gray-900 truncate" title={doc.file_name}>{doc.file_name}</p>
                                                    <p className="text-[10px] text-gray-500 mt-1 font-medium italic">
                                                        {new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Loading Indicator */}
                                    {isFetchingNextPage && (
                                        <div className="flex justify-center items-center py-6">
                                            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                                            <span className="ml-2 text-sm text-gray-600">Loading more attachments...</span>
                                        </div>
                                    )}

                                    {/* No More Attachments Indicator */}
                                    {!hasNextPage && displayAttachments.length > 20 && (
                                        <div className="flex justify-center py-4">
                                            <span className="text-xs text-gray-500">All attachments loaded</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>


                        {/* 5. Discussion */}
                        <div className="discussion bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3">
                            <label className="text-sm font-semibold text-gray-700 block mb-4">Discussion ({comments.length})</label>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {comments.map((comment: { id: React.Key | null | undefined; user_details: { first_name: any[]; username: any[]; }; created_at: string | number | Date; content: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined; }) => (
                                    <div key={comment.id} className="flex gap-2.5">
                                        <div className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                                            {comment.user_details.first_name?.[0] || comment.user_details.username[0]}
                                        </div>
                                        <div className="bg-gray-50 rounded-2xl rounded-tl-none p-2.5 flex-1">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-xs font-bold text-gray-900">{comment.user_details.first_name || comment.user_details.username}</span>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">{new Date(comment.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-gray-600">{comment.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 pt-1">
                                <input
                                    type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment..." className="flex-1 px-3 py-2 bg-gray-50 border-none rounded-full text-xs focus:ring-2 focus:ring-black"
                                />
                                <button
                                    onClick={() => { if (newComment.trim()) addCommentMutation.mutate(newComment.trim()); }}
                                    disabled={!newComment.trim()} className="p-2 bg-black text-white rounded-full disabled:bg-gray-200"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* DELETE CONFIRMATION */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Task</h3>
                        <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete <b>{task.heading}</b>?</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-lg bg-gray-200">No</button>
                            <button onClick={() => deleteMutation.mutate(task.id)} className="px-4 py-2 rounded-lg bg-red-600 text-white">Yes, Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ATTACHMENT DELETE CONFIRMATION */}
            {deleteAttachmentConfirm && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Attachment</h3>
                        <p className="text-sm text-gray-600 mb-6">
                            Are you sure you want to delete <b>{deleteAttachmentConfirm.name}</b>?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteAttachmentConfirm(null)}
                                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
                            >
                                No
                            </button>
                            <button
                                onClick={() => handleDeleteAttachment(deleteAttachmentConfirm.id)}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* DOCUMENT PREVIEW */}
            {previewDocument && (
                <DocumentPreview
                    url={previewDocument.url}
                    fileName={previewDocument.fileName}
                    fileType={previewDocument.fileType}
                    onClose={() => setPreviewDocument(null)}
                />
            )}
        </div>
    );
};