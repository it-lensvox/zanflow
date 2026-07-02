import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, FolderKanban, CheckSquare, FileText, Calendar, MessageSquare, Users } from 'lucide-react';
import { taskApi, projectsApi, documentsApi, agentApi } from '@/services/api';
import type { AgentSearchResponse, AgentSearchMember } from '@/types';
import { getStatusColors } from '@/config/statusColors';
import { buildViewAllUrl } from '@/utils/filtersUsedNavigation';
import { getTypeHex, getTypeBg } from '@/pages/Project/projectConstants';

// ── Types 
type ResultItem = {
  id: number | string;
  title: string;
  sub?: string;
  type: 'project' | 'task' | 'document' | 'note' | 'event';
  route: string;
  taskStatus?: string;
  taskType?: string;
};

// Static meta for task/document/note/event
const TYPE_META = {
  task: { icon: <FileText size={15} color="#F59E0B" />, color: '#F59E0B', bg: '#FFFBEB', label: 'Task' },
  document: { icon: <FileText size={15} color="#22C55E" />, color: '#22C55E', bg: '#F0FDF4', label: 'Document' },
  note: { icon: <FileText size={15} color="#8B5CF6" />, color: '#8B5CF6', bg: '#F5F3FF', label: 'Note' },
  event: { icon: <Calendar size={15} color="#06B6D4" />, color: '#06B6D4', bg: '#ECFEFF', label: 'Event' },
} as const;

// Project meta is dynamic — color comes from project type
function getProjectMeta(taskType?: string) {
  const color = getTypeHex(taskType);
  const bg = getTypeBg(taskType);
  return { icon: <FolderKanban size={15} color={color} />, color, bg, label: 'Project' };
}

// ── Per-section accumulated items (for Load More per model)
type SectionItems = Record<'project' | 'task' | 'note' | 'event', ResultItem[]>;
type SectionPages = Record<'project' | 'task' | 'note' | 'event', number>;
type SectionHasMore = Record<'project' | 'task' | 'note' | 'event', boolean>;
type SectionLoading = Record<'project' | 'task' | 'note' | 'event', boolean>;

const EMPTY_ITEMS: SectionItems = { project: [], task: [], note: [], event: [] };
const EMPTY_PAGES: SectionPages = { project: 1, task: 1, note: 1, event: 1 };
const EMPTY_HAS_MORE: SectionHasMore = { project: false, task: false, note: false, event: false };
const EMPTY_LOADING: SectionLoading = { project: false, task: false, note: false, event: false };

