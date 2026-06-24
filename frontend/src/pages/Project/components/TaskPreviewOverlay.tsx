import React, { useState } from 'react';
import { X, Upload, Loader2, Users, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { priorityOptions, getStatusConfig } from '@/components/layout/DualView/taskConfig';
import type { PreviewTask } from '@/hooks/useJsonPreview';

// Priority badge 
const PRIORITY_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  critical: { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444', label: 'Critical' },
  high:     { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316', label: 'High' },
  medium:   { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B', label: 'Medium' },
  low:      { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', label: 'Low' },
};

function PriorityBadge({ priority }: { priority?: string }) {
  const key = (priority || '').toLowerCase();
  const cfg = PRIORITY_STYLES[key];
  if (!cfg) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.text, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ─── Status badge 
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:     { bg: '#FFF9EC', text: '#B45309', label: 'Pending' },
  backlog:     { bg: '#FFF4ED', text: '#C2410C', label: 'Backlog' },
  in_progress: { bg: '#EEF2FF', text: '#4338CA', label: 'In Progress' },
  completed:   { bg: '#F0FDF4', text: '#15803D', label: 'Completed' },
  deployed:    { bg: '#F5F3FF', text: '#7C3AED', label: 'Deployed' },
  deferred:    { bg: '#F9FAFB', text: '#6B7280', label: 'Deferred' },
  review:      { bg: '#EFF6FF', text: '#1D4ED8', label: 'Review' },
};

function StatusBadge({ status }: { status?: string }) {
  const key = (status || '').toLowerCase().replace(/[\s-]/g, '_');
  const cfg = STATUS_STYLES[key] || { bg: '#F3F4F6', text: '#6B7280', label: status || '' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.text, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

// ─── Single task preview card 
interface TaskPreviewCardProps {
  task: PreviewTask;
  index: number;
  onRemove: (index: number) => void;
  onEditTitle: (index: number, newTitle: string) => void;
}

function TaskPreviewCard({ task, index, onRemove, onEditTitle }: TaskPreviewCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.heading);
  const [showEmails, setShowEmails] = useState(false);
  const emails = task.assignee_emails ?? [];

  const commitTitle = () => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== task.heading) {
      onEditTitle(index, trimmed);
    } else {
      setTitleValue(task.heading);
    }
    setIsEditingTitle(false);
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E6EBF2',
      borderRadius: 12,
      padding: '14px 14px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      position: 'relative',
      boxShadow: '0 1px 4px rgba(16,24,40,.06)',
      transition: 'box-shadow 0.18s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,24,40,.10)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(16,24,40,.06)')}
    >
      {/* Remove button */}
      <button
        onClick={() => onRemove(index)}
        title="Remove task"
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 22, height: 22, borderRadius: '50%',
          border: 'none', background: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#9CA3AF', transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#EF4444'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
      >
        <X size={13} strokeWidth={2.5} />
      </button>

      {/* Task number */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>
          TASK {index + 1}
        </span>
      </div>

      {/* Title — editable */}
      {isEditingTitle ? (
        <input
          autoFocus
          value={titleValue}
          onChange={e => setTitleValue(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleValue(task.heading); setIsEditingTitle(false); } }}
          style={{
            fontSize: 14, fontWeight: 600, color: '#172033',
            border: '1.5px solid #6366F1', borderRadius: 6,
            padding: '4px 8px', outline: 'none', width: '100%',
            background: '#F5F7FF', fontFamily: 'inherit',
          }}
        />
      ) : (
        <div
          onClick={() => setIsEditingTitle(true)}
          title="Click to edit title"
          style={{
            fontSize: 14, fontWeight: 600, color: '#172033',
            lineHeight: 1.4, paddingRight: 20, cursor: 'text',
            borderRadius: 6, padding: '4px 6px', margin: '-4px -6px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FB')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {task.heading}
          <span style={{ marginLeft: 6, fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>✎</span>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <p style={{
          fontSize: 12, color: '#667085', lineHeight: 1.5,
          margin: 0, overflow: 'hidden',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}>
          {task.description}
        </p>
      )}

      {/* Badges row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {task.priority && <PriorityBadge priority={task.priority} />}
        {task.status && <StatusBadge status={task.status} />}
      </div>

      {/* Assignees */}
      {emails.length > 0 && (
        <div style={{ position: 'relative' }}>
          {emails.length === 1 ? (
            <span style={{ fontSize: 11, color: '#667085', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={11} /> {emails[0]}
            </span>
          ) : (
            <button
              onMouseEnter={() => setShowEmails(true)}
              onMouseLeave={() => setShowEmails(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6366F1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
            >
              <Users size={11} /> {emails.length} assignees
            </button>
          )}
          {showEmails && emails.length > 1 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
              background: '#1E293B', color: '#fff', borderRadius: 8,
              padding: '8px 12px', fontSize: 11, lineHeight: 1.7,
              zIndex: 50, minWidth: 180, boxShadow: '0 4px 16px rgba(0,0,0,.18)',
            }}>
              {emails.map((e, i) => <div key={i} style={{ opacity: 0.9 }}>{e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main overlay 
interface TaskPreviewOverlayProps {
  tasks: PreviewTask[];
  onRemoveTask: (index: number) => void;
  onEditTitle: (index: number, newTitle: string) => void;
  onBack: () => void;
  onCreateTasks: () => void;
  isCreating: boolean;
}

export function TaskPreviewOverlay({
  tasks,
  onRemoveTask,
  onEditTitle,
  onBack,
  onCreateTasks,
  isCreating,
}: TaskPreviewOverlayProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      {/* Centered container */}
      <div style={{
        width: '100%', maxWidth: 860,
        maxHeight: 'calc(100vh - 48px)',
        background: '#F7F8FB',
        borderRadius: 18,
        boxShadow: '0 24px 60px rgba(16,24,40,.22)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px',
          background: '#fff',
          borderBottom: '1px solid #E6EBF2',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={onBack}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: '#667085',
                background: 'none', border: '1px solid #E6EBF2',
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F7F8FB'; e.currentTarget.style.color = '#344054'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#667085'; }}
            >
              <ArrowLeft size={14} /> Back to Import
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#172033' }}>Preview Tasks</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                  background: '#EEF2FF', color: '#4338CA',
                }}>
                  {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#667085', marginTop: 2 }}>
                Edit titles, remove unwanted tasks, then create.
              </p>
            </div>
          </div>

          <button
            onClick={onCreateTasks}
            disabled={isCreating || tasks.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 22px', borderRadius: 9, border: 'none',
              background: tasks.length === 0 ? '#E5E7EB' : 'linear-gradient(135deg,#5568d3,#65408b)',
              color: tasks.length === 0 ? '#9CA3AF' : '#fff',
              fontSize: 14, fontWeight: 700, cursor: tasks.length === 0 || isCreating ? 'not-allowed' : 'pointer',
              opacity: isCreating ? 0.75 : 1,
              boxShadow: tasks.length > 0 ? '0 2px 8px rgba(101,64,139,.30)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {isCreating
              ? <><Loader2 size={15} className="animate-spin" /> Creating…</>
              : <><Upload size={15} /> Create {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}</>
            }
          </button>
        </div>

        {/* ── Grid of cards ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 24px' }}>
          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 500 }}>All tasks removed</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Go back to import more.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 14,
            }}>
              {tasks.map((task, i) => (
                <TaskPreviewCard
                  key={i}
                  task={task}
                  index={i}
                  onRemove={onRemoveTask}
                  onEditTitle={onEditTitle}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}