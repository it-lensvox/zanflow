import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckSquare, FileText, ArrowUpRight, Clock, User, MessageSquare, FolderKanban as FolderIcon, ExternalLink, Building2, AlertTriangle } from 'lucide-react';
import { buildViewAllUrl } from '@/utils/filtersUsedNavigation';
import { getPriorityConfig } from '@/config/priorityConfig';
import { getStatusColors } from '@/config/statusColors';
import { chatApi, documentsApi } from '@/services/api';
import { DocumentPreview } from '@/components/common/DocumentPreview';
import type { AgentFiltersUsed } from '@/types';

// ─── Task Card 
interface TaskCardProps {
  id: number; title: string; project?: string;
  status?: string; priority?: string; due?: string; assignee?: string;
}

function TaskCard({ id, title, project, status, priority, due, assignee }: TaskCardProps) {
  const navigate = useNavigate();
  const pc = getPriorityConfig(priority);
  const sc = getStatusColors(status || 'pending');

  return (
    <div onClick={() => navigate(`/tasks/${id}`)} style={{
      background: 'hsl(var(--card))', border: `1px solid hsl(var(--border))`,
      borderLeft: `3px solid ${pc.border}`,
      borderRadius: 10, padding: '11px 14px',
      cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7,
      transition: 'all .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(16,24,40,.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
          <CheckSquare style={{ width: 13, height: 13, color: pc.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        </div>
        <ArrowUpRight style={{ width: 12, height: 12, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, alignItems: 'center' }}>
        {project && <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99, background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>{project}</span>}
        {status  && <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99, background: sc.bg, color: sc.text, textTransform: 'capitalize' as const }}>{status.replace(/_/g, ' ')}</span>}
        {priority && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: pc.bg, color: pc.color, textTransform: 'capitalize' as const }}>{priority}</span>}
        {due && <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: 3 }}><Clock style={{ width: 9, height: 9 }} />{due}</span>}
        {assignee && <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: 3 }}><User style={{ width: 9, height: 9 }} />{assignee}</span>}
      </div>
    </div>
  );
}

// ─── Project Card 
interface ProjectCardProps {
  id: number; name: string; type?: string; tasks?: number; status?: string;
}

