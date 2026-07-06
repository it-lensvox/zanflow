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

      {/* Modal */}
      <div
        className={cn(
          'relative bg-card border rounded-lg shadow-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200',
          maxWidth,
          className,
        )}
      >
        {children}
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
      className="flex items-center justify-between p-6 border-b sticky top-0 bg-card z-10 gap-4"
      style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif' }}
    >
      <div className="min-w-0">
        <h2 className="text-ls font-semibold truncate">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}