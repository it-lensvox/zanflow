import { Bot } from 'lucide-react';
import { markdownToHtml, RichTextEditor } from '@/components/common/RichTextEditor';
import type { AgentUIMessage } from '@/types';

const TEXT  = '#172033';
const MUTED = '#667085';

interface MessageBubbleProps {
  message:    AgentUIMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const time   = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{ maxWidth: '72%' }}>
          <div style={{
            background: '#1663f6', color: '#fff',
            borderRadius: '18px 18px 4px 18px',
            padding: '10px 16px',
            fontSize: 14, lineHeight: 1.6, fontWeight: 400,
            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          }}>
            {message.content}
          </div>
          <p style={{ fontSize: 10, color: MUTED, textAlign: 'right', marginTop: 4 }}>{time}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
      {/* Bot avatar */}
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        <Bot style={{ width: 16, height: 16, color: '#fff' }} />
      </div>

      <div style={{ maxWidth: '75%', minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 4 }}>Dyuksa AI</p>
        <div style={{
          background: '#fff', border: '1px solid #e6ebf2',
          borderRadius: '4px 18px 18px 18px',
          padding: '10px 16px',
          fontSize: 14, color: TEXT, lineHeight: 1.7,
          boxShadow: '0 1px 4px rgba(16,24,40,.06)',
          wordBreak: 'break-word',
          minWidth: 40, minHeight: 20,
        }}>
          {isStreaming ? (
            /* Plain text during streaming — RichTextEditor can't handle rapid updates */
            <span style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: TEXT, lineHeight: 1.7 }}>
              {message.content}
              <span style={{ display: 'inline-block', width: 2, height: 14, background: '#1663f6', marginLeft: 2, animation: 'blink .7s step-end infinite', verticalAlign: 'text-bottom' }} />
            </span>
          ) : (
            /* Rich markdown render once streaming is done */
            <RichTextEditor
              value={markdownToHtml(typeof message.content === 'string' ? message.content : '')}
              onChange={() => {}}
              readOnly
              showToolbar={false}
              minHeight="0px"
              className="!border-0 !ring-0 !bg-transparent !rounded-none [&_.ProseMirror]:!p-0 [&_.ProseMirror]:!min-h-0"
            />
          )}
        </div>
       <p style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{time}</p>
      </div>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}