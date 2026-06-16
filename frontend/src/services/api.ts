import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  AuthTokens, User as AppUser, PaginatedResponse, PaginatedProjectsResponse, GetUploadUrlPayload, GetUploadUrlResponse, ConfirmUploadResponse, GetDownloadUrlPayload, ConfirmUploadPayload, GetDownloadUrlResponse, AllDocumentsResponse,
  TaskComment, CreateTaskCommentPayload, AITaskSuggestionResponse, AITaskSuggestionPayload, ProjectCreatePayload, Label, DocumentStatus, ChatMessage, ChatRoom, ChatRoomMessagesResponse, CreatePrivateChatPayload,
  GatewaySendMessagePayload, GatewayIncomingMessage, RefineTextPayload, RefineTextResponse, TaskResponse, TeamTypeChoicesResponse, PinTaskResponse,
  CreateTeamPayload, ProjectChatRoom, TeamChatRoom, ChatUnreadResponse, NotificationData, NotificationCallback, Team, ThreadRoom, ThreadSession, ThreadStorage, ThreadUIMessage, CreateThreadRoomPayload, WSJoinRoomCommand, WSSendMessageCommand, WSIncomingThreadMessage, WSUnreadUpdateSignal, ThreadMessagesResponse,
  InviteUserPayload, InviteUserResponse, InviteVerifyResponse, InviteAcceptPayload, InviteAcceptResponse, AIBotSendPayload, AIBotIncomingMessage, OrganizationSignupPayload, OrganizationSignupResponse,
  DailyUpdate, DailyUpdatePayload, DailyUpdateListResponse, TaskFilterParams, Event as CalendarEventType,
} from '@/types';

//export const API_URL = (import.meta as any).env.VITE_API_URL || 'http://192.168.1.164:8000/api/v1';
//const WS_GATEWAY_URL = (import.meta as any).env.VITE_WS_GATEWAY_URL || 'ws://192.168.1.164:8000/ws/gateway';
//const WS_AI_BOT_URL = (import.meta as any).env.VITE_WS_AI_BOT_URL || 'ws://192.168.1.164:8000/ws/ai-bot/';
export const API_URL = (import.meta as any).env.VITE_API_URL || 'http://192.168.1.164:8000/api/v1';
const WS_GATEWAY_URL = (import.meta as any).env.VITE_WS_GATEWAY_URL || 'ws://192.168.1.164:8000/ws/gateway';
const WS_AI_BOT_URL = (import.meta as any).env.VITE_WS_AI_BOT_URL || 'ws://192.168.1.164:8000/ws/ai-bot/';
// export const API_URL = (import.meta as any).env.VITE_API_URL || 'http://zanflow.lensvox.com/api/v1';
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
const TOKEN_KEY = 'zanflow_tokens';

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add Authorization header
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // ✅ Add X-Workspace-ID header
    const workspaceId = localStorage.getItem('active_workspace_id');
    if (workspaceId) {
      config.headers['X-Workspace-ID'] = workspaceId;
    }

    console.log('🌐 API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      workspaceId: config.headers['X-Workspace-ID'],
      hasAuth: !!token,
    });

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ✅ Response interceptor for token refresh with queue
// Only refreshes on ACTUAL auth failures, not permission errors
let isRefreshingToken = false;
let failedRequestsQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedRequestsQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedRequestsQueue = [];
};

