import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
    ArrowLeft, Plus, Upload, Search, Film, Loader2, FileText, FileJson, Settings,
    List, Grid3X3, MessageCircle
} from 'lucide-react';
import { projectsApi, taskApi, documentsApi } from '@/services/api';
import type { Task } from '@/types'
import { CreateTask } from '@/pages/MyTask/CreateTask';
import { DualView } from '@/components/layout/DualView/DualView';
import { TaskGridCard, createTasksTableColumns } from '@/components/layout/DualView/taskConfig';
import { DocumentPreview, useDocumentPreviewKeyboard } from '@/components/common/DocumentPreview';
import { TaskDetailModal } from '../MyTask/TaskDetailModal';
import { useTableFilters, ColumnFilterConfig } from '@/hooks/useTableFilters';
import { SearchFilter, ListFilter, DateFilter, FilterHeaderWrapper } from '@/components/layout/DualView/FilterComponents';
import { getStatusConfig, priorityOptions, statusOptions } from '@/components/layout/DualView/taskConfig';
// Lazy-load the PDF viewer — react-pdf + pdfjs-dist is ~2 MB.
// It is only needed when a file thumbnail is of type "pdf".
// The pdfjs worker is configured here (not in main.tsx) so it is only
// initialised when this lazy chunk is actually downloaded, keeping the
// app startup bundle free of any PDF-related code.
const LazyPDFThumbnail = React.lazy(() =>
  import('react-pdf').then(({ Document, Page, pdfjs }) => {
    // Configure the local bundled worker — avoids an external CDN round-trip.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    return {
      default: ({ url }: { url: string }) => (
        <Document file={url} loading="">
          <Page
            pageNumber={1}
            width={250}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      ),
    };
  })
);
import './ContentCreation.scss';


type TabType = 'tasks' | 'calendar' | 'media';
type MediaTag = 'final' | 'draft' | 'rawFootage' | 'approved' | 'wip' | 'reference';

export function MediaPreviewModal({
    doc,
    projectId,
    onClose
}: {
    doc: any;
    projectId: number;
    onClose: () => void;
}) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchUrl = async () => {
            try {
                const response = await documentsApi.getDownloadUrl(projectId, {
                    document_id: doc.id
                });
                if (response?.url) {
                    setPreviewUrl(response.url);
                }
            } catch (error) {
                console.error('Failed to fetch download URL:', error);
                onClose();
            }
        };
        fetchUrl();
    }, [doc.id, projectId, onClose]);

    if (!previewUrl) {
        return (
            <div className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
            </div>
        );
    }

    return (
        <DocumentPreview
            url={previewUrl}
            fileName={doc.original_file_name || doc.name}
            fileType={doc.file_type}
            onClose={onClose}
        />
    );
}

export function MediaThumbnail({ file, projectId }: { file: any; projectId: number }) {
    const { data: downloadUrl, isLoading } = useQuery({
        queryKey: ['document-download-url', projectId, file.id],
        queryFn: () => documentsApi.getDownloadUrl(projectId, { document_id: file.id }).then(res => res.url),
        staleTime: 60 * 1000,
    });

    if (isLoading) {
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }

    if (!downloadUrl) {
        return <Film className="h-8 w-8 text-muted-foreground" />;
    }

    switch (file.file_type) {
        case 'image':
            return (
                <img
                    src={downloadUrl}
                    alt="Preview"
                    className="w-full h-full object-cover rounded"
                />
            );
        case 'video':
            return (
                <video className="w-full h-full object-cover rounded" preload="metadata">
                    <source src={`${downloadUrl}#t=0.5`} />
                </video>
            );
        case 'pdf':
            return (
                <div className="w-full h-full flex items-start justify-center overflow-hidden">
                    <div className="scale-[0.4] origin-top mt-1">
                        <React.Suspense fallback={<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}>
                            <LazyPDFThumbnail url={downloadUrl} />
                        </React.Suspense>
                    </div>
                </div>
            );
        case 'json':
            return <FileJson className="h-8 w-8 text-yellow-600" />;
        default:
            return <FileText className="h-8 w-8 text-muted-foreground" />;
    }
}

