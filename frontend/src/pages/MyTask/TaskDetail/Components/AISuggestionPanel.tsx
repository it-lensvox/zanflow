import React, { useRef, useEffect, useState } from 'react';
import {
  Sparkles, RefreshCw, Plus, X, Check, Loader2, ChevronUp,
  AlertCircle, CheckCircle2, ChevronDown, User,
} from 'lucide-react';
import type { TaskSuggestion, SuggestionPriority, SuggestionStatus } from '../hooks/useAISuggestions';
import { getStatusConfig, priorityOptions, statusOptions } from '@/components/layout/DualView/taskConfig';
import { PRIORITY_OPTIONS } from '@/config/priorityConfig';

// ── Design tokens 
const T = {
  text:  'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  line:  'hsl(var(--border))',
  blue:  '#1663f6',
} as const;

// ── Status — dot colors pulled from getStatusConfig (single source of truth) ─
const STATUS_OPTS: { value: SuggestionStatus; label: string; dot: string }[] = (
  ['pending','backlog','in_progress','review','completed','deployed','deferred'] as SuggestionStatus[]
).map(v => ({
  value: v,
  label: getStatusConfig(v).label.charAt(0) + getStatusConfig(v).label.slice(1).toLowerCase().replace(/_/g, ' '),
  dot:   getStatusConfig(v).color,
}));

const PRIORITY_OPTS = PRIORITY_OPTIONS.map(p => p.value) as SuggestionPriority[];

