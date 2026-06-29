import { Sparkles } from 'lucide-react';
import { useAIBot }       from './hooks/useAIBot';
import { HistoryPanel }   from './components/HistoryPanel';
import { ChatArea }       from './components/ChatArea';
import { ChatHeader }     from './components/ChatHeader';

export function AIBot() {
  const b = useAIBot();

  // ── Collapsed FAB ──────────────────────────────────────────────────────────
  if (!b.isExpanded) {
    return (
      <button
        onMouseDown={b.handleFabMouseDown}
        onClick={b.handleFabClick}
        title="Open Dyuksa AI (drag to reposition)"
        style={{ position: 'fixed', left: b.fabPos.x, top: b.fabPos.y, zIndex: 60, width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1663f6 100%)', border: 'none', boxShadow: '0 4px 20px rgba(22,99,246,.4), 0 2px 8px rgba(0,0,0,.3)', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'transform .15s, box-shadow .15s', userSelect: 'none' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(22,99,246,.5), 0 4px 12px rgba(0,0,0,.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(22,99,246,.4), 0 2px 8px rgba(0,0,0,.3)'; }}
      >
        <Sparkles style={{ width: 22, height: 22, pointerEvents: 'none', color: '#93c5fd' }} />
      </button>
    );
  }

  // ── Shared inner layout ────────────────────────────────────────────────────
  const innerLayout = (variant: 'mini' | 'fullscreen') => (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', borderRadius: variant === 'mini' ? 14 : 16 }}>

      {/* History sidebar */}
      <div style={{ width: b.isHistoryOpen ? 240 : 0, flexShrink: 0, overflow: 'hidden', transition: 'width .25s ease', borderRight: b.isHistoryOpen ? '1px solid #1e293b' : 'none' }}>
        {b.isHistoryOpen && (
          <HistoryPanel
            sessions={b.sessions}
            activeSessionId={b.activeSessionId}
            searchQuery={b.searchQuery}
            setSearchQuery={b.setSearchQuery}
            isLoading={b.sessionsLoading}
            onSelectSession={id => { b.loadSessionHistory(id); if (variant === 'mini') b.setIsHistoryOpen(false); }}
            onNewConversation={b.startNewConversation}
            onRenameSession={(id, title) => b.renameSession(title, id)}
            onPinSession={(id, isPinned) => b.pinSession(id, isPinned)}
            onDeleteSession={id => b.deleteSession(id)}
          />
        )}
      </div>

      {/* Chat column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <ChatHeader
          variant={variant}
          isHistoryOpen={b.isHistoryOpen}
          activeSessionId={b.activeSessionId}
          sessionTitle={b.activeSessionId ? (b.sessions.find(s => s.id === b.activeSessionId)?.title || `Conversation ${b.activeSessionId}`) : 'Dyuksa AI'}
          onToggleHistory={() => b.setIsHistoryOpen(v => !v)}
          onNewConversation={b.startNewConversation}
          onMaximize={variant === 'mini' ? () => { b.setIsFullScreen(true); b.setIsHistoryOpen(false); } : undefined}
          onClose={variant === 'fullscreen'
            ? () => { b.setIsFullScreen(false); b.setIsHistoryOpen(false); }
            : () => { b.setIsExpanded(false); b.setIsHistoryOpen(false); }
          }
          onRename={b.renameSession}
          onDelete={b.deleteSession}
        />
        <ChatArea
          messages={b.messages}
          isTyping={b.isTyping}
          historyLoading={b.historyLoading}
          input={b.input}
          setInput={b.setInput}
          onSend={b.sendMessage}
          onKeyDown={b.handleKeyDown}
          onNewConversation={b.startNewConversation}
          messagesEndRef={b.messagesEndRef}
          inputRef={b.inputRef}
        />
      </div>
    </div>
  );

  // ── Full-screen modal ──────────────────────────────────────────────────────
  if (b.isFullScreen) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }}>
        <div style={{ width: b.isHistoryOpen ? 'min(920px, calc(100vw - 48px))' : 'min(700px, calc(100vw - 48px))', height: 'calc(100vh - 80px)', background: '#fff', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,.25)', overflow: 'hidden', transition: 'width .25s ease' }}>
          {innerLayout('fullscreen')}
        </div>
      </div>
    );
  }

  // ── Mini widget ────────────────────────────────────────────────────────────
  const miniW = b.isHistoryOpen ? 660 : 400;
  const left  = Math.min(Math.max(b.fabPos.x + 24 - miniW / 2, 8), window.innerWidth  - miniW - 8);
  const top   = Math.min(Math.max(b.fabPos.y - 616, 8),          window.innerHeight - 624);

  return (
    <div style={{ position: 'fixed', zIndex: 55, left, top, width: miniW, height: 608, background: '#fff', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,.18)', border: '1px solid #e6ebf2', overflow: 'hidden', transition: 'width .25s ease' }}>
      {innerLayout('mini')}
    </div>
  );
}

export default AIBot;