export function ContentCreation() {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('tasks');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
    const navigate = useNavigate();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewDocument, setPreviewDocument] = useState<{
        url: string;
        fileName: string;
        fileType?: string;
    } | null>(null);
    const { data: tasksData, isLoading: isTasksLoading } = useQuery({
        queryKey: ['tasks'],
        queryFn: () => taskApi.list(),
        select: (data) => {
            const allTasks = data.tasks || data.results || [];
            return allTasks.filter((t: any) => String(t.project) === id);
        },
    });

    const tasks = tasksData || [];

    // Filter configuration for task columns
    const filterConfig: ColumnFilterConfig[] = [
        { key: 'project', type: 'search', searchFields: ['project_details', 'name'] },
        { key: 'heading', type: 'search' },
        { key: 'labels', type: 'search' },
        {
            key: 'status',
            type: 'list',
            listOptions: statusOptions.map(opt => ({
                value: opt.value.toUpperCase(),
                label: opt.label
            }))
        },
        {
            key: 'priority',
            type: 'list',
            listOptions: priorityOptions.map(opt => ({
                value: opt.value,
                label: opt.label
            }))
        },
        { key: 'end_date', type: 'date' },
    ];

    // Initialize filter hook
    const {
        filteredData: filteredTasks,
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

    // Handle filter toggle
    const handleFilter = useCallback((key: string) => {
        setActiveFilterKey(prev => prev === key ? null : key);
    }, [setActiveFilterKey]);

    const { data: project, isLoading: isProjectLoading } = useQuery({
        queryKey: ['project', id],
        queryFn: () => projectsApi.get(Number(id)),
        enabled: !!id,
        staleTime: Infinity,
        placeholderData: () => {
            const cache = queryClient.getQueryData(['projects']) as any || queryClient.getQueryData(['projects', '']) as any;
            const list = Array.isArray(cache) ? cache : (cache?.results || []);
            return list.find((p: any) => p.id === Number(id));
        }
    });

    const [mediaPage, setMediaPage] = useState(1);
    const [allMediaFiles, setAllMediaFiles] = useState<any[]>([]);
    const [hasMoreMedia, setHasMoreMedia] = useState(true);
    const mediaScrollRef = useRef<HTMLDivElement>(null);

    const { data: documentsData, isLoading: isMediaLoading, isFetching: isMediaFetching } = useQuery({
        queryKey: ['documents', { project: id, page: mediaPage }],
        queryFn: () => documentsApi.list({ project: (Number(id)), page: mediaPage }),
        enabled: !!id && hasMoreMedia,
        staleTime: 1000 * 60 * 5,
    });

    // Update media files when new data arrives
    useEffect(() => {
        if (documentsData) {
            const newFiles = documentsData?.results || documentsData || [];

            if (mediaPage === 1) {
                setAllMediaFiles(newFiles);
            } else {
                setAllMediaFiles(prev => [...prev, ...newFiles]);
            }

            // Check if there are more pages
            if (documentsData?.next === null || newFiles.length === 0) {
                setHasMoreMedia(false);
            }
        }
    }, [documentsData, mediaPage]);

    // Infinite scroll handler for media
    const handleMediaScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;

        if (scrollPercentage > 0.8 && !isMediaFetching && hasMoreMedia) {
            setMediaPage(prev => prev + 1);
        }
    }, [isMediaFetching, hasMoreMedia]);

    const mediaFiles = allMediaFiles;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !id) return;

        const MAX_FILE_SIZE = 500 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            setUploadError('File size exceeds the 500 MB limit.');
            return;
        }

        try {
            setIsUploading(true);
            setUploadError(null);

            // Step 1: Get Upload URL
            const projectIdNum = Number(id);

            const uploadUrlResponse = await documentsApi.getUploadUrl(projectIdNum, {
                file_name: file.name,
                file_type: file.type || 'application/octet-stream',
            });

            const { url: s3Url, fields: s3Fields, file_key } = uploadUrlResponse;

            // Step 2: Direct S3 Upload
            await documentsApi.uploadFileToS3(s3Url, s3Fields, file);

            // Step 3: Confirm Upload
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const imageTypes = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
            const docTypes = ['doc', 'docx', 'pdf', 'txt', 'rtf'];
            const spreadsheetTypes = ['xls', 'xlsx', 'csv'];
            const presentationTypes = ['ppt', 'pptx'];

            let mappedType = 'other';
            if (imageTypes.includes(ext)) mappedType = 'image';
            else if (ext === 'pdf') mappedType = 'pdf';
            else if (ext === 'json') mappedType = 'json';
            else if (docTypes.includes(ext) || spreadsheetTypes.includes(ext) || presentationTypes.includes(ext)) mappedType = 'document';
            else if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) mappedType = 'video';
            else if (['mp3', 'wav', 'ogg'].includes(ext)) mappedType = 'audio';
            else if (ext === 'zip' || ext === 'xml') mappedType = ext;

            const confirmResponse = await documentsApi.confirmUpload(projectIdNum, {
                file_key: file_key,
                file_name: file.name,
                file_type: mappedType,
            });

            // Step 4: Call Get Download URL
            if (confirmResponse.id) {
                await documentsApi.getDownloadUrl(projectIdNum, { document_id: confirmResponse.id });
            }

            // Reset pagination state to show new document immediately
            setMediaPage(1);
            setHasMoreMedia(true);
            setAllMediaFiles([]);

            // Refresh the media list
            queryClient.invalidateQueries({ queryKey: ['documents', { project: id }] });
            await queryClient.refetchQueries({
                queryKey: ['documents'],
                type: 'active'
            });

            // Reset file input to close system dialog
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err: any) {
            setUploadError(err.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    // Drag and drop handlers
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isUploading) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set to false if leaving the drop zone entirely
        if (e.currentTarget === e.target) {
            setIsDragging(false);
        }
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
            // Create proper FileList-like object
            const syntheticEvent = {
                target: { files: files }
            } as unknown as React.ChangeEvent<HTMLInputElement>;

            await handleFileUpload(syntheticEvent);
        }
    };

    const handleTaskCreated = () => {
        setIsCreateTaskModalOpen(false);
        // This triggers the global refetch same as Taskboard
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
    };

    // Handle document preview
    const handleDocumentPreview = async (doc: any) => {
        try {
            const projectIdNum = Number(id);
            const downloadResponse = await documentsApi.getDownloadUrl(projectIdNum, {
                document_id: doc.id
            });

            if (downloadResponse?.url) {
                setPreviewDocument({
                    url: downloadResponse.url,
                    fileName: doc.original_file_name || doc.name,
                    fileType: doc.file_type
                });
            }
        } catch (error) {
            console.error('Failed to open document:', error);
            alert('Failed to open document. Please try again.');
        }
    };

    // Enable keyboard shortcuts for document preview
    useDocumentPreviewKeyboard(() => setPreviewDocument(null));

    const handleTaskUpdated = (updatedTask: any) => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        setSelectedTask(updatedTask);
    };

    const handleDeleteTask = async (taskId: number) => {
        try {
            await taskApi.delete(taskId);
            // Use invalidation instead of local filter to ensure persistence
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            setSelectedTask(null);
        } catch (error) {
            console.error("Failed to delete task:", error);
        }
    };

    if (isProjectLoading) {
        return (
            <div className="content-creation-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="content-creation-error">
                <h2>Project not found</h2>
                <Link to="/projects">Back to projects</Link>
            </div>
        );
    }

    return (
        <div className="content-creation">
            <div className="content-creation__main">
                <div className="content-creation__header">
                    <div className="content-creation__header-top">
                        <Link to="/projects" className="content-creation__back-button">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="content-creation__title-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <div>
                                <h1 className="content-creation__title">{project.name}</h1>
                            </div>
                            <p className="content-creation__subtitle">Content Creation Dashboard</p>
                        </div>
                    </div>

                    <div className="content-creation__tabs">
                        {(['tasks', 'calendar', 'media'] as TabType[]).map((tab) => (
                            <button
                                key={tab}
                                className={`content-creation__tab ${activeTab === tab ? 'content-creation__tab--active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}

                        <button
                            className="content-creation__tab content-creation__tab--create-task"
                            onClick={() => setIsCreateTaskModalOpen(true)}
                        >
                            <Plus className="h-4 w-4" />
                            Create Task
                        </button>

                        <button
                            onClick={() => navigate('/team-chat', { state: { projectId: Number(id) } })}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2 text-gray-600 hover:text-black"
                            title="Team Chat"
                        >
                            <MessageCircle className="h-4 w-4" />
                        </button>

                        <button
                            onClick={() => navigate(`/projects/${id}/settings`)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2 text-gray-600 hover:text-black"
                            title="Project Settings"
                        >
                            <Settings className="h-5 w-5" />
                            <span className="text-sm font-medium"></span>
                        </button>
                    </div>
                </div>

                <div className="content-creation__content">
                    {activeTab === 'tasks' && (
                        <div className="content-creation__tasks">
                            {/* View Toggle Controls */}
                            <div className="flex justify-end mb-2">
                                <div className="flex items-center border border-gray-200 rounded-md bg-white p-1 gap-1">
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                        title="List View"
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                        title="Grid View"
                                    >
                                        <Grid3X3 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {isTasksLoading ? (
                                <div className="flex justify-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
                                </div>
                            ) : tasks.length > 0 ? (
                                <>
                                    {viewMode === 'list' ? (
                                        <div className="bg-white rounded-lg shadow-sm">
                                            <DualView
                                                viewMode="table"
                                                gridProps={{
                                                    data: filteredTasks,
                                                    renderCard: (task: any) => <TaskGridCard task={task} onTaskClick={(t) => setSelectedTask(t as unknown as Task)} />,
                                                }}
                                                tableProps={{
                                                    data: filteredTasks,
                                                    activeFilterKey: activeFilterKey,
                                                    columns: createTasksTableColumns({
                                                        onTaskClick: (t) => setSelectedTask(t as unknown as Task),
                                                        queryClient,
                                                        user,
                                                        navigate
                                                    }).map(col => ({
                                                        ...col,
                                                        headerClassName: `relative ${activeFilterKey === col.key ? 'z-[100]' : ''}`,
                                                        label: (
                                                            <div ref={activeFilterKey === col.key ? filterContainerRef : null}>
                                                                <FilterHeaderWrapper
                                                                    columnLabel={col.label as string}
                                                                    filterType={
                                                                        ['project', 'heading', 'labels'].includes(col.key) ? 'search' :
                                                                            ['status', 'priority'].includes(col.key) ? 'list' :
                                                                                col.key === 'end_date' ? 'date' : 'none'
                                                                    }
                                                                    isActive={activeFilterKey === col.key}
                                                                    filterContent={
                                                                        <>
                                                                            {col.key === 'status' && (
                                                                                <ListFilter
                                                                                    columnKey="status"
                                                                                    options={statusOptions.map(status => ({
                                                                                        value: status.value.toUpperCase(),
                                                                                        label: status.label,
                                                                                        icon: React.createElement(getStatusConfig(status.value.toUpperCase() as any).icon, { className: "w-3.5 h-3.5" }),
                                                                                        className: getStatusConfig(status.value.toUpperCase() as any).text,
                                                                                    }))}
                                                                                    selectedValue={columnFilters.status || ''}
                                                                                    onSelect={(value) => {
                                                                                        setColumnFilters(prev => ({ ...prev, status: value }));
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    onClear={() => {
                                                                                        clearFilter('status');
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    isActive={activeFilterKey === 'status'}
                                                                                    containerRef={filterContainerRef}
                                                                                />
                                                                            )}
                                                                            {col.key === 'priority' && (
                                                                                <ListFilter
                                                                                    columnKey="priority"
                                                                                    options={priorityOptions.map(opt => ({
                                                                                        value: opt.value,
                                                                                        label: opt.label,
                                                                                        icon: <span>{opt.icon}</span>
                                                                                    }))}
                                                                                    selectedValue={columnFilters.priority || ''}
                                                                                    onSelect={(value) => {
                                                                                        setColumnFilters(prev => ({ ...prev, priority: value }));
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    onClear={() => {
                                                                                        clearFilter('priority');
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    isActive={activeFilterKey === 'priority'}
                                                                                    containerRef={filterContainerRef}
                                                                                />
                                                                            )}
                                                                            {col.key === 'end_date' && (
                                                                                <DateFilter
                                                                                    columnKey="end_date"
                                                                                    value={columnFilters.end_date || ''}
                                                                                    onChange={(value) => {
                                                                                        setColumnFilters(prev => ({ ...prev, end_date: value }));
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    onClear={() => {
                                                                                        clearFilter('end_date');
                                                                                        setActiveFilterKey(null);
                                                                                    }}
                                                                                    isActive={activeFilterKey === 'end_date'}
                                                                                    containerRef={filterContainerRef}
                                                                                />
                                                                            )}
                                                                        </>
                                                                    }
                                                                >
                                                                    {['project', 'heading', 'labels'].includes(col.key) && (
                                                                        <SearchFilter
                                                                            columnKey={col.key}
                                                                            placeholder={`Search...`}
                                                                            value={columnFilters[col.key] || ''}
                                                                            onChange={(value) => setColumnFilters(prev => ({ ...prev, [col.key]: value }))}
                                                                            isActive={activeFilterKey === col.key}
                                                                        />
                                                                    )}
                                                                </FilterHeaderWrapper>
                                                            </div>
                                                        )
                                                    })),
                                                    rowKey: (task: any) => task.id,
                                                    onRowClick: (t) => setSelectedTask(t as unknown as Task),
                                                    onSort: handleSort,
                                                    onFilter: handleFilter,
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {tasks.map((task: Task) => (
                                                <TaskGridCard
                                                    key={task.id}
                                                    task={task as any}
                                                    onTaskClick={(t) => setSelectedTask(t as unknown as Task)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="content-creation__tasks-empty">
                                    <div className="content-creation__empty-icon">📋</div>
                                    <h3>No tasks yet</h3>
                                    <p>Create your first content task to get started</p>
                                    <button
                                        className="content-creation__btn-primary"
                                        onClick={() => setIsCreateTaskModalOpen(true)}
                                    >
                                        <Plus className="h-4 w-4" />
                                        New Task
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'calendar' && (
                        <div className="content-creation__calendar">
                            <div className="content-creation__calendar-empty">
                                <div className="content-creation__empty-icon">📅</div>
                                <h3>Calendar View</h3>
                                <p>Schedule and manage your content creation timeline</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'media' && (
                        <div
                            className="content-creation__media"
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            <div className="content-creation__search-bar">
                                <Search className="content-creation__search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search files..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="content-creation__search-input"
                                />
                            </div>

                            <div className="content-creation__upload-area">
                                <label className={`content-creation__upload-box ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isDragging ? 'border-primary bg-primary/5 border-2' : ''}`}>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                        accept="*"
                                    />
                                    {isUploading ? (
                                        <Loader2 className="content-creation__upload-icon animate-spin" />
                                    ) : (
                                        <Upload className={`content-creation__upload-icon ${isDragging ? 'text-primary' : ''}`} />
                                    )}
                                    <p className="content-creation__upload-text">
                                        {isUploading ? 'Uploading to S3...' : isDragging ? 'Drop file here' : 'Drop files here or click to browse'}
                                    </p>
                                    <p className="content-creation__upload-subtext">Videos, images, audio, PDFs (Max 500MB)</p>
                                    {uploadError && <p className="text-destructive text-sm mt-2">{uploadError}</p>}
                                </label>
                            </div>

                            {isMediaLoading && mediaPage === 1 ? (
                                <div className="flex justify-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
                                </div>
                            ) : mediaFiles.length > 0 ? (
                                <div
                                    className="max-h-[600px] overflow-y-auto"
                                    onScroll={handleMediaScroll}
                                    ref={mediaScrollRef}
                                >
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6 px-2">
                                        {mediaFiles.map((file: any) => (
                                            <div
                                                key={file.id}
                                                className="border rounded-lg p-2 bg-white text-center cursor-pointer hover:shadow-md transition-shadow"
                                                onClick={() => handleDocumentPreview(file)}
                                            >
                                                <div className="aspect-square bg-muted rounded flex items-center justify-center mb-2 overflow-hidden border relative">
                                                    <MediaThumbnail file={file} projectId={Number(id)} />
                                                </div>
                                                <p className="text-xs font-medium truncate">{file.original_file_name || file.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {isMediaFetching && mediaPage > 1 && (
                                        <div className="flex justify-center py-4">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                                        </div>
                                    )}
                                    {!hasMoreMedia && mediaFiles.length > 20 && (
                                        <div className="text-center py-4 text-muted-foreground text-sm">
                                            All media loaded
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="content-creation__media-empty">
                                    <Film className="content-creation__empty-media-icon" />
                                    <p className="content-creation__empty-text">No media files yet</p>
                                </div>
                            )}
                            {/* Full-page drag overlay */}
                            {isDragging && (
                                <div className="fixed inset-0 bg-primary/10 border-4 border-dashed border-primary pointer-events-none z-50 flex items-center justify-center">
                                    <div className="bg-white p-8 rounded-lg shadow-lg">
                                        <Upload className="h-16 w-16 text-primary mx-auto mb-4" />
                                        <p className="text-xl font-semibold text-primary">Drop file anywhere to upload</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal for PDF/Image/Video Preview */}
            {selectedMedia && (
                <MediaPreviewModal
                    doc={selectedMedia}
                    projectId={Number(id)}
                    onClose={() => setSelectedMedia(null)}
                />
            )}

            {isCreateTaskModalOpen && (
                <div className="content-creation__modal-overlay">
                    <div className="content-creation__modal-container bg-gray-50 p-6">
                        <CreateTask
                            onClose={() => setIsCreateTaskModalOpen(false)}
                            onSuccess={handleTaskCreated}
                            isModal={true}
                            fixedProjectId={Number(id)}
                        />
                    </div>
                </div>
            )}

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask as any}
                    onClose={() => setSelectedTask(null)}
                    onDelete={handleDeleteTask}
                    onTaskUpdated={handleTaskUpdated}
                />
            )}
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
}