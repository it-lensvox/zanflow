import { Send, Sparkles, Zap, ListTodo, FolderKanban, FileText } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { AgentUIMessage } from '@/types';
import { MUTED } from '@/config/tokens';

const TEXT = '#0f172a';

interface ChatAreaProps {
  messages:          AgentUIMessage[];
  isTyping:          boolean;
  historyLoading:    boolean;
  input:             string;
  setInput:          (v: string) => void;
  onSend:            () => void;
  onKeyDown:         (e: React.KeyboardEvent) => void;
  onNewConversation: () => void;
  messagesEndRef:    React.RefObject<HTMLDivElement>;
  inputRef:          React.RefObject<HTMLTextAreaElement>;
  onCloseChat:       () => void;
}

const SUGGESTIONS = [
  { icon: <ListTodo style={{ width: 13, height: 13 }} />,     label: 'Tasks',    text: 'List all open tasks assigned to me',                    accent: '#3b5bdb' },
  { icon: <FolderKanban style={{ width: 13, height: 13 }} />, label: 'Projects', text: 'Show me all projects I\'m part of',                     accent: '#7c3aed' },
  { icon: <Zap style={{ width: 13, height: 13 }} />,          label: 'Create',   text: 'Create a task called Fix login bug in ZanFlow — high',  accent: '#ea580c' },
  { icon: <FileText style={{ width: 13, height: 13 }} />,     label: 'Standup',  text: 'Summarise my open tasks for today\'s standup',          accent: '#0891b2' },
];

export function ChatArea({ messages, isTyping, historyLoading, input, setInput, onSend, onKeyDown, onNewConversation, messagesEndRef, inputRef, onCloseChat }: ChatAreaProps) {
  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#f8faff' }}>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 12px' }}>

        {historyLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #1e3a5f, #1663f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s ease-in-out infinite' }}>
              <Sparkles style={{ width: 20, height: 20, color: '#93c5fd' }} />
            </div>
            <p style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>Loading conversation…</p>
          </div>

        ) : isEmpty ? (
          /* ── Empty state ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 16px' }}>

            {/* Hero mark */}
            <div style={{ position: 'relative', marginBottom: 22 }}>
              <div style={{ width: 68, height: 68, borderRadius: 20, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1663f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 40px rgba(22,99,246,.25), 0 4px 12px rgba(0,0,0,.15)' }}>
                <Sparkles style={{ width: 30, height: 30, color: '#93c5fd' }} />
              </div>
              {/* Online dot */}
              <div style={{ position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, borderRadius: '50%', background: '#22c55e', border: '3px solid #f8faff', boxShadow: '0 0 8px rgba(34,197,94,.6)' }} />
            </div>

            <h3 style={{ fontSize: 22, fontWeight: 800, color: TEXT, letterSpacing: '-.03em', margin: '0 0 6px', textAlign: 'center' }}>Dyuksa AI</h3>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 28, textAlign: 'center', lineHeight: 1.5, maxWidth: 280 }}>
              Your intelligent workspace assistant
            </p>

            {/* 2×2 suggestion grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 420 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => { setInput(s.text); inputRef.current?.focus(); }}
                  style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', transition: 'all .15s', display: 'flex', flexDirection: 'column', gap: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = s.accent; e.currentTarget.style.boxShadow = `0 4px 16px ${s.accent}20`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: `${s.accent}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.accent }}>
                    {s.icon}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.accent, textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>{s.label}</span>
                  <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.3 }}>{s.text.slice(0, 44)}{s.text.length > 44 ? '…' : ''}</span>
                </button>
              ))}
            </div>
          </div>

        ) : (
          <>
            {messages.map((m, i) => {
              const isStreamingMsg = isTyping && i === messages.length - 1 && m.role === 'assistant';
              if (isStreamingMsg && m.content === '') return null;
              return <MessageBubble key={m.id} message={m} isStreaming={isStreamingMsg} onCloseChat={onCloseChat} />;
            })}

            {/* Typing indicator */}
            {isTyping && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingRight: 48 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles style={{ width: 14, height: 14, color: '#93c5fd' }} />
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px 18px 18px 18px', padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center', boxShadow: '0 2px 10px rgba(16,24,40,.06)' }}>
                  {[0, 160, 320].map(delay => (
                    <span key={delay} style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', display: 'inline-block', animation: `aiDot 1.4s ease-in-out ${delay}ms infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 20px 14px', background: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8faff', borderRadius: 14, padding: '13px 14px', border: '1.5px solid #e2e8f0', transition: 'all .2s' }}
          onFocusCapture={e => { e.currentTarget.style.borderColor = '#1663f6'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
          onBlurCapture={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8faff'; e.currentTarget.style.boxShadow = 'none'; }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Ask Dyuksa AI anything…" rows={1}
            style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: TEXT, fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', display: 'block', paddingTop: 2 }}
            onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; }} />
          <button onClick={onSend} disabled={!input.trim() || isTyping}
            style={{ width: 34, height: 34, borderRadius: 10, border: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', cursor: !input.trim() || isTyping ? 'not-allowed' : 'pointer', background: !input.trim() || isTyping ? '#e2e8f0' : 'linear-gradient(135deg, #1663f6, #0f4bd4)', boxShadow: !input.trim() || isTyping ? 'none' : '0 4px 12px rgba(22,99,246,.35)' }}>
            <Send style={{ width: 14, height: 14, color: !input.trim() || isTyping ? '#94a3b8' : '#fff' }} />
          </button>
        </div>
        <p style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 7, letterSpacing: '.01em' }}>
          Dyuksa AI · Workspace assistant · May make mistakes
        </p>
      </div>

      <style>{`
        @keyframes aiDot { 0%,80%,100%{transform:scale(1);opacity:.4} 40%{transform:scale(1.35);opacity:1} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(22,99,246,.4)} 50%{box-shadow:0 0 0 8px rgba(22,99,246,0)} }
      `}</style>
    </div>
  );
}