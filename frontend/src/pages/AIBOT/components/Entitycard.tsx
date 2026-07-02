import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckSquare, FileText, ArrowUpRight, Clock, User, MessageSquare, FolderKanban as FolderIcon, ExternalLink, Building2 } from 'lucide-react';
import { buildViewAllUrl } from '@/utils/filtersUsedNavigation';
import { chatApi } from '@/services/api';
import type { AgentFiltersUsed } from '@/types';

// ─── Priority + status colour maps 
const PRIORITY_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fff1f2', text: '#e11d48', border: '#fda4af' },
  high:     { bg: '#fff7ed', text: '#ea580c', border: '#fdba74' },
  medium:   { bg: '#fffbeb', text: '#d97706', border: '#fcd34d' },
  low:      { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' },
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:     { bg: '#eff6ff', text: '#2563eb' },
  in_progress: { bg: '#fff7ed', text: '#c2410c' },
  completed:   { bg: '#f0fdf4', text: '#15803d' },
  cancelled:   { bg: '#f1f5f9', text: '#64748b' },
};

const PROJECT_TYPE_COLOR: Record<string, string> = {
  client:           '#3b82f6',
  internal:         '#8b5cf6',
  content_creation: '#ec4899',
  ideas:            '#f59e0b',
  demo:             '#22c36a',
};

// ─── Task Card 
interface TaskCardProps {
  id: number; title: string; project?: string;
  status?: string; priority?: string; due?: string; assignee?: string;
}

function TaskCard({ id, title, project, status, priority, due, assignee }: TaskCardProps) {
  const navigate = useNavigate();
  const p = (priority || '').toLowerCase();
  const s = (status   || '').toLowerCase().replace(/\s+/g, '_');
  const pc = PRIORITY_COLOR[p] || PRIORITY_COLOR.medium;
  const sc = STATUS_COLOR[s]   || STATUS_COLOR.pending;

  return (
    <div onClick={() => navigate(`/tasks/${id}`)} style={{
      background: '#fff', border: `1px solid #e6ebf2`,
      borderLeft: `3px solid ${pc.border}`,
      borderRadius: 10, padding: '11px 14px',
      cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7,
      transition: 'all .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(16,24,40,.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
          <CheckSquare style={{ width: 13, height: 13, color: pc.text, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        </div>
        <ArrowUpRight style={{ width: 12, height: 12, color: '#94a3b8', flexShrink: 0 }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, alignItems: 'center' }}>
        {project && <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99, background: '#eff6ff', color: '#2563eb' }}>{project}</span>}
        {status  && <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99, background: sc.bg, color: sc.text, textTransform: 'capitalize' as const }}>{status.replace(/_/g, ' ')}</span>}
        {priority && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: pc.bg, color: pc.text, textTransform: 'capitalize' as const }}>{priority}</span>}
        {due && <span style={{ fontSize: 10, color: '#667085', display: 'flex', alignItems: 'center', gap: 3 }}><Clock style={{ width: 9, height: 9 }} />{due}</span>}
        {assignee && <span style={{ fontSize: 10, color: '#667085', display: 'flex', alignItems: 'center', gap: 3 }}><User style={{ width: 9, height: 9 }} />{assignee}</span>}
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
  const color    = PROJECT_TYPE_COLOR[(type || '').toLowerCase()] || '#667085';
  const initial  = (name || 'P')[0].toUpperCase();

  return (
    <div onClick={() => navigate(`/projects/${id}`)} style={{
      background: '#fff', border: '1px solid #e6ebf2', borderRadius: 10,
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
        <p style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
        <p style={{ fontSize: 10, color: '#667085', marginTop: 2 }}>
          {type && <span style={{ textTransform: 'capitalize' as const }}>{type.replace(/_/g, ' ')}</span>}
          {tasks !== undefined && ` · ${tasks} tasks`}
          {status && ` · ${status}`}
        </p>
      </div>
      <ArrowUpRight style={{ width: 12, height: 12, color: '#94a3b8', flexShrink: 0 }} />
    </div>
  );
}

// ─── Note Card 
interface NoteCardProps { id: number; title: string; preview?: string; folder?: string; }

function NoteCard({ id, title, preview, folder }: NoteCardProps) {
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
      <ArrowUpRight style={{ width: 12, height: 12, color: '#94a3b8', flexShrink: 0 }} />
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
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: '#94a3b8', margin: '0 0 6px' }}>{label}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>{children}</div>
      {(onShowMore || viewAllUrl) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          {onShowMore ? (
            <button onClick={onShowMore} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
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
  tasks?:      TaskCardProps[];
  projects?:   ProjectCardProps[];
  notes?:      NoteCardProps[];
  openChat?:   OpenChatResult;
  members?:    WorkspaceMember[];
  workspaces?: WorkspaceItem[];
  createdProject?: CreatedProject;
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

  // ── create_project
  if (tc === 'create_project' && (toolResult as any).success && (toolResult as any).project_id) {
    return {
      createdProject: {
        project_id: Number((toolResult as any).project_id),
        name:       String((toolResult as any).name || 'New Project'),
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
    <div style={{ background: '#fff', border: '1px solid #e6ebf2', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <MessageSquare style={{ width: 16, height: 16, color: '#1663f6' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>
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
    <div style={{ background: '#fff', border: '1px solid #e6ebf2', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1663f6' }}>{initials}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
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