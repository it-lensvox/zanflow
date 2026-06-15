import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, FolderKanban, CheckSquare, FileText, Calendar } from 'lucide-react';
import { taskApi, projectsApi, documentsApi } from '@/services/api';

// ── Types ──────────────────────────────────────────────────────────────────────
type ResultItem = {
  id: number | string;
  title: string;
  sub?: string;
  type: 'project' | 'task' | 'document';
  route: string;
};

const TYPE_META = {
  project:  { icon: <FolderKanban size={15} color="#1663F6" />, color: '#1663F6', bg: '#EEF4FF', label: 'Project' },
  task:     { icon: <CheckSquare  size={15} color="#F59E0B" />, color: '#F59E0B', bg: '#FFFBEB', label: 'Task' },
  document: { icon: <FileText     size={15} color="#22C55E" />, color: '#22C55E', bg: '#F0FDF4', label: 'Document' },
};

// ── Search overlay ─────────────────────────────────────────────────────────────
export function GlobalSearchOverlay({ onClose }: { onClose: () => void }) {
  const navigate  = useNavigate();
  const inputRef  = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  // Focus on mount
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  // Close on ESC
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // ── Data ──────────────────────────────────────────────────────────────────────
  const { data: tasksRes }    = useQuery({ queryKey: ['gs-tasks'],    queryFn: () => taskApi.list({ disable_pagination: true }),    staleTime: 60000 });
  const { data: projectsRes } = useQuery({ queryKey: ['gs-projects'], queryFn: () => projectsApi.list(),                            staleTime: 60000 });
  const { data: docsRes }     = useQuery({ queryKey: ['gs-docs'],     queryFn: () => documentsApi.list({ page_size: 200, page: 1 }), staleTime: 60000 });

  const allTasks    = tasksRes?.tasks    || tasksRes?.results    || (Array.isArray(tasksRes)    ? tasksRes    : []);
  const allProjects = projectsRes?.results || (Array.isArray(projectsRes) ? projectsRes : []);
    const allDocs     = docsRes?.results   || docsRes?.documents   || (Array.isArray(docsRes)     ? docsRes     : []);

  // ── Filter results ─────────────────────────────────────────────────────────────
  const results: ResultItem[] = (() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    const out: ResultItem[] = [];

    allProjects.forEach((p: any) => {
      if ((p.name || '').toLowerCase().includes(q))
        out.push({ id: p.id, title: p.name, sub: p.description || '', type: 'project', route: `/projects/${p.id}` });
    });
    allTasks.forEach((t: any) => {
      if ((t.heading || t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
        out.push({ id: t.id, title: t.heading || t.title, sub: t.project_details?.name || '', type: 'task', route: '/taskboard' });
    });
    allDocs.forEach((d: any) => {
      if ((d.name || d.title || '').toLowerCase().includes(q))
        out.push({ id: d.id, title: d.name || d.title, sub: d.project_name || d.project || '', type: 'document', route: '/documents' });
    });

    return out.slice(0, 10);
  })();

  // Quick links shown when no query
  const quickLinks = [
    { label: 'My Work',    icon: <Calendar size={14} color="#8B5CF6" />,  route: '/my-work',   bg: '#F5F3FF' },
    { label: 'Tasks',      icon: <CheckSquare size={14} color="#F59E0B" />, route: '/taskboard', bg: '#FFFBEB' },
    { label: 'Projects',   icon: <FolderKanban size={14} color="#1663F6" />, route: '/projects', bg: '#EEF4FF' },
    { label: 'Documents',  icon: <FileText size={14} color="#22C55E" />,  route: '/documents', bg: '#F0FDF4' },
  ];

  const go = useCallback((route: string) => { navigate(route); onClose(); }, [navigate, onClose]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={onClose}
    >
      <div
        style={{ width: 560, background: '#fff', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,.22)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #E6EBF2' }}>
          <Search size={17} color="#9CA3AF" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, tasks, documents…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#172033', background: 'transparent', fontFamily: 'inherit' }}
          />
          {query ? (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={15} color="#9CA3AF" />
            </button>
          ) : (
            <kbd style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>ESC</kbd>
          )}
        </div>

        {/* Results or quick links */}
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {query.trim().length >= 2 ? (
            results.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
                No results for "<strong>{query}</strong>"
              </div>
            ) : (
              <div>
                {/* Group by type */}
                {(['project', 'task', 'document'] as const).map(type => {
                  const group = results.filter(r => r.type === type);
                  if (!group.length) return null;
                  const meta = TYPE_META[type];
                  return (
                    <div key={type}>
                      <div style={{ padding: '10px 18px 4px', fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                        {meta.label}s
                      </div>
                      {group.map(item => (
                        <button
                          key={item.id}
                          onClick={() => go(item.route)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {meta.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                            {item.sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{item.sub}</div>}
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 10 }}>{meta.label}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Quick links</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {quickLinks.map(l => (
                  <button
                    key={l.route}
                    onClick={() => go(l.route)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: l.bg, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    {l.icon}
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid #E6EBF2', display: 'flex', gap: 16 }}>
          {[['↵', 'to select'], ['↑↓', 'to navigate'], ['esc', 'to close']].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9CA3AF' }}>
              <kbd style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700, color: '#6B7280' }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Trigger button — placed in the top bar ─────────────────────────────────────
export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false);

  // ⌘K shortcut
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 36, padding: '0 14px',
          background: '#F7F8FB', border: '1px solid #E6EBF2',
          borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          minWidth: 200,
        }}
      >
        <Search size={13} color="#667085" />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: '#9CA3AF' }}>Search anything…</span>
        <kbd style={{ background: '#fff', border: '1px solid #E3E8EF', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, color: '#6B7280' }}>⌘K</kbd>
      </button>

      {open && <GlobalSearchOverlay onClose={() => setOpen(false)} />}
    </>
  );
}