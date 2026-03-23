import React, { useState, useEffect } from 'react';
import { X, Download, Loader2, FileText, AlertCircle, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';
/**
 * Supports: Images, PDF, DOCX, PPTX, TXT, Code files, and more.
 * 
 * @param url - The URL of the document to preview
 * @param fileName - The name of the file
 * @param fileType - The MIME type or extension of the file
 * @param onClose - Callback function when preview is closed
 */

interface DocumentPreviewProps {
    url: string;
    fileName: string;
    fileType?: string;
    onClose: () => void;
    defaultFullscreen?: boolean;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
    url,
    fileName,
    fileType = '',
    onClose,
    defaultFullscreen = false,
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(100);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [textContent, setTextContent] = useState<string>('');
    const [downloading, setDownloading] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);

    // Toggle fullscreen mode
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Determine file type from extension or MIME type
    const getFileExtension = () => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        return ext;
    };

    const extension = getFileExtension();

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension);
    const isPDF = extension === 'pdf' || fileType?.includes('pdf');
    const isOfficeDoc = ['doc', 'docx'].includes(extension);
    const isPresentation = ['ppt', 'pptx'].includes(extension);
const isSpreadsheet = ['xls', 'xlsx'].includes(extension);
    const isText = ['txt', 'md', 'log', 'csv'].includes(extension);
    const isCode = ['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'py', 'java', 'cpp', 'c', 'sh', 'yml', 'yaml', 'xml'].includes(extension);
    const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(extension) || fileType?.startsWith('video/') || false;
    const isAudio = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(extension) || fileType?.startsWith('audio/') || false;
    // Handle download - Force download using fetch and blob
    const handleDownload = async () => {
        try {
            setDownloading(true);

            // Fetch the file as a blob
            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            // Get the blob data with correct content type
            const contentType = response.headers.get('content-type') || 'application/octet-stream';
            const blob = await response.blob();

            // Ensure blob has correct type
            const downloadBlob = new Blob([blob], { type: contentType });

            // Create a blob URL
            const blobUrl = window.URL.createObjectURL(downloadBlob);

            // Create a temporary link and trigger download
            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = blobUrl;
            link.download = fileName;

            // Append to body, click, and remove
            document.body.appendChild(link);
            link.click();

            // Cleanup after a short delay to ensure download starts
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            }, 100);

            setDownloading(false);
        } catch (error) {
            console.error('Download failed:', error);
            setDownloading(false);

            // Fallback: Direct download attempt
            try {
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (e) {
                console.error('Fallback download also failed:', e);
                alert('Download failed. Please try again or contact support.');
            }
        }
    };


    // Fetch text content for text/code files
    useEffect(() => {
        if (isText || isCode) {
            fetch(url)
                .then(res => res.text())
                .then(text => {
                    setTextContent(text);
                    setLoading(false);
                })
                .catch(err => {
                    setError('Failed to load file content');
                    setLoading(false);
                });
        }
        const isKnownType = isImage || isPDF || isOfficeDoc || isPresentation || isSpreadsheet || isText || isCode || isVideo || isAudio;
        if (!isKnownType) {
            setLoading(false);
        }
    }, [url, isImage, isPDF, isOfficeDoc, isPresentation, isSpreadsheet, isText, isCode, isVideo, isAudio]);

    // Zoom controls
    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));

    // Render different content based on file type
    const renderPreviewContent = () => {
        // Image Preview
        if (isImage) {
            return (
                <div className="flex items-center justify-center h-full bg-gray-900 p-4">
                    <img
                        src={url}
                        alt={fileName}
                        className="max-w-full max-h-full object-contain"
                        style={{ transform: `scale(${zoom / 100})` }}
                        onLoad={() => setLoading(false)}
                        onError={() => {
                            setError('Failed to load image');
                            setLoading(false);
                        }}
                    />
                </div>
            );
        }

        // PDF Preview
        if (isPDF) {
            const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
            return (
                <div className="h-full w-full bg-gray-100">
                    <iframe
                        src={googleViewerUrl}
                        className="w-full h-full border-0"
                        title={fileName}
                        onLoad={() => setLoading(false)}
                        onError={() => {
                            setError('Failed to load PDF. Click download to view externally.');
                            setLoading(false);
                        }}
                    />
                </div>
            );
        }

        // Office Documents (DOCX, PPTX, XLSX) - Using Microsoft Office Online Viewer
        if (isOfficeDoc || isPresentation || isSpreadsheet) {
            const encodedUrl = encodeURIComponent(url);
            const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;

            return (
                <div className="h-full w-full bg-white">
                    <iframe
                        src={viewerUrl}
                        className="w-full h-full border-0"
                        title={fileName}
                        onLoad={() => setLoading(false)}
                        onError={() => {
                            setError('Failed to load document. Click download to view externally.');
                            setLoading(false);
                        }}
                    />
                </div>
            );
        }

        // Text and Code Files
        if ((isText || isCode) && textContent) {
            return (
                <div className="h-full w-full bg-gray-900 text-gray-100 overflow-auto p-6">
                    <pre className="font-mono text-sm whitespace-pre-wrap">
                        <code>{textContent}</code>
                    </pre>
                </div>
            );
        }

        // Video Preview
        if (isVideo) {
            return (
                <div className="flex items-center justify-center h-full bg-gray-900">
                    <video
                        src={url}
                        controls
                        autoPlay={false}
                        className="max-w-full max-h-full rounded"
                        style={{ maxHeight: '100%', maxWidth: '100%' }}
                        onLoadedData={() => setLoading(false)}
                        onCanPlay={() => setLoading(false)}
                        onError={() => {
                            setError('Failed to load video. Click download to view externally.');
                            setLoading(false);
                        }}
                    >
                        Your browser does not support the video tag.
                    </video>
                </div>
            );
        }

        // Audio Preview
        if (isAudio) {
            return (
                <div className="flex flex-col items-center justify-center h-full bg-gray-900 gap-6 p-8">
                    <FileText className="w-20 h-20 text-blue-400" />
                    <p className="text-white text-lg font-medium truncate max-w-sm text-center">{fileName}</p>
                    <audio
                        src={url}
                        controls
                        className="w-full max-w-lg"
                        onLoadedData={() => setLoading(false)}
                        onCanPlay={() => setLoading(false)}
                        onError={() => {
                            setError('Failed to load audio. Click download to view externally.');
                            setLoading(false);
                        }}
                    >
                        Your browser does not support the audio tag.
                    </audio>
                </div>
            );
        }

        // Fallback for unsupported file types
        return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
                <FileText className="w-20 h-20 text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Preview Not Available</h3>
                <p className="text-gray-500 mb-6 text-center max-w-md">
                    Preview is not supported for this file type (.{extension}).
                    Please download the file to view it.
                </p>
                <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {downloading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Downloading...
                        </>
                    ) : (
                        <>
                            <Download className="w-5 h-5" />
                            Download File
                        </>
                    )}
                </button>
            </div>
        );
    };

    return (
        <div className={`fixed z-[100] bg-black flex flex-col transition-all duration-300 ${isFullscreen
            ? 'inset-0 bg-opacity-90'
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vh] max-w-7xl rounded-lg shadow-2xl bg-opacity-95'
            }`}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-800 text-white">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    <h2 className="text-lg font-semibold truncate" title={fileName}>
                        {fileName}
                    </h2>
                    <span className="px-2 py-1 bg-gray-700 rounded text-xs uppercase flex-shrink-0">
                        {extension}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {/* Zoom Controls for Images */}
                    {isImage && (
                        <div className="flex items-center gap-2 mr-4">
                            <button
                                onClick={handleZoomOut}
                                disabled={zoom <= 50}
                                className="p-2 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Zoom Out"
                            >
                                <ZoomOut className="w-5 h-5" />
                            </button>
                            <span className="text-sm w-16 text-center">{zoom}%</span>
                            <button
                                onClick={handleZoomIn}
                                disabled={zoom >= 200}
                                className="p-2 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Zoom In"
                            >
                                <ZoomIn className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {/* Maximize/Minimize Button */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 hover:bg-gray-700 rounded transition-colors"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? (
                            <Minimize2 className="w-5 h-5" />
                        ) : (
                            <Maximize2 className="w-5 h-5" />
                        )}
                    </button>

                    {/* Download Button */}
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="p-2 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        title="Download"
                    >
                        {downloading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Download className="w-5 h-5" />
                        )}
                    </button>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded transition-colors"
                        title="Close"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 relative overflow-hidden">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                            <p className="text-white text-sm">Loading preview...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                        <div className="flex flex-col items-center gap-4 max-w-md p-6">
                            <AlertCircle className="w-16 h-16 text-red-500" />
                            <h3 className="text-xl font-semibold text-white">Preview Error</h3>
                            <p className="text-gray-300 text-center">{error}</p>
                            <button
                                onClick={handleDownload}
                                disabled={downloading}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {downloading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Downloading...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-5 h-5" />
                                        Download File
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {!error && renderPreviewContent()}
            </div>

            {/* Footer Info */}
            <div className="px-6 py-3 bg-gray-800 text-gray-400 text-sm flex justify-between items-center">
                <span>Press ESC to close</span>
                <span className="text-xs">
                    {isImage && 'Use zoom controls to adjust size'}
                    {isPDF && 'Scroll to navigate pages'}
                    {(isOfficeDoc || isPresentation || isSpreadsheet) && 'Powered by Microsoft Office Online Viewer'}
                </span>
            </div>
        </div>
    );
};

