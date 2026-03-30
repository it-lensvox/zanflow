import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';
import { useQuery, QueryClient } from '@tanstack/react-query';
import { taskApi, projectsApi, usersApi } from '@/services/api';
import { Task, ProjectMinimal } from '@/types';
import type { TableColumn } from '@/components/layout/DualView/TableView';
import { statusOptions, priorityOptions, getStatusConfig } from '@/components/layout/DualView/taskConfig';

interface InlineCreateRowProps {
  columns: TableColumn<Task>[];
  onCancel: () => void;
  queryClient: QueryClient;
  fixedProjectId?: number;
}

interface InlineFormState {
  heading: string;
  selectedProjectId: number | null;
  status: string;
  priority: string;
  assignedTo: number[];
  endDate: string;
  startDate: string;
}

type FieldKey = 'project' | 'heading' | 'status' | 'assignedTo' | 'priority' | 'endDate';

const ALL_FIELD_ORDER: FieldKey[] = ['project', 'heading', 'status', 'assignedTo', 'priority', 'endDate'];

export const InlineCreateRow: React.FC<InlineCreateRowProps> = ({ columns, onCancel, queryClient, fixedProjectId }) => {
  const [form, setForm] = useState<InlineFormState>({
    heading: '',
    selectedProjectId: fixedProjectId ?? null,
    status: 'pending',
    priority: 'medium',
    assignedTo: [],
    endDate: '',
    startDate: '',
  });

  const [activeField, setActiveField] = useState<FieldKey>(fixedProjectId ? 'heading' : 'project');
  const fieldOrder: FieldKey[] = fixedProjectId
    ? ALL_FIELD_ORDER.filter((f) => f !== 'project')
    : ALL_FIELD_ORDER;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown states
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');

  // Refs
  const headingRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Fetch projects
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    staleTime: Infinity,
  });

  const allProjects: ProjectMinimal[] = React.useMemo(() => {
    if (!projectsData) return [];
    return (projectsData as any).results || projectsData || [];
  }, [projectsData]);

  const filteredProjects = React.useMemo(() => {
    if (!projectSearch.trim()) return allProjects;
    const search = projectSearch.toLowerCase();
    return allProjects.filter(p => p.name.toLowerCase().includes(search));
  }, [allProjects, projectSearch]);

  // Fetch users
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    staleTime: Infinity,
  });

  const allUsers = React.useMemo(() => {
    if (!usersData) return [];
    const data = (usersData as any).results || usersData;
    return Array.isArray(data) ? data.map((user: any) => ({
      id: user.id,
      label: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
    })) : [];
  }, [usersData]);

  const filteredUsers = React.useMemo(() => {
    const available = allUsers.filter(u => !form.assignedTo.includes(u.id));
    if (!assigneeSearch.trim()) return available;
    return available.filter(u => u.label.toLowerCase().includes(assigneeSearch.toLowerCase()));
  }, [allUsers, form.assignedTo, assigneeSearch]);

  // Auto-focus first active field on mount
  useEffect(() => {
    setTimeout(() => {
      if (fixedProjectId) {
        headingRef.current?.focus();
      } else {
        projectInputRef.current?.focus();
        setProjectDropdownOpen(true);
      }
    }, 100);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
        setStatusDropdownOpen(false);
        setPriorityDropdownOpen(false);
        setAssigneeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const closeAllDropdowns = useCallback(() => {
    setProjectDropdownOpen(false);
    setStatusDropdownOpen(false);
    setPriorityDropdownOpen(false);
    setAssigneeDropdownOpen(false);
  }, []);

  // Navigate to next field
 const goToNextField = useCallback((currentField: FieldKey) => {
    closeAllDropdowns();
    const currentIndex = fieldOrder.indexOf(currentField);
    if (currentIndex < fieldOrder.length - 1) {
      const nextField = fieldOrder[currentIndex + 1];
      setActiveField(nextField);
      // Focus appropriate element after state update
      setTimeout(() => {
        switch (nextField) {
          case 'heading':
            headingRef.current?.focus();
            break;
          case 'status':
            setStatusDropdownOpen(true);
            break;
          case 'assignedTo':
            setAssigneeDropdownOpen(true);
            break;
          case 'priority':
            setPriorityDropdownOpen(true);
            break;
          case 'endDate':
            dateRef.current?.focus();
            dateRef.current?.showPicker?.();
            break;
        }
      }, 50);
    } else {
      // Last field — submit
      handleSubmit();
    }
  }, [closeAllDropdowns]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, field: FieldKey) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goToNextField(field);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      goToNextField(field);
    }
  }, [goToNextField, onCancel]);

  // Submit handler — reuses CreateTask.tsx API call pattern
  const handleSubmit = useCallback(async () => {
    if (!form.heading.trim() || !form.selectedProjectId) {
      setError('Project and Task Title are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const selectedProject = allProjects.find(p => p.id === form.selectedProjectId);
    const assignedUserDetails = allUsers
      .filter(u => form.assignedTo.includes(u.id))
      .map(u => ({
        id: u.id,
        username: u.label,
        email: '',
        first_name: u.first_name || u.label.split(' ')[0] || '',
        last_name: u.last_name || u.label.split(' ').slice(1).join(' ') || '',
        role: 'annotator' as const,
        is_active: true,
        date_joined: new Date().toISOString(),
      }));

    // Build optimistic task
    const optimisticTask = {
      id: Date.now(),
      heading: form.heading,
      description: '',
      start_date: form.startDate ? `${form.startDate}T09:00:00Z` : '',
      end_date: form.endDate ? `${form.endDate}T18:00:00Z` : '',
      duration_time: '',
      status: form.status as Task['status'],
      priority: form.priority,
      project: String(form.selectedProjectId),
      project_details: selectedProject || { id: form.selectedProjectId, name: '' },
      project_name: selectedProject?.name || null,
      assigned_to: form.assignedTo,
      assigned_to_user_details: assignedUserDetails,
      assigned_by: 0,
      labels: [],
      links: [],
      attachments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } satisfies Task;

    // Optimistic cache update — same pattern as CreateTask.tsx
    const previousSnapshot = queryClient.getQueryData(['tasks']);
    queryClient.setQueryData(['tasks'], (old: any) => {
      if (old?.pages) {
        return {
          ...old,
          pages: [
            { ...old.pages?.[0], results: [optimisticTask, ...(old.pages?.[0]?.results ?? [])] },
            ...(old.pages?.slice(1) ?? []),
          ],
        };
      }
      if (!old) return { pages: [{ count: 1, next: null, previous: null, results: [optimisticTask] }], pageParams: [1] };
      if (Array.isArray(old)) return { pages: [{ count: old.length + 1, next: null, previous: null, results: [optimisticTask, ...old] }], pageParams: [1] };
      return old;
    });

    // Reset form and close inline row
    setForm({
      heading: '',
      selectedProjectId: null,
      status: 'pending',
      priority: 'medium',
      assignedTo: [],
      endDate: '',
      startDate: '',
    });
    setIsSubmitting(false);
    onCancel();

    // Fire API in background
    try {
      const formData = new FormData();
      formData.append('heading', form.heading);
      formData.append('description', '');
      if (form.endDate) formData.append('end_date', `${form.endDate}T18:00:00Z`);
      if (form.startDate) formData.append('start_date', `${form.startDate}T09:00:00Z`);
      formData.append('status', form.status);
      formData.append('priority', form.priority);
      formData.append('project', String(form.selectedProjectId));
      form.assignedTo.forEach(id => {
        formData.append('assigned_to', String(id));
      });

      const apiResponse = await taskApi.create(formData);
      const createdTask: Task = apiResponse?.task || apiResponse;

      // Replace optimistic with real task in taskboard cache
      queryClient.setQueryData(['tasks'], (old: any) => {
        if (old?.pages) {
          return {
            ...old,
            pages: [
              {
                ...old.pages?.[0],
                results: [
                  createdTask,
                  ...(old.pages?.[0]?.results ?? []).filter((t: Task) => t.id !== optimisticTask.id),
                ],
              },
              ...(old.pages?.slice(1) ?? []),
            ],
          };
        }
        return old;
      });

      // Replace optimistic with real task in project-scoped table cache
      const projId = String(form.selectedProjectId);
      queryClient.setQueryData(['tasks-list', projId], (old: any) => {
        if (!old) return old;
        const list: Task[] = old.tasks ?? old.results ?? (Array.isArray(old) ? old : []);
        const merged = [createdTask, ...list.filter((t) => t.id !== optimisticTask.id && t.id !== createdTask.id)];
        if (old.tasks) return { ...old, tasks: merged };
        if (old.results) return { ...old, results: merged };
        return merged;
      });
    } catch (err: any) {
      if (previousSnapshot !== undefined) {
        queryClient.setQueryData(['tasks'], previousSnapshot);
      } else {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
      console.error('[InlineCreateRow] API call failed:', err);
    }
  }, [form, allProjects, allUsers, queryClient, onCancel]);

  const selectedProject = allProjects.find(p => p.id === form.selectedProjectId);
  const statusConfig = getStatusConfig(form.status);
  const priorityOption = priorityOptions.find(opt => opt.value === form.priority);

  return (
    <div ref={rowRef} className="border-t border-[#dfe1e6] bg-blue-50/30 -mt-px">
      {error && (
        <div className="px-3 py-1.5 bg-red-50 text-red-600 text-[11px] border-b border-red-100 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:text-red-800">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <table className="w-full border-collapse table-fixed">
        <tbody>
          <tr className="border-b border-[#dfe1e6]">
         {/* Project Column */}
            {columns.find(c => c.key === 'project') && (
              <td
                className="py-2 px-3 h-12 align-middle text-[13px] border-r border-[#f4f5f7] relative"
                style={{ width: columns.find(c => c.key === 'project')?.width }}
              >
                {fixedProjectId ? (
                  /* Read-only display when project is pre-selected */
                  <span className="text-[12px] text-gray-700 font-medium px-2 py-1.5 block truncate">
                    {selectedProject?.name || ''}
                  </span>
                ) : (
                  /* Editable dropdown on taskboard where project must be chosen */
                  <div className="relative" data-dropdown="inline-project">
                    <input
                      ref={projectInputRef}
                      type="text"
                      value={form.selectedProjectId ? (selectedProject?.name || '') : projectSearch}
                      onChange={(e) => {
                        setProjectSearch(e.target.value);
                        setForm(prev => ({ ...prev, selectedProjectId: null }));
                        setProjectDropdownOpen(true);
                      }}
                      onFocus={() => {
                        setActiveField('project');
                        setProjectDropdownOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && form.selectedProjectId) {
                          e.preventDefault();
                          goToNextField('project');
                        } else if (e.key === 'Escape') {
                          onCancel();
                        }
                      }}
                      placeholder="Select project *"
                      className="w-full bg-transparent text-[12px] text-gray-700 font-medium border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder-gray-400"
                    />
                    {projectDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-[60] max-h-48 overflow-y-auto">
                        {filteredProjects.length > 0 ? filteredProjects.map(project => (
                          <div
                            key={project.id}
                            className={`px-3 py-2 text-[12px] cursor-pointer hover:bg-blue-50 transition-colors ${form.selectedProjectId === project.id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'}`}
                            onClick={() => {
                              setForm(prev => ({ ...prev, selectedProjectId: project.id }));
                              setProjectSearch('');
                              setProjectDropdownOpen(false);
                              goToNextField('project');
                            }}
                          >
                            {project.name}
                          </div>
                        )) : (
                          <div className="px-3 py-2 text-[12px] text-gray-400 italic">No projects found</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </td>
            )}

            {/* Heading / Task Title Column */}
            {columns.find(c => c.key === 'heading') && (
              <td
                className="py-2 px-3 h-12 align-middle text-[13px] border-r border-[#f4f5f7]"
                style={{ width: columns.find(c => c.key === 'heading')?.width }}
              >
                <input
                  ref={headingRef}
                  type="text"
                  value={form.heading}
                  onChange={(e) => setForm(prev => ({ ...prev, heading: e.target.value }))}
                  onFocus={() => setActiveField('heading')}
                  onKeyDown={(e) => handleKeyDown(e, 'heading')}
                  placeholder="Task title *"
                  className="w-full bg-transparent text-[13px] font-medium text-[#172b4d] border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder-gray-400"
                />
              </td>
            )}

            {/* Status Column */}
            {columns.find(c => c.key === 'status') && (
              <td
                className="py-2 px-3 h-12 align-middle text-[13px] border-r border-[#f4f5f7] relative"
                style={{ width: columns.find(c => c.key === 'status')?.width }}
              >
                <div className="relative" data-dropdown="inline-status">
                  <div
                    className={`px-2.5 py-1 rounded text-[11px] font-medium ${statusConfig.bg} ${statusConfig.text} cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 justify-between`}
                    onClick={() => {
                      setActiveField('status');
                      setStatusDropdownOpen(!statusDropdownOpen);
                      setProjectDropdownOpen(false);
                      setPriorityDropdownOpen(false);
                      setAssigneeDropdownOpen(false);
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setStatusDropdownOpen(!statusDropdownOpen);
                      } else if (e.key === 'Escape') {
                        onCancel();
                      } else if (e.key === 'Tab') {
                        e.preventDefault();
                        goToNextField('status');
                      }
                    }}
                  >
                    <span>{statusConfig.label}</span>
                    <ChevronDown className="w-3 h-3" />
                  </div>
                  {statusDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-[60] max-h-48 overflow-y-auto py-1">
                      {statusOptions.map(option => {
                        const optConfig = getStatusConfig(option.value);
                        return (
                          <div
                            key={option.value}
                            className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-[12px] flex items-center gap-2"
                            onClick={() => {
                              setForm(prev => ({ ...prev, status: option.value }));
                              setStatusDropdownOpen(false);
                              goToNextField('status');
                            }}
                          >
                            {React.createElement(option.icon, { className: `w-3.5 h-3.5 ${optConfig.text}` })}
                            <span className={form.status === option.value ? 'font-bold' : 'font-medium'}>
                              {option.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </td>
            )}

            {/* Assignee Column */}
            {columns.find(c => c.key === 'assigned_to') && (
              <td
                className="py-2 px-3 h-12 align-middle text-[13px] border-r border-[#f4f5f7] relative"
                style={{ width: columns.find(c => c.key === 'assigned_to')?.width }}
              >
                <div className="relative" data-dropdown="inline-assignee">
                  <div
                    className="flex items-center gap-1 cursor-pointer border border-gray-200 rounded px-2 py-1.5 hover:border-blue-400 transition-colors min-h-[28px]"
                    onClick={() => {
                      setActiveField('assignedTo');
                      setAssigneeDropdownOpen(!assigneeDropdownOpen);
                      setProjectDropdownOpen(false);
                      setStatusDropdownOpen(false);
                      setPriorityDropdownOpen(false);
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setAssigneeDropdownOpen(!assigneeDropdownOpen);
                      } else if (e.key === 'Escape') {
                        onCancel();
                      } else if (e.key === 'Tab') {
                        e.preventDefault();
                        goToNextField('assignedTo');
                      }
                    }}
                  >
                    {form.assignedTo.length > 0 ? (
                      <div className="flex -space-x-1">
                        {form.assignedTo.slice(0, 3).map(id => {
                          const user = allUsers.find(u => u.id === id);
                          return (
                            <div
                              key={id}
                              className="w-5 h-5 rounded-full bg-[#8d87b5] text-white flex items-center justify-center text-[9px] font-semibold ring-1 ring-white"
                              title={user?.label}
                            >
                              {user?.first_name?.[0]}{user?.last_name?.[0]}
                            </div>
                          );
                        })}
                        {form.assignedTo.length > 3 && (
                          <div className="w-5 h-5 rounded-full bg-gray-400 text-white flex items-center justify-center text-[8px] font-semibold ring-1 ring-white">
                            +{form.assignedTo.length - 3}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400">Assign</span>
                    )}
                    <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
                  </div>
                  {assigneeDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-[60] max-h-56 overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <input
                          type="text"
                          value={assigneeSearch}
                          onChange={(e) => setAssigneeSearch(e.target.value)}
                          placeholder="Search users..."
                          className="w-full text-[11px] px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setAssigneeDropdownOpen(false);
                            } else if (e.key === 'Tab') {
                              e.preventDefault();
                              setAssigneeDropdownOpen(false);
                              goToNextField('assignedTo');
                            }
                          }}
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto py-1">
                        {filteredUsers.map(user => (
                          <div
                            key={user.id}
                            className="px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-[12px] flex items-center gap-2"
                            onClick={() => {
                              setForm(prev => ({ ...prev, assignedTo: [...prev.assignedTo, user.id] }));
                              setAssigneeSearch('');
                            }}
                          >
                            <div className="w-5 h-5 rounded-full bg-[#8d87b5] text-white flex items-center justify-center text-[9px] font-semibold">
                              {user.first_name?.[0]}{user.last_name?.[0]}
                            </div>
                            <span>{user.label}</span>
                          </div>
                        ))}
                        {filteredUsers.length === 0 && (
                          <div className="px-3 py-2 text-[11px] text-gray-400 italic">No users available</div>
                        )}
                      </div>
                      {form.assignedTo.length > 0 && (
                        <div className="border-t border-gray-100 p-2">
                          <button
                            type="button"
                            className="w-full text-[11px] font-medium text-blue-600 hover:text-blue-700 py-1"
                            onClick={() => {
                              setAssigneeDropdownOpen(false);
                              goToNextField('assignedTo');
                            }}
                          >
                            Done ({form.assignedTo.length} selected)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </td>
            )}

            {/* Priority Column */}
            {columns.find(c => c.key === 'priority') && (
              <td
                className="py-2 px-3 h-12 align-middle text-[13px] border-r border-[#f4f5f7] relative"
                style={{ width: columns.find(c => c.key === 'priority')?.width }}
              >
                <div className="relative" data-dropdown="inline-priority">
                  <div
                    className="flex items-center gap-1.5 text-gray-600 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors justify-between"
                    onClick={() => {
                      setActiveField('priority');
                      setPriorityDropdownOpen(!priorityDropdownOpen);
                      setProjectDropdownOpen(false);
                      setStatusDropdownOpen(false);
                      setAssigneeDropdownOpen(false);
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setPriorityDropdownOpen(!priorityDropdownOpen);
                      } else if (e.key === 'Escape') {
                        onCancel();
                      } else if (e.key === 'Tab') {
                        e.preventDefault();
                        goToNextField('priority');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`h-1 w-3 rounded-full ${priorityOption?.dotColor || 'bg-gray-400'}`} />
                      <span className="capitalize text-[12px]">{form.priority}</span>
                    </div>
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </div>
                  {priorityDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-[60] py-1">
                      {priorityOptions.map(option => (
                        <div
                          key={option.value}
                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-[12px] flex items-center gap-2"
                          onClick={() => {
                            setForm(prev => ({ ...prev, priority: option.value }));
                            setPriorityDropdownOpen(false);
                            goToNextField('priority');
                          }}
                        >
                          <span>{option.icon}</span>
                          <span className={form.priority === option.value ? 'font-bold text-blue-600' : ''}>
                            {option.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </td>
            )}

            {/* Labels Column — empty placeholder */}
            {columns.find(c => c.key === 'labels') && (
              <td
                className="py-2 px-3 h-12 align-middle text-[13px] border-r border-[#f4f5f7]"
                style={{ width: columns.find(c => c.key === 'labels')?.width }}
              >
                <span className="text-gray-300 text-[11px] pl-1">—</span>
              </td>
            )}

            {/* Date Column */}
            {columns.find(c => ['end_date', 'start_date', 'created_at'].includes(c.key)) && (() => {
              const dateCol = columns.find(c => ['end_date', 'start_date', 'created_at'].includes(c.key))!;
              return (
                <td
                  className="py-2 px-3 h-12 align-middle text-[13px] border-r border-[#f4f5f7]"
                  style={{ width: dateCol.width }}
                >
                  <input
                    ref={dateRef}
                    type="date"
                    value={dateCol.key === 'start_date' ? form.startDate : form.endDate}
                    onChange={(e) => {
                      if (dateCol.key === 'start_date') {
                        setForm(prev => ({ ...prev, startDate: e.target.value }));
                      } else {
                        setForm(prev => ({ ...prev, endDate: e.target.value }));
                      }
                    }}
                    onFocus={() => setActiveField('endDate')}
                    onKeyDown={(e) => handleKeyDown(e, 'endDate')}
                    className="w-full border border-gray-200 bg-transparent text-[11px] rounded px-1.5 py-1 cursor-pointer text-[#172b4d] font-medium focus:outline-none focus:ring-1 focus:ring-blue-400"
                    style={{ colorScheme: 'light' }}
                  />
                </td>
              );
            })()}

            {/* Updated Column — empty placeholder */}
            {columns.find(c => c.key === 'updated_at') && (
              <td
                className="py-2 px-3 h-12 align-middle text-[13px] border-r border-[#f4f5f7]"
                style={{ width: columns.find(c => c.key === 'updated_at')?.width }}
              >
                <span className="text-gray-300 text-[11px] pl-1">—</span>
              </td>
            )}

            {/* Duration Column — empty placeholder */}
            {columns.find(c => c.key === 'duration') && (
              <td
                className="py-2 px-3 h-12 align-middle text-[13px]"
                style={{ width: columns.find(c => c.key === 'duration')?.width }}
              >
                <span className="text-gray-300 text-[11px] pl-1">—</span>
              </td>
            )}
          </tr>
        </tbody>
      </table>

      {/* Action bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-[#eaecf0] rounded-b-md">
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <span>Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono border border-gray-200">Enter</kbd> to move next</span>
          <span>·</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono border border-gray-200">Esc</kbd> to cancel</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-[12px] text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !form.heading.trim() || !form.selectedProjectId}
            className="px-3 py-1.5 text-[12px] font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            Create
          </button>
        </div>
      </div>
    </div>
  );
};