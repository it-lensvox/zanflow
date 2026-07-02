import { Sparkles } from 'lucide-react';
import { markdownToHtml, RichTextEditor } from '@/components/common/RichTextEditor';
import { EntityCards, parseToolResult } from './Entitycard';
import type { AgentUIMessage } from '@/types';

const TEXT  = '#172033';
const MUTED = '#667085';

interface MessageBubbleProps {
  message:     AgentUIMessage;
  isStreaming?: boolean;
  onCloseChat?: () => void;
}

export function MessageBubble({ message, isStreaming = false, onCloseChat }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const time   = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const entities = !isStreaming
    ? parseToolResult(message.toolCalled || null, message.toolResult || null)
    : null;
  const hasEntities = !!(entities && (
    (entities.tasks         && entities.tasks.length    > 0) ||
    (entities.projects      && entities.projects.length > 0) ||
    (entities.notes         && entities.notes.length    > 0) ||
    entities.openChat                                        ||
    entities.createdProject                                  ||
    (entities.members       && entities.members.length    > 0) ||
    (entities.workspaces    && entities.workspaces.length > 0)
  ));

  // ── User bubble 
  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20, paddingLeft: 40 }}>
        <div style={{ maxWidth: '78%' }}>
          <div style={{
            background: 'linear-gradient(135deg, #1663f6 0%, #0f4bd4 100%)',
            color: '#fff',
            borderRadius: '20px 20px 4px 20px',
            padding: '11px 18px',
            fontSize: 14, lineHeight: 1.6, fontWeight: 400,
            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
            boxShadow: '0 4px 14px rgba(22,99,246,.25)',
          }}>
            {message.content}
          </div>
          <p style={{ fontSize: 10, color: MUTED, textAlign: 'right', marginTop: 5 }}>{time}</p>
        </div>
      </div>
    );
  }

  // ── Bot bubble 
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, paddingRight: 40 }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0, marginTop: 2,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      }}>
        <Sparkles style={{ width: 14, height: 14, color: '#60a5fa' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' as const }}>
          Dyuksa AI
        </p>

        {isStreaming ? (
          <div style={{
            background: '#fff', border: '1px solid #e6ebf2',
            borderRadius: '4px 20px 20px 20px',
            padding: '12px 18px',
            fontSize: 14, color: TEXT, lineHeight: 1.7,
            boxShadow: '0 2px 12px rgba(16,24,40,.06)',
            minWidth: 40, minHeight: 20,
          }}>
            <span style={{ whiteSpace: 'pre-wrap' }}>
              {message.content}
              <span style={{ display: 'inline-block', width: 2, height: 14, background: '#1663f6', marginLeft: 2, animation: 'blink .7s step-end infinite', verticalAlign: 'text-bottom' }} />
            </span>
          </div>
        ) : (
          <div style={{
            background: '#fff', border: '1px solid #e6ebf2',
            borderRadius: '4px 20px 20px 20px',
            padding: '12px 18px',
            fontSize: 14, color: TEXT, lineHeight: 1.7,
            boxShadow: '0 2px 12px rgba(16,24,40,.06)',
            minWidth: 40, minHeight: 20,
          }}>
           {hasEntities ? (
              /* Cards only  */
              entities && <EntityCards entities={entities} filtersUsed={message.filtersUsed ?? null} onCloseChat={onCloseChat} />
            ) : (
              /* Plain text response — no entity data detected */
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
        )}

        <p style={{ fontSize: 10, color: MUTED, marginTop: 5 }}>{time}</p>
      </div>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}