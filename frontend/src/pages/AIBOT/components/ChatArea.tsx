import { Send, Bot, Loader2 } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { AgentUIMessage } from '@/types';

const TEXT  = '#172033';
const MUTED = '#667085';
const LINE  = '#e6ebf2';

interface ChatAreaProps {
  messages:        AgentUIMessage[];
  isTyping:        boolean;
  historyLoading:  boolean;
  input:           string;
  setInput:        (v: string) => void;
  onSend:          () => void;
  onKeyDown:       (e: React.KeyboardEvent) => void;
  onNewConversation: () => void;
  messagesEndRef:  React.RefObject<HTMLDivElement>;
  inputRef:        React.RefObject<HTMLTextAreaElement>;
}

const SUGGESTIONS = [
  'Create a task called Fix login bug in ZanFlow with high priority',
  'List all open tasks assigned to me',
  'Summarise my open tasks for today\'s standup',
  'Show me all projects I\'m part of',
];

export function ChatArea({ messages, isTyping, historyLoading, input, setInput, onSend, onKeyDown, onNewConversation, messagesEndRef, inputRef }: ChatAreaProps) {
  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#f9fafb' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 8px' }}>
        {historyLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
            <Loader2 style={{ width: 22, height: 22, color: MUTED, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : isEmpty ? (
          /* ── Empty state ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 24px', gap: 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Bot style={{ width: 26, height: 26, color: '#fff' }} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: TEXT, letterSpacing: '-.02em', margin: '0 0 6px' }}>Dyuksa AI</h3>
            <p style={{ fontSize: 14, color: MUTED, marginBottom: 28 }}>Ask me anything about your projects, tasks, and notes.</p>

            {/* Suggestion chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 440 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 10, border: '1px solid #e6ebf2', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', lineHeight: 1.4 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0f4ff'; e.currentTarget.style.borderColor = '#1663f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e6ebf2'; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => {
              const isStreamingMsg = isTyping && i === messages.length - 1 && m.role === 'assistant';
              if (isStreamingMsg && m.content === '') return null;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isStreaming={isStreamingMsg}
                />
              );
            })}

            {/* Typing indicator  */}
            {isTyping && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot style={{ width: 16, height: 16, color: '#fff' }} />
                </div>
                <div style={{ background: '#fff', border: '1px solid #e6ebf2', borderRadius: '4px 18px 18px 18px', padding: '12px 16px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 150, 300].map(delay => (
                    <span key={delay} style={{ width: 7, height: 7, borderRadius: '50%', background: '#9ca3af', display: 'inline-block', animation: `bounce 1.2s ease-in-out ${delay}ms infinite` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div style={{ padding: '12px 20px 16px', background: '#fff', borderTop: `1px solid ${LINE}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: '#f3f4f6', borderRadius: 12, padding: '8px 12px', border: '1px solid #e6ebf2', transition: 'border-color .2s' }}
          onFocusCapture={e => e.currentTarget.style.borderColor = '#1663f6'}
          onBlurCapture={e => e.currentTarget.style.borderColor = '#e6ebf2'}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything…  (Enter to send, Shift+Enter for new line)"
            rows={1}
            style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: TEXT, fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button onClick={onSend} disabled={!input.trim() || isTyping}
            style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: !input.trim() || isTyping ? '#e5e7eb' : '#1663f6', cursor: !input.trim() || isTyping ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
            <Send style={{ width: 15, height: 15, color: !input.trim() || isTyping ? '#9ca3af' : '#fff' }} />
          </button>
        </div>
        <p style={{ fontSize: 10, color: MUTED, textAlign: 'center', marginTop: 6 }}>
          Dyuksa AI can make mistakes. Verify important information.
        </p>
      </div>

      {/* Bounce animation */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}