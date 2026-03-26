// User Types 
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'annotator' | 'viewer';
  avatar?: string;
  is_active: boolean;
  is_superuser?: boolean;
  date_joined: string;
  skills?: string[];
}

// User Management 
// Invite User
export interface InviteUserPayload {
  email: string;
  role: 'admin' | 'manager' | 'annotator' | 'viewer';
}

export interface InviteUserResponse {
  detail: string;
}

// Invite Accept (Setup Account page)
export interface InviteVerifyResponse {
  email: string;
  role: 'admin' | 'manager' | 'annotator' | 'viewer';
}

export interface InviteAcceptPayload {
  token: string;
  username: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
}

export interface InviteAcceptResponse {
  detail: string;
}

// Minimal user info for nested references
export interface UserMinimal {
  id: number;
  username: string;
  full_name: string;
  avatar?: string;
}

// Project page  types 
export interface Project {
  is_favourite: boolean;
  id: number;
  name: string;
  description: string;
  task_type: TaskType;
  settings: ProjectSettings;
  default_labels: string[];
  is_active: boolean;
  created_by: UserMinimal;
  created_at: string;
  updated_at: string;
  labels: Label[];
  member_count: number;
  document_count: number;
  members?: ProjectMember[];
}

// In Project page  render member list on card
export interface ProjectMember {
  id: number;
  user: UserMinimal;
  full_name: string;
  role: 'owner' | 'member';
  joined_at: string;
}
//  In create task load project name from project list API
export interface ProjectMinimal {
  id: number;
  name: string;
}

// In project listing page with pagination
export interface PaginatedProjectsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ProjectMinimal[];
}

// Create New Project dropdown for task type
export type TaskType =
  | 'client'
  | 'internal'
  | 'content-creation'
  | 'ideas'

// Create New Project payload
export interface ProjectCreatePayload {
  name: string;
  description?: string;
  task_type: string;
  assigned_members: { user_id: number; role: string }[];
  project_settings?: Record<string, any>;
}

// In project settings page

export interface ProjectSettings {
  metrics?: string[];
  comparison_rules?: {
    ignore_whitespace?: boolean;
    case_sensitive?: boolean;
    numeric_tolerance?: number;
  };
  required_fields?: string[];
}

export interface ProjectStats {
  total_documents: number;
  approved_documents: number;
  pending_documents: number;
  total_test_runs: number;
  latest_accuracy: number | null;
  open_issues: number;
}

export interface Label {
  id: number;
  name: string;
  color: string;
  description: string;
  is_default: boolean;
  created_at: string;
}

export interface TaskAttachment {
  id: number;
  file_url: string;
  file_name: string;
  uploaded_at: string;
}

// In createtask page add link
export interface TaskLink {
  id: number;
  url: string;
  created_at: string;
}


// In CreateTask add AI Refined For TaskTitle and Description
export interface RefineTextPayload {
  text: string;
  type: 'optimize_title' | 'generate_description' | 'refine_description';
}

export interface RefineTextResponse {
  refined_text: string;
}

// In task detail page
export interface Task {
  id: number;
  heading: string;
  description: string;
  duration?: string;
  duration_time?: string;
  start_date: string;
  end_date: string;
  priority: string;
  project: string | null;
  project_details?: ProjectMinimal;
  project_name: string | null;
  assigned_to: number[];
  assigned_to_user_details: User[];
  assigned_by: number;
  assigned_by_user_details?: User;
  status: 'pending' | 'backlog' | 'in_progress' | 'completed' | 'deployed' | 'deferred' | 'review' | string;
  labels?: Label[];
  links?: TaskLink[];
  attachments?: TaskAttachment[];
  created_at?: string;
  updated_at?: string;
  is_pinned?: boolean;
  comments?: TaskComment[];
}

// Pin task API response
export interface PinTaskResponse {
  message: string;
  is_pinned: boolean;
}

// Update TaskResponse to use the interface
export interface TaskResponse {
  message: string;
  task: Task;
}

// Paginated task list response (DRF standard envelope)
export interface TaskPaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Task[];
}

// In taskdetailmodal comment section 
export interface TaskComment {
  id: number;
  task: number;
  user: number;
  user_details: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  content: string;
  created_at: string;
}

