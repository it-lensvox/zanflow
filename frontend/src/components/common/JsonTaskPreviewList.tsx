import React, { useState } from 'react';
import { CheckCircle, Trash2, Users } from 'lucide-react';
import { priorityOptions, getStatusConfig } from '@/components/layout/DualView/taskConfig';
import type { PreviewTask } from '@/hooks/useJsonPreview';

interface JsonTaskPreviewListProps {
  tasks: PreviewTask[];
  onDelete: (index: number) => void;
}

export function JsonTaskPreviewList({ tasks, onDelete }: JsonTaskPreviewListProps) {
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);

  if (tasks.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {/* Count badge */}
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <span className="text-xs font-semibold text-green-700">
          {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'} Detected
        </span>
      </div>

      {/* Preview cards */}
      <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
        {tasks.map((task, index) => {
          const priorityConfig = priorityOptions.find(
            (p) => p.value === task.priority?.toLowerCase()
          );
          const statusConfig = task.status
            ? getStatusConfig(task.status as any)
            : null;
          const emails = task.assignee_emails ?? [];
          const hasMultiple = emails.length > 1;

          return (
            <div
              key={index}
              className="bg-[#f8fafc] border border-gray-200 rounded-lg px-3 py-2.5 flex items-center gap-2"
            >
              {/* Left: heading + badges */}
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-800 truncate">
                  {task.heading}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  {priorityConfig && (
                    <span className={`text-[11px] font-medium ${priorityConfig.color} flex items-center gap-1`}>
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${priorityConfig.dotColor}`} />
                      {priorityConfig.label}
                    </span>
                  )}
                  {statusConfig && (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusConfig.badge}`}>
                      {statusConfig.label}
                    </span>
                  )}

                  {/* Assignee emails */}
                  {emails.length === 1 && (
                    <span className="text-[11px] text-gray-400 truncate max-w-[160px]">
                      {emails[0]}
                    </span>
                  )}
                  {hasMultiple && (
                    <div className="relative">
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[11px] text-[#65408b] font-medium hover:underline focus:outline-none"
                        onMouseEnter={() => setTooltipIndex(index)}
                        onMouseLeave={() => setTooltipIndex(null)}
                      >
                        <Users className="w-3 h-3" />
                        {emails.length} assignees
                      </button>

                      {/* Tooltip */}
                      {tooltipIndex === index && (
                        <div className="absolute left-0 top-5 z-50 bg-gray-900 text-white text-[11px] rounded-lg shadow-lg px-3 py-2 flex flex-col gap-1 min-w-[180px]">
                          {emails.map((email, i) => (
                            <span key={i} className="truncate">{email}</span>
                          ))}
                          {/* Tooltip arrow */}
                          <span className="absolute -top-1.5 left-3 w-3 h-3 bg-gray-900 rotate-45 rounded-sm" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: delete button */}
              <button
                type="button"
                onClick={() => onDelete(index)}
                aria-label={`Remove task "${task.heading}"`}
                className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}