import React from 'react';
import { GridView, GridViewProps } from './GridView';
import { TableView, TableViewProps } from './TableView';
import { ViewMode } from './useViewMode';

interface DualViewProps<T> {
  viewMode: ViewMode;
  gridProps: Omit<GridViewProps<T>, 'isLoading'>;
  tableProps: Omit<TableViewProps<T>, 'isLoading'>;
  isLoading?: boolean;
}

export function DualView<T>({
  viewMode,
  gridProps,
  tableProps,
  isLoading = false,
}: DualViewProps<T>) {
  if (viewMode === 'grid') {
    return <GridView {...gridProps} isLoading={isLoading} />;
  }

  return <TableView {...tableProps} isLoading={isLoading} />;
}