function ProjectCard({ id, name, type, tasks, status }: ProjectCardProps) {
  const navigate = useNavigate();
  
 const initial = (name || 'P')[0].toUpperCase();
  const typeColorMap: Record<string, string> = {
    client: '#3b82f6', internal: '#8b5cf6', content_creation: '#ec4899',
    ideas: '#f59e0b', demo: '#22c55e',
  };
  const color = typeColorMap[(type || '').toLowerCase().replace(/-/g, '_')] ?? '#667085';

  return (
    <div onClick={() => navigate(`/projects/${id}`)} style={{
      background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10,
      padding: '11px 14px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10,
      transition: 'all .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(16,24,40,.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>

      <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, border: `1.5px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color }}>{initial}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
        <p style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
          {type && <span style={{ textTransform: 'capitalize' as const }}>{type.replace(/_/g, ' ')}</span>}
          {tasks !== undefined && ` · ${tasks} tasks`}
          {status && ` · ${status}`}
        </p>
      </div>
      <ArrowUpRight style={{ width: 12, height: 12, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
    </div>
  );
}

// ─── Note Card 
interface NoteCardProps { id: number; title: string; preview?: string; folder?: string; }

function NoteCard({ title, preview, folder }: NoteCardProps) {
  const navigate = useNavigate();
  return (
    <div onClick={() => navigate('/quick-notes')} style={{
      background: '#fff', border: '1px solid #e6ebf2', borderRadius: 10,
      padding: '11px 14px', cursor: 'pointer',
      display: 'flex', gap: 10, alignItems: 'flex-start', transition: 'all .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(16,24,40,.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
      <FileText style={{ width: 13, height: 13, color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>{title}</p>
        {preview && <p style={{ fontSize: 11, color: '#667085', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</p>}
        {folder && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef9c3', color: '#a16207', marginTop: 4, display: 'inline-block' }}>{folder}</span>}
      </div>
      <ArrowUpRight style={{ width: 12, height: 12, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
    </div>
  );
}

// ─── Card grid wrapper 
export function EntityCardGrid({ children, label, viewAllUrl, viewAllLabel, onShowMore, onCloseChat }: { children: React.ReactNode; label?: string; viewAllUrl?: string | null; viewAllLabel?: string; onShowMore?: () => void; onCloseChat?: () => void }) {
  const navigate = useNavigate();
  const goViewAll = () => {
    if (!viewAllUrl) return;
    onCloseChat?.();
    navigate(viewAllUrl);
  };
  return (
    <div style={{ marginTop: 10 }}>
      {label && (
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: 'hsl(var(--muted-foreground))', margin: '0 0 6px' }}>{label}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>{children}</div>
      {(onShowMore || viewAllUrl) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          {onShowMore ? (
            <button onClick={onShowMore} style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
              Show more
            </button>
          ) : <span />}
          {viewAllUrl && (
            <button onClick={goViewAll} style={{ fontSize: 10, fontWeight: 700, color: '#1663f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
              {viewAllLabel || 'View all'} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Types
interface ParsedEntities {
  tasks?:           TaskCardProps[];
  projects?:        ProjectCardProps[];
  notes?:           NoteCardProps[];
  openChat?:        OpenChatResult;
  members?:         WorkspaceMember[];
  workspaces?:      WorkspaceItem[];
  createdProject?:  CreatedProject;
  createdTask?:     CreatedTask;
  missingLabels?:   MissingLabels;
  agentDocuments?:  AgentDocCard[];
}

interface OpenChatResult {
  room_id:       string;
  room_type:     'private' | 'project';
  member_name?:  string;
  project_name?: string;
  project_id?:   number;
}

interface WorkspaceMember {
  id:       number;
  name:     string;
  email:    string;
  room_id?: string | null;
}

interface WorkspaceItem {
  id:         number;
  name:       string;
  is_current: boolean;
  role:       string;
}

interface CreatedProject {
  project_id: number;
  name:       string;
}

interface CreatedTask {
  task_id:          number;
  labels_attached?: string[];
}

interface MissingLabels {
  missing_labels:   string[];
  available_labels: string[];
}

// ─── Smart extractor — handles many backend shapes 
function extractList(toolResult: Record<string, unknown>, keys: string[]): any[] | null {
  for (const key of keys) {
    const v = (toolResult as any)[key];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  // Wrapped shapes: { results: [...] } { data: [...] } { items: [...] }
  for (const wrap of ['results', 'data', 'items']) {
    const v = (toolResult as any)[wrap];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  return null;
}

function looksLikeTasks(items: any[]): boolean {
  const first = items[0];
  return !!(first && (first.heading !== undefined || first.status !== undefined) && first.id !== undefined);
}

function looksLikeProjects(items: any[]): boolean {
  const first = items[0];
  // Only need id + name — backend project list may omit task_type etc.
  return !!(first && first.id !== undefined && first.name !== undefined && first.heading === undefined);
}

// ─── Main parser 
export function parseToolResult(toolCalled: string | null, toolResult: Record<string, unknown> | null): ParsedEntities | null {
  if (!toolResult) return null;
  const tc = (toolCalled || '').toLowerCase();

  // ── open_chat
  if (tc === 'open_chat' && (toolResult as any).success && (toolResult as any).room_id) {
    return {
      openChat: {
        room_id:      String((toolResult as any).room_id),
        room_type:    (toolResult as any).room_type === 'project' ? 'project' : 'private',
        member_name:  (toolResult as any).member_name,
        project_name: (toolResult as any).project_name,
        project_id:   (toolResult as any).project_id ? Number((toolResult as any).project_id) : undefined,
      },
    };
  }

  // ── get_workspace_members
  if (tc === 'get_workspace_members' && Array.isArray((toolResult as any).members)) {
    return {
      members: (toolResult as any).members.map((m: any) => ({
        id: m.id, name: m.name, email: m.email, room_id: m.room_id ?? null,
      })),
    };
  }

  // ── list_workspaces
  if (tc === 'list_workspaces' && Array.isArray((toolResult as any).workspaces)) {
    return {
      workspaces: (toolResult as any).workspaces.map((w: any) => ({
        id: w.id, name: w.name, is_current: !!w.is_current, role: w.role || '',
      })),
    };
  }

  // ── create_task — success
  if (tc === 'create_task' && (toolResult as any).success && (toolResult as any).task_id) {
    return {
      createdTask: {
        task_id:          Number((toolResult as any).task_id),
        labels_attached:  (toolResult as any).labels_attached ?? [],
      },
    };
  }

  // ── create_task — missing labels (task NOT created)
  if (tc === 'create_task' && !(toolResult as any).success && Array.isArray((toolResult as any).missing_labels)) {
    return {
      missingLabels: {
        missing_labels:   (toolResult as any).missing_labels,
        available_labels: (toolResult as any).available_labels ?? [],
      },
    };
  }

  // ── create_project
  if (tc === 'create_project' && (toolResult as any).success && (toolResult as any).project_id) {
    return {
      createdProject: {
        project_id: Number((toolResult as any).project_id),
        name:       String((toolResult as any).name || 'New Project'),
      },
    };
  }

  // ── create_task — success
  if (tc === 'create_task' && (toolResult as any).success && (toolResult as any).task_id) {
    return {
      createdTask: {
        task_id:         Number((toolResult as any).task_id),
        labels_attached: (toolResult as any).labels_attached ?? [],
      },
    };
  }

  // ── create_task — missing labels (task NOT created)
  if (tc === 'create_task' && !(toolResult as any).success && Array.isArray((toolResult as any).missing_labels)) {
    return {
      missingLabels: {
        missing_labels:   (toolResult as any).missing_labels,
        available_labels: (toolResult as any).available_labels ?? [],
      },
    };
  }

  // ── Tasks 
  const isTaskTool = tc.includes('task') || tc.includes('list_user') || tc.includes('find_task') || tc.includes('search_task');
  const taskCandidates = isTaskTool
    ? extractList(toolResult, ['tasks', 'task'])
    : extractList(toolResult, ['tasks']) || null;

  // Fallback: check if results look like tasks
  const taskList = taskCandidates || (isTaskTool ? extractList(toolResult, ['results']) : null);
  if (taskList && looksLikeTasks(taskList)) {
    return {
      tasks: taskList.slice(0, 10).map((t: any) => ({
        id:       t.id,
        title:    t.heading || t.title || t.name || 'Untitled',
        project:  t.project_name || t.project?.name || t.project_details?.name,
        status:   t.status,
        priority: t.priority,
        due:      t.end_date ? new Date(t.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : undefined,
        assignee: t.assigned_to_user_details?.[0]
          ? `${t.assigned_to_user_details[0].first_name} ${t.assigned_to_user_details[0].last_name}`.trim()
          : undefined,
      })),
    };
  }

  // ── Projects 
  // Backend returns: { projects: [...] } or { results: [...] } where items have name + id
  const isProjectTool = tc.includes('project');
  const projectCandidates = isProjectTool
    ? extractList(toolResult, ['projects', 'project', 'results', 'data'])
    : extractList(toolResult, ['projects']);

  if (projectCandidates && looksLikeProjects(projectCandidates)) {
    return {
      projects: projectCandidates.slice(0, 12).map((p: any) => ({
        id:     p.id,
        name:   p.name,
        type:   p.task_type,
        tasks:  p.task_count ?? p.tasks_count ?? p.total_tasks,
        status: p.status || (p.is_active ? 'Active' : 'Inactive'),
      })),
    };
  }

  // ── Notes 
  const isNoteTool = tc.includes('note');
  const noteList = isNoteTool
    ? extractList(toolResult, ['notes', 'note', 'results'])
    : extractList(toolResult, ['notes']);

  if (noteList && noteList.length > 0 && noteList[0]?.content !== undefined) {
    return {
      notes: noteList.slice(0, 10).map((n: any) => ({
        id:      n.id,
        title:   n.title || 'Untitled Note',
        preview: n.content?.replace(/<[^>]*>/g, '')?.slice(0, 80),
        folder:  n.folder_name || n.folder?.name,
      })),
    };
  }

  // ── Documents (from AI search results passed as tool_result)
  const isDocTool = tc.includes('document') || tc.includes('search_doc') || tc.includes('find_doc');
  const docList = isDocTool
    ? extractList(toolResult, ['documents', 'document', 'results'])
    : extractList(toolResult, ['documents']);

  if (docList && docList.length > 0 && docList[0]?.file_type !== undefined) {
    return {
      agentDocuments: docList.slice(0, 10).map((d: any) => ({
        id:        String(d.id),
        title:     d.name || d.title || 'Untitled',
        project:   d.project || '',
        file_type: d.file_type || 'other',
      })),
    };
  }

  return null;
}

// ─── Open Chat Card
function OpenChatCard({ result, onCloseChat }: { result: OpenChatResult; onCloseChat?: () => void }) {
  const navigate = useNavigate();
  const label = result.room_type === 'project'
    ? `${result.project_name || 'Project'} chat`
    : `Chat with ${result.member_name || 'member'}`;
  const route = result.room_type === 'project' && result.project_id
    ? `/team-chat/${result.project_id}/${result.room_id}`
    : `/team-chat/chat/${result.room_id}`;

  return (
    <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(22,99,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <MessageSquare style={{ width: 16, height: 16, color: '#1663f6' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
          {result.room_type === 'private' ? 'Private message' : 'Project channel'}
        </div>
      </div>
      <button
        onClick={() => { onCloseChat?.(); navigate(route); }}
        style={{ height: 30, padding: '0 14px', borderRadius: 7, border: 'none', background: '#1663f6', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontFamily: 'inherit' }}
      >
        <MessageSquare style={{ width: 11, height: 11 }} /> Open chat
      </button>
    </div>
  );
}

// ─── Workspace Member Card
function MemberCard({ member, onCloseChat }: { member: WorkspaceMember; onCloseChat?: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handleChat = async () => {
    await queryClient.invalidateQueries({ queryKey: ['private-chat-rooms'] });

    if (member.room_id) {
      onCloseChat?.();
      navigate(`/team-chat/chat/${member.room_id}`);
      return;
    }

    // Fallback: room_id null — create private room on demand
    try {
      const room = await chatApi.createPrivateRoom(member.id);
      await queryClient.invalidateQueries({ queryKey: ['private-chat-rooms'] });
      onCloseChat?.();
      navigate(`/team-chat/chat/${room.id}`);
    } catch {
      onCloseChat?.();
      navigate('/team-chat/chat');
    }
  };

  return (
    <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(22,99,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1663f6' }}>{initials}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
        <div style={{ fontSize: 11, color: '#667085', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
      </div>
      <button
        onClick={handleChat}
        style={{ height: 26, padding: '0 10px', borderRadius: 6, border: '1px solid #e6ebf2', background: '#fff', fontSize: 11, fontWeight: 600, color: '#1663f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, fontFamily: 'inherit' }}
      >
        <MessageSquare style={{ width: 10, height: 10 }} /> Chat
      </button>
    </div>
  );
}

// ─── Workspace Card
function WorkspaceCard({ workspace }: { workspace: WorkspaceItem }) {
  return (
    <div style={{ background: workspace.is_current ? '#F7F9FF' : '#fff', border: `1px solid ${workspace.is_current ? '#C7D7FD' : '#e6ebf2'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: workspace.is_current ? '#EEF4FF' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Building2 style={{ width: 14, height: 14, color: workspace.is_current ? '#1663f6' : '#667085' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workspace.name}</div>
        <div style={{ fontSize: 11, color: '#667085', marginTop: 1, textTransform: 'capitalize' as const }}>{workspace.role}{workspace.is_current ? ' · Current' : ''}</div>
      </div>
      {workspace.is_current && (
        <span style={{ fontSize: 10, fontWeight: 700, color: '#1663f6', background: '#EEF4FF', padding: '2px 8px', borderRadius: 99 }}>Active</span>
      )}
    </div>
  );
}

// ─── Created Project Card
function CreatedProjectCard({ project, onCloseChat }: { project: CreatedProject; onCloseChat?: () => void }) {
  const navigate = useNavigate();
  return (
    <div style={{ background: '#F0FDF4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <FolderIcon style={{ width: 16, height: 16, color: '#16a34a' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>{project.name}</div>
        <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>Project created successfully</div>
      </div>
      <button
        onClick={() => { onCloseChat?.(); navigate(`/projects/${project.project_id}`); }}
        style={{ height: 30, padding: '0 14px', borderRadius: 7, border: 'none', background: '#16a34a', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontFamily: 'inherit' }}
      >
        <ExternalLink style={{ width: 11, height: 11 }} /> Go to project
      </button>
    </div>
  );
}
// ─── Agent Search Document Card
interface AgentDocCard {
  id:        string;
  title:     string;
  project:   string;
  file_type: string;
}

function DocumentCard({ doc, onCloseChat }: { doc: AgentDocCard; onCloseChat?: () => void }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; fileType: string } | null>(null);

  const FILE_ICON_COLOR: Record<string, string> = {
    pdf: '#EF4444', image: '#8B5CF6', video: '#F59E0B',
    json: '#10B981', text: '#3B82F6', other: '#6B7280',
  };
  const iconColor = FILE_ICON_COLOR[doc.file_type] || FILE_ICON_COLOR.other;

  const handleOpen = async () => {
    setLoading(true);
    try {
      const detail = await documentsApi.get(doc.id);
      const projectId = detail.project ?? detail.project_id;
      if (!projectId) { navigate('/documents'); onCloseChat?.(); return; }
      const { url } = await documentsApi.getDownloadUrl(Number(projectId), { document_id: doc.id });
      setPreviewDoc({ url, fileName: doc.title, fileType: doc.file_type });
    } catch {
      navigate('/documents');
      onCloseChat?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid #e6ebf2', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${iconColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText style={{ width: 15, height: 15, color: iconColor }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
          <div style={{ fontSize: 11, color: '#667085', marginTop: 1 }}>{doc.project} · {doc.file_type.toUpperCase()}</div>
        </div>
        <button
          onClick={handleOpen}
          disabled={loading}
          style={{ height: 28, padding: '0 12px', borderRadius: 7, border: 'none', background: loading ? '#e2e8f0' : '#1663f6', fontSize: 11, fontWeight: 600, color: loading ? '#94a3b8' : '#fff', cursor: loading ? 'wait' : 'pointer', flexShrink: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <ExternalLink style={{ width: 10, height: 10 }} />
          {loading ? 'Opening…' : 'Open'}
        </button>
      </div>
      {previewDoc && (
        <DocumentPreview
          url={previewDoc.url}
          fileName={previewDoc.fileName}
          fileType={previewDoc.fileType}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </>
  );
}

// ─── Created Task Card
function CreatedTaskCard({ task, onCloseChat }: { task: CreatedTask; onCloseChat?: () => void }) {
  const navigate = useNavigate();
  return (
    <div style={{ background: '#F0FDF4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <CheckSquare style={{ width: 16, height: 16, color: '#16a34a' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>Task created successfully</div>
        {task.labels_attached && task.labels_attached.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginTop: 4 }}>
            {task.labels_attached.map(l => (
              <span key={l} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: '#dbeafe', color: '#1d4ed8' }}>{l}</span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => { onCloseChat?.(); navigate(`/tasks/${task.task_id}`); }}
        style={{ height: 30, padding: '0 14px', borderRadius: 7, border: 'none', background: '#16a34a', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontFamily: 'inherit' }}
      >
        <ExternalLink style={{ width: 11, height: 11 }} /> View task
      </button>
    </div>
  );
}

// ─── Missing Labels Card
function MissingLabelsCard({ data }: { data: MissingLabels }) {
  return (
    <div style={{ background: '#FFF7ED', border: '1px solid #fdba74', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AlertTriangle style={{ width: 13, height: 13, color: '#d97706' }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>Task not created — label not found</div>
      </div>
      {data.missing_labels.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#92400e', fontWeight: 500 }}>Missing: </span>
          {data.missing_labels.map(l => (
            <span key={l} style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: '#FEE2E2', color: '#dc2626', marginRight: 4 }}>{l}</span>
          ))}
        </div>
      )}
      {data.available_labels.length > 0 && (
        <div>
          <span style={{ fontSize: 11, color: '#667085', fontWeight: 500 }}>Available labels: </span>
          {data.available_labels.map(l => (
            <span key={l} style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: '#EEF4FF', color: '#1663f6', marginRight: 4 }}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Renderer 
export function EntityCards({ entities, filtersUsed, onCloseChat }: { entities: ParsedEntities; filtersUsed?: AgentFiltersUsed | null; onCloseChat?: () => void }) {
  const taskViewAllUrl    = buildViewAllUrl('task',    filtersUsed ?? null);
  const projectViewAllUrl = buildViewAllUrl('project', filtersUsed ?? null);
  const noteViewAllUrl    = buildViewAllUrl('note',    filtersUsed ?? null);
  return (
    <>
      {/* open_chat */}
      {entities.openChat && (
        <OpenChatCard result={entities.openChat} onCloseChat={onCloseChat} />
      )}

      {/* create_project */}
      {entities.createdProject && (
        <CreatedProjectCard project={entities.createdProject} onCloseChat={onCloseChat} />
      )}

      {/* create_task — success */}
      {entities.createdTask && (
        <CreatedTaskCard task={entities.createdTask} onCloseChat={onCloseChat} />
      )}

      {/* create_task — missing labels */}
      {entities.missingLabels && (
        <MissingLabelsCard data={entities.missingLabels} />
      )}

      {/* agent documents */}
      {entities.agentDocuments && entities.agentDocuments.length > 0 && (() => {
        // Build filtered documents URL — Documents page reads ?project={id} and ?file_type={type}
        const projectId = (filtersUsed as any)?.project_id || '';
        const fileType  = (filtersUsed as any)?.file_type  || '';
        const params = new URLSearchParams();
        if (projectId) params.set('project', String(projectId));
        if (fileType)  params.set('file_type', fileType);
        const docViewAllUrl = params.toString() ? `/documents?${params.toString()}` : '/documents';
        return (
          <EntityCardGrid
            label={`${entities.agentDocuments.length} document${entities.agentDocuments.length > 1 ? 's' : ''}`}
            viewAllUrl={docViewAllUrl}
            viewAllLabel="View all on Documents"
            onCloseChat={onCloseChat}
          >
            {entities.agentDocuments.map(d => (
              <DocumentCard key={d.id} doc={d} onCloseChat={onCloseChat} />
            ))}
          </EntityCardGrid>
        );
      })()}

      {/* get_workspace_members */}
      {entities.members && entities.members.length > 0 && (
        <EntityCardGrid label={`${entities.members.length} member${entities.members.length > 1 ? 's' : ''}`}>
          {entities.members.map(m => <MemberCard key={m.id} member={m} onCloseChat={onCloseChat} />)}
        </EntityCardGrid>
      )}

      {/* list_workspaces */}
      {entities.workspaces && entities.workspaces.length > 0 && (
        <EntityCardGrid label={`${entities.workspaces.length} workspace${entities.workspaces.length > 1 ? 's' : ''}`}>
          {entities.workspaces.map(w => <WorkspaceCard key={w.id} workspace={w} />)}
        </EntityCardGrid>
      )}

      {entities.tasks    && entities.tasks.length    > 0 && (
        <EntityCardGrid label={`${entities.tasks.length} task${entities.tasks.length > 1 ? 's' : ''}`} viewAllUrl={taskViewAllUrl} viewAllLabel="View all on Taskboard" onCloseChat={onCloseChat}>
          {entities.tasks.map(t => <TaskCard key={t.id} {...t} />)}
        </EntityCardGrid>
      )}
      {entities.projects && entities.projects.length > 0 && (
        <EntityCardGrid label={`${entities.projects.length} project${entities.projects.length > 1 ? 's' : ''}`} viewAllUrl={projectViewAllUrl} viewAllLabel="View all on Projects" onCloseChat={onCloseChat}>
          {entities.projects.map(p => <ProjectCard key={p.id} {...p} />)}
        </EntityCardGrid>
      )}
      {entities.notes    && entities.notes.length    > 0 && (
        <EntityCardGrid label={`${entities.notes.length} note${entities.notes.length > 1 ? 's' : ''}`} viewAllUrl={noteViewAllUrl} viewAllLabel="View all on Documents" onCloseChat={onCloseChat}>
          {entities.notes.map(n => <NoteCard key={n.id} {...n} />)}
        </EntityCardGrid>
      )}
    </>
  );
}