// Check if a 403 is an auth issue (expired token) vs a permission issue
const isAuthError = (error: any): boolean => {
  const status = error.response?.status;
  
  // 401 is always an auth issue
  if (status === 401) return true;
  
  // For 403, check the response body to distinguish auth vs permission
  if (status === 403) {
    const data = error.response?.data;
    const detail = (data?.detail || '').toLowerCase();
    const code = data?.code || '';
    
    // These indicate expired/missing token (should refresh)
    if (
      code === 'not_authenticated' ||
      code === 'token_not_valid' ||
      detail.includes('authentication credentials were not provided') ||
      detail.includes('token not valid') ||
      detail.includes('token is invalid or expired')
    ) {
      return true;
    }
    
    // Everything else is a permission error (don't refresh)
    // e.g. "Only admins can create workspaces", "You are not a member"
    return false;
  }
  
  return false;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (isAuthError(error) && !originalRequest._retry) {
      // Don't retry the refresh endpoint itself
      if (originalRequest.url?.includes('/auth/refresh')) {
        stopProactiveRefresh(); // Add this
        localStorage.clear();   // Wipes access, refresh, and active_workspace_id completely
        window.location.href = '/login';
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // If already refreshing, queue this request and wait
      if (isRefreshingToken) {
        return new Promise((resolve, reject) => {
          failedRequestsQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      // First failed request — start the refresh
      isRefreshingToken = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_URL}/auth/refresh/`, {
          refresh: refreshToken
        });

        const { access, refresh } = response.data;

        // ✅ Save to individual keys (used by axios interceptor)
        localStorage.setItem('access_token', access);
        if (refresh) {
          localStorage.setItem('refresh_token', refresh);
        }

        // ✅ Save to zanflow_tokens (used by WebSockets and getTokens())
        // This ensures WebSocket reconnection picks up the new token
        setTokens({ access, refresh: refresh || refreshToken });

        // Update default header
        api.defaults.headers.common['Authorization'] = `Bearer ${access}`;

        // Schedule next proactive refresh
        scheduleProactiveRefresh();

        // Resolve all queued requests with new token
        processQueue(null, access);

        // Retry the original request
        originalRequest.headers['Authorization'] = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        stopProactiveRefresh(); // Add this
        localStorage.clear();   // Wipes everything
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshingToken = false;
      }
    }

    return Promise.reject(error);
  }
);

export const getTokens = (): AuthTokens | null => {
  const tokens = localStorage.getItem(TOKEN_KEY);
  return tokens ? JSON.parse(tokens) : null;
};

export const setTokens = (tokens: AuthTokens): void => {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
};

export const clearTokens = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// ═══════════════════════════════════════════════════════════════════
// PROACTIVE TOKEN REFRESH
// Refreshes the token BEFORE it expires so HTTP and WebSocket
// never see an expired token. No more 403s, no WS disconnects.
// ═══════════════════════════════════════════════════════════════════
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function decodeTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null; // convert to ms
  } catch {
    return null;
  }
}

function scheduleProactiveRefresh() {
  // Clear any existing timer
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }

  const accessToken = localStorage.getItem('access_token');
  if (!accessToken) return;

  const expMs = decodeTokenExp(accessToken);
  if (!expMs) return;

  // Refresh 2 minutes before expiry (or halfway if token lives < 4 min)
  const now = Date.now();
  const timeUntilExpiry = expMs - now;
  const refreshIn = Math.max(timeUntilExpiry - 120000, timeUntilExpiry / 2, 5000);

  console.log(`🔄 Token refresh scheduled in ${Math.round(refreshIn / 1000)}s`);

  proactiveRefreshTimer = setTimeout(async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return;

      const response = await axios.post(`${API_URL}/auth/refresh/`, {
        refresh: refreshToken
      });

      const { access, refresh } = response.data;

      // Update all token stores
      localStorage.setItem('access_token', access);
      if (refresh) {
        localStorage.setItem('refresh_token', refresh);
      }
      setTokens({ access, refresh: refresh || refreshToken });
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;

      console.log('🔄 Token proactively refreshed');

      // Schedule next refresh
      scheduleProactiveRefresh();
    } catch (error) {
      console.warn('Proactive refresh failed, will retry on next API call');
    }
  }, refreshIn);
}

// Start the timer whenever tokens change
export function startProactiveRefresh() {
  scheduleProactiveRefresh();
}

export function stopProactiveRefresh() {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    localStorage.removeItem('active_workspace_id');
    delete api.defaults.headers.common['X-Workspace-ID'];
    const response = await api.post<AuthTokens>('/auth/login/', {
      username,
      password,
    });
    setTokens(response.data);
    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);
    api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;
    startProactiveRefresh();
    return response.data;
  },

  logout: () => {
    stopProactiveRefresh();
    clearTokens();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('active_workspace_id');
    delete api.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['X-Workspace-ID'];
    window.location.href = '/login';
  },

  sendOtp: async (email: string) => {
    const response = await api.post('/organizations/signup/send-otp/', { email });
    return response.data;
  },

  register: async (data: OrganizationSignupPayload): Promise<OrganizationSignupResponse> => {
    // 💡 Add these two lines here as well!
    localStorage.removeItem('active_workspace_id');
    delete api.defaults.headers.common['X-Workspace-ID'];

    const response = await api.post<OrganizationSignupResponse>(
      '/organizations/signup/',
      data
    );
    setTokens(response.data.tokens);
    api.defaults.headers.common['Authorization'] = `Bearer ${response.data.tokens.access}`;
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me/');
    return response.data;
  },

  // Skills API
  updateSkills: async (skills: string[]) => {
    const response = await api.patch('/auth/me/', { skills });
    return response.data;
  },

  // Update profile fields (first_name, last_name, avatar)
  updateProfile: async (data: FormData | { first_name?: string; last_name?: string }) => {
    const isFormData = data instanceof FormData;

    if (isFormData) {
      // ✅ Let browser auto-set Content-Type with boundary for multipart
      const response = await api.patch('/auth/me/', data, {
        headers: { 'Content-Type': undefined },
      });
      return response.data;
    }

    // ✅ JSON for name/text updates
    const response = await api.patch('/auth/me/', data);
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password/', { email });
    return response.data;
  },

  verifyOTP: async (email: string, otp: string,) => {
    const response = await api.post('/auth/verify-otp/', { email, otp });
    return response.data;
  },

  setNewPassword: async (data: {
    email: string;
    reset_token: string;
    password: string;
    password_confirm: string;
  }) => {
    const response = await api.post('/auth/set-new-password/', data);
    return response.data;
  },

  resetPassword: async (data: {
    username: string;
    old_password: string;
    new_password: string;
    confirm_new_password: string;
  }) => {
    const response = await api.post('/auth/reset-password/', data);
    return response.data;
  },

};


// Projects API
export const projectsApi = {
  list: async (params?: { task_type?: string; is_active?: boolean; page?: number }) => {
    const response = await api.get<PaginatedProjectsResponse>('/projects/', { params });
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/projects/${id}/`);
    return response.data;
  },

  create: async (data: ProjectCreatePayload) => {
    const response = await api.post('/projects/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<{ name: string; description: string; is_favourite: boolean; task_type: string }>) => {
    const response = await api.patch(`/projects/${id}/`, data);
    return response.data;
  },

  delete: async (id: number) => {
    await api.delete(`/projects/${id}/`);
  },

  getStats: async (id: number) => {
    const response = await api.get(`/projects/${id}/stats/`);
    return response.data;
  },

  createLabel: async (projectId: number, data: { name: string; color: string }) => {
    const response = await api.post(`/projects/${projectId}/labels/`, data);
    return response.data;
  },

  deleteLabel: async (projectId: number, labelId: number) => {
    const response = await api.delete(`/projects/${projectId}/labels/${labelId}/`);
    return response.data;
  },

  getLabels: async (projectId: number) => {
    const response = await api.get<PaginatedResponse<Label>>(`/projects/${projectId}/labels/`);
    return response.data;
  },
  addMember: async (projectId: number, data: { user_id: number; role: string }) => {
    const response = await api.post(`/projects/${projectId}/add-member/`, data);
    return response.data;
  },
  removeMember: async (projectId: number, userId: number) => {
    const response = await api.delete(`/projects/${projectId}/members/${userId}/`);
    return response.data;
  },
};

// Add Documents API in task type file
export const documentsApi = {
  list: async (params?: {
    project?: number;
    status?: string;
    file_type?: string;
    page?: number;
    page_size?: number;
    folder?: string;
    root_only?: boolean;
    disable_pagination?: boolean;
  }) => {
    const response = await api.get('/documents/', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/documents/${id}/`);
    return response.data;
  },


  getUploadUrl: async (projectId: number, data: GetUploadUrlPayload) => {
    const response = await api.post<GetUploadUrlResponse>(
      `/projects/${projectId}/get-upload-url/`,
      data
    );
    return response.data;
  },

  uploadFileToS3: async (
    s3Url: string,
    fields: Record<string, string>,
    file: File
  ) => {
    const formData = new FormData();
    Object.keys(fields).forEach(key => {
      formData.append(key, fields[key]);
    });
    formData.append('file', file);
    await axios.post(s3Url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // This `create` now expects the final S3 file_key
  create: async (data: {
    project: number;
    name: string;
    description: string;
    file_key: string;
    initial_gt_data?: Record<string, unknown>;
    file_type: string;
    original_file_name: string;
  }) => {
    const response = await api.post('/documents/', data);
    return response.data;
  },

  // 3rd API: Confirm Upload
  confirmUpload: async (projectId: number, data: ConfirmUploadPayload) => {
    const response = await api.post<ConfirmUploadResponse>(
      `/projects/${projectId}/confirm-upload/`,
      data
    );
    return response.data;
  },

  // 4th API: Get Download URL
  getDownloadUrl: async (projectId: number, data: GetDownloadUrlPayload) => {
    const response = await api.post<GetDownloadUrlResponse>(
      `/projects/${projectId}/get-download-url/`,
      data
    );
    return response.data;
  },

  update: async (id: string, data: Partial<{ name: string; description: string }>) => {
    const response = await api.patch(`/documents/${id}/`, data);
    return response.data;
  },

  // Update document status in documents page 
  updateStatus: async (id: string, status: DocumentStatus) => {
    const response = await api.patch(`/documents/${id}/`, { status });
    return response.data;
  },

  // Document delete on documents page
  delete: async (id: string) => {
    await api.delete(`/documents/${id}/`);
  },

  removeLabel: async (documentId: string, labelId: number) => {
    const response = await api.delete(`/documents/${documentId}/labels/${labelId}/`);
    return response.data;
  },
  // Get all project and task documents with optional task filtering
  getAllDocuments: async (projectId: number, taskId?: number) => {
    const url = `/documents/project/${projectId}/all/`;
    const params = taskId ? { task_id: taskId } : {};
    const response = await api.get<AllDocumentsResponse>(url, { params });
    return response.data;
  },

  // Share document with a user or project
  share: async (documentId: string, payload: import('@/types').ShareDocumentPayload): Promise<import('@/types').ShareDocumentResponse> => {
    const response = await api.post<import('@/types').ShareDocumentResponse>(
      `/documents/${documentId}/share/`,
      payload
    );
    return response.data;
  },
  listFolders: async (params?: { project?: number; parent?: string }) => {
    const response = await api.get('/documents/folders/', { params });
    return response.data;
  },

  // Create a new folder under a project
  createFolder: async (data: { project: number; name: string; parent?: string | null }) => {
    const response = await api.post('/documents/folders/', data);
    return response.data;
  },

  // Rename a folder
  renameFolder: async (folderId: string, name: string) => {
    const response = await api.patch(`/documents/folders/${folderId}/`, { name });
    return response.data;
  },

  // Delete a folder
  deleteFolder: async (folderId: string) => {
    await api.delete(`/documents/folders/${folderId}/`);
  },

  getActivity: (documentId: string) =>
    api.get(`/documents/${documentId}/activity/`),

  getComments: (documentId: string) =>
    api.get(`/documents/${documentId}/comments/`),

  addComment: async (documentId: string, content: string, mentions: number[] = []) => {
    const response = await api.post(  // ✅ Correct - matches your other methods
      `/documents/${documentId}/comments/`,
      {
        content,
        mentions
      }
    );
    return response.data;
  },

  deleteComment: (documentId: string, commentId: number) =>
    api.delete(`/documents/${documentId}/comments/${commentId}/`),

  getTeamMembers: () => usersApi.listAll(),

  sharedWithMe: async (params?: { page?: number }) => {
    const response = await api.get('/documents/shared-with-me/', { params });
    return response.data;
  },

  // ✅ Revoke document sharing access from a user or project
  revokeShare: async (documentId: string, payload: { user_id?: number; project_id?: number }) => {
    const response = await api.delete(`/documents/${documentId}/share/`, { data: payload });
    return response.data;
  },
};


// Add New Task API
export const taskApi = {
  list: async (params?: TaskFilterParams) => {
    const response = await api.get('/tasksite/', { params });
    const data = response.data;
    const taskArray = data.results || data.tasks;
    if (taskArray && Array.isArray(taskArray)) {
      const mappedTasks = taskArray.map((task: any) => ({
        ...task,
        attachments: task.attachments || [],
        labels: task.label_details || task.labels || []
      }));

      // Sort tasks by created_at and updated_at in descending order 
      mappedTasks.sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      });

      // Retain the structure but inject the mapped tasks
      if (data.results) data.results = mappedTasks;
      if (data.tasks) data.tasks = mappedTasks;
    } else if (Array.isArray(data)) {
      const mappedTasks = data.map((task: any) => ({
        ...task,
        attachments: task.attachments || [],
        labels: task.label_details || task.labels || []
      }));
      mappedTasks.sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      });
      return mappedTasks;
    }

    return data;
  },

  // Paginated fetch — used by the Task Board infinite scroll
  listPaginated: async (page: number = 1): Promise<import('@/types').TaskPaginatedResponse> => {
    const response = await api.get('/tasksite/', { params: { page } });
    const data = response.data;
    const rawResults: any[] = data.results ?? data.tasks ?? [];
    const results = rawResults.map((task: any) => ({
      ...task,
      attachments: task.attachments || [],
      labels: task.label_details || task.labels || [],
    }));
    return {
      count: data.count ?? results.length,
      next: data.next ?? null,
      previous: data.previous ?? null,
      results,
    };
  },

  get: async (taskId: number) => {
    const response = await api.get(`/tasksite/${taskId}/`);
    const data = response.data;
    const task = data.task || data;
    return {
      ...data,
      task: {
        ...task,
        attachments: task.attachments || [],
        labels: task.label_details || task.labels || []
      }
    };
  },

  // Create a new task
  create: async (formData: FormData) => {
    const response = await api.post('/tasksite/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    if (response.data?.task?.label_details) {
      response.data.task.labels = response.data.task.label_details;
    }
    return response.data;
  },

  // Bulk upload tasks via JSON
  bulkUpload: async (projectId: number | string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<import('@/types').BulkTaskUploadResponse>(
      `/tasksite/project/${projectId}/bulk-upload/`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  update: async (taskId: number, data: Partial<{ status: string; priority: string; duration_time: string; labels: number[]; start_date: string; end_date: string; description: string; assigned_to: number[]; links: string[]; }>) => {
    const response = await api.patch(`/tasksite/${taskId}/`, data);
    return response.data;
  },

  delete: async (taskId: number) => {
    const response = await api.delete(`/tasksite/${taskId}/`);
    return response.data;
  },

  getPerformance: async (userId: number) => {
    const response = await api.get(`/tasksite/performance/${userId}/`);
    const apiData = response.data;
    const performanceMetrics = apiData.performance_metrics || {};

    const mappedPerformance = {
      completed_tasks_count: performanceMetrics.completed ?? 0,
      in_progress_tasks_count: performanceMetrics.in_progress ?? 0,
      pending_tasks_count: performanceMetrics.pending ?? 0,
      total_tasks_count: performanceMetrics.total ?? 0,

      performance_score: performanceMetrics.total
        ? Math.round((performanceMetrics.completed / performanceMetrics.total) * 100)
        : 0,
    };

    const taskHistory = apiData.task_history || [];
    const projectDistributionMap: Record<string, { task_count: number }> = {};

    taskHistory.forEach((task: any) => {
      const projectName = task.project_name || 'Unassigned Project';
      if (!projectDistributionMap[projectName]) {
        projectDistributionMap[projectName] = { task_count: 0 };
      }
      projectDistributionMap[projectName].task_count += 1;
    });

    const projectDistribution = Object.keys(projectDistributionMap).map(name => ({
      project_name: name,
      task_count: projectDistributionMap[name].task_count,
      total_project_tasks: apiData.performance_metrics.total,
    }));

    const recentActivity = taskHistory.map((task: any) => ({
      task_name: task.heading,
      project_name: task.project_name || 'Unassigned Project',
      status: task.status,
      timestamp: task.updated_at,
    })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());


    return {
      ...mappedPerformance,
      project_distribution: projectDistribution,
      recent_activity: recentActivity,
    };

  },

  // Get comments for a specific task
  getComments: async (taskId: number) => {
    const response = await api.get<any>(`/tasksite/${taskId}/comments/`);
    return response.data.results || [];
  },

  // Post a new comment to a task
  addComment: async (taskId: number, data: CreateTaskCommentPayload) => {
    const response = await api.post<TaskComment>(`/tasksite/${taskId}/comments/`, data);
    return response.data;
  },

  // Create AI-based task suggestion
  suggestTask: async (data: AITaskSuggestionPayload) => {
    const response = await api.post<AITaskSuggestionResponse>(
      '/task-ai/suggest-task/',
      data
    );
    return response.data;
  },

  //Create AI-refined inside TaskTitle and Description
  refineText: async (data: RefineTextPayload) => {
    const response = await api.post<RefineTextResponse>(
      '/task-ai/refine-text/',
      data
    );
    return response.data;
  },

  // Upload files directly to Exiting taskdetail
  uploadFiles: async (taskId: number, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('uploaded_files', file);
    });

    const response = await api.patch<TaskResponse>(`/tasksite/${taskId}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  // Delete taskdetail  attachment
  deleteAttachment: async (attachmentId: string) => {
    const response = await api.delete(`/tasksite/attachments/${attachmentId}/`);
    return response.data;
  },

  // Pin or unpin a task
  pinTask: async (taskId: number): Promise<PinTaskResponse> => {
    const response = await api.post<PinTaskResponse>(`/tasksite/${taskId}/pin/`);
    return response.data;
  },


};

// Create Teams API
export const teamsApi = {

  // TeamType
  getTeamTypeChoices: async () => {
    const response = await api.get<TeamTypeChoicesResponse>('/teams/choices/');
    return response.data;
  },

  // Save Team
  create: async (data: CreateTeamPayload) => {
    const response = await api.post<Team>('/teams/', data);
    return response.data;
  },

  list: async () => {
    const response = await api.get<PaginatedResponse<Team>>('/teams/');
    return response.data;
  },

  // For favorite toggle
  toggleFavorite: async (id: number, isFavourite: boolean) => {
    const response = await api.post(`/teams/${id}/favorite/`, {
      is_favourite: isFavourite
    });
    return response.data;
  },

  // Add member to team
  addMember: async (teamId: number, data: { user_id: number; role: string }) => {
    const response = await api.post(`/teams/${teamId}/members/`, data);
    return response.data;
  },

  // Delete team
  delete: async (id: number) => {
    await api.delete(`/teams/${id}/`);
  },
};

// Organizations Overview API (Superuser only)
export const organizationsApi = {
  overview: async (): Promise<import('@/types').OrganizationsOverviewResponse> => {
    const response = await api.get('/organizations/overview/');
    return response.data;
  },

  delete: async (id: number): Promise<import('@/types').OrganizationDeleteResponse> => {
    const response = await api.delete(`/organizations/overview/${id}/delete/`, {
      data: { confirm: 'DELETE' },
    });
    return response.data;
  },

  toggleStatus: async (id: number): Promise<import('@/types').OrganizationToggleStatusResponse> => {
    const response = await api.post(`/organizations/overview/${id}/toggle-status/`);
    return response.data;
  },
};

// User ManagementAPI
export const usersApi = {
  list: async () => {
    const response = await api.get<PaginatedResponse<AppUser>>('/auth/users/');
    return response.data;
  },
  // Get all users name list
  listAll: async () => {
    const response = await api.get<{ message: string, users: AppUser[] }>('/tasksite/all-users/');
    return response.data.users;
  },

  create: async (data: {
    username: string;
    email: string;
    password: string;
    password_confirm: string;
    first_name: string;
    last_name: string;
    role: AppUser['role'];
  }) => {
    const response = await api.post<AppUser>('/auth/create-user/', data);
    return response.data;
  },

  updateRole: async (id: number, role: AppUser['role']) => {
    const response = await api.patch<AppUser>(`/auth/update-role/${id}/`, { role });
    return response.data;
  },

  delete: async (id: number) => {
    await api.delete(`/auth/delete-user/${id}/`);
  },

  invite: async (data: InviteUserPayload): Promise<InviteUserResponse> => {
    const response = await api.post<InviteUserResponse>('/auth/invite/send/', data);
    return response.data;
  },

  // Invite Accept (Setup Account page)

  // Called on page load — no auth token needed, uses plain axios
  verifyInvite: async (token: string): Promise<InviteVerifyResponse> => {
    const response = await axios.get<InviteVerifyResponse>(
      `${API_URL}/auth/invite/verify/${token}/`
    );
    return response.data;
  },

  // Called on form submit — no auth token needed, uses plain axios
  acceptInvite: async (data: InviteAcceptPayload): Promise<InviteAcceptResponse> => {
    const response = await axios.post<InviteAcceptResponse>(
      `${API_URL}/auth/invite/accept/`,
      data
    );
    return response.data;
  },
};

// Team Chat API
export const chatApi = {
  // 1. Create or Get Private Chat Room
  createPrivateRoom: async (userId: number) => {
    const response = await api.post<ChatRoom>('/chat/rooms/private/', {
      user_id: userId
    } as CreatePrivateChatPayload);
    return response.data;
  },

  // 2. Fetch Messages for a specific Room
  getRoomMessages: async (roomId: string, params?: { limit?: number; before?: string; after?: string }) => {
    const response = await api.get<ChatRoomMessagesResponse>(`/chat/rooms/${roomId}/messages/`, { params });
    return response.data;
  },

  // Send a message 
  sendMessage: async (roomId: string, data: { content: string; attachment?: File }) => {
    const formData = new FormData();
    formData.append('content', data.content);
    if (data.attachment) {
      formData.append('attachment', data.attachment);
    }

    const response = await api.post(`/chat/rooms/${roomId}/messages/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Send a message with attachment via HTTP POST 
  sendMessageWithAttachment: async (roomId: string, data: { content: string | ''; attachment: File }) => {
    const formData = new FormData();
    formData.append('content', data.content || '');
    formData.append('attachment', data.attachment);

    const response = await api.post<ChatMessage>(`/chat/rooms/${roomId}/send/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get Private Rooms 
  getPrivateRooms: async () => {
    const response = await api.get<ChatRoom[]>('/chat/rooms/', {
      params: { type: 'private' }
    });
    return response.data;
  },

  // Team Chat Project Render list
  getProjectRooms: async () => {
    const response = await api.get<ProjectChatRoom[]>('/chat/rooms/', {
      params: { type: 'project' }
    });
    return response.data;
  },

  //Team and Channels Render list  
  getTeamRooms: async () => {
    const response = await api.get<TeamChatRoom[]>('/chat/rooms/', {
      params: { type: 'team' }
    });
    return response.data;
  },

  // Team room chat Delete message
  deleteMessage: async (roomId: string, messageId: string) => {
    const response = await api.delete(`/chat/rooms/${roomId}/messages/${messageId}/`);
    return response.data;
  },

  // Get total unread count
  getUnreadCount: async () => {
    const response = await api.get<ChatUnreadResponse>('/chat/unread/');
    return response.data;
  },

  // Mark messages as read in a room
  markAsRead: async (roomId: string) => {
    const response = await api.post(`/chat/rooms/${roomId}/mark-read/`);
    return response.data;
  },
  // Get room details with members
  getRoomDetails: async (roomId: string) => {
    const response = await api.get<ChatRoom>(`/chat/rooms/${roomId}/`);
    return response.data;
  },

  // Fetch ALL rooms in a single call (private + team + project + thread etc.)
  getAllRooms: async (): Promise<import('@/types').ChatRoomListItem[]> => {
    const response = await api.get<import('@/types').ChatRoomListItem[]>('/chat/rooms/');
    return response.data;
  },

  // TeamChat favourites functionality
  updateRoomSettings: async (roomId: string, settings: { is_favourite?: boolean; is_muted?: boolean }) => {
    const response = await api.patch(`/chat/rooms/${roomId}/settings/`, settings);
    return response.data;
  },

};


// Gateway  WebSocket Service - Receives all messages across all rooms
export class GatewayWebSocketService {
  private ws: WebSocket | null = null;
  private messageCallbacks: Set<(msg: GatewayIncomingMessage) => void> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private userId: number | null = null;
  public presenceMap: Map<number, 'online' | 'offline'> = new Map();
  private presenceListeners: Set<(map: Map<number, 'online' | 'offline'>) => void> = new Set();

  connect() {
    // Prevent multiple connections
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    // Read token from the same key the interceptor updates
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error("No access token available for Gateway WebSocket");
      return;
    }

    // New Gateway WebSocket URL
    const wsUrl = `${WS_GATEWAY_URL}/?token=${token}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.requestOnlineUsers();
    };

    this.ws.onmessage = (event) => {
      try {
        const data: GatewayIncomingMessage = JSON.parse(event.data);

        // Handle connection acknowledgement
        if (data.type === 'GATEWAY_CONNECTED') {
          this.userId = data.user_id || null;
        }

        // Handle individual presence update (single user status change)
        if (data.type === 'PRESENCE' && data.user_id) {
          const status = data.status as 'online' | 'offline';
          this.presenceMap = new Map(this.presenceMap);
          this.presenceMap.set(data.user_id, status);
          this.presenceListeners.forEach(cb => cb(this.presenceMap));
        }
        if (data.type === 'PRESENCE_SYNC') {
          const onlineUserIds: number[] = data.online_users || [];
          const updatedMap = new Map(this.presenceMap);
          onlineUserIds.forEach(uid => updatedMap.set(uid, 'online'));
          this.presenceMap = updatedMap;
          this.presenceListeners.forEach(cb => cb(this.presenceMap));
        }

        // Forward all messages to all registered callbacks
        this.messageCallbacks.forEach(cb => cb(data));
      } catch (err) {
        console.error('Gateway WS Message Parse Error', err);
      }
    };

    this.ws.onerror = (error) => {
      console.error('Gateway WebSocket Error', error);
    };

    this.ws.onclose = () => {
      this.attemptReconnect();
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached for Gateway WebSocket');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Request all currently online users from backend.
  requestOnlineUsers() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ command: 'get_online_users' }));
    }
  }

  // Send message using new command structure
  sendMessage(roomId: string, content: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload: GatewaySendMessagePayload = {
        command: 'send_message',
        room_id: roomId,
        content: content
      };
      this.ws.send(JSON.stringify(payload));
    } else {
      console.error("Gateway WebSocket is not open. Cannot send message.");
    }
  }

  onMessage(callback: (msg: GatewayIncomingMessage) => void) {
    this.messageCallbacks.add(callback);
    // Return unsubscribe function
    return () => this.messageCallbacks.delete(callback);
  }

  offMessage(callback: (msg: GatewayIncomingMessage) => void) {
    this.messageCallbacks.delete(callback);
  }

  // Subscribe to presence updates — fires immediately with current map, then on every change
  onPresenceUpdate(callback: (map: Map<number, 'online' | 'offline'>) => void) {
    this.presenceListeners.add(callback);
    // Fire immediately with current state so the UI hydrates on mount
    callback(this.presenceMap);
    return () => this.presenceListeners.delete(callback);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
      this.userId = null;
    }
    this.messageCallbacks.clear();
    this.presenceListeners.clear();
    this.presenceMap = new Map();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getUserId(): number | null {
    return this.userId;
  }
}
// Export singleton instance for global use
export const gatewaySocket = new GatewayWebSocketService();

// WebSocket Notification Service
export class NotificationWebSocketService {
  private ws: WebSocket | null = null;
  private notificationCallbacks: Set<NotificationCallback> = new Set();
  private chatUnreadCallbacks: Set<(data: { total_unread: number; room_id: string; room_unread: number }) => void> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  // Connect to the WebSocket notification gateway
  connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('❌ No access token available for Notification WebSocket');
      return;
    }

    this.isConnecting = true;

    const wsUrl = `${WS_GATEWAY_URL}/?token=${token}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Check if this is a notification event
          if (message.type === 'SIGNAL' && message.event === 'NEW_NOTIFICATION') {
    const notificationData: NotificationData = message.data;
    const currentWorkspaceId = parseInt(localStorage.getItem('active_workspace_id') || '0');
    notificationData._isCurrentWorkspace = notificationData.workspace_id === currentWorkspaceId;
    this.notificationCallbacks.forEach(callback => {
              try {
                callback(notificationData);
              } catch (err) {
                console.error('Error in notification callback:', err);
              }
            });
          }
          if (message.type === 'SIGNAL' && message.event === 'CHAT_UNREAD_UPDATE') {
            this.chatUnreadCallbacks.forEach(callback => {
              try {
                callback(message.data);
              } catch (err) {
                console.error('Error in chat unread callback:', err);
              }
            });
          }
        } catch (err) {
          console.error('❌ Failed to parse notification message:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ Notification WebSocket error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.attemptReconnect();
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.isConnecting = false;
    }
  }

  // Attempt to reconnect with exponential backoff
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached for Notification WebSocket');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Register a callback to receive notifications
   * @param callback 
   * @returns 
   */
  onNotification(callback: NotificationCallback): () => void {
    this.notificationCallbacks.add(callback);
    return () => {
      this.notificationCallbacks.delete(callback);
    };
  }
  onChatUnreadUpdate(callback: (data: { total_unread: number; room_id: string; room_unread: number }) => void): () => void {
    this.chatUnreadCallbacks.add(callback);
    return () => {
      this.chatUnreadCallbacks.delete(callback);
    };
  }


  // Disconnect from WebSocket
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.reconnectAttempts = 0;
    this.isConnecting = false;

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this.notificationCallbacks.clear();
    this.chatUnreadCallbacks.clear();
  }

  //  Check if WebSocket is currently connected
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }


  // Get current connection state
  getConnectionState(): 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED' {
    if (!this.ws) return 'CLOSED';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'CLOSED';
    }
  }
}

// Export singleton instance for global use
export const notificationSocket = new NotificationWebSocketService();

// Helper function to fetch notifications using existing auth
export const fetchNotifications = async ({ pageParam = 1 }: { pageParam?: number } = {}) => {
  const response = await api.get('/notification/', { params: { page: pageParam } });
  return response.data;
};

// Delete all read notifications
export const deleteReadNotifications = async (): Promise<import('@/types').DeleteReadNotificationsResponse> => {
  const response = await api.delete('/notification/delete-all/');
  return response.data;
};


// THREADS API
const THREADS_STORAGE_KEY = 'zanflow_threads';

export const threadsApi = {
  // Create a new thread room via backend API
  createThreadRoom: async (payload: CreateThreadRoomPayload): Promise<ThreadRoom> => {
    const response = await api.post<ThreadRoom>('/chat/rooms/thread/', payload);
    return response.data;
  },

  // Get all thread rooms for a project from backend
  getProjectThreads: async (projectId: number): Promise<ThreadRoom[]> => {
    const response = await api.get('/chat/rooms/', {
      params: {
        type: 'thread',
        project_id: projectId
      }
    });
    return response.data.results || response.data;
  },

  // Get messages for a specific thread room
  getThreadMessages: async (roomId: string): Promise<ThreadMessagesResponse> => {
    const response = await api.get<ThreadMessagesResponse>(`/chat/rooms/${roomId}/messages/`);
    return response.data;
  },

  // Fetch authoritative unread counts for thread rooms scoped to a project.
  getThreadUnreadCounts: async (projectId: number): Promise<Record<string, number>> => {
    const response = await api.get<ChatUnreadResponse>('/chat/unread/', {
      params: { project_id: projectId },
    });
    const byRoom = response.data.by_room || {};
    const threadUnreads: Record<string, number> = {};

    for (const [roomId, room] of Object.entries(byRoom)) {
      if (
        room.room_type === 'thread' &&
        (room.project_id === undefined || room.project_id === String(projectId))
      ) {
        threadUnreads[roomId] = room.unread_count;
      }
    }
    return threadUnreads;
  },


  /// Delete a thread room
  deleteThreadRoom: async (roomId: string): Promise<void> => {
    await api.delete(`/chat/rooms/${roomId}/`);
  },

  // Connect to WebSocket gateway
  connectThreadSocket: (token: string): WebSocket => {
    const wsUrl = `${WS_GATEWAY_URL}/?token=${token}`;
    return new WebSocket(wsUrl);
  },

  // Join a thread room via WebSocket
  joinThreadRoom: (socket: WebSocket, slug: string): void => {
    if (socket.readyState === WebSocket.OPEN) {
      const command: WSJoinRoomCommand = {
        command: 'join_room',
        room_slug: slug,
      };
      socket.send(JSON.stringify(command));
    }
  },


  // Send message to thread room via WebSocket
  sendThreadMessage: (socket: WebSocket, roomId: string, content: string): void => {
    if (socket.readyState === WebSocket.OPEN) {
      const command: WSSendMessageCommand = {
        command: 'send_message',
        room_id: roomId,
        content: content,
      };
      socket.send(JSON.stringify(command));
    }
  },

  // Parse incoming WebSocket message
  parseIncomingMessage: (event: MessageEvent): WSIncomingThreadMessage | null => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'CHAT_MESSAGE') {
        return parsed as WSIncomingThreadMessage;
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  // Parse incoming unread signal
  parseUnreadSignal: (event: MessageEvent): WSUnreadUpdateSignal | null => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'SIGNAL' && parsed.event === 'CHAT_UNREAD_UPDATE' && parsed.data?.room_type === 'thread') {
        return parsed as WSUnreadUpdateSignal;
      }
      return null;
    } catch (error) {
      return null;
    }
  },


  // Convert backend message to UI message format
  convertToUIMessage: (backendMessage: WSIncomingThreadMessage['data'], currentUserId?: number): ThreadUIMessage => {
    let senderType: 'user' | 'system' | 'other' = 'other';

    if (backendMessage.is_ai_generated || !backendMessage.sender) {
      senderType = 'system';
    } else if (currentUserId && backendMessage.sender.id === currentUserId) {
      senderType = 'user';
    } else if (backendMessage.sender.id !== null) {
      senderType = 'other';
    }
    return {
      id: backendMessage.id,
      text: backendMessage.content,
      sender: senderType,
      timestamp: new Date(backendMessage.created_at),
      isAI: backendMessage.is_ai_generated,
      senderName: backendMessage.sender?.full_name || backendMessage.sender?.username || 'System',
      senderId: backendMessage.sender?.id || null,
    };
  },

  // Convert backend message from messages API to UI format
  convertBackendMessageToUI: (
    backendMsg: ThreadMessagesResponse['messages'][0],
    currentUserId?: number
  ): ThreadUIMessage => {
    // Determine sender type - CRITICAL: Use is_own_message from backend
    let senderType: 'user' | 'system' | 'other' = 'other';

    if (!backendMsg.sender) {
      // AI generated message (sender is null)
      senderType = 'system';
    } else if (backendMsg.is_own_message) {
      // Backend tells us this is our own message
      senderType = 'user';
    } else {
      // Message from another user
      senderType = 'other';
    }

    return {
      id: backendMsg.id,
      text: backendMsg.content,
      sender: senderType,
      timestamp: new Date(backendMsg.created_at),
      isAI: !backendMsg.sender,
      senderName: backendMsg.sender?.full_name || backendMsg.sender?.username,
      senderId: backendMsg.sender?.id || null,
    };
  },
};


