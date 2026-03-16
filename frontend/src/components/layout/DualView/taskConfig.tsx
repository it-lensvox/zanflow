import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, CheckSquare, Clock, PlayCircle, Pause,
  Eye, AlertCircle, CheckCircle, ListTodo
} from 'lucide-react';
import type { Task } from '@/types';
import type { TableColumn } from '@/components/layout/DualView/TableView';
import { taskApi } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { formatRelativeTime } from '@/lib/utils';
import { TablePopover } from '@/components/common';

// Utility function to format dates
const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

// Status configuration
export const getStatusConfig = (status: Task['status']) => {
  const normalizedStatus = status.toUpperCase();
  switch (normalizedStatus) {
    case 'PENDING':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-800',
        badge: 'bg-yellow-50 text-yellow-600 border border-yellow-200',
        cardClass: 'card-pending',
        label: 'PENDING',
        icon: Clock,
        color: '#f59e0b',
      };
    case 'BACKLOG':
      return {
        bg: 'bg-orange-50',
        text: 'text-orange-800',
        badge: 'bg-orange-50 text-orange-600 border border-orange-200',
        cardClass: 'card-backlog',
        label: 'BACKLOG',
        icon: ListTodo,
        color: '#f97316',
      };
    case 'IN_PROGRESS':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        badge: 'bg-blue-50 text-blue-600 border border-blue-200',
        cardClass: 'card-in-progress',
        label: 'IN PROGRESS',
        icon: PlayCircle,
        color: '#3b82f6',
      };
    case 'COMPLETED':
      return {
        bg: 'bg-green-50',
        text: 'text-green-800',
        badge: 'bg-green-50 text-green-600 border border-green-200',
        cardClass: 'card-completed',
        label: 'COMPLETED',
        icon: CheckCircle,
        color: '#22c55e',
      };
    case 'DEPLOYED':
      return {
        bg: 'bg-purple-50',
        text: 'text-purple-800',
        badge: 'bg-purple-50 text-purple-600 border border-purple-200',
        cardClass: 'card-deployed',
        label: 'DEPLOYED',
        icon: CheckSquare,
        color: '#8b5cf6',
      };
    case 'DEFERRED':
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-800',
        badge: 'bg-gray-100 text-gray-600 border border-gray-200',
        cardClass: 'card-deferred',
        label: 'DEFERRED',
        icon: Pause,
        color: '#6b7280',
      };
    case 'REVIEW':
      return {
        bg: 'bg-indigo-50',
        text: 'text-indigo-800',
        badge: 'bg-indigo-100 text-indigo-600 border border-indigo-200',
        cardClass: 'card-review',
        label: 'REVIEW',
        icon: Eye,
        color: '#6366f1',
      };
    default:
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-800',
        badge: 'bg-gray-100 text-gray-600 border border-gray-200',
        cardClass: 'card-gray',
        label: normalizedStatus,
        icon: AlertCircle,
        color: '#9ca3af',
      };
  }
};

// Priority options
export const priorityOptions = [
  { value: 'critical', label: 'Critical', color: 'text-red-700', dotColor: 'bg-red-700', icon: '🚨' },
  { value: 'high', label: 'High', color: 'text-red-600', dotColor: 'bg-red-500', icon: '🔴' },
  { value: 'medium', label: 'Medium', color: 'text-orange-600', dotColor: 'bg-orange-200', icon: '🟡' },
  { value: 'low', label: 'Low', color: 'text-green-600', dotColor: 'bg-green-500', icon: '🟢' },
];

// Status options
export const statusOptions = [
  { value: 'pending', label: 'PENDING', icon: Clock },
  { value: 'backlog', label: 'BACKLOG', icon: ListTodo },
  { value: 'in_progress', label: 'IN PROGRESS', icon: PlayCircle },
  { value: 'completed', label: 'COMPLETED', icon: CheckCircle },
  { value: 'deployed', label: 'DEPLOYED', icon: CheckSquare },
  { value: 'deferred', label: 'DEFERRED', icon: Pause },
  { value: 'review', label: 'REVIEW', icon: Eye },
];

// Grid Card Component
interface TaskGridCardProps {
  task: Task;
  onTaskClick: (task: Task) => void;
}

