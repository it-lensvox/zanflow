import { Grid3X3, List } from 'lucide-react';

export type ViewMode = 'grid' | 'table';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ viewMode, onViewModeChange, className = '' }: ViewToggleProps) {
  return (
    <div className={`flex rounded-lg border overflow-hidden ${className}`}>
      <button
        onClick={() => onViewModeChange('table')}
        className={`p-2 transition-colors ${
          viewMode === 'table' 
            ? 'bg-blue-600 text-white' 
            : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
        aria-label="Table view"
      >
        <List className="w-5 h-5" />
      </button>
      <button
        onClick={() => onViewModeChange('grid')}
        className={`p-2 transition-colors ${
          viewMode === 'grid' 
            ? 'bg-blue-600 text-white' 
            : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
        aria-label="Grid view"
      >
        <Grid3X3 className="w-5 h-5" />
      </button>
    </div>
  );
}