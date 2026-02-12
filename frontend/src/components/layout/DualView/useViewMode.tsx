import { useState, useCallback } from 'react';

export type ViewMode = 'grid' | 'table';

interface UseViewModeOptions {
  defaultMode?: ViewMode;
  storageKey?: string;
}

export function useViewMode({ 
  defaultMode = 'grid', 
  storageKey 
}: UseViewModeOptions = {}) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (storageKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'grid' || stored === 'table') {
        return stored;
      }
    }
    return defaultMode;
  });

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, mode);
    }
  }, [storageKey]);

  return { viewMode, setViewMode };
}