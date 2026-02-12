import React from 'react';

interface Column<T> {
  header: string;
  key: string;
  className?: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
}

export function DataTable<T extends { id: number | string }>({ 
  data, 
  columns, 
  onRowClick,
  isLoading 
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="jira-list-container bg-white border border-[#dfe1e6] rounded-md overflow-x-auto shadow-sm">
      <table className="jira-list-table w-full border-collapse">
        <thead>
          <tr className="bg-[#fafbfc]">
            {columns.map((col, index) => (
              <th 
                key={col.key} 
                className={`jira-th border-[#dfe1e6] ${index !== columns.length - 1 ? 'border-r' : ''} ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr 
              key={item.id} 
              className="jira-table-row group hover:bg-[#f4f5f7] cursor-pointer"
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col, index) => (
                <td 
                  key={col.key} 
                  className={`jira-td border-[#f4f5f7] ${index !== columns.length - 1 ? 'border-r' : ''}`}
                >
                  {col.render ? col.render(item) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}