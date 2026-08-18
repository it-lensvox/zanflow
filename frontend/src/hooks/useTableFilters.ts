import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

export interface FilterableItem {
  [key: string]: any;
}


export interface ColumnFilterConfig {
  key: string;
  type: 'search' | 'list' | 'date' | 'none';
  searchFields?: string[];
  listOptions?: Array<{ value: string; label: string }>;
}


export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc' | null;
}


export interface ColumnFilters {
  [key: string]: string;
}


export interface UseTableFiltersOptions<T extends FilterableItem> {
  data: T[];
  columns: ColumnFilterConfig[];
  globalSearchFields?: string[];
  initialSort?: SortConfig;
  onFilterChange?: (filters: ColumnFilters) => void;
  onSortChange?: (sort: SortConfig) => void;
}


export interface UseTableFiltersReturn<T extends FilterableItem> {

  filteredData: T[];

  sortConfig: SortConfig;
  handleSort: (key: string) => void;


  columnFilters: ColumnFilters;
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFilters>>;
  clearFilter: (key: string) => void;
  clearAllFilters: () => void;


  activeFilterKey: string | null;
  setActiveFilterKey: React.Dispatch<React.SetStateAction<string | null>>;


  globalSearch: string;
  setGlobalSearch: React.Dispatch<React.SetStateAction<string>>;

  filterContainerRef: React.RefObject<HTMLDivElement>;
}

export function useTableFilters<T extends FilterableItem>({
  data,
  columns,
  globalSearchFields = [],
  initialSort = { key: '', direction: null },
  onFilterChange,
  onSortChange,
}: UseTableFiltersOptions<T>): UseTableFiltersReturn<T> {
  // State management
  const [sortConfig, setSortConfig] = useState<SortConfig>(initialSort);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [activeFilterKey, setActiveFilterKey] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const filterContainerRef = useRef<HTMLDivElement>(null);

  // Auto-close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterContainerRef.current &&
        !filterContainerRef.current.contains(event.target as Node)
      ) {
        setActiveFilterKey(null);
      }
    };

    if (activeFilterKey) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeFilterKey]);

  useEffect(() => {
    onFilterChange?.(columnFilters);
  }, [columnFilters, onFilterChange]);


  useEffect(() => {
    onSortChange?.(sortConfig);
  }, [sortConfig, onSortChange]);

  const getNestedValue = useCallback((obj: any, path: string | string[]): any => {
    const keys = Array.isArray(path) ? path : path.split('.');
    return keys.reduce((value, key) => value?.[key], obj);
  }, []);

  /**
   * Handle sorting
   */
  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        const newDirection =
          prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc';
        return { key: newDirection ? key : '', direction: newDirection };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const clearFilter = useCallback((key: string) => {
    setColumnFilters((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setColumnFilters({});
    setGlobalSearch('');
  }, []);

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply global search
    if (globalSearch.trim() !== '') {
      const searchLower = globalSearch.toLowerCase();
      result = result.filter((item) =>
        globalSearchFields.some((field) => {
          const value = getNestedValue(item, field);
          return String(value || '').toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply column-specific filters
    result = result.filter((item) => {
      return Object.entries(columnFilters).every(([key, filterValue]) => {
        if (!filterValue) return true;

        // Find column configuration
        const column = columns.find((col) => col.key === key);
        if (!column) return true;

        const filterLower = filterValue.toLowerCase();

        // Handle search-type filters
        if (column.type === 'search') {
          if (column.searchFields) {
            const value = getNestedValue(item, column.searchFields);
            return String(value || '').toLowerCase().startsWith(filterLower);
          } else {
            const value = item[key];
            return String(value || '').toLowerCase().startsWith(filterLower);
          }
        }

        // Handle list-type filters
        if (column.type === 'list') {
          const itemValue = String(item[key] || '').toLowerCase();
          return itemValue === filterLower;
        }

        // Handle date-type filters
        if (column.type === 'date') {
          const itemDate = item[key]?.split('T')[0];
          return itemDate === filterValue;
        }

        // Default: contains match
        const itemValue = String(item[key] || '').toLowerCase();
        return itemValue.includes(filterLower);
      });
    });

    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const column = columns.find((col) => col.key === sortConfig.key);

        let valA: any;
        let valB: any;

        if (column?.searchFields) {
          valA = getNestedValue(a, column.searchFields);
          valB = getNestedValue(b, column.searchFields);
        } else {
          valA = a[sortConfig.key];
          valB = b[sortConfig.key];
        }

        // Handle date sorting
        if (sortConfig.key.includes('date') || valA instanceof Date || valB instanceof Date) {
          valA = new Date(valA || 0).getTime();
          valB = new Date(valB || 0).getTime();
        }

        // Handle number sorting
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }

        // Handle string sorting
        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();

        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, globalSearch, globalSearchFields, columnFilters, columns, sortConfig, getNestedValue]);

  return {
    filteredData,
    sortConfig,
    handleSort,
    columnFilters,
    setColumnFilters,
    clearFilter,
    clearAllFilters,
    activeFilterKey,
    setActiveFilterKey,
    globalSearch,
    setGlobalSearch,
    filterContainerRef,
  };
}