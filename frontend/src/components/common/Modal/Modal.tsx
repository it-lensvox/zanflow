import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxWidth?: 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl';
  disableOverlayClose?: boolean;
  children: React.ReactNode;
  className?: string;
}


export function Modal({
  isOpen,
  onClose,
  maxWidth = 'max-w-2xl',
  disableOverlayClose = false,
  children,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);


  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !disableOverlayClose && onClose()}
      />

      {/* Modal — overflow visible so absolute dropdowns inside are never clipped.
          Scrolling is handled by the inner wrapper. */}
      <div
        className={cn(
          'relative bg-card border rounded-lg shadow-lg w-full animate-in fade-in zoom-in-95 duration-200',
          maxWidth,
          className,
        )}
        style={{ maxHeight: '90vh', overflow: 'visible' }}
      >
        {/* Inner scroll container — clips content but not absolute-positioned overlays */}
        <div style={{ maxHeight: '90vh', overflowY: 'auto', borderRadius: 'inherit' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  actions?: React.ReactNode;
}

// Standard modal header — sticky title/subtitle + close button, matching
export function ModalHeader({ title, subtitle, onClose, actions }: ModalHeaderProps) {
  return (
    <div
      className="flex items-center justify-between border-b sticky top-0 bg-card z-10 gap-3"
      style={{ padding: '10px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}
    >
      <div className="min-w-0 flex items-center gap-2">
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#172033', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h2>
        {subtitle && (
          <span style={{ fontSize: 12, color: '#667085', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            — {subtitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        <button
          type="button"
          onClick={onClose}
          className="hover:bg-accent rounded-lg transition-colors"
          style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', border: 'none', background: 'none', cursor: 'pointer' }}
          aria-label="Close"
        >
          <X className="h-4 w-4" style={{ color: '#667085' }} />
        </button>
      </div>
    </div>
  );
}