// THREADS STORAGE UTILITIE
export const threadsStorageApi = {
  // Get all thread sessions for a project from localStorage
  getProjectThreads: (projectId: number): ThreadStorage => {
    try {
      const data = localStorage.getItem(`${THREADS_STORAGE_KEY}_${projectId}`);
      if (!data) {
        return { sessions: [], lastActiveSessionId: null };
      }
      const parsed = JSON.parse(data);
      return {
        sessions: parsed.sessions.map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        })),
        lastActiveSessionId: parsed.lastActiveSessionId,
      };
    } catch (error) {
      return { sessions: [], lastActiveSessionId: null };
    }
  },


  // Save thread sessions to localStorage
  saveProjectThreads: (projectId: number, data: ThreadStorage): void => {
    try {
      localStorage.setItem(`${THREADS_STORAGE_KEY}_${projectId}`, JSON.stringify(data));
    } catch (error) {
    }
  },


  // Search sessions by title or content
  searchSessions: (sessions: ThreadSession[], query: string): ThreadSession[] => {
    if (!query.trim()) return sessions;

    const lowerQuery = query.toLowerCase();
    return sessions.filter(session => {
      if (session.title.toLowerCase().includes(lowerQuery)) return true;
      return session.messages.some(msg =>
        msg.text.toLowerCase().includes(lowerQuery)
      );
    });
  },
};