export function TaskGridCard({ task, onTaskClick }: TaskGridCardProps) {
  const statusConfig = getStatusConfig(task.status);

  return (
    <div
      onClick={() => onTaskClick(task)}
      className={`${statusConfig.cardClass} rounded-xl p-4 transition-all duration-300 cursor-pointer text-gray-800 hover:shadow-lg hover:-translate-y-0.5 border border-[#d0d5dd] relative hover:z-50 h-full group bg-white`}
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-2 mb-3">
        <div className="pr-2 flex flex-col">
          {/* Project Name */}
          <span className="text-sm font-bold text-gray-700 line-clamp-1 mb-0.5" title={task.project_details?.name || task.project_name || undefined}>
            {task.project_details?.name || task.project_name || 'No Project'}
          </span>
          {/* Task Heading */}
          <span className="text-xs font-medium text-gray-600 line-clamp-2" title={task.heading}>
            {task.heading || 'No Task'}
          </span>
        </div>
        {task.updated_at && (
          <div className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
            {formatRelativeTime(task.updated_at)}
          </div>
        )}
      </div>

      {/* Details Section */}
      <div className="space-y-1 text-xs text-gray-500 mb-6">
        <div className="flex items-center">
          <Calendar className="w-3 h-3 mr-1" />
          <span className="font-medium">Due:</span>
          <span className="ml-1">{formatDate(task.end_date)}</span>
        </div>

        {/* Assigned */}
        <div
          className="flex items-center relative group/assigned cursor-pointer hover:text-blue-600 transition-colors w-max"
          onClick={(e) => e.stopPropagation()}
        >
          <Users className="w-3 h-3 mr-1" />
          <span className="font-medium">Assigned:</span>
          <span className="ml-1 font-bold">{task.assigned_to.length}</span>

          {/* Hover Dropdown */}
          <div className="absolute top-full left-0 mt-1 hidden group-hover/assigned:block z-50 min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-xl p-2 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto">
              {task.assigned_to_user_details && task.assigned_to_user_details.length > 0 ? (
                task.assigned_to_user_details.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold text-blue-700 shrink-0">
                      {u.first_name[0]}{u.last_name?.[0]}
                    </div>
                    <span className="text-[11px] font-medium text-gray-700 truncate">
                      {u.first_name} {u.last_name}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-[11px] text-gray-400 px-1 italic">No users assigned</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="absolute bottom-3 right-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${statusConfig.badge}`}>
          {statusConfig.label}
        </span>
      </div>
    </div>
  );
}

// Table Columns Configuration
interface TaskTableColumnsProps {
  onTaskClick: (task: Task) => void;
  queryClient: ReturnType<typeof useQueryClient>;
  user: ReturnType<typeof useAuth>['user'];
  navigate: ReturnType<typeof useNavigate>;
}

export const createTasksTableColumns = ({ onTaskClick, queryClient, user, navigate, dateField = 'end_date' }: TaskTableColumnsProps & { dateField?: 'end_date' | 'start_date' | 'created_at' }): TableColumn<Task>[] => {

  // Status Dropdown Component
  const StatusDropdown = ({ task }: { task: Task }) => {
    const [activeDropdown, setActiveDropdown] = useState(false);
    const statusConfig = getStatusConfig(task.status);

    const handleStatusChange = async (newStatus: string) => {
      try {
        await taskApi.update(task.id, { status: newStatus } as any);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        setActiveDropdown(false);
      } catch (error) {
        console.error('Failed to update status:', error);
      }
    };

    const trigger = (
      <div
        className={`px-2.5 py-1 rounded text-[11px] font-medium ${statusConfig.bg} ${statusConfig.text} cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1`}
      >
        <span>{statusConfig.label}</span>
      </div>
    );

    return (
      <TablePopover
        trigger={trigger}
        width="min-w-[140px]"
        estimatedHeight={200}
        open={activeDropdown}
        onOpen={() => setActiveDropdown(true)}
        onClose={() => setActiveDropdown(false)}
      >
        <div className="max-h-[200px] overflow-y-auto py-1">
          {statusOptions.map((option) => {
            const optionConfig = getStatusConfig(option.value);
            const textColor = optionConfig.badge.split(' ').find(cls => cls.startsWith('text-')) || optionConfig.text;

            return (
              <div
                key={option.value}
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-[12px] flex items-center gap-2"
                onClick={() => handleStatusChange(option.value)}
              >
                {React.createElement(option.icon, { className: `w-3.5 h-3.5 ${textColor}` })}
                <span className={`${task.status === option.value ? "font-bold" : "font-medium"} ${textColor}`}>
                  {option.label}
                </span>
                {task.status === option.value && (
                  <svg className={`w-3.5 h-3.5 ml-auto ${textColor}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </TablePopover>
    );
  };

  // Priority Dropdown Component
  const PriorityDropdown = ({ task }: { task: Task }) => {
    const [activeDropdown, setActiveDropdown] = useState(false);
    const priorityOption = priorityOptions.find(opt => opt.value === task.priority);

    const handlePriorityChange = async (newPriority: string) => {
      try {
        await taskApi.update(task.id, { priority: newPriority } as any);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        setActiveDropdown(false);
      } catch (error) {
        console.error('Failed to update priority:', error);
      }
    };

    const trigger = (
      <div className="flex items-center gap-1.5 text-gray-600 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors">
        <div className={`h-1 w-3 rounded-full ${priorityOption?.dotColor || 'bg-gray-400'}`} />
        <span className="capitalize text-[12px]">{task.priority || 'None'}</span>
      </div>
    );

    return (
      <TablePopover
        trigger={trigger}
        width="w-32"
        estimatedHeight={180}
        open={activeDropdown}
        onOpen={() => setActiveDropdown(true)}
        onClose={() => setActiveDropdown(false)}
      >
        <div className="py-1">
          {priorityOptions.map((option) => (
            <div
              key={option.value}
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-[12px] flex items-center gap-2"
              onClick={() => handlePriorityChange(option.value)}
            >
              <span>{option.icon}</span>
              <span className={task.priority === option.value ? "font-bold text-blue-600" : ""}>
                {option.label}
              </span>
            </div>
          ))}
        </div>
      </TablePopover>
    );
  };

  // Date Input Component
  const DateInput = ({ task, field }: { task: Task; field: 'start_date' | 'end_date' }) => {
    const handleDateChange = async (value: string, e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.type === 'blur') {
        e.stopPropagation();
      }
      if (!value) return;

      try {
        await taskApi.update(task.id, { [field]: `${value}T12:00:00Z` });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } catch (error) {
        console.error('Failed to update date:', error);
      }
    };

    return (
      <div className="border rounded px-1.5 py-1 bg-white hover:border-blue-400 transition-all" onClick={(e) => e.stopPropagation()}>
        {user?.role === 'admin' || user?.role === 'manager' ? (
          <input
            type="date"
            value={task[field]?.split('T')[0] || ''}
            onChange={(e) => handleDateChange(e.target.value, e)}
            className="border-none bg-transparent text-[11px] p-0 cursor-pointer w-full text-[#172b4d] font-medium focus:outline-none"
            style={{
              colorScheme: 'light'
            }}
          />
        ) : (
          <span className="text-[11px] text-[#172b4d] font-medium py-0.5">
            {formatDate(task[field])}
          </span>
        )}
      </div>
    );
  };

  return [
    {
      key: 'type',
      label: <span className="text-[14px] font-bold  tracking-wide text-gray-700">Type</span>,
      width: '8%',
      render: (task: Task) => (
        <div className="flex items-center gap-1.5">
          <CheckSquare className="w-4 h-4 text-blue-600" />
        </div>
      ),
    },
    {
      key: 'project',
      label: <span className="text-[14px] font-bold  tracking-wide text-gray-700">Project</span>,
      width: '150px',
      render: (task: Task) => (
        <span className="text-[12px] text-gray-700 font-medium">
          {task.project_details?.name || task.project_name || 'No Project'}
        </span>
      ),
    },
    {
      key: 'heading',
      label: <span className="text-[14px] font-bold  tracking-wide text-gray-700">Task Title</span>,
      width: '25%',
      render: (task: Task) => (
        <span className="font-medium text-[#172b4d] truncate block max-w-[300px]" title={task.heading}>
          {task.heading}
        </span>
      ),
    },
    {
      key: 'status',
      label: <span className="text-[14px] font-bold  tracking-wide text-gray-700">Status</span>,
      width: '10%',
      render: (task: Task) => <StatusDropdown task={task} />,
    },
    {
      key: 'assigned_to',
      label: <span className="text-[14px] font-bold  tracking-wide text-gray-700">Assignee</span>,
      width: '10%',
      render: (task: Task) => {
        const trigger = (
          <div className="flex -space-x-1.5 cursor-pointer hover:opacity-80">
            {task.assigned_to_user_details.length > 0 ? (
              <>
                {task.assigned_to_user_details.slice(0, 3).map((u) => (
                  <div
                    key={u.id}
                    className="w-6 h-6 rounded-full bg-[#8d87b5] text-white flex items-center justify-center text-[10px] font-semibold ring-1 ring-white"
                    title={`${u.first_name} ${u.last_name}`}
                  >
                    {u.first_name[0]}{u.last_name[0]}
                  </div>
                ))}
                {task.assigned_to_user_details.length > 3 && (
                  <div
                    className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-[10px] font-semibold ring-1 ring-white"
                    title={`+${task.assigned_to_user_details.length - 3} more`}
                  >
                    +{task.assigned_to_user_details.length - 3}
                  </div>
                )}
              </>
            ) : (
              <span className="text-gray-300 text-[11px] pl-1">—</span>
            )}
          </div>
        );

        return (
          <TablePopover trigger={trigger}>
            <div className="p-2 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-lg">
              <span className="text-xs font-semibold text-gray-700">Assignees</span>
              <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                {task.assigned_to_user_details.length}
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {task.assigned_to_user_details.length > 0 ? (
                task.assigned_to_user_details.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded">
                    <div className="w-6 h-6 rounded-full bg-[#8d87b5] text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                      {u.first_name[0]}{u.last_name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-gray-700 truncate">{u.first_name} {u.last_name}</p>
                      <p className="text-[10px] text-gray-400 truncate capitalize">{u.role}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-2 text-center text-xs text-gray-400 italic">No assignees</div>
              )}
            </div>
          </TablePopover>
        );
      },
    },
    {
      key: 'priority',
      label: <span className="text-[14px] font-bold  tracking-wide text-gray-700">Priority</span>,
      width: '10%',
      render: (task: Task) => <PriorityDropdown task={task} />,
    },
    {
      key: 'labels',
      label: <span className="text-[14px] font-bold  tracking-wide text-gray-700">Labels</span>,
      width: '10%',
      render: (task: Task) => (
        <div className="flex flex-wrap gap-1.5 items-center h-full min-h-[24px]" onClick={(e) => e.stopPropagation()}>
          {task.labels && task.labels.length > 0 ? (
            task.labels.map((label) => (
              <span
                key={label.id}
                className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm whitespace-nowrap"
                style={{ backgroundColor: label.color || '#3b82f6' }}
              >
                {label.name}
              </span>
            ))
          ) : (
            <span className="text-gray-300 text-[11px] pl-1">—</span>
          )}
        </div>
      ),
    },
    {
      key: dateField,
      label: <span className="text-[14px] font-bold tracking-wide text-gray-700">{dateField === 'end_date' ? 'Due Date' : dateField === 'start_date' ? 'Start Date' : 'Created At'}</span>,
      width: '10%',
      render: (task: Task) =>
        dateField === 'created_at'
          ? <span className="text-[13px] text-gray-600 pl-1">{formatDate(task.created_at || '')}</span>
          : <DateInput task={task} field={dateField as 'start_date' | 'end_date'} />,
    },
    {
      key: 'duration',
      label: <span className="text-[14px] font-bold  tracking-wide text-gray-700">Duration</span>,
      width: '15%',
      render: (task: Task) => (
        <input
          type="text"
          defaultValue={(task as any).duration_time || (task as any).duration || ''}
          placeholder="—"
          onBlur={async (e) => {
            const val = e.target.value;
            try {
              await taskApi.update(task.id, { duration_time: val } as any);
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
            } catch (err) {
              console.error('Failed to update duration:', err);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full bg-transparent border-none text-[12px] focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5 placeholder-gray-300"
        />
      ),
    },
  ];
};