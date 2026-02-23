import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  AuthTokens, User as AppUser, PaginatedResponse, PaginatedProjectsResponse, GetUploadUrlPayload, GetUploadUrlResponse, ConfirmUploadResponse, GetDownloadUrlPayload, ConfirmUploadPayload,
  GetDownloadUrlResponse, AllDocumentsResponse, TaskComment, CreateTaskCommentPayload, AITaskSuggestionResponse, AITaskSuggestionPayload, ProjectCreatePayload,
  Label, DocumentStatus, ChatMessage, ChatRoom, ChatRoomMessagesResponse, CreatePrivateChatPayload, GatewaySendMessagePayload, GatewayIncomingMessage, RefineTextPayload, RefineTextResponse, TaskResponse, TeamTypeChoicesResponse,
  CreateTeamPayload, ProjectChatRoom, TeamChatRoom, ChatUnreadResponse, NotificationData, NotificationCallback, Team, ThreadRoom, ThreadSession, ThreadStorage, ThreadUIMessage, CreateThreadRoomPayload, WSJoinRoomCommand, WSSendMessageCommand, WSIncomingThreadMessage, WSUnreadUpdateSignal
} from '@/types';


//export const API_URL = (import.meta as any).env.VITE_API_URL || 'http://192.168.1.4:8000/api/v1';
//const WS_GATEWAY_URL = (import.meta as any).env.VITE_WS_GATEWAY_URL || 'ws://192.168.1.4:8000/ws/gateway';

//export const API_URL = (import.meta as any).env.VITE_API_URL || 'http://192.168.1.14:8000/api/v1';
//const WS_GATEWAY_URL = (import.meta as any).env.VITE_WS_GATEWAY_URL || 'ws://192.168.1.14:8000/ws/gateway';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
const WS_GATEWAY_URL = import.meta.env.VITE_WS_GATEWAY_URL || 'ws://localhost:8000/ws/gateway';

//export const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api/v1';
//const WS_GATEWAY_URL = (import.meta as any).env.VITE_WS_GATEWAY_URL || 'ws://localhost:8000/ws/gateway';


//export const API_URL = (import.meta as any).env.VITE_API_URL || 'http://192.168.1.6:8000/api/v1';
//const WS_GATEWAY_URL = (import.meta as any).env.VITE_WS_GATEWAY_URL || 'ws://192.168.1.6:8000/ws/gateway';


//export const API_URL = (import.meta as any).env.VITE_API_URL || 'http://192.168.1.18:8000/api/v1';
//const WS_GATEWAY_URL = (import.meta as any).env.VITE_WS_GATEWAY_URL || 'ws://192.168.1.12:8000/ws/gateway';
 
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

// Token refresh mutex
let isRefreshing = false;
let refreshPromise: Promise<AuthTokens> | null = null;

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

// Response interceptor for token refresh with mutex to prevent race conditions
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
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = axios
            .post<AuthTokens>(`${API_URL}/auth/refresh/`, {
              refresh: tokens.refresh,
            })
            .then((res) => {
              const newTokens = res.data;
              setTokens(newTokens);
              api.defaults.headers.common['Authorization'] = `Bearer ${newTokens.access}`;
              return newTokens;
            })
            .catch((refreshError) => {
              clearTokens();
              window.dispatchEvent(new CustomEvent('auth:token-expired'));
              throw refreshError;
            })
            .finally(() => {
              isRefreshing = false;
              refreshPromise = null;
            });
        }

        try {
          const newTokens = await refreshPromise!;
          originalRequest.headers.Authorization = `Bearer ${newTokens.access}`;
          return api(originalRequest);
        } catch {
          return Promise.reject(error);
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
  // Get all project and task documents with optional task filtering
  getAllDocuments: async (projectId: number, taskId?: number) => {
    const url = `/documents/project/${projectId}/all/`;
    const params = taskId ? { task_id: taskId } : {};
    const response = await api.get<AllDocumentsResponse>(url, { params });
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

      // Sort tasks by created_at and updated_at in descending order 
      data.tasks.sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA; 
      });
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

  // TeamChat favourites functionality
  updateRoomSettings: async (roomId: string, settings: { is_favourite?: boolean; is_muted?: boolean }) => {
    const response = await api.patch(`/chat/rooms/${roomId}/settings/`, settings);
    return response.data;
  },

};


