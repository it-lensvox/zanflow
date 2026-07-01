import React from 'react';

export interface TableColumn<T> {
  key: string;
  label: React.ReactNode;
  width?: string;
  className?: string;
  render?: (item: T, index: number) => React.ReactNode;
  headerClassName?: string;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface FilterState {
  [key: string]: string | string[];
}
export interface OpenFilter {
  key: string;
  type: 'search' | 'list' | 'date';
}

export interface TableViewProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  rowKey: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  onRowMouseEnter?: (item: T) => void;
  onSort?: (key: string) => void;
  onFilter?: (key: string) => void;
  activeFilterKey?: string | null;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  rowClassName?: (item: T) => string;
  maxHeight?: string | number;
  rowProps?: (item: T) => React.HTMLAttributes<HTMLTableRowElement>; 
}

export function TableView<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  onRowMouseEnter,
  onSort,
  onFilter,
  activeFilterKey,
  className = '',
  rowClassName,
  maxHeight = '70vh',
  rowProps,
}: TableViewProps<T>) {
  return (
    <div
      className={`bg-white border border-[#dfe1e6] rounded-md shadow-sm font-sans text-[13px] ${className}`}
      style={{
        overflowX: 'auto',
        overflowY: 'auto',
        maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
        WebkitOverflowScrolling: 'touch' as any,
      }}
    >
      <table
        className="border-collapse w-full"
        style={{ width: '100%', tableLayout: 'fixed', minWidth: '1000px' }}
      >
        {/* Sticky header */}
        <thead className="sticky top-0 z-20">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`group/header text-left py-[12px] px-3 font-extrabold text-[13px] text-[#172033] bg-[#fafbfc] border-b border-r border-[#dfe1e6] last:border-r-0 whitespace-nowrap relative ${activeFilterKey === column.key ? 'z-[100]' : ''} ${column.headerClassName || ''}`}
                style={column.width ? { width: column.width } : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">{column.label}</div>
                  <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
                    {onSort && (
                      <button
                        className="hover:bg-gray-200 p-0.5 rounded transition-colors"
                        onClick={(e) => { e.stopPropagation(); onSort(column.key); }}
                      >
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                      </button>
                    )}
                    {onFilter && (
                      <button
                        className="hover:bg-gray-200 p-0.5 rounded transition-colors"
                        onClick={(e) => { e.stopPropagation(); onFilter(column.key); }}
                      >
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {data.map((item, index) => {
            const customRowProps = rowProps ? rowProps(item) : {};
            const customClassName = customRowProps.className || '';
            return (
              <tr
                key={rowKey(item)}
                onClick={() => onRowClick?.(item)}
                onMouseEnter={() => onRowMouseEnter?.(item)}
                {...customRowProps}
                className={`group border-b border-[#f4f5f7] last:border-b-0 hover:bg-[#f4f5f7] transition-colors cursor-pointer relative hover:z-[50] ${rowClassName ? rowClassName(item) : ''} ${customClassName}`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`py-3 px-3 h-14 align-middle text-[14px] border-r border-[#f4f5f7] group-hover:border-r-[#dfe1e6] last:border-r-0 relative ${column.className || ''}`}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.render ? column.render(item, index) : (item as any)[column.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}