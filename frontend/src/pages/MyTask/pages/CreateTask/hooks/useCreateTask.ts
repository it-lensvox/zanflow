import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { taskApi, usersApi, projectsApi } from '@/services/api';
import { useTaskDraftsContext } from '@/hooks/useTaskDrafts';
import type { ProjectMinimal, AITaskSuggestionResponse, Task } from '@/types';

export interface UserOption {
  value: string;
  label: string;
  id: number;
}

interface UseCreateTaskProps {
  onClose?: () => void;
  onSuccess?: (task?: Task) => void;
  isModal?: boolean;
  fixedProjectId?: number;
  draftId?: string;
}

export function useCreateTask({
  onClose,
  onSuccess,
  isModal = false,
  fixedProjectId,
  draftId: propDraftId,
}: UseCreateTaskProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // ── Draft system ─────────────────────────────────────────────────────────
  const { createDraft, getDraft, autosaveDraft, minimizeDraft, discardDraft } = useTaskDraftsContext();
  const resolvedDraftId = propDraftId ?? (location.state?.draftId as string | undefined);
  const draftIdRef = useRef<string>(resolvedDraftId ?? '');

  useEffect(() => {
    if (!draftIdRef.current) {
      const initialProjectId = fixedProjectId ?? (location.state?.projectId ? Number(location.state.projectId) : undefined);
      const id = createDraft(fixedProjectId, initialProjectId);
      draftIdRef.current = id;
    }
  }, []);

  const draftId = draftIdRef.current;
  const savedDraft = getDraft(draftId);

  // ── Form state ──
  const [heading, setHeading] = useState(savedDraft?.heading ?? '');
  const [description, setDescription] = useState(savedDraft?.description ?? '');
  const [startDate, setStartDate] = useState(savedDraft?.startDate ?? location.state?.startDate ?? '');
  const [endDate, setEndDate] = useState(savedDraft?.endDate ?? location.state?.endDate ?? '');
  const [assignedToList, setAssignedToList] = useState<number[]>(savedDraft?.assignedToList ?? []);
  const [selectedProjects, setSelectedProjects] = useState<number[]>(
    savedDraft?.selectedProjects.length
      ? savedDraft.selectedProjects
      : fixedProjectId
        ? [fixedProjectId]
        : location.state?.projectId
          ? [Number(location.state.projectId)]
          : []
  );
  const [status, setStatus] = useState(savedDraft?.status ?? 'pending');
  const [priority, setPriority] = useState(savedDraft?.priority ?? 'medium');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [labels, setLabels] = useState(savedDraft?.labels ?? '');
  const [linkInput, setLinkInput] = useState('');
  const [links, setLinks] = useState<string[]>(savedDraft?.links ?? []);
  const [duration, setDuration] = useState(savedDraft?.duration ?? '');
  const [projectLabels, setProjectLabels] = useState<any[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>(savedDraft?.selectedLabelIds ?? []);
  const [projectMembers, setProjectMembers] = useState<{ user: { id: number; username: string; full_name: string } }[]>([]);

  // ── UI state ─
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
  const [assigneeSearchInput, setAssigneeSearchInput] = useState('');
  const [projectSearchInput, setProjectSearchInput] = useState('');
  const [highlightedUserIndex, setHighlightedUserIndex] = useState(0);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSuccessView, setShowSuccessView] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isTitleRefining, setIsTitleRefining] = useState(false);
  const [isDescRefining, setIsDescRefining] = useState(false);

  const projectSearchInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──
  console.log('🔨 [CreateTask] hook mounted | fixedProjectId:', fixedProjectId, '| draftId:', draftId, '| isModal:', isModal);
  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    staleTime: Infinity,
  });

  const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    staleTime: Infinity,
  });

  // ── Derived data ──
  const allUserOptions = React.useMemo<UserOption[]>(() => {
    if (!usersData) return [];
    const data = (usersData as any).results || usersData;
    return Array.isArray(data) ? data.map((user: any) => ({
      value: String(user.id),
      label: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username,
      id: user.id,
    })) : [];
  }, [usersData]);

  const allProjectOptions = React.useMemo<ProjectMinimal[]>(() => {
    if (!projectsData) return [];
    return (projectsData as any).results || projectsData || [];
  }, [projectsData]);

  const filteredUserOptions = React.useMemo(() => {
    let available = allUserOptions;
    if (selectedProjects.length > 0 && projectMembers.length > 0) {
      const memberIds = projectMembers.map(m => m.user.id);
      available = allUserOptions.filter(u => memberIds.includes(u.id));
    }
    available = available.filter(u => !assignedToList.includes(u.id));
    if (!assigneeSearchInput.trim()) return available;
    return available.filter(u => u.label.toLowerCase().startsWith(assigneeSearchInput.toLowerCase()));
  }, [allUserOptions, assignedToList, assigneeSearchInput, selectedProjects, projectMembers]);

  const filteredProjectOptions = React.useMemo(() => {
    if (!projectSearchInput.trim()) return allProjectOptions;
    const q = projectSearchInput.toLowerCase();
    const starts = allProjectOptions.filter(p => p.name.toLowerCase().startsWith(q));
    const contains = allProjectOptions.filter(p => !p.name.toLowerCase().startsWith(q) && p.name.toLowerCase().includes(q));
    return [...starts, ...contains];
  }, [allProjectOptions, projectSearchInput]);

  // ── Effects ───

  // Autosave
  useEffect(() => {
    if (!draftId) return;
    autosaveDraft(draftId, {
      heading, description, startDate, endDate,
      assignedToList, selectedProjects, status, priority,
      labels, selectedLabelIds, links, duration,
    });
  }, [heading, description, startDate, endDate, assignedToList, selectedProjects,
    status, priority, labels, selectedLabelIds, links, duration]);

  // Sync projectId from location state
  useEffect(() => {
    if (!fixedProjectId && location.state?.projectId) {
      setSelectedProjects([Number(location.state.projectId)]);
    }
  }, [location.state?.projectId, fixedProjectId]);

  // Fetch project labels & members when project changes
  useEffect(() => {
    const fetchProjectData = async () => {
      if (selectedProjects.length > 0) {
        try {
          const [labelsData, projectDetails] = await Promise.all([
            projectsApi.getLabels(selectedProjects[0]),
            projectsApi.get(selectedProjects[0]),
          ]);
          setProjectLabels(labelsData.results || []);
          const members = projectDetails.assigned_members || projectDetails.members || [];
          setProjectMembers(members);
        } catch (err) {
          console.error('Failed to fetch project data:', err);
        }
      } else {
        setProjectLabels([]);
        setSelectedLabelIds([]);
        setProjectMembers([]);
      }
    };
    fetchProjectData();
  }, [selectedProjects]);

  console.log('🔨 [CreateTask] usersData:', (usersData as any)?.results?.length ?? (usersData as any)?.length ?? usersData, '| usersError:', usersError?.message, '| projectsData:', (projectsData as any)?.results?.length ?? (projectsData as any)?.length);
  // Handle load errors
  useEffect(() => {
    if (usersError || projectsError) {
      setError('Failed to load required data. Please refresh.');
    }
  }, [usersError, projectsError]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-dropdown="status"]'))   setStatusDropdownOpen(false);
      if (!t.closest('[data-dropdown="priority"]')) setPriorityDropdownOpen(false);
      if (!t.closest('[data-dropdown="assignee"]')) setDropdownOpen(false);
      if (!t.closest('[data-dropdown="project"]'))  setProjectDropdownOpen(false);
      if (!t.closest('[data-dropdown="label"]'))    setLabelDropdownOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // AI-generated task prefill
  useEffect(() => {
    const ai = location.state?.aiGeneratedTask as AITaskSuggestionResponse;
    if (!ai) return;
    setHeading(ai.heading || '');
    setStartDate(ai.start_date || '');
    setEndDate(ai.end_date || '');
    setStatus(ai.status || 'pending');
    setPriority(ai.priority || 'medium');
    setAssignedToList(ai.assigned_to || []);
    if (ai.project) setSelectedProjects([ai.project]);
    if (ai.description) setDescription(formatAITextToHtml(ai.description));
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, navigate, location.pathname]);

  // ── Handlers ───

  const formatAITextToHtml = (text: string) =>
    text
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    const isDeleting = (e.nativeEvent as any).inputType === 'deleteContentBackward';
    if (isDeleting) { setDuration(val); return; }
    val = val.replace(/[^0-9:]/g, '');
    if (/^\d{2}$/.test(val)) val = val + ':';
    else if (/^\d{2}:\d$/.test(val)) val = val + '0';
    setDuration(val);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const MAX = 500 * 1024 * 1024;
    const valid = Array.from(e.target.files).filter(f => {
      if (f.size > MAX) { setError(`File ${f.name} exceeds 500 MB.`); return false; }
      return true;
    });
    setAttachments(prev => [...prev, ...valid]);
  };

  const removeAttachment = (index: number) =>
    setAttachments(prev => prev.filter((_, i) => i !== index));

  const handleAddLink = () => {
    if (linkInput.trim()) {
      setLinks(prev => [...prev, linkInput.trim()]);
      setLinkInput('');
    }
  };

  const removeLink = (index: number) =>
    setLinks(prev => prev.filter((_, i) => i !== index));

  const handleRefineTitle = async () => {
    if (!heading.trim()) return;
    setIsTitleRefining(true);
    try {
      const res = await taskApi.refineText({ text: heading, type: 'optimize_title' });
      if (res.refined_text) setHeading(res.refined_text);
    } catch (err) {
      console.error('Failed to optimize title', err);
    } finally {
      setIsTitleRefining(false);
    }
  };

  const handleRefineDescription = async () => {
    const stripHtml = (html: string) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || '';
    };
    const text = stripHtml(description);
    const isEmpty = !text.trim();
    if (isEmpty && !heading.trim()) {
      setError('Please enter a Task Title first to generate a description.');
      return;
    }
    setIsDescRefining(true);
    try {
      const res = await taskApi.refineText({
        text: isEmpty ? heading : text,
        type: isEmpty ? 'generate_description' : 'refine_description',
      });
      if (res.refined_text) setDescription(formatAITextToHtml(res.refined_text));
    } catch (err) {
      console.error('Failed to refine description', err);
    } finally {
      setIsDescRefining(false);
    }
  };

  const handleMinimize = useCallback(() => {
    minimizeDraft(draftId);
    if (isModal && onClose) onClose();
    else navigate(-1);
  }, [draftId, minimizeDraft, isModal, onClose, navigate]);

  const handleClose = () => {
    discardDraft(draftId);
    if (isModal && onClose) onClose();
    else navigate('/taskboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!heading || selectedProjects.length === 0) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    const projectId = selectedProjects[0];
    const selectedProject = allProjectOptions.find(p => p.id === projectId);
    const selectedLabelObjects = projectLabels.filter((l: any) => selectedLabelIds.includes(l.id));
    const assignedUserDetails = allUserOptions
      .filter(u => assignedToList.includes(u.id))
      .map(u => ({
        id: u.id,
        username: u.label,
        email: '',
        first_name: u.label.split(' ')[0] || '',
        last_name: u.label.split(' ').slice(1).join(' ') || '',
        role: 'project_member' as const,
        is_active: true,
        date_joined: new Date().toISOString(),
      }));

    const optimisticTask = {
      id: Date.now(),
      heading,
      description,
      start_date: startDate ? `${startDate}T09:00:00Z` : '',
      end_date: endDate ? `${endDate}T18:00:00Z` : '',
      duration_time: duration,
      status: status as Task['status'],
      priority,
      project: String(projectId),
      project_details: selectedProject || { id: projectId, name: '' },
      project_name: selectedProject?.name || null,
      assigned_to: assignedToList,
      assigned_to_user_details: assignedUserDetails,
      assigned_by: 0,
      labels: selectedLabelObjects,
      links: links.map((url, idx) => ({ id: idx, url, created_at: new Date().toISOString() })),
      attachments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } satisfies Task;

    const previousTasksSnapshot = queryClient.getQueryCache()
      .findAll({ queryKey: ['tasks'], exact: false })
      .map(q => ({ key: q.queryKey, data: queryClient.getQueryData(q.queryKey) }));

    const injectOptimistic = (old: any) => {
      // New per-page shape: { count, next, previous, results }
      if (old?.results && Array.isArray(old.results)) {
        return { ...old, count: (old.count ?? 0) + 1, results: [optimisticTask, ...old.results] };
      }
      // Old infinite query shape: { pages: [...] }
      if (old?.pages) {
        return {
          ...old,
          pages: [
            { ...old.pages?.[0], results: [optimisticTask, ...(old.pages?.[0]?.results ?? [])] },
            ...(old.pages?.slice(1) ?? []),
          ],
        };
      }
      if (Array.isArray(old)) return [optimisticTask, ...old];
      return { count: 1, next: null, previous: null, results: [optimisticTask] };
    };

    queryClient.getQueryCache().findAll({ queryKey: ['tasks'], exact: false }).forEach(query => {
      queryClient.setQueryData(query.queryKey, injectOptimistic);
    });
    setShowSuccessView(true);
    if (isModal && onSuccess) {
      onSuccess(optimisticTask);
    } else {
      const fromCalendar = location.state?.startDate !== undefined;
      await queryClient.invalidateQueries({ queryKey: ['tasks'], exact: false });
      navigate(fromCalendar ? '/calendar' : '/taskboard');
    }

    try {
      const formData = new FormData();
      formData.append('heading', heading);
      formData.append('description', description);
      if (startDate) formData.append('start_date', `${startDate}T09:00:00Z`);
      if (endDate) formData.append('end_date', `${endDate}T18:00:00Z`);
      formData.append('duration_time', duration);
      formData.append('status', status);
      formData.append('priority', priority);
      formData.append('project', String(projectId));
      selectedLabelIds.forEach(id => formData.append('labels', String(id)));
      links.forEach(link => formData.append('uploaded_links', link));
      assignedToList.forEach(id => formData.append('assigned_to', String(id)));
      attachments.forEach(file => formData.append('uploaded_files', file));

      const apiResponse = await taskApi.create(formData);
      const createdTask: Task = apiResponse?.task || apiResponse;

      queryClient.getQueryCache().findAll({ queryKey: ['tasks'], exact: false }).forEach(query => {
        queryClient.setQueryData(query.queryKey, (old: any) => {
          // New per-page shape
          if (old?.results && Array.isArray(old.results)) {
            return {
              ...old,
              results: [
                createdTask,
                ...old.results.filter((t: Task) => t.id !== optimisticTask.id && t.id !== createdTask.id),
              ],
            };
          }
          // Old infinite query shape
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
      });

      queryClient.invalidateQueries({ queryKey: ['tasks-calendar'] });

      queryClient.setQueryData(['tasks-list', String(projectId)], (old: any) => {
        if (!old) return old;
        const list: Task[] = old.tasks ?? old.results ?? (Array.isArray(old) ? old : []);
        const merged = [createdTask, ...list.filter(t => t.id !== optimisticTask.id && t.id !== createdTask.id)];
        if (old.tasks) return { ...old, tasks: merged };
        if (old.results) return { ...old, results: merged };
        return merged;
      });
    } catch (err: any) {
      // Rollback all task cache entries on error
      if (previousTasksSnapshot.length > 0) {
        previousTasksSnapshot.forEach(({ key, data }) => {
          queryClient.setQueryData(key, data);
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['tasks'], exact: false });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks-list'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['tasks'], exact: false });
      console.error('❌ [CreateTask] Upload failed:', err);
      setError(err.response?.data?.message || 'Failed to create task. Please check your inputs.');
      setLoading(false);
      setShowSuccessView(false);
    }
  };

  return {
    // form state
    heading, setHeading,
    description, setDescription,
    startDate, setStartDate,
    endDate, setEndDate,
    assignedToList, setAssignedToList,
    selectedProjects, setSelectedProjects,
    status, setStatus,
    priority, setPriority,
    attachments,
    labels, setLabels,
    linkInput, setLinkInput,
    links,
    duration,
    projectLabels,
    selectedLabelIds, setSelectedLabelIds,
    projectMembers,
    // ui state
    dropdownOpen, setDropdownOpen,
    statusDropdownOpen, setStatusDropdownOpen,
    priorityDropdownOpen, setPriorityDropdownOpen,
    projectDropdownOpen, setProjectDropdownOpen,
    labelDropdownOpen, setLabelDropdownOpen,
    assigneeSearchInput, setAssigneeSearchInput,
    projectSearchInput, setProjectSearchInput,
    highlightedUserIndex, setHighlightedUserIndex,
    showAIModal, setShowAIModal,
    showSuccessView,
    loading, error, success,
    isTitleRefining, isDescRefining,
    // refs
    projectSearchInputRef,
    // query state
    usersLoading, projectsLoading,
    // derived
    allUserOptions, allProjectOptions,
    filteredUserOptions, filteredProjectOptions,
    // handlers
    handleDurationChange,
    handleFileChange,
    removeAttachment,
    handleAddLink,
    removeLink,
    handleRefineTitle,
    handleRefineDescription,
    handleMinimize,
    handleClose,
    handleSubmit,
  };
}