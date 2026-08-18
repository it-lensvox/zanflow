import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, CheckCircle, Clock, AlertCircle, Plus, Settings, Sparkles,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/common';
import { DocumentPreview, useDocumentPreviewKeyboard } from '@/components/common/DocumentPreview';
import { projectsApi, documentsApi } from '@/services/api';
import { formatDate } from '@/lib/utils';
import { getDocStatusConfig } from '@/config/documentConfig';
import type { Document } from '@/types';
import { AITask } from '@/pages/MyTask/components/AITask';


export function ProjectDetail() {
  const navigate = useNavigate();
  const [showAIModal, setShowAIModal] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{
    url: string;
    fileName: string;
    fileType?: string;
  } | null>(null);

  const { id } = useParams<{ id: string }>();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const res = await projectsApi.get(Number(id));
      // ✅ normalize — handle both flat {id, name} and nested {project: {id, name}}
      return res?.project ?? res;
    },
    enabled: !!id,
    staleTime: 0,
    retry: 2,
  });

  const [documentPage, setDocumentPage] = useState(1);
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [hasMoreDocs, setHasMoreDocs] = useState(true);
  const documentScrollRef = useRef<HTMLDivElement>(null);

  const { data: documentsData, isLoading: docsLoading, isFetching: isDocsFetching } = useQuery({
    queryKey: ['documents', { project: id, page: documentPage }],
    queryFn: () => documentsApi.list({ project: Number(id), page: documentPage }),
    enabled: !!id && hasMoreDocs,
    staleTime: 1000 * 60 * 5,
  });

  // Update documents when new data arrives
  useEffect(() => {
    if (documentsData) {
      const newDocs = documentsData?.results || documentsData || [];

      if (documentPage === 1) {
        setAllDocuments(newDocs);
      } else {
        setAllDocuments(prev => [...prev, ...newDocs]);
      }

      // Check if there are more pages
      if (documentsData?.next === null || newDocs.length === 0) {
        setHasMoreDocs(false);
      }
    }
  }, [documentsData, documentPage]);

  // Infinite scroll handler for documents
  const handleDocumentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;

    if (scrollPercentage > 0.8 && !isDocsFetching && hasMoreDocs) {
      setDocumentPage(prev => prev + 1);
    }
  }, [isDocsFetching, hasMoreDocs]);

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
      } else {
        alert('Unable to open document: Download URL not available.');
      }
    } catch (error) {
      console.error('Failed to open document:', error);
      alert('Failed to open document. Please try again.');
    }
  };

  // Enable keyboard shortcuts for document preview
  useDocumentPreviewKeyboard(() => setPreviewDocument(null));

  const documents = allDocuments;

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Project not found</h2>
        <Link to="/projects" className="text-primary hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const stats = {
    total: documents.length,
    approved: documents.filter((d: Document) => d.status === 'approved').length,
    pending: documents.filter((d: Document) => d.status === 'in_review').length,
    draft: documents.filter((d: Document) => d.status === 'draft').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/projects"
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{project.name}</h1>
              <Badge variant="secondary">
                {project.task_type.replace('_', ' ')}
              </Badge>
            </div>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAIModal(true)}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Task by AI
          </Button>
          <Link to={`/projects/${id}/settings`}>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Documents
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Review
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{stats.draft}</div>
          </CardContent>
        </Card>
      </div>

      {/* Documents Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documents</CardTitle>
          <Link to={`/projects/${id}/documents/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {docsLoading && documentPage === 1 ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : documents.length > 0 ? (
            <div
              className="overflow-x-auto max-h-[600px] overflow-y-auto"
              onScroll={handleDocumentScroll}
              ref={documentScrollRef}
            >
              <table className="w-full">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Name</th>
                    <th className="text-left py-3 px-4 font-medium">Type</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Versions</th>
                    <th className="text-left py-3 px-4 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc: Document) => (
                    <tr
                      key={doc.id}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          navigate(`/documents/${doc.id}`);
                        } else {
                          handleDocumentPreview(doc);
                        }
                      }}
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium">
                          {doc.original_file_name || doc.name}
                        </div>
                        {doc.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {doc.description}
                          </div>
                        )}
                        {doc.original_file_name && doc.original_file_name !== doc.name && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Internal: {doc.name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{doc.file_type}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 500, background: getDocStatusConfig(doc.status).bg, color: getDocStatusConfig(doc.status).text }}>
                          {getDocStatusConfig(doc.status).label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {doc.version_count || 0}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {isDocsFetching && documentPage > 1 && (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              )}
              {!hasMoreDocs && documents.length > 20 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  All documents loaded
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No documents yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first document to start creating ground truth
              </p>
              <Link to={`/projects/${id}/documents/new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {showAIModal && (
        <AITask
          onClose={() => setShowAIModal(false)}
          fixedProjectId={Number(id)}
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