// Gateway  WebSocket Service - Receives all messages across all rooms
export class GatewayWebSocketService {
  private ws: WebSocket | null = null;
  private messageCallback: ((msg: GatewayIncomingMessage) => void) | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private userId: number | null = null;

  connect() {
    // Prevent multiple connections
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('⚠️ Gateway WebSocket already connected/connecting');
      return;
    }

    const tokens = getTokens();
    if (!tokens?.access) {
      console.error("No access token available for Gateway WebSocket");
      return;
    }

    // New Gateway WebSocket URL
    const wsUrl = `${WS_GATEWAY_URL}/?token=${tokens.access}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('🌍 Connected to WebSocket Gateway');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data: GatewayIncomingMessage = JSON.parse(event.data);

        // Handle connection acknowledgement
        if (data.type === 'GATEWAY_CONNECTED') {
          this.userId = data.user_id || null;
        }

        // Forward all messages to callback
        if (this.messageCallback) {
          this.messageCallback(data);
        }
      } catch (err) {
        console.error('Gateway WS Message Parse Error', err);
      }
    };

    this.ws.onerror = (error) => {
      console.error('Gateway WebSocket Error', error);
    };

    this.ws.onclose = () => {
      console.log('❌ Gateway WebSocket Disconnected');
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

    console.log(`Reconnecting Gateway WebSocket in ${delay}ms... (Attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
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
      console.log(`📤 Message sent to room ${roomId}`);
    } else {
      console.error("Gateway WebSocket is not open. Cannot send message.");
    }
  }

  onMessage(callback: (msg: GatewayIncomingMessage) => void) {
    this.messageCallback = callback;
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
      this.messageCallback = null;
      this.userId = null;
    }
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
  private chatUnreadCallbacks: Set<(data: { total_unread: number; room_id: string }) => void> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  // Connect to the WebSocket notification gateway
  connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('⚠️ Notification WebSocket already connecting');
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('⚠️ Notification WebSocket already connected');
      return;
    }

    const tokens = getTokens();
    if (!tokens?.access) {
      console.error('❌ No access token available for Notification WebSocket');
      return;
    }

    this.isConnecting = true;

    const wsUrl = `${WS_GATEWAY_URL}/?token=${tokens.access}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('🔔 Connected to Notification WebSocket Gateway');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Check if this is a notification event
          if (message.type === 'SIGNAL' && message.event === 'NEW_NOTIFICATION') {
            const notificationData: NotificationData = message.data;

            console.log('📬 New notification received:', notificationData);

            // Notify all registered callbacks
            this.notificationCallbacks.forEach(callback => {
              try {
                callback(notificationData);
              } catch (err) {
                console.error('Error in notification callback:', err);
              }
            });
          }
          // Check if this is a chat unread update event
          if (message.type === 'SIGNAL' && message.event === 'CHAT_UNREAD_UPDATE') {

            // Notify all registered unread callbacks
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
        console.log('❌ Notification WebSocket disconnected', event.code, event.reason);
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

    console.log(`🔄 Reconnecting Notification WebSocket in ${delay}ms... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

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
  onChatUnreadUpdate(callback: (data: { total_unread: number; room_id: string }) => void): () => void {
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
export const fetchNotifications = async () => {
  const response = await api.get('/notification/');
  return response.data;
};


// // THREADS API
// const THREADS_STORAGE_KEY = 'zanflow_threads';

// export const threadsApi = {
//   /**
//    * Create a new thread room via backend API
//    */
//   createThreadRoom: async (payload: CreateThreadRoomPayload): Promise<ThreadRoom> => {
//     const response = await api.post<ThreadRoom>('/chat/rooms/thread/', payload);
//     return response.data;
//   },

//   /**
//    * Connect to WebSocket gateway
//    */
//   connectThreadSocket: (token: string): WebSocket => {
//     const wsUrl = `${WS_GATEWAY_URL}/?token=${token}`;
//     return new WebSocket(wsUrl);
//   },

//   /**
//    * Join a thread room via WebSocket
//    */
//   joinThreadRoom: (socket: WebSocket, slug: string): void => {
//     if (socket.readyState === WebSocket.OPEN) {
//       const command: WSJoinRoomCommand = {
//         command: 'join_room',
//         room_slug: slug,
//       };
//       socket.send(JSON.stringify(command));
//     }
//   },

//   /**
//    * Send message to thread room via WebSocket
//    */
//   sendThreadMessage: (socket: WebSocket, roomId: string, content: string): void => {
//     if (socket.readyState === WebSocket.OPEN) {
//       const command: WSSendMessageCommand = {
//         command: 'send_message',
//         room_id: roomId,
//         content: content,
//       };
//       socket.send(JSON.stringify(command));
//     }
//   },

//   /**
//    * Parse incoming WebSocket message
// /**
//    * Parse incoming WebSocket message
//    */
//   parseIncomingMessage: (event: MessageEvent): WSIncomingThreadMessage | null => {
//     try {
//       const parsed = JSON.parse(event.data);
//       if (parsed.type === 'CHAT_MESSAGE') {
//         return parsed as WSIncomingThreadMessage;
//       }
//       return null;
//     } catch (error) {
//       return null;
//     }
//   },

//   // Parse incoming unread signal
//   parseUnreadSignal: (event: MessageEvent): WSUnreadUpdateSignal | null => {
//     try {
//       const parsed = JSON.parse(event.data);
//       if (parsed.type === 'SIGNAL' && parsed.event === 'CHAT_UNREAD_UPDATE') {
//         return parsed as WSUnreadUpdateSignal;
//       }
//       return null;
//     } catch (error) {
//       return null;
//     }
//   },


//   // Convert backend message to UI message format
//   convertToUIMessage: (backendMessage: WSIncomingThreadMessage['data']): ThreadUIMessage => {
//     return {
//       id: backendMessage.id,
//       text: backendMessage.content,
//       sender: backendMessage.is_ai_generated ? 'system' : 'user',
//       timestamp: new Date(backendMessage.created_at),
//       isAI: backendMessage.is_ai_generated,
//     };
//   },
// };


// // THREADS STORAGE UTILITIE
// export const threadsStorageApi = {
//    // Get all thread sessions for a project from localStorage
//   getProjectThreads: (projectId: number): ThreadStorage => {
//     try {
//       const data = localStorage.getItem(`${THREADS_STORAGE_KEY}_${projectId}`);
//       if (!data) {
//         return { sessions: [], lastActiveSessionId: null };
//       }
//       const parsed = JSON.parse(data);
//       return {
//         sessions: parsed.sessions.map((session: any) => ({
//           ...session,
//           createdAt: new Date(session.createdAt),
//           updatedAt: new Date(session.updatedAt),
//           messages: session.messages.map((msg: any) => ({
//             ...msg,
//             timestamp: new Date(msg.timestamp),
//           })),
//         })),
//         lastActiveSessionId: parsed.lastActiveSessionId,
//       };
//     } catch (error) {
//       return { sessions: [], lastActiveSessionId: null };
//     }
//   },


//   // Save thread sessions to localStorage
//   saveProjectThreads: (projectId: number, data: ThreadStorage): void => {
//     try {
//       localStorage.setItem(`${THREADS_STORAGE_KEY}_${projectId}`, JSON.stringify(data));
//     } catch (error) {
//     }
//   },


//   // Search sessions by title or content
//   searchSessions: (sessions: ThreadSession[], query: string): ThreadSession[] => {
//     if (!query.trim()) return sessions;
    
//     const lowerQuery = query.toLowerCase();
//     return sessions.filter(session => {
//       if (session.title.toLowerCase().includes(lowerQuery)) return true;
//       return session.messages.some(msg => 
//         msg.text.toLowerCase().includes(lowerQuery)
//       );
//     });
//   },
// };


export default api;
