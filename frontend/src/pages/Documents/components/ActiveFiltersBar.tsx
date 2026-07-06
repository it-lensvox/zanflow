import { X } from 'lucide-react';

interface ActiveFiltersBarProps {
  projectFilter:  string;
  projectName:    string;
  statusFilter:   string;
  fileTypeFilter: string;
  searchTerm:     string;
  ownerFilter?:   string;
  ownerName?:     string;
  onClearAll:     () => void;
  onRemoveFilter: (k: string) => void;
}

function getOwnerAvatar(name: string) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'SY';
  const avatarColors = ['#7C3AED','#EF4444','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6','#F97316','#14B8A6','#6366F1'];
  const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length;
  return { initials, color: avatarColors[colorIndex] };
}

export function ActiveFiltersBar({ projectFilter, projectName, statusFilter, fileTypeFilter, searchTerm, ownerFilter, ownerName, onClearAll, onRemoveFilter }: ActiveFiltersBarProps) {
  if (!(projectFilter || statusFilter || fileTypeFilter || searchTerm || ownerFilter)) return null;

  return (
    <div className="flex items-center gap-2 px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 py-3" style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
      <span style={{ fontWeight: 600, fontSize: 13, color: '#1a1a1a' }}>Active Filters:</span>

      {projectFilter && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium" style={{ background: '#DBEAFE', color: '#2563EB' }}>
          Project: {projectName}
          <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100 ml-1" onClick={() => onRemoveFilter('project')} />
        </span>
      )}
      {statusFilter && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium" style={{ background: '#FFF4E6', color: '#D97706' }}>
          Status: {statusFilter.replace('_', ' ')}
          <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100 ml-1" onClick={() => onRemoveFilter('status')} />
        </span>
      )}
      {fileTypeFilter && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium" style={{ background: '#F3E8FF', color: '#7C3AED' }}>
          Type: {fileTypeFilter.toUpperCase()}
          <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100 ml-1" onClick={() => onRemoveFilter('file_type')} />
        </span>
      )}
      {ownerFilter && ownerName && (() => {
        const avatar = getOwnerAvatar(ownerName);
        return (
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[13px] font-medium" style={{ background: '#F3F4F6', color: '#1a1a1a' }}>
            Owner:
            <div className="rounded-full flex items-center justify-center text-white font-semibold" style={{ width: 20, height: 20, backgroundColor: avatar.color, fontSize: 9, fontWeight: 600 }} title={ownerName}>
              {avatar.initials}
            </div>
            <span>{ownerName}</span>
            <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100 ml-1" onClick={() => onRemoveFilter('owner')} />
          </span>
        );
      })()}
      {searchTerm && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium" style={{ background: '#D1FAE5', color: '#059669' }}>
          Search: "{searchTerm}"
          <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100 ml-1" onClick={() => onRemoveFilter('search')} />
        </span>
      )}
      <span className="cursor-pointer ml-1" style={{ color: '#4169FF', fontWeight: 500, fontSize: 13 }} onClick={onClearAll}>
        Clear all
      </span>
    </div>
  );
}