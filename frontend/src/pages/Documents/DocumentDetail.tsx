import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, Download, Calendar, User, Loader2, File, Image as ImageIcon, FileJson,
  Film, FileCode, ChevronLeft, ChevronRight, Info, X,
} from 'lucide-react';
import { Button, Badge } from '@/components/common';
import { documentsApi } from '@/services/api';
import { formatDate, getStatusColor } from '@/lib/utils';
import type { Document } from '@/types';
import { Document as PDFDocument, Page as PDFPage, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import React from 'react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

function useDownloadUrl(projectId: string | undefined, documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-download-url', projectId, documentId],
    queryFn: async () => {
      if (!projectId || !documentId) return null;
      const response = await documentsApi.getDownloadUrl(Number(projectId), { document_id: documentId });
      return response.url;
    },
    enabled: !!projectId && !!documentId,
    staleTime: 60 * 1000,
  });
}

function DocumentViewer({ doc, downloadUrl }: { doc: Document; downloadUrl: string | null }) {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Fetch text content for JSON/Text files
  React.useEffect(() => {
    if (!downloadUrl) return;
    if (doc.file_type === 'json' || doc.file_type === 'text') {
      setIsLoadingFile(true);
      fetch(downloadUrl)
        .then((res) => res.text())
        .then((text) => setFileContent(text))
        .catch((err) => {
          console.error('[DocumentViewer] Fetch error:', err);
          setFileError('Failed to load file content.');
        })
        .finally(() => setIsLoadingFile(false));
    }
  }, [downloadUrl, doc.file_type]);

  if (isLoadingFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (fileError || !downloadUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <FileText className="h-16 w-16 text-destructive/40 mb-4" />
        <p className="text-lg font-semibold text-destructive">
          {fileError || 'Unable to load document'}
        </p>
      </div>
    );
  }

  // Render based on file type
  if (doc.file_type === 'video') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black rounded-lg">
        <video controls className="max-w-full max-h-full">
          <source src={downloadUrl} />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  if (doc.file_type === 'image') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/10 rounded-lg p-6">
        <img
          src={downloadUrl}
          alt={doc.name}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        />
      </div>
    );
  }

  if (doc.file_type === 'json' || doc.file_type === 'text') {
    return (
      <div className="w-full h-full overflow-auto bg-slate-950 text-slate-50 rounded-lg p-6">
        <pre className="text-sm font-mono whitespace-pre-wrap break-all leading-relaxed">
          {fileContent}
        </pre>
      </div>
    );
  }

  if (doc.file_type === 'pdf') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center space-y-4 overflow-auto py-6">
        <div className="rounded-lg overflow-hidden shadow-2xl bg-white">
          <PDFDocument
            file={downloadUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={(err) => {
              console.error('[DocumentViewer] PDF Load Error:', err);
              setFileError(`Failed to load PDF: ${err.message}`);
            }}
          >
            <PDFPage
              pageNumber={pageNumber}
              width={Math.min(window.innerWidth * 0.7, 900)}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </PDFDocument>
        </div>
        {numPages && numPages > 1 && (
          <div className="flex items-center gap-3 bg-background/95 backdrop-blur-sm px-4 py-2.5 rounded-full border shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold px-2 min-w-[100px] text-center">
              {pageNumber} / {numPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Check for office documents or other external opening types
  const fileExtension = (doc.original_file_name || doc.name).split('.').pop()?.toLowerCase() || '';
  const officeTypes = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];

  if (officeTypes.includes(fileExtension) || doc.file_type === 'other') {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <FileText className="h-20 w-20 text-blue-500/40 mb-4" />
        <p className="text-xl font-semibold text-muted-foreground">
          {officeTypes.includes(fileExtension) ? 'Office Document' : 'External File'}
        </p>
        <p className="text-sm text-muted-foreground mt-2 mb-6 text-center">
          This file type cannot be previewed directly but can be opened in a new tab.
        </p>
        <Button
          onClick={() => {
            if (downloadUrl) {
              if (['doc', 'docx', 'ppt', 'pptx'].includes(fileExtension)) {
                const officeViewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(downloadUrl)}`;
                window.open(officeViewerUrl, '_blank');
              } else {
                window.open(downloadUrl, '_blank');
              }
            }
          }}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          Open File in New Tab
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <FileText className="h-20 w-20 text-muted-foreground/30 mb-4" />
      <p className="text-xl font-semibold text-muted-foreground">Unsupported File Type</p>
      <p className="text-sm text-muted-foreground mt-2">
        Cannot preview "{doc.file_type}" files
      </p>
    </div>
  );
}

export function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showInfo, setShowInfo] = useState(false);

  const { data: document, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id!),
    enabled: !!id,
  });

  const { data: downloadUrl, isLoading: isUrlLoading } = useDownloadUrl(
    document?.project?.toString(),
    document?.id
  );

  React.useEffect(() => {
    if (document && downloadUrl && !isLoading && !isUrlLoading) {
      const fileName = document.original_file_name || document.name || '';
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      if (fileExtension === 'docx') {
        const officeViewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(downloadUrl)}`;
        window.open(officeViewerUrl, '_blank');
        navigate('/documents');
      }
    }
  }, [document, downloadUrl, isLoading, isUrlLoading, navigate]);


  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return FileText;
      case 'image':
        return ImageIcon;
      case 'json':
        return FileJson;
      case 'video':
        return Film;
      case 'text':
        return FileCode;
      default:
        return File;
    }
  };

  const handleDownload = async () => {
    if (!downloadUrl) return;

    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document?.original_file_name || document?.name || 'download';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(downloadUrl, '_blank');
    }
  };

  if (isLoading || isUrlLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-12 w-12 text-primary" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <FileText className="h-20 w-20 text-muted-foreground/30" />
        <h2 className="text-2xl font-bold text-muted-foreground">Document not found</h2>
        <Button onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Documents
        </Button>
      </div>
    );
  }

  const FileIcon = getFileIcon(document.file_type);

  return (
    <div className="relative h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/documents')}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                <FileIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold tracking-tight truncate">
                  {document.original_file_name || document.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="uppercase text-xs font-semibold">
                    {document.file_type}
                  </Badge>
                  <Badge className={`${getStatusColor(document.status)} text-xs`}>
                    {document.status.replace('_', ' ')}
                  </Badge>
                  {document.project_name && (
                    <Badge variant="outline" className="text-xs">{document.project_name}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInfo(!showInfo)}
              className="gap-2"
            >
              <Info className="h-4 w-4" />
              Details
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleDownload}
              disabled={!downloadUrl}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Document Viewer  */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="w-full h-full max-w-6xl">
            <DocumentViewer doc={document as Document} downloadUrl={downloadUrl || null} />
          </div>
        </div>

        {/* Info Sidebar - Slide from right */}
        <div
          className={`absolute top-0 right-0 h-full w-96 bg-card border-l shadow-2xl transform transition-transform duration-300 ease-in-out ${showInfo ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
          <div className="h-full overflow-y-auto">
            {/* Sidebar Header */}
            <div className="sticky top-0 bg-card border-b px-8 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Document Details</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowInfo(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Sidebar Content */}
            <div className="p-8 space-y-6">
              {/* Description */}
              {document.description && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Description
                  </h3>
                  <p className="text-sm leading-relaxed">{document.description}</p>
                </div>
              )}

              {/* Document Info */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <Calendar className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Created</p>
                      <p className="text-sm font-semibold mt-0.5">
                        {formatDate(document.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <Calendar className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Last Updated</p>
                      <p className="text-sm font-semibold mt-0.5">
                        {formatDate(document.updated_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <User className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Created By</p>
                      <p className="text-sm font-semibold mt-0.5">
                        {document.created_by?.username || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {document.file_size && (
                    <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <File className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">File Size</p>
                        <p className="text-sm font-semibold mt-0.5">
                          {(document.file_size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Labels */}
              {document.labels && document.labels.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Labels
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {document.labels.map((label: { id: React.Key | null | undefined; color: any; name: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined; }) => (
                      <Badge
                        key={label.id}
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: label.color,
                          color: label.color,
                        }}
                      >
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate(`/projects/${document.project}`)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Project
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}