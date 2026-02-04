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
  date_joined: string;
  skills?: string[];
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
  comments?: TaskComment[];
}

// Update TaskResponse to use the interface
export interface TaskResponse {
  message: string;
  task: Task;
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

// API Testing Tool types
export interface APICollection {
  id: string;
  name: string;
  description?: string;
  project_id?: number;
  api_count: number;
  execution_order: 'sequential' | 'parallel';
  environment_variables: Record<string, string>;
  tags: string[];
  is_active: boolean;
  created_by?: UserMinimal;
  created_at: string;
  updated_at: string;
  last_run?: {
    id: string;
    status: string;
    executed_at: string;
    success_rate: number;
  } | null;
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

export interface ExecutionRun {
  id: string;
  collection: APICollection;
  executed_by?: UserMinimal;
  status: 'pending' | 'running' | 'completed' | 'partial_failure' | 'failed' | 'cancelled';
  started_at?: string;
  completed_at?: string;
  total_apis: number;
  successful_count: number;
  failed_count: number;
  skipped_count: number;
  trigger_type: 'manual' | 'scheduled' | 'webhook' | 'ci_cd';
  environment?: Record<string, string>;
  notes?: string;
  duration_seconds?: number;
  success_rate: number;
  results?: ExecutionResult[];
  created_at: string;
  updated_at: string;
}

export interface ExecutionResult {
  id: string;
  execution_run: string;
  api_endpoint?: string;
  endpoint_name: string;
  endpoint_method: string;
  status: 'success' | 'failed' | 'error' | 'timeout' | 'skipped';
  request_url: string;
  request_headers?: Record<string, string>;
  request_body?: string;
  response_status_code?: number;
  response_headers?: Record<string, string>;
  response_body?: string;
  response_size_bytes?: number;
  execution_time_ms: number;
  error_message?: string;
  error_type?: string;
  assertions_passed: boolean;
  assertion_details?: Record<string, any>;
  extracted_variables?: Record<string, any>;
  retry_attempt: number;
  created_at: string;
}

export interface APITestingDashboard {
  total_collections: number;
  total_endpoints: number;
  endpoints_by_method: Record<string, number>;
  recent_runs: ExecutionRun[];
  success_rate_last_30_days: number;
}

export interface CreateCollectionPayload {
  name: string;
  description?: string;
  project_id?: number;
  execution_order?: 'sequential' | 'parallel';
  environment_variables?: Record<string, string>;
  tags?: string[];
}

export interface CreateEndpointPayload {
  collection: string;
  name: string;
  description?: string;
  http_method: string;
  url: string;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
  request_body?: Record<string, any> | string;
  body_type?: string;
  expected_status_code?: number;
  expected_response_contains?: Record<string, any>;
  timeout_seconds?: number;
  retry_count?: number;
  sort_order?: number;
  extract_variables?: Record<string, string>;
  depends_on?: string;
}

export interface CreateCredentialPayload {
  collection: string;
  name: string;
  auth_type: string;
  token?: string;
  username?: string;
  password?: string;
  api_key?: string;
  api_key_name?: string;
  header_name?: string;
  header_prefix?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  auto_refresh?: boolean;
  refresh_url?: string;
  refresh_payload?: Record<string, any>;
}

export interface RunCollectionPayload {
  credential_id?: string;
  environment_overrides?: Record<string, string>;
  notes?: string;
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
}

export interface ChatRoom {
  id: string;
  name: string;
  room_type: 'private' | 'group';
  slug: string;
  project: number | null;
  participants: ChatUserMinimal[];
  created_by: ChatUserMinimal;
  memberships: ChatRoomMembership[];
  current_user_membership?: ChatRoomMembership;
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

export interface ChatRoomMessagesResponse {
  messages: ChatMessage[];
  count: number;
  has_more: boolean;
}

// Payload for creating a private room
export interface CreatePrivateChatPayload {
  user_id: number;
}

// Payload sent TO the server
export interface WebSocketSendMessagePayload {
  type: 'chat_message';
  content: string;
}

// Payload received FROM the server
export interface WebSocketIncomingMessage {
  type: 'chat_message' | 'connection_established';
  message?: ChatMessage; // The actual message object
  room_id?: string;
  sender?: ChatUserMinimal;
}

// Global WebSocket types for cross-room messaging
export interface UnreadCount {
  room_id: string;
  count: number;
}

export interface WebSocketGlobalMessage {
  type: 'chat_message' | 'user_joined' | 'user_left' | 'typing' | 'unread_update';
  message?: ChatMessage; 
  room_id: string;
  sender?: ChatUserMinimal;
  unread_counts?: UnreadCount[];
}

export interface ToastNotification {
  id: string;
  room_id: string;
  sender_name: string;
  message_preview: string;
  timestamp: string;
}