import React from 'react';
import { FileText, Clock, CheckCircle, File } from 'lucide-react';
import type { Document } from '@/types';

interface DocumentStatsSidebarProps {
  documents: Document[];
  currentFilter: string;
  onFilterChange: (status: string) => void;
}

export function DocumentStatsSidebar({ documents, currentFilter, onFilterChange }: DocumentStatsSidebarProps) {
  // Calculate counts based on current document list (ignoring search filter for pure stats if needed, 
  // but usually stats reflect the broad dataset available to the page)
  const stats = {
    total: documents.length,
    draft: documents.filter(d => d.status === 'draft').length,
    inReview: documents.filter(d => d.status === 'in_review').length,
    approved: documents.filter(d => d.status === 'approved').length,
  };

  const statItems = [
    { 
      label: 'Total Documents', 
      val: stats.total, 
      filter: '', 
      icon: FileText,
      color: 'text-gray-900', 
      bgColor: 'bg-gray-50', 
      iconColor: 'text-gray-400',
      activeRing: 'ring-gray-400'
    },
    { 
      label: 'Draft', 
      val: stats.draft, 
      filter: 'draft', 
      icon: File,
      color: 'text-yellow-600', 
      bgColor: 'bg-yellow-50', 
      iconColor: 'text-yellow-500',
      activeRing: 'ring-yellow-500'
    },
    { 
      label: 'In Review', 
      val: stats.inReview, 
      filter: 'in_review', 
      icon: Clock,
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50', 
      iconColor: 'text-blue-500',
      activeRing: 'ring-blue-500'
    },
    { 
      label: 'Approved', 
      val: stats.approved, 
      filter: 'approved', 
      icon: CheckCircle,
      color: 'text-green-600', 
      bgColor: 'bg-green-50', 
      iconColor: 'text-green-500',
      activeRing: 'ring-green-500'
    },
  ];

  return (
    <div className="w-[280px] min-w-[280px] bg-white border-l border-[#e5e7eb] p-6 fixed right-0 top-0 h-screen overflow-y-auto z-10 hidden lg:block">
      <h3 className="text-base font-semibold text-gray-800 mb-5">FILTER BY STATUS</h3>
      <div className="flex flex-col gap-2">
        {statItems.map((item) => {
          const isActive = currentFilter === item.filter;
          const Icon = item.icon;
          
          return (
            <div
              key={item.label}
              onClick={() => onFilterChange(item.filter)}
              className={`
                flex items-center justify-between px-4 py-3.5 rounded-[10px] cursor-pointer transition-all duration-200 border border-transparent
                ${item.bgColor}
                ${isActive ? `ring-2 ${item.activeRing} shadow-md` : 'hover:shadow-md hover:border-gray-100'}
              `}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-[18px] h-[18px] ${item.iconColor}`} />
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
              <div className={`text-base font-bold ${item.color}`}>
                {item.val}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}