// ── Shared mini-dropdown ────
function MiniDropdown<T extends string>({
  value,
  options,
  renderTrigger,
  renderOption,
  onChange,
}: {
  value: T;
  options: T[];
  renderTrigger: (v: T) => React.ReactNode;
  renderOption:  (v: T) => React.ReactNode;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '2px 7px', borderRadius: 6, border: `1px solid ${T.line}`,
          background: 'hsl(var(--input))', fontSize: 11, color: T.text,
          cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
        }}
      >
        {renderTrigger(value)}
        <ChevronDown size={10} style={{ color: T.muted }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 60, top: 'calc(100% + 3px)', left: 0,
          background: 'hsl(var(--popover))', border: `1px solid ${T.line}`, borderRadius: 8,
          boxShadow: '0 8px 24px rgba(16,24,40,.12)', overflow: 'hidden', minWidth: 120,
        }}>
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                width: '100%', padding: '7px 12px', fontSize: 12, color: T.text,
                background: value === opt ? 'hsl(var(--accent))' : 'transparent',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: 7, textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--accent))')}
              onMouseLeave={e => (e.currentTarget.style.background = value === opt ? 'hsl(var(--accent))' : 'transparent')}
            >
              {renderOption(opt)}
              {value === opt && (
                <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="12" height="12" viewBox="0 0 20 20" fill={T.blue}>
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Assignee picker ──────────────────────────────────────────────────────────
interface AvailableUser {
  id:         number;
  username:   string;
  first_name: string;
  last_name:  string;
}

function AssigneePicker({
  assignedIds,
  availableUsers,
  onAdd,
  onRemove,
}: {
  assignedIds:    number[];
  availableUsers: AvailableUser[];
  onAdd:    (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unassigned = availableUsers.filter(u => !assignedIds.includes(u.id));

  const initials = (u: AvailableUser) =>
    `${u.first_name[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase() || u.username[0].toUpperCase();

  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flex: 1 }}>
      {/* Assigned pills */}
      {assignedIds.map(id => {
        const u = availableUsers.find(u => u.id === id);
        if (!u) return null;
        return (
          <span
            key={id}
            title={`${u.first_name} ${u.last_name}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: '#ede9fe', border: '1px solid #c4b5fd',
              borderRadius: 99, padding: '1px 5px 1px 2px',
              fontSize: 10, fontWeight: 600, color: '#6d28d9',
              cursor: 'default', whiteSpace: 'nowrap',
            }}
          >
            <span style={{
              width: 16, height: 16, borderRadius: '50%',
              background: '#7c3aed', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, flexShrink: 0,
            }}>
              {initials(u)}
            </span>
            {u.first_name}
            <button
              onClick={() => onRemove(id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', padding: 0, lineHeight: 1, display: 'flex' }}
            >
              <X size={9} />
            </button>
          </span>
        );
      })}

      {/* Add button — only show if there are unassigned users */}
      {unassigned.length > 0 && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen(v => !v)}
            title="Add assignee"
            style={{
              width: 18, height: 18, borderRadius: '50%',
              border: `1.5px dashed ${T.line}`, background: 'hsl(var(--muted))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: T.muted, flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.blue; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.color = T.muted; }}
          >
            <Plus size={10} />
          </button>
          {open && (
            <div style={{
              position: 'absolute', zIndex: 60, top: 'calc(100% + 3px)', left: 0,
             background: 'hsl(var(--popover))', border: `1px solid ${T.line}`, borderRadius: 8,
              boxShadow: '0 8px 24px rgba(16,24,40,.12)', overflow: 'hidden',
              minWidth: 150, maxHeight: 160, overflowY: 'auto',
            }}>
              {unassigned.map(u => (
                <button
                  key={u.id}
                  onClick={() => { onAdd(u.id); setOpen(false); }}
                  style={{ width: '100%', padding: '7px 12px', fontSize: 12, color: T.text, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}
                   onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--accent))')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                 <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: T.muted, flexShrink: 0 }}>
                    {initials(u)}
                  </div>
                  {u.first_name} {u.last_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unassigned placeholder */}
      {assignedIds.length === 0 && unassigned.length === 0 && (
        <span style={{ fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
          <User size={11} /> No members
        </span>
      )}
    </div>
  );
}

// ── Skeleton
function SuggestionSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px 6px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'hsl(var(--card))', border: `1px solid ${T.line}`,
            borderRadius: 8, padding: '9px 12px',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 80}ms`,
          }}
        >
         <div style={{ width: 14, height: 14, borderRadius: 4, background: 'hsl(var(--border))', flexShrink: 0 }} />
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'hsl(var(--border))', flexShrink: 0 }} />
          <div style={{ height: 11, background: 'hsl(var(--border))', borderRadius: 4, flex: 1, width: `${55 + i * 8}%` }} />
          <div style={{ width: 40, height: 18, background: 'hsl(var(--muted))', borderRadius: 6, flexShrink: 0 }} />
          <div style={{ width: 50, height: 18, background: 'hsl(var(--muted))', borderRadius: 6, flexShrink: 0 }} />
        </div>
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  );
}

// ── Single suggestion row ─────────────────────────────────────────────────────
function SuggestionRow({
  suggestion,
  availableUsers,
  onToggle,
  onDelete,
  onStartEdit,
  onCommitEdit,
  onPriorityChange,
  onStatusChange,
  onAddAssignee,
  onRemoveAssignee,
}: {
  suggestion:       TaskSuggestion;
  availableUsers:   AvailableUser[];
  onToggle:         () => void;
  onDelete:         () => void;
  onStartEdit:      () => void;
  onCommitEdit:     (title: string) => void;
  onPriorityChange: (p: SuggestionPriority) => void;
  onStatusChange:   (s: SuggestionStatus)   => void;
  onAddAssignee:    (id: number)             => void;
  onRemoveAssignee: (id: number)             => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const _sc = STATUS_OPTS.find(o => o.value === suggestion.status) ?? STATUS_OPTS[0];
  useEffect(() => {
    if (suggestion.isEditing) inputRef.current?.focus();
  }, [suggestion.isEditing]);

  return (
    <div
      style={{
        background: suggestion.selected ? 'hsl(var(--card))' : 'hsl(var(--muted)/0.4)',
        border: `1px solid ${suggestion.selected ? T.line : 'hsl(var(--border))'}`,
        borderRadius: 8,
        opacity: suggestion.selected ? 1 : 0.65,
        transition: 'all .15s',
      }}
    >
      {/* ── Row 1: checkbox · title · delete ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 4px' }}>
        {/* Checkbox */}
        <button
          onClick={onToggle}
          style={{
            width: 15, height: 15, borderRadius: 4, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: suggestion.selected ? `2px solid ${T.blue}` : `2px solid hsl(var(--border))`,
            background: suggestion.selected ? T.blue : 'hsl(var(--input))',
            cursor: 'pointer', transition: 'all .15s',
          }}
          aria-label={suggestion.selected ? 'Deselect' : 'Select'}
        >
          {suggestion.selected && <Check size={9} style={{ color: '#fff', strokeWidth: 3 }} />}
        </button>

        {/* Title */}
        {suggestion.isEditing ? (
          <input
            ref={inputRef}
            defaultValue={suggestion.title}
            onBlur={e => onCommitEdit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  onCommitEdit((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') onCommitEdit(suggestion.title);
            }}
            style={{
              flex: 1, fontSize: 12, color: T.text,
              background: '#eff6ff', border: `1px solid ${T.blue}`, borderRadius: 6,
              padding: '2px 6px', outline: 'none',
              boxShadow: `0 0 0 2px rgba(22,99,246,.1)`,
            }}
          />
        ) : (
          <span
            onClick={onStartEdit}
            title="Click to rename"
            style={{
              flex: 1, fontSize: 12, fontWeight: 500,
              color: suggestion.selected ? T.text : T.muted,
              textDecoration: suggestion.selected ? 'none' : 'line-through',
              cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {suggestion.title}
          </span>
        )}

        {/* Delete */}
        <button
          onClick={onDelete}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.muted, padding: 2, flexShrink: 0, display: 'flex',
            borderRadius: 4, transition: 'color .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = T.muted)}
          aria-label="Remove suggestion"
        >
          <X size={12} />
        </button>
      </div>

      {/* ── Row 2: priority · status · assignees ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 8px 33px', flexWrap: 'wrap' }}>
        {/* Priority pill-dropdown */}
        <MiniDropdown<SuggestionPriority>
          value={suggestion.priority}
          options={PRIORITY_OPTS}
          renderTrigger={p => {
            const c = priorityOptions.find(o => o.value === p) ?? priorityOptions[2];
            return (
              <>
                <div className={`h-1 w-3 rounded-full ${c.dotColor}`} style={{ flexShrink: 0 }} />
                <span className={`text-[11px] font-medium ${c.color}`}>{c.label}</span>
              </>
            );
          }}
          renderOption={p => {
            const c = priorityOptions.find(o => o.value === p) ?? priorityOptions[2];
            return (
              <>
                <span>{c.icon}</span>
                <span className={`text-[12px] font-medium ${c.color}`}>{c.label}</span>
              </>
            );
          }}
          onChange={onPriorityChange}
        />

        {/* Status pill-dropdown */}
        <MiniDropdown<SuggestionStatus>
          value={suggestion.status}
          options={STATUS_OPTS.map(o => o.value)}
          renderTrigger={s => {
            const cfg = getStatusConfig(s);
            return (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cfg.badge}`}>
                {cfg.label}
              </span>
            );
          }}
          renderOption={s => {
            const cfg = getStatusConfig(s);
            const opt = statusOptions.find(o => o.value === s);
            const textColor = cfg.badge.split(' ').find((cls: string) => cls.startsWith('text-')) || cfg.text;
            return (
              <>
                {opt && React.createElement(opt.icon, { className: `w-3.5 h-3.5 ${textColor}` })}
                <span className={`text-[12px] font-medium ${textColor}`}>{cfg.label}</span>
              </>
            );
          }}
          onChange={onStatusChange}
        />

        {/* Assignee picker */}
        {availableUsers.length > 0 && (
          <AssigneePicker
            assignedIds={suggestion.assigned_to}
            availableUsers={availableUsers}
            onAdd={onAddAssignee}
            onRemove={onRemoveAssignee}
          />
        )}
      </div>
    </div>
  );
}

