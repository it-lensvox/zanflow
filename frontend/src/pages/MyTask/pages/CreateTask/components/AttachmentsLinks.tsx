import React from 'react';
import { Paperclip, Link, Plus, Trash2, UploadCloud } from 'lucide-react';
import { FormField } from './FormField';
import { LINE, INPUT_STYLE, MUTED, TEXT, BLUE } from '../createTaskConstants';

interface AttachmentsLinksProps {
  attachments: File[];
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeAttachment: (i: number) => void;
  linkInput: string;
  setLinkInput: (v: string) => void;
  links: string[];
  handleAddLink: () => void;
  removeLink: (i: number) => void;
}

export function AttachmentsLinks({
  attachments, handleFileChange, removeAttachment,
  linkInput, setLinkInput, links, handleAddLink, removeLink,
}: AttachmentsLinksProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Links */}
      <div>
        <FormField label="Links" icon={<Link size={13} />}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={linkInput}
              onChange={e => setLinkInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
              placeholder="Paste URL…"
              style={INPUT_STYLE}
              onFocus={e => { e.currentTarget.style.borderColor = '#1663f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,99,246,.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <button
              type="button"
              onClick={handleAddLink}
              style={{
                width: 38, height: 38, flexShrink: 0,
                border: `1px solid ${LINE}`, borderRadius: 8,
                background: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: BLUE, transition: 'background .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#eef3ff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <Plus size={15} />
            </button>
          </div>
          {links.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {links.map((link, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 7,
                    background: '#f7f8fb', border: `1px solid ${LINE}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <Link size={11} color={MUTED} />
                    <a
                      href={link.startsWith('http') ? link : `https://${link}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: BLUE, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {link}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLink(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: '2px', display: 'flex' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </FormField>
      </div>

      {/* Attachments */}
      <div>
        <FormField label="Attachments" icon={<Paperclip size={13} />}>
          <div
            style={{
              border: `1.5px dashed ${LINE}`, borderRadius: 8,
              padding: '16px 12px', textAlign: 'center',
              background: '#fafbfc', cursor: 'pointer', position: 'relative',
              transition: 'border-color .15s',
            }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#1663f6'; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = LINE; }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.style.borderColor = LINE;
              if (e.dataTransfer.files) {
                // trigger handleFileChange manually
                const dt = { target: { files: e.dataTransfer.files } } as any;
                handleFileChange(dt);
              }
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#1663f6')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = LINE)}
          >
            <input
              type="file" multiple accept="*"
              onChange={handleFileChange}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            />
            <UploadCloud size={20} color={MUTED} style={{ margin: '0 auto 6px' }} />
            <p style={{ fontSize: 12, color: TEXT }}>
              <span style={{ color: BLUE, fontWeight: 500 }}>Click to upload</span> or drag & drop
            </p>
            <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Max 500 MB</p>
          </div>
          {attachments.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {attachments.map((file, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 7,
                    background: '#f7f8fb', border: `1px solid ${LINE}`,
                  }}
                >
                  <Paperclip size={12} color={MUTED} />
                  <span style={{ fontSize: 12, color: TEXT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                  <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: '2px', display: 'flex' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </FormField>
      </div>
    </div>
  );
}