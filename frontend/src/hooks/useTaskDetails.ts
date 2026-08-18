import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi, taskApi, documentsApi, chatApi, usersApi, notificationSocket, gatewaySocket, quickNotesApi } from '@/services/api';
import { useViewMode } from '@/components/layout/DualView/useViewMode';
import { useTableFilters, ColumnFilterConfig } from '@/hooks/useTableFilters';
import { statusOptions, priorityOptions } from '@/components/layout/DualView/taskConfig';
import type { Task, TaskOption, FilteredDocument, AllDocumentsResponse, TaskAttachment, QuickNote } from '@/types';

export type TabType = 'tasks' | 'add_documents';
export type ProjectMode = 'media' | 'documents';

const DATE_FIELD_OPTIONS = [
    { value: 'end_date' as const, label: 'Due Date' },
    { value: 'start_date' as const, label: 'Start Date' },
    { value: 'created_at' as const, label: 'Created At' },
];
const PERSON_FIELD_OPTIONS = [
    { value: 'assigned_to' as const, label: 'Assignee' },
    { value: 'created_by' as const, label: 'Created By' },
    { value: 'updated_by' as const, label: 'Updated By' },
];

export function useProjectDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // ─── Tab & View State ────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<TabType>('tasks');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const { viewMode: docViewMode, setViewMode: setDocViewMode } = useViewMode({
        defaultMode: 'table',
        storageKey: 'project-documents-view-mode',
    });

    // ─── Modal State ─────────────────────────────────────────────────────────────
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    // ── Bulk task selection (avatar-checkbox) ──────────────────────────────
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());

    const toggleTaskSelect = useCallback((taskId: number) => {
      setSelectedTaskIds(prev => {
        const next = new Set(prev);
        next.has(taskId) ? next.delete(taskId) : next.add(taskId);
        return next;
      });
    }, []);

    const toggleAllTasks = useCallback((visibleTasks: Task[]) => {
      setSelectedTaskIds(prev => {
        const allSelected = visibleTasks.every(t => prev.has(t.id));
        return allSelected ? new Set() : new Set(visibleTasks.map(t => t.id));
      });
    }, []);

    const handleBulkDeleteTasks = useCallback(async () => {
      const ids = [...selectedTaskIds];
      if (ids.length === 0) return;
      // Optimistic removal from all caches
      const removeIds = (list: Task[]) => list.filter(t => !ids.includes(t.id));
      queryClient.setQueryData(['tasks-list', id], (old: any) => {
        if (!old) return old;
        const list: Task[] = old.tasks ?? old.results ?? (Array.isArray(old) ? old : []);
        const filtered = removeIds(list);
        if (old.tasks) return { ...old, tasks: filtered };
        if (old.results) return { ...old, results: filtered };
        return filtered;
      });
      queryClient.getQueryCache().findAll({ queryKey: ['tasks'] }).forEach(query => {
        queryClient.setQueryData(query.queryKey, (old: any) => {
          if (!old?.pages) return old;
          return { ...old, pages: old.pages.map((page: any) => ({ ...page, results: removeIds(page.results) })) };
        });
      });
      setSelectedTaskIds(new Set());
      await Promise.all(ids.map(taskId =>
        taskApi.delete(taskId).catch(() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['tasks-list', id] });
        })
      ));
    }, [selectedTaskIds, queryClient, id]);
    const [isInlineCreating, setIsInlineCreating] = useState(false);
    const [showNotesPanel, setShowNotesPanel] = useState(false);

    // Quick Note Edit & Create State
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
    const [editNoteContent, setEditNoteContent] = useState<string>('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    const [isCreatingNote, setIsCreatingNote] = useState(false);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [isSavingNewNote, setIsSavingNewNote] = useState(false);

    // ─── Upload State ─────────────────────────────────────────────────────────────

    // ─── Upload State ─────────────────────────────────────────────────────────────
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Preview / Delete State 
    const [previewDocument, setPreviewDocument] = useState<{
        url: string;
        fileName: string;
        fileType?: string;
    } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [infoDoc, setInfoDoc] = useState<any | null>(null);
    const [shareDoc, setShareDoc] = useState<any | null>(null);

    // ─── Document Filter State 
    const [documentFilter, setDocumentFilter] = useState<'project' | 'task'>('project');
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [showTaskDropdown, setShowTaskDropdown] = useState(false);
    const taskDropdownRef = useRef<HTMLDivElement>(null);

    // ─── Date Filter State 
    const [dateField, setDateField] = useState<'end_date' | 'start_date' | 'created_at'>('end_date');
    const [personField, setPersonField] = useState<'assigned_to' | 'created_by' | 'updated_by'>('assigned_to');
    const [showPersonFieldDropdown, setShowPersonFieldDropdown] = useState(false);
    const personTriggerRef = useRef<HTMLButtonElement>(null);
    const [showDateFieldDropdown, setShowDateFieldDropdown] = useState(false);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
    const dateTriggerRef = useRef<HTMLButtonElement>(null);

    // ─── Media Pagination State ──────────────────────────────────────────────────
    const [mediaPage, setMediaPage] = useState(1);
    const [allMediaFiles, setAllMediaFiles] = useState<any[]>([]);
    const [hasMoreMedia, setHasMoreMedia] = useState(true);

    // ─── Queries ─────────────────────────────────────────────────────────────────
    const { data: project, isLoading: isProjectLoading } = useQuery({
        queryKey: ['project', id],
        queryFn: () => projectsApi.get(Number(id)),
        enabled: !!id,
        staleTime: Infinity,
        placeholderData: () => {
            const cache =
                (queryClient.getQueryData(['projects']) as any) ||
                (queryClient.getQueryData(['projects', '']) as any);
            const list = Array.isArray(cache) ? cache : cache?.results || [];
            return list.find((p: any) => p.id === Number(id));
        },
    });

    const { data: projectRoomsData } = useQuery({
        queryKey: ['project-chat-rooms'],
        queryFn: () => chatApi.getProjectRooms(),
        staleTime: 5 * 60 * 1000,
    });

    const { data: notesData, isLoading: notesLoading } = useQuery({
        queryKey: ['quickNotes', 'project', id],
        queryFn: () => quickNotesApi.getNotes({ project: Number(id) }),
        enabled: showNotesPanel && !!id,
    });

    // Explicitly filter to only show notes that are shared/attached to this specific project
    const projectNotes = (notesData?.results || []).filter(
        (note: QuickNote) => note.project === Number(id)
    );

    const { data: tasksData, isLoading: isLoadingTasks } = useQuery({
        queryKey: ['tasks-list', id],
        queryFn: () => taskApi.list({ project_id: Number(id), disable_pagination: true }),
        staleTime: 0,
        select: (data) => {
            if (Array.isArray(data)) return data;
            return data?.results || data?.tasks || [];
        },
    });
    const tasks = (tasksData || []) as Task[];

    const { data: usersData } = useQuery({
        queryKey: ['all-users'],
        queryFn: () => usersApi.listAll(),
        enabled: !!user,
    });

    const {
        data: documentsData,
        isFetching: isMediaFetching,
    } = useQuery({
        queryKey: ['documents', { project: id, page: mediaPage }],
        queryFn: () => documentsApi.list({ project: Number(id), page: mediaPage }),
        enabled: !!id && hasMoreMedia && activeTab !== 'add_documents',
        staleTime: 1000 * 60 * 5,
    });

    const { data: allDocumentsData, isLoading: isAllDocumentsLoading } = useQuery({
        queryKey: ['all-documents', id],
        queryFn: async (): Promise<AllDocumentsResponse> => documentsApi.getAllDocuments(Number(id)),
        enabled: activeTab === 'add_documents',
        staleTime: 0,
        refetchOnMount: true,
    });

    const { data: selectedTaskData, isLoading: isTaskAttachmentsLoading } = useQuery({
        queryKey: ['task-attachments', selectedTaskId],
        queryFn: () => taskApi.get(selectedTaskId!),
        enabled: activeTab === 'add_documents' && documentFilter === 'task' && !!selectedTaskId,
        staleTime: 0,
        refetchOnMount: true,
    });

    const { data: allTasksData, isLoading: isAllTasksLoading } = useQuery({
        queryKey: ['all-tasks-attachments', id],
        queryFn: () => taskApi.list({ project_id: Number(id), disable_pagination: true }),
        enabled: activeTab === 'add_documents' && documentFilter === 'task' && !selectedTaskId,
        staleTime: 0,
        refetchOnMount: true,
        select: (data) => {
            if (Array.isArray(data)) return data;
            return data?.results || data?.tasks || [];
        },
    });

    // ─── Derived Data ─────────────────────────────────────────────────────────────
    const allDocuments: FilteredDocument[] = allDocumentsData?.documents || [];

    const taskOptions: TaskOption[] = useMemo(() => {
        return tasks
            .map((task: Task) => ({ task_id: task.id, task_heading: task.heading }))
            .sort((a, b) => a.task_heading.localeCompare(b.task_heading));
    }, [tasks]);

    const selectedTaskName =
        taskOptions.find((t) => t.task_id === selectedTaskId)?.task_heading || 'Select Task';

    const filteredDocuments = useMemo(() => {
        if (documentFilter === 'project') {
            return allDocuments.filter((doc: FilteredDocument) => doc.source === 'Project');
        }
        if (documentFilter === 'task') {
            if (selectedTaskId) {
                const taskData = selectedTaskData?.task || selectedTaskData;
                const attachments: TaskAttachment[] = taskData?.attachments || [];
                return attachments.map((att: TaskAttachment) => ({
                    id: att.id,
                    file_name: att.file_name,
                    file_url: att.file_url,
                    uploaded_at: att.uploaded_at,
                    source: 'Task' as const,
                    task_id: selectedTaskId,
                    task_heading: selectedTaskName,
                }));
            }
            const allTasks = (allTasksData || []) as Task[];
            return allTasks.flatMap((task: Task) =>
                (task.attachments || []).map((att: TaskAttachment) => ({
                    id: att.id,
                    file_name: att.file_name,
                    file_url: att.file_url,
                    uploaded_at: att.uploaded_at,
                    source: 'Task' as const,
                    task_id: task.id,
                    task_heading: task.heading,
                })),
            );
        }
        return allDocuments;
    }, [allDocuments, documentFilter, selectedTaskId, selectedTaskData, selectedTaskName, allTasksData]);

    const isDocumentsLoading =
        isAllDocumentsLoading || isTaskAttachmentsLoading || isAllTasksLoading;

    const filteredTaskOptions = taskOptions.filter((option) =>
        option.task_heading.toLowerCase().includes(taskSearchQuery.toLowerCase()),
    );

    const activeDateLabel =
        DATE_FIELD_OPTIONS.find((o) => o.value === dateField)?.label ?? 'Due Date';

    const activePersonLabel = PERSON_FIELD_OPTIONS.find((o) => o.value === personField)?.label ?? 'Assignee';

    // ─── Table Filters ────────────────────────────────────────────────────────────
    const filterConfig: ColumnFilterConfig[] = [
        { key: 'project', type: 'search', searchFields: ['project_details', 'name'] },
        { key: 'heading', type: 'search' },
        { key: 'labels', type: 'search' },
        {
            key: 'status',
            type: 'list',
            listOptions: statusOptions.map((opt) => ({
                value: opt.value.toUpperCase(),
                label: opt.label,
            })),
        },
        {
            key: 'priority',
            type: 'list',
            listOptions: priorityOptions.map((opt) => ({ value: opt.value, label: opt.label })),
        },
        { key: dateField, type: 'date' },
    ];

    const {
        filteredData: filteredTasksFromHook,
        handleSort,
        columnFilters,
        setColumnFilters,
        clearFilter,
        activeFilterKey,
        setActiveFilterKey,
        filterContainerRef,
    } = useTableFilters<Task>({
        data: tasks,
        columns: filterConfig,
        globalSearchFields: ['heading', 'description'],
    });

    const filteredTasks = useMemo(() => {
        const assigneeFilterValue = columnFilters['assigned_to'];
        if (!assigneeFilterValue) return filteredTasksFromHook;
        if (assigneeFilterValue === '__empty__') {
            return filteredTasksFromHook.filter((task: Task) =>
                (task.assigned_to || []).length === 0,
            );
        }
        return filteredTasksFromHook.filter((task: Task) =>
            task.assigned_to.map(String).includes(String(assigneeFilterValue)),
        );
    }, [filteredTasksFromHook, columnFilters]);

    // ─── Effects
    useEffect(() => {
        if (!documentsData) return;
        const allResults = documentsData?.results || documentsData || [];
        const newMediaFiles = allResults.filter((file: any) => !file.metadata?.gt_category);
        setAllMediaFiles((prev) => (mediaPage === 1 ? newMediaFiles : [...prev, ...newMediaFiles]));
        if (documentsData?.next === null || allResults.length === 0) setHasMoreMedia(false);
    }, [documentsData, mediaPage]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (taskDropdownRef.current && !taskDropdownRef.current.contains(event.target as Node)) {
                setShowTaskDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!showDateFieldDropdown) return;
        const handler = () => {
            setShowDateFieldDropdown(false);
            setDropdownPos(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showDateFieldDropdown]);

    // Add this in your hook where you manage showPersonFieldDropdown state
useEffect(() => {
  if (!showPersonFieldDropdown) return;

  const handleClickOutside = (event: MouseEvent) => {
    // Don't close if clicking on the trigger button
    if (personTriggerRef.current?.contains(event.target as Node)) {
      return;
    }
    
    // Close dropdown
    setShowPersonFieldDropdown(false);
  };

  // Add listener after a small delay to avoid immediate closing
  const timeoutId = setTimeout(() => {
    document.addEventListener('mousedown', handleClickOutside);
  }, 0);

  return () => {
    clearTimeout(timeoutId);
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [showPersonFieldDropdown]);

    // Real-time task sync via WebSocket notification 
    useEffect(() => {
        if (!id) return;
        let debounceTimer: NodeJS.Timeout | null = null;
        const processedTaskIds = new Set<string>();

        const handleTaskNotification = async (taskId: number) => {
            const dedupeKey = `${taskId}-${Math.floor(Date.now() / 2000)}`;
            if (processedTaskIds.has(dedupeKey)) return;
            processedTaskIds.add(dedupeKey);

            try {
                const response = await taskApi.get(taskId);
                const fetchedTask = response.task || response;
                if (
                    String(fetchedTask.project) !== String(id) &&
                    fetchedTask.project_details?.id !== Number(id)
                ) return;
                queryClient.invalidateQueries({ queryKey: ['tasks-list', id] });
                queryClient.setQueryData(['tasks'], (old: any) => {
                    if (!old?.pages) return old;
                    const taskExistsInPages = old.pages.some((page: any) =>
                        page.results?.some((t: Task) => t.id === fetchedTask.id)
                    );
                    if (taskExistsInPages) {
                        return {
                            ...old,
                            pages: old.pages.map((page: any) => ({
                                ...page,
                                results: page.results.map((t: Task) =>
                                    t.id === fetchedTask.id ? fetchedTask : t
                                ),
                            })),
                        };
                    }
                    return {
                        ...old,
                        pages: [
                            { ...old.pages[0], results: [fetchedTask, ...(old.pages[0]?.results ?? [])] },
                            ...old.pages.slice(1),
                        ],
                    };
                });
            } catch (err) {
                console.error('Failed to fetch real-time task:', err);
            }
        };

        // Listen on notificationSocket
        const unsubNotification = notificationSocket.onNotification((data) => {
            if (data.related_object?.type !== 'task') return;
            const taskId = Number(data.related_object.id);
            if (taskId) handleTaskNotification(taskId);
        });

        // Listen on gatewaySocket
        const handleGatewayMessage = (msg: any) => {
            if (msg.type === 'SIGNAL' && msg.event === 'NEW_NOTIFICATION') {
                const related = msg.data?.related_object;
                if (related?.type !== 'task') return;
                const taskId = Number(related.id);
                if (taskId) handleTaskNotification(taskId);
            }
        };
        const unsubGateway = gatewaySocket.onMessage(handleGatewayMessage);

        return () => {
            unsubNotification();
            unsubGateway();
            if (debounceTimer) clearTimeout(debounceTimer);
            processedTaskIds.clear();
        };
    }, [id, queryClient]);
    // Handlers 
    const handleMediaScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const target = e.currentTarget;
            const pct = (target.scrollTop + target.clientHeight) / target.scrollHeight;
            if (pct > 0.8 && !isMediaFetching && hasMoreMedia) setMediaPage((p) => p + 1);
        },
        [isMediaFetching, hasMoreMedia],
    );

    const handleFilter = useCallback(
        (key: string) => {
            setShowDateFieldDropdown(false);
            setDropdownPos(null);
            setActiveFilterKey((prev) => (prev === key ? null : key));
        },
        [setActiveFilterKey],
    );

    const handleFilterChange = (filter: 'project' | 'task') => {
        setDocumentFilter(filter);
        if (filter === 'project') {
            setSelectedTaskId(null);
            setShowTaskDropdown(false);
        }
    };

    const handleTaskSelect = (taskId: number) => {
        setSelectedTaskId(taskId);
        setShowTaskDropdown(false);
        setTaskSearchQuery('');
    };

    const handleNavigateToChat = () => {
        const projectRoom = projectRoomsData?.find((room) => room.project === Number(id));
        if (projectRoom) {
            navigate(`/team-chat/${id}/${projectRoom.id}`);
        } else {
            navigate('/team-chat', { state: { projectId: Number(id) } });
        }
    };

    const handleTaskCreated = useCallback(
        (newTask?: Task) => {
            setIsCreateTaskModalOpen(false);
            if (newTask) {
                queryClient.setQueryData(['tasks'], (old: any) => {
                    if (!old?.pages) return old;
                    return {
                        ...old,
                        pages: [
                            { ...old.pages[0], results: [newTask, ...(old.pages[0]?.results ?? [])] },
                            ...old.pages.slice(1),
                        ],
                    };
                });
                queryClient.setQueryData(['tasks-list', id], (old: any) => {
                    if (!old) return old;
                    const list: Task[] = old.tasks ?? old.results ?? old ?? [];
                    const merged = [newTask, ...list.filter((t) => t.id !== newTask.id)];
                    if (old.tasks) return { ...old, tasks: merged };
                    if (old.results) return { ...old, results: merged };
                    return merged;
                });
            } else {
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
                queryClient.invalidateQueries({ queryKey: ['tasks-list', id] });
            }
        },
        [queryClient, id],
    );

    const handleTaskUpdated = useCallback(
        (updatedTask: any) => {
            queryClient.setQueryData(['tasks-list', id], (old: any) => {
                if (!old) return old;
                const list: Task[] = old.tasks ?? old.results ?? (Array.isArray(old) ? old : []);
                const merged = [updatedTask, ...list.filter((t) => t.id !== updatedTask.id)];
                if (old.tasks) return { ...old, tasks: merged };
                if (old.results) return { ...old, results: merged };
                return merged;
            });
            queryClient.setQueryData(['tasks'], (old: any) => {
                if (!old?.pages) return old;
                const pages = old.pages.map((page: any) => ({
                    ...page,
                    results: page.results.filter((t: Task) => t.id !== updatedTask.id),
                }));
                return {
                    ...old,
                    pages: [
                        { ...pages[0], results: [updatedTask, ...(pages[0]?.results ?? [])] },
                        ...pages.slice(1),
                    ],
                };
            });
            setSelectedTask(updatedTask);
        },
        [queryClient, id],
    );

    const handleDeleteTask = useCallback(
        async (taskId: number) => {
            queryClient.setQueryData(['tasks-list', id], (old: any) => {
                if (!old) return old;
                const list: Task[] = old.tasks ?? old.results ?? (Array.isArray(old) ? old : []);
                const filtered = list.filter((t) => t.id !== taskId);
                if (old.tasks) return { ...old, tasks: filtered };
                if (old.results) return { ...old, results: filtered };
                return filtered;
            });
            queryClient.setQueryData(['tasks'], (old: any) => {
                if (!old?.pages) return old;
                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        results: page.results.filter((t: Task) => t.id !== taskId),
                    })),
                };
            });
            setSelectedTask(null);
            try {
                await taskApi.delete(taskId);
            } catch {
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
                queryClient.invalidateQueries({ queryKey: ['tasks-list', id] });
            }
        },
        [queryClient, id],
    );

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !id) return;

        const MAX_FILE_SIZE = 500 * 1024 * 1024;
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > MAX_FILE_SIZE) {
                setUploadError(`File ${files[i].name} exceeds the 500 MB limit.`);
                return;
            }
        }

        try {
            setIsUploading(true);
            setUploadError(null);
            const projectIdNum = Number(id);
            const newUploadedDocs: any[] = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const uploadUrlResponse = await documentsApi.getUploadUrl(projectIdNum, {
                    file_name: file.name,
                    file_type: file.type || 'application/octet-stream',
                });
                const { url: s3Url, fields: s3Fields, file_key } = uploadUrlResponse;
                await documentsApi.uploadFileToS3(s3Url, s3Fields, file);

                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                let mappedType = 'other';
                if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) mappedType = 'image';
                else if (ext === 'pdf') mappedType = 'pdf';
                else if (ext === 'json') mappedType = 'json';
                else if (['doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'].includes(ext))
                    mappedType = 'document';
                else if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) mappedType = 'video';
                else if (['mp3', 'wav', 'ogg'].includes(ext)) mappedType = 'audio';
                else if (ext === 'zip' || ext === 'xml') mappedType = ext;

                const confirmResponse = await documentsApi.confirmUpload(projectIdNum, {
                    file_key,
                    file_name: file.name,
                    file_type: mappedType,
                });

                if (confirmResponse.id) {
                    await documentsApi.getDownloadUrl(projectIdNum, { document_id: confirmResponse.id });
                    if (user) {
                        newUploadedDocs.push({
                            id: confirmResponse.id,
                            created_by: {
                                id: user.id,
                                username: user.username,
                                full_name: `${user.first_name} ${user.last_name}`.trim() || user.username,
                            },
                            file_type: mappedType,
                            project_name: project?.name || 'General',
                        });
                    }
                }
            }

            if (newUploadedDocs.length > 0) {
                setAllMediaFiles((prev) => [...prev, ...newUploadedDocs]);
            }
            setMediaPage(1);
            setHasMoreMedia(true);
            queryClient.invalidateQueries({ queryKey: ['all-documents', id] });
            queryClient.invalidateQueries({ queryKey: ['documents', { project: id }] });
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err: any) {
            setUploadError(err.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isUploading) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target) setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (isUploading) return;
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            await handleFileUpload({ target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>);
        }
    };

    // In-memory URL cache: docId → { url, expiresAt }
    const downloadUrlCacheRef = useRef<Map<string, { url: string; expiresAt: number }>>(new Map());
    const DOWNLOAD_URL_TTL_MS = 4 * 60 * 1000;

    const handleDocumentClick = async (doc: FilteredDocument) => {
        if (!doc.id) {
            alert('Document URL not available.');
            return;
        }

        const docId = String(doc.id);
        const cached = downloadUrlCacheRef.current.get(docId);
        const now = Date.now();

        // Serve from cache if still valid — no API call needed
        if (cached && cached.expiresAt > now) {
            setPreviewDocument({
                url: cached.url,
                fileName: doc.file_name || 'Document',
                fileType: doc.file_name?.split('.').pop() || '',
            });
            return;
        }

        // Fetch fresh URL and cache it
        try {
            const { url } = await documentsApi.getDownloadUrl(Number(id), {
                document_id: docId,
            });
            downloadUrlCacheRef.current.set(docId, { url, expiresAt: now + DOWNLOAD_URL_TTL_MS });
            setPreviewDocument({
                url,
                fileName: doc.file_name || 'Document',
                fileType: doc.file_name?.split('.').pop() || '',
            });
        } catch {
            if (doc.file_url) {
                setPreviewDocument({
                    url: doc.file_url,
                    fileName: doc.file_name || 'Document',
                    fileType: doc.file_name?.split('.').pop() || '',
                });
            } else {
                alert('Could not load document preview. Please try again.');
            }
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, doc: any) => {
        e.stopPropagation();
        setDeleteConfirm({ id: String(doc.id), name: doc.name || doc.file_name || 'Document' });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirm) return;
        try {
            setIsDeleting(true);
            if (documentFilter === 'task') {
                await taskApi.deleteAttachment(deleteConfirm.id);
            } else {
                await documentsApi.delete(deleteConfirm.id);
            }
            setDeleteConfirm(null);
            if (documentFilter === 'project') {
                queryClient.invalidateQueries({ queryKey: ['all-documents', id] });
            } else if (selectedTaskId) {
                queryClient.invalidateQueries({ queryKey: ['task-attachments', selectedTaskId] });
            } else {
                queryClient.invalidateQueries({ queryKey: ['all-tasks-attachments', id] });
            }
        } catch (error) {
            console.error('Delete failed:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const openDateFieldDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (dateTriggerRef.current) {
            const rect = dateTriggerRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
        }
        setShowDateFieldDropdown((v) => !v);
    };

    const selectDateField = (value: 'end_date' | 'start_date' | 'created_at') => {
        setDateField(value);
        setShowDateFieldDropdown(false);
        setDropdownPos(null);
        clearFilter(dateField);
        setActiveFilterKey(null);
    };

    const handleEditNoteStart = (note: QuickNote) => {
        setEditingNoteId(note.id);
        setEditNoteContent(note.content);
    };

    const handleEditNoteCancel = () => {
        setEditingNoteId(null);
        setEditNoteContent('');
    };

    const handleEditNoteSave = async () => {
        if (!editingNoteId) return;
        try {
            setIsSavingNote(true);
            await quickNotesApi.updateNote(editingNoteId, { content: editNoteContent });
            queryClient.invalidateQueries({ queryKey: ['quickNotes', 'project', id] });
            setEditingNoteId(null);
            setEditNoteContent('');
        } catch (error) {
            console.error('Failed to update note:', error);
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleCreateNoteStart = () => {
        setIsCreatingNote(true);
        setNewNoteContent('');
    };

    const handleCreateNoteCancel = () => {
        setIsCreatingNote(false);
        setNewNoteContent('');
    };

    const handleCreateNoteSave = async () => {
        if (!newNoteContent.trim() || !id) return;
        try {
            setIsSavingNewNote(true);
            // This associates the newly created note specifically with the active project
            await quickNotesApi.createNote({ content: newNoteContent, project: Number(id) });
            queryClient.invalidateQueries({ queryKey: ['quickNotes', 'project', id] });
            setIsCreatingNote(false);
            setNewNoteContent('');
        } catch (error) {
            console.error('Failed to create note:', error);
        } finally {
            setIsSavingNewNote(false);
        }
    };

    const handleDeleteNote = async (noteId: number) => {
        try {
            // Instantly delete without the browser confirmation popup
            await quickNotesApi.deleteNote(noteId);
            queryClient.invalidateQueries({ queryKey: ['quickNotes', 'project', id] });
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    };
    return {
        // IDs & navigation
        id,
        navigate,
        user,
        queryClient,

        // Data
        project,
        tasks,
        usersData,
        allMediaFiles,
        filteredDocuments,
        filteredTasks,
        filteredTaskOptions,
        taskOptions,
        selectedTaskName,
        DATE_FIELD_OPTIONS,
        activeDateLabel,

        // Loading states
        isProjectLoading,
        isLoadingTasks,
        isDocumentsLoading,
        isAllDocumentsLoading,

        // Tab & view
        activeTab,
        setActiveTab,
        viewMode,
        setViewMode,
        docViewMode,
        setDocViewMode,

        // Modals
        isCreateTaskModalOpen,
        setIsCreateTaskModalOpen,
        isInlineCreating,
        setIsInlineCreating,
        selectedTask,
        setSelectedTask,
        showNotesPanel,
        setShowNotesPanel,
        projectNotes,
        notesLoading,
        editingNoteId,
        editNoteContent,
        setEditNoteContent,
        isSavingNote,
        handleEditNoteStart,
        handleEditNoteCancel,
        handleEditNoteSave,
        isCreatingNote,
        newNoteContent,
        setNewNoteContent,
        isSavingNewNote,
        handleCreateNoteStart,
        handleCreateNoteCancel,
        handleCreateNoteSave,
        handleDeleteNote,
        previewDocument,
        setPreviewDocument,
        deleteConfirm,
        setDeleteConfirm,
        isDeleting,

        // Document info & share
        infoDoc,
        setInfoDoc,
        shareDoc,
        setShareDoc,

        // Upload
        isUploading,
        uploadError,
        isDragging,
        fileInputRef,

        // Document filter
        documentFilter,
        selectedTaskId,
        taskSearchQuery,
        setTaskSearchQuery,
        showTaskDropdown,
        setShowTaskDropdown,
        taskDropdownRef,

        // Date filter
        dateField,
        dateTriggerRef,
        showDateFieldDropdown,
        dropdownPos,
        setDropdownPos,

        // Person filter
        personField,
        setPersonField,
        personTriggerRef,
        showPersonFieldDropdown,
        setShowPersonFieldDropdown,
        activePersonLabel,
        PERSON_FIELD_OPTIONS,

        // Table filter
        columnFilters,
        setColumnFilters,
        clearFilter,
        activeFilterKey,
        setActiveFilterKey,
        filterContainerRef,
        handleSort,

        // Handlers
        handleMediaScroll,
        handleFilter,
        handleFilterChange,
        handleTaskSelect,
        handleNavigateToChat,
        handleTaskCreated,
        handleTaskUpdated,
        handleDeleteTask,
        selectedTaskIds, toggleTaskSelect, toggleAllTasks, handleBulkDeleteTasks,
        handleFileUpload,
        handleDragEnter,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        handleDocumentClick,
        handleDeleteClick,
        handleDeleteConfirm,
        openDateFieldDropdown,
        selectDateField,
    };
}