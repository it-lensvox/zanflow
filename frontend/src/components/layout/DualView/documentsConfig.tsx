import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Trash2, CheckCircle, Clock, File } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@/components/common';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import type { Document, DocumentStatus } from '@/types';
import type { TableColumn } from '../DualView';
import { documentsApi } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';

interface DocumentTableColumnsProps {
  onDeleteClick: (e: React.MouseEvent, doc: Document) => void;
}

const getDocumentStatusConfig = (status: DocumentStatus) => {
  const normalizedStatus = status.toLowerCase() as Lowercase<DocumentStatus>;

  switch (normalizedStatus) {
    case 'draft':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-800',
        label: 'DRAFT',
        icon: File
      };
    case 'in_review':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        label: 'IN REVIEW',
        icon: Clock
      };
    case 'approved':
      return {
        bg: 'bg-green-50',
        text: 'text-green-800',
        label: 'APPROVED',
        icon: CheckCircle
      };
    case 'archived':
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-800',
        label: 'ARCHIVED',
        icon: FileText
      };
    default: {
      const exhaustiveCheck: never = normalizedStatus;
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-800',
        label: String(status).toUpperCase().replace('_', ' '),
        icon: FileText
      };
    }
  }
};

const statusOptions: { value: DocumentStatus; label: string; icon: any }[] = [
  { value: 'draft', label: 'DRAFT', icon: File },
  { value: 'in_review', label: 'IN REVIEW', icon: Clock },
  { value: 'approved', label: 'APPROVED', icon: CheckCircle },
  { value: 'archived', label: 'ARCHIVED', icon: FileText },
];

export const createDocumentsTableColumns = ({ onDeleteClick }: DocumentTableColumnsProps): TableColumn<Document>[] => {
  const StatusDropdown = ({ doc }: { doc: Document }) => {
    const [activeDropdown, setActiveDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();
    const statusConfig = getDocumentStatusConfig(doc.status);

    // Handle outside click to close dropdown
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setActiveDropdown(false);
        }
      };

      if (activeDropdown) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [activeDropdown]);

    const handleStatusChange = async (newStatus: DocumentStatus) => {
      try {
        await documentsApi.updateStatus(doc.id, newStatus);
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        setActiveDropdown(false);
      } catch (error) {
        console.error('Failed to update status:', error);
      }
    };

    return (
      <div ref={dropdownRef} className="relative" onClick={(e) => e.stopPropagation()}>
        <div
          className={`jira-status-badge ${statusConfig.bg} ${statusConfig.text} cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium`}
          onClick={() => setActiveDropdown(!activeDropdown)}
        >
          <span>{statusConfig.label}</span>
        </div>

        {activeDropdown && (
          <div
            className="absolute z-50 mt-1 left-0 min-w-[140px] max-h-[200px] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1"
            onWheel={(e) => e.stopPropagation()}
          >
            {statusOptions.map((option) => {
              const optionConfig = getDocumentStatusConfig(option.value);
              return (
                <div
                  key={option.value}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-[12px] flex items-center gap-2"
                  onClick={() => handleStatusChange(option.value)}
                >
                  {React.createElement(option.icon, { className: `w-3.5 h-3.5 ${optionConfig.text}` })}
                  <span className={doc.status === option.value ? "font-bold text-blue-600" : ""}>
                    {option.label}
                  </span>
                  {doc.status === option.value && (
                    <svg className="w-3.5 h-3.5 text-blue-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return [
    {
      key: 'name',
      label: 'Document',
      // width: '350px',  // Added width
      render: (doc: Document) => (
        <div className="flex items-center justify-between w-full group/cell">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="font-medium text-[#172b4d] truncate" title={doc.name}>
              {doc.name}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(e, doc);
            }}
            className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 hover:bg-red-50 rounded flex-shrink-0"
            title="Delete Document"
          >
            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
          </button>
        </div>
      ),
    },
    {
      key: 'project',
      label: 'Project',
      width: '180px',  // Added width
      render: (doc: Document) => (
        <span className="text-[12px] text-gray-700 font-medium">
          {doc.project_name || 'General'}
        </span>
      ),
    },
    {
      key: 'file_type',
      label: 'Type',
      width: '120px',
      render: (doc: Document) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 uppercase border border-gray-200">
          {doc.file_type}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',  // Reduced from 140px
      render: (doc: Document) => <StatusDropdown doc={doc} />,
    },
    {
      key: 'created_by',
      label: 'Uploaded By',
      width: '180px',  // Added width
      render: (doc: Document) => (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
            {doc.created_by?.full_name?.charAt(0) || 'U'}
          </div>
          <span className="text-gray-700">{doc.created_by?.full_name || 'System'}</span>
        </div>
      ),
    },
  ];

};

interface DocumentGridCardProps {
  document: Document;
  onDeleteClick: (e: React.MouseEvent, doc: Document) => void;
}

export function DocumentGridCard({ document: doc, onDeleteClick }: DocumentGridCardProps) {
  const getStatusConfig = (status: DocumentStatus) => {
    const normalizedStatus = status.toLowerCase() as Lowercase<DocumentStatus>;

    switch (normalizedStatus) {
      case 'approved':
        return { badge: 'bg-green-50 text-green-600 border border-green-200', label: 'APPROVED' };
      case 'in_review':
        return { badge: 'bg-blue-50 text-blue-600 border border-blue-200', label: 'IN REVIEW' };
      case 'draft':
        return { badge: 'bg-yellow-50 text-yellow-600 border border-yellow-200', label: 'DRAFT' };
      case 'archived':
        return { badge: 'bg-gray-100 text-gray-600 border border-gray-200', label: 'ARCHIVED' };
      default: {
        const exhaustiveCheck: never = normalizedStatus;
        return {
          badge: 'bg-gray-50 text-gray-600 border border-gray-200',
          label: String(status).toUpperCase().replace('_', ' ')
        };
      }
    }
  };

  const statusConfig = getStatusConfig(doc.status);

  return (
    <div
      onClick={() => window.location.href = `/documents/${doc.id}`}
      className="bg-white rounded-xl p-4 transition-all duration-300 cursor-pointer text-gray-800 hover:shadow-lg hover:-translate-y-0.5 border border-[#d0d5dd] relative hover:z-50 h-full group"
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-2 mb-3">
        <div className="pr-2 flex flex-col">
          {/* Project Name */}
          <span className="text-sm font-bold text-gray-900 line-clamp-1 mb-0.5" title={doc.project_name}>
            {doc.project_name || 'General'}
          </span>
          {/* Document Name */}
          <span className="text-xs font-medium text-gray-600 line-clamp-2" title={doc.name}>
            {doc.name}
          </span>
        </div>
        <div className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
          {formatRelativeTime(doc.updated_at)}
        </div>
      </div>

      {/* Details Section */}
      <div className="space-y-1 text-xs text-gray-500 mb-6">
        <div className="flex items-center">
          <FileText className="w-3 h-3 mr-1" />
          <span className="font-medium">Type:</span>
          <span className="ml-1 uppercase">{doc.file_type}</span>
        </div>
      </div>

      {/* Trash Button */}
      <button
        onClick={(e) => onDeleteClick(e, doc)}
        className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
        title="Delete Document"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Status Badge */}
      <div className="absolute bottom-3 right-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${statusConfig.badge}`}>
          {statusConfig.label}
        </span>
      </div>
    </div>
  );
}