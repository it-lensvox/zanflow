import { useState, useRef, useEffect } from 'react';
import { Plus, Maximize2, ChevronDown, PanelLeftOpen, PanelLeftClose, MoreHorizontal, Pencil, Trash2, Sparkles } from 'lucide-react';

interface ChatHeaderProps {
  variant:           'mini' | 'fullscreen';
  isHistoryOpen:     boolean;
  activeSessionId:   number | null;
  sessionTitle:      string;
  onToggleHistory:   () => void;
  onNewConversation: () => void;
  onMaximize?:       () => void;
  onClose:           () => void;
  onRename:          (newTitle: string) => void;
  onDelete:          () => void;
}

function IconBtn({ icon, onClick, title, accent }: { icon: React.ReactNode; onClick: () => void; title: string; accent?: boolean }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: accent ? 'rgba(22,99,246,.1)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent ? '#1663f6' : '#64748b', transition: 'all .15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = accent ? 'rgba(22,99,246,.18)' : '#f1f5f9'; }}
      onMouseLeave={e => { e.currentTarget.style.background = accent ? 'rgba(22,99,246,.1)' : 'none'; }}>
      {icon}
    </button>
  );
}

export function ChatHeader({ variant, isHistoryOpen, activeSessionId, sessionTitle, onToggleHistory, onNewConversation, onMaximize, onClose, onRename, onDelete }: ChatHeaderProps) {
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal,  setRenameVal]  = useState('');
  const menuRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  useEffect(() => { if (isRenaming) inputRef.current?.focus(); }, [isRenaming]);

  const commitRename = () => {
    const t = renameVal.trim();
    if (t && t !== sessionTitle) onRename(t);
    setIsRenaming(false);
  };

  const menuItems = [
    { icon: <Pencil style={{ width: 13, height: 13 }} />, label: 'Rename', action: () => { setRenameVal(sessionTitle); setIsRenaming(true); setMenuOpen(false); }, color: '#374151' },
    { icon: <Trash2 style={{ width: 13, height: 13 }} />, label: 'Delete', action: () => { onDelete(); setMenuOpen(false); },                                      color: '#ef4444' },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: variant === 'mini' ? '9px 12px' : '11px 18px',
      borderBottom: '1px solid #e6ebf2',
      background: '#fff',
      flexShrink: 0, gap: 8,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
        <IconBtn
          icon={isHistoryOpen ? <PanelLeftClose style={{ width: 15, height: 15 }} /> : <PanelLeftOpen style={{ width: 15, height: 15 }} />}
          onClick={onToggleHistory}
          title={isHistoryOpen ? 'Close history' : 'Open history'}
        />

        {/* AI badge + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles style={{ width: 10, height: 10, color: '#60a5fa' }} />
          </div>

          {isRenaming ? (
            <input ref={inputRef} value={renameVal} onChange={e => setRenameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setIsRenaming(false); }}
              onBlur={commitRename}
              style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#172033', border: 'none', borderBottom: '1.5px solid #1663f6', outline: 'none', background: 'transparent', padding: '1px 0', minWidth: 0 }} />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#172033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {sessionTitle}
            </span>
          )}
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <IconBtn icon={<Plus style={{ width: 14, height: 14 }} />} onClick={onNewConversation} title="New conversation" />

        {variant === 'mini' && onMaximize && (
          <IconBtn icon={<Maximize2 style={{ width: 14, height: 14 }} />} onClick={onMaximize} title="Full screen" />
        )}

        {activeSessionId && (
          <div style={{ position: 'relative' }} ref={menuRef}>
            <IconBtn icon={<MoreHorizontal style={{ width: 14, height: 14 }} />} onClick={() => setMenuOpen(v => !v)} title="More options" />
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 36, zIndex: 200, minWidth: 164, background: '#fff', border: '1px solid #e6ebf2', borderRadius: 10, boxShadow: '0 8px 32px rgba(16,24,40,.14)', padding: '4px 0' }}>
                {menuItems.map(item => (
                  <button key={item.label} onClick={item.action}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: item.color, textAlign: 'left', fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.background = item.color === '#ef4444' ? '#fef2f2' : '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    {item.icon}{item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <IconBtn icon={<ChevronDown style={{ width: 14, height: 14 }} />} onClick={onClose} title="Close" />
      </div>
    </div>
  );
}