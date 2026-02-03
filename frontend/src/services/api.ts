import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  AuthTokens, User as AppUser, PaginatedResponse, PaginatedProjectsResponse, GetUploadUrlPayload, GetUploadUrlResponse, ConfirmUploadResponse, GetDownloadUrlPayload, ConfirmUploadPayload,
  GetDownloadUrlResponse, TaskComment, CreateTaskCommentPayload, AITaskSuggestionResponse, AITaskSuggestionPayload, APICollection,
  APIEndpoint, AuthCredential, ExecutionRun, ExecutionResult, APITestingDashboard, CreateCollectionPayload, CreateEndpointPayload, CreateCredentialPayload, RunCollectionPayload, ProjectCreatePayload,
  Label, DocumentStatus, ChatMessage, ChatRoom, ChatRoomMessagesResponse, CreatePrivateChatPayload, WebSocketSendMessagePayload, WebSocketGlobalMessage, RefineTextPayload, RefineTextResponse, TeamTypeChoicesResponse,
  CreateTeamPayload, Team
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.18:8000/api/v1';


export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
const TOKEN_KEY = 'zanflow_tokens';

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

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const tokens = getTokens();
    if (tokens?.access) {
      config.headers.Authorization = `Bearer ${tokens.access}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle both 401 (Unauthorized) and 403 (Forbidden) for token refresh
    if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
      originalRequest._retry = true;

      const tokens = getTokens();
      if (tokens?.refresh) {
        try {
          const response = await axios.post<AuthTokens>(
            `${API_URL}/auth/refresh/`,
            { refresh: tokens.refresh }
          );

          const newTokens = response.data;
          setTokens(newTokens);
          api.defaults.headers.common['Authorization'] = `Bearer ${newTokens.access}`;
          originalRequest.headers.Authorization = `Bearer ${newTokens.access}`;
          return api(originalRequest);
        } catch (refreshError) {
          clearTokens();
          window.dispatchEvent(new CustomEvent('auth:token-expired'));
          return Promise.reject(refreshError);
        }
      } else {
        clearTokens();
        window.dispatchEvent(new CustomEvent('auth:token-expired'));
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const response = await api.post<AuthTokens>('/auth/login/', {
      username,
      password,
    });
    setTokens(response.data);
    api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;
    return response.data;
  },

  logout: () => {
    clearTokens();
    delete api.defaults.headers.common['Authorization'];
  },

  register: async (data: {
    username: string;
    email: string;
    password: string;
    password_confirm: string;
  }) => {
    const response = await api.post('/auth/register/', data);
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

// Notification
export const notificationsApi = {
  list: async (params?: { limit?: number; offset?: number }) => {
    const response = await api.get('/notification/', { params });
    return response.data;
  },

  getSummary: async () => {
    const response = await api.get('/notification/');
    return {
      total: response.data.total,
      unread: response.data.unread_count
    };
  },

  // Mark a notification as read
  markAsRead: async (id: number) => {
    const response = await api.patch(`/notification/${id}/`, { is_read: true });
    return response.data;
  },

  // Delete a specific notification
  delete: async (id: number) => {
    await api.delete(`/notification/${id}/`);
  },

  clearAll: async () => {
    await api.post('/notification/clear_all/');
  }
};


// Projects API
export const projectsApi = {
  list: async (params?: { task_type?: string; is_active?: boolean }) => {
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

  update: async (id: number, data: Partial<{ name: string; description: string; is_favourite: boolean }>) => {
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
};

// Add Documents API in task type file
export const documentsApi = {
  list: async (params?: {
    project?: number;
    status?: string;
    file_type?: string;
    page?: number;
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
};


// Add New Task API
export const taskApi = {
  list: async () => {
    const response = await api.get('/tasksite/');
    const data = response.data;
    if (data.tasks && Array.isArray(data.tasks)) {
      data.tasks = data.tasks.map((task: any) => ({
        ...task,
        attachments: task.attachments || [],
        labels: task.label_details || []
      }));
    }

    return data;
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
};

// User ManagementAPI
export const usersApi = {
  list: async () => {
    const response = await api.get<PaginatedResponse<AppUser>>('/auth/users/');
    return response.data;
  },
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
  getRoomMessages: async (roomId: string, params?: { limit?: number; offset?: number }) => {
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
};

// WebSocket Service for Real-time Chat
export class ChatWebSocketService {
  private ws: WebSocket | null = null;
  private messageCallback: ((msg: ChatMessage) => void) | null = null;

  connect(roomId: string) {
    const tokens = getTokens();
    if (!tokens?.access) {
      console.error("No access token available for WebSocket");
      return;
    }

    // Construct WS URL with Token
    const wsUrl = `ws://192.168.1.18:8000/ws/chat/${roomId}/?token=${tokens.access}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log(`Connected to Chat Room: ${roomId}`);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle incoming chat message
        if (data.type === 'chat_message' && data.message && this.messageCallback) {
          this.messageCallback(data.message);
        }
      } catch (err) {
        console.error('WS Message Parse Error', err);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket Error', error);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from Chat WS');
    };
  }

  // Send message via WebSocket
  sendMessage(content: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload: WebSocketSendMessagePayload = {
        type: 'chat_message',
        content: content
      };
      this.ws.send(JSON.stringify(payload));
    } else {
      console.error("WebSocket is not open. Cannot send message.");
    }
  }

  // Register callback for UI updates
  onMessage(callback: (msg: ChatMessage) => void) {
    this.messageCallback = callback;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.messageCallback = null;
    }
  }
}