// ── Search overlay
export function GlobalSearchOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AgentSearchResponse | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-section accumulated items + pagination state
  const [sectionItems, setSectionItems] = useState<SectionItems>(EMPTY_ITEMS);
  const [sectionPages, setSectionPages] = useState<SectionPages>(EMPTY_PAGES);
  const [sectionHasMore, setSectionHasMore] = useState<SectionHasMore>(EMPTY_HAS_MORE);
  const [sectionLoading, setSectionLoading] = useState<SectionLoading>(EMPTY_LOADING);
  const [totals, setTotals] = useState<Record<string, number>>({});

  // Focus on mount
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  // Close on ESC
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // ── Basic REST data (for instant local results while AI loads)
  const { data: tasksRes } = useQuery({ queryKey: ['gs-tasks'], queryFn: () => taskApi.list({ disable_pagination: true }), staleTime: 60000 });
  const { data: projectsRes } = useQuery({ queryKey: ['gs-projects'], queryFn: () => projectsApi.list(), staleTime: 60000 });
  const { data: docsRes } = useQuery({ queryKey: ['gs-docs'], queryFn: () => documentsApi.list({ page_size: 200, page: 1 }), staleTime: 60000 });

  const allTasks = tasksRes?.tasks || tasksRes?.results || (Array.isArray(tasksRes) ? tasksRes : []);
  const allProjects = projectsRes?.results || (Array.isArray(projectsRes) ? projectsRes : []);
  const allDocs = docsRes?.results || docsRes?.documents || (Array.isArray(docsRes) ? docsRes : []);

  // ── Helper: map AI response results into SectionItems
  // Members from AI search stored separately (not in SectionItems — different render)
  const [memberResults, setMemberResults] = useState<AgentSearchMember[]>([]);

  const mapAiResults = (res: AgentSearchResponse): SectionItems => {
    if (res.type !== 'search') return EMPTY_ITEMS;
    // Store members separately
    setMemberResults(res.results.members || []);
    return {
      project: res.results.projects.map(p => ({ id: p.id, title: p.name, sub: '', type: 'project' as const, route: `/projects/${p.id}` })),
      task:    res.results.tasks.map(t    => ({ id: t.id, title: t.heading, sub: t.project || '', type: 'task' as const, route: `/tasks/${t.id}`, taskStatus: t.status })),
      note: res.results.notes.map(n => ({ id: n.id, title: n.title, sub: n.preview || n.project || '', type: 'note' as const, route: '/documents' })),
      event: (res.results.events || []).map(e => ({ id: e.id, title: e.title, sub: e.event_type ? `${e.event_type}${e.organizer ? ' · ' + e.organizer : ''}` : e.organizer || '', type: 'event' as const, route: '/calendar' })),
    };
  };

  // ── Parallel AI search
  useEffect(() => {
    setAiResult(null);
    setSectionItems(EMPTY_ITEMS);
    setSectionPages(EMPTY_PAGES);
    setSectionHasMore(EMPTY_HAS_MORE);
    setTotals({});
    setMemberResults([]);
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) { setAiLoading(false); return; }

    setAiLoading(true);
    aiTimerRef.current = setTimeout(async () => {
      try {
        const res = await agentApi.search({ query: trimmed, page: 1, page_size: 10 });
        if (res.type === 'search') {
        }
        setAiResult(res);
        if (res.type === 'search') {
          setSectionItems(mapAiResults(res));
          setSectionHasMore({
            project: false, task: false, note: false, event: false, ...Object.fromEntries(
              (['project', 'task', 'note', 'event'] as const).map(m => [m, res.has_more])
            )
          });
          setTotals(res.totals as unknown as Record<string, number>);
        }
      } catch {
      } finally {
        setAiLoading(false);
      }
    }, 500);

    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
  }, [query]);

  // ── Load more for a specific section
  const handleLoadMore = async (model: 'project' | 'task' | 'note' | 'event') => {
    const nextPage = sectionPages[model] + 1;
    setSectionLoading(prev => ({ ...prev, [model]: true }));
    try {
      const res = await agentApi.search({
        query: query.trim(),
        page: nextPage,
        page_size: 10,
        models: [model],
      });
      if (res.type === 'search') {
        const mapped = mapAiResults(res);
        setSectionItems(prev => ({ ...prev, [model]: [...prev[model], ...mapped[model]] }));
        setSectionPages(prev => ({ ...prev, [model]: nextPage }));
        setSectionHasMore(prev => ({ ...prev, [model]: res.has_more }));
      }
    } catch { }
    finally { setSectionLoading(prev => ({ ...prev, [model]: false })); }
  };

  // ── Build displayed results:
  const useAiResults = aiResult?.type === 'search';

  const basicResults: ResultItem[] = (() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    const out: ResultItem[] = [];
    allProjects.forEach((p: any) => {
      if ((p.name || '').toLowerCase().includes(q))
        out.push({ id: p.id, title: p.name, sub: p.description || '', type: 'project', route: `/projects/${p.id}`, taskType: p.task_type || p.type || '' });
    });
    allTasks.forEach((t: any) => {
      if ((t.heading || t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
        out.push({ id: t.id, title: t.heading || t.title, sub: t.project_details?.name || '', type: 'task', route: `/tasks/${t.id}`, taskStatus: t.status });
    });
    allDocs.forEach((d: any) => {
      if ((d.name || d.title || '').toLowerCase().includes(q))
        out.push({ id: d.id, title: d.name || d.title, sub: d.project_name || d.project || '', type: 'document', route: '/documents' });
    });
    return out.slice(0, 10);
  })();

  // ── Action intent: AI classified the query as an action, not a search
  const isActionIntent = aiResult?.type === 'action';
  const actionQuery = isActionIntent ? aiResult.query : '';
  const actionMessage = isActionIntent ? aiResult.message : '';
  // Quick links shown when no query
  const quickLinks = [
    { label: 'My Work', icon: <Calendar size={14} color="#8B5CF6" />, route: '/my-work', bg: '#F5F3FF' },
    { label: 'Tasks', icon: <CheckSquare size={14} color="#F59E0B" />, route: '/taskboard', bg: '#FFFBEB' },
    { label: 'Projects', icon: <FolderKanban size={14} color="#1663F6" />, route: '/projects', bg: '#EEF4FF' },
    { label: 'Documents', icon: <FileText size={14} color="#22C55E" />, route: '/documents', bg: '#F0FDF4' },
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
            <>

              {/* Action intent banner */}
              {isActionIntent ? (
                <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#172033', fontWeight: 600, marginBottom: 6 }}>{actionMessage}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>
                    Try the AI assistant to complete this action.
                  </div>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('aibot:open', { detail: { query: actionQuery } }));
                      onClose();
                    }}
                    style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#8B5CF6', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Open AI Assistant
                  </button>
                </div>
            ) : (() => {
                // Decide which result set to render
                const displaySections = useAiResults ? sectionItems : null;
                const displayBasic    = !useAiResults ? basicResults : [];

                // Empty state: AI done + no results, and basic also empty
                const aiDoneEmpty = !aiLoading && useAiResults && Object.values(sectionItems).every(a => a.length === 0);
                const basicEmpty  = !aiLoading && !useAiResults && displayBasic.length === 0;
                const showEmpty   = aiDoneEmpty || basicEmpty;

                if (showEmpty) return (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
                    No results for "<strong>{query}</strong>"
                  </div>
                );

                // Skeleton: AI loading AND no basic results yet
                if (aiLoading && displayBasic.length === 0 && !useAiResults) return (
                  <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F3F4F6', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ height: 12, borderRadius: 4, background: 'linear-gradient(90deg,#f0f2f5 25%,#e4e7ec 50%,#f0f2f5 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', width: '55%' }} />
                          <div style={{ height: 10, borderRadius: 4, background: 'linear-gradient(90deg,#f0f2f5 25%,#e4e7ec 50%,#f0f2f5 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', width: '30%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );

               // ── AI results: per-section with totals + Load More
                if (displaySections) return (
                  <div>
                    {/* Members section — only from AI search */}
                    {memberResults.length > 0 && (
                      <div>
                        <div style={{ padding: '10px 18px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                            Members
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', background: '#F3F4F6', borderRadius: 10, padding: '1px 7px' }}>
                            {memberResults.length}
                          </span>
                        </div>
                        {memberResults.map(member => {
                          const initials = member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                          return (
                            <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#1663F6' }}>{initials}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
                                <div style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
                              </div>
                              <button
                                onClick={() => { navigate(`/team-chat/chat?member_id=${member.id}`); onClose(); }}
                                style={{ height: 26, padding: '0 10px', borderRadius: 6, border: '1px solid #C7D7FD', background: '#EEF4FF', fontSize: 11, fontWeight: 600, color: '#1663F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, fontFamily: 'inherit' }}
                              >
                                <MessageSquare size={10} /> Chat
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(['project', 'task', 'note', 'event'] as const).map(model => {
                      const group = displaySections[model];
                      if (!group.length && !totals[model + 's'] && !totals[model]) return null;
                      const staticMeta = model !== 'project' ? TYPE_META[model] : null;
                      const sectionTotal = totals[model + 's'] ?? totals[model] ?? group.length;
                      const hasMore = sectionHasMore[model];
                      const isLoadingMore = sectionLoading[model];
                      const viewAllUrl = useAiResults && aiResult?.type === 'search'
                        ? buildViewAllUrl(model, aiResult.filters_used)
                        : null;
                      return (
                        <div key={model}>
                          {/* Section header with total count + View all link */}
                          <div style={{ padding: '10px 18px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                              {staticMeta?.label ?? 'Project'}s
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {sectionTotal > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', background: '#F3F4F6', borderRadius: 10, padding: '1px 7px' }}>
                                  {sectionTotal}
                                </span>
                              )}
                             {viewAllUrl && sectionTotal > group.length && (
                                <button
                                  onClick={() => { console.log('[DEBUG] View all clicked — built URL:', viewAllUrl, 'from filters_used:', aiResult?.type === 'search' ? aiResult.filters_used : null); go(viewAllUrl); }}
                                  style={{ fontSize: 10, fontWeight: 700, color: '#1663F6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                                >
                                  View all {sectionTotal} →
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Result rows */}
                          {group.map(item => {
                            const meta = item.type === 'project' ? getProjectMeta(item.taskType) : staticMeta!;
                            const statusColors = item.taskStatus ? getStatusColors(item.taskStatus) : null;
                            return (
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
                                {statusColors ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: statusColors.text, background: statusColors.bg, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>
                                    {(item.taskStatus || '').replace('_', ' ')}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>{meta.label}</span>
                                )}
                              </button>
                            );
                          })}
                          {/* Per-section Load More */}
                          {hasMore && (
                            <div style={{ padding: '4px 18px 10px' }}>
                              <button
                                onClick={() => handleLoadMore(model)}
                                disabled={isLoadingMore}
                                style={{ fontSize: 12, fontWeight: 600, color: '#1663F6', background: 'none', border: 'none', cursor: isLoadingMore ? 'default' : 'pointer', padding: 0, fontFamily: 'inherit', opacity: isLoadingMore ? 0.5 : 1 }}
                              >
                                {isLoadingMore ? 'Loading…' : `Show more ${staticMeta?.label.toLowerCase() ?? 'project'}s`}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );

                // ── Basic REST results 
                return (
                  <div>
                    {(['project', 'task', 'document'] as const).map(type => {
                      const group = displayBasic.filter(r => r.type === type);
                      if (!group.length) return null;
                      const staticMeta = type !== 'project' ? TYPE_META[type] : null;
                      return (
                        <div key={type}>
                          <div style={{ padding: '10px 18px 4px', fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                            {staticMeta?.label ?? 'Project'}s
                          </div>
                          {group.map(item => {
                            const meta = item.type === 'project' ? getProjectMeta(item.taskType) : staticMeta!;
                            const statusColors = item.taskStatus ? getStatusColors(item.taskStatus) : null;
                            return (
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
                                {statusColors ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: statusColors.text, background: statusColors.bg, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>
                                    {(item.taskStatus || '').replace('_', ' ')}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>{meta.label}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
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

// ── Trigger button 
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
          minWidth: 200, width: '100%',
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