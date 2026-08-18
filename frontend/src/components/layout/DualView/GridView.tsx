import React from 'react';
import { Card, CardContent } from '@/components/common';

export interface GridViewProps<T> {
  data: T[];
  renderCard: (item: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  gridClassName?: string;
}

export function GridView<T>({
  data,
  renderCard,
  emptyState,
  isLoading = false,
  className = '',
  gridClassName = 'grid gap-4 md:grid-cols-2 lg:grid-cols-3',
}: GridViewProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-0">
          {emptyState || (
            <div className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-medium">No data found</h3>
              <p className="text-muted-foreground">
                There are no items to display
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={gridClassName}>
      {data.map((item) => renderCard(item))}
    </div>
  );
}