// TaskdetailModal Comment Payload
export interface CreateTaskCommentPayload {
  content: string;
}

// Document types
export interface Document {
  id: string;
  project: number;
  project_name?: string;
  name: string;
  description: string;
  source_file?: string;
  source_file_url?: string;
  original_file_name?: string;
  file_type: FileType;
  file_size?: number;
  metadata: Record<string, unknown>;
  status: DocumentStatus;
  assigned_users?: UserMinimal[];
  created_by: UserMinimal;
  created_at: string;
  updated_at: string;
  labels?: Label[];
  version_count?: number;
}

export type FileType = 'pdf' | 'image' | 'json' | 'text' | 'video' | 'other';
export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'archived';

// Test types
export interface TestRun {
  id: string;
  project: number;
  name: string;
  description: string;
  status: TestRunStatus;
  triggered_by: TriggerType;
  config: Record<string, unknown>;
  summary_metrics: Record<string, number>;
  s3_output_path?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  created_at: string;
}

export type TestRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type TriggerType = 'manual' | 'api' | 'scheduled' | 'ci_cd';

export interface TestResult {
  id: string;
  test_run: string;
  document: string;
  status: TestResultStatus;
  extracted_data: Record<string, unknown>;
  metrics: Record<string, unknown>;
  diff_data: DiffData;
  debug_data: Record<string, unknown>;
  error_message?: string;
}

export type TestResultStatus = 'pass' | 'fail' | 'error' | 'skipped';

export interface DiffData {
  matched?: string[];
  mismatched?: Array<{ field: string; expected: unknown; actual: unknown }>;
  missing?: string[];
  extra?: string[];
}

// Issue types
export interface Issue {
  id: string;
  project: number;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  issue_type: IssueType;
  labels: Label[];
  assignees: UserMinimal[];
  due_date?: string;
  parent_issue?: string;
  auto_generated: boolean;
  error_category?: string;
  resolved_at?: string;
  resolved_by?: UserMinimal;
  resolution_notes?: string;
  created_by: UserMinimal;
  created_at: string;
  updated_at: string;
}

export type IssueStatus =
  | 'open'
  | 'in_progress'
  | 'in_review'
  | 'resolved'
  | 'closed'
  | 'wont_fix';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';
export type IssueType =
  | 'bug'
  | 'task'
  | 'improvement'
  | 'auto_generated';

// API types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail?: string;
  [key: string]: unknown;
}

// Auth types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

// Sign Up page
export interface OrganizationSignupPayload {
  company_name: string;
  admin_email: string;
  password: string;
  password_confirm: string;
}

export interface OrganizationSignupResponse {
  message: string;
  organization: {
    id: number;
    name: string;
    slug: string;
  };
  user: Pick<User, 'id' | 'username' | 'email' | 'role'>;
  tokens: AuthTokens;
}

// Tool: PdfVsHtml types
export interface ToolDocumentListPayload {
  documents: string[];
}

export interface StyleCounts {
  bold: number;
  italic: number;
  boldItalic: number;
  superscript: number;
}

