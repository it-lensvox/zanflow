import { useNavigate } from 'react-router-dom';
import { CheckSquare, FolderKanban, FileText, ArrowUpRight, Clock, User } from 'lucide-react';

// ─── Priority + status colour maps ───────────────────────────────────────────
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

// ─── Task Card ────────────────────────────────────────────────────────────────
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

// ─── Project Card ─────────────────────────────────────────────────────────────
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

// ─── Note Card ────────────────────────────────────────────────────────────────
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

// ─── Card grid wrapper ────────────────────────────────────────────────────────
export function EntityCardGrid({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      {label && <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: '#94a3b8', marginBottom: 6 }}>{label}</p>}
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>{children}</div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParsedEntities {
  tasks?:    TaskCardProps[];
  projects?: ProjectCardProps[];
  notes?:    NoteCardProps[];
}

// ─── Smart extractor — handles many backend shapes ────────────────────────────
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

// ─── Main parser ──────────────────────────────────────────────────────────────
export function parseToolResult(toolCalled: string | null, toolResult: Record<string, unknown> | null): ParsedEntities | null {
  if (!toolResult) return null;
  const tc = (toolCalled || '').toLowerCase();

  // ── Tasks ──────────────────────────────────────────────────────────────────
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

  // ── Projects ───────────────────────────────────────────────────────────────
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

  // ── Notes ──────────────────────────────────────────────────────────────────
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

// ─── Renderer ─────────────────────────────────────────────────────────────────
export function EntityCards({ entities }: { entities: ParsedEntities }) {
  return (
    <>
      {entities.tasks    && entities.tasks.length    > 0 && (
        <EntityCardGrid label={`${entities.tasks.length} task${entities.tasks.length > 1 ? 's' : ''}`}>
          {entities.tasks.map(t => <TaskCard key={t.id} {...t} />)}
        </EntityCardGrid>
      )}
      {entities.projects && entities.projects.length > 0 && (
        <EntityCardGrid label={`${entities.projects.length} project${entities.projects.length > 1 ? 's' : ''}`}>
          {entities.projects.map(p => <ProjectCard key={p.id} {...p} />)}
        </EntityCardGrid>
      )}
      {entities.notes    && entities.notes.length    > 0 && (
        <EntityCardGrid label={`${entities.notes.length} note${entities.notes.length > 1 ? 's' : ''}`}>
          {entities.notes.map(n => <NoteCard key={n.id} {...n} />)}
        </EntityCardGrid>
      )}
    </>
  );
}