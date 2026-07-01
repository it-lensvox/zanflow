import { Sparkles, Minus } from 'lucide-react';
import { useAIBot }       from './hooks/useAIBot';
import { HistoryPanel }   from './components/HistoryPanel';
import { ChatArea }       from './components/ChatArea';
import { ChatHeader }     from './components/ChatHeader';

export function AIBot() {
  const b = useAIBot();

  // ── Minimized widget — shown in bottom-right, restores on click ─
  if (b.isExpanded && b.isMinimized) {
    return (
      <button
        onClick={() => b.setIsMinimized(false)}
        title="Restore Dyuksa AI"
        style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 60, height: 44, borderRadius: 22, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1663f6 100%)', border: 'none', boxShadow: '0 4px 20px rgba(22,99,246,.4), 0 2px 8px rgba(0,0,0,.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 0 12px', color: '#fff', transition: 'transform .15s, box-shadow .15s', userSelect: 'none' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(22,99,246,.5), 0 4px 12px rgba(0,0,0,.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(22,99,246,.4), 0 2px 8px rgba(0,0,0,.3)'; }}
      >
        <Sparkles style={{ width: 16, height: 16, color: '#93c5fd', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Dyuksa AI
        </span>
      </button>
    );
  }

  // ── Collapsed FAB ─
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

  // ── Shared inner layout ──
  const innerLayout = (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', borderRadius: 16 }}>

      {/* History sidebar */}
      <div style={{ width: b.isHistoryOpen ? 240 : 0, flexShrink: 0, overflow: 'hidden', transition: 'width .25s ease', borderRight: b.isHistoryOpen ? '1px solid #1e293b' : 'none' }}>
        {b.isHistoryOpen && (
          <HistoryPanel
            sessions={b.sessions}
            activeSessionId={b.activeSessionId}
            searchQuery={b.searchQuery}
            setSearchQuery={b.setSearchQuery}
            isLoading={b.sessionsLoading}
            onSelectSession={id => b.loadSessionHistory(id)}
            onNewConversation={b.startNewConversation}
            onRenameSession={(id, title) => b.renameSession(title, id)}
            onPinSession={(id, isPinned) => b.pinSession(id, isPinned)}
            onDeleteSession={id => b.deleteSession(id)}
            onBulkDelete={ids => b.bulkDeleteSessions(ids)}
          />
        )}
      </div>

      {/* Chat column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <ChatHeader
          isHistoryOpen={b.isHistoryOpen}
          activeSessionId={b.activeSessionId}
          sessionTitle={b.activeSessionId ? (b.sessions.find(s => s.id === b.activeSessionId)?.title || `Conversation ${b.activeSessionId}`) : 'Dyuksa AI'}
          onToggleHistory={() => b.setIsHistoryOpen(v => !v)}
          onNewConversation={b.startNewConversation}
         onMinimize={b.handleMinimize}
          onClose={() => { b.setIsExpanded(false); b.setIsFullScreen(false); b.setIsMinimized(false); }}
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
          onCloseChat={() => { b.setIsExpanded(false); b.setIsFullScreen(false); }}
        />
      </div>
    </div>
  );

  // ── Full-screen modal
  if (b.isExpanded) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }}>
        <div style={{ width: b.isHistoryOpen ? 'min(1280px, calc(100vw - 48px))' : 'min(1040px, calc(100vw - 48px))', height: 'calc(100vh - 80px)', background: '#fff', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,.25)', overflow: 'hidden', transition: 'width .25s ease' }}>
          {innerLayout}
        </div>
      </div>
    );
  }

  return null;
}

export default AIBot;