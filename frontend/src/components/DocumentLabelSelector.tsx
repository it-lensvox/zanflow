import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/common';
import { documentsApi } from '@/services/api';
import type { Label } from '@/types';

interface LabelSelectorProps {
  documentId: string;
  currentLabels: Label[];
  availableLabels: Label[];
}

export function DocumentLabelSelector({ documentId, currentLabels, availableLabels }: LabelSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const queryClient = useQueryClient();

  const addLabelMutation = useMutation({
    mutationFn: (labelId: number) => documentsApi.addLabel(documentId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
    },
  });

  const removeLabelMutation = useMutation({
    mutationFn: (labelId: number) => documentsApi.removeLabel(documentId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
    },
  });

  const currentLabelIds = currentLabels.map((l) => l.id);
  const availableToAdd = availableLabels.filter((l) => !currentLabelIds.includes(l.id));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tag className="h-4 w-4 text-muted-foreground" />
      
      {currentLabels.map((label) => (
        <span
          key={label.id}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: label.color }}
        >
          {label.name}
          <button
            onClick={() => removeLabelMutation.mutate(label.id)}
            className="hover:bg-white/20 rounded-full p-0.5"
            disabled={removeLabelMutation.isPending}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {availableToAdd.length > 0 && (
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Label
          </Button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border rounded-md shadow-lg z-10 min-w-[150px]">
              {availableToAdd.map((label) => (
                <button
                  key={label.id}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => {
                    addLabelMutation.mutate(label.id);
                    setShowDropdown(false);
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {currentLabels.length === 0 && availableToAdd.length === 0 && (
        <span className="text-xs text-muted-foreground">No labels available</span>
      )}
    </div>
  );
}