// Hook for keyboard shortcuts
export const useDocumentPreviewKeyboard = (onClose: () => void) => {
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [onClose]);
};


/**
 * Reusable thumbnail component for document attachments
 * 
 * @param url - The URL of the document
 * @param fileName - The name of the file
 * @param fileType - The MIME type or extension of the file
 * @param onClick - Optional callback when thumbnail is clicked
 * @param className - Additional CSS classes
 */

interface DocumentThumbnailProps {
    url: string;
    fileName: string;
    fileType?: string;
    onClick?: () => void;
    className?: string;
    showFileName?: boolean;
}

export const DocumentThumbnail: React.FC<DocumentThumbnailProps> = ({
    url,
    fileName,
    fileType = '',
    onClick,
    className = '',
    showFileName = true,
}) => {
    const [thumbnailError, setThumbnailError] = useState(false);

    // Determine file type from extension or MIME type
    const getFileExtension = () => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        return ext;
    };

    const extension = getFileExtension();

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension);
    const isPDF = extension === 'pdf' || fileType?.includes('pdf');
    const isOfficeDoc = ['doc', 'docx'].includes(extension);
    const isPresentation = ['ppt', 'pptx'].includes(extension);
    const isSpreadsheet = ['xls', 'xlsx'].includes(extension);
    const isText = ['txt', 'md', 'log', 'csv'].includes(extension);
    const isCode = ['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'py', 'java', 'cpp', 'c', 'sh', 'yml', 'yaml', 'xml'].includes(extension);
    const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(extension) || fileType?.startsWith('video/') || false;
    const isAudio = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(extension) || fileType?.startsWith('audio/') || false;

    // Get appropriate icon and color for file type
    const getFileIcon = () => {
        if (isPDF) return { icon: <FileText className="w-8 h-8" />, color: 'bg-red-100 text-red-600' };
        if (isOfficeDoc) return { icon: <FileText className="w-8 h-8" />, color: 'bg-blue-100 text-blue-600' };
        if (isPresentation) return { icon: <FileText className="w-8 h-8" />, color: 'bg-orange-100 text-orange-600' };
        if (isSpreadsheet) return { icon: <FileText className="w-8 h-8" />, color: 'bg-green-100 text-green-600' };
        if (isText || isCode) return { icon: <FileText className="w-8 h-8" />, color: 'bg-gray-100 text-gray-600' };
        if (isVideo) return { icon: <FileText className="w-8 h-8" />, color: 'bg-purple-100 text-purple-600' };
        if (isAudio) return { icon: <FileText className="w-8 h-8" />, color: 'bg-pink-100 text-pink-600' };
        return { icon: <FileText className="w-8 h-8" />, color: 'bg-gray-100 text-gray-500' };
    };

    const renderThumbnail = () => {
        // Image thumbnail - show actual image
        if (isImage && !thumbnailError) {
            return (
                <div className="w-full h-full overflow-hidden bg-gray-50 rounded-lg">
                    <img
                        src={url}
                        alt={fileName}
                        className="w-full h-full object-cover rounded-lg"
                        onError={() => setThumbnailError(true)}
                    />
                </div>
            );
        }

        // File icon for non-images or failed image loads
        const { icon, color } = getFileIcon();
        return (
            <div className={`w-full h-full flex flex-col items-center justify-center ${color} rounded-lg`}>
                {icon}
                <span className="text-xs font-semibold mt-2 uppercase">{extension}</span>
            </div>
        );
    };

    return (
        <div
            className={`relative group cursor-pointer ${className}`}
            onClick={onClick}
        >
            {/* Thumbnail Container */}
            <div className="w-full h-32 rounded-xl overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition-all duration-200 bg-white shadow-sm">
                {renderThumbnail()}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center rounded-xl">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-sm font-medium">
                        Click to preview
                    </div>
                </div>
            </div>

            {/* File Name */}
            {showFileName && (
                <p className="mt-2 text-sm text-gray-700 truncate text-center" title={fileName}>
                    {fileName}
                </p>
            )}
        </div>
    );
};
