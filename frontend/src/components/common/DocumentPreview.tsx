import React, { useState, useEffect } from 'react';
import { X, Download, Loader2, FileText, AlertCircle, ZoomIn, ZoomOut, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
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

    // HTML view mode state
    const [codeViewMode, setCodeViewMode] = useState<'code' | 'preview'>('code');

    // Excel preview state - holds parsed sheets and active tab index
    const [excelSheets, setExcelSheets] = useState<{
        name: string;
        data: any[][];
    }[]>([]);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);

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

    // Detect if the URL itself points to a PDF (regardless of fileName)
    // This handles the case where backend converted Office files to PDF for preview
    const urlPointsToPdf = (() => {
        try {
            // Strip query params (presigned URLs have lots of them)
            const urlPath = url.split('?')[0].toLowerCase();
            return urlPath.endsWith('.pdf');
        } catch {
            return false;
        }
    })();

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension);
    const isPDF = urlPointsToPdf || extension === 'pdf' || fileType?.includes('pdf');

    // If URL is a PDF (converted from Office), don't treat it as an Office doc
    const isOfficeDoc = !urlPointsToPdf && ['doc', 'docx'].includes(extension);
    const isPresentation = !urlPointsToPdf && ['ppt', 'pptx'].includes(extension);
    const isSpreadsheet = !urlPointsToPdf && ['xls', 'xlsx'].includes(extension);
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
    
    // Load and parse Excel files using SheetJS
    useEffect(() => {
        // Skip if URL points to a converted PDF (shouldn't happen for Excel anymore, but safe)
        if (isSpreadsheet && !urlPointsToPdf) {
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error('Failed to download Excel file');
                    return res.arrayBuffer();
                })
                .then(buffer => {
                    const workbook = XLSX.read(buffer, { type: 'array' });
                    
                    const sheets = workbook.SheetNames.map(name => ({
                        name,
                        data: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
                            header: 1,    // Get array-of-arrays
                            defval: '',   // Default value for empty cells
                        }) as any[][]
                    }));
                    
                    setExcelSheets(sheets);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Excel parse error:', err);
                    setError(
                        'Failed to load Excel file. The file may be corrupted, ' +
                        'password-protected, or in an unsupported format.'
                    );
                    setLoading(false);
                });
        }
    }, [url, isSpreadsheet, urlPointsToPdf]);

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
        // Excel/Spreadsheet Preview using SheetJS (interactive table view)
        if (isSpreadsheet && !urlPointsToPdf && excelSheets.length > 0) {
            const currentSheet = excelSheets[activeSheetIndex];
            
            return (
                <div className="h-full w-full flex flex-col bg-white overflow-hidden">
                    {/* Sheet tabs (only show if multiple sheets) */}
                    {excelSheets.length > 1 && (
                        <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 bg-gray-100 border-b border-gray-200 overflow-x-auto">
                            {excelSheets.map((sheet, index) => (
                                <button
                                    key={sheet.name}
                                    onClick={() => setActiveSheetIndex(index)}
                                    className={`px-3 py-1 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                                        activeSheetIndex === index
                                            ? 'bg-white text-blue-600 border border-blue-300 shadow-sm'
                                            : 'text-gray-600 hover:bg-white'
                                    }`}
                                >
                                    {sheet.name}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    {/* Spreadsheet table content */}
                    <div className="flex-1 overflow-auto">
                        <table className="text-sm border-collapse">
                            <tbody>
                                {currentSheet.data.length === 0 ? (
                                    <tr>
                                        <td className="p-8 text-center text-gray-500">
                                            This sheet is empty
                                        </td>
                                    </tr>
                                ) : (
                                    currentSheet.data.map((row, rowIndex) => (
                                        <tr 
                                            key={rowIndex}
                                            className={rowIndex === 0 ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'}
                                        >
                                            {/* Row number cell */}
                                            <td className="px-3 py-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 text-center min-w-[40px] sticky left-0 z-10">
                                                {rowIndex + 1}
                                            </td>
                                            
                                            {/* Data cells */}
                                            {row.map((cell, cellIndex) => (
                                                <td 
                                                    key={cellIndex}
                                                    className="px-3 py-1.5 border border-gray-200 whitespace-nowrap"
                                                    title={String(cell || '')}
                                                >
                                                    {cell !== null && cell !== undefined ? String(cell) : ''}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Footer info */}
                    <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
                        <span>
                            {currentSheet.data.length} rows × {currentSheet.data[0]?.length || 0} columns
                        </span>
                        <span>
                            Sheet {activeSheetIndex + 1} of {excelSheets.length}
                        </span>
                    </div>
                </div>
            );
        }

        // Office Documents (DOCX, PPTX) - Using Microsoft Office Online Viewer
        // Note: Spreadsheets are handled above with SheetJS for better UX
        if (isOfficeDoc || isPresentation) {
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
            const isHtml = ['html', 'htm'].includes(extension);

            // Process HTML to inject responsive styles so tables and images don't overflow the iframe
            const getResponsiveHtml = () => {
                const responsiveStyles = `
                    <style>
                        /* Prevent horizontal scroll on the entire body */
                        html, body { max-width: 100vw; overflow-x: hidden; margin: 0; padding: 0; }
                        body { padding: 1rem; box-sizing: border-box; }
                        /* Make tables scroll horizontally within their own container */
                        table { width: 100% !important; max-width: 100%; overflow-x: auto; display: block; border-collapse: collapse; }
                        /* Ensure media fits the screen */
                        img, video, iframe { max-width: 100%; height: auto; }
                        /* Prevent long un-spaced text from breaking layout */
                        * { word-wrap: break-word; }
                    </style>
                `;
                
                // Safely inject styles into the head if it exists, otherwise prepend them
                if (textContent.toLowerCase().includes('</head>')) {
                    return textContent.replace(/<\/head>/i, `${responsiveStyles}</head>`);
                }
                return `${responsiveStyles}${textContent}`;
            };

            return (
                <div className="h-full w-full flex flex-col bg-gray-900">
                    {/* View Toggles for HTML */}
                    {isHtml && (
                        <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-gray-800 border-b border-gray-700">
                            <button
                                onClick={() => setCodeViewMode('code')}
                                className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                                    codeViewMode === 'code'
                                        ? 'bg-gray-700 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                            >
                                Code
                            </button>
                            <button
                                onClick={() => setCodeViewMode('preview')}
                                className={`px-4 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-2 ${
                                    codeViewMode === 'preview'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                            >
                                Preview
                            </button>
                        </div>
                    )}
                    
                    <div className="flex-1 overflow-auto relative">
                    {isHtml && codeViewMode === 'preview' ? (
                            <div className="absolute inset-0 bg-white">
                                <iframe
                                    title={fileName}
                                    srcDoc={getResponsiveHtml()}
                                    // Allow scripts so interactive buttons/pagination work
                                    // Removed 'allow-same-origin' to keep the app secure from XSS
                                    sandbox="allow-scripts allow-popups" 
                                    className="w-full h-full border-0"
                                    style={{ backgroundColor: '#ffffff' }}
                                />
                            </div>
                        ) : (
                            <div className="h-full w-full p-6 text-gray-100 overflow-auto">
                                <pre className="font-mono text-sm whitespace-pre-wrap">
                                    <code>{textContent}</code>
                                </pre>
                            </div>
                        )}
                    </div>
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
                    {isSpreadsheet && !urlPointsToPdf && 'Spreadsheet preview — switch tabs to view sheets'}
                    {(isOfficeDoc || isPresentation) && !urlPointsToPdf && 'Powered by Microsoft Office Online Viewer'}
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