// Add this new class after the ChatWebSocketService class (after line 667 in api.ts)

// Global WebSocket Service - Receives all messages across all rooms
export class GlobalChatWebSocketService {
  private ws: WebSocket | null = null;
  private messageCallback: ((msg: WebSocketGlobalMessage) => void) | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    const tokens = getTokens();
    if (!tokens?.access) {
      console.error("No access token available for Global WebSocket");
      return;
    }

    // Global WebSocket URL - listens to ALL rooms for this user
    const wsUrl = `ws://192.168.1.12:8000/ws/chat/global/?token=${tokens.access}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('🌍 Connected to Global Chat WebSocket');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data: WebSocketGlobalMessage = JSON.parse(event.data);

        if (this.messageCallback) {
          this.messageCallback(data);
        }
      } catch (err) {
        console.error('Global WS Message Parse Error', err);
      }
    };

    this.ws.onerror = (error) => {
      console.error('Global WebSocket Error', error);
    };

    this.ws.onclose = () => {
      console.log('❌ Global WebSocket Disconnected');
      this.attemptReconnect();
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached for Global WebSocket');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`Reconnecting Global WebSocket in ${delay}ms... (Attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  onMessage(callback: (msg: WebSocketGlobalMessage) => void) {
    this.messageCallback = callback;
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.messageCallback = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance for global use (optional)
export const globalChatSocket = new GlobalChatWebSocketService();

// API Testing Platform API
export const apiTestingApi = {
  // Collections
  listCollections: async (params?: { project_id?: number }) => {
    const response = await api.get<PaginatedResponse<APICollection>>('/api-testing/collections/', { params });
    return response.data;
  },

  getCollection: async (id: string) => {
    const response = await api.get<APICollection>(`/api-testing/collections/${id}/`);
    return response.data;
  },

  createCollection: async (data: CreateCollectionPayload) => {
    const response = await api.post<APICollection>('/api-testing/collections/', data);
    return response.data;
  },

  updateCollection: async (id: string, data: Partial<CreateCollectionPayload>) => {
    const response = await api.patch<APICollection>(`/api-testing/collections/${id}/`, data);
    return response.data;
  },

  deleteCollection: async (id: string) => {
    await api.delete(`/api-testing/collections/${id}/`);
  },

  runCollection: async (id: string, data?: RunCollectionPayload) => {
    const response = await api.post<ExecutionRun>(`/api-testing/collections/${id}/run/`, data || {});
    return response.data;
  },

  getCollectionHistory: async (id: string) => {
    const response = await api.get<ExecutionRun[]>(`/api-testing/collections/${id}/history/`);
    return response.data;
  },

  // Endpoints
  listEndpoints: async (params?: { collection?: string }) => {
    const response = await api.get<PaginatedResponse<APIEndpoint>>('/api-testing/endpoints/', { params });
    return response.data;
  },

  getEndpoint: async (id: string) => {
    const response = await api.get<APIEndpoint>(`/api-testing/endpoints/${id}/`);
    return response.data;
  },

  createEndpoint: async (data: CreateEndpointPayload) => {
    const response = await api.post<APIEndpoint>('/api-testing/endpoints/', data);
    return response.data;
  },

  updateEndpoint: async (id: string, data: Partial<CreateEndpointPayload>) => {
    const response = await api.patch<APIEndpoint>(`/api-testing/endpoints/${id}/`, data);
    return response.data;
  },

  deleteEndpoint: async (id: string) => {
    await api.delete(`/api-testing/endpoints/${id}/`);
  },

  runEndpoint: async (id: string, data?: { credential_id?: string; environment_overrides?: Record<string, string> }) => {
    const response = await api.post<ExecutionResult>(`/api-testing/endpoints/${id}/run/`, data || {});
    return response.data;
  },

  // Credentials
  listCredentials: async (params?: { collection?: string }) => {
    const response = await api.get<PaginatedResponse<AuthCredential>>('/api-testing/credentials/', { params });
    return response.data;
  },

  getCredential: async (id: string) => {
    const response = await api.get<AuthCredential>(`/api-testing/credentials/${id}/`);
    return response.data;
  },

  createCredential: async (data: CreateCredentialPayload) => {
    const response = await api.post<AuthCredential>('/api-testing/credentials/', data);
    return response.data;
  },

  updateCredential: async (id: string, data: Partial<CreateCredentialPayload>) => {
    const response = await api.patch<AuthCredential>(`/api-testing/credentials/${id}/`, data);
    return response.data;
  },

  deleteCredential: async (id: string) => {
    await api.delete(`/api-testing/credentials/${id}/`);
  },

  // Execution Runs
  listRuns: async (params?: { collection?: string; status?: string }) => {
    const response = await api.get<PaginatedResponse<ExecutionRun>>('/api-testing/runs/', { params });
    return response.data;
  },

  getRun: async (id: string) => {
    const response = await api.get<ExecutionRun>(`/api-testing/runs/${id}/`);
    return response.data;
  },

  // Dashboard
  getDashboard: async () => {
    const response = await api.get<APITestingDashboard>('/api-testing/dashboard/');
    return response.data;
  },
};

export default api;
