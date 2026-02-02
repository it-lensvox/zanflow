import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate, useOutletContext } from 'react-router-dom';
import { FileText, Search, Filter, ChevronDown, Bell } from 'lucide-react';
import { Button, Card, CardContent, Input } from '@/components/common';
import { documentsApi, notificationsApi, projectsApi } from '@/services/api';
import type { Document, Project } from '@/types';
import { ViewToggle, DualView, useViewMode, } from '@/components/layout/DualView';
import { createDocumentsTableColumns, DocumentGridCard } from '@/components/layout/DualView/documentsConfig';


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
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const navigate = useNavigate();
  const { viewMode, setViewMode } = useViewMode({
    defaultMode: 'table',
  });

  const projectFilter = searchParams.get('project') || '';
  const statusFilter = searchParams.get('status') || '';
  const fileTypeFilter = searchParams.get('file_type') || '';

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  const { data: allDocumentsData, isLoading } = useQuery({
    queryKey: ['documents', 'all', projectFilter, fileTypeFilter],
    queryFn: () =>
      documentsApi.list({
        project: projectFilter ? Number(projectFilter) : undefined,
        file_type: fileTypeFilter || undefined,
      }),
    enabled: true
  });

  const rawProjects = projectsData?.results || projectsData || [];
  const projects = (Array.isArray(rawProjects) ? rawProjects : []) as Project[];

  const allDocs = allDocumentsData?.results || allDocumentsData || [];
  const projectLookup = projects.reduce((acc: Record<number, string>, project: Project) => {
    acc[project.id] = project.name;
    return acc;
  }, {});
  const displayedDocuments = allDocs.map((doc: Document) => ({
    ...doc,
    project_name: projectLookup[doc.project] || doc.project_name || 'General'
  })).filter((doc: Document) => {
    if (statusFilter && doc.status !== statusFilter) return false;
    if (searchTerm && !doc.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

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
  };

  const hasActiveFilters =
    projectFilter || statusFilter || fileTypeFilter || searchTerm;

  const handleDeleteClick = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    setDeleteConfirm({ id: doc.id, name: doc.name });
  };
  const { data: summary } = useQuery({
    queryKey: ['notifications-summary'],
    queryFn: () => notificationsApi.getSummary(),
    refetchInterval: 30000,
  });

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

  return (
    <div className="flex w-full min-h-screen">
      <div className="flex-1 min-w-0 p-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Documents</h1>
              <p className="text-muted-foreground">
                Manage all ground truth documents across projects
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
              <Button
                className="relative"
                onClick={() => setIsActivityOpen(!isActivityOpen)}
              >
                <Bell className="h-5 w-5" />
                {(summary?.unread ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {summary?.unread}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search documents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    <ChevronDown
                      className={`h-4 w-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                    />
                  </Button>
                  {hasActiveFilters && (
                    <Button variant="ghost" onClick={clearFilters}>
                      Clear
                    </Button>
                  )}
                </div>

                {showFilters && (
                  <div className="flex flex-wrap gap-4 pt-4 border-t">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Project</label>
                      <select
                        value={projectFilter}
                        onChange={(e) => updateFilter('project', e.target.value)}
                        className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">All Projects</option>
                        {projects.map((project: Project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status Filter */}

                    <div className="space-y-1">
                      <label className="text-sm font-medium">File Type</label>
                      <select
                        value={fileTypeFilter}
                        onChange={(e) => updateFilter('file_type', e.target.value)}
                        className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {FILE_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Documents View */}
          <DualView
            viewMode={viewMode}
            isLoading={isLoading}
            gridProps={{
              data: displayedDocuments,
              renderCard: (doc) => (
                <DocumentGridCard
                  key={doc.id}
                  document={doc}
                  onDeleteClick={handleDeleteClick}
                />
              ),
              emptyState,
              gridClassName: 'grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
            }}
            tableProps={{
              data: displayedDocuments,
              columns: createDocumentsTableColumns({ onDeleteClick: handleDeleteClick }),
              rowKey: (doc) => doc.id,
              onRowClick: (doc) => navigate(`/documents/${doc.id}`),
              emptyState,
              rowClassName: () => 'group',
            }}
          />
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
    </div>
  );
}
