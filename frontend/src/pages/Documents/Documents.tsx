import React from 'react';
import { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams, useNavigate, useOutletContext } from 'react-router-dom';
import { FileText, Search, Filter, ChevronDown, Bell, ChevronLeft, ChevronRight, Info, X, Calendar, User, HardDrive, Tag, Hash } from 'lucide-react';
import { Button, Card, CardContent, Input } from '@/components/common';
import { documentsApi, projectsApi } from '@/services/api';
import type { Document, Project } from '@/types';
import { ViewToggle, DualView, useViewMode, } from '@/components/layout/DualView';
import { createDocumentsTableColumns, DocumentGridCard } from '@/components/layout/DualView/documentsConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationsPage } from '../NotificationsPage';
import { DocumentPreview } from '@/components/common/DocumentPreview';
import { DocumentShareModal } from '@/pages/Documents/DocumentShareModal';

const FILE_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
];

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}

function DocumentInfoPanel({ doc, onClose }: { doc: Document | null; onClose: () => void }) {
  if (!doc) return null;

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    in_review: 'bg-blue-50 text-blue-700 border border-blue-200',
    approved: 'bg-green-50 text-green-700 border border-green-200',
    archived: 'bg-gray-100 text-gray-700 border border-gray-200',
  };

  const rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    {
      icon: <FileText className="w-4 h-4 text-blue-500" />,
      label: 'File Name',
      value: <span className="text-gray-600 font-semibold break-all">{doc.original_file_name || doc.name}</span>,
    },
    {
      icon: <User className="w-4 h-4 text-blue-500" />,
      label: 'Uploaded By',
      value: doc.created_by?.full_name || 'System',
    },
    {
      icon: <Calendar className="w-4 h-4 text-rose-500" />,
      label: 'Created At',
      value: formatDate(doc.created_at),
    },
    {
      icon: <Calendar className="w-4 h-4 text-amber-500" />,
      label: 'Updated At',
      value: formatDate(doc.updated_at),
    },
  ];

  if (doc.description) {
    rows.splice(1, 0, {
      icon: <FileText className="w-4 h-4 text-gray-400" />,
      label: 'Description',
      value: <span className="text-gray-600 break-words">{doc.description}</span>,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      <div className="pointer-events-auto w-[340px] h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-800">Document Info</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Metadata Rows */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
              <div className="mt-0.5 flex-shrink-0">{row.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{row.label}</div>
                <div className="text-[12px] text-gray-700">{row.value}</div>
              </div>
            </div>
          ))}

          {/* Labels */}
          {doc.labels && doc.labels.length > 0 && (
            <div className="flex items-start gap-3 py-1.5">
              <Tag className="w-3.5 h-3.5 text-pink-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Labels</div>
                <div className="flex flex-wrap gap-1">
                  {doc.labels.map((label) => (
                    <span
                      key={label.id}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                      style={{ backgroundColor: label.color }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      <Card className="relative w-full max-w-[400px] shadow-2xl border-destructive/20 animate-in fade-in zoom-in duration-300">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-destructive/10 rounded-full">
              <FileText className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight">
                Confirm Deletion
              </h3>
              <p className="text-sm text-muted-foreground px-2">{title}</p>
            </div>
            <div className="flex w-full gap-4 pt-4">
              <Button
                variant="destructive"
                className="flex-1 font-semibold shadow-sm hover:shadow-destructive/20"
                onClick={onConfirm}
              >
                Yes
              </Button>
              <Button
                variant="outline"
                className="flex-1 font-semibold hover:bg-accent"
                onClick={onClose}
              >
                No
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function Documents() {
  const queryClient = useQueryClient();
  const { unreadCount } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    fileName: string;
    fileType: string;
  } | null>(null);
  const navigate = useNavigate();
  const [infoDoc, setInfoDoc] = useState<Document | null>(null);
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const { viewMode, setViewMode } = useViewMode({
    defaultMode: 'table',
  });

  const projectFilter = searchParams.get('project') || '';
  const statusFilter = searchParams.get('status') || '';
  const fileTypeFilter = searchParams.get('file_type') || '';

  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at'>('updated_at');

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [projectFilter, fileTypeFilter, searchTerm]);

  React.useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  }, []);

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  const { data: allDocumentsData, isLoading } = useQuery({
    queryKey: ['documents', 'all', projectFilter, fileTypeFilter, currentPage],
    queryFn: () =>
      documentsApi.list({
        project: projectFilter ? Number(projectFilter) : undefined,
        file_type: fileTypeFilter || undefined,
        page: currentPage,
      }),
    enabled: true,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
  });
  const rawProjects = projectsData?.results || projectsData || [];
  const projects = (Array.isArray(rawProjects) ? rawProjects : []) as Project[];

  const allDocs = allDocumentsData?.results || allDocumentsData || [];
  const totalCount = (allDocumentsData as any)?.count || 0;
  const hasNextPage = !!(allDocumentsData as any)?.next;
  const hasPreviousPage = !!(allDocumentsData as any)?.previous;
  const projectLookup = projects.reduce((acc: Record<number, string>, project: Project) => {
    acc[project.id] = project.name;
    return acc;
  }, {});
  const displayedDocuments = (() => {
    const nameCount: Record<string, number> = {};
    const nameIndex: Record<string, number> = {};

    // Count how many times each name appears
    allDocs.forEach((doc: Document) => {
      const baseName = (doc as any).file_name || doc.original_file_name || doc.name || '';
      nameCount[baseName] = (nameCount[baseName] || 0) + 1;
    });

    return allDocs.map((doc: Document) => {
      const baseName = (doc as any).file_name || doc.original_file_name || doc.name || '';
      let displayName = baseName;

      if (nameCount[baseName] > 1) {
        if (nameIndex[baseName] === undefined) nameIndex[baseName] = 0;
        else nameIndex[baseName] += 1;

        if (nameIndex[baseName] > 0) {
          const dotIndex = baseName.lastIndexOf('.');
          displayName = dotIndex !== -1
            ? `${baseName.slice(0, dotIndex)} (${nameIndex[baseName]})${baseName.slice(dotIndex)}`
            : `${baseName} (${nameIndex[baseName]})`;
        }
      }

      return {
        ...doc,
        name: displayName,
        project_name: projectLookup[doc.project] || doc.project_name || 'General'
      };
    }).filter((doc: Document) => {
      if (statusFilter && doc.status !== statusFilter) return false;
      if (searchTerm && !doc.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    }).sort((a: Document, b: Document) => {
      return new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime();
    });
  })();

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
    setSearchTerm('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    projectFilter || statusFilter || fileTypeFilter || searchTerm;

  const handleDeleteClick = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    setDeleteConfirm({ id: doc.id, name: doc.name });
  };

  const handleDocumentClick = async (doc: Document) => {
    try {
      // Fetch download URL
      const response = await documentsApi.getDownloadUrl(doc.project, { document_id: doc.id });
      setPreviewDoc({
        url: response.url,
        fileName: doc.original_file_name || doc.name,
        fileType: doc.file_type,
      });
    } catch (error) {
      console.error('Failed to get download URL:', error);
      navigate(`/documents/${doc.id}`);
    }
  };

  const { isActivityOpen, setIsActivityOpen } = useOutletContext<{
    isActivityOpen: boolean;
    setIsActivityOpen: (open: boolean) => void;
  }>();
  const emptyState = (
    <div className="flex flex-col items-center justify-center py-12">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">No documents found</h3>
      <p className="text-muted-foreground mb-4">
        {hasActiveFilters
          ? 'Try adjusting your filters'
          : 'Create your first document to get started'}
      </p>
      {hasActiveFilters && (
        <Button variant="outline" onClick={clearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  );

  const paginationControls = totalCount > 0 && (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-background">
      <div className="text-sm text-muted-foreground">
        Showing page {currentPage} of {Math.ceil(totalCount / 20)} ({totalCount} total documents)
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={!hasPreviousPage}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium px-3 py-1 rounded bg-primary text-primary-foreground">
            {currentPage}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((prev) => prev + 1)}
          disabled={!hasNextPage}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex w-full h-screen">
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-8 pt-8">
            <div>
              <h1 className="text-3xl font-bold">Documents</h1>
              <p className="text-muted-foreground">
                Manage all documents across projects
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
              <Button
                className="relative"
                onClick={() => setIsActivityOpen(!isActivityOpen)}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="px-8 shrink-0"><Card>
            <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={projectFilter}
                    onChange={(e) => updateFilter('project', e.target.value)}
                    className="flex h-10 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">All Projects</option>
                    {projects.map((project: Project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={fileTypeFilter}
                    onChange={(e) => updateFilter('file_type', e.target.value)}
                    className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {FILE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters} className="px-3">
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card></div>

          {/* Documents View */}
          <div className="flex-1 overflow-hidden px-8 pb-8 pt-6 min-h-0 flex flex-col">
            <div className="flex-1 overflow-hidden">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] w-full">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary mb-4"></div>
                  <p className="text-sm font-medium text-muted-foreground animate-pulse">
                    Loading documents...
                  </p>
                </div>
              ) : (
                <DualView
                  viewMode={viewMode}
                  isLoading={isLoading}
                gridProps={{
                  data: displayedDocuments,
                  renderCard: (doc) => (
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDocumentClick(doc);
                      }}
                      className="cursor-pointer"
                      style={{ pointerEvents: 'auto' }}
                    >
                      <div style={{ pointerEvents: 'none' }}>
                        <DocumentGridCard
                          key={doc.id}
                          document={doc}
                          onDeleteClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(e, doc);
                          }}
                          onShareClick={(doc) => {
                            setShareDoc(doc);
                          }}
                        />
                      </div>
                    </div>
                  ),
                  emptyState,
                  gridClassName: 'grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
                }}
                tableProps={{
                  data: displayedDocuments,
                  columns: createDocumentsTableColumns({ onDeleteClick: handleDeleteClick, onInfoClick: (doc) => setInfoDoc(doc), onShareClick: (doc) => setShareDoc(doc) }),
                  rowKey: (doc) => doc.id,
                  onRowClick: (doc) => handleDocumentClick(doc),
                  emptyState,
                  rowClassName: () => 'group',
                }}
              />
              )}
            </div>
            {paginationControls}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!deleteConfirm}
        title="Are you sure want to delete?"
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          if (deleteConfirm) {
            try {
              await documentsApi.delete(deleteConfirm.id);
              setDeleteConfirm(null);
              queryClient.invalidateQueries({ queryKey: ['documents'] });
            } catch (error) {
              console.error('Delete failed:', error);
            }
          }
        }}
      />
      {isActivityOpen && (
        <NotificationsPage
          onClose={() => setIsActivityOpen(false)}
          defaultFilter="unread"
        />
      )}
      <DocumentInfoPanel doc={infoDoc} onClose={() => setInfoDoc(null)} />
      {previewDoc && (
        <DocumentPreview
          url={previewDoc.url}
          fileName={previewDoc.fileName}
          fileType={previewDoc.fileType}
          onClose={() => setPreviewDoc(null)}
        />
      )}
      <DocumentShareModal
        isOpen={!!shareDoc}
        onClose={() => setShareDoc(null)}
        document={shareDoc}
      />
    </div>
  );
}