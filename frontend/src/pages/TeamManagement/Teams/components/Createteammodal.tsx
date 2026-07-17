import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, X, Plus } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { teamsApi, usersApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { CreateTeamPayload } from '@/types';
import { TEXT, MUTED, LINE, BLUE } from '@/config/tokens';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Custom dropdown — dark-mode safe
function CustomDropdown({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [isOpen, setIsOpen]   = useState(false);
  const [rect, setRect]       = useState<DOMRect | null>(null);
  const triggerRef            = useRef<HTMLDivElement>(null);
  const dropRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropRef.current    && !dropRef.current.contains(e.target as Node)
      ) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(v => !v)}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8,
          border: `1px solid ${isOpen ? BLUE : LINE}`,
          background: 'hsl(var(--input))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', transition: 'border-color .15s',
          boxShadow: isOpen ? `0 0 0 3px rgba(22,99,246,.08)` : 'none',
        }}
      >
        <span style={{ fontSize: 13, color: value ? TEXT : MUTED }}>{value || placeholder}</span>
        <ChevronDown size={14} color={MUTED} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </div>
      {isOpen && rect && ReactDOM.createPortal(
        <div ref={dropRef} style={{
          position: 'fixed',
          top: rect.bottom + 6,
          left: rect.left,
          width: rect.width,
          zIndex: 99999,
          background: 'hsl(var(--popover))', border: `1px solid ${LINE}`,
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          overflow: 'hidden', padding: '4px 0',
        }}>
          {options.map(opt => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                color: value === opt ? BLUE : TEXT,
                background: value === opt ? `${BLUE}18` : 'transparent',
                fontWeight: value === opt ? 600 : 400,
              }}
              onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = 'hsl(var(--accent))'; }}
              onMouseLeave={e => { if (value !== opt) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export function CreateTeamModal({ isOpen, onClose, onSuccess }: CreateTeamModalProps) {
  const [teamName,             setTeamName]             = useState('');
  const [teamType,             setTeamType]             = useState('');
  const [selectedMembers,      setSelectedMembers]      = useState<number[]>([]);
  const [memberSearchInput,    setMemberSearchInput]    = useState('');
  const [memberDropdownOpen,   setMemberDropdownOpen]   = useState(false);
  const [highlightedIdx,       setHighlightedIdx]       = useState(0);
  const [leaderId,             setLeaderId]             = useState<number | null>(null);
  const [isSubmitting,         setIsSubmitting]         = useState(false);
  const [error,                setError]                = useState<string | null>(null);
  const memberDropdownRef    = useRef<HTMLDivElement>(null);
  const teamTypeRef          = useRef<HTMLDivElement>(null);
  const [typeDropRect,  setTypeDropRect]  = useState<DOMRect | null>(null);
  const [memberDropRect, setMemberDropRect] = useState<DOMRect | null>(null);
  const { user } = useAuth();
  const { data: teamTypeChoices, isLoading: isLoadingTeamTypes } = useQuery({
    queryKey: ['teamTypeChoices'],
    queryFn: teamsApi.getTeamTypeChoices,
  });
  const teamTypes = teamTypeChoices?.team_types || [];

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    staleTime: Infinity,
  });

  const allUserOptions = React.useMemo<Array<{ value: string; label: string; id: number }>>(() => {
    if (!usersData) return [];
    const data = (usersData as any).results || usersData;
    return Array.isArray(data) ? data.map((u: any) => ({
      value: String(u.id),
      label: u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username,
      id: u.id,
    })) : [];
  }, [usersData]);

  const filteredMemberOptions = React.useMemo(() => {
    const available = allUserOptions.filter(u => !selectedMembers.includes(u.id));
    if (!memberSearchInput.trim()) return available;
    return available.filter(u => u.label.toLowerCase().startsWith(memberSearchInput.toLowerCase()));
  }, [allUserOptions, selectedMembers, memberSearchInput]);

  const createTeamMutation = useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => { resetForm(); onSuccess(); },
    onError: (err: any) => { setError(err.response?.data?.detail || 'Failed to create team'); setIsSubmitting(false); },
  });

  const resetForm = () => {
    setTeamName(''); setTeamType(''); setSelectedMembers([]);
    setMemberSearchInput(''); setLeaderId(null); setError(null); setIsSubmitting(false);
  };

  const handleClose = () => { if (!isSubmitting) { resetForm(); onClose(); } };

  const handleSubmit = async () => {
    setError(null);
    if (!teamName.trim()) { setError('Team name is required'); return; }
    if (selectedMembers.length === 0) { setError('Please add at least one member'); return; }
    setIsSubmitting(true);
    const payload: CreateTeamPayload = {
      name: teamName,
      team_type: teamType || 'engineering',
      description: '',
      leader_id: leaderId || user?.id || selectedMembers[0],
      member_ids: selectedMembers,
    };
    createTeamMutation.mutate(payload);
  };

  // ESC + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isSubmitting) handleClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = 'unset'; };
  }, [isOpen, isSubmitting]);

  useEffect(() => {
    if (!memberDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node))
        setMemberDropdownOpen(false);
    };
    // Use mousedown so we can stopPropagation in dropdown items before this fires
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [memberDropdownOpen]);

  if (!isOpen) return null;

  const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 6 };
  const INPUT: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${LINE}`, background: 'hsl(var(--input))',
    fontSize: 13, color: TEXT, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .15s, box-shadow .15s',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div style={{
        position: 'relative', background: 'hsl(var(--card))', borderRadius: 16,
        border: `1px solid ${LINE}`, boxShadow: '0 24px 48px rgba(0,0,0,.20)',
        width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        margin: '0 16px',
      }}>
        {/* ── Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${BLUE}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={16} color={BLUE} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>Create New Team</p>
              <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Set up a team and invite members</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${LINE}`, background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: MUTED }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
            onMouseLeave={e => e.currentTarget.style.background = 'hsl(var(--muted))'}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>{error}</p>
            </div>
          )}

          {/* Team Name */}
          <div>
            <label style={LABEL}>Team Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              placeholder="Enter team name"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              disabled={isSubmitting}
              style={INPUT}
              onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Team Type */}
          <div>
            <label style={LABEL}>Team Type</label>
            <CustomDropdown
              value={teamTypes.find(t => t.value === teamType)?.label || ''}
              onChange={label => { const sel = teamTypes.find(t => t.label === label); if (sel) setTeamType(sel.value); }}
              options={teamTypes.map(t => t.label)}
              placeholder={isLoadingTeamTypes ? 'Loading…' : 'Select team type'}
            />
          </div>

          {/* Add Members */}
          <div>
            <label style={LABEL}>Add Members <span style={{ color: '#ef4444' }}>*</span></label>
            <div ref={memberDropdownRef}>
              {/* Input area */}
              <div
                onClick={() => {
                  setMemberDropdownOpen(true);
                  if (memberDropdownRef.current) {
                    setMemberDropRect(memberDropdownRef.current.getBoundingClientRect());
                  }
                }}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 8,
                  border: `1px solid ${memberDropdownOpen ? BLUE : LINE}`,
                  background: 'hsl(var(--input))',
                  display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 40,
                  cursor: 'text', transition: 'border-color .15s',
                  boxShadow: memberDropdownOpen ? '0 0 0 3px rgba(22,99,246,.08)' : 'none',
                }}
              >
                {usersLoading ? (
                  <span style={{ fontSize: 13, color: MUTED, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, border: `2px solid ${BLUE}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                    Loading users…
                  </span>
                ) : (
                  <>
                    {selectedMembers.map(id => {
                      const u = allUserOptions.find(u => u.id === id);
                      if (!u) return null;
                      return (
                        <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: `${BLUE}18`, color: BLUE, fontSize: 12, fontWeight: 500 }}>
                          {u.label}
                          <button type="button" onClick={e => { e.stopPropagation(); setSelectedMembers(prev => prev.filter(i => i !== id)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BLUE, padding: 0, lineHeight: 1, fontSize: 14 }} disabled={isSubmitting}>×</button>
                        </span>
                      );
                    })}
                    <input
                      type="text"
                      value={memberSearchInput}
                      onChange={e => { setMemberSearchInput(e.target.value); setHighlightedIdx(0); setMemberDropdownOpen(true); }}
                      onFocus={() => { setMemberDropdownOpen(true); setHighlightedIdx(0); }}
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIdx(p => Math.min(p + 1, filteredMemberOptions.length - 1)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIdx(p => Math.max(p - 1, 0)); }
                        else if (e.key === 'Enter') { e.preventDefault(); if (filteredMemberOptions[highlightedIdx]) { setSelectedMembers(p => [...p, filteredMemberOptions[highlightedIdx].id]); setMemberSearchInput(''); setHighlightedIdx(0); } }
                        else if (e.key === 'Escape') { setMemberDropdownOpen(false); setMemberSearchInput(''); }
                        else if (e.key === 'Backspace' && memberSearchInput === '' && selectedMembers.length > 0) { setSelectedMembers(p => p.slice(0, -1)); }
                      }}
                      placeholder={selectedMembers.length === 0 ? 'Search members…' : ''}
                      style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: TEXT, fontFamily: 'inherit' }}
                      disabled={isSubmitting}
                    />
                  </>
                )}
              </div>

             {/* Members dropdown — portal so it renders above the modal */}
              {memberDropdownOpen && !usersLoading && filteredMemberOptions.length > 0 && memberDropRect && ReactDOM.createPortal(
                <div style={{
                  position: 'fixed',
                  top: memberDropRect.bottom + 6,
                  left: memberDropRect.left,
                  width: memberDropRect.width,
                  zIndex: 99999,
                  background: 'hsl(var(--popover))', border: `1px solid ${LINE}`,
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
                  maxHeight: 220, overflowY: 'auto', padding: '4px 0',
                }}>
                  {filteredMemberOptions.map((u, i) => (
                    <div
                      key={u.id}
                      onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedMembers(p => [...p, u.id]);
                        setMemberSearchInput('');
                        setHighlightedIdx(0);
                        setMemberDropdownOpen(false);
                      }}
                      onMouseEnter={() => setHighlightedIdx(i)}
                      style={{
                        padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                        color: i === highlightedIdx ? BLUE : TEXT,
                        background: i === highlightedIdx ? `${BLUE}18` : 'transparent',
                      }}
                    >
                      {u.label}
                    </div>
                  ))}
                </div>,
                document.body
              )}
            </div>
          </div>
        </div>

        {/* ── Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 24px 20px', borderTop: `1px solid ${LINE}`, flexShrink: 0, background: 'hsl(var(--muted)/0.5)' }}>
          <button onClick={handleClose} disabled={isSubmitting}
            style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${LINE}`, background: 'hsl(var(--muted))', fontSize: 13, fontWeight: 500, color: MUTED, cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
            onMouseLeave={e => e.currentTarget.style.background = 'hsl(var(--muted))'}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: isSubmitting ? '#94a3b8' : BLUE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isSubmitting ? (
              <><div style={{ width: 13, height: 13, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />Creating…</>
            ) : 'Create Team'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}