export interface Highlight {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentDetailResponse {
  pdf_base64: string;
  html_url: string;
}

// Base for selectable elements (Text, Table, Cell)
export interface SelectableBaseElement {
  id: string;
  PDF: string;
  page: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface SelectableTextElement extends SelectableBaseElement {
  type: 'text';
  text: string;
  words_pos: string;
}

export interface SelectableTableElement extends SelectableBaseElement {
  type: 'table';
  table_num_cols: number;
  table_num_rows: number;
  table_last_header_row: number;
  table_last_header_col: number;
  caption_text: string | null;
  label: string;
  ids_table_merge: string | null;
  table_np: string;
}

export interface SelectableCellElement extends SelectableBaseElement {
  type: 'cell';
  text: string;
}

export type SelectableElement = SelectableTextElement | SelectableTableElement | SelectableCellElement;

export interface PageContentErrorResponse {
  ok: boolean;
  error: string;
  payload?: any;
  data?: null;
}

export interface GetUploadUrlPayload {
  file_name: string;
  file_type: string;
}

export interface GetUploadUrlResponse {
  url: string;
  fields: Record<string, string>;
  file_key: string;
}

export interface ConfirmUploadResponse {
  id: string;
  status: DocumentStatus;
}

// 4th API call (Get Download URL)
export interface GetDownloadUrlPayload {
  document_id: string;
}

export interface GetDownloadUrlResponse {
  url: string;
}

// Create AI based Task Generation 
export interface AITaskSuggestionPayload {
  project_id: number;
  description: string;
}

export interface AITaskSuggestionResponse {
  heading: string;
  description: string;
  start_date: string;
  end_date: string;
  assigned_to: number[];
  project: number;
  status: string;
  priority: string;
  ai_metadata: {
    required_skills: string[];
    assignment_reasoning: string;
  };
}

export interface APIEndpoint {
  id: string;
  collection: string;
  name: string;
  description?: string;
  http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  headers: Record<string, string>;
  query_params: Record<string, string>;
  request_body?: Record<string, any> | string;
  body_type: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'none';
  expected_status_code: number;
  expected_response_contains?: Record<string, any>;
  timeout_seconds: number;
  retry_count: number;
  retry_delay_seconds: number;
  sort_order: number;
  is_active: boolean;
  extract_variables?: Record<string, string>;
  depends_on?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthCredential {
  id: string;
  collection: string;
  collection_name?: string;
  name: string;
  auth_type: 'bearer' | 'basic' | 'api_key' | 'api_key_header' | 'api_key_query' | 'oauth2' | 'custom';
  header_name: string;
  header_prefix: string;
  api_key_name?: string;
  is_active: boolean;
  expires_at?: string;
  is_expired?: boolean;
  auto_refresh: boolean;
  refresh_url?: string;
  refresh_payload?: Record<string, any>;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCollectionPayload {
  name: string;
  description?: string;
  project_id?: number;
  execution_order?: 'sequential' | 'parallel';
  environment_variables?: Record<string, string>;
  tags?: string[];
}

// Calendar Event types
export interface CalendarEvent {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  type: 'task' | 'event' | 'meeting';
}

// Create Team Types
export interface TeamTypeChoice {
  value: string;
  label: string;
}

export interface TeamTypeChoicesResponse {
  team_types: TeamTypeChoice[];
}

// Create Save Team Payload
export interface CreateTeamPayload {
  name: string;
  team_type: string;
  description: string;
  leader_id: number;
  member_ids: number[];
}

// Team Member User Info
export interface TeamMemberUserInfo {
  id: number;
  email: string;
  full_name: string;
  initials: string;
}

// Team Member
export interface TeamMember {
  id: number;
  user: TeamMemberUserInfo;
  role: 'owner' | 'member';
  role_display: string;
  can_manage: boolean;
  joined_at: string;
  created_at: string;
}

// Team Response
export interface Team {
  id: number;
  name: string;
  team_type: string;
  team_type_display: string;
  color: string;
  description: string;
  leader: number;
  leader_info: TeamMemberUserInfo;
  member_count: number;
  members: TeamMember[];
  my_role: 'owner' | 'member';
  can_manage: boolean;
  is_favourite: boolean;
  created_at: string;
  updated_at: string;
}

// Team Chat types
export interface ChatUserMinimal {
  id: number;
  username: string;
  full_name: string;
  email: string;
}

export interface ChatRoomMembership {
  id: string;
  user: ChatUserMinimal;
  joined_at: string;
  last_read_at: string | null;
  is_muted: boolean;
  room_role: 'owner' | 'admin' | 'member';
  is_favourite: boolean;
}

export interface ChatRoom {
  id: string;
  name: string;
  room_type: 'private' | 'group' | 'project' | 'team';
  slug: string;
  project: number | null;
  participants?: ChatUserMinimal[];
  participant_count?: number;
  created_by?: ChatUserMinimal;
  memberships?: ChatRoomMembership[];
  current_user_membership?: ChatRoomMembership;
  last_message?: {
    id: string;
    sender_username: string;
    content_preview: string;
    created_at: string;
  } | null;
  unread_count?: number;
  is_member?: boolean;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface ChatMessage {
  id: string | number;
  room: string;
  sender: ChatUserMinimal;
  content: string;
  created_at: string;
  is_own_message: boolean;
  message_type: string;
  attachment: string | null;
  attachment_name: string;
  reply_to: string | null;
  reply_to_preview: string | null;
  updated_at: string;
  is_deleted: boolean;
  is_read?: boolean;
  attachments?: any[];
}

// Optimistic message status for UI rendering
export type OptimisticMessageStatus = 'sending' | 'sent' | 'error';

export interface OptimisticChatMessage extends ChatMessage {
  optimisticStatus?: OptimisticMessageStatus;
  optimisticId?: string;
}

export interface ChatRoomMessagesResponse {
  messages: ChatMessage[];
  count: number;
  has_more: boolean;
}

//Team Chat Project Render list
export interface ProjectChatRoom {
  id: string;
  name: string;
  room_type: 'project';
  slug: string;
  project: number;
  participant_count: number;
  last_message: {
    id: string;
    sender_username: string;
    content_preview: string;
    created_at: string;
  } | null;
  unread_count: number;
  is_member: boolean;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// Paginated Project Chat Rooms Response
export interface PaginatedProjectChatRoomsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ProjectChatRoom[];
}

//Team and Channels Render list
export interface TeamChatRoom {
  id: string;
  name: string;
  room_type: 'team';
  slug: string;
  project: null;
  participant_count: number;
  last_message: string | null;
  unread_count: number;
  is_member: boolean;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// Payload for creating a private room
export interface CreatePrivateChatPayload {
  user_id: number;
}

// WebSocket Gateway types
export interface GatewayConnectedEvent {
  type: 'GATEWAY_CONNECTED';
  user_id: number;
}

export interface GatewaySendMessagePayload {
  command: 'send_message';
  room_id: string;
  content: string;
}

export interface GatewayIncomingMessage {
  type: 'CHAT_MESSAGE' | 'SIGNAL' | 'GATEWAY_CONNECTED' | 'PRESENCE' | 'PRESENCE_SYNC' | 'room_created';
  event?: 'NEW_NOTIFICATION' | 'CHAT_UNREAD_UPDATE';
  message?: ChatMessage;
  data?: ChatMessage | NotificationData | any;
  room_id?: string;
  user_id?: number;
  online_users?: number[];
  status?: 'online' | 'offline';
  username?: string;
  room?: any;
}

// Global WebSocket types for cross-room messaging
export interface UnreadCount {
  room_id: string;
  count: number;
}

// WebSocket Notification System Types
export interface NotificationRelatedObject {
  type: 'task' | 'project' | 'message' | 'comment' | 'team';
  id: string | number;
}

// Individual notification data structure
export interface NotificationData {
  id: number;
  title: string;
  message?: string;
  notification_type?: string;
  priority?: string;
  actor_name?: string | null;
  is_read: boolean;
  metadata?: {
    task_id?: number;
    task_heading?: string;
    project_id?: string | number;
    project_name?: string;
    old_status?: string;
    new_status?: string;
    priority?: string;
    [key: string]: any;
  };
  related_object?: NotificationRelatedObject;
  time_since?: string;
  created_at?: string;
  unread_count?: number;
}

// API response wrapper for notification list
export interface NotificationListResponse {
  message: string;
  total: number;
  unread_count: number;
  limit: number;
  offset: number;
  notifications: NotificationData[];
}

// Response type for delete-read notifications API
export interface DeleteReadNotificationsResponse {
  message: string;
  deleted_count: number;
}

// WebSocket notification event wrapper
export interface WebSocketNotificationEvent {
  type: 'SIGNAL';
  event: 'NEW_NOTIFICATION';
  data: NotificationData;
}

// Callback type for notification listeners
export type NotificationCallback = (notification: NotificationData) => void;

// Team chat and thread chattotal badge unread_count
export interface ChatUnreadResponse {
  total_unread: number;
  thread_unread: number;
  rooms_with_unread: number;
  by_room: Record<string, {
    name: string;
    unread_count: number;
    room_type: string;
    last_message_at?: string;
    project_id?: string;
  }>;
}

// Presence event from WebSocket gateway
export interface PresenceEvent {
  type: 'PRESENCE';
  status: 'online' | 'offline';
  user_id: number;
  username: string | null;
}

// Chat unread update WebSocket event
export interface ChatUnreadUpdateEvent {
  type: 'SIGNAL';
  event: 'CHAT_UNREAD_UPDATE';
  data: {
    room_id: string;
    total_unread: number;
    room_unread: number;
  };
}

// Unified room shape returned by /api/v1/chat/rooms/ (all room_types in one call)
export interface ChatRoomListItem {
  id: string;
  name: string;
  room_type: 'private' | 'group' | 'project' | 'team' | 'thread' | 'ai_bot' | 'global';
  slug: string;
  project: number | null;
  participant_count: number;
  participants: number[]; 
  last_message: {
    id: string;
    sender_username: string;
    content_preview: string;
    created_at: string;
  } | null;
  unread_count: number;
  is_member: boolean;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_favourite: boolean;
  parent_message: string | null;
  created_by: {
    id: number;
    username: string;
    full_name: string;
    email: string;
  } | null;
}

export interface ToastNotification {
  id: string;
  room_id: string;
  sender_name: string;
  message_preview: string;
  timestamp: string;
}

// THREADS TYPES

// Sender information in thread messages
export interface ThreadSender {
  username: string;
  full_name?: string;
  avatar?: string;
}

// Thread message from backend
export interface ThreadMessage {
  id: string;
  room_id: string;
  sender: ThreadSender;
  content: string;
  is_ai_generated: boolean;
  timestamp: Date;
}

// Thread room (session)
export interface ThreadRoom {
  id: string;
  slug: string;
  name: string;
  room_type: string;
  project: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  unread_count: number;
  created_by?: {
    id: number;
    username: string;
    full_name: string;
    email: string;
  };
  participants?: Array<{
    id: number;
    username: string;
    full_name: string;
    email: string;
  }>;
  current_user_membership?: {
    id: string;
    joined_at: string;
    last_read_at: string;
    is_muted: boolean;
    room_role: string;
  };
}

// Thread messages response from backend API
export interface ThreadMessagesResponse {
  messages: Array<{
    id: string;
    room: string;
    sender: {
      id: number | null;
      username: string;
      full_name: string;
      email: string;
    } | null;
    message_type: string;
    content: string;
    attachment: string | null;
    attachment_name: string;
    metadata: Record<string, any>;
    reply_to: string | null;
    reply_to_preview: string | null;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
    is_own_message: boolean;
  }>;
  count: number;
  has_more: boolean;
}

// Local thread session for UI state
export interface ThreadSession {
  id: string;
  room_id: string;
  slug: string;
  projectId: number;
  title: string;
  messages: ThreadUIMessage[];
  createdAt: Date;
  updatedAt: Date;
  unreadCount: number;
  lastReadAt: Date | null;
  createdById?: number;
}

// UI message format
export interface ThreadUIMessage {
  id: string;
  text: string;
  sender: 'user' | 'system' | 'other';
  timestamp: Date;
  isAI?: boolean;
  senderName?: string;
  senderId?: number | null;
}

// Props for Threads component
export interface ThreadsProps {
  projectId: number;
  projectName: string;
}

// Local storage structure
export interface ThreadStorage {
  sessions: ThreadSession[];
  lastActiveSessionId: string | null;
}

// Create thread room payload
export interface CreateThreadRoomPayload {
  project_id: number;
  name: string;
}


// WebSocket command types
export type WebSocketCommand =
  | 'join_room'
  | 'send_message'
  | 'leave_room';

// WebSocket join room command
export interface WSJoinRoomCommand {
  command: 'join_room';
  room_slug: string;
}

// WebSocket send message command
export interface WSSendMessageCommand {
  command: 'send_message';
  room_id: string;
  content: string;
}

// WebSocket incoming message
export interface WSIncomingThreadMessage {
  type: 'CHAT_MESSAGE';
  data: {
    id: string;
    room_id: string;
    sender: {
      id: number | null;
      username: string;
      full_name?: string;
    };
    message_type: string;
    content: string;
    attachment_url: string | null;
    attachment_name: string;
    reply_to: string | null;
    created_at: string;
    is_deleted: boolean;
    is_ai_generated: boolean;
    thread_count: number;
  };
}

// WebSocket unread update signal
export interface WSUnreadUpdateSignal {
  type: 'SIGNAL';
  event: 'CHAT_UNREAD_UPDATE';
  data: {
    room_id: string;
    room_type: 'thread' | 'project' | 'direct' | 'team' | string;
    thread_unread: number;
    total_unread: number;
    room_unread: number;
  };
}

// Combined WebSocket message types
export type WSThreadMessage = WSIncomingThreadMessage | WSUnreadUpdateSignal;

// Document Filter Types for ContentCreation
export interface ProjectDocument {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  source: 'Project';
  task_id: null;
  task_heading: null;
}

export interface TaskDocument {
  id: number;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  source: 'Task';
  task_id: number;
  task_heading: string;
}

export type FilteredDocument = ProjectDocument | TaskDocument;

// Task Details and Content Creation--> Document section Filter documents based on selected filter
export interface AllDocumentsResponse {
  message: string;
  total_files: number;
  documents: FilteredDocument[];
}

export interface TaskOption {
  task_id: number;
  task_heading: string;
}


// AI BOT TYPES

// Page context sent with every AI Bot message
export interface AIBotContext {
  page: string;
  id: number | string | null;
}

// Outgoing message payload to WebSocket
export interface AIBotSendPayload {
  message: string;
  context: AIBotContext;
}

// Incoming message types from backend WebSocket
export type AIBotMessageType = 'system' | 'ai_chunk' | 'ai_done' | 'ai_complete' | 'ai_response' | 'chat_title' | 'error';

export interface AIBotIncomingMessage {
  type: AIBotMessageType;
  text: string;
}

// UI message stored in session history
export interface AIBotUIMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

// AI Bot chat session
export interface AIBotSession {
  id: string;
  title: string;
  messages: AIBotUIMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Organization / Workspace Types (Superuser only)

export interface OrgAdmin {
  id: number;
  username: string;
  email: string;
}

export interface OrgRecentUser {
  id: number;
  username: string;
  email: string;
  last_login: string;
  role: string;
}

export interface OrgStats {
  users: number;
  projects: number;
  tasks: number;
  teams: number;
  chat_rooms: number;
  chat_messages: number;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  stats: OrgStats;
  admins: OrgAdmin[];
  recent_active_users: OrgRecentUser[];
}

export interface PlatformSummary {
  total_organizations: number;
  active_organizations: number;
  inactive_organizations: number;
  total_users: number;
}

export interface OrganizationsOverviewResponse {
  platform_summary: PlatformSummary;
  tenants: Tenant[];
}

export interface OrganizationDeleteResponse {
  message: string;
  summary: {
    organization: string;
    deleted: Record<string, number>;
  };
}

export interface OrganizationToggleStatusResponse {
  message: string;
  is_active: boolean;
}

// ─── Quick Notes Types

// Backend folder shape 
export interface QuickNoteFolder {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface QuickNoteAttachment {
  id: number;
  note: number;
  file: string;
  filename: string;
  created_at: string;
}

// Backend note shape 
export interface QuickNote {
  id: number;
  folder: number | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  attachments?: QuickNoteAttachment[];
}

// Paginated notes list response
export interface PaginatedQuickNotesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: QuickNote[];
}

// Payload for creating a folder
export interface CreateQuickNoteFolderPayload {
  name: string;
}

// Payload for renaming a folder
export interface UpdateQuickNoteFolderPayload {
  name: string;
}

// Payload for creating a note
export interface CreateQuickNotePayload {
  content: string;
  folder?: number | null;
}

// Payload for updating a note
export interface UpdateQuickNotePayload {
  title?: string;
  content?: string;
  folder?: number | null;
}

// Calendar Daily Update Types

// Single daily update entry (matches backend response)
export interface DailyUpdate {
  id: number;
  user: number;
  user_name: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// Payload for creating or updating a daily update
export interface DailyUpdatePayload {
  date: string; // 'YYYY-MM-DD'
  content: string;
}

// Response when listing daily updates (admin / manager)
export interface DailyUpdateListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DailyUpdate[];
}