// ── Panel props ───────────────────────────────────────────────────────────────
export interface AISuggestionPanelProps {
  isOpen:       boolean;
  isLoading:    boolean;
  isCreating:   boolean;
  error:        string | null;
  createError:  string | null;
  createdCount: number;
  suggestions:  TaskSuggestion[];
  selectedCount: number;
  allSelected:  boolean;
  availableUsers: AvailableUser[];
  onClose:            () => void;
  onRegenerate:       () => void;
  onGenerateMore:     () => void;
  onToggleSelect:     (clientId: string) => void;
  onToggleSelectAll:  () => void;
  onDelete:           (clientId: string) => void;
  onStartEdit:        (clientId: string) => void;
  onCommitEdit:       (clientId: string, title: string) => void;
  onPriorityChange:   (clientId: string, priority: SuggestionPriority) => void;
  onStatusChange:     (clientId: string, status: SuggestionStatus)     => void;
  onAddAssignee:      (clientId: string, userId: number)               => void;
  onRemoveAssignee:   (clientId: string, userId: number)               => void;
  onCreateSelected:   () => void;
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function AISuggestionPanel({
  isOpen, isLoading, isCreating, error, createError, createdCount,
  suggestions, selectedCount, allSelected, availableUsers,
  onClose, onRegenerate, onGenerateMore,
  onToggleSelect, onToggleSelectAll,
  onDelete, onStartEdit, onCommitEdit,
  onPriorityChange, onStatusChange, onAddAssignee, onRemoveAssignee,
  onCreateSelected,
}: AISuggestionPanelProps) {
  if (!isOpen) return null;

  const isEmpty    = !isLoading && !error && suggestions.length === 0;
  const showSuccess = createdCount > 0 && !createError;

  return (
    <div style={{
      marginTop: 10, border: `1px solid rgba(99,130,254,0.35)`,
      borderRadius: 10, overflow: 'hidden',
      background: 'hsl(var(--card))', boxShadow: '0 1px 4px rgba(0,0,0,.12)',
    }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'hsl(var(--card))', borderBottom: `1px solid hsl(var(--border))` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(59,90,245,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={11} style={{ color: T.blue }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#3b5af5' }}>
            {isLoading
              ? 'Analysing your task…'
              : suggestions.length > 0
              ? `${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''} — edit before creating`
              : 'AI child task suggestions'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {!isLoading && suggestions.length > 0 && (
            <button onClick={onRegenerate}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.blue, background: 'none', border: 'none', cursor: 'pointer', padding: '3px 7px', borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,90,245,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <RefreshCw size={11} /> Regenerate
            </button>
          )}
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 3, display: 'flex', borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = T.text)}
            onMouseLeave={e => (e.currentTarget.style.color = T.muted)}
            aria-label="Close AI panel"
          >
            <ChevronUp size={15} />
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && <SuggestionSkeleton />}

      {/* ── Error ── */}
      {error && !isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
          <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: '#b91c1c', flex: 1, margin: 0 }}>{error}</p>
          <button onClick={onRegenerate}
            style={{ fontSize: 12, color: '#b91c1c', background: 'none', border: `1px solid #fecaca`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* ── Empty ── */}
      {isEmpty && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '24px 16px', textAlign: 'center' }}>
          <Sparkles size={18} style={{ color: '#cbd5e1' }} />
          <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>No suggestions generated. Try adding more detail to the task description.</p>
          <button onClick={onRegenerate} style={{ fontSize: 12, color: T.blue, background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>Try again</button>
        </div>
      )}

      {/* ── List ── */}
      {suggestions.length > 0 && !isLoading && (
        <>
          {/* Select-all bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 4px' }}>
            <span style={{ fontSize: 11, color: T.muted }}>{selectedCount} of {suggestions.length} selected</span>
            <button onClick={onToggleSelectAll}
              style={{ fontSize: 11, fontWeight: 600, color: T.blue, background: 'none', border: 'none', cursor: 'pointer' }}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {/* Column hints (shown once above the list) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px 4px 33px' }}>
            <span style={{ fontSize: 10, color: T.muted, minWidth: 60 }}>Priority</span>
            <span style={{ fontSize: 10, color: T.muted, minWidth: 80 }}>Status</span>
            <span style={{ fontSize: 10, color: T.muted }}>Assignees</span>
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '0 10px 8px' }}>
            {suggestions.map(s => (
              <SuggestionRow
                key={s.clientId}
                suggestion={s}
                availableUsers={availableUsers}
                onToggle={() => onToggleSelect(s.clientId)}
                onDelete={() => onDelete(s.clientId)}
                onStartEdit={() => onStartEdit(s.clientId)}
                onCommitEdit={title => onCommitEdit(s.clientId, title)}
                onPriorityChange={p => onPriorityChange(s.clientId, p)}
                onStatusChange={st => onStatusChange(s.clientId, st)}
                onAddAssignee={id => onAddAssignee(s.clientId, id)}
                onRemoveAssignee={id => onRemoveAssignee(s.clientId, id)}
              />
            ))}
          </div>

          {/* Generate more */}
          <div style={{ padding: '0 10px 8px' }}>
            <button onClick={onGenerateMore} disabled={isLoading}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 11, color: T.muted, border: `1px dashed ${T.line}`, borderRadius: 8, padding: '7px 0', background: 'none', cursor: 'pointer', transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = T.blue; e.currentTarget.style.borderColor = '#93c5fd'; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.line; }}
            >
              <Plus size={11} /> Generate more suggestions
            </button>
          </div>
        </>
      )}

      {/* ── Footer ── */}
      {suggestions.length > 0 && !isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 10px', borderTop: `1px solid hsl(var(--border))`, background: 'hsl(var(--muted))' }}>
          <div style={{ fontSize: 11 }}>
            {showSuccess && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a' }}>
                <CheckCircle2 size={13} /> {createdCount} task{createdCount !== 1 ? 's' : ''} created
              </span>
            )}
            {createError && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#d97706' }}>
                <AlertCircle size={13} /> {createError}
              </span>
            )}
          </div>
          <button
            onClick={onCreateSelected}
            disabled={selectedCount === 0 || isCreating}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: selectedCount === 0 || isCreating ? T.line : T.blue,
              color:      selectedCount === 0 || isCreating ? T.muted : '#fff',
              fontSize: 12, fontWeight: 600,
              cursor: selectedCount === 0 || isCreating ? 'not-allowed' : 'pointer',
              transition: 'all .15s',
            }}
          >
            {isCreating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {isCreating
              ? 'Creating…'
              : `Create ${selectedCount > 0 ? selectedCount : ''} task${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}