// AI BOT WEBSOCKET API
export const aiBotApi = {
  // Connect to the AI Bot WebSocket using JWT token
  connect: (): WebSocket => {
    const tokens = getTokens();
    const token = tokens?.access ?? '';
    return new WebSocket(`${WS_AI_BOT_URL}?token=${token}`);
  },

  // Send a message with page context
  sendMessage: (socket: WebSocket, payload: AIBotSendPayload): void => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  },

  parseMessage: (event: MessageEvent): AIBotIncomingMessage | null => {
    try {
      const parsed = JSON.parse(event.data) as AIBotIncomingMessage;
      if (parsed?.type) return parsed;
      return null;
    } catch {
      return null;
    }
  },
};

// Quick Notes API
export const quickNotesApi = {
  // Folders
  getFolders: async (): Promise<import('@/types').QuickNoteFolder[]> => {
    const response = await api.get('/quicknotes/folders/');
    return response.data.results ?? response.data;
  },

  createFolder: async (data: import('@/types').CreateQuickNoteFolderPayload): Promise<import('@/types').QuickNoteFolder> => {
    const response = await api.post('/quicknotes/folders/', data);
    return response.data;
  },

  // PATCH /quicknotes/folders/{id}/
  updateFolder: async (id: number, data: { name: string }): Promise<import('@/types').QuickNoteFolder> => {
    const response = await api.patch(`/quicknotes/folders/${id}/`, data);
    return response.data;
  },

  // DELETE /quicknotes/folders/{id}/
  deleteFolder: async (id: number): Promise<void> => {
    await api.delete(`/quicknotes/folders/${id}/`);
  },

  // Notes
  getNotes: async (params?: { project?: number }): Promise<import('@/types').PaginatedQuickNotesResponse> => {
    const response = await api.get('/quicknotes/notes/', { params });
    return response.data;
  },

  getNote: async (id: number): Promise<import('@/types').QuickNote> => {
    const response = await api.get(`/quicknotes/notes/${id}/`);
    return response.data;
  },

  createNote: async (data: import('@/types').CreateQuickNotePayload): Promise<import('@/types').QuickNote> => {
    const response = await api.post('/quicknotes/notes/', data);
    return response.data;
  },

  updateNote: async (id: number, data: import('@/types').UpdateQuickNotePayload): Promise<import('@/types').QuickNote> => {
    const response = await api.patch(`/quicknotes/notes/${id}/`, data);
    return response.data;
  },

  deleteNote: async (id: number): Promise<void> => {
    await api.delete(`/quicknotes/notes/${id}/`);
  },
  uploadAttachment: async (noteId: number, file: File): Promise<import('@/types').QuickNoteAttachment> => {
    const formData = new FormData();
    formData.append('note', noteId.toString());
    formData.append('file', file);

    const response = await api.post('/quicknotes/attachments/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteAttachment: async (attachmentId: number): Promise<void> => {
    await api.delete(`/quicknotes/attachments/${attachmentId}/`);
  },
};

// Calendar Daily Update API
export const dailyUpdateApi = {
  // Get the current user's daily update for a specific date
  getMyUpdate: async (date: string, userId: number): Promise<DailyUpdate | null> => {
    const response = await api.get<DailyUpdateListResponse | DailyUpdate[]>('/daily-updates/', {
      params: { date },
    });
    const all: DailyUpdate[] = Array.isArray(response.data)
      ? response.data
      : (response.data as DailyUpdateListResponse).results ?? [];
    const match = all.find((u) => u.date === date && u.user === userId);
    return match ?? null;
  },

  upsert: async (data: DailyUpdatePayload, userId: number): Promise<DailyUpdate> => {
    const existing = await dailyUpdateApi.getMyUpdate(data.date, userId);
    if (existing) {
      const response = await api.patch<DailyUpdate>(`/daily-updates/${existing.id}/`, {
        content: data.content,
      });
      return response.data;
    }
    const response = await api.post<DailyUpdate>('/daily-updates/', data);
    return response.data;
  },

  // Admin / manager
  listAll: async (params?: { date?: string; user?: number }): Promise<DailyUpdate[]> => {
    const response = await api.get<DailyUpdateListResponse | DailyUpdate[]>(
      '/daily-updates/',
      { params }
    );
    const all: DailyUpdate[] = Array.isArray(response.data)
      ? response.data
      : (response.data as DailyUpdateListResponse).results ?? [];
    if (params?.date) {
      return all.filter((u) => u.date === params.date);
    }
    return all;
  },
};
export const eventApi = {
  list: async (params?: any) => {
    const { data } = await api.get('/daily-updates/events/', { params });
    return data;
  },
  create: async (payload: Partial<CalendarEventType>) => {
    const { data } = await api.post('/daily-updates/events/', payload);
    return data;
  },
  retrieve: async (id: number) => {
    const { data } = await api.get(`/daily-updates/events/${id}/`);
    return data;
  },
  update: async (id: number, payload: Partial<CalendarEventType>) => {
    const { data } = await api.patch(`/daily-updates/events/${id}/`, payload);
    return data;
  },
  delete: async (id: number) => {
    await api.delete(`/daily-updates/events/${id}/`);
  },
  checkAvailability: async (attendeeId: number, startTime: string, endTime: string): Promise<{ is_available: boolean }> => {
    const { data } = await api.get('/daily-updates/events/check-availability/', {
      params: {
        attendee_id: attendeeId,
        start_time: startTime,
        end_time: endTime
      }
    });
    return data;
  },
  exportEvent: async (eventId: number) => {
    const response = await api.get(`/daily-updates/events/${eventId}/export/`, {
      responseType: 'blob',
    });

    // Create download link
    const blob = new Blob([response.data], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `event-${eventId}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  exportAllEvents: async () => {
    const response = await api.get('/daily-updates/events/export-all/', {
      responseType: 'blob',
    });

    // Create download link
    const blob = new Blob([response.data], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dyuksa-calendar-${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // ═══════════════════════════════════════════════════════════════════════
  // INVITATION API FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  acceptInvitation: async (invitationId: number): Promise<void> => {
    await api.patch(`/daily-updates/events/invitations/${invitationId}/accept/`, {});
  },

  declineInvitation: async (invitationId: number, reason: string): Promise<void> => {
    await api.patch(`/daily-updates/events/invitations/${invitationId}/decline/`, { reason });
  },

  rescheduleInvitation: async (invitationId: number, proposedTime: string): Promise<void> => {
    await api.patch(`/daily-updates/events/invitations/${invitationId}/reschedule/`, {
      proposed_time: proposedTime
    });
  },

  // ═══════════════════════════════════════════════════════════════════════
  // RSVP STATUS API - Get all attendees' response status for an event
  // ═══════════════════════════════════════════════════════════════════════

  getEventRsvpStatus: async (eventId: number): Promise<{
    event_id: number;
    organizer: string;
    attendee_status: Array<{
      user_id: number;
      name: string;
      status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
      decline_reason: string | null;
      proposed_reschedule_time: string | null;
    }>;
  }> => {
    const { data } = await api.get(`/daily-updates/events/${eventId}/rsvp-status/`);
    return data;
  },
  // Suggest available time slots for a group of attendees
  suggestSlots: async (
    attendeeIds: number[],
    targetDate: string,
    durationMinutes: number = 30
  ): Promise<{
    target_date: string;
    duration_minutes: number;
    available_slots: string[];
  }> => {
    const { data } = await api.post('/daily-updates/events/suggest-slots/', {
      attendee_ids: attendeeIds,
      target_date: targetDate,
      duration_minutes: durationMinutes
    });
    return data;
  },
};
// ═══════════════════════════════════════════════════════════════════════
// DYUKSA AI SCHEDULING ASSISTANT
// ═══════════════════════════════════════════════════════════════════════

export const dyuksaAI = {
  // Send a natural language scheduling request to the AI
  chat: async (message: string): Promise<{
    action?: 'create_event' | 'show_slots' | 'clarify';
    data?: {
      event_type?: string;
      title?: string;
      attendee_ids?: number[];
      attendee_names?: string[];
      target_date?: string;
      duration_minutes?: number;
      available_slots?: string[];
    };
    reply: string;
  }> => {
    const { data } = await api.post('/task-ai/chat/agent/', { message });
    return data;
  },
};

// Add to your api.ts exports
export const calendarShareApi = {
  list: async () => {
    const response = await api.get('/daily-updates/calendar-shares/');
    return Array.isArray(response.data) ? response.data : (response.data.results || []);
  },
  create: async (data: { shared_with: number; permission: 'view' | 'edit' | 'full' }) => {
    const response = await api.post('/daily-updates/calendar-shares/', data);
    return response.data;
  },
  update: async (shareId: number, data: { permission: 'view' | 'edit' | 'full' }) => {
    const response = await api.patch(`/daily-updates/calendar-shares/${shareId}/`, data);
    return response.data;
  },
  delete: async (shareId: number) => {
    await api.delete(`/daily-updates/calendar-shares/${shareId}/`);
  },
};

// ═══════════════════════════════════════════════════════════════════════
// CALENDAR PUBLIC LINK API
// ═══════════════════════════════════════════════════════════════════════

export const calendarLinkApi = {
  list: async () => {
    const response = await api.get('/daily-updates/calendar-links/');
    return Array.isArray(response.data) ? response.data : (response.data.results || []);
  },
  create: async (expiresAt?: string) => {
    const payload = expiresAt ? { expires_at: expiresAt } : {};
    const response = await api.post('/daily-updates/calendar-links/', payload);
    return response.data;
  },
  delete: async (linkId: number) => {
    await api.delete(`/daily-updates/calendar-links/${linkId}/`);
  },
  // Public endpoint - no auth required
  getPublicCalendar: async (token: string) => {
    const response = await api.get(`/daily-updates/shared-calendar/${token}/`, {
      headers: {
        // Remove auth header for public endpoint
        Authorization: undefined
      }
    });
    return response.data;
  },
};

interface Workspace {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  member_count: number;
  role: 'admin' | 'manager' | 'viewer' | 'annotator' | 'developer' | null;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

interface WorkspacesResponse {
  active_workspace_id: number;
  workspaces: Workspace[];
}

export const workspaceApi = {
  getActiveWorkspaceId: (): number | null => {
    const id = localStorage.getItem('active_workspace_id');
    return id ? parseInt(id) : null;
  },

  // ✅ Get workspace details with members
  async getWorkspaceDetails(workspaceId: number) {
    const response = await api.get(`/organizations/workspaces/${workspaceId}/`);
    return response.data;
  },

  // ✅ Get available users to add
  async getAvailableUsers(workspaceId: number, search?: string) {
    const response = await api.get(`/organizations/workspaces/${workspaceId}/available-users/`, {
      params: search ? { search } : undefined,
    });
    return response.data;
  },

  // ✅ Get workspace members
  async getWorkspaceMembers(workspaceId: number) {
    const response = await api.get(`/organizations/workspaces/${workspaceId}/members/`);
    return response.data;
  },

  // ✅ Add member to workspace
  async addMember(workspaceId: number, userId: number, role: string) {
    const response = await api.post(`/organizations/workspaces/${workspaceId}/members/`, {
      user_id: userId, role,
    });
    return response.data;
  },

  // ✅ Remove member from workspace
  async removeMember(workspaceId: number, userId: number) {
    const response = await api.delete(`/organizations/workspaces/${workspaceId}/members/${userId}/`);
    return response.data;
  },

  // ✅ Update member role
  async updateMemberRole(workspaceId: number, userId: number, role: string) {
    const response = await api.patch(`/organizations/workspaces/${workspaceId}/members/${userId}/`, { role });
    return response.data;
  },

  // ✅ Update workspace name
  async updateWorkspace(workspaceId: number, data: { name: string }) {
    const response = await api.patch(`/organizations/workspaces/${workspaceId}/`, data);
    return response.data;
  },

  async deleteWorkspace(workspaceId: number) {
    const response = await api.delete(`/organizations/workspaces/${workspaceId}/delete/`, {
      data: { confirm: 'DELETE' }
    });
    return response.data;
  },

  // 1️⃣ LIST MY WORKSPACES
  async getWorkspaces() {
    const response = await api.get('/organizations/workspaces/');
    const data = response.data;

    console.log('✅ Raw backend response:', data);

    let normalizedData;

    if (Array.isArray(data)) {
      console.log('⚠️ Backend returned array, normalizing...');

      const storedId = localStorage.getItem('active_workspace_id');
      const storedIdNum = storedId ? parseInt(storedId) : null;

      const storedExists = storedIdNum && data.some((w: any) => w.id === storedIdNum);

      let activeId;
      if (storedExists) {
        activeId = storedIdNum;
      } else {
        const defaultWorkspace = data.find((w: any) => w.is_default);
        activeId = defaultWorkspace?.id || data[0]?.id;

        if (storedIdNum && !storedExists) {
          console.log(`⚠️ Stored workspace ${storedIdNum} not found, using ${activeId}`);
        }
      }

      if (activeId && activeId !== storedIdNum) {
        localStorage.setItem('active_workspace_id', String(activeId));
        console.log(`🔄 Updated workspace ID from ${storedIdNum} to ${activeId}`);
      }

      normalizedData = {
        active_workspace_id: activeId,
        workspaces: data
      };
    } else {
      normalizedData = data;

      const storedId = localStorage.getItem('active_workspace_id');
      if (data.active_workspace_id && storedId !== String(data.active_workspace_id)) {
        localStorage.setItem('active_workspace_id', String(data.active_workspace_id));
        console.log(`🔄 Updated workspace ID to ${data.active_workspace_id}`);
      }
    }

    console.log('✅ Normalized data:', normalizedData);
    return normalizedData;
  },

  // 2️⃣ CREATE NEW WORKSPACE
  async createWorkspace(name: string, description?: string, members?: { user_id: number; role: string }[]) {
    const response = await api.post('/organizations/workspaces/', {
      name,
      ...(description && { description }),
      ...(members && members.length > 0 && { members }),
    });
    return response.data;
  },

  // 3️⃣ SWITCH WORKSPACE
  async switchWorkspace(workspaceId: number) {
    const response = await api.post(`/organizations/workspaces/${workspaceId}/switch/`);
    const data = response.data;

    // ✅ 1. Update localStorage
    localStorage.setItem('active_workspace_id', String(workspaceId));

    // ✅ 2. Update axios default header immediately
    api.defaults.headers.common['X-Workspace-ID'] = String(workspaceId);

    console.log(`✅ Workspace switched to ${workspaceId}, axios header updated`);
    return data;
  },

  // 4️⃣ GET WORKSPACE DETAILS
  // async getWorkspaceDetails(workspaceId: number) {
  //   const response = await api.get(`/organizations/workspaces/${workspaceId}/`);
  //   return response.data;
  // },

  // Helper methods
  setActiveWorkspace(workspaceId: number): void {
    localStorage.setItem('active_workspace_id', String(workspaceId));
  },

  clearActiveWorkspace(): void {
    localStorage.removeItem('active_workspace_id');
  }

  
};

// ✅ Auto-start proactive refresh if user is already logged in (page reload)
if (localStorage.getItem('access_token')) {
  startProactiveRefresh();
}

export default api;